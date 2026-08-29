import assert from "node:assert/strict";
import { applyLibraryCatalogOverlay, createEmptyLibraryCatalogOverlay, mergeLibraryCatalogOverlay } from "../../lib/catalog-sync/library-catalog-overlay.js";

const baseline = {
  schemaVersion: 2,
  presentationContract: { schemaVersion: 2 },
  records: {
    items: [{ kind: "items", slug: "known", name: "Known", subtitle: "Item", image: null, description: "old", facts: [], meta: {}, profile: {}, localizedFacts: {}, localizedDescriptions: {}, localizedProfiles: {} }],
    npcs: [],
    creatures: [{ kind: "creatures", slug: "known-creature", name: "Known Creature", subtitle: "Creatures", image: null, description: "old", facts: [], meta: {}, profile: { abilities: [], damageModifiers: [], traits: [], tables: [] }, localizedFacts: {}, localizedDescriptions: {}, localizedProfiles: {} }],
    bosses: [], books: []
  }
};
const page = {
  schemaVersion: 1,
  cursor: "cursor-1",
  hasMore: false,
  changes: [
    { id: "1", kind: "items", slug: "known", locale: "pt-BR", version: 2, publishedAt: "2026-08-18T00:00:00.000Z", fields: { description: "new", facts: [["Classe", "Core"]], profile: { technicalDescription: ["Baseline line"], bestSell: "100 gp" } } },
    { id: "2", kind: "items", slug: "new-item", locale: "pt-BR", version: 1, publishedAt: "2026-08-18T00:00:01.000Z", fields: { title: "New Item", subtitle: "Valuables", description: "created by site", image: "/library/items/by-slug/new-item.gif", facts: [["Categoria", "Valuables"]], loot: [] } },
    { id: "3", kind: "items", slug: "new-item", locale: "en", version: 1, publishedAt: "2026-08-18T00:00:02.000Z", fields: { title: "New Item", description: "English" } },
    { id: "4", kind: "books-documents", slug: "new-book", locale: "pt-BR", version: 1, publishedAt: "2026-08-18T00:00:03.000Z", fields: { title: "New Book", author: "Author", rawText: "Text" } },
    { id: "5", kind: "items", slug: "known", locale: "pt-BR", version: 3, publishedAt: "2026-08-18T00:00:04.000Z", fields: { description: "new", facts: [["Classe", "Core"]], profile: { technicalDescription: ["Baseline line"], bestSell: "100 gp", food: { edible: true, regenerationSeconds: 120, paragraphs: ["Food note"] }, tables: [{ title: "Values", headings: ["A", "B"], rows: [["1", "2"]] }] } } },
    { id: "6", kind: "creatures", slug: "known-creature", locale: "pt-BR", version: 2, publishedAt: "2026-08-18T00:00:05.000Z", fields: { profile: { bestiaryWarning: "Careful", abilities: [{ element: "Fire", name: "Wave", value: "200" }], damageModifiers: [{ key: "fire", label: "Fire", value: "50%" }], traits: [["Pushable", "No"]], tables: [{ title: "Stages", headings: ["Stage"], rows: [["One"]] }] } } },
    { id: "7", kind: "npcs", slug: "new-npc", locale: "pt-BR", version: 1, publishedAt: "2026-08-18T00:00:06.000Z", fields: { title: "New NPC", subtitle: "Trader", facts: [["Cidade", "Thais"]], profile: { buy: [{ name: "New Item", slug: "new-item", price: "1", image: "/library/items/by-slug/new-item.gif" }] } } },
    { id: "8", kind: "creatures", slug: "new-creature", locale: "pt-BR", version: 1, publishedAt: "2026-08-18T00:00:07.000Z", fields: { title: "New Creature", subtitle: "Creatures", facts: [["Vida", "100"]], profile: { loot: [{ name: "New Item", slug: "new-item", amount: "1", rarity: "common", image: "/library/items/by-slug/new-item.gif" }] } } },
    { id: "9", kind: "bosses", slug: "new-boss", locale: "pt-BR", version: 1, publishedAt: "2026-08-18T00:00:08.000Z", fields: { title: "New Boss", subtitle: "Bosses", facts: [["Vida", "200"]], profile: { abilities: [{ element: "Fire", name: "Wave", value: "300" }] } } }
  ]
};
const overlay = mergeLibraryCatalogOverlay(createEmptyLibraryCatalogOverlay(), page);
const result = applyLibraryCatalogOverlay(baseline, overlay);
assert.equal(result.records.items.find((entry) => entry.slug === "known").description, "new");
assert.equal(result.records.items.find((entry) => entry.slug === "known").profile.bestSell, "100 gp");
const created = result.records.items.find((entry) => entry.slug === "new-item");
assert.equal(created.description, "created by site");
assert.equal(created.localizedDescriptions.en, "English");
assert.equal(result.records.books.find((entry) => entry.slug === "new-book").author, "Author");
assert.equal(result.records.items.find((entry) => entry.slug === "known").profile.food.regenerationSeconds, 120);
assert.equal(result.records.items.find((entry) => entry.slug === "known").profile.tables[0].rows[0][1], "2");
assert.equal(result.records.creatures.find((entry) => entry.slug === "known-creature").profile.abilities[0].name, "Wave");
assert.equal(result.records.creatures.find((entry) => entry.slug === "known-creature").profile.tables[0].title, "Stages");
assert.equal(result.records.npcs.find((entry) => entry.slug === "new-npc").profile.buy[0].slug, "new-item");
assert.equal(result.records.creatures.find((entry) => entry.slug === "new-creature").profile.loot[0].rarity, "common");
assert.equal(result.records.bosses.find((entry) => entry.slug === "new-boss").profile.abilities[0].value, "300");
assert.equal(result.appliedOverlay.records, 8);
assert.equal(result.presentationContract, baseline.presentationContract, "presentation contract must survive overlay application");
console.log(JSON.stringify({ passed: true, changes: result.appliedOverlay.records, newItems: result.records.items.length - baseline.records.items.length }, null, 2));
