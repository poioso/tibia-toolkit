#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCREEN_VISION_SPELL_PRESETS } from "../desktop/screen-vision/spell-presets.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

const mainSource = read("desktop/main.js");
const mainPreloadSource = read("desktop/preload.cjs");
const screenVisionPreloadSource = read("desktop/screen-vision/preload.cjs");
const screenVisionSource = read("desktop/screen-vision/screen-vision.js");
const translationsSource = read("lib/i18n/ui-translations.js");
const nativeHostProjectSource = read("desktop/screen-vision-native/ScreenVision.NativeHost/ScreenVision.NativeHost.csproj");
const nativeAudioSource = read("desktop/screen-vision-native/ScreenVision.NativeHost/Host/NativeAlertAudioPlayer.cs");
const installerSource = read("desktop/build-installer.mjs");
const contentPackBuilderSource = read("tools/build-content-pack.mjs");
const builder = JSON.parse(read("desktop/electron-builder.json"));

assert.match(screenVisionSource, /soundKey:\s*"default"/, "New alerts must select the default sound.");
assert.match(mainSource, /"default":\s*resolveSoundAsset\([^)]*utura gran\.ogg/, "The default sound must resolve to an actual bundled alert.");
assert.match(mainSource, /screenVisionSpellSoundMap\.has\(soundKey\)[\s\S]*resolveSoundAsset/, "Spell sounds must resolve through Content Pack and installer fallbacks.");
assert.match(mainSource, /playAlertTimerSoundInNativeHost/, "Alert playback must use the Toolkit native host.");
assert.ok(
  mainSource.indexOf("if (isOggOpusAudioFile(file))") < mainSource.indexOf("const nativePlayback = await playAlertTimerSoundInNativeHost"),
  "Self-contained Electron Opus playback must be attempted before the Vorbis-only native path."
);
assert.match(mainSource, /Buffer\.from\("OpusHead", "ascii"\)/, "Opus-in-OGG assets must be detected from their stream header.");
assert.match(mainSource, /mode=electron-opus/, "Successful self-contained Opus playback must be recorded.");
assert.match(mainSource, /loadFile\(path\.join\(__dirname,\s*"alert-audio-runtime\.html"\)\)/, "The audio player must use a local page that can load file audio.");
assert.match(mainSource, /mode=native-toolkit/, "Successful native playback must be recorded with the Toolkit identity.");
assert.match(mainSource, /mode=electron-fallback/, "Electron playback must remain available only as a fallback.");
assert.match(mainSource, /screen-vision:timers:preview-sound/, "The main process must expose a sound preview channel.");
assert.match(screenVisionSource, /previewDockedAlertTimerSound\(nextTimer\)/, "Selecting a timer sound must play an immediate preview.");
assert.match(mainSource, /setAppUserModelId\(runtimeAppUserModelId\)/, "Windows must receive the Toolkit application identity.");
assert.match(mainSource, /setAlwaysOnTop\(false\)/, "The native file picker owner must leave the topmost level while the dialog is open.");
assert.match(mainSource, /setAlwaysOnTop\(true,\s*"screen-saver"\)/, "The controller topmost level must be restored after the picker closes.");

for (const [label, preloadSource] of [
  ["main docked panel", mainPreloadSource],
  ["standalone Screen Vision", screenVisionPreloadSource]
]) {
  assert.match(
    preloadSource,
    /pickAudioFile\(\)\s*{\s*return ipcRenderer\.invoke\("screen-vision:dialogs:pick-audio-file"\);\s*}/,
    `${label} must expose the custom audio picker.`
  );
  assert.match(
    preloadSource,
    /previewSound\(payload\)\s*{\s*return ipcRenderer\.invoke\("screen-vision:timers:preview-sound", payload\);\s*}/,
    `${label} must expose the sound preview bridge.`
  );
}

assert.match(nativeHostProjectSource, /<AssemblyTitle>Tibia Toolkit<\/AssemblyTitle>/, "The native audio host must display the Tibia Toolkit product name.");
assert.match(nativeHostProjectSource, /<ApplicationIcon>\.\.\\\.\.\\build\\icon\.ico<\/ApplicationIcon>/, "The native audio host must embed the Toolkit icon.");
assert.match(mainSource, /source:\s*"development-apphost"/, "Development must prefer the icon-bearing native apphost.");
assert.match(nativeAudioSource, /session\.DisplayName\s*=\s*"Tibia Toolkit"/, "The Windows audio session must use the Tibia Toolkit name.");
assert.match(nativeAudioSource, /session\.IconPath\s*=\s*iconPath/, "The Windows audio session must use the Toolkit icon.");
assert.match(installerSource, /"publish",[\s\S]*nativeHostProjectPath[\s\S]*nativeHostPublishDir/, "The installer build must publish the native audio host.");
assert.ok(
  installerSource.indexOf('"publish"') < installerSource.indexOf('builderCliPath'),
  "The native audio host must be published before electron-builder packages the app."
);
assert.ok(builder.files.includes("desktop/**/*"), "The installer must include the published native audio host directory.");
assert.ok(
  !builder.files.includes("!desktop/screen-vision-native/publish/**/*"),
  "The installer must not exclude the published native audio host."
);
assert.match(
  contentPackBuilderSource,
  /archive\.addLocalFolder\(path\.join\(projectRoot,\s*"assets"\),\s*"assets"/,
  "The downloadable Content Pack must include the complete runtime assets tree."
);

for (const asset of [
  "assets/screen-vision/reference/sounds/spells/utura gran.ogg",
  "assets/screen-vision/reference/sounds/spells/exura gran ico.ogg",
  "assets/screen-vision/reference/sounds/spells/utito tempo.ogg"
]) {
  assert.ok(builder.files.includes(asset), `${asset} must be included in the installer.`);
  assert.ok(fs.existsSync(path.join(projectRoot, asset)), `${asset} is missing from the development source.`);
}

for (const preset of SCREEN_VISION_SPELL_PRESETS) {
  if (!preset?.soundPath) continue;
  assert.ok(
    fs.existsSync(path.join(projectRoot, String(preset.soundPath).replaceAll("/", path.sep))),
    `Missing spell audio asset for ${preset.name || preset.soundKey}: ${preset.soundPath}`
  );
}

assert.equal((translationsSource.match(/"screenVision\.alerts\.audioFiles"/g) || []).length, 3, "Audio file picker copy must exist in PT-BR, EN, and DE.");
assert.ok(fs.existsSync(path.join(projectRoot, "desktop", "alert-audio-runtime.html")), "The isolated Electron audio page is missing.");

console.log(JSON.stringify({
  passed: true,
  verifiedSpellSounds: SCREEN_VISION_SPELL_PRESETS.filter((preset) => preset?.soundPath).length,
  verifiedFallbackSounds: 3,
  pickerBridges: 2,
  playbackModes: ["electron-opus", "native-toolkit", "electron-fallback"]
}, null, 2));
