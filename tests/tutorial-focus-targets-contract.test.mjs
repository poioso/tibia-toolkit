import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tutorialSource = fs.readFileSync(path.join(projectRoot, "desktop", "tutorial-tour.js"), "utf8");
const mainSource = fs.readFileSync(path.join(projectRoot, "desktop", "main.js"), "utf8");

test("item list tutorial exposes and focuses the external Buy Me a Coffee control", () => {
  const coffeeStep = tutorialSource.match(/gif:\s*TUTORIAL_ASSETS\.coffee,([\s\S]*?)\n\s*},\n\s*\{/i)?.[1] || "";

  assert.ok(coffeeStep, "Buy Me a Coffee tutorial step must exist");
  assert.match(coffeeStep, /externalFocus:\s*true/);
  assert.match(coffeeStep, /focusSupportersShowcase\?\.\("coffee"\)/);
});

test("last books tutorial step opens and focuses the visible map panel after previous-step cleanup", () => {
  const booksRoute = tutorialSource.match(/const TUTORIAL_BOOKS_STEP_META\s*=\s*\[([\s\S]*?)\n\];/)?.[1] || "";

  assert.match(booksRoute, /selector:\s*"#books-detail \[data-books-inline-map-panel\]:not\(\.hidden\)"/);
  assert.match(booksRoute, /afterPreviousClose:\s*async \(\) =>/);
  assert.match(booksRoute, /openMap:\s*true/);
});

test("tutorial target is refreshed after the previous spotlight closes", () => {
  assert.match(tutorialSource, /await step\.afterPreviousClose\?\.\(\)/);
  assert.match(tutorialSource, /const targetElement = findVisibleTutorialElement\(selector\);\s*\n\s*const element = targetElement \|\| document\.body/);
  assert.match(tutorialSource, /rect\.width > 0[\s\S]*?rect\.height > 0/);
});

test("auto-height growth preserves the side chosen around the focused element", () => {
  assert.match(mainSource, /tutorialPopoverResizePlacement\s*=\s*chosen\.placement/);
  assert.match(mainSource, /tutorialPopoverResizePlacement\s*===\s*"bottom"\s*\?\s*bounds\.y/);
  assert.match(mainSource, /tutorialPopoverResizePlacement\.startsWith\("top"\)\s*\?\s*bounds\.y\s*-\s*heightDelta/);
});
