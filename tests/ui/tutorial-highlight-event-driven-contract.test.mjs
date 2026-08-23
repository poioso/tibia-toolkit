import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../desktop/tutorial-tour.js", import.meta.url), "utf8");
const start = source.indexOf("function startTutorialHighlightFrame(");
const end = source.indexOf("\nfunction escapeHtml", start);
const helper = source.slice(start, end);

test("tutorial highlight follows real layout changes instead of polling every animation frame", () => {
  assert.match(helper, /new ResizeObserver\(scheduleUpdate\)/);
  assert.match(helper, /new MutationObserver\(scheduleUpdate\)/);
  assert.match(helper, /window\.addEventListener\("scroll", scheduleUpdate, true\)/);
  assert.match(helper, /rectSignature === activeTutorialHighlightRectSignature/);
  assert.equal((helper.match(/requestAnimationFrame\(update\)/g) || []).length, 1);
  const updateBody = helper.slice(
    helper.indexOf("const update ="),
    helper.indexOf("const scheduleUpdate =")
  );
  assert.doesNotMatch(updateBody, /requestAnimationFrame/);
});
