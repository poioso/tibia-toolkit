import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [
  mainSource,
  rendererSource,
  preloadSource,
  nativePreloadSource,
  pipeServerSource,
  selectionSource,
  windowProbeSource,
  mirrorManagerSource,
  mirrorWindowSource,
  snapGroupSource,
  snapGroupBorderSource,
  windowStyleSource,
  magnifierSource,
  selectorSource,
  projectSource,
  overlaySource,
  profileFormatSource,
  embeddedStylesSource,
  mainHtml,
  nativeHtml
] = await Promise.all([
  read("desktop/main.js"),
  read("desktop/screen-vision/screen-vision.js"),
  read("desktop/preload.cjs"),
  read("desktop/screen-vision/preload.cjs"),
  read("desktop/screen-vision-native/ScreenVision.NativeHost/Host/PipeServer.cs"),
  read("desktop/screen-vision-native/ScreenVision.NativeHost/Host/NativeSelectionManager.cs"),
  read("desktop/screen-vision-native/ScreenVision.NativeHost/Interop/WindowProbe.cs"),
  read("desktop/screen-vision-native/ScreenVision.NativeHost/Host/NativeMirrorManager.cs"),
  read("desktop/screen-vision-native/ScreenVision.NativeHost/Views/RegionMirrorWindow.cs"),
  read("desktop/screen-vision-native/ScreenVision.NativeHost/Host/SnapGroup.cs"),
  read("desktop/screen-vision-native/ScreenVision.NativeHost/Views/SnapGroupBorderWindow.cs"),
  read("desktop/screen-vision-native/ScreenVision.NativeHost/Interop/WindowStyleInterop.cs"),
  read("desktop/screen-vision-native/ScreenVision.NativeHost/Host/NativeCursorMagnifierManager.cs"),
  read("desktop/screen-vision-native/ScreenVision.NativeHost/Views/WindowSelectorWindow.cs"),
  read("desktop/screen-vision-native/ScreenVision.NativeHost/ScreenVision.NativeHost.csproj"),
  read("lib/overlay/overlay-mirrors.js"),
  read("lib/overlay/screen-vision-profile-format.js"),
  read("desktop/screen-vision/screen-vision-embedded.css"),
  read("index.html"),
  read("desktop/screen-vision/screen-vision.html")
]);

await Promise.all([
  access(path.join(root, "assets/tools/tibia-mirror/toolbar/obs-mirror.png")),
  access(path.join(root, "desktop/screen-vision-native/ScreenVision.NativeHost/Assets/selector/cancel-off.png")),
  access(path.join(root, "desktop/screen-vision-native/ScreenVision.NativeHost/Assets/selector/cancel-on.png")),
  access(path.join(root, "desktop/screen-vision-native/ScreenVision.NativeHost/Assets/selector/check-off.png")),
  access(path.join(root, "desktop/screen-vision-native/ScreenVision.NativeHost/Assets/selector/check-on.png"))
]);

for (const html of [mainHtml, nativeHtml]) {
  assert.match(html, /id="obs-window-mirror-button"/);
  assert.match(html, /toolbar\/obs-mirror\.png/);
}

for (const preload of [preloadSource, nativePreloadSource]) {
  assert.match(preload, /addObs\(\)\s*\{\s*return ipcRenderer\.invoke\("screen-vision:regions:add-obs"\);\s*\}/);
  assert.match(preload, /isWindowAvailable\(\)\s*\{\s*return ipcRenderer\.invoke\("screen-vision:obs-window:is-available"\);\s*\}/);
}

assert.match(rendererSource, /window\.screenVisionApi\.regions\.addObs\(\)/);
assert.match(rendererSource, /isObsMirror \? " obs-source-card"/);
assert.match(rendererSource, /native-host-outdated/);
assert.match(rendererSource, /const obsAvailable = await refreshObsWindowAvailability\(\)/);
assert.match(rendererSource, /Date\.now\(\) - state\.obsWindowAvailabilityCheckedAt >= 3000/);
assert.match(mainSource, /command:\s*sourceType === "obs-window" \? "selectObsRegion" : "selectRegion"/);
assert.match(mainSource, /sourceType:\s*"obs-window"/);
assert.match(mainSource, /nativeObsTopmostCommandSupported === false/);
assert.match(mainSource, /setNativeObsMirrorsVisible\(shouldShowObsMirrorOverlays\)/);
assert.match(mainSource, /const sourceBounds = normalizeSelectionBounds\([\s\S]*?response\?\.data\?\.sourceBounds \|\| runtimeSourceState\?\.clientBounds \|\| runtimeSourceState\?\.bounds,[\s\S]*?1[\s\S]*?\)/);
assert.match(mainSource, /openNativeRegionSelectionWindow\(\{[\s\S]*?sourceType:\s*"obs-window"[\s\S]*?\}\)/);
assert.doesNotMatch(mainSource, /openElectronObsRegionSelectionWindow/);
assert.match(mainSource, /syncNativeMirrorWindows\(runtimeRegions\)/);
assert.doesNotMatch(mainSource, /syncElectronObsMirrorWindows/);
assert.doesNotMatch(mainSource, /development-local-release/);
assert.match(mainSource, /afterStore:\s*async \(storedState\)/);
assert.match(mainSource, /const visibleRegions = mirrorItems\.filter\(\(entry\) => entry\.isVisible/);
assert.match(mainSource, /entry\.isVisible && entry\.sourceType !== "obs-window"/);
assert.match(pipeServerSource, /"selectObsRegion"\s*=>\s*await SelectObsRegionAsync/);
assert.match(pipeServerSource, /"setObsMirrorsTopmost"\s*=>\s*await SetObsMirrorsTopmostAsync/);
assert.match(pipeServerSource, /"setObsMirrorsVisible"\s*=>\s*await SetObsMirrorsVisibleAsync/);
assert.match(selectionSource, /new WindowSelectorWindow\(\)/);
assert.match(selectionSource, /SourceType = "obs-window"/);
assert.match(windowProbeSource, /GetObsWindowInfos\(\)/);
assert.match(windowProbeSource, /var titleMatch = candidates\.FirstOrDefault/);
assert.ok(
  windowProbeSource.indexOf("var titleMatch = candidates.FirstOrDefault")
    < windowProbeSource.indexOf("return candidates.FirstOrDefault"),
  "the persisted OBS title must be resolved before the process fallback"
);
assert.match(mirrorManagerSource, /ResolveSourceWindow/);
assert.match(mirrorManagerSource, /SetObsMirrorsTopmostAsync/);
assert.match(mirrorManagerSource, /SetObsMirrorsVisibleAsync/);
assert.match(mirrorWindowSource, /SourceType, "obs-window"/);
assert.match(mirrorWindowSource, /ObsMirrorAccentBrush = new\(Color\.FromRgb\(49, 95, 199\)\)/);
assert.match(mirrorWindowSource, /var shouldBeTopmost = isObsMirror \? _alwaysOnTop : tibiaInfo\?\.IsForeground == true/);
assert.match(mirrorWindowSource, /if \(_alwaysOnTop \|\| _sourceHwnd == IntPtr\.Zero\)[\s\S]*WindowStyleInterop\.PlaceWindowAbove\(_windowHandle, _sourceHwnd\)/);
assert.match(snapGroupSource, /new SnapGroupBorderWindow\(isObsGroup\)/);
assert.match(snapGroupSource, /FindHighestWindowInZOrder[\s\S]*highestMirrorHwnd != IntPtr\.Zero \? highestMirrorHwnd : sourceHwnd/);
assert.ok(
  snapGroupSource.indexOf("_unifiedBorderWindow.Show()")
    < snapGroupSource.indexOf("SyncTopmostFromWindows();", snapGroupSource.indexOf("private void ShowUnifiedBorder")),
  "the unified border must receive its z-order only after its native window exists"
);
assert.match(snapGroupBorderSource, /isObsGroup[\s\S]*Color\.FromRgb\(49, 95, 199\)[\s\S]*Color\.FromRgb\(88, 196, 112\)/);
assert.match(snapGroupBorderSource, /Background = new SolidColorBrush\(Color\.FromArgb\(34, accentColor\.R, accentColor\.G, accentColor\.B\)\)/);
assert.match(snapGroupBorderSource, /Color = accentColor/);
assert.match(snapGroupBorderSource, /Topmost = false/);
assert.doesNotMatch(snapGroupBorderSource, /SetWindowAlwaysOnTop\(handle, true\)/);
assert.match(windowStyleSource, /FindHighestWindowInZOrder\(IEnumerable<IntPtr> handles\)/);
assert.match(magnifierSource, /WindowProbe\.GetObsWindowInfos\(\)/);
assert.match(selectorSource, /cancel-off\.png/);
assert.match(selectorSource, /check-off\.png/);
assert.doesNotMatch(selectorSource, /"cancel\.png"|"continue\.png"/);
assert.match(projectSource, /<Resource Include="Assets\\selector\\\*\.png" \/>/);
assert.match(overlaySource, /sourceType === "obs-window"/);
assert.match(overlaySource, /sourceHwnd/);
assert.match(profileFormatSource, /IsObsMirror:\s*region\.sourceType === "obs-window"/);
assert.match(profileFormatSource, /ObsCaptureSourceId/);
assert.match(embeddedStylesSource, /\.region-card\.obs-source-card:not\(\.locked-state\)[^{]*\{[^}]*border-color:\s*#284cb8/is);
assert.match(embeddedStylesSource, /desktop-main-width-medium[\s\S]*desktop-main-width-wide[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);

console.log("OBS Mirror contracts passed.");
