import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCREEN_VISION_FOOD_PRESETS,
  SCREEN_VISION_POTION_PRESETS
} from "../desktop/screen-vision/consumable-presets.js";
import { createOverlayTimerEntryFromDraft } from "../lib/overlay/overlay-timers.js";
import {
  mirrorProfileToOverlayState,
  overlayStateToMirrorAudioProfile
} from "../lib/overlay/screen-vision-profile-format.js";
import { createDefaultOverlayToolsState } from "../lib/overlay/overlay-tools-state.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

assert.equal(SCREEN_VISION_POTION_PRESETS.length, 4);
assert.equal(SCREEN_VISION_FOOD_PRESETS.length, 28);
assert.equal(new Set(SCREEN_VISION_POTION_PRESETS.map((entry) => entry.id)).size, 4);
assert.equal(new Set(SCREEN_VISION_FOOD_PRESETS.map((entry) => entry.id)).size, 28);

for (const preset of [...SCREEN_VISION_POTION_PRESETS, ...SCREEN_VISION_FOOD_PRESETS]) {
  assert.ok(fs.existsSync(path.join(projectRoot, preset.imagePath)), `Imagem ausente: ${preset.imagePath}`);
  assert.ok(preset.durationSeconds >= 60 && preset.durationSeconds <= 86400);
}

for (const preset of SCREEN_VISION_POTION_PRESETS) {
  assert.ok(preset.soundKey.startsWith("potion-"));
  assert.ok(fs.existsSync(path.join(projectRoot, preset.soundPath)), `Audio ausente: ${preset.soundPath}`);
}

for (const preset of SCREEN_VISION_FOOD_PRESETS) {
  assert.equal(preset.soundKey, "none");
  assert.equal(preset.soundPath, "");
}

const coconut = SCREEN_VISION_FOOD_PRESETS.find((entry) => entry.id === "coconut-shrimp-bake");
assert.equal(coconut?.durationSeconds, 86400);

const deadline = Date.now() + 86400 * 1000;
const foodTimer = createOverlayTimerEntryFromDraft({
  name: coconut.name,
  durationSeconds: coconut.durationSeconds,
  soundKey: "none",
  volumePercent: 0,
  volumeMuted: true,
  showVisualAlert: false,
  timerKind: "food",
  presetId: coconut.id,
  clockMode: "wall-clock",
  persistentEndsAtMs: deadline
});

assert.equal(foodTimer.durationSeconds, 86400);
assert.equal(foodTimer.enabled, false);
assert.equal(foodTimer.volumeMuted, true);
assert.equal(foodTimer.timerKind, "food");
assert.equal(foodTimer.clockMode, "wall-clock");
assert.equal(foodTimer.persistentEndsAtMs, deadline);

const overlayState = createDefaultOverlayToolsState();
overlayState.timers.items = [foodTimer];
const audioProfile = overlayStateToMirrorAudioProfile(overlayState);
const restored = mirrorProfileToOverlayState({}, audioProfile).overlayToolsState;
assert.equal(restored.timers.items[0].timerKind, "food");
assert.equal(restored.timers.items[0].clockMode, "wall-clock");
assert.equal(restored.timers.items[0].persistentEndsAtMs, deadline);
assert.equal(restored.timers.items[0].enabled, false);

console.log(JSON.stringify({
  ok: true,
  potions: SCREEN_VISION_POTION_PRESETS.length,
  foods: SCREEN_VISION_FOOD_PRESETS.length,
  foodsSilentByDefault: true,
  maxDurationSeconds: coconut.durationSeconds,
  profileRoundTrip: true
}, null, 2));
