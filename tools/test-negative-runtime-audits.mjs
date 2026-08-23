import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const tool = path.resolve(import.meta.dirname, "audit-runtime-dependencies.mjs");
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "tibia-toolkit-runtime-audit-"));
const files = {
  "app.js": "import './lib/helper.mjs';\nconst preload = './desktop/preload.cjs';\nvoid preload;\n",
  "lib/helper.mjs": "export const ready = true;\n",
  "desktop/preload.cjs": "module.exports = {};\n",
  "desktop/popup.html": '<link rel="stylesheet" href="./popup.css"><img src="../assets/ui/icon.png">',
  "desktop/popup.css": "body { color: white; }\n",
  "assets/ui/icon.png": "fixture-image"
};

async function writeFixture() {
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(fixture, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
}
function run() {
  const { TIBIA_TOOLKIT_ASSET_SOURCE, ...testEnvironment } = process.env;
  return spawnSync(process.execPath, [tool, fixture, "--strict-assets"], { encoding: "utf8", env: testEnvironment });
}
async function expectFailure(relative, label) {
  await fs.rm(path.join(fixture, relative), { force: true });
  const result = run();
  assert.notEqual(result.status, 0, `${label} removal must fail the audit`);
  await writeFixture();
}

try {
  await writeFixture();
  const complete = run();
  if (complete.status !== 0) console.error(complete.stdout || complete.stderr);
  assert.equal(complete.status, 0, "complete fixture must pass the audit");
  await expectFailure("desktop/popup.css", "CSS");
  await expectFailure("assets/ui/icon.png", "image");
  await expectFailure("desktop/preload.cjs", "preload");
  await expectFailure("lib/helper.mjs", "module");
  console.log("Negative runtime asset tests passed: CSS, image, preload and module removals all failed closed.");
} finally {
  await fs.rm(fixture, { recursive: true, force: true });
}
