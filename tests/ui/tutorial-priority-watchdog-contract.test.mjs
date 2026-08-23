import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../desktop/main.js", import.meta.url), "utf8");

test("tutorial priority is event driven and never re-composites the owner on a polling interval", () => {
  const priorityStart = source.indexOf("function enforceTutorialPriority()");
  const priorityEnd = source.indexOf("function isTutorialPriorityActive()", priorityStart);
  const prioritySource = source.slice(priorityStart, priorityEnd);
  assert.match(source, /function enforceTutorialPriority\(\)/);
  assert.match(source, /tutorialPriorityOwner = owner;\s*\/\/ Native z-order only needs to be asserted[\s\S]*?enforceTutorialPriority\(\);/);
  assert.doesNotMatch(prioritySource, /tutorialPriorityTimer/);
  assert.doesNotMatch(prioritySource, /setInterval\(enforceTutorialPriority/);
  assert.doesNotMatch(prioritySource, /\.moveTop\(\)/);
});
