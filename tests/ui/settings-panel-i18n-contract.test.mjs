import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const phraseMap = JSON.parse(
  fs.readFileSync(new URL("../../assets/localization/phrases.pt-BR.json", import.meta.url), "utf8"),
);
const translations = fs.readFileSync(new URL("../../lib/i18n/ui-translations.js", import.meta.url), "utf8");

test("settings panel keeps the accented Portuguese title", () => {
  assert.equal(
    Object.prototype.hasOwnProperty.call(phraseMap, "Configuracoes"),
    false,
    "the phrase map must not downgrade Configurações to an unaccented label",
  );
  assert.match(translations, /"screenVision\.settings\.title"\s*:\s*"Configurações"/);
  assert.match(translations, /"screenVision\.settings\.title"\s*:\s*"Settings"/);
  assert.match(translations, /"screenVision\.settings\.title"\s*:\s*"Einstellungen"/);
});
