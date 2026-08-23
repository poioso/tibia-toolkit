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
  const openingScriptStart = lowerPopover.indexOf("<script");
  const openingScriptEnd = openingScriptStart >= 0 ? lowerPopover.indexOf(">", openingScriptStart) : -1;
  const closingScriptStart = openingScriptEnd >= 0 ? lowerPopover.indexOf("</script", openingScriptEnd + 1) : -1;
  const closingScriptEnd = closingScriptStart >= 0 ? lowerPopover.indexOf(">", closingScriptStart) : -1;
  const inlineScript = openingScriptEnd >= 0 && closingScriptStart >= 0 && closingScriptEnd >= 0
    ? popover.slice(openingScriptEnd + 1, closingScriptStart)
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
  assert.match(main, /payload\.autoHeight\s*===\s*true\s*\?\s*360/);
});

test("all media registered for tutorials exists locally or in the content pack contract", () => {
  const tour = read("desktop/tutorial-tour.js");
  const contentContract = JSON.parse(read("tools/content-pack-contract.json"));
  const assetBlock = tour.match(/const TUTORIAL_ASSETS\s*=\s*\{([\s\S]*?)\n\};/)?.[1] || "";
  const assets = [...assetBlock.matchAll(/["'](assets\/[^"]+?\.(?:gif|png|jpe?g|webp))["']/gi)]
    .map((match) => match[1]);

  assert.ok(assets.length >= 40, `expected the complete tutorial asset registry, found ${assets.length}`);
  const declaredContentAssets = new Set(contentContract.requiredAssetReferences || []);
  const missing = assets.filter((relativePath) => (
    !fs.existsSync(path.join(projectRoot, relativePath)) && !declaredContentAssets.has(relativePath)
  ));
  assert.deepEqual(missing, []);
});
