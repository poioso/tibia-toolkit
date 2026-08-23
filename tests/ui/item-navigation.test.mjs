import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");

test("linked Library items switch from Books or Spells to the List view before loading", () => {
  const start = appSource.indexOf("async function handleItemSearch(skipInputNormalization = false) {");
  const end = appSource.indexOf("\nfunction findExactItemSuggestion", start);
  assert.ok(start >= 0 && end > start, "handleItemSearch must remain available");

  const body = appSource.slice(start, end);
  const switchIndex = body.indexOf('await setItemViewMode("list", { skipHistory: true });');
  const fetchIndex = body.indexOf("const staticData = await fetchItemStatic(");

  assert.ok(switchIndex >= 0, "linked item searches must activate the List view");
  assert.ok(fetchIndex > switchIndex, "the List view must activate before item data is loaded");
});

test("loaded linked items anchor the item summary instead of the search controls or NPC prices", () => {
  const start = appSource.indexOf("async function handleItemSearch(skipInputNormalization = false) {");
  const end = appSource.indexOf("\nfunction findExactItemSuggestion", start);
  assert.ok(start >= 0 && end > start, "handleItemSearch must remain available");

  const body = appSource.slice(start, end);
  assert.match(body, /const scrollLoadedItemSummary = \(\) => \{[\s\S]*scrollItemSummaryIntoView\(\)/);
  assert.equal((body.match(/scrollLoadedItemSummary\(\);/g) || []).length, 2);
});

test("Stash hydration preserves the single initial anchor", () => {
  const start = appSource.indexOf("async function hydrateStashPreviewItem(");
  const end = appSource.indexOf("\nfunction applyItemCurrencyRates", start);
  assert.ok(start >= 0 && end > start, "hydrateStashPreviewItem must remain available");

  const body = appSource.slice(start, end);
  const renderIndex = body.indexOf("renderItem(");
  const detailIndex = body.indexOf("showStashItemDetail();");

  assert.ok(renderIndex >= 0, "the hydrated Stash item must render the complete card");
  assert.ok(detailIndex > renderIndex, "Stash detail must be shown after the full card renders");
  assert.doesNotMatch(body, /scrollItemSummaryIntoView\(/, "hydration must not interrupt the initial smooth anchor");
});

test("item Wiki actions have one delegated listener instead of accumulating listeners", () => {
  const bindStart = appSource.indexOf("function bindEntityDetailActions(");
  const bindEnd = appSource.indexOf("\nfunction renderItemWikiButton", bindStart);
  assert.ok(bindStart >= 0 && bindEnd > bindStart, "bindEntityDetailActions must remain available");

  const bindBody = appSource.slice(bindStart, bindEnd);
  assert.match(bindBody, /button\.dataset\.externalLinkBound === "true"/);
  assert.match(bindBody, /button\.dataset\.externalLinkBound = "true"/);

  const wikiStart = bindEnd;
  const wikiEnd = appSource.indexOf("\nfunction ", wikiStart + 1);
  const wikiBody = appSource.slice(wikiStart, wikiEnd > wikiStart ? wikiEnd : undefined);
  assert.match(wikiBody, /els\.itemOpenWiki\.onclick = null;/);
  assert.match(wikiBody, /els\.itemOpenWiki\.dataset\.externalUrl = wikiUrl;/);
  assert.doesNotMatch(wikiBody, /openDesktopExternalLink\(wikiUrl\)/);
});
