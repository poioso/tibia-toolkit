import { enrichMiniWorldChange } from "./mini-world-change-visuals.mjs";

const DEFAULT_SOURCE_BASE = "https://tibiatrade.gg/trpc";
const DEFAULT_TIME_ZONE = "Europe/Berlin";
const DEFAULT_SERVER_SAVE_TIME = "10:00";
const DEFAULT_COLLECTION_TIMES = ["10:10", "10:30"];

const SOURCE_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "TibiaToolkit-GameDataHub/1.0 (+https://tibiatoolkit.com)"
};

export const MINI_WORLD_CHANGES_KEY = "mini-world-changes";

export function normalizeMiniWorldChangesConfig(input = {}) {
  const collectionTimes = normalizeCollectionTimes(input.collectionTimes);

  return {
    enabled: normalizeBoolean(input.enabled, true),
    sourceBase: String(input.sourceBase || DEFAULT_SOURCE_BASE).replace(/\/+$/, ""),
    timeZone: String(input.timeZone || DEFAULT_TIME_ZONE).trim() || DEFAULT_TIME_ZONE,
    serverSaveTime: normalizeClock(input.serverSaveTime, DEFAULT_SERVER_SAVE_TIME),
    collectionTimes: collectionTimes.length > 0 ? collectionTimes : [...DEFAULT_COLLECTION_TIMES],
    bootstrapWhenEmpty: normalizeBoolean(input.bootstrapWhenEmpty, true)
  };
}

export async function collectMiniWorldChanges({
  fetchImpl = fetch,
  sourceBase = DEFAULT_SOURCE_BASE,
  timeoutMs = 20_000,
  collectedAt = new Date().toISOString(),
  schedule = {}
} = {}) {
  const normalizedBase = String(sourceBase || DEFAULT_SOURCE_BASE).replace(/\/+$/, "");
  const [worldsPayload, catalogPayload] = await fetchTrpcBatch({
    fetchImpl,
    timeoutMs,
    url: `${normalizedBase}/world.list,miniWorldChange.list?batch=1&input=%7B%7D`,
    expectedCount: 2
  });
  const sourceWorlds = requireArray(worldsPayload?.worlds, "world.list worlds");
  const sourceCatalog = requireArray(catalogPayload?.mini_world_changes, "miniWorldChange.list catalog");
  const catalog = sourceCatalog
    .map((entry) => ({
      id: Number(entry?.id),
      name: String(entry?.name || "").trim()
    }))
    .filter((entry) => Number.isFinite(entry.id) && entry.name);

  if (catalog.length === 0) {
    throw new Error("TibiaTrade returned an empty Mini World Changes catalog.");
  }

  const procedureNames = catalog.map(() => "miniWorldChange.listActiveWorlds").join(",");
  const input = Object.fromEntries(
    catalog.map((entry, index) => [String(index), { mini_world_change_id: entry.id }])
  );
  const activePayloads = await fetchTrpcBatch({
    fetchImpl,
    timeoutMs,
    url: `${normalizedBase}/${procedureNames}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
    expectedCount: catalog.length
  });
  const activeByWorldId = new Map();

  activePayloads.forEach((payload, index) => {
    const change = catalog[index];
    const activeWorlds = requireArray(payload?.active_worlds, `active worlds for ${change.name}`);

    for (const active of activeWorlds) {
      const worldId = Number(active?.world_id);
      if (!Number.isFinite(worldId)) continue;

      const entries = activeByWorldId.get(worldId) || [];
      entries.push(enrichMiniWorldChange({
        id: change.id,
        name: change.name,
        sourceRecordId: Number.isFinite(Number(active?.id)) ? Number(active.id) : null
      }));
      activeByWorldId.set(worldId, entries);
    }
  });

  const worlds = sourceWorlds
    .map((world) => {
      const id = Number(world?.id);
      const name = String(world?.name || "").trim();
      if (!Number.isFinite(id) || !name) return null;

      return {
        id,
        name,
        pvpType: String(world?.pvp_type || "").trim() || null,
        battleyeColor: String(world?.battleye_color || world?.worlld_battleye_color || "").trim() || null,
        activeMiniWorldChanges: (activeByWorldId.get(id) || []).sort(compareByName)
      };
    })
    .filter(Boolean)
    .sort(compareByName);
  const activeAssignmentCount = worlds.reduce(
    (total, world) => total + world.activeMiniWorldChanges.length,
    0
  );

  return {
    schemaVersion: 1,
    source: {
      provider: "TibiaTrade",
      baseUrl: "https://tibiatrade.gg",
      collectedAt
    },
    schedule: {
      timeZone: String(schedule.timeZone || DEFAULT_TIME_ZONE),
      serverSaveTime: String(schedule.serverSaveTime || DEFAULT_SERVER_SAVE_TIME),
      collectionTimes: normalizeCollectionTimes(schedule.collectionTimes).length > 0
        ? normalizeCollectionTimes(schedule.collectionTimes)
        : [...DEFAULT_COLLECTION_TIMES]
    },
    catalog: catalog.sort(compareByName).map(enrichMiniWorldChange),
    worlds,
    stats: {
      worldCount: worlds.length,
      catalogCount: catalog.length,
      activeAssignmentCount,
      worldsWithActiveCount: worlds.filter((world) => world.activeMiniWorldChanges.length > 0).length,
      upstreamRequestCount: 2
    }
  };
}

export function getDueMiniWorldChangeSlots({
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
  collectionTimes = DEFAULT_COLLECTION_TIMES,
  completedSlots = []
} = {}) {
  const local = getZonedDateTimeParts(now, timeZone);
  const completed = new Set(Array.isArray(completedSlots) ? completedSlots : []);
  const currentMinute = local.hour * 60 + local.minute;

  return normalizeCollectionTimes(collectionTimes)
    .filter((clock) => clockToMinutes(clock) <= currentMinute)
    .map((clock) => `${local.date}T${clock}@${timeZone}`)
    .filter((slot) => !completed.has(slot));
}

export function getTodayDueMiniWorldChangeSlots({
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
  collectionTimes = DEFAULT_COLLECTION_TIMES
} = {}) {
  return getDueMiniWorldChangeSlots({ now, timeZone, collectionTimes, completedSlots: [] });
}

export function getZonedDateTimeParts(date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

export function pruneCompletedMiniWorldChangeSlots(slots, keepDays = 8) {
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1_000;
  return [...new Set(Array.isArray(slots) ? slots : [])]
    .filter((slot) => {
      const datePart = String(slot).slice(0, 10);
      const timestamp = Date.parse(`${datePart}T12:00:00Z`);
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    })
    .sort();
}

async function fetchTrpcBatch({ fetchImpl, timeoutMs, url, expectedCount }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: SOURCE_HEADERS,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`TibiaTrade request failed with HTTP ${response.status}.`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length !== expectedCount) {
      throw new Error(`TibiaTrade returned an unexpected batch size (${payload?.length ?? "invalid"}).`);
    }

    return payload.map((entry, index) => {
      if (entry?.error) {
        throw new Error(`TibiaTrade tRPC batch item ${index} failed: ${entry.error.message || "unknown error"}`);
      }

      if (!entry?.result || !("data" in entry.result)) {
        throw new Error(`TibiaTrade tRPC batch item ${index} has no result data.`);
      }

      return entry.result.data;
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeCollectionTimes(value) {
  const entries = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(entries.map((entry) => normalizeClock(entry, "")).filter(Boolean))]
    .sort((left, right) => clockToMinutes(left) - clockToMinutes(right));
}

function normalizeClock(value, fallback) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function clockToMinutes(clock) {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`TibiaTrade returned invalid ${label}.`);
  }
  return value;
}

function compareByName(left, right) {
  return String(left?.name || "").localeCompare(String(right?.name || ""), "en", { sensitivity: "base" });
}
