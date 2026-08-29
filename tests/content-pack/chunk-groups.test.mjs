import assert from "node:assert/strict";
import test from "node:test";
import {
  getContentPackChunkGroup,
  isContentPackRuntimeAsset,
  normalizeContentPackRelativePath
} from "../../lib/content-pack/chunk-groups.js";

test("normalizes source and archive asset paths identically", () => {
  assert.equal(normalizeContentPackRelativePath("assets\\library\\items\\catalog\\sprites\\plate-armor.gif"), "library/items/catalog/sprites/plate-armor.gif");
  assert.equal(normalizeContentPackRelativePath("/assets/tutorial/step.gif"), "tutorial/step.gif");
});

test("keeps the generator, audit and runtime chunk classifications stable", () => {
  assert.equal(getContentPackChunkGroup("assets/library/items/atlases/items.png"), "library-media-items");
  assert.equal(getContentPackChunkGroup("library/items/catalog/sprites/plate-armor.gif"), "library-media-items");
  assert.equal(getContentPackChunkGroup("library/catalogs/item-details.json"), "library-data-items");
  assert.equal(getContentPackChunkGroup("mini-world-changes/entry.png"), "mini-world-change-assets");
  assert.equal(getContentPackChunkGroup("tutorial/step.gif"), "ui-tutorial-assets");
  assert.equal(getContentPackChunkGroup("monetization/supporters/card.webp"), "ui-supporter-assets");
  assert.equal(getContentPackChunkGroup("tools/analyzer.gif"), "ui-tool-assets");
  assert.equal(getContentPackChunkGroup("library/navigation/item-list-tab.gif"), "ui-core-assets");
  assert.equal(getContentPackChunkGroup("navigation/desktop-controls/desktop-close-idle.png"), "ui-core-assets");
  assert.equal(getContentPackChunkGroup("library/tasks/icon-weeklytasks.png"), "ui-core-assets");
  assert.equal(getContentPackChunkGroup("navigation/home.png"), "ui-core-assets");
  assert.equal(getContentPackChunkGroup("sprite-sheets/images/objects.png"), "client-sprite-sheets");
  assert.equal(getContentPackChunkGroup("sprite-sheets/maps/appearance-map.json"), "client-appearance-maps");
  assert.equal(getContentPackChunkGroup("sprite-sheets/audit/summary.json"), "client-runtime-assets");
  assert.equal(getContentPackChunkGroup("tools/tibia-mirror/example.json"), "ui-tool-assets");
});

test("matches the content-pack inclusion rules", () => {
  assert.equal(isContentPackRuntimeAsset("assets/tutorial/step.gif"), true);
  assert.equal(isContentPackRuntimeAsset("assets/sprite-sheets/images/objects.png"), true);
  assert.equal(isContentPackRuntimeAsset("assets/library/catalogs/item.jpeg"), false);
  assert.equal(isContentPackRuntimeAsset("assets/library/catalogs/.gitkeep"), false);
});
