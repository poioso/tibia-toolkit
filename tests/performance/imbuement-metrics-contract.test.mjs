import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../app.js", import.meta.url), "utf8");

test("imbuement refresh records cache, market and independent local ingredient phases", () => {
  const refresh = source.match(/async function refreshImbuementWorldData\(\) \{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(refresh, /const refreshStartedAt = performance\.now\(\);/);
  assert.match(refresh, /recordPerformanceMetric\("imbuement-cache-ready"/);
  assert.match(refresh, /recordPerformanceMetric\("imbuement-market-ready"/);
  assert.match(refresh, /recordPerformanceMetric\("imbuement-ingredients-ready"/);
  assert.match(refresh, /recordPerformanceMetric\("imbuement-refresh-failed"/);
  assert.match(refresh, /const cachedEntry = await loadStoredImbuementMarket\(selectedWorld\.name\);/);
  assert.match(refresh, /await fetchImbuementMarket\(\{[\s\S]*?forceFresh: true/);
  assert.match(refresh, /const ingredientMetadataPromise = ensureIngredientMetadata\(ingredientNames\)/);
  assert.match(refresh, /const metadataReady = await ingredientMetadataPromise;/);
});
