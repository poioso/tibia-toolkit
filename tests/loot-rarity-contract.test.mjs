import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("missing loot rarity stays unclassified and is never rendered as common", async () => {
  const [dataService, siteBrowser, desktop] = await Promise.all([
    readFile(new URL("../lib/data/data-service.js", import.meta.url), "utf8"),
    readFile(new URL("../site/app/LibraryBrowser.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
  ]);

  assert.match(dataService, /return rarityCandidate \|\| lootQualifier \|\| contextRarity \|\| "unknown";/);
  assert.doesNotMatch(dataService, /return rarityCandidate \|\| lootQualifier \|\| contextRarity \|\| "common";/);
  assert.match(siteBrowser, /visibleEntries = entries\.filter\(\(entry\) => normalizeLootRarity\(entry\.rarity\) !== "unknown"\)/);
  assert.match(desktop, /visibleLoot = loot\.filter\(\(item\) => normalizeRenderedCreatureLootRarity\(item\.rarity\) !== "unknown"\)/);
});
