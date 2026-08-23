import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serviceSource = await readFile(new URL("../../lib/data/data-service.js", import.meta.url), "utf8");
const catalog = JSON.parse(await readFile(new URL("../../assets/data/stash-catalog.json", import.meta.url), "utf8"));

test("Stash ships a compact catalog with the reviewed source hash", () => {
  assert.equal(catalog.schemaVersion, 1);
  assert.match(catalog.sourceSha256, /^[a-f0-9]{64}$/i);
  assert.equal(catalog.itemCount, catalog.items.length);
  assert.equal(catalog.items.length, 6758);
  assert.equal(catalog.categories.length, 65);
  assert.equal(catalog.traders.length, 202);
  assert.ok(catalog.items.every((item) => item.slug && item.name && item.imageSrc !== undefined));
});

test("Stash prefers the compact catalog and preserves the full-index fallback", () => {
  assert.match(serviceSource, /const STASH_CATALOG_BUNDLE_PATH = "assets\/data\/stash-catalog\.json"/);
  assert.match(serviceSource, /async function loadStashCatalog\(\)/);
  assert.match(serviceSource, /const compactCatalog = await loadStashCatalog\(\)/);
  assert.match(serviceSource, /if \(compactCatalog\) \{\s*return compactCatalog;/);
  assert.match(serviceSource, /const \[metadataIndex, weeklyTaskItemNames, itemSpriteAtlas\]/);
  assert.match(serviceSource, /overlayChanges/);
  assert.match(serviceSource, /activeHash && activeHash !== String\(bundle\.sourceSha256\)/);
});
