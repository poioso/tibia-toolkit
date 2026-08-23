import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { getContentPackChunkGroup } from "../lib/content-pack/chunk-groups.js";

const MANIFEST_FILE = "content-manifest.json";
const PENDING_UPDATE_FILE = "pending-update.json";
const REMOTE_REQUEST_TIMEOUT_MS = 30_000;
const LEGACY_MANIFEST_TIMEOUT_MS = 5_000;
const DOWNLOAD_ATTEMPTS_PER_SOURCE = 3;
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 25_000;
const MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;
const DISK_SPACE_BUFFER_BYTES = 128 * 1024 * 1024;
const ALLOWED_ASSET_EXTENSIONS = new Set([
  ".css",
  ".gif",
  ".gitkeep",
  ".html",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".md",
  ".ogg",
  ".png",
  ".svg",
  ".webp"
]);
const ALLOWED_ASSET_DOTFILES = new Set([".gitkeep"]);

class ContentPackError extends Error {
  constructor(code, phase, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = "ContentPackError";
    this.code = code;
    this.phase = phase;
  }
}

function contentError(code, phase, message, cause = null) {
  if (cause instanceof ContentPackError) {
    return cause;
  }
  return new ContentPackError(code, phase, message, cause);
}

function normalizeUrlList(values = []) {
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || "").trim())
    .filter((value, index, list) => /^https:\/\//i.test(value) && list.indexOf(value) === index);
}

async function fetchWithResponseTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(Number(options.timeoutMs))
    ? Math.max(500, Number(options.timeoutMs))
    : REMOTE_REQUEST_TIMEOUT_MS;
  const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function getAllowedAssetExtension(assetPath) {
  const baseName = path.basename(assetPath).toLowerCase();
  if (ALLOWED_ASSET_DOTFILES.has(baseName)) {
    return baseName;
  }
  return path.extname(assetPath).toLowerCase();
}

function normalizeChunk(raw, sourceUrl) {
  const id = String(raw?.id || "").trim();
  const archiveUrl = String(raw?.archiveUrl || raw?.url || "").trim();
  const sha256 = String(raw?.sha256 || "").trim().toLowerCase();
  const bytes = Number(raw?.bytes || 0);
  const unpackedBytes = Number(raw?.unpackedBytes || 0);

  if (
    !/^[a-z0-9][a-z0-9-]{1,80}$/i.test(id)
    || !/^https:\/\//i.test(archiveUrl)
    || !/^[a-f0-9]{64}$/.test(sha256)
    || !Number.isFinite(bytes)
    || bytes <= 0
    || bytes > MAX_ARCHIVE_BYTES
  ) {
    throw contentError("CONTENT_MANIFEST_INVALID", "manifest", `Grupo de conteudo invalido: ${sourceUrl}`);
  }

  return {
    id,
    archiveUrl,
    sha256,
    bytes: Math.round(bytes),
    unpackedBytes: Number.isFinite(unpackedBytes) && unpackedBytes > 0
      ? Math.round(unpackedBytes)
      : null
  };
}

function normalizeManifest(raw, sourceUrl) {
  const version = String(raw?.version || "").trim();
  const archiveUrl = String(raw?.archiveUrl || raw?.url || "").trim();
  const sha256 = String(raw?.sha256 || "").trim().toLowerCase();
  const bytes = Number(raw?.bytes || 0);
  const unpackedBytes = Number(raw?.unpackedBytes || 0);

  if (
    !version
    || !/^https:\/\//i.test(archiveUrl)
    || !/^[a-f0-9]{64}$/.test(sha256)
    || !Number.isFinite(bytes)
    || bytes <= 0
    || bytes > MAX_ARCHIVE_BYTES
  ) {
    throw contentError("CONTENT_MANIFEST_INVALID", "manifest", `Manifesto de conteudo invalido: ${sourceUrl}`);
  }

  const chunks = Array.isArray(raw?.chunks)
    ? raw.chunks.map((chunk) => normalizeChunk(chunk, sourceUrl))
    : [];
  const seenChunkIds = new Set();
  for (const chunk of chunks) {
    if (seenChunkIds.has(chunk.id)) {
      throw contentError("CONTENT_MANIFEST_INVALID", "manifest", `Grupo de conteudo duplicado: ${sourceUrl}`);
    }
    seenChunkIds.add(chunk.id);
  }

  return {
    version,
    archiveUrl,
    sha256,
    bytes: Math.round(bytes),
    unpackedBytes: Number.isFinite(unpackedBytes) && unpackedBytes > 0
      ? Math.round(unpackedBytes)
      : null,
    notes: String(raw?.notes || "").trim(),
    chunks,
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

async function fetchManifestCandidates(urls, onDiagnostic, options = {}) {
  const manifests = [];
  let lastError = null;

  for (const url of normalizeUrlList(urls)) {
    try {
      const response = await fetchWithResponseTimeout(url, { timeoutMs: options.timeoutMs });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      manifests.push(normalizeManifest(await response.json(), url));
    } catch (error) {
      lastError = error;
      onDiagnostic?.({ phase: "manifest", url, error });
    }
  }

  if (manifests.length === 0) {
    throw contentError(
      "CONTENT_MANIFEST_UNAVAILABLE",
      "manifest",
      `Nao foi possivel consultar o pacote de conteudo. ${lastError?.message || ""}`.trim(),
      lastError
    );
  }

  return manifests;
}

async function getFileSize(filePath) {
  return fs.stat(filePath).then((entry) => entry.size).catch(() => 0);
}

async function updateChecksumFromFile(filePath, checksum, bytes) {
  if (bytes <= 0) {
    return;
  }

  const file = await fs.open(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let offset = 0;

  try {
    while (offset < bytes) {
      const length = Math.min(buffer.length, bytes - offset);
      const { bytesRead } = await file.read(buffer, 0, length, offset);
      if (bytesRead <= 0) {
        throw new Error("O arquivo parcial terminou antes do esperado.");
      }
      checksum.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
  } finally {
    await file.close();
  }
}

async function ensureFreeDiskSpace(packRoot, manifest, existingBytes = 0) {
  await fs.mkdir(packRoot, { recursive: true });

  let stats;
  try {
    stats = await fs.statfs(packRoot, { bigint: true });
  } catch {
    return;
  }

  const availableBytes = stats.bavail * stats.bsize;
  const remainingDownloadBytes = BigInt(Math.max(0, manifest.bytes - existingBytes));
  const expectedUnpackedBytes = BigInt(
    manifest.unpackedBytes || Math.ceil(manifest.bytes * 1.5)
  );
  const requiredBytes = remainingDownloadBytes
    + expectedUnpackedBytes
    + BigInt(DISK_SPACE_BUFFER_BYTES);

  if (availableBytes < requiredBytes) {
    const requiredMiB = Math.ceil(Number(requiredBytes) / (1024 * 1024));
    const availableMiB = Math.floor(Number(availableBytes) / (1024 * 1024));
    throw contentError(
      "CONTENT_DISK_SPACE",
      "preflight",
      `Espaco insuficiente para preparar os recursos. Necessario: ${requiredMiB} MB; disponivel: ${availableMiB} MB.`
    );
  }
}

function parseContentRangeStart(value) {
  const match = String(value || "").match(/^bytes\s+(\d+)-\d+\/\d+$/i);
  return match ? Number(match[1]) : null;
}

async function downloadArchive(manifest, archivePath, onProgress) {
  let existingBytes = await getFileSize(archivePath);
  if (existingBytes > manifest.bytes) {
    await fs.rm(archivePath, { force: true });
    existingBytes = 0;
  }

  await ensureFreeDiskSpace(path.dirname(archivePath), manifest, existingBytes);

  const headers = existingBytes > 0 ? { Range: `bytes=${existingBytes}-` } : {};
  let response;
  try {
    response = await fetchWithResponseTimeout(manifest.archiveUrl, { headers });
  } catch (error) {
    throw contentError("CONTENT_DOWNLOAD_NETWORK", "download", "A conexao com o pacote de conteudo foi interrompida.", error);
  }

  if (response.status === 416 && existingBytes === manifest.bytes) {
    response = null;
  } else if (!response?.ok || !response.body) {
    throw contentError(
      "CONTENT_DOWNLOAD_HTTP",
      "download",
      `Nao foi possivel baixar os recursos (HTTP ${response?.status || 0}).`
    );
  }

  let append = Boolean(response && existingBytes > 0 && response.status === 206);
  if (append && parseContentRangeStart(response.headers.get("content-range")) !== existingBytes) {
    throw contentError("CONTENT_DOWNLOAD_RANGE", "download", "O servidor respondeu com uma faixa de download invalida.");
  }
  if (response && response.status === 200) {
    append = false;
    existingBytes = 0;
  }

  const checksum = crypto.createHash("sha256");
  if (append || response === null) {
    await updateChecksumFromFile(archivePath, checksum, existingBytes);
  }

  let received = existingBytes;
  onProgress?.({ phase: "download", received, total: manifest.bytes });

  if (response) {
    const reader = response.body.getReader();
    const file = await fs.open(archivePath, append ? "a" : "w");

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        await file.write(value);
        checksum.update(value);
        received += value.byteLength;
        if (received > manifest.bytes || received > MAX_ARCHIVE_BYTES) {
          throw contentError("CONTENT_SIZE", "download", "O pacote de conteudo excede o tamanho declarado.");
        }
        onProgress?.({ phase: "download", received, total: manifest.bytes });
      }
    } catch (error) {
      throw contentError("CONTENT_DOWNLOAD_NETWORK", "download", "A conexao foi interrompida durante o download.", error);
    } finally {
      await file.close();
    }
  }

  if (received !== manifest.bytes) {
    throw contentError(
      "CONTENT_DOWNLOAD_INCOMPLETE",
      "download",
      `O download terminou incompleto (${received} de ${manifest.bytes} bytes).`
    );
  }

  if (checksum.digest("hex") !== manifest.sha256) {
    await fs.rm(archivePath, { force: true });
    throw contentError("CONTENT_CHECKSUM", "verify", "A verificacao de seguranca do pacote de conteudo falhou.");
  }
}

async function extractArchive(archivePath, destination, { expectedChunkId = null } = {}) {
  let archive;
  try {
    archive = new AdmZip(archivePath);
  } catch (error) {
    throw contentError("CONTENT_EXTRACT", "extract", "Nao foi possivel abrir o pacote de conteudo.", error);
  }

  const entries = archive.getEntries();
  if (entries.length === 0 || entries.length > MAX_ARCHIVE_ENTRIES) {
    throw contentError("CONTENT_EXTRACT", "extract", "O pacote possui uma quantidade invalida de arquivos.");
  }
  if (!entries.some((entry) => entry.entryName.startsWith("assets/"))) {
    throw contentError("CONTENT_EXTRACT", "extract", "O pacote nao possui a pasta assets.");
  }

  let uncompressedBytes = 0;
  const destinationRoot = path.resolve(destination);

  try {
    for (const entry of entries) {
      const normalizedName = entry.entryName.replaceAll("\\", "/");
      if (
        !normalizedName
        || normalizedName.startsWith("/")
        || normalizedName.includes("../")
        || (!entry.isDirectory && !normalizedName.startsWith("assets/"))
      ) {
        throw new Error("O pacote possui um caminho invalido.");
      }
      if (!entry.isDirectory && expectedChunkId && getContentPackChunkGroup(normalizedName) !== expectedChunkId) {
        throw new Error(`O grupo ${expectedChunkId} possui um arquivo fora do seu escopo.`);
      }

      const outputPath = path.resolve(destination, normalizedName);
      if (!outputPath.startsWith(`${destinationRoot}${path.sep}`)) {
        throw new Error("O pacote tentou sair do diretorio permitido.");
      }

      if (entry.isDirectory) {
        await fs.mkdir(outputPath, { recursive: true });
        continue;
      }

      const extension = getAllowedAssetExtension(normalizedName);
      if (!ALLOWED_ASSET_EXTENSIONS.has(extension)) {
        throw new Error(`Extensao nao permitida: ${extension || "(sem extensao)"}.`);
      }

      const data = entry.getData();
      uncompressedBytes += data.byteLength;
      if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
        throw new Error("O pacote excede o limite de extracao permitido.");
      }

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, data);
    }
  } catch (error) {
    const code = error?.code === "ENOSPC" ? "CONTENT_DISK_SPACE" : "CONTENT_EXTRACT";
    throw contentError(code, "extract", "Nao foi possivel extrair os recursos.", error);
  }
}

async function listFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await walk(root);
  return files;
}

async function overlayVerifiedChunk(stageRoot, currentRoot, rollbackRoot, applied = []) {
  const stagedAssets = path.join(stageRoot, "assets");
  const targetAssets = path.join(currentRoot, "assets");
  const files = await listFiles(stagedAssets);
  for (const source of files) {
    const relative = path.relative(stagedAssets, source);
    const target = path.resolve(targetAssets, relative);
    const allowedRoot = path.resolve(targetAssets);
    if (!target.startsWith(`${allowedRoot}${path.sep}`)) throw new Error("O grupo tentou sair dos recursos permitidos.");

    const backup = path.join(rollbackRoot, relative);
    const existed = await fs.stat(target).then((entry) => entry.isFile()).catch(() => false);
    if (existed) {
      await fs.mkdir(path.dirname(backup), { recursive: true });
      await fs.copyFile(target, backup);
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
    applied.push({ target, backup, existed });
  }
  return applied;
}

async function rollbackOverlay(applied) {
  for (const entry of [...applied].reverse()) {
    if (entry.existed) await fs.copyFile(entry.backup, entry.target).catch(() => {});
    else await fs.rm(entry.target, { force: true }).catch(() => {});
  }
}

function changedChunks(installedManifest, nextManifest) {
  if (!Array.isArray(installedManifest?.chunks) || !Array.isArray(nextManifest?.chunks)) return null;
  const previous = new Map(installedManifest.chunks.map((chunk) => [String(chunk?.id || ""), String(chunk?.sha256 || "").toLowerCase()]));
  return nextManifest.chunks.filter((chunk) => previous.get(chunk.id) !== chunk.sha256);
}

async function applyPendingChunkUpdate({ packRoot, currentRoot, installedManifest, pending, onStatus, onProgress }) {
  const nextManifest = normalizeManifest(pending?.manifest, "pending-local");
  const chunks = changedChunks(installedManifest, nextManifest);
  if (!chunks || chunks.length === 0) return false;

  const pendingRoot = path.join(packRoot, "pending");
  const transactionRoot = path.join(packRoot, `transaction-${Date.now()}`);
  const rollbackRoot = path.join(transactionRoot, "rollback");
  const applied = [];
  await fs.mkdir(transactionRoot, { recursive: true });

  try {
    for (const chunk of chunks) {
      const archivePath = path.join(pendingRoot, `${chunk.sha256}.zip`);
      const stat = await fs.stat(archivePath).catch(() => null);
      if (!stat || stat.size !== chunk.bytes) throw new Error(`Grupo pendente ausente ou incompleto: ${chunk.id}`);
      const stageRoot = path.join(transactionRoot, "stage", chunk.id);
      onStatus?.({ phase: "verifying" });
      await extractArchive(archivePath, stageRoot, { expectedChunkId: chunk.id });
      await overlayVerifiedChunk(stageRoot, currentRoot, path.join(rollbackRoot, chunk.id), applied);
      onProgress?.({ phase: "apply", received: chunk.bytes, total: chunk.bytes });
    }
    await fs.writeFile(path.join(currentRoot, MANIFEST_FILE), JSON.stringify(nextManifest, null, 2), "utf8");
    await fs.rm(path.join(packRoot, PENDING_UPDATE_FILE), { force: true });
    await fs.rm(pendingRoot, { recursive: true, force: true });
    return true;
  } catch (error) {
    await rollbackOverlay(applied);
    throw contentError("CONTENT_ACTIVATE", "activate", "Nao foi possivel ativar a atualizacao pendente.", error);
  } finally {
    await fs.rm(transactionRoot, { recursive: true, force: true });
  }
}

function waitBeforeRetry(attempt) {
  return new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
}

export async function ensureContentPack({
  appIsPackaged,
  sourceAssetsRoot,
  userDataPath,
  manifestUrls = [],
  onStatus,
  onProgress,
  onDiagnostic
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
  // Content Packs generated before the chunk manifest was introduced are
  // valid archives, but they are not safe to trust as the active cache: they
  // cannot be incrementally compared and may be missing assets added later.
  // Keep modern caches on the fast path, while forcing a complete manifest
  // check/download for this legacy format.
  const isLegacyInstalledPack = Boolean(
    installed?.version
      && installed?.sha256
      && hasInstalledAssets
      && (!Array.isArray(installed.chunks) || installed.chunks.length === 0)
  );
  const pending = await readJson(path.join(packRoot, PENDING_UPDATE_FILE));
  if (installed?.version && installed?.sha256 && hasInstalledAssets && pending?.manifest) {
    const applied = await applyPendingChunkUpdate({
      packRoot,
      currentRoot,
      installedManifest: installed,
      pending,
      onStatus,
      onProgress
    });
    if (applied) {
      const updated = await readJson(installedManifestPath);
      return { assetsRoot: installedAssetsRoot, source: "pending-update", version: String(updated?.version || installed.version) };
    }
  }
  // A previously verified modern pack is enough to open immediately. Remote
  // checks remain out of the critical path for these packs so a slow CDN
  // cannot delay a working installed app. Legacy packs are intentionally
  // excluded: the old manifest has no chunks and must be compared with the
  // current remote manifest before it can be trusted again.
  if (installed?.version && installed?.sha256 && hasInstalledAssets && !isLegacyInstalledPack) {
    return { assetsRoot: installedAssetsRoot, source: "cache", version: String(installed.version) };
  }

  if (isLegacyInstalledPack) {
    onDiagnostic?.({
      phase: "legacy-cache",
      code: "CONTENT_LEGACY_CACHE_REJECTED",
      error: new Error(`Content Pack legado ${installed.version} sem chunks; sera feita uma verificacao completa.`)
    });
  }

  let manifests = [];

  try {
    manifests = await fetchManifestCandidates(
      manifestUrls,
      onDiagnostic,
      isLegacyInstalledPack ? { timeoutMs: LEGACY_MANIFEST_TIMEOUT_MS } : {}
    );
  } catch (error) {
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
      installed.version === manifest.version
      && installed.sha256 === manifest.sha256
    ))
    && hasInstalledAssets
  ) {
    return { assetsRoot: installedAssetsRoot, source: "cache", version: String(installed.version) };
  }

  const tempRoot = path.join(packRoot, `pending-${Date.now()}`);
  const backupRoot = path.join(packRoot, `previous-${Date.now()}`);
  let downloadedManifest = null;
  let archivePath = null;
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(tempRoot, { recursive: true });

  try {
    let lastDownloadError = null;

    for (const candidate of manifests) {
      archivePath = path.join(packRoot, `content-${candidate.sha256}.zip.part`);
      for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS_PER_SOURCE; attempt += 1) {
        try {
          onStatus?.({ phase: "downloading" });
          await downloadArchive(candidate, archivePath, onProgress);
          downloadedManifest = candidate;
          break;
        } catch (error) {
          lastDownloadError = error;
          onDiagnostic?.({
            phase: error?.phase || "download",
            code: error?.code || "CONTENT_UNKNOWN",
            sourceUrl: candidate.sourceUrl,
            archiveUrl: candidate.archiveUrl,
            attempt,
            error
          });

          if (error?.code === "CONTENT_CHECKSUM" || error?.code === "CONTENT_DISK_SPACE") {
            break;
          }
          if (attempt < DOWNLOAD_ATTEMPTS_PER_SOURCE) {
            await waitBeforeRetry(attempt);
          }
        }
      }
      if (downloadedManifest) {
        break;
      }
    }

    if (!downloadedManifest || !archivePath) {
      throw lastDownloadError || contentError("CONTENT_DOWNLOAD_NETWORK", "download", "Nao foi possivel baixar os recursos.");
    }

    onStatus?.({ phase: "verifying" });
    await extractArchive(archivePath, tempRoot);
    await fs.writeFile(path.join(tempRoot, MANIFEST_FILE), JSON.stringify(downloadedManifest, null, 2), "utf8");
    const hadPreviousPack = await fs.stat(currentRoot).then(() => true).catch(() => false);

    if (hadPreviousPack) {
      await fs.rm(backupRoot, { recursive: true, force: true });
      await fs.rename(currentRoot, backupRoot);
    }

    try {
      await fs.rename(tempRoot, currentRoot);
    } catch (error) {
      if (hadPreviousPack) {
        await fs.rename(backupRoot, currentRoot).catch(() => {});
      }
      throw contentError("CONTENT_ACTIVATE", "activate", "Nao foi possivel ativar os recursos baixados.", error);
    }

    if (hadPreviousPack) {
      await fs.rm(backupRoot, { recursive: true, force: true });
    }
    await fs.rm(archivePath, { force: true });
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    throw error;
  }

  return { assetsRoot: installedAssetsRoot, source: "download", version: downloadedManifest.version };
}

// This function is deliberately used only after the renderer is ready. It
// downloads and verifies the delta in the background, but never changes the
// active files. `ensureContentPack` applies the saved delta on the following
// launch before any window receives assets.
export async function prepareContentPackChunkUpdate({ manifestUrls = [], userDataPath, installedManifest = null, onDiagnostic, onProgress } = {}) {
  const manifests = await fetchManifestCandidates(manifestUrls, onDiagnostic, { timeoutMs: 5_000 });
  const target = manifests.find((manifest) => (
    manifest.version !== String(installedManifest?.version || "")
    || manifest.sha256 !== String(installedManifest?.sha256 || "").toLowerCase()
  ));
  if (!target) return { prepared: false, reason: "up-to-date", chunks: [] };

  const chunks = changedChunks(installedManifest, target);
  if (!chunks || chunks.length === 0) {
    return { prepared: false, reason: "legacy-or-full-update", chunks: [] };
  }

  const packRoot = path.join(userDataPath, "content-pack");
  const pendingRoot = path.join(packRoot, "pending");
  await fs.rm(pendingRoot, { recursive: true, force: true });
  await fs.mkdir(pendingRoot, { recursive: true });

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const archivePath = path.join(pendingRoot, `${chunk.sha256}.zip`);
      await downloadArchive(chunk, archivePath, (progress) => onProgress?.({ ...progress, chunk: chunk.id, index, count: chunks.length }));
    }
    await fs.writeFile(path.join(packRoot, PENDING_UPDATE_FILE), JSON.stringify({ manifest: target, preparedAt: new Date().toISOString() }, null, 2), "utf8");
    return { prepared: true, reason: "pending-restart", chunks: chunks.map((chunk) => ({ id: chunk.id, bytes: chunk.bytes })) };
  } catch (error) {
    await fs.rm(pendingRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function inspectContentPackUpdate({ manifestUrls = [], installedManifest = null, onDiagnostic } = {}) {
  const manifests = await fetchManifestCandidates(manifestUrls, onDiagnostic, { timeoutMs: 5_000 });
  const installedVersion = String(installedManifest?.version || "").trim();
  const installedChecksum = String(installedManifest?.sha256 || "").trim().toLowerCase();
  const current = manifests.find((manifest) => (
    manifest.version === installedVersion && manifest.sha256 === installedChecksum
  ));

  const installedChunks = new Map(
    Array.isArray(installedManifest?.chunks)
      ? installedManifest.chunks.map((chunk) => [String(chunk?.id || ""), String(chunk?.sha256 || "").toLowerCase()])
      : []
  );

  return {
    upToDate: Boolean(current),
    available: manifests.map((manifest) => ({
      version: manifest.version,
      sourceUrl: manifest.sourceUrl,
      changedChunks: manifest.chunks
        .filter((chunk) => installedChunks.get(chunk.id) !== chunk.sha256)
        .map((chunk) => ({ id: chunk.id, bytes: chunk.bytes }))
    }))
  };
}
