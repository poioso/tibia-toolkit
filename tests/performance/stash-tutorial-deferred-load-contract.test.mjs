import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");
const tutorialSource = await readFile(new URL("../../desktop/tutorial-tour.js", import.meta.url), "utf8");

test("o primeiro passo do tutorial Stash nao espera o catalogo", () => {
  const start = tutorialSource.indexOf("const TUTORIAL_STASH_STEP_META = [");
  const end = tutorialSource.indexOf("\nconst TUTORIAL_TOOLS_STEP_META", start);
  const stashTour = tutorialSource.slice(start, end);

  assert.match(stashTour, /setItemViewMode\?\.\("stash", \{ deferStashLoad: true \}\)/);
});

test("a carga diferida preserva o fluxo normal e nao redesenha Stash fora da aba", () => {
  const start = appSource.indexOf("async function setItemViewMode(mode, options = {}) {");
  const end = appSource.indexOf("\nfunction setNpcTab", start);
  const body = appSource.slice(start, end);

  assert.match(body, /if \(options\.deferStashLoad\) \{/);
  assert.match(body, /void loadStashView\(\);/);
  assert.match(body, /await loadStashView\(\);/);
  assert.match(body, /if \(state\.itemViewMode !== "stash"\) \{\s*return;/);
});
