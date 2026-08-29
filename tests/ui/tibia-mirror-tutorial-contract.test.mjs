import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../desktop/screen-vision/screen-vision.js", import.meta.url), "utf8");
const tourSource = await readFile(new URL("../../desktop/tutorial-tour.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../../desktop/main.js", import.meta.url), "utf8");
const preloadSource = await readFile(new URL("../../desktop/preload.cjs", import.meta.url), "utf8");
const selectorSource = await readFile(new URL("../../desktop/mirror-game-selector.html", import.meta.url), "utf8");

test("Tibia Mirror tutorial simulates a new profile without hiding real data", () => {
  const profileStart = source.indexOf("function hasMirrorProfile()");
  const profileEnd = source.indexOf("\nfunction isCreateProfileEmptyStateActive", profileStart);
  const profileBody = source.slice(profileStart, profileEnd);
  assert.match(profileBody, /tutorialProfileDemo\?\.active/);
  assert.match(profileBody, /profileCreated/);

  const emptyStateStart = source.indexOf("function renderEmptyState()");
  const emptyStateEnd = source.indexOf("\nfunction render", emptyStateStart + 1);
  const emptyStateBody = source.slice(emptyStateStart, emptyStateEnd);
  assert.match(emptyStateBody, /const hasRegions = tutorialProfileDemoActive \? false : state\.regions\.length > 0;/);
  assert.match(emptyStateBody, /tutorialProfileDemoActive\s*\? isTibiaWindowReadyForTutorial\(\)/);
});

test("Alerts tutorial focuses the actual spell-panel control", () => {
  assert.match(
    tourSource,
    /selector: '\[data-docked-action="set-alerts-view"\]\[data-alerts-view="magias"\]',[\s\S]*?setAlertDemoStage\?\.\("magic-toggle"\)/
  );
  assert.match(
    source,
    /data-docked-action="set-alerts-view"[\s\S]*?data-alerts-view="magias"/
  );
});

test("Tibia Mirror ends with the three-client compatibility notice", () => {
  assert.match(tourSource, /tibiaMirrorClients: "assets\/tutorial\/tibia-mirror-clientes\.png"/);
  assert.match(tourSource, /gif: TUTORIAL_ASSETS\.tibiaMirrorClients/);
  assert.match(tourSource, /<strong>Tibia, RubinOT e Medivia<\/strong>/);
  assert.match(tourSource, /as magias específicas não foram adaptadas aos dois OT servers/);
  const finalStepStart = tourSource.indexOf("gif: TUTORIAL_ASSETS.tibiaMirrorClients");
  const finalStepEnd = tourSource.indexOf("\n  }\n];", finalStepStart);
  const finalStep = tourSource.slice(finalStepStart - 180, finalStepEnd);
  assert.match(finalStep, /selector: \(\) => ensureTutorialExternalFocusAnchor\(\)/);
  assert.match(finalStep, /externalFocus: true/);
  assert.match(finalStep, /focusMirrorGameSelector\?\.\(true\)/);
  assert.doesNotMatch(finalStep, /data-tool-tab="screen-vision"/);
  assert.match(preloadSource, /tutorial:focus-mirror-game-selector/);
  assert.match(mainSource, /mirrorGameSelectorRequestedVisible \|\| mirrorGameSelectorTutorialFocus/);
  assert.match(mainSource, /!isTutorialPriorityActive\(\) \|\| mirrorGameSelectorTutorialFocus/);
  assert.match(mainSource, /ipcMain\.handle\("tutorial:focus-mirror-game-selector"/);
  assert.match(selectorSource, /#selector\.tutorial-focus/);
  assert.match(selectorSource, /classList\.toggle\('tutorial-focus',Boolean\(data\.tutorialFocus\)\)/);
});
