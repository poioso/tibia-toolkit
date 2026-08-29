import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../desktop/main.js", import.meta.url), "utf8");

function sourceBetween(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("main window stays hidden until the renderer ready IPC signal", () => {
  const createWindow = sourceBetween(
    "async function createOverlayWindow()",
    "function restoreMainWindowTopmost",
  );
  const readyHandler = sourceBetween(
    'ipcMain.handle("app:ready-to-show"',
    'ipcMain.handle("data:send-message"',
  );
  const preEventSetup = sourceBetween(
    "async function createOverlayWindow()",
    'window.on("show",',
  );
  const failedLoadHandler = sourceBetween(
    'window.webContents.on("did-fail-load"',
    'window.webContents.on("did-finish-load"',
  );

  assert.match(createWindow, /show:\s*false/);
  assert.doesNotMatch(preEventSetup, /restoreMainWindowTopmost\(window\)/);
  assert.doesNotMatch(preEventSetup, /window\.show\(\)/);
  assert.doesNotMatch(failedLoadHandler, /window\.show\(\)/);
  assert.match(readyHandler, /mainWindowRendererReady\s*=\s*true/);
  assert.match(readyHandler, /window\.show\(\)/);
});
