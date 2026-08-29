import assert from "node:assert/strict";
import test from "node:test";

import {
  loadAuthoritativeWorldCatalog,
  mergeAuthoritativeWorldCatalog,
  normalizeRegularWorldCatalog,
  resolveWorldSlug,
} from "../../lib/data/world-catalog.js";

const slugify = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "-");

test("regular worlds are normalized, deduplicated and sorted", () => {
  const worlds = normalizeRegularWorldCatalog([
    { name: " Wickera " },
    { name: "Jinxibra" },
    { name: "jinxibra" },
    { name: "" },
    { name: "Sinistra" },
  ], slugify);

  assert.deepEqual(worlds.map((world) => world.name), ["Jinxibra", "Sinistra", "Wickera"]);
});

test("market metadata enriches but never expands the authoritative catalog", () => {
  const worlds = mergeAuthoritativeWorldCatalog(
    [{ name: "Antica", status: "online" }, { name: "Wickera", status: "online" }],
    [{ name: "Antica", last_update: "now" }, { name: "Retired World", last_update: "old" }],
    slugify,
  );

  assert.deepEqual(worlds.map((world) => world.name), ["Antica", "Wickera"]);
  assert.equal(worlds[0].last_update, "now");
});

test("a removed selection resolves only to an API-provided fallback", () => {
  const worlds = normalizeRegularWorldCatalog([{ name: "Wickera" }, { name: "Antica" }], slugify);
  assert.equal(resolveWorldSlug("Retired World", worlds), "antica");
  assert.equal(resolveWorldSlug("Retired World", [{ name: "Wickera", slug: "wickera" }]), "wickera");
  assert.equal(resolveWorldSlug("Antica", []), "");
});

test("96 TibiaData worlds remain authoritative when market returns 113", async () => {
  const regularWorlds = Array.from({ length: 93 }, (_, index) => ({ name: `World ${String(index).padStart(2, "0")}` }))
    .concat([{ name: "Jinxibra" }, { name: "Sinistra" }, { name: "Wickera" }]);
  const marketWorlds = Array.from({ length: 113 }, (_, index) => ({
    name: index < 96 ? regularWorlds[index].name : `Market Extra ${index}`,
    last_update: `update-${index}`,
  }));

  const result = await loadAuthoritativeWorldCatalog({
    fetchRegularWorlds: async () => regularWorlds,
    fetchMarketWorlds: async () => marketWorlds,
    cachedWorlds: null,
    slugifyWorldName: slugify,
  });

  assert.equal(result.source, "fresh");
  assert.equal(result.worlds.length, 96);
  assert.deepEqual(
    ["Jinxibra", "Sinistra", "Wickera"].map((name) => result.worlds.some((world) => world.name === name)),
    [true, true, true],
  );
  assert.equal(result.worlds.some((world) => world.name.startsWith("Market Extra")), false);
});

test("a TibiaData removal immediately removes the world even if market keeps it", async () => {
  const result = await loadAuthoritativeWorldCatalog({
    fetchRegularWorlds: async () => [{ name: "Antica" }],
    fetchMarketWorlds: async () => [{ name: "Antica" }, { name: "Retired World" }],
    cachedWorlds: [{ name: "Retired World", slug: "retired-world" }],
    slugifyWorldName: slugify,
  });

  assert.deepEqual(result.worlds.map((world) => world.name), ["Antica"]);
});

test("network failure preserves the previous valid app catalog", async () => {
  const cachedWorlds = [{ name: "Antica", slug: "antica" }, { name: "Wickera", slug: "wickera" }];
  const result = await loadAuthoritativeWorldCatalog({
    fetchRegularWorlds: async () => { throw new Error("offline"); },
    fetchMarketWorlds: async () => { throw new Error("offline"); },
    cachedWorlds,
    slugifyWorldName: slugify,
  });

  assert.equal(result.source, "cache");
  assert.deepEqual(result.worlds, cachedWorlds);
});

test("empty API and empty cache do not invent Antica", async () => {
  await assert.rejects(() => loadAuthoritativeWorldCatalog({
    fetchRegularWorlds: async () => [],
    fetchMarketWorlds: async () => [{ name: "Antica" }],
    cachedWorlds: [],
    slugifyWorldName: slugify,
  }), /catálogo de mundos vazio/);
});
