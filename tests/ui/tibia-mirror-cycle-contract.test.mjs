import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSource = await readFile(new URL("../../desktop/main.js", import.meta.url), "utf8");

test("Mirror native sync serializes create/delete commands and supersedes stale empty reads", () => {
  assert.match(mainSource, /let nativeMirrorSyncQueue = Promise\.resolve\(\);/);
  assert.match(mainSource, /const pending = nativeMirrorSyncQueue\.then\(run, run\);/);
  assert.match(mainSource, /native-mirror-sync-empty-superseded/);
  assert.match(mainSource, /screen-vision:regions:toggle-all-visibility[\s\S]*?enqueueOverlayToolsMutation/);
  assert.match(mainSource, /function isMirrorInSelectedBulkScope[\s\S]*?sourceType === "obs-window"/);
  assert.match(mainSource, /toggle-all-visibility[\s\S]*?isMirrorInSelectedBulkScope\(entry, activeGame\)/);
  assert.match(mainSource, /toggle-all-lock[\s\S]*?enqueueOverlayToolsMutation[\s\S]*?isMirrorInSelectedBulkScope\(entry, activeGame\)/);
  assert.match(mainSource, /screen-vision:regions:delete[\s\S]*?enqueueOverlayToolsMutation/);
  assert.match(mainSource, /appendOverlayMirrorEntry[\s\S]*?afterStore: async \(storedState\) => \{[\s\S]*?syncRegionMirrorWindows\(storedState\)/);
});

test("Account refresh cannot clear live Mirror windows from a transient empty snapshot", () => {
  assert.match(
    mainSource,
    /syncMirrorVisibilityForAccountState[\s\S]*?syncRegionMirrorWindows\(overlayToolsState, \{ allowEmpty: false \}\)/,
  );
  assert.match(mainSource, /syncNativeMirrorWindows\(\[\], \{ allowEmpty: true \}\)/);
  assert.match(mainSource, /syncNativeMirrorWindows\(runtimeRegions, \{ allowEmpty \}\)/);
});
