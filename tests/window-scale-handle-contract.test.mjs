import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

const mainSource = await fs.readFile(new URL("../desktop/main.js", import.meta.url), "utf8");
const handleSource = await fs.readFile(new URL("../desktop/window-scale-handle.html", import.meta.url), "utf8");

test("scale handle uses a dedicated proportional drag channel", () => {
  assert.match(handleSource, /windowScaleHandleApi\?\.startDrag/);
  assert.match(handleSource, /windowScaleHandleApi\?\.setHovering/);
  assert.doesNotMatch(handleSource, /requestAnimationFrame\(flush\)/);
  assert.match(mainSource, /ipcMain\.on\("window-scale-handle:drag-start"/);
  assert.doesNotMatch(mainSource, /ipcMain\.on\("window-scale-handle:drag-move"/);
  assert.match(mainSource, /ipcMain\.on\("window-scale-handle:drag-end"/);
  assert.doesNotMatch(handleSource, /event\.movement[XY]/);
  assert.match(mainSource, /const cursor = screen\.getCursorScreenPoint\(\)/);
  assert.match(mainSource, /mainWindow\.setMinimumSize\(1, 1\)/);
  assert.match(mainSource, /mainWindow\.setMaximumSize\(workArea\.width, workArea\.height\)/);
  assert.match(mainSource, /applyDesktopUiScaleFromCursor\(\)/);
  assert.match(mainSource, /syncWindowMoveHandleDuringScaleDrag\(nextBounds, scale\)/);
  assert.match(mainSource, /syncWindowScaleHandleDuringDrag\(nextBounds, scale\)/);
  assert.match(mainSource, /setDesktopWindowZoom\(windowScaleHandleWindow, scale\)/);
  assert.match(mainSource, /window-scale-handle:hover/);
  assert.match(mainSource, /Redimensionar janela/);
  assert.match(mainSource, /window-scale-handle:performance/);
  assert.match(mainSource, /function abortWindowScaleHandleDrag/);
  assert.match(mainSource, /abortWindowScaleHandleDrag\("main-window-blur"\)/);
  assert.match(mainSource, /window-scale-handle:drag-abort reason=/);
  assert.match(mainSource, /function isTibiaMirrorWindow/);
  assert.match(mainSource, /&& !isTibiaMirrorWindow\(window\)/);
  assert.match(mainSource, /if \(windowScaleHandleDragState\) return;/);
  assert.match(mainSource, /if \(scale >= previousScale\)/);
  assert.match(mainSource, /resizable: true,[\s\S]*backgroundColor: "#1d2129"/);
  assert.doesNotMatch(mainSource, /windowScaleHandleDragState\.wasResizable/);
  assert.match(mainSource, /const size = scaleDesktopUiValue\(WINDOW_SCALE_HANDLE_SIZE\)/);
  assert.match(mainSource.slice(mainSource.indexOf("function syncWindowScaleHandle"), mainSource.indexOf("function syncWindowScaleHandleDuringDrag")), /setDesktopWindowZoom\(windowScaleHandleWindow\)/);
  assert.match(mainSource, /mainWindow\.webContents\.setZoomFactor\(scale\)/);
});

test("scale gesture does not call native Mirror geometry and preserves hierarchy restoration", () => {
  const scaleStart = mainSource.indexOf("function applyDesktopUiScaleFromCursor");
  const scaleEnd = mainSource.indexOf("function beginWindowScaleHandleDrag", scaleStart);
  const scaleSource = mainSource.slice(scaleStart, scaleEnd);
  assert.doesNotMatch(scaleSource, /syncRegionMirrorWindows|mirrorBounds|callNativeHost/);
  assert.match(mainSource, /restoreAuxiliaryStackAfterMainZOrder\("scale-drag-end"\)/);
  assert.match(mainSource, /syncWindowScaleHandle\(\{ forceShow: true, preserveStacking: true \}\)/);
  assert.match(mainSource, /function isWindowHandleDragActive\(\)[\s\S]*windowMoveHandleDragState \|\| windowScaleHandleDragState/);
  const focusStart = mainSource.indexOf('window.on("focus"');
  const focusEnd = mainSource.indexOf('window.on("ready-to-show"', focusStart);
  const focusSource = mainSource.slice(focusStart, focusEnd);
  assert.doesNotMatch(focusSource, /!windowMoveHandleDragState/);
  assert.match(focusSource, /!isWindowHandleDragActive\(\)/);

  const zOrderStart = mainSource.indexOf("async function reassertMainWindowZOrderNoActivate");
  const zOrderEnd = mainSource.indexOf("async function restoreAuxiliaryStackAfterMainZOrder", zOrderStart);
  const zOrderSource = mainSource.slice(zOrderStart, zOrderEnd);
  assert.match(zOrderSource, /mode=electron-after-native-error/);
  assert.match(zOrderSource, /mainWindow\.setAlwaysOnTop\(true, "screen-saver"\)/);
});

test("desktop popups inherit the current proportional scale", () => {
  const zoomStart = mainSource.indexOf("function setDesktopWindowZoom");
  const zoomEnd = mainSource.indexOf("function isTibiaMirrorWindow", zoomStart);
  const zoomSource = mainSource.slice(zoomStart, zoomEnd);
  assert.match(zoomSource, /window\.webContents\.on\("did-finish-load", reapplyCurrentScale\)/);
  assert.match(zoomSource, /window\.on\("show", reapplyCurrentScale\)/);

  const closeStart = mainSource.indexOf("async function showAppCloseChoiceDialog");
  const closeEnd = mainSource.indexOf("async function requestMainWindowClose", closeStart);
  const closeSource = mainSource.slice(closeStart, closeEnd);
  assert.match(closeSource, /const width = scaleDesktopUiValue\(430\)/);
  assert.match(closeSource, /const height = scaleDesktopUiValue\(286\)/);
  assert.match(closeSource, /setDesktopWindowZoom\(dialogWindow\)/);

  const confirmStart = mainSource.indexOf("async function showScreenVisionConfirmDialog");
  const promptStart = mainSource.indexOf("async function showScreenVisionPromptDialog", confirmStart);
  const confirmSource = mainSource.slice(confirmStart, promptStart);
  assert.match(confirmSource, /scaleDesktopUiValue\(requestedWidth\)/);
  assert.match(confirmSource, /scaleDesktopUiValue\(requestedHeight\)/);
  assert.match(confirmSource, /setDesktopWindowZoom\(dialogWindow\)/);
  assert.match(mainSource.slice(promptStart), /setDesktopWindowZoom\(dialogWindow\)/);

  const screenshotStart = mainSource.indexOf("async function ensureDesktopScreenshotAssistant");
  const screenshotEnd = mainSource.indexOf("async function closeDesktopScreenshotAssistantHelp", screenshotStart);
  const screenshotSource = mainSource.slice(screenshotStart, screenshotEnd);
  assert.match(screenshotSource, /const width = scaleDesktopUiValue\(276\)/);
  assert.match(screenshotSource, /const height = scaleDesktopUiValue\(154\)/);
  assert.match(screenshotSource, /setDesktopWindowZoom\(window\)/);

  const tutorialStart = mainSource.indexOf("async function ensureTutorialPopoverWindow");
  const tutorialEnd = mainSource.indexOf("function enforceTutorialPriority", tutorialStart);
  const tutorialSource = mainSource.slice(tutorialStart, tutorialEnd);
  assert.match(tutorialSource, /scaleDesktopUiValue\(390\)/);
  assert.match(tutorialSource, /setDesktopWindowZoom\(tutorialPopoverWindow\)/);

  const pickerStart = mainSource.indexOf("function getDesktopGlobalWorldPickerBounds");
  const pickerEnd = mainSource.indexOf("async function openDesktopGlobalWorldPicker", pickerStart);
  const pickerSource = mainSource.slice(pickerStart, pickerEnd);
  assert.match(pickerSource, /const width = scaleDesktopUiValue\(352\)/);
  assert.match(pickerSource, /scaleDesktopUiValue\(Number\(requestedHeight\) \|\| 344\)/);

  const alertStart = mainSource.indexOf("function computeAlertWindowBounds");
  const alertEnd = mainSource.indexOf("function resolveAlertDisplay", alertStart);
  const alertSource = mainSource.slice(alertStart, alertEnd);
  assert.match(alertSource, /const width = scaleDesktopUiValue\(logicalWidth\)/);
  assert.match(alertSource, /const height = scaleDesktopUiValue\(logicalHeight\)/);

  const splashStart = mainSource.indexOf("async function createSplashWindow");
  const splashEnd = mainSource.indexOf("function closeSplashWindow", splashStart);
  const splashSource = mainSource.slice(splashStart, splashEnd);
  assert.match(splashSource, /const width = scaleDesktopUiValue\(392\)/);
  assert.match(splashSource, /setDesktopWindowZoom\(splashWindow\)/);
});
