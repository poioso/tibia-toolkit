import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("every tutorial bullet uses the shared proportional media layout", () => {
  const popover = read("desktop/tutorial-popover.html");
  const tour = read("desktop/tutorial-tour.js");

  assert.match(popover, /\.gif\s*\{[\s\S]*?object-fit:\s*contain;/);
  assert.doesNotMatch(popover, /object-fit:\s*cover;/);
  assert.doesNotMatch(popover, /body\.screenshot-tour/);
  assert.match(popover, /card\.scrollHeight\s*\+\s*verticalPadding/);
  assert.match(popover, /result\?\.constrained/);

  const lowerPopover = popover.toLowerCase();
  const scriptStart = lowerPopover.indexOf("<script");
  const scriptBodyStart = scriptStart >= 0 ? popover.indexOf(">", scriptStart) + 1 : -1;
  const scriptBodyEnd = scriptBodyStart > 0 ? lowerPopover.lastIndexOf("</script") : -1;
  const inlineScript = scriptBodyEnd > scriptBodyStart
    ? popover.slice(scriptBodyStart, scriptBodyEnd)
    : "";
  assert.ok(inlineScript, "tutorial popover inline script must exist");
  assert.doesNotThrow(() => new Function(inlineScript));

  assert.match(tour, /gifFit:\s*"contain"/);
  assert.match(tour, /gifNatural:\s*true/);
  assert.match(tour, /autoHeight:\s*true/);
});

test("tutorial resizing reports monitor constraints back to the renderer", () => {
  const preload = read("desktop/tutorial-popover-preload.cjs");
  const main = read("desktop/main.js");

  assert.match(preload, /ipcRenderer\.invoke\("tutorial-popover:resize-to-content", height\)/);
  assert.match(main, /ipcMain\.handle\("tutorial-popover:resize-to-content"/);
  assert.match(main, /constrained:\s*desiredHeight\s*>\s*maximumHeight/);
  assert.match(main, /payload\.autoHeight\s*===\s*true\s*\?\s*scaleDesktopUiValue\(360\)/);
});

test("all media registered for tutorials exists locally", () => {
  const tour = read("desktop/tutorial-tour.js");
  const assetBlock = tour.match(/const TUTORIAL_ASSETS\s*=\s*\{([\s\S]*?)\n\};/)?.[1] || "";
  const assets = [...assetBlock.matchAll(/["'](assets\/[^"]+?\.(?:gif|png|jpe?g|webp))["']/gi)]
    .map((match) => match[1]);

  assert.ok(assets.length >= 40, `expected the complete tutorial asset registry, found ${assets.length}`);
  const missing = assets.filter((relativePath) => !fs.existsSync(path.join(projectRoot, relativePath)));
  assert.deepEqual(missing, []);
});
