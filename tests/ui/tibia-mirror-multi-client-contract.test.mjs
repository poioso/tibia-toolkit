import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSource = await readFile(new URL("../../desktop/main.js", import.meta.url), "utf8");
const windowProbeSource = await readFile(
  new URL("../../desktop/screen-vision-native/ScreenVision.NativeHost/Interop/WindowProbe.cs", import.meta.url),
  "utf8",
);
const gridSource = await readFile(
  new URL("../../desktop/screen-vision-native/ScreenVision.NativeHost/Host/NativeGridOverlayManager.cs", import.meta.url),
  "utf8",
);
const magnifierSource = await readFile(
  new URL("../../desktop/screen-vision-native/ScreenVision.NativeHost/Host/NativeCursorMagnifierManager.cs", import.meta.url),
  "utf8",
);
const magnifierWindowSource = await readFile(
  new URL("../../desktop/screen-vision-native/ScreenVision.NativeHost/Views/CropMagnifierWindow.cs", import.meta.url),
  "utf8",
);
const visualManagerSource = await readFile(
  new URL("../../desktop/screen-vision-native/ScreenVision.NativeHost/Host/NativeVisualCustomizationManager.cs", import.meta.url),
  "utf8",
);
const hotkeyListenerSource = await readFile(
  new URL("../../desktop/screen-vision-native/ScreenVision.NativeHost/Host/GlobalHotkeyListener.cs", import.meta.url),
  "utf8",
);
const characterLocationSource = await readFile(
  new URL("../../desktop/screen-vision-native/ScreenVision.NativeHost/Views/CharacterLocationWindow.cs", import.meta.url),
  "utf8",
);
const pipeServerSource = await readFile(
  new URL("../../desktop/screen-vision-native/ScreenVision.NativeHost/Host/PipeServer.cs", import.meta.url),
  "utf8",
);
const rendererSource = await readFile(new URL("../../desktop/screen-vision/screen-vision.js", import.meta.url), "utf8");
const selectorSource = await readFile(new URL("../../desktop/mirror-game-selector.html", import.meta.url), "utf8");
const tooltipSource = await readFile(new URL("../../desktop/window-move-handle-tooltip.html", import.meta.url), "utf8");

test("Mirror clients use exact native windows and preserve per-game regions", () => {
  assert.match(windowProbeSource, /ProcessName, "Medivia"[\s\S]*Title\.StartsWith\("Medivia - "/);
  assert.match(windowProbeSource, /ProcessName, "rubinot_dx"/);
  assert.match(windowProbeSource, /ObserveForegroundGameWindow\(\)/);
  assert.match(windowProbeSource, /LastVerifiedGameWindows/);
  assert.doesNotMatch(windowProbeSource, /CopyFromScreen|Graphics\.CopyFromScreen/);

  assert.match(mainSource, /normalizeMirrorSourceGame\(entry\.sourceGame\) === activeGame/);
  assert.match(mainSource, /sourceHwnd: Number\(activeSourceState\.hwnd\)/);
  assert.match(mainSource, /response\?\.data\?\.sourceHwnd \|\| runtimeSourceState\?\.hwnd/);
  assert.match(mainSource, /if \(mirrorSourceSelectionPromise\)/);
  assert.match(mainSource, /mirrorSourceSelectionPromise = null/);
  assert.match(mainSource, /refreshMirrorGameSelectorAvailability/);
  assert.match(mainSource, /recoverRubinotWindowProofFromDebugLog/);
  assert.match(mainSource, /mirror-source-proof-recovered sourceGame=rubinot/);
  assert.match(mainSource, /ProcessName -ine "rubinot_dx"/);
  assert.match(windowProbeSource, /knownTitle\.Equals\("RubinOT Client"/);
  assert.match(windowProbeSource, /info\.Title\.Equals\("RubinOT Client"/);
  assert.match(mainSource, /const durableTitle = \/\^RubinOT Client - \/i/);
  assert.match(mainSource, /"RubinOT Client - verified"/);
  assert.match(mainSource, /getMirrorGameUnavailableLabels/);
  assert.match(mainSource, /tibia: "Abra o Tibia primeiro"/);
  assert.match(mainSource, /rubinot: "Abra a janela do RubinOT primeiro"/);
  assert.match(mainSource, /medivia: "Logue no Medivia primeiro"/);
  assert.match(mainSource, /mirrorGameAvailability\[game\] !== true/);
  assert.match(selectorSource, /aria-disabled/);
  assert.match(selectorSource, /button\.unavailable/);
  assert.match(selectorSource, /button\.unavailable\{[^}]*brightness\(\.42\)[^}]*opacity:\.28/);
  assert.match(tooltipSource, /#tooltip\.error/);
  assert.match(mainSource, /selectorBounds\.y - WINDOW_MOVE_HANDLE_TOOLTIP_HEIGHT - 7/);
  assert.match(mainSource, /tooltip\.setAlwaysOnTop\(true, "screen-saver"\)/);
  assert.match(mainSource, /resolveWindowMoveHandleSide\(mainBounds, windowMoveHandleSide\)/);
});

test("the grid follows the selected game instead of forcing official Tibia", () => {
  assert.match(gridSource, /SetAsync\(bool enabled, int gridSize, bool visible, string sourceGame = "tibia"\)/);
  assert.match(gridSource, /WindowProbe\.GetGameWindowInfo\(sourceGame\)/);
  assert.doesNotMatch(gridSource, /WindowProbe\.GetTibiaWindowInfo\(\)/);
});

test("magnifier, SQM and alerts follow the selected game without changing Tibia defaults", () => {
  assert.match(magnifierSource, /SetEnabledAsync\([\s\S]*?bool enabled,[\s\S]*?string sourceGame = "tibia",[\s\S]*?long knownHwnd = 0/);
  assert.match(magnifierSource, /GetGameWindowInfo\(sourceGame, knownHwnd, knownProcessId, knownTitle\)/);
  assert.match(magnifierWindowSource, /MonitorFromPoint/);
  assert.match(magnifierWindowSource, /destinationMonitor == cursorMonitor/);
  assert.match(magnifierWindowSource, /TryGetMonitorBounds\([\s\S]*?out var finalBounds/);
  assert.match(pipeServerSource, /SetEnabledAsync\([\s\S]*?enabled,[\s\S]*?sourceGame,[\s\S]*?knownHwnd/);
  assert.match(mainSource, /getMirrorSourceGameState\(sourceGame, \{ forceFresh: true \}\)/);
  assert.match(mainSource, /command: "setCursorMagnifier",[\s\S]*?enabled,[\s\S]*?sourceGame/);
  assert.match(mainSource, /knownHwnd: Number\(tibiaState\?\.hwnd \|\| 0\)/);
  assert.match(mainSource, /nativeCursorMagnifierEnabled = applied/);
  assert.match(mainSource, /\|\| nativeCursorMagnifierEnabled/);
  assert.match(mainSource, /alternateMirrorSourceSelected/);
  assert.match(mainSource, /activeMirrorSourceGame !== "tibia"/);
  assert.match(mainSource, /syncAlertTimerTibiaVisibilityGate\(null, \{[\s\S]*?sourceGame,[\s\S]*?sourceState: mirrorSourceState/);
  assert.match(mainSource, /Alert timers and global hotkeys are allowed for every selected client as[\s\S]*?long as its game window is open/);
  assert.match(mainSource, /reason: "source-game-connected"/);
  assert.match(mainSource, /shouldShowVisualOverlays = Boolean\([\s\S]*?shouldShowRegularMirrorOverlays/);
  assert.match(mainSource, /lastNativeVisualOverlayPriority !== shouldPrioritizeVisualOverlays/);
  assert.match(mainSource, /syncNativeVisualCustomization\(null, \{[\s\S]*?tibiaState: mirrorSourceState,[\s\S]*?sourceGame/);
  assert.match(visualManagerSource, /_characterLocationWindow\?\.BringToFrontNoActivate\(\)/);
  assert.match(characterLocationSource, /BringWindowToFrontNoActivate\(_windowHandle, true\)/);
  assert.match(mainSource, /alert-timer-visual-started/);
  assert.match(mainSource, /alert-timer-visual-error/);
  assert.match(mainSource, /command: "setAlertHotkeys"/);
  assert.match(mainSource, /native-alert-hotkey-received/);
  assert.match(hotkeyListenerSource, /GetAsyncKeyState/);
  assert.match(hotkeyListenerSource, /SetPolledBindings/);
  assert.match(pipeServerSource, /"setAlertHotkeys" => await SetAlertHotkeysAsync/);
  assert.match(mainSource, /nativeGridOverlayEnabled/);
  assert.match(mainSource, /nativeVisualCustomizationActive/);
  assert.match(mainSource, /shouldShowTibiaMirrorSurface\(tibiaState, \{ sourceGame \}\)/);
});

test("spell, potion and food proper names bypass automatic UI translation", () => {
  assert.match(rendererSource, /docked-alert-consumable-button"[\s\S]*?data-i18n-preserve/);
  assert.match(rendererSource, /docked-alert-magic-spell-button"[\s\S]*?data-i18n-preserve/);
  assert.match(rendererSource, /<strong data-i18n-preserve translate="no">\$\{escapeHtml\(selectedLabel\)\}<\/strong>/);
  assert.match(rendererSource, /docked-alert-sound-menu" data-i18n-preserve translate="no"/);
  assert.match(rendererSource, /docked-alert-sound-option\$\{[\s\S]*?data-i18n-preserve[\s\S]*?translate="no"/);
  assert.match(rendererSource, /<strong data-i18n-preserve>\$\{escapeHtml\(timer\.name/);
});

test("profiles and active runtime state are isolated per selected game", () => {
  assert.match(mainSource, /return screenVisionProfilesDir;/);
  assert.match(mainSource, /path\.join\(screenVisionProfilesDir, game === "rubinot" \? "RubinOT" : "Medivia"\)/);
  assert.match(mainSource, /last-profile\.\$\{game\}\.txt/);
  assert.match(mainSource, /importScreenVisionProfileFromDialog\(\)[\s\S]*?const profilesDir = await ensureScreenVisionProfilesDirForGame\(\);[\s\S]*?defaultPath: profilesDir/);
  assert.match(mainSource, /activateScreenVisionProfileForSourceGame\(game, \{ sourceState, wallClockTimers \}\)/);
  assert.match(mainSource, /disableMirrorRuntimeFeatures\(overlayToolsState\)/);
  assert.match(mainSource, /gridEnabled = false/);
  assert.match(mainSource, /charLocEnabled: false/);
  assert.match(mainSource, /cursorGlowEnabled: false/);
  assert.match(mainSource, /state\.timers\.isListening = false/);
  assert.match(mainSource, /state\.timers\.visualsEnabled = false/);
  assert.match(mainSource, /getRunningWallClockTimers\(previousState\)/);
  assert.match(mainSource, /isWallClockFoodTimer\(timer\)[\s\S]*?persistentEndsAtMs/);
  assert.match(mainSource, /stopNonWallClockAlertTimerRuntimes\(previousState\)/);
});

test("Medivia exposes only the custom alert action while Tibia and RubinOT retain presets", () => {
  assert.match(rendererSource, /isMediviaSource[\s\S]*?sourceGame[\s\S]*?=== "medivia"/);
  assert.match(rendererSource, /isMediviaSource[\s\S]*?data-docked-action="create-alert-spell-blank"/);
  assert.match(rendererSource, /: `[\s\S]*?data-alerts-view="magias"[\s\S]*?data-alerts-view="pocoes"[\s\S]*?data-alerts-view="comidas"/);
  assert.match(rendererSource, /createDockedBlankSpellAlert\(button\)/);
});
