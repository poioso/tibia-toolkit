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
  "desktop/screenshot-assistant.html",
  "desktop/screenshot-assistant.css",
  "desktop/screenshot-assistant.js",
  "desktop/screenshot-assistant-preload.cjs",
  "desktop/screenshot-selector.html",
  "desktop/screenshot-selector.css",
  "desktop/screenshot-selector.js",
  "desktop/screenshot-selector-preload.cjs",
  "desktop/tutorial-popover.html",
  "desktop/tutorial-popover-preload.cjs",
  "desktop/build/icon.ico",
  "desktop/screen-vision-native/publish/win-x64/ScreenVision.NativeHost.exe",
  "assets/screen-vision/reference/sounds/spells/utura gran.ogg",
  "assets/screen-vision/reference/sounds/spells/exura gran ico.ogg",
  "assets/screen-vision/reference/sounds/spells/utito tempo.ogg",
  "assets/ui/Tick.png",
  "assets/ui/Cross.png",
  "assets/ui/tutorial/update.gif"
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

if (missing.length) {
  console.error(`Packaged runtime verification failed for ${appRoot}.`);
  for (const relativePath of missing) {
    console.error(`- ${relativePath}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Packaged runtime verified: ${requiredFiles.length} required files present in ${appRoot}.`);
}
