import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");
const dataServiceSource = await readFile(new URL("../../lib/data/data-service.js", import.meta.url), "utf8");

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test("Imbuement reuses the local Stash image index before its narrow fallback", () => {
  const body = sourceBetween(
    appSource,
    "function ensureIngredientMetadata(",
    "async function warmImbuementMetadata(",
  );

  assert.match(body, /await ensureStashLoaded\(\)/);
  assert.match(body, /state\.stashItemBySlug\.get\(lookupSlug\)/);
  assert.match(body, /localItem\.imageSrc/);
  assert.match(body, /unresolvedNames\.length > 0/);
  assert.match(body, /names: unresolvedNames/);
  assert.doesNotMatch(body, /names: missingNames/);
});

test("Imbuement sprites start independently from the Market request", () => {
  const body = sourceBetween(
    appSource,
    "async function refreshImbuementWorldData()",
    "function ensureIngredientMetadata(",
  );
  const metadataStart = body.indexOf("const ingredientMetadataPromise = ensureIngredientMetadata(ingredientNames)");
  const marketStart = body.indexOf("const fetchedMarket = await fetchImbuementMarket(");
  assert.ok(metadataStart >= 0 && marketStart > metadataStart);
  assert.match(body, /await ingredientMetadataPromise/);
});

test("the ingredient fallback no longer materialises one full item detail per image", () => {
  const body = sourceBetween(
    dataServiceSource,
    "async function getIngredientMetadata(",
    "async function fetchWorldCatalog(",
  );

  assert.match(body, /const metadataIndex = await getItemMetadataIndex\(\)/);
  assert.match(body, /getItemImageUrl\(itemMeta\)/);
  assert.doesNotMatch(body, /Promise\.all/);
  assert.doesNotMatch(body, /resolveItemDetail/);
});

test("other image-bearing tools remain on their bounded local or indexed paths", () => {
  assert.match(appSource, /function getSkillWeaponImage\(/);
  assert.match(appSource, /function getVocationOutfitPath\(/);
  assert.match(appSource, /const data = await fetchCreatureIndex\(\)/);
  assert.match(appSource, /await ensureStashLoaded\(\)/);
  assert.doesNotMatch(
    sourceBetween(appSource, "function renderSkillCalculatorCompact()", "function renderTibiaCoinsCtaMarkup("),
    /fetchItem|fetchIngredientMetadata|fetchCreatureDetail/,
  );
});
