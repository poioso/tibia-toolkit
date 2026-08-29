import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { ensureContentPack, prepareContentPackChunkUpdate } from "../desktop/content-pack.js";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const root = await fs.mkdtemp(path.join(os.tmpdir(), "tibia-toolkit-content-chunks-"));
const originalFetch = globalThis.fetch;

try {
  const userDataPath = path.join(root, "user-data");
  const packRoot = path.join(userDataPath, "content-pack");
  const currentRoot = path.join(packRoot, "current");
  await fs.mkdir(path.join(currentRoot, "assets", "library", "catalogs"), { recursive: true });
  await fs.writeFile(path.join(currentRoot, "assets", "library", "catalogs", "item-details.json"), "old-data", "utf8");

  const oldManifest = {
    version: "test-old",
    archiveUrl: "https://content.test/full-old.zip",
    sha256: "a".repeat(64),
    bytes: 1,
    chunks: [{ id: "library-data-items", archiveUrl: "https://content.test/items-old.zip", sha256: "b".repeat(64), bytes: 1 }]
  };
  await fs.writeFile(path.join(currentRoot, "content-manifest.json"), JSON.stringify(oldManifest), "utf8");

  const archive = new AdmZip();
  archive.addFile("assets/library/catalogs/item-details.json", Buffer.from("new-data"));
  const archivePath = path.join(root, "items.zip");
  archive.writeZip(archivePath);
  const archiveBytes = await fs.readFile(archivePath);
  const nextManifest = {
    version: "test-next",
    archiveUrl: "https://content.test/full-next.zip",
    sha256: "c".repeat(64),
    bytes: 1,
    chunks: [{
      id: "library-data-items",
      archiveUrl: "https://content.test/items-next.zip",
      sha256: sha256(archiveBytes),
      bytes: archiveBytes.byteLength,
      unpackedBytes: 8
    }]
  };

  let remoteManifest = nextManifest;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("latest.json")) return new Response(JSON.stringify(remoteManifest), { status: 200 });
    if (String(url).endsWith("items-next.zip")) return new Response(archiveBytes, { status: 200 });
    if (String(url).endsWith("full-next.zip")) return new Response(fullArchiveBytes, { status: 200 });
    if (String(url).endsWith("item-atlas.zip")) return new Response(atlasBytes, { status: 200 });
    return new Response("missing", { status: 404 });
  };

  const prepared = await prepareContentPackChunkUpdate({
    manifestUrls: ["https://content.test/latest.json"],
    userDataPath,
    installedManifest: oldManifest
  });
  assert.deepEqual(prepared, {
    prepared: true,
    reason: "pending-restart",
    chunks: [{ id: "library-data-items", bytes: archiveBytes.byteLength }]
  });
  assert.equal(await fs.readFile(path.join(currentRoot, "assets", "library", "catalogs", "item-details.json"), "utf8"), "old-data");

  const applied = await ensureContentPack({
    appIsPackaged: true,
    sourceAssetsRoot: path.join(root, "source-assets"),
    userDataPath,
    manifestUrls: []
  });
  assert.equal(applied.source, "pending-update");
  assert.equal(applied.version, "test-next");
  assert.equal(await fs.readFile(path.join(currentRoot, "assets", "library", "catalogs", "item-details.json"), "utf8"), "new-data");
  await assert.rejects(fs.stat(path.join(packRoot, "pending-update.json")));

  // A published pre-chunk pack must not be accepted as a permanent cache.
  // This reproduces the 0.6.7 manifest found on the affected machine: the
  // remote full pack is selected and activated before the renderer can use it.
  const legacyRoot = path.join(root, "legacy-user-data");
  const legacyCurrentRoot = path.join(legacyRoot, "content-pack", "current");
  await fs.mkdir(path.join(legacyCurrentRoot, "assets", "ui"), { recursive: true });
  await fs.writeFile(path.join(legacyCurrentRoot, "assets", "ui", "missing-before.png"), "legacy", "utf8");
  const legacyManifest = {
    version: "0.6.7",
    archiveUrl: "https://content.test/full-legacy.zip",
    sha256: "1".repeat(64),
    bytes: 1,
    unpackedBytes: 6
  };
  await fs.writeFile(path.join(legacyCurrentRoot, "content-manifest.json"), JSON.stringify(legacyManifest), "utf8");

  const fullArchive = new AdmZip();
  fullArchive.addFile("assets/missing-before.png", Buffer.from("current"));
  fullArchive.addFile("assets/new-icon.png", Buffer.from("icon"));
  const fullArchivePath = path.join(root, "full-next.zip");
  fullArchive.writeZip(fullArchivePath);
  const fullArchiveBytes = await fs.readFile(fullArchivePath);
  const fullManifest = {
    version: "0.7.1",
    archiveUrl: "https://content.test/full-next.zip",
    sha256: sha256(fullArchiveBytes),
    bytes: fullArchiveBytes.byteLength,
    unpackedBytes: 11,
    chunks: [{
      id: "ui",
      archiveUrl: "https://content.test/ui-next.zip",
      sha256: "2".repeat(64),
      bytes: 1,
      unpackedBytes: 1
    }]
  };
  remoteManifest = fullManifest;
  const legacyResult = await ensureContentPack({
    appIsPackaged: true,
    sourceAssetsRoot: path.join(root, "source-assets"),
    userDataPath: legacyRoot,
    manifestUrls: ["https://content.test/latest.json"]
  });
  assert.equal(legacyResult.source, "download");
  assert.equal(legacyResult.version, "0.7.1");
  assert.equal(await fs.readFile(path.join(legacyCurrentRoot, "assets", "missing-before.png"), "utf8"), "current");
  assert.equal(await fs.readFile(path.join(legacyCurrentRoot, "assets", "new-icon.png"), "utf8"), "icon");

  // The builder places static item atlases in the same incremental media
  // chunk as item sprites. The runtime must accept that exact grouping.
  const atlasArchive = new AdmZip();
  atlasArchive.addFile("assets/library/items/atlases/example.png", Buffer.from("atlas"));
  const atlasPath = path.join(root, "item-atlas.zip");
  atlasArchive.writeZip(atlasPath);
  const atlasBytes = await fs.readFile(atlasPath);
  const atlasManifest = {
    ...nextManifest,
    version: "test-atlas",
    sha256: "e".repeat(64),
    chunks: [
      ...nextManifest.chunks,
      {
        id: "library-media-items",
        archiveUrl: "https://content.test/item-atlas.zip",
        sha256: sha256(atlasBytes),
        bytes: atlasBytes.byteLength,
        unpackedBytes: 5
      }
    ]
  };
  remoteManifest = atlasManifest;
  const atlasPrepared = await prepareContentPackChunkUpdate({
    manifestUrls: ["https://content.test/latest.json"],
    userDataPath,
    installedManifest: nextManifest
  });
  assert.deepEqual(atlasPrepared, {
    prepared: true,
    reason: "pending-restart",
    chunks: [{ id: "library-media-items", bytes: atlasBytes.byteLength }]
  });
  const atlasApplied = await ensureContentPack({
    appIsPackaged: true,
    sourceAssetsRoot: path.join(root, "source-assets"),
    userDataPath,
    manifestUrls: []
  });
  assert.equal(atlasApplied.version, "test-atlas");
  assert.equal(await fs.readFile(path.join(currentRoot, "assets", "library", "items", "atlases", "example.png"), "utf8"), "atlas");

  // A chunk may never escape its declared group.  Rejection must leave the
  // installed data intact, proving the pre-activation path is transactional.
  const invalidArchive = new AdmZip();
  invalidArchive.addFile("assets/library/npcs/sprites/not-allowed.gif", Buffer.from("x"));
  const invalidPath = path.join(root, "invalid.zip");
  invalidArchive.writeZip(invalidPath);
  const invalidBytes = await fs.readFile(invalidPath);
  const invalidManifest = {
    ...oldManifest,
    version: "test-invalid",
    sha256: "d".repeat(64),
    chunks: [{
      id: "library-data-items",
      archiveUrl: "https://content.test/invalid.zip",
      sha256: sha256(invalidBytes),
      bytes: invalidBytes.byteLength,
      unpackedBytes: 1
    }]
  };
  await fs.writeFile(path.join(currentRoot, "content-manifest.json"), JSON.stringify(oldManifest), "utf8");
  await fs.mkdir(path.join(packRoot, "pending"), { recursive: true });
  await fs.writeFile(path.join(packRoot, "pending", `${sha256(invalidBytes)}.zip`), invalidBytes);
  await fs.writeFile(path.join(packRoot, "pending-update.json"), JSON.stringify({ manifest: invalidManifest }), "utf8");
  const recovered = await ensureContentPack({
    appIsPackaged: true,
    sourceAssetsRoot: path.join(root, "source-assets"),
    userDataPath,
    manifestUrls: []
  });
  assert.equal(recovered.source, "cache-recovered");
  assert.equal(recovered.version, oldManifest.version);
  assert.equal(await fs.readFile(path.join(currentRoot, "assets", "library", "catalogs", "item-details.json"), "utf8"), "new-data");
  await assert.rejects(fs.stat(path.join(packRoot, "pending-update.json")));
  const quarantineEntries = await fs.readdir(path.join(packRoot, "quarantine"), { withFileTypes: true });
  assert.equal(quarantineEntries.filter((entry) => entry.isDirectory()).length, 1);
  const quarantineRoot = path.join(packRoot, "quarantine", quarantineEntries[0].name);
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(quarantineRoot, "pending-update.json"), "utf8")),
    { manifest: invalidManifest }
  );

  remoteManifest = invalidManifest;
  const skippedQuarantine = await prepareContentPackChunkUpdate({
    manifestUrls: ["https://content.test/latest.json"],
    userDataPath,
    installedManifest: oldManifest
  });
  assert.deepEqual(skippedQuarantine, {
    prepared: false,
    reason: "quarantined",
    chunks: []
  });

  console.log(JSON.stringify({ passed: true, prepared, applied }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  await fs.rm(root, { recursive: true, force: true });
}
