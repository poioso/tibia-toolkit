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
const booksCatalogPath = "assets/data/books-documents/tibiawiki.audit.json";

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

function normalizeBookImagePath(source) {
  const remoteFilename = decodeURIComponent(String(source || "").split("/").at(-1) || "book.gif")
    .replace(/[?#].*$/, "");
  const extension = remoteFilename.match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase() || ".gif";
  const filename = remoteFilename
    .slice(0, -extension.length)
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `assets/data/books-documents/images/${filename || "book"}${extension}`;
}

// Book appearance images are resolved from each catalog record at runtime, so
// they cannot be discovered by the static source scan above. Audit them from
// the same catalog that the renderer consumes.
const bookImageReferences = new Set();
const booksCatalogEntry = new AdmZip(archivePath).getEntry(booksCatalogPath);
if (!booksCatalogEntry) {
  bookImageReferences.add(booksCatalogPath);
} else {
  const booksCatalog = JSON.parse(booksCatalogEntry.getData().toString("utf8"));
  for (const record of Array.isArray(booksCatalog?.records) ? booksCatalog.records : []) {
    for (const appearance of Array.isArray(record?.appearances) ? record.appearances : []) {
      bookImageReferences.add(normalizeBookImagePath(appearance?.source));
    }
  }
}
const dynamicReferences = [...references].filter((reference) => reference.includes("${")).sort();
const requiredReferences = new Set([
  ...references,
  ...bookImageReferences
]);
const missing = [...requiredReferences]
  .filter((reference) => !reference.includes("${"))
  .filter((reference) => !entries.has(reference))
  .sort();

console.log(JSON.stringify({
  archive: archivePath,
  staticReferences: references.size,
  bookImageReferences: bookImageReferences.size,
  dynamicReferences,
  archiveFiles: entries.size,
  missing
}, null, 2));

if (missing.length > 0) {
  process.exitCode = 1;
}
