import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.resolve(
  projectRoot,
  process.argv[2] || "dist/tibia-toolkit-release/win-unpacked/resources/app"
);

const requiredModules = [
  "services/game-data-hub/server.mjs",
  "services/game-data-hub/api-security.mjs"
];

const privateModules = [
  "services/game-data-hub/mini-world-changes.mjs",
  "services/game-data-hub/mini-world-change-visuals.mjs",
  "services/market-cache/server.mjs"
];

for (const relativeModulePath of requiredModules) {
  const absoluteModulePath = path.join(packageRoot, relativeModulePath);
  try {
    const metadata = await fs.stat(absoluteModulePath);
    if (!metadata.isFile() || metadata.size === 0) {
      throw new Error("not a non-empty file");
    }
  } catch (error) {
    throw new Error(`Packaged runtime module is missing: ${relativeModulePath} (${error.message})`);
  }
}

for (const relativeModulePath of privateModules) {
  const absoluteModulePath = path.join(packageRoot, relativeModulePath);
  const exists = await fs.stat(absoluteModulePath).then(() => true).catch(() => false);
  if (exists) {
    throw new Error(`Private server-only module was included in the desktop package: ${relativeModulePath}`);
  }
}

console.log(
  `Packaged runtime module audit passed: ${requiredModules.length} public modules found and ${privateModules.length} private modules excluded.`
);
