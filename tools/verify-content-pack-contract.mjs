import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(root, "tools", "content-pack-contract.json");
const sourceFiles = [
  "app.js",
  "index.html",
  "styles.css",
  "desktop/tutorial-tour.js",
  "lib/data-service.js",
  "lib/ui-translations.js"
];
const assetReference = /assets\/[^"'`\s)<>]+?\.(?:gif|png|jpg|jpeg|webp|svg|ogg|json|html|css|js)/g;

if (!fs.existsSync(contractPath)) {
  throw new Error("Contrato do content pack ausente: tools/content-pack-contract.json");
}

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const declared = new Set(Array.isArray(contract.staticAssetReferences) ? contract.staticAssetReferences : []);
const references = new Set();

for (const relativePath of sourceFiles) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const match of source.matchAll(assetReference)) {
    if (!match[0].includes("${")) references.add(match[0].replaceAll("\\\\", "/"));
  }
}

const undeclared = [...references].filter((reference) => !declared.has(reference)).sort();
const requiredContractPaths = [
  "assets/data/books-documents/tibiawiki.audit.json",
  "assets/ui/nav-biblioteca.gif",
  "assets/ui/item-books-tab.gif"
];
const missingContractEntries = requiredContractPaths.filter((reference) => !declared.has(reference));

console.log(JSON.stringify({
  contractVersion: contract.version,
  staticReferences: references.size,
  declaredReferences: declared.size,
  undeclared,
  missingContractEntries
}, null, 2));

if (undeclared.length > 0 || missingContractEntries.length > 0) {
  process.exitCode = 1;
}
