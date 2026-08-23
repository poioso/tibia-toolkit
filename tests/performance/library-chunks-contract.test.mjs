import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { configureDataService, handleDataServiceMessage } from "../../lib/data/data-service.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const canonicalPath = path.join(root, "assets", "data", "site-library-canonical.json");
const chunksRoot = path.join(root, "assets", "data", "site-library-chunks");
const canonicalContents = await fs.readFile(canonicalPath);
const canonical = JSON.parse(canonicalContents.toString("utf8"));
const manifest = JSON.parse(await fs.readFile(path.join(chunksRoot, "manifest.json"), "utf8"));

test("generated Library chunks are an exact, complete copy of the canonical catalogue", async () => {
  assert.equal(manifest.sourceSha256, crypto.createHash("sha256").update(canonicalContents).digest("hex"));
  for (const kind of ["items", "npcs", "creatures", "bosses", "books"]) {
    const reconstructed = [];
    const summaries = manifest.kinds[kind].summaries;
    for (const relativePath of [...new Set(summaries.map((entry) => entry.chunk))]) {
      const contents = await fs.readFile(path.join(chunksRoot, ...relativePath.split("/")));
      const expected = manifest.chunks[relativePath];
      assert.equal(contents.byteLength, expected.bytes, relativePath);
      assert.equal(crypto.createHash("sha256").update(contents).digest("hex"), expected.sha256, relativePath);
      const chunk = JSON.parse(contents.toString("utf8"));
      assert.equal(chunk.kind, kind);
      reconstructed.push(...chunk.records);
    }
    assert.deepEqual(reconstructed, canonical.records[kind]);
    assert.equal(summaries.length, canonical.records[kind].length);
  }
});

test("clean first run lists and opens Library data without reading the monolith", async () => {
  let monolithReads = 0;
  const storage = new Map();
  configureDataService({
    getLibraryCatalogState() {
      return { activeHash: "", hasActiveBase: false, overlayChanges: 0 };
    },
    getAssetUrl(relativePath) {
      return relativePath;
    },
    getLibraryMediaUrl() {
      return "";
    },
    async readJsonAsset(relativePath) {
      if (relativePath === "assets/data/site-library-canonical.json") monolithReads += 1;
      return JSON.parse(await fs.readFile(path.join(root, ...relativePath.split("/")), "utf8"));
    },
    async storageGet(key) {
      return typeof key === "string" ? { [key]: storage.get(key) } : Object.fromEntries(storage);
    },
    async storageSet(values) {
      for (const [key, value] of Object.entries(values || {})) storage.set(key, value);
    },
    async storageRemove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) storage.delete(key);
    },
  });
  await handleDataServiceMessage({ type: "activate-library-content" });

  const books = await handleDataServiceMessage({ type: "fetch-books-documents", payload: { page: 1, pageSize: 12 } });
  assert.ok(books.total > 0);
  assert.equal(books.results.length, 12);
  const book = await handleDataServiceMessage({ type: "fetch-books-documents", payload: { slug: books.results[0].slug } });
  assert.equal(book.detail?.slug, books.results[0].slug);

  const creatures = await handleDataServiceMessage({ type: "fetch-creature-index" });
  assert.ok(creatures.items.length > 0);
  const items = await handleDataServiceMessage({ type: "fetch-item-suggestions", payload: { showAll: true, limit: 8000 } });
  assert.ok(items.length > 0);
  const firstSuggestionPage = await handleDataServiceMessage({
    type: "fetch-item-suggestions",
    payload: { showAll: true, limit: 60, offset: 0 }
  });
  const secondSuggestionPage = await handleDataServiceMessage({
    type: "fetch-item-suggestions",
    payload: { showAll: true, limit: 60, offset: 60 }
  });
  assert.equal(firstSuggestionPage.length, 60);
  assert.equal(secondSuggestionPage.length, 60);
  assert.deepEqual([...firstSuggestionPage, ...secondSuggestionPage], items.slice(0, 120));
  assert.equal(monolithReads, 0);
});

test("incompatible active catalogue keeps the existing monolithic fallback", async () => {
  let monolithReads = 0;
  configureDataService({
    getLibraryCatalogState() {
      return { activeHash: "f".repeat(64), hasActiveBase: true, overlayChanges: 0 };
    },
    getAssetUrl(relativePath) {
      return relativePath;
    },
    getLibraryMediaUrl() {
      return "";
    },
    async readJsonAsset(relativePath) {
      if (relativePath === "assets/data/site-library-canonical.json") monolithReads += 1;
      return JSON.parse(await fs.readFile(path.join(root, ...relativePath.split("/")), "utf8"));
    },
    async storageGet() { return {}; },
    async storageSet() {},
    async storageRemove() {},
  });
  await handleDataServiceMessage({ type: "activate-library-content" });
  const books = await handleDataServiceMessage({ type: "fetch-books-documents", payload: { page: 1, pageSize: 12 } });
  assert.ok(books.total > 0);
  assert.ok(monolithReads > 0);
});
