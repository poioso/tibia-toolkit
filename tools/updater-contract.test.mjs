import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const source = await fs.readFile(new URL("../desktop/app-updater.js", import.meta.url), "utf8");

test("updater exposes a resolvable initialCheck result", () => {
  assert.match(source, /const initialCheck = new Promise/);
  assert.match(source, /completeInitialCheck\(\{ available: true, info \}\)/);
  assert.match(source, /completeInitialCheck\(\{ available: false, error: null \}\)/);
  assert.match(source, /completeInitialCheck\(\{ available: false, error \}\)/);
  assert.match(source, /initialCheck,\s*getInfo/);
});

test("updater keeps manual download and both feed fallback guarantees", () => {
  assert.match(source, /autoUpdater\.autoDownload = false/);
  assert.match(source, /activeSourceIndex \+ 1 < updateUrls\.length/);
  assert.match(source, /Nenhum servidor de atualizacao respondeu/);
});
