import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../../app.js", import.meta.url), "utf8");
const pickerSource = await fs.readFile(new URL("../../desktop/world-picker.js", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.ok(start >= 0, `Missing start marker: ${startMarker}`);
  assert.ok(end > start, `Missing end marker: ${endMarker}`);
  return appSource.slice(start, end);
}

test("global world arrow and typing use the external picker with the same filter contract", () => {
  const inputHandler = sourceBetween(
    'els.globalWorldInput?.addEventListener("input"',
    'els.globalWorldDropdownButton?.addEventListener("click"'
  );
  const buttonHandler = sourceBetween(
    'els.globalWorldDropdownButton?.addEventListener("click"',
    'els.desktopBoostedCreature?.addEventListener("click"'
  );

  assert.match(inputHandler, /globalWorldPicker\?\.open/);
  assert.match(inputHandler, /openDesktopGlobalWorldPickerForQuery/);
  assert.match(buttonHandler, /globalWorldPicker\?\.open/);
  assert.match(buttonHandler, /toggleDesktopGlobalWorldPicker/);
  assert.match(pickerSource, /normalizedName === normalizedQuery/);
  assert.match(pickerSource, /normalizedName\.startsWith\(normalizedQuery\)/);
  assert.match(pickerSource, /normalizedName\.includes\(normalizedQuery\)/);
  assert.match(pickerSource, /slice\(0, normalizedQuery \? 14 : worlds\.length\)/);
});
