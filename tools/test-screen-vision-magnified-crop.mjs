import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const html = read("index.html");
const renderer = read("desktop/screen-vision/screen-vision.js");
const preload = read("desktop/preload.cjs");
const main = read("desktop/main.js");
const translations = read("lib/i18n/ui-translations.js");
const selectionManager = read("desktop/screen-vision-native/ScreenVision.NativeHost/Host/NativeSelectionManager.cs");
const cursorMagnifierManager = read("desktop/screen-vision-native/ScreenVision.NativeHost/Host/NativeCursorMagnifierManager.cs");
const magnifier = read("desktop/screen-vision-native/ScreenVision.NativeHost/Views/CropMagnifierWindow.cs");
const regionSelector = read("desktop/screen-vision-native/ScreenVision.NativeHost/Views/RegionSelectorWindow.cs");

const quickCropIndex = html.indexOf('id="crop-tool-button"');
const magnifierIndex = html.indexOf('id="magnified-crop-tool-button"');
assert.ok(quickCropIndex >= 0, "32x32 crop button is missing");
assert.ok(magnifierIndex > quickCropIndex, "visual magnifier button must remain immediately to the right of 32x32 crop");
assert.match(html.slice(magnifierIndex, magnifierIndex + 700), /assets\/ui\/tools\/tibia-eye\/toolbar\/Loupe\.gif/);
assert.ok(fs.existsSync(path.join(root, "assets/tools/tibia-mirror/toolbar/Loupe.gif")), "Loupe.gif asset is missing");
assert.match(html.slice(magnifierIndex, magnifierIndex + 700), /aria-pressed="false"/);

for (const key of [
  "screenVision.magnifiedCrop",
  "screenVision.magnifiedCropHint",
  "screenVision.magnifierDisableHint"
]) {
  const occurrences = translations.split(`"${key}"`).length - 1;
  assert.equal(occurrences, 3, `${key} must exist in pt-BR, en and de`);
}

assert.match(renderer, /window\.screenVisionApi\.magnifier\.toggle\(\)/);
assert.match(renderer, /cursorMagnifierEnabled/);
assert.doesNotMatch(renderer, /addMagnifiedRegion/);
assert.match(preload, /magnifier:\s*\{[\s\S]*screen-vision:magnifier:toggle/);
assert.doesNotMatch(preload, /screen-vision:regions:add-magnified/);

const magnifierHandler = main.match(/ipcMain\.handle\("screen-vision:magnifier:toggle", async \(\) => \{([\s\S]*?)\n  \}\);/)?.[1] || "";
assert.match(magnifierHandler, /setCursorMagnifier/);
assert.doesNotMatch(magnifierHandler, /appendOverlayMirrorEntry|syncRegionMirrorWindows|createNextRegionName/);
const nativeSelectionHandler = main.match(/async function openNativeRegionSelectionWindow\([^]*?\n\}/)?.[0] || "";
assert.doesNotMatch(nativeSelectionHandler, /setCursorMagnifier|startManualSelectionCrossWindow/);
assert.doesNotMatch(main, /screen-vision:regions:add-magnified|magnified-square-crop/);

assert.match(selectionManager, /isFixedIconCrop/);
assert.match(selectionManager, /showMagnifier:\s*true/);
assert.match(selectionManager, /confirmFixedSelectionOnClick:\s*false/);
assert.match(cursorMagnifierManager, /DispatcherTimer/);
assert.match(cursorMagnifierManager, /GetCursorPos/);
assert.match(cursorMagnifierManager, /SourceSize = 64/);
assert.doesNotMatch(cursorMagnifierManager, /MirrorWindowSpec|SyncMirrors|WriteProcessMemory|OpenProcess|CreateRemoteThread/);
assert.match(magnifier, /DwmRegisterThumbnail/);
assert.match(magnifier, /ExtendedStyleNoActivate/);
assert.match(magnifier, /Color\.FromRgb\(88,\s*196,\s*112\)/);
assert.match(magnifier, /showCursorCenterMarker/);
assert.match(magnifier, /Background = Brushes\.White/);
assert.match(regionSelector, /GetCursorMagnifierRect/);
assert.match(regionSelector, /_showMagnifier && !_selectionReady && _fixedSelectionSize is null/);
assert.match(regionSelector, /cursor\.X >= 0[\s\S]*cursor\.X <= _overlayCanvas\.ActualWidth/);
assert.match(regionSelector, /showCursorCenterMarker: _showCenterMarker/);
assert.doesNotMatch(magnifier, /Color\.FromRgb\((214,\s*147,\s*37|255,\s*187,\s*65)\)/);
assert.doesNotMatch(magnifier, /WriteProcessMemory|OpenProcess|CreateRemoteThread/);

console.log("Screen Vision 32x32 preview and standalone visual magnifier contract passed.");
