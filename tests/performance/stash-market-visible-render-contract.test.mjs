import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../app.js", import.meta.url), "utf8");

test("Stash repaint after Market batches keeps global price sorting exact and defers only off-screen cards", () => {
  const helper = source.match(/function shouldRenderStashGridAfterMarketUpdate\(values\) \{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(helper, /state\.stashSort\.startsWith\("market"\)/);
  assert.match(helper, /querySelectorAll\("\[data-market-id\]"\)/);
  assert.match(source, /function renderStashGridAfterMarketUpdate\(values\)/);
  assert.match(source, /renderStashGridAfterMarketUpdate\(values\);/);
  assert.match(source, /"stash-market-grid-render-deferred"/);
});
