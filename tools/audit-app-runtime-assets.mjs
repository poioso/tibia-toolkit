import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Source-level release gate for the desktop runtime.  Electron intentionally
// excludes assets from the installer and installs them through the immutable
// content pack, so a normal `files` listing cannot prove media completeness.
// This audit verifies the pack contract, every literal runtime asset reference
// and the dynamic spell media catalogue without creating a release artefact.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = path.join(root, "assets");
const reportDirectory = path.join(root, ".local", "audits");
const reportPath = path.join(reportDirectory, "app-runtime-assets-audit.json");
const issues = [];
const checked = { literalReferences: 0, assetFiles: 0, imageFiles: 0, webpStoredWithPngExtension: 0, spells: 0, librarySprites: 0, bookImages: 0, proficiencyIcons: 0, intentionallyExcluded: 0 };
const allowedExtensions = new Set([".css", ".gif", ".html", ".jpg", ".js", ".json", ".md", ".ogg", ".png", ".svg", ".webp"]);
const imageExtensions = new Set([".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const runtimeAssetExceptions = new Set([
  "assets/tibia-client/organized/client-ui/images/taskboard/icon-weeklytasks.png",
  "assets/tibia-client/organized/objects/items/painting-equipment/artist-s-palette--item-3133.png"
]);
const externalWindowFiles = new Set([
  "desktop/supporters-showcase.html",
  "desktop/window-move-handle.html",
  "desktop/screenshot-assistant.html",
  "desktop/screenshot-assistant.js"
]);

// Keep runtime-generated paths explicit. A source scan cannot see these as
// literal references because the renderer path is assembled with path.join().
// This list is intentionally small and limited to bootstrap/UI assets that
// must remain available even when the rest of the asset tree is reorganized.
const dynamicAssetContracts = [
  { reference: "assets/ui/Tick.png", location: "desktop/main.js:buildAppCloseChoiceDialogHtml" },
  { reference: "assets/ui/Cross.png", location: "desktop/main.js:buildAppCloseChoiceDialogHtml" },
  { reference: "assets/ui/desktop-controls/desktop-minimize-idle.png", location: "desktop/main.js:buildAppCloseChoiceDialogHtml" },
  { reference: "assets/ui/desktop-controls/desktop-minimize-active.png", location: "desktop/main.js:buildAppCloseChoiceDialogHtml" },
  { reference: "assets/ui/desktop-controls/desktop-close-idle.png", location: "desktop/main.js:buildAppCloseChoiceDialogHtml" },
  { reference: "assets/ui/desktop-controls/desktop-close-active.png", location: "desktop/main.js:buildAppCloseChoiceDialogHtml" }
];

async function exists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function normalizeReference(value) {
  return String(value || "")
    .replaceAll("\\", "/")
    .replace(/[?#].*$/, "")
    .replace(/^\.\//, "")
    .trim();
}

async function detectImageFormat(file) {
  const contents = await fs.readFile(file);
  if (contents.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ".png";
  if (["GIF87a", "GIF89a"].includes(contents.subarray(0, 6).toString("ascii"))) return ".gif";
  if (contents.length >= 4 && contents[0] === 0xff && contents[1] === 0xd8 && contents.at(-2) === 0xff && contents.at(-1) === 0xd9) return ".jpg";
  if (contents.subarray(0, 4).toString("ascii") === "RIFF" && contents.subarray(8, 12).toString("ascii") === "WEBP") return ".webp";
  if (/<svg(?:\s|>)/i.test(contents.subarray(0, 2048).toString("utf8"))) return ".svg";
  return "";
}

const builder = JSON.parse(await fs.readFile(path.join(root, "desktop", "electron-builder.json"), "utf8"));
if (!Array.isArray(builder.files) || !builder.files.includes("!assets/**/*")) {
  issues.push({ kind: "installer-contract", detail: "A exclusao intencional de assets do instalador mudou." });
}
const contentBuilder = await fs.readFile(path.join(root, "tools", "build-content-pack.mjs"), "utf8");
if (!contentBuilder.includes('archive.addLocalFolder(path.join(projectRoot, "assets"), "assets"')) {
  issues.push({ kind: "content-pack-contract", detail: "O gerador nao inclui a arvore assets completa." });
}

const allAssets = await walk(assetsRoot);
for (const file of allAssets) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (relative.startsWith("assets/tibia-client/organized/") && !runtimeAssetExceptions.has(relative)) continue;
  const extension = path.extname(file).toLowerCase();
  if (imageExtensions.has(extension)) {
    checked.imageFiles += 1;
    const detectedFormat = await detectImageFormat(file);
    if (!detectedFormat) {
      issues.push({ kind: "invalid-image-signature", file: relative, extension });
    } else if (extension === ".png" && detectedFormat === ".webp") {
      // TibiaData serves animated WebP bytes from an extensionless endpoint.
      // The historical local bundle stores them under numeric .png names;
      // Chromium and Pillow decode by content, and changing all public paths
      // would break old content packs. Keep this compatibility alias explicit.
      checked.webpStoredWithPngExtension += 1;
    } else if (!(detectedFormat === extension || (detectedFormat === ".jpg" && extension === ".jpeg"))) {
      issues.push({ kind: "image-extension-content-mismatch", file: relative, extension, detectedFormat });
    }
  }
  // These entries are deliberately omitted by the content pack builder.  A
  // runtime reference to one would still be caught by the literal-reference
  // scan below, but their mere presence in the source tree is not a failure.
  if (path.basename(file) === ".gitkeep" || extension === ".jpeg") {
    checked.intentionallyExcluded += 1;
    if (extension === ".jpeg") {
      const jpgTwin = file.slice(0, -5) + ".jpg";
      const [jpegContents, jpgContents] = await Promise.all([
        fs.readFile(file),
        fs.readFile(jpgTwin).catch(() => null)
      ]);
      if (!jpgContents || !jpegContents.equals(jpgContents)) {
        issues.push({ kind: "jpeg-runtime-alias-missing", file: relative, expectedTwin: path.relative(root, jpgTwin).replaceAll("\\", "/") });
      }
    }
    continue;
  }
  if (!allowedExtensions.has(extension)) issues.push({ kind: "unsupported-extension", file: relative, extension });
  checked.assetFiles += 1;
  if (!(await exists(file))) issues.push({ kind: "empty-or-missing-asset", file: relative });
}

const sourceFiles = [
  path.join(root, "app.js"),
  path.join(root, "styles.css"),
  path.join(root, "index.html"),
  ...(await walk(path.join(root, "desktop"))).filter((file) => /\.(?:c?js|json|css|html)$/i.test(file)),
  ...(await walk(path.join(root, "lib"))).filter((file) => /\.(?:c?js|json|css|html)$/i.test(file)),
];
const references = new Map();
const referencePattern = /(?:\/?assets\/[^\s"'`<>]+?\.(?:json|html|jpeg|webp|css|gif|jpg|ogg|png|svg|md|js))(?:[?#][^\s"'`<>]*)?/gi;
for (const file of sourceFiles) {
  const source = await fs.readFile(file, "utf8");
  const relativeSourcePath = path.relative(root, file).replaceAll("\\", "/");
  if (externalWindowFiles.has(relativeSourcePath) && /(?:\.\.\/)+assets\//.test(source)) {
    issues.push({
      kind: "external-window-relative-asset-path",
      file: relativeSourcePath,
      detail: "Janelas externas precisam usar tibiatoolkit://app/assets/...; caminhos relativos apontam para o bootstrap do instalador."
    });
  }
  for (const match of source.matchAll(referencePattern)) {
    const reference = normalizeReference(match[0]).replace(/^\//, "");
    if (!reference.startsWith("assets/")) continue;
    // Templates that deliberately interpolate a filename are validated by the
    // focused catalogue audits below; only literal filesystem paths belong in
    // this check.
    if (/[${}]/.test(reference)) continue;
    const locations = references.get(reference) || [];
    locations.push(path.relative(root, file).replaceAll("\\", "/"));
    references.set(reference, locations);
  }
}
for (const [reference, locations] of references) {
  checked.literalReferences += 1;
  if (!(await exists(path.join(root, reference)))) {
    issues.push({ kind: "literal-reference-missing", reference, locations: [...new Set(locations)] });
  }
}

for (const contract of dynamicAssetContracts) {
  if (!(await exists(path.join(root, contract.reference)))) {
    issues.push({
      kind: "dynamic-reference-missing",
      reference: contract.reference,
      locations: [contract.location]
    });
  }
}

const spells = JSON.parse(await fs.readFile(path.join(assetsRoot, "data", "spells.detailed.json"), "utf8"));
for (const spell of spells.records || []) {
  checked.spells += 1;
  for (const candidate of [spell.icon, spell.animation?.localPath]) {
    if (!candidate) continue;
    const relative = normalizeReference(candidate)
      .replace(/^\/library\/spells\//, "assets/data/spells/")
      .replace(/^library\/spells\//, "assets/data/spells/");
    if (!(await exists(path.join(root, relative)))) {
      issues.push({ kind: "spell-media-missing", spell: spell.id, reference: relative });
    }
  }
}

const spritePaths = JSON.parse(await fs.readFile(path.join(assetsRoot, "data", "library-sprite-paths.json"), "utf8"));
for (const kind of ["creatures", "npcs"]) {
  for (const [slug, extension] of Object.entries(spritePaths[kind] || {})) {
    checked.librarySprites += 1;
    const relative = `assets/data/${kind}/${slug}.${extension}`;
    if (!(await exists(path.join(root, relative)))) {
      issues.push({ kind: "library-sprite-missing", entityKind: kind, slug, reference: relative });
    }
  }
}

const canonical = JSON.parse(await fs.readFile(path.join(assetsRoot, "data", "site-library-canonical.json"), "utf8"));
const localBookImage = (source) => {
  const remoteFilename = decodeURIComponent(String(source || "").split("/").at(-1) || "book.gif").replace(/^arquivo:/i, "").replace(/[?#].*$/, "");
  const extension = remoteFilename.match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase() || ".gif";
  const filename = remoteFilename.slice(0, -extension.length).toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `assets/data/books-documents/images/${filename || "book"}${extension}`;
};
for (const book of canonical.records?.books || []) {
  const sources = [book.image, ...(book.appearances || []).map((appearance) => appearance.source || appearance.image)].filter(Boolean);
  for (const source of sources) {
    checked.bookImages += 1;
    const relative = localBookImage(source);
    if (!(await exists(path.join(root, relative)))) {
      issues.push({ kind: "book-image-missing", slug: book.slug, source, reference: relative });
    }
  }
}
for (const item of canonical.records?.items || []) {
  for (const tier of item.profile?.proficiency || []) {
    for (const option of tier.options || []) {
      for (const image of option.images || []) {
        const filename = String(image?.src || image?.url || image || "").split("/").filter(Boolean).at(-1);
        if (!filename) continue;
        checked.proficiencyIcons += 1;
        const relative = `assets/data/item-proficiency-icons/${filename}`;
        if (!(await exists(path.join(root, relative)))) {
          issues.push({ kind: "proficiency-icon-missing", item: item.slug, reference: relative });
        }
      }
    }
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  passed: issues.length === 0,
  checked,
  issues
};
await fs.mkdir(reportDirectory, { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify(result, null, 2));
console.error(`[audit-app-runtime-assets] relatório salvo em ${path.relative(root, reportPath).replaceAll("\\", "/")}`);
if (!result.passed) process.exitCode = 1;
