import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

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

await fs.mkdir(outputDir, { recursive: true });

const archiveAlreadyExists = await fs.stat(archivePath).then(() => true).catch(() => false);
if (archiveAlreadyExists) {
  throw new Error(
    `O pacote ${archiveName} ja existe. Use uma nova TIBIA_TOOLKIT_CONTENT_VERSION; pacotes versionados sao imutaveis.`
  );
}

const archive = new AdmZip();
archive.addLocalFolder(path.join(projectRoot, "assets"), "assets", (filePath) => {
  // .jpeg was introduced after early thin clients shipped. The matching .jpg
  // asset is packaged instead, so an old client can still bootstrap safely.
  return path.basename(filePath) !== ".gitkeep" && path.extname(filePath).toLowerCase() !== ".jpeg";
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

const contents = await fs.readFile(archivePath);
const checksum = crypto.createHash("sha256").update(contents).digest("hex");
const unpackedBytes = archive
  .getEntries()
  .filter((entry) => !entry.isDirectory)
  .reduce((total, entry) => total + Number(entry.header.size || 0), 0);

for (const [index, target] of manifestTargets.entries()) {
  const id = String(target.id || `host-${index + 1}`).replace(/[^a-z0-9_-]/gi, "-");
  const manifest = {
    version,
    archiveUrl: `${String(target.baseUrl).trim().replace(/\/$/, "")}/${archiveName}`,
    sha256: checksum,
    bytes: contents.byteLength,
    unpackedBytes,
    notes: "Pacote de conteudo do Tibia Toolkit"
  };
  const targetDir = path.join(outputDir, "manifests", id);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  if (index === 0) {
    await fs.writeFile(path.join(outputDir, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
}
console.log(`Pacote criado: ${archivePath}`);
console.log(`Manifesto: ${path.join(outputDir, "latest.json")}`);
console.log(`Manifestos por host: ${path.join(outputDir, "manifests")}`);
