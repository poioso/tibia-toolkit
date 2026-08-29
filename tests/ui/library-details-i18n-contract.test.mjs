import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const translations = fs.readFileSync(new URL("../../lib/i18n/ui-translations.js", import.meta.url), "utf8");
const renderer = fs.readFileSync(new URL("../../app.js", import.meta.url), "utf8");

test("library fact headings resolve to public labels in every locale", () => {
  const usedKeys = new Set(
    [...renderer.matchAll(/\bt\("([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_-]+)+)"/g)].map((match) => match[1]),
  );
  const definedKeys = new Set(
    [...translations.matchAll(/"([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_-]+)+)"\s*:/g)].map((match) => match[1]),
  );

  assert.deepEqual(
    [...usedKeys].filter((key) => !definedKeys.has(key)),
    [],
    "every literal renderer translation key must have a public label",
  );
  assert.equal((translations.match(/"common\.details"\s*:/g) || []).length, 3);
  assert.equal((translations.match(/"common\.description"\s*:/g) || []).length, 3);
  assert.match(translations, /"common\.details"\s*:\s*"Detalhes"/);
  assert.match(translations, /"common\.details"\s*:\s*"Details"/);
  assert.match(translations, /"common\.details"\s*:\s*"Details"/);
  assert.match(translations, /"common\.description"\s*:\s*"Descrição"/);
  assert.match(translations, /"common\.description"\s*:\s*"Description"/);
  assert.match(translations, /"common\.description"\s*:\s*"Beschreibung"/);
  assert.match(renderer, /t\("common\.details"\)/);
  assert.match(renderer, /t\("common\.description"\)/);
});
