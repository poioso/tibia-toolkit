import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
  "app.js",
  "index.html",
  "styles.css",
  "desktop/tutorial-tour.js",
  "lib/data-service.js",
  "lib/ui-translations.js"
];
const assetReference = /assets\/[^"'`\s)<>]+?\.(?:gif|png|jpg|jpeg|webp|svg|ogg|json|html|css|js)/g;
const references = new Set();

for (const relativePath of sourceFiles) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const match of source.matchAll(assetReference)) {
    if (!match[0].includes("${")) references.add(match[0].replaceAll("\\\\", "/"));
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const contract = {
  version: 1,
  generatedForAppVersion: packageJson.version,
  staticAssetReferences: [...references].sort(),
  notes: "Generated from renderer and runtime asset references. Validate the actual ZIP with audit-content-pack.mjs before every content promotion."
};
const outputPath = path.join(root, "tools", "content-pack-contract.json");
fs.writeFileSync(outputPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
console.log(`Updated ${outputPath}`);
