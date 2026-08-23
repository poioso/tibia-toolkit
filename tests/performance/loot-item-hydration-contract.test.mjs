import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");

test("loot item sprites hydrate progressively with bounded concurrency", () => {
  const start = appSource.indexOf("async function hydrateLootParsedItems(");
  const end = appSource.indexOf("\nasync function hydrateLootParsedMonsters", start);
  assert.ok(start >= 0 && end > start, "loot item hydration must remain available");

  const body = appSource.slice(start, end);
  assert.match(body, /mapLootItemsWithConcurrency\(\s*parsed\.items,\s*6,/);
  assert.match(body, /await ensureStashLoaded\(\)/);
  assert.match(body, /state\.stashItemBySlug\.get\(lookupSlug\)/);
  assert.match(body, /shouldContinue:\s*\(\)\s*=>\s*\(\s*requestId\s*===\s*state\.lootItemHydrationRequestId/);
  assert.match(body, /isLootVisualHydrationActive\(\)/);
  assert.match(body, /mapLootItemsWithConcurrency\(staticItems,\s*6,[\s\S]*?undefined,\s*\{\s*shouldContinue:/);
  assert.match(body, /parsed\.items = resolvedItems\.slice\(\);[\s\S]*renderLootSplitter\(\);/);
  assert.doesNotMatch(body, /await Promise\.all\(parsed\.items\.map/);
  assert.doesNotMatch(body, /patchLootItemTile[\s\S]*renderSoloLootOutput\(parsed\)/);
});

test("stale hydration queues stop launching more item work", () => {
  const start = appSource.indexOf("async function mapLootItemsWithConcurrency(");
  const end = appSource.indexOf("\nasync function hydrateLootParsedMonsters", start);
  assert.ok(start >= 0 && end > start, "bounded item mapper must remain available");

  const body = appSource.slice(start, end);
  assert.match(body, /options = \{\}/);
  assert.match(body, /while \(nextIndex < source\.length\) \{\s*if \(shouldContinue && !shouldContinue\(\)\) \{\s*return;/);
  assert.match(body, /results\[currentIndex\] = await worker[\s\S]*?if \(shouldContinue && !shouldContinue\(\)\) \{\s*return;/);
});
