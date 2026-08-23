import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");

test("Solo Hunt marks known static items and resolves missing Market values in a batch", () => {
  assert.match(appSource, /let staticItems = await mapLootItemsWithConcurrency/);
  assert.match(appSource, /staticResolved: true/);
  assert.match(appSource, /staticResolved: false/);
  assert.match(appSource, /const marketIds = \[\.\.\.new Set\(/);
  assert.match(appSource, /fetchStashMarketValues\(\{[\s\S]*?marketIds,[\s\S]*?forceFresh: true,[\s\S]*?mergeIntoWorldCache: true/);
  assert.match(appSource, /const itemsNeedingRefresh = staticItems\.filter\(\(item\) => \{[\s\S]*?if \(item\.staticResolved\) \{[\s\S]*?return false;/);
  assert.match(appSource, /const data = await fetchItem\(\{[\s\S]*?itemSlug: item\.slug/);
});

