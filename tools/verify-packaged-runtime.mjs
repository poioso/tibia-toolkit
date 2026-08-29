import { access, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const appRoot = path.resolve(
  process.argv[2]
    || path.join(projectRoot, "dist", "tibia-toolkit-release", "win-unpacked", "resources", "app")
);

const requiredFiles = [
  "desktop/main.js",
  "desktop/preload.cjs",
  "desktop/alert-audio-runtime.html",
  "desktop/supporters-showcase.html",
  "desktop/supporters-showcase-preload.cjs",
  "desktop/window-move-handle.html",
  "desktop/window-move-handle-preload.cjs",
  "desktop/screenshot-assistant.html",
  "desktop/screenshot-assistant.js",
  "desktop/screenshot-assistant.css",
  "desktop/screenshot-assistant-preload.cjs",
  "desktop/build/icon.ico",
  "desktop/screen-vision-native/publish/win-x64/ScreenVision.NativeHost.exe",
  "node_modules/@msgpack/msgpack/package.json",
  "node_modules/@msgpack/msgpack/dist.es5+esm/index.mjs",
  "assets/tools/tibia-mirror/reference/sounds/spells/utura gran.ogg",
  "assets/tools/tibia-mirror/reference/sounds/spells/exura gran ico.ogg",
  "assets/tools/tibia-mirror/reference/sounds/spells/utito tempo.ogg",
  "assets/common/actions/Tick.png",
  "assets/common/actions/Cross.png",
  "assets/tutorial/update.gif"
];

const missing = [];
for (const relativePath of requiredFiles) {
  const filePath = path.join(appRoot, relativePath);
  try {
    await access(filePath);
    const details = await stat(filePath);
    if (!details.isFile() || details.size <= 0) {
      missing.push(`${relativePath} (empty)`);
    }
  } catch {
    missing.push(relativePath);
  }
}

const externalWindowFiles = [
  "desktop/supporters-showcase.html",
  "desktop/window-move-handle.html",
  "desktop/screenshot-assistant.html",
  "desktop/screenshot-assistant.js"
];
for (const relativePath of externalWindowFiles) {
  const filePath = path.join(appRoot, relativePath);
  let source = "";
  try {
    source = await (await import("node:fs/promises")).readFile(filePath, "utf8");
  } catch {
    continue;
  }
  if (/(?:\.\.\/)+assets\//.test(source)) {
    missing.push(`${relativePath} (relative asset path points to bootstrap)`);
  }
  if (!source.includes("tibiatoolkit://app/assets/")) {
    missing.push(`${relativePath} (runtime asset protocol missing)`);
  }
}

if (missing.length) {
  console.error(`Packaged runtime verification failed for ${appRoot}.`);
  for (const relativePath of missing) {
    console.error(`- ${relativePath}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Packaged runtime verified: ${requiredFiles.length} required files present in ${appRoot}.`);
}
