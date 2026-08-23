import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");
const dataServiceSource = await readFile(
  new URL("../../lib/data/data-service.js", import.meta.url),
  "utf8",
);
const marketCacheSource = await readFile(
  new URL("../../services/market-cache/server.mjs", import.meta.url),
  "utf8",
);
const siteMarketRouteSource = await readFile(
  new URL("../../site/app/api/app-market/[...path]/route.ts", import.meta.url),
  "utf8",
);
const siteMarketCacheSource = await readFile(
  new URL("../../site/lib/market-cache.ts", import.meta.url),
  "utf8",
);

test("Stash prefers the bounded VPS snapshot before ID batches", () => {
  assert.match(appSource, /stashMarketBackgroundPreferSnapshot/);
  assert.match(appSource, /loadAllCached: true,\s*forceFresh: true/);
  assert.match(dataServiceSource, /market_snapshot\?server=/);
  assert.match(dataServiceSource, /failFastNotFound: true/);
  assert.match(dataServiceSource, /MARKET_SNAPSHOT_TIMEOUT_MS/);
  assert.match(dataServiceSource, /notModified && cachedValue\?\.values/);
  assert.match(dataServiceSource, /Array\.isArray\(payload\.values\)/);
  assert.match(dataServiceSource, /market_snapshot_delta\?server=/);
  assert.match(dataServiceSource, /fromVersion/);
  assert.match(dataServiceSource, /payload\.removed\.forEach/);
  assert.match(dataServiceSource, /market-values:\$\{slugifyWorldName\(worldSlug \|\| DEFAULT_WORLD\)\}:/);
  assert.match(dataServiceSource, /dataServiceRuntime\.storageGet\(null\)/);
  assert.match(dataServiceSource, /await putCache\(cacheKey, \{[\s\S]*values: merged/);
  assert.doesNotMatch(dataServiceSource, /if \(!isUsingCustomMarketApi\(\)\)/);
});

test("Market snapshot exposes stable version metadata and conditional reads", () => {
  assert.match(marketCacheSource, /url\.pathname === "\/market_snapshot"/);
  assert.match(marketCacheSource, /url\.pathname === "\/market_snapshot_delta"/);
  assert.match(marketCacheSource, /schemaVersion: 1/);
  assert.match(marketCacheSource, /conditionalRequests: true/);
  assert.match(marketCacheSource, /snapshotVersion/);
  assert.match(marketCacheSource, /createHash\("sha256"\)/);
  assert.match(marketCacheSource, /sizeBytes/);
  assert.match(marketCacheSource, /checksum: `sha256:/);
  assert.match(marketCacheSource, /gzipAsync/);
  assert.match(marketCacheSource, /ETag/);
  assert.match(marketCacheSource, /if-none-match/);
  assert.match(marketCacheSource, /statusCode === 304/);
  assert.match(marketCacheSource, /persistMarketSnapshotHistory/);
  assert.match(marketCacheSource, /currentVersion/);
  assert.match(marketCacheSource, /fallback: "\/market_snapshot"/);
});

test("Snapshot fallback keeps the legacy bridge path available", () => {
  assert.match(dataServiceSource, /error\?\.status === 404/);
  assert.match(dataServiceSource, /tempo limite esgotado/);
  assert.match(dataServiceSource, /limit: "7000"/);
  assert.match(dataServiceSource, /mergeMarketValuesPreservingValidCache\(cachedValue\?\.values, result\)/);
  assert.match(dataServiceSource, /MARKET_SNAPSHOT_INVALID/);
});

test("Public bridge protects bursts without imposing a total item quota", () => {
  assert.match(marketCacheSource, /publicRateLimitPerMinute/);
  assert.match(marketCacheSource, /publicMaxConcurrent/);
  assert.match(marketCacheSource, /publicMaxItemIds/);
  assert.match(marketCacheSource, /publicMaxResponseBytes/);
  assert.match(marketCacheSource, /publicMaxClientKeys/);
  assert.match(marketCacheSource, /prunePublicRequestHistory/);
  assert.match(marketCacheSource, /429/);
  assert.match(marketCacheSource, /Retry-After/);
  assert.match(marketCacheSource, /413/);
  assert.match(marketCacheSource, /maxItemIds/);
  assert.match(marketCacheSource, /validateMarketQuery/);
  assert.match(marketCacheSource, /Parametro nao permitido/);
  assert.doesNotMatch(marketCacheSource, /daily|monthly|total.*quota/i);
});

test("Market retries honor Retry-After and preserve cached data after 429", () => {
  assert.match(dataServiceSource, /getRetryDelay\(attempt, response\.headers\.get\("retry-after"\)\)/);
  assert.match(dataServiceSource, /error\?\.status === 429/);
  assert.match(dataServiceSource, /return cachedEntry\?\.value \|\| \[\]/);
  assert.match(dataServiceSource, /parseRetryAfterMs/);
  assert.match(dataServiceSource, /Math\.random\(\)/);
});

test("Forced item refreshes deduplicate and retain a valid cached batch", () => {
  assert.match(dataServiceSource, /const marketRequestsInFlight = new Map\(\)/);
  assert.match(dataServiceSource, /const inFlight = marketRequestsInFlight\.get\(cacheKey\)/);
  assert.match(dataServiceSource, /const cachedEntry = await getCacheEntry\(cacheKey\)/);
  assert.match(dataServiceSource, /if \(!bypassCache && cachedEntry\?\.value/);
  assert.match(dataServiceSource, /marketRequestsInFlight\.delete\(cacheKey\)/);
});

test("The site bridge exposes the snapshot without falling back to a public IP", () => {
  assert.match(siteMarketRouteSource, /"market_snapshot"/);
  assert.match(siteMarketRouteSource, /"market_snapshot_delta"/);
  assert.match(siteMarketRouteSource, /"since"/);
  assert.match(siteMarketRouteSource, /acceptedStatuses:.*409/);
  assert.match(siteMarketRouteSource, /status: sourceResponse\.status/);
  assert.match(siteMarketRouteSource, /fetchMarketCacheResponse/);
  assert.match(siteMarketRouteSource, /sourceResponse\.status === 304/);
  assert.match(siteMarketCacheSource, /http:\/\/poioso-market-cache:4317/);
  assert.doesNotMatch(siteMarketCacheSource, /138\.117\.217\.99/);
});
