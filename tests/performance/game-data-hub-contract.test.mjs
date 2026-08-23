import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function source(relativePath) {
  return readFile(path.join(workspaceRoot, relativePath), "utf8");
}

const hubSource = await source("site/lib/game-data-hub.ts");
const appGameRouteSource = await source("site/app/api/app-game/[...path]/route.ts");
const worldsRouteSource = await source("site/app/api/worlds/route.ts");
const bossRouteSource = await source("site/app/api/boss-tracker/route.ts");
const findPartyRouteSource = await source("site/app/api/find-party/route.ts");
const boostedRouteSource = await source("site/app/api/boosted/route.ts");
const supportersRouteSource = await source("site/app/api/supporters/route.ts");
const newsRouteSource = await source("site/app/api/news/route.ts");
const newsTickerRouteSource = await source("site/app/api/news-ticker/route.ts");
const tibiaDataPublicSource = await source("site/lib/tibiadata-public.ts");
const appDataServiceSource = await source("lib/data/data-service.js");
const gameDataHubSource = await source("services/game-data-hub/server.mjs");

test("site Game Data uses the private Hub name instead of historical public IPs", () => {
  for (const content of [hubSource, appGameRouteSource, worldsRouteSource, bossRouteSource, findPartyRouteSource, boostedRouteSource, supportersRouteSource]) {
    assert.doesNotMatch(content, /138\.117\.217\.99|136\.248\.77\.127/);
  }
  assert.match(hubSource, /site-hub:4318/);
  assert.match(appGameRouteSource, /fetchGameDataHubJson/);
  assert.match(gameDataHubSource, /td-boosted-creature/);
  assert.match(gameDataHubSource, /const TIBIA_DATA_BASE = "https:\/\/api\.tibiadata\.com";/);
  assert.match(gameDataHubSource, /TIBIA_DATA_BASE\}\/v4\/creatures/);
  assert.match(gameDataHubSource, /TIBIA_DATA_BASE\}\/v4\/boostablebosses/);
  assert.doesNotMatch(gameDataHubSource, /key: "ts-boosted-(?:creature|boss)"/);
});

test("site queries allowed TibiaData resources directly and keeps a cached Hub fallback", () => {
  assert.match(bossRouteSource, /fetchGameDataHubJson/);
  assert.doesNotMatch(bossRouteSource, /function bases|api\.tibiadata\.com|fetchDirect/);
  assert.match(findPartyRouteSource, /fetchTibiaDataPublicJson/);
  assert.match(findPartyRouteSource, /freshMs:\s*0/);
  assert.match(findPartyRouteSource, /fetchGameDataHubJson/);
  assert.match(worldsRouteSource, /fetchTibiaDataPublicJson/);
  assert.match(worldsRouteSource, /fetchGameDataHubJson/);
  assert.match(newsRouteSource, /fetchTibiaDataPublicJson/);
  assert.match(newsTickerRouteSource, /fetchTibiaDataPublicJson/);
  assert.match(tibiaDataPublicSource, /https:\/\/api\.tibiadata\.com/);
  assert.match(boostedRouteSource, /fetchTibiaDataPublicJson/);
  assert.match(boostedRouteSource, /\/v4\/creatures/);
  assert.match(boostedRouteSource, /\/v4\/boostablebosses/);
  assert.doesNotMatch(boostedRouteSource, /fetchGameDataHubJson/);
});

test("desktop live-data consumers keep public TibiaData exceptions explicit", () => {
  assert.match(appDataServiceSource, /DEFAULT_GAME_DATA_HUB_BASE = "https:\/\/tibiatoolkit\.com\/api\/app-game"/);
  assert.match(appDataServiceSource, /fetchGameDataHubJson/);
  assert.match(appDataServiceSource, /TIBIA_DATA_API_BASE = "https:\/\/api\.tibiadata\.com\/v4"/);
  assert.match(appDataServiceSource, /TIBIA_DATA_API_BASE}\/world\/\$\{encodeURIComponent\(worldName\)\}/);
  assert.match(appDataServiceSource, /fetchTibiaDataBoostedJson\("\/creatures"\)/);
  assert.match(appDataServiceSource, /fetchTibiaDataBoostedJson\("\/boostablebosses"\)/);
  assert.doesNotMatch(appDataServiceSource, /fetchDirectBoss/);
});
