import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogFilterCache } from "../../lib/ui/catalog-filter-cache.js";

test("reuses the filtered result while source, dependencies and filters are unchanged", () => {
  const cache = createCatalogFilterCache();
  const source = [];
  const dependency = {};
  let builds = 0;

  const first = cache.get({
    source,
    dependencies: [dependency],
    signature: "query\u0000trade",
    buildItems: () => {
      builds += 1;
      return ["first"];
    }
  });
  const second = cache.get({
    source,
    dependencies: [dependency],
    signature: "query\u0000trade",
    buildItems: () => {
      builds += 1;
      return ["second"];
    }
  });

  assert.equal(builds, 1);
  assert.equal(second, first);
});

test("invalidates when the index, a dependent weakness index or filters change", () => {
  const cache = createCatalogFilterCache();
  const source = [];
  const weaknessA = {};
  const weaknessB = {};
  let builds = 0;
  const read = (options) => cache.get({
    ...options,
    buildItems: () => [++builds]
  });

  assert.deepEqual(read({ source, dependencies: [weaknessA], signature: "all" }), [1]);
  assert.deepEqual(read({ source, dependencies: [weaknessA], signature: "all" }), [1]);
  assert.deepEqual(read({ source, dependencies: [weaknessB], signature: "all" }), [2]);
  assert.deepEqual(read({ source, dependencies: [weaknessB], signature: "filtered" }), [3]);
  assert.deepEqual(read({ source: [], dependencies: [weaknessB], signature: "filtered" }), [4]);
});

test("clear drops the previous result", () => {
  const cache = createCatalogFilterCache();
  const source = [];
  cache.get({ source, signature: "all", buildItems: () => [1] });
  cache.clear();
  const current = cache.get({ source, signature: "all", buildItems: () => [2] });
  assert.deepEqual(current, [2]);
});
