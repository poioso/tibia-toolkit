import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const dataServiceSource = await readFile(
  new URL("../../lib/data/data-service.js", import.meta.url),
  "utf8",
);
const desktopMainSource = await readFile(
  new URL("../../desktop/main.js", import.meta.url),
  "utf8",
);

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("startup does not eagerly hydrate item, imbuement or Mini World Changes market data", () => {
  const startupTail = sourceBetween(
    appSource,
    "await runInitialSplashTask(97, 98",
    "updateInitialSplashProgress(100)",
  );

  assert.doesNotMatch(startupTail, /fetchItem\s*\(/);
  assert.doesNotMatch(startupTail, /refreshImbuementWorldData\s*\(/);
  assert.doesNotMatch(startupTail, /loadMiniWorldChanges\s*\(/);
});

test("startup currency icons use direct local assets without building the item index", () => {
  const currencyIcons = sourceBetween(
    appSource,
    "function renderCurrencyIcons()",
    "function createShortcutMarkup",
  );

  assert.match(appSource, /TIBIA_COINS_CURRENCY_ICON_PATH = "assets\/data\/items\/sprites\/5113\.png"/);
  assert.match(appSource, /GOLD_TOKEN_CURRENCY_ICON_PATH = "assets\/data\/items\/sprites\/4239\.png"/);
  assert.match(currencyIcons, /TIBIA_COINS_CURRENCY_ICON_PATH/);
  assert.match(currencyIcons, /GOLD_TOKEN_CURRENCY_ICON_PATH/);
  assert.doesNotMatch(currencyIcons, /fetchIngredientMetadata\s*\(/);
});

test("startup checks Library updates without parsing active and backup catalogs for media cleanup", () => {
  const startupLibraryCheck = sourceBetween(
    desktopMainSource,
    "setTimeout(() => {\n        void checkLibraryCatalogUpdates()",
    "startLibraryCatalogSignalMonitor();",
  );
  const activation = sourceBetween(
    desktopMainSource,
    "async function activatePendingLibraryCatalogUpdate()",
    "async function promptStartupUpdate",
  );

  assert.doesNotMatch(startupLibraryCheck, /cleanupLibraryCatalogMediaCache\s*\(/);
  assert.match(activation, /cleanupLibraryCatalogMediaCache\s*\(/);
});

test("world changes only refresh the currently visible live-data surface", () => {
  const worldChange = sourceBetween(
    appSource,
    "async function selectWorldSuggestion",
    "function refreshOpenBossTrackerForCurrentWorld",
  );

  assert.match(worldChange, /state\.selectedSection === "item-prices"/);
  assert.match(worldChange, /state\.selectedSection === "tools"/);
  assert.match(worldChange, /state\.selectedSection === "mini-world-changes"/);
  assert.doesNotMatch(worldChange, /void refreshCurrencyRates/);
  assert.doesNotMatch(worldChange, /scheduleWarmItemCache/);
});

test("Stash Market paints local cache, refreshes visible items and continues in background", () => {
  const visibleLoader = sourceBetween(
    appSource,
    "async function loadVisibleStashMarketValues",
    "async function loadStashWorldMarketSnapshot",
  );
  const snapshotLoader = sourceBetween(
    appSource,
    "async function loadStashWorldMarketSnapshot",
    "function getStashMarketContextSignature",
  );

  assert.match(visibleLoader, /options\?\.onlyVisible !== false/);
  assert.match(visibleLoader, /const continueInBackground = options\?\.continueInBackground === true/);
  assert.match(visibleLoader, /!showBlockingProgress \|\| continueInBackground/);
  assert.match(visibleLoader, /forceFresh: true/);
  assert.match(visibleLoader, /scheduleStashMarketBackgroundRefresh\(/);
  assert.match(snapshotLoader, /localOnly: true/);
  assert.match(appSource, /async function refreshNextStashMarketBackgroundChunk/);
  assert.match(appSource, /loadAllCached: true/);
  assert.match(appSource, /forceFresh: true/);
  assert.match(appSource, /pendingIds\.slice\(0, 120\)/);
});

test("Stash Market refresh uses only the custom tooltip", () => {
  assert.match(appSource, /stashMarketRefreshButton\.removeAttribute\("title"\)/);
  assert.doesNotMatch(appSource, /stashMarketRefreshButton\.title\s*=/);
  assert.doesNotMatch(indexSource, /id="stash-market-refresh-button"[^>]*\btitle=/);
  assert.doesNotMatch(indexSource, /id="stash-market-refresh-button"[^>]*data-i18n-title=/);
});

test("local Stash snapshot never requires a world-catalog or remote Market request", () => {
  const stashService = sourceBetween(
    dataServiceSource,
    "async function getStashMarketValues",
    "async function fetchCachedWorldMarketSnapshot",
  );
  const localBranch = stashService.indexOf("if (loadAllCached && localOnly)");
  const worldCatalog = stashService.indexOf("await fetchWorldCatalog()");

  assert.ok(localBranch >= 0 && localBranch < worldCatalog);
  assert.match(stashService, /return readStoredWorldMarketSnapshot\(worldSlug\)/);
});

test("item requests keep item, Tibia Coins and Gold Token in one market batch", () => {
  const itemFetch = sourceBetween(
    dataServiceSource,
    "async function fetchFreshItemData",
    "async function getCurrencyRates",
  );

  assert.match(itemFetch, /itemDetail\.marketId/);
  assert.match(itemFetch, /tibiaCoinDetail\?\.marketId/);
  assert.match(itemFetch, /goldTokenDetail\?\.marketId/);
  assert.match(itemFetch, /currencyRates:/);
});

test("transient empty item Market responses cannot poison the item cache", () => {
  const itemRequest = sourceBetween(
    dataServiceSource,
    "async function getItemData",
    "async function getStaticItemData",
  );
  const itemFetch = sourceBetween(
    dataServiceSource,
    "async function fetchFreshItemData",
    "async function getCurrencyRates",
  );

  assert.match(itemRequest, /cachedMarketIsAuthoritative = hasMeaningfulMarketData\(cached\?\.market\)/);
  assert.match(itemRequest, /cachedMarketIsAuthoritative/);
  assert.match(itemFetch, /if \(hasMeaningfulMarketData\(itemMarket\)\) \{\s*await putCache\(cacheKey, result\)/);
});

test("changing worlds releases a cancelled Stash Market request before scheduling the next one", () => {
  const worldSelection = sourceBetween(
    appSource,
    "async function selectWorldSuggestion",
    "function refreshOpenBossTrackerForCurrentWorld",
  );

  assert.match(worldSelection, /state\.stashMarketRequestId \+= 1;/);
  assert.match(worldSelection, /state\.stashLoadingMarket = false;/);
  assert.match(worldSelection, /cancelStashMarketBackgroundRefresh\(\);/);
  assert.match(worldSelection, /scheduleStashMarketLoad\(\);/);
  assert.ok(
    worldSelection.indexOf("state.stashLoadingMarket = false;") <
      worldSelection.indexOf("scheduleStashMarketLoad();"),
  );
});

test("Stash Market status reports fresh prices for the current world only", () => {
  const statusRenderer = sourceBetween(
    appSource,
    "function setStashGridStatus",
    "function getStashItemValue",
  );

  assert.match(statusRenderer, /state\.stashValueMode !== "market"/);
  assert.match(statusRenderer, /state\.stashMarketFreshIds\[item\.marketId\]/);
  assert.match(statusRenderer, /Market: \$\{formatCompactNumber\(freshCount\)\}\/\$\{formatCompactNumber\(eligibleCount\)\}/);
  assert.doesNotMatch(statusRenderer, /state\.stashMarketById\[item\.marketId\]/);
});

test("opportunistic item warmup is static and cannot trigger Market requests", () => {
  const warmup = sourceBetween(
    appSource,
    "async function warmCurrentWorldItemCache",
    "function syncCurrencyButtons",
  );

  assert.match(warmup, /await fetchItemStatic\s*\(/);
  assert.doesNotMatch(warmup, /await fetchItem\s*\(/);
});
