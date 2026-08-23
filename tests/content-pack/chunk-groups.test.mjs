import assert from "node:assert/strict";
import test from "node:test";
import {
  getContentPackChunkGroup,
  isContentPackRuntimeAsset,
  normalizeContentPackRelativePath
} from "../../lib/content-pack/chunk-groups.js";

test("normalizes source and archive asset paths identically", () => {
  assert.equal(normalizeContentPackRelativePath("assets\\data\\items\\plate-armor.gif"), "data/items/plate-armor.gif");
  assert.equal(normalizeContentPackRelativePath("/assets/ui/tutorial/step.gif"), "ui/tutorial/step.gif");
});

test("keeps the generator, audit and runtime chunk classifications stable", () => {
  assert.equal(getContentPackChunkGroup("assets/data/item-atlases/items.png"), "library-media-items");
  assert.equal(getContentPackChunkGroup("data/items/plate-armor.gif"), "library-media-items");
  assert.equal(getContentPackChunkGroup("data/item-details.json"), "library-data-items");
  assert.equal(getContentPackChunkGroup("data/mini-world-changes/entry.png"), "mini-world-change-assets");
  assert.equal(getContentPackChunkGroup("ui/tutorial/step.gif"), "ui-tutorial-assets");
  assert.equal(getContentPackChunkGroup("ui/supporters/card.webp"), "ui-supporter-assets");
  assert.equal(getContentPackChunkGroup("ui/tools/analyzer.gif"), "ui-tool-assets");
  assert.equal(getContentPackChunkGroup("ui/navigation/home.png"), "ui-core-assets");
  assert.equal(getContentPackChunkGroup("tibia-client/sheets/objects.png"), "client-sprite-sheets");
  assert.equal(getContentPackChunkGroup("tibia-client/appearance-map.json"), "client-appearance-maps");
  assert.equal(getContentPackChunkGroup("tibia-client/audit/summary.json"), "client-runtime-assets");
  assert.equal(getContentPackChunkGroup("screen-vision/example.json"), "core-and-other-assets");
});

test("matches the content-pack inclusion rules", () => {
  assert.equal(isContentPackRuntimeAsset("assets/ui/tutorial/step.gif"), true);
  assert.equal(isContentPackRuntimeAsset("assets/tibia-client/organized/objects/hidden.png"), false);
  assert.equal(isContentPackRuntimeAsset("assets/data/item.jpeg"), false);
  assert.equal(isContentPackRuntimeAsset("assets/data/.gitkeep"), false);
});
