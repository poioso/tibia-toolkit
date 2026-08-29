import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");
const stylesSource = await readFile(new URL("../../styles.css", import.meta.url), "utf8");

test("either update indicator replaces the toolbar brand and app update has priority", () => {
  assert.match(appSource, /function renderDesktopToolbarBrandUpdateState\(\)/);
  assert.match(appSource, /const showLibraryUpdate = !showAppUpdate && libraryPhase === "ready"/);
  assert.match(appSource, /classList\.toggle\("has-update", showAppUpdate \|\| showLibraryUpdate\)/);
  assert.match(appSource, /desktopLibraryContentUpdateButton\.hidden = !showLibraryUpdate/);
});

test("the Library update indicator occupies the same centered slot as the app update indicator", () => {
  const blockStart = stylesSource.indexOf(".desktop-library-content-update-button {");
  const blockEnd = stylesSource.indexOf("}", blockStart);
  const block = stylesSource.slice(blockStart, blockEnd);

  assert.match(block, /position: absolute/);
  assert.match(block, /top: 50%/);
  assert.match(block, /left: 50%/);
  assert.match(block, /width: 34px/);
  assert.match(block, /height: 34px/);
  assert.match(block, /transform: translate\(-50%, -50%\)/);
});
