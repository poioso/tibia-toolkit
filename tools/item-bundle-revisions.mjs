import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const dataDirectory = path.join(projectRoot, "assets", "library", "catalogs");
const revisionPath = path.join(dataDirectory, "item-bundle-revisions.json");
const bundleFiles = [
  "item-details.json",
  "item-supplements.json",
  "item-proficiency-damage.json",
  "item-npc-trades.json"
];

function describeBundle(buffer) {
  const payload = JSON.parse(buffer.toString("utf8"));
  const rows = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload?.items) ? payload.items : []);
  return {
    generatedAt: String(payload?.generatedAt || payload?.updatedAt || ""),
    count: rows.length
  };
}

export async function writeItemBundleRevisionManifest() {
  const contents = await Promise.all(
    bundleFiles.map(async (fileName) => ({
      fileName,
      buffer: await fs.readFile(path.join(dataDirectory, fileName))
    }))
  );

  const checksum = crypto.createHash("sha256");
  const bundles = {};
  for (const entry of contents) {
    checksum.update(entry.fileName);
    checksum.update("\0");
    checksum.update(entry.buffer);
    bundles[entry.fileName] = describeBundle(entry.buffer);
  }

  const manifest = {
    revision: `items-${checksum.digest("hex").slice(0, 20)}`,
    bundles
  };
  await fs.writeFile(revisionPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const manifest = await writeItemBundleRevisionManifest();
  console.log(`Item bundle revision: ${manifest.revision}`);
}
