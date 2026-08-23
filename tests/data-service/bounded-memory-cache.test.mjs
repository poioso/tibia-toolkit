import test from "node:test";
import assert from "node:assert/strict";

import { createBoundedMemoryCache } from "../../lib/data/bounded-memory-cache.js";

test("mantem o limite e remove o item menos recentemente usado", () => {
  const cache = createBoundedMemoryCache({ maxEntries: 2 });

  cache.set("a", 1).set("b", 2);
  assert.equal(cache.size, 2);

  assert.equal(cache.get("a"), 1);
  cache.set("c", 3);

  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("b"), false);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.size, 2);
});

test("atualizar uma chave a torna a mais recente sem aumentar o limite", () => {
  const cache = createBoundedMemoryCache({ maxEntries: 2 });

  cache.set("a", 1).set("b", 2).set("a", 3).set("c", 4);

  assert.equal(cache.get("a"), 3);
  assert.equal(cache.has("b"), false);
  assert.equal(cache.has("c"), true);
  assert.equal(cache.size, 2);
});

test("delete e clear preservam a semantica esperada do cache", () => {
  const cache = createBoundedMemoryCache({ maxEntries: 2 });

  cache.set("a", 1).set("b", 2);
  assert.equal(cache.delete("a"), true);
  assert.equal(cache.delete("a"), false);
  assert.equal(cache.size, 1);

  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(cache.get("b"), undefined);
});

