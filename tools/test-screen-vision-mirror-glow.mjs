import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const nativePath = path.join(projectRoot, "desktop", "screen-vision-native", "ScreenVision.NativeHost", "Views", "RegionMirrorWindow.cs");
const mainPath = path.join(projectRoot, "desktop", "main.js");
const [nativeSource, mainSource] = await Promise.all([
  fs.readFile(nativePath, "utf8"),
  fs.readFile(mainPath, "utf8"),
]);

assert.match(nativeSource, /ApplyLocalGlow\(next, _spec\.GlowColor, _spec\.GlowIntensity, refreshMenu: false\)/);
assert.doesNotMatch(nativeSource, /ApplyLocalGlow\(true, [^\n]*Glow/);
assert.match(nativeSource, /return 0\.15 \+ \(normalized \* 1\.55\);/);

for (const action of ["mirror-set-glow-color", "mirror-set-glow-saved-colors", "mirror-set-glow-intensity"]) {
  const start = mainSource.indexOf(`type === "${action}"`);
  assert.notEqual(start, -1, `${action} handler is missing`);
  const block = mainSource.slice(start, start + 1_500);
  assert.doesNotMatch(block, /glowEnabled:\s*true/, `${action} must not re-enable glow`);
  assert.match(block, /syncRegionMirrorWindows\(savedState\)/, `${action} must resync native mirrors`);
}

console.log("Mirror glow toggle, persistence and continuous intensity contracts passed.");
