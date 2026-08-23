import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(root, "tools", "content-pack-contract.json");
const extensions = new Set([".js", ".mjs", ".cjs", ".css", ".html", ".json"]);
const requiredAssetReferences = [
  "assets/ui/Tick.png",
  "assets/ui/Cross.png",
  "assets/ui/tutorial/update.gif",
  "assets/ui/tutorial/openscreenshotfolder.png",
  "assets/ui/tutorial/uncheck.png",
  "assets/ui/tutorial/folder.gif",
  "assets/ui/tutorial/folder-inactive.png",
  "assets/ui/tutorial/polaroid.gif",
  "assets/ui/tutorial/polaroid-inactive.png",
  "assets/ui/tutorial/Dustbin.gif",
  "assets/ui/tutorial/balao-interrogacao.gif",
  "assets/ui/tools/tibia-eye/buy-me-a-coffee/pix-qr.png"
];

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

function normalize(value) {
  return String(value || "").replaceAll("\\", "/").replace(/[?#].*$/, "").replace(/^(?:\.\.\/|\.\/)+/, "");
}

const sourceFiles = [];
for (const entry of ["app.js", "index.html", "styles.css", "desktop", "lib"]) {
  const target = path.join(root, entry);
  try {
    const stat = await fs.stat(target);
    if (stat.isFile()) sourceFiles.push(target); else sourceFiles.push(...await collect(target));
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
}

const references = new Set();
const assetPattern = /((?:\.\.?\/)?assets\/[^"'`\s)<>]+?\.(?:json|html|jpeg|webp|css|gif|jpg|ogg|png|svg|md|js))/gi;
for (const sourceFile of sourceFiles) {
  const source = await fs.readFile(sourceFile, "utf8");
  for (const match of source.matchAll(assetPattern)) {
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

const allReferences = [...new Set([...references, ...requiredAssetReferences])].sort();
const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const contract = {
  version: 2,
  generatedForAppVersion: packageJson.version,
  sourceFiles: sourceFiles.map((file) => path.relative(root, file).replaceAll("\\", "/")).sort(),
  staticAssetReferences: [...references].sort(),
  dynamicAssetReferences: requiredAssetReferences,
  requiredAssetReferences: allReferences,
  notes: "Gerado sobre app.js, index.html, styles.css, desktop e lib. O ZIP imutavel e a origem completa de desenvolvimento sao os gates de existencia dos assets."
};
await fs.writeFile(outputPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, sourceFiles: sourceFiles.length, staticReferences: references.size, requiredReferences: allReferences.length }, null, 2));
