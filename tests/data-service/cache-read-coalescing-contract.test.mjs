import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../lib/data/data-service.js", import.meta.url), "utf8");

test("concurrent persistent cache reads are coalesced by key", () => {
  const start = source.indexOf("async function getCachedStorageRead(");
  const end = source.indexOf("\nasync function putCache", start);
  assert.ok(start >= 0 && end > start, "storage-read coalescer must remain available");

  const body = source.slice(start, end);
  assert.match(body, /cacheStorageReadPromises\.get\(normalizedKey\)/);
  assert.match(body, /dataServiceRuntime\.storageGet\(normalizedKey\)/);
  assert.match(body, /\.finally\(\(\) => cacheStorageReadPromises\.delete\(normalizedKey\)\)/);
});
