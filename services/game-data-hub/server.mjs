import http from "node:http";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchBazaarAuctionDetail } from "./bazaar-detail.mjs";
import { buildBazaarOverviewSourceUrl, fetchBazaarOverview } from "./bazaar-overview.mjs";
import { closeBazaarBrowser } from "./bazaar-scraper.mjs";
import {
  MINI_WORLD_CHANGES_KEY,
  collectMiniWorldChanges,
  getDueMiniWorldChangeSlots,
  getTodayDueMiniWorldChangeSlots,
  normalizeMiniWorldChangesConfig,
  pruneCompletedMiniWorldChangeSlots
} from "./mini-world-changes.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4318;
const DEFAULT_TICK_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_STATE_FILE_PATH = path.join(__dirname, "data", "state.json");

const DEFAULT_REFRESH = {
  tibiaStatisticWorldsMs: 60_000,
  boostedMs: 60_000,
  tibiaDataWorldsMs: 60_000,
  tibiaDataWorldDetailMs: 60_000,
  tibiaDataGuildsMs: 5 * 60_000,
  tibiaDataGuildDetailMs: 5 * 60_000,
  tibiaDataHousesMs: 5 * 60_000,
  tibiaDataHouseDetailMs: 5 * 60_000,
  tibiaDataKillStatisticsMs: 5 * 60_000,
  tibiaDataHighscoresMs: 5 * 60_000,
  tibiaDataNewsMs: 5 * 60_000,
  tibiaDataCharacterMs: 5 * 60_000,
  bazaarCurrentMs: 5 * 60_000,
  bazaarHistoryMs: 15 * 60_000,
  bazaarDetailMs: 30 * 60_000,
  rookieWorldsMs: 5 * 60_000,
  rookieTrendingMs: 5 * 60_000,
  bossWorldMs: 15 * 60_000,
  bossDetailMs: 15 * 60_000,
  rookieCharactersMs: 5 * 60_000,
  rookieCharacterDetailMs: 10 * 60_000
};

const TIBIA_STATISTIC_BASE = "https://www.tibia-statistic.com";
const GUILDSTATS_BASE = "https://guildstats.eu";
const TIBIA_ROUTE_BASE = "https://tibiaroute.com";
const TIBIA_DATA_BASE = "https://api.tibiadata.com";
const ROOKIE_BASE = "https://dev.rookie.com.pl";
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};
const NEWS_ARCHIVE_KEY = "td-news-archive";
const NEWS_ARCHIVE_SEED_COUNT = 15;
const NEWS_ARCHIVE_TRANSLATION_MODEL = "gpt-5-mini";
const NEWS_ARCHIVE_INITIAL_IDS = new Set([
  8842, 8819, 8872, 8875, 8869, 8870, 8866, 8846,
  8806, 8862, 8850, 8803, 8847, 8849, 8843
]);
const NEWS_ARCHIVE_CUTOFF_DATE = "2026-07-13";

export async function createGameDataHubServer(overrides = {}) {
  const config = await loadConfig(overrides);
  const runtime = {
    schedulerTimer: null,
    inFlight: new Map(),
    stateSaveInFlight: Promise.resolve()
  };
  const state = await loadState(config.stateFilePath);

  normalizeState(state);
  await saveState(config, runtime, state);

  const scheduledModules = buildScheduledModules(config);

  const server = http.createServer((request, response) => {
    void handleRequest({ request, response, config, runtime, state, scheduledModules });
  });
  server.requestTimeout = Math.max(30_000, Math.min(config.timeoutMs + 5_000, 120_000));
  server.headersTimeout = server.requestTimeout + 5_000;
  server.keepAliveTimeout = 5_000;

  async function start() {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.port, config.host, () => {
        server.off("error", reject);
        resolve();
      });
    });

    runtime.schedulerTimer = setInterval(() => {
      void schedulerTick({ config, runtime, state, scheduledModules });
    }, config.tickMs);
    runtime.schedulerTimer.unref?.();
    void schedulerTick({ config, runtime, state, scheduledModules });

    return {
      host: config.host,
      port: server.address()?.port || config.port
    };
  }

  async function close() {
    if (runtime.schedulerTimer) {
      clearInterval(runtime.schedulerTimer);
      runtime.schedulerTimer = null;
    }

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await closeBazaarBrowser().catch(() => {});
  }

  return {
    server,
    config,
    state,
    start,
    close
  };
}

async function handleRequest({ request, response, config, runtime, state, scheduledModules }) {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `${config.host}:${config.port}`}`);

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    if (url.pathname === "/healthz") {
      sendJson(response, 200, { ok: true, service: "game-data-hub" });
      return;
    }

    if (url.pathname === "/status" || url.pathname === "/api/game/status") {
      sendJson(response, 200, buildStatusPayload({ config, state, scheduledModules }));
      return;
    }

    if (url.pathname === "/api/game/worlds/statistics") {
      const payload = await getCombinedWorldStatistics({ config, runtime, state });
      sendJson(response, 200, payload);
      return;
    }

    if (url.pathname === "/api/game/boosted") {
      const payload = await getCombinedBoosted({ config, runtime, state });
      sendJson(response, 200, payload);
      return;
    }

    if (url.pathname === "/api/game/mini-world-changes") {
      const payload = await getCachedMiniWorldChanges({ config, state });
      sendJson(response, payload ? 200 : 503, payload || { error: "Mini World Changes cache is not ready." });
      return;
    }

    if (url.pathname === "/api/game/mini-world-changes/catalog") {
      const payload = await getCachedMiniWorldChanges({ config, state });
      sendJson(
        response,
        payload ? 200 : 503,
        payload
          ? { data: { catalog: payload.data.catalog }, meta: payload.meta }
          : { error: "Mini World Changes cache is not ready." }
      );
      return;
    }

    const miniWorldChangesWorldMatch = url.pathname.match(/^\/api\/game\/mini-world-changes\/worlds\/([^/]+)$/);
    if (miniWorldChangesWorldMatch) {
      const requestedWorld = decodeURIComponent(miniWorldChangesWorldMatch[1]).trim();
      const payload = await getCachedMiniWorldChanges({ config, state });
      if (!payload) {
        sendJson(response, 503, { error: "Mini World Changes cache is not ready." });
        return;
      }

      const world = payload.data.worlds.find(
        (entry) => entry.name.localeCompare(requestedWorld, "en", { sensitivity: "base" }) === 0
      );
      sendJson(
        response,
        world ? 200 : 404,
        world ? { data: { world }, meta: payload.meta } : { error: `Unknown Tibia world: ${requestedWorld}` }
      );
      return;
    }

    if (url.pathname === "/api/game/bazaar/current") {
      const filters = extractBazaarFilters(url.searchParams, "currentcharactertrades");
      const key = `bazaar-current:${buildBazaarFilterCacheKey(filters)}`;
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key,
        refreshMs: config.refresh.bazaarCurrentMs,
        sourceUrl: buildBazaarOverviewSourceUrl("currentcharactertrades", filters),
        fetcher: () =>
          fetchBazaarOverview({
            subtopic: "currentcharactertrades",
            filters,
            timeoutMs: config.timeoutMs
          })
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    if (url.pathname === "/api/game/bazaar/history") {
      const filters = extractBazaarFilters(url.searchParams, "pastcharactertrades");
      const key = `bazaar-history:${buildBazaarFilterCacheKey(filters)}`;
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key,
        refreshMs: config.refresh.bazaarHistoryMs,
        sourceUrl: buildBazaarOverviewSourceUrl("pastcharactertrades", filters),
        fetcher: () =>
          fetchBazaarOverview({
            subtopic: "pastcharactertrades",
            filters,
            timeoutMs: config.timeoutMs
          })
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    const bazaarAuctionMatch = url.pathname.match(/^\/api\/game\/bazaar\/auction\/(\d+)$/);
    if (bazaarAuctionMatch) {
      const auctionId = bazaarAuctionMatch[1];
      const subtopic =
        String(url.searchParams.get("subtopic") || "").trim().toLowerCase() === "pastcharactertrades"
          ? "pastcharactertrades"
          : "currentcharactertrades";
      const key = `bazaar-auction:${subtopic}:${auctionId}`;
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key,
        refreshMs: config.refresh.bazaarDetailMs,
        sourceUrl: `https://www.tibia.com/charactertrade/?subtopic=${subtopic}&page=details&auctionid=${auctionId}`,
        fetcher: () =>
          fetchBazaarAuctionDetail({
            auctionId,
            subtopic,
            timeoutMs: config.timeoutMs
          })
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    if (url.pathname === "/api/game/tibiadata/worlds") {
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: "td-worlds",
        refreshMs: config.refresh.tibiaDataWorldsMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/worlds`,
        fetcher: fetchTibiaDataWorlds
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    if (url.pathname === "/api/game/tibiadata/guild") {
      const guildName = String(url.searchParams.get("name") || "").trim();

      if (!guildName) {
        sendJson(response, 400, { error: "Missing guild name." });
        return;
      }

      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `td-guild:${guildName}`,
        refreshMs: config.refresh.tibiaDataGuildDetailMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/guild/${encodeURIComponent(guildName)}`,
        fetcher: () => fetchTibiaDataGuild(guildName)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    if (url.pathname === "/api/game/tibiadata/character") {
      const characterName = String(url.searchParams.get("name") || "").trim();

      if (!characterName) {
        sendJson(response, 400, { error: "Missing character name." });
        return;
      }

      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `td-character:${characterName}`,
        refreshMs: config.refresh.tibiaDataCharacterMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/character/${encodeURIComponent(characterName)}`,
        fetcher: () => fetchTibiaDataCharacter(characterName)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    if (url.pathname === "/api/game/tibiadata/highscores") {
      const world = String(url.searchParams.get("world") || "").trim();
      const category = String(url.searchParams.get("category") || "experience").trim().toLowerCase();
      const vocation = String(url.searchParams.get("vocation") || "all").trim().toLowerCase();
      const page = clampInteger(url.searchParams.get("page"), 1, 1, 20);

      if (!world) {
        sendJson(response, 400, { error: "Missing world." });
        return;
      }

      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `td-highscores:${world}:${category}:${vocation}:${page}`,
        refreshMs: config.refresh.tibiaDataHighscoresMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/highscores/${encodeURIComponent(world)}/${encodeURIComponent(category)}/${encodeURIComponent(vocation)}/${page}`,
        fetcher: () => fetchTibiaDataHighscores({ world, category, vocation, page })
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    if (url.pathname === "/api/game/tibiadata/news") {
      // TibiaData archives by day range, not by item count. Two weeks is enough
      // for the compact feed while the response below remains capped at 15.
      const days = clampInteger(url.searchParams.get("days"), 14, 1, 180);
      const limit = clampInteger(url.searchParams.get("limit"), 15, 1, 200);
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `td-news:${days}:limit=${limit}`,
        refreshMs: config.refresh.tibiaDataNewsMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/news/archive/${days}`,
        fetcher: () => fetchTibiaDataNews(days, limit)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    if (url.pathname === "/api/game/tibiadata/news/archive") {
      const locale = normalizeNewsLocale(url.searchParams.get("locale"));
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: NEWS_ARCHIVE_KEY,
        refreshMs: config.refresh.tibiaDataNewsMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/news/archive/30`,
        fetcher: () => collectPersistentNewsArchive(config)
      });
      const archive = await ensureNewsArchiveTranslations({
        config,
        runtime,
        archive: payload.data,
        locale
      });
      sendJson(response, 200, {
        data: { news: presentNewsArchive(archive, locale) },
        meta: payload.meta
      });
      return;
    }

    const tibiaDataNewsMatch = url.pathname.match(/^\/api\/game\/tibiadata\/news\/(\d+)$/);
    if (tibiaDataNewsMatch) {
      const newsId = tibiaDataNewsMatch[1];
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `td-news-detail:${newsId}`,
        refreshMs: config.refresh.tibiaDataNewsMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/news/id/${newsId}`,
        fetcher: () => fetchTibiaDataNewsDetail(newsId)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    const tibiaDataGuildsMatch = url.pathname.match(/^\/api\/game\/tibiadata\/worlds\/([^/]+)\/guilds$/);
    if (tibiaDataGuildsMatch) {
      const world = decodeURIComponent(tibiaDataGuildsMatch[1]);
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `td-guilds:${world}`,
        refreshMs: config.refresh.tibiaDataGuildsMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/guilds/${encodeURIComponent(world)}`,
        fetcher: () => fetchTibiaDataGuilds(world)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    const tibiaDataHousesMatch = url.pathname.match(/^\/api\/game\/tibiadata\/worlds\/([^/]+)\/houses$/);
    if (tibiaDataHousesMatch) {
      const world = decodeURIComponent(tibiaDataHousesMatch[1]);
      const town = String(url.searchParams.get("town") || "").trim();

      if (!town) {
        sendJson(response, 400, { error: "Missing town." });
        return;
      }

      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `td-houses:${world}:${town}`,
        refreshMs: config.refresh.tibiaDataHousesMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/houses/${encodeURIComponent(world)}/${encodeURIComponent(town)}`,
        fetcher: () => fetchTibiaDataHouses(world, town)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    const tibiaDataHouseMatch = url.pathname.match(/^\/api\/game\/tibiadata\/worlds\/([^/]+)\/houses\/(\d+)$/);
    if (tibiaDataHouseMatch) {
      const world = decodeURIComponent(tibiaDataHouseMatch[1]);
      const houseId = tibiaDataHouseMatch[2];
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `td-house:${world}:${houseId}`,
        refreshMs: config.refresh.tibiaDataHouseDetailMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/house/${encodeURIComponent(world)}/${houseId}`,
        fetcher: () => fetchTibiaDataHouse(world, houseId)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    const tibiaDataKillStatisticsMatch = url.pathname.match(/^\/api\/game\/tibiadata\/worlds\/([^/]+)\/killstatistics$/);
    if (tibiaDataKillStatisticsMatch) {
      const world = decodeURIComponent(tibiaDataKillStatisticsMatch[1]);
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `td-killstatistics:${world}`,
        refreshMs: config.refresh.tibiaDataKillStatisticsMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/killstatistics/${encodeURIComponent(world)}`,
        fetcher: () => fetchTibiaDataKillStatistics(world)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    const tibiaDataWorldMatch = url.pathname.match(/^\/api\/game\/tibiadata\/worlds\/([^/]+)$/);
    if (tibiaDataWorldMatch) {
      const world = decodeURIComponent(tibiaDataWorldMatch[1]);
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `td-world:${world}`,
        refreshMs: config.refresh.tibiaDataWorldDetailMs,
        sourceUrl: `${TIBIA_DATA_BASE}/v4/world/${encodeURIComponent(world)}`,
        fetcher: () => fetchTibiaDataWorld(world)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    if (url.pathname === "/api/game/rook/worlds") {
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: "rook-worlds",
        refreshMs: config.refresh.rookieWorldsMs,
        sourceUrl: `${ROOKIE_BASE}/worlds`,
        fetcher: fetchRookieWorlds
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    if (url.pathname === "/api/game/rook/characters/trending") {
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: "rook-trending",
        refreshMs: config.refresh.rookieTrendingMs,
        sourceUrl: `${ROOKIE_BASE}/characters/trending`,
        fetcher: fetchRookieTrending
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    if (url.pathname === "/api/game/rook/characters") {
      const offset = clampInteger(url.searchParams.get("offset"), 0, 0, 100_000);
      const limit = clampInteger(url.searchParams.get("limit"), 20, 1, 100);
      const sort = sanitizeSlugValue(url.searchParams.get("sort") || "level");
      const order = String(url.searchParams.get("order") || "desc").toLowerCase() === "asc" ? "asc" : "desc";
      const world = String(url.searchParams.get("world") || "").trim();
      const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
      const query = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
        sort,
        order
      });

      if (world) {
        query.set("world", world);
      }

      if (status) {
        query.set("status", status);
      }

      const key = `rook-characters:${query.toString()}`;
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key,
        refreshMs: config.refresh.rookieCharactersMs,
        sourceUrl: `${ROOKIE_BASE}/characters?${query.toString()}`,
        fetcher: () => fetchRookieCharacters(query)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    const rookCharacterMatch = url.pathname.match(/^\/api\/game\/rook\/characters\/(\d+)$/);
    if (rookCharacterMatch) {
      const characterId = rookCharacterMatch[1];
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `rook-character:${characterId}`,
        refreshMs: config.refresh.rookieCharacterDetailMs,
        sourceUrl: `${ROOKIE_BASE}/characters/${characterId}`,
        fetcher: () => fetchRookieCharacterDetail(characterId)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    const rookForecastMatch = url.pathname.match(/^\/api\/game\/rook\/characters\/(\d+)\/forecast$/);
    if (rookForecastMatch) {
      const characterId = rookForecastMatch[1];
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `rook-character-forecast:${characterId}`,
        refreshMs: config.refresh.rookieCharacterDetailMs,
        sourceUrl: `${ROOKIE_BASE}/characters/${characterId}/forecast`,
        fetcher: () => fetchRookieCharacterForecast(characterId)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    const rookActivityMatch = url.pathname.match(/^\/api\/game\/rook\/characters\/(\d+)\/activity$/);
    if (rookActivityMatch) {
      const characterId = rookActivityMatch[1];
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `rook-character-activity:${characterId}`,
        refreshMs: config.refresh.rookieCharacterDetailMs,
        sourceUrl: `${ROOKIE_BASE}/characters/${characterId}/activity`,
        fetcher: () => fetchRookieCharacterActivity(characterId)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    const bossWorldMatch = url.pathname.match(/^\/api\/game\/bosses\/worlds\/([a-z0-9-]+)$/);
    if (bossWorldMatch) {
      const worldSlug = bossWorldMatch[1];
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `boss-world:${worldSlug}`,
        refreshMs: config.refresh.bossWorldMs,
        sourceUrl: `${TIBIA_STATISTIC_BASE}/bosshunter/details/${worldSlug}`,
        fetcher: () => fetchBossWorld(worldSlug)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    const bossDetailMatch = url.pathname.match(/^\/api\/game\/bosses\/worlds\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
    if (bossDetailMatch) {
      const worldSlug = bossDetailMatch[1];
      const bossSlug = bossDetailMatch[2];
      const payload = await ensureSnapshot({
        config,
        runtime,
        state,
        key: `boss-detail:${worldSlug}:${bossSlug}`,
        refreshMs: config.refresh.bossDetailMs,
        sourceUrl: `${TIBIA_STATISTIC_BASE}/bosshunter/${worldSlug}/${bossSlug}`,
        fetcher: () => fetchBossDetail(worldSlug, bossSlug)
      });
      sendJson(response, 200, wrapSingleModuleResponse(payload));
      return;
    }

    sendJson(response, 404, { error: "Route not found." });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function schedulerTick({ config, runtime, state, scheduledModules }) {
  await runMiniWorldChangesScheduler({ config, runtime, state }).catch(() => {});

  for (const module of scheduledModules) {
    const meta = state.modules[module.key] || null;
    const nextRefreshAt = Date.parse(meta?.nextRefreshAt || 0) || 0;

    if (nextRefreshAt > Date.now()) {
      continue;
    }

    const refreshed = await refreshSnapshot({
      config,
      runtime,
      state,
      key: module.key,
      refreshMs: module.refreshMs,
      sourceUrl: module.sourceUrl,
      fetcher: module.fetcher
    }).catch(() => {});

    if (module.key === NEWS_ARCHIVE_KEY && refreshed?.data) {
      // Warm and persist both public translations as part of the collector
      // cycle. Cached source hashes guarantee that an unchanged article is
      // never sent to the translation API again.
      await Promise.all([
        ensureNewsArchiveTranslations({ config, runtime, archive: refreshed.data, locale: "pt-BR" }),
        ensureNewsArchiveTranslations({ config, runtime, archive: refreshed.data, locale: "de" })
      ]).catch(() => {});
    }
  }
}

async function runMiniWorldChangesScheduler({ config, runtime, state, now = new Date() }) {
  const schedule = config.miniWorldChanges;
  if (!schedule.enabled) return;

  const meta = state.modules[MINI_WORLD_CHANGES_KEY] || {};
  const snapshot = await readSnapshot(config, MINI_WORLD_CHANGES_KEY);
  let completedSlots = pruneCompletedMiniWorldChangeSlots(meta.completedSlots);

  if (!snapshot && schedule.bootstrapWhenEmpty && !meta.bootstrapAttemptAt) {
    const bootstrapAttemptAt = now.toISOString();
    updateModuleMeta(state, MINI_WORLD_CHANGES_KEY, { bootstrapAttemptAt, completedSlots });
    await saveState(config, runtime, state);
    await refreshMiniWorldChangesSnapshot({ config, runtime, state, now, slot: "bootstrap" });
    completedSlots = pruneCompletedMiniWorldChangeSlots([
      ...completedSlots,
      ...getTodayDueMiniWorldChangeSlots({
        now,
        timeZone: schedule.timeZone,
        collectionTimes: schedule.collectionTimes
      })
    ]);
    updateModuleMeta(state, MINI_WORLD_CHANGES_KEY, { completedSlots });
    await saveState(config, runtime, state);
    return;
  }

  const dueSlots = getDueMiniWorldChangeSlots({
    now,
    timeZone: schedule.timeZone,
    collectionTimes: schedule.collectionTimes,
    completedSlots
  });
  const slot = dueSlots[0];
  if (!slot) return;

  completedSlots = pruneCompletedMiniWorldChangeSlots([...completedSlots, slot]);
  updateModuleMeta(state, MINI_WORLD_CHANGES_KEY, {
    completedSlots,
    lastScheduledSlot: slot,
    lastScheduledAttemptAt: now.toISOString()
  });
  await saveState(config, runtime, state);
  await refreshMiniWorldChangesSnapshot({ config, runtime, state, now, slot });
}

async function refreshMiniWorldChangesSnapshot({ config, runtime, state, now, slot }) {
  const schedule = config.miniWorldChanges;
  return refreshSnapshot({
    config,
    runtime,
    state,
    key: MINI_WORLD_CHANGES_KEY,
    refreshMs: 24 * 60 * 60_000,
    sourceUrl: "https://tibiatrade.gg/mini-world-changes",
    fetcher: async () => {
      const data = await collectMiniWorldChanges({
        sourceBase: schedule.sourceBase,
        timeoutMs: config.timeoutMs,
        collectedAt: now.toISOString(),
        schedule
      });
      updateModuleMeta(state, MINI_WORLD_CHANGES_KEY, {
        lastCompletedSlot: slot,
        lastScheduledSuccessAt: new Date().toISOString()
      });
      return data;
    }
  });
}

async function getCachedMiniWorldChanges({ config, state }) {
  const data = await readSnapshot(config, MINI_WORLD_CHANGES_KEY);
  if (!data) return null;

  const meta = state.modules[MINI_WORLD_CHANGES_KEY] || {};
  return {
    data,
    meta: {
      fetchedAt: meta.fetchedAt || null,
      lastSuccessAt: meta.lastSuccessAt || null,
      lastAttemptAt: meta.lastAttemptAt || null,
      lastCompletedSlot: meta.lastCompletedSlot || null,
      lastScheduledSlot: meta.lastScheduledSlot || null,
      lastError: meta.lastError || null,
      stale: false,
      refreshing: false
    }
  };
}

async function getCombinedWorldStatistics({ config, runtime, state }) {
  const modules = [
    {
      key: "ts-worlds-data",
      refreshMs: config.refresh.tibiaStatisticWorldsMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/statistics/worlds/data`,
      fetcher: fetchTibiaStatisticWorldsData
    },
    {
      key: "ts-worlds-trends",
      refreshMs: config.refresh.tibiaStatisticWorldsMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/statistics/worlds/trends`,
      fetcher: fetchTibiaStatisticWorldTrends
    },
    {
      key: "ts-worlds-aggregates",
      refreshMs: config.refresh.tibiaStatisticWorldsMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/statistics/worlds/aggregates`,
      fetcher: fetchTibiaStatisticWorldAggregates
    },
    {
      key: "ts-worlds-active-levels",
      refreshMs: config.refresh.tibiaStatisticWorldsMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/statistics/worlds/active-levels`,
      fetcher: fetchTibiaStatisticWorldActiveLevels
    }
  ];

  const responses = await Promise.all(
    modules.map((module) =>
      ensureSnapshot({
        config,
        runtime,
        state,
        key: module.key,
        refreshMs: module.refreshMs,
        sourceUrl: module.sourceUrl,
        fetcher: module.fetcher
      })
    )
  );

  return {
    data: {
      worlds: responses[0].data,
      trends: responses[1].data,
      aggregates: responses[2].data,
      activeLevels: responses[3].data
    },
    meta: {
      modules: responses.map((entry) => entry.meta),
      stale: responses.some((entry) => entry.meta.stale)
    }
  };
}

async function getCombinedBoosted({ config, runtime, state }) {
  const [creature, boss] = await Promise.all([
    ensureSnapshot({
      config,
      runtime,
      state,
      key: "ts-boosted-creature",
      refreshMs: config.refresh.boostedMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/boosted-creature`,
      fetcher: fetchBoostedCreature
    }),
    ensureSnapshot({
      config,
      runtime,
      state,
      key: "ts-boosted-boss",
      refreshMs: config.refresh.boostedMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/boosted-boss`,
      fetcher: fetchBoostedBoss
    })
  ]);

  return {
    data: {
      creature: creature.data,
      boss: boss.data
    },
    meta: {
      modules: [creature.meta, boss.meta],
      stale: creature.meta.stale || boss.meta.stale
    }
  };
}

async function ensureSnapshot({ config, runtime, state, key, refreshMs, sourceUrl, fetcher }) {
  const existing = state.modules[key] || null;
  const snapshot = await readSnapshot(config, key);
  const fetchedAtMs = Date.parse(existing?.fetchedAt || snapshot?.storedAt || 0) || 0;
  const hasData = snapshot !== null;
  const isFresh = hasData && fetchedAtMs > 0 && Date.now() - fetchedAtMs < refreshMs;

  if (isFresh) {
    return buildModuleResponse({
      key,
      data: snapshot,
      meta: existing,
      refreshMs,
      stale: false,
      refreshing: false
    });
  }

  if (hasData) {
    void refreshSnapshot({ config, runtime, state, key, refreshMs, sourceUrl, fetcher }).catch(() => {});
    return buildModuleResponse({
      key,
      data: snapshot,
      meta: existing,
      refreshMs,
      stale: true,
      refreshing: true
    });
  }

  return refreshSnapshot({ config, runtime, state, key, refreshMs, sourceUrl, fetcher });
}

async function refreshSnapshot({ config, runtime, state, key, refreshMs, sourceUrl, fetcher }) {
  if (runtime.inFlight.has(key)) {
    return runtime.inFlight.get(key);
  }

  const task = (async () => {
    const startedAt = new Date().toISOString();
    updateModuleMeta(state, key, {
      sourceUrl,
      refreshMs,
      lastAttemptAt: startedAt
    });
    await saveState(config, runtime, state);

    try {
      const data = await fetcher();
      const fetchedAt = new Date().toISOString();
      const sourceUpdatedAt = inferSourceUpdatedAt(data, fetchedAt);

      await writeSnapshot(config, key, data);
      updateModuleMeta(state, key, {
        fetchedAt,
        lastSuccessAt: fetchedAt,
        sourceUpdatedAt,
        nextRefreshAt: new Date(Date.now() + refreshMs).toISOString(),
        lastError: null,
        sourceUrl,
        refreshMs
      });
      await saveState(config, runtime, state);

      return buildModuleResponse({
        key,
        data,
        meta: state.modules[key],
        refreshMs,
        stale: false,
        refreshing: false
      });
    } catch (error) {
      updateModuleMeta(state, key, {
        nextRefreshAt: new Date(Date.now() + Math.min(refreshMs, 60_000)).toISOString(),
        lastError: error instanceof Error ? error.message : String(error),
        sourceUrl,
        refreshMs
      });
      await saveState(config, runtime, state);
      throw error;
    } finally {
      runtime.inFlight.delete(key);
    }
  })();

  runtime.inFlight.set(key, task);
  return task;
}

function buildModuleResponse({ key, data, meta, refreshMs, stale, refreshing }) {
  return {
    key,
    data,
    meta: {
      key,
      fetchedAt: meta?.fetchedAt || null,
      lastSuccessAt: meta?.lastSuccessAt || null,
      lastAttemptAt: meta?.lastAttemptAt || null,
      sourceUpdatedAt: meta?.sourceUpdatedAt || null,
      sourceUrl: meta?.sourceUrl || null,
      refreshMs,
      stale,
      refreshing,
      lastError: meta?.lastError || null
    }
  };
}

function wrapSingleModuleResponse(payload) {
  return {
    data: payload.data,
    meta: payload.meta
  };
}

function buildStatusPayload({ config, state, scheduledModules }) {
  return {
    ok: true,
    service: "game-data-hub",
    host: config.host,
    port: config.port,
    dataDir: config.dataDir,
    stateFilePath: config.stateFilePath,
    refresh: config.refresh,
    miniWorldChanges: config.miniWorldChanges,
    scheduledModules: scheduledModules.map((module) => ({
      key: module.key,
      refreshMs: module.refreshMs,
      sourceUrl: module.sourceUrl
    })),
    modules: state.modules
  };
}

function buildScheduledModules(config) {
  return [
    {
      key: "ts-worlds-data",
      refreshMs: config.refresh.tibiaStatisticWorldsMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/statistics/worlds/data`,
      fetcher: fetchTibiaStatisticWorldsData
    },
    {
      key: "ts-worlds-trends",
      refreshMs: config.refresh.tibiaStatisticWorldsMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/statistics/worlds/trends`,
      fetcher: fetchTibiaStatisticWorldTrends
    },
    {
      key: "ts-worlds-aggregates",
      refreshMs: config.refresh.tibiaStatisticWorldsMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/statistics/worlds/aggregates`,
      fetcher: fetchTibiaStatisticWorldAggregates
    },
    {
      key: "ts-worlds-active-levels",
      refreshMs: config.refresh.tibiaStatisticWorldsMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/statistics/worlds/active-levels`,
      fetcher: fetchTibiaStatisticWorldActiveLevels
    },
    {
      key: "ts-boosted-creature",
      refreshMs: config.refresh.boostedMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/boosted-creature`,
      fetcher: fetchBoostedCreature
    },
    {
      key: "ts-boosted-boss",
      refreshMs: config.refresh.boostedMs,
      sourceUrl: `${TIBIA_STATISTIC_BASE}/boosted-boss`,
      fetcher: fetchBoostedBoss
    },
    {
      key: "td-worlds",
      refreshMs: config.refresh.tibiaDataWorldsMs,
      sourceUrl: `${TIBIA_DATA_BASE}/v4/worlds`,
      fetcher: fetchTibiaDataWorlds
    },
    {
      key: "td-news:14:limit=15",
      refreshMs: config.refresh.tibiaDataNewsMs,
      sourceUrl: `${TIBIA_DATA_BASE}/v4/news/archive/14`,
      fetcher: () => fetchTibiaDataNews(14, 15)
    },
    {
      key: NEWS_ARCHIVE_KEY,
      refreshMs: config.refresh.tibiaDataNewsMs,
      sourceUrl: `${TIBIA_DATA_BASE}/v4/news/archive/30`,
      fetcher: () => collectPersistentNewsArchive(config)
    },
    {
      key: "bazaar-current:currentpage=1&filter_levelrangefrom=0&filter_levelrangeto=0&filter_profession=0&filter_skillid=&filter_skillrangefrom=0&filter_skillrangeto=0&filter_world=&filter_worldbattleyestate=0&filter_worldpvptype=9&order_column=101&order_direction=1&searchstring=&searchtype=1",
      refreshMs: config.refresh.bazaarCurrentMs,
      sourceUrl: buildBazaarOverviewSourceUrl("currentcharactertrades", extractBazaarFilters(new URLSearchParams(), "currentcharactertrades")),
      fetcher: () =>
        fetchBazaarOverview({
          subtopic: "currentcharactertrades",
          filters: extractBazaarFilters(new URLSearchParams(), "currentcharactertrades"),
          timeoutMs: config.timeoutMs
        })
    },
    {
      key: "bazaar-history:currentpage=1&filter_levelrangefrom=0&filter_levelrangeto=0&filter_profession=0&filter_skillid=&filter_skillrangefrom=0&filter_skillrangeto=0&filter_world=&filter_worldbattleyestate=0&filter_worldpvptype=9&order_column=101&order_direction=1&searchstring=&searchtype=0",
      refreshMs: config.refresh.bazaarHistoryMs,
      sourceUrl: buildBazaarOverviewSourceUrl("pastcharactertrades", extractBazaarFilters(new URLSearchParams(), "pastcharactertrades")),
      fetcher: () =>
        fetchBazaarOverview({
          subtopic: "pastcharactertrades",
          filters: extractBazaarFilters(new URLSearchParams(), "pastcharactertrades"),
          timeoutMs: config.timeoutMs
        })
    },
    {
      key: "rook-worlds",
      refreshMs: config.refresh.rookieWorldsMs,
      sourceUrl: `${ROOKIE_BASE}/worlds`,
      fetcher: fetchRookieWorlds
    },
    {
      key: "rook-trending",
      refreshMs: config.refresh.rookieTrendingMs,
      sourceUrl: `${ROOKIE_BASE}/characters/trending`,
      fetcher: fetchRookieTrending
    }
  ];
}

async function loadConfig(overrides = {}) {
  const configPath =
    overrides.configPath ||
    process.env.GAME_DATA_HUB_CONFIG_PATH ||
    process.env.GAME_DATA_HUB_CONFIG ||
    path.join(__dirname, "config.json");
  const fileConfig = overrides.fileConfig || (await readJsonIfExists(configPath));
  const stateFilePath = resolveStateFilePath(
    overrides.stateFilePath ||
      process.env.GAME_DATA_HUB_STATE_PATH ||
      fileConfig?.stateFilePath ||
      fileConfig?.metadataFilePath ||
      DEFAULT_STATE_FILE_PATH
  );
  const dataDir = path.dirname(stateFilePath);

  const fileMiniWorldChanges = fileConfig?.miniWorldChanges || {};

  return {
    configPath,
    host: overrides.host || process.env.GAME_DATA_HUB_HOST || fileConfig?.host || DEFAULT_HOST,
    port: overrides.port ?? parsePositiveInteger(process.env.PORT, fileConfig?.port, DEFAULT_PORT),
    tickMs: parsePositiveInteger(
      overrides.tickMs,
      process.env.GAME_DATA_HUB_TICK_MS,
      fileConfig?.tickMs,
      DEFAULT_TICK_MS
    ),
    timeoutMs: parsePositiveInteger(
      overrides.timeoutMs,
      process.env.GAME_DATA_HUB_TIMEOUT_MS,
      fileConfig?.timeoutMs,
      DEFAULT_TIMEOUT_MS
    ),
    stateFilePath,
    dataDir,
    snapshotsDir: path.join(dataDir, "snapshots"),
    miniWorldChanges: normalizeMiniWorldChangesConfig({
      enabled: overrides.miniWorldChangesEnabled ?? process.env.GAME_DATA_HUB_MWC_ENABLED ?? fileMiniWorldChanges.enabled,
      sourceBase: overrides.miniWorldChangesSourceBase || process.env.GAME_DATA_HUB_MWC_SOURCE_BASE || fileMiniWorldChanges.sourceBase,
      timeZone: overrides.miniWorldChangesTimeZone || process.env.GAME_DATA_HUB_MWC_TIME_ZONE || fileMiniWorldChanges.timeZone,
      serverSaveTime: overrides.miniWorldChangesServerSaveTime || process.env.GAME_DATA_HUB_MWC_SERVER_SAVE_TIME || fileMiniWorldChanges.serverSaveTime,
      collectionTimes: overrides.miniWorldChangesCollectionTimes || process.env.GAME_DATA_HUB_MWC_COLLECTION_TIMES || fileMiniWorldChanges.collectionTimes,
      bootstrapWhenEmpty: overrides.miniWorldChangesBootstrapWhenEmpty ?? process.env.GAME_DATA_HUB_MWC_BOOTSTRAP_WHEN_EMPTY ?? fileMiniWorldChanges.bootstrapWhenEmpty
    }),
    refresh: {
      tibiaStatisticWorldsMs: parsePositiveInteger(
        overrides.tibiaStatisticWorldsMs,
        process.env.GAME_DATA_HUB_TS_WORLDS_MS,
        fileConfig?.refresh?.tibiaStatisticWorldsMs,
        DEFAULT_REFRESH.tibiaStatisticWorldsMs
      ),
      boostedMs: parsePositiveInteger(
        overrides.boostedMs,
        process.env.GAME_DATA_HUB_BOOSTED_MS,
        fileConfig?.refresh?.boostedMs,
        DEFAULT_REFRESH.boostedMs
      ),
      tibiaDataWorldsMs: parsePositiveInteger(
        overrides.tibiaDataWorldsMs,
        process.env.GAME_DATA_HUB_TD_WORLDS_MS,
        fileConfig?.refresh?.tibiaDataWorldsMs,
        DEFAULT_REFRESH.tibiaDataWorldsMs
      ),
      tibiaDataWorldDetailMs: parsePositiveInteger(
        overrides.tibiaDataWorldDetailMs,
        process.env.GAME_DATA_HUB_TD_WORLD_DETAIL_MS,
        fileConfig?.refresh?.tibiaDataWorldDetailMs,
        DEFAULT_REFRESH.tibiaDataWorldDetailMs
      ),
      tibiaDataGuildsMs: parsePositiveInteger(
        overrides.tibiaDataGuildsMs,
        process.env.GAME_DATA_HUB_TD_GUILDS_MS,
        fileConfig?.refresh?.tibiaDataGuildsMs,
        DEFAULT_REFRESH.tibiaDataGuildsMs
      ),
      tibiaDataGuildDetailMs: parsePositiveInteger(
        overrides.tibiaDataGuildDetailMs,
        process.env.GAME_DATA_HUB_TD_GUILD_DETAIL_MS,
        fileConfig?.refresh?.tibiaDataGuildDetailMs,
        DEFAULT_REFRESH.tibiaDataGuildDetailMs
      ),
      tibiaDataHousesMs: parsePositiveInteger(
        overrides.tibiaDataHousesMs,
        process.env.GAME_DATA_HUB_TD_HOUSES_MS,
        fileConfig?.refresh?.tibiaDataHousesMs,
        DEFAULT_REFRESH.tibiaDataHousesMs
      ),
      tibiaDataHouseDetailMs: parsePositiveInteger(
        overrides.tibiaDataHouseDetailMs,
        process.env.GAME_DATA_HUB_TD_HOUSE_DETAIL_MS,
        fileConfig?.refresh?.tibiaDataHouseDetailMs,
        DEFAULT_REFRESH.tibiaDataHouseDetailMs
      ),
      tibiaDataKillStatisticsMs: parsePositiveInteger(
        overrides.tibiaDataKillStatisticsMs,
        process.env.GAME_DATA_HUB_TD_KILLSTATISTICS_MS,
        fileConfig?.refresh?.tibiaDataKillStatisticsMs,
        DEFAULT_REFRESH.tibiaDataKillStatisticsMs
      ),
      tibiaDataHighscoresMs: parsePositiveInteger(
        overrides.tibiaDataHighscoresMs,
        process.env.GAME_DATA_HUB_TD_HIGHSCORES_MS,
        fileConfig?.refresh?.tibiaDataHighscoresMs,
        DEFAULT_REFRESH.tibiaDataHighscoresMs
      ),
      tibiaDataNewsMs: parsePositiveInteger(
        overrides.tibiaDataNewsMs,
        process.env.GAME_DATA_HUB_TD_NEWS_MS,
        fileConfig?.refresh?.tibiaDataNewsMs,
        DEFAULT_REFRESH.tibiaDataNewsMs
      ),
      tibiaDataCharacterMs: parsePositiveInteger(
        overrides.tibiaDataCharacterMs,
        process.env.GAME_DATA_HUB_TD_CHARACTER_MS,
        fileConfig?.refresh?.tibiaDataCharacterMs,
        DEFAULT_REFRESH.tibiaDataCharacterMs
      ),
      bazaarCurrentMs: parsePositiveInteger(
        overrides.bazaarCurrentMs,
        process.env.GAME_DATA_HUB_BAZAAR_CURRENT_MS,
        fileConfig?.refresh?.bazaarCurrentMs,
        DEFAULT_REFRESH.bazaarCurrentMs
      ),
      bazaarHistoryMs: parsePositiveInteger(
        overrides.bazaarHistoryMs,
        process.env.GAME_DATA_HUB_BAZAAR_HISTORY_MS,
        fileConfig?.refresh?.bazaarHistoryMs,
        DEFAULT_REFRESH.bazaarHistoryMs
      ),
      bazaarDetailMs: parsePositiveInteger(
        overrides.bazaarDetailMs,
        process.env.GAME_DATA_HUB_BAZAAR_DETAIL_MS,
        fileConfig?.refresh?.bazaarDetailMs,
        DEFAULT_REFRESH.bazaarDetailMs
      ),
      rookieWorldsMs: parsePositiveInteger(
        overrides.rookieWorldsMs,
        process.env.GAME_DATA_HUB_ROOKIE_WORLDS_MS,
        fileConfig?.refresh?.rookieWorldsMs,
        DEFAULT_REFRESH.rookieWorldsMs
      ),
      rookieTrendingMs: parsePositiveInteger(
        overrides.rookieTrendingMs,
        process.env.GAME_DATA_HUB_ROOKIE_TRENDING_MS,
        fileConfig?.refresh?.rookieTrendingMs,
        DEFAULT_REFRESH.rookieTrendingMs
      ),
      bossWorldMs: parsePositiveInteger(
        overrides.bossWorldMs,
        process.env.GAME_DATA_HUB_BOSS_WORLD_MS,
        fileConfig?.refresh?.bossWorldMs,
        DEFAULT_REFRESH.bossWorldMs
      ),
      bossDetailMs: parsePositiveInteger(
        overrides.bossDetailMs,
        process.env.GAME_DATA_HUB_BOSS_DETAIL_MS,
        fileConfig?.refresh?.bossDetailMs,
        DEFAULT_REFRESH.bossDetailMs
      ),
      rookieCharactersMs: parsePositiveInteger(
        overrides.rookieCharactersMs,
        process.env.GAME_DATA_HUB_ROOKIE_CHARACTERS_MS,
        fileConfig?.refresh?.rookieCharactersMs,
        DEFAULT_REFRESH.rookieCharactersMs
      ),
      rookieCharacterDetailMs: parsePositiveInteger(
        overrides.rookieCharacterDetailMs,
        process.env.GAME_DATA_HUB_ROOKIE_CHARACTER_DETAIL_MS,
        fileConfig?.refresh?.rookieCharacterDetailMs,
        DEFAULT_REFRESH.rookieCharacterDetailMs
      )
    }
  };
}

function resolveStateFilePath(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return DEFAULT_STATE_FILE_PATH;
  }

  if (normalized.toLowerCase().endsWith(".json")) {
    return normalized;
  }

  return path.join(normalized, "state.json");
}

async function loadState(stateFilePath) {
  const parsed = await readJsonIfExists(stateFilePath);
  return parsed && typeof parsed === "object" ? parsed : { version: 1, modules: {} };
}

function normalizeState(state) {
  state.version = 1;
  state.modules = state.modules && typeof state.modules === "object" ? state.modules : {};
}

function updateModuleMeta(state, key, patch) {
  state.modules[key] = {
    ...(state.modules[key] || {}),
    ...patch
  };
}

async function saveState(config, runtime, state) {
  runtime.stateSaveInFlight = runtime.stateSaveInFlight.then(async () => {
    await fs.mkdir(config.dataDir, { recursive: true });
    const tempPath = `${config.stateFilePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
    await fs.rename(tempPath, config.stateFilePath);
  });

  return runtime.stateSaveInFlight;
}

async function readSnapshot(config, key) {
  const filePath = getSnapshotPath(config, key);
  const parsed = await readJsonIfExists(filePath);
  return parsed?.data ?? null;
}

async function writeSnapshot(config, key, data) {
  const filePath = getSnapshotPath(config, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  const payload = {
    storedAt: new Date().toISOString(),
    data
  };
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

function getSnapshotPath(config, key) {
  return path.join(config.snapshotsDir, `${safeFileSegment(key)}.json`);
}

async function fetchTibiaStatisticWorldsData() {
  return fetchJson(`${TIBIA_STATISTIC_BASE}/statistics/worlds/data`);
}

async function fetchTibiaStatisticWorldTrends() {
  return fetchJson(`${TIBIA_STATISTIC_BASE}/statistics/worlds/trends`);
}

async function fetchTibiaStatisticWorldAggregates() {
  return fetchJson(`${TIBIA_STATISTIC_BASE}/statistics/worlds/aggregates`);
}

async function fetchTibiaStatisticWorldActiveLevels() {
  return fetchJson(`${TIBIA_STATISTIC_BASE}/statistics/worlds/active-levels`);
}

async function fetchBoostedCreature() {
  const html = await fetchText(`${TIBIA_STATISTIC_BASE}/boosted-creature`);
  return parseBoostedPage(html, "creature");
}

async function fetchBoostedBoss() {
  const html = await fetchText(`${TIBIA_STATISTIC_BASE}/boosted-boss`);
  return parseBoostedPage(html, "boss");
}

export async function fetchTibiaDataWorlds() {
  return fetchJson(`${TIBIA_DATA_BASE}/v4/worlds`);
}

export async function fetchTibiaDataWorld(world) {
  return fetchJson(`${TIBIA_DATA_BASE}/v4/world/${encodeURIComponent(world)}`);
}

export async function fetchTibiaDataGuilds(world) {
  return fetchJson(`${TIBIA_DATA_BASE}/v4/guilds/${encodeURIComponent(world)}`);
}

export async function fetchTibiaDataGuild(guildName) {
  return fetchJson(`${TIBIA_DATA_BASE}/v4/guild/${encodeURIComponent(guildName)}`);
}

async function fetchTibiaDataHouses(world, town) {
  return fetchJson(`${TIBIA_DATA_BASE}/v4/houses/${encodeURIComponent(world)}/${encodeURIComponent(town)}`);
}

async function fetchTibiaDataHouse(world, houseId) {
  return fetchJson(`${TIBIA_DATA_BASE}/v4/house/${encodeURIComponent(world)}/${encodeURIComponent(houseId)}`);
}

export async function fetchTibiaDataKillStatistics(world) {
  return fetchJson(`${TIBIA_DATA_BASE}/v4/killstatistics/${encodeURIComponent(world)}`);
}

async function fetchTibiaDataHighscores({ world, category, vocation, page }) {
  return fetchJson(
    `${TIBIA_DATA_BASE}/v4/highscores/${encodeURIComponent(world)}/${encodeURIComponent(category)}/${encodeURIComponent(vocation)}/${page}`
  );
}

async function fetchTibiaDataNews(days, limit = 15) {
  const payload = await fetchJson(`${TIBIA_DATA_BASE}/v4/news/archive/${days}`);
  if (!Array.isArray(payload?.news)) {
    return payload;
  }

  return {
    ...payload,
    news: payload.news.slice(0, limit)
  };
}

async function fetchTibiaDataNewsDetail(newsId) {
  return fetchJson(`${TIBIA_DATA_BASE}/v4/news/id/${encodeURIComponent(newsId)}`);
}

function normalizeNewsLocale(value) {
  return value === "de" || value === "en" || value === "pt-BR" ? value : "pt-BR";
}

function normalizeFullNewsItem(item) {
  if (
    !item ||
    typeof item.id !== "number" ||
    typeof item.date !== "string" ||
    typeof item.news !== "string" ||
    typeof item.url !== "string" ||
    item.type !== "news"
  ) {
    return null;
  }

  return {
    id: item.id,
    date: item.date,
    title: item.news,
    category: typeof item.category === "string" ? item.category : "other",
    type: "news",
    url: item.url
  };
}

function sortNewsNewestFirst(items) {
  return items.sort((left, right) => {
    const byDate = Date.parse(`${right.date}T12:00:00Z`) - Date.parse(`${left.date}T12:00:00Z`);
    return byDate || right.id - left.id;
  });
}

function calculateNewsSourceHash(title, contentHtml) {
  return createHash("sha256").update(`${title}\n${contentHtml}`).digest("hex");
}

async function collectPersistentNewsArchive(config) {
  const previousArchive = await readSnapshot(config, NEWS_ARCHIVE_KEY);
  const previousItems = Array.isArray(previousArchive?.articles) ? previousArchive.articles : [];
  const isInitialSeed = previousItems.length === 0;
  const sourceDays = isInitialSeed ? 90 : 30;
  const sourcePayload = await fetchTibiaDataNews(sourceDays, 200);
  const fullNews = (Array.isArray(sourcePayload?.news) ? sourcePayload.news : [])
    .map(normalizeFullNewsItem)
    .filter(Boolean);
  const initialBaseline = fullNews.filter((article) => NEWS_ARCHIVE_INITIAL_IDS.has(article.id));
  const newSinceBaseline = fullNews.filter(
    (article) => !NEWS_ARCHIVE_INITIAL_IDS.has(article.id) && article.date >= NEWS_ARCHIVE_CUTOFF_DATE
  );
  const candidates = isInitialSeed
    ? [...initialBaseline.slice(0, NEWS_ARCHIVE_SEED_COUNT), ...newSinceBaseline]
    : fullNews;
  const byId = new Map(previousItems.map((article) => [article.id, article]));

  for (const candidate of candidates) {
    const existing = byId.get(candidate.id);
    if (existing) {
      Object.assign(existing, candidate);
    } else {
      byId.set(candidate.id, candidate);
    }
  }

  const articles = sortNewsNewestFirst([...byId.values()]);
  const pendingDetails = articles.filter((article) => !article.original);
  const workers = Array.from({ length: Math.min(3, pendingDetails.length) }, async () => {
    while (pendingDetails.length > 0) {
      const article = pendingDetails.shift();
      if (!article) return;

      try {
        const payload = await fetchTibiaDataNewsDetail(article.id);
        const detail = payload?.news;
        if (!detail) continue;

        const title = typeof detail.title === "string" ? detail.title : article.title;
        const contentHtml = typeof detail.content_html === "string" ? detail.content_html : "";
        article.date = typeof detail.date === "string" ? detail.date : article.date;
        article.title = title;
        article.category = typeof detail.category === "string" ? detail.category : article.category;
        article.url = typeof detail.url === "string" ? detail.url : article.url;
        article.original = {
          title,
          content: typeof detail.content === "string" ? detail.content : "",
          contentHtml,
          sourceHash: calculateNewsSourceHash(title, contentHtml),
          savedAt: new Date().toISOString()
        };
      } catch {
        // This article stays in the archive and is retried on the next cycle.
      }
    }
  });
  await Promise.all(workers);

  return {
    version: 1,
    seededAt: previousArchive?.seededAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    articles
  };
}

function protectNewsBrandTerms(value, protectWholeValue = false) {
  const terms = [];
  const input = String(value || "");
  const restoreTerms = (translated) => {
    let restored = String(translated || "");
    terms.forEach((term, index) => {
      const marker = `\\[\\[\\s*TIBIA_TERM_${index}\\s*\\]\\]`;
      const duplicatedTerm = new RegExp(`${marker}\\s*[|:]?\\s*${escapeRegex(term)}`, "gi");
      const bareMarker = new RegExp(`${marker}\\s*[|:]?`, "gi");
      restored = restored.replace(duplicatedTerm, term).replace(bareMarker, term);
    });
    return restored;
  };

  if (protectWholeValue && /[\p{L}\p{N}]/u.test(input)) {
    terms.push(input);
    return {
      value: "[[TIBIA_TERM_0]]",
      restore: restoreTerms
    };
  }

  const protectedValue = input.replace(/\b(?:Tibia\.com|Tibia|CipSoft)\b/g, (term) => {
    const placeholder = `[[TIBIA_TERM_${terms.length}]]`;
    terms.push(term);
    return placeholder;
  });

  return {
    value: protectedValue,
    restore: restoreTerms
  };
}

function normalizeNewsTranslationContext(value, locale) {
  let normalized = String(value || "");
  if (locale === "de") {
    // Canonical linked names stay in English, but the surrounding German prose
    // must not inherit the English preposition that precedes the protected link.
    normalized = normalized.replace(/\bWith(?=\s*(?:&nbsp;\s*)?<a\b)/gi, "Mit");
  }
  return normalized;
}

function repairNewsTranslationPlaceholders(originalHtml, translatedHtml, locale) {
  const normalizedHtml = normalizeNewsTranslationContext(translatedHtml, locale);
  if (!/\[\[\s*TIBIA_TERM_\d+\s*\]\]/i.test(normalizedHtml)) {
    return normalizedHtml;
  }

  const originalTextNodes = splitNewsHtmlTextNodes(originalHtml).nodes.filter((node) => node.markup === undefined);
  const translatedNodes = splitNewsHtmlTextNodes(normalizedHtml).nodes;
  let textIndex = 0;

  const repairedHtml = translatedNodes
    .map((node) => {
      if (node.markup !== undefined) return node.markup;
      const originalNode = originalTextNodes[textIndex++];
      if (!originalNode) return `${node.leading}${node.source}${node.trailing}`;
      const restored = originalNode.protectedText.restore(node.source);
      const safeText = /\[\[\s*TIBIA_TERM_\d+\s*\]\]/i.test(restored) ? originalNode.source : restored;
      return `${node.leading}${normalizeTibiansTranslation(originalNode.source, safeText, locale)}${node.trailing}`;
    })
    .join("");
  return normalizeNewsTranslationContext(repairedHtml, locale);
}

function splitNewsHtmlTextNodes(contentHtml) {
  const nodes = [];
  const units = [];
  const fragments = String(contentHtml || "").split(/(<!--[\s\S]*?-->|<[^>]*>)/g);
  let insideLink = false;
  let insideListItem = false;
  const listStack = [];

  for (const fragment of fragments) {
    if (!fragment) continue;
    if (/^(<!--[\s\S]*?-->|<[^>]*>)$/.test(fragment)) {
      nodes.push({ markup: fragment });
      if (/^<\s*a\b/i.test(fragment)) insideLink = true;
      if (/^<\s*\/\s*a\s*>/i.test(fragment)) insideLink = false;
      if (/^<\s*(ul|ol)\b/i.test(fragment)) {
        listStack.push(/^<\s*ol\b/i.test(fragment) ? "ordered-list" : "unordered-list");
      }
      if (/^<\s*li\b/i.test(fragment)) insideListItem = true;
      if (/^<\s*\/\s*li\s*>/i.test(fragment)) insideListItem = false;
      if (/^<\s*\/\s*(ul|ol)\s*>/i.test(fragment)) listStack.pop();
      continue;
    }

    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(fragment);
    const body = match?.[2] ?? fragment;
    if (!body) {
      nodes.push({ markup: fragment });
      continue;
    }

    // Linked labels in official news commonly are canonical names (quests,
    // items, mechanics, creatures or places), so preserve them byte-for-byte.
    const protectedText = protectNewsBrandTerms(body, insideLink);
    const id = `node_${units.length}`;
    units.push({
      id,
      text: protectedText.value,
      htmlContext: insideListItem
        ? `${listStack[listStack.length - 1] || "list"}:list-item`
        : insideLink
          ? "link-label"
          : "text-node"
    });
    nodes.push({
      id,
      source: body,
      leading: match?.[1] || "",
      trailing: match?.[3] || "",
      protectedText
    });
  }

  return { nodes, units };
}

function plainTextFromNewsHtml(contentHtml) {
  return String(contentHtml || "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeTibiansTranslation(source, translated, locale) {
  if (!/\bTibians\b/.test(String(source || ""))) return String(translated || "");
  if (locale === "pt-BR") {
    return String(translated || "")
      .replace(/\bTibians\b/g, "Tibianos")
      .replace(/\bTibianer(?:n)?\b/g, "Tibianos");
  }
  if (locale === "de") {
    return String(translated || "")
      .replace(/\bTibianer(?:n)?\b/g, "Tibians")
      .replace(/\bTibianos\b/g, "Tibians");
  }
  return String(translated || "");
}

async function translateNewsArticle(original, locale) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_TRANSLATION_MODEL?.trim() || NEWS_ARCHIVE_TRANSLATION_MODEL;
  const protectedTitle = protectNewsBrandTerms(original.title);
  const { nodes, units } = splitNewsHtmlTextNodes(original.contentHtml);
  const targetLanguage = locale === "pt-BR" ? "Brazilian Portuguese" : "German";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions:
        "You translate official Tibia news for publication. Translate only prose into the requested language. Every textNodes entry represents one immutable HTML text node, and htmlContext identifies whether it belongs to a link label or to an ordered/unordered list item. Preserve every id exactly once. Never merge, split, omit, duplicate or reorder text nodes. Keep every list item independent and in its original order; do not turn list items into paragraphs and do not add bullet glyphs or numbering because the preserved HTML provides the markers. Never translate or alter canonical Tibia names: items, creatures, bosses, NPCs, characters, quests, missions, places, towns, worlds, servers, spells, game mechanics, product names, URLs, email addresses, or strings inside [[...]] placeholders. Translate all surrounding prose completely even when it is adjacent to a protected placeholder; in German, English prepositions such as With must be translated (for example, With before a protected term becomes Mit). Exception: translate the plural demonym Tibians as Tibianos in Brazilian Portuguese, but preserve Tibians exactly in German. Preserve every placeholder byte-for-byte. Keep factual tone. Return only the requested JSON.",
      input: JSON.stringify({ targetLanguage, title: protectedTitle.value, textNodes: units }),
      text: {
        format: {
          type: "json_schema",
          name: "official_tibia_news_translation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "textNodes"],
            properties: {
              title: { type: "string" },
              textNodes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "text"],
                  properties: { id: { type: "string" }, text: { type: "string" } }
                }
              }
            }
          }
        }
      }
    })
  });
  if (!response.ok) throw new Error(`OpenAI translation failed with ${response.status}`);

  const responsePayload = await response.json();
  // `output_text` is an SDK convenience property and is not guaranteed in a
  // raw REST response. Aggregate the documented output message content here.
  const outputText = Array.isArray(responsePayload?.output)
    ? responsePayload.output
        .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
        .filter((part) => part?.type === "output_text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("")
    : "";
  if (!outputText) throw new Error("OpenAI returned no translation text");
  const translationPayload = JSON.parse(outputText);
  if (typeof translationPayload?.title !== "string" || !Array.isArray(translationPayload?.textNodes)) {
    throw new Error("OpenAI returned an invalid translation shape");
  }

  const translatedNodes = new Map();
  for (const unit of translationPayload.textNodes) {
    if (typeof unit?.id === "string" && typeof unit?.text === "string") {
      translatedNodes.set(unit.id, unit.text);
    }
  }
  if (translatedNodes.size !== units.length || units.some((unit) => !translatedNodes.has(unit.id))) {
    throw new Error("OpenAI did not preserve every text node");
  }

  const contentHtml = nodes
    .map((node) => {
      if (node.markup !== undefined) return node.markup;
      const restored = node.protectedText.restore(translatedNodes.get(node.id));
      return `${node.leading}${normalizeTibiansTranslation(node.source, restored, locale)}${node.trailing}`;
    })
    .join("");

  const restoredTitle = protectedTitle.restore(translationPayload.title);
  if (/\[\[\s*TIBIA_TERM_\d+\s*\]\]/i.test(restoredTitle) || /\[\[\s*TIBIA_TERM_\d+\s*\]\]/i.test(contentHtml)) {
    throw new Error("OpenAI translation leaked a protected Tibia term placeholder");
  }

  return {
    title: restoredTitle,
    content: plainTextFromNewsHtml(contentHtml),
    contentHtml,
    sourceHash: original.sourceHash,
    translatedAt: new Date().toISOString(),
    model
  };
}

async function ensureNewsArchiveTranslations({ config, runtime, archive, locale }) {
  if (locale === "en" || !process.env.OPENAI_API_KEY?.trim() || !Array.isArray(archive?.articles)) {
    return archive;
  }

  const key = `${NEWS_ARCHIVE_KEY}:translation:${locale}`;
  if (runtime.inFlight.has(key)) return runtime.inFlight.get(key);

  const task = (async () => {
    let changed = false;
    for (const article of archive.articles) {
      const original = article.original;
      const cached = article.translations?.[locale];
      if (!original || !cached) continue;

      const repairedTitle = protectNewsBrandTerms(original.title).restore(cached.title);
      const repairedHtml = repairNewsTranslationPlaceholders(original.contentHtml, cached.contentHtml, locale);
      if (repairedTitle !== cached.title || repairedHtml !== cached.contentHtml) {
        cached.title = /\[\[\s*TIBIA_TERM_\d+\s*\]\]/i.test(repairedTitle) ? original.title : repairedTitle;
        cached.contentHtml = repairedHtml;
        cached.content = plainTextFromNewsHtml(repairedHtml);
        changed = true;
      }
    }

    // A API só entra para a notícia que acabou de chegar. As anteriores são
    // preservadas como arquivo local e recebem revisão/manual translation fora
    // deste ciclo, evitando custo e retraduções em massa.
    const newestArticle = sortNewsNewestFirst([...archive.articles])[0];
    for (const article of newestArticle ? [newestArticle] : []) {
      const original = article.original;
      const cached = article.translations?.[locale];
      if (!original || cached?.sourceHash === original.sourceHash) continue;

      try {
        const translation = await translateNewsArticle(original, locale);
        if (!translation) continue;
        article.translations ||= {};
        article.translations[locale] = translation;
        changed = true;
      } catch (error) {
        console.error(
          `[game-data-hub] news translation failed for ${article.id}/${locale}:`,
          error instanceof Error ? error.message : String(error)
        );
        // Do not destroy a valid source article when one translation attempt fails.
      }
    }

    if (changed) await writeSnapshot(config, NEWS_ARCHIVE_KEY, archive);
    return archive;
  })();

  runtime.inFlight.set(key, task);
  try {
    return await task;
  } finally {
    runtime.inFlight.delete(key);
  }
}

function presentNewsArchive(archive, locale) {
  return (Array.isArray(archive?.articles) ? archive.articles : []).map((article) => {
    const content = locale === "en" ? article.original : article.translations?.[locale] || article.original;
    const contentHtml = locale === "en"
      ? content?.contentHtml || ""
      : repairNewsTranslationPlaceholders(article.original?.contentHtml || "", content?.contentHtml || "", locale);
    return {
      id: article.id,
      date: article.date,
      title: content?.title || article.title,
      category: article.category,
      type: "news",
      url: article.url,
      content: plainTextFromNewsHtml(contentHtml) || content?.content || "",
      contentHtml
    };
  });
}

async function fetchTibiaDataCharacter(characterName) {
  return fetchJson(`${TIBIA_DATA_BASE}/v4/character/${encodeURIComponent(characterName)}`);
}

export async function fetchBossWorld(worldSlug) {
  const html = await fetchText(`${TIBIA_STATISTIC_BASE}/bosshunter/details/${worldSlug}`);
  return parseBossWorldPage(html, worldSlug);
}

export async function fetchBossDetail(worldSlug, bossSlug) {
  let detail = null;
  let primaryError = null;

  try {
    const html = await fetchText(`${TIBIA_STATISTIC_BASE}/bosshunter/${worldSlug}/${bossSlug}`);
    detail = parseBossDetailPage(html, worldSlug, bossSlug);
  } catch (error) {
    primaryError = error;
  }

  const worldName = detail?.worldName || titleizeSlug(worldSlug);
  const bossName = detail?.name || titleizeSlug(bossSlug);
  let resolvedBossName = bossName;
  let guildStats = await fetchGuildStatsBossWorldData(worldName, resolvedBossName).catch(() => null);

  if (!hasGuildStatsBossData(guildStats)) {
    const lookupBossName = await resolveGuildStatsBossName(worldName, bossSlug, bossName);
    if (lookupBossName && lookupBossName !== resolvedBossName) {
      resolvedBossName = lookupBossName;
      guildStats = await fetchGuildStatsBossWorldData(worldName, resolvedBossName).catch(() => guildStats);
    }
  }

  const routeMap = await fetchTibiaRouteBossMapData(worldName, resolvedBossName).catch(() => null);

  if (!detail && !guildStats && primaryError) {
    throw primaryError;
  }

  return mergeBossDetailSources(
    detail || createBossDetailShellFromGuildStats(worldSlug, bossSlug, resolvedBossName),
    guildStats,
    routeMap
  );
}

export async function fetchGuildStatsBossWorldData(worldName, bossName) {
  const html = await fetchText(`${GUILDSTATS_BASE}/bosses/${encodeURIComponent(worldName)}/${encodeURIComponent(bossName)}`);
  return parseGuildStatsBossWorldPage(html, worldName, bossName);
}

async function fetchTibiaRouteBossMapData(worldName, bossName) {
  const sourceUrl = buildTibiaRouteBossMapUrl(worldName, bossName);
  const html = await fetchText(sourceUrl);
  return parseTibiaRouteBossMapPage(html, sourceUrl);
}

async function resolveGuildStatsBossName(worldName, bossSlug, fallbackName) {
  try {
    const html = await fetchText(`${GUILDSTATS_BASE}/bosses/${encodeURIComponent(worldName)}`);
    const options = parseGuildStatsBossOptions(html);
    const wantedKeys = new Set([
      normalizeBossLookupKey(bossSlug),
      normalizeBossLookupKey(fallbackName)
    ]);

    return options.find((option) => wantedKeys.has(normalizeBossLookupKey(option))) || fallbackName;
  } catch {
    return fallbackName;
  }
}

async function fetchRookieWorlds() {
  const json = await fetchJson(`${ROOKIE_BASE}/worlds`);
  return {
    totalCount: Number(json?.data?.totalCount) || 0,
    items: Array.isArray(json?.data?.items) ? json.data.items : []
  };
}

async function fetchRookieTrending() {
  const json = await fetchJson(`${ROOKIE_BASE}/characters/trending`);
  return normalizeRookiePayload(json);
}

async function fetchRookieCharacters(query) {
  const json = await fetchJson(`${ROOKIE_BASE}/characters?${query.toString()}`);
  return normalizeRookiePayload(json);
}

async function fetchRookieCharacterDetail(characterId) {
  const json = await fetchJson(`${ROOKIE_BASE}/characters/${characterId}`);
  return normalizeRookiePayload(json);
}

async function fetchRookieCharacterForecast(characterId) {
  const json = await fetchJson(`${ROOKIE_BASE}/characters/${characterId}/forecast`);
  return normalizeRookiePayload(json);
}

async function fetchRookieCharacterActivity(characterId) {
  const json = await fetchJson(`${ROOKIE_BASE}/characters/${characterId}/activity`);
  return normalizeRookiePayload(json);
}

function normalizeRookiePayload(json) {
  if (json && typeof json === "object" && "data" in json) {
    return json.data;
  }

  return json;
}

function parseBoostedPage(html, type) {
  const normalizedType = type === "boss" ? "boss" : "creature";
  const currentMatch = html.match(
    normalizedType === "boss"
      ? /Today&#x27;s boosted boss:\s*([^<]+)</i
      : /Today&#x27;s boosted creature:\s*([^<]+)</i
  );
  const updatedMatch = html.match(/Last updated\s+([0-9:-]+\s+[0-9:]+\s+UTC)\.\s+Seen\s+(\d+)\s+time/i);
  const currentName = decodeHtml(currentMatch?.[1] || "");
  const rows = [...html.matchAll(/<tr>\s*<td>(\d{4}-\d{2}-\d{2})<\/td>\s*<td>\s*<img[^>]+src="([^"]+)"[\s\S]*?\/>\s*([^<]+)\s*<\/td>\s*<td>([^<]+)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<\/tr>/gi)]
    .map((match) => ({
      date: match[1],
      image: match[2],
      name: decodeHtml(match[3]),
      entryType: decodeHtml(match[4]),
      recentOccurrences: Number(match[5]) || 0
    }));

  return {
    type: normalizedType,
    current: {
      name: currentName,
      image: rows[0]?.image || null,
      lastUpdated: normalizeUtcText(updatedMatch?.[1] || ""),
      recentOccurrences: Number(updatedMatch?.[2]) || 0
    },
    recent: rows
  };
}

function parseBossWorldPage(html, worldSlug) {
  const titleMatch = html.match(/<h2 class="page-heading">Bosses on\s+([^<]+)<\/h2>/i);
  const countMatch = html.match(/(\d+)\s+bosses tracked on/i);
  const rows = [...html.matchAll(/<tr id="boss-[^"]+"\s+class="boss-row"\s+data-boss-key="([^"]*)"\s+data-chance="([^"]*)"\s+data-category="([^"]*)"[\s\S]*?<a href="\/bosshunter\/[^/]+\/([^"]+)">\s*<img src="([^"]+)" alt="([^"]+)"[\s\S]*?<a href="\/bosshunter\/[^/]+\/[^"]+" class="boss-name-link">\s*([^<]+)\s*<\/a>[\s\S]*?<td class="align-middle">\s*(\d{4}-\d{2}-\d{2})\s*\([A-Za-z]{3}\)\s*<span class="days-text">([^<]+)<\/span>/gi)]
    .map((match) => ({
      key: decodeHtml(match[1]),
      chanceClass: match[2],
      chanceLabel: normalizeChance(match[2]),
      category: decodeHtml(match[3]),
      bossSlug: match[4],
      image: match[5],
      alt: decodeHtml(match[6]),
      name: decodeHtml(match[7]),
      lastSeenDate: match[8],
      lastSeenRelative: decodeHtml(match[9])
    }));

  return {
    worldSlug,
    worldName: decodeHtml(titleMatch?.[1] || titleizeSlug(worldSlug)),
    totalBosses: Number(countMatch?.[1]) || rows.length,
    bosses: rows
  };
}

function parseBossDetailPage(html, worldSlug, bossSlug) {
  const nameMatch = html.match(/<h1 class="monster-name-header">\s*([^<]+)\s*<\/h1>/i);
  const imageMatch = html.match(/<img src="([^"]+)" alt="[^"]+" class="monster-image-head"/i);
  const categoryMatch = html.match(/<strong>Category:<\/strong>\s*([^<]+)</i);
  const lastSeenMatch = html.match(/<strong>Last Seen:<\/strong>\s*(\d{4}-\d{2}-\d{2})\s*\([A-Za-z]{3}\)\s*<span class="days-text-inline">\(([^)]+)\)<\/span>/i);
  const chanceMatch = html.match(/<strong class="me-1">Appearance chance:<\/strong>[\s\S]*?<span class="chance-text ms-1">([^<]+)<\/span>(?:[\s\S]*?<span class="chance-percentage [^"]+">\((\d+)%\)<\/span>)?/i);
  const statsMatch = html.match(/<p class="boss-stats-text">\s*([\s\S]*?)\s*<\/p>/i);
  const labels = parseJsNumberArray(html, "labels");
  const occurrences = parseJsNumberArray(html, "occurrences");
  const totalOccurrences = parseJsInteger(html, "totalOccurrences");
  const lastSeenDays = parseJsInteger(html, "lastSeenDays");
  const crossWorldRows = parseBossCrossWorldRows(html, bossSlug);

  return {
    worldSlug,
    worldName: titleizeSlug(worldSlug),
    bossSlug,
    name: decodeHtml((nameMatch?.[1] || "").replace(/\s*-\s*Tibia Boss\s*$/i, "")),
    image: imageMatch?.[1] || null,
    category: decodeHtml(categoryMatch?.[1] || ""),
    lastSeenDate: lastSeenMatch?.[1] || null,
    lastSeenRelative: decodeHtml(lastSeenMatch?.[2] || ""),
    appearanceChance: {
      label: decodeHtml(chanceMatch?.[1] || ""),
      percentage: Number(chanceMatch?.[2]) || 0
    },
    occurrenceStats: {
      summary: decodeHtml(stripTags(statsMatch?.[1] || "")),
      totalOccurrences,
      lastSeenDays,
      chart: labels.map((label, index) => ({
        day: label,
        occurrences: occurrences[index] || 0
      }))
    },
    crossWorlds: crossWorldRows,
    globalStats: null,
    respawnHistory: []
  };
}

function parseGuildStatsBossWorldPage(html, worldName, bossName) {
  const spawnTodayStat = extractGuildStatsBossStat(html, "Spawn boss today");
  const expectedInStat = extractGuildStatsBossStat(html, "Expected in");
  const lastSeenWorldStat = extractGuildStatsBossStat(html, `Last seen on ${worldName}`);
  const killedOnWorldStat = extractGuildStatsBossStat(html, `Killed on ${worldName}`);
  const killedPlayersOnWorldStat = extractGuildStatsBossStat(html, `Killed players on ${worldName}`);
  const killedOverallStat = extractGuildStatsBossStat(html, "Killed overall");
  const killedPlayersOverallStat = extractGuildStatsBossStat(html, "Killed players overall");
  const lastSeenInTibiaStat = extractGuildStatsBossStat(html, "Last seen in Tibia");
  const firstOccurrenceStat = extractGuildStatsBossStat(html, "First occurrence");
  const sampleOccurrencesMatch = html.match(/Based on a sample of\s*([\d,]+)\s*boss occurrences/i);
  const labels = parseJsArrayLiteral(html, "chartLabels");
  const values = parseJsArrayLiteral(html, "chartValues");
  // GuildStats now emits this as `const daysRound = 4`; accept every normal
  // declaration form so the current-day marker and the date cycle stay live.
  const currentDayValue = parseJsInteger(html, "daysRound");
  const mapIframeMatch = html.match(/<iframe[^>]+src="([^"]*tibiamaps\.io\/map\/embed#[^"]+)"[^>]*><\/iframe>/i);
  const respawnHistoryNoteMatch = html.match(/<td colspan="4" class="[^"]*text-center[^"]*">\s*([^<]*respawns too often to track[^<]*)\s*<\/td>/i);
  const respawnRows = [...html.matchAll(/<tr[^>]*class="[^"]*respawn-group[^"]*"[^>]*>[\s\S]*?<td class="py-2 px-4 text-white font-medium"[^>]*>\s*([0-9-]+)\s*[\s\S]*?<td class="py-1\.5 px-4 text-center text-gray-300">\s*([0-9,]+)\s*<\/td>\s*<td class="py-1\.5 px-4 text-center text-gray-300">\s*([0-9,]+)\s*<\/td>\s*<td class="py-1\.5 px-4 text-right text-gray-300">\s*([^<]+)\s*<\/td>/gi)]
    .map((match) => ({
      date: match[1],
      killedBosses: parseLooseInteger(match[2]),
      killedPlayers: parseLooseInteger(match[3]),
      world: decodeHtml(match[4])
    }));

  return {
    worldStats: {
      spawnTodayLabel: spawnTodayStat.value.replace(/\s*\([\d.]+%\)\s*$/i, ""),
      spawnTodayPercentage: parseLooseFloat(spawnTodayStat.value.match(/\(([\d.]+)%\)/)?.[1]),
      expectedIn: expectedInStat.value,
      expectedWindow: expectedInStat.note,
      lastSeenOnWorld: normalizeGuildStatsDate(lastSeenWorldStat.value),
      lastSeenOnWorldRelative: lastSeenWorldStat.note,
      killedOnWorld: parseLooseInteger(killedOnWorldStat.value),
      killedPlayersOnWorld: parseLooseInteger(killedPlayersOnWorldStat.value)
    },
    sampleOccurrences: parseLooseInteger(sampleOccurrencesMatch?.[1]),
    spawnChart: labels.map((day, index) => ({
      day: Number(day) || 0,
      percentage: Number(values[index]) || 0
    })).filter((entry) => entry.day > 0),
    currentDay: currentDayValue,
    globalStats: {
      killedOverall: parseLooseInteger(killedOverallStat.value),
      killedPlayersOverall: parseLooseInteger(killedPlayersOverallStat.value),
      lastSeenInTibia: normalizeGuildStatsDate(lastSeenInTibiaStat.value),
      firstOccurrence: normalizeGuildStatsDate(firstOccurrenceStat.value) || firstOccurrenceStat.value
    },
    respawnHistory: respawnRows,
    respawnHistoryNote: normalizeGuildStatsRespawnNote(respawnHistoryNoteMatch?.[1]),
    mapUrl: normalizeGuildStatsMapUrl(mapIframeMatch?.[1]),
    bossName
  };
}

function extractGuildStatsBossStat(html, label) {
  const match = html.match(new RegExp(
    `${escapeRegex(label)}\\s*<\\/div>\\s*<div[^>]*class="[^"]*text-white[^"]*font-bold[^"]*"[^>]*>([\\s\\S]*?)<\\/div>(?:\\s*<div[^>]*class="[^"]*text-gray-500[^"]*"[^>]*>\\s*\\(?([^<)]*)\\)?\\s*<\\/div>)?`,
    "i"
  ));
  const value = decodeHtml(stripTags(match?.[1] || "")).trim();
  const note = decodeHtml(stripTags(match?.[2] || "")).trim();

  return { value, note };
}

function parseGuildStatsBossOptions(html) {
  const selectMatch = html.match(/<select[^>]+id="bossSelect"[\s\S]*?<\/select>/i);
  const selectHtml = selectMatch?.[0] || "";

  return [...selectHtml.matchAll(/<option[^>]*value="([^"]+)"[^>]*>\s*([^<]*)\s*<\/option>/gi)]
    .map((match) => decodeHtml(match[1] || match[2]))
    .filter((name) => name && !/^\(choose boss\)$/i.test(name));
}

function hasGuildStatsBossData(guildStats) {
  if (!guildStats || typeof guildStats !== "object") {
    return false;
  }

  const worldStats = guildStats.worldStats || {};
  const globalStats = guildStats.globalStats || {};
  const firstOccurrence = String(globalStats.firstOccurrence || "").trim().toLowerCase();
  const lastSeenInTibia = String(globalStats.lastSeenInTibia || "").trim();

  return Boolean(
    worldStats.spawnTodayLabel ||
    worldStats.expectedIn ||
    worldStats.lastSeenOnWorld ||
    parseLooseInteger(worldStats.killedOnWorld) ||
    parseLooseInteger(worldStats.killedPlayersOnWorld) ||
    parseLooseInteger(globalStats.killedOverall) ||
    parseLooseInteger(globalStats.killedPlayersOverall) ||
    (lastSeenInTibia && lastSeenInTibia !== "-") ||
    (firstOccurrence && firstOccurrence !== "unknown" && firstOccurrence !== "-") ||
    (Array.isArray(guildStats.respawnHistory) && guildStats.respawnHistory.length) ||
    guildStats.respawnHistoryNote ||
    (Array.isArray(guildStats.spawnChart) && guildStats.spawnChart.length) ||
    guildStats.mapUrl
  );
}

function createBossDetailShellFromGuildStats(worldSlug, bossSlug, bossName) {
  return {
    worldSlug,
    worldName: titleizeSlug(worldSlug),
    bossSlug,
    name: bossName,
    image: null,
    category: "",
    lastSeenDate: null,
    lastSeenRelative: "",
    appearanceChance: {
      label: "",
      percentage: 0
    },
    occurrenceStats: {
      summary: "",
      totalOccurrences: 0,
      lastSeenDays: 0,
      chart: []
    },
    crossWorlds: [],
    globalStats: null,
    respawnHistory: []
  };
}

function mergeBossDetailSources(detail, guildStats, routeMap = null) {
  if (!guildStats) {
    return routeMap ? { ...detail, routeMap } : detail;
  }

  return {
    ...detail,
    occurrenceStats: {
      ...(detail?.occurrenceStats || {}),
      sampleOccurrences:
        parseLooseInteger(guildStats.sampleOccurrences) ||
        parseLooseInteger(detail?.occurrenceStats?.totalOccurrences) ||
        0
    },
    worldStats: guildStats.worldStats || null,
    spawnChart: Array.isArray(guildStats.spawnChart) ? guildStats.spawnChart : [],
    currentDay: guildStats.currentDay ?? null,
    globalStats: guildStats.globalStats || null,
    respawnHistory: Array.isArray(guildStats.respawnHistory) ? guildStats.respawnHistory : [],
    respawnHistoryNote: guildStats.respawnHistoryNote || "",
    mapUrl: guildStats.mapUrl || "",
    routeMap
  };
}

function parseBossCrossWorldRows(html, bossSlug) {
  const escapedBossSlug = escapeRegex(bossSlug);
  return [...html.matchAll(new RegExp(`<tr>[\\s\\S]*?<a href="/bosshunter/([^/]+)/${escapedBossSlug}">\\s*([^<]+)\\s*</a>[\\s\\S]*?<span class="chance-text ms-1">([^<]+)</span>(?:[\\s\\S]*?<span class="chance-percentage [^"]+">\\((\\d+)%\\)</span>)?[\\s\\S]*?<td class="text-center">\\s*(\\d{4}-\\d{2}-\\d{2}|Never|Unknown)?(?:[\\s\\S]*?<span class="days-text[^"]*">\\(?([^<)]*)\\)?</span>)?`, "gi"))]
    .map((match) => ({
      worldSlug: match[1],
      worldName: decodeHtml(match[2]),
      chanceLabel: decodeHtml(match[3]),
      chancePercentage: Number(match[4]) || 0,
      lastSeenDate: match[5] && /\d{4}-\d{2}-\d{2}/.test(match[5]) ? match[5] : null,
      lastSeenRelative: decodeHtml(match[6] || "")
    }));
}

function parseJsNumberArray(html, variableName) {
  const match = html.match(new RegExp(`var\\s+${escapeRegex(variableName)}\\s*=\\s*\\[([^\\]]*)\\]`, "i"));

  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

function parseJsInteger(html, variableName) {
  const match = html.match(new RegExp(`(?:var|let|const)\\s+${escapeRegex(variableName)}\\s*=\\s*(\\d+)`, "i"));
  return Number(match?.[1]) || 0;
}

function parseJsArrayLiteral(html, variableName) {
  const match = html.match(new RegExp(`const\\s+${escapeRegex(variableName)}\\s*=\\s*\\[([^\\]]*)\\]`, "i"));

  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

function extractJsStringValue(html, variableName) {
  const match = html.match(new RegExp(`const\\s+${escapeRegex(variableName)}\\s*=\\s*['"]([^'"]+)['"]`, "i"));
  return match?.[1] || "";
}

function parseLooseInteger(value) {
  const normalized = String(value || "").replace(/[^0-9-]/g, "");
  return normalized ? Number(normalized) || 0 : null;
}

function parseLooseFloat(value) {
  const normalized = String(value || "").replace(/[^0-9.,-]/g, "").replace(",", ".");
  return normalized ? Number(normalized) || 0 : null;
}

function normalizeGuildStatsDate(value) {
  const text = decodeHtml(value).trim();

  if (!text || /^unknown$/i.test(text)) {
    return "";
  }

  const match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) {
    return text;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function normalizeGuildStatsRespawnNote(value) {
  const text = decodeHtml(value).trim();

  if (/respawns too often to track/i.test(text)) {
    return "Este boss respawna com muita frequencia para rastrear o historico.";
  }

  return text;
}

function normalizeGuildStatsMapUrl(value) {
  const text = decodeHtml(value).trim();

  if (!text) {
    return "";
  }

  return text.replace("/map/embed#", "/map#");
}

function buildTibiaRouteBossMapUrl(worldName, bossName) {
  const bossSlug = String(bossName || "")
    .trim()
    .replace(/\s+/g, "-");
  return `${TIBIA_ROUTE_BASE}/br/boss-places/${encodeURIComponent(bossSlug)}/world-${encodeURIComponent(worldName)}`;
}

function parseTibiaRouteBossMapPage(html, sourceUrl) {
  const maps = extractTibiaRouteJsonArray(html, '\\"maps\\":');
  const directoryMatch = html.match(/\\"mapDirectory\\":\\"([^"]*)\\"/i);
  const cdnMatch = html.match(/\\"mapFromCDN\\":(true|false)/i);
  const normalizedMaps = normalizeTibiaRouteMaps(maps);

  if (!normalizedMaps.length) {
    return null;
  }

  return {
    sourceUrl,
    mapDirectory: decodeEscapedTibiaRouteString(directoryMatch?.[1] || ""),
    mapFromCDN: cdnMatch?.[1] === "true",
    maps: normalizedMaps
  };
}

function extractTibiaRouteJsonArray(html, marker) {
  const markerIndex = html.indexOf(marker);

  if (markerIndex < 0) {
    return [];
  }

  const start = html.indexOf("[", markerIndex + marker.length);

  if (start < 0) {
    return [];
  }

  let depth = 0;
  let inString = false;

  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    const next = html[index + 1];

    if (char === "\\" && next === '"') {
      inString = !inString;
      index += 1;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        const escapedJson = html.slice(start, index + 1);
        try {
          return JSON.parse(decodeEscapedTibiaRouteString(escapedJson));
        } catch {
          return [];
        }
      }
    }
  }

  return [];
}

function decodeEscapedTibiaRouteString(value) {
  return String(value || "")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function normalizeTibiaRouteMaps(maps) {
  if (!Array.isArray(maps)) {
    return [];
  }

  return maps
    .map((map) => {
      const paths = Array.isArray(map?.paths)
        ? map.paths
            .map((pathEntry) => ({
              floor: parseLooseInteger(pathEntry?.floor),
              pulseColor: decodeHtml(pathEntry?.pulseColor || ""),
              pathColor: decodeHtml(pathEntry?.pathColor || ""),
              weight: parseLooseInteger(pathEntry?.weight),
              delay: parseLooseInteger(pathEntry?.delay),
              dashArray: Array.isArray(pathEntry?.dashArray)
                ? pathEntry.dashArray.map((value) => parseLooseInteger(value)).filter((value) => value !== null)
                : [],
              routes: Array.isArray(pathEntry?.routes)
                ? pathEntry.routes
                    .map((point) => normalizeTibiaRoutePoint(point))
                    .filter(Boolean)
                : []
            }))
            .filter((pathEntry) => pathEntry.routes.length > 1)
        : [];

      if (!paths.length) {
        return null;
      }

      const markers = Array.isArray(map?.markers)
        ? map.markers
            .filter((marker) => !marker?.isDeleted)
            .map((marker) => ({
              ...normalizeTibiaRoutePoint(marker),
              icon: decodeHtml(marker?.icon || "")
            }))
            .filter((marker) => marker && marker.x !== null && marker.y !== null && marker.floor !== null)
        : [];

      return {
        id: decodeHtml(map?.id || ""),
        name: decodeHtml(map?.name || ""),
        slug: decodeHtml(map?.slug || ""),
        cords: normalizeTibiaRoutePoint(map?.cords),
        markers,
        paths,
        speed: parseLooseInteger(map?.speed) || 500,
        type: decodeHtml(map?.type || "")
      };
    })
    .filter(Boolean);
}

function normalizeTibiaRoutePoint(point) {
  if (!point || typeof point !== "object") {
    return null;
  }

  const x = parseLooseInteger(point.x);
  const y = parseLooseInteger(point.y);
  const floor = parseLooseInteger(point.floor);
  const zoom = parseLooseInteger(point.zoom);

  if (x === null || y === null) {
    return null;
  }

  return {
    x,
    y,
    floor,
    zoom
  };
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}: ${body.slice(0, 240)}`);
  }

  return body;
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}: ${body.slice(0, 240)}`);
  }

  return JSON.parse(body);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    return await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function inferSourceUpdatedAt(data, fallback) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  if (typeof data.current?.lastUpdated === "string" && data.current.lastUpdated) {
    return data.current.lastUpdated;
  }

  if (typeof data.lastUpdated === "string" && data.lastUpdated) {
    return data.lastUpdated;
  }

  if (typeof data.updatedAt === "string" && data.updatedAt) {
    return data.updatedAt;
  }

  return fallback;
}

function normalizeUtcText(value) {
  const normalized = decodeHtml(value).trim();
  return normalized || null;
}

function safeFileSegment(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value) {
  return String(value || "").replace(/<[^>]+>/g, " ");
}

function normalizeChance(value) {
  switch (String(value || "").toLowerCase()) {
    case "highchance":
      return "High Chance";
    case "mediumchance":
      return "Medium Chance";
    case "lowchance":
      return "Low Chance";
    case "nochance":
      return "No Chance";
    default:
      return decodeHtml(value);
  }
}

function sanitizeSlugValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .trim() || "level";
}

function normalizeBossLookupKey(value) {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function titleizeSlug(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function parsePositiveInteger(...values) {
  for (const value of values) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 1;
}

function extractBazaarFilters(searchParams, subtopic) {
  const normalizedSubtopic =
    String(subtopic || "").toLowerCase() === "pastcharactertrades"
      ? "pastcharactertrades"
      : "currentcharactertrades";
  const aliasMap = new Map([
    ["world", "filter_world"],
    ["profession", "filter_profession"],
    ["pvpType", "filter_worldpvptype"],
    ["battleyeState", "filter_worldbattleyestate"],
    ["levelFrom", "filter_levelrangefrom"],
    ["levelTo", "filter_levelrangeto"],
    ["skillId", "filter_skillid"],
    ["skillFrom", "filter_skillrangefrom"],
    ["skillTo", "filter_skillrangeto"],
    ["orderColumn", "order_column"],
    ["orderDirection", "order_direction"],
    ["searchType", "searchtype"],
    ["searchString", "searchstring"],
    ["page", "currentpage"]
  ]);
  const defaults = {
    currentpage: "1",
    filter_levelrangefrom: "0",
    filter_levelrangeto: "0",
    filter_profession: "0",
    filter_skillid: "",
    filter_skillrangefrom: "0",
    filter_skillrangeto: "0",
    filter_world: "",
    filter_worldbattleyestate: "0",
    filter_worldpvptype: "9",
    order_column: "101",
    order_direction: "1",
    searchstring: "",
    searchtype: normalizedSubtopic === "pastcharactertrades" ? "0" : "1"
  };
  const output = { ...defaults };

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const directValue = searchParams.get(key);
    if (directValue !== null) {
      output[key] = String(directValue).trim();
      continue;
    }

    const alias = [...aliasMap.entries()].find((entry) => entry[1] === key)?.[0];
    if (!alias) {
      output[key] = defaultValue;
      continue;
    }

    const aliasValue = searchParams.get(alias);
    output[key] = aliasValue !== null ? String(aliasValue).trim() : defaultValue;
  }

  return output;
}

function buildBazaarFilterCacheKey(filters) {
  return Object.entries(filters)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${String(value ?? "")}`)
    .join("&");
}

function buildBazaarSourceUrl(subtopic, filters) {
  const url = new URL("https://www.tibia.com/charactertrade/");
  url.searchParams.set("subtopic", subtopic);

  for (const [key, value] of Object.entries(filters || {})) {
    url.searchParams.set(key, String(value ?? ""));
  }

  return url.toString();
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const app = await createGameDataHubServer();
  const address = await app.start();
  console.log(`[game-data-hub] listening on http://${address.host}:${address.port}`);

  let isShuttingDown = false;
  const shutdown = async (signal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`[game-data-hub] shutting down after ${signal}`);

    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      console.error(
        `[game-data-hub] failed to shutdown cleanly: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("unhandledRejection", (error) => {
    console.error(`[game-data-hub] unhandled rejection: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    void shutdown("unhandledRejection");
  });
  process.on("uncaughtException", (error) => {
    console.error(`[game-data-hub] uncaught exception: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    void shutdown("uncaughtException");
  });
}
