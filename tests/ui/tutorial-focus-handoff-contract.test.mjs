import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../desktop/main.js", import.meta.url), "utf8");

function handlerBody(channel, nextMarker) {
  const start = source.indexOf(`ipcMain.on("${channel}"`);
  const end = source.indexOf(nextMarker, start + 1);
  return source.slice(start, end);
}

test("tutorial next and cancel keep focus on the native tutorial popover", () => {
  const next = handlerBody("tutorial-popover:next", 'ipcMain.on("tutorial-popover:cancel"');
  const cancel = handlerBody("tutorial-popover:cancel", 'ipcMain.handle("app:splash-progress"');

  assert.match(next, /mainWindow\.webContents\.send\("tutorial:next"\)/);
  assert.doesNotMatch(next, /mainWindow\.focus\(\)/);
  assert.match(cancel, /mainWindow\.webContents\.send\("tutorial:cancel"\)/);
  assert.doesNotMatch(cancel, /mainWindow\.focus\(\)/);
});

test("main-window focus and blur do not restack while a tutorial owns priority", () => {
  assert.match(source, /function isTutorialPriorityActive\(\)/);
  assert.match(source, /if \(!isTutorialPriorityActive\(\)\) \{\s*restoreMainWindowTopmost\(window\);/);
});
