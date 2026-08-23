import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../desktop/tutorial-tour.js", import.meta.url), "utf8");

test("a digitacao simulada de Precos de Itens consulta sugestoes somente ao terminar", () => {
  const start = source.indexOf("async function typeSearchText(text) {");
  const end = source.indexOf("\nasync function runImbuementTierDemo", start);
  const body = source.slice(start, end);

  assert.ok(start >= 0 && end > start, "typeSearchText deve existir como fluxo isolado");
  assert.doesNotMatch(body, /dispatchEvent\(new Event\("input"/);
  assert.match(body, /await getTutorialApi\(\)\?\.typeItemSearch\?\.\(text\);/);
});
