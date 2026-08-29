import assert from "node:assert/strict";
import test from "node:test";

const mainSource = await (await import("node:fs/promises")).readFile(new URL("../desktop/main.js", import.meta.url), "utf8");
const handleSource = await (await import("node:fs/promises")).readFile(new URL("../desktop/window-move-handle.html", import.meta.url), "utf8");

test("external move handle references content-pack assets through the runtime protocol", () => {
  assert.match(handleSource, /tibiatoolkit:\/\/app\/assets\/window-controls\/move-window-static\.png/);
  assert.match(handleSource, /const grabIcon = "tibiatoolkit:\/\/app\/assets\/window-controls\/move-window-grab\.png"/);
  assert.doesNotMatch(handleSource, /\.\.\/assets\/ui\/window-controls\//);
  assert.match(handleSource, /pointerenter[\s\S]*icon\.src = staticIcon/);
  assert.match(handleSource, /pointerdown[\s\S]*icon\.src = grabIcon/);
  assert.match(handleSource, /closed-hand grip/);
  assert.match(handleSource, /box-shadow:\s*none/);
});

test("move handle follows the main window and changes side when the current side does not fit", () => {
  assert.match(mainSource, /function resolveWindowMoveHandleSide/);
  assert.match(mainSource, /currentSide === "left" && rightFits/);
  assert.match(mainSource, /currentSide === "right" && leftFits/);
  assert.match(mainSource, /window\.on\("move",[\s\S]*syncWindowMoveHandle\(\)/);
  assert.doesNotMatch(mainSource, /window\.on\("move",[\s\S]*if \(windowMoveHandleDragState\) \{\s*return;\s*\}/);
  assert.match(mainSource, /window\.on\("move",[\s\S]*syncMirrorGameSelector\(\)/);
  assert.match(mainSource, /window\.on\("move",[\s\S]*syncSupportersShowcase\(\)/);
  assert.match(mainSource, /window\.on\("move",[\s\S]*syncDesktopAdsShowcase\(\)/);
  assert.match(mainSource, /window\.on\("resize",[\s\S]*syncWindowMoveHandle\(\)/);
});

test("move handle drag updates the main window and exposes the expected tooltip", () => {
  assert.match(mainSource, /ipcMain\.on\("window-move-handle:drag-move"/);
  assert.match(mainSource, /function getWindowMoveHandleVirtualWorkArea/);
  assert.match(mainSource, /Use the whole virtual desktop/);
  assert.match(mainSource, /const area = getWindowMoveHandleVirtualWorkArea\(\);/);
  assert.match(mainSource, /mainWindow\.setPosition\(nextX, nextY, false\)/);
  assert.match(mainSource, /function preserveMainWindowTopmostDuringHandleDrag/);
  const dragMoveStart = mainSource.indexOf('ipcMain.on("window-move-handle:drag-move"');
  const dragMoveEnd = mainSource.indexOf('ipcMain.on("window-move-handle:drag-end"', dragMoveStart);
  const dragMoveSource = mainSource.slice(dragMoveStart, dragMoveEnd);
  assert.match(dragMoveSource, /mainWindow\.setPosition\(nextX, nextY, false\);/);
  assert.doesNotMatch(dragMoveSource, /setAlwaysOnTop\(|moveTop\(|reassertMainWindowZOrderNoActivate/);
  assert.doesNotMatch(dragMoveSource, /setFocusable\(/);
  assert.match(mainSource, /window-move-handle:drag-start[\s\S]*void writeDebugLog\("window-move-handle:drag-start"\)/);
  assert.match(mainSource, /command: "bringWindowToFrontNoActivate"/);
  assert.match(mainSource, /function restoreAuxiliaryStackAfterMainZOrder/);
  assert.match(mainSource, /function restoreMainWindowTopmost[\s\S]*window\.moveTop\(\)/);
  assert.doesNotMatch(mainSource, /window-move-handle:drag-start[\s\S]*reassertMainWindowZOrderNoActivate\("drag-start"\)/);
  assert.doesNotMatch(mainSource, /window-move-handle:drag-end[\s\S]*reassertMainWindowZOrderNoActivate\("drag-end"\)/);
  assert.match(mainSource, /isTutorialPriorityActive\(\)/);
  assert.match(mainSource, /Arraste para mover a janela do aplicativo/);
  assert.match(handleSource, /setPointerCapture\(event\.pointerId\)/);
});
