import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../app.js", import.meta.url), "utf8");

test("a consulta individual de item mede estatico, Market e falha separadamente", () => {
  const start = source.indexOf("async function handleItemSearch(skipInputNormalization = false) {");
  const end = source.indexOf("\nfunction renderItem", start);
  const body = source.slice(start, end);

  assert.ok(start >= 0 && end > start, "handleItemSearch deve existir como fluxo isolado");
  assert.match(body, /recordPerformanceMetric\("item-search-static-ready"/);
  assert.match(body, /recordPerformanceMetric\("item-search-market-ready"/);
  assert.match(body, /recordPerformanceMetric\("item-search-failed"/);
  assert.match(body, /const itemSearchStartedAt = performance\.now\(\);/);
});
