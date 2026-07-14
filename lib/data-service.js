import { ALL_IMBUEMENT_INGREDIENT_NAMES } from "./imbuements-data.js";

import { getActiveLocale, normalizeLocale, setActiveLocale } from "./locale-state.js";

import {
  fetchBossDetail as fetchDirectBossDetail,
  fetchBossWorld as fetchDirectBossWorld,
  fetchTibiaDataGuild as fetchDirectTibiaDataGuild,
  fetchTibiaDataGuilds as fetchDirectTibiaDataGuilds,
  fetchTibiaDataKillStatistics as fetchDirectTibiaDataKillStatistics,
  fetchTibiaDataWorld as fetchDirectTibiaDataWorld
} from "../services/game-data-hub/server.mjs";

const DEFAULT_WORLD = "antica";
const DEFAULT_ITEM = "tibia-coins";
const CACHE_TTL_MS = 1000 * 60 * 15;
const PERSISTED_DYNAMIC_CACHE_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;
const MARKET_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const IMBUEMENT_CACHE_TTL_MS = 1000 * 60 * 60;
const IMBUEMENT_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const STATIC_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 90;
const WORLD_CACHE_TTL_MS = 1000 * 60 * 10;
const WORLD_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const CHARACTER_PROFILE_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const CHARACTER_PROFILE_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const CURRENCY_CACHE_RETENTION_MS = PERSISTED_DYNAMIC_CACHE_RETENTION_MS;
const API_RATE_LIMIT_MS = 5000;
const ITEM_SPRITE_VERSION = "tibiadata-assets-api-v2";
const ITEM_CACHE_VERSION = "local-details-v7";
const ITEM_BUNDLE_CACHE_MARKER_KEY = "item-bundle-cache-marker";
const CREATURE_DETAIL_CACHE_VERSION = "v13";
// v4 reparses GuildStats `const daysRound`, restoring the live current-day
// marker and date-cycle filter instead of serving the old incomplete cache.
const BOSS_TRACKER_CACHE_VERSION = "v5";
const ITEM_METADATA_BUNDLE_PATH = "assets/data/item-metadata.json";
const ITEM_DETAILS_BUNDLE_PATH = "assets/data/item-details.json";
const ITEM_SUPPLEMENTS_BUNDLE_PATH = "assets/data/item-supplements.json";
const ITEM_DROPPED_BY_OVERRIDES_BUNDLE_PATH = "assets/data/item-dropped-by-overrides.json";
const ITEM_PROFICIENCY_DAMAGE_BUNDLE_PATH = "assets/data/item-proficiency-damage.json";
const ITEM_NPC_TRADES_BUNDLE_PATH = "assets/data/item-npc-trades.json";
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
const NPC_DETAILS_BUNDLE_PATH = "assets/data/npc-details.json";
const NPC_INDEX_BUNDLE_PATH = "assets/data/npc-index.json";
const NPC_JOB_OVERRIDES_BUNDLE_PATH = "assets/data/npc-job-overrides.json";
const CREATURE_INDEX_BUNDLE_PATH = "assets/data/creature-index.json";
const CREATURE_STATUS_OVERRIDES_BUNDLE_PATH = "assets/data/creature-status-overrides.json";
const TIBIA_MARKET_API_BASE = "https://api.tibiamarket.top";
const TIBIADATA_WORLDS_ENDPOINT = "https://api.tibiadata.com/v4/worlds";
const TIBIADATA_CHARACTER_ENDPOINT = "https://api.tibiadata.com/v4/character";
const TIBIADATA_WORLD_ENDPOINT = "https://api.tibiadata.com/v4/world";
const TIBIADATA_GUILDS_ENDPOINT = "https://api.tibiadata.com/v4/guilds";
const TIBIADATA_GUILD_ENDPOINT = "https://api.tibiadata.com/v4/guild";
const DEFAULT_GAME_DATA_HUB_BASE = "http://138.117.217.99:4318";
const GAME_DATA_HUB_BOSS_TIMEOUT_MS = 6500;
const MARKET_API_TIMEOUT_MS = 8000;
const FALLBACK_BASE_TIMEOUT_MS = 2500;
const TIBIAWIKI_DATA_API_BASE = "https://tibiadata.bytewizards.de/api/v1";
const TIBIA_FANDOM_API_BASE = "https://tibia.fandom.com/api.php";
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
  "Fruit",
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
  hireling: "assets/ui/Hireling_(Trader).gif",
  "wes the blacksmith": "assets/ui/Wes_The_Blacksmith.gif",
  'hireling "trader"': "assets/ui/Hireling_(Trader).gif",
  "hireling trader": "assets/ui/Hireling_(Trader).gif"
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
const memoryCache = new Map();
const backgroundRefreshKeys = new Set();

let itemMetadataIndexPromise = null;
let itemMetadataIndexValue = null;
let itemDetailsIndexPromise = null;
let itemDetailsIndexValue = null;
let itemDroppedByOverridesPromise = null;
let itemDroppedByOverridesValue = null;
let itemProficiencyDamageValue = null;
let itemNpcTradesValue = null;
let npcDetailsIndexPromise = null;
let npcDetailsIndexValue = null;
let npcJobOverridesPromise = null;
let npcJobOverridesValue = null;
let npcIndexBundleValue = null;
let creatureIndexBundleValue = null;
let creatureStatusOverridesPromise = null;
let creatureStatusOverridesValue = null;
const characterProfileCache = new Map();
let storageCacheCleanupPromise = null;
let dataServiceRuntime = createUnsupportedRuntime();

export function configureDataService(runtime) {
  dataServiceRuntime = {
    ...createUnsupportedRuntime(),
    ...runtime
  };
}

export async function handleDataServiceMessage(message) {
  switch (message?.type) {
    case "set-locale":
      return { locale: setActiveLocale(message?.payload?.locale) };
    case "bootstrap":
      return getBootstrapData();
    case "fetch-item":
      return getItemData(message.payload);
    case "fetch-item-static":
      return getStaticItemData(message.payload);
    case "fetch-item-suggestions":
      return getItemSuggestions(message.payload);
    case "fetch-stash-items":
      return getStashItems();
    case "fetch-stash-market-values":
      return getStashMarketValues(message.payload);
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
    getCachedImageUrl(_category, _key, sourceUrl) {
      return sourceUrl;
    },
    async readJsonAsset() {
      throw new Error("Runtime nao configurado para leitura de assets.");
    },
    async storageGet() {
      return {};
    },
    async storageSet() {},
    async storageRemove() {}
  };
}

async function getBootstrapData() {
  void cleanupStorageCaches().catch(() => {});
  await invalidateItemCachesForUpdatedBundles().catch(() => {});
  const worlds = await fetchWorldCatalog();

  return {
    worlds,
    defaultWorld: DEFAULT_WORLD,
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
  return dataServiceRuntime.readJsonAsset(`assets/i18n/phrases.${locale}.json`);
}

async function invalidateItemCachesForUpdatedBundles() {
  const [detailsBundle, supplementsBundle, proficiencyBundle, npcTradesBundle] = await Promise.all([
    dataServiceRuntime.readJsonAsset(ITEM_DETAILS_BUNDLE_PATH).catch(() => null),
    dataServiceRuntime.readJsonAsset(ITEM_SUPPLEMENTS_BUNDLE_PATH).catch(() => null),
    dataServiceRuntime.readJsonAsset(ITEM_PROFICIENCY_DAMAGE_BUNDLE_PATH).catch(() => null),
    dataServiceRuntime.readJsonAsset(ITEM_NPC_TRADES_BUNDLE_PATH).catch(() => null)
  ]);
  const currentMarker = JSON.stringify({
    detailsGeneratedAt: detailsBundle?.generatedAt || "",
    detailsCount: Array.isArray(detailsBundle?.items) ? detailsBundle.items.length : 0,
    supplementsGeneratedAt: supplementsBundle?.generatedAt || "",
    supplementsCount: Array.isArray(supplementsBundle?.items) ? supplementsBundle.items.length : 0,
    proficiencyGeneratedAt: proficiencyBundle?.generatedAt || "",
    proficiencyCount: Array.isArray(proficiencyBundle?.items) ? proficiencyBundle.items.length : 0,
    npcTradesGeneratedAt: npcTradesBundle?.generatedAt || "",
    npcTradesCount: Array.isArray(npcTradesBundle?.items) ? npcTradesBundle.items.length : 0
  });
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
  const worldSlug = slugifyWorldName(payload?.worldSlug || DEFAULT_WORLD);
  const itemSlug = slugifyTibiaItemName(payload?.itemSlug || "");
  const forceFreshMarket = payload?.forceFreshMarket === true;

  if (!itemSlug) {
    throw new Error("Informe o slug do item.");
  }

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

  if (
    !forceFreshMarket &&
    cached &&
    !cachedEntry?.isExpired &&
    cachedWorldUpdate &&
    currentWorldUpdate &&
    cachedWorldUpdate === currentWorldUpdate
  ) {
    return applyDroppedByOverridesToCachedItemPayload(cached, cacheKey);
  }

  if (!forceFreshMarket && cached && !cachedEntry?.isExpired && (!cachedWorldUpdate || !currentWorldUpdate)) {
    return applyDroppedByOverridesToCachedItemPayload(cached, cacheKey);
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

async function getStaticItemData(payload) {
  const worldSlug = slugifyWorldName(payload?.worldSlug || DEFAULT_WORLD);
  const itemSlug = slugifyTibiaItemName(payload?.itemSlug || "");

  if (!itemSlug) {
    throw new Error("Informe o slug do item.");
  }

  const cacheKey = `item-static:${ITEM_CACHE_VERSION}:${itemSlug}`;
  const worldCacheKey = `item:${ITEM_CACHE_VERSION}:${worldSlug}:${itemSlug}`;
  const cached = await getCache(cacheKey);
  const cachedWorldEntry = await getCacheEntry(worldCacheKey);
  const cachedWorldData = cachedWorldEntry?.value || null;
  const itemDetail = await resolveItemDetailBySlug(itemSlug);
  const selectedWorld = {
    ...(cachedWorldData?.selectedWorld || {}),
    name: cachedWorldData?.selectedWorld?.name || itemNameFromSlug(worldSlug),
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
    return {
      ...cachedWithOverrides,
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
    relatedItems: itemMetadataIndexValue ? buildRelatedItems(itemDetail, itemMetadataIndexValue) : [],
    availableWorlds: worlds
  };

  await putCache(`currency:${worldSlug}`, {
    worldSlug,
    tibiaCoinPrice: tibiaCoinMarket?.sell_offer ?? null,
    goldTokenPrice: goldTokenMarket?.sell_offer ?? null
  });
  await putCache(cacheKey, result);
  void refreshStaticItemDetailInBackground({
    itemSlug,
    cacheKey,
    cachedResult: result
  });
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

async function refreshStaticItemDetailInBackground({ itemSlug, cacheKey, cachedResult }) {
  const refreshKey = `item-detail:${itemSlug}`;

  if (backgroundRefreshKeys.has(refreshKey)) {
    return;
  }

  backgroundRefreshKeys.add(refreshKey);

  try {
    const onlineDetail = await fetchTibiaWikiJson(`items/${encodeURIComponent(itemNameFromSlug(itemSlug))}`);
    const normalized = normalizeItemMetadata({
      ...onlineDetail,
      detailLoaded: true
    });

    if (!normalized) {
      return;
    }

    const currentStaticSignature = getStaticItemSignature(cachedResult?.item);
    const onlineStaticSignature = getStaticItemSignature(normalized);

    if (currentStaticSignature === onlineStaticSignature) {
      return;
    }

    const updatedResult = {
      ...cachedResult,
      item: await buildDetailedItemRecord(normalized)
    };

    await putCache(`wiki-item:${normalized.slug}`, normalized);
    await putCache(cacheKey, updatedResult);
  } catch (_error) {
    // Background refresh is best-effort; local bundled data remains the fallback.
  } finally {
    backgroundRefreshKeys.delete(refreshKey);
  }
}

function getStaticItemSignature(item) {
  return JSON.stringify({
    npc_buy: getNpcTradeSignature(item?.npc_buy),
    npc_sell: getNpcTradeSignature(item?.npc_sell),
    marketId: item?.marketId ?? item?.id ?? null
  });
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
  const worldSlug = slugifyWorldName(payload?.worldSlug || DEFAULT_WORLD);
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
  const limit = Math.min(Math.max(Number(payload?.limit) || 8, 1), showAll ? 6000 : 20);

  if (query.length < 1 && !showAll) {
    return [];
  }

  const metadataIndex = await getItemMetadataIndex();
  const normalizedQuery = normalizeLookupValue(query);
  const slugQuery = slugifyTibiaItemName(query);

  return metadataIndex.items
    .filter(isVisibleUiItem)
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
    .slice(0, limit)
    .map(({ item }) => ({
      id: item.id,
      slug: item.slug,
      name: item.wiki_name || item.name,
      category: item.category || "Sem categoria",
      imageSrc: getItemImageUrl(item)
    }));
}

async function getStashItems() {
  const metadataIndex = await getItemMetadataIndex();
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

async function getNpcIndex() {
  const bundled = await loadBundledNpcIndex().catch(() => null);

  if (bundled?.items?.length) {
    return bundled;
  }

  const cacheKey = "npc-index:fandom-category-v4";
  const cached = await getCache(cacheKey);

  if (cached?.items?.length) {
    return cached;
  }

  const localIndex = await getNpcDetailsIndex().catch(() => ({ list: [] }));
  const bySlug = new Map();

  (localIndex.list || []).forEach((npc) => {
    const normalized = normalizeNpcIndexEntry(npc);

    if (normalized) {
      bySlug.set(normalized.slug, normalized);
    }
  });

  const fandomNames = await fetchFandomCategoryMembers("Category:NPCs").catch(() => []);
  fandomNames.forEach((name) => {
    if (!isValidNpcIndexName(name)) {
      return;
    }

    const slug = slugifyTibiaItemName(name);
    if (!bySlug.has(slug)) {
      bySlug.set(slug, normalizeNpcIndexEntry({ name, source: "fandom" }));
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

  await putCache(cacheKey, result);
  return result;
}

async function loadBundledNpcIndex() {
  if (npcIndexBundleValue) {
    return npcIndexBundleValue;
  }

  const bundle = await dataServiceRuntime.readJsonAsset(NPC_INDEX_BUNDLE_PATH);
  const jobOverrides = await loadNpcJobOverrides();
  const items = Array.isArray(bundle?.items)
    ? bundle.items.map(normalizeNpcIndexEntry).filter(Boolean)
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

  const cacheKey = `npc-ui-detail:v7:${slugifyTibiaItemName(name)}`;
  const cached = await getCache(cacheKey);

  if (cached) {
    return cached;
  }

  const localDetail = await getLocalNpcDetail(name).catch(() => null);

  if (localDetail) {
    const normalized = await enrichNpcDetailForUi(normalizeNpcDetailForUi(null, localDetail));
    normalized.tradeItems = await getNpcTradeItems(normalized.name);
    await putCache(cacheKey, normalized);
    return normalized;
  }

  const detail = await fetchTibiaWikiJson(`npcs/${encodeURIComponent(name)}`);
  const normalized = await enrichNpcDetailForUi(normalizeNpcDetailForUi(detail, { name }));
  normalized.tradeItems = await getNpcTradeItems(normalized.name);
  await putCache(cacheKey, normalized);
  return normalized;
}

async function getCreatureIndex() {
  const bundled = await loadBundledCreatureIndex().catch(() => null);

  if (bundled?.items?.length && Array.isArray(bundled.categories)) {
    return bundled;
  }

  const cacheKey = "creature-index:tibiawiki-v4";
  const cached = await getCache(cacheKey);

  if (cached?.items?.length && Array.isArray(cached.categories)) {
    return cached;
  }

  const pageSize = 100;
  const items = [];
  let page = 1;
  let totalCount = 0;

  do {
    const data = await fetchTibiaWikiJson(`creatures?page=${page}&pageSize=${pageSize}`);
    const pageItems = Array.isArray(data?.items) ? data.items : [];

    totalCount = Number(data?.totalCount) || totalCount || pageItems.length;
    items.push(...pageItems.map(normalizeCreatureIndexEntry).filter(Boolean));

    if (pageItems.length < pageSize) {
      break;
    }

    page += 1;
  } while (items.length < totalCount && page < 25);

  const sortedItems = items.sort((left, right) => left.name.localeCompare(right.name));
  const categories = await buildCreatureCategoryIndex(sortedItems);
  const result = {
    generatedAt: new Date().toISOString(),
    totalCount,
    items: sortedItems,
    categories,
    classes: uniqueSorted(sortedItems.map((creature) => creature.creatureClass).filter(Boolean)),
    types: uniqueSorted(
      sortedItems.flatMap((creature) => [creature.primaryType, creature.secondaryType]).filter(Boolean)
    )
  };

  await putCache(cacheKey, result);
  return result;
}

async function loadBundledCreatureIndex() {
  if (creatureIndexBundleValue) {
    return creatureIndexBundleValue;
  }

  const bundle = await dataServiceRuntime.readJsonAsset(CREATURE_INDEX_BUNDLE_PATH);
  const statusOverrides = await loadCreatureStatusOverrides().catch(() => ({}));

  if (!bundle?.items?.length) {
    return null;
  }

  creatureIndexBundleValue = {
    ...bundle,
    items: bundle.items.map((creature) => enrichCreatureIndexEntry(creature, statusOverrides)),
    categories: (bundle.categories || []).map((category) => ({
      ...category,
      imageSrc: dataServiceRuntime.getAssetUrl(category.imageSrc || `assets/ui/creature-categories/${category.slug}.png`)
    }))
  };

  return creatureIndexBundleValue;
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
      statusOverrides?.[creature?.slug || slugifyTibiaItemName(creature?.name)]?.imageSrc ||
      getCreatureOverrideImageUrl(creature?.name, detailOverride) ||
      getCreatureWikiImageUrl(creature?.name) ||
      creature.imageSrc ||
      ""
  };
}

async function buildCreatureCategoryIndex(items) {
  const byLookup = new Map();
  const categoryBuckets = new Map(
    CREATURE_CATEGORY_DEFINITIONS.map((definition) => [definition.slug, new Set()])
  );

  items.forEach((item) => {
    const keys = [
      normalizeLookupValue(item.name),
      normalizeLookupValue(item.name?.replace(/\s+\(Creature\)$/i, ""))
    ].filter(Boolean);

    keys.forEach((key) => {
      if (!byLookup.has(key)) {
        byLookup.set(key, item);
      }
    });
  });

  const categoryMembers = await Promise.all(
    CREATURE_CATEGORY_DEFINITIONS.map(async (definition) => ({
      definition,
      members: (
        await Promise.all(
          (definition.titles || []).map((title) =>
            fetchFandomCategoryMembers(`Category:${title}`).catch(() => [])
          )
        )
      ).flat()
    }))
  );

  categoryMembers.forEach(({ definition, members }) => {
    const bucket = categoryBuckets.get(definition.slug);

    [...(definition.fallback || []), ...members].forEach((creatureName) => {
      const item = findCreatureByCategoryName(byLookup, creatureName);
      if (item) {
        bucket.add(item.slug);
      }
    });
  });

  items.forEach((item) => {
    const categories = CREATURE_CATEGORY_DEFINITIONS
      .filter((definition) => categoryBuckets.get(definition.slug)?.has(item.slug))
      .map((definition) => definition.slug);

    item.categorySlugs = categories;
    item.categoryLabels = CREATURE_CATEGORY_DEFINITIONS
      .filter((definition) => categories.includes(definition.slug))
      .map((definition) => definition.label);
  });

  return CREATURE_CATEGORY_DEFINITIONS.map((definition) => {
    const itemSlugs = Array.from(categoryBuckets.get(definition.slug) || []);
    return {
      slug: definition.slug,
      label: definition.label,
      imageSrc: dataServiceRuntime.getAssetUrl(`assets/ui/creature-categories/${definition.slug}.png`),
      count: itemSlugs.length,
      itemSlugs
    };
  });
}

function findCreatureByCategoryName(byLookup, rawName) {
  const name = String(rawName || "").trim();

  if (!name) {
    return null;
  }

  const candidates = [
    name,
    name.replace(/\s+\(Creature\)$/i, ""),
    `${name} (Creature)`
  ];

  for (const candidate of candidates) {
    const item = byLookup.get(normalizeLookupValue(candidate));
    if (item) {
      return item;
    }
  }

  return null;
}

async function getCreatureDetail(payload = {}) {
  const name = String(payload.name || "").trim();

  if (!name) {
    throw new Error("Monstro nao informado.");
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
    const refreshedCached = await refreshCachedCreatureDetail(cached);

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

    const migratedCached = await refreshCachedCreatureDetail(legacyCached);
    await putCache(cacheKey, migratedCached);
    return payload?.includeBossTracker ? enrichCreatureDetailWithBossWorldData(migratedCached, payload) : migratedCached;
  }

  const localCreature = getLocalCreatureIndexEntry(name);
  const statusOverride = getCreatureStatusOverride(name, localCreature);
  let detail = null;

  try {
    detail = await fetchTibiaWikiJson(`creatures/${encodeURIComponent(name)}`);
  } catch (error) {
    if (!statusOverride && !localCreature) {
      throw error;
    }
  }

  const normalized = await enrichCreatureDetailForUi(
    normalizeCreatureDetailForUi(detail || { name: localCreature?.name || statusOverride?.name || name })
  );
  await putCache(cacheKey, normalized);
  return payload?.includeBossTracker ? enrichCreatureDetailWithBossWorldData(normalized, payload) : normalized;
}

async function getBossTrackerForUi(payload = {}) {
  const name = String(payload.name || "").trim();
  const worldSlug = slugifyWorldName(payload.worldSlug || payload.worldName || payload.world || DEFAULT_WORLD);

  if (!name) {
    throw new Error("Boss nao informado.");
  }

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
  const gameDataHubBase = getGameDataHubBase();
  if (gameDataHubBase) {
    try {
      return await fetchGameDataHubJson(
        `${gameDataHubBase}/api/game/bosses/worlds/${encodeURIComponent(worldSlug)}`,
        `Falha ao consultar bosses do mundo`,
        GAME_DATA_HUB_BOSS_TIMEOUT_MS
      );
    } catch (_error) {
      // fallback below
    }
  }

  return fetchDirectBossWorld(worldSlug);
}

async function fetchBossDetailTrackerPayload(worldSlug, bossSlug) {
  const gameDataHubBase = getGameDataHubBase();
  if (gameDataHubBase) {
    try {
      return await fetchGameDataHubJson(
        `${gameDataHubBase}/api/game/bosses/worlds/${encodeURIComponent(worldSlug)}/${encodeURIComponent(bossSlug)}`,
        `Falha ao consultar detalhe do boss`,
        GAME_DATA_HUB_BOSS_TIMEOUT_MS
      );
    } catch (_error) {
      // fallback below
    }
  }

  return fetchDirectBossDetail(worldSlug, bossSlug);
}

async function fetchBossKillStatisticsPayload(worldName) {
  const gameDataHubBase = getGameDataHubBase();
  if (gameDataHubBase) {
    try {
      const payload = await fetchGameDataHubJson(
        `${gameDataHubBase}/api/game/tibiadata/worlds/${encodeURIComponent(worldName)}/killstatistics`,
        `Falha ao consultar kill statistics`,
        GAME_DATA_HUB_BOSS_TIMEOUT_MS
      );
      return payload?.killstatistics || null;
    } catch (_error) {
      // fallback below
    }
  }

  return fetchDirectTibiaDataKillStatistics(worldName)?.then((payload) => payload?.killstatistics || null);
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
        throw new Error(`${errorLabel} (${response.status}): ${body}`);
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
                .filter((pathEntry) => pathEntry.routes.length > 1)
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
    imageSrc.includes("/assets/data/item-sprites/") ||
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

async function fetchFandomCategoryMembers(categoryTitle) {
  const members = [];
  let cmcontinue = "";

  do {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: categoryTitle,
      cmlimit: "500",
      format: "json",
      origin: "*"
    });

    if (cmcontinue) {
      params.set("cmcontinue", cmcontinue);
    }

    const response = await fetch(`${TIBIA_FANDOM_API_BASE}?${params.toString()}`, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Falha ao consultar Fandom (${response.status}).`);
    }

    const data = await response.json();
    members.push(
      ...(data?.query?.categorymembers || [])
        .filter((member) => member?.ns === 0 && member?.title)
        .map((member) => member.title)
    );
    cmcontinue = data?.continue?.cmcontinue || "";
  } while (cmcontinue);

  return members;
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
    imageSrc: npc.imageSrc || npc.image_src || getNpcImageUrl(displayName)
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

  if (isWeakNpcJob(enriched.job) || !enriched.city || !enriched.location || !enriched.map?.url) {
    const fandomFields = await fetchFandomNpcFields(enriched.name).catch(() => null);

    if (fandomFields) {
      if (!enriched.city && fandomFields.city) {
        enriched.city = fandomFields.city;
      }

      if (!enriched.location && fandomFields.location) {
        enriched.location = fandomFields.location;
      }

      if (isWeakNpcJob(enriched.job) && fandomFields.job && !isWeakNpcJob(fandomFields.job)) {
        enriched.job = fandomFields.job;
      }

      if (!enriched.job2 && fandomFields.job2) {
        enriched.job2 = fandomFields.job2;
      }

      if (!enriched.implemented && fandomFields.implemented) {
        enriched.implemented = fandomFields.implemented;
      }

      if (!enriched.map?.url) {
        enriched.map = extractMapReference({}, fandomFields);
      }
    }
  }

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

async function fetchFandomNpcFields(name) {
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    titles: name,
    rvprop: "content",
    rvslots: "main",
    formatversion: "2",
    format: "json",
    origin: "*"
  });
  const response = await fetch(`${TIBIA_FANDOM_API_BASE}?${params.toString()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const raw = data?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content || "";

  if (!raw) {
    return null;
  }

  return extractSimpleWikiTemplateFields(raw);
}

function extractSimpleWikiTemplateFields(raw) {
  const aliases = {
    job: "job",
    job2: "job2",
    city: "city",
    location: "location",
    implemented: "implemented",
    posx: "posx",
    posy: "posy",
    posz: "posz"
  };

  return extractWikiTemplateFields(raw, aliases);
}

async function fetchFandomCreatureFields(name) {
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    titles: name,
    rvprop: "content",
    rvslots: "main",
    formatversion: "2",
    format: "json",
    origin: "*"
  });
  const response = await fetch(`${TIBIA_FANDOM_API_BASE}?${params.toString()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const raw = data?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content || "";

  if (!raw) {
    return null;
  }

  return extractWikiTemplateFields(raw, {
    hp: "hp",
    exp: "exp",
    speed: "speed",
    armor: "armor",
    mitigation: "mitigation",
    charmspoints: "charmspoints",
    charms: "charms",
    bestiarylevel: "bestiarylevel",
    occurrence: "occurrence",
    bosstiaryclass: "bosstiaryclass",
    bosstiarycategory: "bosstiarycategory",
    pushable: "pushable",
    pushobjects: "pushobjects",
    walksaround: "walksaround",
    walksthrough: "walksthrough",
    paraimmune: "paraimmune",
    senseinvis: "senseinvis",
    illusionable: "illusionable",
    behaviour: "behaviour",
    behavior: "behavior",
    strategy: "strategy",
    notes: "notes",
    location: "location",
    abilities: "abilities",
    sounds: "sounds",
    loot: "loot",
    posx: "posx",
    posy: "posy",
    posz: "posz"
  }, { preserveRaw: new Set(["abilities", "sounds", "loot"]) });
}

function extractWikiTemplateFields(raw, aliases, options = {}) {
  const fields = {};
  const preserveRaw = options.preserveRaw || new Set();

  String(raw || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^\|\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);

      if (!match) {
        return;
      }

      const key = aliases[match[1].toLowerCase()];
      if (!key) {
        return;
      }

      fields[key] = preserveRaw.has(key) ? String(match[2] || "").trim() : cleanEntityText(match[2]);
    });

  Object.entries(aliases).forEach(([rawKey, key]) => {
    if (!preserveRaw.has(key)) {
      return;
    }

    const rawValue = extractMultilineWikiField(raw, rawKey);
    if (rawValue && rawValue.length > String(fields[key] || "").length) {
      fields[key] = rawValue;
    }
  });

  return fields;
}

function extractMultilineWikiField(raw, key) {
  const lines = String(raw || "").split(/\r?\n/);
  const startIndex = lines.findIndex((line) =>
    new RegExp(`^\\|\\s*${escapeRegExp(key)}\\s*=`, "i").test(line)
  );

  if (startIndex < 0) {
    return "";
  }

  const firstLine = lines[startIndex].replace(new RegExp(`^\\|\\s*${escapeRegExp(key)}\\s*=\\s*`, "i"), "");
  const collected = [firstLine];
  let depth = getTemplateDepth(firstLine);

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (depth <= 0 && /^\|\s*[A-Za-z0-9_]+\s*=/.test(line)) {
      break;
    }

    collected.push(line);
    depth += getTemplateDepth(line);

    if (depth <= 0 && firstLine.includes("{{")) {
      break;
    }
  }

  return collected.join("\n").trim();
}

function getTemplateDepth(value) {
  const text = String(value || "");
  const open = (text.match(/\{\{/g) || []).length;
  const close = (text.match(/\}\}/g) || []).length;
  return open - close;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
      statusOverride?.imageSrc ||
      getCreatureOverrideImageUrl(name, override) ||
      getCreatureWikiImageUrl(name) ||
      getCreatureImageUrl(detail) ||
      bundledCreature?.imageSrc ||
      "",
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
    const fandomFields = await fetchFandomCreatureFields(enriched.name).catch(() => null);

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

  return rarityCandidate || lootQualifier || contextRarity || "common";
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
  return getRemoteAssetImageUrl(
    detail?.primaryImage?.assetId ||
      (Array.isArray(detail?.images) ? detail.images[0]?.assetId : null)
  );
}

function getCreatureOverrideImageUrl(name, override = {}) {
  if (!override?.imageFile) {
    return "";
  }

  const sourceUrl = `https://www.tibiawiki.com.br/wiki/Special:Redirect/file/${encodeURIComponent(override.imageFile || `${getTibiaWikiBrPageTitle(name)}.gif`)}`;
  return getCachedRemoteImageUrl("creatures", name, sourceUrl);
}

function getCreatureWikiImageUrl(name) {
  const displayName = String(name || "")
    .replace(/\s+\(Creature\)$/i, "")
    .trim();

  if (!displayName) {
    return "";
  }

  const sourceUrl = `https://www.tibiawiki.com.br/wiki/Special:Redirect/file/${encodeURIComponent(`${getTibiaWikiBrPageTitle(displayName)}.gif`)}`;
  return getCachedRemoteImageUrl("creatures", displayName, sourceUrl);
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
  const worldSlug = slugifyWorldName(payload?.worldSlug || DEFAULT_WORLD);
  const requestedIds = Array.isArray(payload?.marketIds)
    ? [...new Set(payload.marketIds.map((id) => Number(id)).filter(Boolean))]
    : [];
  const loadAllCached = payload?.loadAllCached === true;
  const forceFresh = payload?.forceFresh === true;
  const mergeIntoWorldCache = payload?.mergeIntoWorldCache === true;

  if (requestedIds.length === 0 && !loadAllCached) {
    return {};
  }

  const worlds = await fetchWorldCatalog();
  const selectedWorld = findWorldBySlug(worlds, worldSlug);

  if (!selectedWorld) {
    throw new Error("Mundo nao encontrado na base online.");
  }

  if (loadAllCached) {
    return fetchCachedWorldMarketSnapshot(selectedWorld);
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

async function fetchCachedWorldMarketSnapshot(selectedWorld) {
  if (!isUsingCustomMarketApi()) {
    return {};
  }

  const worldName = selectedWorld?.name || DEFAULT_WORLD;
  const worldLastUpdate = selectedWorld?.last_update || null;
  const cacheKey = `market-world:${slugifyWorldName(worldName)}`;
  const cachedEntry = await getCacheEntry(cacheKey);
  const cachedValue = normalizeCachedWorldMarketValue(cachedEntry?.value);

  if (cachedValue && worldLastUpdate && cachedValue.worldLastUpdate === worldLastUpdate) {
    return cachedValue.values;
  }

  if (
    cachedValue &&
    !cachedEntry.isExpired &&
    (!worldLastUpdate || !cachedValue.worldLastUpdate || cachedValue.worldLastUpdate === worldLastUpdate)
  ) {
    return cachedValue.values;
  }

  if (cachedValue && cachedEntry.isExpired && (!worldLastUpdate || cachedValue.worldLastUpdate === worldLastUpdate)) {
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
  const worldName = selectedWorld?.name || DEFAULT_WORLD;
  const query = new URLSearchParams({
    server: worldName,
    limit: "7000"
  });
  const entries = await fetchTibiaMarketJson(`market_values?${query.toString()}`);
  const result = entriesToStashMarketMap(Array.isArray(entries) ? entries : []);

  await putCache(cacheKey, {
    worldLastUpdate: selectedWorld?.last_update || null,
    values: result
  });
  return result;
}

async function mergeIntoCachedWorldMarketSnapshot({
  selectedWorld,
  values,
  trustWorldLastUpdate = false
}) {
  if (!isUsingCustomMarketApi() || !selectedWorld?.name || !values || typeof values !== "object") {
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
    values: {
      ...(cachedValue?.values || {}),
      ...values
    }
  });
}

function normalizeCachedWorldMarketValue(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (value.values && typeof value.values === "object") {
    return {
      worldLastUpdate: value.worldLastUpdate || null,
      values: value.values
    };
  }

  return {
    worldLastUpdate: null,
    values: value
  };
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

  const entries = await Promise.all([...new Set(names)].map(async (name) => {
    const slug = slugifyTibiaItemName(name);
    const itemDetail = await resolveItemDetailBySlug(slug).catch(async () => {
      const metadataIndex = await getItemMetadataIndex();
      const itemMeta = findItemSummaryByName(metadataIndex, name);
      return itemMeta ? resolveItemDetail(itemMeta).catch(() => itemMeta) : null;
    });

    return [
      name,
      {
        slug,
        imageSrc: itemDetail ? getItemImageUrl(itemDetail) : "",
        itemName: itemDetail?.wiki_name || itemDetail?.name || name
      }
    ];
  }));

  return Object.fromEntries(entries);
}

async function fetchWorldCatalog() {
  const cacheKey = "world-data";
  const cachedEntry = await getCacheEntry(cacheKey);
  const cached = cachedEntry?.value || null;
  const isCachedExpired = Boolean(cachedEntry?.isExpired);

  if (cached) {
    if (Array.isArray(cached) && cached.some((world) => world?.last_update)) {
      if (isCachedExpired) {
        refreshCacheInBackground(cacheKey, async () => {
          const [marketWorlds, tibiaDataWorlds] = await Promise.all([
            fetchTibiaMarketJson("world_data").catch(() => fetchMarketWorldCatalogFromStatus().catch(() => [])),
            fetchTibiaDataWorldCatalog().catch(() => [])
          ]);
          const tibiaDataBySlug = Object.fromEntries(
            tibiaDataWorlds.map((entry) => [entry.slug, entry])
          );
          const baseWorlds = Array.isArray(marketWorlds) && marketWorlds.length > 0
            ? marketWorlds
            : tibiaDataWorlds;
          const worlds = Array.isArray(baseWorlds)
            ? baseWorlds
                .map((entry) => {
                  const name = entry?.name || "";
                  const slug = slugifyWorldName(name);
                  const tibiaData = tibiaDataBySlug[slug] || null;

                  return {
                    name,
                    slug,
                    last_update: entry?.last_update || null,
                    location: tibiaData?.location || null,
                    status: tibiaData?.status || null,
                    players_online: tibiaData?.players_online ?? null,
                    pvp_type: tibiaData?.pvp_type || null,
                    battleye_protected: tibiaData?.battleye_protected ?? null,
                    battleye_date: tibiaData?.battleye_date || null,
                    transfer_type: tibiaData?.transfer_type || null,
                    game_world_type: tibiaData?.game_world_type || null
                  };
                })
                .filter((entry) => entry.name && entry.slug)
                .sort((left, right) => left.name.localeCompare(right.name))
            : [];

          await putCache(cacheKey, worlds);
          return worlds;
        });
      }

      return cached;
    }

    try {
      const statusWorlds = await fetchMarketWorldCatalogFromStatus();
      const statusBySlug = Object.fromEntries(statusWorlds.map((world) => [world.slug, world]));
      const enriched = Array.isArray(cached)
        ? cached.map((world) => ({
            ...world,
            last_update: world?.last_update || statusBySlug[world?.slug]?.last_update || null
          }))
        : cached;

      if (Array.isArray(enriched) && enriched.some((world) => world?.last_update)) {
        await putCache(cacheKey, enriched);
        return enriched;
      }
    } catch (_error) {
      // Keep the existing local world catalog if the cache status endpoint is temporarily unavailable.
    }

    return cached;
  }

  const [marketWorlds, tibiaDataWorlds] = await Promise.all([
    fetchTibiaMarketJson("world_data").catch(() => fetchMarketWorldCatalogFromStatus().catch(() => [])),
    fetchTibiaDataWorldCatalog().catch(() => [])
  ]);
  const tibiaDataBySlug = Object.fromEntries(
    tibiaDataWorlds.map((entry) => [entry.slug, entry])
  );
  const baseWorlds = Array.isArray(marketWorlds) && marketWorlds.length > 0
    ? marketWorlds
    : tibiaDataWorlds;
  const worlds = Array.isArray(baseWorlds)
    ? baseWorlds
        .map((entry) => {
          const name = entry?.name || "";
          const slug = slugifyWorldName(name);
          const tibiaData = tibiaDataBySlug[slug] || null;

          return {
            name,
            slug,
            last_update: entry?.last_update || null,
            location: tibiaData?.location || null,
            status: tibiaData?.status || null,
            players_online: tibiaData?.players_online ?? null,
            pvp_type: tibiaData?.pvp_type || null,
            battleye_protected: tibiaData?.battleye_protected ?? null,
            battleye_date: tibiaData?.battleye_date || null,
            transfer_type: tibiaData?.transfer_type || null,
            game_world_type: tibiaData?.game_world_type || null
          };
        })
        .filter((entry) => entry.name && entry.slug)
        .sort((left, right) => left.name.localeCompare(right.name))
    : [];

  await putCache(cacheKey, worlds);
  return worlds;
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
  const response = await fetch(TIBIADATA_WORLDS_ENDPOINT, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Falha ao consultar mundos do TibiaData (${response.status}): ${body}`);
  }

  const data = JSON.parse(body);
  const regularWorlds = Array.isArray(data?.worlds?.regular_worlds) ? data.worlds.regular_worlds : [];
  const tournamentWorlds = Array.isArray(data?.worlds?.tournament_worlds)
    ? data.worlds.tournament_worlds
    : [];

  return [...regularWorlds, ...tournamentWorlds]
    .map((entry) => ({
      name: entry?.name || "",
      slug: slugifyWorldName(entry?.name || ""),
      location: entry?.location || null,
      status: entry?.status || null,
      players_online: toNumberOrNull(entry?.players_online),
      pvp_type: entry?.pvp_type || null,
      battleye_protected:
        typeof entry?.battleye_protected === "boolean" ? entry.battleye_protected : null,
      battleye_date: entry?.battleye_date || null,
      transfer_type: entry?.transfer_type || null,
      game_world_type: entry?.game_world_type || null
    }))
    .filter((entry) => entry.name && entry.slug);
}

async function getCharacterProfiles(payload = {}) {
  const names = Array.isArray(payload.names) ? payload.names : [];
  const uniqueNames = [...new Set(names.map((name) => String(name || "").trim()).filter(Boolean))];
  const entries = await Promise.all(
    uniqueNames.map(async (name) => {
      const key = name.toLowerCase();

      if (characterProfileCache.has(key)) {
        return [name, characterProfileCache.get(key)];
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
          characterProfileCache.set(key, profile);

          if (cachedEntry.isExpired) {
            refreshCacheInBackground(cacheKey, () => fetchFreshCharacterProfile(name, cacheKey));
          }

          return [name, profile];
        }

        const profile = await fetchFreshCharacterProfile(name, cacheKey);

        characterProfileCache.set(key, profile);
        return [name, profile];
      } catch (_error) {
        return [name, null];
      }
    })
  );

  return Object.fromEntries(entries);
}

async function fetchFreshCharacterProfile(name, cacheKey = getCharacterProfileCacheKey(name)) {
  const response = await fetch(`${TIBIADATA_CHARACTER_ENDPOINT}/${encodeURIComponent(name)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  const body = await response.text();

  if (!response.ok) {
    if (response.status === 404) {
      await putCache(cacheKey, { profile: null });
    }

    return null;
  }

  const data = JSON.parse(body);
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

  await putCache(cacheKey, { profile });
  return profile;
}

async function getFindPartySnapshot(payload = {}) {
  const worldSlug = slugifyWorldName(payload?.worldSlug || DEFAULT_WORLD);
  const worlds = await fetchWorldCatalog();
  const selectedWorld = findWorldBySlug(worlds, worldSlug);

  if (!selectedWorld?.name) {
    throw new Error("Mundo nao encontrado para o Find Party.");
  }

  const [worldData, guildNames] = await Promise.all([
    fetchFindPartyWorldData(selectedWorld.name),
    fetchFindPartyGuildNames(selectedWorld.name)
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

async function fetchFindPartyWorldData(worldName) {
  const cacheKey = `find-party-world:${slugifyWorldName(worldName)}`;
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

async function fetchFindPartyGuildNames(worldName) {
  const cacheKey = `find-party-guilds:${slugifyWorldName(worldName)}`;
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
  const gameDataHubBase = getGameDataHubBase();

  if (gameDataHubBase) {
    try {
      const response = await fetch(
        `${gameDataHubBase}/api/game/tibiadata/worlds/${encodeURIComponent(worldName)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        }
      );
      const body = await response.text();

      if (!response.ok) {
        throw new Error(`Falha ao consultar mundo do Find Party (${response.status}): ${body}`);
      }

      return JSON.parse(body)?.data?.world || null;
    } catch (_error) {
      // fallback below
    }
  }

  const payload = await fetchDirectTibiaDataWorld(worldName);
  return payload?.world || null;
}

async function fetchFindPartyGuildListPayload(worldName) {
  const gameDataHubBase = getGameDataHubBase();

  if (gameDataHubBase) {
    try {
      const response = await fetch(
        `${gameDataHubBase}/api/game/tibiadata/worlds/${encodeURIComponent(worldName)}/guilds`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        }
      );
      const body = await response.text();

      if (!response.ok) {
        throw new Error(`Falha ao consultar guildas do mundo (${response.status}): ${body}`);
      }

      return JSON.parse(body)?.data?.guilds || null;
    } catch (_error) {
      // fallback below
    }
  }

  const payload = await fetchDirectTibiaDataGuilds(worldName);
  return payload?.guilds || null;
}

async function fetchFindPartyGuildPayload(guildName) {
  const gameDataHubBase = getGameDataHubBase();

  if (gameDataHubBase) {
    try {
      const response = await fetch(
        `${gameDataHubBase}/api/game/tibiadata/guild?name=${encodeURIComponent(guildName)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        }
      );
      const body = await response.text();

      if (!response.ok) {
        throw new Error(`Falha ao consultar membros da guilda (${response.status}): ${body}`);
      }

      return JSON.parse(body)?.data?.guild || null;
    } catch (_error) {
      // fallback below
    }
  }

  const payload = await fetchDirectTibiaDataGuild(guildName);
  return payload?.guild || null;
}

function getCharacterProfileCacheKey(name) {
  return `character-profile:${String(name || "").trim().toLowerCase()}`;
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

    if (!rawItems) {
      rawItems = await loadBundledItemMetadata().catch(() => null);
    }

    if (!rawItems) {
      rawItems = await fetchTibiaWikiItemPages();
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
    const items = applyItemDroppedByOverrides(
      mergeItemSummariesWithDetails(summaryItems, detailIndex, supplementalItems),
      droppedByOverrides
    );
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

async function fetchTibiaWikiItemPages() {
  const firstPage = await fetchTibiaWikiJson(`items?page=1&pageSize=${TIBIAWIKI_DATA_PAGE_SIZE}`);
  const totalCount = Number(firstPage?.totalCount) || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / TIBIAWIKI_DATA_PAGE_SIZE));
  const pages = [firstPage];

  for (let page = 2; page <= totalPages; page += TIBIAWIKI_DATA_PAGE_BATCH_SIZE) {
    const batch = Array.from(
      { length: Math.min(TIBIAWIKI_DATA_PAGE_BATCH_SIZE, totalPages - page + 1) },
      (_entry, index) => page + index
    );

    const results = await Promise.allSettled(
      batch.map((pageNumber) =>
        fetchTibiaWikiJson(`items?page=${pageNumber}&pageSize=${TIBIAWIKI_DATA_PAGE_SIZE}`)
      )
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        pages.push(result.value);
      }
    });
  }

  return pages.flatMap((page) => (Array.isArray(page?.items) ? page.items : []));
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
    const [supplementalItems, droppedByOverrides, proficiencyItems, npcTradeItems] = await Promise.all([
      loadBundledSupplementalItemMetadata().catch(() => []),
      loadBundledItemDroppedByOverrides().catch(() => []),
      loadBundledItemProficiencyDamage().catch(() => []),
      loadBundledItemNpcTrades().catch(() => [])
    ]);
    const items = applyVerifiedItemMetadata(
      applyItemDroppedByOverrides(
        mergeNormalizedItemRecordsBySlug([
          ...detailItems.map(normalizeItemMetadata).filter(Boolean),
          ...supplementalItems
        ]),
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

  // This TibiaWiki/API page is a quest-page artifact and confuses the real currency item.
  if (item.slug === "tibia-coin-item" || wikiName === "Tibia Coin (Item)") {
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

async function fetchTibiaWikiJson(pathWithQuery, attempt = 1) {
  try {
    const response = await fetch(`${TIBIAWIKI_DATA_API_BASE}/${pathWithQuery}`, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });
    const body = await response.text();

    if (!response.ok) {
      if (shouldRetryTibiaWikiRequest(response.status, attempt)) {
        await delay(getRetryDelay(attempt));
        return fetchTibiaWikiJson(pathWithQuery, attempt + 1);
      }

      throw new Error(`Falha ao consultar TibiaWiki estruturado (${response.status}): ${body}`);
    }

    return JSON.parse(body);
  } catch (error) {
    if (attempt < TIBIAWIKI_DATA_RETRY_LIMIT) {
      await delay(getRetryDelay(attempt));
      return fetchTibiaWikiJson(pathWithQuery, attempt + 1);
    }

    throw error;
  }
}

async function resolveItemDetail(itemMeta) {
  if (!itemMeta) {
    return null;
  }

  if (itemMeta.detailLoaded && hasStructuredItemExtras(itemMeta)) {
    return itemMeta;
  }

  const cacheKey = `wiki-item:${itemMeta.slug}`;
  const cached = await getCache(cacheKey);

  if (cached && hasStructuredItemExtras(cached)) {
    return applyDroppedByOverridesToCachedItem(cached, cacheKey);
  }

  const detail = await fetchTibiaWikiJson(`items/${encodeURIComponent(itemMeta.wiki_name || itemMeta.name)}`);
  const normalized = normalizeItemMetadata({
    ...itemMeta,
    ...detail,
    detailLoaded: true
  });

  await putCache(cacheKey, normalized);
  return normalized;
}

async function resolveItemDetailBySlug(itemSlug) {
  const normalizedSlug = slugifyTibiaItemName(itemSlug);
  const cacheKey = `wiki-item:${normalizedSlug}`;
  const cached = await getCache(cacheKey);

  if (cached && hasStructuredItemExtras(cached)) {
    return applyDroppedByOverridesToCachedItem(cached, cacheKey);
  }

  const metadataIndex = await getItemMetadataIndex();
  const slugCandidates = getItemLookupSlugCandidates(normalizedSlug);
  const itemMeta = findItemSummaryBySlugCandidates(metadataIndex, slugCandidates);

  if (itemMeta?.detailLoaded && hasStructuredItemExtras(itemMeta)) {
    if (itemMeta.slug !== normalizedSlug) {
      await putCache(cacheKey, itemMeta);
    }

    return itemMeta;
  }

  for (const slugCandidate of slugCandidates) {
    try {
      const detail = await fetchTibiaWikiJson(`items/${encodeURIComponent(itemNameFromSlug(slugCandidate))}`);
      const normalized = normalizeItemMetadata({
        ...detail,
        detailLoaded: true
      });

      if (normalized) {
        await putCache(`wiki-item:${normalized.slug}`, normalized);

        if (normalized.slug !== normalizedSlug) {
          await putCache(cacheKey, normalized);
        }

        return normalized;
      }
    } catch (_error) {
      // Some loot names arrive pluralized even when the wiki page is singular.
    }
  }

  if (!itemMeta) {
    throw new Error("Item nao encontrado na base online.");
  }

  const resolved = await resolveItemDetail(itemMeta);

  if (itemMeta.slug !== normalizedSlug) {
    await putCache(cacheKey, resolved);
  }

  return resolved;
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
  const cachedEntry = bypassCache ? null : await getCacheEntry(cacheKey);

  if (cachedEntry?.value && !cachedEntry.isExpired) {
    return cachedEntry.value;
  }

  if (cachedEntry?.value && !bypassCache) {
    refreshCacheInBackground(cacheKey, () => fetchFreshMarketValues(cacheKey, query));
    return cachedEntry.value;
  }

  try {
    return await fetchFreshMarketValues(cacheKey, query);
  } catch (error) {
    if (isMarketBackoffError(error)) {
      return cachedEntry?.value || [];
    }

    throw error;
  }
}

async function fetchFreshMarketValues(cacheKey, query) {
  const entries = await fetchTibiaMarketJson(`market_values?${query.toString()}`);
  let result = normalizeMarketEntriesPayload(entries);

  if (!marketEntriesHaveMeaningfulData(result) && shouldTryPublicMarketFallback()) {
    const publicEntries = await fetchSingleMarketBaseJson(
      TIBIA_MARKET_API_BASE,
      `market_values?${query.toString()}`
    ).catch(() => null);
    const publicResult = normalizeMarketEntriesPayload(publicEntries);

    if (marketEntriesHaveMeaningfulData(publicResult)) {
      result = publicResult;
    }
  }

  await putCache(cacheKey, result);
  return result;
}

function marketEntriesHaveMeaningfulData(entries = []) {
  return normalizeMarketEntriesPayload(entries)
    .map((entry) => normalizeMarketEntry(entry))
    .some((entry) => hasMeaningfulMarketData(entry));
}

function shouldTryPublicMarketFallback() {
  const configuredBases = Array.isArray(dataServiceRuntime.marketApiBases)
    ? dataServiceRuntime.marketApiBases
    : [];

  return configuredBases
    .map((base) => String(base || "").replace(/\/+$/, ""))
    .some((base) => base && base !== TIBIA_MARKET_API_BASE);
}

async function fetchTibiaMarketJson(pathWithQuery) {
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

        const maxAttempts = candidateBases.length > 1 && base !== candidateBases[candidateBases.length - 1] ? 1 : 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          let response;
          let body = "";

          const isLastBase = base === candidateBases[candidateBases.length - 1];
          const timeoutMs = !isLastBase && candidateBases.length > 1
            ? FALLBACK_BASE_TIMEOUT_MS
            : MARKET_API_TIMEOUT_MS;

          try {
            response = await fetchWithTimeout(`${base}/${pathWithQuery}`, timeoutMs);
            body = await response.text();
          } catch (error) {
            const isLastAttempt = attempt >= maxAttempts;

            if (!isLastAttempt) {
              await delay(getMarketApiDelayMs(base) + getRetryDelay(attempt));
              continue;
            }

            lastError = new Error(
              base === TIBIA_MARKET_API_BASE
                ? `Falha ao consultar a API publica do market: ${error instanceof Error ? error.message : String(error)}`
                : `Falha ao consultar a base do market na VPS: ${error instanceof Error ? error.message : String(error)}`
            );
            break;
          }

          endpointNextRunByPath.set(baseQueueKey, Date.now() + getMarketApiDelayMs(base));

          if (response.ok) {
            return parseTibiaMarketJsonBody(body);
          }

          const isBackoffBody = Boolean(body && /External source backoff/i.test(body));
          const isRetryable = response.status === 429 || response.status >= 500 || isBackoffBody;
          const isLastAttempt = attempt >= maxAttempts;
          const isFallbackBase = base === TIBIA_MARKET_API_BASE;

          if (!isFallbackBase && (isBackoffBody || (response.status >= 500 && isLastAttempt))) {
            lastError = new Error(`Falha ao consultar a base online (${response.status}): ${body}`);
            break;
          }

          if (isRetryable && !isLastAttempt) {
            await delay(getMarketApiDelayMs(base) + getRetryDelay(attempt));
            continue;
          }

          if (response.status === 429) {
            lastError = new Error(
              base === TIBIA_MARKET_API_BASE
                ? "Limite de consultas da API atingido no momento. Aguarde um pouco e tente de novo."
                : "A base do market na VPS atingiu o limite temporario de consultas. Aguarde um pouco e tente de novo."
            );
            break;
          }

          lastError = new Error(`Falha ao consultar a base online (${response.status}): ${body}`);
          break;
        }
      }

      throw lastError || new Error("Falha ao consultar a base online.");
    });

  endpointQueueByPath.set(queueKey, nextTask.catch(() => {}));
  return nextTask;
}

async function fetchSingleMarketBaseJson(base, pathWithQuery) {
  const normalizedBase = String(base || "").replace(/\/+$/, "");
  const pathKey = pathWithQuery.split("?")[0];
  const baseQueueKey = `${normalizedBase}|${pathKey}`;
  const waitMs = Math.max(0, (endpointNextRunByPath.get(baseQueueKey) || 0) - Date.now());

  if (waitMs > 0) {
    await delay(waitMs);
  }

  const response = await fetchWithTimeout(`${normalizedBase}/${pathWithQuery}`, MARKET_API_TIMEOUT_MS);
  const body = await response.text();
  endpointNextRunByPath.set(baseQueueKey, Date.now() + getMarketApiDelayMs(normalizedBase));

  if (!response.ok) {
    throw new Error(`Falha ao consultar a API publica do market (${response.status}): ${body}`);
  }

  return parseTibiaMarketJsonBody(body);
}

function getMarketApiBases(primaryBase = getMarketApiBase()) {
  const configuredBases = Array.isArray(dataServiceRuntime.marketApiBases)
    ? dataServiceRuntime.marketApiBases
    : [];
  const bases = [
    ...configuredBases,
    primaryBase
  ].map((base) => String(base || "").replace(/\/+$/, ""));

  if (!bases.includes(TIBIA_MARKET_API_BASE)) {
    bases.push(TIBIA_MARKET_API_BASE);
  }

  return [...new Set(bases.filter(Boolean))];
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
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

function getMarketApiBase() {
  return String(dataServiceRuntime.marketApiBase || TIBIA_MARKET_API_BASE).replace(/\/+$/, "");
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

function isUsingCustomMarketApi() {
  return getMarketApiBase() !== TIBIA_MARKET_API_BASE;
}

function getMarketApiDelayMs(base = getMarketApiBase()) {
  return String(base || "").replace(/\/+$/, "") === TIBIA_MARKET_API_BASE ? API_RATE_LIMIT_MS : 120;
}

function isMarketBackoffError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /External source backoff|base online \(500\).*backoff|retryBlockedUntil/i.test(message);
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
  const [npcBuy, npcSell] = await Promise.all([
    enrichNpcListWithDetails(itemMeta.npc_buy),
    enrichNpcListWithDetails(itemMeta.npc_sell)
  ]);

  return {
    ...buildItemRecord(itemMeta),
    npc_buy: npcBuy,
    npc_sell: npcSell
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
  if (itemMeta?.image_src) {
    return itemMeta.image_src;
  }

  if (itemMeta?.assetId) {
    return getAssetImageUrl(itemMeta.assetId);
  }

  return "";
}

function getAssetImageUrl(assetId) {
  const localAssetUrl = dataServiceRuntime.getAssetUrl(`assets/data/items/sprites/${assetId}.png`);
  return dataServiceRuntime.getCachedImageUrl(
    "item-sprites",
    `asset-${assetId}-${ITEM_SPRITE_VERSION}`,
    localAssetUrl
  );
}

function getRemoteItemImageUrl(assetId) {
  const normalizedAssetId = Number(assetId);

  if (!normalizedAssetId) {
    return "";
  }

  return getCachedRemoteImageUrl(
    "items",
    `asset-${normalizedAssetId}-${ITEM_SPRITE_VERSION}`,
    `${TIBIAWIKI_DATA_API_BASE}/assets/${normalizedAssetId}`
  );
}

function getRemoteAssetImageUrl(assetId) {
  const normalizedAssetId = Number(assetId);

  if (!normalizedAssetId) {
    return "";
  }

  return getCachedRemoteImageUrl(
    "creatures",
    `asset-${normalizedAssetId}`,
    `${TIBIAWIKI_DATA_API_BASE}/assets/${normalizedAssetId}`
  );
}

function getCachedRemoteImageUrl(category, key, sourceUrl) {
  const normalizedSource = String(sourceUrl || "").trim();

  if (!normalizedSource || !/^https?:\/\//i.test(normalizedSource)) {
    return normalizedSource;
  }

  return dataServiceRuntime.getCachedImageUrl(category, key, normalizedSource);
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
        location: npcDetail?.city || npcDetail?.location || npc.location || null,
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

  const cacheKey = `npc-detail:${slugifyTibiaItemName(normalizedName)}`;
  const cached = await getCache(cacheKey);

  if (cached) {
    return cached;
  }

  const detail = await fetchTibiaWikiJson(`npcs/${encodeURIComponent(normalizedName)}`);
  const parsed = {
    name: detail?.name || normalizedName,
    city: extractNpcField(detail, "city") || extractNpcSummaryField(detail?.summary, "City"),
    location: cleanWikiText(extractNpcField(detail, "location") || extractNpcSummaryField(detail?.summary, "Location"))
  };

  await putCache(cacheKey, parsed);
  return parsed;
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
  const override = NPC_DETAIL_OVERRIDES[slugifyTibiaItemName(npcName)] || null;
  const fallbackPath = NPC_IMAGE_FALLBACKS[normalizedNpcName];

  if (fallbackPath) {
    return dataServiceRuntime.getAssetUrl(fallbackPath);
  }

  if (normalizedNpcName.includes("hireling")) {
    return dataServiceRuntime.getAssetUrl("assets/ui/Hireling_(Trader).gif");
  }

  if (normalizedNpcName.includes("wes") && normalizedNpcName.includes("blacksmith")) {
    return dataServiceRuntime.getAssetUrl("assets/ui/Wes_The_Blacksmith.gif");
  }

  const fileName = override?.imageFile || `${getTibiaWikiBrPageTitle(npcName)}.gif`;
  const sourceUrl = `https://www.tibiawiki.com.br/wiki/Special:Redirect/file/${encodeURIComponent(fileName)}`;
  return getCachedRemoteImageUrl("npcs", npcName, sourceUrl);
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

function getRetryDelay(attempt) {
  return 500 * attempt * attempt;
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

  const stored = await dataServiceRuntime.storageGet(key);
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
    key === "world-data" ||
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

  if (key === "world-data") {
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
  if (key === "world-data") {
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


