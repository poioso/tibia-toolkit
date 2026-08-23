import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../desktop/tutorial-tour.js", import.meta.url), "utf8");

test("uma transicao de tutorial limpa o popover somente uma vez", () => {
  const closeStart = source.indexOf("async function closeActiveStep({");
  const closeEnd = source.indexOf("\nasync function runStep", closeStart);
  const closeBody = source.slice(closeStart, closeEnd);
  const runStart = source.indexOf("async function runStep(index = 0, tourName = \"item-prices\") {");
  const runEnd = source.indexOf("\nfunction getTutorialErrorKind", runStart);
  const runBody = source.slice(runStart, runEnd);

  assert.match(closeBody, /closePopover = true/);
  assert.match(closeBody, /if \(closePopover\) \{\s*await window\.desktopApi\?\.app\?\.tutorial\?\.closeStep\?\.\(\);/);
  assert.match(runBody, /await window\.desktopApi\?\.app\?\.tutorial\?\.closeStep\?\.\(\);/);
  assert.match(runBody, /closePopover: false/);
});
