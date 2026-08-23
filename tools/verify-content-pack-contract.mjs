import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const contractPath = path.join(root, "tools", "content-pack-contract.json");
const contract = JSON.parse(await fs.readFile(contractPath, "utf8"));
const extensions = new Set([".js", ".mjs", ".cjs", ".css", ".html", ".json"]);

async function collect(directory) {
  const output = [];
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch (error) { if (error?.code === "ENOENT") return output; throw error; }
  for (const entry of entries) {
    if (["node_modules", "bin", "obj", "publish", "dist", ".git", ".local"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await collect(full));
    else if (extensions.has(path.extname(entry.name).toLowerCase())) output.push(full);
  }
  return output;
}

function normalize(value) { return String(value || "").replaceAll("\\", "/").replace(/[?#].*$/, "").replace(/^(?:\.\.\/|\.\/)+/, ""); }
const references = new Set();
const pattern = /((?:\.\.?\/)?assets\/[^"'`\s)<>]+?\.(?:json|html|jpeg|webp|css|gif|jpg|ogg|png|svg|md|js))/gi;
const sourceFiles = [];
for (const entry of ["app.js", "index.html", "styles.css", "desktop", "lib"]) {
  const target = path.join(root, entry);
  try { const stat = await fs.stat(target); if (stat.isFile()) sourceFiles.push(target); else sourceFiles.push(...await collect(target)); } catch (error) { if (error?.code !== "ENOENT") throw error; }
}
for (const sourceFile of sourceFiles) {
  const source = await fs.readFile(sourceFile, "utf8");
  for (const match of source.matchAll(pattern)) {
    const reference = normalize(match[1]);
    if (reference.startsWith("assets/") && !/[${}]/.test(reference)) references.add(reference);
  }
  for (const match of source.matchAll(/\bpath\.join\(([^)\n]+)\)/g)) {
    const parts = [...match[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((part) => part[1]);
    const assetIndex = parts.indexOf("assets");
    if (assetIndex < 0) continue;
    const reference = normalize(parts.slice(assetIndex).join("/"));
    if (/\.[a-z0-9]{2,5}$/i.test(reference) && !/[${}]/.test(reference)) references.add(reference);
  }
}
const declared = new Set([...(contract.staticAssetReferences || []), ...(contract.dynamicAssetReferences || [])]);
const undeclared = [...references].filter((reference) => !declared.has(reference)).sort();
const missingRequired = [...new Set(contract.requiredAssetReferences || [])].filter((reference) => !declared.has(reference)).sort();
const result = { contractVersion: contract.version, sourceFiles: sourceFiles.length, staticReferences: references.size, declaredReferences: declared.size, undeclared, missingRequired };
console.log(JSON.stringify(result, null, 2));
if (undeclared.length || missingRequired.length) process.exitCode = 1;
