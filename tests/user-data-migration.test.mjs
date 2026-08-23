import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migrateLegacyUserDataDirectory } from "../desktop/user-data-migration.js";

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tibia-toolkit-user-data-"));
}

function removeTempRoot(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("moves the legacy ScreenVision root into the canonical user-data root", () => {
  const root = makeTempRoot();
  try {
    const legacy = path.join(root, "ScreenVision");
    fs.mkdirSync(path.join(legacy, "ScreenVision", "Profiles"), { recursive: true });
    fs.writeFileSync(path.join(legacy, "overlay-storage.json"), "legacy-state");
    fs.writeFileSync(path.join(legacy, "ScreenVision", "Profiles", "main.json"), "profile");

    const result = migrateLegacyUserDataDirectory({
      appDataRoot: root,
      targetDirectoryName: "Poioso Tibia Toolkit"
    });

    assert.equal(result.status, "migrated");
    assert.equal(fs.existsSync(legacy), false);
    assert.equal(
      fs.readFileSync(path.join(root, "Poioso Tibia Toolkit", "overlay-storage.json"), "utf8"),
      "legacy-state"
    );
    assert.equal(
      fs.readFileSync(path.join(root, "Poioso Tibia Toolkit", "ScreenVision", "Profiles", "main.json"), "utf8"),
      "profile"
    );
  } finally {
    removeTempRoot(root);
  }
});

test("merges a legacy root without overwriting newer target data", () => {
  const root = makeTempRoot();
  try {
    const legacy = path.join(root, "ScreenVision");
    const target = path.join(root, "Poioso Tibia Toolkit");
    fs.mkdirSync(legacy, { recursive: true });
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(legacy, "new-setting.json"), "keep");
    fs.writeFileSync(path.join(legacy, "same.json"), "same");
    fs.writeFileSync(path.join(target, "same.json"), "same");
    fs.writeFileSync(path.join(legacy, "conflict.json"), "old");
    fs.writeFileSync(path.join(target, "conflict.json"), "new");

    const result = migrateLegacyUserDataDirectory({
      appDataRoot: root,
      targetDirectoryName: "Poioso Tibia Toolkit"
    });

    assert.equal(result.status, "migrated-with-conflicts");
    assert.equal(fs.readFileSync(path.join(target, "new-setting.json"), "utf8"), "keep");
    assert.equal(fs.readFileSync(path.join(target, "same.json"), "utf8"), "same");
    assert.equal(fs.readFileSync(path.join(target, "conflict.json"), "utf8"), "new");
    assert.equal(fs.existsSync(legacy), false);
    assert.equal(
      fs.readFileSync(path.join(target, ".legacy-user-data-conflicts", "conflict.json"), "utf8"),
      "old"
    );
  } finally {
    removeTempRoot(root);
  }
});

test("does nothing when the legacy root is absent", () => {
  const root = makeTempRoot();
  try {
    const result = migrateLegacyUserDataDirectory({
      appDataRoot: root,
      targetDirectoryName: "Poioso Tibia Toolkit"
    });
    assert.equal(result.status, "not-needed");
  } finally {
    removeTempRoot(root);
  }
});
