import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { configureDataService, handleDataServiceMessage } from "../../lib/data/data-service.js";
import { translatePhraseSync } from "../../lib/i18n/phrase-translations.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const storage = new Map();
let networkCalls = 0;
const canonical = JSON.parse(await fs.readFile(path.join(projectRoot, "assets/library/catalogs/site-library-canonical.json"), "utf8"));
// This record deliberately exists only in the simulated site snapshot. It
// proves that a creature published after an installer build joins the desktop
// list and opens from its canonical document without any legacy index entry.
const siteOnlyCreature = {
  kind: "creatures",
  slug: "site-bridge-creature",
  name: "Site Bridge Creature",
  subtitle: "Creatures",
  image: null,
  description: "A record published by the site.",
  facts: [["Vida", "321"], ["Experiência", "654"], ["Notas", "Available from the site bridge."]],
  meta: { creatureClass: "Magical", primaryType: "Creature", isBoss: "" },
  profile: { abilities: [], damageModifiers: [], traits: [], loot: [], tables: [] },
  localizedFacts: {}, localizedDescriptions: {}, localizedProfiles: {}, aliases: []
};
canonical.records.creatures.push(siteOnlyCreature);
const siteOnlyItem = {
  kind: "items",
  slug: "site-bridge-item",
  name: "Site Bridge Item",
  subtitle: "Valuables",
  image: "/library/items/by-slug/site-bridge-item.gif",
  description: "A record published by the site.",
  facts: [["Categoria", "Valuables"], ["Notas", "The attached image is stored locally by the app."]],
  meta: { marketId: 0, wikiUrl: "" },
  profile: {
    technicalDescription: ["It weighs 1.00 oz."],
    noteImage: "/library/items/notes/site-bridge-item.png",
    proficiency: [{ level: 8, options: [{ text: "Bridge option", translations: {}, images: [{ src: "/library/proficiency/site-bridge.gif", alt: "Bridge", title: "Bridge" }] }] }],
    buy: [], sell: [], droppedBy: [], tables: []
  },
  localizedFacts: {}, localizedDescriptions: {}, localizedProfiles: {}, aliases: []
};
canonical.records.items.push(siteOnlyItem);
const appSource = await fs.readFile(path.join(projectRoot, "app.js"), "utf8");
const runtimeApiSource = await fs.readFile(path.join(projectRoot, "lib/data/runtime-api.js"), "utf8");
const phraseEn = JSON.parse(await fs.readFile(path.join(projectRoot, "assets/localization/phrases.en.json"), "utf8"));
const phraseDe = JSON.parse(await fs.readFile(path.join(projectRoot, "assets/localization/phrases.de.json"), "utf8"));
const canonicalBySlug = (kind, slug) => canonical.records[kind].find((entry) => entry.slug === slug) || null;
const canonicalFact = (kind, slug, label) => canonicalBySlug(kind, slug)?.facts?.find(([name]) => name === label)?.[1] || "";
const canonicalLocalizedFactValues = (kind, slug, label) => {
  const record = canonicalBySlug(kind, slug);
  const index = record?.facts?.findIndex(([name]) => name === label) ?? -1;
  return new Set([record?.facts, ...Object.values(record?.localizedFacts || {})]
    .filter(Array.isArray)
    .map((facts) => index >= 0 ? facts[index]?.[1] : undefined)
    .filter(Boolean));
};

configureDataService({
  getAssetUrl(relativePath) {
    return pathToFileURL(path.join(projectRoot, relativePath)).href;
  },
  getLibraryMediaUrl(sitePath) {
    if (/\/(?:cloud-in-a-bottle|scraps-of-a-radiant-attire)\.gif$/u.test(sitePath)) return "";
    return `tibiatoolkit://app/assets/library-media${sitePath}`;
  },
  async readJsonAsset(relativePath) {
    if (relativePath === "assets/library/catalogs/site-library-canonical.json") return structuredClone(canonical);
    return JSON.parse(await fs.readFile(path.join(projectRoot, relativePath), "utf8"));
  },
  async storageGet(key) {
    if (key == null) return Object.fromEntries(storage.entries());
    if (typeof key === "string") return { [key]: storage.get(key) };
    return {};
  },
  async storageSet(values) {
    Object.entries(values || {}).forEach(([key, value]) => storage.set(key, value));
  },
  async storageRemove(keys) {
    (Array.isArray(keys) ? keys : [keys]).forEach((key) => storage.delete(key));
  }
});

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  networkCalls += 1;
  throw new Error("A Biblioteca nao pode buscar dados pela rede.");
};

try {
  const bookSlug = canonical.records.books[0]?.slug;
  const updateItems = canonical.records.items.filter((entry) => canonicalFact("items", entry.slug, "Implementado") === "15.32.fc9100");
  const updateCreatures = canonical.records.creatures.filter((entry) => canonicalFact("creatures", entry.slug, "Implementado") === "15.32.fc9100");
  const expectedNewCreatureSlugs = ["blue-woodworm", "green-woodworm", "red-woodworm", "yellow-woodworm"];
  const localizedUpdateIssues = [...updateItems, ...updateCreatures].flatMap((entry) => {
    const ptFacts = entry.localizedFacts?.["pt-BR"] || entry.facts || [];
    return ["en", "de"].flatMap((locale) => {
      const localizedFacts = entry.localizedFacts?.[locale] || [];
      const issues = localizedFacts.length === ptFacts.length ? [] : [`fact-count ${localizedFacts.length}/${ptFacts.length}`];
      for (let index = 0; index < Math.min(ptFacts.length, localizedFacts.length); index += 1) {
        const [ptLabel, ptValue] = ptFacts[index] || [];
        const [localizedLabel, localizedValue] = localizedFacts[index] || [];
        if (!String(localizedLabel || "").trim()) issues.push(`empty-label:${ptLabel}`);
        if (!String(localizedValue || "").trim() && String(ptValue || "").trim()) issues.push(`empty-value:${ptLabel}`);
        const narrative = ["Notas", "Comportamento", "Estrat\u00e9gia", "Hist\u00f3ria", "Descri\u00e7\u00e3o"].includes(ptLabel);
        const portugueseNarrative = /\b(?:n\u00e3o|para|com|uma|um|esta|este|sua|seu|quando|tamb\u00e9m|obtido|obtida|pode|usar|usado|usada|localiza\u00e7\u00e3o|faz parte)\b/iu.test(String(ptValue || ""));
        if (narrative && portugueseNarrative && String(localizedValue || "").trim() === String(ptValue || "").trim()) {
          issues.push(`untranslated-narrative:${ptLabel}`);
        }
      }
      return issues.length ? [{ locale, kind: entry.kind, slug: entry.slug, issues }] : [];
    });
  });
  const [item, npc, creature, mimar, technicalItem, foodItem, newItem, newCreature, siteCreature, siteItem, stashAmazonArmor, stashAbridgedScroll, sliver, exaltedCore, dust, updateItemResults, updateCreatureResults, creatures, books, book, itemSuggestions] = await Promise.all([
    handleDataServiceMessage({ type: "fetch-item-static", payload: { itemSlug: "alchemists-notepad", worldSlug: "antica" } }),
    handleDataServiceMessage({ type: "fetch-npc-detail", payload: { name: "A Bearded Woman" } }),
    handleDataServiceMessage({ type: "fetch-creature-detail", payload: { name: "Ancient Spawn of Morgathla" } }),
    handleDataServiceMessage({ type: "fetch-creature-detail", payload: { name: "Mimar Haffar" } }),
    handleDataServiceMessage({ type: "fetch-item-static", payload: { itemSlug: "abyss-hammer", worldSlug: "antica" } }),
    handleDataServiceMessage({ type: "fetch-item-static", payload: { itemSlug: "amber-souvenir", worldSlug: "antica" } }),
    handleDataServiceMessage({ type: "fetch-item-static", payload: { itemSlug: "cursed-coin", worldSlug: "antica" } }),
    handleDataServiceMessage({ type: "fetch-creature-detail", payload: { name: "Yellow Woodworm" } }),
    handleDataServiceMessage({ type: "fetch-creature-detail", payload: { name: siteOnlyCreature.name } }),
    handleDataServiceMessage({ type: "fetch-item-static", payload: { itemSlug: siteOnlyItem.slug, worldSlug: "antica" } }),
    handleDataServiceMessage({ type: "fetch-stash-item-preview", payload: { itemSlug: "amazon-armor", worldSlug: "antica" } }),
    handleDataServiceMessage({ type: "fetch-stash-item-preview", payload: { itemSlug: "abridged-promotion-scroll", worldSlug: "antica" } }),
    handleDataServiceMessage({ type: "fetch-item-static", payload: { itemSlug: "sliver", worldSlug: "antica" } }),
    handleDataServiceMessage({ type: "fetch-item-static", payload: { itemSlug: "exalted-core", worldSlug: "antica" } }),
    handleDataServiceMessage({ type: "fetch-item-static", payload: { itemSlug: "dust", worldSlug: "antica" } }),
    Promise.all(updateItems.map((entry) => handleDataServiceMessage({ type: "fetch-item-static", payload: { itemSlug: entry.slug, worldSlug: "antica" } }))),
    Promise.all(updateCreatures.map((entry) => handleDataServiceMessage({ type: "fetch-creature-detail", payload: { name: entry.name } }))),
    handleDataServiceMessage({ type: "fetch-creature-index" }),
    handleDataServiceMessage({ type: "fetch-books-documents", payload: {} }),
    handleDataServiceMessage({ type: "fetch-books-documents", payload: { slug: bookSlug } }),
    handleDataServiceMessage({ type: "fetch-item-suggestions", payload: { query: "", showAll: true, limit: 8000 } })
  ]);

  const suggestionSlugs = new Set((itemSuggestions || []).map((entry) => String(entry?.slug || "").trim()).filter(Boolean));
  const canonicalItemSlugs = new Set(canonical.records.items.map((entry) => entry.slug));
  const missingSuggestionSlugs = [...canonicalItemSlugs].filter((slug) => !suggestionSlugs.has(slug));
  const extraSuggestionSlugs = [...suggestionSlugs].filter((slug) => !canonicalItemSlugs.has(slug));
  const allBooksForSort = async (sort) => {
    const first = await handleDataServiceMessage({ type: "fetch-books-documents", payload: { sort, page: 1, pageSize: 120 } });
    const pages = Math.ceil((first?.total || 0) / (first?.pageSize || 120));
    const remaining = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => handleDataServiceMessage({
      type: "fetch-books-documents",
      payload: { sort, page: index + 2, pageSize: 120 }
    })));
    return [...(first?.results || []), ...remaining.flatMap((page) => page?.results || [])];
  };
  const [allBooksNameAsc, allBooksNameDesc] = await Promise.all([
    allBooksForSort("name-asc"),
    allBooksForSort("name-desc")
  ]);
  const numericBookStartsAfterLetters = (entries = []) => {
    const names = entries.map((entry) => String(entry?.name || "").trim()).filter(Boolean);
    const firstNumeric = names.findIndex((name) => /^\d/.test(name));
    const lastLetter = names.reduce((index, name, current) => (/^[A-Za-z]/.test(name) ? current : index), -1);
    // The catalog has numeric titles, so this proves that they are deliberately
    // grouped after A-Z instead of being placed at the beginning by the locale
    // collator. It applies to both name directions.
    return firstNumeric >= 0 && lastLetter >= 0 && firstNumeric > lastLetter;
  };
  const hasLocalizedFact = (entry, labels, expected) => (entry?.item?.canonicalFacts || [])
    .some(([label, value]) => labels.includes(label) && value === expected);

  const checks = {
    offline: networkCalls === 0,
    coreDetails: Boolean(item?.item?.name) && Boolean(npc?.name) && Boolean(creature?.name),
    foodProfile: foodItem?.item?.slug === "amber-souvenir"
      && foodItem?.item?.food?.edible === true
      && foodItem?.item?.food?.regenerationSeconds === 120,
    itemTechnicalProfile: technicalItem?.item?.slug === "abyss-hammer"
      && technicalItem?.item?.technical_description_lines?.length > 0
      && Array.isArray(technicalItem?.item?.proficiency)
      && Array.isArray(technicalItem?.item?.damageTable)
      && technicalItem?.item?.damageModel?.sourceStatus === canonicalBySlug("items", "abyss-hammer")?.profile?.damageModel?.sourceStatus
      && Array.isArray(technicalItem?.item?.droppedBy)
      && Array.isArray(technicalItem?.item?.npc_buy)
      && Array.isArray(technicalItem?.item?.npc_sell),
    canonicalNotes: canonicalLocalizedFactValues("items", "alchemists-notepad", "Notas").has(item?.item?.notes) && canonicalLocalizedFactValues("npcs", "a-bearded-woman", "Notas").has(npc?.notes) && canonicalLocalizedFactValues("bosses", "ancient-spawn-of-morgathla", "Notas").has(creature?.notes),
    // The offline bridge uses its default English locale unless a renderer
    // locale is injected.  The structural assertion must therefore accept
    // the localized coordinate label while still proving the reviewed note,
    // its achievement formatting, and the removal of imported image markup.
    reviewedBossNarrative: creature?.notes?.includes("**Scourge of Scarabs**") && /\(33749,32160,15:1 (?:aqui|here)\)/u.test(creature?.notes || "") && !creature?.notes?.includes("Loot Earthborn Titan Armor.png"),
    cursedCoin: newItem?.item?.wiki_name === "Cursed Coin" && newItem?.item?.description_lines?.length === 0 && newItem?.item?.technical_description_lines?.join("\n") === canonicalBySlug("items", "cursed-coin")?.profile?.technicalDescription?.join("\n") && newItem?.item?.technical_description_lines?.includes("(Arm: 0).") && newItem?.item?.technical_description_lines?.includes("It weighs 1.50 oz.") && newItem?.item?.technical_description_lines?.includes("An ancient curse is breaking the powerful aura of this coin") && !newItem?.item?.technical_description_lines?.some((line) => /^(?:Added|Market):/i.test(line)) && !newItem?.item?.technical_description_lines?.some((line) => /Classification: 1\. Max\. Tier: 0\./i.test(line)) && newItem?.item?.notes === "" && newItem?.item?.npc_sell?.some?.((entry) => entry.name === "Proprietor Piers" && entry.location === "Thais" && entry.price === "70 Event Points"),
    exaltationItems: sliver?.item?.slug === "sliver"
      && sliver?.item?.technical_description_lines?.join("\n") === "This item can be used in the exaltation forge to create exalted cores."
      && hasLocalizedFact(sliver, ["Obtido em", "Obtained in", "Erhalten bei"], "Delivery Tasks: 50-100")
      && exaltedCore?.item?.slug === "exalted-core"
      && exaltedCore?.item?.technical_description_lines?.join("\n") === "Use this item to enhance your chances at the exaltation forge."
      && hasLocalizedFact(exaltedCore, ["Classe", "Class", "Klasse"], "Core")
      && hasLocalizedFact(exaltedCore, ["Obtido em", "Obtained in", "Erhalten bei"], "Delivery Tasks: 5-10")
      && dust?.item?.slug === "dust"
      && dust?.item?.wiki_name === "Dust"
      && /(?:Ele é virtual|It is virtual|Er ist virtuell)/u.test(dust?.item?.notes || "")
      && /(?:\/assets\/data\/items\/notes|\/assets\/library-media\/library\/items\/notes)\/exaltation-forge-conversion\.png$/u.test(dust?.item?.notes_image || ""),
    updateRecords: newCreature?.name === "Yellow Woodworm" && newCreature?.implemented === "15.32.fc9100" && updateItems.length >= 36 && updateCreatures.length >= 4 && canonicalBySlug("items", "sauerkraut-barrel")?.profile?.technicalDescription?.join("\n") === "It weighs 0.00 oz." && expectedNewCreatureSlugs.every((slug) => canonicalBySlug("creatures", slug)?.facts?.some(([label, value]) => label === "Implementado" && value === "15.32.fc9100")),
    siteOnlyCreatureBridge: siteCreature?.slug === siteOnlyCreature.slug
      && siteCreature?.hitpoints === 321
      && siteCreature?.experience === 654
      && siteCreature?.notes === "Available from the site bridge."
      && creatures?.items?.some((entry) => entry?.slug === siteOnlyCreature.slug),
    siteOnlyItemMediaBridge: siteItem?.item?.slug === siteOnlyItem.slug
      && siteItem?.item?.notes_image === "tibiatoolkit://app/assets/library-media/library/items/notes/site-bridge-item.png"
      && siteItem?.item?.proficiency?.[0]?.options?.[0]?.images?.[0]?.src === "tibiatoolkit://app/assets/library-media/library/proficiency/site-bridge.gif",
    stashUsesCanonicalFirstPaint: stashAmazonArmor?.item?.slug === "amazon-armor"
      && stashAmazonArmor?.item?.technical_description_lines?.length > 0
      && stashAmazonArmor?.item?.technical_description_lines?.some((line) => /Max\. Tier: 10/u.test(line))
      && stashAbridgedScroll?.item?.slug === "abridged-promotion-scroll"
      && stashAbridgedScroll?.item?.technical_description_lines?.some((line) => /hero of level 51/u.test(line)),
    lootUsesBundledFallbackWhenMediaIsNotCached: ["cloud-in-a-bottle", "scraps-of-a-radiant-attire"].every((slug) => {
      const loot = mimar?.loot?.find((entry) => entry?.slug === slug);
      return loot?.imageSrc && /assets[\\/]library[\\/]items[\\/]catalog[\\/]by-slug[\\/][^\\/]+\.gif$/iu.test(loot.imageSrc);
    }),
    updateLocaleParity: localizedUpdateIssues.length === 0,
    batchDetails: updateItemResults.every((entry, index) => entry?.item?.wiki_name === updateItems[index]?.name) && updateCreatureResults.every((entry, index) => entry?.name === updateCreatures[index]?.name && entry?.implemented === "15.32.fc9100"),
    booksAndIndexes: (creatures?.items?.length || 0) === canonical.records.creatures.length && !creatures?.items?.some((entry) => entry?.name === "Yellow Worm") && (books?.total || 0) > 0 && book?.detail?.englishText === canonical.records.books[0]?.englishText && book?.detail?.translatedText === canonical.records.books[0]?.translatedText,
    bookNumericOrder: numericBookStartsAfterLetters(allBooksNameAsc) && numericBookStartsAfterLetters(allBooksNameDesc),
    fullItemIndex: suggestionSlugs.size === canonical.records.items.length
      && missingSuggestionSlugs.length === 0
      && extraSuggestionSlugs.length === 0
      && suggestionSlugs.has("cow-bell")
      && suggestionSlugs.has("cowbell")
      && suggestionSlugs.has("gemmed-book")
      && suggestionSlugs.has("book-gemmed"),
    localizedLibraryRoutes: runtimeApiSource.includes('"fetch-books-documents"')
      && appSource.includes("function localizeSpellRecord")
      && appSource.includes("state.spells.loaded = false"),
    reviewedPhraseParity: translatePhraseSync("en", "Combate corpo a corpo. Foge com vida baixa.", phraseEn) === "Fights in melee combat. Flees at low health."
      && translatePhraseSync("de", "Combate corpo a corpo. Foge com vida baixa.", phraseDe) === "Kämpft im Nahkampf. Flieht bei niedrigen Trefferpunkten.",
  };
  const result = {
    passed: Object.values(checks).every(Boolean),
    checks,
    networkCalls,
    item: item?.item?.wiki_name || item?.item?.name || "",
    npc: npc?.name || "",
    creature: creature?.name || "",
    foodItem: { slug: foodItem?.item?.slug, food: foodItem?.item?.food || null },
    technicalItem: {
      slug: technicalItem?.item?.slug,
      technicalLines: technicalItem?.item?.technical_description_lines?.length || 0,
      proficiency: technicalItem?.item?.proficiency?.length || 0,
      damageRows: technicalItem?.item?.damageTable?.length || 0,
      damageModel: technicalItem?.item?.damageModel || null,
      droppedBy: technicalItem?.item?.droppedBy?.length || 0,
      buy: technicalItem?.item?.npc_buy?.length || 0,
      sell: technicalItem?.item?.npc_sell?.length || 0
    },
    updateItem: newItem?.item?.wiki_name || newItem?.item?.name || "",
    updateItemDescriptionLines: newItem?.item?.description_lines || [],
    updateItemTechnicalDescriptionLines: newItem?.item?.technical_description_lines || [],
    updateItemNotes: newItem?.item?.notes || "",
    updateItemSeller: newItem?.item?.npc_sell?.[0] || null,
    exaltationItems: {
      sliver: { slug: sliver?.item?.slug, technical: sliver?.item?.technical_description_lines, facts: sliver?.item?.canonicalFacts },
      exaltedCore: { slug: exaltedCore?.item?.slug, technical: exaltedCore?.item?.technical_description_lines, facts: exaltedCore?.item?.canonicalFacts },
      dust: { slug: dust?.item?.slug, noteImage: dust?.item?.notes_image, notesStart: String(dust?.item?.notes || "").slice(0, 80) }
    },
    updateCreature: newCreature?.name || "",
    siteOnlyCreature: { slug: siteCreature?.slug || "", hitpoints: siteCreature?.hitpoints || null },
    siteOnlyItem: { slug: siteItem?.item?.slug || "", noteImage: siteItem?.item?.notes_image || "" },
    updateCreatureImplemented: newCreature?.implemented || "",
    updateBatch: { items: updateItems.length, openedItems: updateItemResults.filter((entry) => Boolean(entry?.item?.wiki_name)).length, creatures: updateCreatures.length, openedCreatures: updateCreatureResults.filter((entry) => Boolean(entry?.name)).length },
    updateLocaleIssues: localizedUpdateIssues,
    creatures: creatures?.items?.length || 0,
    books: books?.total || 0,
    bookOrderSample: {
      asc: allBooksNameAsc.slice(0, 8).map((entry) => entry?.name),
      desc: allBooksNameDesc.slice(0, 8).map((entry) => entry?.name)
    },
    itemSuggestions: suggestionSlugs.size,
    missingSuggestionSlugs: missingSuggestionSlugs.slice(0, 20),
    extraSuggestionSlugs: extraSuggestionSlugs.slice(0, 20)
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
}
