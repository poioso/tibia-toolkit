import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("manual market refresh is server-authorized and survives app identity changes", async () => {
  const app = await source("app.js");
  const main = await source("desktop/main.js");
  const runtimeApi = await source("lib/data/runtime-api.js");
  const dataService = await source("lib/data/data-service.js");
  const route = await source("prototypes/auth-foundation/app/api/product/market/manual-refresh/route.js");
  const migration = await source("prototypes/auth-foundation/migrations/033_market_manual_refresh_cooldowns.sql");

  assert.match(app, /await reserveStashMarketRefresh\(\)/);
  assert.match(app, /performance\.now\(\)/);
  assert.match(app, /stash\.refreshMarketCooldown/);
  assert.match(app, /classList\.toggle\("blocked", marketModeActive && cooldownActive\)/);
  assert.doesNotMatch(app, /STASH_MARKET_REFRESH_COOLDOWN_MS/);
  assert.doesNotMatch(app, /state\.stashMarketById = \{\s*\.\.\.state\.stashMarketById,\s*\.\.\.values/);

  assert.match(main, /accountInstallationIdStorageKey/);
  assert.match(main, /\/api\/product\/market\/manual-refresh/);
  assert.match(main, /JSON\.stringify\(\{ installationId \}\)/);
  assert.match(runtimeApi, /type: "get-stash-market-refresh-status"/);
  assert.match(runtimeApi, /type: "reserve-stash-market-refresh"/);
  assert.match(dataService, /case "get-stash-market-refresh-status"/);
  assert.match(dataService, /case "reserve-stash-market-refresh"/);

  assert.match(route, /status: 429/);
  assert.match(route, /Retry-After/);
  assert.match(route, /FOR UPDATE/);
  assert.match(route, /result\.accepted/);
  assert.match(route, /allowed: true, accepted: true/);
  assert.match(migration, /installation_id TEXT PRIMARY KEY/);
});

test("manual market refresh preserves cached values when a fresh response is empty", async () => {
  const dataService = await source("lib/data/data-service.js");
  const app = await source("app.js");

  assert.match(dataService, /mergeMarketValuesPreservingValidCache/);
  assert.match(dataService, /hasMeaningfulMarketValue\(existing\) && !hasMeaningfulMarketValue\(incoming\)/);
  assert.match(app, /hasMeaningfulStashMarketValue\(existing\)/);
});
