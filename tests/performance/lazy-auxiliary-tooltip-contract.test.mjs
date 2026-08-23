import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktopMainSource = await readFile(
  new URL("../../desktop/main.js", import.meta.url),
  "utf8",
);

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("the auxiliary tooltip renderer is lazy by default with an emergency eager rollback", () => {
  assert.match(
    desktopMainSource,
    /const eagerAuxiliaryTooltips = process\.env\.TIBIA_TOOLKIT_EAGER_AUXILIARY_TOOLTIPS === "1"/,
  );

  const handleCreation = sourceBetween(
    desktopMainSource,
    "async function ensureWindowMoveHandle(owner = mainWindow)",
    "async function ensureTutorialPopoverWindow",
  );
  assert.doesNotMatch(handleCreation, /window-move-handle-tooltip-preload\.cjs/);
  assert.doesNotMatch(handleCreation, /window-move-handle-tooltip\.html/);
  assert.match(handleCreation, /if \(eagerAuxiliaryTooltips\) \{\s*await ensureWindowMoveHandleTooltip\(owner\)/);
});

test("first hover creates one tooltip renderer and hover leave cancels delayed display", () => {
  const tooltipCreation = sourceBetween(
    desktopMainSource,
    "async function ensureWindowMoveHandleTooltip(owner = mainWindow)",
    "function hideWindowMoveHandleTooltip",
  );
  const tooltipVisibility = sourceBetween(
    desktopMainSource,
    "function hideWindowMoveHandleTooltip",
    "function syncWindowMoveHandle",
  );

  assert.match(tooltipCreation, /if \(windowMoveHandleTooltipPromise\) return windowMoveHandleTooltipPromise/);
  assert.match(tooltipCreation, /window-move-handle-tooltip-preload\.cjs/);
  assert.match(tooltipCreation, /window-move-handle-tooltip\.html/);
  assert.match(tooltipCreation, /auxiliary-tooltip-created mode=/);
  assert.match(tooltipCreation, /auxiliary-tooltip-create-failed error=/);
  assert.match(tooltipVisibility, /windowMoveHandleTooltipRequestToken \+= 1/);
  assert.match(tooltipVisibility, /const requestToken = \+\+windowMoveHandleTooltipRequestToken/);
  assert.match(tooltipVisibility, /await ensureWindowMoveHandleTooltip\(mainWindow\)/);
  assert.match(tooltipVisibility, /requestToken !== windowMoveHandleTooltipRequestToken/);
});

test("tooltip IPC hover handlers explicitly detach their asynchronous work", () => {
  const handlers = sourceBetween(
    desktopMainSource,
    'ipcMain.on("desktop-ads:hover"',
    'ipcMain.on("window-move-handle:drag-start"',
  );

  assert.match(handlers, /void showDesktopAdsTooltip\(payload\.text, payload\.rect\)/);
  assert.match(handlers, /if \(hovering\) void showWindowMoveHandleTooltip\(\)/);
});
