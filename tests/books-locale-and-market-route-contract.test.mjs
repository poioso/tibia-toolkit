import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("book detail accepts both canonical and source translation field names", async () => {
  const desktop = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(desktop, /book\.translatedText \|\| book\.ptText/);
  assert.match(desktop, /book\.englishText \|\| book\.originalText \|\| book\.rawText/);
  assert.match(desktop, /await loadBooksDocuments\(\)/);
  assert.match(desktop, /selectBookDocument\(openBookSlug, \{ scrollIntoView: false \}\)/);
});

test("public market bridge accepts the query names used by the desktop app", async () => {
  const route = await readFile(
    new URL("../site/app/api/app-market/[...path]/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /"server"/);
  assert.match(route, /"servers"/);
  assert.match(route, /"item_ids"/);
});

test("desktop and site clients never call the external Market provider directly", async () => {
  const [desktopConfig, dataService, siteMarketCache, vpsChecker] = await Promise.all([
    readFile(new URL("../desktop/app-config.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/data/data-service.js", import.meta.url), "utf8"),
    readFile(new URL("../site/lib/market-cache.ts", import.meta.url), "utf8"),
    readFile(new URL("../desktop/vps-checker/lib/monitor-service.mjs", import.meta.url), "utf8"),
  ]);

  for (const source of [desktopConfig, dataService, siteMarketCache, vpsChecker]) {
    assert.doesNotMatch(source, /api\.tibiamarket\.top/);
  }

  assert.match(desktopConfig, /https:\/\/tibiatoolkit\.com\/api\/app-market/);
  assert.match(dataService, /https:\/\/tibiatoolkit\.com\/api\/app-market/);
});

test("development app prefers local market homologation without changing production", async () => {
  const desktopMain = await readFile(new URL("../desktop/main.js", import.meta.url), "utf8");

  assert.match(desktopMain, /const fileBases = usesProductionDataServices\s*\? configuredMarketBases/);
  assert.match(desktopMain, /http:\/\/127\.0\.0\.1:3042\/api\/app-market/);
});
