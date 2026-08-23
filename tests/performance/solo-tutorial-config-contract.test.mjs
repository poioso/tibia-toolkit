import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");
const tutorialSource = await readFile(new URL("../../desktop/tutorial-tour.js", import.meta.url), "utf8");

test("solo tutorial config does not reset analysis when its mode is already active", () => {
  const start = appSource.indexOf("configureLootAnalyzerTour(options = {}) {");
  const end = appSource.indexOf("\n    async prepareSoloAnalyzerEventsTutorial", start);
  assert.ok(start >= 0 && end > start, "tour configuration must remain available");

  const body = appSource.slice(start, end);
  assert.match(body, /const modeChanged = state\.lootMode !== nextMode/);
  assert.match(body, /if \(modeChanged\) \{[\s\S]*setLootMode\(nextMode\)/);
  assert.match(body, /else if \(textChanged\) \{[\s\S]*parseAndRenderLootSplitter\(\)/);
  assert.doesNotMatch(body, /setLootMode\(options\.mode/);
});

test("solo tutorial clears the sample before it reaches the dedicated input step", () => {
  const soloStart = tutorialSource.indexOf("const TUTORIAL_SOLO_ANALYZER_STEP_META");
  const soloEnd = tutorialSource.indexOf("\nconst TUTORIAL_PARTY_FINDER_STEP_META", soloStart);
  const body = tutorialSource.slice(soloStart, soloEnd);
  assert.match(body, /configureLootAnalyzerTour\?\.\(\{ mode: "solo", text: "" \}\)/);
  assert.equal((body.match(/text: SOLO_ANALYZER_TUTORIAL_SAMPLE/g) || []).length, 1);
});

test("clearing the solo tutorial sample keeps the empty parser result safe", () => {
  const start = appSource.indexOf("function parseAndRenderLootSplitter()");
  const end = appSource.indexOf("\nfunction cancelSoloLootMarketLoading", start);
  const body = appSource.slice(start, end);
  assert.match(body, /const parsed = state\.lootMode === "solo"/);
  assert.match(body, /itemCount: parsed\?\.items\?\.length \|\| 0/);
  assert.match(body, /monsterCount: parsed\?\.monsters\?\.length \|\| 0/);
});

test("restoring Solo Hunt after the tutorial parses exactly once", () => {
  const start = appSource.indexOf("restoreLootAnalyzerTourState(snapshot, options = {})");
  const end = appSource.indexOf("\n    getFindPartyTourState", start);
  const body = appSource.slice(start, end);
  assert.match(body, /setLootMode\(options\.endMode === "solo" \? "solo" : "party"\)/);
  assert.doesNotMatch(body, /setLootMode[\s\S]*parseAndRenderLootSplitter\(\)/);
});
