import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../desktop/tutorial-popover.html", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../../desktop/main.js", import.meta.url), "utf8");
const tourSource = await readFile(new URL("../../desktop/tutorial-tour.js", import.meta.url), "utf8");

test("tutorial popover hides the previous GIF until the current step media loads", () => {
  const start = source.indexOf("function renderTutorialPopover(payload) {");
  const end = source.indexOf("\n    // O processo principal pode preparar", start);
  const body = source.slice(start, end);

  assert.match(body, /gif\.hidden = true;/);
  assert.match(body, /gif\.removeAttribute\("src"\);/);
  assert.match(body, /gif\.addEventListener\("load", revealGif, \{ once: true \}\);/);
  assert.match(body, /gif\.hidden = false;/);
  assert.match(source, /window\.renderTutorialPopover = renderTutorialPopover/);
  assert.match(source, /window\.clearTutorialPopover = clearTutorialPopover/);
});

test("a visible tutorial popover clears its composed frame before it is hidden", () => {
  const start = mainSource.indexOf('ipcMain.handle("tutorial:close-step"');
  const end = mainSource.indexOf('\n  ipcMain.handle("tutorial-popover:resize-to-content"', start);
  const body = mainSource.slice(start, end);
  assert.match(body, /if \(tutorialPopoverWindow\.isVisible\(\)\)/);
  assert.match(body, /window\.clearTutorialPopover\?\.\(\)/);
  assert.match(body, /clearTutorialPopover[\s\S]*requestAnimationFrame/);
  assert.ok(
    body.indexOf("window.clearTutorialPopover") < body.indexOf("tutorialPopoverWindow.hide()"),
    "the old composed surface must be cleared before hiding the popover"
  );
});

test("main process renders a reused tutorial window before showing it", () => {
  const start = mainSource.indexOf('ipcMain.handle("tutorial:show-step"');
  const end = mainSource.indexOf('\n  ipcMain.handle("tutorial:close-step"', start);
  const body = mainSource.slice(start, end);

  assert.match(body, /window\.renderTutorialPopover\?\./);
  assert.match(body, /tutorialPopoverWindow\.showInactive\(\);/);
  assert.ok(
    body.indexOf("window.renderTutorialPopover") < body.indexOf("tutorialPopoverWindow.showInactive()"),
    "the new step must render before the reused window becomes visible"
  );
  assert.doesNotMatch(
    body,
    /renderTutorialPopover[\s\S]*requestAnimationFrame/,
    "a hidden popover must not wait for animation frames before it can be shown"
  );
});

test("desktop ads stay below the interactive tutorial window", () => {
  const syncStart = mainSource.indexOf("function syncDesktopAdsShowcase(options = {})");
  const syncEnd = mainSource.indexOf("\nfunction notifyDesktopAdsShowcaseResume", syncStart);
  const syncBody = mainSource.slice(syncStart, syncEnd);
  assert.match(syncBody, /desktopAdsShowcaseWindow\.setAlwaysOnTop\(true, "floating"\)/);

  const tutorialStart = mainSource.indexOf("async function ensureTutorialPopoverWindow");
  const tutorialEnd = mainSource.indexOf("\nlet runtimeAssetsRoot", tutorialStart);
  const tutorialBody = mainSource.slice(tutorialStart, tutorialEnd);
  assert.match(tutorialBody, /tutorialPopoverWindow\.setAlwaysOnTop\(true, "screen-saver"\)/);
});

test("every tutorial modal enables the event-driven native priority guard", () => {
  const priorityStart = mainSource.indexOf("function enforceTutorialPriority(");
  const priorityEnd = mainSource.indexOf("\nlet runtimeAssetsRoot", priorityStart);
  const priorityBody = mainSource.slice(priorityStart, priorityEnd);
  assert.match(priorityBody, /BrowserWindow\.getAllWindows\(\)/);
  assert.match(priorityBody, /auxiliaryWindow\.setAlwaysOnTop\(true, "floating"\)/);
  assert.match(priorityBody, /owner\.setAlwaysOnTop\(true, "screen-saver"\)/);
  assert.match(priorityBody, /function setTutorialPriority\(owner, active\)/);
  assert.match(priorityBody, /tutorialPriorityOwner = owner;[\s\S]*?enforceTutorialPriority\(\);/);
  assert.doesNotMatch(priorityBody, /setInterval\(enforceTutorialPriority/);

  assert.match(tourSource, /tutorial\?\.setPriority\?\.\(blocked\)/);
  assert.match(tourSource, /function openWelcome\(\)[\s\S]*setPriority\?\.\(true\)/);
  assert.match(tourSource, /function openTutorialConfirmation[\s\S]*setPriority\?\.\(true\)/);
  assert.match(tourSource, /function closeWelcome\(\)[\s\S]*setPriority\?\.\(false\)/);
  assert.match(tourSource, /function closeTutorialConfirmation\(\)[\s\S]*setPriority\?\.\(false\)/);
});
