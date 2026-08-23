import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSource = await readFile(new URL("../../desktop/main.js", import.meta.url), "utf8");

test("Tibia Mirror grid follows the regular mirror focus visibility", () => {
  const visibilityStart = mainSource.indexOf("async function syncTibiaMirrorVisibility(");
  const visibilityEnd = mainSource.indexOf("\nasync function isObsStudioFocused", visibilityStart);
  assert.ok(visibilityStart >= 0 && visibilityEnd > visibilityStart, "Mirror visibility sync must remain available");

  const body = mainSource.slice(visibilityStart, visibilityEnd);
  assert.match(body, /buildGridOverlayTibiaSignature\(mirrorSourceState, shouldShowRegularMirrorOverlays, sourceGame\)/);
  assert.match(body, /syncNativeGridOverlay\(null, \{ tibiaState: mirrorSourceState, sourceGame, visible: shouldShowRegularMirrorOverlays \}\)/);
});

test("direct grid synchronization preserves Mirror/controller focus", () => {
  const helperStart = mainSource.indexOf("async function shouldShowTibiaMirrorSurface(");
  const helperEnd = mainSource.indexOf("\nfunction canUseTibiaWindowForScreenVision", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, "Mirror surface visibility helper must remain available");

  const helper = mainSource.slice(helperStart, helperEnd);
  assert.match(helper, /mirrorInteractionActive \|\| toolkitFocused \|\| controllerFocused/);
  assert.match(mainSource, /syncNativeGridOverlay\(state, \{ tibiaState, sourceGame, visible \}\)/);
  assert.match(mainSource, /options\.visible \?\? await shouldShowTibiaMirrorSurface\(tibiaState, \{ sourceGame \}\)/);
});

test("mirror selection keeps an enabled grid visible for accurate picking", () => {
  const start = mainSource.indexOf("async function withGridVisibleDuringSelection(");
  const end = mainSource.indexOf("\nfunction getTargetSelectionDisplay", start);
  assert.ok(start >= 0 && end > start, "selection grid guard must remain available");

  const body = mainSource.slice(start, end);
  assert.match(body, /if \(gridSettings\.enabled\)/);
  assert.match(body, /syncNativeGridOverlay\(overlayToolsState, \{ visible: true \}\)/);
  assert.doesNotMatch(body, /enabled:\s*false/);
});
