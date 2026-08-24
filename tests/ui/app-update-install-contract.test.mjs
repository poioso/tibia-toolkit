import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (relativePath) => fs.readFile(new URL(relativePath, root), "utf8");

test("updater marks the installer-owned quit before calling quitAndInstall", async () => {
  const source = await read("desktop/app-updater.js");
  assert.match(source, /onInstallRequested\s*=\s*\(\)\s*=>\s*\{\}/);
  assert.match(source, /onInstallRequested\(\);\s*onStatus\([\s\S]*?\);\s*autoUpdater\.quitAndInstall\(\);/);
});

test("main process lets electron-updater own before-quit after install starts", async () => {
  const source = await read("desktop/main.js");
  assert.match(source, /let appUpdateQuitRequested = false;/);
  assert.match(source, /onInstallRequested\(\)\s*\{[\s\S]*?appUpdateQuitRequested = true;/);
  assert.match(source, /app\.on\("before-quit", \(event\) => \{[\s\S]*?if \(appUpdateQuitRequested\) \{[\s\S]*?return;/);
});

console.log("OK app update install contract");
