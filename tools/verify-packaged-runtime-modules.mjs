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
  "services/game-data-hub/api-security.mjs",
  "assets/ui/Tick.png",
  "assets/ui/Cross.png",
  "assets/ui/tutorial/update.gif",
  "desktop/screen-vision-native/publish/win-x64/ScreenVision.NativeHost.exe"
];

const serverOnlyModules = [
  "services/game-data-hub/mini-world-changes.mjs",
  "services/game-data-hub/mini-world-change-visuals.mjs"
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

for (const relativeModulePath of serverOnlyModules) {
  const absoluteModulePath = path.join(packageRoot, relativeModulePath);
  try {
    await fs.access(absoluteModulePath);
    throw new Error(`Server-only module is present in the desktop package: ${relativeModulePath}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log(`Packaged runtime module audit passed: ${requiredModules.length} required modules found.`);
