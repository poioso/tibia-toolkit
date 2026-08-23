import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] || path.resolve(import.meta.dirname, ".."));
const assetRoot = path.resolve(process.env.TIBIA_TOOLKIT_ASSET_SOURCE || path.join(root, "assets"));
const strictAssets = process.argv.includes("--strict-assets");
const sourceExtensions = new Set([".js", ".mjs", ".cjs", ".css", ".html", ".json"]);
const issues = [];
const contentPackAssets = new Set();

async function exists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function collect(directory) {
  const output = [];
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return output;
    throw error;
  }
  for (const entry of entries) {
    if (["node_modules", "bin", "obj", "publish", "dist", ".git", ".local"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await collect(full));
    else if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) output.push(full);
  }
  return output;
}

function clean(value) {
  return String(value || "").split(/[?#]/, 1)[0].replaceAll("\\", "/");
}

function localTarget(raw, sourceFile) {
  const value = clean(raw);
  if (!value || /^(?:[a-z]+:|data:|#|\\\\)/i.test(value)) return null;
  if (value.startsWith("assets/")) return { kind: "asset", path: path.join(assetRoot, value.slice("assets/".length)), reference: value };
  if (value.startsWith("../assets/")) return { kind: "asset", path: path.join(assetRoot, value.slice("../assets/".length)), reference: `assets/${value.slice("../assets/".length)}` };
  if (value.startsWith("/assets/")) return { kind: "asset", path: path.join(assetRoot, value.slice("/assets/".length)), reference: value.slice(1) };
  if (value.startsWith("desktop/") || value.startsWith("lib/") || value.startsWith("app.js") || value.startsWith("index.html") || value.startsWith("styles.css")) {
    return { kind: "module", path: path.join(root, value), reference: value };
  }
  if (value.startsWith("./") || value.startsWith("../")) return { kind: "module", path: path.resolve(path.dirname(sourceFile), value), reference: value };
  return null;
}

async function resolveModule(candidate) {
  try {
    const stat = await fs.stat(candidate);
    if (stat.isDirectory()) return candidate;
  } catch {}
  const options = [candidate, `${candidate}.js`, `${candidate}.mjs`, `${candidate}.cjs`, `${candidate}.json`, `${candidate}.css`, `${candidate}.html`];
  for (const option of options) if (await exists(option)) return option;
  for (const extension of [".js", ".mjs", ".cjs", ".json", ".css", ".html"]) {
    if (await exists(path.join(candidate, `index${extension}`))) return path.join(candidate, `index${extension}`);
  }
  return null;
}

function addReference(raw, sourceFile, kind) {
  const target = localTarget(raw, sourceFile);
  if (!target) return;
  if (/[${}]/.test(String(raw)) || /(?:node_modules|third_party|\.local|auth-homologation\.local\.json|(?:^|[\\/])(?:bin|obj|publish)(?:[\\/]|$))/.test(String(raw))) return;
  target.kind = kind === "asset" ? "asset" : target.kind;
  pending.push({ ...target, sourceFile, raw });
}

const sourceFiles = [];
for (const entry of ["app.js", "index.html", "styles.css", "desktop", "lib"]) {
  const candidate = path.join(root, entry);
  try {
    const stat = await fs.stat(candidate);
    if (stat.isFile()) sourceFiles.push(candidate);
    else sourceFiles.push(...await collect(candidate));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const pending = [];
for (const sourceFile of sourceFiles) {
  const source = await fs.readFile(sourceFile, "utf8");
  const patterns = [
    /(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bloadFile\s*\(\s*["'`]([^"'`]+)["'`]/g,
    /\b(?:preload|src|href)\s*[:=]\s*["'`]([^"'`]+)["'`]/g,
    /\burl\(\s*["']?([^"')]+)["']?\s*\)/g,
    /["'`]((?:\.\.?\/)?assets\/[^"'`?#]+)["'`]/g
  ];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) addReference(match[1], sourceFile, String(match[1]).includes("assets/") ? "asset" : "module");
  for (const match of source.matchAll(/\bpath\.join\(([^)\n]+)\)/g)) {
    const expression = match[1];
    if (!/(?:__dirname|projectRoot|^\s*["'`]assets["'`])/.test(expression)) continue;
    const parts = [...expression.matchAll(/["'`]([^"'`]+)["'`]/g)].map((part) => part[1]);
    if (parts.length === 0) continue;
    const reference = parts.join("/");
    const hasAssetSegment = parts.includes("assets");
    const projectRootPath = /\bprojectRoot\b/.test(expression);
    const normalizedReference = hasAssetSegment
      ? `assets/${parts.slice(parts.indexOf("assets") + 1).join("/")}`
      : projectRootPath ? reference : `./${reference}`;
    addReference(normalizedReference, sourceFile, hasAssetSegment ? "asset" : "module");
  }
}

const seen = new Set();
for (const reference of pending) {
  const key = `${reference.kind}|${reference.path}`;
  if (seen.has(key)) continue;
  seen.add(key);
  if (reference.kind === "asset") {
    if (!(await exists(reference.path))) {
      contentPackAssets.add(reference.reference);
      if (strictAssets) issues.push({ kind: "missing-asset", reference: reference.reference, source: path.relative(root, reference.sourceFile) });
    }
    continue;
  }
  if (!(await resolveModule(reference.path))) issues.push({ kind: "missing-module", reference: reference.raw, source: path.relative(root, reference.sourceFile) });
}

const result = {
  root,
  assetRoot,
  sourceFiles: sourceFiles.length,
  references: pending.length,
  contentPackAssets: [...contentPackAssets].sort(),
  issues
};
console.log(JSON.stringify(result, null, 2));
if (issues.length > 0) process.exitCode = 1;
