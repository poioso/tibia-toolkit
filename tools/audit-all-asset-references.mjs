import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const textExtensions = new Set([".js", ".mjs", ".cjs", ".html", ".css", ".json"]);
const ignoredDirectories = new Set(["node_modules", ".local", ".git", "dist", "build", "output", "release", "audit"]);
const assetExtensions = new Set([".css", ".gif", ".html", ".jpg", ".jpeg", ".js", ".json", ".ogg", ".png", ".svg", ".webp"]);
const files = [];
const references = new Map();
const missing = [];

async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
}

function normalize(value) {
  return String(value || "")
    .replaceAll("\\", "/")
    .replace(/^tibiatoolkit:\/\/app\//i, "")
    .replace(/^\//, "")
    .replace(/[?#].*$/, "")
    .replace(/[.,:]+$/, "");
}

function isConcreteAssetReference(value) {
  return value.startsWith("assets/") && !/[${}*]/.test(value);
}

files.push(path.join(root, "app.js"), path.join(root, "index.html"), path.join(root, "styles.css"));
await walk(path.join(root, "desktop"));
await walk(path.join(root, "lib"));
await walk(path.join(root, "assets", "tools"));

// This catches protocol URLs, HTML/CSS attributes, JS literals and JSON paths.
const referencePattern = /(?:tibiatoolkit:\/\/app\/)?(?:\/?assets\/)[^\s"'<>`]+/gi;
for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  const location = path.relative(root, file).replaceAll("\\", "/");
  for (const match of source.matchAll(referencePattern)) {
    const reference = normalize(match[0]);
    if (!isConcreteAssetReference(reference) || !assetExtensions.has(path.extname(reference).toLowerCase())) continue;
    const locations = references.get(reference) || [];
    locations.push(location);
    references.set(reference, locations);
  }
}

for (const [reference, locations] of [...references].sort(([left], [right]) => left.localeCompare(right))) {
  let valid = false;
  try {
    const stat = await fs.stat(path.join(root, ...reference.split("/")));
    valid = stat.isFile() && stat.size > 0;
  } catch {
    valid = false;
  }
  if (!valid) missing.push({ reference, locations: [...new Set(locations)] });
}

console.log(JSON.stringify({
  filesScanned: files.length,
  uniqueReferences: references.size,
  missingCount: missing.length,
  missing
}, null, 2));

if (missing.length) process.exitCode = 1;
