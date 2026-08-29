import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");
const serviceSource = await readFile(new URL("../../lib/data/data-service.js", import.meta.url), "utf8");

test("desktop bootstrap can start with an empty catalog and never persists an invented world", () => {
  assert.match(serviceSource, /fetchWorldCatalog\(\{ forceFresh: true \}\)\.catch\(\(\) => \[\]\)/);
  assert.match(appSource, /currentWorldSlug: ""/);
  assert.match(appSource, /if \(state\.currentWorldSlug\) \{[\s\S]*?saveLastWorldSlug/);
  assert.doesNotMatch(appSource, /currentWorldSlug \|\| "antica"/);
});

test("desktop disables world controls and restores invalid typed text", () => {
  assert.match(appSource, /input\.disabled = !catalogAvailable/);
  assert.match(appSource, /button\.disabled = !catalogAvailable/);
  assert.match(appSource, /function restoreWorldInput\(field\)/);
  assert.match(appSource, /setTimeout\(\(\) => restoreWorldInput\("global"\), 120\)/);
  assert.match(appSource, /event\.key === "Escape"[\s\S]*?restoreWorldInput\(field\)/);
});

test("market-dependent service paths reject an empty world instead of defaulting to Antica", () => {
  assert.doesNotMatch(serviceSource, /worldSlug \|\| DEFAULT_WORLD/);
  assert.doesNotMatch(serviceSource, /selectedWorld\?\.name \|\| DEFAULT_WORLD/);
  assert.match(serviceSource, /Selecione um mundo disponível antes de consultar o market/);
});
