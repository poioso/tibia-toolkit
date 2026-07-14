import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";

const MANIFEST_FILE = "content-manifest.json";
const REMOTE_REQUEST_TIMEOUT_MS = 8_000;
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 25_000;
const MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;
const ALLOWED_ASSET_EXTENSIONS = new Set([
  ".gif",
  ".gitkeep",
  ".jpg",
  ".json",
  ".md",
  ".ogg",
  ".png",
  ".svg",
  ".webp"
]);

function normalizeUrlList(values = []) {
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || "").trim())
    .filter((value, index, list) => /^https:\/\//i.test(value) && list.indexOf(value) === index);
}

async function fetchWithResponseTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeManifest(raw, sourceUrl) {
  const version = String(raw?.version || "").trim();
  const archiveUrl = String(raw?.archiveUrl || raw?.url || "").trim();
  const sha256 = String(raw?.sha256 || "").trim().toLowerCase();
  const bytes = Number(raw?.bytes || 0);

  if (
    !version
    || !/^https:\/\//i.test(archiveUrl)
    || !/^[a-f0-9]{64}$/.test(sha256)
    || !Number.isFinite(bytes)
    || bytes <= 0
    || bytes > MAX_ARCHIVE_BYTES
  ) {
    throw new Error(`Manifesto de conteudo invalido: ${sourceUrl}`);
  }

  return {
    version,
    archiveUrl,
    sha256,
    bytes: Math.round(bytes),
    notes: String(raw?.notes || "").trim(),
    sourceUrl
  };
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function fetchManifestCandidates(urls) {
  const manifests = [];
  let lastError = null;

  for (const url of normalizeUrlList(urls)) {
    try {
      const response = await fetchWithResponseTimeout(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      manifests.push(normalizeManifest(await response.json(), url));
    } catch (error) {
      lastError = error;
    }
  }

  if (manifests.length === 0) {
    throw new Error(`Nao foi possivel consultar o pacote de conteudo. ${lastError?.message || ""}`.trim());
  }

  return manifests;
}

async function downloadArchive(manifest, archivePath, onProgress) {
  const response = await fetchWithResponseTimeout(manifest.archiveUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Nao foi possivel baixar os assets (HTTP ${response.status}).`);
  }

  const total = Number(response.headers.get("content-length")) || manifest.bytes || 0;
  if (total > MAX_ARCHIVE_BYTES) {
    throw new Error("O pacote de conteudo excede o limite permitido.");
  }
  const reader = response.body.getReader();
  const file = await fs.open(archivePath, "w");
  const checksum = crypto.createHash("sha256");
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      await file.write(value);
      checksum.update(value);
      received += value.byteLength;
      if (received > MAX_ARCHIVE_BYTES) {
        throw new Error("O pacote de conteudo excede o limite permitido.");
      }
      onProgress?.({ phase: "download", received, total });
    }
  } finally {
    await file.close();
  }

  if (checksum.digest("hex") !== manifest.sha256) {
    throw new Error("A verificacao de seguranca do pacote de conteudo falhou.");
  }

  if (received !== manifest.bytes) {
    throw new Error("O tamanho do pacote de conteudo nao corresponde ao manifesto.");
  }
}

async function extractArchive(archivePath, destination) {
  const archive = new AdmZip(archivePath);
  const entries = archive.getEntries();
  if (entries.length === 0 || entries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error("O pacote de conteudo possui uma quantidade invalida de arquivos.");
  }
  if (!entries.some((entry) => entry.entryName.startsWith("assets/"))) {
    throw new Error("O pacote de conteudo nao possui a pasta assets.");
  }

  let uncompressedBytes = 0;
  const destinationRoot = path.resolve(destination);

  for (const entry of entries) {
    const normalizedName = entry.entryName.replaceAll("\\", "/");
    if (
      !normalizedName
      || normalizedName.startsWith("/")
      || normalizedName.includes("../")
      || (!entry.isDirectory && !normalizedName.startsWith("assets/"))
    ) {
      throw new Error("O pacote de conteudo possui um caminho invalido.");
    }

    const outputPath = path.resolve(destination, normalizedName);
    if (!outputPath.startsWith(`${destinationRoot}${path.sep}`)) {
      throw new Error("O pacote de conteudo tentou sair do diretorio permitido.");
    }

    if (entry.isDirectory) {
      await fs.mkdir(outputPath, { recursive: true });
      continue;
    }

    const extension = path.extname(normalizedName).toLowerCase();
    if (!ALLOWED_ASSET_EXTENSIONS.has(extension)) {
      throw new Error(`O pacote de conteudo possui uma extensao nao permitida: ${extension || "(sem extensao)"}.`);
    }

    const data = entry.getData();
    uncompressedBytes += data.byteLength;
    if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new Error("O pacote de conteudo excede o limite de extracao permitido.");
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, data);
  }
}

export async function ensureContentPack({
  appIsPackaged,
  sourceAssetsRoot,
  userDataPath,
  manifestUrls = [],
  onStatus,
  onProgress
} = {}) {
  if (!appIsPackaged) {
    return { assetsRoot: sourceAssetsRoot, source: "development", version: "development" };
  }

  const packRoot = path.join(userDataPath, "content-pack");
  const currentRoot = path.join(packRoot, "current");
  const installedManifestPath = path.join(currentRoot, MANIFEST_FILE);
  const installedAssetsRoot = path.join(currentRoot, "assets");
  const installed = await readJson(installedManifestPath);
  const hasInstalledAssets = await fs
    .stat(installedAssetsRoot)
    .then((entry) => entry.isDirectory())
    .catch(() => false);
  let manifests = [];

  try {
    manifests = await fetchManifestCandidates(manifestUrls);
  } catch (error) {
    // A previously verified pack remains safe to use during a temporary outage.
    if (hasInstalledAssets) {
      return {
        assetsRoot: installedAssetsRoot,
        source: "cache-offline",
        version: String(installed?.version || "cached")
      };
    }
    throw error;
  }

  if (
    installed?.version
    && manifests.some((manifest) => (
      installed?.version === manifest.version
      && installed?.sha256 === manifest.sha256
    ))
    && hasInstalledAssets
  ) {
    return { assetsRoot: installedAssetsRoot, source: "cache", version: String(installed.version) };
  }

  const tempRoot = path.join(packRoot, `pending-${Date.now()}`);
  const backupRoot = path.join(packRoot, `previous-${Date.now()}`);
  const archivePath = path.join(packRoot, `content-${Date.now()}.zip`);
  let downloadedManifest = null;
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(tempRoot, { recursive: true });

  try {
    let lastDownloadError = null;

    for (const candidate of manifests) {
      try {
        onStatus?.({ phase: "downloading" });
        await downloadArchive(candidate, archivePath, onProgress);
        downloadedManifest = candidate;
        break;
      } catch (error) {
        lastDownloadError = error;
        await fs.rm(archivePath, { force: true });
      }
    }

    if (!downloadedManifest) {
      throw lastDownloadError || new Error("Nao foi possivel baixar os assets.");
    }

    onStatus?.({ phase: "verifying" });
    await extractArchive(archivePath, tempRoot);
    await fs.writeFile(path.join(tempRoot, MANIFEST_FILE), JSON.stringify(downloadedManifest, null, 2), "utf8");
    const hadPreviousPack = await fs
      .stat(currentRoot)
      .then(() => true)
      .catch(() => false);

    if (hadPreviousPack) {
      await fs.rm(backupRoot, { recursive: true, force: true });
      await fs.rename(currentRoot, backupRoot);
    }

    try {
      await fs.rename(tempRoot, currentRoot);
    } catch (swapError) {
      if (hadPreviousPack) {
        await fs.rename(backupRoot, currentRoot).catch(() => {});
      }
      throw swapError;
    }

    if (hadPreviousPack) {
      await fs.rm(backupRoot, { recursive: true, force: true });
    }
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    throw error;
  } finally {
    await fs.rm(archivePath, { force: true });
  }

  return { assetsRoot: installedAssetsRoot, source: "download", version: downloadedManifest.version };
}
