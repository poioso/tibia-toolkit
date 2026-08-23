const MEDIA_PATH_PATTERN = /^\/library\/[a-z0-9._/-]+$/i;
const MEDIA_HASH_PATTERN = /^[a-f0-9]{64}$/i;

export function collectLibraryMediaPaths(value, paths = new Set()) {
  if (typeof value === "string") {
    if (MEDIA_PATH_PATTERN.test(value)) paths.add(value);
    return paths;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectLibraryMediaPaths(entry, paths));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => collectLibraryMediaPaths(entry, paths));
  }
  return paths;
}

export function collectRetainedLibraryMediaHashes({ snapshots = [], indexes = [] } = {}) {
  const referencedPaths = new Set();
  snapshots.filter(Boolean).forEach((snapshot) => collectLibraryMediaPaths(snapshot, referencedPaths));
  const hashes = new Set();
  for (const index of indexes.filter(Boolean)) {
    for (const [mediaPath, descriptor] of Object.entries(index)) {
      const hash = String(descriptor?.sha256 || "").toLowerCase();
      if (referencedPaths.has(mediaPath) && MEDIA_HASH_PATTERN.test(hash)) hashes.add(hash);
    }
  }
  return { referencedPaths, hashes };
}

export function planLibraryMediaCacheCleanup({ files = [], retainedHashes = new Set(), now = Date.now(), graceMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
  return files
    .filter((entry) => MEDIA_HASH_PATTERN.test(String(entry?.name || "")))
    .filter((entry) => !retainedHashes.has(String(entry.name).toLowerCase()))
    .filter((entry) => Number.isFinite(Number(entry?.mtimeMs)) && now - Number(entry.mtimeMs) >= graceMs)
    .map((entry) => String(entry.name).toLowerCase());
}

export function pruneLibraryMediaIndex(index, referencedPaths) {
  return Object.fromEntries(Object.entries(index || {}).filter(([mediaPath, descriptor]) => (
    referencedPaths.has(mediaPath) && MEDIA_HASH_PATTERN.test(String(descriptor?.sha256 || ""))
  )));
}
