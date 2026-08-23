import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { writeItemBundleRevisionManifest } from "./item-bundle-revisions.mjs";
import { getContentPackChunkGroup, isContentPackRuntimeAsset } from "../lib/content-pack/chunk-groups.js";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
const runtimeConfig = JSON.parse(await fs.readFile(path.join(projectRoot, "desktop", "app-config.json"), "utf8"));
const version = process.env.TIBIA_TOOLKIT_CONTENT_VERSION || packageJson.version;
const outputDir = path.join(projectRoot, "release", "content");
const archiveName = `tibia-toolkit-content-${version}.zip`;
const archivePath = path.join(outputDir, archiveName);
// Every published content pack must remain readable by the oldest supported
// thin installer. Keep this list in sync with its extractor allow-list.
const LEGACY_SAFE_ASSET_EXTENSIONS = new Set([
  ".css", ".gif", ".gitkeep", ".html", ".jpg", ".js", ".json",
  ".md", ".ogg", ".png", ".svg", ".webp"
]);
// Extraction/reference material is not loaded by the desktop runtime and can
// contain file types unsupported by already-installed thin clients.
const configuredTargets = Array.isArray(runtimeConfig.contentPackDistributionTargets)
  ? runtimeConfig.contentPackDistributionTargets
  : [];
const manifestTargets = configuredTargets.length > 0
  ? configuredTargets
  : (Array.isArray(runtimeConfig.contentPackManifestUrls)
    ? runtimeConfig.contentPackManifestUrls
    : [runtimeConfig.contentPackManifestUrl]
  ).map((manifestUrl, index) => ({
    id: `host-${index + 1}`,
    baseUrl: String(manifestUrl || "").replace(/\/latest\.json(?:\?.*)?$/i, "")
  }));
const overrideBaseUrl = String(process.env.TIBIA_TOOLKIT_CONTENT_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");

if (overrideBaseUrl) {
  manifestTargets.splice(0, manifestTargets.length, { id: "override", baseUrl: overrideBaseUrl });
}

if (manifestTargets.length === 0 || manifestTargets.some((target) => !/^https?:\/\//i.test(String(target?.baseUrl || "")))) {
  throw new Error("Defina contentPackDistributionTargets ou TIBIA_TOOLKIT_CONTENT_BASE_URL.");
}

async function buildChunkArchives(sourceArchive) {
  const byGroup = new Map();
  for (const entry of sourceArchive.getEntries().filter((entry) => !entry.isDirectory)) {
    const group = getContentPackChunkGroup(entry.entryName);
    const entries = byGroup.get(group) || [];
    entries.push(entry);
    byGroup.set(group, entries);
  }

  const chunks = [];
  for (const [id, entries] of [...byGroup.entries()].sort(([left], [right]) => left.localeCompare(right, "en"))) {
    const chunkArchive = new AdmZip();
    for (const entry of entries) chunkArchive.addFile(entry.entryName, entry.getData());
    const chunkName = `tibia-toolkit-content-${version}-${id}.zip`;
    const chunkPath = path.join(outputDir, chunkName);
    chunkArchive.writeZip(chunkPath);
    const contents = await fs.readFile(chunkPath);
    chunks.push({
      id,
      archiveName: chunkName,
      sha256: crypto.createHash("sha256").update(contents).digest("hex"),
      bytes: contents.byteLength,
      unpackedBytes: entries.reduce((total, entry) => total + Number(entry.header.size || 0), 0),
      entries: entries.length
    });
  }
  return chunks;
}

await fs.mkdir(outputDir, { recursive: true });

// The runtime only reads this tiny manifest during boot. Generate it from the
// actual large item bundles immediately before archiving so cache invalidation
// never depends on parsing tens of megabytes during startup.
await writeItemBundleRevisionManifest();

const archiveAlreadyExists = await fs.stat(archivePath).then(() => true).catch(() => false);
if (archiveAlreadyExists) {
  throw new Error(
    `O pacote ${archiveName} ja existe. Use uma nova TIBIA_TOOLKIT_CONTENT_VERSION; pacotes versionados sao imutaveis.`
  );
}

const archive = new AdmZip();
archive.addLocalFolder(path.join(projectRoot, "assets"), "assets", (filePath) => {
  const relativePath = path.relative(projectRoot, filePath).replaceAll("\\", "/");
  // .jpeg was introduced after early thin clients shipped. The matching .jpg
  // asset is packaged instead, so an old client can still bootstrap safely.
  return isContentPackRuntimeAsset(relativePath);
});

const incompatibleEntries = archive
  .getEntries()
  .filter((entry) => !entry.isDirectory)
  .map((entry) => entry.entryName)
  .filter((entryName) => !LEGACY_SAFE_ASSET_EXTENSIONS.has(path.extname(entryName).toLowerCase()));

if (incompatibleEntries.length > 0) {
  throw new Error(
    `O pacote possui extensoes incompativeis com clientes publicados: ${incompatibleEntries.join(", ")}`
  );
}
archive.writeZip(archivePath);

// Read every entry back from the exact ZIP that will be published. AdmZip
// validates entry metadata/CRC while extracting, catching truncated or
// unreadable packaged files before an installer can reference the archive.
const packagedArchive = new AdmZip(archivePath);
for (const entry of packagedArchive.getEntries().filter((candidate) => !candidate.isDirectory)) {
  const unpacked = entry.getData();
  if (unpacked.byteLength !== Number(entry.header.size || 0)) {
    throw new Error(`Entrada ilegivel no pacote: ${entry.entryName}`);
  }
}

const contents = await fs.readFile(archivePath);
const checksum = crypto.createHash("sha256").update(contents).digest("hex");
const unpackedBytes = archive
  .getEntries()
  .filter((entry) => !entry.isDirectory)
  .reduce((total, entry) => total + Number(entry.header.size || 0), 0);
const chunks = await buildChunkArchives(archive);

for (const [index, target] of manifestTargets.entries()) {
  const id = String(target.id || `host-${index + 1}`).replace(/[^a-z0-9_-]/gi, "-");
  const manifest = {
    version,
    archiveUrl: `${String(target.baseUrl).trim().replace(/\/$/, "")}/${archiveName}`,
    sha256: checksum,
    bytes: contents.byteLength,
    unpackedBytes,
    notes: "Pacote de conteudo do Tibia Toolkit",
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      archiveUrl: `${String(target.baseUrl).trim().replace(/\/$/, "")}/${chunk.archiveName}`,
      sha256: chunk.sha256,
      bytes: chunk.bytes,
      unpackedBytes: chunk.unpackedBytes,
      entries: chunk.entries
    }))
  };
  const targetDir = path.join(outputDir, "manifests", id);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  if (index === 0) {
    await fs.writeFile(path.join(outputDir, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
}
console.log(`Pacote criado: ${archivePath}`);
console.log(`Pacotes por grupo: ${chunks.length}`);
console.log(`Manifesto: ${path.join(outputDir, "latest.json")}`);
console.log(`Manifestos por host: ${path.join(outputDir, "manifests")}`);
