import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { startAppUpdater } from "../desktop/app-updater.js";

class FakeUpdater extends EventEmitter {
  setFeedURL({ url }) {
    this.url = url;
  }

  async checkForUpdates() {
    queueMicrotask(() => this.emit("update-available", { version: "0.7.7" }));
  }

  async downloadUpdate() {}
  quitAndInstall() {}
}

test("returns null outside a packaged runtime", () => {
  assert.equal(startAppUpdater({ appIsPackaged: false }), null);
});

test("exposes the initial update result before content bootstrap", async () => {
  const updater = new FakeUpdater();
  const controller = startAppUpdater({
    appIsPackaged: true,
    urls: ["https://updates.test"],
    updater
  });

  assert.deepEqual(await controller.initialCheck, {
    available: true,
    info: { version: "0.7.7" }
  });
  controller.dispose();
});

test("settles the initial check when no update is available", async () => {
  const updater = new FakeUpdater();
  updater.checkForUpdates = async () => {
    queueMicrotask(() => updater.emit("update-not-available", { version: "0.7.7" }));
  };
  const controller = startAppUpdater({
    appIsPackaged: true,
    urls: ["https://updates.test"],
    updater
  });

  assert.deepEqual(await controller.initialCheck, {
    available: false,
    info: { version: "0.7.7" }
  });
  controller.dispose();
});
