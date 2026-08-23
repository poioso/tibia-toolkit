import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
async function collect(directory) {
  const output = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await collect(full));
    else if (entry.name.endsWith(".test.mjs")) output.push(full);
  }
  return output;
}
const testFiles = (await collect(path.join(root, "tests"))).filter((file) => !file.endsWith("auth-homologation-runtime.contract.test.mjs"));
const nodeTest = spawnSync(process.execPath, ["--test", ...testFiles], { cwd: root, stdio: "inherit" });
if (nodeTest.status !== 0) process.exit(nodeTest.status || 1);
for (const script of ["tools/updater-contract.test.mjs", "tools/test-negative-runtime-audits.mjs"]) {
  const result = spawnSync(process.execPath, [script], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Release test gate passed: ${testFiles.length} Node test files plus updater and negative runtime audits.`);
