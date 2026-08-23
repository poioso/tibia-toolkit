import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const root = path.resolve(import.meta.dirname, "..");
const archivePath = path.resolve(process.argv[2] || "");
if (!archivePath || !fs.existsSync(archivePath)) throw new Error("Informe o caminho de um ZIP de conteudo existente.");
const contract = JSON.parse(fs.readFileSync(path.join(root, "tools", "content-pack-contract.json"), "utf8"));
const archive = new AdmZip(archivePath);
const entries = new Set();
for (const entry of archive.getEntries()) {
  if (entry.isDirectory) continue;
  if (entry.getData().length === 0) throw new Error(`Entrada vazia no Content Pack: ${entry.entryName}`);
  entries.add(entry.entryName.replaceAll("\\", "/"));
}
const required = new Set([...(contract.staticAssetReferences || []), ...(contract.dynamicAssetReferences || []), ...(contract.requiredAssetReferences || [])]);
const booksCatalogPath = "assets/data/books-documents/tibiawiki.audit.json";
const missing = [...required].filter((reference) => !entries.has(reference)).sort();
const booksCatalogEntry = archive.getEntry(booksCatalogPath);
const bookImageReferences = new Set();
if (!booksCatalogEntry) missing.push(booksCatalogPath);
else {
  const catalog = JSON.parse(booksCatalogEntry.getData().toString("utf8"));
  for (const record of Array.isArray(catalog?.records) ? catalog.records : []) {
    for (const appearance of Array.isArray(record?.appearances) ? record.appearances : []) {
      const source = decodeURIComponent(String(appearance?.source || "").split("/").at(-1) || "book.gif").replace(/[?#].*$/, "");
      const extension = source.match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase() || ".gif";
      const filename = source.slice(0, -extension.length).toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      bookImageReferences.add(`assets/data/books-documents/images/${filename || "book"}${extension}`);
    }
  }
}
for (const reference of bookImageReferences) if (!entries.has(reference)) missing.push(reference);
const result = { archive: archivePath, archiveFiles: entries.size, requiredReferences: required.size, bookImageReferences: bookImageReferences.size, missing: [...new Set(missing)].sort() };
console.log(JSON.stringify(result, null, 2));
if (result.missing.length) process.exitCode = 1;
