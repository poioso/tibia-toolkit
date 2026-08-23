import assert from "node:assert/strict";
import test from "node:test";
import {
  collectRetainedLibraryMediaHashes,
  planLibraryMediaCacheCleanup,
  pruneLibraryMediaIndex
} from "../../lib/catalog-sync/media-cache.js";

test("library media cleanup retains active, pending and backup references", () => {
  const activeHash = "a".repeat(64);
  const backupHash = "b".repeat(64);
  const staleHash = "c".repeat(64);
  const active = { "/library/items/active.gif": { sha256: activeHash } };
  const backup = { "/library/items/backup.gif": { sha256: backupHash } };
  const { referencedPaths, hashes } = collectRetainedLibraryMediaHashes({
    snapshots: [{ image: "/library/items/active.gif" }, { image: "/library/items/backup.gif" }],
    indexes: [active, backup]
  });
  assert.deepEqual([...hashes].sort(), [activeHash, backupHash]);
  assert.deepEqual(planLibraryMediaCacheCleanup({
    files: [
      { name: activeHash, mtimeMs: 0 },
      { name: backupHash, mtimeMs: 0 },
      { name: staleHash, mtimeMs: 0 },
      { name: "not-a-catalog-blob", mtimeMs: 0 }
    ],
    retainedHashes: hashes,
    now: 10_000,
    graceMs: 1_000
  }), [staleHash]);
  assert.deepEqual(pruneLibraryMediaIndex({ ...active, "/library/items/old.gif": { sha256: staleHash } }, referencedPaths), active);
});
