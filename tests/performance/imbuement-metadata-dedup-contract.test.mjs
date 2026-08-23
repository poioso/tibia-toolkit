import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../app.js", import.meta.url), "utf8");

test("Imbuement metadata uses one shared in-flight promise", () => {
  assert.match(source, /let ingredientMetadataPromise = null;/);
  assert.match(source, /let ingredientMetadataPromiseNames = new Set\(\);/);
  assert.match(source, /let ingredientMetadataPromiseWorldSlug = "";/);
  assert.match(source, /if \(ingredientMetadataPromise\) \{/);
  assert.match(source, /const activePromise = ingredientMetadataPromise;/);
  assert.match(source, /return activePromise\.then\(\(\) => ensureIngredientMetadata\(requestedNames\)\);/);
  assert.match(source, /trackedPromise = run\.finally\(\(\) => \{/);
});

test("Imbuement Market remains a separate request from ingredient metadata", () => {
  const refresh = source.match(/async function refreshImbuementWorldData\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
  const metadataStart = refresh.indexOf("const ingredientMetadataPromise = ensureIngredientMetadata(ingredientNames)");
  const marketStart = refresh.indexOf("const fetchedMarket = await fetchImbuementMarket(");
  assert.ok(metadataStart >= 0 && marketStart > metadataStart);
  assert.match(refresh, /const metadataReady = await ingredientMetadataPromise;/);
});
