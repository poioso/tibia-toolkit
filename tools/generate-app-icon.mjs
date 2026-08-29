import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const sourcePath = path.join(projectRoot, "assets", "common", "branding", "loading-emblem.png");
const outputPath = path.join(projectRoot, "desktop", "build", "icon.ico");

const icon = await pngToIco(sourcePath);
await fs.writeFile(outputPath, icon);
console.log(`Icone gerado: ${outputPath}`);
