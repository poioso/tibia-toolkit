import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getContentPackChunkGroup, isContentPackRuntimeAsset } from "../lib/content-pack/chunk-groups.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = path.join(projectRoot, "assets");
const reportPath = path.join(projectRoot, ".local", "reports", "performance", "content-pack-chunk-readiness.json");
async function walk(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(absolute));
    else if (entry.isFile() && entry.name !== ".gitkeep") result.push(absolute);
  }
  return result;
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const files = (await walk(assetsRoot)).filter((absolute) => (
  isContentPackRuntimeAsset(path.relative(assetsRoot, absolute))
));
const groups = new Map();
for (const absolute of files) {
  const relative = path.relative(assetsRoot, absolute).replaceAll("\\", "/");
  const contents = await fs.readFile(absolute);
  const id = getContentPackChunkGroup(relative);
  const group = groups.get(id) || { id, files: [], bytes: 0 };
  group.files.push({ path: relative, sha256: digest(contents), bytes: contents.byteLength });
  group.bytes += contents.byteLength;
  groups.set(id, group);
}

const chunks = [...groups.values()].map((group) => ({
  id: group.id,
  files: group.files.length,
  bytes: group.bytes,
  sha256: digest(group.files
    .sort((left, right) => left.path.localeCompare(right.path, "en"))
    .map((file) => `${file.path}:${file.sha256}:${file.bytes}`)
    .join("\n"))
})).sort((left, right) => left.id.localeCompare(right.id, "en"));

const totalBytes = chunks.reduce((sum, group) => sum + group.bytes, 0);
const report = {
  generatedAt: new Date().toISOString(),
  result: "ready-for-manifest-v2",
  contract: "Initial install downloads every chunk. Future updates may download only chunks whose sha256 changes; the app never fetches a library record at page-open time.",
  totalFiles: files.length,
  totalBytes,
  chunks
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
