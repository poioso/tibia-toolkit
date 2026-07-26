import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archivePath = path.resolve(process.argv[2] || "");
const sourceFiles = [
  "app.js",
  "index.html",
  "styles.css",
  "desktop/tutorial-tour.js",
  "lib/data-service.js",
  "lib/ui-translations.js"
];
const assetReference = /assets\/[^"'`\s)<>]+?\.(?:gif|png|jpg|jpeg|webp|svg|ogg|json|html|css|js)/g;

if (!archivePath || !fs.existsSync(archivePath)) {
  throw new Error("Informe o caminho de um ZIP de conteudo existente.");
}

const references = new Set();
for (const relativePath of sourceFiles) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const match of source.matchAll(assetReference)) {
    references.add(match[0].replaceAll("\\\\", "/"));
  }
}

const entries = new Set(
  new AdmZip(archivePath)
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => entry.entryName)
);
const dynamicReferences = [...references].filter((reference) => reference.includes("${")).sort();
const missing = [...references]
  .filter((reference) => !reference.includes("${"))
  .filter((reference) => !entries.has(reference))
  .sort();

console.log(JSON.stringify({
  archive: archivePath,
  staticReferences: references.size,
  dynamicReferences,
  archiveFiles: entries.size,
  missing
}, null, 2));

if (missing.length > 0) {
  process.exitCode = 1;
}
