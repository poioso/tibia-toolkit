import { ALL_IMBUEMENT_INGREDIENT_NAMES } from "./imbuements-data.js";
import { createBoundedMemoryCache } from "./bounded-memory-cache.js";

import { getActiveLocale, normalizeLocale, setActiveLocale } from "../i18n/locale-state.js";
import { resolveLibraryPresentationTemplate, validateLibraryPresentationContract } from "../catalog-sync/library-presentation-contract.js";
import { loadAuthoritativeWorldCatalog, normalizeRegularWorldCatalog, resolveWorldSlug } from "./world-catalog.js";

const DEFAULT_WORLD = "antica";
const DEFAULT_ITEM = "tibia-coins";
const CACHE_TTL_MS = 1000 * 60 * 15;
const PERSISTED_DYNAMIC_CACHE_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;
const MARKET_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const IMBUEMENT_CACHE_TTL_MS = 1000 * 60 * 60;
const IMBUEMENT_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const STATIC_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 90;
const WORLD_CACHE_KEY = "world-data:v2";
const WORLD_CACHE_TTL_MS = 1000 * 60 * 10;
const WORLD_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const CHARACTER_PROFILE_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const CHARACTER_PROFILE_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const CHARACTER_PROFILE_CACHE_VERSION = "v2";
const CHARACTER_PROFILE_FETCH_CONCURRENCY = 2;
const CHARACTER_PROFILE_FETCH_ATTEMPTS = 3;
const CHARACTER_PROFILE_RETRY_BASE_MS = 180;
const CURRENCY_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const ITEM_SPRITE_VERSION = "tibiadata-assets-api-v2";
const ITEM_CACHE_VERSION = "canonical-site-v11";
const ITEM_BUNDLE_CACHE_MARKER_KEY = "item-bundle-cache-marker";
const CREATURE_DETAIL_CACHE_VERSION = "canonical-site-v17";
// v4 reparses GuildStats `const daysRound`, restoring the live current-day
// marker and date-cycle filter instead of serving the old incomplete cache.
const BOSS_TRACKER_CACHE_VERSION = "v5";
const ITEM_METADATA_BUNDLE_PATH = "assets/library/catalogs/item-metadata.json";
const ITEM_DETAILS_BUNDLE_PATH = "assets/library/catalogs/item-details.json";
const ITEM_SUPPLEMENTS_BUNDLE_PATH = "assets/library/catalogs/item-supplements.json";
const ITEM_DROPPED_BY_OVERRIDES_BUNDLE_PATH = "assets/library/catalogs/item-dropped-by-overrides.json";
const ITEM_PROFICIENCY_DAMAGE_BUNDLE_PATH = "assets/library/catalogs/item-proficiency-damage.json";
const ITEM_NPC_TRADES_BUNDLE_PATH = "assets/library/catalogs/item-npc-trades.json";
const ITEM_AUDIT_CORRECTIONS_BUNDLE_PATH = "assets/library/catalogs/item-audit-corrections.json";
const ITEM_LOOT_AUDIT_CORRECTIONS_BUNDLE_PATH = "assets/library/catalogs/item-loot-audit-corrections.json";
const ITEM_BUNDLE_REVISIONS_PATH = "assets/library/catalogs/item-bundle-revisions.json";
const WEEKLY_TASK_ITEMS_BUNDLE_PATH = "assets/library/catalogs/weekly-task-items.json";
const ITEM_SPRITE_ATLAS_BUNDLE_PATH = "assets/library/catalogs/item-sprite-atlas.json";
const STASH_CATALOG_BUNDLE_PATH = "assets/library/catalogs/stash-catalog.json";
const ITEM_CANONICAL_IDENTITIES = Object.freeze({
  "ferumbras-staff-enchanted": {
    slug: "ferumbras-staff-enchanted-wand",
    name: "Ferumbras' Staff (Enchanted Wand)",
    pageTitle: "Ferumbras'_Staff_(Enchanted_Wand)"
  },
  "ferumbras-staff-failed": {
    slug: "ferumbras-staff-wand",
    name: "Ferumbras' Staff (Wand)",
    pageTitle: "Ferumbras'_Staff_(Wand)"
  }
});
const ITEM_PROFICIENCY_SOURCE_SLUG_BY_ITEM_SLUG = Object.freeze({
  "ferumbras-staff-enchanted": "ferumbras-staff-enchanted-wand",
  "ferumbras-staff-failed": "ferumbras-staff-wand"
});
const ITEM_SLUG_ALIASES = {
  "ferumbras-staff-enchanted": "ferumbras-staff-enchanted-wand",
  "ferumbras-staff-failed": "ferumbras-staff-wand",
  encyclopedia: "encyclopedia-replica",
  "botanist-s-container": "botanists-container",
  "heliodor-s-scrolls": "heliodors-scrolls",
  "rainbow-quartzes": "rainbow-quartz",
  cherries: "cherry",
  "ritual-teeth": "ritual-tooth",
  potatoes: "potato",
  tomatoes: "tomato",
  grape: "grapes",
  "throwing-knives": "throwing-knife",
  "veins-of-ore": "vein-of-ore",
  "music-sheet-first": "music-sheet-first-verse",
  "music-sheet-second": "music-sheet-second-verse",
  "music-sheet-third": "music-sheet-third-verse",
  "music-sheet-fourth": "music-sheet-fourth-verse",
  "blue-coloured-egg": "coloured-egg-blue",
  "green-coloured-egg": "coloured-egg-green",
  "purple-coloured-egg": "coloured-egg-purple",
  "red-coloured-egg": "coloured-egg-red",
  "yellow-coloured-egg": "coloured-egg-yellow",
  "blue-piece-of-clothes": "blue-piece-of-cloth",
  "brown-piece-of-clothes": "brown-piece-of-cloth",
  "green-piece-of-clothes": "green-piece-of-cloth",
  "red-piece-of-clothes": "red-piece-of-cloth",
  "white-piece-of-clothes": "white-piece-of-cloth",
  "yellow-piece-of-clothes": "yellow-piece-of-cloth",
  "small-rubbies": "small-ruby",
  "rusty-armor": "rusted-armor",
  "moonsilver-crystals-1": "moonsilver-crystals",
  "gold-coin-always": "gold-coin",
  "platinum-coin-always": "platinum-coin",
  "gold-token-always": "gold-token",
  "silver-token-always": "silver-token",
  "crystal-arrow-always": "crystal-arrow",
  "balista-bolt": "ballista-bolt",
  "balista-bolts": "ballista-bolt",
  "ballista-bolts": "ballista-bolt",
  "piecing-bolt": "piercing-bolt",
  "piecing-bolts": "piercing-bolt",
  "piercing-bolts": "piercing-bolt",
  "power-bolts": "power-bolt"
};
const ITEM_MARKETABILITY_OVERRIDES = {
  "power-bolt": "yes"
};
const NPC_DETAILS_BUNDLE_PATH = "assets/library/catalogs/npc-details.json";
const NPC_INDEX_BUNDLE_PATH = "assets/library/catalogs/npc-index.json";
const NPC_JOB_OVERRIDES_BUNDLE_PATH = "assets/library/catalogs/npc-job-overrides.json";
const NPC_AUDIT_CORRECTIONS_BUNDLE_PATH = "assets/library/catalogs/npc-audit-corrections.json";
const CREATURE_INDEX_BUNDLE_PATH = "assets/library/catalogs/creature-index.json";
const CREATURE_STATUS_OVERRIDES_BUNDLE_PATH = "assets/library/catalogs/creature-status-overrides.json";
const CREATURE_AUDIT_CORRECTIONS_BUNDLE_PATH = "assets/library/catalogs/creature-audit-corrections.json";
const CREATURE_LOOT_AUDIT_CORRECTIONS_BUNDLE_PATH = "assets/library/catalogs/creature-loot-audit-corrections.json";
const BOSS_TABLE_AUDIT_CORRECTIONS_BUNDLE_PATH = "assets/library/catalogs/boss-table-audit-corrections.json";
const LIBRARY_SPRITE_PATHS_BUNDLE_PATH = "assets/library/catalogs/library-sprite-paths.json";
const BOOKS_DOCUMENTS_AUDIT_PATH = "assets/library/books/documents/tibiawiki.audit.json";
// Generated from site/lib/library-data.ts.  Detail screens consume this
// resolved document instead of independently reinterpreting raw audit files.
const SITE_LIBRARY_CANONICAL_PATH = "assets/library/catalogs/site-library-canonical.json";
const SITE_LIBRARY_CHUNKS_MANIFEST_PATH = "assets/library/chunks/manifest.json";
const SITE_LIBRARY_CHUNKS_ROOT = "assets/library/chunks";
const SITE_LIBRARY_CHUNK_CACHE_LIMIT = 8;
const TIBIA_TOOLKIT_MARKET_BRIDGE_BASE = "https://tibiatoolkit.com/api/app-market";
const DEFAULT_GAME_DATA_HUB_BASE = "https://tibiatoolkit.com/api/app-game";
const TIBIA_DATA_API_BASE = "https://api.tibiadata.com/v4";
const GAME_DATA_HUB_BOSS_TIMEOUT_MS = 6500;
const TIBIA_DATA_BOOSTED_TIMEOUT_MS = 8500;
// A handful of old snapshots retained MediaWiki presentation fragments. The
// factual source is kept in the audit bundle; these are only its already
// reviewed display equivalents, shared with the site so the desktop app does
// not show a different document to the user.
const FACTUAL_NARRATIVE_OVERRIDES = {
  "bibby-bloodbath": [
    "Esta é um orc fêmea. Este boss utiliza o sistema de recompensa. Ela aparece num forte durante a Mini World Change Bibby Bloodbath na saída norte de Carlin (32350,31720,7:2 aqui) ou ao norte do Jakundaf Desert (32680,32043,7:2 aqui) ou ao leste de Femor Hills (32623,31826,7:2 aqui). Você só poderá invadir o forte e lutar contra os orcs uma vez por aparição (você pode derrotá-los após ocorrer outra aparição, desde que sua última batalha tenha sido finalizada a mais de 24 horas). Caso você tente entrar novamente no forte após matá-la em sua aparição, a mensagem abaixo aparecerá:",
    "***You already defeated Bibby Bloodbath, she will abandon these lands.***\n*Você já derrotou Bibby Bloodbath, ela abandonará essas terras*.",
    "* Ao derrotar este boss pela primeira vez, você receberá o achievement **\"Bibby's Bloodbath\"**."
  ].join("\n\n"),
  "drume": [
    "É um dos líderes usurpadores tentando assumir o controle da Ordem do Leão.",
    "* Faz parte de The Order of the Lion Quest."
  ].join("\n\n"),
  "ancient-spawn-of-morgathla": [
    "Trata-se de um World Boss acessível apenas para quem completou as Warzones 4, 5 e 6.",
    "Há rumores em torno desse boss em relação ao Soul Ruby, sendo ele citado inclusive no livro Morgathla Reveals the Secrets of the Mask, especula-se que existe a possibilidade do Soul Ruby ser um loot raro deste boss. E dizem que ao usar a ruby no Helmet of the Ancients, o mesmo irá revelar seu poder máximo para sempre.",
    [
      "* A sala de acesso ao boss fica abaixo do NPC Gnomus, clicando no grande cristal vermelho, (33749,32160,15:1 aqui).",
      "* Para conseguir entrar no boss é necessário tocar o Gong com uma Strange Mallet, que é obtida como loot dos bosses das Warzones 4, 5 e 6 em 3 partes: Mallet Handle, Mallet Head e Mallet Pommel.",
      "* Após derrotá-lo e abrir o baú de recompensa, você receberá o achievement \"**Scourge of Scarabs**\"."
    ].join("\n")
  ].join("\n\n")
};
// Mini World Changes must use the same public route as the website so both
// surfaces read the single current snapshot maintained by the site Hub.
const MINI_WORLD_CHANGES_PUBLIC_API_BASE = "https://tibiatoolkit.com/api/mini-world-changes";
const MARKET_API_TIMEOUT_MS = 8000;
const MARKET_SNAPSHOT_TIMEOUT_MS = 3500;
const MARKET_SNAPSHOT_SCHEMA_VERSION = 1;
const FALLBACK_BASE_TIMEOUT_MS = 2500;
const TIBIAWIKI_DATA_API_BASE = "https://tibiadata.bytewizards.de/api/v1";
const TIBIAWIKI_DATA_PAGE_SIZE = 100;
const FIND_PARTY_WORLD_CACHE_TTL_MS = 1000 * 60;
const FIND_PARTY_WORLD_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const FIND_PARTY_GUILDS_CACHE_TTL_MS = 1000 * 60 * 15;
const FIND_PARTY_GUILDS_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const FIND_PARTY_GUILD_MEMBERS_CACHE_TTL_MS = 1000 * 60 * 10;
const FIND_PARTY_GUILD_MEMBERS_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const CREATURE_CATEGORY_DEFINITIONS = [
  { slug: "anfibios", label: "Anfibios", titles: ["Amphibians"], fallback: ["Azure Frog"] },
  { slug: "aquaticos", label: "Aquaticos", titles: [], fallback: ["Quara Predator", "Quara Constrictor", "Quara Hydromancer", "Quara Mantassin", "Quara Pincher"] },
  { slug: "aves", label: "Aves", titles: ["Birds"], fallback: ["Carnivostrich"] },
  { slug: "bosses", label: "Bosses", titles: ["Bosses"], fallback: ["Abyssador"] },
  { slug: "constructos", label: "Constructos", titles: ["Golems"], fallback: ["Worker Golem", "War Golem", "Metal Gargoyle"] },
  { slug: "criaturas-magicas", label: "Criaturas Magicas", titles: [], fallback: ["Wisp", "Gazer", "Bonelord", "Elder Bonelord"] },
  { slug: "demonios", label: "Demonios", titles: ["Demons"], fallback: ["Demon"] },
  { slug: "dragoes", label: "Dragoes", titles: ["Dragons"], fallback: ["Dragon"] },
  { slug: "elementais", label: "Elementais", titles: ["Elementals"], fallback: ["Fire Elemental"] },
  { slug: "extra-dimensionais", label: "Extra Dimensionais", titles: [], fallback: ["Reality Reaver", "Breach Brood", "Dread Intruder", "Sparkion"] },
  { slug: "fadas", label: "Fadas", titles: [], fallback: ["Pixie", "Twisted Pooka", "Dark Faun", "Faun"] },
  { slug: "gigantes", label: "Gigantes", titles: ["Giants"], fallback: ["Cyclops"] },
  { slug: "humanos", label: "Humanos", titles: ["Humans"], fallback: ["Bandit"] },
  { slug: "humanoides", label: "Humanoides", titles: ["Humanoids"], fallback: ["Orc"] },
  { slug: "imortais", label: "Imortais", titles: [], fallback: ["Ferumbras", "Gaz'Haragoth", "Mawhawk"] },
  { slug: "inkborn", label: "Inkborn", titles: ["Inkborn"], fallback: ["Inkwing"] },
  { slug: "licantropos", label: "Licantropos", titles: ["Lycanthropes"], fallback: ["Werewolf"] },
  { slug: "mamiferos", label: "Mamiferos", titles: ["Mammals"], fallback: ["Wolf"] },
  { slug: "mortos-vivos", label: "Mortos-Vivos", titles: ["Undead", "Ghosts", "Skeletons", "Vampires", "Zombies"], fallback: ["Skeleton"] },
  { slug: "plantas", label: "Plantas", titles: ["Plants"], fallback: ["Carniphila"] },
  { slug: "repteis", label: "Repteis", titles: ["Reptiles"], fallback: ["Crocodile"] },
  { slug: "slimes", label: "Slimes", titles: [], fallback: ["Slime", "Acid Blob", "Death Blob", "Mercury Blob"] },
  { slug: "the-ruthless-seven", label: "The Ruthless Seven", titles: ["The Ruthless Seven"], fallback: ["Ghazbaran"] },
  { slug: "triangle-of-terror", label: "Triangle of Terror", titles: ["Triangle of Terror"], fallback: ["Morgaroth"] },
  { slug: "vermes", label: "Vermes", titles: ["Worms"], fallback: ["Rotworm"] }
];
const TIBIAWIKI_DATA_PAGE_BATCH_SIZE = 4;
const TIBIAWIKI_DATA_RETRY_LIMIT = 3;
const FILTERABLE_ITEM_CATEGORIES = new Set([
  "Amulets and Necklaces",
  "Area Runes",
  "Armor",
  "Armors",
  "Attack Runes",
  "Axe Weapons",
  "Backpacks",
  "Beds",
  "Blessing Charms",
  "Books",
  "Boots",
  "Bows",
  "Closets",
  "Clothing Accessories",
  "Club Weapons",
  "Coffins",
  "Containers",
  "Contest Prizes",
  "Creature Products",
  "Crossbows",
  "Decorations",
  "Dividers",
  "Diving Equipment",
  "Documents and Papers",
  "Dolls and Bears",
  "Enchanted Items",
  "Fansite Items",
  "Field Runes",
  "Fist Fighting Weapons",
  "Food",
  "Furniture",
  "Game Tokens",
  "Healing Runes",
  "Helmets",
  "Keys",
  "Kitchen Tools",
  "Legs",
  "Light Sources",
  "Liquids",
  "Magical Items",
  "Metals",
  "Musical Instruments",
  "Painting Equipment",
  "Party Items",
  "Plants and Herbs",
  "Potions",
  "Quest Items",
  "Quivers",
  "Refuse",
  "Replicas",
  "Rings",
  "Rods",
  "Rubbish",
  "Runes",
  "Shields",
  "Spellbooks",
  "Summon Runes",
  "Support Runes",
  "Sword Weapons",
  "Taming Items",
  "Throwing Weapons",
  "Tools",
  "Trophies",
  "Valuables",
  "Wands"
]);
const NPC_IMAGE_FALLBACKS = {
  hireling: "assets/library/npcs/icons/Hireling_(Trader).gif",
  "wes the blacksmith": "assets/library/npcs/icons/Wes_The_Blacksmith.gif",
  'hireling "trader"': "assets/library/npcs/icons/Hireling_(Trader).gif",
  "hireling trader": "assets/library/npcs/icons/Hireling_(Trader).gif"
};
const NPC_DETAIL_OVERRIDES = {
  "a-beautiful-girl": {
    job: "Informer",
    location: "Inside Devovorga's lair",
    spoilers: [
      {
        title: "Spoiler",
        text: "Faz parte do evento Rise of Devovorga. Fale com ela para acordar a Devovorga, sua verdadeira forma."
      }
    ]
  },
  "a-blue-stone": {
    name: "a blue stone",
    pageTitle: "A_blue_stone",
    imageFile: "A_blue_stone.gif",
    job: "Roleplay",
    location: "Murmuring Wilderness",
    implemented: "futuro",
    notes: "Compre itens com hi - ice shards.",
    trade: "yes",
    map: {
      x: 33792,
      y: 32673,
      z: 7,
      url: "https://tibiamaps.io/map#33792,32673,7:2"
    }
  },
  "a-tortured-soul": {
    job: "Roleplay",
    location: "Ghostlands, two floors up",
    notes: "Esse Ã© um NPC que nÃ£o pode ser alcanÃ§ado. Quando vocÃª se aproxima dele, ele desaparece. NÃ£o existem histÃ³rias sobre esse personagem fantasma."
  },
  "altar-npc": {
    job: "Roleplay",
    location: "Blood Vestibule",
    spoilers: [
      {
        title: "Spoiler",
        text: "Faz parte da Rotten Blood Quest."
      }
    ]
  },
  bron: {
    job: "Outfitter"
  }
};
const CREATURE_DETAIL_OVERRIDES = {
  "ancient-spawn-of-morgathla": {
    pageTitle: "Ancient_Spawn_of_Morgathla",
    imageFile: "Ancient_Spawn_of_Morgathla.gif"
  },
  "ascending-ferumbras": {
    behaviour: "NÃ£o Ã© possÃ­vel bloquear o respawn dessa criatura.",
    location: "Halls of Ascension."
  },
  "dreadful-disruptor": {
    imageFile: "Dreadful_Disruptor.gif"
  },
  infernalist: {
    charms: 50,
    behaviour: "NÃ£o Ã© possÃ­vel bloquear o respawn dessa criatura. Combate Ã  distÃ¢ncia. Foge com a vida baixa.",
    location: "Demona, Edron Northern Ruins, Fury Hell, Yalahar Magician Quarter."
  }
};
const CREATURE_LOOT_RARITY_OVERRIDES = {
  "eldritch-dragon-lord": {
    "fiery-crypt-rune": "very-rare"
  }
};
const BESTIARY_CHARM_POINTS = {
  harmless: 1,
  trivial: 5,
  easy: 15,
  medium: 25,
  hard: 50,
  challenging: 100
};

const endpointNextRunByPath = new Map();
const endpointQueueByPath = new Map();
const marketRequestsInFlight = new Map();
// Keep persistent storage as the source of truth while bounding renderer-memory
// growth. This cache is limited to data-service entries and is unrelated to
// native overlays, capture, focus or screen-vision windows.
const memoryCache = createBoundedMemoryCache({ maxEntries: 256 });
// Several item cards can request the same persistent world/snapshot entry at
// once. Coalesce only the storage read; cache TTL/retention decisions remain
// individual to each caller below.
const cacheStorageReadPromises = new Map();
const backgroundRefreshKeys = new Set();

let itemMetadataIndexPromise = null;
let itemMetadataIndexValue = null;
let weeklyTaskItemNamesPromise = null;
let weeklyTaskItemNamesValue = null;
let itemSpriteAtlasPromise = null;
let itemSpriteAtlasValue = null;
let itemDetailsIndexPromise = null;
let itemDetailsIndexValue = null;
let itemDroppedByOverridesPromise = null;
let itemDroppedByOverridesValue = null;
let itemProficiencyDamageValue = null;
let itemNpcTradesValue = null;
let itemAuditCorrectionsPromise = null;
let itemAuditCorrectionsValue = null;
let itemLootAuditCorrectionsPromise = null;
let itemLootAuditCorrectionsValue = null;
let npcDetailsIndexPromise = null;
let npcDetailsIndexValue = null;
let npcJobOverridesPromise = null;
let npcJobOverridesValue = null;
let npcAuditCorrectionsPromise = null;
let npcAuditCorrectionsValue = null;
let npcIndexBundleValue = null;
let creatureIndexBundleValue = null;
let creatureStatusOverridesPromise = null;
let creatureStatusOverridesValue = null;
let creatureAuditCorrectionsPromise = null;
let creatureAuditCorrectionsValue = null;
let creatureLootAuditCorrectionsPromise = null;
let creatureLootAuditCorrectionsValue = null;
let bossTableAuditCorrectionsPromise = null;
let bossTableAuditCorrectionsValue = null;
let librarySpritePathsPromise = null;
let librarySpritePathsValue = null;
let booksDocumentsCatalogPromise = null;
let siteLibraryCanonicalPromise = null;
let siteLibraryCanonicalValue = null;
let siteLibraryChunkIndexPromise = null;
let siteLibraryChunkIndexValue = null;
const siteLibraryChunkCache = new Map();
let stashCatalogPromise = null;
let stashCatalogValue = null;
let stashCatalogLoaded = false;
// Profile lookups are session data, not the persistent catalogue. Keep a
// small LRU so long sessions with many character names cannot grow the
// renderer-side memory indefinitely.
const characterProfileCache = createBoundedMemoryCache({ maxEntries: 64 });
const characterProfileRequestPromises = new Map();
let storageCacheCleanupPromise = null;
let worldCatalogRequestPromise = null;
let dataServiceRuntime = createUnsupportedRuntime();

export function configureDataService(runtime) {
  dataServiceRuntime = {
    ...createUnsupportedRuntime(),
    ...runtime
  };
}

export function resetLibraryContentCaches() {
  itemMetadataIndexPromise = null;
  itemMetadataIndexValue = null;
  weeklyTaskItemNamesPromise = null;
  weeklyTaskItemNamesValue = null;
  itemSpriteAtlasPromise = null;
  itemSpriteAtlasValue = null;
  itemDetailsIndexPromise = null;
  itemDetailsIndexValue = null;
  itemDroppedByOverridesPromise = null;
  itemDroppedByOverridesValue = null;
  itemProficiencyDamageValue = null;
  itemNpcTradesValue = null;
  itemAuditCorrectionsPromise = null;
  itemAuditCorrectionsValue = null;
  itemLootAuditCorrectionsPromise = null;
  itemLootAuditCorrectionsValue = null;
  npcDetailsIndexPromise = null;
  npcDetailsIndexValue = null;
  npcJobOverridesPromise = null;
  npcJobOverridesValue = null;
  npcAuditCorrectionsPromise = null;
  npcAuditCorrectionsValue = null;
  npcIndexBundleValue = null;
  creatureIndexBundleValue = null;
  creatureStatusOverridesPromise = null;
  creatureStatusOverridesValue = null;
  creatureAuditCorrectionsPromise = null;
  creatureAuditCorrectionsValue = null;
  creatureLootAuditCorrectionsPromise = null;
  creatureLootAuditCorrectionsValue = null;
  bossTableAuditCorrectionsPromise = null;
  bossTableAuditCorrectionsValue = null;
  librarySpritePathsPromise = null;
  librarySpritePathsValue = null;
  booksDocumentsCatalogPromise = null;
  siteLibraryCanonicalPromise = null;
  siteLibraryCanonicalValue = null;
  siteLibraryChunkIndexPromise = null;
  siteLibraryChunkIndexValue = null;
  siteLibraryChunkCache.clear();
  stashCatalogPromise = null;
  stashCatalogValue = null;
  stashCatalogLoaded = false;
  return { reset: true };
}

export async function handleDataServiceMessage(message) {
  switch (message?.type) {
    case "activate-library-content":
      return resetLibraryContentCaches();
    case "set-locale":
      return { locale: setActiveLocale(message?.payload?.locale) };
    case "bootstrap":
      return getBootstrapData();
    case "fetch-item":
      return getItemData(message.payload);
    case "fetch-item-static":
      return getStaticItemData(message.payload);
    case "fetch-stash-item-preview":
      return getStashItemPreview(message.payload);
    case "fetch-item-suggestions":
      return getItemSuggestions(message.payload);
    case "fetch-stash-items":
      return getStashItems();
    case "fetch-books-documents":
      return getBooksDocuments(message.payload);
    case "fetch-stash-market-values":
      return getStashMarketValues(message.payload);
    case "get-stash-market-refresh-status":
      return requestManualStashMarketRefresh({ consume: false });
    case "reserve-stash-market-refresh":
      return requestManualStashMarketRefresh({ consume: true });
    case "fetch-npc-index":
      return getNpcIndex();
    case "fetch-npc-detail":
      return getNpcDetailForUi(message.payload);
    case "fetch-creature-index":
      return getCreatureIndex();
    case "fetch-creature-detail":
      return getCreatureDetail(message.payload);
    case "fetch-boss-tracker":
      return getBossTrackerForUi(message.payload);
    case "fetch-mini-world-changes":
      return getMiniWorldChangesForUi(message.payload);
    case "fetch-boosted":
      return getBoostedForUi();
    case "fetch-character-profiles":
      return getCharacterProfiles(message.payload);
    case "fetch-find-party-snapshot":
      return getFindPartySnapshot(message.payload);
    case "fetch-find-party-guild-members":
      return getFindPartyGuildMembers(message.payload);
    case "fetch-currency-rates":
      return getCurrencyRates(message.payload);
    case "fetch-imbuement-market":
      return getImbuementMarket(message.payload);
    case "fetch-ingredient-metadata":
      return getIngredientMetadata(message.payload);
    case "fetch-phrase-map":
      return getPhraseTranslationBundle(message.payload);
    default:
      throw new Error("Tipo de mensagem nao suportado.");
  }
}

async function getBoostedForUi() {
  const [creaturesPayload, bossesPayload] = await Promise.all([
    fetchTibiaDataBoostedJson("/creatures"),
    fetchTibiaDataBoostedJson("/boostablebosses")
  ]);
  const creature = creaturesPayload?.creatures?.boosted || null;
  const boss = bossesPayload?.boostable_bosses?.boosted || null;
  if (!creature?.name || !boss?.name) {
    throw new Error("A API TibiaData retornou dados incompletos de Boosted.");
  }

  return {
    creature: {
      name: String(creature.name),
      image: typeof creature.image_url === "string" ? creature.image_url : null
    },
    boss: {
      name: String(boss.name),
      image: typeof boss.image_url === "string" ? boss.image_url : null
    },
    updatedAt: creaturesPayload?.information?.timestamp || bossesPayload?.information?.timestamp || ""
  };
}

async function fetchTibiaDataBoostedJson(path) {
  const response = await fetchWithTimeout(
    `${TIBIA_DATA_API_BASE}${path}`,
    TIBIA_DATA_BOOSTED_TIMEOUT_MS,
    { Accept: "application/json" }
  );
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Falha ao consultar TibiaData (${response.status}): ${body}`);
  }

  try {
    return JSON.parse(body);
  } catch (_error) {
    throw new Error("A resposta da API TibiaData nao e um JSON valido.");
  }
}

// Character profiles are one of the public TibiaData surfaces. Keep this
// lookup independent from the private Game Data Hub so a Hub route change
// cannot break Find Party or the character helper in the desktop app.
async function fetchTibiaDataCharacterJson(name) {
  let lastError = null;

  for (let attempt = 0; attempt < CHARACTER_PROFILE_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        `${TIBIA_DATA_API_BASE}/character/${encodeURIComponent(name)}`,
        GAME_DATA_HUB_BOSS_TIMEOUT_MS,
        { Accept: "application/json" }
      );
      const body = await response.text();

      if (!response.ok) {
        const error = new Error(`Falha ao consultar TibiaData (${response.status}): ${body}`);
        error.status = response.status;

        if (response.status === 404 || !isRetryableCharacterProfileError(error)) {
          throw error;
        }

        lastError = error;
        if (attempt + 1 < CHARACTER_PROFILE_FETCH_ATTEMPTS) {
          await delay(getCharacterProfileRetryDelayMs(response, attempt));
          continue;
        }
        throw error;
      }

      try {
        return JSON.parse(body);
      } catch (_error) {
        throw new Error("A API TibiaData retornou uma resposta inválida para personagem.");
      }
    } catch (error) {
      lastError = error;
      if (
        error?.status === 404
        || !isRetryableCharacterProfileError(error)
        || attempt + 1 >= CHARACTER_PROFILE_FETCH_ATTEMPTS
      ) {
        throw error;
      }
      await delay(getCharacterProfileRetryDelayMs(null, attempt));
    }
  }

  throw lastError || new Error("Falha ao consultar personagem no TibiaData.");
}

async function fetchOfficialTibiaCharacterJson(name) {
  const response = await fetchWithTimeout(
    `https://www.tibia.com/community/?subtopic=characters&name=${encodeURIComponent(name)}`,
    GAME_DATA_HUB_BOSS_TIMEOUT_MS,
    {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0 (compatible; TibiaToolkit/0.7.1)"
    }
  );
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`Falha ao consultar personagem no tibia.com (${response.status}).`);
  }

  const resolvedName = extractOfficialTibiaCharacterField(html, "Name");
  if (!resolvedName) {
    return { character: { character: null } };
  }

  return {
    character: {
      character: {
        name: resolvedName,
        sex: extractOfficialTibiaCharacterField(html, "Sex"),
        vocation: extractOfficialTibiaCharacterField(html, "Vocation"),
        level: toNumberOrNull(extractOfficialTibiaCharacterField(html, "Level")),
        world: extractOfficialTibiaCharacterField(html, "World"),
        guild: { name: "" }
      }
    }
  };
}

function extractOfficialTibiaCharacterField(html, label) {
  const escapedLabel = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(html || "").match(
    new RegExp(`<td[^>]*>\\s*(?:<nobr>)?${escapedLabel}:?(?:<\\/nobr>)?\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, "i")
  );
  return decodeOfficialTibiaHtmlText(match?.[1] || "");
}

function decodeOfficialTibiaHtmlText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isRetryableCharacterProfileError(error) {
  const status = Number(error?.status);
  return !Number.isFinite(status) || status === 429 || status >= 500;
}

function getCharacterProfileRetryDelayMs(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(3000, Math.round(retryAfter * 1000));
  }

  return CHARACTER_PROFILE_RETRY_BASE_MS * (2 ** attempt);
}

async function getMiniWorldChangesForUi(payload = {}) {
  const [catalogBundle, localeBundle] = await Promise.all([
    dataServiceRuntime.readJsonAsset("assets/mini-world-changes/catalog.json"),
    dataServiceRuntime.readJsonAsset("assets/localization/mini-world-changes.json").catch(() => ({}))
  ]);
  const worldName = String(payload?.worldName || "").trim();
  let activeWorld = null;
  let activeError = "";

  if (worldName) {
    try {
      const response = await fetchWithTimeout(
        `${MINI_WORLD_CHANGES_PUBLIC_API_BASE}?world=${encodeURIComponent(worldName)}`,
        GAME_DATA_HUB_BOSS_TIMEOUT_MS
      );
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`Falha ao consultar Mini World Changes (${response.status}): ${body}`);
      }
      activeWorld = JSON.parse(body)?.world || null;
    } catch (error) {
      activeError = error instanceof Error ? error.message : String(error || "");
    }
  }

  return {
    catalog: applyMiniWorldChangeTranslations(
      Array.isArray(catalogBundle?.entries) ? catalogBundle.entries : [],
      localeBundle?.translations || {}
    ),
    generatedAt: catalogBundle?.generatedAt || "",
    activeWorld,
    activeError
  };
}

function applyMiniWorldChangeTranslations(entries, translations) {
  const visit = (value, protectedContext = false) => {
    if (Array.isArray(value)) return value.map((entry) => visit(entry, protectedContext));
    if (!value || typeof value !== "object") return value;
    const nextProtected = protectedContext || value.type === "announcement" || value.type === "transcript";
    const next = Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, visit(entry, nextProtected)])
    );
    if (!nextProtected && value.type === "text" && translations[value.text]) {
      next.translations = translations[value.text];
    }
    return next;
  };
  return visit(entries);
}

function createUnsupportedRuntime() {
  return {
    marketApiBase: null,
    marketApiBases: [],
    gameDataHubBase: null,
    gameDataHubBases: [],
    supportersDataUrl: null,
    supportersDataUrls: [],
    getAssetUrl(relativePath) {
      return relativePath;
    },
    getLibraryMediaUrl(sitePath) {
      return sitePath;
    },
    getCachedImageUrl(_category, _key, sourceUrl) {
      return sourceUrl;
    },
    getLibraryCatalogState() {
      // Unknown runtimes retain the proven monolithic path. Desktop opts in
      // only after it can prove the generated chunks match its active base.
      return { activeHash: "", hasActiveBase: true, overlayChanges: 0 };
    },
    async readJsonAsset() {
      throw new Error("Runtime nao configurado para leitura de assets.");
    },
    async storageGet() {
      return {};
    },
    async storageSet() {},
    async storageRemove() {},
    async requestManualStashMarketRefresh() {
      throw new Error("A autorizacao do limite manual do market nao esta configurada.");
    }
  };
}

async function getBootstrapData() {
  void cleanupStorageCaches().catch(() => {});
  await invalidateItemCachesForUpdatedBundles().catch(() => {});
  const worlds = await fetchWorldCatalog({ forceFresh: true }).catch(() => []);

  return {
    worlds,
    defaultWorld: resolveWorldSlug(DEFAULT_WORLD, worlds),
    defaultItem: DEFAULT_ITEM,
    initialItem: null,
    quickPicks: [],
    supportersDataUrl: String(dataServiceRuntime.supportersDataUrl || "").trim() || null,
    supportersDataUrls: Array.isArray(dataServiceRuntime.supportersDataUrls)
      ? dataServiceRuntime.supportersDataUrls.map((url) => String(url || "").trim()).filter(Boolean)
      : []
  };
}

async function getPhraseTranslationBundle(payload) {
  const locale = normalizeLocale(payload?.locale);
  return dataServiceRuntime.readJsonAsset(`assets/localization/phrases.${locale}.json`);
}

async function invalidateItemCachesForUpdatedBundles() {
  // This runs before the first screen is rendered. Keep it intentionally tiny:
  // parsing the four full item bundles here added tens of MB of allocations at boot.
  const revisions = await dataServiceRuntime.readJsonAsset(ITEM_BUNDLE_REVISIONS_PATH).catch(() => null);
  const currentMarker = String(revisions?.revision || "").trim();

  // Older content packs can still start safely. They simply skip this one-time
  // cache invalidation rather than parsing every large bundle during boot.
  if (!currentMarker) {
    return;
  }
  const storedMarker = await dataServiceRuntime.storageGet(ITEM_BUNDLE_CACHE_MARKER_KEY).catch(() => ({}));
  const previousMarker = String(storedMarker?.[ITEM_BUNDLE_CACHE_MARKER_KEY]?.value || "");

  if (previousMarker === currentMarker) {
    return;
  }

  const allStored = await dataServiceRuntime.storageGet(null).catch(() => ({}));
  const cacheKeysToRemove = Object.keys(allStored).filter((key) =>
    key === "item-metadata" ||
    key.startsWith("wiki-item:") ||
    key.startsWith("item:") ||
    key.startsWith("item-static:")
  );

  if (cacheKeysToRemove.length > 0) {
    await dataServiceRuntime.storageRemove(cacheKeysToRemove);
    cacheKeysToRemove.forEach((key) => memoryCache.delete(key));
  }

  await putCache(ITEM_BUNDLE_CACHE_MARKER_KEY, currentMarker);
}

async function getItemData(payload) {
  const worldSlug = slugifyWorldName(payload?.worldSlug || "");
  const itemSlug = slugifyTibiaItemName(payload?.itemSlug || "");
  const forceFreshMarket = payload?.forceFreshMarket === true;

  if (!itemSlug) {
    throw new Error("Informe o slug do item.");
  }
  if (!worldSlug) throw new Error("Selecione um mundo disponível antes de consultar o market.");

  const cacheKey = `item:${ITEM_CACHE_VERSION}:${worldSlug}:${itemSlug}`;
  const cachedEntry = await getCacheEntry(cacheKey);
  const cached = cachedEntry?.value || null;
  const worlds = await fetchWorldCatalog();
  const selectedWorld = findWorldBySlug(worlds, worldSlug);

  if (!selectedWorld) {
    throw new Error("Mundo nao encontrado na base online.");
  }

  const cachedWorldUpdate = cached?.selectedWorld?.last_update || null;
  const currentWorldUpdate = selectedWorld?.last_update || null;
  const cachedMarketIsAuthoritative = hasMeaningfulMarketData(cached?.market);

  if (
    !forceFreshMarket &&
    cached &&
    !cachedEntry?.isExpired &&
    cachedMarketIsAuthoritative &&
    cachedWorldUpdate &&
    currentWorldUpdate &&
    cachedWorldUpdate === currentWorldUpdate
  ) {
    const cachedPayload = await applyDroppedByOverridesToCachedItemPayload(cached, cacheKey);
    return rebuildCachedItemPayloadFromCanonical(cachedPayload, itemSlug);
  }

  if (
    !forceFreshMarket &&
    cached &&
    !cachedEntry?.isExpired &&
    cachedMarketIsAuthoritative &&
    (!cachedWorldUpdate || !currentWorldUpdate)
  ) {
    const cachedPayload = await applyDroppedByOverridesToCachedItemPayload(cached, cacheKey);
    return rebuildCachedItemPayloadFromCanonical(cachedPayload, itemSlug);
  }

  return fetchFreshItemData({
    cacheKey,
    itemSlug,
    worldSlug,
    worlds,
    selectedWorld,
    forceFreshMarket,
    cachedResult: cached
  });
}

async function rebuildCachedItemPayloadFromCanonical(payload, itemSlug) {
  const canonicalDocument = await getCanonicalLibraryDocument("items", itemSlug);
  if (!canonicalDocument || !payload?.item) return payload;
  return {
    ...payload,
    // Market/world cache remains reusable, but the Library presentation must
    // never come from an older legacy payload. This prevents background
    // hydration from putting the wrong fields back after the canonical first
    // paint was already shown.
    item: await buildCanonicalItemRecord(canonicalDocument, payload.item)
  };
}

async function getStaticItemData(payload) {
  const worldSlug = slugifyWorldName(payload?.worldSlug || "");
  const itemSlug = slugifyTibiaItemName(payload?.itemSlug || "");

  if (!itemSlug) {
    throw new Error("Informe o slug do item.");
  }
  if (!worldSlug) throw new Error("Selecione um mundo disponível antes de consultar o item.");

  const cacheKey = `item-static:${ITEM_CACHE_VERSION}:${itemSlug}`;
  const worldCacheKey = `item:${ITEM_CACHE_VERSION}:${worldSlug}:${itemSlug}`;
  const cached = await getCache(cacheKey);
  const cachedWorldEntry = await getCacheEntry(worldCacheKey);
  const cachedWorldData = cachedWorldEntry?.value || null;
  const itemDetail = await resolveItemDetailBySlug(itemSlug);
  const selectedWorld = {
    ...(cachedWorldData?.selectedWorld || {}),
    name: cachedWorldData?.selectedWorld?.name || (worldSlug ? itemNameFromSlug(worldSlug) : ""),
    slug: worldSlug,
    last_update: cachedWorldData?.selectedWorld?.last_update || null,
    tc_price: cachedWorldData?.selectedWorld?.tc_price ?? null
  };
  const cachedSnapshotMarket = await getLocallyCachedWorldMarketEntry(selectedWorld, itemDetail.marketId);
  const cachedMarket = getPreferredMarketEntry(
    null,
    getPreferredMarketEntry(cachedWorldData?.market, cachedSnapshotMarket, itemDetail.marketId),
    itemDetail.marketId
  );

  if (cached?.item) {
    const cachedWithOverrides = await applyDroppedByOverridesToCachedItemPayload(cached, cacheKey);
    // Market data can stay cached, but the Library document is locale-aware.
    // Rebuild its presentation from the current canonical document instead of
    // returning the language in which this static cache was first populated.
    const canonicalDocument = await getCanonicalLibraryDocument("items", itemSlug);
    const item = canonicalDocument
      ? await buildCanonicalItemRecord(canonicalDocument, itemDetail?.__legacyItemMeta || null)
      : cachedWithOverrides.item;
    return {
      ...cachedWithOverrides,
      item,
      selectedWorld,
      market: cachedMarket,
      availableWorlds: cachedWorldData?.availableWorlds || cachedWithOverrides.availableWorlds || []
    };
  }

  const result = {
    item: await buildDetailedItemRecord(itemDetail),
    selectedWorld,
    market: cachedMarket,
    relatedItems: itemMetadataIndexValue ? buildRelatedItems(itemDetail, itemMetadataIndexValue) : [],
    availableWorlds: cachedWorldData?.availableWorlds || []
  };
  await putCache(cacheKey, result);
  return result;
}

// The Stash already loads this metadata index to render its grid. Return an
// immediate local preview first, then let the regular item request enrich NPC
// details and market data in the background.
async function getStashItemPreview(payload) {
  const worldSlug = slugifyWorldName(payload?.worldSlug || "");
  const itemSlug = slugifyTibiaItemName(payload?.itemSlug || "");

  if (!itemSlug) {
    throw new Error("Informe o slug do item.");
  }
  if (!worldSlug) throw new Error("Selecione um mundo disponível antes de consultar o item.");

  const metadataIndex = await getItemMetadataIndex();
  const itemMeta = findItemSummaryBySlugCandidates(
    metadataIndex,
    getItemLookupSlugCandidates(itemSlug)
  );

  if (!itemMeta) {
    throw new Error("Item nao encontrado no catalogo local.");
  }

  // The Stash first paint must use the same reviewed site document as the
  // regular item view. The legacy metadata record is only a safe fallback;
  // rendering it first caused fields such as classification, slots, added
  // version, notes and the green technical description to appear wrong until
  // the background hydration completed.
  const canonicalDocument = await getCanonicalLibraryDocument("items", itemSlug);
  const item = canonicalDocument
    ? await buildCanonicalItemRecord(canonicalDocument, itemMeta)
    : buildItemRecord(itemMeta);

  return {
    item,
    selectedWorld: {
      name: worldSlug ? itemNameFromSlug(worldSlug) : "",
      slug: worldSlug,
      last_update: null,
      tc_price: null
    },
    market: createEmptyMarketEntry(itemMeta.marketId),
    relatedItems: [],
    availableWorlds: []
  };
}

async function getLocallyCachedWorldMarketEntry(selectedWorld, marketId) {
  const normalizedMarketId = Number(marketId) || 0;

  if (!normalizedMarketId || !selectedWorld?.name) {
    return null;
  }

  const cacheKey = `market-world:${slugifyWorldName(selectedWorld.name)}`;
  const cachedEntry = await getCacheEntry(cacheKey);
  const cachedValue = normalizeCachedWorldMarketValue(cachedEntry?.value);
  const snapshotEntry = cachedValue?.values?.[normalizedMarketId] ?? cachedValue?.values?.[String(normalizedMarketId)] ?? null;

  if (!snapshotEntry) {
    return null;
  }

  if (
    cachedEntry?.isExpired &&
    (!selectedWorld.last_update || !cachedValue?.worldLastUpdate || cachedValue.worldLastUpdate === selectedWorld.last_update)
  ) {
    refreshCacheInBackground(cacheKey, () => fetchFreshCachedWorldMarketSnapshot(cacheKey, selectedWorld));
  }

  return normalizeCachedSnapshotMarketEntry(snapshotEntry, normalizedMarketId);
}

function normalizeCachedSnapshotMarketEntry(entry, marketId) {
  return {
    id: Number(marketId) || 0,
    time: null,
    captured_at: entry?.updatedAt || null,
    is_full_data: true,
    current: normalizeMarketNumber(entry?.current ?? entry?.sellOffer),
    buy_offer: normalizeMarketNumber(entry?.buyOffer),
    sell_offer: normalizeMarketNumber(entry?.sellOffer),
    month_average_sell: null,
    month_average_buy: null,
    month_sold: null,
    month_bought: null,
    active_traders: null,
    month_highest_sell: null,
    month_lowest_buy: null,
    month_lowest_sell: null,
    month_highest_buy: null,
    buy_offers: normalizeMarketNumber(entry?.buyOffers),
    sell_offers: normalizeMarketNumber(entry?.sellOffers),
    day_average_sell: null,
    day_average_buy: null,
    day_sold: null,
    day_bought: null,
    day_highest_sell: null,
    day_lowest_sell: null,
    day_highest_buy: null,
    day_lowest_buy: null,
    total_immediate_profit: null,
    total_immediate_profit_info: "",
    availability: null,
    demand: null,
    status: "cache local"
  };
}

async function fetchFreshItemData({
  cacheKey,
  itemSlug,
  worldSlug,
  worlds,
  selectedWorld,
  forceFreshMarket = false,
  cachedResult = null
}) {
  const [itemDetail, tibiaCoinDetail, goldTokenDetail] = await Promise.all([
    resolveItemDetailBySlug(itemSlug),
    resolveItemDetailBySlug("tibia-coins"),
    resolveItemDetailBySlug("gold-token")
  ]);

  const requestedIds = [
    itemDetail.marketId,
    tibiaCoinDetail?.marketId,
    goldTokenDetail?.marketId
  ];
  const marketEntries = await fetchMarketValues({
    serverName: selectedWorld.name,
    itemIds: requestedIds,
    bypassCache: forceFreshMarket
  }).catch((error) => {
    if (isMarketBackoffError(error)) {
      return [];
    }

    throw error;
  });
  let marketById = Object.fromEntries(
    marketEntries.map((entry) => [entry.id, normalizeMarketEntry(entry)])
  );
  let itemMarket = marketById[itemDetail.marketId] ?? null;

  if (!itemMarket) {
    const directEntries = await fetchMarketValues({
      serverName: selectedWorld.name,
      itemIds: [itemDetail.marketId],
      bypassCache: true
    }).catch((error) => {
      if (isMarketBackoffError(error)) {
        return [];
      }

      throw error;
    });
    const directMarketById = Object.fromEntries(
      directEntries.map((entry) => [entry.id, normalizeMarketEntry(entry)])
    );
    marketById = {
      ...marketById,
      ...directMarketById
    };
    itemMarket = marketById[itemDetail.marketId] ?? null;
  }

  itemMarket = getPreferredMarketEntry(itemMarket, cachedResult?.market, itemDetail.marketId);

  const tibiaCoinMarket = tibiaCoinDetail?.marketId ? marketById[tibiaCoinDetail.marketId] ?? null : null;
  const goldTokenMarket = goldTokenDetail?.marketId ? marketById[goldTokenDetail.marketId] ?? null : null;
  const worldWithRates = {
    ...selectedWorld,
    tc_price: tibiaCoinMarket?.sell_offer ?? null
  };

  const result = {
    item: await buildDetailedItemRecord(itemDetail),
    selectedWorld: worldWithRates,
    market: itemMarket,
    currencyRates: {
      tibiaCoinPrice: tibiaCoinMarket?.sell_offer ?? null,
      goldTokenPrice: goldTokenMarket?.sell_offer ?? null
    },
    relatedItems: itemMetadataIndexValue ? buildRelatedItems(itemDetail, itemMetadataIndexValue) : [],
    availableWorlds: worlds
  };

  await putCache(`currency:${worldSlug}`, {
    worldSlug,
    tibiaCoinPrice: tibiaCoinMarket?.sell_offer ?? null,
    goldTokenPrice: goldTokenMarket?.sell_offer ?? null
  });
  // An empty placeholder without a capture timestamp means the live request
  // failed; it is not proof that the item has zero offers. Do not poison the
  // item cache with that transient state. A genuine zero-offer response still
  // has captured_at and remains cacheable through hasMeaningfulMarketData().
  if (hasMeaningfulMarketData(itemMarket)) {
    await putCache(cacheKey, result);
  }
  // Static library records are revised through the local audited content pack.
  // Never replace them behind the user's back with a live wiki response.
  void getItemMetadataIndex().catch(() => {});
  return result;
}

function getPreferredMarketEntry(primaryMarket, fallbackMarket, marketId = 0) {
  if (hasMeaningfulMarketData(primaryMarket)) {
    return primaryMarket;
  }

  if (hasMeaningfulMarketData(fallbackMarket)) {
    return {
      ...fallbackMarket,
      id: Number(fallbackMarket?.id) || Number(marketId) || 0,
      status: fallbackMarket?.status || "cache local"
    };
  }

  return createEmptyMarketEntry(marketId || primaryMarket?.id || fallbackMarket?.id || 0);
}

function hasMeaningfulMarketData(market) {
  return Boolean(
    market &&
    (
      (typeof market.sell_offers === "number" && market.sell_offers > 0) ||
      (typeof market.buy_offers === "number" && market.buy_offers > 0) ||
      (typeof market.sell_offer === "number" && market.sell_offer > 0) ||
      (typeof market.buy_offer === "number" && market.buy_offer > 0) ||
      market.captured_at
    )
  );
}

function getNpcTradeSignature(npcs) {
  return Array.isArray(npcs)
    ? npcs.map((npc) => ({
        name: npc?.name || "",
        price: typeof npc?.price === "number" ? npc.price : null
      }))
    : [];
}

async function getCurrencyRates(payload) {
  const worldSlug = slugifyWorldName(payload?.worldSlug || "");
  if (!worldSlug) throw new Error("Selecione um mundo disponível antes de consultar as moedas.");
  const forceFresh = payload?.forceFresh === true;
  const cacheKey = `currency:${worldSlug}`;
  const cachedEntry = await getCacheEntry(cacheKey, {
    retentionMs: CURRENCY_CACHE_RETENTION_MS
  });
  const cached = cachedEntry?.value || null;

  if (!forceFresh && cached && hasCurrencyRateValue(cached)) {
    if (cachedEntry.isExpired) {
      refreshCacheInBackground(cacheKey, () => fetchFreshCurrencyRates({ worldSlug, cacheKey, cached }));
    }

    return cached;
  }

  return fetchFreshCurrencyRates({ worldSlug, cacheKey, cached });
}

async function fetchFreshCurrencyRates({ worldSlug, cacheKey, cached = null }) {
  const fallbackCached = hasCurrencyRateValue(cached) ? cached : null;

  const [worlds, tibiaCoinDetail, goldTokenDetail] = await Promise.all([
    fetchWorldCatalog(),
    resolveItemDetailBySlug("tibia-coins"),
    resolveItemDetailBySlug("gold-token")
  ]);
  const selectedWorld = findWorldBySlug(worlds, worldSlug);

  if (!selectedWorld) {
    throw new Error("Mundo nao encontrado na base online.");
  }

  const requestedIds = [tibiaCoinDetail?.marketId, goldTokenDetail?.marketId].filter(Boolean);

  if (requestedIds.length === 0) {
    return {
      worldSlug,
      tibiaCoinPrice: null,
      goldTokenPrice: null
    };
  }

  let marketBackoff = false;
  const marketEntries = await fetchMarketValues({
    serverName: selectedWorld.name,
    itemIds: requestedIds,
    bypassCache: true
  }).catch((error) => {
    if (isMarketBackoffError(error)) {
      marketBackoff = true;
      return [];
    }

    throw error;
  });

  if (marketBackoff && fallbackCached) {
    return fallbackCached;
  }

  const marketById = Object.fromEntries(
    marketEntries.map((entry) => [entry.id, normalizeMarketEntry(entry)])
  );
  const result = {
    worldSlug,
    tibiaCoinPrice: tibiaCoinDetail?.marketId
      ? marketById[tibiaCoinDetail.marketId]?.sell_offer ?? selectedWorld.tc_price ?? null
      : selectedWorld.tc_price ?? null,
    goldTokenPrice: goldTokenDetail?.marketId ? marketById[goldTokenDetail.marketId]?.sell_offer ?? null : null
  };

  await putCache(cacheKey, result);
  return result;
}

function hasCurrencyRateValue(value) {
  return (
    typeof value?.tibiaCoinPrice === "number" ||
    typeof value?.goldTokenPrice === "number"
  );
}

async function getItemSuggestions(payload) {
  const query = String(payload?.query || "").trim();
  const showAll = Boolean(payload?.showAll);
  const offset = Math.max(0, Math.floor(Number(payload?.offset) || 0));
  // The locally audited Library now contains more than 6,000 items. A caller
  // that explicitly asks for the full local catalogue must not silently lose
  // the tail of that list; normal interactive suggestions remain capped at 20.
  const limit = Math.min(Math.max(Number(payload?.limit) || 8, 1), showAll ? 8000 : 20);

  if (query.length < 1 && !showAll) {
    return [];
  }

  const [metadataIndex, canonicalItems, itemSpriteAtlas] = await Promise.all([
    getItemMetadataIndex(),
    getCanonicalLibrarySummaries("items"),
    loadItemSpriteAtlas()
  ]);
  const canonicalItemSlugs = new Set(
    canonicalItems
      .map((record) => String(record?.slug || "").trim())
      .filter(Boolean)
  );
  const normalizedQuery = normalizeLookupValue(query);
  const slugQuery = slugifyTibiaItemName(query);

  return metadataIndex.items
    // The Website's canonical Library defines the public desktop catalogue.
    // Older cached bundles can contain retired aliases or legacy-only entries;
    // keep them available to their internal callers, but never surface them
    // in the user-facing Library search.
    .filter((item) => isVisibleUiItem(item) && (
      canonicalItemSlugs.has(String(item?.slug || "").trim())
      || item.catalogVisible === true
    ))
    .map((item) => {
      const score = showAll
        ? 0
        : [
            normalizeLookupValue(item.name),
            normalizeLookupValue(item.wiki_name),
            item.slug
          ].filter(Boolean).reduce((bestScore, value) => {
            if (!value) {
              return bestScore;
            }

            return Math.max(
              bestScore,
              scoreSuggestionValue(value, normalizedQuery),
              scoreSuggestionValue(value, slugQuery)
            );
          }, -1);

      return {
        score,
        item
      };
    })
    .filter((entry) => entry.score > -1)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (left.item.wiki_name || left.item.name).localeCompare(right.item.wiki_name || right.item.name);
    })
    .slice(offset, offset + limit)
    .map(({ item }) => ({
      id: item.id,
      slug: item.slug,
      name: item.wiki_name || item.name,
      category: item.category || "Sem categoria",
      imageSrc: getItemImageUrl(item),
      sprite: getItemSpriteAtlasEntry(item, itemSpriteAtlas)
    }));
}

async function loadStashCatalog() {
  if (stashCatalogLoaded) {
    return stashCatalogValue;
  }

  if (stashCatalogPromise) {
    return stashCatalogPromise;
  }

  stashCatalogPromise = (async () => {
    const bundle = await dataServiceRuntime.readJsonAsset(STASH_CATALOG_BUNDLE_PATH).catch(() => null);
    if (
      Number(bundle?.schemaVersion) !== 1 ||
      !/^[a-f0-9]{64}$/i.test(String(bundle?.sourceSha256 || "")) ||
      !Array.isArray(bundle?.items) ||
      !Array.isArray(bundle?.categories) ||
      !Array.isArray(bundle?.traders)
    ) {
      return null;
    }

    const libraryState = dataServiceRuntime.getLibraryCatalogState?.() || {};
    if (Number(libraryState.overlayChanges || 0) > 0) {
      return null;
    }

    const activeHash = String(libraryState.activeHash || "").toLowerCase();
    if (activeHash && activeHash !== String(bundle.sourceSha256).toLowerCase()) {
      return null;
    }

    const validItems = bundle.items.every((item) => (
      item && typeof item === "object" &&
      String(item.slug || "").trim() &&
      String(item.name || "").trim()
    ));
    if (!validItems) {
      return null;
    }

    return {
      items: bundle.items,
      categories: bundle.categories,
      traders: bundle.traders
    };
  })().catch(() => null);

  try {
    stashCatalogValue = await stashCatalogPromise;
    return stashCatalogValue;
  } finally {
    stashCatalogLoaded = true;
    stashCatalogPromise = null;
  }
}

async function getStashItems() {
  // The compact catalog contains exactly the presentation fields needed by
  // the Stash. It avoids parsing/merging the full item metadata and detail
  // bundles on the first open. The existing path below remains the safe
  // fallback for an old, missing or incompatible content pack.
  const compactCatalog = await loadStashCatalog();
  if (compactCatalog) {
    return compactCatalog;
  }

  const [metadataIndex, weeklyTaskItemNames, itemSpriteAtlas] = await Promise.all([
    getItemMetadataIndex(),
    loadWeeklyTaskItemNames(),
    loadItemSpriteAtlas()
  ]);
  const items = metadataIndex.items
    .filter(isVisibleUiItem)
    .map((item) => {
      const sellTo = Array.isArray(item.npc_buy) ? item.npc_buy : [];
      const buyFrom = Array.isArray(item.npc_sell) ? item.npc_sell : [];
      const npcSellValue = getBestNpcSellToValue(sellTo);

      return {
        id: item.id,
        marketId: item.marketId,
        slug: item.slug,
        name: item.wiki_name || item.name,
        category: item.category || "Sem categoria",
        categoryTags: getItemCategoryTags(item),
        imageSrc: getItemImageUrl(item),
        sprite: getItemSpriteAtlasEntry(item, itemSpriteAtlas),
        isWeeklyTask: isWeeklyTaskItemName(item.wiki_name || item.name, weeklyTaskItemNames),
        npcValue: npcSellValue,
        sellTo: sellTo.map((npc) => npc.name).filter(isValidTraderName),
        buyFrom: buyFrom.map((npc) => npc.name).filter(isValidTraderName)
      };
    })
    .filter((item, index, allItems) => {
      return allItems.findIndex((entry) => entry.slug === item.slug) === index;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const categories = [
    ...new Set(items.flatMap((item) => item.categoryTags).filter(Boolean))
  ]
    .filter((category) => FILTERABLE_ITEM_CATEGORIES.has(category))
    .sort((left, right) => left.localeCompare(right));
  const traders = [
    ...new Set(items.flatMap((item) => item.sellTo).filter(Boolean))
  ].sort((left, right) => left.localeCompare(right));

  return {
    items,
    categories,
    traders
  };
}

async function loadItemSpriteAtlas() {
  if (itemSpriteAtlasValue) return itemSpriteAtlasValue;
  if (itemSpriteAtlasPromise) return itemSpriteAtlasPromise;
  itemSpriteAtlasPromise = dataServiceRuntime.readJsonAsset(ITEM_SPRITE_ATLAS_BUNDLE_PATH)
    .then((bundle) => {
      itemSpriteAtlasValue = bundle && typeof bundle === "object" ? bundle : {};
      return itemSpriteAtlasValue;
    })
    .catch(() => {
      itemSpriteAtlasValue = {};
      return itemSpriteAtlasValue;
    });
  try {
    return await itemSpriteAtlasPromise;
  } finally {
    itemSpriteAtlasPromise = null;
  }
}

function getItemSpriteAtlasEntry(item, atlasBundle) {
  const directAssetId = String(item?.image_src || "").match(/items\/sprites\/(\d+)\.[a-z0-9]+(?:[?#].*)?$/i)?.[1];
  const assetId = Number(item?.assetId) || Number(directAssetId) || null;
  const slug = slugifyTibiaItemName(item?.slug || item?.wiki_name || item?.name || "");
  const entry = assetId
    ? atlasBundle?.sprites?.[String(assetId)]
    : atlasBundle?.bySlug?.[slug];
  const atlas = Number.isInteger(entry?.atlas) ? atlasBundle?.atlases?.[entry.atlas] : null;
  const width = Number(atlas?.width);
  const height = Number(atlas?.height);
  const x = Number(entry?.x);
  const y = Number(entry?.y);
  if (!atlas?.src || !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return {
    src: dataServiceRuntime.getAssetUrl(atlas.src),
    width,
    height,
    x,
    y,
    tileSize: Number(atlasBundle?.tileSize) || 32
  };
}

async function loadWeeklyTaskItemNames() {
  if (weeklyTaskItemNamesValue) {
    return weeklyTaskItemNamesValue;
  }

  if (!weeklyTaskItemNamesPromise) {
    weeklyTaskItemNamesPromise = dataServiceRuntime
      .readJsonAsset(WEEKLY_TASK_ITEMS_BUNDLE_PATH)
      .then((bundle) => {
        weeklyTaskItemNamesValue = new Set(
          (Array.isArray(bundle?.itemNames) ? bundle.itemNames : [])
            .map((name) => normalizeWeeklyTaskItemName(name))
            .filter(Boolean)
        );
        return weeklyTaskItemNamesValue;
      })
      .catch(() => {
        weeklyTaskItemNamesValue = new Set();
        return weeklyTaskItemNamesValue;
      });
  }

  try {
    return await weeklyTaskItemNamesPromise;
  } finally {
    weeklyTaskItemNamesPromise = null;
  }
}

function normalizeWeeklyTaskItemName(value) {
  return normalizeLookupValue(value);
}

const WEEKLY_TASK_ITEM_NAME_ALIASES = new Map([
  ["darklight core (item)", "darklight core"],
  ["darklight matter (item)", "darklight matter"],
  ["gore horn (item)", "gore horn"]
]);

function isWeeklyTaskItemName(value, weeklyTaskItemNames) {
  const normalized = normalizeWeeklyTaskItemName(value);
  return weeklyTaskItemNames.has(normalized)
    || weeklyTaskItemNames.has(WEEKLY_TASK_ITEM_NAME_ALIASES.get(normalized));
}

function decodeBookText(value) {
  let source = String(value || "");
  const mojibakeSequence = /(?:\u00C2[\u0080-\u00BF]|\u00C3[\u0080-\u00BF]|\u00E2[\u0080-\u00BF])/;
  // Older source records may have been decoded as Windows-1252 before they
  // reached the catalog. Decode only known mojibake sequences, preserving
  // proper names and intentional punctuation exactly as stored.
  for (let pass = 0; pass < 2 && mojibakeSequence.test(source); pass += 1) {
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true })
        .decode(Uint8Array.from(source, (character) => character.charCodeAt(0)));
      if (decoded === source) break;
      source = decoded;
    } catch {
      break;
    }
  }
  return source;
}

function getReadableBookText(value, fallback = "") {
  const decoded = decodeBookText(value);
  // A replacement character means the original byte was lost upstream. Do
  // not render a fake question mark: use the source-language text instead.
  return decoded.includes("\uFFFD") ? decodeBookText(fallback) : decoded;
}

function isCompatibleLibraryChunkManifest(manifest) {
  if (Number(manifest?.schemaVersion) !== 1 || !/^[a-f0-9]{64}$/i.test(String(manifest?.sourceSha256 || ""))) return false;
  const state = dataServiceRuntime.getLibraryCatalogState?.() || {};
  if (Number(state.overlayChanges || 0) > 0) return false;
  const activeHash = String(state.activeHash || "").toLowerCase();
  if (activeHash) return activeHash === String(manifest.sourceSha256).toLowerCase();
  return !state.hasActiveBase;
}

async function loadCanonicalLibraryChunkIndex() {
  if (siteLibraryChunkIndexValue) return siteLibraryChunkIndexValue;
  if (!siteLibraryChunkIndexPromise) {
    siteLibraryChunkIndexPromise = dataServiceRuntime.readJsonAsset(SITE_LIBRARY_CHUNKS_MANIFEST_PATH)
      .then((manifest) => {
        if (!isCompatibleLibraryChunkManifest(manifest)) return null;
        const presentationValidation = validateLibraryPresentationContract(manifest?.presentationContract);
        const index = {
          sourceSha256: String(manifest.sourceSha256).toLowerCase(),
          presentationContract: presentationValidation.valid ? presentationValidation.contract : null,
          presentationContractError: presentationValidation.valid ? null : presentationValidation.reason,
          summaries: {},
          lookup: {},
        };
        for (const kind of ["items", "npcs", "creatures", "bosses", "books"]) {
          const summaries = Array.isArray(manifest?.kinds?.[kind]?.summaries) ? manifest.kinds[kind].summaries : [];
          index.summaries[kind] = summaries;
          const lookup = new Map();
          for (const summary of summaries) {
            const slug = slugifyTibiaItemName(summary?.slug);
            if (slug) lookup.set(slug, summary);
            for (const alias of Array.isArray(summary?.aliases) ? summary.aliases : []) {
              const key = slugifyTibiaItemName(alias);
              if (key) lookup.set(key, summary);
            }
          }
          for (const summary of summaries) {
            const name = slugifyTibiaItemName(summary?.name);
            if (name && !lookup.has(name)) lookup.set(name, summary);
          }
          index.lookup[kind] = lookup;
        }
        siteLibraryChunkIndexValue = index;
        return index;
      })
      .catch(() => null)
      .finally(() => { siteLibraryChunkIndexPromise = null; });
  }
  return siteLibraryChunkIndexPromise;
}

async function loadCanonicalLibraryChunk(relativePath) {
  const key = String(relativePath || "").replace(/^\/+/, "");
  if (!/^(items|npcs|creatures|bosses|books)\/\d{4}\.json$/.test(key)) return null;
  if (siteLibraryChunkCache.has(key)) {
    const cached = siteLibraryChunkCache.get(key);
    siteLibraryChunkCache.delete(key);
    siteLibraryChunkCache.set(key, cached);
    return cached;
  }
  const bundle = await dataServiceRuntime.readJsonAsset(`${SITE_LIBRARY_CHUNKS_ROOT}/${key}`);
  const records = Array.isArray(bundle?.records) ? bundle.records : null;
  if (!records) return null;
  siteLibraryChunkCache.set(key, records);
  while (siteLibraryChunkCache.size > SITE_LIBRARY_CHUNK_CACHE_LIMIT) {
    siteLibraryChunkCache.delete(siteLibraryChunkCache.keys().next().value);
  }
  return records;
}

async function getCanonicalLibrarySummaries(kind) {
  const chunkIndex = await loadCanonicalLibraryChunkIndex();
  if (Array.isArray(chunkIndex?.summaries?.[kind])) return chunkIndex.summaries[kind];
  const documents = await loadCanonicalLibraryDocuments();
  return Array.isArray(documents?.records?.[kind]) ? documents.records[kind] : [];
}

async function loadCanonicalLibraryDocuments() {
  if (siteLibraryCanonicalValue) return siteLibraryCanonicalValue;
  if (!siteLibraryCanonicalPromise) {
    siteLibraryCanonicalPromise = dataServiceRuntime.readJsonAsset(SITE_LIBRARY_CANONICAL_PATH)
      .then((bundle) => {
        const byKind = {};
        byKind.records = {};
        byKind.schemaVersion = Number(bundle?.schemaVersion || 1);
        const presentationValidation = validateLibraryPresentationContract(bundle?.presentationContract);
        byKind.presentationContract = presentationValidation.valid ? presentationValidation.contract : null;
        byKind.presentationContractError = presentationValidation.valid ? null : presentationValidation.reason;
        for (const kind of ["items", "npcs", "creatures", "bosses", "books"]) {
          byKind[kind] = new Map();
          const records = Array.isArray(bundle?.records?.[kind]) ? bundle.records[kind] : [];
          byKind.records[kind] = records;
          // Stable public slugs win over aliases. This matters for objects
          // whose display name is shared by an older item (for example books).
          for (const record of records) {
            const normalized = slugifyTibiaItemName(record?.slug);
            if (normalized) byKind[kind].set(normalized, record);
            for (const alias of Array.isArray(record?.aliases) ? record.aliases : []) {
              const normalizedAlias = slugifyTibiaItemName(alias);
              if (normalizedAlias) byKind[kind].set(normalizedAlias, record);
            }
          }
          for (const record of records) {
            // A display name is only a fallback. It must never replace an
            // exact public slug: distinct objects such as `gemmed-book` and
            // `book-gemmed` share a visible name but have different factual
            // fields, sprites and game identities.
            for (const key of [record?.name]) {
              const normalized = slugifyTibiaItemName(key);
              if (normalized && !byKind[kind].has(normalized)) {
                byKind[kind].set(normalized, record);
              }
            }
          }
        }
        siteLibraryCanonicalValue = byKind;
        return byKind;
      })
      .catch(() => null)
      .finally(() => { siteLibraryCanonicalPromise = null; });
  }
  return siteLibraryCanonicalPromise;
}

async function getCanonicalLibraryDocument(kind, nameOrSlug) {
  const normalizedKey = slugifyTibiaItemName(nameOrSlug);
  const chunkIndex = await loadCanonicalLibraryChunkIndex();
  const summary = chunkIndex?.lookup?.[kind]?.get(normalizedKey) || null;
  if (summary?.chunk) {
    try {
      const records = await loadCanonicalLibraryChunk(summary.chunk);
      const targetSlug = slugifyTibiaItemName(summary.slug);
      const document = records?.find((record) => slugifyTibiaItemName(record?.slug) === targetSlug) || null;
      if (document) return localizeCanonicalLibraryDocument(document, kind, chunkIndex.presentationContract);
    } catch {
      // A missing or corrupt generated block must never make an offline detail
      // disappear. The existing monolithic catalogue remains the last-good
      // fallback and is intentionally kept in every package.
    }
  } else if (chunkIndex) {
    return null;
  }
  const documents = await loadCanonicalLibraryDocuments();
  const document = documents?.[kind]?.get(normalizedKey) || null;
  if (!document) return null;
  return localizeCanonicalLibraryDocument(document, kind, documents?.presentationContract);
}

function localizeCanonicalLibraryDocument(document, kind, presentationContract) {
  const locale = getActiveLocale();
  const facts = Array.isArray(document?.localizedFacts?.[locale])
    ? document.localizedFacts[locale]
    : document.facts;
  const description = typeof document?.localizedDescriptions?.[locale] === "string"
    ? document.localizedDescriptions[locale]
    : document.description;
  const localizedProfile = document?.localizedProfiles?.[locale];
  const profile = localizedProfile && typeof localizedProfile === "object"
    ? { ...(document.profile || {}), ...localizedProfile }
    : document.profile;
  // Keep all technical/profile data byte-for-byte; only human-facing factual
  // fields vary by locale. The in-game green description remains literal.
  const presentationTemplate = resolveLibraryPresentationTemplate(presentationContract, kind);
  const presentation = presentationTemplate
    ? { contractVersion: Number(presentationContract.schemaVersion || 1), template: presentationTemplate }
    : null;
  const localizedDocument = facts === document.facts && description === document.description && profile === document.profile
    ? document
    : { ...document, facts, description, profile };
  return presentation ? { ...localizedDocument, presentation } : localizedDocument;
}

function canonicalFacts(document) {
  return new Map(Array.isArray(document?.facts) ? document.facts.map(([label, value]) => [String(label), String(value ?? "")]) : []);
}

// The canonical site document carries localized display labels.  Extraction
// still uses the stable PT-BR field identity so the app can keep its existing
// visual components without maintaining a second data interpretation.
const CANONICAL_FACT_LABEL_ALIASES = Object.freeze({
  "Categoria": ["Category", "Kategorie"],
  "Classe": ["Class", "Klasse"],
  "Peso": ["Weight", "Gewicht"],
  "Valor": ["Value", "Wert"],
  "Atributos": ["Attributes", "Attribute"],
  "Implementado": ["Implemented", "Implementiert"],
  "Obtido em": ["Obtained in", "Erhalten bei"],
  "Experiência": ["Experience", "Erfahrung"],
  "Tipo": ["Type", "Typ"],
  "Empurrável": ["Pushable", "Verschiebbar"],
  "Empurra objetos": ["Pushes objects", "Kann Gegenstände schieben"],
  "Notas": ["Notes", "Hinweise"],
  "Market": ["Market", "Markt"],
  "Vendido por": ["Sold by", "Verkauft von"],
  "Comprado por": ["Bought by", "Gekauft von"],
  "Drop de": ["Dropped by", "Fallengelassen von"],
  "Modificadores de dano": ["Damage modifiers", "Schadensmodifikatoren"],
  "Vida": ["Hitpoints", "Trefferpunkte"],
  "Imunidades": ["Immunities", "Immunitäten"],
  "Comportamento": ["Behaviour", "Verhalten"],
  "Armadura": ["Armor", "Rüstung"],
  "Falas": ["Sounds", "Aussagen"],
  "História": ["History", "Geschichte"],
  "Localização": ["Location", "Fundort"],
  "Cidade": ["City", "Stadt"],
  "Local": ["Location", "Ort"],
  "Função": ["Job", "Beruf"],
  "Comércio": ["Trade", "Handel"],
  "Vocação": ["Vocation"],
  "Velocidade": ["Speed", "Geschwindigkeit"],
  "Dificuldade": ["Difficulty", "Schwierigkeit"],
  "Ocorrência": ["Occurrence", "Vorkommen"],
  "Mãos": ["Hands", "Hände"],
  "Defesa": ["Defense", "Verteidigung"],
  "Tipo de arma": ["Weapon type", "Waffentyp"],
  "Ataque": ["Attack", "Angriff"],
  "Resistências": ["Resistances", "Resistenzen"],
  "Removido": ["Removed", "Entfernt"],
  "Alcance": ["Range", "Reichweite"],
  "Dano": ["Damage", "Schaden"],
});

function canonicalFact(facts, label) {
  for (const candidate of [label, ...(CANONICAL_FACT_LABEL_ALIASES[label] || [])]) {
    if (facts.has(candidate)) return String(facts.get(candidate) || "").trim();
  }
  return "";
}

function canonicalContentEquals(left, right) {
  const normalize = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
  return normalize(left) !== "" && normalize(left) === normalize(right);
}

function canonicalDisplayText(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\(https:\/\/www\.tibiawiki\.com\.br\/wiki\/[^\s)]+\)/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .trim();
}

function numberFromCanonical(value) {
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function canonicalSpriteUrl(kind, name, fallback = "") {
  const spriteKind = kind === "npcs" ? "npcs" : "creatures";
  return getLocalLibrarySpriteUrl(spriteKind, name) || fallback;
}

function canonicalLibraryMediaUrl(source, fallback = "") {
  const value = String(source || "").trim();
  return /^\/library\/[a-z0-9._/-]+$/i.test(value)
    ? (dataServiceRuntime.getLibraryMediaUrl(value) || fallback)
    : fallback;
}

function canonicalLootImageUrl(entry = {}) {
  const image = String(entry.image || "");
  const numeric = image.match(/\/library\/items\/(\d+)\.png(?:[?#].*)?$/i)?.[1];
  if (numeric) return getAssetImageUrl(numeric);
  const bySlug = image.match(/\/library\/items\/by-slug\/([^/?#]+)$/i)?.[1];
  if (bySlug) return canonicalLibraryMediaUrl(image, dataServiceRuntime.getAssetUrl(`assets/library/items/catalog/by-slug/${decodeURIComponent(bySlug)}`));
  const catalogMedia = canonicalLibraryMediaUrl(image);
  if (catalogMedia) return catalogMedia;
  return getItemImageUrl({ slug: entry.slug, wiki_name: entry.name, image_src: image });
}

function localizeCanonicalProficiency(entries = []) {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...entry,
    options: (Array.isArray(entry?.options) ? entry.options : []).map((option) => ({
      ...option,
      images: (Array.isArray(option?.images) ? option.images : []).map((image) => {
        const source = String(image?.src || "");
        const filename = source.split("/").filter(Boolean).at(-1) || "";
        // Site records deliberately use public `/library/proficiency/...`
        // paths; Electron must use its bundled copy of the same reviewed GIF.
        const downloadedMedia = canonicalLibraryMediaUrl(source);
        return downloadedMedia
          ? { ...image, src: downloadedMedia }
          : filename
            ? { ...image, src: dataServiceRuntime.getAssetUrl(`assets/library/items/proficiency-icons/${filename}`) }
            : image;
      })
    }))
  }));
}

function applyCanonicalCreatureDocument(target, document) {
  if (!target || !document) return target;
  const facts = canonicalFacts(document);
  const profile = document.profile || {};
  target.canonicalDocument = document;
  target.canonicalFacts = Array.isArray(document.facts) ? document.facts : [];
  target.canonicalProfile = profile;
  target.name = document.name || target.name;
  target.slug = document.slug || target.slug;
  target.creatureClass = canonicalFact(facts, "Classe") || target.creatureClass;
  target.primaryType = canonicalFact(facts, "Tipo") || target.primaryType;
  target.hitpoints = numberFromCanonical(canonicalFact(facts, "Vida")) ?? target.hitpoints;
  target.experience = numberFromCanonical(canonicalFact(facts, "Experiência")) ?? target.experience;
  target.speed = numberFromCanonical(canonicalFact(facts, "Velocidade")) ?? target.speed;
  target.armor = numberFromCanonical(canonicalFact(facts, "Armadura")) ?? target.armor;
  target.mitigation = numberFromCanonical(canonicalFact(facts, "Mitigation")) ?? target.mitigation;
  target.charms = numberFromCanonical(canonicalFact(facts, "Charms")) ?? target.charms;
  target.difficulty = canonicalFact(facts, "Dificuldade") || target.difficulty;
  target.occurrence = canonicalFact(facts, "Ocorrência") || target.occurrence;
  target.location = canonicalFact(facts, "Localização") || target.location;
  target.behaviour = canonicalFact(facts, "Comportamento") || canonicalFact(facts, "Descrição") || target.behaviour;
  target.notes = canonicalFact(facts, "Notas") || target.notes;
  target.history = canonicalFact(facts, "História") || target.history;
  target.sounds = canonicalFact(facts, "Falas") ? [canonicalFact(facts, "Falas")] : target.sounds;
  target.abilities = Array.isArray(profile.abilities) && profile.abilities.length ? profile.abilities : target.abilities;
  target.damageModifiers = Array.isArray(profile.damageModifiers) && profile.damageModifiers.length ? profile.damageModifiers : target.damageModifiers;
  target.loot = Array.isArray(profile.loot) && profile.loot.length ? profile.loot.map((entry) => ({ ...entry, imageSrc: canonicalLootImageUrl(entry) })) : target.loot;
  target.tables = Array.isArray(profile.tables) ? profile.tables : target.tables;
  target.pushable = canonicalFact(facts, "Empurrável") || target.pushable;
  target.pushObjects = canonicalFact(facts, "Empurra objetos") || target.pushObjects;
  target.implemented = canonicalFact(facts, "Implementado") || target.implemented;
  const immunities = canonicalFact(facts, "Imunidades").toLocaleLowerCase("en-US");
  if (immunities) {
    target.paralyzeImmune = /paralysis|paralis/.test(immunities) ? "yes" : target.paralyzeImmune;
    target.senseInvisible = /invisibility|invisib/.test(immunities) ? "yes" : target.senseInvisible;
  }
  target.wikiUrl = document.meta?.wikiUrl || target.wikiUrl;
  target.imageSrc = canonicalSpriteUrl("creatures", target.name, canonicalLibraryMediaUrl(document.image, target.imageSrc));
  return target;
}

function applyCanonicalNpcDocument(target, document) {
  if (!target || !document) return target;
  const facts = canonicalFacts(document);
  target.canonicalDocument = document;
  target.canonicalFacts = Array.isArray(document.facts) ? document.facts : [];
  target.canonicalProfile = document.profile || {};
  target.name = document.name || target.name;
  target.slug = document.slug || target.slug;
  target.city = canonicalFact(facts, "Cidade") || target.city;
  target.location = canonicalFact(facts, "Local") || target.location;
  target.description = canonicalFact(facts, "Descrição") || target.description;
  target.job = canonicalFact(facts, "Função") || target.job;
  target.trade = canonicalFact(facts, "Comércio") || target.trade;
  target.implemented = canonicalFact(facts, "Implementado") || target.implemented;
  target.notes = canonicalFact(facts, "Notas") || target.notes;
  target.history = canonicalFact(facts, "História") || target.history;
  target.sounds = canonicalFact(facts, "Falas") ? [canonicalFact(facts, "Falas")] : target.sounds;
  target.map = document.meta?.mapUrl ? { url: document.meta.mapUrl } : target.map;
  target.wikiUrl = document.meta?.wikiUrl || target.wikiUrl;
  target.imageSrc = canonicalSpriteUrl("npcs", target.name, canonicalLibraryMediaUrl(document.image, target.imageSrc));
  return target;
}

function canonicalNpcTradeItems(document = {}) {
  const profile = document.profile || {};
  const mapItems = (entries) => (Array.isArray(entries) ? entries : []).map((entry) => ({
    name: entry.name,
    price: entry.price,
    currency: entry.currency || "",
    slug: entry.slug,
    imageSrc: canonicalLootImageUrl(entry)
  }));
  return { buy: mapItems(profile.buy), sell: mapItems(profile.sell) };
}

async function applyCanonicalItemDocument(target) {
  if (!target) return target;
  // Canonical item documents contain merchants by name.  Load the local
  // sprite manifest before materialising those rows so a first item opened in
  // a fresh app session never races the NPC index and renders without images.
  await loadLibrarySpritePaths();
  const document = await getCanonicalLibraryDocument("items", target.slug || target.wiki_name || target.name);
  if (!document) return target;
  const facts = canonicalFacts(document);
  const description = String(document.description || "").trim();
  // Once a site document exists, it is authoritative. Retaining an old app
  // fallback here is what caused stale Notes to survive after the site was
  // corrected (and, for food items, to appear as duplicated descriptions).
  const selectedNotes = canonicalFact(facts, "Notas");
  target.canonicalDocument = document;
  target.canonicalFacts = Array.isArray(document.facts) ? document.facts : [];
  target.canonicalProfile = document.profile || {};
  target.wiki_name = document.name || target.wiki_name;
  target.category = canonicalDisplayText(canonicalFact(facts, "Categoria")) || target.category;
  // Some source records use their game description as a fallback "Notas".
  // The app has separate areas for each, so that fallback must not be rendered
  // as a second (or third) copy of the same factual text.
  target.notes = canonicalContentEquals(selectedNotes, description) ? "" : selectedNotes;
  target.location = canonicalFact(facts, "Localização") || target.location;
  target.marketable = canonicalFact(facts, "Market") || target.marketable;
  // Keep the game's literal technical text in its own green block. The
  // narrative description is a separate field on the site and must not
  // replace it in Electron.
  target.technical_description_lines = Array.isArray(document.profile?.technicalDescription)
    ? document.profile.technicalDescription.filter(Boolean)
    : [];
  const noteImagePath = String(document.profile?.noteImage || "").trim();
  const noteImageName = noteImagePath.split("/").filter(Boolean).at(-1) || "";
  target.notes_image = canonicalLibraryMediaUrl(noteImagePath, noteImageName
    ? dataServiceRuntime.getAssetUrl(`assets/library/items/catalog/notes/${noteImageName}`)
    : "");
  target.description_lines = description ? [description] : [];
  target.proficiency = Array.isArray(document.profile?.proficiency)
    ? localizeCanonicalProficiency(document.profile.proficiency)
    : target.proficiency;
  target.damageTable = Array.isArray(document.profile?.damageTable)
    ? document.profile.damageTable
    : target.damageTable;
  target.food = document.profile?.food && typeof document.profile.food === "object"
    ? document.profile.food
    : target.food;
  target.tables = Array.isArray(document.profile?.tables)
    ? document.profile.tables
    : target.tables;
  target.droppedBy = Array.isArray(document.profile?.droppedBy)
    ? document.profile.droppedBy.map((entry) => String(entry?.name || "").trim()).filter(Boolean)
    : target.droppedBy;
  target.npc_sell = Array.isArray(document.profile?.buy) && document.profile.buy.length
      ? document.profile.buy.map((entry) => ({
        name: entry.name,
        price: entry.price,
        currency: entry.currency || "",
        location: entry.location,
        image_src: canonicalSpriteUrl("npcs", entry.name)
      }))
    : target.npc_sell;
  target.npc_buy = Array.isArray(document.profile?.sell) && document.profile.sell.length
      ? document.profile.sell.map((entry) => ({
        name: entry.name,
        price: entry.price,
        currency: entry.currency || "",
        location: entry.location,
        image_src: canonicalSpriteUrl("npcs", entry.name)
      }))
    : target.npc_buy;
  target.map = document.meta?.mapUrl ? { url: document.meta.mapUrl } : target.map;
  target.wikiUrl = document.meta?.wikiUrl || target.wikiUrl;
  return target;
}

function normalizeBookImage(source) {
  const catalogMedia = canonicalLibraryMediaUrl(source);
  if (catalogMedia) return catalogMedia;
  // Some audited Wiki references are page URLs (`Arquivo:Black_Book.gif`)
  // rather than direct image URLs.  Both identify the same local media; the
  // namespace is not part of the downloaded filename.
  const remoteFilename = decodeURIComponent(String(source || "").split("/").at(-1) || "book.gif")
    .replace(/^arquivo:/i, "")
    .replace(/[?#].*$/, "");
  const extension = remoteFilename.match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase() || ".gif";
  const filename = remoteFilename
    .slice(0, -extension.length)
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return dataServiceRuntime.getAssetUrl(`assets/library/books/documents/images/${filename || "book"}${extension}`);
}

function normalizeBookAppearance(appearance = {}) {
  const coordinates = appearance?.coordinates && Number.isFinite(Number(appearance.coordinates.x))
    ? {
        x: Number(appearance.coordinates.x),
        y: Number(appearance.coordinates.y),
        floor: Number(appearance.coordinates.floor),
        zoom: Number(appearance.coordinates.zoom) || 2
      }
    : null;
  return {
    name: decodeBookText(appearance?.name),
    image: normalizeBookImage(appearance?.source),
    location: decodeBookText(appearance?.location),
    locationDetail: decodeBookText(appearance?.locationDetail),
    coordinates,
    source: String(appearance?.source || "")
  };
}

async function getBooksDocumentsCatalog() {
  if (!booksDocumentsCatalogPromise) {
    booksDocumentsCatalogPromise = getCanonicalLibrarySummaries("books")
      .then(async (canonicalBooks) => {
        // Books follow the same rule as the other Library types: take the
        // fully resolved local site document, never recreate a second detail
        // from the raw audit record in the Electron renderer.
        if (canonicalBooks.length) return canonicalBooks.map(normalizeCanonicalBookRecord);
        const bundle = await dataServiceRuntime.readJsonAsset(BOOKS_DOCUMENTS_AUDIT_PATH);
        return (Array.isArray(bundle?.records) ? bundle.records : []).map((record) => {
        const appearances = Array.isArray(record?.appearances)
          ? record.appearances.map(normalizeBookAppearance)
          : [];
        const locations = [...new Set(appearances.map((appearance) => appearance.location).filter(Boolean))];
        const libraries = [...new Set(appearances
          .map((appearance) => String(appearance.locationDetail || "").replace(/^\(|\)$/g, "").trim())
          .filter(Boolean))];
        const pageName = decodeBookText(record?.pageName || record?.name || record?.slug);
        return {
          slug: String(record?.slug || slugifyTibiaItemName(pageName)),
          name: pageName.replace(/ \(Book\)$/i, ""),
          pageName,
          tibn: decodeBookText(record?.tibn),
          author: decodeBookText(record?.author),
          genre: decodeBookText(record?.genre),
          shortDescription: getReadableBookText(record?.shortDescription, record?.originalText),
          version: decodeBookText(record?.added),
          notes: decodeBookText(record?.notes),
          englishText: decodeBookText(record?.originalText),
          translatedText: getReadableBookText(record?.ptText, record?.originalText),
          translated: Boolean(record?.translated),
          untranslated: !Boolean(record?.translated),
          source: String(record?.source || ""),
          appearances,
          locations,
          libraries,
          image: appearances[0]?.image || null
        };
        });
      });
  }
  return booksDocumentsCatalogPromise;
}

function normalizeCanonicalBookRecord(record = {}) {
  return {
    ...record,
    image: record.appearances?.[0]?.source ? normalizeBookImage(record.appearances[0].source) : (record.image ? normalizeBookImage(record.image) : null),
    appearances: Array.isArray(record.appearances) ? record.appearances.map((appearance) => ({
      ...appearance,
      image: normalizeBookImage(appearance.source || appearance.image),
    })) : [],
  };
}

function compareBookText(left, right, direction = 1) {
  if (!left) return right ? 1 : 0;
  if (!right) return -1;
  // Numeric titles belong after the alphabet in the Library.  localeCompare
  // normally places them before A, which made the beginning of the catalogue
  // look like a sequence of volume numbers instead of an A-Z index.
  const leftStartsNumeric = /^\s*\d/.test(String(left));
  const rightStartsNumeric = /^\s*\d/.test(String(right));
  if (leftStartsNumeric !== rightStartsNumeric) {
    return leftStartsNumeric ? 1 : -1;
  }
  return direction * String(left).localeCompare(String(right), undefined, { sensitivity: "base" });
}

async function getBooksDocuments(payload = {}) {
  const slug = String(payload?.slug || "").trim();
  if (slug) {
    const detail = await getCanonicalLibraryDocument("books", slug).catch(() => null);
    if (detail) return { detail: normalizeCanonicalBookRecord(detail) };
    const fallbackCatalog = await getBooksDocumentsCatalog();
    return { detail: fallbackCatalog.find((entry) => entry.slug === slug) || null };
  }

  const catalog = await getBooksDocumentsCatalog();

  const query = String(payload?.query || "").trim().toLocaleLowerCase("en-US");
  const location = String(payload?.location || "").trim();
  const library = String(payload?.library || "").trim();
  const author = String(payload?.author || "").trim();
  const sort = String(payload?.sort || "name-asc").trim();
  const pageSize = Math.max(12, Math.min(120, Number(payload?.pageSize) || 60));
  const currentPage = Math.max(1, Number(payload?.page) || 1);
  const filtered = catalog.filter((entry) => {
    if (location && !entry.locations.includes(location)) return false;
    if (library && !entry.libraries.includes(library)) return false;
    if (author && entry.author !== author) return false;
    if (!query) return true;
    return [entry.name, entry.pageName, entry.author, entry.genre, entry.shortDescription, ...entry.locations, ...entry.libraries, ...entry.appearances.flatMap((appearance) => [appearance.name, appearance.location, appearance.locationDetail])]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("en-US").includes(query));
  });
  const sorted = [...filtered].sort((left, right) => {
    const name = compareBookText(left.name, right.name);
    const entryAuthor = compareBookText(left.author, right.author);
    const entryLocation = compareBookText(left.locations[0], right.locations[0]);
    const entryLibrary = compareBookText(left.libraries[0], right.libraries[0]);
    // `compareBookText` intentionally keeps numeric titles after the A-Z
    // entries even when the alphabetic direction is reversed.
    if (sort === "name-desc") return compareBookText(left.name, right.name, -1) || entryAuthor;
    if (sort === "author-asc") return entryAuthor || name;
    if (sort === "author-desc") return compareBookText(left.author, right.author, -1) || name;
    if (sort === "location-asc") return entryLocation || name;
    if (sort === "location-desc") return compareBookText(left.locations[0], right.locations[0], -1) || name;
    if (sort === "library-asc") return entryLibrary || name;
    if (sort === "library-desc") return compareBookText(left.libraries[0], right.libraries[0], -1) || name;
    return name || entryAuthor;
  });
  const start = (currentPage - 1) * pageSize;
  return {
    total: sorted.length,
    page: currentPage,
    pageSize,
    results: sorted.slice(start, start + pageSize).map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      image: entry.image,
      locations: entry.locations,
      libraries: entry.libraries,
      author: entry.author,
      shortDescription: entry.shortDescription
    })),
    facets: {
      locations: [...new Set(catalog.flatMap((entry) => entry.locations))].sort((left, right) => left.localeCompare(right)),
      authors: [...new Set(catalog.map((entry) => entry.author).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
      libraries: [...new Set(catalog.flatMap((entry) => entry.libraries))].sort((left, right) => left.localeCompare(right))
    }
  };
}

async function getNpcIndex() {
  const bundled = await loadBundledNpcIndex().catch(() => null);

  if (bundled?.items?.length) {
    return bundled;
  }

  const localIndex = await getNpcDetailsIndex().catch(() => ({ list: [] }));
  const bySlug = new Map();

  (localIndex.list || []).forEach((npc) => {
    const normalized = normalizeNpcIndexEntry(npc);

    if (normalized) {
      bySlug.set(normalized.slug, normalized);
    }
  });

  const items = Array.from(bySlug.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  const result = {
    generatedAt: new Date().toISOString(),
    items,
    cities: uniqueSorted(items.map((npc) => npc.city).filter(Boolean)),
    jobs: uniqueSorted(
      items.flatMap((npc) => [npc.job, npc.job2]).filter(Boolean)
    ),
    tradeOptions: ["Compra/vende", "Sem comercio", "Desconhecido"]
  };

  return result;
}

async function loadBundledNpcIndex() {
  if (npcIndexBundleValue) {
    return npcIndexBundleValue;
  }

  const bundle = await dataServiceRuntime.readJsonAsset(NPC_INDEX_BUNDLE_PATH);
  const [jobOverrides, auditCorrections] = await Promise.all([loadNpcJobOverrides(), loadNpcAuditCorrections(), loadLibrarySpritePaths()]);
  const items = Array.isArray(bundle?.items)
    ? bundle.items.map((npc) => ({ ...npc, ...(auditCorrections[npc?.slug || slugifyTibiaItemName(npc?.name)] || {}) })).map(normalizeNpcIndexEntry).filter(Boolean)
    : [];
  items.forEach((npc) => applyNpcJobOverride(npc, jobOverrides));

  if (items.length === 0) {
    return null;
  }

  npcIndexBundleValue = {
    generatedAt: bundle.generatedAt,
    items: items.sort((left, right) => left.name.localeCompare(right.name)),
    cities: Array.isArray(bundle?.cities) && bundle.cities.length
      ? uniqueSorted(bundle.cities.map((city) => cleanEntityText(city)).filter(Boolean))
      : uniqueSorted(items.map((npc) => npc.city).filter(Boolean)),
    jobs: Array.isArray(bundle?.jobs) && bundle.jobs.length
      ? uniqueSorted(bundle.jobs.map((job) => cleanEntityText(job)).filter(Boolean))
      : uniqueSorted(
        items.flatMap((npc) =>
          Array.isArray(npc.functionLabels) && npc.functionLabels.length
            ? npc.functionLabels
            : [npc.job, npc.job2]
        ).filter(Boolean)
      ),
    tradeOptions: ["Compra/vende", "Sem comercio", "Desconhecido"]
  };

  return npcIndexBundleValue;
}

async function loadNpcJobOverrides() {
  if (npcJobOverridesValue) {
    return npcJobOverridesValue;
  }

  if (npcJobOverridesPromise) {
    return npcJobOverridesPromise;
  }

  npcJobOverridesPromise = dataServiceRuntime
    .readJsonAsset(NPC_JOB_OVERRIDES_BUNDLE_PATH)
    .then((bundle) => bundle?.overrides || {})
    .catch(() => ({}));

  try {
    npcJobOverridesValue = await npcJobOverridesPromise;
    return npcJobOverridesValue;
  } finally {
    npcJobOverridesPromise = null;
  }
}

async function loadNpcAuditCorrections() {
  if (npcAuditCorrectionsValue) return npcAuditCorrectionsValue;
  if (npcAuditCorrectionsPromise) return npcAuditCorrectionsPromise;
  npcAuditCorrectionsPromise = dataServiceRuntime.readJsonAsset(NPC_AUDIT_CORRECTIONS_BUNDLE_PATH)
    .then((bundle) => Object.fromEntries((Array.isArray(bundle?.npcs) ? bundle.npcs : [])
      .filter((entry) => entry?.slug)
      .map((entry) => [String(entry.slug), entry])))
    .catch(() => ({}));
  try {
    npcAuditCorrectionsValue = await npcAuditCorrectionsPromise;
    return npcAuditCorrectionsValue;
  } finally {
    npcAuditCorrectionsPromise = null;
  }
}

async function loadCreatureStatusOverrides() {
  if (creatureStatusOverridesValue) {
    return creatureStatusOverridesValue;
  }

  if (creatureStatusOverridesPromise) {
    return creatureStatusOverridesPromise;
  }

  creatureStatusOverridesPromise = dataServiceRuntime
    .readJsonAsset(CREATURE_STATUS_OVERRIDES_BUNDLE_PATH)
    .then((bundle) => bundle?.overrides || {})
    .catch(() => ({}));

  try {
    creatureStatusOverridesValue = await creatureStatusOverridesPromise;
    return creatureStatusOverridesValue;
  } finally {
    creatureStatusOverridesPromise = null;
  }
}

async function loadCreatureAuditCorrections() {
  if (creatureAuditCorrectionsValue) return creatureAuditCorrectionsValue;
  if (creatureAuditCorrectionsPromise) return creatureAuditCorrectionsPromise;
  creatureAuditCorrectionsPromise = dataServiceRuntime.readJsonAsset(CREATURE_AUDIT_CORRECTIONS_BUNDLE_PATH)
    .then((bundle) => Object.fromEntries((Array.isArray(bundle?.records) ? bundle.records : [])
      .filter((entry) => entry?.slug)
      .map((entry) => [String(entry.slug), entry])))
    .catch(() => ({}));
  try {
    creatureAuditCorrectionsValue = await creatureAuditCorrectionsPromise;
    return creatureAuditCorrectionsValue;
  } finally {
    creatureAuditCorrectionsPromise = null;
  }
}

async function loadCreatureLootAuditCorrections() {
  if (creatureLootAuditCorrectionsValue) return creatureLootAuditCorrectionsValue;
  if (creatureLootAuditCorrectionsPromise) return creatureLootAuditCorrectionsPromise;
  creatureLootAuditCorrectionsPromise = dataServiceRuntime.readJsonAsset(CREATURE_LOOT_AUDIT_CORRECTIONS_BUNDLE_PATH)
    .then((bundle) => bundle?.overrides || {})
    .catch(() => ({}));
  try {
    creatureLootAuditCorrectionsValue = await creatureLootAuditCorrectionsPromise;
    return creatureLootAuditCorrectionsValue;
  } finally {
    creatureLootAuditCorrectionsPromise = null;
  }
}

async function loadBossTableAuditCorrections() {
  if (bossTableAuditCorrectionsValue) return bossTableAuditCorrectionsValue;
  if (bossTableAuditCorrectionsPromise) return bossTableAuditCorrectionsPromise;
  bossTableAuditCorrectionsPromise = dataServiceRuntime.readJsonAsset(BOSS_TABLE_AUDIT_CORRECTIONS_BUNDLE_PATH)
    .then((bundle) => bundle?.overrides || {})
    .catch(() => ({}));
  try {
    bossTableAuditCorrectionsValue = await bossTableAuditCorrectionsPromise;
    return bossTableAuditCorrectionsValue;
  } finally {
    bossTableAuditCorrectionsPromise = null;
  }
}

async function applyLocalCreatureTables(detail) {
  const tables = (await loadBossTableAuditCorrections())[slugifyTibiaItemName(detail?.name)]?.tables;
  return Array.isArray(tables) && tables.length ? { ...detail, tables } : detail;
}

async function loadLibrarySpritePaths() {
  if (librarySpritePathsValue) return librarySpritePathsValue;
  if (librarySpritePathsPromise) return librarySpritePathsPromise;
  librarySpritePathsPromise = dataServiceRuntime.readJsonAsset(LIBRARY_SPRITE_PATHS_BUNDLE_PATH)
    .then((bundle) => {
      librarySpritePathsValue = { creatures: bundle?.creatures || {}, npcs: bundle?.npcs || {} };
      return librarySpritePathsValue;
    })
    .catch(() => {
      librarySpritePathsValue = { creatures: {}, npcs: {} };
      return librarySpritePathsValue;
    });
  try {
    return await librarySpritePathsPromise;
  } finally {
    librarySpritePathsPromise = null;
  }
}

function getLocalLibrarySpriteUrl(kind, name, slugHint = "") {
  const candidates = [...new Set([
    String(slugHint || "").trim(),
    slugifyTibiaItemName(name)
  ].filter(Boolean))];
  const slug = candidates.find((candidate) => librarySpritePathsValue?.[kind]?.[candidate]) || "";
  const extension = slug ? librarySpritePathsValue[kind][slug] : "";
  return extension ? dataServiceRuntime.getAssetUrl(`assets/library/${kind}/sprites/${slug}.${extension}`) : "";
}

function getLocalLibrarySpriteStillUrl(kind, name, slugHint = "") {
  const candidates = [...new Set([
    String(slugHint || "").trim(),
    slugifyTibiaItemName(name)
  ].filter(Boolean))];
  const slug = candidates.find((candidate) => librarySpritePathsValue?.[kind]?.[candidate]) || "";
  const extension = slug ? librarySpritePathsValue[kind][slug] : "";
  if (!extension) return "";
  return ["gif", "png", "webp"].includes(extension.toLowerCase())
    ? dataServiceRuntime.getAssetUrl(`assets/library/thumbnails/${kind}/${slug}.png`)
    : dataServiceRuntime.getAssetUrl(`assets/library/${kind}/sprites/${slug}.${extension}`);
}

function applyNpcJobOverride(npc, overrides = {}) {
  const override = overrides[npc?.slug || slugifyTibiaItemName(npc?.name)];

  if (!override) {
    return npc;
  }

  if (override.job && isWeakNpcJob(npc.job)) {
    npc.job = override.job;
  }

  if (override.job2 && !npc.job2) {
    npc.job2 = override.job2;
  }

  if (override.city) {
    npc.city = override.city;
  }

  if (override.location) {
    npc.location = override.location;
  }

  if (override.subarea && !npc.subarea) {
    npc.subarea = override.subarea;
  }

  if (override.implemented) {
    npc.implemented = override.implemented;
  }

  if (override.map) {
    npc.map = override.map;
  }

  if (override.notes) {
    npc.notes = override.notes;
  }

  if (Array.isArray(override.spoilers)) {
    npc.spoilers = override.spoilers;
  }

  return npc;
}

async function getNpcDetailForUi(payload = {}) {
  const name = String(payload.name || "").trim();

  if (!name) {
    throw new Error("NPC nao informado.");
  }

  await loadLibrarySpritePaths();

  const cacheKey = `npc-ui-detail:v10:${slugifyTibiaItemName(name)}`;
  const cached = await getCache(cacheKey);
  const canonicalDocument = await getCanonicalLibraryDocument("npcs", name);

  const applyCurrentCanonicalDocument = async (detail) => {
    if (!canonicalDocument) return detail;
    const localized = { ...detail };
    applyCanonicalNpcDocument(localized, canonicalDocument);
    const canonicalTrades = canonicalNpcTradeItems(canonicalDocument);
    localized.tradeItems = canonicalTrades.buy.length || canonicalTrades.sell.length
      ? canonicalTrades
      : (localized.tradeItems || { buy: [], sell: [] });
    return localized;
  };

  if (cached) {
    // The cache is useful for the static shell, but the canonical fields vary
    // with the active language and must never remain in the first locale that
    // opened this NPC.
    return applyCurrentCanonicalDocument(cached);
  }

  const localDetail = await getLocalNpcDetail(name).catch(() => null);

  if (localDetail) {
    const normalized = await enrichNpcDetailForUi(normalizeNpcDetailForUi(null, localDetail));
    applyCanonicalNpcDocument(normalized, canonicalDocument);
    const canonicalTrades = canonicalNpcTradeItems(canonicalDocument);
    normalized.tradeItems = canonicalTrades.buy.length || canonicalTrades.sell.length
      ? canonicalTrades
      : await getNpcTradeItems(normalized.name);
    await putCache(cacheKey, normalized);
    return normalized;
  }

  // A few current NPCs are intentionally present only in the reviewed site
  // catalogue. They still need a complete app card rather than disappearing
  // merely because the historical desktop index has not listed them yet.
  if (canonicalDocument) {
    const normalized = await enrichNpcDetailForUi(normalizeNpcDetailForUi(null, { name: canonicalDocument.name }));
    const complete = await applyCurrentCanonicalDocument(normalized);
    await putCache(cacheKey, complete);
    return complete;
  }

  throw new Error("NPC nao encontrado no acervo local auditado.");
}

async function getCreatureIndex() {
  const [bundled, canonicalCreatures, canonicalBosses] = await Promise.all([
    loadBundledCreatureIndex().catch(() => null),
    getCanonicalLibrarySummaries("creatures").catch(() => []),
    getCanonicalLibrarySummaries("bosses").catch(() => []),
  ]);

  if (bundled?.items?.length && Array.isArray(bundled.categories)) {
    const canonicalRecords = [...canonicalCreatures, ...canonicalBosses];
    if (!canonicalRecords.length) return bundled;
    const canonicalKeys = new Set(canonicalRecords.flatMap((record) => [
      record?.slug,
      record?.name,
    ].map((value) => slugifyTibiaItemName(value)).filter(Boolean)));
    const itemsBySlug = new Map(bundled.items
      .filter((creature) => canonicalKeys.has(slugifyTibiaItemName(creature?.slug || creature?.name)))
      .map((creature) => [slugifyTibiaItemName(creature?.slug || creature?.name), creature]));
    // The legacy index remains the visual shell for existing records, but a
    // record published only by the site must still be searchable immediately.
    // Do not wait for the next installer/content-pack build to make a new
    // creature or boss visible in the desktop catalogue.
    for (const record of canonicalRecords) {
      const key = slugifyTibiaItemName(record?.slug || record?.name);
      if (key && !itemsBySlug.has(key)) itemsBySlug.set(key, canonicalCreatureIndexRecord(record));
    }
    return {
      ...bundled,
      // The canonical document determines which public creatures are real.
      // The historical index remains the visual shell, but must not revive a
      // removed duplicate such as the pre-release *Yellow Worm* placeholder.
      items: [...itemsBySlug.values()],
    };
  }

  throw new Error("Indice de criaturas indisponivel no acervo local auditado.");
}

function canonicalCreatureIndexRecord(record = {}) {
  const facts = canonicalFacts(record);
  const meta = record.meta || {};
  const name = String(record.name || record.slug || "").trim();
  return {
    id: `site:${record.slug || slugifyTibiaItemName(name)}`,
    name,
    slug: String(record.slug || slugifyTibiaItemName(name)),
    hitpoints: numberFromCanonical(canonicalFact(facts, "Vida")) ?? (Number(meta.hitpoints) || 0),
    experience: numberFromCanonical(canonicalFact(facts, "Experiência")) ?? (Number(meta.experience) || 0),
    imageSrc: canonicalSpriteUrl("creatures", name, canonicalLibraryMediaUrl(record.image, "")),
    creatureClass: canonicalFact(facts, "Classe") || meta.creatureClass || "",
    primaryType: canonicalFact(facts, "Tipo") || meta.primaryType || "",
    secondaryType: meta.secondaryType || "",
    bestiaryClass: meta.bestiaryClass || "",
    difficulty: canonicalFact(facts, "Dificuldade") || "",
    occurrence: canonicalFact(facts, "Ocorrência") || "",
    isBoss: String(meta.isBoss || ""),
    categorySlugs: Array.isArray(meta.categorySlugs) ? meta.categorySlugs : [],
    categoryLabels: Array.isArray(meta.categoryLabels) ? meta.categoryLabels : [],
    bossCategory: String(meta.bossCategory || "")
  };
}

async function loadBundledCreatureIndex() {
  if (creatureIndexBundleValue) {
    return creatureIndexBundleValue;
  }

  const bundle = await dataServiceRuntime.readJsonAsset(CREATURE_INDEX_BUNDLE_PATH);
  const [statusOverrides, auditCorrections, lootCorrections] = await Promise.all([
    loadCreatureStatusOverrides().catch(() => ({})),
    loadCreatureAuditCorrections(),
    loadCreatureLootAuditCorrections(),
    loadLibrarySpritePaths()
  ]);

  if (!bundle?.items?.length) {
    return null;
  }

  creatureIndexBundleValue = {
    ...bundle,
    items: bundle.items.map((creature) => enrichCreatureIndexEntry(
      applyLocalCreatureLootAudit({ ...creature, ...(auditCorrections[creature?.slug || slugifyTibiaItemName(creature?.name)] || {}) }, lootCorrections),
      statusOverrides
    )),
    categories: (bundle.categories || []).map((category) => ({
      ...category,
      imageSrc: dataServiceRuntime.getAssetUrl(category.imageSrc || `assets/bestiary/creature-categories/${category.slug}.png`)
    }))
  };

  return creatureIndexBundleValue;
}

function applyLocalCreatureLootAudit(creature, corrections = {}) {
  const correction = corrections[creature?.slug || slugifyTibiaItemName(creature?.name)] || {};
  const remove = new Set((correction.removeLoot || []).map((entry) => normalizeLookupValue(typeof entry === "string" ? entry : entry?.name)));
  const merged = [...(Array.isArray(creature?.loot) ? creature.loot : []), ...(Array.isArray(correction.addLoot) ? correction.addLoot : [])]
    .filter((entry) => entry && !remove.has(normalizeLookupValue(typeof entry === "string" ? entry : entry.name)));
  const seen = new Set();
  return {
    ...creature,
    loot: merged.filter((entry) => {
      const key = normalizeLookupValue(typeof entry === "string" ? entry : entry.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  };
}

function enrichCreatureIndexEntry(creature, statusOverrides = {}) {
  const override = statusOverrides[creature?.slug || slugifyTibiaItemName(creature?.name)] || {};
  const detailOverride = CREATURE_DETAIL_OVERRIDES[creature?.slug || slugifyTibiaItemName(creature?.name)] || {};

  return {
    ...creature,
    hitpoints: creature.hitpoints || override.hitpoints || null,
    experience: creature.experience || override.experience || null,
    difficulty: creature.difficulty || override.difficulty || "",
    occurrence: creature.occurrence || override.occurrence || "",
    isBoss: creature.isBoss || override.isBoss || "",
    bossCategory: creature.bossCategory || override.bossCategory || "",
    pushable: creature.pushable || override.pushable || "",
    pushObjects: creature.pushObjects || override.pushObjects || "",
    walksAround: creature.walksAround || override.walksAround || "",
    walksThrough: creature.walksThrough || override.walksThrough || "",
    paralyzeImmune: creature.paralyzeImmune || override.paralyzeImmune || "",
    senseInvisible: creature.senseInvisible || override.senseInvisible || "",
    illusionable: creature.illusionable || override.illusionable || "",
    imageSrc:
      getLocalLibrarySpriteUrl("creatures", creature?.name, creature?.slug) ||
      statusOverrides?.[creature?.slug || slugifyTibiaItemName(creature?.name)]?.imageSrc ||
      getCreatureOverrideImageUrl(creature?.name, detailOverride) ||
      getCreatureWikiImageUrl(creature?.name) ||
      creature.imageSrc ||
      "",
    stillImageSrc: getLocalLibrarySpriteStillUrl("creatures", creature?.name, creature?.slug)
  };
}

async function getCreatureDetail(payload = {}) {
  const name = String(payload.name || "").trim();

  if (!name) {
    throw new Error("Monstro nao informado.");
  }
  if (payload?.includeBossTracker && !slugifyWorldName(payload.worldSlug || payload.worldName || payload.world || "")) {
    throw new Error("Selecione um mundo disponível antes de consultar o boss.");
  }

  const slug = slugifyTibiaItemName(name);
  const cacheKey = `creature-detail:${CREATURE_DETAIL_CACHE_VERSION}:${slug}`;
  const legacyCacheKeys = [
    `creature-detail:v10:${slug}`,
    `creature-detail:v9:${slug}`
  ];
  // Load local creature corrections before touching persisted details so a
  // data audit is reflected immediately, even for creatures opened before it.
  await loadBundledCreatureIndex().catch(() => null);
  await loadCreatureStatusOverrides().catch(() => null);
  const cached = await getCache(cacheKey);

  if (cached) {
    const refreshedCached = await applyLocalCreatureTables(await refreshCachedCreatureDetail(cached));
    applyCanonicalCreatureDocument(refreshedCached, await getCanonicalLibraryDocument("creatures", name) || await getCanonicalLibraryDocument("bosses", name));

    if (refreshedCached !== cached) {
      await putCache(cacheKey, refreshedCached);
    }

    return payload?.includeBossTracker ? enrichCreatureDetailWithBossWorldData(refreshedCached, payload) : refreshedCached;
  }

  for (const legacyCacheKey of legacyCacheKeys) {
    const legacyCached = await getCache(legacyCacheKey);

    if (!legacyCached) {
      continue;
    }

    const migratedCached = await applyLocalCreatureTables(await refreshCachedCreatureDetail(legacyCached));
    applyCanonicalCreatureDocument(migratedCached, await getCanonicalLibraryDocument("creatures", name) || await getCanonicalLibraryDocument("bosses", name));
    await putCache(cacheKey, migratedCached);
    return payload?.includeBossTracker ? enrichCreatureDetailWithBossWorldData(migratedCached, payload) : migratedCached;
  }

  const canonicalDocument = await getCanonicalLibraryDocument("creatures", name) || await getCanonicalLibraryDocument("bosses", name);
  const localCreature = getLocalCreatureIndexEntry(name);
  const statusOverride = getCreatureStatusOverride(name, localCreature);
  if (!localCreature && !statusOverride && !canonicalDocument) {
    throw new Error("Criatura nao encontrada no acervo local auditado.");
  }
  const localFields = { ...(canonicalDocument ? canonicalCreatureIndexRecord(canonicalDocument) : {}), ...(localCreature || {}), ...(statusOverride || {}) };
  const normalized = await applyLocalCreatureTables(await enrichCreatureDetailForUi(
    normalizeCreatureDetailForUi({
      name: localFields.name || name,
      ...localFields,
      structuredData: { infobox: { name: localFields.name || name, fields: localFields } }
    })
  ));
  applyCanonicalCreatureDocument(normalized, canonicalDocument);
  await putCache(cacheKey, normalized);
  return payload?.includeBossTracker ? enrichCreatureDetailWithBossWorldData(normalized, payload) : normalized;
}

async function getBossTrackerForUi(payload = {}) {
  const name = String(payload.name || "").trim();
  const worldSlug = slugifyWorldName(payload.worldSlug || payload.worldName || payload.world || "");

  if (!name) {
    throw new Error("Boss nao informado.");
  }
  if (!worldSlug) throw new Error("Selecione um mundo disponível antes de consultar o boss.");

  const cacheKey = `boss-tracker:${BOSS_TRACKER_CACHE_VERSION}:${worldSlug}:${slugifyTibiaItemName(name)}`;
  const cachedEntry = await getCacheEntry(cacheKey);

  if (cachedEntry?.value && !cachedEntry.isExpired) {
    return cachedEntry.value;
  }

  if (cachedEntry?.value) {
    refreshCacheInBackground(cacheKey, async () => {
      const detail = await getCreatureDetail({
        ...payload,
        includeBossTracker: true
      });
      const bossTracker = detail?.bossTracker || null;
      if (bossTracker) {
        await putCache(cacheKey, bossTracker);
      }
      return bossTracker;
    });
    return cachedEntry.value;
  }

  const detail = await getCreatureDetail({
    ...payload,
    includeBossTracker: true
  });
  const bossTracker = detail?.bossTracker || null;

  if (bossTracker) {
    await putCache(cacheKey, bossTracker);
  }

  return bossTracker;
}

async function enrichCreatureDetailWithBossWorldData(detail, payload = {}) {
  if (!detail || !isBossCreatureDetail(detail)) {
    return detail;
  }

  const worldName = cleanEntityText(payload.worldName || payload.world || "");
  const worldSlug = slugifyWorldName(payload.worldSlug || worldName);

  if (!worldName || !worldSlug) {
    return detail;
  }

  const [bossWorld, killStatistics] = await Promise.all([
    fetchBossWorldTrackerPayload(worldSlug).catch(() => null),
    fetchBossKillStatisticsPayload(worldName).catch(() => null)
  ]);
  const bossEntry = findBossWorldEntry(bossWorld, detail.name);
  const bossSlug = bossEntry?.bossSlug || slugifyTibiaItemName(detail.name);
  const bossDetail = await fetchBossDetailTrackerPayload(worldSlug, bossSlug).catch(() => null);
  const killEntry = findBossKillStatisticsEntry(killStatistics, detail.name);
  const bossTracker = normalizeBossTrackerForUi({
    worldSlug,
    worldName,
    bossSlug,
    bossEntry,
    bossDetail,
    killEntry
  });

  if (!bossTracker) {
    return detail;
  }

  return {
    ...detail,
    bossTracker
  };
}

function isBossCreatureDetail(detail = {}) {
  return Boolean(
    cleanEntityText(detail.bossCategory) ||
      normalizeLookupValue(detail.isBoss) === "yes" ||
      normalizeLookupValue(detail.secondaryType).includes("boss")
  );
}

async function fetchBossWorldTrackerPayload(worldSlug) {
  return fetchGameDataHubJson(
    `${getGameDataHubBase()}/api/game/bosses/worlds/${encodeURIComponent(worldSlug)}`,
    "Falha ao consultar bosses do mundo",
    GAME_DATA_HUB_BOSS_TIMEOUT_MS
  );
}

async function fetchBossDetailTrackerPayload(worldSlug, bossSlug) {
  return fetchGameDataHubJson(
    `${getGameDataHubBase()}/api/game/bosses/worlds/${encodeURIComponent(worldSlug)}/${encodeURIComponent(bossSlug)}`,
    "Falha ao consultar detalhe do boss",
    GAME_DATA_HUB_BOSS_TIMEOUT_MS
  );
}

async function fetchBossKillStatisticsPayload(worldName) {
  const payload = await fetchGameDataHubJson(
    `${getGameDataHubBase()}/api/game/tibiadata/worlds/${encodeURIComponent(worldName)}/killstatistics`,
    "Falha ao consultar kill statistics",
    GAME_DATA_HUB_BOSS_TIMEOUT_MS
  );
  return payload?.killstatistics || null;
}

async function fetchGameDataHubJson(url, errorLabel, timeoutMs = GAME_DATA_HUB_BOSS_TIMEOUT_MS) {
  const sourceUrl = new URL(url);
  const bases = getGameDataHubBases(sourceUrl.origin);
  let lastError = null;

  for (const [index, base] of bases.entries()) {
    const isLastBase = index === bases.length - 1;
    const requestTimeoutMs = !isLastBase && bases.length > 1
      ? Math.min(timeoutMs, FALLBACK_BASE_TIMEOUT_MS)
      : timeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(`${base}${sourceUrl.pathname}${sourceUrl.search}`, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        },
        signal: controller.signal
      });
      const body = await response.text();

      if (!response.ok) {
        const error = new Error(`${errorLabel} (${response.status}): ${body}`);
        error.status = response.status;
        throw error;
      }

      return JSON.parse(body)?.data || null;
    } catch (error) {
      lastError = error?.name === "AbortError"
        ? new Error(`${errorLabel}: tempo limite ao consultar a base de dados.`)
        : error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error(`${errorLabel}: falha ao consultar a base de dados.`);
}

function findBossWorldEntry(bossWorldPayload, bossName) {
  const entries = Array.isArray(bossWorldPayload?.bosses) ? bossWorldPayload.bosses : [];
  const normalizedName = normalizeLookupValue(bossName);
  const slug = slugifyTibiaItemName(bossName);

  return entries.find((entry) =>
    normalizeLookupValue(entry?.name) === normalizedName ||
      slugifyTibiaItemName(entry?.name) === slug
  ) || null;
}

function findBossKillStatisticsEntry(killStatisticsPayload, bossName) {
  const entries = Array.isArray(killStatisticsPayload?.entries) ? killStatisticsPayload.entries : [];
  const normalizedName = normalizeLookupValue(bossName);
  const slug = slugifyTibiaItemName(bossName);

  return entries.find((entry) =>
    normalizeLookupValue(entry?.race) === normalizedName ||
      slugifyTibiaItemName(entry?.race) === slug
  ) || null;
}

function normalizeBossTrackerForUi({
  worldSlug,
  worldName,
  bossSlug,
  bossEntry,
  bossDetail,
  killEntry
} = {}) {
  const chancePercentage = toNumberOrNull(
    bossDetail?.appearanceChance?.percentage ?? bossEntry?.chancePercentage ?? null
  );
  const totalOccurrencesRaw = toNumberOrNull(bossDetail?.occurrenceStats?.totalOccurrences);
  const totalOccurrences = totalOccurrencesRaw && totalOccurrencesRaw > 0 ? totalOccurrencesRaw : null;
  const lastSeenDaysRaw = toNumberOrNull(bossDetail?.occurrenceStats?.lastSeenDays);
  const lastSeenDays = lastSeenDaysRaw && lastSeenDaysRaw > 0 ? lastSeenDaysRaw : null;
  const chart = Array.isArray(bossDetail?.occurrenceStats?.chart)
    ? bossDetail.occurrenceStats.chart
        .map((entry) => ({
          day: toNumberOrNull(entry?.day),
          occurrences: toNumberOrNull(entry?.occurrences) || 0
        }))
        .filter((entry) => entry.day !== null && (entry.day > 0 || entry.occurrences > 0))
    : [];
  const crossWorlds = Array.isArray(bossDetail?.crossWorlds)
    ? bossDetail.crossWorlds.map((entry) => ({
        worldSlug: cleanEntityText(entry?.worldSlug),
        worldName: cleanEntityText(entry?.worldName),
        chanceLabel: cleanEntityText(entry?.chanceLabel),
        chancePercentage: toNumberOrNull(entry?.chancePercentage),
        lastSeenDate: cleanEntityText(entry?.lastSeenDate),
        lastSeenRelative: cleanEntityText(entry?.lastSeenRelative)
      }))
    : [];
  const respawnHistory = Array.isArray(bossDetail?.respawnHistory)
    ? bossDetail.respawnHistory.map((entry) => ({
        date: cleanEntityText(entry?.date),
        killedBosses: toNumberOrNull(entry?.killedBosses),
        killedPlayers: toNumberOrNull(entry?.killedPlayers),
        world: cleanEntityText(entry?.world)
      }))
    : [];
  const respawnHistoryNote = cleanEntityText(bossDetail?.respawnHistoryNote);
  const routeMap = normalizeBossRouteMapForUi(bossDetail?.routeMap);
  const spawnChart = Array.isArray(bossDetail?.spawnChart)
    ? bossDetail.spawnChart.map((entry) => ({
        day: toNumberOrNull(entry?.day),
        percentage: toNumberOrNull(entry?.percentage)
      })).filter((entry) => entry.day !== null && entry.percentage !== null)
    : [];
  const worldStats = bossDetail?.worldStats && typeof bossDetail.worldStats === "object"
    ? {
        spawnTodayLabel: cleanEntityText(bossDetail.worldStats.spawnTodayLabel),
        spawnTodayPercentage: toNumberOrNull(bossDetail.worldStats.spawnTodayPercentage),
        expectedIn: cleanEntityText(bossDetail.worldStats.expectedIn),
        expectedWindow: cleanEntityText(bossDetail.worldStats.expectedWindow),
        lastSeenOnWorld: cleanEntityText(bossDetail.worldStats.lastSeenOnWorld),
        lastSeenOnWorldRelative: cleanEntityText(bossDetail.worldStats.lastSeenOnWorldRelative),
        killedOnWorld: toNumberOrNull(bossDetail.worldStats.killedOnWorld),
        killedPlayersOnWorld: toNumberOrNull(bossDetail.worldStats.killedPlayersOnWorld)
      }
    : null;
  const globalStats = bossDetail?.globalStats && typeof bossDetail.globalStats === "object"
    ? {
        killedOverall: toNumberOrNull(bossDetail.globalStats.killedOverall),
        killedPlayersOverall: toNumberOrNull(bossDetail.globalStats.killedPlayersOverall),
        lastSeenInTibia: cleanEntityText(bossDetail.globalStats.lastSeenInTibia),
        firstOccurrence: cleanEntityText(bossDetail.globalStats.firstOccurrence)
      }
    : null;
  const sourceCurrentDay = toNumberOrNull(bossDetail?.currentDay);
  const inferredCurrentDay = inferBossCurrentDay(worldStats);
  const hasData =
    Boolean(cleanEntityText(bossDetail?.lastSeenDate || bossEntry?.lastSeenDate)) ||
    Boolean(cleanEntityText(bossDetail?.appearanceChance?.label || bossEntry?.chanceLabel)) ||
    chancePercentage !== null ||
    totalOccurrences !== null ||
    chart.length > 0 ||
    spawnChart.length > 0 ||
    crossWorlds.length > 0 ||
    respawnHistory.length > 0 ||
    Boolean(respawnHistoryNote) ||
    Boolean(routeMap) ||
    Boolean(worldStats?.spawnTodayLabel || worldStats?.spawnTodayPercentage || worldStats?.expectedIn || worldStats?.killedOnWorld || worldStats?.killedPlayersOnWorld) ||
    Boolean(globalStats?.killedOverall || globalStats?.killedPlayersOverall || globalStats?.lastSeenInTibia || globalStats?.firstOccurrence) ||
    Boolean(killEntry);

  if (!hasData) {
    return null;
  }

  return {
    worldSlug,
    worldName,
    bossSlug,
    chanceLabel: cleanEntityText(bossDetail?.appearanceChance?.label || bossEntry?.chanceLabel),
    chancePercentage,
    category: cleanEntityText(bossDetail?.category || bossEntry?.category),
    lastSeenDate: cleanEntityText(bossDetail?.lastSeenDate || bossEntry?.lastSeenDate),
    lastSeenRelative: cleanEntityText(bossDetail?.lastSeenRelative || bossEntry?.lastSeenRelative),
    occurrenceSummary: cleanEntityText(bossDetail?.occurrenceStats?.summary),
    totalOccurrences,
    sampleOccurrences: toNumberOrNull(bossDetail?.occurrenceStats?.sampleOccurrences),
    lastSeenDays,
    chart,
    spawnChart,
    // Some source pages omit their chart variable intermittently. The source
    // still provides the world last-seen date/relative age, which is enough to
    // keep the marker and current-cycle chart accurate.
    currentDay: inferredCurrentDay ?? sourceCurrentDay,
    crossWorlds,
    worldStats,
    globalStats,
    respawnHistory,
    respawnHistoryNote,
    mapUrl: cleanEntityText(bossDetail?.mapUrl),
    routeMap,
    killStats: killEntry
      ? {
          lastDayPlayersKilled: toNumberOrNull(killEntry?.last_day_players_killed),
          lastDayKilled: toNumberOrNull(killEntry?.last_day_killed),
          lastWeekPlayersKilled: toNumberOrNull(killEntry?.last_week_players_killed),
          lastWeekKilled: toNumberOrNull(killEntry?.last_week_killed)
        }
      : null
  };
}

function inferBossCurrentDay(worldStats = null) {
  const relative = String(worldStats?.lastSeenOnWorldRelative || "").trim();
  const relativeMatch = relative.match(/(\d+)\s*day/i);

  if (relativeMatch) {
    return Number(relativeMatch[1]);
  }

  if (/today|hoje/i.test(relative)) {
    return 0;
  }

  const dateText = String(worldStats?.lastSeenOnWorld || "").trim();
  const dateMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!dateMatch) {
    return null;
  }

  const seenAt = Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const getPart = (type) => parts.find((part) => part.type === type)?.value || "";
  const year = Number(getPart("year"));
  const month = Number(getPart("month"));
  const day = Number(getPart("day"));

  if (![year, month, day].every(Number.isFinite)) {
    return null;
  }

  const todayAt = Date.UTC(year, month - 1, day);
  const difference = Math.floor((todayAt - seenAt) / 86400000);
  return difference >= 0 ? difference : null;
}

function normalizeBossRouteMapForUi(routeMap) {
  if (!routeMap || typeof routeMap !== "object") {
    return null;
  }

  const maps = Array.isArray(routeMap.maps)
    ? routeMap.maps
        .map((map) => {
          const paths = Array.isArray(map?.paths)
            ? map.paths
                .map((pathEntry) => ({
                  floor: toNumberOrNull(pathEntry?.floor),
                  pulseColor: cleanEntityText(pathEntry?.pulseColor),
                  pathColor: cleanEntityText(pathEntry?.pathColor),
                  weight: toNumberOrNull(pathEntry?.weight),
                  delay: toNumberOrNull(pathEntry?.delay),
                  dashArray: Array.isArray(pathEntry?.dashArray)
                    ? pathEntry.dashArray.map((value) => toNumberOrNull(value)).filter((value) => value !== null)
                    : [],
                  routes: Array.isArray(pathEntry?.routes)
                    ? pathEntry.routes
                        .map((point) => normalizeBossRoutePoint(point))
                        .filter(Boolean)
                    : []
                }))
                // Keep route data with at least one valid point. The inline
                // renderer still decides whether it can draw a polyline.
                .filter((pathEntry) => pathEntry.routes.length > 0)
            : [];

          if (!paths.length) {
            return null;
          }

          return {
            id: cleanEntityText(map?.id),
            name: cleanEntityText(map?.name),
            slug: cleanEntityText(map?.slug),
            cords: normalizeBossRoutePoint(map?.cords),
            markers: Array.isArray(map?.markers)
              ? map.markers
                  .map((marker) => {
                    const point = normalizeBossRoutePoint(marker);
                    return point ? { ...point, icon: cleanEntityText(marker?.icon) } : null;
                  })
                  .filter(Boolean)
              : [],
            paths,
            speed: toNumberOrNull(map?.speed) || 500,
            type: cleanEntityText(map?.type)
          };
        })
        .filter(Boolean)
    : [];

  if (!maps.length) {
    return null;
  }

  return {
    sourceUrl: cleanEntityText(routeMap.sourceUrl),
    mapDirectory: cleanEntityText(routeMap.mapDirectory),
    mapFromCDN: Boolean(routeMap.mapFromCDN),
    maps
  };
}

function normalizeBossRoutePoint(point) {
  if (!point || typeof point !== "object") {
    return null;
  }

  const x = toNumberOrNull(point.x);
  const y = toNumberOrNull(point.y);

  if (x === null || y === null) {
    return null;
  }

  return {
    x,
    y,
    floor: toNumberOrNull(point.floor),
    zoom: toNumberOrNull(point.zoom)
  };
}

async function refreshCachedCreatureDetail(detail) {
  if (!detail || typeof detail !== "object") {
    return detail;
  }

  const originalLoot = Array.isArray(detail.loot) ? detail.loot : [];
  const normalizedLoot = normalizeCreatureLootEntries(detail.loot);
  const statusOverride = getCreatureStatusOverride(detail.name, getLocalCreatureIndexEntry(detail.name));
  const refreshedDetail = applyCreatureOverrideFields({ ...detail, loot: normalizedLoot }, statusOverride);
  const loot = Array.isArray(refreshedDetail.loot) ? refreshedDetail.loot : [];
  const detailChanged = JSON.stringify(refreshedDetail) !== JSON.stringify(detail);

  if (loot.length === 0) {
    return originalLoot.length > 0
      ? { ...refreshedDetail, loot: [] }
      : detail;
  }

  if (!loot.some((entry) => shouldRefreshCreatureLootEntry(entry))) {
    return detailChanged
      ? refreshedDetail
      : detail;
  }

  const refreshedLoot = await hydrateCreatureLootItems(applyCreatureLootRarityOverrides(detail.name, loot));

  if (JSON.stringify(refreshedLoot) === JSON.stringify(loot) && !detailChanged) {
    return detail;
  }

  return {
    ...refreshedDetail,
    loot: refreshedLoot
  };
}

function normalizeCreatureLootEntries(loot = []) {
  if (!Array.isArray(loot)) {
    return [];
  }

  return loot
    .map((entry) => {
      const name = normalizeCreatureLootItemName(entry?.name || "");

      if (!name) {
        return null;
      }

      return {
        ...entry,
        name,
        slug: slugifyTibiaItemName(name)
      };
    })
    .filter(Boolean);
}

function shouldRefreshCreatureLootEntry(entry) {
  const imageSrc = String(entry?.imageSrc || "");
  const fallbackSrc = String(entry?.imageFallbackSrc || "");

  return (
    !imageSrc ||
    /^file:\/\//i.test(imageSrc) ||
    imageSrc.includes("/assets/library/items/catalog/sprites/") ||
    imageSrc.includes("tibiadata-assets-api-v1") ||
    !fallbackSrc
  );
}

function getLocalCreatureIndexEntry(name) {
  const normalizedName = normalizeLookupValue(name);
  const slug = slugifyTibiaItemName(name);
  return creatureIndexBundleValue?.items?.find(
    (creature) => creature.slug === slug || normalizeLookupValue(creature.name) === normalizedName
  ) || null;
}

function getCreatureStatusOverride(name, creature = null) {
  const keys = [
    creature?.slug,
    slugifyTibiaItemName(name),
    slugifyCreatureCatalogKey(name)
  ].filter(Boolean);

  for (const key of keys) {
    const override = creatureStatusOverridesValue?.[key];

    if (override) {
      return override;
    }
  }

  return null;
}

function slugifyCreatureCatalogKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeNpcIndexEntry(npc) {
  const name = String(npc?.name || "").trim();

  if (!isValidNpcIndexName(name)) {
    return null;
  }

  const buySell = String(npc.buySell || npc.trade || npc.buy_sell || "").toLowerCase();
  const hasTrade = buySell === "yes" || buySell === "true";
  const slug = npc.slug || slugifyTibiaItemName(name);
  const override = NPC_DETAIL_OVERRIDES[slug] || null;
  const job = cleanEntityText(npc.job);
  const job2 = cleanEntityText(npc.job2);
  const displayName = override?.name || name;

  return {
    name: displayName,
    slug,
    city: cleanEntityText(npc.city),
    location: cleanEntityText(override?.location || npc.location),
    subarea: cleanEntityText(npc.subarea),
    job: isWeakNpcJob(job) && override?.job ? override.job : job,
    job2: isWeakNpcJob(job2) && override?.job2 ? override.job2 : job2,
    trade: override?.trade || (buySell ? (hasTrade ? "yes" : "no") : "unknown"),
    implemented: cleanEntityText(npc.implemented),
    notes: cleanEntityText(npc.notes),
    spoilers: Array.isArray(npc.spoilers) ? npc.spoilers : [],
    map: npc.map || null,
    functionSlugs: Array.isArray(npc.functionSlugs)
      ? npc.functionSlugs.map((value) => cleanEntityText(value)).filter(Boolean)
      : [],
    functionLabels: Array.isArray(npc.functionLabels)
      ? npc.functionLabels.map((value) => cleanEntityText(value)).filter(Boolean)
      : [],
    cityCategorySlugs: Array.isArray(npc.cityCategorySlugs)
      ? npc.cityCategorySlugs.map((value) => cleanEntityText(value)).filter(Boolean)
      : [],
    cityCategoryLabels: Array.isArray(npc.cityCategoryLabels)
      ? npc.cityCategoryLabels.map((value) => cleanEntityText(value)).filter(Boolean)
      : [],
    imageSrc: getLocalLibrarySpriteUrl("npcs", displayName, slug) || npc.imageSrc || npc.image_src || getNpcImageUrl(displayName),
    stillImageSrc: getLocalLibrarySpriteStillUrl("npcs", displayName, slug)
  };
}

function normalizeNpcDetailForUi(detail, fallback = {}) {
  const info = detail?.structuredData?.infobox || {};
  const fields = info.fields || {};
  const baseName = detail?.name || fallback.name;
  const override = NPC_DETAIL_OVERRIDES[slugifyTibiaItemName(baseName)] || null;
  const name = override?.name || baseName;
  const job = cleanEntityText(info.job || fields.job || fallback.job);
  const job2 = cleanEntityText(info.job2 || fields.job2 || fallback.job2);
  const buySell = String(info.buySell || fields.buysell || fallback.trade || "").toLowerCase();
  const hasTrade = buySell === "yes" || buySell === "true";

  return {
    name,
    slug: slugifyTibiaItemName(name),
    summary: cleanEntityText(detail?.summary),
    city: cleanEntityText(info.city || fields.city || fallback.city),
    location: cleanEntityText(info.location || fields.location || fallback.location),
    subarea: cleanEntityText(info.subarea || fields.subarea || fallback.subarea),
    job,
    job2,
    race: cleanEntityText(info.race || fields.race),
    gender: cleanEntityText(info.gender || fields.gender),
    trade: buySell ? (hasTrade ? "yes" : "no") : "unknown",
    implemented: cleanEntityText(info.implemented || fields.implemented),
    notes: cleanEntityText(info.notes || fields.notes || fallback.notes),
    spoilers: Array.isArray(fallback.spoilers) ? fallback.spoilers : [],
    sounds: parseSoundList(info.sounds || fields.sounds),
    wikiUrl: getTibiaWikiBrPageUrl(name),
    lastUpdated: detail?.lastUpdated || null,
    imageSrc: getNpcImageUrl(name),
    stillImageSrc: getLocalLibrarySpriteStillUrl("npcs", name),
    map: extractMapReference(info, fields)
  };
}

async function enrichNpcDetailForUi(detail) {
  const enriched = { ...detail };
  const jobOverrides = await loadNpcJobOverrides();

  if (!enriched.name) {
    return enriched;
  }

  applyNpcJobOverride(enriched, jobOverrides);

  // Library facts are completed only by the audited local pack. Do not use a
  // live Fandom page to silently fill a missing NPC field.

  const override = NPC_DETAIL_OVERRIDES[slugifyTibiaItemName(enriched.name)] || null;

  if (override) {
    Object.entries(override).forEach(([key, value]) => {
      if (value) {
        enriched[key] = value;
      }
    });
    enriched.wikiUrl = getTibiaWikiBrPageUrl(enriched.name);
    enriched.imageSrc = getNpcImageUrl(enriched.name);
  }

  applyNpcJobOverride(enriched, jobOverrides);

  return enriched;
}

function isWeakNpcJob(value) {
  const normalized = normalizeLookupValue(value);
  return (
    !normalized ||
    normalized === "unknown occupation" ||
    normalized === "unknown" ||
    normalized === "desconhecido" ||
    normalized.includes("sem ocupacao")
  );
}

async function getNpcTradeItems(npcName) {
  const normalizedNpcName = normalizeLookupValue(npcName);
  const metadataIndex = await getItemMetadataIndex();
  const buy = [];
  const sell = [];

  metadataIndex.items.forEach((item) => {
    const npcBuyEntry = findNpcTradeEntry(item.npc_buy, normalizedNpcName);
    const npcSellEntry = findNpcTradeEntry(item.npc_sell, normalizedNpcName);

    if (npcBuyEntry) {
      buy.push(buildNpcTradeItem(item, npcBuyEntry));
    }

    if (npcSellEntry) {
      sell.push(buildNpcTradeItem(item, npcSellEntry));
    }
  });

  return {
    buy: buy.sort(compareNpcTradeItems),
    sell: sell.sort(compareNpcTradeItems)
  };
}

function findNpcTradeEntry(trades, normalizedNpcName) {
  if (!Array.isArray(trades)) {
    return null;
  }

  return trades.find((trade) => normalizeLookupValue(trade?.name) === normalizedNpcName) || null;
}

function buildNpcTradeItem(item, trade) {
  return {
    name: item.wiki_name || item.name,
    slug: item.slug,
    category: item.category || "",
    imageSrc: getItemImageUrl(item),
    imageFallbackSrc: getRemoteItemImageUrl(item.assetId),
    price: typeof trade?.price === "number" ? trade.price : null
  };
}

function compareNpcTradeItems(left, right) {
  return left.name.localeCompare(right.name);
}

function normalizeCreatureIndexEntry(entry) {
  const name = String(entry?.name || "").trim();

  if (!name) {
    return null;
  }

  return {
    id: entry.id || null,
    name,
    slug: slugifyTibiaItemName(name),
    hitpoints: toNumberOrNull(entry.hitpoints),
    experience: toNumberOrNull(entry.experience),
    lastUpdated: entry.lastUpdated || null,
    imageSrc: getRemoteAssetImageUrl(entry?.primaryImage?.assetId)
  };
}

function normalizeCreatureDetailForUi(detail) {
  const info = detail?.structuredData?.infobox || {};
  const fields = info.fields || {};
  const name = detail?.name || info.name || fields.name || "Monstro";
  const override = CREATURE_DETAIL_OVERRIDES[slugifyTibiaItemName(name)] || null;
  const bundledCreature = creatureIndexBundleValue?.items?.find(
    (creature) => normalizeLookupValue(creature.name) === normalizeLookupValue(name)
  );
  const statusOverride = getCreatureStatusOverride(name, bundledCreature);
  const experience = toNumberOrNull(
    statusOverride?.experience ||
      statusOverride?.exp ||
      fields.exp ||
      detail?.experience ||
      bundledCreature?.experience
  );
  const difficulty = cleanEntityText(statusOverride?.difficulty || fields.bestiarylevel || info.bestiaryDifficulty);
  const occurrence = cleanEntityText(statusOverride?.occurrence || info.bestiaryOccurrence || fields.occurrence);
  const bossCategory = cleanEntityText(
    statusOverride?.bossCategory ||
      statusOverride?.bosstiaryclass ||
      info.bosstiaryCategory ||
      fields.bosstiaryclass ||
      fields.bosstiarycategory
  );
  const isBoss = cleanEntityText(info.isBoss || fields.isboss);

  return {
    name,
    slug: slugifyTibiaItemName(name),
    imageSrc:
      getLocalLibrarySpriteUrl("creatures", name, bundledCreature?.slug) ||
      statusOverride?.imageSrc ||
      getCreatureOverrideImageUrl(name, override) ||
      getCreatureWikiImageUrl(name) ||
      getCreatureImageUrl(detail) ||
      bundledCreature?.imageSrc ||
      "",
    stillImageSrc: getLocalLibrarySpriteStillUrl("creatures", name, bundledCreature?.slug),
    wikiUrl: statusOverride?.wikiUrl || getTibiaWikiBrPageUrl(name),
    lastUpdated: detail?.lastUpdated || null,
    hitpoints: toNumberOrNull(statusOverride?.hitpoints || statusOverride?.hp || fields.hp || detail?.hitpoints || bundledCreature?.hitpoints),
    experience,
    bonusExperience: Math.round((experience || 0) * 1.5),
    armor: toNumberOrNull(statusOverride?.armor || info.armor || fields.armor || bundledCreature?.armor),
    mitigation: toNumberOrNull(override?.mitigation || statusOverride?.mitigation || info.mitigation || fields.mitigation || bundledCreature?.mitigation),
    speed: toNumberOrNull(statusOverride?.speed || info.speed || fields.speed || bundledCreature?.speed),
    charms: toNumberOrNull(override?.charms || statusOverride?.charms || statusOverride?.charmspoints || fields.charmspoints || fields.charms || bundledCreature?.charms),
    creatureClass: cleanEntityText(info.creatureClass || fields.creatureclass),
    primaryType: cleanEntityText(info.primaryType || fields.primarytype),
    secondaryType: cleanEntityText(info.secondaryType || fields.secondarytype),
    difficulty,
    occurrence,
    isBoss,
    bossCategory,
    bestiaryWarning: Boolean(
      !difficulty &&
        !occurrence &&
        (bossCategory || normalizeLookupValue(isBoss) === "yes")
    ),
    summon: cleanEntityText(info.summon || fields.summon),
    convince: cleanEntityText(info.convince || fields.convince),
    pushable: cleanEntityText(statusOverride?.pushable || info.pushable || fields.pushable),
    pushObjects: cleanEntityText(statusOverride?.pushObjects || statusOverride?.pushobjects || info.pushObjects || fields.pushobjects),
    walksAround: cleanEntityText(statusOverride?.walksAround || statusOverride?.walksaround || info.walksAround || fields.walksaround),
    walksThrough: cleanEntityText(statusOverride?.walksThrough || statusOverride?.walksthrough || info.walksThrough || fields.walksthrough),
    paralyzeImmune: cleanEntityText(statusOverride?.paralyzeImmune || statusOverride?.paraimmune || info.paralyzeImmune || fields.paraimmune),
    senseInvisible: cleanEntityText(statusOverride?.senseInvisible || statusOverride?.senseinvis || info.senseInvisible || fields.senseinvis),
    illusionable: cleanEntityText(statusOverride?.illusionable || info.illusionable || fields.illusionable),
    abilities: parseCreatureAbilities(info.abilities || fields.abilities),
    behaviour: cleanCreatureTextValue(override?.behaviour || statusOverride?.behaviour || info.behaviour || fields.behaviour),
    strategy: cleanEntityText(info.strategy || fields.strategy),
    location: cleanCreatureTextValue(override?.location || statusOverride?.location || info.location || fields.location),
    sounds: parseSoundList(info.sounds || fields.sounds),
    notes: cleanEntityText(info.notes || fields.notes),
    history: cleanEntityText(info.history || fields.history),
    damageModifiers: buildCreatureDamageModifiers(info, fields),
    // The local TibiaWiki BR audit is authoritative for loot categories.
    // Prefer it before any remote payload so every rarity row reaches the UI.
    loot: Array.isArray(statusOverride?.loot) && statusOverride.loot.length > 0
      ? statusOverride.loot.map((entry) => ({ ...entry }))
      : parseCreatureLoot(info.loot || fields.loot),
    map: extractMapReference(info, fields)
  };
}

async function enrichCreatureDetailForUi(detail) {
  const enriched = { ...detail };
  const override = CREATURE_DETAIL_OVERRIDES[slugifyTibiaItemName(enriched.name)] || null;
  const statusOverride = getCreatureStatusOverride(enriched.name, getLocalCreatureIndexEntry(enriched.name));
  const needsFallback =
    hasMissingCreatureNumber(enriched.hitpoints) ||
    hasMissingCreatureNumber(enriched.experience) ||
    hasMissingCreatureNumber(enriched.speed) ||
    hasMissingCreatureNumber(enriched.armor) ||
    hasMissingCreatureNumber(enriched.charms) ||
    isUnknownCreatureText(enriched.difficulty) ||
    isUnknownCreatureText(enriched.occurrence) ||
    isUnknownCreatureText(enriched.behaviour) ||
    isUnknownCreatureText(enriched.location);

  if (needsFallback) {
    // Missing fields remain visibly unknown until they are reviewed into the
    // local pack. The app must never silently fill Library facts from Fandom.
    const fandomFields = null;

    if (fandomFields) {
      applyCreatureNumberFallback(enriched, "hitpoints", fandomFields.hp);
      applyCreatureNumberFallback(enriched, "experience", fandomFields.exp);
      applyCreatureNumberFallback(enriched, "speed", fandomFields.speed);
      applyCreatureNumberFallback(enriched, "armor", fandomFields.armor);
      applyCreatureNumberFallback(enriched, "mitigation", fandomFields.mitigation);
      applyCreatureNumberFallback(enriched, "charms", fandomFields.charmspoints || fandomFields.charms);

      if (hasMissingCreatureNumber(enriched.experience)) {
        enriched.bonusExperience = 0;
      } else {
        enriched.bonusExperience = Math.round(enriched.experience * 1.5);
      }

      if (isUnknownCreatureText(enriched.difficulty)) {
        enriched.difficulty = cleanCreatureTextValue(fandomFields.bestiarylevel);
      }

      if (isUnknownCreatureText(enriched.occurrence)) {
        enriched.occurrence = cleanCreatureTextValue(fandomFields.occurrence);
      }

      if (isUnknownCreatureText(enriched.behaviour)) {
        enriched.behaviour = cleanCreatureTextValue(
          fandomFields.behaviour ||
            fandomFields.behavior ||
            fandomFields.strategy
        );
      }

      if (isUnknownCreatureText(enriched.location)) {
        enriched.location = cleanCreatureTextValue(fandomFields.location);
      }

      if (!enriched.map?.url) {
        enriched.map = extractMapReference({}, fandomFields);
      }

      if (!enriched.bossCategory && (fandomFields.bosstiaryclass || fandomFields.bosstiarycategory)) {
        enriched.bossCategory = cleanCreatureTextValue(fandomFields.bosstiaryclass || fandomFields.bosstiarycategory);
      }

      applyCreatureTextFallback(enriched, "pushable", fandomFields.pushable);
      applyCreatureTextFallback(enriched, "pushObjects", fandomFields.pushobjects);
      applyCreatureTextFallback(enriched, "walksAround", fandomFields.walksaround);
      applyCreatureTextFallback(enriched, "walksThrough", fandomFields.walksthrough);
      applyCreatureTextFallback(enriched, "paralyzeImmune", fandomFields.paraimmune);
      applyCreatureTextFallback(enriched, "senseInvisible", fandomFields.senseinvis);
      applyCreatureTextFallback(enriched, "illusionable", fandomFields.illusionable);

      if ((!Array.isArray(enriched.abilities) || enriched.abilities.length === 0) && fandomFields.abilities) {
        enriched.abilities = parseCreatureAbilities(fandomFields.abilities);
      }

      if ((!Array.isArray(enriched.sounds) || enriched.sounds.length === 0) && fandomFields.sounds) {
        enriched.sounds = parseSoundList(fandomFields.sounds);
      }

      if ((!Array.isArray(enriched.loot) || enriched.loot.length === 0) && fandomFields.loot) {
        enriched.loot = parseCreatureLoot(fandomFields.loot);
      }
    }
  }

  applyCreatureOverrideFields(enriched, statusOverride);
  if (Array.isArray(statusOverride?.loot) && statusOverride.loot.length > 0) {
    enriched.loot = statusOverride.loot.map((entry) => ({ ...entry }));
  }
  applyCreatureOverrideFields(enriched, override, { onlyWhenMissing: true });

  // Keep the desktop document faithful to the reviewed local source while
  // removing collector-only MediaWiki remnants. This is presentation cleanup,
  // never an automatic rewrite of facts.
  const narrativeSlug = slugifyTibiaItemName(enriched.name);
  enriched.notes = normalizeAuditedNarrative(enriched.notes, narrativeSlug);
  enriched.history = normalizeAuditedNarrative(enriched.history, narrativeSlug, { allowOverride: false });
  enriched.behaviour = normalizeAuditedNarrative(enriched.behaviour, narrativeSlug, { allowOverride: false });
  if (normalizeLookupValue(enriched.history) === normalizeLookupValue(enriched.notes)) {
    enriched.history = "";
  }

  if (hasMissingCreatureNumber(enriched.charms)) {
    const fallbackCharms = getCharmPointsFromDifficulty(enriched.difficulty);
    if (fallbackCharms !== null) {
      enriched.charms = fallbackCharms;
    }
  }

  enriched.bestiaryWarning = Boolean(
    !cleanCreatureTextValue(enriched.difficulty) &&
      !cleanCreatureTextValue(enriched.occurrence) &&
      (enriched.bossCategory || normalizeLookupValue(enriched.isBoss) === "yes")
  );

  enriched.loot = await hydrateCreatureLootItems(
    applyCreatureLootRarityOverrides(enriched.name, normalizeCreatureLootEntries(enriched.loot || []))
  );

  // The audit mirrors entity sprites into the local content pack. A source
  // URL may remain in the factual record for traceability, but must not win
  // over the local file at runtime.
  enriched.imageSrc = getLocalLibrarySpriteUrl("creatures", enriched.name, enriched.slug) || enriched.imageSrc;

  return enriched;
}

function applyCreatureOverrideFields(target, override = {}, options = {}) {
  if (!override) {
    return target;
  }

  Object.entries(override).forEach(([key, value]) => {
    if (!hasMeaningfulOverrideValue(value)) {
      return;
    }

    if (options.onlyWhenMissing && hasMeaningfulOverrideValue(target[key])) {
      return;
    }

    target[key] = value;
  });

  return target;
}

function hasMeaningfulOverrideValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return Boolean(value || value === 0);
}

function applyCreatureLootRarityOverrides(creatureName, loot = []) {
  const overrides = CREATURE_LOOT_RARITY_OVERRIDES[slugifyTibiaItemName(creatureName)] || null;

  if (!overrides || !Array.isArray(loot)) {
    return loot;
  }

  return loot.map((item) => {
    const rarity = overrides[slugifyTibiaItemName(item?.name)];
    return rarity ? { ...item, rarity } : item;
  });
}

function getCharmPointsFromDifficulty(difficulty) {
  const normalized = normalizeLookupValue(difficulty);

  return Object.prototype.hasOwnProperty.call(BESTIARY_CHARM_POINTS, normalized)
    ? BESTIARY_CHARM_POINTS[normalized]
    : null;
}

function applyCreatureNumberFallback(target, key, value) {
  if (!hasMissingCreatureNumber(target[key])) {
    return;
  }

  const number = toNumberOrNull(value);
  if (number !== null && (key !== "hitpoints" || number > 0)) {
    target[key] = number;
  }
}

function applyCreatureTextFallback(target, key, value) {
  if (!isUnknownCreatureText(target[key])) {
    return;
  }

  const cleaned = cleanCreatureTextValue(value);
  if (cleaned) {
    target[key] = cleaned;
  }
}

function hasMissingCreatureNumber(value) {
  return !value || value <= 0;
}

function isUnknownCreatureText(value) {
  const normalized = normalizeLookupValue(value);
  return !normalized || normalized === "unknown" || normalized === "unknown.";
}

function cleanCreatureTextValue(value) {
  const cleaned = cleanEntityText(value);
  return isUnknownCreatureText(cleaned) ? "" : cleaned;
}

function normalizeAuditedNarrative(value, slug = "", { allowOverride = true } = {}) {
  const reviewed = allowOverride ? FACTUAL_NARRATIVE_OVERRIDES[slug] : "";
  if (reviewed) return reviewed;
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\[\[(?:Arquivo|File|Image|Imagem):[^\]]+\]\]/gi, "")
    .replace(/(?:Arquivo|File|Image|Imagem):[^|\n]*?\.(?:png|gif|jpe?g|webp)/gi, "")
    .replace(/(?:^|(?<=\s))[A-Za-zÀ-ÿ0-9_()'-]+(?:[ _-][A-Za-zÀ-ÿ0-9_()'-]+){0,8}\.(?:png|gif|jpe?g|webp)(?=\|)/gi, "")
    .replace(/\|(?=\s|$)/g, "")
    .replace(/\s*\(\s*\)/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/(^|\n)\s*\*(?=\S)(?!\*)/g, "$1* ")
    .replace(/([^\n])[^\S\r\n]+\*\s+/g, "$1\n* ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseCreatureLoot(value) {
  const raw = String(value || "");

  if (!raw) {
    return [];
  }

  const items = [];
  const regex = /\{\{Loot Item\|([^{}]+)\}\}/gi;
  let cursor = 0;
  let contextRarity = "";
  let match = regex.exec(raw);

  while (match) {
    contextRarity = inferCreatureLootContext(raw.slice(cursor, match.index), contextRarity);
    const item = parseCreatureLootItem(match[1], { contextRarity });
    if (item) {
      items.push(item);
    }
    cursor = regex.lastIndex;
    match = regex.exec(raw);
  }

  return items;
}

function parseCreatureLootItem(value, options = {}) {
  const parts = splitWikiTemplateParts(value).map((part) => cleanEntityText(part)).filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const contextRarity = normalizeLootRarity(options.contextRarity);
  const rarityCandidate = normalizeLootRarity(parts[parts.length - 1]);
  const itemQualifierFromPart = normalizeLootQualifier(parts[parts.length - 1]);
  const body = rarityCandidate || itemQualifierFromPart ? parts.slice(0, -1) : parts;
  const hasAmount = body.length > 1 && looksLikeLootAmount(body[0]);
  const amount = hasAmount ? body[0] : "";
  const rawName = hasAmount ? body.slice(1).join(" ") : body.join(" ");
  const extractedName = extractCreatureLootNameAndQualifier(rawName);
  const name = normalizeCreatureLootItemName(extractedName.name);
  const lootQualifier = normalizeLootQualifier(extractedName.qualifier || itemQualifierFromPart);
  const rarity = resolveCreatureLootRarity(contextRarity, rarityCandidate, lootQualifier);

  if (!name) {
    return null;
  }

  return {
    name,
    amount,
    rarity,
    slug: slugifyTibiaItemName(name),
    imageSrc: ""
  };
}

function resolveCreatureLootRarity(contextRarity, rarityCandidate, lootQualifier) {
  if (contextRarity === "event") {
    const qualifier = lootQualifier || rarityCandidate;
    return qualifier ? `event-${qualifier}` : "event";
  }

  // A missing rarity is not evidence of a common drop. Keep it in the local
  // audit trail as unknown; the site and app deliberately hide unknown rows
  // instead of inventing a category for the visitor.
  return rarityCandidate || lootQualifier || contextRarity || "unknown";
}

function inferCreatureLootContext(text, currentRarity = "") {
  const normalized = normalizeLookupValue(cleanEntityText(text));
  const checks = [
    [/durante\s+(invasoes|invasao|eventos|evento)/, "event"],
    [/\bmuito\s+raro\s*:?$/, "very-rare"],
    [/\bsemi\s*-?\s*raro\s*:?$/, "semi-rare"],
    [/\bincomum\s*:?$/, "uncommon"],
    [/\braro\s*:?$/, "rare"],
    [/\bcomum\s*:?$/, "common"],
    [/\bloot\s*:?$/, ""]
  ];

  for (const [pattern, rarity] of checks) {
    if (pattern.test(normalized)) {
      return rarity;
    }
  }

  return currentRarity;
}

function extractCreatureLootNameAndQualifier(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(.*?)\s*\(([^()]+)\)\s*$/);

  if (!match) {
    return { name: text, qualifier: "" };
  }

  const qualifier = normalizeLootQualifier(match[2]);

  if (!qualifier) {
    return { name: text, qualifier: "" };
  }

  return {
    name: match[1].trim(),
    qualifier
  };
}

function normalizeCreatureLootItemName(value) {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+\balways\b$/i, "")
    .trim()
    .replace(/[;,.:]+$/g, "")
    .trim();
  const normalized = normalizeLookupValue(cleaned);

  if (
    !normalized ||
    normalized === "?" ||
    normalized === "desconhecido" ||
    normalized === "nenhum" ||
    normalized === "sweet dreams quest" ||
    /sempre cai na primeira vez/i.test(cleaned) ||
    /depois muito raro/i.test(cleaned)
  ) {
    return "";
  }

  if (normalized === "small rubbies") {
    return "Small Ruby";
  }

  if (normalized === "rusty armor") {
    return "Rusted Armor";
  }

  if (normalized === "moonsilver crystals 1") {
    return "Moonsilver Crystals";
  }

  return cleaned;
}

function normalizeLootRarity(value) {
  const normalized = normalizeLookupValue(value);
  const rarityMap = {
    common: "common",
    comum: "common",
    uncommon: "uncommon",
    incomum: "uncommon",
    "semi rare": "semi-rare",
    "semi-rare": "semi-rare",
    "semi raro": "semi-rare",
    rare: "rare",
    raro: "rare",
    "very rare": "very-rare",
    "very-rare": "very-rare",
    "muito raro": "very-rare",
    "extremely rare": "very-rare",
    "extremely-rare": "very-rare",
    event: "event",
    "during events": "event",
    "durante eventos": "event",
    "durante evento": "event",
    "durante invasoes": "event",
    "durante invasao": "event",
    always: "always",
    sempre: "always"
  };

  return rarityMap[normalized] || "";
}

function normalizeLootQualifier(value) {
  const normalized = normalizeLookupValue(value);
  const qualifierMap = {
    common: "common",
    comum: "common",
    uncommon: "uncommon",
    incomum: "uncommon",
    "semi rare": "semi-rare",
    "semi-rare": "semi-rare",
    "semi raro": "semi-rare",
    rare: "rare",
    raro: "rare",
    "very rare": "very-rare",
    "very-rare": "very-rare",
    "muito raro": "very-rare",
    always: "always",
    sempre: "always"
  };

  return qualifierMap[normalized] || "";
}

function looksLikeLootAmount(value) {
  return /^(\d+|\d+\s*-\s*\d+|0\s*-\s*\d+|atÃ©\s+\d+)/i.test(String(value || "").trim());
}

async function hydrateCreatureLootItems(loot = []) {
  if (!Array.isArray(loot) || loot.length === 0) {
    return [];
  }

  const metadataIndex = await getItemMetadataIndex().catch(() => null);

  if (!metadataIndex) {
    return loot;
  }

  return loot.map((entry) => {
    const item = findItemSummaryByName(metadataIndex, entry.name);

    if (!item) {
      return entry;
    }

    return {
      ...entry,
      name: item.wiki_name || item.name || entry.name,
      slug: item.slug || entry.slug,
      category: item.category || "",
      imageSrc: getItemImageUrl(item),
      imageFallbackSrc: getRemoteItemImageUrl(item.assetId)
    };
  });
}

function getCreatureImageUrl(detail) {
  return getLocalLibrarySpriteUrl("creatures", detail?.name) || getRemoteAssetImageUrl(
    detail?.primaryImage?.assetId ||
      (Array.isArray(detail?.images) ? detail.images[0]?.assetId : null)
  );
}

function getCreatureOverrideImageUrl(name) {
  const local = getLocalLibrarySpriteUrl("creatures", name);
  if (local) return local;
  return "";
}

function getCreatureWikiImageUrl(name) {
  const local = getLocalLibrarySpriteUrl("creatures", name);
  if (local) return local;
  const displayName = String(name || "")
    .replace(/\s+\(Creature\)$/i, "")
    .trim();

  if (!displayName) {
    return "";
  }

  return "";
}

function parseCreatureAbilities(value) {
  const raw = String(value || "");

  if (!raw || raw === "{}") {
    return [];
  }

  const abilities = [];
  const meleeMatch = raw.match(/\{\{Melee\|([^}]+)\}\}/i);
  if (meleeMatch) {
    abilities.push(...parseCreatureMeleeAbility(meleeMatch[1]));
  }

  const abilityRegex = /\{\{Ability\|([^}]+)\}\}/gi;
  let match = abilityRegex.exec(raw);

  while (match) {
    const ability = parseCreatureAbilityTemplate(match[1]);

    if (ability) {
      abilities.push(ability);
    }

    match = abilityRegex.exec(raw);
  }

  if (abilities.length > 0) {
    return abilities;
  }

  const fallback = cleanEntityText(raw);
  return fallback && fallback !== "{}" ? [{ element: "Fisico", name: fallback, value: "" }] : [];
}

function parseCreatureMeleeAbility(value) {
  const parts = splitWikiTemplateParts(value);
  const abilities = [];
  const physicalValue = cleanCreatureAbilityValue(parts[0]);

  if (physicalValue) {
    abilities.push({
      element: "Fisico",
      name: "Corpo a corpo",
      value: physicalValue.replace(/\+$/g, "")
    });
  }

  parts.slice(1).forEach((part) => {
    const [key, rawValue] = part.split("=");
    const value = cleanCreatureAbilityValue(rawValue);
    const element = mapCreatureAbilityElement(key);

    if (element && value) {
      abilities.push({
        element,
        name: element === "Cura" ? "Cura" : "Envenena",
        value: `${value} por turno`
      });
    }
  });

  return abilities;
}

function parseCreatureAbilityTemplate(value) {
  const parts = splitWikiTemplateParts(value);
  const name = cleanEntityText(parts[0]);
  let abilityValue = "";
  let element = "";

  parts.slice(1).forEach((part) => {
    const [rawKey, ...rawRest] = part.split("=");
    const key = cleanEntityText(rawKey).toLowerCase();
    const rest = cleanEntityText(rawRest.join("="));

    if (rawRest.length > 0) {
      if (key === "element") {
        element = mapCreatureAbilityElement(rest);
      }
      return;
    }

    if (!abilityValue) {
      abilityValue = cleanCreatureAbilityValue(part);
    }
  });

  if (!name && !abilityValue) {
    return null;
  }

  return {
    element: element || mapCreatureAbilityElement(name) || "Fisico",
    name: name || "Ataque",
    value: abilityValue
  };
}

function splitWikiTemplateParts(value) {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanCreatureAbilityValue(value) {
  return cleanEntityText(value)
    .replace(/^damage\s*=\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapCreatureAbilityElement(value) {
  const normalized = normalizeLookupValue(value);

  if (!normalized) return "";
  if (normalized.includes("heal") || normalized.includes("cura")) return "Cura";
  if (normalized.includes("poison") || normalized.includes("earth")) return "Terra";
  if (normalized.includes("fire")) return "Fogo";
  if (normalized.includes("death")) return "Morte";
  if (normalized.includes("energy")) return "Energia";
  if (normalized.includes("holy")) return "Sagrado";
  if (normalized.includes("ice")) return "Gelo";
  if (normalized.includes("physical") || normalized.includes("melee") || normalized.includes("corpo")) return "Fisico";
  return "";
}

function buildCreatureDamageModifiers(info, fields) {
  const modifiers = [
    ["Fisico", info.physicalDamageModifier || fields.physicaldmgmod],
    ["Terra", info.earthDamageModifier || fields.earthdmgmod],
    ["Fogo", info.fireDamageModifier || fields.firedmgmod],
    ["Morte", info.deathDamageModifier || fields.deathdmgmod],
    ["Energia", info.energyDamageModifier || fields.energydmgmod],
    ["Sagrado", info.holyDamageModifier || fields.holydmgmod],
    ["Gelo", info.iceDamageModifier || fields.icedmgmod],
    ["Cura", info.healingModifier || fields.healingdmgmod]
  ];

  return modifiers
    .map(([label, value]) => ({ label, value: cleanCreatureModifierValue(value) }))
    .filter((modifier) => modifier.value);
}

function cleanCreatureModifierValue(value) {
  return cleanEntityText(value).replace(/\?+$/g, "");
}

function extractMapReference(info, fields) {
  const xRaw = cleanEntityText(info.positionX || fields.posx || fields.posx2);
  const yRaw = cleanEntityText(info.positionY || fields.posy || fields.posy2);
  const zRaw = cleanEntityText(info.positionZ || fields.posz || fields.posz2);
  const x = convertWikiMapCoordinate(xRaw);
  const y = convertWikiMapCoordinate(yRaw);
  const z = convertWikiMapFloor(zRaw);

  return {
    xRaw,
    yRaw,
    zRaw,
    x,
    y,
    z,
    url: x && y && z !== null ? `https://tibiamaps.io/map#${x},${y},${z}:1` : ""
  };
}

function convertWikiMapCoordinate(value) {
  const match = String(value || "").match(/(\d{2,3})\.(\d{1,3})/);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 256 + Number(match[2]);
}

function convertWikiMapFloor(value) {
  const match = String(value || "").match(/\b(0|[1-9]\d?)\b/);

  return match ? Number(match[1]) : null;
}

function parseSoundList(value) {
  const text = String(value || "");
  const match = text.match(/\{\{Sound List\|([^}]*)\}\}/i);

  if (!match) {
    const cleaned = cleanEntityText(text);
    return cleaned ? [cleaned] : [];
  }

  return match[1]
    .split("|")
    .map((sound) => cleanEntityText(sound))
    .filter(Boolean);
}

function cleanEntityText(value) {
  return String(value || "")
    .replace(/\[\[File:[^\]]+\]\]/gi, " ")
    .replace(/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]+)\]/gi, "$1")
    .replace(/\[(?:https?:)?\/\/[^\]]+\]/gi, " ")
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\{\{Sound List\|([^}]*)\}\}/gi, "$1")
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/'''+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,\s*\./g, ".")
    .replace(/\s+\./g, ".")
    .trim();
}

function isValidNpcIndexName(name) {
  const normalized = String(name || "").trim();

  if (!normalized || normalized === "-" || normalized.length > 80) {
    return false;
  }

  return !/^(\.{2,}|\d|NPCs?|List of|Category:|Template:|File:)/i.test(normalized);
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

async function getStashMarketValues(payload) {
  const worldSlug = slugifyWorldName(payload?.worldSlug || "");
  const requestedIds = Array.isArray(payload?.marketIds)
    ? [...new Set(payload.marketIds.map((id) => Number(id)).filter(Boolean))]
    : [];
  const loadAllCached = payload?.loadAllCached === true;
  const localOnly = payload?.localOnly === true;
  const forceFresh = payload?.forceFresh === true;
  const mergeIntoWorldCache = payload?.mergeIntoWorldCache === true;

  if (!worldSlug) throw new Error("Selecione um mundo disponível antes de consultar o market.");

  if (requestedIds.length === 0 && !loadAllCached) {
    return {};
  }

  if (loadAllCached && localOnly) {
    return readStoredWorldMarketSnapshot(worldSlug);
  }

  const worlds = await fetchWorldCatalog();
  const selectedWorld = findWorldBySlug(worlds, worldSlug);

  if (!selectedWorld) {
    throw new Error("Mundo nao encontrado na base online.");
  }

  if (loadAllCached) {
    return fetchCachedWorldMarketSnapshot(selectedWorld, { forceFresh });
  }

  const chunks = [];
  for (let index = 0; index < requestedIds.length; index += 120) {
    chunks.push(requestedIds.slice(index, index + 120));
  }

  const entries = [];
  for (const chunk of chunks) {
    const chunkEntries = await fetchMarketValues({
      serverName: selectedWorld.name,
      itemIds: chunk,
      bypassCache: forceFresh
    });
    entries.push(...chunkEntries);
  }

  const values = entriesToStashMarketMap(entries);

  if (mergeIntoWorldCache && values && typeof values === "object" && Object.keys(values).length > 0) {
    await mergeIntoCachedWorldMarketSnapshot({
      selectedWorld,
      values,
      trustWorldLastUpdate: forceFresh
    });
  }

  return values;
}

async function requestManualStashMarketRefresh({ consume = false } = {}) {
  return dataServiceRuntime.requestManualStashMarketRefresh({ consume: consume === true });
}

async function readStoredWorldMarketSnapshot(worldSlug) {
  const normalizedWorldSlug = slugifyWorldName(worldSlug || "");
  if (!normalizedWorldSlug) return {};
  const cacheKey = `market-world:${normalizedWorldSlug}`;
  const cachedEntry = await getCacheEntry(cacheKey);
  const cachedValue = normalizeCachedWorldMarketValue(cachedEntry?.value);
  if (cachedValue?.values && Object.keys(cachedValue.values).length > 0) {
    return cachedValue.values;
  }

  // Older installations persisted only the 120-item request batches. Rebuild
  // a local-first view from those batches once, so an app update does not make
  // the Stash lose all colours while the new snapshot is being collected.
  const prefix = `market-values:${normalizedWorldSlug}:`;
  const stored = await dataServiceRuntime.storageGet(null).catch(() => ({}));
  const merged = {};

  Object.entries(stored && typeof stored === "object" ? stored : {})
    .filter(([key, entry]) => (
      key.startsWith(prefix) &&
      entry &&
      Number.isFinite(Number(entry.timestamp)) &&
      Date.now() - Number(entry.timestamp) <= MARKET_CACHE_RETENTION_MS
    ))
    .sort(([, left], [, right]) => Number(left.timestamp) - Number(right.timestamp))
    .forEach(([, entry]) => {
      Object.assign(merged, entriesToStashMarketMap(normalizeMarketEntriesPayload(entry.value)));
    });

  if (Object.keys(merged).length > 0) {
    await putCache(cacheKey, {
      worldLastUpdate: cachedValue?.worldLastUpdate || null,
      snapshotVersion: cachedValue?.snapshotVersion || null,
      snapshotAt: cachedValue?.snapshotAt || null,
      etag: cachedValue?.etag || null,
      snapshotSizeBytes: cachedValue?.snapshotSizeBytes || null,
      snapshotChecksum: cachedValue?.snapshotChecksum || null,
      values: merged
    });
  }

  return merged;
}

async function fetchCachedWorldMarketSnapshot(selectedWorld, { forceFresh = false } = {}) {
  const worldName = String(selectedWorld?.name || "").trim();
  if (!worldName) throw new Error("Selecione um mundo disponível antes de consultar o market.");
  const worldLastUpdate = selectedWorld?.last_update || null;
  const cacheKey = `market-world:${slugifyWorldName(worldName)}`;
  const cachedEntry = await getCacheEntry(cacheKey);
  const cachedValue = normalizeCachedWorldMarketValue(cachedEntry?.value);

  if (!forceFresh && cachedValue && worldLastUpdate && cachedValue.worldLastUpdate === worldLastUpdate) {
    return cachedValue.values;
  }

  if (
    !forceFresh &&
    cachedValue &&
    !cachedEntry.isExpired &&
    (!worldLastUpdate || !cachedValue.worldLastUpdate || cachedValue.worldLastUpdate === worldLastUpdate)
  ) {
    return cachedValue.values;
  }

  if (!forceFresh && cachedValue && cachedEntry.isExpired && (!worldLastUpdate || cachedValue.worldLastUpdate === worldLastUpdate)) {
    refreshCacheInBackground(cacheKey, () => fetchFreshCachedWorldMarketSnapshot(cacheKey, selectedWorld));
    return cachedValue.values;
  }

  if (cachedValue) {
    try {
      return await fetchFreshCachedWorldMarketSnapshot(cacheKey, selectedWorld);
    } catch (_error) {
      refreshCacheInBackground(cacheKey, () => fetchFreshCachedWorldMarketSnapshot(cacheKey, selectedWorld));
      return cachedValue.values;
    }
  }

  return fetchFreshCachedWorldMarketSnapshot(cacheKey, selectedWorld);
}

async function fetchFreshCachedWorldMarketSnapshot(cacheKey, selectedWorld) {
  const worldName = String(selectedWorld?.name || "").trim();
  if (!worldName) throw new Error("Selecione um mundo disponível antes de consultar o market.");
  const cachedEntry = await getCacheEntry(cacheKey);
  const cachedValue = normalizeCachedWorldMarketValue(cachedEntry?.value);

  if (cachedValue?.snapshotVersion && cachedValue?.values) {
    const deltaValues = await fetchMarketSnapshotDelta({
      cacheKey,
      worldName,
      selectedWorld,
      cachedValue
    });
    if (deltaValues) {
      return deltaValues;
    }
  }

  const snapshotHeaders = cachedValue?.etag
    ? { "If-None-Match": cachedValue.etag }
    : {};

  try {
    const snapshotResponse = await fetchTibiaMarketJson(
      `market_snapshot?server=${encodeURIComponent(worldName)}`,
      {
        headers: snapshotHeaders,
        allowNotModified: true,
        failFastNotFound: true,
        timeoutMs: MARKET_SNAPSHOT_TIMEOUT_MS,
        returnMetadata: true
      }
    );

    if (snapshotResponse?.notModified && cachedValue?.values) {
      await putCache(cacheKey, cachedValue);
      return cachedValue.values;
    }

    const payload = snapshotResponse?.payload;
    if (!payload || !Array.isArray(payload.values)) {
      throw createMarketSnapshotValidationError("Snapshot do market invalido.");
    }

    await validateMarketSnapshotPayload(payload);

    const result = entriesToStashMarketMap(payload.values);
    const values = mergeMarketValuesPreservingValidCache(cachedValue?.values, result);
    await putCache(cacheKey, {
      worldLastUpdate: payload.sourceUpdatedAt || selectedWorld?.last_update || null,
      snapshotVersion: payload.snapshotVersion || null,
      snapshotAt: payload.snapshotAt || null,
      etag: snapshotResponse.etag || payload.etag || null,
      snapshotSizeBytes: Number(payload.sizeBytes) || null,
      snapshotChecksum: payload.checksum || null,
      values
    });
    return values;
  } catch (error) {
    const snapshotUnavailable =
      error?.status === 404 ||
      error?.status >= 500 ||
      error?.code === "MARKET_SNAPSHOT_INVALID" ||
      /tempo limite esgotado/i.test(error instanceof Error ? error.message : String(error));

    if (!snapshotUnavailable) {
      throw error;
    }
  }

  const query = new URLSearchParams({
    server: worldName,
    limit: "7000"
  });
  const entries = await fetchTibiaMarketJson(`market_values?${query.toString()}`);
  const result = entriesToStashMarketMap(Array.isArray(entries) ? entries : []);

  await putCache(cacheKey, {
    worldLastUpdate: selectedWorld?.last_update || null,
    snapshotVersion: null,
    snapshotAt: null,
    etag: null,
    snapshotSizeBytes: null,
    snapshotChecksum: null,
    values: mergeMarketValuesPreservingValidCache(cachedValue?.values, result)
  });
  return mergeMarketValuesPreservingValidCache(cachedValue?.values, result);
}

async function fetchMarketSnapshotDelta({ cacheKey, worldName, selectedWorld, cachedValue }) {
  try {
    const deltaResponse = await fetchTibiaMarketJson(
      `market_snapshot_delta?server=${encodeURIComponent(worldName)}&since=${encodeURIComponent(cachedValue.snapshotVersion)}`,
      {
        allowNotModified: true,
        failFastNotFound: true,
        timeoutMs: MARKET_SNAPSHOT_TIMEOUT_MS,
        returnMetadata: true
      }
    );

    if (deltaResponse?.notModified && cachedValue.values) {
      await putCache(cacheKey, cachedValue);
      return cachedValue.values;
    }

    const payload = deltaResponse?.payload;
    if (!payload || !Array.isArray(payload.changed) || !Array.isArray(payload.removed)) {
      throw createMarketSnapshotValidationError("Delta do snapshot do market invalido.");
    }

    await validateMarketSnapshotDeltaPayload(payload, cachedValue.snapshotVersion);

    const values = { ...(cachedValue.values || {}) };
    Object.assign(values, entriesToStashMarketMap(payload.changed));
    payload.removed.forEach((marketId) => {
      delete values[String(marketId)];
    });

    await putCache(cacheKey, {
      worldLastUpdate: payload.sourceUpdatedAt || selectedWorld?.last_update || cachedValue.worldLastUpdate || null,
      snapshotVersion: payload.toVersion || null,
      snapshotAt: payload.snapshotAt || null,
      etag: deltaResponse.etag || payload.etag || null,
      snapshotSizeBytes: null,
      snapshotChecksum: payload.checksum || null,
      values
    });
    return values;
  } catch (error) {
    const deltaUnavailable =
      error?.status === 404 ||
      error?.status === 409 ||
      error?.status === 422 ||
      error?.status >= 500 ||
      error?.code === "MARKET_SNAPSHOT_INVALID" ||
      /tempo limite esgotado/i.test(error instanceof Error ? error.message : String(error));

    if (deltaUnavailable) {
      return null;
    }

    throw error;
  }
}

async function mergeIntoCachedWorldMarketSnapshot({
  selectedWorld,
  values,
  trustWorldLastUpdate = false
}) {
  if (!selectedWorld?.name || !values || typeof values !== "object") {
    return;
  }

  const cacheKey = `market-world:${slugifyWorldName(selectedWorld.name)}`;
  const cachedEntry = await getCacheEntry(cacheKey);
  const cachedValue = normalizeCachedWorldMarketValue(cachedEntry?.value);

  if (!cachedValue && !trustWorldLastUpdate) {
    return;
  }

  await putCache(cacheKey, {
    worldLastUpdate: trustWorldLastUpdate
      ? (selectedWorld?.last_update || cachedValue?.worldLastUpdate || null)
      : (cachedValue?.worldLastUpdate || null),
    values: mergeMarketValuesPreservingValidCache(cachedValue?.values, values)
  });
}

function mergeMarketValuesPreservingValidCache(cachedValues, incomingValues) {
  const merged = { ...(cachedValues && typeof cachedValues === "object" ? cachedValues : {}) };

  Object.entries(incomingValues && typeof incomingValues === "object" ? incomingValues : {}).forEach(
    ([marketId, incoming]) => {
      const existing = merged[marketId];
      if (hasMeaningfulMarketValue(existing) && !hasMeaningfulMarketValue(incoming)) {
        return;
      }
      merged[marketId] = incoming;
    }
  );

  return merged;
}

function hasMeaningfulMarketValue(value) {
  return Boolean(
    value &&
      (value.updatedAt ||
        (value.current !== null && value.current !== undefined && Number.isFinite(Number(value.current))) ||
        (value.sellOffer !== null && value.sellOffer !== undefined && Number.isFinite(Number(value.sellOffer))) ||
        (value.buyOffer !== null && value.buyOffer !== undefined && Number.isFinite(Number(value.buyOffer))))
  );
}

function normalizeCachedWorldMarketValue(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (value.values && typeof value.values === "object") {
    return {
      worldLastUpdate: value.worldLastUpdate || null,
      snapshotVersion: value.snapshotVersion || null,
      snapshotAt: value.snapshotAt || null,
      etag: value.etag || null,
      snapshotSizeBytes: Number(value.snapshotSizeBytes) || null,
      snapshotChecksum: value.snapshotChecksum || null,
      values: value.values
    };
  }

  return {
    worldLastUpdate: null,
    snapshotVersion: null,
    snapshotAt: null,
    etag: null,
    snapshotSizeBytes: null,
    snapshotChecksum: null,
    values: value
  };
}

async function validateMarketSnapshotPayload(payload) {
  const schemaVersion = Number(payload?.schemaVersion || MARKET_SNAPSHOT_SCHEMA_VERSION);
  if (schemaVersion !== MARKET_SNAPSHOT_SCHEMA_VERSION) {
    throw createMarketSnapshotValidationError(
      `Versao de esquema do snapshot do market nao suportada: ${schemaVersion}.`,
    );
  }

  const serializedValues = JSON.stringify(payload.values);
  const encodedValues = new TextEncoder().encode(serializedValues);
  const expectedSize = Number(payload?.sizeBytes);
  if (Number.isFinite(expectedSize) && expectedSize >= 0 && expectedSize !== encodedValues.byteLength) {
    throw createMarketSnapshotValidationError("Tamanho do snapshot do market nao confere.");
  }

  const expectedChecksum = String(payload?.checksum || "").replace(/^sha256:/i, "").trim().toLowerCase();
  if (!expectedChecksum) {
    return;
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== "function") {
    throw createMarketSnapshotValidationError("Nao foi possivel validar o checksum do snapshot do market.");
  }

  const digest = await subtle.digest("SHA-256", encodedValues);
  const actualChecksum = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (actualChecksum !== expectedChecksum) {
    throw createMarketSnapshotValidationError("Checksum do snapshot do market nao confere.");
  }
}

async function validateMarketSnapshotDeltaPayload(payload, expectedFromVersion) {
  const schemaVersion = Number(payload?.schemaVersion || MARKET_SNAPSHOT_SCHEMA_VERSION);
  if (schemaVersion !== MARKET_SNAPSHOT_SCHEMA_VERSION) {
    throw createMarketSnapshotValidationError(
      `Versao de esquema do delta do snapshot do market nao suportada: ${schemaVersion}.`
    );
  }

  if (String(payload?.fromVersion || "") !== String(expectedFromVersion || "")) {
    throw createMarketSnapshotValidationError("A versao de origem do delta do snapshot do market nao confere.");
  }

  if (!String(payload?.toVersion || "").trim()) {
    throw createMarketSnapshotValidationError("O delta do snapshot do market nao informa a versao de destino.");
  }

  if (
    payload.removed.some((marketId) => {
      const numericId = Number(marketId);
      return !Number.isInteger(numericId) || numericId <= 0;
    })
  ) {
    throw createMarketSnapshotValidationError("O delta do snapshot do market contem IDs removidos invalidos.");
  }

  if (
    payload.changed.some((entry) => {
      const numericId = Number(entry?.id);
      return !Number.isInteger(numericId) || numericId <= 0;
    })
  ) {
    throw createMarketSnapshotValidationError("O delta do snapshot do market contem IDs alterados invalidos.");
  }

  const serializedDelta = JSON.stringify({
    changed: payload.changed,
    removed: payload.removed
  });
  const encodedDelta = new TextEncoder().encode(serializedDelta);
  const expectedSize = Number(payload?.sizeBytes);
  if (Number.isFinite(expectedSize) && expectedSize >= 0 && expectedSize !== encodedDelta.byteLength) {
    throw createMarketSnapshotValidationError("Tamanho do delta do snapshot do market nao confere.");
  }

  const expectedChecksum = String(payload?.checksum || "").replace(/^sha256:/i, "").trim().toLowerCase();
  if (!expectedChecksum) {
    throw createMarketSnapshotValidationError("O delta do snapshot do market nao informa checksum.");
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== "function") {
    throw createMarketSnapshotValidationError("Nao foi possivel validar o checksum do delta do snapshot do market.");
  }

  const digest = await subtle.digest("SHA-256", encodedDelta);
  const actualChecksum = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (actualChecksum !== expectedChecksum) {
    throw createMarketSnapshotValidationError("Checksum do delta do snapshot do market nao confere.");
  }
}

function createMarketSnapshotValidationError(message) {
  const error = new Error(message);
  error.code = "MARKET_SNAPSHOT_INVALID";
  return error;
}

function entriesToStashMarketMap(entries) {
  return Object.fromEntries(
    entries.map((entry) => {
      const market = normalizeMarketEntry(entry);
      const hasActiveOffers =
        (typeof market.sell_offers === "number" && market.sell_offers > 0) ||
        (typeof market.buy_offers === "number" && market.buy_offers > 0) ||
        (typeof market.sell_offer === "number" && market.sell_offer > 0) ||
        (typeof market.buy_offer === "number" && market.buy_offer > 0);

      return [
        market.id,
        {
          current: hasActiveOffers ? market.sell_offer : null,
          sellOffer: market.sell_offer,
          buyOffer: market.buy_offer,
          sellOffers: market.sell_offers,
          buyOffers: market.buy_offers,
          hasActiveOffers,
          updatedAt: market.captured_at
        }
      ];
    })
  );
}

async function getImbuementMarket(payload) {
  const worldName = payload?.worldName;
  const forceFresh = payload?.forceFresh === true;

  if (!worldName) {
    throw new Error("Informe o nome do mundo para carregar os imbuements.");
  }

  const cacheKey = `imbuements:${worldName.toLowerCase()}`;
  const cachedEntry = await getCacheEntry(cacheKey);

  if (!forceFresh && cachedEntry && !cachedEntry.isExpired) {
    return cachedEntry.value;
  }

  if (!forceFresh && cachedEntry?.value) {
    refreshCacheInBackground(cacheKey, () => fetchFreshImbuementMarket(worldName, cacheKey));
    return {
      ...cachedEntry.value,
      stale: true,
      refreshStarted: true
    };
  }

  return fetchFreshImbuementMarket(worldName, cacheKey);
}

async function fetchFreshImbuementMarket(worldName, cacheKey) {
  const metadataIndex = await getItemMetadataIndex();
  const requestedNames = [
    ...ALL_IMBUEMENT_INGREDIENT_NAMES,
    "Tibia Coins",
    "Gold Token"
  ];
  const itemDetails = await Promise.all(
    [...new Set(requestedNames)].map(async (name) => {
      const summary = findItemSummaryByName(metadataIndex, name);

      if (!summary) {
        return null;
      }

      if (summary.marketId) {
        return summary;
      }

      return resolveItemDetail(summary).catch(() => null);
    })
  );
  const validItems = itemDetails.filter((item) => item?.marketId);
  const marketEntries = await fetchMarketValues({
    serverName: worldName,
    itemIds: validItems.map((item) => item.marketId),
    bypassCache: true
  });
  const marketById = Object.fromEntries(
    marketEntries.map((entry) => [entry.id, normalizeMarketEntry(entry)])
  );
  const pricesByName = {};
  let latestUpdate = null;

  validItems.forEach((item) => {
    const market = marketById[item.marketId] ?? null;

    if (!market) {
      return;
    }

    pricesByName[item.wiki_name] = {
      name: item.wiki_name,
      kind: "market",
      buyPrice: market.buy_offer,
      sellPrice: market.sell_offer,
      buyTransactions: market.day_bought,
      sellTransactions: market.day_sold,
      scrapedAt: market.captured_at
    };

    if (market.captured_at && (!latestUpdate || market.captured_at > latestUpdate)) {
      latestUpdate = market.captured_at;
    }
  });

  const result = {
    worldName,
    updatedAt: latestUpdate,
    rates: {
      tibiaCoinPrice: pricesByName["Tibia Coins"]?.sellPrice ?? null,
      goldTokenPrice: pricesByName["Gold Token"]?.sellPrice ?? null,
      goldTokenBuyPrice: pricesByName["Gold Token"]?.buyPrice ?? null
    },
    pricesByName
  };

  await putCache(cacheKey, result);
  return result;
}

function refreshCacheInBackground(cacheKey, loader) {
  if (backgroundRefreshKeys.has(cacheKey)) {
    return;
  }

  backgroundRefreshKeys.add(cacheKey);
  Promise.resolve()
    .then(loader)
    .catch(() => {})
    .finally(() => {
      backgroundRefreshKeys.delete(cacheKey);
    });
}

async function getIngredientMetadata(payload) {
  const names = Array.isArray(payload?.names) ? payload.names : [];

  if (names.length === 0) {
    return {};
  }

  // Imbuement only needs the local name, slug and sprite. Resolving the full
  // item detail for every ingredient repeated the old Loot Analyzer pattern
  // and materialised many independent reads. The same in-memory metadata index
  // used by Stash already contains everything required here.
  const metadataIndex = await getItemMetadataIndex();
  const entries = [...new Set(names)].map((name) => {
    const slug = slugifyTibiaItemName(name);
    const itemMeta = findItemSummaryBySlugCandidates(metadataIndex, getItemLookupSlugCandidates(slug))
      || findItemSummaryByName(metadataIndex, name);

    return [
      name,
      {
        slug: itemMeta?.slug || slug,
        imageSrc: itemMeta ? getItemImageUrl(itemMeta) : "",
        itemName: itemMeta?.wiki_name || itemMeta?.name || name
      }
    ];
  });

  return Object.fromEntries(entries);
}

async function fetchWorldCatalog(options = {}) {
  const cacheKey = WORLD_CACHE_KEY;
  const cachedEntry = await getCacheEntry(cacheKey);
  const cached = Array.isArray(cachedEntry?.value) ? cachedEntry.value : null;
  if (cached && !cachedEntry.isExpired && options.forceFresh !== true) return cached;
  if (worldCatalogRequestPromise) return worldCatalogRequestPromise;

  worldCatalogRequestPromise = (async () => {
    try {
      const result = await loadAuthoritativeWorldCatalog({
        fetchRegularWorlds: fetchTibiaDataWorldCatalog,
        fetchMarketWorlds: () => fetchTibiaMarketJson("world_data")
          .catch(() => fetchMarketWorldCatalogFromStatus().catch(() => [])),
        cachedWorlds: cached,
        slugifyWorldName,
      });
      if (result.source === "fresh") await putCache(cacheKey, result.worlds);
      return result.worlds;
    } finally {
      worldCatalogRequestPromise = null;
    }
  })();

  return worldCatalogRequestPromise;
}

async function fetchMarketWorldCatalogFromStatus() {
  const status = await fetchTibiaMarketJson("status");
  const trackedWorlds = Array.isArray(status?.trackedWorlds) ? status.trackedWorlds : [];
  const trackedBySlug = Object.fromEntries(
    trackedWorlds
      .map((entry) => [slugifyWorldName(entry?.name || ""), entry])
      .filter(([slug]) => slug)
  );
  const names = [
    ...(Array.isArray(status?.availableWorldList) ? status.availableWorldList : []),
    ...(Array.isArray(status?.crawlOrder) ? status.crawlOrder : []),
    ...trackedWorlds.map((entry) => entry?.name || ""),
    status?.currentWorld?.name || ""
  ]
    .map((name) => String(name || "").trim())
    .filter(Boolean);

  return [...new Set(names)].map((name) => {
    const slug = slugifyWorldName(name);
    const tracked = trackedBySlug[slug] || null;
    const isCurrentWorld = slug && slug === slugifyWorldName(status?.currentWorld?.name || "");

    return {
      name,
      slug,
      last_update: tracked?.lastUpdate || (isCurrentWorld ? status?.currentWorld?.sourceLastUpdate : null) || null
    };
  });
}

async function fetchTibiaDataWorldCatalog() {
  const data = await fetchGameDataHubJson(
    `${getGameDataHubBase()}/api/game/tibiadata/worlds`,
    "Falha ao consultar mundos do TibiaData",
    GAME_DATA_HUB_BOSS_TIMEOUT_MS
  );
  const regularWorlds = Array.isArray(data?.worlds?.regular_worlds) ? data.worlds.regular_worlds : [];
  return normalizeRegularWorldCatalog(regularWorlds, slugifyWorldName)
    .map((entry) => ({
      name: entry.name,
      slug: entry.slug,
      location: entry?.location || null,
      status: entry?.status || null,
      players_online: toNumberOrNull(entry?.players_online),
      pvp_type: entry?.pvp_type || null,
      battleye_protected:
        typeof entry?.battleye_protected === "boolean" ? entry.battleye_protected : null,
      battleye_date: entry?.battleye_date || null,
      transfer_type: entry?.transfer_type || null,
      game_world_type: entry?.game_world_type || null
    }));
}

async function getCharacterProfiles(payload = {}) {
  const names = Array.isArray(payload.names) ? payload.names : [];
  const uniqueNames = [...new Set(names.map((name) => String(name || "").trim()).filter(Boolean))];
  const entries = new Array(uniqueNames.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(CHARACTER_PROFILE_FETCH_CONCURRENCY, uniqueNames.length) },
    async () => {
      while (nextIndex < uniqueNames.length) {
        const index = nextIndex;
        nextIndex += 1;
        const name = uniqueNames[index];
        const key = name.toLowerCase();

        if (characterProfileCache.has(key)) {
          const cachedProfile = characterProfileCache.get(key);
          if (cachedProfile) {
            entries[index] = [name, cachedProfile];
            continue;
          }

          // Do not keep a transient API/network failure as a permanent session
          // result. The next profile refresh must be allowed to retry.
          characterProfileCache.delete(key);
        }

        try {
          const cacheKey = getCharacterProfileCacheKey(name);
          const cachedEntry = await getCacheEntry(cacheKey, {
            ttlMs: CHARACTER_PROFILE_CACHE_TTL_MS,
            retentionMs: CHARACTER_PROFILE_CACHE_RETENTION_MS
          });
          const cached = cachedEntry?.value || null;

          if (cached && typeof cached === "object" && "profile" in cached) {
            const profile = cached.profile || null;
            if (profile) {
              characterProfileCache.set(key, profile);
            }

            if (cachedEntry.isExpired) {
              refreshCacheInBackground(cacheKey, () => fetchFreshCharacterProfile(name, cacheKey));
            }

            if (profile) {
              entries[index] = [name, profile];
              continue;
            }
          }

          const profile = await fetchFreshCharacterProfile(name, cacheKey);

          if (profile) {
            characterProfileCache.set(key, profile);
          }
          entries[index] = [name, profile];
        } catch (_error) {
          entries[index] = [name, null];
        }
      }
    }
  );
  await Promise.all(workers);

  return Object.fromEntries(entries);
}

async function fetchFreshCharacterProfile(name, cacheKey = getCharacterProfileCacheKey(name)) {
  const requestKey = String(name || "").trim().toLocaleLowerCase("en-US");
  if (characterProfileRequestPromises.has(requestKey)) {
    return characterProfileRequestPromises.get(requestKey);
  }

  const operation = (async () => {
    let data;
    try {
      data = await fetchTibiaDataCharacterJson(name);
    } catch (_tibiaDataError) {
      try {
        data = await fetchOfficialTibiaCharacterJson(name);
      } catch (_officialTibiaError) {
      // A failed lookup must never overwrite a previously valid profile or
      // poison the persistent cache for the rest of the day.
        return null;
      }
    }

    const character = data?.character?.character || null;
    const profile = character?.name
      ? {
          name: character.name,
          sex: character.sex || "",
          vocation: character.vocation || "",
          level: toNumberOrNull(character.level),
          world: character.world || "",
          guild: character?.guild?.name || ""
        }
      : null;

    if (profile) {
      await putCache(cacheKey, { profile });
    }
    return profile;
  })();

  characterProfileRequestPromises.set(requestKey, operation);
  try {
    return await operation;
  } finally {
    characterProfileRequestPromises.delete(requestKey);
  }
}

async function getFindPartySnapshot(payload = {}) {
  const worldSlug = slugifyWorldName(payload?.worldSlug || "");
  const worlds = await fetchWorldCatalog();
  const selectedWorld = findWorldBySlug(worlds, worldSlug);

  if (!selectedWorld?.name) {
    throw new Error("Mundo nao encontrado para o Find Party.");
  }

  const [worldData, guildNames] = await Promise.all([
    fetchFindPartyWorldData(selectedWorld.name, { force: payload?.force === true }),
    fetchFindPartyGuildNames(selectedWorld.name, { force: payload?.force === true })
  ]);

  return {
    world: {
      name: selectedWorld.name,
      slug: selectedWorld.slug
    },
    players: worldData.players,
    guilds: guildNames
  };
}

async function getFindPartyGuildMembers(payload = {}) {
  const guildNames = Array.isArray(payload?.guildNames)
    ? [...new Set(payload.guildNames.map((name) => String(name || "").trim()).filter(Boolean))]
    : [];

  if (guildNames.length === 0) {
    return {
      guilds: {},
      memberNames: []
    };
  }

  const entries = await Promise.all(
    guildNames.map(async (guildName) => {
      const members = await fetchFindPartyGuildMembersByName(guildName).catch(() => []);
      return [
        guildName,
        {
          members
        }
      ];
    })
  );

  const guilds = Object.fromEntries(entries);
  const memberNames = [...new Set(Object.values(guilds).flatMap((entry) => entry.members || []))];

  return {
    guilds,
    memberNames
  };
}

async function fetchFindPartyWorldData(worldName, options = {}) {
  const cacheKey = `find-party-world:${slugifyWorldName(worldName)}`;
  if (options.force === true) {
    return fetchFreshFindPartyWorldData(worldName, cacheKey);
  }
  const cachedEntry = await getCacheEntry(cacheKey, {
    ttlMs: FIND_PARTY_WORLD_CACHE_TTL_MS,
    retentionMs: FIND_PARTY_WORLD_CACHE_RETENTION_MS
  });

  if (cachedEntry?.value) {
    if (cachedEntry.isExpired) {
      refreshCacheInBackground(cacheKey, () => fetchFreshFindPartyWorldData(worldName, cacheKey));
    }

    return cachedEntry.value;
  }

  return fetchFreshFindPartyWorldData(worldName, cacheKey);
}

async function fetchFreshFindPartyWorldData(worldName, cacheKey = `find-party-world:${slugifyWorldName(worldName)}`) {
  const world = await fetchFindPartyWorldPayload(worldName);
  const players = Array.isArray(world?.online_players)
    ? world.online_players
        .map((entry) => ({
          name: String(entry?.name || "").trim(),
          level: toNumberOrNull(entry?.level),
          vocation: String(entry?.vocation || "").trim(),
          world: String(world?.name || worldName).trim()
        }))
        .filter((entry) => entry.name && Number.isFinite(entry.level) && entry.level > 0)
    : [];

  const payload = {
    world: String(world?.name || worldName).trim(),
    players
  };

  await putCache(cacheKey, payload, {
    ttlMs: FIND_PARTY_WORLD_CACHE_TTL_MS,
    retentionMs: FIND_PARTY_WORLD_CACHE_RETENTION_MS
  });

  return payload;
}

async function fetchFindPartyGuildNames(worldName, options = {}) {
  const cacheKey = `find-party-guilds:${slugifyWorldName(worldName)}`;
  if (options.force === true) {
    return fetchFreshFindPartyGuildNames(worldName, cacheKey);
  }
  const cachedEntry = await getCacheEntry(cacheKey, {
    ttlMs: FIND_PARTY_GUILDS_CACHE_TTL_MS,
    retentionMs: FIND_PARTY_GUILDS_CACHE_RETENTION_MS
  });

  if (cachedEntry?.value) {
    if (cachedEntry.isExpired) {
      refreshCacheInBackground(cacheKey, () => fetchFreshFindPartyGuildNames(worldName, cacheKey));
    }

    return cachedEntry.value;
  }

  return fetchFreshFindPartyGuildNames(worldName, cacheKey);
}

async function fetchFreshFindPartyGuildNames(worldName, cacheKey = `find-party-guilds:${slugifyWorldName(worldName)}`) {
  const guilds = await fetchFindPartyGuildListPayload(worldName);
  const names = [
    ...(Array.isArray(guilds?.active) ? guilds.active : []),
    ...(Array.isArray(guilds?.formation) ? guilds.formation : [])
  ]
    .map((entry) => String(entry?.name || "").trim())
    .filter(Boolean);
  const uniqueNames = [...new Set(names)].sort((left, right) => left.localeCompare(right));

  await putCache(cacheKey, uniqueNames, {
    ttlMs: FIND_PARTY_GUILDS_CACHE_TTL_MS,
    retentionMs: FIND_PARTY_GUILDS_CACHE_RETENTION_MS
  });

  return uniqueNames;
}

async function fetchFindPartyGuildMembersByName(guildName) {
  const cacheKey = `find-party-guild:${String(guildName || "").trim().toLowerCase()}`;
  const cachedEntry = await getCacheEntry(cacheKey, {
    ttlMs: FIND_PARTY_GUILD_MEMBERS_CACHE_TTL_MS,
    retentionMs: FIND_PARTY_GUILD_MEMBERS_CACHE_RETENTION_MS
  });

  if (cachedEntry?.value) {
    if (cachedEntry.isExpired) {
      refreshCacheInBackground(cacheKey, () => fetchFreshFindPartyGuildMembersByName(guildName, cacheKey));
    }

    return cachedEntry.value;
  }

  return fetchFreshFindPartyGuildMembersByName(guildName, cacheKey);
}

async function fetchFreshFindPartyGuildMembersByName(
  guildName,
  cacheKey = `find-party-guild:${String(guildName || "").trim().toLowerCase()}`
) {
  const guild = await fetchFindPartyGuildPayload(guildName);
  const memberNames = Array.isArray(guild?.members)
    ? guild.members
        .map((entry) => String(entry?.name || "").trim())
        .filter(Boolean)
    : [];

  await putCache(cacheKey, memberNames, {
    ttlMs: FIND_PARTY_GUILD_MEMBERS_CACHE_TTL_MS,
    retentionMs: FIND_PARTY_GUILD_MEMBERS_CACHE_RETENTION_MS
  });

  return memberNames;
}

async function fetchFindPartyWorldPayload(worldName) {
  try {
    const response = await fetchWithTimeout(
      `${TIBIA_DATA_API_BASE}/world/${encodeURIComponent(worldName)}`,
      GAME_DATA_HUB_BOSS_TIMEOUT_MS,
      { Accept: "application/json" }
    );
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Falha ao consultar mundo do Find Party no TibiaData (${response.status}): ${body}`);
    }
    const payload = JSON.parse(body);
    if (!payload?.world) {
      throw new Error("O TibiaData retornou um mundo invalido para o Find Party.");
    }
    return payload.world;
  } catch (_directError) {
    // Preserve availability during a transient TibiaData failure. The Hub is
    // only a last-valid fallback; successful on-demand queries never use it.
    const payload = await fetchGameDataHubJson(
      `${getGameDataHubBase()}/api/game/tibiadata/worlds/${encodeURIComponent(worldName)}`,
      "Falha ao consultar mundo do Find Party",
      GAME_DATA_HUB_BOSS_TIMEOUT_MS
    );
    return payload?.world || null;
  }
}

async function fetchFindPartyGuildListPayload(worldName) {
  const payload = await fetchGameDataHubJson(
    `${getGameDataHubBase()}/api/game/tibiadata/worlds/${encodeURIComponent(worldName)}/guilds`,
    "Falha ao consultar guildas do mundo",
    GAME_DATA_HUB_BOSS_TIMEOUT_MS
  );
  return payload?.guilds || null;
}

async function fetchFindPartyGuildPayload(guildName) {
  const payload = await fetchGameDataHubJson(
    `${getGameDataHubBase()}/api/game/tibiadata/guild?name=${encodeURIComponent(guildName)}`,
    "Falha ao consultar membros da guilda",
    GAME_DATA_HUB_BOSS_TIMEOUT_MS
  );
  return payload?.guild || null;
}

function getCharacterProfileCacheKey(name) {
  return `character-profile:${CHARACTER_PROFILE_CACHE_VERSION}:${String(name || "").trim().toLowerCase()}`;
}

async function getItemMetadataIndex() {
  if (itemMetadataIndexValue) {
    return itemMetadataIndexValue;
  }

  if (itemMetadataIndexPromise) {
    return itemMetadataIndexPromise;
  }

  itemMetadataIndexPromise = (async () => {
    const cacheKey = "item-metadata";
    const cached = await getCache(cacheKey);
    let rawItems = Array.isArray(cached) ? cached : null;
    const bundledItems = await loadBundledItemMetadata().catch(() => null);

    if (!rawItems) {
      rawItems = bundledItems;
    } else if (Array.isArray(bundledItems)) {
      // The desktop cache is intentionally retained for performance, but it
      // must never hide newly audited local records after a content update.
      // Keep cached entries and append only bundled identities it does not
      // already contain; existing cached market state is left untouched.
      const known = new Set(rawItems.map((item) => slugifyTibiaItemName(item?.slug || item?.wiki_name || item?.actualName || item?.name)));
      rawItems = [...rawItems, ...bundledItems.filter((item) => {
        const key = slugifyTibiaItemName(item?.slug || item?.wiki_name || item?.actualName || item?.name);
        if (!key || known.has(key)) return false;
        known.add(key);
        return true;
      })];
    }

    if (!rawItems) {
      throw new Error("Indice de itens indisponivel no acervo local auditado.");
    }

    if (!cached && Array.isArray(rawItems)) {
      await putCache(cacheKey, rawItems);
    }

    const summaryItems = Array.isArray(rawItems)
      ? rawItems.map(normalizeItemMetadata).filter(Boolean)
      : [];
    const detailIndex = await getItemDetailsIndex().catch(() => null);
    const supplementalItems = await loadBundledSupplementalItemMetadata().catch(() => []);
    const droppedByOverrides = await loadBundledItemDroppedByOverrides().catch(() => []);
    let items = applyItemDroppedByOverrides(
      mergeItemSummariesWithDetails(summaryItems, detailIndex, supplementalItems),
      droppedByOverrides
    );
    const canonicalItems = await getCanonicalLibrarySummaries("items");
    const knownCanonicalSlugs = new Set(items.map((item) => slugifyTibiaItemName(item.slug || item.wiki_name || item.name)));
    // Make every public site item discoverable in the desktop search. The
    // full detail still comes from the canonical document at open time.
    items = [...items, ...canonicalItems
      .filter((record) => record?.slug && !knownCanonicalSlugs.has(slugifyTibiaItemName(record.slug)))
      .map((record) => ({
        id: `site:${record.slug}`,
        slug: record.slug,
        name: record.name,
        wiki_name: record.name,
        category: canonicalFact(canonicalFacts(record), "Categoria") || record.subtitle || "Sem categoria",
        image_src: canonicalItemImageUrl(record),
        marketId: Number(record.meta?.marketId) || 0,
        marketable: canonicalFact(canonicalFacts(record), "Market") || "",
        richDetailLoaded: true
      }))];
    const byId = {};
    const bySlug = {};
    const byName = {};
    const byWikiName = {};

    // Exact item identities must win over aliases derived from a display name.
    // Stateful variants often share a generic name and previously claimed the
    // generic slug before the actual generic item was indexed.
    items.forEach((item) => {
      if (item.slug && !bySlug[item.slug]) {
        bySlug[item.slug] = item;
      }
    });

    items.forEach((item) => {
      byId[item.id] = item;

      [slugifyTibiaItemName(item.name || ""), slugifyTibiaItemName(item.wiki_name || "")]
        .filter(Boolean)
        .forEach((slug) => {
          if (!bySlug[slug]) {
            bySlug[slug] = item;
          }
        });

      const normalizedName = normalizeLookupValue(item.name);
      const normalizedWikiName = normalizeLookupValue(item.wiki_name);

      if (normalizedName && !byName[normalizedName]) {
        byName[normalizedName] = item;
      }

      if (normalizedWikiName && !byWikiName[normalizedWikiName]) {
        byWikiName[normalizedWikiName] = item;
      }
    });

    itemMetadataIndexValue = {
      items,
      byId,
      bySlug,
      byName,
      byWikiName,
      specialItems: {
        tibiaCoin: bySlug["tibia-coins"] ?? byWikiName["tibia coins"] ?? null,
        goldToken: bySlug["gold-token"] ?? byWikiName["gold token"] ?? null
      }
    };

    return itemMetadataIndexValue;
  })();

  try {
    return await itemMetadataIndexPromise;
  } finally {
    itemMetadataIndexPromise = null;
  }
}

async function loadBundledItemMetadata() {
  const bundle = await dataServiceRuntime.readJsonAsset(ITEM_METADATA_BUNDLE_PATH);

  if (Array.isArray(bundle)) {
    return bundle;
  }

  if (Array.isArray(bundle?.items)) {
    return bundle.items;
  }

  return null;
}

async function getItemDetailsIndex() {
  if (itemDetailsIndexValue) {
    return itemDetailsIndexValue;
  }

  if (itemDetailsIndexPromise) {
    return itemDetailsIndexPromise;
  }

  itemDetailsIndexPromise = (async () => {
    const bundle = await dataServiceRuntime.readJsonAsset(ITEM_DETAILS_BUNDLE_PATH);
    const detailItems = Array.isArray(bundle) ? bundle : bundle?.items || [];
    const [supplementalItems, droppedByOverrides, proficiencyItems, npcTradeItems, auditCorrections, lootAuditCorrections] = await Promise.all([
      loadBundledSupplementalItemMetadata().catch(() => []),
      loadBundledItemDroppedByOverrides().catch(() => []),
      loadBundledItemProficiencyDamage().catch(() => []),
      loadBundledItemNpcTrades().catch(() => []),
      loadBundledItemAuditCorrections(),
      loadBundledItemLootAuditCorrections()
    ]);
    const items = applyVerifiedItemMetadata(
      applyItemDroppedByOverrides(
        applyLocalItemAuditCorrections(mergeNormalizedItemRecordsBySlug([
          ...detailItems.map(normalizeItemMetadata).filter(Boolean),
          ...supplementalItems
        ]), auditCorrections, lootAuditCorrections),
        droppedByOverrides
      ),
      proficiencyItems,
      npcTradeItems
    );
    const bySlug = {};
    const byName = {};
    const byWikiName = {};

    items.forEach((item) => {
      if (item.slug && !bySlug[item.slug]) {
        bySlug[item.slug] = item;
      }
    });

    items.forEach((item) => {
      [slugifyTibiaItemName(item.name || ""), slugifyTibiaItemName(item.wiki_name || "")]
        .filter(Boolean)
        .forEach((slug) => {
          if (!bySlug[slug]) {
            bySlug[slug] = item;
          }
        });

      const normalizedName = normalizeLookupValue(item.name);
      const normalizedWikiName = normalizeLookupValue(item.wiki_name);

      if (normalizedName && !byName[normalizedName]) {
        byName[normalizedName] = item;
      }

      if (normalizedWikiName && !byWikiName[normalizedWikiName]) {
        byWikiName[normalizedWikiName] = item;
      }
    });

    itemDetailsIndexValue = {
      items,
      bySlug,
      byName,
      byWikiName
    };

    return itemDetailsIndexValue;
  })();

  try {
    return await itemDetailsIndexPromise;
  } finally {
    itemDetailsIndexPromise = null;
  }
}

function mergeNormalizedItemRecordsBySlug(items) {
  const mergedBySlug = new Map();

  for (const item of items || []) {
    const slug = String(item?.slug || slugifyTibiaItemName(item?.wiki_name || item?.name || "")).trim();

    if (!slug) {
      continue;
    }

    const previous = mergedBySlug.get(slug);

    if (!previous) {
      mergedBySlug.set(slug, item);
      continue;
    }

    mergedBySlug.set(slug, mergeItemMetadata(previous, item));
  }

  return [...mergedBySlug.values()];
}

function mergeItemSummariesWithDetails(summaryItems, detailIndex) {
  if (!detailIndex) {
    return summaryItems;
  }

  const mergedItems = summaryItems.map((summary) => {
    const detail = findDetailForItem(summary, detailIndex);

    return detail ? mergeItemMetadata(summary, detail) : summary;
  });
  const seenSlugs = new Set(mergedItems.map((item) => item.slug));

  detailIndex.items.forEach((detail) => {
    if (!seenSlugs.has(detail.slug)) {
      mergedItems.push(detail);
      seenSlugs.add(detail.slug);
    }
  });

  return mergedItems;
}

async function loadBundledSupplementalItemMetadata() {
  try {
    const bundle = await dataServiceRuntime.readJsonAsset(ITEM_SUPPLEMENTS_BUNDLE_PATH);
    const items = Array.isArray(bundle) ? bundle : bundle?.items || [];
    return items.map(normalizeItemMetadata).filter(Boolean);
  } catch (_error) {
    return [];
  }
}

async function loadBundledItemProficiencyDamage() {
  if (itemProficiencyDamageValue) return itemProficiencyDamageValue;
  const bundle = await dataServiceRuntime.readJsonAsset(ITEM_PROFICIENCY_DAMAGE_BUNDLE_PATH);
  itemProficiencyDamageValue = Array.isArray(bundle?.items) ? bundle.items : [];
  return itemProficiencyDamageValue;
}

async function loadBundledItemNpcTrades() {
  if (itemNpcTradesValue) return itemNpcTradesValue;
  const bundle = await dataServiceRuntime.readJsonAsset(ITEM_NPC_TRADES_BUNDLE_PATH);
  itemNpcTradesValue = Array.isArray(bundle?.items) ? bundle.items : [];
  return itemNpcTradesValue;
}

async function loadBundledItemAuditCorrections() {
  if (itemAuditCorrectionsValue) return itemAuditCorrectionsValue;
  if (itemAuditCorrectionsPromise) return itemAuditCorrectionsPromise;

  itemAuditCorrectionsPromise = dataServiceRuntime.readJsonAsset(ITEM_AUDIT_CORRECTIONS_BUNDLE_PATH)
    .then((bundle) => {
      const records = [...(Array.isArray(bundle?.items) ? bundle.items : []), ...(Array.isArray(bundle?.newItems) ? bundle.newItems : [])];
      itemAuditCorrectionsValue = new Map(records.filter((entry) => entry?.slug).map((entry) => [String(entry.slug), entry]));
      return itemAuditCorrectionsValue;
    })
    .catch(() => {
      itemAuditCorrectionsValue = new Map();
      return itemAuditCorrectionsValue;
    });

  try {
    return await itemAuditCorrectionsPromise;
  } finally {
    itemAuditCorrectionsPromise = null;
  }
}

async function loadBundledItemLootAuditCorrections() {
  if (itemLootAuditCorrectionsValue) return itemLootAuditCorrectionsValue;
  if (itemLootAuditCorrectionsPromise) return itemLootAuditCorrectionsPromise;

  itemLootAuditCorrectionsPromise = dataServiceRuntime.readJsonAsset(ITEM_LOOT_AUDIT_CORRECTIONS_BUNDLE_PATH)
    .then((bundle) => {
      itemLootAuditCorrectionsValue = new Map((Array.isArray(bundle?.items) ? bundle.items : [])
        .filter((entry) => entry?.slug)
        .map((entry) => [String(entry.slug), entry]));
      return itemLootAuditCorrectionsValue;
    })
    .catch(() => {
      itemLootAuditCorrectionsValue = new Map();
      return itemLootAuditCorrectionsValue;
    });

  try {
    return await itemLootAuditCorrectionsPromise;
  } finally {
    itemLootAuditCorrectionsPromise = null;
  }
}

function applyLocalItemAuditCorrections(items, corrections, lootCorrections) {
  return (items || []).map((item) => {
    const slug = String(item?.slug || slugifyTibiaItemName(item?.wiki_name || item?.name || ""));
    const correction = corrections?.get(slug) || {};
    const lootCorrection = lootCorrections?.get(slug) || {};
    const removeDroppedBy = new Set((lootCorrection.removeDroppedBy || correction.removeDroppedBy || []).map(normalizeLookupValue));
    const droppedBy = [...new Map([...(item?.droppedBy || []), ...(lootCorrection.addDroppedBy || correction.addDroppedBy || [])]
      .filter(Boolean)
      .filter((name) => !removeDroppedBy.has(normalizeLookupValue(name)))
      .map((name) => [normalizeLookupValue(name), name])).values()];
    const unlinkedDroppedBy = [...new Set([...(item?.unlinkedDroppedBy || []), ...(lootCorrection.unlinkedDroppedBy || correction.unlinkedDroppedBy || [])].filter(Boolean))];
    return { ...item, ...correction, slug, ...(droppedBy.length || Array.isArray(item?.droppedBy) ? { droppedBy } : {}), ...(unlinkedDroppedBy.length ? { unlinkedDroppedBy } : {}) };
  });
}

function applyVerifiedItemMetadata(items, proficiencyItems = [], npcTradeItems = []) {
  const proficiencyBySlug = new Map(
    proficiencyItems.filter((entry) => entry?.slug).map((entry) => [entry.slug, entry])
  );
  const tradesBySlug = new Map(
    npcTradeItems.filter((entry) => entry?.slug).map((entry) => [entry.slug, entry])
  );

  return (items || []).map((item) => {
    const slugCandidates = [
      item?.slug,
      slugifyTibiaItemName(item?.wiki_name || ""),
      slugifyTibiaItemName(item?.name || "")
    ].filter(Boolean);
    const proficiency = slugCandidates
      .flatMap((slug) => [slug, ITEM_PROFICIENCY_SOURCE_SLUG_BY_ITEM_SLUG[slug]])
      .filter(Boolean)
      .map((slug) => proficiencyBySlug.get(slug))
      .find(Boolean);
    const trades = slugCandidates.map((slug) => tradesBySlug.get(slug)).find(Boolean);

    return {
      ...item,
      ...(proficiency
        ? {
            proficiency: Array.isArray(proficiency.proficiency) ? proficiency.proficiency : [],
            damageTable: Array.isArray(proficiency.damageTable) ? proficiency.damageTable : [],
            proficiencyWikiUrl: proficiency.wikiUrl || item?.wikiUrl || ""
          }
        : {}),
      ...(trades
        ? {
            npc_sell: sanitizeNpcTradeList(trades.npc_sell),
            npc_buy: sanitizeNpcTradeList(trades.npc_buy),
            tradeVerified: true
          }
        : {})
    };
  });
}

async function loadBundledItemDroppedByOverrides() {
  if (itemDroppedByOverridesValue) {
    return itemDroppedByOverridesValue;
  }

  if (itemDroppedByOverridesPromise) {
    return itemDroppedByOverridesPromise;
  }

  itemDroppedByOverridesPromise = (async () => {
    try {
      const bundle = await dataServiceRuntime.readJsonAsset(ITEM_DROPPED_BY_OVERRIDES_BUNDLE_PATH);
      const items = Array.isArray(bundle) ? bundle : bundle?.items || [];
      itemDroppedByOverridesValue = items
        .map((entry) => ({
          slug: String(entry?.slug || slugifyTibiaItemName(entry?.wiki_name || entry?.name || "")).trim(),
          name: String(entry?.name || "").trim(),
          wiki_name: String(entry?.wiki_name || entry?.name || "").trim(),
          pageTitle: String(entry?.pageTitle || "").trim(),
          wikiUrl: String(entry?.wikiUrl || "").trim(),
          droppedBy: Array.isArray(entry?.droppedBy) ? entry.droppedBy.filter(Boolean) : []
        }))
        .filter((entry) => entry.slug);
      return itemDroppedByOverridesValue;
    } catch (_error) {
      itemDroppedByOverridesValue = [];
      return itemDroppedByOverridesValue;
    }
  })();

  try {
    return await itemDroppedByOverridesPromise;
  } finally {
    itemDroppedByOverridesPromise = null;
  }
}

async function applyDroppedByOverridesToCachedItemPayload(payload, cacheKey = "") {
  if (!payload?.item) {
    return payload;
  }

  const item = await applyDroppedByOverridesToCachedItem(payload.item);
  const changed =
    JSON.stringify(item?.droppedBy || []) !== JSON.stringify(payload?.item?.droppedBy || []) ||
    JSON.stringify(item?.npc_buy || []) !== JSON.stringify(payload?.item?.npc_buy || []) ||
    JSON.stringify(item?.npc_sell || []) !== JSON.stringify(payload?.item?.npc_sell || []) ||
    JSON.stringify(item?.proficiency || []) !== JSON.stringify(payload?.item?.proficiency || []) ||
    JSON.stringify(item?.damageTable || []) !== JSON.stringify(payload?.item?.damageTable || []) ||
    String(item?.wikiUrl || "") !== String(payload?.item?.wikiUrl || "") ||
    String(item?.pageTitle || "") !== String(payload?.item?.pageTitle || "");

  if (!changed) {
    return payload;
  }

  const nextPayload = {
    ...payload,
    item
  };

  if (cacheKey) {
    await putCache(cacheKey, nextPayload);
  }

  return nextPayload;
}

async function applyDroppedByOverridesToCachedItem(item, cacheKey = "") {
  if (!item || typeof item !== "object") {
    return item;
  }

  const sanitizedItem = {
    ...item,
    npc_buy: sanitizeNpcTradeList(item.npc_buy),
    npc_sell: sanitizeNpcTradeList(item.npc_sell)
  };
  const [overrides, proficiencyItems, npcTradeItems] = await Promise.all([
    loadBundledItemDroppedByOverrides().catch(() => []),
    loadBundledItemProficiencyDamage().catch(() => []),
    loadBundledItemNpcTrades().catch(() => [])
  ]);
  const [withDroppedBy] = applyItemDroppedByOverrides([sanitizedItem], overrides);
  const [mergedItem] = applyVerifiedItemMetadata([withDroppedBy], proficiencyItems, npcTradeItems);
  const changed = JSON.stringify(mergedItem) !== JSON.stringify(item);

  if (!changed) {
    return item;
  }

  if (cacheKey) {
    await putCache(cacheKey, mergedItem);
  }

  return mergedItem;
}

function applyItemDroppedByOverrides(items, overrides) {
  if (!Array.isArray(items) || items.length === 0 || !Array.isArray(overrides) || overrides.length === 0) {
    return items;
  }

  const overridesBySlug = Object.fromEntries(
    overrides
      .filter((entry) => entry?.slug)
      .map((entry) => [entry.slug, entry])
  );

  return items.map((item) => {
    const override =
      overridesBySlug[item.slug] ||
      overridesBySlug[slugifyTibiaItemName(item.wiki_name || "")] ||
      overridesBySlug[slugifyTibiaItemName(item.name || "")] ||
      null;

    if (!override) {
      return item;
    }

    return {
      ...item,
      pageTitle: override.pageTitle || item.pageTitle || null,
      wikiUrl: override.wikiUrl || item.wikiUrl || "",
      droppedBy:
        Array.isArray(override.droppedBy) && override.droppedBy.length > 0
          ? override.droppedBy
          : item.droppedBy
    };
  });
}

function findDetailForItem(item, detailIndex) {
  return (
    detailIndex.bySlug[item.slug] ??
    detailIndex.bySlug[slugifyTibiaItemName(item.name || "")] ??
    detailIndex.bySlug[slugifyTibiaItemName(item.wiki_name || "")] ??
    detailIndex.byName[normalizeLookupValue(item.name)] ??
    detailIndex.byWikiName[normalizeLookupValue(item.wiki_name)] ??
    null
  );
}

function mergeItemMetadata(summary, detail) {
  return {
    ...summary,
    ...detail,
    category: detail.category || summary.category,
    categorySlug: detail.categorySlug || summary.categorySlug,
    primaryType: detail.primaryType || summary.primaryType,
    secondaryType: detail.secondaryType || summary.secondaryType,
    objectClass: detail.objectClass || summary.objectClass,
    categoryTags: mergeCategoryTags(summary.categoryTags, detail.categoryTags, [
      summary.category,
      detail.category,
      summary.primaryType,
      detail.primaryType,
      summary.secondaryType,
      detail.secondaryType,
      summary.objectClass,
      detail.objectClass
    ]),
    assetId: detail.assetId || summary.assetId,
    image_src: detail.image_src || summary.image_src,
    max_tier: detail.max_tier || summary.max_tier,
    npc_sell: mergeNpcTradeMetadata(summary.npc_sell, detail.npc_sell, detail.tradeVerified),
    droppedBy: Array.isArray(detail.droppedBy)
      ? detail.droppedBy
      : Array.isArray(summary.droppedBy)
        ? summary.droppedBy
        : [],
    npc_buy: mergeNpcTradeMetadata(summary.npc_buy, detail.npc_buy, detail.tradeVerified),
    proficiency: Array.isArray(detail.proficiency)
      ? detail.proficiency
      : Array.isArray(summary.proficiency)
        ? summary.proficiency
        : [],
    damageTable: Array.isArray(detail.damageTable)
      ? detail.damageTable
      : Array.isArray(summary.damageTable)
        ? summary.damageTable
        : [],
    proficiencyWikiUrl: detail.proficiencyWikiUrl || summary.proficiencyWikiUrl || "",
    tradeVerified: Boolean(detail.tradeVerified || summary.tradeVerified),
    detailLoaded: Boolean(detail.detailLoaded || summary.detailLoaded)
  };
}

function mergeNpcTradeMetadata(summaryTrades, detailTrades, authoritative = false) {
  const previous = sanitizeNpcTradeList(summaryTrades);
  const next = sanitizeNpcTradeList(detailTrades);

  if (authoritative) return next;
  if (next.length > 0) return next;
  return previous;
}

function isVisibleUiItem(item) {
  if (!item?.slug || !item?.name) {
    return false;
  }

  const wikiName = String(item.wiki_name || item.name || "");

  if (wikiName.includes("Keys by Type/")) {
    return false;
  }

  // `Armors` is a category-page artifact, not an item. Keep the `Armors`
  // category available to real equipment; only suppress this exact fake slug.
  if (item.slug === "armors") {
    return false;
  }

  // This TibiaWiki/API page is a quest-page artifact and confuses the real currency item.
  if (item.slug === "tibia-coin-item" || wikiName === "Tibia Coin (Item)") {
    return false;
  }

  // Invalid trade-table artifact: there is no canonical item record and its
  // TibiaWiki file link does not resolve to an image.
  if (item.slug === "candy-cone-chair") {
    return false;
  }

  if (/^\d+\s+Theons$/i.test(wikiName) || /^\d+\s+Theons$/i.test(item.name || "")) {
    return false;
  }

  return true;
}

function getBestNpcSellToValue(npcs = []) {
  const prices = npcs
    .filter((npc) => isValidTraderName(npc?.name))
    .map((npc) => (typeof npc?.price === "number" ? npc.price : null))
    .filter((price) => price !== null);

  return prices.length > 0 ? Math.max(...prices) : null;
}

function getItemCategoryTags(item) {
  return mergeCategoryTags(
    item?.categoryTags,
    item?.category,
    item?.primaryType,
    item?.secondaryType,
    item?.objectClass
  );
}

function getBestNpcBuyFromValue(npcs = []) {
  const prices = npcs
    .filter((npc) => isValidTraderName(npc?.name))
    .map((npc) => (typeof npc?.price === "number" ? npc.price : null))
    .filter((price) => price !== null);

  return prices.length > 0 ? Math.min(...prices) : null;
}

function mergeCategoryTags(...groups) {
  return [
    ...new Set(
      groups
        .flat()
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ];
}

function isValidTraderName(name) {
  const value = String(name || "").trim();

  if (!value || value === "-") {
    return false;
  }

  return !/sayname|for \d|quest|hunting task points/i.test(value);
}

async function resolveItemDetail(itemMeta) {
  if (!itemMeta) {
    return null;
  }

  if (itemMeta.detailLoaded && hasStructuredItemExtras(itemMeta)) {
    return itemMeta;
  }

  const details = await getItemDetailsIndex();
  const localDetail = findDetailForItem(itemMeta, details);
  if (!localDetail) {
    throw new Error("Item nao encontrado no acervo local auditado.");
  }
  return applyDroppedByOverridesToCachedItem(mergeItemMetadata(itemMeta, localDetail));
}

async function resolveItemDetailBySlug(itemSlug) {
  const normalizedSlug = slugifyTibiaItemName(itemSlug);
  const metadataIndex = await getItemMetadataIndex();
  const slugCandidates = getItemLookupSlugCandidates(normalizedSlug);
  const itemMeta = findItemSummaryBySlugCandidates(metadataIndex, slugCandidates);
  // The website's canonical document is the authority for the Library. Use
  // it before the legacy item bundle, whose historical aliases can otherwise
  // resolve a different item with a similar name (notably Ferumbras' staffs).
  const canonical = await getCanonicalLibraryDocument("items", normalizedSlug);
  if (canonical) return {
    __canonicalDocument: canonical,
    __legacyItemMeta: itemMeta || null,
    marketId: Number(canonical.meta?.marketId) || Number(itemMeta?.marketId) || 0
  };
  if (!itemMeta) {
    throw new Error("Item nao encontrado no acervo local auditado.");
  }
  return resolveItemDetail(itemMeta);
}

function hasStructuredItemExtras(itemMeta) {
  if (!itemMeta || typeof itemMeta !== "object") {
    return false;
  }

  return itemMeta.richDetailLoaded === true;
}

function findItemSummaryByName(metadataIndex, name) {
  const candidates = getItemLookupNameCandidates(name);

  for (const candidate of candidates) {
    const slug = slugifyTibiaItemName(candidate);
    const key = normalizeLookupValue(candidate);
    const item =
      metadataIndex.byName[key] ??
      metadataIndex.bySlug[slug] ??
      metadataIndex.byWikiName[key] ??
      null;

    if (item) {
      return item;
    }
  }

  return null;
}

function findItemSummaryBySlugCandidates(metadataIndex, slugCandidates) {
  for (const slug of slugCandidates) {
    const item = metadataIndex.bySlug[slug] ?? null;

    if (item) {
      return item;
    }
  }

  return null;
}

function getItemLookupNameCandidates(name) {
  const originalName = String(name || "").trim();
  const slugCandidates = getItemLookupSlugCandidates(originalName);
  const candidates = [originalName];

  slugCandidates.forEach((slug) => {
    const candidateName = itemNameFromSlug(slug);

    if (candidateName) {
      candidates.push(candidateName);
    }
  });

  return [...new Set(candidates.filter(Boolean))];
}

function getItemLookupSlugCandidates(value) {
  const slug = slugifyTibiaItemName(value);
  const candidates = [slug];
  const alias = ITEM_SLUG_ALIASES[slug];

  if (alias) {
    candidates.push(alias);
  }

  getSingularItemSlugCandidates(slug).forEach((candidate) => candidates.push(candidate));

  return [...new Set(candidates.filter(Boolean))];
}

function getSingularItemSlugCandidates(slug) {
  const candidates = [];

  if (!slug || !slug.endsWith("s")) {
    return candidates;
  }

  if (slug.endsWith("teeth")) {
    candidates.push(`${slug.slice(0, -5)}tooth`);
  }

  if (slug.endsWith("feet")) {
    candidates.push(`${slug.slice(0, -4)}foot`);
  }

  if (slug.endsWith("men")) {
    candidates.push(`${slug.slice(0, -3)}man`);
  }

  if (slug.endsWith("women")) {
    candidates.push(`${slug.slice(0, -5)}woman`);
  }

  if (slug.endsWith("mice")) {
    candidates.push(`${slug.slice(0, -4)}mouse`);
  }

  if (slug.endsWith("geese")) {
    candidates.push(`${slug.slice(0, -5)}goose`);
  }

  if (slug.endsWith("knives")) {
    candidates.push(`${slug.slice(0, -5)}knife`);
  }

  if (slug.endsWith("wives")) {
    candidates.push(`${slug.slice(0, -4)}wife`);
  }

  if (slug.endsWith("lives")) {
    candidates.push(`${slug.slice(0, -4)}life`);
  }

  if (slug.endsWith("leaves")) {
    candidates.push(`${slug.slice(0, -6)}leaf`);
  }

  if (slug.endsWith("ies")) {
    candidates.push(`${slug.slice(0, -3)}y`);
  }

  if (slug.endsWith("zes")) {
    candidates.push(slug.slice(0, -2));
  }

  if (slug.endsWith("ches") || slug.endsWith("shes") || slug.endsWith("xes") || slug.endsWith("ses")) {
    candidates.push(slug.slice(0, -2));
  }

  candidates.push(slug.slice(0, -1));

  return candidates;
}

async function fetchMarketValues({ serverName, itemIds, bypassCache = false }) {
  const normalizedIds = [...new Set(itemIds.filter(Boolean).map((id) => Number(id)))].filter(Boolean);

  if (normalizedIds.length === 0) {
    return [];
  }

  const query = new URLSearchParams({
    server: serverName,
    item_ids: normalizedIds.join(",")
  });
  const cacheKey = `market-values:${slugifyWorldName(serverName)}:${normalizedIds.join(",")}`;
  const cachedEntry = await getCacheEntry(cacheKey);

  if (!bypassCache && cachedEntry?.value && !cachedEntry.isExpired) {
    return cachedEntry.value;
  }

  if (!bypassCache && cachedEntry?.value) {
    refreshCacheInBackground(cacheKey, () => fetchFreshMarketValues(cacheKey, query));
    return cachedEntry.value;
  }

  const inFlight = marketRequestsInFlight.get(cacheKey);
  if (inFlight) {
    try {
      return await inFlight;
    } catch (error) {
      if (isMarketBackoffError(error)) {
        return cachedEntry?.value || [];
      }

      throw error;
    }
  }

  const request = fetchFreshMarketValues(cacheKey, query);
  marketRequestsInFlight.set(cacheKey, request);

  try {
    return await request;
  } catch (error) {
    if (isMarketBackoffError(error)) {
      return cachedEntry?.value || [];
    }

    throw error;
  } finally {
    if (marketRequestsInFlight.get(cacheKey) === request) {
      marketRequestsInFlight.delete(cacheKey);
    }
  }
}

async function fetchFreshMarketValues(cacheKey, query) {
  const entries = await fetchTibiaMarketJson(`market_values?${query.toString()}`);
  const result = normalizeMarketEntriesPayload(entries);

  await putCache(cacheKey, result);
  return result;
}

async function fetchTibiaMarketJson(pathWithQuery, options = {}) {
  const primaryBase = getMarketApiBase();
  const candidateBases = getMarketApiBases(primaryBase);
  const pathKey = pathWithQuery.split("?")[0];
  const queueKey = `${primaryBase}|${pathKey}`;
  const queued = endpointQueueByPath.get(queueKey) || Promise.resolve();
  const nextTask = queued
    .catch(() => {})
    .then(async () => {
      let lastError = null;

      for (const base of candidateBases) {
        const baseQueueKey = `${base}|${pathKey}`;
        const waitMs = Math.max(0, (endpointNextRunByPath.get(baseQueueKey) || 0) - Date.now());

        if (waitMs > 0) {
          await delay(waitMs);
        }

        const maxAttempts = options.failFastNotFound === true
          ? 1
          : candidateBases.length > 1 && base !== candidateBases[candidateBases.length - 1] ? 1 : 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          let response;
          let body = "";

          const isLastBase = base === candidateBases[candidateBases.length - 1];
          const requestedTimeoutMs = Number(options.timeoutMs);
          const defaultTimeoutMs = !isLastBase && candidateBases.length > 1
            ? FALLBACK_BASE_TIMEOUT_MS
            : MARKET_API_TIMEOUT_MS;
          const timeoutMs = Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
            ? Math.min(defaultTimeoutMs, requestedTimeoutMs)
            : defaultTimeoutMs;

          try {
            response = await fetchWithTimeout(`${base}/${pathWithQuery}`, timeoutMs, options.headers);
            body = await response.text();
          } catch (error) {
            const isLastAttempt = attempt >= maxAttempts;

            if (!isLastAttempt) {
              await delay(getMarketApiDelayMs(base) + getRetryDelay(attempt));
              continue;
            }

            lastError = new Error(
              `Falha ao consultar a base do market na VPS: ${error instanceof Error ? error.message : String(error)}`
            );
            break;
          }

          endpointNextRunByPath.set(baseQueueKey, Date.now() + getMarketApiDelayMs(base));

          if (response.status === 304 && options.allowNotModified === true) {
            return {
              notModified: true,
              etag: response.headers.get("etag") || null,
              lastModified: response.headers.get("last-modified") || null
            };
          }

          if (response.ok) {
            const payload = parseTibiaMarketJsonBody(body);
            return options.returnMetadata === true
              ? {
                  payload,
                  etag: response.headers.get("etag") || null,
                  lastModified: response.headers.get("last-modified") || null
                }
              : payload;
          }

          const isBackoffBody = Boolean(body && /External source backoff/i.test(body));
          const isRetryable = response.status === 429 || response.status >= 500 || isBackoffBody;
          const isLastAttempt = attempt >= maxAttempts;
          if (!isLastBase && (isBackoffBody || (response.status >= 500 && isLastAttempt))) {
            lastError = createMarketHttpError(`Falha ao consultar a base online (${response.status}): ${body}`, response.status);
            break;
          }

          if (isRetryable && !isLastAttempt) {
            await delay(
              getMarketApiDelayMs(base)
              + getRetryDelay(attempt, response.headers.get("retry-after"))
            );
            continue;
          }

          if (response.status === 429) {
            lastError = createMarketHttpError(
              "A base do market na VPS atingiu o limite temporario de consultas. Aguarde um pouco e tente de novo.",
              response.status
            );
            break;
          }

          lastError = createMarketHttpError(`Falha ao consultar a base online (${response.status}): ${body}`, response.status);
          break;
        }
      }

      throw lastError || new Error("Falha ao consultar a base online.");
    });

  endpointQueueByPath.set(queueKey, nextTask.catch(() => {}));
  return nextTask;
}

function getMarketApiBases(primaryBase = getMarketApiBase()) {
  const configuredBases = Array.isArray(dataServiceRuntime.marketApiBases)
    ? dataServiceRuntime.marketApiBases
    : [];
  const bases = [
    ...configuredBases,
    primaryBase
  ].map((base) => String(base || "").replace(/\/+$/, ""));

  return [...new Set(bases.filter(Boolean))];
}

async function fetchWithTimeout(url, timeoutMs, requestHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        ...(requestHeaders && typeof requestHeaders === "object" ? requestHeaders : {})
      },
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("tempo limite esgotado");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function createMarketHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getMarketApiBase() {
  return String(dataServiceRuntime.marketApiBase || TIBIA_TOOLKIT_MARKET_BRIDGE_BASE).replace(/\/+$/, "");
}

function getGameDataHubBase() {
  return String(dataServiceRuntime.gameDataHubBase || DEFAULT_GAME_DATA_HUB_BASE).replace(/\/+$/, "");
}

function getGameDataHubBases(primaryBase = getGameDataHubBase()) {
  const configuredBases = Array.isArray(dataServiceRuntime.gameDataHubBases)
    ? dataServiceRuntime.gameDataHubBases
    : [];
  const bases = [
    ...configuredBases,
    primaryBase,
    DEFAULT_GAME_DATA_HUB_BASE
  ].map((base) => String(base || "").replace(/\/+$/, ""));

  return [...new Set(bases.filter(Boolean))];
}

function getMarketApiDelayMs() {
  return 120;
}

function isMarketBackoffError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return error?.status === 429
    || /External source backoff|base online \(500\).*backoff|retryBlockedUntil/i.test(message);
}

function parseTibiaMarketJsonBody(body) {
  try {
    return JSON.parse(body);
  } catch (error) {
    const positionMatch = /position\s+(\d+)/i.exec(error?.message || "");
    const jsonEnd = positionMatch ? Number(positionMatch[1]) : findJsonDocumentEnd(body);

    if (jsonEnd > 0) {
      return JSON.parse(body.slice(0, jsonEnd));
    }

    throw error;
  }
}

function normalizeMarketEntriesPayload(entries) {
  if (Array.isArray(entries)) {
    return entries;
  }

  if (entries && typeof entries === "object" && Number(entries.id)) {
    return [entries];
  }

  return [];
}

function findJsonDocumentEnd(body) {
  const raw = String(body || "");
  const offset = raw.length - raw.trimStart().length;
  const text = raw.slice(offset);
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;

      if (depth === 0) {
        return offset + index + 1;
      }
    }
  }

  return -1;
}

function normalizeItemMetadata(entry) {
  const wikiId = Number(entry?.id);

  if (!wikiId) {
    return null;
  }

  const sourceName = entry?.actualName || entry?.name || entry?.wiki_name || `item-${wikiId}`;
  const sourceWikiName = entry?.actualName
    ? entry?.name || entry?.wiki_name || sourceName
    : entry?.wiki_name || entry?.name || sourceName;
  const sourceSlug = entry?.slug || slugifyTibiaItemName(sourceWikiName);
  const canonicalIdentity = ITEM_CANONICAL_IDENTITIES[sourceSlug] || null;
  const name = canonicalIdentity?.name || sourceName;
  const wikiName = canonicalIdentity?.name || sourceWikiName;
  const marketId = Array.isArray(entry?.itemIds)
    ? Number(entry.itemIds[0]) || null
    : Number(entry?.marketId) || null;
  const primaryImage = Array.isArray(entry?.images)
    ? entry.images[0] ?? null
    : entry?.primaryImage ?? null;
  const assetId = Number(primaryImage?.assetId) || Number(entry?.assetId) || null;
  const wikiPageTitle = canonicalIdentity?.pageTitle || getItemWikiPageTitle(entry);
  const attributeMap = getItemAdditionalAttributeMap(entry);
  const marketableExplicit =
    inferItemMarketableExplicit(entry?.marketable, entry?.value, attributeMap.value) ||
    ITEM_MARKETABILITY_OVERRIDES[slugifyTibiaItemName(entry?.slug || wikiName || name)] ||
    null;
  const npcTrades = Array.isArray(entry?.npc_buy) || Array.isArray(entry?.npc_sell)
    ? {
        buyFrom: Array.isArray(entry?.npc_sell) ? entry.npc_sell : [],
        sellTo: Array.isArray(entry?.npc_buy) ? entry.npc_buy : []
      }
    : normalizeNpcTrades(entry);

  return {
    id: marketId || wikiId,
    wikiId,
    marketId,
    slug: canonicalIdentity?.slug || sourceSlug,
    category: entry?.categoryName || entry?.category || entry?.primaryType || "Sem categoria",
    categorySlug: entry?.categorySlug || null,
    primaryType: entry?.primaryType || null,
    secondaryType: entry?.secondaryType || null,
    objectClass: entry?.objectClass || null,
    categoryTags: mergeCategoryTags(
      entry?.categoryTags,
      entry?.categoryName,
      entry?.category,
      entry?.primaryType,
      entry?.secondaryType,
      entry?.objectClass
    ),
    tier: typeof entry?.tier === "number" ? entry.tier : -1,
    name,
    wiki_name: wikiName,
    pageTitle: wikiPageTitle || null,
    wikiUrl: wikiPageTitle ? getTibiaWikiBrPageUrlByTitle(wikiPageTitle) : "",
    npc_sell: sanitizeNpcTradeList(npcTrades.buyFrom),
    npc_buy: sanitizeNpcTradeList(npcTrades.sellTo),
    assetId,
    image_src: assetId ? getAssetImageUrl(assetId) : entry?.image_src || "",
    max_tier: toNumberOrNull(entry?.upgradeClass) ?? toNumberOrNull(entry?.max_tier) ?? 0,
    marketable: marketableExplicit || entry?.marketable || null,
    marketableExplicit,
    npc_price: parsePriceValue(entry?.npcPrice),
    npc_value: parsePriceValue(entry?.npcValue),
    value: entry?.value || null,
    implemented: entry?.implemented || null,
    droppedBy: Array.isArray(entry?.droppedBy) ? entry.droppedBy.filter(Boolean) : [],
    notes: cleanItemNotesText(entry?.notes || attributeMap.notes || "") || null,
    spoilers: normalizeItemSpoilers(entry?.spoilers),
    location: cleanWikiText(entry?.location || attributeMap.location || "") || null,
    map: normalizeItemMap(entry?.map),
    storeTc: parseStoreTcValue(entry?.storeTc ?? entry?.store_tc ?? entry?.value ?? attributeMap.value ?? ""),
    storeAvailable: isItemStoreAvailable(entry, attributeMap),
    richDetailLoaded: Boolean(
      entry?.richDetailLoaded ||
      entry?.additionalAttributes ||
      entry?.notes ||
      entry?.attrib ||
      entry?.location ||
      entry?.map ||
      entry?.storeTc != null ||
      entry?.store_tc != null ||
      entry?.storeAvailable ||
      Array.isArray(entry?.spoilers)
    ),
    weaponType: entry?.weaponType || null,
    hands: entry?.hands || null,
    attack: entry?.attack || null,
    defense: entry?.defense || null,
    defenseMod: entry?.defenseMod || null,
    armor: entry?.armor || null,
    range: entry?.range || null,
    levelRequired: entry?.levelRequired || null,
    imbueSlots: entry?.imbueSlots || null,
    vocation: entry?.vocation || null,
    damageType: entry?.damageType || null,
    damageRange: entry?.damageRange || null,
    energyAttack: entry?.energyAttack || null,
    fireAttack: entry?.fireAttack || null,
    earthAttack: entry?.earthAttack || null,
    iceAttack: entry?.iceAttack || null,
    deathAttack: entry?.deathAttack || null,
    holyAttack: entry?.holyAttack || null,
    weight: entry?.weight || null,
    attrib: cleanWikiText(entry?.attrib || attributeMap.attrib || "") || null,
    proficiency: Array.isArray(entry?.proficiency) ? entry.proficiency : [],
    damageTable: Array.isArray(entry?.damageTable) ? entry.damageTable : [],
    proficiencyWikiUrl: String(entry?.proficiencyWikiUrl || "").trim(),
    tradeVerified: Boolean(entry?.tradeVerified),
    catalogVisible: entry?.catalogVisible === true,
    detailLoaded: Boolean(entry?.detailLoaded || Array.isArray(entry?.itemIds))
  };
}

function getItemAdditionalAttributeMap(entry) {
  return Object.fromEntries(
    (entry?.additionalAttributes?.entries || []).map((attribute) => [
      String(attribute?.key || "").trim(),
      attribute?.value
    ])
  );
}

function normalizeItemSpoilers(spoilers) {
  if (!Array.isArray(spoilers)) {
    return [];
  }

  return spoilers
    .map((spoiler) => {
      if (typeof spoiler === "string") {
        return {
          title: "Spoiler",
          text: cleanWikiText(spoiler)
        };
      }

      return {
        title: cleanWikiText(spoiler?.title || "Spoiler") || "Spoiler",
        text: cleanWikiText(spoiler?.text || spoiler?.description || "")
      };
    })
    .filter((spoiler) => spoiler.text);
}

function normalizeItemMap(mapValue) {
  if (!mapValue || typeof mapValue !== "object") {
    return null;
  }

  const url = String(mapValue?.url || "").trim();

  if (!url) {
    return null;
  }

  return {
    url,
    label: cleanWikiText(mapValue?.label || "")
  };
}

function parseStoreTcValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? value : null;
  }

  const text = String(value || "").trim();

  if (!/tibia\s*coins?/i.test(text)) {
    return null;
  }

  return parsePriceValue(text);
}

function isItemStoreAvailable(entry, attributeMap = getItemAdditionalAttributeMap(entry)) {
  if (parseStoreTcValue(entry?.storeTc ?? entry?.store_tc ?? entry?.value ?? attributeMap.value ?? "") !== null) {
    return true;
  }

  const notes = String(entry?.notes || attributeMap.notes || "").trim();
  return /bought\s+through\s+the\s+store/i.test(notes);
}

function normalizeNpcTrades(entry) {
  const attributes = Object.fromEntries(
    (entry?.additionalAttributes?.entries || []).map((attribute) => [
      attribute?.key,
      attribute?.value
    ])
  );
  const npcPrice = parsePriceValue(entry?.npcPrice);
  const npcValue = parsePriceValue(entry?.npcValue);

  return {
    buyFrom: parseNpcTradeList(attributes.buyFrom, npcPrice),
    sellTo: parseNpcTradeList(attributes.sellTo, npcValue)
  };
}

function parseNpcTradeList(value, fallbackPrice = null) {
  const rawValue = String(value || "").trim();

  if (!rawValue || rawValue === "--") {
    return [];
  }

  const trades = [];
  const tradePattern = /([^:;]+):\s*([0-9][0-9.,]*)/g;
  let match = tradePattern.exec(rawValue);

  while (match) {
    const names = match[1]
      .split(/,|\band\b|\be\b/i)
      .map(cleanNpcTradeName)
      .filter(Boolean);
    const price = parsePriceValue(match[2]);

    names.forEach((name) => {
      if (price !== null) {
        trades.push({
          name,
          location: null,
          price
        });
      }
    });

    match = tradePattern.exec(rawValue);
  }

  if (trades.length === 0 && fallbackPrice !== null) {
    rawValue
      .split(/,|\band\b|\be\b/i)
      .map(cleanNpcTradeName)
      .filter(Boolean)
      .forEach((name) => {
        trades.push({
          name,
          location: null,
          price: fallbackPrice
        });
      });
  }

  return sanitizeNpcTradeList(trades);
}

function cleanNpcTradeName(value) {
  const name = cleanWikiText(value).split(";")[0].trim();
  const normalized = name.toLowerCase();

  if (!name || ["sayname", "ask", "trade"].includes(normalized)) {
    return "";
  }

  if (/^(?:tomes?|notes?|history|spoilers?)-\d+$/i.test(name)) {
    return "";
  }

  return name;
}

function sanitizeNpcTradeList(npcs = []) {
  if (!Array.isArray(npcs)) {
    return [];
  }

  return npcs
    .map((npc) => {
      const rawName = String(npc?.name || "");
      const name = cleanNpcTradeName(npc?.name);

      if (!name) {
        return null;
      }

      const imageSrc = String(npc?.image_src || "");
      const shouldRefreshImage =
        rawName !== name ||
        /(?:;|%3[bB]|%253[bB]|tomes?-\d+|notes?-\d+|history-\d+|spoilers?-\d+)/i.test(imageSrc);

      return {
        ...npc,
        name,
        image_src: shouldRefreshImage
          ? getNpcImageUrl(name)
          : npc?.image_src
      };
    })
    .filter(Boolean);
}

function cleanWikiText(value) {
  return String(value || "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\|.*/g, "")
    .trim();
}

function cleanItemNotesText(value) {
  const cleaned = cleanWikiText(value)
    .replace(/\s*\*\s*(Recompensa da .*?Quest\.?|Obtained .*?Quest\.?|Temporarily obtained .*?Quest\.?|Item used on .*?Quest\.?|Item temporarily obtained .*?Quest\.?|Obtained during .*?Quest\.?|Part of .*?Quest\.?)\s*$/i, " ")
    .replace(/\{\{\s*[A-Za-z0-9_ -]+$/g, " ")
    .replace(/File:[A-Za-z0-9_()' -]+?\.(?:gif|png|jpg|jpeg|webp)(?:\|[^\r\n]*)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(nenhuma|nenhum|none|n\/a|nao ha|não há)\.?$/i.test(cleaned)) {
    return "";
  }

  return cleaned;
}

function inferItemMarketableExplicit(...values) {
  for (const value of values) {
    if (value === "yes" || value === "no") {
      return value;
    }

    if (/negotiable|negoci[aá]vel/i.test(String(value || "").trim())) {
      return "yes";
    }
  }

  return null;
}

function parsePriceValue(value) {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  const digits = String(value || "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function normalizeMarketEntry(entry) {
  return {
    id: Number(entry?.id) || 0,
    time: toNumberOrNull(entry?.time),
    captured_at: toNumberOrNull(entry?.time) ? unixToIso(entry.time) : null,
    is_full_data: Boolean(entry?.is_full_data),
    current: normalizeMarketNumber(entry?.sell_offer),
    buy_offer: normalizeMarketNumber(entry?.buy_offer),
    sell_offer: normalizeMarketNumber(entry?.sell_offer),
    month_average_sell: normalizeMarketNumber(entry?.month_average_sell),
    month_average_buy: normalizeMarketNumber(entry?.month_average_buy),
    month_sold: normalizeMarketNumber(entry?.month_sold),
    month_bought: normalizeMarketNumber(entry?.month_bought),
    active_traders: normalizeMarketNumber(entry?.active_traders),
    month_highest_sell: normalizeMarketNumber(entry?.month_highest_sell),
    month_lowest_buy: normalizeMarketNumber(entry?.month_lowest_buy),
    month_lowest_sell: normalizeMarketNumber(entry?.month_lowest_sell),
    month_highest_buy: normalizeMarketNumber(entry?.month_highest_buy),
    buy_offers: normalizeMarketNumber(entry?.buy_offers),
    sell_offers: normalizeMarketNumber(entry?.sell_offers),
    day_average_sell: normalizeMarketNumber(entry?.day_average_sell),
    day_average_buy: normalizeMarketNumber(entry?.day_average_buy),
    day_sold: normalizeMarketNumber(entry?.day_sold),
    day_bought: normalizeMarketNumber(entry?.day_bought),
    day_highest_sell: normalizeMarketNumber(entry?.day_highest_sell),
    day_lowest_sell: normalizeMarketNumber(entry?.day_lowest_sell),
    day_highest_buy: normalizeMarketNumber(entry?.day_highest_buy),
    day_lowest_buy: normalizeMarketNumber(entry?.day_lowest_buy),
    total_immediate_profit: normalizeMarketNumber(entry?.total_immediate_profit),
    total_immediate_profit_info: entry?.total_immediate_profit_info || "",
    availability: null,
    demand: null,
    status: entry?.is_full_data ? "coleta completa" : "coleta parcial"
  };
}

function createEmptyMarketEntry(id) {
  return {
    id: Number(id) || 0,
    time: null,
    captured_at: null,
    is_full_data: false,
    current: null,
    buy_offer: null,
    sell_offer: null,
    month_average_sell: null,
    month_average_buy: null,
    month_sold: null,
    month_bought: null,
    active_traders: null,
    month_highest_sell: null,
    month_lowest_buy: null,
    month_lowest_sell: null,
    month_highest_buy: null,
    buy_offers: null,
    sell_offers: null,
    day_average_sell: null,
    day_average_buy: null,
    day_sold: null,
    day_bought: null,
    day_highest_sell: null,
    day_lowest_sell: null,
    day_highest_buy: null,
    day_lowest_buy: null,
    total_immediate_profit: null,
    total_immediate_profit_info: "",
    availability: null,
    demand: null,
    status: "sem dados de mercado"
  };
}

function buildItemRecord(itemMeta) {
  const fallbackLocation = deriveItemLocationFallback(itemMeta);
  return {
    id: itemMeta.id,
    slug: itemMeta.slug,
    name: itemMeta.name,
    wiki_name: itemMeta.wiki_name,
    pageTitle: itemMeta.pageTitle || null,
    wikiUrl: itemMeta.wikiUrl || "",
    category: itemMeta.category || "Sem categoria",
    image_src: getItemImageUrl(itemMeta),
    description_lines: buildItemDescriptionLines(itemMeta),
    droppedBy: Array.isArray(itemMeta.droppedBy) ? itemMeta.droppedBy.filter(Boolean) : [],
    unlinkedDroppedBy: Array.isArray(itemMeta.unlinkedDroppedBy) ? itemMeta.unlinkedDroppedBy.filter(Boolean) : [],
    notes: localizeCommonItemNoteText(cleanItemNotesText(itemMeta.notes) || null),
    spoilers: normalizeItemSpoilers(itemMeta.spoilers),
    location: cleanWikiText(itemMeta.location) || fallbackLocation || null,
    map: normalizeItemMap(itemMeta.map),
    marketable: itemMeta.marketable || null,
    marketableExplicit: itemMeta.marketableExplicit || null,
    storeTc: parseStoreTcValue(itemMeta.storeTc ?? itemMeta.value),
    storeAvailable: Boolean(itemMeta.storeAvailable || parseStoreTcValue(itemMeta.storeTc ?? itemMeta.value) !== null),
    attrib: cleanWikiText(itemMeta.attrib) || null,
    proficiency: Array.isArray(itemMeta.proficiency) ? itemMeta.proficiency : [],
    damageTable: Array.isArray(itemMeta.damageTable) ? itemMeta.damageTable : [],
    proficiencyWikiUrl: itemMeta.proficiencyWikiUrl || "",
    richDetailLoaded: Boolean(itemMeta.richDetailLoaded),
    npc_buy: enrichNpcList(itemMeta.npc_buy),
    npc_sell: enrichNpcList(itemMeta.npc_sell),
    max_tier: itemMeta.max_tier > 0 ? itemMeta.max_tier : 0
  };
}

function localizeCommonItemNoteText(value) {
  return String(value || "")
    .replace(/^It can be bought through the Store\./i, "Esse item pode ser comprado na Store.")
    .replace(/It will be delivered to Your Store Inbox in a Decoration Kit\./gi, "Ele será entregue no Seu Store Inbox em um Decoration Kit.")
    .replace(/It will be delivered to Your Store Inbox\./gi, "Ele será entregue no Seu Store Inbox.")
    .replace(/See ([A-Za-z0-9' -]+) for general information regarding ([A-Za-z0-9' -]+)\./gi, "Veja $1 para mais informações sobre $2.")
    .trim();
}

function deriveItemLocationFallback(itemMeta) {
  const primaryType = String(itemMeta?.primaryType || itemMeta?.category || "").trim().toLowerCase();
  const secondaryType = String(itemMeta?.secondaryType || "").trim().toLowerCase();
  const objectClass = String(itemMeta?.objectClass || "").trim().toLowerCase();
  const storeAvailable = Boolean(itemMeta?.storeAvailable || parseStoreTcValue(itemMeta?.storeTc ?? itemMeta?.value) !== null);

  if ((secondaryType === "beds" || primaryType === "furniture") && (storeAvailable || objectClass === "household items")) {
    return "Em casa de jogadores.";
  }

  return "";
}

function buildItemDescriptionLines(itemMeta) {
  const lines = [];
  const stats = [];

  addStat(stats, "Arm", itemMeta?.armor);
  addStat(stats, "Atk", itemMeta?.attack);
  addDefenseStat(stats, itemMeta);
  addStat(stats, "Range", itemMeta?.range);
  addStat(stats, "Slots", itemMeta?.imbueSlots);

  addElementalStat(stats, "Energy", itemMeta?.energyAttack);
  addElementalStat(stats, "Fire", itemMeta?.fireAttack);
  addElementalStat(stats, "Earth", itemMeta?.earthAttack);
  addElementalStat(stats, "Ice", itemMeta?.iceAttack);
  addElementalStat(stats, "Death", itemMeta?.deathAttack);
  addElementalStat(stats, "Holy", itemMeta?.holyAttack);

  if (stats.length > 0) {
    lines.push(`(${stats.join(", ")}).`);
  }

  const level = cleanWikiText(itemMeta?.levelRequired);
  const vocation = cleanWikiText(itemMeta?.vocation);
  if (level || vocation) {
    const vocationText = vocation ? `por ${vocation}` : "corretamente";
    const levelText = level ? ` de level ${level} ou superior` : "";
    lines.push(`Pode ser usado ${vocationText}${levelText}.`);
  }

  if (Number(itemMeta?.max_tier) > 0) {
    lines.push(`ClassificaÃ§Ã£o: ${itemMeta.max_tier}. Max. Tier: ${itemMeta.max_tier}.`);
  }

  const weight = cleanWikiText(itemMeta?.weight);
  if (weight && weight !== "0.00") {
    lines.push(`Pesa ${weight} oz.`);
  }

  const implemented = cleanWikiText(itemMeta?.implemented);
  if (implemented) {
    lines.push(`Adicionado: ${implemented}.`);
  }

  if (String(itemMeta?.marketable || "").toLowerCase() === "yes") {
    lines.push("Mercado: Este item pode ser comercializado pelo Mercado.");
  }

  return lines;
}

function addStat(stats, label, value) {
  const cleanedValue = cleanWikiText(value);

  if (cleanedValue) {
    stats.push(`${label}: ${cleanedValue}`);
  }
}

function addDefenseStat(stats, itemMeta) {
  const defense = cleanWikiText(itemMeta?.defense);

  if (!defense) {
    return;
  }

  const defenseMod = cleanWikiText(itemMeta?.defenseMod);
  stats.push(`Def: ${defense}${defenseMod ? ` ${defenseMod}` : ""}`);
}

function addElementalStat(stats, label, value) {
  const cleanedValue = cleanWikiText(value);

  if (cleanedValue) {
    stats.push(`${label}: ${cleanedValue}`);
  }
}

async function buildDetailedItemRecord(itemMeta) {
  if (itemMeta?.__canonicalDocument) {
    return buildCanonicalItemRecord(itemMeta.__canonicalDocument, itemMeta.__legacyItemMeta);
  }
  const [npcBuy, npcSell] = await Promise.all([
    enrichNpcListWithDetails(itemMeta.npc_buy),
    enrichNpcListWithDetails(itemMeta.npc_sell)
  ]);

  return applyCanonicalItemDocument({
    ...buildItemRecord(itemMeta),
    npc_buy: npcBuy,
    npc_sell: npcSell
  });
}

function canonicalItemImageUrl(document = {}) {
  const catalogMedia = canonicalLibraryMediaUrl(document.image);
  if (catalogMedia) return catalogMedia;
  const numeric = String(document.image || "").match(/\/library\/items\/(\d+)\.png(?:[?#].*)?$/i)?.[1];
  return numeric
    ? getAssetImageUrl(numeric)
    : getItemImageUrl({ slug: document.slug, wiki_name: document.name, image_src: document.image });
}

async function buildCanonicalItemRecord(document = {}, legacyItem = null) {
  // See applyCanonicalItemDocument: ensure canonical merchant rows always
  // have a resolved local sprite, including on the first detail request.
  await loadLibrarySpritePaths();
  const facts = canonicalFacts(document);
  const profile = document.profile || {};
  const description = String(document.description || "").trim();
  const notes = canonicalFact(facts, "Notas");
  return {
    id: document.slug,
    slug: document.slug,
    name: document.name,
    wiki_name: document.name,
    pageTitle: document.name,
    wikiUrl: document.meta?.wikiUrl || "",
    category: canonicalDisplayText(canonicalFact(facts, "Categoria")) || document.subtitle || "Sem categoria",
    image_src: canonicalItemImageUrl(document),
    canonicalDocument: document,
    canonicalFacts: Array.isArray(document.facts) ? document.facts : [],
    canonicalProfile: profile,
    technical_description_lines: Array.isArray(profile.technicalDescription) ? profile.technicalDescription.filter(Boolean) : [],
    notes_image: (() => {
      const noteImagePath = String(profile.noteImage || "").trim();
      const filename = noteImagePath.split("/").filter(Boolean).at(-1) || "";
      return canonicalLibraryMediaUrl(noteImagePath, filename ? dataServiceRuntime.getAssetUrl(`assets/library/items/catalog/notes/${filename}`) : "");
    })(),
    description_lines: description ? [description] : [],
    notes: canonicalContentEquals(notes, description) ? "" : notes,
    droppedBy: Array.isArray(profile.droppedBy)
      ? profile.droppedBy.filter((entry) => entry?.kind && entry?.slug).map((entry) => String(entry?.name || "").trim()).filter(Boolean)
      : [],
    unlinkedDroppedBy: Array.isArray(profile.droppedBy)
      ? profile.droppedBy.filter((entry) => !entry?.kind || !entry?.slug).map((entry) => String(entry?.name || "").trim()).filter(Boolean)
      : [],
    location: canonicalFact(facts, "Localização") || canonicalFact(facts, "Local") || null,
    map: document.meta?.mapUrl ? { url: document.meta.mapUrl } : null,
    marketable: canonicalFact(facts, "Market") || null,
    marketableExplicit: canonicalFact(facts, "Market") || null,
    storeTc: null,
    storeAvailable: false,
    attrib: "",
    proficiency: localizeCanonicalProficiency(profile.proficiency),
    damageTable: Array.isArray(profile.damageTable) ? profile.damageTable : [],
    damageModel: profile.damageModel || null,
    food: profile.food && typeof profile.food === "object" ? profile.food : null,
    tables: Array.isArray(profile.tables) ? profile.tables : [],
    npc_sell: Array.isArray(profile.buy) && profile.buy.length
      ? profile.buy.map((entry) => ({ ...entry, currency: entry.currency || "", image_src: canonicalSpriteUrl("npcs", entry.name) }))
      : await enrichNpcListWithDetails(legacyItem?.npc_sell),
    npc_buy: Array.isArray(profile.sell) && profile.sell.length
      ? profile.sell.map((entry) => ({ ...entry, currency: entry.currency || "", image_src: canonicalSpriteUrl("npcs", entry.name) }))
      : await enrichNpcListWithDetails(legacyItem?.npc_buy),
    max_tier: Number((profile.technicalDescription || []).join(" ").match(/Max\. Tier:\s*(\d+)/i)?.[1]) || 0
  };
}

function buildRelatedItems(currentItem, metadataIndex) {
  if (!currentItem?.category) {
    return [];
  }

  return metadataIndex.items
    .filter((item) => item.slug !== currentItem.slug && item.category === currentItem.category)
    .slice(0, 12)
    .map((item) => ({
      item: buildItemRecord(item)
    }));
}

function getItemImageUrl(itemMeta) {
  if (itemMeta?.__canonicalDocument) {
    return canonicalItemImageUrl(itemMeta.__canonicalDocument);
  }
  if (itemMeta?.assetId) {
    return getAssetImageUrl(itemMeta.assetId);
  }

  const directLocalImage = String(itemMeta?.image_src || "").trim();
  if (directLocalImage.startsWith("assets/")) {
    return dataServiceRuntime.getAssetUrl(directLocalImage);
  }
  if (directLocalImage.startsWith("/library/items/")) {
    return dataServiceRuntime.getAssetUrl(directLocalImage.replace(/^\/library\/items\//, "assets/library/items/catalog/"));
  }

  // Supplements and recently introduced items can have no numeric Tibia
  // sprite. The Website stores their reviewed sprite by slug; use that same
  // local asset in loot previews instead of an unreachable Wiki redirect.
  const slug = slugifyTibiaItemName(itemMeta?.slug || itemMeta?.wiki_name || itemMeta?.name || "");
  if (slug) {
    const source = String(itemMeta?.image_src || "");
    const extension = source.match(/\.(gif|png|jpe?g|webp)(?:[?#].*)?$/i)?.[1]?.toLowerCase() || "gif";
    return dataServiceRuntime.getAssetUrl(`assets/library/items/catalog/by-slug/${slug}.${extension}`);
  }

  if (itemMeta?.image_src) return itemMeta.image_src;

  return "";
}

function getAssetImageUrl(assetId) {
  const localAssetUrl = dataServiceRuntime.getAssetUrl(`assets/library/items/catalog/sprites/${assetId}.png`);
  return dataServiceRuntime.getCachedImageUrl(
    "item-sprites",
    `asset-${assetId}-${ITEM_SPRITE_VERSION}`,
    localAssetUrl
  );
}

function getRemoteItemImageUrl(assetId) {
  // Library media is part of the audited content pack. Do not fall back to a
  // third-party image endpoint while the user is browsing the application.
  return "";
}

function getRemoteAssetImageUrl(assetId) {
  return "";
}

function getCachedRemoteImageUrl(category, key, sourceUrl) {
  const normalizedSource = String(sourceUrl || "").trim();

  if (!normalizedSource || !/^https?:\/\//i.test(normalizedSource)) {
    return normalizedSource;
  }
  return "";
}

function enrichNpcList(npcs = []) {
  if (!Array.isArray(npcs)) {
    return [];
  }

  return npcs.map((npc) => ({
    ...npc,
    image_src: npc?.name ? getNpcImageUrl(npc.name) : ""
  }));
}

async function enrichNpcListWithDetails(npcs = []) {
  if (!Array.isArray(npcs) || npcs.length === 0) {
    return [];
  }

  return Promise.all(
    npcs.map(async (npc) => {
      const npcDetail = npc?.name ? await getNpcDetail(npc.name).catch(() => null) : null;

      return {
        ...npc,
        // A merchant's specific location (for example, Fibula) is more useful
        // and more faithful than its broad city category (for example, Thais).
        location: npc.location || npcDetail?.location || npcDetail?.city || null,
        image_src: npc?.name ? getNpcImageUrl(npc.name) : ""
      };
    })
  );
}

async function getNpcDetail(npcName) {
  const normalizedName = String(npcName || "").trim();

  if (!normalizedName) {
    return null;
  }

  const localDetail = await getLocalNpcDetail(normalizedName).catch(() => null);

  if (localDetail) {
    return localDetail;
  }

  return null;
}

async function getLocalNpcDetail(npcName) {
  const index = await getNpcDetailsIndex();
  const slug = slugifyTibiaItemName(npcName);
  const key = normalizeLookupValue(npcName);

  const detail = index.bySlug[slug] ?? index.byName[key] ?? null;

  if (detail) {
    return detail;
  }

  const bundledIndex = await loadBundledNpcIndex().catch(() => null);
  const indexedNpc = bundledIndex?.items?.find(
    (npc) => npc.slug === slug || normalizeLookupValue(npc.name) === key
  );

  return indexedNpc || null;
}

async function getNpcDetailsIndex() {
  if (npcDetailsIndexValue) {
    return npcDetailsIndexValue;
  }

  if (npcDetailsIndexPromise) {
    return npcDetailsIndexPromise;
  }

  npcDetailsIndexPromise = (async () => {
    const bundle = await dataServiceRuntime.readJsonAsset(NPC_DETAILS_BUNDLE_PATH);
    const npcs = Array.isArray(bundle) ? bundle : bundle?.npcs || [];
    const bySlug = {};
    const byName = {};
    const list = [];

    npcs.forEach((npc) => {
      if (!npc?.name) {
        return;
      }

      const normalized = {
        name: npc.name,
        slug: npc.slug || slugifyTibiaItemName(npc.name),
        city: npc.city || null,
        location: npc.location || null,
        subarea: npc.subarea || null,
        job: npc.job || null,
        job2: npc.job2 || null,
        trade: npc.buySell || npc.trade || null,
        image_src: npc.image_src || null
      };
      const slug = npc.slug || slugifyTibiaItemName(npc.name);
      const key = normalizeLookupValue(npc.name);

      if (slug && !bySlug[slug]) {
        bySlug[slug] = normalized;
      }

      if (key && !byName[key]) {
        byName[key] = normalized;
      }

      list.push(normalized);
    });

    npcDetailsIndexValue = {
      bySlug,
      byName,
      list
    };

    return npcDetailsIndexValue;
  })();

  try {
    return await npcDetailsIndexPromise;
  } finally {
    npcDetailsIndexPromise = null;
  }
}

function extractNpcField(detail, fieldName) {
  const rawWikiText = String(detail?.rawWikiText || "");
  const pattern = new RegExp(`^\\|\\s*${fieldName}\\s*=\\s*(.+)$`, "im");
  const match = rawWikiText.match(pattern);

  return match ? cleanWikiText(match[1]) : "";
}

function extractNpcSummaryField(summary, label) {
  const text = String(summary || "");
  const pattern = new RegExp(`${label}:\\s*([^.]*)`, "i");
  const match = text.match(pattern);

  return match ? cleanWikiText(match[1]) : "";
}

function getNpcImageUrl(npcName) {
  const normalizedNpcName = normalizeLookupValue(npcName);
  const fallbackPath = NPC_IMAGE_FALLBACKS[normalizedNpcName];

  if (fallbackPath) {
    return dataServiceRuntime.getAssetUrl(fallbackPath);
  }

  if (normalizedNpcName.includes("hireling")) {
    return dataServiceRuntime.getAssetUrl("assets/library/npcs/icons/Hireling_(Trader).gif");
  }

  if (normalizedNpcName.includes("wes") && normalizedNpcName.includes("blacksmith")) {
    return dataServiceRuntime.getAssetUrl("assets/library/npcs/icons/Wes_The_Blacksmith.gif");
  }

  const local = getLocalLibrarySpriteUrl("npcs", npcName);
  if (local) return local;

  return "";
}

function getTibiaWikiBrPageUrl(pageName) {
  return `https://www.tibiawiki.com.br/wiki/${encodeURIComponent(getTibiaWikiBrPageTitle(pageName))}`;
}

function getTibiaWikiBrPageUrlByTitle(pageTitle) {
  return `https://www.tibiawiki.com.br/wiki/${encodeURIComponent(String(pageTitle || "").trim())}`;
}

function getTibiaWikiBrPageTitle(pageName) {
  const slug = slugifyTibiaItemName(pageName);
  const override =
    NPC_DETAIL_OVERRIDES[slug] ||
    CREATURE_DETAIL_OVERRIDES[slug] ||
    null;

  if (override?.pageTitle) {
    return override.pageTitle;
  }

  return String(pageName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const [first = "", ...rest] = word;
      return `${first.toLocaleUpperCase()}${rest.join("")}`;
    })
    .join("_");
}

function getItemWikiPageTitle(entry) {
  const explicitPageTitle = String(entry?.pageTitle || entry?.wikiPageTitle || "").trim();

  if (explicitPageTitle) {
    return explicitPageTitle;
  }

  const urlCandidates = [
    entry?.wikiUrl,
    entry?.wiki_url,
    entry?.url
  ].map((value) => String(value || "").trim()).filter(Boolean);

  for (const candidate of urlCandidates) {
    const pageTitle = extractWikiPageTitleFromUrl(candidate);
    if (pageTitle) {
      return pageTitle;
    }
  }

  const wikiName = cleanWikiText(entry?.wiki_name || entry?.name || entry?.actualName || "");
  return wikiName ? getTibiaWikiBrPageTitle(wikiName) : "";
}

function extractWikiPageTitleFromUrl(urlValue) {
  try {
    const url = new URL(String(urlValue || "").trim());
    const parts = url.pathname.split("/").filter(Boolean);
    const wikiIndex = parts.findIndex((part) => part.toLowerCase() === "wiki");
    const rawTitle = wikiIndex >= 0
      ? parts[wikiIndex + 1]
      : parts[parts.length - 1];

    if (!rawTitle) {
      return "";
    }

    return safeDecodeUriComponent(rawTitle).trim();
  } catch {
    return "";
  }
}

function safeDecodeUriComponent(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function findWorldBySlug(worlds, worldSlug) {
  return worlds.find((world) => world.slug === worldSlug) ?? null;
}

function normalizeLookupValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function scoreSuggestionValue(value, query) {
  if (!value || !query) {
    return -1;
  }

  if (value === query) {
    return 600;
  }

  if (value.startsWith(query)) {
    return 450;
  }

  const words = value.split(/[^a-z0-9]+/).filter(Boolean);

  if (words.some((word) => word === query)) {
    return 360;
  }

  if (words.some((word) => word.startsWith(query))) {
    return 300;
  }

  const fuzzyTarget = value.slice(0, query.length);

  if (isCloseTokenMatch(fuzzyTarget, query)) {
    return 240;
  }

  if (words.some((word) => isCloseTokenMatch(word.slice(0, query.length), query))) {
    return 210;
  }

  return -1;
}

function isCloseTokenMatch(target, query) {
  if (!target || !query || Math.abs(target.length - query.length) > 1) {
    return false;
  }

  if (target === query) {
    return true;
  }

  if (target.length === query.length) {
    const diffIndexes = [];

    for (let index = 0; index < target.length; index += 1) {
      if (target[index] !== query[index]) {
        diffIndexes.push(index);

        if (diffIndexes.length > 2) {
          break;
        }
      }
    }

    if (diffIndexes.length === 1) {
      return true;
    }

    if (diffIndexes.length === 2) {
      const [firstIndex, secondIndex] = diffIndexes;
      return (
        target[firstIndex] === query[secondIndex] &&
        target[secondIndex] === query[firstIndex]
      );
    }
  }

  return levenshteinDistanceWithin(target, query, 1);
}

function levenshteinDistanceWithin(left, right, maxDistance) {
  const leftLength = left.length;
  const rightLength = right.length;

  if (Math.abs(leftLength - rightLength) > maxDistance) {
    return false;
  }

  const previousRow = Array.from({ length: rightLength + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= leftLength; leftIndex += 1) {
    let currentRow = [leftIndex];
    let minValue = currentRow[0];

    for (let rightIndex = 1; rightIndex <= rightLength; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const value = Math.min(
        previousRow[rightIndex] + 1,
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex - 1] + substitutionCost
      );

      currentRow.push(value);
      minValue = Math.min(minValue, value);
    }

    if (minValue > maxDistance) {
      return false;
    }

    for (let index = 0; index < currentRow.length; index += 1) {
      previousRow[index] = currentRow[index];
    }
  }

  return previousRow[rightLength] <= maxDistance;
}

function slugifyWorldName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function slugifyTibiaItemName(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['Ã¢â‚¬â„¢]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function itemNameFromSlug(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function normalizeMarketNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return null;
  }

  return value;
}

function unixToIso(value) {
  const timestamp = Number(value);

  if (!timestamp || Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryTibiaWikiRequest(status, attempt) {
  if (attempt >= TIBIAWIKI_DATA_RETRY_LIMIT) {
    return false;
  }

  return status === 408 || status === 429 || status >= 500;
}

function getRetryDelay(attempt, retryAfterHeader = "") {
  const exponentialMs = Math.min(30_000, 500 * (2 ** Math.max(0, attempt - 1)));
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
  const jitterMs = Math.floor(Math.random() * 250);
  return Math.max(exponentialMs, retryAfterMs) + jitterMs;
}

function parseRetryAfterMs(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return 0;
  }

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : 0;
}

function toNumberOrNull(value) {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value
      .trim()
      .replace(/,/g, "")
      .replace(/\?+$/g, "")
      .replace(/[^0-9.-]/g, "");

    if (!cleaned) {
      return null;
    }

    const normalized = Number(cleaned);
    return Number.isNaN(normalized) ? null : normalized;
  }

  return null;
}

async function getCache(key) {
  const entry = await getCacheEntry(key);

  if (!entry) {
    return null;
  }

  if (entry.isExpired) {
    return null;
  }

  return entry.value;
}

async function getCacheEntry(key, options = {}) {
  const memoryEntry = memoryCache.get(key);
  const ttlMs = Number.isFinite(options?.ttlMs) && options.ttlMs > 0
    ? options.ttlMs
    : getCacheTtl(key);
  const retentionMs = Number.isFinite(options?.retentionMs) && options.retentionMs > 0
    ? options.retentionMs
    : getCacheRetentionTtl(key);

  if (memoryEntry) {
    if (Date.now() - memoryEntry.timestamp > retentionMs) {
      memoryCache.delete(key);
      await dataServiceRuntime.storageRemove(key).catch(() => {});
      return null;
    }

    return {
      value: memoryEntry.value,
      isExpired: Date.now() - memoryEntry.timestamp > ttlMs
    };
  }

  const stored = await getCachedStorageRead(key);
  const entry = stored[key];

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > retentionMs) {
    await dataServiceRuntime.storageRemove(key).catch(() => {});
    return null;
  }

  memoryCache.set(key, entry);

  return {
    value: entry.value,
    isExpired: Date.now() - entry.timestamp > ttlMs
  };
}

async function getCachedStorageRead(key) {
  const normalizedKey = String(key || "");
  if (!normalizedKey) {
    return {};
  }

  let pending = cacheStorageReadPromises.get(normalizedKey);
  if (!pending) {
    pending = Promise.resolve()
      .then(() => dataServiceRuntime.storageGet(normalizedKey))
      .finally(() => cacheStorageReadPromises.delete(normalizedKey));
    cacheStorageReadPromises.set(normalizedKey, pending);
  }

  return pending;
}

async function putCache(key, value) {
  const entry = {
    timestamp: Date.now(),
    value
  };

  memoryCache.set(key, entry);

  if (!shouldPersistCache(key)) {
    return;
  }

  try {
    await dataServiceRuntime.storageSet({
      [key]: entry
    });
  } catch (_error) {
    // Ignore storage quota issues for non-essential caches; memory cache stays active.
  }
}

function shouldPersistCache(key) {
  return (
    key === WORLD_CACHE_KEY ||
    key === "item-metadata" ||
    key === ITEM_BUNDLE_CACHE_MARKER_KEY ||
    key.startsWith("currency:") ||
    key.startsWith("item:") ||
    key.startsWith("item-static:") ||
    key.startsWith("imbuements:") ||
    key.startsWith("market-values:") ||
    key.startsWith("market-world:") ||
    key.startsWith("wiki-item:") ||
    key.startsWith("npc-detail:") ||
    key.startsWith("npc-index:") ||
    key.startsWith("npc-ui-detail:") ||
    key.startsWith("creature-index:") ||
    key.startsWith("creature-detail:") ||
    key.startsWith("boss-tracker:") ||
    key.startsWith("character-profile:") ||
    key.startsWith("find-party-world:") ||
    key.startsWith("find-party-guilds:") ||
    key.startsWith("find-party-guild:")
  );
}

function getCacheTtl(key) {
  if (
    key === ITEM_BUNDLE_CACHE_MARKER_KEY ||
    key === "item-metadata" ||
    key.startsWith("item-static:") ||
    key.startsWith("wiki-item:") ||
    key.startsWith("npc-detail:") ||
    key.startsWith("npc-index:") ||
    key.startsWith("npc-ui-detail:") ||
    key.startsWith("creature-index:") ||
    key.startsWith("creature-detail:") ||
    key.startsWith("boss-tracker:")
  ) {
    return STATIC_CACHE_TTL_MS;
  }

  if (key.startsWith("imbuements:")) {
    return IMBUEMENT_CACHE_TTL_MS;
  }

  if (key === WORLD_CACHE_KEY) {
    return WORLD_CACHE_TTL_MS;
  }

  if (key.startsWith("character-profile:")) {
    return CHARACTER_PROFILE_CACHE_TTL_MS;
  }

  if (key.startsWith("find-party-world:")) {
    return FIND_PARTY_WORLD_CACHE_TTL_MS;
  }

  if (key.startsWith("find-party-guilds:")) {
    return FIND_PARTY_GUILDS_CACHE_TTL_MS;
  }

  if (key.startsWith("find-party-guild:")) {
    return FIND_PARTY_GUILD_MEMBERS_CACHE_TTL_MS;
  }

  return CACHE_TTL_MS;
}

function getCacheRetentionTtl(key) {
  if (key === WORLD_CACHE_KEY) {
    return WORLD_CACHE_RETENTION_MS;
  }

  if (key.startsWith("currency:")) {
    return CURRENCY_CACHE_RETENTION_MS;
  }

  if (key.startsWith("imbuements:")) {
    return IMBUEMENT_CACHE_RETENTION_MS;
  }

  if (key.startsWith("market-values:") || key.startsWith("market-world:")) {
    return MARKET_CACHE_RETENTION_MS;
  }

  if (key.startsWith("character-profile:")) {
    return CHARACTER_PROFILE_CACHE_RETENTION_MS;
  }

  if (key.startsWith("find-party-world:")) {
    return FIND_PARTY_WORLD_CACHE_RETENTION_MS;
  }

  if (key.startsWith("find-party-guilds:")) {
    return FIND_PARTY_GUILDS_CACHE_RETENTION_MS;
  }

  if (key.startsWith("find-party-guild:")) {
    return FIND_PARTY_GUILD_MEMBERS_CACHE_RETENTION_MS;
  }

  return getCacheTtl(key);
}

async function cleanupStorageCaches() {
  if (storageCacheCleanupPromise) {
    return storageCacheCleanupPromise;
  }

  storageCacheCleanupPromise = (async () => {
    const stored = await dataServiceRuntime.storageGet(null);
    const keysToRemove = Object.entries(stored)
      .filter(([key, entry]) => {
        if (key.startsWith("page:") || key.startsWith("home:")) {
          return true;
        }

        return Boolean(entry?.timestamp && Date.now() - entry.timestamp > getCacheRetentionTtl(key));
      })
      .map(([key]) => key);

    if (keysToRemove.length > 0) {
      await dataServiceRuntime.storageRemove(keysToRemove);
    }
  })();

  try {
    await storageCacheCleanupPromise;
  } finally {
    storageCacheCleanupPromise = Promise.resolve();
  }
}
