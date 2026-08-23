import {
  convertPrice,
  formatCompactNumber,
  formatIsoDateTime,
  formatRelativeTimeFromNow,
  formatNpcPrice,
  slugifyItemInput
} from "./lib/i18n/formatters.js";
import {
  closeDesktopOverlay,
  fetchBossTracker,
  fetchBoosted,
  fetchMiniWorldChanges,
  fetchBootstrap,
  fetchCreatureDetail,
  fetchCreatureIndex,
  fetchCharacterProfiles,
  fetchFindPartyGuildMembers,
  fetchFindPartySnapshot,
  fetchCurrencyRates,
  getDesktopOverlayState,
  fetchImbuementMarket,
  fetchIngredientMetadata,
  fetchItem,
  fetchItemStatic,
  fetchStashItemPreview,
  fetchItemSuggestions,
  fetchNpcDetail,
  fetchNpcIndex,
  fetchStashItems,
  fetchBooksDocuments,
  fetchStashMarketValues,
  fetchStashMarketRefreshStatus,
  reserveStashMarketRefresh,
  isDesktopOverlayApp,
  localStorageGet,
  localStorageSet,
  minimizeDesktopOverlay,
  openDesktopExternalLink,
  openDesktopScreenVisionWindow,
  notifyDesktopReadyToShow,
  setDataLocale,
  setDesktopOverlayOpacity,
  setDesktopSplashProgress,
  setDesktopSplashStatus
} from "./lib/data/runtime-api.js";
import { bootstrapRendererLocale } from "./lib/i18n/renderer-locale.js";
import { t } from "./lib/i18n/app-i18n.js";
import {
  loadPhraseTranslationMap,
  registerProtectedPhrases,
  translatePhraseSync
} from "./lib/i18n/phrase-translations.js";
import {
  ALL_IMBUEMENT_INGREDIENT_NAMES,
  IMBUEMENT_CATEGORY_LABELS,
  IMBUEMENT_CATEGORY_ORDER,
  IMBUEMENT_FEES,
  IMBUEMENTS,
  IMBUEMENTS_BY_KEY
} from "./lib/data/imbuements-data.js";
import {
  cloneOverlayToolsStateForSave,
  createDefaultOverlayToolsState,
  OVERLAY_TOOLS_STORAGE_KEY,
  normalizeOverlayToolsState
} from "./lib/overlay/overlay-tools-state.js";
import {
  createDefaultOverlayTimerDraft,
  createOverlayTimerEntryFromDraft,
  formatOverlayTimerDuration,
  getOverlayTimerSummary
} from "./lib/overlay/overlay-timers.js";
import { getFixedGridVirtualWindow } from "./lib/ui/fixed-grid-virtualization.js";
import { createCatalogFilterCache } from "./lib/ui/catalog-filter-cache.js";

const RECENT_ITEMS_KEY = "recentItems";
const LAST_WORLD_KEY = "lastWorldSlug";
const LOOT_ANALYZER_DRAFTS_KEY = "lootAnalyzerDrafts";
const LOOT_ANALYZER_DRAFTS_FALLBACK_KEY = "poioso:lootAnalyzerDrafts";
const MAX_RECENT_ITEMS = 8;
const NAVIGATION_HISTORY_LIMIT = 30;
const MONSTER_DETAIL_MEMORY_CACHE_LIMIT = 12;
const INITIAL_SPLASH_MIN_VISIBLE_MS = 900;
const STASH_GRID_FALLBACK_CELL_SIZE = 42;
const STASH_GRID_FALLBACK_GAP = 4;
// Tela maxima: 19 colunas x 13 linhas visiveis, mais uma linha antes/depois.
// Assim o DOM do Stash fica limitado a aproximadamente 19 x 15 = 285 cards.
const STASH_GRID_TARGET_RENDERED_ROWS = 15;
// Retorno de emergencia: false restaura a renderizacao integral sem mudar
// dados, ordenacao, cache ou qualquer consulta de Market.
const STASH_GRID_VIRTUALIZATION_ENABLED = true;
// Retorno de emergencia: false restaura a reabertura integral da ficha em
// cada passo do tutorial Bosstiary. O dado do Boss Tracker continua intacto.
const BOSSTIARY_TUTORIAL_REUSE_OPEN_DETAIL_ENABLED = true;
const LIBRARY_RENDER_METRIC_THROTTLE_MS = 750;
const ITEM_SUGGESTIONS_PAGE_SIZE = 60;
const ITEM_SUGGESTIONS_LOAD_AHEAD_PX = 80;
const DEFAULT_IMBUEMENT_KEY = "vampirism";
const DEFAULT_IMBUEMENT_TIER = "powerful";
// Deduplicate concurrent ingredient metadata hydration from the calculator,
// tier/picker controls, creature gear and the background warm-up.  The
// promise is intentionally separate from the Market request: local sprites
// and indexed metadata must never wait for, or restart, Market loading.
let ingredientMetadataPromise = null;
let ingredientMetadataPromiseNames = new Set();
let ingredientMetadataPromiseWorldSlug = "";
const GOLD_ICON_PATH = "assets/ui/economy/Crystal_Coin.gif";
const TIBIA_COINS_CURRENCY_ICON_PATH = "assets/data/items/sprites/5113.png";
const GOLD_TOKEN_CURRENCY_ICON_PATH = "assets/data/items/sprites/4239.png";
const TIBIA_COIN_CTA_ICON_PATH = "assets/ui/economy/Tibia_Coin_Icon.gif";
const CRYSTAL_COIN_STATIC_ICON_PATH = "assets/ui/economy/crystal-coin.webp";
const MARKET_ICON_PATH = "assets/ui/economy/The_Market_(Object).gif";
const SHRINE_ICON_PATH = "assets/ui/tools/Imbuing_Shrine.gif";
const DESKTOP_SETTINGS_DISCORD_URL = "https://discord.gg/2AFRsc2jmp";
const DESKTOP_SETTINGS_YOUTUBE_URL = "https://www.youtube.com/@poioso?sub_confirmation=1";
const DESKTOP_SETTINGS_INSTAGRAM_URL = "https://www.instagram.com/poioso_joga/";
const DESKTOP_SETTINGS_TWITCH_URL = "https://www.twitch.tv/poios0";
const DESKTOP_SETTINGS_WEBSITE_URL = "https://tibiatoolkit.com/?utm_source=tibia_toolkit_app&utm_medium=desktop&utm_campaign=settings";
const DESKTOP_SETTINGS_ASSETS = {
  discord: "assets/ui/tools/tibia-eye/settings/discord-button.png",
  youtube: "assets/ui/tools/tibia-eye/settings/youtube-button.png",
  instagram: "assets/ui/tools/tibia-eye/settings/instagram-button.png",
  twitch: "assets/ui/tools/tibia-eye/settings/twitch-button.png",
  authenticator: "assets/ui/tools/tibia-eye/settings/authenticator-button.png",
  tutorial: "assets/ui/tools/tibia-eye/settings/tutorial-button.png",
  website: "assets/ui/tools/tibia-eye/settings/website-button.png"
};
const BATTLEYE_GREEN_ICON_PATH = "assets/ui/world-status/icon_battleyeinitial.gif";
const BATTLEYE_YELLOW_ICON_PATH = "assets/ui/world-status/icon_battleye.gif";
const NPC_WES_FALLBACK_ICON_PATH = "assets/ui/npcs/Wes_The_Blacksmith.gif";
const NPC_HIRELING_FALLBACK_ICON_PATH = "assets/ui/npcs/Hireling_(Trader).gif";
const CREATURE_GEAR_RECOMMENDATIONS_DIR = "assets/data/hakai/creature-gear-recommendations";
const CREATURE_GEAR_VOCATIONS = [
  { key: "knight", label: "Knight", icon: "assets/ui/vocations/knight-male.png" },
  { key: "sorcerer", label: "Sorcerer", icon: "assets/ui/vocations/sorcerer-male.png" },
  { key: "druid", label: "Druid", icon: "assets/ui/vocations/druid-female.png" },
  { key: "paladin", label: "Paladin", icon: "assets/ui/vocations/paladin-male.png" },
  { key: "monk", label: "Monk", icon: "assets/ui/vocations/monk-male.png" }
];
const CREATURE_GEAR_WEAPON_STYLES = ["1H", "2H"];
const libraryRenderMetricAt = new Map();
const bossTrackerInFlightRequests = new Map();
const CREATURE_GEAR_WEAPON_STYLE_ICONS = {
  "1H": "assets/ui/skill-weapons/one-hand.png",
  "2H": "assets/ui/skill-weapons/two-hands.png"
};
const BOSS_CHART_ZOOM_LEVELS = [3, 5, 8, 12, 18, 26];
const BOSS_STAT_ICONS = {
  spawnToday: "assets/ui/boss-stats/spawn-today.png",
  expectedIn: "assets/ui/boss-stats/expected-in.png",
  lastSeenWorld: "assets/ui/boss-stats/last-seen-world.png",
  killedWorld: "assets/ui/boss-stats/killed-world.png",
  playersKilledWorld: "assets/ui/boss-stats/players-killed-world.png",
  killedTotal: "assets/ui/boss-stats/killed-total.png",
  playersKilledTotal: "assets/ui/boss-stats/players-killed-total.png",
  lastSeenTibia: "assets/ui/boss-stats/last-seen-tibia.png",
  firstAppearance: "assets/ui/boss-stats/first-appearance.png"
};
const CREATURE_GEAR_SLOT_ORDER = [
  "amulet",
  "helmet",
  "rune",
  "weapon",
  "armor",
  "offhand",
  "ring",
  "legs",
  "accessory",
  "armorImbuement",
  "boots",
  "offhandImbuement"
];
const VOCATION_OUTFITS = {
  druid: {
    male: "assets/ui/vocations/druid-male.png",
    female: "assets/ui/vocations/druid-female.png"
  },
  elderdruid: {
    male: "assets/ui/vocations/druid-male.png",
    female: "assets/ui/vocations/druid-female.png"
  },
  monk: {
    male: "assets/ui/vocations/monk-male.png",
    female: "assets/ui/vocations/monk-female.png"
  },
  knight: {
    male: "assets/ui/vocations/knight-male.png",
    female: "assets/ui/vocations/knight-female.png"
  },
  eliteknight: {
    male: "assets/ui/vocations/knight-male.png",
    female: "assets/ui/vocations/knight-female.png"
  },
  sorcerer: {
    male: "assets/ui/vocations/sorcerer-male.png",
    female: "assets/ui/vocations/sorcerer-female.png"
  },
  mastersorcerer: {
    male: "assets/ui/vocations/sorcerer-male.png",
    female: "assets/ui/vocations/sorcerer-female.png"
  },
  paladin: {
    male: "assets/ui/vocations/paladin-male.png",
    female: "assets/ui/vocations/paladin-female.png"
  },
  royalpaladin: {
    male: "assets/ui/vocations/paladin-male.png",
    female: "assets/ui/vocations/paladin-female.png"
  }
};
const SUPPORTER_DOCKED_PANEL_KEY = "supporters-panel";
const SUPPORTER_TIER_ORDER = ["diamond", "gold", "silver", "bronze", "iron"];
const SUPPORTER_TIER_META = {
  diamond: {
    labelKey: "screenVision.supporters.tier.diamond",
    medalPath: "assets/ui/supporters/medalha-diamante.png",
    accent: "#57d6ff",
    shadow: "rgba(87, 214, 255, 0.28)"
  },
  gold: {
    labelKey: "screenVision.supporters.tier.gold",
    medalPath: "assets/ui/supporters/medalha-ouro.png",
    accent: "#f0c14b",
    shadow: "rgba(240, 193, 75, 0.24)"
  },
  silver: {
    labelKey: "screenVision.supporters.tier.silver",
    medalPath: "assets/ui/supporters/medalha-prata.png",
    accent: "#cfd8e6",
    shadow: "rgba(207, 216, 230, 0.22)"
  },
  bronze: {
    labelKey: "screenVision.supporters.tier.bronze",
    medalPath: "assets/ui/supporters/medalha-bronze.png",
    accent: "#c98046",
    shadow: "rgba(201, 128, 70, 0.24)"
  },
  iron: {
    labelKey: "screenVision.supporters.tier.iron",
    medalPath: "assets/ui/supporters/medalha-ferro.png",
    accent: "#8c97a8",
    shadow: "rgba(140, 151, 168, 0.2)"
  },
  default: {
    labelKey: "screenVision.supporters.tier.default",
    medalPath: "assets/ui/supporters/medalha-ferro.png",
    accent: "#7f90a9",
    shadow: "rgba(127, 144, 169, 0.16)"
  }
};
const SUPPORTER_SHOWCASE_DEFAULTS = {
  normalMs: 6000,
  mediaMs: 11000,
  transitionMs: 900
};
const SUPPORTER_SHOWCASE_LIMITS = {
  normalMinMs: 2000,
  normalMaxMs: 60000,
  mediaMinMs: 4000,
  mediaMaxMs: 120000,
  transitionMinMs: 250,
  transitionMaxMs: 4000
};
const SUPPORTERS_STORAGE_CACHE_KEY = "supporters-data-cache";
const SUPPORTERS_RANKING_RATES_CACHE_KEY = "supporters-ranking-rates-cache";
const SUPPORTERS_FETCH_TIMEOUT_MS = 12000;
// Supporters are useful startup content, but never a reason to leave the
// application hidden when a remote source is slow. The request itself keeps
// running after this gate and applies its payload as soon as it settles.
const SUPPORTERS_STARTUP_BLOCK_MAX_MS = 10000;
const SUPPORTERS_RANKING_RATES_CACHE_MS = 30 * 60 * 1000;
const DEFAULT_SUPPORTER_RANKING_RATES = Object.freeze({
  usdToBrl: 5,
  tibiaCoinBrl: 0.21,
  expiresAt: 0
});
const SUPPORTER_MOCK_SEEDS = [
  {
    characterName: "Poioso",
    amountTotalCents: 25000
  },
  {
    characterName: "Poioso Curandeiro",
    amountTotalCents: 20000
  },
  {
    characterName: "Poioso Arqueiro",
    amountTotalCents: 16000
  },
  {
    characterName: "Poioso Atirador",
    amountTotalCents: 12000
  },
  {
    characterName: "Pato Donald Ninja",
    amountTotalCents: 9000
  },
  {
    characterName: "Aacen",
    amountTotalCents: 4500
  },
  {
    characterName: "Abdala Ragab",
    amountTotalCents: 3500
  },
  {
    characterName: "Abi Alowarrior",
    amountTotalCents: 2500
  },
  {
    characterName: "Adam",
    amountTotalCents: 2000
  }
];
const CREATURE_STAT_ICONS = {
  HP: "assets/ui/bestiary/Hearthp.png",
  XP: "assets/ui/bestiary/Xpbestiary.png",
  Velocidade: "assets/ui/combat-status/Haste_Icon.gif",
  Armadura: "assets/ui/bestiary/Armor_Icon.gif",
  "Mitigação": "assets/ui/combat-status/12px-Mitigation_Icon_Wheel.gif",
  Charms: "assets/ui/combat-status/Charm.gif"
};
const CREATURE_ABILITY_GROUP_ICONS = {
  velocidade: "assets/ui/combat-status/Haste_Icon.gif",
  speed: "assets/ui/combat-status/Haste_Icon.gif",
  haste: "assets/ui/combat-status/Haste_Icon.gif",
  invoca: "assets/ui/combat-status/Summon_icon.png",
  summon: "assets/ui/combat-status/Summon_icon.png",
  summons: "assets/ui/combat-status/Summon_icon.png",
  paralyze: "assets/ui/combat-status/Slowed_Icon.gif",
  debuff: "assets/ui/combat-status/Weakened_Icon.png",
  invisibilidade: "assets/ui/combat-status/Invisible_Icon.gif",
  invisibility: "assets/ui/combat-status/Invisible_Icon.gif",
  drunk: "assets/ui/combat-status/Weakened_Icon.png",
  drowning: "assets/ui/combat-status/Life_Drain_Icone.gif",
  "anti-trap": "assets/ui/Cross.png"
};
const CREATURE_DIFFICULTY_ICONS = {
  harmless: "assets/ui/bestiary/Bestiario_Inofensivo.gif",
  inofensivo: "assets/ui/bestiary/Bestiario_Inofensivo.gif",
  trivial: "assets/ui/bestiary/Bestiario_Trivial.gif",
  easy: "assets/ui/bestiary/Bestiario_Facil.gif",
  facil: "assets/ui/bestiary/Bestiario_Facil.gif",
  medium: "assets/ui/bestiary/Bestiario_Medio_(3).gif",
  medio: "assets/ui/bestiary/Bestiario_Medio_(3).gif",
  hard: "assets/ui/bestiary/Bestiario_Dificil.gif",
  dificil: "assets/ui/bestiary/Bestiario_Dificil.gif"
};
const CREATURE_OCCURRENCE_ICONS = {
  common: "assets/ui/bestiary/comum.png",
  comum: "assets/ui/bestiary/comum.png",
  uncommon: "assets/ui/bestiary/Incomum.png",
  incomum: "assets/ui/bestiary/Incomum.png",
  rare: "assets/ui/bestiary/Raro.png",
  raro: "assets/ui/bestiary/Raro.png",
  "very rare": "assets/ui/bestiary/muito_raro.png",
  "muito raro": "assets/ui/bestiary/muito_raro.png"
};
const BOSSTIARY_ICONS = {
  archfoe: "assets/ui/bestiary/Bosstiary_Archfoe.png",
  bane: "assets/ui/bestiary/Bosstiary_Bane.png",
  nemesis: "assets/ui/bestiary/Bosstiary_Nemesis.png"
};
const BOSSTIARY_TOOLTIPS = {
  archfoe: ["1 estrela: 5 mortes - 10 pontos", "2 estrelas: 20 mortes - 30 pontos", "3 estrelas: 60 mortes - 60 pontos"],
  bane: ["1 estrela: 25 mortes - 5 pontos", "2 estrelas: 100 mortes - 15 pontos", "3 estrelas: 300 mortes - 30 pontos"],
  nemesis: ["1 estrela: 1 morte - 10 pontos", "2 estrelas: 3 mortes - 30 pontos", "3 estrelas: 5 mortes - 60 pontos"]
};
const ELEMENT_ICONS = {
  Fisico: "assets/ui/combat-status/Fisico.png",
  "Físico": "assets/ui/combat-status/Fisico.png",
  Physical: "assets/ui/combat-status/Fisico.png",
  physical: "assets/ui/combat-status/Fisico.png",
  Terra: "assets/ui/combat-status/Poisoned_Icon.gif",
  Earth: "assets/ui/combat-status/Poisoned_Icon.gif",
  earth: "assets/ui/combat-status/Poisoned_Icon.gif",
  Poison: "assets/ui/combat-status/Poisoned_Icon.gif",
  Fogo: "assets/ui/combat-status/Burning_Icon.gif",
  Fire: "assets/ui/combat-status/Burning_Icon.gif",
  fire: "assets/ui/combat-status/Burning_Icon.gif",
  Morte: "assets/ui/combat-status/Cursed_Icon.gif",
  Death: "assets/ui/combat-status/Cursed_Icon.gif",
  death: "assets/ui/combat-status/Cursed_Icon.gif",
  Energia: "assets/ui/combat-status/Electrified_Icon.gif",
  Energy: "assets/ui/combat-status/Electrified_Icon.gif",
  energy: "assets/ui/combat-status/Electrified_Icon.gif",
  Sagrado: "assets/ui/combat-status/Dazzled_Icon.gif",
  Holy: "assets/ui/combat-status/Dazzled_Icon.gif",
  holy: "assets/ui/combat-status/Dazzled_Icon.gif",
  Gelo: "assets/ui/combat-status/Freezing_Icon.gif",
  Ice: "assets/ui/combat-status/Freezing_Icon.gif",
  ice: "assets/ui/combat-status/Freezing_Icon.gif",
  Cura: "assets/ui/combat-status/Heal_Icon.png",
  Healing: "assets/ui/combat-status/Heal_Icon.png",
  healing: "assets/ui/combat-status/Heal_Icon.png",
  "Life Drain": "assets/ui/combat-status/Life_Drain_Icone.gif",
  "Mana Drain": "assets/ui/combat-status/Life_Drain_Icone.gif"
};
const ELEMENT_DISPLAY_NAMES = {
  Fisico: "Físico",
  Physical: "Físico",
  physical: "Físico",
  Terra: "Earth",
  Earth: "Earth",
  earth: "Earth",
  Fogo: "Fire",
  Fire: "Fire",
  fire: "Fire",
  Morte: "Death",
  Death: "Death",
  death: "Death",
  Energia: "Energy",
  Energy: "Energy",
  energy: "Energy",
  Sagrado: "Holy",
  Holy: "Holy",
  holy: "Holy",
  Gelo: "Ice",
  Ice: "Ice",
  ice: "Ice",
  Cura: "Cura",
  Healing: "Cura",
  healing: "Cura",
  Velocidade: "Velocidade",
  Speed: "Velocidade",
  speed: "Velocidade",
  Haste: "Velocidade",
  haste: "Velocidade",
  Invoca: "Invoca",
  Summon: "Invoca",
  summon: "Invoca",
  summons: "Invoca",
  Paralyze: "Paralisa",
  paralyze: "Paralisa",
  Debuff: "Enfraquece",
  debuff: "Enfraquece",
  Invisibilidade: "Invisibilidade",
  Invisibility: "Invisibilidade",
  invisibility: "Invisibilidade",
  Drunk: "Embriaga",
  drunk: "Embriaga",
  Drowning: "Afogamento",
  drowning: "Afogamento",
  "Anti-Trap": "Anti-Trap",
  "anti-trap": "Anti-Trap",
  "Life Drain": "Life Drain",
  "Mana Drain": "Mana Drain"
};
const CREATURE_WEAKNESS_FILTERS = [
  { key: "physical", label: "FÃ­sico", iconKey: "Fisico" },
  { key: "earth", label: "Earth", iconKey: "Earth" },
  { key: "fire", label: "Fire", iconKey: "Fire" },
  { key: "death", label: "Death", iconKey: "Death" },
  { key: "energy", label: "Energy", iconKey: "Energy" },
  { key: "holy", label: "Holy", iconKey: "Holy" },
  { key: "ice", label: "Ice", iconKey: "Ice" },
  { key: "healing", label: "Cura", iconKey: "Healing" }
];
const SHORT_IMBUEMENT_CATEGORY_LABELS = {
  "aumento-skill": "Aum. de skill",
  "dano-elemental": "Dano elem.",
  "protecao-elemental": "Prot. elemt.",
  suporte: "Suporte"
};
const IMBUEMENT_TIER_LABELS = {
  basic: "Basic",
  intricate: "Intricate",
  powerful: "Powerful"
};
const IMBUEMENT_EFFECT_META = {
  "lich-shroud": { type: "protection", element: "Death", label: "Elemental de Morte" },
  "snake-skin": { type: "protection", element: "Earth", label: "Elemental de Terra" },
  "dragon-hide": { type: "protection", element: "Fire", label: "Elemental de Fogo" },
  "quara-scale": { type: "protection", element: "Ice", label: "Elemental de Gelo" },
  "cloud-fabric": { type: "protection", element: "Energy", label: "Elemental de Energia" },
  "demon-presence": { type: "protection", element: "Holy", label: "Elemental Sagrado" },
  scorch: { type: "elemental-damage", element: "Fire", label: "Dano de Fogo" },
  venom: { type: "elemental-damage", element: "Earth", label: "Dano de Terra" },
  frost: { type: "elemental-damage", element: "Ice", label: "Dano de Gelo" },
  electrify: { type: "elemental-damage", element: "Energy", label: "Dano de Energia" },
  reap: { type: "elemental-damage", element: "Death", label: "Dano de Morte" },
  precision: { type: "skill", label: "Distance Fighting" },
  epiphany: { type: "skill", label: "Magic Level" },
  chop: { type: "skill", label: "Axe Fighting" },
  slash: { type: "skill", label: "Sword Fighting" },
  bash: { type: "skill", label: "Club Fighting" },
  blockade: { type: "skill", label: "Shielding" },
  vampirism: { type: "leech", label: "vida" },
  void: { type: "leech", label: "mana" },
  strike: { type: "critical" },
  swiftness: { type: "speed" },
  featherweight: { type: "capacity" },
  vibrancy: { type: "paralysis" }
};

const SKILL_TYPES = {
  sword: { label: "Sword/Axe/Club", family: "melee", base: 50, weapon: "sword", icon: "assets/ui/tools/skill-melee.gif", unitsPerCharge: 7.2 },
  distance: { label: "Distance", family: "distance", base: 30, weapon: "bow", icon: "assets/ui/tools/skill-distance.gif", unitsPerCharge: 4.32 },
  magic: { label: "Magic Level", family: "magic", base: 1600, weapon: "rod", icon: "assets/ui/tools/skill-magic.gif", unitsPerCharge: 600 },
  shielding: { label: "Shielding", family: "shielding", base: 50, weapon: "shield", icon: "assets/ui/tools/skill-shielding.gif", unitsPerCharge: 14.4 },
  fist: { label: "Fist", family: "fist", base: 50, weapon: "wraps", icon: "assets/ui/tools/skill-fist.gif", unitsPerCharge: 7.2 }
};

const SKILL_VOCATION_FACTORS = {
  knight: { melee: 1.1, distance: 1.4, magic: 3, shielding: 1.1, fist: 1.4 },
  paladin: { melee: 1.2, distance: 1.1, magic: 1.4, shielding: 1.2, fist: 1.3 },
  sorcerer: { melee: 1.8, distance: 1.8, magic: 1.1, shielding: 1.8, fist: 1.5 },
  druid: { melee: 1.8, distance: 1.8, magic: 1.1, shielding: 1.8, fist: 1.5 },
  monk: { melee: 1.2, distance: 1.4, magic: 1.4, shielding: 1.2, fist: 1.1 }
};

const SKILL_WEAPON_TIERS = [
  { key: "lasting", label: "Lasting Weapons", prefix: "Lasting Exercise", charges: 14400, npcPrice: 10000000, storeTc: 720 },
  { key: "durable", label: "Durable Weapons", prefix: "Durable Exercise", charges: 1800, npcPrice: 1250000, storeTc: 90 },
  { key: "exercise", label: "Regular Weapons", prefix: "Exercise", charges: 500, npcPrice: 347222, storeTc: 25 }
];

const SKILL_WEAPON_IMAGE_FALLBACKS = {
  sword: "assets/ui/skill-weapons/lasting-sword.gif",
  bow: "assets/ui/skill-weapons/lasting-bow.gif",
  rod: "assets/ui/skill-weapons/lasting-rod.gif",
  shield: "assets/ui/skill-weapons/lasting-shield.gif",
  wraps: "assets/ui/skill-weapons/lasting-wraps.gif"
};

const SKILL_WEAPON_IMAGES = {
  lasting: {
    sword: "assets/ui/skill-weapons/lasting-sword.gif",
    bow: "assets/ui/skill-weapons/lasting-bow.gif",
    rod: "assets/ui/skill-weapons/lasting-rod.gif",
    shield: "assets/ui/skill-weapons/lasting-shield.gif",
    wraps: "assets/ui/skill-weapons/lasting-wraps.gif"
  },
  durable: {
    sword: "assets/ui/skill-weapons/durable-sword.gif",
    bow: "assets/ui/skill-weapons/durable-bow.gif",
    rod: "assets/ui/skill-weapons/durable-rod.gif",
    shield: "assets/ui/skill-weapons/durable-shield.gif",
    wraps: "assets/ui/skill-weapons/durable-wraps.gif"
  },
  exercise: {
    sword: "assets/ui/skill-weapons/exercise-sword.gif",
    bow: "assets/ui/skill-weapons/exercise-bow.gif",
    rod: "assets/ui/skill-weapons/exercise-rod.gif",
    shield: "assets/ui/skill-weapons/exercise-shield.gif",
    wraps: "assets/ui/skill-weapons/exercise-wraps.gif"
  }
};

const TIBIA_MAP_DATA_BASE_URL = "assets/tibia-map-data/";
const TIBIA_MAP_GROUND_FLOOR = 7;
const TIBIA_MAP_MIN_FLOOR = 0;
const TIBIA_MAP_MAX_FLOOR = 15;
const TIBIA_MAP_PIXEL_BOUNDS = {
  minX: 124 * 256,
  minY: 121 * 256,
  maxX: (133 + 1) * 256,
  maxY: (128 + 1) * 256,
  width: (133 + 1 - 124) * 256,
  height: (128 + 1 - 121) * 256
};
const LOCALE_SWITCHER_OPTIONS = [
  { code: "pt-BR", flagSrc: "assets/ui/flags/pt-BR.svg", flagAlt: "Português (Brasil)", labelKey: "locale.current.pt-BR" },
  { code: "en", flagSrc: "assets/ui/flags/en.svg", flagAlt: "English", labelKey: "locale.current.en" },
  { code: "de", flagSrc: "assets/ui/flags/de.svg", flagAlt: "Deutsch", labelKey: "locale.current.de" }
];
const inlineTibiaMapPayloads = new Map();
let inlineTibiaMapSequence = 0;

const state = {
  supporters: [],
  supporterToolbarIndex: 0,
  supporterToolbarTimer: null,
  supporterNarrowMedalIndex: 0,
  supporterNarrowMedalTimer: null,
  supporterProfilesRequestId: 0,
  supporterShowcaseSignature: "",
  supporterShowcaseTimerIds: [],
  supportersDataUrl: "",
  supportersDataUrls: [],
  supporterRankingRates: { ...DEFAULT_SUPPORTER_RANKING_RATES },
  coffeeConfig: createDefaultSupporterCoffeeConfig(),
  desktopAccountConnected: false,
  desktopAccountEntitlements: [],
  desktopAccountBenefits: [],
  desktopAccountProfile: null,
  desktopAccountSummary: { openReports: 0, unreadMessages: 0 },
  desktopReportKind: "suggestion",
  desktopReportSelectedElements: [],
  desktopReportPickerCleanup: null,
  desktopCampaignDestination: "",
  desktopSupportDestination: "",
  desktopSocialLinks: {
    discord: DESKTOP_SETTINGS_DISCORD_URL,
    youtube: DESKTOP_SETTINGS_YOUTUBE_URL,
    instagram: DESKTOP_SETTINGS_INSTAGRAM_URL,
    twitch: DESKTOP_SETTINGS_TWITCH_URL
  },
  desktopAccountLoading: false,
  desktopAccountEntitlementRefreshTimer: null,
  desktopScreenshotSettings: null,
  desktopScreenshotExpanded: false,
  desktopScreenshotCapturingHotkey: false,
  desktopScreenshotActionBusy: false,
  desktopScreenshotDiscoveryState: "searching",
  desktopScreenshotAvailabilityPromise: null,
  desktopScreenshotAvailabilityRequestId: 0,
  desktopScreenshotTibiaOpen: false,
  desktopScreenshotSourceAvailable: false,
  desktopScreenshotNeedsSelection: false,
  desktopScreenshotNeedsTibia: false,
  desktopScreenshotSourceDirectory: "",
  desktopScreenshotNewCount: 0,
  desktopScreenshotStatus: "",
  requestedDockedPanelKey: "",
  desktopDockedPanelReturnKey: "",
  dockedToolPanelState: {
    open: false,
    panelKey: "",
    side: "right",
    phase: "closed",
    width: 0
  },
  worlds: [],
  quickPicks: [],
  recentItems: [],
  selectedSection: "item-prices",
  itemCurrencyMode: "gold",
  imbuementCurrencyMode: "gold",
  currentItem: null,
  currentWorldSlug: "antica",
  currentImbuementKey: DEFAULT_IMBUEMENT_KEY,
  currentImbuementTier: DEFAULT_IMBUEMENT_TIER,
  currencyRates: {
    tibiaCoinPrice: null,
    goldTokenPrice: null
  },
  currencyRatesRequestId: 0,
  currencyRatesLoading: false,
  currencyRatesLastAttemptAt: 0,
  activeToolLiveDataTimer: null,
  currencyIconMap: {
    gold: GOLD_ICON_PATH,
    tc: GOLD_ICON_PATH,
    gt: GOLD_ICON_PATH
  },
  imbuementMarket: null,
  imbuementRates: {
    tibiaCoinPrice: null,
    goldTokenPrice: null,
    goldTokenBuyPrice: null
  },
  manualGoldTokenEnabled: false,
  manualGoldTokenPrice: null,
  mixedPurchaseEnabled: false,
  imbuementIncludeShrineFee: false,
  imbuementMarketPriceMode: "sell",
  imbuementIngredientValueModeByName: {},
  ownedIngredientQuantities: {},
  manualIngredientPrices: {},
  ingredientMetaByName: {},
  imbuementPickerOpen: false,
  imbuementLoading: {
    active: false,
    message: "",
    progress: 0
  },
  imbuementLoadingTimer: null,
  imbuementRequestId: 0,
  imbuementRequestInFlightWorldSlug: null,
  imbuementMetadataWarmupStarted: false,
  npcTab: "buy",
  itemSuggestions: [],
  itemSuggestionsOpen: false,
  itemSuggestionsShowAll: false,
  itemSuggestionsHasMore: false,
  itemSuggestionsLoadingMore: false,
  activeItemSuggestionIndex: -1,
  selectedItemSuggestion: null,
  itemSuggestionRequestId: 0,
  itemSearchRequestId: 0,
  itemSearchLoadingRequestId: 0,
  itemSearchGlobalLoadingRequestId: 0,
  itemCacheWarmupTimer: null,
  itemCacheWarmupRequestId: 0,
  tutorialPreloadPromise: null,
  tutorialPreloadReady: false,
  tutorialItemSuggestions: [],
  itemViewMode: "list",
  spells: { loaded: false, records: [], query: "", sort: "name-asc", vocations: new Set(["knight", "paladin", "druid", "sorcerer", "monk"]), categories: new Set(["ataque", "suporte"]), wheelOnly: false },
  booksDocuments: {
    query: "",
    location: "",
    library: "",
    author: "",
    sort: "name-asc",
    page: 1,
    pageSize: 60,
    listing: null,
    detail: null,
    loading: false,
    requestId: 0,
    searchTimer: null
  },
  overlayTools: createDefaultOverlayToolsState(),
  stashItems: [],
  stashItemBySlug: new Map(),
  stashCategories: [],
  stashTraders: [],
  stashMarketById: {},
  stashMarketRevision: 0,
  stashFilteredItemsCache: [],
  stashFilteredItemsCacheSignature: "",
  stashFilteredItemsCacheSource: null,
  stashLoaded: false,
  stashLoadPromise: null,
  stashLoadingMarket: false,
  stashQuery: "",
  stashWeeklyOnly: false,
  stashCategory: "",
  stashTrader: "",
  stashSort: "name-asc",
  stashValueMode: "npc",
  stashMarketTimer: null,
  stashMarketRequestId: 0,
  stashMarketLoadedSignature: "",
  stashMarketFreshIds: {},
  stashMarketBackgroundTimer: null,
  stashMarketBackgroundRequestId: 0,
  stashMarketBackgroundLoading: false,
  stashMarketBackgroundPreferSnapshot: false,
  stashWorldMarketLoadedSlug: "",
  stashWorldMarketLoading: false,
  stashMarketRefreshCooldownDeadline: 0,
  stashMarketRefreshCooldownTimer: null,
  stashMarketRefreshWarningTimer: null,
  stashMarketRefreshSyncing: false,
  stashPreviewRequestId: 0,
  lastPreviewedStashSlug: null,
  stashPreviewVisible: false,
  stashRenderSignature: "",
  stashVirtualRenderFrame: null,
  localeRefreshRequestId: 0,
  phraseTranslationMap: {},
  entityViewMode: "npcs",
  npcIndex: [],
  npcCities: [],
  npcJobs: [],
  npcQuery: "",
  npcCatalogLimit: 60,
  npcCatalogFilterCache: createCatalogFilterCache(),
  npcCity: "",
  npcJob: "",
  npcTrade: "",
  npcLoaded: false,
  npcDetailRequestId: 0,
  monsterIndex: [],
  monsterCategories: [],
  monsterClasses: [],
  monsterTypes: [],
  monsterQuery: "",
  monsterCatalogLimit: 60,
  monsterCatalogFilterCache: createCatalogFilterCache(),
  monsterCategory: "",
  monsterClass: "",
  monsterType: "",
  monsterWeaknessFilter: "",
  weaknessDropdownOpen: false,
  creatureWeaknessIndex: null,
  creatureWeaknessIndexLoading: false,
  creatureWeaknessIndexPromise: null,
  bossQuery: "",
  bossCatalogLimit: 60,
  bossCatalogFilterCache: createCatalogFilterCache(),
  bossFilters: {
    bane: true,
    archfoe: true,
    nemesis: true
  },
  monstersLoaded: false,
  monsterDetailRequestId: 0,
  currentMonsterDetail: null,
  monsterDetailMemoryCache: new Map(),
  currentBossTracker: null,
  bossProbabilityChartMode: "days",
  bossProbabilityChartZoom: 2,
  bossRespawnHistoryLimit: 10,
  creatureGearRecommendations: {},
  creatureGearRecommendationPromises: {},
  creatureGearRecommendationMissingSlugs: new Set(),
  creatureGearEntry: null,
  creatureGearVocation: "knight",
  creatureGearWeaponStyle: "1H",
  monsterCategoriesCollapsed: false,
  miniWorldChangesCatalog: [],
  miniWorldChangesActiveWorld: null,
  miniWorldChangesActiveError: "",
  miniWorldChangesLoaded: false,
  miniWorldChangesLoading: false,
  miniWorldChangesRequestId: 0,
  miniWorldChangesRefreshCooldownUntil: 0,
  miniWorldChangesRefreshTimer: null,
  boostedStatus: {
    creature: null,
    boss: null,
    loading: false,
    requestId: 0
  },
  currentMiniWorldChangeId: "",
  currentNavigationEntry: null,
  navigationBackStack: [],
  navigationForwardStack: [],
  navigationRestoring: false,
  timerEditingId: null,
  timerFilter: "all",
  timerRuntime: {
    activeById: {},
    tickHandle: null
  },
  mapWindow: {
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0
  },
  itemWorldSuggestions: [],
  itemWorldSuggestionsOpen: false,
  activeItemWorldSuggestionIndex: -1,
  globalWorldSuggestions: [],
  globalWorldSuggestionsOpen: false,
  activeGlobalWorldSuggestionIndex: -1,
  toolWorldSuggestions: [],
  toolWorldSuggestionsOpen: false,
  activeToolWorldSuggestionIndex: -1,
  lootWorldSuggestions: [],
  lootWorldSuggestionsOpen: false,
  activeLootWorldSuggestionIndex: -1,
  selectedToolTab: "imbuement",
  findPartyVocation: "",
  findPartyPlayers: [],
  findPartyWorldName: "",
  findPartyLoadedWorldSlug: "",
  findPartyLoading: false,
  findPartyFeedbackMessage: "",
  findPartyFeedbackIsError: false,
  findPartyRequestId: 0,
  findPartyCharacterName: "",
  findPartyCharacterProfile: null,
  findPartyCharacterLookupTimer: null,
  findPartyCharacterLookupRequestId: 0,
  findPartyGuilds: [],
  findPartyGuildQuery: "",
  findPartyGuildSuggestions: [],
  findPartyGuildSuggestionsOpen: false,
  activeFindPartyGuildSuggestionIndex: -1,
  findPartySelectedGuilds: [],
  findPartyBlockedGuildMemberNames: [],
  findPartyGuildMembersByName: {},
  findPartyGuildMemberRequestId: 0,
  findPartyPage: 1,
  findPartyPageSize: 10,
  findPartySortMode: "level",
  findPartySortDirection: "desc",
  skillCalculator: {
    type: "sword",
    vocation: "knight",
    current: 80,
    target: 90,
    remainingPercent: 100,
    loyaltyPoints: 0,
    useDummy: true,
    useDouble: false,
    metadataByName: {}
  },
  lootMode: "party",
  lootAnalyzerText: "",
  lootPartyAnalyzerText: "",
  lootSoloAnalyzerText: "",
  lootSoloCharacterName: "",
  lootSoloProfile: null,
  lootSoloUseMarket: false,
  lootSoloDoubleXp: false,
  lootSoloDoubleLoot: false,
  lootSoloMarketLoading: false,
  lootSoloMarketRefreshRequestId: 0,
  lootParsed: null,
  lootManualPrices: {},
  lootHelpOpen: false,
  lootProfileRequestId: 0,
  lootItemHydrationRequestId: 0,
  lootMonsterHydrationRequestId: 0,
  lootProfilesLoading: false,
  initialSplashStartedAt: 0,
  initialSplashProgress: 0,
  globalLoadingAction: null,
  globalLoadingCount: 0,
  appUpdate: { phase: "idle", info: null },
  appUpdateRequestPending: false,
  libraryContent: { phase: "idle", pendingChanges: 0, error: null },
  libraryContentNeedsViewRefresh: false,
  libraryContentActivationPending: false,
  localeController: null
};

const els = {
  appShell: document.querySelector(".app-shell"),
  mainContent: document.querySelector(".main-content"),
  desktopToolbar: document.querySelector("#desktop-toolbar"),
  desktopToolbarBrand: document.querySelector("#desktop-toolbar-brand"),
  desktopUpdateButton: document.querySelector("#desktop-update-button"),
  desktopLibraryContentUpdateButton: document.querySelector("#desktop-library-content-update-button"),
  appVersionMicro: document.querySelector("#app-version-micro"),
  desktopOpacityInput: document.querySelector("#desktop-opacity-input"),
  desktopOpacityValue: document.querySelector("#desktop-opacity-value"),
  historyBackButton: document.querySelector("#history-back-button"),
  historyForwardButton: document.querySelector("#history-forward-button"),
  desktopSupportersSlot: document.querySelector("#desktop-supporters-slot"),
  desktopSupportersButton: document.querySelector("#desktop-supporters-button"),
  desktopSupportersActiveMedal: document.querySelector("#desktop-supporters-active-medal"),
  desktopSupportersMarquee: document.querySelector("#desktop-supporters-marquee"),
  desktopSupportersMarqueeTrack: document.querySelector("#desktop-supporters-marquee-track"),
  localeSwitcher: document.querySelector("#locale-switcher"),
  localeSwitcherButton: document.querySelector("#locale-switcher-button"),
  localeSwitcherFlag: document.querySelector("#locale-switcher-flag"),
  localeSwitcherLabel: document.querySelector("#locale-switcher-label"),
  localeSwitcherMenu: document.querySelector("#locale-switcher-menu"),
  apiDocsButton: document.querySelector("#api-docs-button"),
  desktopAuthenticatorButton: document.querySelector("#desktop-authenticator-button"),
  desktopCoffeeButton: document.querySelector("#desktop-coffee-button"),
  desktopTibiaCoinsButton: document.querySelector("#desktop-tibia-coins-button"),
  desktopMinimizeButton: document.querySelector("#desktop-minimize-button"),
  desktopCloseButton: document.querySelector("#desktop-close-button"),
  desktopSettingsButton: document.querySelector("#desktop-settings-button"),
  desktopDockedPanel: document.querySelector("#desktop-docked-panel"),
  desktopDockedPanelTitle: document.querySelector("#desktop-docked-panel-title"),
  desktopDockedPanelDescription: document.querySelector("#desktop-docked-panel-description"),
  desktopDockedPanelContent: document.querySelector("#desktop-docked-panel-content"),
  desktopDockedPanelClose: document.querySelector("#desktop-docked-panel-close"),
  connectionStatus: document.querySelector("#connection-status"),
  feedback: document.querySelector("#item-feedback"),
  panelItemHeader: document.querySelector("#panel-item-prices .panel-header"),
  controlsCard: document.querySelector("#panel-item-prices .controls-card"),
  shortcutsCard: document.querySelector("#panel-item-prices .shortcuts-card"),
  itemForm: document.querySelector("#item-search-form"),
  itemInput: document.querySelector("#item-slug-input"),
  itemDropdownButton: document.querySelector("#item-dropdown-button"),
  itemDropdownLoadingIndicator: document.querySelector(".item-dropdown-loading-indicator"),
  itemSuggestions: document.querySelector("#item-suggestions"),
  globalWorldInput: document.querySelector("#global-world-input"),
  globalWorldDropdownButton: document.querySelector("#global-world-dropdown-button"),
  globalWorldSuggestions: document.querySelector("#global-world-suggestions"),
  desktopWorldStatus: document.querySelector("#desktop-world-status"),
  desktopBoostedCreature: document.querySelector("#desktop-boosted-creature"),
  desktopBoostedCreatureImage: document.querySelector("#desktop-boosted-creature-image"),
  desktopBoostedBoss: document.querySelector("#desktop-boosted-boss"),
  desktopBoostedBossImage: document.querySelector("#desktop-boosted-boss-image"),
  desktopYasirPodium: document.querySelector("#desktop-yasir-podium"),
  desktopYasirImage: document.querySelector("#desktop-yasir-image"),
  itemViewTabs: document.querySelectorAll(".item-view-tab"),
  itemListView: document.querySelector("#item-list-view"),
  itemStashView: document.querySelector("#item-stash-view"),
  itemBooksView: document.querySelector("#item-books-view"),
  itemSpellsView: document.querySelector("#item-spells-view"),
  itemDetailView: null,
  booksSearchInput: document.querySelector("#books-search-input"),
  booksClearSearch: document.querySelector("#books-clear-search"),
  booksSortFilter: document.querySelector("#books-sort-filter"),
  booksLocationFilter: document.querySelector("#books-location-filter"),
  booksLibraryFilter: document.querySelector("#books-library-filter"),
  booksAuthorFilter: document.querySelector("#books-author-filter"),
  booksGrid: document.querySelector("#books-grid"),
  booksStatus: document.querySelector("#books-status"),
  booksPagination: document.querySelector("#books-pagination"),
  booksDetail: document.querySelector("#books-detail"),
  spellsSearchInput: document.querySelector("#spells-search-input"),
  spellsSortFilter: document.querySelector("#spells-sort-filter"),
  spellsStatus: document.querySelector("#spells-status"),
  spellsGrid: document.querySelector("#spells-grid"),
  spellsDetail: document.querySelector("#spells-detail"),
  spellVocationFilters: document.querySelectorAll("[data-spell-vocation]"),
  spellCategoryFilters: document.querySelectorAll("[data-spell-category]"),
  spellWheelFilter: document.querySelector("[data-spell-wheel]"),
  spellFilterLabels: document.querySelectorAll("[data-spell-filter-label]"),
  stashSearchInput: document.querySelector("#stash-search-input"),
  stashClearSearch: document.querySelector("#stash-clear-search"),
  stashWeeklyFilter: document.querySelector("#stash-weekly-filter"),
  stashCategoryFilter: document.querySelector("#stash-category-filter"),
  stashTraderFilter: document.querySelector("#stash-trader-filter"),
  stashSortFilter: document.querySelector("#stash-sort-filter"),
  stashGrid: document.querySelector("#stash-grid"),
  stashValueButtons: document.querySelectorAll("#stash-value-switch [data-stash-value-mode]"),
  stashMarketRefreshButton: document.querySelector("#stash-market-refresh-button"),
  stashMarketRefreshWarning: document.querySelector("#stash-market-refresh-warning"),
  stashStatus: document.querySelector("#stash-status"),
  npcsStatus: document.querySelector("#npcs-status"),
  entityTabs: document.querySelectorAll("[data-entity-view]"),
  npcBrowser: document.querySelector("#npc-browser"),
  monsterBrowser: document.querySelector("#monster-browser"),
  bossBrowser: document.querySelector("#boss-browser"),
  npcSearchInput: document.querySelector("#npc-search-input"),
  npcCityFilter: document.querySelector("#npc-city-filter"),
  npcJobFilter: document.querySelector("#npc-job-filter"),
  npcTradeFilter: document.querySelector("#npc-trade-filter"),
  npcListPanel: document.querySelector("#npc-list-panel"),
  monsterSearchInput: document.querySelector("#monster-search-input"),
  bossSearchInput: document.querySelector("#boss-search-input"),
  bossFilterInputs: document.querySelectorAll("[data-boss-filter]"),
  monsterCategoryToggle: document.querySelector("#monster-category-toggle"),
  monsterCategoryGrid: document.querySelector("#monster-category-grid"),
  monsterClassFilter: document.querySelector("#monster-class-filter"),
  monsterTypeFilter: document.querySelector("#monster-type-filter"),
  monsterWeaknessFilter: document.querySelector("#monster-weakness-filter"),
  bossWeaknessFilter: document.querySelector("#boss-weakness-filter"),
  monsterListPanel: document.querySelector("#monster-list-panel"),
  bossListPanel: document.querySelector("#boss-list-panel"),
  entityDetailEmpty: document.querySelector("#entity-detail-empty"),
  entityDetailContent: document.querySelector("#entity-detail-content"),
  mapModal: document.querySelector("#map-modal"),
  mapModalCard: document.querySelector("#map-modal-card"),
  mapModalHeader: document.querySelector("#map-modal-header"),
  mapModalTitle: document.querySelector("#map-modal-title"),
  mapModalFrame: document.querySelector("#map-modal-frame"),
  mapModalClose: document.querySelector("#map-modal-close"),
  miniWorldChangesOverview: document.querySelector("#mini-world-changes-overview"),
  miniWorldChangesToday: document.querySelector("#mini-world-changes-today"),
  miniWorldChangesRefreshButton: document.querySelector("#mini-world-changes-refresh-button"),
  miniWorldChangesRefreshCountdown: document.querySelector("#mini-world-changes-refresh-countdown"),
  findPartyRefreshButton: document.querySelector("#find-party-refresh-button"),
  miniWorldChangesActive: document.querySelector("#mini-world-changes-active"),
  miniWorldChangesCount: document.querySelector("#mini-world-changes-count"),
  miniWorldChangesCatalog: document.querySelector("#mini-world-changes-catalog"),
  miniWorldChangeDetail: document.querySelector("#mini-world-change-detail"),
  miniWorldChangeDetailTitle: document.querySelector("#mini-world-change-detail-title"),
  miniWorldChangeDetailContent: document.querySelector("#mini-world-change-detail-content"),
  miniWorldChangeActiveBadge: document.querySelector("#mini-world-change-active-badge"),
  miniWorldChangeBack: document.querySelector("#mini-world-change-back"),
  miniWorldChangeOpenNpc: document.querySelector("#mini-world-change-open-npc"),
  miniWorldChangeOpenWiki: document.querySelector("#mini-world-change-open-wiki"),
  miniWorldChangeImageViewer: document.querySelector("#mini-world-change-image-viewer"),
  miniWorldChangeImageViewerTitle: document.querySelector("#mini-world-change-image-viewer-title"),
  miniWorldChangeImageViewerImage: document.querySelector("#mini-world-change-image-viewer-image"),
  miniWorldChangeImageViewerCaption: document.querySelector("#mini-world-change-image-viewer-caption"),
  miniWorldChangeImageViewerClose: document.querySelector("#mini-world-change-image-viewer-close"),
  worldInput: document.querySelector("#world-input"),
  worldDropdownButton: document.querySelector("#world-dropdown-button"),
  worldSuggestions: document.querySelector("#world-suggestions"),
  toolWorldInput: document.querySelector("#tool-world-input"),
  toolWorldDropdownButton: document.querySelector("#tool-world-dropdown-button"),
  toolWorldSuggestions: document.querySelector("#tool-world-suggestions"),
  lootWorldInput: document.querySelector("#loot-world-input"),
  lootWorldDropdownButton: document.querySelector("#loot-world-dropdown-button"),
  lootWorldSuggestions: document.querySelector("#loot-world-suggestions"),
  toolTabs: document.querySelectorAll("[data-tool-tab]"),
  toolSubnavs: document.querySelectorAll("[data-tool-subnav]"),
  toolPanels: document.querySelectorAll("[data-tool-panel]"),
  wheelOfDestinyFrame: document.querySelector("#wheel-of-destiny-frame"),
  findPartyStatusBadge: document.querySelector("#find-party-status-badge"),
  findPartyVocationSelect: document.querySelector("#find-party-vocation-select"),
  findPartyVocationButtons: document.querySelectorAll(".find-party-vocation-button"),
  findPartyCharacterInput: document.querySelector("#find-party-character-input"),
  findPartyGuildControl: document.querySelector("#find-party-guild-control"),
  findPartyGuildChips: document.querySelector("#find-party-guild-chips"),
  findPartyGuildInput: document.querySelector("#find-party-guild-input"),
  findPartyGuildDropdownButton: document.querySelector("#find-party-guild-dropdown-button"),
  findPartyGuildSuggestions: document.querySelector("#find-party-guild-suggestions"),
  findPartyClearButton: document.querySelector("#find-party-clear-button"),
  findPartyLevelRange: document.querySelector("#find-party-level-range"),
  findPartyFeedback: document.querySelector("#find-party-feedback"),
  findPartyResultsSummary: document.querySelector("#find-party-results-summary"),
  findPartyResults: document.querySelector("#find-party-results"),
  findPartySortNameButton: document.querySelector("#find-party-sort-name-button"),
  findPartySortLevelButton: document.querySelector("#find-party-sort-level-button"),
  findPartyPrevPageButton: document.querySelector("#find-party-prev-page-button"),
  findPartyNextPageButton: document.querySelector("#find-party-next-page-button"),
  findPartyPageIndicator: document.querySelector("#find-party-page-indicator"),
  findPartyPageSizeSelect: document.querySelector("#find-party-page-size-select"),
  timerStatusBadge: document.querySelector("#timer-status-badge"),
  timerFormTitle: document.querySelector("#timer-form-title"),
  timerNameInput: document.querySelector("#timer-name-input"),
  timerDurationInput: document.querySelector("#timer-duration-input"),
  timerVolumeInput: document.querySelector("#timer-volume-input"),
  timerSoundSelect: document.querySelector("#timer-sound-select"),
  timerVisualAlertToggle: document.querySelector("#timer-visual-alert-toggle"),
  timerRepeatToggle: document.querySelector("#timer-repeat-toggle"),
  timerFeedback: document.querySelector("#timer-feedback"),
  timerSaveButton: document.querySelector("#timer-save-button"),
  timerResetButton: document.querySelector("#timer-reset-button"),
  timerPreviewButton: document.querySelector("#timer-preview-button"),
  timerFilterTabs: document.querySelectorAll("[data-timer-filter]"),
  timerList: document.querySelector("#timer-list"),
  lootSubtabs: document.querySelectorAll("[data-loot-mode]"),
  lootHelpToggle: document.querySelector("#loot-help-toggle"),
  lootHelpPanel: document.querySelector("#loot-help-panel"),
  lootModePanel: document.querySelector("#loot-mode-panel"),
  lootAutoModeToggle: document.querySelector("#loot-auto-mode-toggle"),
  lootDoubleXpToggle: document.querySelector("#loot-double-xp-toggle"),
  lootDoubleLootToggle: document.querySelector("#loot-double-loot-toggle"),
  lootModeToggleLabel: document.querySelector("#loot-mode-toggle-label"),
  lootModeToggleHelp: document.querySelector("#loot-mode-toggle-help"),
  lootSoloControlsRow: document.querySelector("#loot-solo-controls-row"),
  lootResetButton: document.querySelector("#loot-reset-button"),
  lootCharacterField: document.querySelector("#loot-character-field"),
  lootCharacterInput: document.querySelector("#loot-character-input"),
  lootInputLabel: document.querySelector("#loot-input-label"),
  lootInput: document.querySelector("#loot-input"),
  lootFeedback: document.querySelector("#loot-feedback"),
  lootSessionSummary: document.querySelector("#loot-session-summary"),
  lootPlayerGrid: document.querySelector("#loot-player-grid"),
  lootMonstersCard: document.querySelector("#loot-monsters-card"),
  lootMonstersGrid: document.querySelector("#loot-monsters-grid"),
  lootItemsCard: document.querySelector("#loot-items-card"),
  lootItemsGrid: document.querySelector("#loot-items-grid"),
  lootOutputCard: document.querySelector("#loot-output-card"),
  lootOutputSubtitle: document.querySelector("#loot-output-subtitle"),
  lootOutput: document.querySelector("#loot-output"),
  globalLoadingOverlay: document.querySelector("#global-loading-overlay"),
  globalLoadingText: document.querySelector("#global-loading-text"),
  globalLoadingProgress: document.querySelector("#global-loading-progress"),
  globalLoadingStatus: document.querySelector("#global-loading-status"),
  globalLoadingActionButton: document.querySelector("#global-loading-action-button"),
  itemCurrencyButtons: document.querySelectorAll("#item-currency-switch .currency-button"),
  imbuementCurrencyButtons: document.querySelectorAll("#imbuement-currency-switch .currency-button"),
  imbuementTierButtons: document.querySelectorAll("#imbuement-tier-switch .currency-button"),
  manualTokenToggle: document.querySelector("#manual-token-toggle"),
  manualTokenInput: document.querySelector("#manual-token-input"),
  manualTokenPanel: document.querySelector("#manual-token-panel"),
  ingredientTokenPanel: document.querySelector("#ingredient-token-panel"),
  imbuementMixedRoutePanel: document.querySelector("#imbuement-mixed-route-panel"),
  imbuementPickerTrigger: document.querySelector("#imbuement-picker-trigger"),
  imbuementPickerTriggerIcon: document.querySelector("#imbuement-picker-trigger-icon"),
  imbuementPickerTriggerName: document.querySelector("#imbuement-picker-trigger-name"),
  imbuementPickerTriggerDescription: document.querySelector("#imbuement-picker-trigger-description"),
  imbuementPickerTriggerCaret: document.querySelector("#imbuement-picker-trigger-caret"),
  imbuementPickerPanel: document.querySelector("#imbuement-picker-panel"),
  imbuementPickerGrid: document.querySelector("#imbuement-picker-grid"),
  imbuementFeedback: document.querySelector("#imbuement-feedback"),
  imbuementStatusBadge: document.querySelector("#imbuement-status-badge"),
  imbuementLoading: document.querySelector("#imbuement-loading"),
  imbuementLoadingFill: document.querySelector("#imbuement-loading-fill"),
  imbuementLoadingText: document.querySelector("#imbuement-loading-text"),
  imbuementIcon: document.querySelector("#imbuement-icon"),
  imbuementName: document.querySelector("#imbuement-name"),
  imbuementDescription: document.querySelector("#imbuement-description"),
  imbuementEffectChip: document.querySelector("#imbuement-effect-chip"),
  imbuementEffectDescription: document.querySelector("#imbuement-effect-description"),
  imbuementUpdatedChip: document.querySelector("#imbuement-updated-chip"),
  imbuementMarketCardIcon: document.querySelector("#imbuement-market-card-icon"),
  imbuementFeeCardIcon: document.querySelector("#imbuement-fee-card-icon"),
  imbuementGrandCardIcon: document.querySelector("#imbuement-grand-card-icon"),
  imbuementTokenCardIcon: document.querySelector("#imbuement-token-card-icon"),
  imbuementMarketTotal: document.querySelector("#imbuement-market-total"),
  imbuementFeeTotal: document.querySelector("#imbuement-fee-total"),
  imbuementGrandTotal: document.querySelector("#imbuement-grand-total"),
  imbuementGrandBreakdown: document.querySelector("#imbuement-grand-breakdown"),
  imbuementTokenTotal: document.querySelector("#imbuement-token-total"),
  imbuementTokenBreakdown: document.querySelector("#imbuement-token-breakdown"),
  imbuementRecommendation: document.querySelector("#imbuement-recommendation"),
  imbuementRouteNote: document.querySelector("#imbuement-route-note"),
  imbuementIngredients: document.querySelector("#imbuement-ingredients"),
  skillTypeSelect: document.querySelector("#skill-type-select"),
  skillChoiceButtons: document.querySelectorAll(".skill-choice-button"),
  skillVocationButtons: document.querySelectorAll(".skill-vocation-button"),
  skillBonusButtons: document.querySelectorAll(".skill-bonus-button"),
  skillVocationSelect: document.querySelector("#skill-vocation-select"),
  skillCurrentInput: document.querySelector("#skill-current-input"),
  skillTargetInput: document.querySelector("#skill-target-input"),
  skillRemainingRange: document.querySelector("#skill-remaining-range"),
  skillRemainingInput: document.querySelector("#skill-remaining-input"),
  skillLoyaltyRange: document.querySelector("#skill-loyalty-range"),
  skillLoyaltyInput: document.querySelector("#skill-loyalty-input"),
  skillLoyaltyBonus: document.querySelector("#skill-loyalty-bonus"),
  skillDummyToggle: document.querySelector("#skill-dummy-toggle"),
  skillDoubleToggle: document.querySelector("#skill-double-toggle"),
  skillPreviewIcon: document.querySelector("#skill-preview-icon"),
  skillPreviewTitle: document.querySelector("#skill-preview-title"),
  skillSummaryGrid: document.querySelector("#skill-summary-grid"),
  skillResultsGrid: document.querySelector("#skill-results-grid"),
  navButtons: document.querySelectorAll(".nav-button"),
  navSections: document.querySelector("#main-nav-sections"),
  navScrollButtons: document.querySelectorAll("[data-nav-scroll]"),
  panels: {
    "item-prices": document.querySelector("#panel-item-prices"),
    tools: document.querySelector("#panel-tools"),
    npcs: document.querySelector("#panel-npcs"),
    "mini-world-changes": document.querySelector("#panel-mini-world-changes")
  },
  itemSummaryEmpty: document.querySelector("#item-summary-empty"),
  itemSummaryContent: document.querySelector("#item-summary-content"),
  itemImage: document.querySelector("#item-image"),
  itemCategory: document.querySelector("#item-category"),
  itemName: document.querySelector("#item-name"),
  itemTechnicalDescription: document.querySelector("#item-technical-description"),
  itemDescription: document.querySelector("#item-description"),
  itemDroppedBy: document.querySelector("#item-dropped-by"),
  itemDetails: document.querySelector("#item-details"),
  itemFood: document.querySelector("#item-food"),
  itemProficiency: document.querySelector("#item-proficiency"),
  itemDamageTable: document.querySelector("#item-damage-table"),
  itemLocation: document.querySelector("#item-location"),
  itemNotes: document.querySelector("#item-notes"),
  itemTables: document.querySelector("#item-tables"),
  itemOpenWiki: document.querySelector("#item-open-wiki"),
  itemStoreNote: document.querySelector("#item-store-note"),
  itemMarketDisabledNote: document.querySelector("#item-market-disabled-note"),
  itemPriceSpotlightGrid: document.querySelector("#item-price-spotlight-grid"),
  itemLowestSell: document.querySelector("#item-lowest-sell"),
  itemHighestBuy: document.querySelector("#item-highest-buy"),
  itemSellRecommendation: document.querySelector("#item-sell-recommendation"),
  itemMarketStatGrid: document.querySelector("#item-market-stat-grid"),
  itemCurrentPrice: document.querySelector("#item-current-price"),
  itemMonthSell: document.querySelector("#item-month-sell"),
  itemMonthBuy: document.querySelector("#item-month-buy"),
  itemAvailability: document.querySelector("#item-availability"),
  itemMarketNote: document.querySelector("#item-market-note"),
  itemMarketChips: document.querySelector("#item-market-chips"),
  itemDemandChip: document.querySelector("#item-demand-chip"),
  itemStatusChip: document.querySelector("#item-status-chip"),
  itemTcChip: document.querySelector("#item-tc-chip"),
  itemUpdatedChip: document.querySelector("#item-updated-chip"),
  npcTabButtons: document.querySelectorAll("#npc-tabs .mini-tab"),
  itemMarketCard: document.querySelector("#item-market-card"),
  marketMetrics: document.querySelector("#market-metrics"),
  marketEmpty: document.querySelector("#market-empty"),
  npcCard: document.querySelector(".npc-card"),
  npcBuyList: document.querySelector("#npc-buy-list"),
  npcSellList: document.querySelector("#npc-sell-list"),
  relatedItems: document.querySelector("#related-items"),
  quickPicks: document.querySelector("#quick-picks"),
  recentItems: document.querySelector("#recent-items"),
  currencyIcons: document.querySelectorAll(".currency-icon")
};

boot();

async function boot() {
  const bootStartedAt = performance.now();
  const markBootStage = (stage) => {
    console.info(`[startup] ${stage} +${Math.round(performance.now() - bootStartedAt)}ms`);
  };

  markBootStage("renderer-boot-start");
  await applyDesktopMode();
  markBootStage("desktop-mode-ready");
  initializeSupporterState();
  state.localeController = await bootstrapRendererLocale({
    root: document.body,
    onChanged(locale) {
      updateLocaleSwitcher();
      renderDesktopUpdateUi();
      syncWheelOfDestinyLocale(locale);
      void refreshLocaleSensitiveContent(locale);
    }
  });
  markBootStage("renderer-locale-ready");
  await setDataLocale(state.localeController.getLocale()).catch(() => {});
  state.phraseTranslationMap = await loadPhraseTranslationMap(state.localeController.getLocale()).catch(() => ({}));
  markBootStage("phrase-map-ready");
  renderLocaleSwitcher();
  renderSupporterToolbar();
  normalizeStaticLabels();
  normalizeStaticLabelsDeep();
  markBootStage("static-ui-ready");
  positionItemViewLayout();
  bindEvents();
  bindTemporaryUiPerformanceDiagnostics();
  markBootStage("event-bindings-ready");
  if (isDesktopOverlayApp()) {
    // Restore the encrypted device session before the first settings/account
    // panel can be rendered.  Previously this ran in the background, so the
    // panel could retain the old LOGIN image even when the stored session was
    // valid a moment later.
    await refreshDesktopAccountState();
  }
  markBootStage("account-state-ready");
  void initializeDesktopUpdateUi();
  void initializeLibraryContentUi();
  bindImbuementPickerResize();
  renderImbuementOptions();
  syncManualTokenState();
  syncCurrencyButtons(els.imbuementTierButtons, state.currentImbuementTier, "tier");
  renderImbuementLoading();
  markBootStage("critical-bindings-ready");

  showInitialSplash(0);
  try {
    updateInitialSplashProgress(4);
    const bootstrap = await runInitialSplashTask(4, 30, () => fetchBootstrap());
    markBootStage("bootstrap-data-ready");
    state.worlds = bootstrap.worlds || [];
    registerProtectedPhrases(state.worlds);
    state.quickPicks = bootstrap.quickPicks || [];
    state.supportersDataUrls = normalizeSupportersDataUrls(
      bootstrap.supportersDataUrls,
      bootstrap.supportersDataUrl
    );
    state.supportersDataUrl = state.supportersDataUrls[0] || "";
    const supportersLoadStartedAt = performance.now();
    const supportersLoadPromise = loadSupportersData({
      supportersDataUrls: state.supportersDataUrls
    }).catch((error) => {
      console.warn("[startup] supporters-load-failed", error);
    });
    state.recentItems = await runInitialSplashTask(30, 36, () => loadRecentItems());
    await runInitialSplashTask(36, 40, () => loadLootAnalyzerDrafts());
    await runInitialSplashTask(40, 44, () => loadOverlayToolsState());
    const storedWorldSlug = await runInitialSplashTask(44, 48, () => loadLastWorldSlug());
    const anticaWorld = state.worlds.find((world) => world.slug === "antica");
    state.currentWorldSlug =
      storedWorldSlug && state.worlds.some((world) => world.slug === storedWorldSlug)
        ? storedWorldSlug
        : anticaWorld?.slug || bootstrap.defaultWorld || state.currentWorldSlug;

    runInitialSplashTask(48, 56, () => {
      hydrateWorldInputs();
      renderQuickPicks();
      renderRecentItems();
    });
    updateInitialSplashProgress(74);
    await runInitialSplashTask(74, 82, () => renderCurrencyIcons());
    markBootStage("currency-icons-ready");
    els.connectionStatus.textContent = bootstrap.initialItem?.selectedWorld?.name || bootstrap.defaultWorld || "-";

    if (bootstrap.initialItem) {
      state.currentItem = bootstrap.initialItem;
      state.selectedItemSuggestion = {
        slug: bootstrap.initialItem.item.slug,
        name: bootstrap.initialItem.item.wiki_name || bootstrap.initialItem.item.name,
        category: bootstrap.initialItem.item.category || "Sem categoria",
        imageSrc: bootstrap.initialItem.item.image_src || ""
      };
      els.itemInput.value = state.selectedItemSuggestion.name;
      await runInitialSplashTask(82, 88, () => refreshCurrencyRates());
      runInitialSplashTask(88, 92, () => renderItem());
      setCurrentNavigationEntry({
        type: "item",
        slug: bootstrap.initialItem.item.slug,
        name: bootstrap.initialItem.item.wiki_name || bootstrap.initialItem.item.name,
        category: bootstrap.initialItem.item.category || "Sem categoria",
        imageSrc: bootstrap.initialItem.item.image_src || ""
      });

      if (bootstrap.initialItem?.selectedWorld?.name !== getSelectedWorld()?.name) {
        await runInitialSplashTask(92, 97, () => handleItemSearch(true));
      }
    } else {
      els.itemInput.value = "";
      updateInitialSplashProgress(92);
    }

    const supportersReadyBeforeOpening = await runInitialSplashTask(92, 97, () => (
      waitForStartupTaskDeadline(
        supportersLoadPromise,
        supportersLoadStartedAt,
        SUPPORTERS_STARTUP_BLOCK_MAX_MS
      )
    ));
    markBootStage(supportersReadyBeforeOpening ? "supporters-ready" : "supporters-deferred");
    await runInitialSplashTask(97, 98, () => saveLastWorldSlug(state.currentWorldSlug));
    runInitialSplashTask(98, 99, () => {
      // Startup stays local-first. Live data is requested by the surface that
      // actually needs it (item, Stash Market, tools or Mini World Changes).
      void loadToolbarWorldStatus();
    });
    updateInitialSplashProgress(100);
    markBootStage("renderer-boot-complete");
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : "Não foi possível carregar o app.",
      true
    );
    setImbuementFeedback(t("tools.imbuementLoadFailed"), true);
    els.connectionStatus.textContent = "Falha";
  } finally {
    hideInitialSplash();
    exposeTutorialApi();
  }
}

async function initializeDesktopUpdateUi() {
  if (!isDesktopOverlayApp()) {
    return;
  }

  const version = await window.desktopApi?.app?.getVersion?.().catch(() => "");
  if (version && els.appVersionMicro) {
    els.appVersionMicro.textContent = `v${version}`;
    const tooltip = `BETA ${version}`;
    els.appVersionMicro.dataset.tooltip = tooltip;
    els.appVersionMicro.setAttribute("aria-label", tooltip);
  }

  const applyState = (nextState) => {
    state.appUpdate = nextState && typeof nextState === "object"
      ? nextState
      : { phase: "idle", info: null };
    renderDesktopUpdateUi();
  };

  const currentState = await window.desktopApi?.updater?.getState?.().catch(() => null);
  applyState(currentState);
  window.desktopApi?.updater?.onChanged?.(applyState);
}

function renderDesktopUpdateUi() {
  const phase = String(state.appUpdate?.phase || "idle");
  const showUpdate = phase === "available" || phase === "prompting" || phase === "downloading" || phase === "downloaded";
  const tooltip = phase === "available"
    ? t("updater.availableTooltip")
    : phase === "prompting"
      ? t("updater.availableTooltip")
    : phase === "downloading"
      ? t("updater.downloadNow")
      : phase === "downloaded"
        ? t("updater.downloadedTitle")
        : "";

  els.desktopToolbarBrand?.classList.toggle("has-update", showUpdate);
  if (els.desktopUpdateButton) {
    els.desktopUpdateButton.hidden = !showUpdate;
    els.desktopUpdateButton.disabled = phase !== "available" || state.appUpdateRequestPending;
    els.desktopUpdateButton.dataset.tooltip = tooltip;
    els.desktopUpdateButton.setAttribute("aria-label", tooltip || "Tibia Toolkit");
  }
}

async function initializeLibraryContentUi() {
  if (!isDesktopOverlayApp()) return;
  const applyState = (nextState) => {
    state.libraryContent = nextState && typeof nextState === "object"
      ? nextState
      : { phase: "idle", pendingChanges: 0, error: null };
    renderLibraryContentUpdateUi();
  };
  applyState(await window.desktopApi?.libraryContent?.getState?.().catch(() => null));
  window.desktopApi?.libraryContent?.onChanged?.(applyState);
}

function renderLibraryContentUpdateUi() {
  const phase = String(state.libraryContent?.phase || "idle");
  const pendingChanges = Math.max(0, Number(state.libraryContent?.pendingChanges) || 0);
  const ready = phase === "ready" && pendingChanges > 0;
  const tooltip = ready
    ? t("libraryContent.readyTooltip", { count: pendingChanges })
    : phase === "checking"
      ? t("libraryContent.checking")
      : phase === "activating"
        ? t("libraryContent.activating")
        : "";
  if (els.desktopLibraryContentUpdateButton) {
    els.desktopLibraryContentUpdateButton.hidden = !ready;
    els.desktopLibraryContentUpdateButton.disabled = state.libraryContentActivationPending;
    els.desktopLibraryContentUpdateButton.dataset.tooltip = tooltip;
    els.desktopLibraryContentUpdateButton.setAttribute("aria-label", tooltip || "Tibia Toolkit");
  }
}

async function activateLibraryContentAtSafePoint() {
  if (!isDesktopOverlayApp() || state.libraryContentActivationPending || state.libraryContent?.phase !== "ready") {
    return false;
  }
  state.libraryContentActivationPending = true;
  renderLibraryContentUpdateUi();
  try {
    const nextState = await window.desktopApi?.libraryContent?.activate?.();
    if (nextState && typeof nextState === "object") state.libraryContent = nextState;
    invalidateLibraryViewsAfterContentActivation();
    void refreshLibraryViewAfterContentActivation();
    return true;
  } catch {
    return false;
  } finally {
    state.libraryContentActivationPending = false;
    renderLibraryContentUpdateUi();
  }
}

function invalidateLibraryViewsAfterContentActivation() {
  // The new snapshot is now active in the main process. Keep the current DOM
  // stable, but make every Library entry point obtain fresh data next time it
  // is opened instead of showing a mixed old/new catalogue.
  state.npcLoaded = false;
  state.monstersLoaded = false;
  state.npcIndex = [];
  state.monsterIndex = [];
  state.npcCities = [];
  state.npcJobs = [];
  state.monsterCategories = [];
  state.monsterClasses = [];
  state.monsterTypes = [];
  state.booksDocuments.listing = null;
  state.booksDocuments.detail = null;
  state.stashLoaded = false;
  state.stashItems = [];
  state.stashItemBySlug = new Map();
  state.libraryContentNeedsViewRefresh = true;
}

async function refreshLibraryViewAfterContentActivation() {
  if (!state.libraryContentNeedsViewRefresh) return;
  state.libraryContentNeedsViewRefresh = false;

  if (state.selectedSection === "npcs") {
    await ensureActiveEntityCatalogLoaded().catch(() => {});
    return;
  }

  if (state.selectedSection !== "item-prices") return;

  if (state.itemViewMode === "books") {
    await loadBooksDocuments().catch(() => {});
    return;
  }

  if (state.itemViewMode === "stash") {
    await ensureStashLoaded().then(() => {
      renderStashFilters();
      renderStashGrid();
    }).catch(() => {});
    return;
  }

  if (state.itemViewMode === "list") {
    state.itemSuggestions = [];
    state.selectedItemSuggestion = null;
    closeItemSuggestions();
    if (state.currentItem && els.itemInput?.value.trim()) {
      await handleItemSearch(true).catch(() => {});
    }
  }
}

function exposeTutorialApi() {
  window.TibiaToolsTutorialApi = {
    switchSection(section) {
      switchSection(section);
    },
    async setItemViewMode(mode, options = {}) {
      await setItemViewMode(mode, options);
    },
    async typeItemSearch(value, options = {}) {
      const text = String(value || "");
      els.itemInput.value = text;
      state.selectedItemSuggestion = null;
      state.itemSuggestions = [];
      state.itemSuggestionsOpen = false;
      if (
        !options.showAll &&
        slugifyItemInput(text) === "plate-armor" &&
        state.tutorialItemSuggestions.length > 0
      ) {
        state.itemSuggestions = [...state.tutorialItemSuggestions];
        state.activeItemSuggestionIndex = 0;
        state.itemSuggestionsOpen = true;
        renderItemSuggestions();
        return;
      }
      await updateItemSuggestions({ showAll: Boolean(options.showAll) });
    },
    async selectItemByName(name) {
      const wantedName = slugifyItemInput(name || "");
      let suggestion =
        state.itemSuggestions.find((entry) => slugifyItemInput(entry.name || "") === wantedName) ||
        state.itemSuggestions.find((entry) => slugifyItemInput(entry.name || "").includes(wantedName)) ||
        state.tutorialItemSuggestions.find((entry) => slugifyItemInput(entry.name || "") === wantedName) ||
        state.tutorialItemSuggestions.find((entry) => slugifyItemInput(entry.name || "").includes(wantedName));

      if (!suggestion) {
        els.itemInput.value = String(name || "");
        await updateItemSuggestions({ showAll: false });
        suggestion =
          state.itemSuggestions.find((entry) => slugifyItemInput(entry.name || "") === wantedName) ||
          state.itemSuggestions[0];
      }

      if (suggestion) {
        await selectItemSuggestion(suggestion);
      }
    },
    setStashSort(value) {
      if (!els.stashSortFilter) {
        return;
      }
      els.stashSortFilter.value = value;
      els.stashSortFilter.dispatchEvent(new Event("change", { bubbles: true }));
    },
    setStashQuery(value) {
      if (!els.stashSearchInput) {
        return;
      }
      state.stashQuery = String(value || "").trim();
      els.stashSearchInput.value = state.stashQuery;
      renderStashGrid();
      scheduleStashMarketLoad();
    },
    setStashCategory(value) {
      if (!els.stashCategoryFilter) {
        return;
      }
      els.stashCategoryFilter.value = value || "";
      els.stashCategoryFilter.dispatchEvent(new Event("change", { bubbles: true }));
    },
    setStashTrader(value) {
      if (!els.stashTraderFilter) {
        return;
      }
      els.stashTraderFilter.value = value || "";
      els.stashTraderFilter.dispatchEvent(new Event("change", { bubbles: true }));
    },
    setStashValueMode(value) {
      const button = document.querySelector(`#stash-value-switch [data-stash-value-mode="${CSS.escape(value)}"]`);
      button?.click();
    },
    openNpcPriceTab(value) {
      const button = document.querySelector(`#npc-tabs [data-npc-tab="${CSS.escape(value)}"]`);
      button?.click();
    },
    setToolTab(tab) {
      setToolTab(tab, { skipHistory: true });
    },
    getSupportersTutorialState() {
      return {
        carouselActive: state.supporters.some((supporter) => Boolean(String(supporter?.name || "").trim())),
        coffeeVisible: shouldShowDesktopCoffeeButton()
      };
    },
    async openSupportersTutorialPanel() {
      if (state.dockedToolPanelState.open && state.dockedToolPanelState.panelKey === SUPPORTER_DOCKED_PANEL_KEY) {
        return;
      }
      await requestDesktopDockedPanel(SUPPORTER_DOCKED_PANEL_KEY);
    },
    getImbuementTourState() {
      return {
        selectedToolTab: state.selectedToolTab,
        currentImbuementTier: state.currentImbuementTier,
        imbuementCurrencyMode: state.imbuementCurrencyMode,
        imbuementPickerOpen: state.imbuementPickerOpen,
        mixedPurchaseEnabled: state.mixedPurchaseEnabled,
        imbuementIncludeShrineFee: state.imbuementIncludeShrineFee,
        imbuementMarketPriceMode: state.imbuementMarketPriceMode,
        manualIngredientPrices: JSON.parse(JSON.stringify(state.manualIngredientPrices || {}))
      };
    },
    configureImbuementTour(options = {}) {
      if (options.toolTab) {
        setToolTab(options.toolTab, { skipHistory: true });
      }
      if (options.tier) {
        state.currentImbuementTier = options.tier;
      }
      if (options.currency) {
        state.imbuementCurrencyMode = options.currency;
      }
      if (typeof options.pickerOpen === "boolean") {
        state.imbuementPickerOpen = options.pickerOpen;
      }
      if (typeof options.mixedPurchaseEnabled === "boolean") {
        state.mixedPurchaseEnabled = options.mixedPurchaseEnabled;
      }
      if (typeof options.includeShrineFee === "boolean") {
        state.imbuementIncludeShrineFee = options.includeShrineFee;
      }
      if (options.marketPriceMode) {
        state.imbuementMarketPriceMode = options.marketPriceMode;
      }
      if (typeof options.manualIngredientsEnabled === "boolean") {
        state.manualIngredientPrices = Object.fromEntries(
          getCurrentIngredients().map((ingredient) => [
            ingredient.name,
            {
              ...(state.manualIngredientPrices[ingredient.name] || {}),
              enabled: options.manualIngredientsEnabled
            }
          ])
        );
      }

      syncCurrencyButtons(els.imbuementTierButtons, state.currentImbuementTier, "tier");
      syncCurrencyButtons(els.imbuementCurrencyButtons, state.imbuementCurrencyMode);
      renderImbuementOptions();
      renderImbuement();
      renderImbuementPickerState();
    },
    restoreImbuementTourState(snapshot) {
      if (!snapshot) {
        return;
      }

      state.currentImbuementTier = snapshot.currentImbuementTier || DEFAULT_IMBUEMENT_TIER;
      state.imbuementCurrencyMode = snapshot.imbuementCurrencyMode || "gold";
      state.imbuementPickerOpen = Boolean(snapshot.imbuementPickerOpen);
      state.mixedPurchaseEnabled = Boolean(snapshot.mixedPurchaseEnabled);
      state.imbuementIncludeShrineFee = Boolean(snapshot.imbuementIncludeShrineFee);
      state.imbuementMarketPriceMode = snapshot.imbuementMarketPriceMode === "buy" ? "buy" : "sell";
      state.manualIngredientPrices = JSON.parse(JSON.stringify(snapshot.manualIngredientPrices || {}));
      setToolTab(snapshot.selectedToolTab || "imbuement", { skipHistory: true });
      syncCurrencyButtons(els.imbuementTierButtons, state.currentImbuementTier, "tier");
      syncCurrencyButtons(els.imbuementCurrencyButtons, state.imbuementCurrencyMode);
      renderImbuementOptions();
      renderImbuement();
      renderImbuementPickerState();
    },
    getLootAnalyzerTourState() {
      return {
        selectedToolTab: state.selectedToolTab,
        lootMode: state.lootMode,
        partyText: state.lootPartyAnalyzerText,
        soloText: state.lootSoloAnalyzerText,
        soloCharacterName: state.lootSoloCharacterName,
        soloUseMarket: state.lootSoloUseMarket,
        soloDoubleXp: state.lootSoloDoubleXp,
        soloDoubleLoot: state.lootSoloDoubleLoot
      };
    },
    configureLootAnalyzerTour(options = {}) {
      setToolTab("loot-splitter", { skipHistory: true });
      const nextMode = options.mode === "solo" ? "solo" : "party";
      const hasText = typeof options.text === "string";
      const nextText = hasText ? options.text : null;
      const currentTextForNextMode = nextMode === "solo"
        ? state.lootSoloAnalyzerText
        : state.lootPartyAnalyzerText;
      const modeChanged = state.lootMode !== nextMode;
      const textChanged = hasText && nextText !== currentTextForNextMode;

      if (typeof options.characterName === "string") {
        state.lootSoloCharacterName = options.characterName.trim();
        if (els.lootCharacterInput) {
          els.lootCharacterInput.value = state.lootSoloCharacterName;
        }
      }

      // O tutorial passa por vários passos da mesma ferramenta. Reconfigurar
      // o mesmo modo limpava a análise e disparava novamente perfil,
      // criaturas e todos os itens, mesmo quando o passo apenas destacava
      // outro controle. Ao trocar de modo, grave o texto antes para que
      // setLootMode faça uma única análise do estado final.
      if (modeChanged) {
        if (hasText) {
          if (nextMode === "solo") {
            state.lootSoloAnalyzerText = nextText;
          } else {
            state.lootPartyAnalyzerText = nextText;
          }
        }
        setLootMode(nextMode);
      } else if (textChanged) {
        setActiveLootAnalyzerText(nextText);
        if (els.lootInput) {
          els.lootInput.value = nextText;
        }
        // Cancela visualmente qualquer hidratação anterior antes de iniciar
        // a nova análise. As requisições já enviadas podem terminar na rede,
        // mas não podem redesenhar o tutorial atual.
        state.lootProfileRequestId += 1;
        state.lootItemHydrationRequestId += 1;
        state.lootMonsterHydrationRequestId += 1;
        parseAndRenderLootSplitter();
      }

    },
    async prepareSoloAnalyzerEventsTutorial() {
      document.body.classList.add("tt-solo-events-tutorial");
      await new Promise((resolve) => window.requestAnimationFrame(resolve));

      const firstSwitch = document.querySelector("#loot-double-xp-toggle");
      const secondSwitch = document.querySelector("#loot-double-loot-toggle");
      const firstSwitchLabel = firstSwitch?.closest("label");
      const secondSwitchLabel = secondSwitch?.closest("label");
      if (!firstSwitchLabel || !secondSwitchLabel) {
        return;
      }

      firstSwitchLabel.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      firstSwitchLabel.classList.add("tt-tutorial-demo-hover");
      secondSwitchLabel.classList.add("tt-tutorial-demo-hover");

      const firstRect = firstSwitchLabel.getBoundingClientRect();
      const secondRect = secondSwitchLabel.getBoundingClientRect();
      const focus = document.createElement("div");
      focus.id = "tt-solo-events-focus";
      focus.setAttribute("aria-hidden", "true");
      focus.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:-1",
        `left:${Math.min(firstRect.left, secondRect.left)}px`,
        `top:${Math.min(firstRect.top, secondRect.top)}px`,
        `width:${Math.max(firstRect.right, secondRect.right) - Math.min(firstRect.left, secondRect.left)}px`,
        `height:${Math.max(firstRect.bottom, secondRect.bottom) - Math.min(firstRect.top, secondRect.top)}px`
      ].join(";");
      document.querySelector("#tt-solo-events-focus")?.remove();
      document.body.appendChild(focus);
    },
    restoreLootAnalyzerTourState(snapshot, options = {}) {
      if (!snapshot) {
        return;
      }

      state.lootProfileRequestId += 1;
      state.lootItemHydrationRequestId += 1;
      state.lootMonsterHydrationRequestId += 1;
      state.lootPartyAnalyzerText = String(snapshot.partyText || "");
      state.lootSoloAnalyzerText = String(snapshot.soloText || "");
      state.lootSoloCharacterName = String(snapshot.soloCharacterName || "");
      state.lootSoloUseMarket = Boolean(snapshot.soloUseMarket);
      state.lootSoloDoubleXp = Boolean(snapshot.soloDoubleXp);
      state.lootSoloDoubleLoot = Boolean(snapshot.soloDoubleLoot);
      setToolTab("loot-splitter", { skipHistory: true });
      setLootMode(options.endMode === "solo" ? "solo" : "party");
    },
    getFindPartyTourState() {
      return {
        selectedToolTab: state.selectedToolTab,
        vocation: state.findPartyVocation,
        players: JSON.parse(JSON.stringify(state.findPartyPlayers || [])),
        worldName: state.findPartyWorldName,
        loadedWorldSlug: state.findPartyLoadedWorldSlug,
        feedbackMessage: state.findPartyFeedbackMessage,
        feedbackIsError: state.findPartyFeedbackIsError,
        characterName: state.findPartyCharacterName,
        characterProfile: JSON.parse(JSON.stringify(state.findPartyCharacterProfile || null)),
        guilds: [...state.findPartyGuilds],
        guildQuery: state.findPartyGuildQuery,
        selectedGuilds: [...state.findPartySelectedGuilds],
        blockedGuildMemberNames: [...state.findPartyBlockedGuildMemberNames],
        guildMembersByName: JSON.parse(JSON.stringify(state.findPartyGuildMembersByName || {})),
        page: state.findPartyPage,
        pageSize: state.findPartyPageSize,
        sortMode: state.findPartySortMode,
        sortDirection: state.findPartySortDirection
      };
    },
    configureFindPartyTour(options = {}) {
      setToolTab("find-party", { skipHistory: true });

      if (state.findPartyCharacterLookupTimer) {
        window.clearTimeout(state.findPartyCharacterLookupTimer);
        state.findPartyCharacterLookupTimer = null;
      }

      state.findPartyRequestId += 1;
      state.findPartyCharacterLookupRequestId += 1;
      state.findPartyGuildMemberRequestId += 1;
      state.findPartyLoading = false;

      const hasDemoDruid = state.findPartyPlayers.some(
        (player) => normalizeFindPartyVocationKey(player?.vocation) === "druid"
      );
      if (!hasDemoDruid || state.findPartyGuilds.length < 2) {
        const fallback = createFindPartyTutorialFallback();
        state.findPartyPlayers = fallback.players;
        state.findPartyGuilds = fallback.guilds;
        state.findPartyWorldName = getSelectedWorld()?.name || "Antica";
        state.findPartyLoadedWorldSlug = getSelectedWorld()?.slug || "antica";
      }

      if (typeof options.vocation === "string") {
        state.findPartyVocation = options.vocation;
      }
      if (typeof options.characterName === "string") {
        state.findPartyCharacterName = options.characterName.trim();
        state.findPartyCharacterProfile = state.findPartyCharacterName
          ? {
              name: state.findPartyCharacterName,
              level: 500,
              world: state.findPartyWorldName || getSelectedWorld()?.name || "",
              vocation: "Elite Knight"
            }
          : null;
      }
      if (options.selectFirstGuilds) {
        state.findPartySelectedGuilds = state.findPartyGuilds.slice(0, 2);
        state.findPartyBlockedGuildMemberNames = [];
        state.findPartyGuildMembersByName = {};
      }
      if (options.sortMode) {
        state.findPartySortMode = options.sortMode === "name" ? "name" : "level";
        state.findPartySortDirection = options.sortDirection === "asc" ? "asc" : "desc";
      }

      state.findPartyGuildQuery = "";
      closeFindPartyGuildSuggestions();
      setFindPartyFeedback("");
      state.findPartyPage = 1;
      renderFindParty();
    },
    restoreFindPartyTourState(snapshot) {
      if (!snapshot) {
        return;
      }

      if (state.findPartyCharacterLookupTimer) {
        window.clearTimeout(state.findPartyCharacterLookupTimer);
        state.findPartyCharacterLookupTimer = null;
      }

      state.findPartyRequestId += 1;
      state.findPartyCharacterLookupRequestId += 1;
      state.findPartyGuildMemberRequestId += 1;
      state.findPartyLoading = false;
      state.findPartyVocation = snapshot.vocation || "";
      state.findPartyPlayers = JSON.parse(JSON.stringify(snapshot.players || []));
      state.findPartyWorldName = snapshot.worldName || "";
      state.findPartyLoadedWorldSlug = snapshot.loadedWorldSlug || "";
      setFindPartyFeedback(snapshot.feedbackMessage || "", Boolean(snapshot.feedbackIsError));
      state.findPartyCharacterName = snapshot.characterName || "";
      state.findPartyCharacterProfile = JSON.parse(JSON.stringify(snapshot.characterProfile || null));
      state.findPartyGuilds = [...(snapshot.guilds || [])];
      state.findPartyGuildQuery = snapshot.guildQuery || "";
      state.findPartySelectedGuilds = [...(snapshot.selectedGuilds || [])];
      state.findPartyBlockedGuildMemberNames = [...(snapshot.blockedGuildMemberNames || [])];
      state.findPartyGuildMembersByName = JSON.parse(JSON.stringify(snapshot.guildMembersByName || {}));
      state.findPartyPage = Number(snapshot.page) || 1;
      state.findPartyPageSize = Number(snapshot.pageSize) || 10;
      state.findPartySortMode = snapshot.sortMode === "name" ? "name" : "level";
      state.findPartySortDirection = snapshot.sortDirection === "asc" ? "asc" : "desc";
      closeFindPartyGuildSuggestions();
      setToolTab("find-party", { skipHistory: true });
      renderFindParty();
    },
    getSkillCalculatorTourState() {
      return {
        type: state.skillCalculator.type,
        vocation: state.skillCalculator.vocation,
        current: state.skillCalculator.current,
        target: state.skillCalculator.target,
        remainingPercent: state.skillCalculator.remainingPercent,
        loyaltyPoints: state.skillCalculator.loyaltyPoints,
        useDummy: state.skillCalculator.useDummy,
        useDouble: state.skillCalculator.useDouble
      };
    },
    configureSkillCalculatorTour(options = {}) {
      setToolTab("skill-calculator", { skipHistory: true });
      const calculator = state.skillCalculator;
      if (options.type && SKILL_TYPES[options.type]) calculator.type = options.type;
      if (options.vocation && SKILL_VOCATION_FACTORS[options.vocation]) calculator.vocation = options.vocation;
      if (Number.isFinite(Number(options.current))) calculator.current = clampInteger(options.current, 0, 200, calculator.current);
      if (Number.isFinite(Number(options.target))) calculator.target = clampInteger(options.target, calculator.current + 1, 220, calculator.target);
      if (Number.isFinite(Number(options.remainingPercent))) calculator.remainingPercent = clampDecimal(options.remainingPercent, 0, 100, calculator.remainingPercent);
      if (Number.isFinite(Number(options.loyaltyPoints))) calculator.loyaltyPoints = clampInteger(options.loyaltyPoints, 0, 3600, calculator.loyaltyPoints);
      if (typeof options.useDummy === "boolean") calculator.useDummy = options.useDummy;
      if (typeof options.useDouble === "boolean") calculator.useDouble = options.useDouble;
      syncSkillCalculatorInputs();
      renderSkillCalculator();
    },
    restoreSkillCalculatorTourState(snapshot) {
      if (!snapshot) {
        return;
      }

      Object.assign(state.skillCalculator, {
        type: SKILL_TYPES[snapshot.type] ? snapshot.type : "sword",
        vocation: SKILL_VOCATION_FACTORS[snapshot.vocation] ? snapshot.vocation : "knight",
        current: clampInteger(snapshot.current, 0, 200, 80),
        target: clampInteger(snapshot.target, 1, 220, 90),
        remainingPercent: clampDecimal(snapshot.remainingPercent, 0, 100, 100),
        loyaltyPoints: clampInteger(snapshot.loyaltyPoints, 0, 3600, 0),
        useDummy: Boolean(snapshot.useDummy),
        useDouble: Boolean(snapshot.useDouble)
      });
      state.skillCalculator.target = Math.max(state.skillCalculator.current + 1, state.skillCalculator.target);
      setToolTab("skill-calculator", { skipHistory: true });
      syncSkillCalculatorInputs();
      renderSkillCalculator();
    },
    getNpcCatalogTourState() {
      return {
        selectedSection: state.selectedSection,
        entityViewMode: state.entityViewMode,
        npcQuery: state.npcQuery,
        npcCity: state.npcCity,
        npcJob: state.npcJob,
        npcTrade: state.npcTrade,
        detailHtml: els.entityDetailContent?.innerHTML || "",
        detailHidden: Boolean(els.entityDetailContent?.classList.contains("hidden")),
        emptyHtml: els.entityDetailEmpty?.innerHTML || "",
        emptyHidden: Boolean(els.entityDetailEmpty?.classList.contains("hidden"))
      };
    },
    async configureNpcCatalogTour(options = {}) {
      switchSection("npcs", { skipHistory: true });
      await setEntityViewMode("npcs", { skipHistory: true });

      state.npcQuery = String(options.query || "").trim();
      state.npcCity = String(options.city || "").trim();
      state.npcJob = String(options.job || "").trim();
      state.npcTrade = String(options.trade || "").trim();
      renderNpcFilters();
      if (els.npcSearchInput) els.npcSearchInput.value = state.npcQuery;
      if (els.npcTradeFilter) els.npcTradeFilter.value = state.npcTrade;
      renderNpcCatalog();

      if (options.focusJob) {
        els.npcJobFilter?.focus({ preventScroll: true });
      }

      if (options.openYaman) {
        await openNpcDetail("Yaman", { skipHistory: true });
      }

      if (options.openMap) {
        const mapButton = els.entityDetailContent?.querySelector('[data-boss-map-panel="location"]');
        if (mapButton) {
          renderBossInlineMap(mapButton);
          mapButton.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        }
      }
    },
    closeNpcCatalogTourMap() {
      closeMapModal();
      const mapButton = els.entityDetailContent?.querySelector('[data-boss-map-panel="location"].active');
      if (mapButton) {
        renderBossInlineMap(mapButton);
      }
    },
    restoreNpcCatalogTourState(snapshot) {
      if (!snapshot) {
        return;
      }

      closeMapModal();
      state.npcQuery = String(snapshot.npcQuery || "");
      state.npcCity = String(snapshot.npcCity || "");
      state.npcJob = String(snapshot.npcJob || "");
      state.npcTrade = String(snapshot.npcTrade || "");
      switchSection(snapshot.selectedSection || "npcs", { skipHistory: true });
      void setEntityViewMode(snapshot.entityViewMode || "npcs", { skipHistory: true });
      renderNpcFilters();
      if (els.npcSearchInput) els.npcSearchInput.value = state.npcQuery;
      if (els.npcTradeFilter) els.npcTradeFilter.value = state.npcTrade;
      renderNpcCatalog();
      if (els.entityDetailContent) {
        els.entityDetailContent.innerHTML = snapshot.detailHtml || "";
        els.entityDetailContent.classList.toggle("hidden", Boolean(snapshot.detailHidden));
      }
      if (els.entityDetailEmpty) {
        els.entityDetailEmpty.innerHTML = snapshot.emptyHtml || "";
        els.entityDetailEmpty.classList.toggle("hidden", Boolean(snapshot.emptyHidden));
      }
    },
    getBestiaryTourState() {
      return {
        selectedSection: state.selectedSection,
        entityViewMode: state.entityViewMode,
        monsterQuery: state.monsterQuery,
        monsterCategory: state.monsterCategory,
        monsterClass: state.monsterClass,
        monsterType: state.monsterType,
        monsterWeaknessFilter: state.monsterWeaknessFilter,
        weaknessDropdownOpen: state.weaknessDropdownOpen,
        monsterCategoriesCollapsed: state.monsterCategoriesCollapsed,
        currentMonsterDetail: state.currentMonsterDetail ? JSON.parse(JSON.stringify(state.currentMonsterDetail)) : null,
        detailHtml: els.entityDetailContent?.innerHTML || "",
        detailHidden: Boolean(els.entityDetailContent?.classList.contains("hidden")),
        emptyHtml: els.entityDetailEmpty?.innerHTML || "",
        emptyHidden: Boolean(els.entityDetailEmpty?.classList.contains("hidden"))
      };
    },
    async configureBestiaryTour(options = {}) {
      switchSection("npcs", { skipHistory: true });
      await setEntityViewMode("monsters", { skipHistory: true });

      state.monsterQuery = String(options.query || "").trim();
      state.monsterCategory = String(options.category || "").trim();
      state.monsterClass = "";
      state.monsterType = "";
      state.monsterWeaknessFilter = String(options.weakness || "").trim();
      state.weaknessDropdownOpen = Boolean(options.weaknessMenuOpen);
      state.monsterCategoriesCollapsed = false;
      renderMonsterFilters();
      renderMonsterCategories();
      renderWeaknessFilters();
      if (els.monsterSearchInput) {
        els.monsterSearchInput.value = state.monsterQuery;
      }
      renderMonsterCatalog();

      if (options.openCreature) {
        await openMonsterDetail(options.openCreature, { skipHistory: true });
      }

      if (options.scrollTo) {
        els.entityDetailContent?.querySelector(options.scrollTo)?.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "auto"
        });
      }
    },
    restoreBestiaryTourState(snapshot) {
      if (!snapshot) {
        return;
      }

      state.monsterQuery = String(snapshot.monsterQuery || "");
      state.monsterCategory = String(snapshot.monsterCategory || "");
      state.monsterClass = String(snapshot.monsterClass || "");
      state.monsterType = String(snapshot.monsterType || "");
      state.monsterWeaknessFilter = String(snapshot.monsterWeaknessFilter || "");
      state.weaknessDropdownOpen = Boolean(snapshot.weaknessDropdownOpen);
      state.monsterCategoriesCollapsed = Boolean(snapshot.monsterCategoriesCollapsed);
      state.currentMonsterDetail = snapshot.currentMonsterDetail ? JSON.parse(JSON.stringify(snapshot.currentMonsterDetail)) : null;
      switchSection(snapshot.selectedSection || "npcs", { skipHistory: true });
      void setEntityViewMode(snapshot.entityViewMode || "monsters", { skipHistory: true });
      renderMonsterFilters();
      renderMonsterCategories();
      renderWeaknessFilters();
      if (els.monsterSearchInput) {
        els.monsterSearchInput.value = state.monsterQuery;
      }
      renderMonsterCatalog();
      if (els.entityDetailContent) {
        els.entityDetailContent.innerHTML = snapshot.detailHtml || "";
        els.entityDetailContent.classList.toggle("hidden", Boolean(snapshot.detailHidden));
      }
      if (els.entityDetailEmpty) {
        els.entityDetailEmpty.innerHTML = snapshot.emptyHtml || "";
        els.entityDetailEmpty.classList.toggle("hidden", Boolean(snapshot.emptyHidden));
      }
    },
    getBossiaryTourState() {
      return {
        selectedSection: state.selectedSection,
        entityViewMode: state.entityViewMode,
        bossQuery: state.bossQuery,
        bossFilters: { ...state.bossFilters },
        monsterWeaknessFilter: state.monsterWeaknessFilter,
        weaknessDropdownOpen: state.weaknessDropdownOpen,
        currentMonsterDetail: state.currentMonsterDetail ? JSON.parse(JSON.stringify(state.currentMonsterDetail)) : null,
        detailHtml: els.entityDetailContent?.innerHTML || "",
        detailHidden: Boolean(els.entityDetailContent?.classList.contains("hidden")),
        emptyHtml: els.entityDetailEmpty?.innerHTML || "",
        emptyHidden: Boolean(els.entityDetailEmpty?.classList.contains("hidden"))
      };
    },
    async configureBossiaryTour(options = {}) {
      switchSection("npcs", { skipHistory: true });
      await setEntityViewMode("bosses", { skipHistory: true });
      // Aquecer uma unica consulta nos primeiros passos impede que Mapa e
      // Como chegar dependam de uma nova chamada lenta no momento do foco.
      void warmBossiaryTourBossTracker();

      state.bossQuery = String(options.query || "").trim();
      state.bossFilters = {
        bane: options.bossFilters?.bane ?? true,
        archfoe: options.bossFilters?.archfoe ?? true,
        nemesis: options.bossFilters?.nemesis ?? true
      };
      state.monsterWeaknessFilter = String(options.weakness || "").trim();
      state.weaknessDropdownOpen = Boolean(options.weaknessMenuOpen);
      if (els.bossSearchInput) {
        els.bossSearchInput.value = state.bossQuery;
      }
      els.bossFilterInputs?.forEach((input) => {
        input.checked = Boolean(state.bossFilters[input.dataset.bossFilter]);
      });
      renderWeaknessFilters();
      renderBossCatalog();

      if (options.openBoss) {
        const requestedBoss = normalizeSearchText(options.openBoss);
        const isRequestedBossAlreadyOpen =
          BOSSTIARY_TUTORIAL_REUSE_OPEN_DETAIL_ENABLED &&
          normalizeSearchText(state.currentMonsterDetail?.name) === requestedBoss &&
          Boolean(els.entityDetailContent?.querySelector('[data-tutorial-focus="creature-summary"]'));

        if (!isRequestedBossAlreadyOpen) {
          await openMonsterDetail(options.openBoss, { skipHistory: true });
        }
      }

      if (options.openMap) {
        const selector = `[data-boss-map-panel="${options.openMap}"]`;
        const deadline = Date.now() + 2600;
        let button = els.entityDetailContent?.querySelector(selector);
        while (!button && Date.now() < deadline) {
          await new Promise((resolve) => window.setTimeout(resolve, 80));
          button = els.entityDetailContent?.querySelector(selector);
        }
        if (button) {
          renderBossInlineMap(button);
          button.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        }
      }

      if (options.scrollTo) {
        els.entityDetailContent?.querySelector(options.scrollTo)?.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "auto"
        });
      }
    },
    closeBossiaryTourMap() {
      const mapButton = els.entityDetailContent?.querySelector('[data-boss-map-panel].active');
      if (mapButton) {
        renderBossInlineMap(mapButton);
      }
    },
    restoreBossiaryTourState(snapshot) {
      if (!snapshot) {
        return;
      }

      state.bossQuery = String(snapshot.bossQuery || "");
      state.bossFilters = {
        bane: snapshot.bossFilters?.bane ?? true,
        archfoe: snapshot.bossFilters?.archfoe ?? true,
        nemesis: snapshot.bossFilters?.nemesis ?? true
      };
      state.monsterWeaknessFilter = String(snapshot.monsterWeaknessFilter || "");
      state.weaknessDropdownOpen = Boolean(snapshot.weaknessDropdownOpen);
      state.currentMonsterDetail = snapshot.currentMonsterDetail ? JSON.parse(JSON.stringify(snapshot.currentMonsterDetail)) : null;
      switchSection(snapshot.selectedSection || "npcs", { skipHistory: true });
      void setEntityViewMode(snapshot.entityViewMode || "bosses", { skipHistory: true });
      if (els.bossSearchInput) {
        els.bossSearchInput.value = state.bossQuery;
      }
      els.bossFilterInputs?.forEach((input) => {
        input.checked = Boolean(state.bossFilters[input.dataset.bossFilter]);
      });
      renderWeaknessFilters();
      renderBossCatalog();
      if (els.entityDetailContent) {
        els.entityDetailContent.innerHTML = snapshot.detailHtml || "";
        els.entityDetailContent.classList.toggle("hidden", Boolean(snapshot.detailHidden));
      }
      if (els.entityDetailEmpty) {
        els.entityDetailEmpty.innerHTML = snapshot.emptyHtml || "";
        els.entityDetailEmpty.classList.toggle("hidden", Boolean(snapshot.emptyHidden));
      }
    },
    scrollToSelector(selector, block = "center") {
      document.querySelector(selector)?.scrollIntoView({ block, inline: "nearest", behavior: "smooth" });
    },
    async prepareMiniWorldChangesTutorial(options = {}) {
      switchSection("mini-world-changes", { skipHistory: true });
      if (state.currentMiniWorldChangeId) {
        closeMiniWorldChangeDetail();
      }
      await ensureMiniWorldChangesLoaded();
      renderMiniWorldChanges();

      if (options.showExample && !els.miniWorldChangesActive?.querySelector(".mini-world-change-active-card")) {
        const example = state.miniWorldChangesCatalog[0] || {
          id: "tutorial-example",
          name: "Bank Robbery",
          representative: {
            localPath: "assets/ui/navigation/world-board.gif",
            label: "Bank Robbery"
          }
        };
        els.miniWorldChangesActive.insertAdjacentHTML(
          "beforeend",
          renderMiniWorldChangeActiveCard(example).replace(
            "mini-world-change-active-card\"",
            "mini-world-change-active-card tt-mini-world-changes-tutorial-example\" data-tutorial-example=\"true\""
          )
        );
      }
    },
    clearMiniWorldChangesTutorialExample() {
      els.miniWorldChangesActive
        ?.querySelectorAll(".tt-mini-world-changes-tutorial-example")
        .forEach((element) => element.remove());
    },
    async prepareBooksTutorial(options = {}) {
      switchSection("item-prices", { skipHistory: true });
      await setItemViewMode("books", { skipHistory: true });

      const query = String(options.query || "").trim();
      state.booksDocuments.query = query;
      state.booksDocuments.page = 1;
      if (els.booksSearchInput) {
        els.booksSearchInput.value = query;
      }
      await loadBooksDocuments();

      if (options.openBook) {
        await selectBookDocument(options.openBook);
      }

      if (options.openMap) {
        const mapIndex = Number(options.mapIndex) || 0;
        const appearance = state.booksDocuments.detail?.appearances?.[mapIndex];
        const mapButton = els.booksDetail?.querySelector(`[data-book-map-index="${mapIndex}"]`);
        if (mapButton && appearance?.coordinates) {
          // Invoke the embedded map directly so the guided step never depends
          // on a synthetic click being accepted by the tutorial overlay.
          renderBookInlineMap(mapButton, appearance, state.booksDocuments.detail?.name || "");
        }
      }
    },
    closeBooksTutorialMap() {
      const panel = els.booksDetail?.querySelector("[data-books-inline-map-panel]");
      if (!panel || panel.classList.contains("hidden")) {
        return;
      }

      stopTibiaInlineMaps(panel);
      panel.classList.add("hidden");
      panel.dataset.bookMapIndex = "";
      panel.innerHTML = "";
      els.booksDetail?.querySelectorAll("[data-book-map-index]").forEach((button) => button.classList.remove("active"));
    },
    getStateSnapshot() {
      return {
        selectedSection: state.selectedSection,
        itemViewMode: state.itemViewMode,
        currentWorldSlug: state.currentWorldSlug
      };
    }
  };
}

async function applyDesktopMode() {
  if (!isDesktopOverlayApp()) {
    return;
  }

  document.body.classList.add("desktop-mode");
  syncDesktopEffectiveBreakpoints();

  if (!els.desktopToolbar) {
    return;
  }

  const overlayState = await getDesktopOverlayState().catch(() => null);
  const opacity = Math.round((overlayState?.opacity ?? 1) * 100);

  syncDesktopOpacityUI(opacity);
}

function getCurrentLocaleOption() {
  const activeLocale = state.localeController?.getLocale?.() || "en";
  return LOCALE_SWITCHER_OPTIONS.find((option) => option.code === activeLocale) || LOCALE_SWITCHER_OPTIONS[0];
}

function isLocaleMenuOpen() {
  return els.localeSwitcherMenu && !els.localeSwitcherMenu.classList.contains("hidden");
}

function ensureLocaleMenuPortal() {
  if (!els.localeSwitcherMenu) {
    return;
  }

  if (els.localeSwitcherMenu.parentElement !== document.body) {
    document.body.appendChild(els.localeSwitcherMenu);
  }

  els.localeSwitcherMenu.classList.add("locale-switcher-menu-portal");
}

function positionLocaleMenu() {
  if (!els.localeSwitcherMenu || !els.localeSwitcherButton || !isLocaleMenuOpen()) {
    return;
  }

  const viewportMargin = 8;
  const menuGap = 8;
  const buttonRect = els.localeSwitcherButton.getBoundingClientRect();
  const menuRect = els.localeSwitcherMenu.getBoundingClientRect();
  const maxLeft = Math.max(viewportMargin, window.innerWidth - menuRect.width - viewportMargin);
  const left = Math.max(viewportMargin, Math.min(buttonRect.right - menuRect.width, maxLeft));
  const preferredTop = buttonRect.bottom + menuGap;
  const top = preferredTop + menuRect.height <= window.innerHeight - viewportMargin
    ? preferredTop
    : Math.max(viewportMargin, buttonRect.top - menuRect.height - menuGap);

  els.localeSwitcherMenu.style.left = `${Math.round(left)}px`;
  els.localeSwitcherMenu.style.top = `${Math.round(top)}px`;
}

function setLocaleMenuOpen(open) {
  if (!els.localeSwitcherMenu || !els.localeSwitcherButton) {
    return;
  }

  ensureLocaleMenuPortal();
  els.localeSwitcherMenu.classList.toggle("hidden", !open);
  els.localeSwitcherButton.setAttribute("aria-expanded", open ? "true" : "false");

  if (open) {
    positionLocaleMenu();
    window.requestAnimationFrame(positionLocaleMenu);
  }
}

function updateLocaleSwitcher() {
  if (!els.localeSwitcherButton || !els.localeSwitcherMenu) {
    return;
  }

  const current = getCurrentLocaleOption();

  if (els.localeSwitcherFlag) {
    els.localeSwitcherFlag.innerHTML = `<img class="locale-switcher-flag-image" src="${current.flagSrc}" alt="${current.flagAlt}">`;
  }

  if (els.localeSwitcherLabel) {
    els.localeSwitcherLabel.textContent = t(current.labelKey);
  }

  els.localeSwitcherButton.setAttribute("aria-label", t("locale.switcher.aria"));
  els.localeSwitcherButton.setAttribute("data-tooltip", t("locale.switcher.tooltip"));

  els.localeSwitcherMenu.querySelectorAll("[data-locale-option]").forEach((button) => {
    const localeCode = button.getAttribute("data-locale-option") || "pt-BR";
    const option = LOCALE_SWITCHER_OPTIONS.find((entry) => entry.code === localeCode);

    if (!option) {
      return;
    }

    button.classList.toggle("active", localeCode === current.code);
    button.setAttribute("aria-pressed", localeCode === current.code ? "true" : "false");
    const optionFlag = button.querySelector("[data-locale-option-flag]");
    if (optionFlag) {
      optionFlag.innerHTML = `<img class="locale-switcher-option-flag-image" src="${option.flagSrc}" alt="${option.flagAlt}">`;
    }
    button.querySelector("[data-locale-option-label]")?.replaceChildren(document.createTextNode(t(option.labelKey)));
  });
}

function renderLocaleSwitcher() {
  if (!els.localeSwitcherMenu) {
    return;
  }

  ensureLocaleMenuPortal();
  els.localeSwitcherMenu.innerHTML = LOCALE_SWITCHER_OPTIONS.map((option) => `
    <button
      type="button"
      class="locale-switcher-option"
      data-locale-option="${option.code}"
      aria-pressed="false"
    >
      <span class="locale-switcher-option-flag" data-locale-option-flag>
        <img class="locale-switcher-option-flag-image" src="${option.flagSrc}" alt="${option.flagAlt}">
      </span>
      <span class="locale-switcher-option-label" data-locale-option-label>${t(option.labelKey)}</span>
    </button>
  `).join("");

  setLocaleMenuOpen(false);
  updateLocaleSwitcher();
}

async function refreshLocaleSensitiveContent(locale) {
  const requestId = ++state.localeRefreshRequestId;

  await setDataLocale(locale).catch(() => {});
  state.phraseTranslationMap = await loadPhraseTranslationMap(locale).catch(() => ({}));

  if (requestId !== state.localeRefreshRequestId) {
    return;
  }

  renderLocaleSwitcher();
  renderImbuementOptions();
  renderImbuementPickerState();
  renderImbuementLoading();
  renderImbuement();
  renderSkillCalculator();
  renderFindParty();
  renderNpcTabs();
  renderStashFilters();
  renderStashValueButtons();
  if (state.itemViewMode === "stash") {
    renderStashGrid();
  }
  if (state.booksDocuments.listing) {
    const openBookSlug = state.booksDocuments.detail?.slug || "";
    await loadBooksDocuments().catch(() => {});
    if (openBookSlug && requestId === state.localeRefreshRequestId) {
      await selectBookDocument(openBookSlug, { scrollIntoView: false }).catch(() => {});
    }
  }

  // Detailed spell records are a local bundle rather than a runtime request.
  // Re-read them after a locale switch so their reviewed factual text cannot
  // remain in the language that was active when the tab first opened.
  if (state.spells.loaded) {
    state.spells.loaded = false;
    if (state.itemViewMode === "spells") {
      await loadSpellsCatalog().catch(() => {});
    }
  }

  if (getActiveLootAnalyzerText().trim()) {
    parseAndRenderLootSplitter();
  }

  // The active Library detail is already backed by the local canonical
  // snapshot. Refresh it immediately from that snapshot instead of routing a
  // locale switch through the full item/market request. The heavier catalog
  // refresh below must not block the visible language change.
  if (state.currentItem) {
    void refreshCurrentItemLocale(state.currentItem, requestId);
  }

  const catalogReloads = [];

  if (state.npcLoaded) {
    state.npcLoaded = false;
    catalogReloads.push(ensureNpcCatalogLoaded());
  }

  if (state.monstersLoaded) {
    state.monstersLoaded = false;
    catalogReloads.push(ensureMonsterCatalogLoaded());
  }

  await Promise.allSettled(catalogReloads);

  if (requestId !== state.localeRefreshRequestId) {
    return;
  }

  const currentEntry = normalizeNavigationEntry(state.currentNavigationEntry);

  if (currentEntry?.type === "npc" && currentEntry.name) {
    await openNpcDetail(currentEntry.name, { skipHistory: true }).catch(() => {});
  } else if (currentEntry?.type === "creature" && currentEntry.name) {
    await openMonsterDetail(currentEntry.name, { skipHistory: true }).catch(() => {});
  }

  if (
    requestId === state.localeRefreshRequestId &&
    (state.selectedToolTab === "find-party" || state.findPartyRequestId > 0)
  ) {
    await ensureFindPartySnapshot().catch(() => {});
  }

  if (requestId === state.localeRefreshRequestId) {
    renderSupporterToolbar();
    renderMiniWorldChanges();
  }
}

async function refreshCurrentItemLocale(previousPayload, requestId) {
  const itemSlug = String(previousPayload?.item?.slug || "").trim();
  if (!itemSlug || requestId !== state.localeRefreshRequestId) return;

  const localizedPayload = await fetchItemStatic({
    itemSlug,
    worldSlug: state.currentWorldSlug
  }).catch(() => null);

  if (!localizedPayload || requestId !== state.localeRefreshRequestId || state.currentItem?.item?.slug !== itemSlug) return;

  // Static data already contains the locally cached market snapshot. Keep the
  // previous dynamic fields as a guard against a cache miss during a locale
  // switch, while replacing the complete locale-sensitive Library document.
  state.currentItem = {
    ...previousPayload,
    ...localizedPayload,
    market: localizedPayload.market ?? previousPayload.market,
    selectedWorld: localizedPayload.selectedWorld || previousPayload.selectedWorld,
    availableWorlds: localizedPayload.availableWorlds?.length
      ? localizedPayload.availableWorlds
      : previousPayload.availableWorlds,
    relatedItems: localizedPayload.relatedItems?.length
      ? localizedPayload.relatedItems
      : previousPayload.relatedItems
  };
  renderItem();
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target;

    if (
      state.itemSuggestionsOpen &&
      target !== els.itemInput &&
      target !== els.itemDropdownButton &&
      !els.itemSuggestions.contains(target)
    ) {
      closeItemSuggestions();
    }

    if (
      state.globalWorldSuggestionsOpen &&
      target !== els.globalWorldInput &&
      target !== els.globalWorldDropdownButton &&
      !els.globalWorldDropdownButton?.contains?.(target) &&
      !els.globalWorldSuggestions.contains(target)
    ) {
      closeWorldSuggestions("global");
    }

    if (
      state.toolWorldSuggestionsOpen &&
      target !== els.toolWorldInput &&
      target !== els.toolWorldDropdownButton &&
      !els.toolWorldSuggestions.contains(target)
    ) {
      closeWorldSuggestions("tool");
    }

    if (
      state.lootWorldSuggestionsOpen &&
      target !== els.lootWorldInput &&
      target !== els.lootWorldDropdownButton &&
      !els.lootWorldSuggestions.contains(target)
    ) {
      closeWorldSuggestions("loot");
    }

    if (
      state.findPartyGuildSuggestionsOpen &&
      target !== els.findPartyGuildInput &&
      target !== els.findPartyGuildDropdownButton &&
      target !== els.findPartyGuildControl &&
      !els.findPartyGuildControl?.contains(target) &&
      !els.findPartyGuildSuggestions?.contains(target)
    ) {
      closeFindPartyGuildSuggestions();
    }

    if (
      isLocaleMenuOpen() &&
      target !== els.localeSwitcherButton &&
      !els.localeSwitcher?.contains(target) &&
      !els.localeSwitcherMenu?.contains(target)
    ) {
      setLocaleMenuOpen(false);
    }

  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (isLocaleMenuOpen()) {
        setLocaleMenuOpen(false);
      }
      closeMiniWorldChangeImageViewer();
    }
  });

  els.navButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const section = button.dataset.section;
      if (section) {
        await activateLibraryContentAtSafePoint();
        switchSection(section);
        updateMainNavScrollButtons();
        void window.desktopApi?.libraryContent?.check?.().catch(() => {});
      }
    });
  });

  els.navScrollButtons.forEach((button) => {
    button.addEventListener("click", () => {
      scrollMainNav(button.dataset.navScroll === "left" ? -1 : 1);
    });
  });

  els.navSections?.addEventListener("scroll", updateMainNavScrollButtons, { passive: true });
  window.addEventListener("resize", () => {
    syncDesktopEffectiveBreakpoints();
    updateMainNavScrollButtons();
    positionCompactGlobalWorldPicker();
  });
  updateMainNavScrollButtons();

  if ("ResizeObserver" in window) {
    const desktopBreakpointObserver = new ResizeObserver(() => {
      syncDesktopEffectiveBreakpoints();
      updateMainNavScrollButtons();
      positionCompactGlobalWorldPicker();
    });

    if (els.mainContent) {
      desktopBreakpointObserver.observe(els.mainContent);
    }

    if (els.appShell) {
      desktopBreakpointObserver.observe(els.appShell);
    }
  }

  els.historyBackButton?.addEventListener("click", () => {
    void restorePreviousNavigationEntry();
  });

  els.historyForwardButton?.addEventListener("click", () => {
    void restoreNextNavigationEntry();
  });

  els.localeSwitcherButton?.addEventListener("click", () => {
    setLocaleMenuOpen(!isLocaleMenuOpen());
  });

  els.localeSwitcherMenu?.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  els.localeSwitcherMenu?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-locale-option]");

    if (!button || !state.localeController) {
      return;
    }

    const localeCode = button.getAttribute("data-locale-option") || "pt-BR";
    setLocaleMenuOpen(false);
    void state.localeController.setLocale(localeCode);
  });

  window.addEventListener("resize", () => {
    if (isLocaleMenuOpen()) {
      positionLocaleMenu();
    }
  });

  els.toolTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setToolTab(button.dataset.toolTab || "imbuement");
    });
  });

  els.wheelOfDestinyFrame?.addEventListener("load", () => {
    syncWheelOfDestinyLocale();
  });

  window.addEventListener("message", (event) => {
    if (event.source !== els.wheelOfDestinyFrame?.contentWindow) {
      return;
    }

    if (event.data?.type === "tibia-toolkit-wheel-height") {
      const height = Math.max(620, Math.min(2400, Number(event.data.height) || 0));
      if (height) {
        els.wheelOfDestinyFrame.style.height = `${height}px`;
      }
    }
  });

  els.findPartyVocationButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      const vocation = button.dataset.findPartyVocation || "";
      state.findPartyVocation = state.findPartyVocation === vocation ? "" : vocation;
      state.findPartyPage = 1;
      renderFindParty();
      void ensureFindPartySnapshot({ force: true });
    });
  });

  els.findPartyCharacterInput?.addEventListener("input", () => {
    state.findPartyCharacterName = els.findPartyCharacterInput.value.trim();
    state.findPartyPage = 1;

    if (state.findPartyCharacterLookupTimer) {
      window.clearTimeout(state.findPartyCharacterLookupTimer);
      state.findPartyCharacterLookupTimer = null;
    }

    if (!state.findPartyCharacterName) {
      state.findPartyCharacterProfile = null;
      setFindPartyFeedback("");
      renderFindParty();
      return;
    }

    setFindPartyFeedback("Consultando personagem...");
    renderFindParty();
    state.findPartyCharacterLookupTimer = window.setTimeout(() => {
      state.findPartyCharacterLookupTimer = null;
      void resolveFindPartyReferenceCharacter();
    }, 260);
  });

  els.findPartyGuildInput?.addEventListener("input", () => {
    state.findPartyGuildQuery = els.findPartyGuildInput.value;
    renderFindPartyGuildSuggestions({ forceOpen: true });
  });

  els.findPartyGuildInput?.addEventListener("keydown", (event) => {
    handleFindPartyGuildInputKeydown(event);
  });

  els.findPartyGuildDropdownButton?.addEventListener("click", () => {
    if (state.findPartyGuildSuggestionsOpen) {
      closeFindPartyGuildSuggestions();
      return;
    }

    renderFindPartyGuildSuggestions({ forceOpen: true, showAll: true });
    els.findPartyGuildInput?.focus();
  });

  els.findPartyGuildSuggestions?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-find-party-guild-name]");

    if (!button) {
      return;
    }

    addFindPartyGuildFilter(button.dataset.findPartyGuildName || "");
  });

  els.findPartyGuildChips?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-find-party-remove-guild]");

    if (!button) {
      return;
    }

    removeFindPartyGuildFilter(button.dataset.findPartyRemoveGuild || "");
  });

  els.findPartyClearButton?.addEventListener("click", () => {
    clearFindPartyFilters();
  });

  els.findPartyResults?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-find-party-copy-name]");

    if (!button) {
      return;
    }

    void copyFindPartyCharacterName(button);
  });

  els.findPartyPrevPageButton?.addEventListener("click", () => {
    if (state.findPartyPage > 1) {
      state.findPartyPage -= 1;
      renderFindParty();
    }
  });

  els.findPartyNextPageButton?.addEventListener("click", () => {
    const totalPages = getFindPartyTotalPages();

    if (state.findPartyPage < totalPages) {
      state.findPartyPage += 1;
      renderFindParty();
    }
  });

  els.findPartyPageSizeSelect?.addEventListener("change", () => {
    state.findPartyPageSize = clampInteger(els.findPartyPageSizeSelect.value, 10, 100, 10);
    state.findPartyPage = 1;
    renderFindParty();
  });

  [els.findPartySortNameButton, els.findPartySortLevelButton].forEach((button) => {
    button?.addEventListener("click", () => {
      const sortMode = button.dataset.findPartySort === "name" ? "name" : "level";

      if (state.findPartySortMode === sortMode) {
        state.findPartySortDirection = state.findPartySortDirection === "asc" ? "desc" : "asc";
      } else {
        state.findPartySortMode = sortMode;
        state.findPartySortDirection = sortMode === "name" ? "asc" : "desc";
      }

      state.findPartyPage = 1;
      renderFindParty();
    });
  });

  els.timerNameInput?.addEventListener("input", () => {
    state.overlayTools.timers.draft.name = els.timerNameInput.value;
    void saveOverlayToolsState();
  });

  els.timerDurationInput?.addEventListener("input", () => {
    state.overlayTools.timers.draft.durationSeconds = els.timerDurationInput.value;
    void saveOverlayToolsState();
  });

  els.timerVolumeInput?.addEventListener("input", () => {
    state.overlayTools.timers.draft.volumePercent = els.timerVolumeInput.value;
    void saveOverlayToolsState();
  });

  els.timerSoundSelect?.addEventListener("change", () => {
    state.overlayTools.timers.draft.soundKey = els.timerSoundSelect.value;
    void saveOverlayToolsState();
  });

  els.timerVisualAlertToggle?.addEventListener("change", () => {
    state.overlayTools.timers.draft.showVisualAlert = els.timerVisualAlertToggle.checked;
    void saveOverlayToolsState();
  });

  els.timerRepeatToggle?.addEventListener("change", () => {
    state.overlayTools.timers.draft.repeatEnabled = els.timerRepeatToggle.checked;
    void saveOverlayToolsState();
  });

  els.timerSaveButton?.addEventListener("click", () => {
    void handleTimerSave();
  });

  els.timerResetButton?.addEventListener("click", () => {
    resetTimerDraft();
  });

  els.timerPreviewButton?.addEventListener("click", () => {
    void playTimerPreview();
  });

  els.timerFilterTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.timerFilter = button.dataset.timerFilter === "running" ? "running" : "all";
      renderTimerFilterTabs();
      renderTimerTool();
    });
  });

  els.timerList?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-timer-action]");

    if (!actionButton) {
      return;
    }

    const timerId = actionButton.dataset.timerId || "";
    const action = actionButton.dataset.timerAction || "";

    if (!timerId || !action) {
      return;
    }

    if (action === "start") {
      void startOverlayTimer(timerId);
      return;
    }

    if (action === "stop") {
      stopOverlayTimer(timerId);
      return;
    }

    if (action === "edit") {
      loadTimerIntoDraft(timerId);
      return;
    }

    if (action === "delete") {
      void deleteOverlayTimer(timerId);
    }
  });

  bindSkillCalculatorEvents();

  els.itemForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await confirmExactItemInput();
  });

  els.itemViewTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setItemViewMode(button.dataset.itemView || "list");
    });
  });
  els.spellsSearchInput?.addEventListener("input", () => {
    state.spells.query = els.spellsSearchInput.value.trim();
    renderSpellsCatalog();
  });
  els.spellsSortFilter?.addEventListener("change", () => {
    state.spells.sort = els.spellsSortFilter.value || "name-asc";
    renderSpellsCatalog();
  });
  els.spellVocationFilters.forEach((button) => button.addEventListener("click", () => {
    const vocation = button.dataset.spellVocation || "";
    if (!vocation) return;
    state.spells.vocations.has(vocation) ? state.spells.vocations.delete(vocation) : state.spells.vocations.add(vocation);
    renderSpellsCatalog();
  }));
  els.spellCategoryFilters.forEach((button) => button.addEventListener("click", () => {
    const category = button.dataset.spellCategory || "";
    if (!category) return;
    state.spells.categories.has(category) ? state.spells.categories.delete(category) : state.spells.categories.add(category);
    renderSpellsCatalog();
  }));
  els.spellWheelFilter?.addEventListener("click", () => {
    state.spells.wheelOnly = !state.spells.wheelOnly;
    renderSpellsCatalog();
  });

  const refreshBooks = () => {
    state.booksDocuments.page = 1;
    void loadBooksDocuments();
  };

  els.booksSearchInput?.addEventListener("input", () => {
    state.booksDocuments.query = els.booksSearchInput.value.trim();
    window.clearTimeout(state.booksDocuments.searchTimer);
    state.booksDocuments.searchTimer = window.setTimeout(refreshBooks, 180);
  });

  els.booksClearSearch?.addEventListener("click", () => {
    state.booksDocuments.query = "";
    if (els.booksSearchInput) els.booksSearchInput.value = "";
    refreshBooks();
  });

  els.booksSortFilter?.addEventListener("change", () => {
    state.booksDocuments.sort = els.booksSortFilter.value;
    refreshBooks();
  });

  els.booksLocationFilter?.addEventListener("change", () => {
    state.booksDocuments.location = els.booksLocationFilter.value;
    refreshBooks();
  });

  els.booksLibraryFilter?.addEventListener("change", () => {
    state.booksDocuments.library = els.booksLibraryFilter.value;
    refreshBooks();
  });

  els.booksAuthorFilter?.addEventListener("change", () => {
    state.booksDocuments.author = els.booksAuthorFilter.value;
    refreshBooks();
  });

  els.stashSearchInput?.addEventListener("input", () => {
    state.stashQuery = els.stashSearchInput.value.trim();
    renderStashGrid();
    scheduleStashMarketLoad();
  });

  els.stashGrid?.addEventListener("scroll", handleStashGridScroll, { passive: true });
  if (els.stashGrid && "ResizeObserver" in window) {
    const stashGridObserver = new ResizeObserver(() => {
      scheduleStashGridVirtualRender();
    });
    stashGridObserver.observe(els.stashGrid);
  }

  els.stashClearSearch?.addEventListener("click", () => {
    state.stashQuery = "";
    els.stashSearchInput.value = "";
    renderStashGrid();
    scheduleStashMarketLoad();
  });

  els.stashWeeklyFilter?.addEventListener("click", () => {
    state.stashWeeklyOnly = !state.stashWeeklyOnly;
    renderStashFilters();
    renderStashGrid();
    scheduleStashMarketLoad();
  });

  els.stashCategoryFilter?.addEventListener("change", () => {
    state.stashCategory = els.stashCategoryFilter.value;
    renderStashGrid();
    scheduleStashMarketLoad();
  });

  els.stashTraderFilter?.addEventListener("change", () => {
    state.stashTrader = els.stashTraderFilter.value;
    renderStashGrid();
    scheduleStashMarketLoad();
  });

  els.stashSortFilter?.addEventListener("change", () => {
    state.stashSort = els.stashSortFilter.value;
    renderStashGrid();
    scheduleStashMarketLoad();
  });

  els.stashValueButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.stashValueMode || "npc";
      const modeChanged = state.stashValueMode !== nextMode;
      state.stashValueMode = nextMode;
      if (modeChanged && nextMode === "market") {
        state.stashMarketLoadedSignature = "";
      }
      renderStashFilters();
      renderStashValueButtons();
      renderStashGrid();
      if (nextMode === "market") {
        void syncStashMarketRefreshCooldown();
      }
      scheduleStashMarketLoad();
    });
  });

  els.stashMarketRefreshButton?.addEventListener("click", async () => {
    if (state.stashLoadingMarket || state.stashMarketRefreshSyncing) {
      return;
    }

    if (isStashMarketRefreshCoolingDown()) {
      showStashMarketRefreshWarning(getStashMarketRefreshCooldownLabel());
      return;
    }

    const filteredIds = getTargetStashMarketIds({ onlyVisible: false });

    if (filteredIds.length === 0) {
      showStashMarketRefreshWarning("Nao ha itens de market no filtro atual para atualizar.");
      return;
    }

    state.stashMarketRefreshSyncing = true;
    renderStashValueButtons();

    try {
      const authorization = await reserveStashMarketRefresh();
      applyStashMarketRefreshServerState(authorization);

      if (authorization?.allowed !== true) {
        showStashMarketRefreshWarning(getStashMarketRefreshCooldownLabel());
        return;
      }

      hideStashMarketRefreshWarning();
      void refreshFilteredStashMarketValues();
    } catch (error) {
      showStashMarketRefreshWarning(error instanceof Error ? error.message : "Nao foi possivel confirmar o limite do market.");
    } finally {
      state.stashMarketRefreshSyncing = false;
      renderStashValueButtons();
    }
  });

  els.entityTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const view = ["npcs", "monsters", "bosses"].includes(button.dataset.entityView)
        ? button.dataset.entityView
        : "npcs";
      void setEntityViewMode(view);
    });
  });

  els.npcSearchInput?.addEventListener("input", () => {
    state.npcQuery = els.npcSearchInput.value.trim();
    state.npcCatalogLimit = 60;
    renderNpcCatalog();
  });

  els.npcCityFilter?.addEventListener("change", () => {
    state.npcCity = els.npcCityFilter.value;
    state.npcCatalogLimit = 60;
    renderNpcCatalog();
  });

  els.npcJobFilter?.addEventListener("change", () => {
    state.npcJob = els.npcJobFilter.value;
    state.npcCatalogLimit = 60;
    renderNpcCatalog();
  });

  els.npcTradeFilter?.addEventListener("change", () => {
    state.npcTrade = els.npcTradeFilter.value;
    state.npcCatalogLimit = 60;
    renderNpcCatalog();
  });

  els.monsterSearchInput?.addEventListener("input", () => {
    state.monsterQuery = els.monsterSearchInput.value.trim();
    state.monsterCatalogLimit = 60;
    renderMonsterCatalog();
  });

  els.bossSearchInput?.addEventListener("input", () => {
    state.bossQuery = els.bossSearchInput.value.trim();
    state.bossCatalogLimit = 60;
    renderBossCatalog();
  });

  els.bossFilterInputs?.forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.bossFilter;
      if (key) {
        state.bossFilters[key] = input.checked;
        state.bossCatalogLimit = 60;
        renderBossCatalog();
      }
    });
  });

  bindWeaknessFilterBar(els.monsterWeaknessFilter, "monsters");
  bindWeaknessFilterBar(els.bossWeaknessFilter, "bosses");

  els.monsterCategoryToggle?.addEventListener("click", () => {
    state.monsterCategoriesCollapsed = !state.monsterCategoriesCollapsed;
    renderMonsterCategories();
  });

  els.monsterCategoryGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-monster-category]");

    if (!button) {
      return;
    }

    state.monsterCategory = button.dataset.monsterCategory || "";
    state.monsterCatalogLimit = 60;
    renderMonsterCategories();
    renderMonsterCatalog();
    scrollMonsterListIntoView();
  });

  els.monsterClassFilter?.addEventListener("change", () => {
    state.monsterClass = els.monsterClassFilter.value;
    state.monsterCatalogLimit = 60;
    renderMonsterCatalog();
  });

  els.monsterTypeFilter?.addEventListener("change", () => {
    state.monsterType = els.monsterTypeFilter.value;
    state.monsterCatalogLimit = 60;
    renderMonsterCatalog();
  });

  els.mapModalClose?.addEventListener("click", closeMapModal);
  els.mapModalClose?.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    closeMapModal();
  });
  els.mapModal?.addEventListener("click", (event) => {
    if (event.target === els.mapModal) {
      event.stopPropagation();
    }
  });
  els.mapModalHeader?.addEventListener("pointerdown", startMapDrag);
  window.addEventListener("pointermove", moveMapDrag);
  window.addEventListener("pointerup", stopMapDrag);

  els.miniWorldChangesOverview?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-mini-world-change-id]");
    if (trigger) {
      openMiniWorldChangeDetail(trigger.dataset.miniWorldChangeId || "");
    }
  });

  els.miniWorldChangesRefreshButton?.addEventListener("click", () => {
    const cooldownRemaining = getMiniWorldChangesRefreshCooldownSeconds();
    if (cooldownRemaining > 0 || state.miniWorldChangesLoading) {
      renderMiniWorldChangesRefreshControl();
      return;
    }

    // This only rereads the VPS snapshot exposed by the site. It never starts
    // a new upstream Mini World Changes collection from the desktop app.
    state.miniWorldChangesRefreshCooldownUntil = Date.now() + MINI_WORLD_CHANGES_REFRESH_COOLDOWN_MS;
    renderMiniWorldChangesRefreshControl();
    void loadMiniWorldChanges({ force: true });
  });

  els.findPartyRefreshButton?.addEventListener("click", () => {
    void ensureFindPartySnapshot({ force: true });
  });

  els.miniWorldChangeBack?.addEventListener("click", () => {
    closeMiniWorldChangeDetail();
  });

  els.miniWorldChangeOpenWiki?.addEventListener("click", () => {
    const entry = findMiniWorldChangeById(state.currentMiniWorldChangeId);
    if (entry?.wikiUrl) {
      void openDesktopExternalLink(entry.wikiUrl);
    }
  });

  els.miniWorldChangeOpenNpc?.addEventListener("click", () => {
    void openYasirNpcDetail();
  });

  els.miniWorldChangeDetailContent?.addEventListener("click", (event) => {
    const mapButton = event.target.closest("[data-mini-world-change-map]");
    if (mapButton) {
      renderMiniWorldChangeInlineMap(mapButton);
      return;
    }

    const galleryButton = event.target.closest("[data-mini-world-change-image]");
    if (galleryButton) {
      openMiniWorldChangeImageViewer(galleryButton);
      return;
    }

    const entityButton = event.target.closest("[data-mini-world-change-entity]");
    if (entityButton) {
      void openMiniWorldChangeEntity(entityButton);
    }
  });

  els.miniWorldChangeImageViewerClose?.addEventListener("click", closeMiniWorldChangeImageViewer);
  els.miniWorldChangeImageViewer?.addEventListener("click", (event) => {
    if (!event.target.closest?.(".mini-world-change-image-viewer-card")) {
      closeMiniWorldChangeImageViewer();
    }
  });

  els.itemInput.addEventListener("input", () => {
    state.selectedItemSuggestion = null;
    els.npcCard?.classList.add("hidden");
    if (!els.itemInput.value.trim()) {
      setFeedback("");
      closeItemSuggestions();
      return;
    }

    void updateItemSuggestions();
  });

  els.itemInput.addEventListener("blur", () => {
    if (document.body.classList.contains("tt-tutorial-interaction-blocked")) {
      return;
    }

    const valueAtBlur = els.itemInput.value.trim();
    const selectionAtBlur = state.selectedItemSuggestion;

    window.setTimeout(() => {
      if (
        !valueAtBlur ||
        els.itemInput.value.trim() !== valueAtBlur ||
        state.selectedItemSuggestion !== selectionAtBlur
      ) {
        return;
      }

      void confirmExactItemInput();
    }, 120);
  });

  els.itemInput.addEventListener("focus", () => {
    if (els.itemInput.value.trim()) {
      void updateItemSuggestions();
    }
  });

  els.itemDropdownButton?.addEventListener("click", () => {
    if (state.itemSuggestionsOpen && !els.itemInput.value.trim()) {
      closeItemSuggestions();
      return;
    }

    void updateItemSuggestions({ showAll: true });
  });

  els.itemSuggestions?.addEventListener("scroll", () => {
    if (
      !state.itemSuggestionsShowAll ||
      !state.itemSuggestionsHasMore ||
      state.itemSuggestionsLoadingMore
    ) {
      return;
    }

    const remaining = els.itemSuggestions.scrollHeight - els.itemSuggestions.scrollTop - els.itemSuggestions.clientHeight;
    if (remaining <= ITEM_SUGGESTIONS_LOAD_AHEAD_PX) {
      void loadMoreItemSuggestions();
    }
  }, { passive: true });

  els.itemInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await confirmExactItemInput();
      return;
    }

    if (!state.itemSuggestionsOpen || state.itemSuggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (
        state.activeItemSuggestionIndex === state.itemSuggestions.length - 1 &&
        state.itemSuggestionsShowAll &&
        state.itemSuggestionsHasMore
      ) {
        await loadMoreItemSuggestions();
      }
      state.activeItemSuggestionIndex =
        (state.activeItemSuggestionIndex + 1) % state.itemSuggestions.length;
      renderItemSuggestions();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      state.activeItemSuggestionIndex =
        (state.activeItemSuggestionIndex - 1 + state.itemSuggestions.length) %
        state.itemSuggestions.length;
      renderItemSuggestions();
      return;
    }

    if (event.key === "Escape") {
      closeItemSuggestions();
    }
  });

  els.worldInput.addEventListener("input", () => {
    void updateWorldSuggestions("item");
  });

  els.globalWorldInput?.addEventListener("input", () => {
    void updateWorldSuggestions("global");
  });

  els.globalWorldDropdownButton?.addEventListener("click", () => {
    if (document.body.classList.contains("desktop-mode") && window.desktopApi?.globalWorldPicker?.open) {
      void toggleDesktopGlobalWorldPicker();
      return;
    }

    if (state.globalWorldSuggestionsOpen) {
      closeWorldSuggestions("global");
      return;
    }

    void updateWorldSuggestions("global", { showAll: true });
    if (isCompactGlobalWorldPickerMode()) {
      window.requestAnimationFrame(() => {
        els.globalWorldInput?.focus();
        els.globalWorldInput?.select?.();
      });
    }
  });

  els.desktopBoostedCreature?.addEventListener("click", () => {
    void openBoostedEntity(state.boostedStatus.creature?.name, "monsters");
  });

  els.desktopBoostedBoss?.addEventListener("click", () => {
    void openBoostedEntity(state.boostedStatus.boss?.name, "bosses");
  });

  [els.desktopBoostedCreatureImage, els.desktopBoostedBossImage].forEach((image) => {
    image?.addEventListener("error", () => {
      let fallbacks = [];
      try { fallbacks = JSON.parse(image.dataset.fallbackSources || "[]"); } catch (_error) {}
      const nextSource = Array.isArray(fallbacks) ? fallbacks.shift() : "";
      if (!nextSource) {
        image.hidden = true;
        return;
      }
      image.dataset.fallbackSources = JSON.stringify(fallbacks);
      image.src = nextSource;
    });
  });

  els.desktopYasirPodium?.addEventListener("click", () => {
    void openOrientalTraderWorldChange();
  });

  els.globalWorldInput?.addEventListener("keydown", async (event) => {
    await handleWorldInputKeydown("global", event);
  });

  els.worldDropdownButton?.addEventListener("click", () => {
    if (state.itemWorldSuggestionsOpen) {
      closeWorldSuggestions("item");
      return;
    }

    void updateWorldSuggestions("item", { showAll: true });
  });

  els.worldInput.addEventListener("keydown", async (event) => {
    await handleWorldInputKeydown("item", event);
  });

  els.toolWorldInput.addEventListener("input", () => {
    void updateWorldSuggestions("tool");
  });

  els.toolWorldDropdownButton?.addEventListener("click", () => {
    if (state.toolWorldSuggestionsOpen) {
      closeWorldSuggestions("tool");
      return;
    }

    void updateWorldSuggestions("tool", { showAll: true });
  });

  els.toolWorldInput.addEventListener("keydown", async (event) => {
    await handleWorldInputKeydown("tool", event);
  });

  els.lootWorldInput?.addEventListener("input", () => {
    void updateWorldSuggestions("loot");
  });

  els.lootWorldDropdownButton?.addEventListener("click", () => {
    if (state.lootWorldSuggestionsOpen) {
      closeWorldSuggestions("loot");
      return;
    }

    void updateWorldSuggestions("loot", { showAll: true });
  });

  els.lootWorldInput?.addEventListener("keydown", async (event) => {
    await handleWorldInputKeydown("loot", event);
  });

  els.lootInput?.addEventListener("input", () => {
    setActiveLootAnalyzerText(els.lootInput.value);
    void saveLootAnalyzerDrafts();
    parseAndRenderLootSplitter();
  });

  els.lootSubtabs.forEach((button) => {
    button.addEventListener("click", () => {
      setLootMode(button.dataset.lootMode === "solo" ? "solo" : "party");
    });
  });

  els.lootCharacterInput?.addEventListener("input", () => {
    state.lootSoloCharacterName = els.lootCharacterInput.value.trim();
    void saveLootAnalyzerDrafts();
    parseAndRenderLootSplitter();
  });

  window.addEventListener("beforeunload", () => {
    writeLootAnalyzerDraftsFallback({
      party: state.lootPartyAnalyzerText,
      solo: state.lootSoloAnalyzerText,
      soloCharacterName: state.lootSoloCharacterName,
      soloUseMarket: state.lootSoloUseMarket,
      soloDoubleXp: state.lootSoloDoubleXp,
      soloDoubleLoot: state.lootSoloDoubleLoot,
      updatedAt: new Date().toISOString()
    });
  });

  els.lootAutoModeToggle?.addEventListener("change", () => {
    state.lootSoloUseMarket = Boolean(els.lootAutoModeToggle.checked);
    if (state.lootMode === "solo" && state.lootSoloUseMarket && getActiveLootAnalyzerText().trim()) {
      void refreshSoloLootMarketPricing();
      return;
    }

    if (!state.lootSoloUseMarket) {
      cancelSoloLootMarketLoading({ silent: true, rerender: false });
    }

    void saveLootAnalyzerDrafts();
    parseAndRenderLootSplitter();
  });

  els.lootDoubleXpToggle?.addEventListener("change", () => {
    state.lootSoloDoubleXp = Boolean(els.lootDoubleXpToggle.checked);
    void saveLootAnalyzerDrafts();
    if (state.lootMode === "solo" && state.lootParsed) {
      renderLootMonsters(state.lootParsed.monsters);
      return;
    }
    renderLootSplitter();
  });

  els.lootDoubleLootToggle?.addEventListener("change", () => {
    state.lootSoloDoubleLoot = Boolean(els.lootDoubleLootToggle.checked);
    void saveLootAnalyzerDrafts();
    if (state.lootMode === "solo" && state.lootParsed) {
      renderLootItems(state.lootParsed.items);
      return;
    }
    renderLootSplitter();
  });

  els.lootResetButton?.addEventListener("click", () => {
    resetLootSplitter();
  });

  els.lootHelpToggle?.addEventListener("click", () => {
    state.lootHelpOpen = !state.lootHelpOpen;
    renderLootHelp();
  });

  els.lootItemsGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-loot-item-name]");
    if (!button) {
      return;
    }

    void openLootItem(button.dataset.lootItemName || "");
  });

  els.lootMonstersGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-loot-monster-name]");
    if (!button) {
      return;
    }

    void openLootMonster(button.dataset.lootMonsterName || "");
  });

  els.lootOutput?.addEventListener("click", (event) => {
    const line = event.target.closest("[data-transfer-command]");

    if (
      !line ||
      !els.lootOutput.contains(line) ||
      !event.target.closest(".loot-output-transfer-text, .loot-output-copy-icon")
    ) {
      return;
    }

    void copyTransferCommand(line);
  });

  window.addEventListener("error", (event) => {
    const details = [
      event?.message || "Unknown renderer error",
      event?.filename ? `file=${event.filename}` : "",
      Number.isFinite(event?.lineno) ? `line=${event.lineno}` : "",
      Number.isFinite(event?.colno) ? `col=${event.colno}` : "",
      event?.error?.stack || ""
    ].filter(Boolean).join(" | ");
    console.error(`[renderer-error] ${details}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const details =
      reason?.stack ||
      reason?.message ||
      (typeof reason === "string" ? reason : JSON.stringify(reason));
    console.error(`[renderer-rejection] ${details || "Unknown rejection"}`);
  });

  els.lootOutput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const line = event.target.closest("[data-transfer-command]");

    if (!line || !els.lootOutput.contains(line)) {
      return;
    }

    event.preventDefault();
    void copyTransferCommand(line);
  });

  bindSkillDynamicTooltips(document);

  els.globalLoadingActionButton?.addEventListener("click", () => {
    const handler = state.globalLoadingAction?.onClick;

    if (typeof handler === "function") {
      handler();
    }
  });

  els.itemCurrencyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.itemCurrencyMode = button.dataset.mode;
      syncCurrencyButtons(els.itemCurrencyButtons, state.itemCurrencyMode);
      renderItem();
    });
  });

  els.imbuementCurrencyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.imbuementCurrencyMode = button.dataset.mode;
      syncCurrencyButtons(els.imbuementCurrencyButtons, state.imbuementCurrencyMode);
      syncManualTokenState();
      renderImbuement();
    });
  });

  els.imbuementTierButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.currentImbuementTier = button.dataset.tier || DEFAULT_IMBUEMENT_TIER;
      syncCurrencyButtons(els.imbuementTierButtons, state.currentImbuementTier, "tier");
      renderImbuementOptions();
      renderImbuement();
      void ensureIngredientMetadata()
        .then(() => renderImbuement())
      .catch(() => {});
    });
  });

  els.manualTokenToggle?.addEventListener("change", () => {
    state.manualGoldTokenEnabled = Boolean(els.manualTokenToggle.checked);
    els.manualTokenInput.disabled = !state.manualGoldTokenEnabled;
    syncManualTokenState();
    renderImbuement();
  });

  els.manualTokenInput?.addEventListener("input", () => {
    state.manualGoldTokenPrice = parseManualGoldValue(els.manualTokenInput.value);
    renderImbuement();
  });

  [els.ingredientTokenPanel, els.imbuementMixedRoutePanel].forEach((panel) => {
    panel?.addEventListener("change", handleImbuementRouteControlChange);
    panel?.addEventListener("input", handleImbuementRouteControlInput);
  });

  els.imbuementPickerTrigger.addEventListener("click", () => {
    state.imbuementPickerOpen = !state.imbuementPickerOpen;
    renderImbuementPickerState();
  });

  els.imbuementPickerGrid.addEventListener("click", (event) => {
    const option = event.target.closest("[data-imbuement-key]");
    if (!option) {
      return;
    }

    state.currentImbuementKey = option.dataset.imbuementKey || DEFAULT_IMBUEMENT_KEY;
    renderImbuementOptions();
    renderImbuement();
    void ensureIngredientMetadata()
      .then(() => renderImbuement())
      .catch(() => {});
  });

  els.npcTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.npcTab = button.dataset.npcTab || "buy";
      renderNpcTabs();
    });
  });

  if (isDesktopOverlayApp()) {
    els.desktopOpacityInput?.addEventListener("input", async () => {
      const opacityPercent = Number(els.desktopOpacityInput.value || 100);
      const opacity = opacityPercent / 100;
      syncDesktopOpacityUI(opacityPercent);
      await setDesktopOverlayOpacity(opacity).catch(() => {});
    });

    document.addEventListener("input", (event) => {
      const input = event.target.closest("#desktop-screenshot-upscale-input");
      if (!input) return;
      const factor = Math.min(20, Math.max(1, Math.round(Number(input.value) || 1)));
      const progress = ((factor - 1) / 19) * 100;
      input.value = String(factor);
      input.style.setProperty("--slider-progress", `${progress}%`);
      const value = input.closest(".desktop-screenshot-upscale-control")?.querySelector("strong");
      if (value) value.textContent = `${factor}x`;
      state.desktopScreenshotSettings = {
        ...(state.desktopScreenshotSettings || {}),
        upscaleFactor: factor
      };
      void window.desktopApi?.screenshots?.setUpscale?.(factor).then((result) => {
        if (result?.settings) state.desktopScreenshotSettings = result.settings;
      }).catch(() => {});
    });

    els.desktopMinimizeButton?.addEventListener("click", () => {
      void minimizeDesktopOverlay();
    });

    els.desktopCloseButton?.addEventListener("click", () => {
      void closeDesktopOverlay();
    });

    els.desktopUpdateButton?.addEventListener("click", () => {
      if (state.appUpdate?.phase !== "available" || state.appUpdateRequestPending) {
        return;
      }
      state.appUpdateRequestPending = true;
      renderDesktopUpdateUi();
      void window.desktopApi?.updater?.requestDownload?.()
        .catch(() => {})
        .finally(() => {
          state.appUpdateRequestPending = false;
          renderDesktopUpdateUi();
        });
    });

    els.desktopLibraryContentUpdateButton?.addEventListener("click", () => {
      // A prepared Library snapshot is activated at the next navigation edge,
      // avoiding a partial re-render of a detail page while it is being read.
      void activateLibraryContentAtSafePoint();
    });

    els.desktopSettingsButton?.addEventListener("click", () => {
      void openDesktopSettingsPanel();
    });

    els.desktopTibiaCoinsButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      // The toolbar is an in-app entry point.  It must always open the
      // Tibia Coins purchase panel; only the panel's confirmed purchase
      // action may then forward to an Admin-managed external destination.
      void openManagedDesktopCampaign();
    });

    document.addEventListener("click", (event) => {
      const tibiaCoinsButton = event.target.closest(".tibia-coins-cta");
      const settingsActionButton = event.target.closest("[data-settings-action]");

      if (settingsActionButton) {
        event.preventDefault();
        const action = settingsActionButton.dataset.settingsAction || "";
        if ((action === "capture-screenshot" || action === "open-screenshot-assistant") && (state.desktopScreenshotActionBusy || state.desktopScreenshotDiscoveryState === "searching")) {
          return;
        }

        if (action === "open-discord") {
          void openDesktopExternalLink(state.desktopSocialLinks.discord);
        } else if (action === "open-youtube") {
          void openDesktopExternalLink(state.desktopSocialLinks.youtube);
        } else if (action === "open-instagram") {
          void openDesktopExternalLink(state.desktopSocialLinks.instagram);
        } else if (action === "open-twitch") {
          void openDesktopExternalLink(state.desktopSocialLinks.twitch);
        } else if (action === "open-website") {
          void openDesktopExternalLink(DESKTOP_SETTINGS_WEBSITE_URL);
        } else if (action === "open-authenticator") {
          void requestDesktopDockedPanel("authenticator-panel");
        } else if (action === "reset-tutorial") {
          void window.desktopApi?.app?.tutorial?.resetAll?.();
        } else if (action === "open-account") {
          void openDesktopAccountPanel();
        } else if (action === "toggle-account") {
          void toggleDesktopAccountConnection();
        } else if (action === "toggle-screenshot-settings") {
          state.desktopScreenshotExpanded = !state.desktopScreenshotExpanded;
          // Keep this interaction in-place. Re-rendering the shared dock here
          // races its native resize notification and made the extension flash
          // open before the shell painted its previous markup again.
          const config = settingsActionButton.closest(".desktop-screenshot-option")?.querySelector(".desktop-screenshot-config");
          if (config) {
            config.hidden = !state.desktopScreenshotExpanded;
            config.style.display = state.desktopScreenshotExpanded ? "grid" : "none";
          }
        } else if (action === "start-screenshot-tutorial") {
          state.desktopScreenshotExpanded = true;
          renderDesktopSettingsPanelIntoDockedShell();
          window.setTimeout(() => window.TibiaToolsTutorial?.startScreenshotsTour?.(), 120);
        } else if (action === "open-screenshot-assistant") {
          void openDesktopScreenshotAssistant();
        } else if (action === "capture-screenshot") {
          void captureDesktopScreenshot();
        } else if (action === "toggle-delete-original") {
          void toggleDesktopScreenshotDeleteOriginal();
        } else if (action === "choose-screenshot-directory") {
          void chooseDesktopScreenshotDirectory();
        } else if (action === "choose-tibia-screenshot-directory") {
          void chooseDesktopTibiaScreenshotDirectory();
        } else if (action === "open-screenshot-directory") {
          void openDesktopScreenshotDirectory();
        }
        return;
      }

      const accountActionButton = event.target.closest("[data-account-action]");
      if (accountActionButton) {
        event.preventDefault();
        void handleDesktopAccountAction(accountActionButton.dataset.accountAction || "");
        return;
      }

      const reportKindButton = event.target.closest("[data-account-report-kind]");
      if (reportKindButton) {
        event.preventDefault();
        setDesktopReportKind(reportKindButton.dataset.accountReportKind || "suggestion", reportKindButton.closest("form"));
        return;
      }

      const reportSelectButton = event.target.closest("[data-account-report-select]");
      if (reportSelectButton) {
        event.preventDefault();
        startDesktopReportElementPicker();
        return;
      }

      const reportRemoveButton = event.target.closest("[data-account-report-remove]");
      if (reportRemoveButton) {
        event.preventDefault();
        removeDesktopReportElement(reportRemoveButton.dataset.accountReportRemove || "", reportRemoveButton.closest("form"));
        return;
      }

      if (!tibiaCoinsButton) {
        return;
      }

      event.preventDefault();
      void openManagedDesktopCampaign();
    });

    document.addEventListener("pointerover", (event) => {
      const screenshotButton = event.target.closest(".desktop-screenshot-select-icon");
      if (!screenshotButton) return;
      const previousAvailability = state.desktopScreenshotTibiaOpen;
      void refreshDesktopScreenshotAvailability().then(() => {
        if (previousAvailability !== state.desktopScreenshotTibiaOpen) {
          renderDesktopSettingsPanelIntoDockedShell();
        }
      });
    }, true);

    els.desktopAuthenticatorButton?.addEventListener("click", () => {
      void requestDesktopDockedPanel("authenticator-panel");
    });

    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-account-report-form]");
      if (!form) return;
      event.preventDefault();
      void submitDesktopAccountReport(form);
    });

    window.addEventListener("tibia-toolkit:open-report", () => {
      void openDesktopReportPanel();
    });

    window.addEventListener("tibia-toolkit:open-screenshot-assistant", () => {
      void openDesktopScreenshotAssistant();
    });

    window.addEventListener("tibia-toolkit:docked-panel-rendered", (event) => {
      const panelKey = String(event?.detail?.panelKey || "").trim();
      const requestedPanelKey = String(state.requestedDockedPanelKey || "").trim();
      // The native dock emits a short `open: false` packet while changing
      // bounds. Account/report panels are renderer-owned navigation views;
      // ignoring that packet let Screen Vision's empty placeholder win for a
      // frame (and sometimes remain visible). Keep the requested owner alive
      // through that transition, but ignore unrelated closed tool panels.
      const ownsTransientPanel = ["settings-panel", "account-panel", "report-panel"].includes(panelKey)
        && (Boolean(event?.detail?.open) || requestedPanelKey === panelKey);
      if (!ownsTransientPanel) {
        return;
      }
      if (panelKey === "settings-panel") {
        renderDesktopSettingsPanelIntoDockedShell();
      } else if (panelKey === "account-panel") {
        renderDesktopAccountPanelIntoDockedShell();
      } else if (panelKey === "report-panel") {
        renderDesktopReportPanelIntoDockedShell();
      }
    });

    els.desktopCoffeeButton?.addEventListener("click", () => {
      void requestDesktopDockedPanel("buy-me-a-coffee-panel");
    });

    els.desktopSupportersButton?.addEventListener("click", () => {
      void requestDesktopDockedPanel(SUPPORTER_DOCKED_PANEL_KEY);
    });

    window.desktopApi?.supportersShowcase?.onOpenPanel?.(() => {
      void requestDesktopDockedPanel(SUPPORTER_DOCKED_PANEL_KEY);
    });

    window.desktopApi?.supportersShowcase?.onOpenCoffeePanel?.(() => {
      void requestDesktopDockedPanel("buy-me-a-coffee-panel");
    });

    els.apiDocsButton?.addEventListener("click", () => {
      const docsUrl = new URL("docs/apis.html", window.location.href).href;
      void openDesktopExternalLink(docsUrl);
    });

    els.desktopDockedPanelClose?.addEventListener("click", () => {
      handleDesktopDockedPanelClose();
    });

    window.desktopApi?.screenVision?.events?.onDockedToolPanelStateChanged?.((panelState) => {
      handleDockedToolPanelStateChange(panelState);
    });
  }
}

function initializeSupporterState() {
  state.supporters = [];
  state.supporterToolbarIndex = 0;
  state.supporterNarrowMedalIndex = 0;
  state.coffeeConfig = createDefaultSupporterCoffeeConfig();
  syncSupporterToolbarRotation();
  syncDesktopCoffeeButtonVisibility();
}

async function loadSupportersData(options = {}) {
  const supportersDataUrls = normalizeSupportersDataUrls(
    options.supportersDataUrls,
    options.supportersDataUrl,
    state.supportersDataUrls,
    state.supportersDataUrl
  );
  state.supportersDataUrls = supportersDataUrls;
  state.supportersDataUrl = supportersDataUrls[0] || "";
  const cachedDocument = await loadCachedSupportersDocument().catch(() => null);
  const cachedRankingRates = await loadCachedSupporterRankingRates().catch(() => null);
  const initialRankingRates = cachedRankingRates || { ...DEFAULT_SUPPORTER_RANKING_RATES };
  const rankingRatesPromise = cachedRankingRates?.expiresAt > Date.now()
    ? Promise.resolve(cachedRankingRates)
    : refreshSupporterRankingRates(cachedRankingRates);

  if (supportersDataUrls.length <= 0) {
    applySupportersPayload({
      supporters: [],
      coffee: createDefaultSupporterCoffeeConfig()
    }, initialRankingRates);
    return;
  }

  try {
    const document = await fetchSupportersDocument(supportersDataUrls);
    const payload = normalizeSupportersPayload(document);
    await saveCachedSupportersDocument({
      updatedAt: document?.updatedAt || new Date().toISOString(),
      supporters: payload.supporters,
      coffee: payload.coffee
    }).catch(() => {});
    applySupportersPayload(payload, initialRankingRates);
    void refreshSupporterRankingAfterLoad(payload, rankingRatesPromise, initialRankingRates);

    if (payload.supporters.length > 0) {
      void hydrateSupporterProfiles();
    }
    return;
  } catch (_error) {
    if (cachedDocument) {
      applySupportersPayload(cachedDocument, initialRankingRates);
      void refreshSupporterRankingAfterLoad(cachedDocument, rankingRatesPromise, initialRankingRates);
      if (cachedDocument.supporters?.length) {
        void hydrateSupporterProfiles();
      }
      return;
    }
  }

  applySupportersPayload({
    supporters: [],
    coffee: createDefaultSupporterCoffeeConfig()
  }, initialRankingRates);
}

function applySupportersPayload(payload = {}, rankingRates = DEFAULT_SUPPORTER_RANKING_RATES) {
  const normalizedPayload = normalizeSupportersPayload(payload);
  state.supporterRankingRates = normalizeSupporterRankingRates(rankingRates);
  state.supporters = buildSupporterEntries(normalizedPayload.supporters, state.supporterRankingRates);
  state.coffeeConfig = normalizedPayload.coffee;
  state.supporterToolbarIndex = 0;
  state.supporterNarrowMedalIndex = 0;
  state.supporterProfilesRequestId += 1;
  syncSupporterToolbarRotation();
  renderSupporterToolbar();
  renderActiveDockedToolPanel();
}

function requestDesktopDockedPanel(panelKey) {
  const normalizedPanelKey = String(panelKey || "").trim();
  const currentPanelState = state.dockedToolPanelState || {};

  // Only My Account has a parent panel. Every other lateral panel, including
  // Report a Bug, must close directly instead of reviving an older panel.
  state.desktopDockedPanelReturnKey = normalizedPanelKey === "account-panel"
    ? "settings-panel"
    : "";

  // Account/report actions are idempotent. A second event while the same
  // panel is already visible must not restart its opening animation (or make
  // the panel appear blank while the transition is clipped).
  if (["account-panel", "report-panel"].includes(normalizedPanelKey)
    && currentPanelState.open
    && currentPanelState.panelKey === normalizedPanelKey
    && currentPanelState.phase !== "closed"
    && currentPanelState.phase !== "closing") {
    renderActiveDockedToolPanel();
    return Promise.resolve(true);
  }

  state.requestedDockedPanelKey = normalizedPanelKey;
  state.dockedToolPanelState = {
    ...state.dockedToolPanelState,
    open: true,
    panelKey: normalizedPanelKey,
    phase: state.dockedToolPanelState.phase === "left-pre-shift" ? "left-pre-shift" : "opening",
    width: state.dockedToolPanelState.width || 418
  };
  syncDockedToolPanelShell();
  renderActiveDockedToolPanel();

  // Reports/account are navigation surfaces, not toggle tools. A duplicate
  // late click or renderer event must keep them open; otherwise Electron's
  // normal dock toggle closes the panel just after it was rendered.
  if (["account-panel", "report-panel"].includes(normalizedPanelKey)
    && window.desktopApi?.screenVisionApi?.tools?.open) {
    return window.desktopApi.screenVisionApi.tools.open(normalizedPanelKey, { forceOpen: true });
  }
  return openDesktopScreenVisionWindow(normalizedPanelKey);
}

function handleDesktopDockedPanelClose() {
  const currentPanelKey = state.dockedToolPanelState.panelKey || SUPPORTER_DOCKED_PANEL_KEY;

  if (currentPanelKey === "account-panel") {
    state.desktopDockedPanelReturnKey = "";
    void requestDesktopDockedPanel("settings-panel");
    return;
  }

  state.desktopDockedPanelReturnKey = "";
  const closePanel = window.desktopApi?.screenVisionApi?.tools?.close;
  if (typeof closePanel === "function") {
    void closePanel(currentPanelKey).catch(() => null);
    return;
  }

  void openDesktopScreenVisionWindow(currentPanelKey);
}

function getDesktopDockedPanelElements() {
  const host = document.querySelector("#desktop-docked-panel");
  if (!host) return {};

  // The static document still contains the legacy header with a generic X.
  // Settings/account/report navigation must own the shell so it uses the
  // standard image button, even before Screen Vision has rebuilt it. Its side
  // and icon are synchronized in syncDockedToolPanelShell().
  if (!host.querySelector(".desktop-docked-panel-content") || !host.querySelector(".desktop-docked-tool-header")) {
    host.innerHTML = `
      <div class="desktop-docked-panel-shell">
        <header class="desktop-docked-tool-header desktop-docked-tool-header-right">
          <button type="button" class="desktop-docked-arrow-close desktop-docked-panel-close desktop-history-button desktop-window-image-button" id="desktop-docked-panel-close" aria-label="${escapeHtml(t("common.back"))}" data-tooltip="${escapeHtml(t("common.back"))}">
            <span class="desktop-window-icon-stack" aria-hidden="true">
              <img class="desktop-window-icon desktop-window-icon-idle" src="assets/ui/desktop-history/voltar-off.png" alt="">
              <img class="desktop-window-icon desktop-window-icon-active" src="assets/ui/desktop-history/voltar-on.png" alt="">
            </span>
          </button>
          <div class="desktop-docked-tool-heading">
            <strong id="desktop-docked-panel-title">Painel</strong>
            <small id="desktop-docked-panel-description"></small>
          </div>
        </header>
        <div class="desktop-docked-panel-content" id="desktop-docked-panel-content"></div>
      </div>
    `;
  }

  // Screen Vision is lazy-loaded and used to be able to replace this shared
  // host while an account/report panel was opening. Resolve the live nodes on
  // each render, instead of relying solely on references captured at boot.
  const closeButton = host.querySelector("#desktop-docked-panel-close");
  if (closeButton && closeButton.dataset.appDockedCloseBound !== "true") {
    closeButton.dataset.appDockedCloseBound = "true";
    closeButton.addEventListener("click", () => {
      handleDesktopDockedPanelClose();
    });
  }

  // Screen Vision is loaded lazily and may replace the shared dock shell
  // after the account/report renderer has painted it.  Watch that one host
  // only: if a replacement leaves an app-owned panel with the generic empty
  // body, restore the actual account/report surface on the next frame.
  if (host.dataset.appDockedOwnershipObserved !== "true") {
    host.dataset.appDockedOwnershipObserved = "true";
    const observer = new MutationObserver(() => {
      const activePanelKey = state.dockedToolPanelState?.panelKey || state.requestedDockedPanelKey;
      if (!host.isConnected || !["account-panel", "report-panel"].includes(activePanelKey)) return;
      const content = host.querySelector("#desktop-docked-panel-content, .desktop-docked-panel-content");
      // Both application-owned surfaces count as a populated shell. The
      // account view uses `.desktop-account-panel`, while the signed-in
      // report view is a `<form.desktop-report-panel>`.
      if (content?.querySelector(".desktop-settings-panel, .desktop-account-panel, .desktop-report-panel")) return;
      window.requestAnimationFrame(() => {
        const currentPanelKey = state.dockedToolPanelState?.panelKey || state.requestedDockedPanelKey;
        if (currentPanelKey === "settings-panel") renderDesktopSettingsPanelIntoDockedShell();
        if (currentPanelKey === "account-panel") renderDesktopAccountPanelIntoDockedShell();
        if (currentPanelKey === "report-panel") renderDesktopReportPanelIntoDockedShell();
      });
    });
    observer.observe(host, { childList: true, subtree: true });
  }

  return {
    host,
    title: host.querySelector("#desktop-docked-panel-title, .desktop-docked-tool-heading strong"),
    description: host.querySelector("#desktop-docked-panel-description, .desktop-docked-tool-heading small"),
    content: host.querySelector("#desktop-docked-panel-content, .desktop-docked-panel-content")
  };
}

async function openDesktopSettingsPanel() {
  await requestDesktopDockedPanel("settings-panel");
  state.desktopScreenshotDiscoveryState = "searching";
  renderDesktopSettingsPanelIntoDockedShell();
  await Promise.all([refreshDesktopAccountState({ refreshAds: true }), refreshDesktopScreenshotSettings(), refreshDesktopScreenshotAvailability()]);
  renderDesktopSettingsPanelIntoDockedShell();
}

async function openDesktopAccountPanel() {
  try {
    await requestDesktopDockedPanel("account-panel");
    await refreshDesktopAccountState({ refreshAds: true });
  } finally {
    // The account form is still useful if the background dock animation or
    // state refresh fails. Never leave the user with an empty side panel.
    renderDesktopAccountPanelIntoDockedShell();
  }
}

async function openDesktopReportPanel() {
  // Do not rely only on Screen Vision's late render event. When the account
  // is already connected that event can be skipped during a panel transition,
  // leaving the shared shell visible but empty. Render after both operations
  // in every account state.
  try {
    await requestDesktopDockedPanel("report-panel");
    await refreshDesktopAccountState();
  } finally {
    // See the account equivalent above. A report panel must render even when
    // the optional account refresh cannot complete.
    renderDesktopReportPanelIntoDockedShell();
    // The dock shell itself may be recreated by the animation bridge after
    // the awaited IPC call. Paint again on the next frames so the report form
    // is never replaced by an empty shell during that hand-off.
    window.requestAnimationFrame(() => renderDesktopReportPanelIntoDockedShell());
    // Native resize/state messages can arrive after the first frame. Repeat
    // only while Report remains the requested panel, so a later close cannot
    // resurrect it, while the real form still wins over the generic fallback.
    for (const delay of [80, 240, 600]) {
      window.setTimeout(() => {
        if ((state.dockedToolPanelState?.panelKey || state.requestedDockedPanelKey) === "report-panel") {
          renderDesktopReportPanelIntoDockedShell();
        }
      }, delay);
    }
  }
}

function renderDesktopAccountPanelIntoDockedShell() {
  renderDesktopAccountPanelIntoDockedShellByKey("account-panel", t("account.title"), renderDesktopAccountPanelMarkup);
}

function renderDesktopSettingsPanelIntoDockedShell() {
  renderDesktopAccountPanelIntoDockedShellByKey("settings-panel", t("screenVision.settings.title"), renderDesktopSettingsPanelMarkup);
}

function renderDesktopReportPanelIntoDockedShell() {
  renderDesktopAccountPanelIntoDockedShellByKey("report-panel", t("account.report.title"), renderDesktopReportPanelMarkup);
}

function renderDesktopAccountPanelIntoDockedShellByKey(panelKey, panelTitle, renderMarkup) {
  const { host, title, description, content } = getDesktopDockedPanelElements();
  const panelState = state.dockedToolPanelState || {};
  const requestedPanelKey = String(state.requestedDockedPanelKey || "").trim();
  const shellPanelKey = String(document.body?.dataset?.dockedPanelKey || "").trim();
  const ownsRequestedShell = requestedPanelKey === panelKey || shellPanelKey === panelKey;

  // Electron can briefly announce an empty/closed state while the dock is
  // transitioning. Account and report are navigation panels: once requested,
  // their real content must win over that transient packet instead of leaving
  // a visibly blank side panel.
  if (!host || (panelState.panelKey !== panelKey && !ownsRequestedShell)) {
    return;
  }

  if (!content) {
    return;
  }

  if (title) title.textContent = panelTitle;
  // Keep the shared description node in the DOM. Removing it leaves cached
  // renderer references detached after the panel shell is refreshed.
  if (description) description.textContent = "";
  content.innerHTML = renderMarkup();
  if (panelKey === "settings-panel" || panelKey === "report-panel") {
    syncDesktopScreenshotActionBusyUi();
  }
  // Use the one floating-tooltip binder shared by the rest of the app.  The
  // previous call referenced a stale helper name, so freshly-rendered account
  // and report controls never acquired their standard hover tooltip.
  bindSkillDynamicTooltips(content);
}

function syncDesktopScreenshotActionBusyUi() {
  const busy = Boolean(state.desktopScreenshotActionBusy) || state.desktopScreenshotDiscoveryState === "searching";
  document.querySelectorAll('[data-settings-action="open-screenshot-assistant"], [data-settings-action="capture-screenshot"], #tt-screenshot-context-button').forEach((button) => {
    button.disabled = busy;
    button.classList.toggle("screenshot-action-busy", busy);
    if (busy) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  });
}

function setDesktopScreenshotActionBusy(busy) {
  state.desktopScreenshotActionBusy = Boolean(busy);
  syncDesktopScreenshotActionBusyUi();
  window.dispatchEvent(new CustomEvent("tibia-toolkit:screenshot-action-state", {
    detail: { busy: state.desktopScreenshotActionBusy }
  }));
}

async function handleDesktopAccountAction(action) {
  if (action === "connect" || action === "connect-report") {
    await connectDesktopAccount({ openPanel: action === "connect-report" ? "report-panel" : "account-panel" });
    return;
  }
  if (action === "report") {
    await openDesktopReportPanel();
    return;
  }
  if (action === "remove-ads") {
    await requestDesktopDockedPanel("buy-me-a-coffee-panel");
    return;
  }
  if (action === "proof-discord") {
    await openDesktopExternalLink(state.desktopSocialLinks.discord);
    return;
  }
  if (action === "edit-character") {
    await window.desktopApi?.account?.openPage?.("profile");
    return;
  }
  if (action === "reports" || action === "proof" || action === "settings") {
    await window.desktopApi?.account?.openPage?.(action === "settings" ? "account" : action);
    return;
  }
  if (action === "logout") {
    await toggleDesktopAccountConnection();
  }
}

function getDesktopReportPageLabel() {
  const labels = {
    "item-prices": "Preços dos itens",
    "item-stash": "Stash",
    "item-books": "Livros",
    "npcs": "NPCs e criaturas",
    "tools": "Ferramentas"
  };
  return labels[state.selectedSection] || "Tibia Toolkit app";
}

const DESKTOP_REPORT_KIND_COPY = {
  suggestion: {
    icon: "assets/ui/feedback/suggestion.png",
    titleKey: "account.report.suggestionTitle",
    detailKey: "account.report.suggestionDetails"
  },
  bug: {
    icon: "assets/ui/feedback/bug-nostalgia.gif",
    titleKey: "account.report.bugTitle",
    detailKey: "account.report.bugDetails"
  },
  correction: {
    icon: "assets/ui/feedback/correction.png",
    titleKey: "account.report.correctionTitle",
    detailKey: "account.report.correctionDetails"
  }
};

function normalizeDesktopReportKind(value) {
  return Object.prototype.hasOwnProperty.call(DESKTOP_REPORT_KIND_COPY, value) ? value : "suggestion";
}

function desktopReportSelectorFor(element) {
  if (element?.id) return `#${CSS.escape(element.id)}`;
  const parts = [];
  let current = element;
  while (current && current.tagName?.toLowerCase() !== "body" && parts.length < 5) {
    const tag = current.tagName.toLowerCase();
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter((entry) => entry.tagName === current.tagName)
      : [];
    parts.unshift(`${tag}:nth-of-type(${Math.max(1, siblings.indexOf(current) + 1)})`);
    if (current.matches?.("main, .content-panel, .workspace-shell, .main-content")) break;
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function desktopReportElementLabel(element) {
  return String(element?.getAttribute?.("aria-label") || element?.textContent || element?.tagName || "Elemento")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90) || "Elemento";
}

function desktopReportPickerIgnored(element) {
  return !element || Boolean(element.closest?.(".desktop-docked-panel, .desktop-report-picker-hud, .desktop-report-element-highlight, .tt-tour-context-button, .global-loading-overlay, .desktop-window-controls"));
}

function closeDesktopReportElementPicker() {
  const cleanup = state.desktopReportPickerCleanup;
  state.desktopReportPickerCleanup = null;
  cleanup?.();
}

function ensureDesktopReportPickerElements() {
  let hud = document.querySelector("#desktop-report-picker-hud");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "desktop-report-picker-hud";
    hud.className = "desktop-report-picker-hud";
    hud.setAttribute("role", "status");
    document.body.appendChild(hud);
  }
  let highlight = document.querySelector("#desktop-report-element-highlight");
  if (!highlight) {
    highlight = document.createElement("div");
    highlight.id = "desktop-report-element-highlight";
    highlight.className = "desktop-report-element-highlight";
    highlight.setAttribute("aria-hidden", "true");
    document.body.appendChild(highlight);
  }
  return { hud, highlight };
}

function renderDesktopReportSelectedElements(form) {
  const container = form?.querySelector?.("[data-account-report-selected]");
  if (!container) return;
  container.innerHTML = state.desktopReportSelectedElements.map((element) => `
    <div><strong>${escapeHtml(element.id ? `#${element.id}` : element.label)}</strong><span>${escapeHtml(element.selector)}</span><button type="button" data-account-report-remove="${escapeHtml(element.selector)}" aria-label="${escapeHtml(t("account.report.removeElement"))}" data-tooltip="${escapeHtml(t("account.report.removeElement"))}"><img src="assets/ui/Cross.png" alt=""></button></div>
  `).join("");
  container.hidden = state.desktopReportSelectedElements.length === 0;
}

function setDesktopReportKind(value, form = null) {
  const kind = normalizeDesktopReportKind(value);
  state.desktopReportKind = kind;
  const target = form || document.querySelector("[data-account-report-form]");
  if (!target) return;
  const copy = DESKTOP_REPORT_KIND_COPY[kind];
  const field = target.querySelector("[name=kind]");
  if (field) field.value = kind;
  target.querySelectorAll("[data-account-report-kind]").forEach((button) => {
    const selected = button.dataset.accountReportKind === kind;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const titleLabel = target.querySelector("[data-account-report-title-label]");
  const titleInput = target.querySelector("[name=title]");
  const detail = target.querySelector("[name=body]");
  if (titleLabel) titleLabel.textContent = t(copy.titleKey);
  if (titleInput) titleInput.placeholder = t(copy.titleKey);
  if (detail) detail.placeholder = t(copy.detailKey);
}

function removeDesktopReportElement(selector, form = null) {
  state.desktopReportSelectedElements = state.desktopReportSelectedElements.filter((entry) => entry.selector !== selector);
  renderDesktopReportSelectedElements(form || document.querySelector("[data-account-report-form]"));
}

function startDesktopReportElementPicker() {
  closeDesktopReportElementPicker();
  const { hud, highlight } = ensureDesktopReportPickerElements();
  hud.innerHTML = `${escapeHtml(t("account.report.selectElement"))} <small>Esc</small>`;
  hud.hidden = false;
  highlight.hidden = true;
  document.body.classList.add("desktop-report-element-picker-active");
  const elementAt = (event) => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (desktopReportPickerIgnored(element)) {
      highlight.hidden = true;
      return null;
    }
    const rect = element.getBoundingClientRect();
    highlight.style.left = `${rect.left - 4}px`;
    highlight.style.top = `${rect.top - 4}px`;
    highlight.style.width = `${rect.width + 8}px`;
    highlight.style.height = `${rect.height + 8}px`;
    highlight.hidden = false;
    return element;
  };
  const move = (event) => { elementAt(event); };
  const key = (event) => { if (event.key === "Escape") closeDesktopReportElementPicker(); };
  const click = (event) => {
    const element = elementAt(event);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    const selected = { id: element.id || null, selector: desktopReportSelectorFor(element), label: desktopReportElementLabel(element) };
    if (!state.desktopReportSelectedElements.some((entry) => entry.selector === selected.selector)) {
      state.desktopReportSelectedElements = [...state.desktopReportSelectedElements, selected];
    }
    closeDesktopReportElementPicker();
    renderDesktopReportSelectedElements(document.querySelector("[data-account-report-form]"));
  };
  document.addEventListener("pointermove", move, true);
  document.addEventListener("click", click, true);
  document.addEventListener("keydown", key, true);
  state.desktopReportPickerCleanup = () => {
    document.body.classList.remove("desktop-report-element-picker-active");
    hud.hidden = true;
    highlight.hidden = true;
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("click", click, true);
    document.removeEventListener("keydown", key, true);
  };
}

async function submitDesktopAccountReport(form) {
  const status = form.querySelector("[data-account-report-status]");
  const submit = form.querySelector("button[type=submit]");
  const data = new FormData(form);
  if (submit) submit.disabled = true;
  if (status) status.textContent = "";
  try {
    await window.desktopApi?.account?.submitFeedback?.({
      kind: data.get("kind"),
      title: data.get("title"),
      body: `${String(data.get("body") || "").trim()}${state.desktopReportSelectedElements.length ? `\n\n${t("account.report.selectedElements")}\n${t("account.report.page")}: ${getDesktopReportPageLabel()}\n${state.desktopReportSelectedElements.map((element, index) => `${index + 1}. ${element.label}\n   ${t("account.report.selector")}: ${element.selector}${element.id ? `\n   ID: #${element.id}` : ""}`).join("\n")}` : `\n\n${t("account.report.page")}: ${getDesktopReportPageLabel()}`}`,
      locale: state.localeController?.getLocale?.() || "pt-BR",
      pageLabel: getDesktopReportPageLabel()
    });
    form.reset();
    state.desktopReportKind = "suggestion";
    state.desktopReportSelectedElements = [];
    setDesktopReportKind("suggestion", form);
    renderDesktopReportSelectedElements(form);
    if (status) status.textContent = t("account.report.sent");
    await refreshDesktopAccountState();
  } catch (error) {
    if (status) status.textContent = error?.message || t("account.report.failed");
  } finally {
    if (submit) submit.disabled = false;
  }
}

function normalizeSupportersDataUrls(...values) {
  const urls = [];
  for (const value of values) {
    const entries = Array.isArray(value) ? value : [value];
    for (const entry of entries) {
      for (const candidate of String(entry || "").split(",")) {
        const normalized = candidate.trim();
        if (/^https?:\/\//i.test(normalized) && !urls.includes(normalized)) {
          urls.push(normalized);
        }
      }
    }
  }
  return urls;
}

async function fetchSupportersDocument(urls) {
  if (window.desktopApi?.supporters?.fetchDocument) {
    return window.desktopApi.supporters.fetchDocument();
  }

  let lastError = null;
  for (const url of normalizeSupportersDataUrls(urls)) {
    const controller = typeof AbortController === "function"
      ? new AbortController()
      : null;
    const timeoutId = controller
      ? window.setTimeout(() => controller.abort(), SUPPORTERS_FETCH_TIMEOUT_MS)
      : 0;

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller?.signal
      });

      if (!response.ok) {
        throw new Error(`Supporters fetch failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  throw lastError || new Error("Nenhuma fonte de apoiadores esta disponivel.");
}

async function refreshSupporterRankingRates(cachedRates = null) {
  try {
    const remoteRates = await fetchSupporterRankingRates();
    const normalizedRates = normalizeSupporterRankingRates(remoteRates);
    await saveCachedSupporterRankingRates(normalizedRates).catch(() => {});
    return normalizedRates;
  } catch (_error) {
    return cachedRates || { ...DEFAULT_SUPPORTER_RANKING_RATES };
  }
}

async function refreshSupporterRankingAfterLoad(payload, rankingRatesPromise, initialRankingRates) {
  const refreshedRates = await rankingRatesPromise;
  const initial = normalizeSupporterRankingRates(initialRankingRates);
  const refreshed = normalizeSupporterRankingRates(refreshedRates);
  if (
    Math.abs(initial.usdToBrl - refreshed.usdToBrl) < 0.0001
    && Math.abs(initial.tibiaCoinBrl - refreshed.tibiaCoinBrl) < 0.0001
  ) {
    return;
  }

  applySupportersPayload(payload, refreshed);
  if (state.supporters.length > 0) {
    void hydrateSupporterProfiles();
  }
}

async function fetchSupporterRankingRates() {
  if (window.desktopApi?.supporters?.fetchRankingRates) {
    return window.desktopApi.supporters.fetchRankingRates();
  }

  throw new Error("As cotacoes de ranking exigem o processo principal do aplicativo.");
}

function normalizeSupporterRankingRates(source = {}) {
  const usdToBrl = Number(source?.usdToBrl);
  const tibiaCoinBrl = Number(source?.tibiaCoinBrl);
  const expiresAt = Number(source?.expiresAt);

  return {
    usdToBrl: Number.isFinite(usdToBrl) && usdToBrl > 0 ? usdToBrl : DEFAULT_SUPPORTER_RANKING_RATES.usdToBrl,
    tibiaCoinBrl: Number.isFinite(tibiaCoinBrl) && tibiaCoinBrl > 0 ? tibiaCoinBrl : DEFAULT_SUPPORTER_RANKING_RATES.tibiaCoinBrl,
    expiresAt: Number.isFinite(expiresAt) && expiresAt > 0
      ? expiresAt
      : Date.now() + SUPPORTERS_RANKING_RATES_CACHE_MS
  };
}

async function loadCachedSupporterRankingRates() {
  const stored = await localStorageGet(SUPPORTERS_RANKING_RATES_CACHE_KEY).catch(() => ({}));
  const entry = stored?.[SUPPORTERS_RANKING_RATES_CACHE_KEY];
  return entry && typeof entry === "object" ? normalizeSupporterRankingRates(entry) : null;
}

async function saveCachedSupporterRankingRates(rates) {
  await localStorageSet({
    [SUPPORTERS_RANKING_RATES_CACHE_KEY]: normalizeSupporterRankingRates(rates)
  });
}

function normalizeSupportersDocument(document) {
  if (Array.isArray(document)) {
    return document;
  }

  if (document && typeof document === "object" && Array.isArray(document.supporters)) {
    return document.supporters;
  }

  return [];
}

function normalizeSupportersPayload(document) {
  return {
    supporters: normalizeSupportersDocument(document),
    coffee: normalizeSupporterCoffeeConfig(document?.coffee)
  };
}

async function loadCachedSupportersDocument() {
  const stored = await localStorageGet(SUPPORTERS_STORAGE_CACHE_KEY).catch(() => ({}));
  const entry = stored?.[SUPPORTERS_STORAGE_CACHE_KEY];

  if (!entry || typeof entry !== "object") {
    return null;
  }

  return {
    updatedAt: String(entry.updatedAt || "").trim(),
    supporters: normalizeSupportersDocument(entry),
    coffee: normalizeSupporterCoffeeConfig(entry?.coffee)
  };
}

async function saveCachedSupportersDocument(document) {
  const payload = normalizeSupportersPayload(document);
  await localStorageSet({
    [SUPPORTERS_STORAGE_CACHE_KEY]: {
      updatedAt: String(document?.updatedAt || new Date().toISOString()).trim(),
      supporters: payload.supporters,
      coffee: payload.coffee
    }
  });
}

function createDefaultSupporterCoffeeConfig() {
  return {
    buttonVisible: true,
    sections: {
      tibiaCoins: true,
      pix: true,
      mercadoPago: true
    }
  };
}

function normalizeSupporterCoffeeConfig(source = {}) {
  const defaults = createDefaultSupporterCoffeeConfig();
  const sections = source?.sections && typeof source.sections === "object"
    ? source.sections
    : {};

  return {
    buttonVisible: coerceSupporterCoffeeBoolean(
      source?.buttonVisible ?? source?.showButton ?? source?.enabled,
      defaults.buttonVisible
    ),
    sections: {
      tibiaCoins: coerceSupporterCoffeeBoolean(
        sections.tibiaCoins ?? source?.tibiaCoins?.enabled ?? source?.tibiaCoinsEnabled,
        defaults.sections.tibiaCoins
      ),
      pix: coerceSupporterCoffeeBoolean(
        sections.pix ?? source?.pix?.enabled ?? source?.pixEnabled,
        defaults.sections.pix
      ),
      mercadoPago: coerceSupporterCoffeeBoolean(
        sections.mercadoPago ?? sections.mercadopago ?? source?.mercadoPago?.enabled ?? source?.mercadopago?.enabled ?? source?.mercadoPagoEnabled,
        defaults.sections.mercadoPago
      )
    }
  };
}

function coerceSupporterCoffeeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      return fallback;
    }

    if (["1", "true", "yes", "sim", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "nao", "não", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function hasVisibleSupporterCoffeeSections(config = state.coffeeConfig) {
  const sections = config?.sections || {};
  return Boolean(sections.tibiaCoins || sections.pix || sections.mercadoPago);
}

function shouldShowDesktopCoffeeButton(config = state.coffeeConfig) {
  return Boolean(config?.buttonVisible && hasVisibleSupporterCoffeeSections(config));
}

function buildSupporterEntries(seeds = [], rankingRates = DEFAULT_SUPPORTER_RANKING_RATES) {
  const normalizedRates = normalizeSupporterRankingRates(rankingRates);
  return [...seeds]
    .map((seed) => {
      const totalAmountCents = resolveSupporterAmountCents(seed);
      const currency = resolveSupporterCurrency(seed);
      return {
        name: String(seed.characterName || seed.name || "").trim(),
        avatarUrl: String(seed.avatarUrl || "").trim(),
        vocation: String(seed.vocation || "").trim(),
        sex: String(seed.sex || "").trim(),
        level: Number.isFinite(Number(seed.level)) ? Math.round(Number(seed.level)) : null,
        world: String(seed.world || "").trim(),
        guild: String(seed.guild || "").trim(),
        linkUrl: resolveSupporterLinkUrl(seed),
        linkLabel: resolveSupporterLinkLabel(seed),
        showcase: resolveSupporterShowcaseConfig(seed),
        currency,
        totalAmountCents,
        rankingValueCents: resolveSupporterRankingValueCents(totalAmountCents, currency, normalizedRates),
        amountLabel: formatSupporterAmount(totalAmountCents, currency)
      };
    })
    .filter((entry) => Boolean(entry.name))
    .sort((left, right) => right.rankingValueCents - left.rankingValueCents || left.name.localeCompare(right.name))
    .map((entry, index) => {
      const tier = getSupporterTierForIndex(index);
      return {
        ...entry,
        rank: index + 1,
        tier,
        tierMeta: getSupporterTierMeta(tier)
      };
    });
}

function resolveSupporterLinkUrl(seed = {}) {
  const linkSource = seed.link && typeof seed.link === "object"
    ? seed.link
    : {};
  const enabled = coerceSupporterCoffeeBoolean(
    linkSource.enabled ?? seed.linkEnabled,
    false
  );

  if (!enabled) {
    return "";
  }

  return normalizeExternalHttpUrl(linkSource.url ?? seed.linkUrl);
}

function resolveSupporterLinkLabel(seed = {}) {
  const linkSource = seed.link && typeof seed.link === "object"
    ? seed.link
    : {};
  return String(linkSource.label ?? seed.linkLabel ?? "").trim().slice(0, 140);
}

function normalizeExternalHttpUrl(value) {
  const rawUrl = String(value || "").trim();

  if (!rawUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return "";
    }

    if (parsedUrl.hostname.toLowerCase() === "www.danielhatano.com.br") {
      parsedUrl.searchParams.set("tracking", "tibiatoolkit");
    }

    return parsedUrl.href;
  } catch (_error) {
    return "";
  }
}

function bindSupporterCardActions(root) {
  root?.querySelectorAll("[data-supporter-link-url]").forEach((card) => {
    if (card.dataset.supporterLinkBound === "true") {
      return;
    }

    card.dataset.supporterLinkBound = "true";
    card.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void openSupporterCardLink(card);
    });
    card.addEventListener("keydown", (event) => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void openSupporterCardLink(card);
    });
  });
}

async function openSupporterCardLink(card) {
  const url = normalizeExternalHttpUrl(card?.dataset?.supporterLinkUrl);
  if (!url) {
    return false;
  }

  card.dataset.supporterLinkStatus = "opening";
  try {
    await openDesktopExternalLink(url);
    card.dataset.supporterLinkStatus = "opened";
    return true;
  } catch (error) {
    card.dataset.supporterLinkStatus = "error";
    console.error("[supporter-link] Nao foi possivel abrir o link externo.", error);
    return false;
  }
}

function resolveSupporterAmountCents(seed = {}) {
  if (Number.isFinite(Number(seed.amountTotalCents))) {
    return Math.max(0, Math.round(Number(seed.amountTotalCents)));
  }

  if (Number.isFinite(Number(seed.amountCents))) {
    return Math.max(0, Math.round(Number(seed.amountCents)));
  }

  const parsedTotalAmount = parseSupporterAmountToCents(seed.totalAmount);
  if (parsedTotalAmount !== null) {
    return parsedTotalAmount;
  }

  const parsedAmount = parseSupporterAmountToCents(seed.amount);
  if (parsedAmount !== null) {
    return parsedAmount;
  }

  if (Array.isArray(seed.donations)) {
    return seed.donations.reduce((total, donation) => {
      if (Number.isFinite(Number(donation?.amountCents))) {
        return total + Math.max(0, Math.round(Number(donation.amountCents)));
      }

      const parsedDonationAmount = parseSupporterAmountToCents(donation?.amount);
      if (parsedDonationAmount !== null) {
        return total + parsedDonationAmount;
      }

      return total;
    }, 0);
  }

  return 0;
}

function parseSupporterAmountToCents(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 100));
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return null;
  }

  const normalizedValue = rawValue.replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
  if (!normalizedValue || !/\d/.test(normalizedValue)) {
    return null;
  }

  const lastCommaIndex = normalizedValue.lastIndexOf(",");
  const lastDotIndex = normalizedValue.lastIndexOf(".");
  const decimalIndex = Math.max(lastCommaIndex, lastDotIndex);
  const hasExplicitDecimals = decimalIndex >= 0
    && /^\d{1,2}$/.test(normalizedValue.slice(decimalIndex + 1).replace(/[^\d]/g, ""))
    && (/\d/.test(normalizedValue.slice(0, decimalIndex)) || decimalIndex === 0);

  const integerPart = hasExplicitDecimals
    ? normalizedValue.slice(0, decimalIndex)
    : normalizedValue;
  const fractionPart = hasExplicitDecimals
    ? normalizedValue.slice(decimalIndex + 1)
    : "";

  const integerDigits = integerPart.replace(/[^\d]/g, "");
  const fractionDigits = fractionPart.replace(/[^\d]/g, "");

  if (!integerDigits && !fractionDigits) {
    return null;
  }

  const wholeUnits = integerDigits ? Number(integerDigits) : 0;
  const cents = hasExplicitDecimals
    ? Number((fractionDigits + "00").slice(0, 2))
    : 0;

  return Math.max(0, (wholeUnits * 100) + cents);
}

function resolveSupporterCurrency(seed = {}) {
  const directCurrency = [
    seed.currency,
    seed.currencyLabel,
    seed.currencySymbol,
    seed.unit,
    seed.amountCurrency
  ].find((value) => String(value || "").trim());

  if (directCurrency) {
    return String(directCurrency).trim();
  }

  if (Array.isArray(seed.donations)) {
    const donationCurrency = seed.donations
      .map((donation) => [
        donation?.currency,
        donation?.currencyLabel,
        donation?.currencySymbol,
        donation?.unit,
        donation?.amountCurrency
      ].find((value) => String(value || "").trim()))
      .find(Boolean);

    if (donationCurrency) {
      return String(donationCurrency).trim();
    }
  }

  const amountCurrency = [seed.totalAmount, seed.amount]
    .map((value) => String(value || "").match(/^\s*(R\$|US\$|U\$|\$|USD|TC|Tibia\s*Coins?|BRL|Reais?)/i)?.[1])
    .find(Boolean);

  if (amountCurrency) {
    return amountCurrency;
  }

  return "R$";
}

function resolveSupporterCurrencyKind(currency = "") {
  const normalized = String(currency || "R$")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (normalized.includes("TIBIA") || normalized === "TC") {
    return "tc";
  }

  if (normalized === "R$" || normalized.includes("BRL") || normalized.includes("REAL")) {
    return "brl";
  }

  if (normalized === "$" || normalized === "U$" || normalized === "US$" || normalized.includes("USD") || normalized.includes("DOLAR") || normalized.includes("DOLLAR")) {
    return "usd";
  }

  return "brl";
}

function resolveSupporterRankingValueCents(totalAmountCents, currency, rankingRates = DEFAULT_SUPPORTER_RANKING_RATES) {
  const amountUnits = Math.max(0, Number(totalAmountCents) || 0) / 100;
  const rates = normalizeSupporterRankingRates(rankingRates);
  const kind = resolveSupporterCurrencyKind(currency);
  const multiplier = kind === "tc"
    ? rates.tibiaCoinBrl
    : kind === "usd"
      ? rates.usdToBrl
      : 1;
  return Math.max(0, Math.round(amountUnits * multiplier * 100));
}

function getSupporterTierForIndex(index) {
  return SUPPORTER_TIER_ORDER[index] || "default";
}

function getSupporterTierMeta(tier) {
  const meta = SUPPORTER_TIER_META[tier] || SUPPORTER_TIER_META.default;
  return {
    ...meta,
    label: t(meta.labelKey)
  };
}

function formatSupporterAmount(amountCents, currency = "R$") {
  const safeAmountCents = Number.isFinite(Number(amountCents)) ? Math.max(0, Math.round(Number(amountCents))) : 0;
  const minimumFractionDigits = safeAmountCents % 100 === 0 ? 0 : 2;
  const numberLabel = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits,
    maximumFractionDigits: 2
  }).format(safeAmountCents / 100);
  const currencyLabel = String(currency || "").trim();
  return currencyLabel ? `${currencyLabel} ${numberLabel}` : numberLabel;
}

function syncSupporterToolbarRotation() {
  if (state.supporterNarrowMedalTimer) {
    clearInterval(state.supporterNarrowMedalTimer);
  }

  if (state.supporters.length <= 0) {
    return;
  }

  const rotatingTopSupporters = state.supporters.slice(0, 3);
  state.supporterNarrowMedalTimer = window.setInterval(() => {
    if (rotatingTopSupporters.length <= 0) {
      return;
    }

    state.supporterNarrowMedalIndex = (state.supporterNarrowMedalIndex + 1) % rotatingTopSupporters.length;
    renderSupporterToolbar();
  }, 1800);
}

function syncSupportersShowcase(supporters = state.supporters) {
  const showcaseApi = window.desktopApi?.supportersShowcase;
  if (!showcaseApi?.update) {
    return;
  }

  const payload = {
    supporters: (Array.isArray(supporters) ? supporters : [])
      .slice(0, 5)
      .map((supporter) => {
        const tier = String(supporter?.tier || "default").trim().toLowerCase();
        const tierMeta = getSupporterTierMeta(tier);
        return {
          name: String(supporter?.name || "").trim(),
          tier,
          medalPath: tierMeta.medalPath,
          backgroundPath: `assets/ui/supporters/fundo-${({ diamond: "diamante", gold: "ouro", silver: "prata", bronze: "bronze", iron: "ferro" }[tier] || "prata")}.gif`
        };
      })
      .filter((supporter) => supporter.name && supporter.medalPath)
  };
  const signature = JSON.stringify(payload);
  if (signature === state.supporterShowcaseSignature) {
    return;
  }

  state.supporterShowcaseSignature = signature;
  showcaseApi.update(payload);
}

function renderSupporterToolbar() {
  const supporters = state.supporters;
  const activeSupporter = supporters[0] || null;
  const narrowSupporters = supporters.slice(0, 3);
  const narrowSupporter = narrowSupporters[state.supporterNarrowMedalIndex] || activeSupporter;

  if (!els.desktopSupportersSlot || !els.desktopSupportersButton) {
    return;
  }

  syncSupportersShowcase(supporters);

  const hasSupporters = Boolean(activeSupporter);
  els.desktopSupportersSlot.hidden = !hasSupporters;
  els.desktopSupportersSlot.classList.toggle("is-empty", !hasSupporters);
  els.desktopSupportersButton.disabled = !hasSupporters;

  if (!hasSupporters) {
    if (els.desktopSupportersMarqueeTrack) {
      els.desktopSupportersMarqueeTrack.innerHTML = "";
    }
    syncDesktopCoffeeButtonVisibility();
    return;
  }

  const narrowTierMeta = getSupporterTierMeta(narrowSupporter?.tier || "default");

  els.desktopSupportersButton.dataset.supporterTier = activeSupporter.tier || "default";
  els.desktopSupportersButton.setAttribute("aria-label", t("screenVision.supporters.heading"));

  if (els.desktopSupportersActiveMedal) {
    els.desktopSupportersActiveMedal.src = narrowTierMeta.medalPath;
    els.desktopSupportersActiveMedal.alt = narrowTierMeta.label;
  }

  if (els.desktopSupportersMarqueeTrack) {
    const marqueeItems = supporters.slice(0, 5);
    const itemMarkup = marqueeItems
      .map((supporter) => {
        const tierMeta = getSupporterTierMeta(supporter.tier || "default");
        return `
          <span class="desktop-supporters-marquee-item desktop-supporters-marquee-item-${escapeHtml(supporter.tier || "default")}">
            <img src="${escapeHtml(tierMeta.medalPath)}" alt="${escapeHtml(tierMeta.label)}">
            <strong>${escapeHtml(supporter.name || "-")}</strong>
          </span>
        `;
      })
      .join("");

    const durationSeconds = Math.max(14, marqueeItems.length * 4.4);
    els.desktopSupportersMarqueeTrack.style.setProperty("--supporters-marquee-duration", `${durationSeconds}s`);
    els.desktopSupportersMarqueeTrack.innerHTML = `
      <span class="desktop-supporters-marquee-copy">${itemMarkup}</span>
      <span class="desktop-supporters-marquee-copy" aria-hidden="true">${itemMarkup}</span>
    `;
  }

  syncDesktopCoffeeButtonVisibility();
}

function syncDesktopCoffeeButtonVisibility() {
  const button = els.desktopCoffeeButton;

  if (!button) {
    return;
  }

  const shouldShow = shouldShowDesktopCoffeeButton();
  button.hidden = !shouldShow;
  button.disabled = !shouldShow;
  button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  button.style.display = shouldShow ? "" : "none";
}

async function hydrateSupporterProfiles() {
  const supporterNames = state.supporters.map((entry) => entry.name).filter(Boolean);

  if (supporterNames.length <= 0) {
    return;
  }

  const requestId = ++state.supporterProfilesRequestId;

  try {
    const profiles = await fetchCharacterProfiles({
      names: supporterNames
    });

    if (requestId !== state.supporterProfilesRequestId) {
      return;
    }

    const profileEntries = Object.entries(profiles || {});
    const profileMap = new Map(
      profileEntries.map(([name, profile]) => [String(name || "").trim().toLowerCase(), profile])
    );

    state.supporters = state.supporters.map((entry) => {
      const profile = profileMap.get(entry.name.toLowerCase()) || null;

      if (!profile) {
        return entry;
      }

      return {
        ...entry,
        name: String(profile.name || entry.name).trim(),
        vocation: String(profile.vocation || entry.vocation || "").trim(),
        sex: String(profile.sex || entry.sex || "").trim(),
        level: Number.isFinite(Number(profile.level)) ? Math.round(Number(profile.level)) : entry.level,
        world: String(profile.world || entry.world || "").trim(),
        guild: String(profile.guild || "").trim()
      };
    });

    renderSupporterToolbar();
    renderActiveDockedToolPanel();
  } catch (_error) {
    // Keep the mock data if live character enrichment is temporarily unavailable.
  }
}

function handleDockedToolPanelStateChange(panelState = {}) {
  const previousPanelKey = String(
    state.dockedToolPanelState?.panelKey || state.requestedDockedPanelKey || ""
  ).trim();
  const incomingPanelKey = String(panelState.panelKey || "").trim();
  const incomingPhase = panelState.phase || "closed";
  const requestedPanelKey = String(state.requestedDockedPanelKey || "").trim();
  const ownsTransientShell = ["account-panel", "report-panel"].includes(requestedPanelKey);
  const isRequestedTransientPanel = ownsTransientShell
    && (!incomingPanelKey || incomingPanelKey === requestedPanelKey);

  if (!panelState.open && incomingPhase === "closed" && isRequestedTransientPanel) {
    // Electron briefly reports an empty closed dock while it swaps/resizes the
    // shared shell. Some builds retain the same panel key in that packet.
    // Do not let either form erase a renderer-owned report/account surface.
    // A true close has no successor state, so it is still released shortly
    // afterwards below.
    state.dockedToolPanelState = {
      ...state.dockedToolPanelState,
      open: true,
      panelKey: requestedPanelKey,
      side: panelState.side === "left" ? "left" : "right",
      phase: "transitioning",
      width: Number(panelState.width) || state.dockedToolPanelState.width || 418
    };
    syncDockedToolPanelShell();
    renderActiveDockedToolPanel();
    window.setTimeout(() => {
      const currentRequestedPanelKey = String(state.requestedDockedPanelKey || "").trim();
      const currentPanelState = state.dockedToolPanelState || {};
      if (currentRequestedPanelKey !== requestedPanelKey
        || currentPanelState.panelKey !== requestedPanelKey
        || currentPanelState.phase !== "transitioning") {
        return;
      }
      state.requestedDockedPanelKey = "";
      state.dockedToolPanelState = {
        open: false,
        panelKey: "",
        side: currentPanelState.side || "right",
        phase: "closed",
        width: 0
      };
      syncDockedToolPanelShell();
      renderActiveDockedToolPanel();
    }, 900);
    window.requestAnimationFrame(syncDesktopEffectiveBreakpoints);
    return;
  } else if (incomingPanelKey) {
    state.requestedDockedPanelKey = incomingPanelKey;
  } else if (!panelState.open && incomingPhase === "closed") {
    state.requestedDockedPanelKey = "";
  }

  state.dockedToolPanelState = {
    open: Boolean(panelState.open),
    panelKey: incomingPanelKey,
    side: panelState.side === "left" ? "left" : "right",
    phase: incomingPhase,
    width: Number(panelState.width) || 0
  };

  syncDockedToolPanelShell();
  renderActiveDockedToolPanel();
  window.requestAnimationFrame(syncDesktopEffectiveBreakpoints);

  // Settings is the operator's lightweight entitlement check. Refresh once
  // after leaving it as well, so a benefit granted/revoked in the browser can
  // recreate or remove the desktop ads without restarting the app.
  if (previousPanelKey === "settings-panel" && incomingPanelKey !== "settings-panel") {
    void refreshDesktopAccountState({ refreshAds: true });
  }
}

function syncDockedToolPanelShell() {
  const { host } = getDesktopDockedPanelElements();
  if (!host) {
    return;
  }

  const panelState = state.dockedToolPanelState;
  const side = panelState.side === "left" ? "left" : "right";
  const phase = panelState.phase || "closed";
  const isVisible = Boolean(panelState.open) || phase !== "closed";

  document.body.style.setProperty("--desktop-docked-panel-width", `${Math.max(320, panelState.width || 418)}px`);
  document.body.classList.toggle("desktop-docked-panel-open", Boolean(panelState.open));
  document.body.classList.toggle("desktop-docked-panel-left", Boolean(panelState.open) && side === "left");
  document.body.classList.toggle("desktop-docked-panel-right", Boolean(panelState.open) && side === "right");
  document.body.dataset.dockedPanelKey = panelState.open ? (panelState.panelKey || "") : "";
  document.body.dataset.dockedPanelSide = side;
  document.body.dataset.dockedPanelPhase = phase;

  const activePanelKey = panelState.panelKey || state.requestedDockedPanelKey || "";
  syncDesktopAppOwnedDockedPanelHeader(host, activePanelKey, side);

  host.classList.toggle("hidden", !isVisible || phase === "left-pre-shift");
  host.setAttribute("aria-hidden", panelState.open ? "false" : "true");
}

function syncDesktopAppOwnedDockedPanelHeader(host, panelKey, side) {
  const appOwnedPanelKeys = new Set(["settings-panel", "account-panel", "report-panel"]);
  if (!host || !appOwnedPanelKeys.has(String(panelKey || "").trim())) {
    return;
  }

  const header = host.querySelector(".desktop-docked-tool-header");
  const closeButton = header?.querySelector("#desktop-docked-panel-close");
  const heading = header?.querySelector(".desktop-docked-tool-heading");
  if (!header || !closeButton || !heading) {
    return;
  }

  const normalizedSide = side === "left" ? "left" : "right";
  header.classList.toggle("desktop-docked-tool-header-left", normalizedSide === "left");
  header.classList.toggle("desktop-docked-tool-header-right", normalizedSide === "right");

  // Keep the same control and listener; only place it at the edge that faces
  // the main app, matching the generic docked panels.
  if (normalizedSide === "left") {
    header.append(heading, closeButton);
  } else {
    header.insertBefore(closeButton, heading);
  }

  const iconIdle = closeButton.querySelector(".desktop-window-icon-idle");
  const iconActive = closeButton.querySelector(".desktop-window-icon-active");
  const iconPrefix = normalizedSide === "left" ? "avancar" : "voltar";
  if (iconIdle) iconIdle.src = `assets/ui/desktop-history/${iconPrefix}-off.png`;
  if (iconActive) iconActive.src = `assets/ui/desktop-history/${iconPrefix}-on.png`;
}

function renderActiveDockedToolPanel() {
  const { title, description, content } = getDesktopDockedPanelElements();
  if (!content || !title || !description) {
    return;
  }

  clearSupporterShowcaseTimers();

  const panelState = state.dockedToolPanelState;
  const effectivePanelKey = panelState.panelKey || state.requestedDockedPanelKey || "";
  const isDockedPanelVisible = panelState.open || panelState.phase !== "closed";
  const isSupporterPanel = effectivePanelKey === SUPPORTER_DOCKED_PANEL_KEY && isDockedPanelVisible;
  const isSettingsPanel = effectivePanelKey === "settings-panel" && isDockedPanelVisible;
  const isAccountPanel = effectivePanelKey === "account-panel" && isDockedPanelVisible;
  const isReportPanel = effectivePanelKey === "report-panel" && isDockedPanelVisible;

  if (isSupporterPanel) {
    title.textContent = t("screenVision.supporters.title");
    description.textContent = "";
    content.innerHTML = renderSupporterDockedPanelMarkup();
    delete content.dataset.renderKey;
    bindSupporterCardActions(content);
    bindSupporterAvatarFallback(content);
    initializeSupporterShowcaseCycles(content);
    return;
  }

  if (isSettingsPanel) {
    title.textContent = t("screenVision.settings.title");
    description.textContent = "";
    const settingsRenderKey = `settings:${state.desktopAccountConnected}:${state.desktopAccountEntitlements.join(",")}`;
    if (content.dataset.renderKey !== settingsRenderKey) {
      content.innerHTML = renderDesktopSettingsPanelMarkup();
      content.dataset.renderKey = settingsRenderKey;
      // Settings are rendered after the initial document tooltip binding.
      // Bind the new My Account control to the exact same floating hover used
      // by the existing controls instead of relying on a browser title.
      bindSkillDynamicTooltips(content);
    }
    return;
  }

  if (isAccountPanel) {
    title.textContent = t("account.title");
    description.textContent = "";
    content.innerHTML = renderDesktopAccountPanelMarkup();
    bindSkillDynamicTooltips(content);
    bindDesktopAccountAvatarFallback(content);
    delete content.dataset.renderKey;
    return;
  }

  if (isReportPanel) {
    title.textContent = t("account.report.title");
    description.textContent = "";
    content.innerHTML = renderDesktopReportPanelMarkup();
    delete content.dataset.renderKey;
    return;
  }

  // Alertas, Perfis, SQM Finder and the other Tibia Mirror panels are
  // rendered by screen-vision.js. Rendering this legacy generic placeholder
  // here raced the dedicated renderer and exposed "Painel em preparacao" for
  // a frame while the Alertas panel opened.
}

function bindDesktopAccountAvatarFallback(root) {
  const avatar = root?.querySelector("[data-account-avatar]");
  if (!avatar || avatar.getAttribute("src") === "assets/ui/tools/tibia-eye/profiles/no-vocation.png") return;
  const fitAvatarToVisiblePixels = () => {
    try {
      const sourceWidth = avatar.naturalWidth;
      const sourceHeight = avatar.naturalHeight;
      if (!sourceWidth || !sourceHeight) return;
      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(avatar, 0, 0);
      const pixels = context.getImageData(0, 0, sourceWidth, sourceHeight).data;
      let left = sourceWidth;
      let top = sourceHeight;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < sourceHeight; y += 1) {
        for (let x = 0; x < sourceWidth; x += 1) {
          if (pixels[(y * sourceWidth + x) * 4 + 3] <= 12) continue;
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
      }
      if (right < left || bottom < top) return;
      const visibleWidth = right - left + 1;
      const visibleHeight = bottom - top + 1;
      const scale = Math.min(4, Math.max(1, 0.82 / Math.max(visibleWidth / sourceWidth, visibleHeight / sourceHeight)));
      const offsetX = -(((left + right + 1) / 2 / sourceWidth) - 0.5) * 100 * scale;
      const offsetY = -(((top + bottom + 1) / 2 / sourceHeight) - 0.5) * 100 * scale;
      avatar.style.transform = `translate(${offsetX}%, ${offsetY}%) scale(${scale})`;
    } catch {
      // A remote image without readable pixels still receives a useful zoom.
      avatar.style.transform = "scale(2)";
    }
  };
  avatar.addEventListener("load", fitAvatarToVisiblePixels, { once: true });
  if (avatar.complete) fitAvatarToVisiblePixels();
  avatar.addEventListener("error", () => {
    avatar.src = "assets/ui/tools/tibia-eye/profiles/no-vocation.png";
  }, { once: true });
}

function renderSupporterDockedPanelMarkup() {
  const supporters = state.supporters;
  const topSupporters = supporters.slice(0, 5);
  const otherSupporters = supporters.slice(5);

  if (supporters.length <= 0) {
    return `<div class="docked-supporters-content"></div>`;
  }

  return `
    <div class="docked-supporters-content">
      <section class="docked-supporters-section">
        <div class="docked-supporters-section-heading">
          <strong>${escapeHtml(t("screenVision.supporters.heading"))}</strong>
          ${shouldShowDesktopCoffeeButton() ? `<span>${escapeHtml(t("screenVision.supporters.ctaPrefix"))} ${escapeHtml(t("screenVision.supporters.ctaAction"))}</span>` : ""}
        </div>
        <div class="docked-profile-cards docked-supporters-cards">
          ${topSupporters.map(renderSupporterCardMarkup).join("")}
        </div>
        ${otherSupporters.length > 0 ? `
          <div class="docked-profile-cards docked-supporters-cards secondary">
            ${otherSupporters.map(renderSupporterCardMarkup).join("")}
          </div>
        ` : ""}
      </section>
    </div>
  `;
}

function renderDesktopSettingsPanelMarkup() {
  const screenshot = state.desktopScreenshotSettings || {};
  const hotkey = screenshot.hotkey || {};
  const hotkeyLabel = state.desktopScreenshotCapturingHotkey
    ? "..."
    : String(hotkey.label || "Não definido");
  const directory = String(screenshot.outputDirectory || "Carregando diretório...");
  const tibiaScreenshotDirectory = String(state.desktopScreenshotSourceDirectory || screenshot.sourceDirectory || "Pasta de screenshots do Tibia não identificada");
  const upscaleFactor = Math.min(20, Math.max(1, Math.round(Number(screenshot.upscaleFactor) || 1)));
  const upscaleProgress = ((upscaleFactor - 1) / 19) * 100;
  const deleteOriginal = Boolean(screenshot.deleteOriginal);
  const screenshotDiscoverySearching = state.desktopScreenshotDiscoveryState === "searching";
  const screenshotButtonTooltip = screenshotDiscoverySearching
    ? "Procurando pasta de screenshots"
    : !state.desktopScreenshotSourceAvailable
      ? "Pasta de screenshot do Tibia não identificada. Clique aqui para selecionar a pasta de screenshots do Tibia."
      : "Ativar ScreenshotToolkit";
  const screenshotButtonTone = screenshotDiscoverySearching
    ? ""
    : !state.desktopScreenshotSourceAvailable ? "danger" : "";
  const screenshotButtonBusy = screenshotDiscoverySearching || state.desktopScreenshotActionBusy;
  const screenshotNeedsSelection = Boolean((state.desktopScreenshotNeedsSelection || state.desktopScreenshotNeedsTibia) && !screenshot.enabled);
  const screenshotSelectIcon = screenshot.enabled
    ? "assets/ui/tutorial/polaroid.gif"
    : "assets/ui/tutorial/polaroid-inactive.png";
  const newScreenshotCount = Math.max(0, Number(state.desktopScreenshotNewCount) || 0);
  const screenshotFolderIcon = newScreenshotCount > 0
    ? "assets/ui/tutorial/folder.gif"
    : "assets/ui/tutorial/folder-inactive.png";
  const screenshotFolderCount = newScreenshotCount > 0
    ? `<em class="desktop-screenshot-folder-count" aria-hidden="true">${newScreenshotCount}</em>`
    : "";
  const imageButton = (image, action, tooltip, className = "") => `
    <button type="button" class="desktop-settings-image-button ${className}" data-settings-action="${escapeHtml(action)}" data-tooltip="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}"><img src="${escapeHtml(image)}" alt=""></button>`;
  return `
    <div class="desktop-settings-panel">
      <section class="desktop-settings-option desktop-settings-group">
        <strong class="desktop-settings-option-label">Conta</strong>
        <div class="desktop-settings-paired-buttons">
          ${imageButton(state.desktopAccountConnected ? "assets/ui/account/my-account.png" : "assets/ui/account/login.png", state.desktopAccountConnected ? "open-account" : "toggle-account", state.desktopAccountConnected ? t("account.open") : t("toolbar.login"), "desktop-settings-account-button")}
          ${imageButton(DESKTOP_SETTINGS_ASSETS.authenticator, "open-authenticator", t("screenVision.settings.authenticatorTooltip"))}
        </div>
      </section>
       <section class="desktop-settings-option desktop-screenshot-option${screenshot.enabled ? " screenshot-enabled" : ""}${screenshotNeedsSelection ? " screenshot-needs-selection" : ""}" data-tutorial-focus="screenshots-panel">
        <div class="desktop-screenshot-summary">
          <strong class="desktop-settings-option-label">Screenshots</strong>
          <button type="button" class="docked-alert-icon-button desktop-screenshot-edit" data-settings-action="toggle-screenshot-settings" data-tooltip="Configurar screenshots" aria-label="Configurar screenshots"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17,3 C17.55,2.45 18.45,2.45 19,3 L21,5 C21.55,5.55 21.55,6.45 21,7 L7,21 L3,21 L3,17 Z M15,5 L19,9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
           <div class="desktop-screenshot-summary-actions"><button type="button" class="docked-alert-magic-vocation-button desktop-screenshot-tutorial" data-settings-action="start-screenshot-tutorial" data-tooltip="Tutorial de screenshots" aria-label="Tutorial de screenshots"><img src="assets/ui/tutorial/balao-interrogacao.gif" alt=""></button><button type="button" class="docked-alert-magic-vocation-button desktop-screenshot-folder-icon${newScreenshotCount > 0 ? " has-new-screenshots" : ""}" data-settings-action="open-screenshot-directory" data-tooltip="Abrir pasta de screenshots" aria-label="Abrir pasta de screenshots${newScreenshotCount > 0 ? ` (${newScreenshotCount} novas)` : ""}"><img src="${screenshotFolderIcon}" alt="">${screenshotFolderCount}</button><button type="button" class="docked-alert-magic-vocation-button desktop-screenshot-select-icon${screenshotButtonBusy ? " screenshot-action-busy" : ""}" data-settings-action="open-screenshot-assistant" data-tutorial-focus="screenshot-select-area" data-tooltip="${escapeHtml(screenshotButtonTooltip)}" data-tooltip-tone="${screenshotButtonTone}" aria-label="${escapeHtml(screenshotButtonTooltip)}"${screenshotButtonBusy ? " disabled aria-busy=\"true\"" : ""}><img src="${screenshotSelectIcon}" alt=""></button></div>
        </div>
        <div class="desktop-screenshot-config docked-alert-extension" ${state.desktopScreenshotExpanded ? "" : "hidden"}>
          <div class="docked-alert-extension-divider" aria-hidden="true"></div>
          <div class="desktop-screenshot-legacy-controls" hidden>
          <div class="desktop-screenshot-hotkey-row" hidden>
            <div class="docked-alert-hotkey-builder"><span class="docked-alert-hotkey-builder-label${state.desktopScreenshotCapturingHotkey ? " capturing" : ""}">${escapeHtml(state.desktopScreenshotCapturingHotkey ? "Pressione a combinação desejada" : "Clique para escolher o atalho")}</span><button type="button" class="docked-alert-hotkey-capture${state.desktopScreenshotCapturingHotkey ? " capturing" : ""}" data-settings-action="choose-screenshot-hotkey">${escapeHtml(state.desktopScreenshotCapturingHotkey ? "Pressione uma tecla..." : "Escolher atalho")}</button></div>
            <button type="button" class="desktop-report-select-action desktop-screenshot-manual-button" data-settings-action="capture-screenshot" data-tooltip="Tirar screenshot" aria-label="Tirar screenshot"><img src="data:image/gif;base64,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1rGKhSxjH1tWwFZAsH3dq183q9nOLjazn+VsaD0rWdCO1bKYFW1pVUvZyLZ2sq6NLWxna9rX1vasXCoFaW3LWtnelra9Be5ufRvc3/YRmyhI7XCFO9rmrna5xv8trnShu1mVKte5vKWudrFL3O0+l7t4tWdADUre8pr3vOH043jRy972upef6tXme+dL3/qmM75xtK9+98vfgyLXp/Ltr4AHrN9jrZfACE6wQQ0cYAU7+MH+/G9gGwzhClv4nQxe5jGrycwOb9iaz/ywh505TRCXeMQZPuKIf7niEJOYwyKO8YtNDOMZtziWKWaxjHVs4x27mMdA/rGQT+xjIssyx0OucZCNvGQlJ5nGUL6xk42c4igXecpYtnKPt9xkLXdZjFWWspefLOYyX3nMTCbzIMN8ZjNzWc1vTrOcs+zmL69ZwpeVr53jTOc2+5nPaO4zoMGMZwroctB/3rP/ouG86DkHmpGFnsChGy1oSj+6zozOtKNPGGkJTFrTlQb1pRMtakxTudMI+PSmSb1qRLva0qYONY5R/a3i2PobSL61rgFF65vt+tf0yDWwhy2QY03w2MhOtrKXzewbwaDZ0I62tKc97WdT+9rYzra2m2TtbXv72+CGdrfDTe5ym3tN4z63utfNbhmlu93wjve23y3vetu72ePWpL73ze9+P4dG+fa3wAdOcA4B/AU5KrjCF85wCc4o4A2PuMQZfnAXNOdUGM+4xjdOlObA4OIcD7nIR07yQnj8BSAvucpXznKWnNzizGm5zGdO80i8vAU0qrnOd67ziuN8RjwPutBL/+5zFuR86EhP+qmKvoKjK/3pUIcI01Vw76pbXdn0vrrWtw6mrHP962C3kdfDTvavj73saLf62dPOdnmvve1wX/fb4053cs+97nifN8Lzznd1373vgBf33gNPeL27YKeIT7ziF19SGDD+8ZCPfOQdL/nKW/7yLqU85jfP+c5XVPOeD73oOQ/60Zv+9IwvPepXz3qZqr71sI89SV8v+9rb3qK0v73ud8/Q3PP+97X3PfCHz3rhE//4ozc+8pdP+hcw//moVz70p/94GlD/+pDHAfa3r3jtc//7OfU++McPUx6Q//wiBQL6169R9bP//Z//AfznL1Ei0B/+SLj/+/Ov/13187//58cEAIh9UDCA11eABjh9CJiAzycKDviAEBiBEjiBFFiBFniB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" alt=""></button>
          </div>
          <div class="desktop-screenshot-directory-row"><strong>Escolher diretório</strong><button type="button" class="desktop-screenshot-directory-value" data-settings-action="choose-screenshot-directory" title="${escapeHtml(directory)}">${escapeHtml(directory)}</button></div>
          <button type="button" class="desktop-report-select-action desktop-screenshot-folder-button" data-settings-action="open-screenshot-directory" data-tooltip="Abrir pasta de screenshots" aria-label="Abrir pasta de screenshots"><img src="data:image/gif;base64,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" alt=""></button>
          </div>
          <div class="desktop-screenshot-directory-row" data-tutorial-focus="screenshot-directory"><strong>Escolher diretório</strong><button type="button" class="desktop-screenshot-directory-value" data-settings-action="choose-screenshot-directory" data-tooltip="Escolha a pasta onde suas screenshots serão salvas. Isso é opcional.">${escapeHtml(directory)}</button></div>
          <div class="desktop-screenshot-directory-row" data-tutorial-focus="tibia-screenshot-directory"><strong>Pasta do Tibia</strong><button type="button" class="desktop-screenshot-directory-value" data-settings-action="choose-tibia-screenshot-directory" data-tooltip="Escolha a pasta onde o Tibia salva suas screenshots oficiais.">${escapeHtml(tibiaScreenshotDirectory)}</button></div>
          <div class="desktop-screenshot-upscale-row"><strong>Escala</strong><label class="desktop-opacity-control desktop-screenshot-upscale-control" for="desktop-screenshot-upscale-input" data-tooltip="Selecione a resolução da imagem gerada pela screenshot."><input id="desktop-screenshot-upscale-input" type="range" min="1" max="20" step="1" value="${upscaleFactor}" style="--slider-progress: ${upscaleProgress}%"><strong>${upscaleFactor}x</strong></label></div>
          <div class="desktop-screenshot-extra-actions" aria-label="Ações de screenshots"><button type="button" class="docked-alert-magic-vocation-button desktop-screenshot-tutorial" data-settings-action="start-screenshot-tutorial" data-tooltip="Tutorial de screenshots" aria-label="Tutorial de screenshots"><img src="assets/ui/tutorial/balao-interrogacao.gif" alt=""></button><button type="button" class="docked-alert-magic-vocation-button desktop-screenshot-folder-icon${newScreenshotCount > 0 ? " has-new-screenshots" : ""}" data-settings-action="open-screenshot-directory" data-tooltip="Abrir pasta de screenshots" aria-label="Abrir pasta de screenshots${newScreenshotCount > 0 ? ` (${newScreenshotCount} novas)` : ""}"><img src="${screenshotFolderIcon}" alt="">${screenshotFolderCount}</button><button type="button" class="docked-alert-magic-vocation-button desktop-screenshot-delete-icon${deleteOriginal ? " active" : ""}" data-settings-action="toggle-delete-original" data-tooltip="Apagar imagem original" aria-label="Apagar imagem original" aria-pressed="${deleteOriginal ? "true" : "false"}"><img src="assets/ui/tutorial/Dustbin.gif" alt=""></button></div>
          ${state.desktopScreenshotStatus ? `<p class="desktop-screenshot-status">${escapeHtml(state.desktopScreenshotStatus)}</p>` : ""}
        </div>
      </section>
      <section class="desktop-settings-option desktop-settings-social-option"><strong class="desktop-settings-option-label">Siga-nos nas redes</strong><div class="desktop-settings-social-buttons">${imageButton(DESKTOP_SETTINGS_ASSETS.discord, "open-discord", t("screenVision.settings.discordTooltip"))}${imageButton(DESKTOP_SETTINGS_ASSETS.youtube, "open-youtube", t("screenVision.settings.youtubeTooltip"))}${imageButton(DESKTOP_SETTINGS_ASSETS.instagram, "open-instagram", "Instagram")}${imageButton(DESKTOP_SETTINGS_ASSETS.twitch, "open-twitch", "Twitch")}</div></section>
      <section class="desktop-settings-option desktop-settings-group"><strong class="desktop-settings-option-label">Mais</strong><div class="desktop-settings-paired-buttons">${imageButton(DESKTOP_SETTINGS_ASSETS.tutorial, "reset-tutorial", t("screenVision.settings.tutorialTooltip"))}${imageButton(DESKTOP_SETTINGS_ASSETS.website, "open-website", t("screenVision.settings.websiteTooltip"))}</div></section>
    </div>
  `;
}

async function refreshDesktopScreenshotSettings() {
  if (!window.desktopApi?.screenshots?.getSettings) return;
  try {
    state.desktopScreenshotSettings = await window.desktopApi.screenshots.getSettings();
  } catch {
    state.desktopScreenshotStatus = "Não foi possível carregar as configurações de screenshot.";
  }
}

async function refreshDesktopScreenshotAvailability() {
  if (state.desktopScreenshotAvailabilityPromise) return state.desktopScreenshotAvailabilityPromise;
  state.desktopScreenshotDiscoveryState = "searching";
  window.dispatchEvent(new CustomEvent("tibia-toolkit:screenshot-discovery-state", { detail: { state: "searching" } }));
  const requestId = Number(state.desktopScreenshotAvailabilityRequestId || 0) + 1;
  state.desktopScreenshotAvailabilityRequestId = requestId;
  const request = (async () => {
  try {
    const availability = await window.desktopApi?.screenshots?.getAvailability?.();
    if (requestId !== state.desktopScreenshotAvailabilityRequestId) return;
    state.desktopScreenshotTibiaOpen = Boolean(availability?.tibiaOpen);
    state.desktopScreenshotSourceAvailable = Boolean(availability?.screenshotDirectory);
    state.desktopScreenshotSourceDirectory = String(availability?.screenshotDirectory || "");
    state.desktopScreenshotDiscoveryState = availability?.discoveryState === "found" || state.desktopScreenshotSourceAvailable
      ? "found"
      : "not-found";
  } catch {
    if (requestId !== state.desktopScreenshotAvailabilityRequestId) return;
    state.desktopScreenshotTibiaOpen = false;
    state.desktopScreenshotSourceAvailable = false;
    state.desktopScreenshotSourceDirectory = "";
    state.desktopScreenshotDiscoveryState = "not-found";
  }
  window.dispatchEvent(new CustomEvent("tibia-toolkit:screenshot-discovery-state", { detail: { state: state.desktopScreenshotDiscoveryState } }));
  window.dispatchEvent(new CustomEvent("tibia-toolkit:screenshot-state-changed"));
  })();
  const trackedRequest = request.finally(() => {
    if (state.desktopScreenshotAvailabilityPromise === trackedRequest) state.desktopScreenshotAvailabilityPromise = null;
  });
  state.desktopScreenshotAvailabilityPromise = trackedRequest;
  return trackedRequest;
}

async function chooseDesktopTibiaScreenshotDirectory() {
  const result = await window.desktopApi?.screenshots?.chooseSourceDirectory?.();
  if (result?.settings) state.desktopScreenshotSettings = result.settings;
  await refreshDesktopScreenshotAvailability();
  renderDesktopSettingsPanelIntoDockedShell();
  window.dispatchEvent(new CustomEvent("tibia-toolkit:screenshot-state-changed"));
}

async function chooseDesktopScreenshotDirectory() {
  const result = await window.desktopApi?.screenshots?.chooseDirectory?.();
  if (result?.settings) state.desktopScreenshotSettings = result.settings;
  renderDesktopSettingsPanelIntoDockedShell();
}

async function toggleDesktopScreenshotDeleteOriginal() {
  const current = Boolean(state.desktopScreenshotSettings?.deleteOriginal);
  const result = await window.desktopApi?.screenshots?.setDeleteOriginal?.(!current);
  if (result?.settings) state.desktopScreenshotSettings = result.settings;
  renderDesktopSettingsPanelIntoDockedShell();
}

async function openDesktopScreenshotDirectory() {
  const result = await window.desktopApi?.screenshots?.openDirectory?.();
  state.desktopScreenshotStatus = result?.error || "";
  renderDesktopSettingsPanelIntoDockedShell();
}

async function openDesktopScreenshotAssistant() {
  if (state.desktopScreenshotActionBusy || state.desktopScreenshotDiscoveryState === "searching") return;
  setDesktopScreenshotActionBusy(true);
  try {
    await refreshDesktopScreenshotSettings();
    await refreshDesktopScreenshotAvailability();
    if (!state.desktopScreenshotSourceAvailable) {
      await chooseDesktopTibiaScreenshotDirectory();
      return;
    }
    const result = await window.desktopApi?.screenshots?.showAssistant?.({ launcher: true });
    if (result?.opened === false) {
      state.desktopScreenshotStatus = result?.error || "Não foi possível abrir o ScreenshotToolkit.";
    }
  } catch {
    state.desktopScreenshotStatus = "Não foi possível abrir o ScreenshotToolkit.";
  } finally {
    setDesktopScreenshotActionBusy(false);
    renderDesktopSettingsPanelIntoDockedShell();
  }
}

async function captureDesktopScreenshot() {
  if (state.desktopScreenshotActionBusy || state.desktopScreenshotDiscoveryState === "searching") return;
  setDesktopScreenshotActionBusy(true);
  try {
    await refreshDesktopScreenshotSettings();
    await refreshDesktopScreenshotAvailability();
  if (!state.desktopScreenshotSourceAvailable) {
    await chooseDesktopTibiaScreenshotDirectory();
    return;
  }
  const isEnabled = Boolean(state.desktopScreenshotSettings?.enabled);
  if (!state.desktopScreenshotTibiaOpen && !isEnabled) {
    state.desktopScreenshotStatus = "";
    renderDesktopSettingsPanelIntoDockedShell();
    window.dispatchEvent(new CustomEvent("tibia-toolkit:screenshot-state-changed"));
    return;
  }
  state.desktopScreenshotStatus = isEnabled ? "Desativando o recorte automático..." : "Selecione a área padrão da screenshot.";
  renderDesktopSettingsPanelIntoDockedShell();
  try {
    const result = await window.desktopApi?.screenshots?.capture?.();
    if (result?.sourceDirectoryRequired) {
      await chooseDesktopTibiaScreenshotDirectory();
      return;
    }
    state.desktopScreenshotSettings = result?.settings || state.desktopScreenshotSettings;
    state.desktopScreenshotStatus = result?.cancelled ? "Seleção cancelada." : (result?.error || (result?.disabled ? "Recorte automático desativado." : (result?.selection ? "Área padrão definida. Suas próximas screenshots do Tibia serão recortadas." : "")));
  } catch {
    state.desktopScreenshotStatus = "Não foi possível definir a área da screenshot.";
  }
  renderDesktopSettingsPanelIntoDockedShell();
    window.dispatchEvent(new CustomEvent("tibia-toolkit:screenshot-state-changed"));
  } finally {
    setDesktopScreenshotActionBusy(false);
    renderDesktopSettingsPanelIntoDockedShell();
  }
}

window.desktopApi?.screenshots?.onStatus?.((message) => {
  // The source-folder watcher may retry at a fixed interval. Repainting the
  // complete Settings dock for the same status makes the whole panel flicker.
  // Keep the current DOM intact unless the message actually changed.
  if (state.desktopScreenshotStatus === message) return;
  state.desktopScreenshotStatus = message;
  renderDesktopSettingsPanelIntoDockedShell();
});

window.desktopApi?.screenshots?.onState?.((payload) => {
  if (typeof payload?.enabled === "boolean") {
    state.desktopScreenshotSettings = {
      ...(state.desktopScreenshotSettings || {}),
      enabled: payload.enabled
    };
  }
  state.desktopScreenshotNeedsSelection = Boolean(payload?.needsSelection);
  state.desktopScreenshotNeedsTibia = Boolean(payload?.needsTibia);
  window.dispatchEvent(new CustomEvent("tibia-toolkit:screenshot-state-changed"));
  if (state.requestedDockedPanelKey === "settings-panel") renderDesktopSettingsPanelIntoDockedShell();
});

window.desktopApi?.screenshots?.onDiscoveryState?.((payload) => {
  const discoveryState = String(payload?.state || "").trim();
  if (!["searching", "found", "not-found"].includes(discoveryState)) return;
  state.desktopScreenshotDiscoveryState = discoveryState;
  syncDesktopScreenshotActionBusyUi();
  window.dispatchEvent(new CustomEvent("tibia-toolkit:screenshot-discovery-state", { detail: { state: discoveryState } }));
  if (state.requestedDockedPanelKey === "settings-panel") renderDesktopSettingsPanelIntoDockedShell();
});

window.desktopApi?.screenshots?.onNewScreenshotCount?.((count) => {
  const normalized = Math.max(0, Number(count) || 0);
  if (state.desktopScreenshotNewCount === normalized) return;
  state.desktopScreenshotNewCount = normalized;
  renderDesktopSettingsPanelIntoDockedShell();
});

window.desktopApi?.globalWorldPicker?.onSelected?.((slug) => {
  const world = state.worlds.find((candidate) => candidate.slug === slug);
  els.globalWorldDropdownButton?.classList.remove("open");
  if (world) {
    void selectWorldSuggestion("global", world);
  }
});

window.desktopApi?.globalWorldPicker?.onClosed?.(() => {
  els.globalWorldDropdownButton?.classList.remove("open");
});

function renderDesktopAccountPanelMarkup() {
  if (!state.desktopAccountConnected) {
    return `<section class="desktop-account-panel"><p>${escapeHtml(t("account.signInCopy"))}</p><button type="button" class="desktop-account-image-action" data-account-action="connect" aria-label="${escapeHtml(t("toolbar.login"))}" data-tooltip="${escapeHtml(t("toolbar.login"))}"><img src="assets/ui/account/login.png" alt="${escapeHtml(t("toolbar.login"))}"></button></section>`;
  }
  const profile = state.desktopAccountProfile || {};
  const summary = state.desktopAccountSummary || {};
  const displayName = String(profile.displayName || profile.name || "Tibia Toolkit").trim();
  const email = String(profile.email || "").trim();
  const avatarUrl = String(profile.avatarUrl || "").trim();
  const avatarImageUrl = avatarUrl || "assets/ui/tools/tibia-eye/profiles/no-vocation.png";
  const adsBenefit = (Array.isArray(state.desktopAccountBenefits) ? state.desktopAccountBenefits : []).find((benefit) => benefit?.key === "ads.remove") || null;
  const adsBenefitMarkup = adsBenefit
    ? `<dd>${escapeHtml(formatDesktopAdsBenefit(adsBenefit))}</dd>`
    : `<dd><button type="button" class="desktop-account-action desktop-remove-ads-action" data-account-action="remove-ads" data-tooltip="${escapeHtml(t("account.removeAds"))}"><img src="assets/ui/tools/tibia-eye/buy-me-a-coffee/coffee-toolbar.gif" alt=""><strong>${escapeHtml(t("account.removeAds"))}</strong></button></dd>`;
  return `<section class="desktop-account-panel">
    <header class="desktop-account-identity">
      <div class="desktop-account-avatar-frame"><img src="${escapeHtml(avatarImageUrl)}" alt="${escapeHtml(t("account.characterAvatar"))}" data-account-avatar></div>
      <div><strong>${escapeHtml(displayName)}</strong>${email ? `<span>${escapeHtml(email)}</span>` : ""}</div>
      <button type="button" class="desktop-account-edit-character" data-account-action="edit-character" data-tooltip="${escapeHtml(t("account.editCharacter"))}" aria-label="${escapeHtml(t("account.editCharacter"))}"><img src="assets/tibia-client/organized/objects/items/painting-equipment/artist-s-palette--item-3133.png" alt=""></button>
    </header>
    <dl><div><dt>${escapeHtml(t("account.openReports"))}</dt><dd>${Number(summary.openReports) || 0}</dd></div><div><dt>${escapeHtml(t("account.unreadMessages"))}</dt><dd>${Number(summary.unreadMessages) || 0}</dd></div><div class="desktop-account-benefit"><dt>${escapeHtml(t("account.adsRemoved"))}</dt>${adsBenefitMarkup}</div></dl>
    <div class="desktop-account-actions">
      <button type="button" class="desktop-account-action" data-account-action="report" data-tooltip="${escapeHtml(t("account.report.open"))}"><strong>${escapeHtml(t("account.report.open"))}</strong></button>
      <button type="button" class="desktop-account-action" data-account-action="reports" data-tooltip="${escapeHtml(t("account.reports"))}"><strong>${escapeHtml(t("account.reports"))}</strong></button>
      <section class="desktop-account-proof-actions" aria-labelledby="desktop-account-proof-title">
        <h2 id="desktop-account-proof-title">${escapeHtml(t("account.proof"))}</h2>
        <div>
          <button type="button" class="desktop-account-action" data-account-action="proof" data-tooltip="${escapeHtml(t("account.proofSite"))}"><img src="assets/ui/economy/Tibia_Coin_Icon.gif" alt=""><strong>${escapeHtml(t("account.proofSite"))}</strong></button>
          <button type="button" class="desktop-account-action" data-account-action="proof-discord" data-tooltip="${escapeHtml(t("account.proofDiscord"))}"><img src="assets/ui/tools/tibia-eye/buy-me-a-coffee/discord.svg" alt=""><strong>${escapeHtml(t("account.proofDiscord"))}</strong></button>
        </div>
      </section>
      <button type="button" class="desktop-account-action" data-account-action="settings" data-tooltip="${escapeHtml(t("account.moreSettings"))}"><strong>${escapeHtml(t("account.moreSettings"))}</strong></button>
      <button type="button" class="desktop-account-image-action desktop-account-logout-image-action" data-account-action="logout" data-tooltip="${escapeHtml(t("toolbar.logout"))}" aria-label="${escapeHtml(t("toolbar.logout"))}"><img src="assets/ui/account/logout.png" alt="${escapeHtml(t("toolbar.logout"))}"></button>
    </div>
  </section>`;
}

function formatDesktopAdsBenefit(benefit) {
  if (!benefit) return t("account.adsInactive");
  const endsAt = benefit.endsAt ? new Date(benefit.endsAt) : null;
  if (!endsAt || Number.isNaN(endsAt.getTime())) return t("account.adsActiveIndefinite");
  const remainingMs = endsAt.getTime() - Date.now();
  if (remainingMs <= 0) return t("account.adsInactive");
  const remainingDays = Math.max(1, Math.ceil(remainingMs / 86400000));
  const date = new Intl.DateTimeFormat(document.documentElement.lang || "pt-BR", { dateStyle: "medium" }).format(endsAt);
  return t("account.adsActiveUntil", { date, days: remainingDays });
}

function renderDesktopReportPanelMarkup() {
  if (!state.desktopAccountConnected) {
    return `<section class="desktop-account-panel"><p>${escapeHtml(t("account.report.signInCopy"))}</p><button type="button" class="desktop-account-image-action" data-account-action="connect-report" aria-label="${escapeHtml(t("toolbar.login"))}" data-tooltip="${escapeHtml(t("toolbar.login"))}"><img src="assets/ui/account/login.png" alt="${escapeHtml(t("toolbar.login"))}"></button></section>`;
  }
  const kind = normalizeDesktopReportKind(state.desktopReportKind);
  const kindCopy = DESKTOP_REPORT_KIND_COPY[kind];
  return `<form class="desktop-report-panel" data-account-report-form>
    <fieldset><legend>${escapeHtml(t("account.report.whatFound"))}</legend><div class="desktop-report-kind-options">${Object.entries(DESKTOP_REPORT_KIND_COPY).map(([entryKind, entry]) => `<button type="button" data-account-report-kind="${escapeHtml(entryKind)}" class="${entryKind === kind ? "is-selected" : ""}" aria-pressed="${entryKind === kind}" aria-label="${escapeHtml(t(`account.report.${entryKind}`))}" data-tooltip="${escapeHtml(t(`account.report.${entryKind}`))}"><img src="${escapeHtml(entry.icon)}" alt=""></button>`).join("")}</div></fieldset>
    <input type="hidden" name="kind" value="${escapeHtml(kind)}">
    <div class="desktop-report-selected-elements" data-account-report-selected ${state.desktopReportSelectedElements.length ? "" : "hidden"}>${state.desktopReportSelectedElements.map((element) => `<div><strong>${escapeHtml(element.id ? `#${element.id}` : element.label)}</strong><span>${escapeHtml(element.selector)}</span><button type="button" data-account-report-remove="${escapeHtml(element.selector)}" aria-label="${escapeHtml(t("account.report.removeElement"))}" data-tooltip="${escapeHtml(t("account.report.removeElement"))}"><img src="assets/ui/Cross.png" alt=""></button></div>`).join("")}</div>
    <label><span data-account-report-title-label>${escapeHtml(t(kindCopy.titleKey))}</span><input name="title" placeholder="${escapeHtml(t(kindCopy.titleKey))}" minlength="4" maxlength="160" required></label>
    <label><span>${escapeHtml(t("account.report.details"))}</span><textarea name="body" placeholder="${escapeHtml(t(kindCopy.detailKey))}" minlength="10" maxlength="10000" required></textarea></label>
    <p class="desktop-account-status" data-account-report-status aria-live="polite"></p>
    <footer class="desktop-report-actions"><button type="submit" class="entity-link-chip desktop-report-submit" data-tooltip="${escapeHtml(t("account.report.submit"))}">${escapeHtml(t("account.report.submit"))}</button><button type="button" class="desktop-report-select-action" data-account-report-select aria-label="${escapeHtml(t("account.report.selectElement"))}" data-tooltip="${escapeHtml(t("account.report.selectElement"))}"><img src="assets/ui/feedback/select-element.png" alt=""></button></footer>
  </form>`;
}

async function connectDesktopAccount(options = {}) {
  if (!window.desktopApi?.account?.connect) {
    return;
  }

  try {
    const account = await window.desktopApi.account.connect();
    state.desktopAccountConnected = Boolean(account?.connected);
    state.desktopAccountEntitlements = Array.isArray(account?.entitlements) ? account.entitlements : [];
    state.desktopAccountBenefits = Array.isArray(account?.benefits) ? account.benefits : [];
    state.desktopAccountProfile = account?.user ? { ...account.user, ...(account.profile || {}) } : null;
    state.desktopAccountSummary = account?.summary || { openReports: 0, unreadMessages: 0 };
    publishDesktopAccountStateChanged();
    const catalog = await window.desktopApi.account.getCampaigns?.();
    const firstCampaign = Array.isArray(catalog?.ads) ? catalog.ads[0] : null;
    const firstSupport = Array.isArray(catalog?.support) ? catalog.support[0] : null;
    state.desktopCampaignDestination = typeof firstCampaign?.destinationUrl === "string" ? firstCampaign.destinationUrl : "";
    state.desktopSupportDestination = typeof firstSupport?.destination === "string" ? firstSupport.destination : "";
    state.desktopSocialLinks = {
      discord: typeof catalog?.socialLinks?.discord === "string" ? catalog.socialLinks.discord : DESKTOP_SETTINGS_DISCORD_URL,
      youtube: typeof catalog?.socialLinks?.youtube === "string" ? catalog.socialLinks.youtube : DESKTOP_SETTINGS_YOUTUBE_URL,
      instagram: DESKTOP_SETTINGS_INSTAGRAM_URL,
      twitch: DESKTOP_SETTINGS_TWITCH_URL
    };
    syncDesktopCampaignVisibility();
    if (options.openPanel) requestDesktopDockedPanel(options.openPanel);
    renderActiveDockedToolPanel();
    const adsRemoved = Array.isArray(account?.entitlements) && account.entitlements.includes("ads.remove");
    await window.desktopApi?.dialogs?.confirm?.({
      title: t("account.loginCompletedTitle"),
      message: adsRemoved ? t("account.loginCompletedAdsRemoved") : t("account.loginCompleted"),
      confirmLabel: t("dialog.confirm"),
      tone: "success",
      mediaPath: "assets/ui/tutorial/obs.gif",
      mediaWidth: 208,
      hideCancel: true,
      autoHeight: true,
      external: true,
      flat: true
    });
  } catch (error) {
    window.alert(error?.message || "Não foi possível conectar a conta.");
  }
}

function hasDesktopEntitlement(entitlement) {
  return state.desktopAccountEntitlements.includes(entitlement);
}

async function openManagedDesktopCampaign() {
  // Every Tibia Coins CTA opens the same in-app purchase panel. The panel
  // itself remains responsible for the confirmed checkout destination.
  await requestDesktopDockedPanel("tibia-coins-panel");
}

function syncDesktopCampaignVisibility() {
  const campaignButtons = [
    els.desktopTibiaCoinsButton,
    ...document.querySelectorAll(".tibia-coins-cta")
  ];

  // VIP removes advertising, not access to the Tibia Coins purchase panel.
  // These are navigation controls and must remain available to every account
  // state, including a connected account with the ads.remove entitlement.
  campaignButtons.forEach((button) => {
    if (!button) {
      return;
    }
    button.hidden = false;
    button.disabled = false;
    button.setAttribute("aria-hidden", "false");
  });
}

async function refreshDesktopAccountState(options = {}) {
  if (!window.desktopApi?.account?.getState) {
    state.desktopAccountConnected = false;
    state.desktopAccountEntitlements = [];
    state.desktopAccountBenefits = [];
    state.desktopAccountProfile = null;
    state.desktopAccountSummary = { openReports: 0, unreadMessages: 0 };
    syncDesktopCampaignVisibility();
    publishDesktopAccountStateChanged();
    return false;
  }

  try {
    const getAccountState = options.refreshAds && window.desktopApi.account.refresh
      ? window.desktopApi.account.refresh
      : window.desktopApi.account.getState;
    const account = await getAccountState?.();
    state.desktopAccountConnected = Boolean(account?.connected);
    state.desktopAccountEntitlements = Array.isArray(account?.entitlements) ? account.entitlements : [];
    state.desktopAccountBenefits = Array.isArray(account?.benefits) ? account.benefits : [];
    state.desktopAccountProfile = account?.user ? { ...account.user, ...(account.profile || {}) } : null;
    state.desktopAccountSummary = account?.summary || { openReports: 0, unreadMessages: 0 };
    const catalog = await window.desktopApi.account.getCampaigns?.();
    const firstCampaign = Array.isArray(catalog?.ads) ? catalog.ads[0] : null;
    const firstSupport = Array.isArray(catalog?.support) ? catalog.support[0] : null;
    state.desktopCampaignDestination = typeof firstCampaign?.destinationUrl === "string" ? firstCampaign.destinationUrl : "";
    state.desktopSupportDestination = typeof firstSupport?.destination === "string" ? firstSupport.destination : "";
    state.desktopSocialLinks = {
      discord: typeof catalog?.socialLinks?.discord === "string" ? catalog.socialLinks.discord : DESKTOP_SETTINGS_DISCORD_URL,
      youtube: typeof catalog?.socialLinks?.youtube === "string" ? catalog.socialLinks.youtube : DESKTOP_SETTINGS_YOUTUBE_URL,
      instagram: DESKTOP_SETTINGS_INSTAGRAM_URL,
      twitch: DESKTOP_SETTINGS_TWITCH_URL
    };
  } catch {
    state.desktopAccountConnected = false;
    state.desktopAccountEntitlements = [];
    state.desktopAccountBenefits = [];
    state.desktopAccountProfile = null;
    state.desktopAccountSummary = { openReports: 0, unreadMessages: 0 };
    state.desktopCampaignDestination = "";
    state.desktopSupportDestination = "";
    state.desktopSocialLinks = {
      discord: DESKTOP_SETTINGS_DISCORD_URL,
      youtube: DESKTOP_SETTINGS_YOUTUBE_URL,
      instagram: DESKTOP_SETTINGS_INSTAGRAM_URL,
      twitch: DESKTOP_SETTINGS_TWITCH_URL
    };
  }

  syncDesktopCampaignVisibility();
  publishDesktopAccountStateChanged();

  const activePanelKey = state.dockedToolPanelState?.panelKey || state.requestedDockedPanelKey;
  if (["settings-panel", "account-panel", "report-panel"].includes(activePanelKey)) {
    renderActiveDockedToolPanel();
  }

  return state.desktopAccountConnected;
}

function publishDesktopAccountStateChanged() {
  scheduleDesktopAccountEntitlementRefresh();
  window.dispatchEvent(new CustomEvent("tibia-toolkit:account-state-changed", {
    detail: {
      connected: state.desktopAccountConnected,
      entitlements: [...state.desktopAccountEntitlements],
      benefits: [...state.desktopAccountBenefits]
    }
  }));
}

function scheduleDesktopAccountEntitlementRefresh() {
  if (state.desktopAccountEntitlementRefreshTimer) {
    window.clearTimeout(state.desktopAccountEntitlementRefreshTimer);
    state.desktopAccountEntitlementRefreshTimer = null;
  }

  const nextExpiry = (Array.isArray(state.desktopAccountBenefits) ? state.desktopAccountBenefits : [])
    .filter((benefit) => benefit?.key === "ads.remove" && benefit?.endsAt)
    .map((benefit) => new Date(benefit.endsAt).getTime())
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > Date.now())
    .sort((left, right) => left - right)[0];

  if (!nextExpiry) {
    return;
  }

  const delay = Math.min(
    2_147_000_000,
    Math.max(250, nextExpiry - Date.now() + 1_000)
  );
  state.desktopAccountEntitlementRefreshTimer = window.setTimeout(() => {
    state.desktopAccountEntitlementRefreshTimer = null;
    void refreshDesktopAccountState({ refreshAds: true });
  }, delay);
}

window.addEventListener("tibia-toolkit:account-state-changed", (event) => {
  const detail = event?.detail || {};
  if (typeof detail.connected === "boolean") {
    state.desktopAccountConnected = detail.connected;
  }
  if (Array.isArray(detail.entitlements)) {
    state.desktopAccountEntitlements = detail.entitlements.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (Array.isArray(detail.benefits)) {
    state.desktopAccountBenefits = detail.benefits;
  }
  syncDesktopCampaignVisibility();
  renderActiveDockedToolPanel();
});

async function toggleDesktopAccountConnection() {
  if (state.desktopAccountLoading || !window.desktopApi?.account) {
    return;
  }

  state.desktopAccountLoading = true;
  try {
    if (state.desktopAccountConnected) {
      state.desktopAccountConnected = false;
      state.desktopAccountEntitlements = [];
      state.desktopAccountBenefits = [];
      state.desktopAccountProfile = null;
      state.desktopAccountSummary = { openReports: 0, unreadMessages: 0 };
      publishDesktopAccountStateChanged();
      syncDesktopCampaignVisibility();
      renderActiveDockedToolPanel();
      // Update the visual state before the IPC round-trip so Logout becomes
      // Login immediately when the user clicks it.
      await window.desktopApi.account.disconnect?.();
      return;
    }

    await connectDesktopAccount();
  } finally {
    state.desktopAccountLoading = false;
  }
}

function renderSupporterCardMarkup(supporter = {}) {
  const tierMeta = getSupporterTierMeta(supporter.tier || "default");
  const subtitle = buildSupporterSubtitle(supporter);
  const highlightedSubtitle = buildHighlightedSupporterSubtitle(supporter);
  const avatarMarkup = renderSupporterAvatarMarkup(supporter);
  const isHighlighted = supporter.tier && supporter.tier !== "default";
  const showcase = isHighlighted ? resolveSupporterShowcaseConfig(supporter) : null;
  const showcaseAttributes = buildSupporterShowcaseAttributes(showcase);
  const showcaseMarkup = renderSupporterShowcaseMarkup(showcase, supporter.name || "");
  const showcaseClassName = showcase ? " has-showcase-media" : "";
  const linkUrl = normalizeExternalHttpUrl(supporter.linkUrl);
  const linkClassName = linkUrl ? " is-clickable" : "";
  const linkTooltip = String(supporter.linkLabel || "").trim()
    || `${t("screenVision.supporters.openLink")}: ${supporter.name || "-"}`;
  const linkAttributes = linkUrl
    ? ` data-supporter-link-url="${escapeHtml(linkUrl)}" role="link" tabindex="0" aria-label="${escapeHtml(linkTooltip)}" data-tooltip="${escapeHtml(linkTooltip)}"`
    : "";

  return `
    <article class="docked-profile-card docked-supporter-card docked-supporter-card-tier-${escapeHtml(supporter.tier || "default")}${isHighlighted ? " docked-supporter-card-highlighted" : ""}${showcaseClassName}${linkClassName}"${showcaseAttributes}${linkAttributes}>
      ${showcaseMarkup}
      <div class="docked-profile-card-main docked-supporter-card-main">
        ${isHighlighted ? `
          <div class="docked-supporter-card-layout">
            <div class="docked-supporter-amount-wrap">
              <strong class="docked-supporter-amount">${escapeHtml(supporter.amountLabel || formatSupporterAmount(supporter.totalAmountCents, supporter.currency))}</strong>
              <strong class="docked-supporter-name">${escapeHtml(supporter.name || "-")}</strong>
            </div>
            <div class="docked-supporter-identity">
              <div class="docked-profile-avatar-button docked-supporter-avatar" aria-hidden="true">
                ${avatarMarkup}
              </div>
              <span class="docked-supporter-card-subtitle">${escapeHtml(highlightedSubtitle)}</span>
            </div>
          </div>
        ` : `
          <div class="docked-profile-card-title-row docked-supporter-card-title-row">
            <div class="docked-profile-avatar-button docked-supporter-avatar" aria-hidden="true">
              ${avatarMarkup}
            </div>
            <div class="docked-profile-card-center docked-supporter-card-center">
              <strong>${escapeHtml(supporter.name || "-")}</strong>
              <span class="docked-supporter-card-subtitle">${escapeHtml(subtitle)}</span>
            </div>
            <div class="docked-profile-card-meta docked-supporter-card-meta">
              <strong class="docked-supporter-amount">${escapeHtml(supporter.amountLabel || formatSupporterAmount(supporter.totalAmountCents, supporter.currency))}</strong>
              <img class="docked-supporter-medal" src="${escapeHtml(tierMeta.medalPath)}" alt="${escapeHtml(tierMeta.label)}">
            </div>
          </div>
        `}
      </div>
    </article>
  `;
}

function renderSupporterAvatarMarkup(supporter = {}) {
  const avatarUrl = String(supporter.avatarUrl || "").trim();
  const player = {
    name: supporter.name,
    vocation: supporter.vocation,
    sex: supporter.sex
  };

  if (!avatarUrl) {
    return getPlayerAvatarMarkup(player);
  }

  const vocationFallback = getVocationOutfitPath(player.vocation, player.sex);
  return `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(player.vocation || "Avatar do perfil")}" data-supporter-avatar-profile="true" data-supporter-avatar-fallback-src="${escapeHtml(vocationFallback)}" data-supporter-avatar-fallback-initials="${escapeHtml(getPlayerInitials(player.name))}">`;
}

function bindSupporterAvatarFallback(root) {
  root?.querySelectorAll('[data-supporter-avatar-profile="true"]').forEach((avatar) => {
    if (avatar.dataset.supporterAvatarFallbackBound === "true") {
      return;
    }

    avatar.dataset.supporterAvatarFallbackBound = "true";
    avatar.addEventListener("error", () => {
      const fallbackSrc = String(avatar.dataset.supporterAvatarFallbackSrc || "").trim();

      if (fallbackSrc && avatar.dataset.supporterAvatarFallbackApplied !== "true") {
        avatar.dataset.supporterAvatarFallbackApplied = "true";
        avatar.src = fallbackSrc;
        return;
      }

      const initials = document.createElement("span");
      initials.textContent = avatar.dataset.supporterAvatarFallbackInitials || "?";
      avatar.replaceWith(initials);
    });
  });
}

function buildSupporterSubtitle(supporter = {}) {
  const parts = [];

  if (Number.isFinite(Number(supporter.level)) && Number(supporter.level) > 0) {
    parts.push(`${t("tools.level")} ${formatNumberForUi(Number(supporter.level))}`);
  }

  if (supporter.world) {
    parts.push(String(supporter.world));
  }

  if (supporter.guild) {
    parts.push(String(supporter.guild));
  }

  return parts.join(" - ") || t("screenVision.supporters.emptyHighlight");
}

function buildHighlightedSupporterSubtitle(supporter = {}) {
  const parts = [];

  if (Number.isFinite(Number(supporter.level)) && Number(supporter.level) > 0) {
    parts.push(`${t("tools.level")} ${formatNumberForUi(Number(supporter.level))}`);
  }

  if (supporter.world) {
    parts.push(String(supporter.world));
  }

  return parts.join(" - ") || t("screenVision.supporters.emptyHighlight");
}

function resolveSupporterShowcaseConfig(entry = {}) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const showcaseSource = entry.showcase && typeof entry.showcase === "object"
    ? entry.showcase
    : {};
  const mediaUrl = [
    showcaseSource.mediaUrl,
    showcaseSource.url,
    showcaseSource.imageUrl,
    showcaseSource.gifUrl,
    showcaseSource.assetUrl,
    entry.showcaseMediaUrl,
    entry.showcaseImageUrl,
    entry.showcaseGifUrl,
    entry.highlightMediaUrl,
    entry.highlightMediaPath
  ]
    .find((value) => typeof value === "string" && value.trim());

  const isEnabled = coerceSupporterShowcaseBoolean(
    showcaseSource.enabled ?? entry.showcaseEnabled ?? entry.hasShowcaseMedia,
    Boolean(mediaUrl)
  );

  if (!isEnabled || !mediaUrl) {
    return null;
  }

  return {
    mediaUrl: String(mediaUrl).trim(),
    normalMs: clampSupporterShowcaseDuration(
      showcaseSource.normalMs ?? showcaseSource.cardMs ?? showcaseSource.defaultMs ?? showcaseSource.visibleMs ?? entry.showcaseNormalMs ?? entry.showcaseCardMs ?? entry.showcaseDefaultMs ?? entry.showcaseVisibleMs,
      SUPPORTER_SHOWCASE_DEFAULTS.normalMs,
      SUPPORTER_SHOWCASE_LIMITS.normalMinMs,
      SUPPORTER_SHOWCASE_LIMITS.normalMaxMs
    ),
    mediaMs: clampSupporterShowcaseDuration(
      showcaseSource.mediaMs ?? showcaseSource.supporterMs ?? showcaseSource.focusMs ?? entry.showcaseMediaMs ?? entry.showcaseSupporterMs ?? entry.showcaseFocusMs,
      SUPPORTER_SHOWCASE_DEFAULTS.mediaMs,
      SUPPORTER_SHOWCASE_LIMITS.mediaMinMs,
      SUPPORTER_SHOWCASE_LIMITS.mediaMaxMs
    ),
    transitionMs: clampSupporterShowcaseDuration(
      showcaseSource.transitionMs ?? showcaseSource.flareMs ?? entry.showcaseTransitionMs ?? entry.showcaseFlareMs,
      SUPPORTER_SHOWCASE_DEFAULTS.transitionMs,
      SUPPORTER_SHOWCASE_LIMITS.transitionMinMs,
      SUPPORTER_SHOWCASE_LIMITS.transitionMaxMs
    )
  };
}

function coerceSupporterShowcaseBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      return fallback;
    }

    if (["1", "true", "yes", "sim", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "nao", "não", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function clampSupporterShowcaseDuration(value, fallback, min, max) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numericValue)));
}

function buildSupporterShowcaseAttributes(showcase) {
  if (!showcase) {
    return "";
  }

  return ` data-supporter-showcase="true" data-supporter-showcase-normal-ms="${escapeHtml(String(showcase.normalMs))}" data-supporter-showcase-media-ms="${escapeHtml(String(showcase.mediaMs))}" data-supporter-showcase-transition-ms="${escapeHtml(String(showcase.transitionMs))}" style="--supporter-showcase-transition-ms: ${escapeHtml(String(showcase.transitionMs))}ms;"`;
}

function renderSupporterShowcaseMarkup(showcase, supporterName = "") {
  if (!showcase) {
    return "";
  }

  const altText = supporterName
    ? `${String(supporterName).trim()} showcase`
    : "Supporter showcase";

  return `
    <div class="docked-supporter-card-showcase-scene" aria-hidden="true">
      <img src="${escapeHtml(showcase.mediaUrl)}" alt="${escapeHtml(altText)}" loading="eager" decoding="async" referrerpolicy="no-referrer">
    </div>
    <div class="docked-supporter-card-showcase-flare" aria-hidden="true"></div>
  `;
}

function clearSupporterShowcaseTimers() {
  const timerIds = Array.isArray(state.supporterShowcaseTimerIds)
    ? state.supporterShowcaseTimerIds
    : [];

  timerIds.forEach((timerId) => {
    window.clearTimeout(timerId);
  });

  state.supporterShowcaseTimerIds = [];
}

function initializeSupporterShowcaseCycles(root) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }

  const showcaseCards = [...root.querySelectorAll('.docked-supporter-card[data-supporter-showcase="true"]')];

  showcaseCards.forEach((card) => {
    startSupporterShowcaseCycle(card);
  });
}

function startSupporterShowcaseCycle(card) {
  if (!card || !card.isConnected) {
    return;
  }

  const image = card.querySelector(".docked-supporter-card-showcase-scene img");
  if (!image) {
    card.classList.remove("has-showcase-media");
    return;
  }

  const normalMs = clampSupporterShowcaseDuration(
    card.dataset.supporterShowcaseNormalMs,
    SUPPORTER_SHOWCASE_DEFAULTS.normalMs,
    SUPPORTER_SHOWCASE_LIMITS.normalMinMs,
    SUPPORTER_SHOWCASE_LIMITS.normalMaxMs
  );
  const mediaMs = clampSupporterShowcaseDuration(
    card.dataset.supporterShowcaseMediaMs,
    SUPPORTER_SHOWCASE_DEFAULTS.mediaMs,
    SUPPORTER_SHOWCASE_LIMITS.mediaMinMs,
    SUPPORTER_SHOWCASE_LIMITS.mediaMaxMs
  );
  const transitionMs = clampSupporterShowcaseDuration(
    card.dataset.supporterShowcaseTransitionMs,
    SUPPORTER_SHOWCASE_DEFAULTS.transitionMs,
    SUPPORTER_SHOWCASE_LIMITS.transitionMinMs,
    SUPPORTER_SHOWCASE_LIMITS.transitionMaxMs
  );
  const schedule = (callback, delayMs) => {
    const timerId = window.setTimeout(callback, delayMs);
    state.supporterShowcaseTimerIds.push(timerId);
    return timerId;
  };
  const resetCardState = () => {
    card.classList.remove("is-showcase-active", "is-showcase-switching", "is-showcase-entering-media", "is-showcase-returning");
  };
  const switchToPrimary = () => {
    if (!card.isConnected) {
      return;
    }

    card.classList.add("is-showcase-switching", "is-showcase-returning");
    card.classList.remove("is-showcase-entering-media");
    card.classList.remove("is-showcase-active");

    schedule(() => {
      if (!card.isConnected) {
        return;
      }

      card.classList.remove("is-showcase-switching", "is-showcase-returning");
      schedule(switchToMedia, normalMs);
    }, transitionMs);
  };
  const switchToMedia = () => {
    if (!card.isConnected) {
      return;
    }

    card.classList.add("is-showcase-switching", "is-showcase-entering-media");
    window.requestAnimationFrame(() => {
      if (card.isConnected) {
        card.classList.add("is-showcase-active");
      }
    });

    schedule(() => {
      if (card.isConnected) {
        card.classList.remove("is-showcase-switching", "is-showcase-entering-media");
      }
    }, transitionMs);
    schedule(switchToPrimary, transitionMs + mediaMs);
  };

  const markMediaUnavailable = () => {
    if (!card.isConnected) {
      return;
    }

    resetCardState();
    card.classList.remove("has-showcase-media", "is-showcase-ready");
    card.dataset.supporterShowcaseStatus = "error";
    console.warn(`[supporter-showcase] Nao foi possivel carregar ${image.currentSrc || image.src || "a midia"}.`);
  };

  const beginCycle = () => {
    if (!card.isConnected || card.dataset.supporterShowcaseStatus === "ready") {
      return;
    }

    card.dataset.supporterShowcaseStatus = "ready";
    card.classList.add("is-showcase-ready");
    resetCardState();
    schedule(switchToMedia, normalMs);
  };

  const decodeAndBeginCycle = async () => {
    try {
      if (typeof image.decode === "function") {
        await image.decode();
      }
    } catch (_error) {
      // naturalWidth below remains the authoritative load check.
    }

    if (image.naturalWidth > 0) {
      beginCycle();
    } else {
      markMediaUnavailable();
    }
  };

  resetCardState();
  card.dataset.supporterShowcaseStatus = "loading";

  if (image.complete) {
    void decodeAndBeginCycle();
    return;
  }

  image.addEventListener("load", () => {
    void decodeAndBeginCycle();
  }, { once: true });
  image.addEventListener("error", markMediaUnavailable, { once: true });
}

function getDesktopEffectiveWidth() {
  if (document.body.classList.contains("desktop-mode")) {
    const dockedPanelHost = document.querySelector("#desktop-docked-panel");
    const dockedPanelVisible = Boolean(
      dockedPanelHost
      && !dockedPanelHost.classList.contains("hidden")
      && document.body.classList.contains("desktop-docked-panel-open")
    );
    const dockedPanelWidth = dockedPanelVisible
      ? Math.round(dockedPanelHost.getBoundingClientRect().width || 0)
      : 0;
    const baseDesktopWidth = Math.max(0, Math.round(window.innerWidth || 0) - dockedPanelWidth);

    if (baseDesktopWidth > 0) {
      return baseDesktopWidth;
    }

    if (els.mainContent) {
      const width = Math.round(els.mainContent.getBoundingClientRect().width || 0);

      if (width > 0) {
        return width;
      }
    }
  }

  return window.innerWidth || 0;
}

function syncDesktopEffectiveBreakpoints() {
  if (!document.body.classList.contains("desktop-mode")) {
    return;
  }

  const effectiveWidth = getDesktopEffectiveWidth();
  let tier = "wide";

  if (effectiveWidth <= 520) {
    tier = "narrow";
  } else if (effectiveWidth <= 760) {
    tier = "medium";
  }

  document.body.dataset.desktopMainWidth = String(effectiveWidth);
  document.body.dataset.desktopMainWidthTier = tier;
  document.body.classList.toggle("desktop-main-width-narrow", tier === "narrow");
  document.body.classList.toggle("desktop-main-width-medium", tier === "medium");
  document.body.classList.toggle("desktop-main-width-wide", tier === "wide");
  document.body.classList.toggle("desktop-main-width-at-most-620", effectiveWidth <= 620);
  document.body.classList.toggle("desktop-main-width-at-most-760", effectiveWidth <= 760);
  document.body.classList.toggle("desktop-main-width-at-most-820", effectiveWidth <= 820);
  document.body.classList.toggle("desktop-main-width-at-most-470", effectiveWidth <= 470);
  document.body.classList.toggle("desktop-main-width-at-most-516", effectiveWidth <= 516);
  document.body.classList.toggle("desktop-main-width-at-least-560", effectiveWidth >= 560);
  document.body.classList.toggle("desktop-main-width-at-least-620", effectiveWidth >= 620);
  document.body.classList.toggle("desktop-main-width-at-least-720", effectiveWidth >= 720);
  document.body.classList.toggle("desktop-main-width-at-least-761", effectiveWidth >= 761);
  document.body.classList.toggle("desktop-main-width-at-least-780", effectiveWidth >= 780);
  document.body.classList.toggle("desktop-main-width-at-least-1120", effectiveWidth >= 1120);
}

function handleImbuementRouteControlChange(event) {
  const mixedToggle = event.target.closest("[data-mixed-purchase-toggle]");

  if (mixedToggle) {
    state.mixedPurchaseEnabled = Boolean(mixedToggle.checked);
    renderImbuement();
    return;
  }

  const shrineFeeToggle = event.target.closest("[data-imbuement-shrine-fee-toggle]");

  if (shrineFeeToggle) {
    state.imbuementIncludeShrineFee = Boolean(shrineFeeToggle.checked);
    renderImbuement({ preserveRouteControls: true });
    return;
  }

  const marketPriceToggle = event.target.closest("[data-imbuement-market-price-mode]");

  if (marketPriceToggle) {
    state.imbuementMarketPriceMode = marketPriceToggle.checked ? "buy" : "sell";
    renderImbuement({ preserveRouteControls: true });
    return;
  }

  const manualToggle = event.target.closest("[data-manual-ingredient-toggle]");

  if (manualToggle) {
    const ingredientName = manualToggle.dataset.manualIngredientToggle;
    state.manualIngredientPrices[ingredientName] = {
      ...(state.manualIngredientPrices[ingredientName] || {}),
      enabled: Boolean(manualToggle.checked)
    };
    renderImbuement();
  }
}

function handleImbuementRouteControlInput(event) {
  const manualInput = event.target.closest("[data-manual-ingredient-price]");

  if (manualInput) {
    const ingredientName = manualInput.dataset.manualIngredientPrice;
    state.manualIngredientPrices[ingredientName] = {
      ...(state.manualIngredientPrices[ingredientName] || {}),
      price: parseManualGoldValue(manualInput.value)
    };
    renderImbuement({ preserveRouteControls: true });
    return;
  }

  const ownedInput = event.target.closest("[data-owned-ingredient-quantity]");

  if (!ownedInput) {
    return;
  }

  const ingredientName = ownedInput.dataset.ownedIngredientQuantity;
  state.ownedIngredientQuantities[ingredientName] = parseManualQuantityValue(ownedInput.value);
  renderImbuement({ preserveRouteControls: true });
}

function syncDesktopOpacityUI(opacityPercent) {
  if (!els.desktopOpacityInput || !els.desktopOpacityValue) {
    return;
  }

  const normalizedOpacity = Math.min(100, Math.max(45, Number(opacityPercent) || 100));
  els.desktopOpacityInput.value = String(normalizedOpacity);
  els.desktopOpacityValue.textContent = `${normalizedOpacity}%`;
  els.desktopOpacityInput.style.setProperty("--slider-progress", `${normalizedOpacity}%`);
}

function switchSection(section, options = {}) {
  const nextSection = section || state.selectedSection;
  const sectionChanged = nextSection !== state.selectedSection;

  if (
    sectionChanged
    && state.selectedSection === "tools"
    && state.selectedToolTab === "loot-splitter"
    && nextSection !== "tools"
  ) {
    cancelLootVisualHydration();
  }

  if (sectionChanged && !options.skipHistory && !state.navigationRestoring) {
    pushCurrentNavigationEntry();
  }

  state.selectedSection = nextSection;
  syncMirrorGameSelectorVisibility();
  els.navButtons.forEach((navButton) =>
    navButton.classList.toggle("active", navButton.dataset.section === nextSection)
  );

  Object.entries(els.panels).forEach(([key, panel]) => {
    panel.classList.toggle("active", key === nextSection);
  });

  if (nextSection === "npcs") {
    void ensureActiveEntityCatalogLoaded();
  }

  if (nextSection === "mini-world-changes") {
    // The VPS owns the global cache. Recheck it on every visit without polling
    // in the background, so an open app never causes upstream request noise.
    void loadMiniWorldChanges({ force: true });
  }

  if (nextSection === "tools") {
    scheduleActiveToolLiveDataLoad();
  }

  if (state.libraryContentNeedsViewRefresh && (sectionChanged || nextSection === state.selectedSection)) {
    void refreshLibraryViewAfterContentActivation();
  }

  if (sectionChanged || !state.currentNavigationEntry) {
    setCurrentNavigationEntry(getCurrentSectionNavigationEntry());
  }
}

function syncMirrorGameSelectorVisibility() {
  void window.desktopApi?.app?.setMirrorGameSelectorVisible?.(
    state.selectedSection === "tools" && state.selectedToolTab === "screen-vision"
  ).catch(() => {});
}

function setCurrentNavigationEntry(entry) {
  state.currentNavigationEntry = entry ? normalizeNavigationEntry(entry) : null;
  syncNavigationButtons();
}

function normalizeNavigationEntry(entry) {
  if (!entry?.type) {
    return null;
  }

  return {
    type: entry.type,
    section: entry.section || "",
    name: entry.name || "",
    slug: entry.slug || "",
    category: entry.category || "",
    imageSrc: entry.imageSrc || ""
  };
}

function getCurrentSectionNavigationEntry() {
  if (state.selectedSection === "mini-world-changes" && state.currentMiniWorldChangeId) {
    const current = findMiniWorldChangeById(state.currentMiniWorldChangeId);
    return {
      type: "mini-world-change",
      section: "mini-world-changes",
      name: current?.name || "",
      slug: state.currentMiniWorldChangeId
    };
  }

  const entry = {
    type: "section",
    section: state.selectedSection
  };

  if (state.selectedSection === "tools") {
    entry.name = state.selectedToolTab;
  }

  if (state.selectedSection === "npcs") {
    entry.category = state.entityViewMode;
  }

  if (state.selectedSection === "item-prices") {
    entry.category = state.itemViewMode;
  }

  return entry;
}

function areNavigationEntriesEqual(left, right) {
  return Boolean(
    left &&
    right &&
    left.type === right.type &&
    left.slug === right.slug &&
    left.name === right.name &&
    left.section === right.section &&
    left.category === right.category
  );
}

function pushCurrentNavigationEntry() {
  if (state.navigationRestoring || !state.currentNavigationEntry) {
    return;
  }

  const current = normalizeNavigationEntry(state.currentNavigationEntry);
  const previous = state.navigationBackStack[state.navigationBackStack.length - 1];

  if (!current || areNavigationEntriesEqual(current, previous)) {
    return;
  }

  state.navigationBackStack.push(current);
  if (state.navigationBackStack.length > NAVIGATION_HISTORY_LIMIT) {
    state.navigationBackStack.shift();
  }
  state.navigationForwardStack = [];
  syncNavigationButtons();
}

async function restorePreviousNavigationEntry() {
  const entry = state.navigationBackStack.pop();
  if (!entry) {
    syncNavigationButtons();
    return;
  }

  const current = normalizeNavigationEntry(state.currentNavigationEntry);
  if (current) {
    state.navigationForwardStack.push(current);
  }

  await restoreNavigationEntry(entry);
}

async function restoreNextNavigationEntry() {
  const entry = state.navigationForwardStack.pop();
  if (!entry) {
    syncNavigationButtons();
    return;
  }

  const current = normalizeNavigationEntry(state.currentNavigationEntry);
  if (current) {
    state.navigationBackStack.push(current);
  }

  await restoreNavigationEntry(entry);
}

async function restoreNavigationEntry(entry) {
  state.navigationRestoring = true;
  syncNavigationButtons();

  try {
    if (entry.type === "npc") {
      switchSection("npcs");
      await setEntityViewMode("npcs");
      await openNpcDetail(entry.name, { skipHistory: true });
      return;
    }

    if (entry.type === "creature") {
      switchSection("npcs");
      await setEntityViewMode(entry.category === "boss" ? "bosses" : "monsters");
      await openMonsterDetail(entry.name, { skipHistory: true });
      return;
    }

    if (entry.type === "item") {
      state.selectedItemSuggestion = {
        slug: entry.slug,
        name: entry.name || entry.slug,
        category: entry.category || "Item",
        imageSrc: entry.imageSrc || ""
      };
      els.itemInput.value = state.selectedItemSuggestion.name;
      switchSection("item-prices");
      await handleItemSearch(true);
      return;
    }

    if (entry.type === "mini-world-change") {
      switchSection("mini-world-changes", { skipHistory: true });
      await ensureMiniWorldChangesLoaded();
      openMiniWorldChangeDetail(entry.slug, { skipHistory: true });
      return;
    }

    if (entry.type === "section" && entry.section) {
      switchSection(entry.section, { skipHistory: true });

      if (entry.section === "tools" && entry.name) {
        setToolTab(entry.name, { skipHistory: true });
      }

      if (entry.section === "npcs" && entry.category) {
        await setEntityViewMode(entry.category, { skipHistory: true });
      }

      if (entry.section === "item-prices" && entry.category) {
        await setItemViewMode(entry.category, { skipHistory: true });
      }

      setCurrentNavigationEntry(entry);
    }
  } finally {
    state.navigationRestoring = false;
    syncNavigationButtons();
  }
}

function syncNavigationButtons() {
  if (els.historyBackButton) {
    els.historyBackButton.disabled = state.navigationBackStack.length === 0 || state.navigationRestoring;
  }

  if (els.historyForwardButton) {
    els.historyForwardButton.disabled = state.navigationForwardStack.length === 0 || state.navigationRestoring;
  }
}

function ensureItemDetailView() {
  if (els.itemDetailView?.isConnected) {
    return els.itemDetailView;
  }

  const controls = els.controlsCard;
  const layout = els.itemListView?.querySelector(".layout-grid");
  const related = els.itemListView?.querySelector(".related-card");

  if (!controls || !layout || !els.itemBooksView) {
    return null;
  }

  const detailView = document.createElement("div");
  detailView.id = "item-detail-view";
  detailView.className = "item-detail-view";
  els.itemBooksView.insertAdjacentElement("afterend", detailView);
  detailView.append(controls);
  detailView.append(layout);

  if (related) {
    detailView.append(related);
  }

  els.itemDetailView = detailView;
  return detailView;
}

async function setItemViewMode(mode, options = {}) {
  const nextMode = ["list", "stash", "books", "spells"].includes(mode) ? mode : "list";
  const viewModeChanged = nextMode !== state.itemViewMode;

  if (viewModeChanged && !options.skipHistory && !state.navigationRestoring) {
    pushCurrentNavigationEntry();
  }

  if (viewModeChanged && nextMode === "stash") {
    state.stashPreviewVisible = false;
  }

  state.itemViewMode = nextMode;
  if (state.itemViewMode !== "stash") {
    cancelStashMarketBackgroundRefresh();
  }
  els.itemViewTabs.forEach((button) =>
    button.classList.toggle("active", button.dataset.itemView === state.itemViewMode)
  );
  els.itemListView?.classList.toggle("hidden", state.itemViewMode !== "list");
  els.controlsCard?.classList.toggle("hidden", state.itemViewMode !== "list");
  els.shortcutsCard?.classList.toggle("hidden", state.itemViewMode !== "list");
  els.itemStashView?.classList.toggle("hidden", state.itemViewMode !== "stash");
  els.itemBooksView?.classList.toggle("hidden", state.itemViewMode !== "books");
  els.itemSpellsView?.classList.toggle("hidden", state.itemViewMode !== "spells");
  const itemDetailView = ensureItemDetailView();
  itemDetailView?.classList.toggle(
    "hidden",
    state.itemViewMode === "books" || state.itemViewMode === "spells" ||
      (state.itemViewMode === "stash" && !state.stashPreviewVisible)
  );

  if (state.itemViewMode === "stash") {
    const loadStashView = async () => {
      try {
        await ensureStashLoaded();
        // The user can leave Stash while its catalog is loading. Keep the
        // catalog warm, but do not redraw a view that is no longer visible.
        if (state.itemViewMode !== "stash") {
          return;
        }
        renderStashFilters();
        renderStashGrid();
        scheduleStashMarketLoad();
      } catch (error) {
        if (state.itemViewMode === "stash") {
          setStashStatus(error instanceof Error ? error.message : "Falha ao carregar stash.");
        }
      }
    };

    if (options.deferStashLoad) {
      // The introductory tutorial step only highlights the Stash tab. It does
      // not need to wait for thousands of catalog records before appearing.
      void loadStashView();
    } else {
      await loadStashView();
    }
  }

  if (state.itemViewMode === "books") {
    await loadBooksDocuments();
  }
  if (state.itemViewMode === "spells") {
    try {
      await loadSpellsCatalog();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível carregar as magias.";
      if (els.spellsStatus) els.spellsStatus.textContent = message;
      if (els.spellsGrid) els.spellsGrid.innerHTML = "";
    }
  }

  if (!options.skipCurrentEntry) {
    setCurrentNavigationEntry(getCurrentSectionNavigationEntry());
  }
}

async function loadSpellsCatalog() {
  if (!state.spells.loaded) {
    els.spellsStatus.textContent = "Carregando magias...";
    // Keep the first local catalogue read consistent with the loading feedback
    // used by the other Library sections.
    showGlobalLoading("Carregando magias...");
    try {
    const bundle = window.desktopApi?.assets?.readJson
      ? await window.desktopApi.assets.readJson("assets/data/spells.detailed.json")
      : await fetch("assets/data/spells.detailed.json").then(async (response) => {
          if (!response.ok) throw new Error("Não foi possível carregar as magias.");
          return response.json();
        });
    state.spells.records = Array.isArray(bundle.records) ? bundle.records : [];
    const catalogBundle = window.desktopApi?.assets?.readJson
      ? await window.desktopApi.assets.readJson("assets/data/spells.catalog.json")
      : await fetch("assets/data/spells.catalog.json").then((response) => response.json());
    const catalogById = new Map((catalogBundle.spells || []).map((spell) => [spell.id, spell]));
    const locale = state.localeController?.getLocale?.() || "pt-BR";
    const phraseMap = await loadPhraseTranslationMap(locale).catch(() => ({}));
    state.spells.records = state.spells.records.map((spell) => {
      const canonical = catalogById.get(spell.id);
      const merged = {
        ...spell,
        // Vocation and category drive filters, so both surfaces must use the
        // same audited catalogue classification. Detailed records remain the
        // source for factual fields and the immutable spell words.
        vocations: Array.isArray(canonical?.vocations) ? canonical.vocations.join(" ") : spell.vocations,
        category: canonical?.category || spell.category,
      };
      // Spell names and magic words are game identifiers, so they remain
      // literal in every locale. The remaining factual fields use the same
      // reviewed phrase map consumed by the rest of the Library.
      return localizeSpellRecord(merged, locale, phraseMap);
    });
    state.spells.loaded = true;
    } finally {
      hideGlobalLoading();
    }
  }
  renderSpellsCatalog();
}

function localizeSpellRecord(value, locale, phraseMap, path = []) {
  if (locale === "pt-BR" || value === null || value === undefined) return value;
  if (typeof value === "string") {
    const key = path[path.length - 1] || "";
    if (["id", "name", "spellWords", "words", "icon", "wikiUrl", "url", "localPath", "source"].includes(key)
      || /^(?:https?:|assets\/|data:)/i.test(value)) {
      return value;
    }
    return translatePhraseSync(locale, value, phraseMap);
  }
  if (Array.isArray(value)) return value.map((entry) => localizeSpellRecord(entry, locale, phraseMap, path));
  if (typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    localizeSpellRecord(entry, locale, phraseMap, [...path, key])
  ]));
}

function renderSpellsCatalog() {
  if (!els.spellsGrid) return;
  const query = normalizeSearchText(state.spells.query || "");
  const locale = state.localeController?.getLocale?.() || "pt-BR";
  const filterLabels = {
    "pt-BR": { search: "Buscar por", vocation: "Vocação", type: "Tipo", sort: "Ordenar por", knight: "Knight", paladin: "Paladin", druid: "Druid", sorcerer: "Sorcerer", monk: "Monk", ataque: "Magias de ataque", suporte: "Magias de suporte", wheel: "Roda do Destino", sortOptions: ["Nome: A-Z", "Nome: Z-A", "Mana: menor para maior", "Mana: maior para menor", "Level: menor para maior", "Level: maior para menor"] },
    en: { search: "Search by", vocation: "Vocation", type: "Type", sort: "Sort by", knight: "Knight", paladin: "Paladin", druid: "Druid", sorcerer: "Sorcerer", monk: "Monk", ataque: "Attack spells", suporte: "Support spells", wheel: "Wheel of Destiny", sortOptions: ["Name: A-Z", "Name: Z-A", "Mana: low to high", "Mana: high to low", "Level: low to high", "Level: high to low"] },
    de: { search: "Suchen nach", vocation: "Berufung", type: "Typ", sort: "Sortieren nach", knight: "Knight", paladin: "Paladin", druid: "Druid", sorcerer: "Sorcerer", monk: "Monk", ataque: "Angriffszauber", suporte: "Unterstützungszauber", wheel: "Schicksalsrad", sortOptions: ["Name: A-Z", "Name: Z-A", "Mana: niedrig zu hoch", "Mana: hoch zu niedrig", "Level: niedrig zu hoch", "Level: hoch zu niedrig"] }
  }[locale] || {};
  const records = state.spells.records.filter((spell) => {
    const vocations = normalizeSearchText(spell.vocations || "");
    const category = normalizeSearchText(spell.category || "");
    const matchesVocation = [...state.spells.vocations].some((vocation) => vocations.includes(vocation));
    const normalizedCategory = category === "ataque" ? "ataque" : "suporte";
    const matchesCategory = state.spells.categories.has(normalizedCategory);
    const normalMatch = matchesVocation && matchesCategory;
    // The Wheel button is an inclusion switch, not an isolated-result mode.
    // With it off, Wheel spells are hidden; with it on, they participate in
    // the active vocation and type filters exactly like every other spell.
    return (!query || normalizeSearchText(`${spell.name} ${spell.spellWords || ""}`).includes(query))
      && normalMatch
      && (state.spells.wheelOnly || !Boolean(spell.wheelSpellType));
  }).sort((left, right) => {
    const direction = state.spells.sort.endsWith("-desc") ? -1 : 1;
    const field = state.spells.sort.startsWith("mana") ? "mana" : state.spells.sort.startsWith("level") ? "level" : "name";
    if (field === "name") return direction * String(left.name || "").localeCompare(String(right.name || ""), locale);
    const leftValue = Number(left[field]); const rightValue = Number(right[field]);
    return direction * ((Number.isFinite(leftValue) ? leftValue : Number.MAX_SAFE_INTEGER) - (Number.isFinite(rightValue) ? rightValue : Number.MAX_SAFE_INTEGER));
  });
  els.spellVocationFilters.forEach((button) => {
    const label = filterLabels[button.dataset.spellVocation || ""] || "";
    button.classList.toggle("is-selected", state.spells.vocations.has(button.dataset.spellVocation || ""));
    button.title = label;
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
  });
  els.spellCategoryFilters.forEach((button) => {
    const label = filterLabels[button.dataset.spellCategory || ""] || "";
    button.classList.toggle("is-selected", state.spells.categories.has(button.dataset.spellCategory || ""));
    button.title = label;
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
  });
  if (els.spellWheelFilter) {
    els.spellWheelFilter.classList.toggle("is-selected", state.spells.wheelOnly);
    els.spellWheelFilter.title = filterLabels.wheel || "";
    els.spellWheelFilter.dataset.tooltip = filterLabels.wheel || "";
    els.spellWheelFilter.setAttribute("aria-label", filterLabels.wheel || "");
  }
  els.spellFilterLabels.forEach((label) => { label.textContent = filterLabels[label.dataset.spellFilterLabel || ""] || ""; });
  if (els.spellsSortFilter) {
    const labels = filterLabels.sortOptions || [];
    [...els.spellsSortFilter.options].forEach((option, index) => { option.textContent = labels[index] || option.textContent; });
    els.spellsSortFilter.value = state.spells.sort;
  }
  bindSkillDynamicTooltips(els.itemSpellsView);
  els.spellsStatus.textContent = `${records.length} ${spellUi().spells}`;
  els.spellsGrid.innerHTML = records.map((spell) => `<button type="button" class="book-card spell-card" data-spell-id="${escapeHtml(spell.id)}"><img src="${escapeHtml(spell.icon ? String(spell.icon).replace(/^\/library\/spells\//, "assets/data/spells/") : "assets/ui/tools/skill-magic.gif")}" alt=""><strong data-i18n-preserve>${escapeHtml(spell.name)}</strong><span data-i18n-preserve>${escapeHtml(spell.spellWords || "")}</span></button>`).join("");
  els.spellsGrid.querySelectorAll("[data-spell-id]").forEach((button) => button.addEventListener("click", () => openSpellDetail(button.dataset.spellId || "")));
}

function openSpellDetail(id) {
  const spell = state.spells.records.find((entry) => entry.id === id);
  if (!spell || !els.spellsDetail) return;
  const ui = spellUi();
  const consumedRaw = new Set(["name", "subclass", "damagetype", "cooldowngrupo", "cooldownproprio", "cooldownspecial", "words", "premium", "mana", "expLvl", "voc", "implemented", "basePower", "scaleWith", "spellrange", "range", "aimattarget", "animation", "effect", "notes", "history", "soul", "updated1", "wheelSpellType", "category", "mode", "scales"]);
  const facts = [[ui.level,spell.level],[ui.mana,spell.mana],[ui.words,spell.spellWords],[ui.vocation,spell.vocations],[ui.category,spell.category],[ui.damageType,spell.damageType],[ui.premium,spell.premium],[ui.soul,spell.soul],[ui.cooldown,spell.cooldownOwn],[ui.groupCooldown,spell.cooldownGroup],[ui.specialCooldown,spell.cooldownSpecial],[ui.effect,spell.effect],[ui.notes,spell.notes],[ui.history,spell.history],[ui.basePower,spell.basePower],[ui.scaleWith,spell.scaleWith],[ui.range,spell.range],[ui.target,spell.aimAtTarget],[ui.implemented,spell.implemented],[ui.updated,spell.updated],[ui.wheelType,spell.wheelSpellType]];
  Object.entries(spell.rawFields || {}).forEach(([key,value]) => { if (value && !consumedRaw.has(key)) facts.push([key, value]); });
  const displayedFacts = facts.filter(([,value]) => value);
  const spellIcon = spell.icon ? String(spell.icon).replace(/^\/library\/spells\//, "assets/data/spells/") : "assets/ui/tools/skill-magic.gif";
  els.spellsDetail.innerHTML = `<div class="books-detail-header"><div class="books-detail-hero"><img src="${escapeHtml(spellIcon)}" alt=""><h3>${escapeHtml(spell.name)}</h3></div></div><dl class="library-fact-list">${displayedFacts.map(([label,value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${renderLibraryFactualText(value)}</dd></div>`).join("")}</dl>${spell.animation?.localPath ? `<figure><img class="book-detail-image" src="assets/data/spells/demonstrations/${escapeHtml(String(spell.animation.localPath).split("/").pop())}" alt="${escapeHtml(`${ui.demonstration}: ${spell.name}`)}"><figcaption>${escapeHtml(ui.demonstration)}</figcaption></figure>` : ""}`;
  els.spellsDetail.classList.remove("hidden");
  window.requestAnimationFrame(() => els.spellsDetail?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function spellUi() {
  const locale = state.localeController?.getLocale?.() || "pt-BR";
  const labels = {
    "pt-BR": { spells:"magias", level:"Level", mana:"Mana", words:"Palavras mágicas", vocation:"Vocações", category:"Categoria", damageType:"Tipo de dano", premium:"Premium", soul:"Soul Points", cooldown:"Cooldown próprio", groupCooldown:"Cooldown de grupo", specialCooldown:"Cooldown especial", effect:"Efeito", notes:"Notas", history:"História", basePower:"Poder base", scaleWith:"Escala com", range:"Alcance", target:"Alvo", implemented:"Implementada", updated:"Atualizada", wheelType:"Tipo na roda", close:"Fechar", demonstration:"Demonstração" },
    en: { spells:"spells", level:"Level", mana:"Mana", words:"Magic words", vocation:"Vocations", category:"Category", damageType:"Damage type", premium:"Premium", soul:"Soul Points", cooldown:"Own cooldown", groupCooldown:"Group cooldown", specialCooldown:"Special cooldown", effect:"Effect", notes:"Notes", history:"History", basePower:"Base power", scaleWith:"Scales with", range:"Range", target:"Target", implemented:"Implemented", updated:"Updated", wheelType:"Wheel type", close:"Close", demonstration:"Demonstration" },
    de: { spells:"Zauber", level:"Level", mana:"Mana", words:"Zauberworte", vocation:"Berufungen", category:"Kategorie", damageType:"Schadensart", premium:"Premium", soul:"Seelenpunkte", cooldown:"Eigener Cooldown", groupCooldown:"Gruppen-Cooldown", specialCooldown:"Spezial-Cooldown", effect:"Effekt", notes:"Notizen", history:"Geschichte", basePower:"Grundstärke", scaleWith:"Skaliert mit", range:"Reichweite", target:"Ziel", implemented:"Implementiert", updated:"Aktualisiert", wheelType:"Radtyp", close:"Schließen", demonstration:"Demonstration" }
  };
  return labels[locale] || labels["pt-BR"];
}

async function setEntityViewMode(mode, options = {}) {
  const nextMode = ["npcs", "monsters", "bosses"].includes(mode) ? mode : "npcs";

  if (nextMode !== state.entityViewMode && !options.skipHistory && !state.navigationRestoring) {
    pushCurrentNavigationEntry();
  }

  state.entityViewMode = nextMode;
  els.entityTabs.forEach((button) =>
    button.classList.toggle("active", button.dataset.entityView === state.entityViewMode)
  );
  els.npcBrowser?.classList.toggle("hidden", state.entityViewMode !== "npcs");
  els.monsterBrowser?.classList.toggle("hidden", state.entityViewMode !== "monsters");
  els.bossBrowser?.classList.toggle("hidden", state.entityViewMode !== "bosses");
  await ensureActiveEntityCatalogLoaded();
  setCurrentNavigationEntry(getCurrentSectionNavigationEntry());
}

async function ensureActiveEntityCatalogLoaded() {
  if (state.entityViewMode === "monsters" || state.entityViewMode === "bosses") {
    await ensureMonsterCatalogLoaded();
    if (state.entityViewMode === "bosses") {
      renderBossCatalog();
    }
    return;
  }

  await ensureNpcCatalogLoaded();
}

async function ensureNpcCatalogLoaded() {
  if (state.npcLoaded) {
    renderNpcFilters();
    renderNpcCatalog();
    setNpcsStatus(t("npcs.countNpcs", { count: formatCompactNumber(state.npcIndex.length) }));
    return;
  }

  setNpcsStatus(t("npcs.loadingNpcs"));
  showGlobalLoading(t("npcs.loadingNpcs"));

  try {
    const data = await fetchNpcIndex();
    state.npcIndex = Array.isArray(data?.items) ? data.items : [];
    state.npcCities = Array.isArray(data?.cities) ? data.cities : [];
    state.npcJobs = Array.isArray(data?.jobs) ? data.jobs : [];
    state.npcLoaded = true;
    renderNpcFilters();
    renderNpcCatalog();
    setNpcsStatus(t("npcs.countNpcs", { count: formatCompactNumber(state.npcIndex.length) }));
  } catch (error) {
    setNpcsStatus(t("npcs.failedNpcs"));
    renderEntityError(els.npcListPanel, error, "NPCs");
  } finally {
    hideGlobalLoading();
  }
}

async function ensureMonsterCatalogLoaded() {
  if (state.monstersLoaded) {
    renderMonsterCategories();
    renderWeaknessFilters();
    renderMonsterCatalog();
    return;
  }

  setNpcsStatus(t("npcs.loadingCreatures"));
  showGlobalLoading(t("npcs.loadingCreatures"));

  try {
    const data = await fetchCreatureIndex();
    state.monsterIndex = Array.isArray(data?.items) ? data.items : [];
    state.monsterCategories = Array.isArray(data?.categories) ? data.categories : [];
    state.monsterClasses = Array.isArray(data?.classes) ? data.classes : [];
    state.monsterTypes = Array.isArray(data?.types) ? data.types : [];
    state.monstersLoaded = true;
    renderToolbarWorldStatus();
    renderMonsterFilters();
    renderMonsterCatalog();
    setNpcsStatus(t("npcs.countCreatures", { count: formatCompactNumber(state.monsterIndex.length) }));
  } catch (error) {
    setNpcsStatus(t("npcs.failedCreatures"));
    renderEntityError(els.monsterListPanel, error, "criaturas");
  } finally {
    hideGlobalLoading();
  }
}

function renderNpcFilters() {
  if (els.npcCityFilter) {
    els.npcCityFilter.innerHTML = [
      `<option value="">${escapeHtml(t("common.all.feminine"))}</option>`,
      ...state.npcCities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`)
    ].join("");
    els.npcCityFilter.value = state.npcCity;
  }

  if (els.npcJobFilter) {
    els.npcJobFilter.innerHTML = [
      `<option value="">${escapeHtml(t("common.all.feminine"))}</option>`,
      ...state.npcJobs.map((job) => `<option value="${escapeHtml(job)}">${escapeHtml(job)}</option>`)
    ].join("");
    els.npcJobFilter.value = state.npcJob;
  }
}

function renderMonsterFilters() {
  renderMonsterCategories();
  renderWeaknessFilters();

  if (els.monsterClassFilter) {
    els.monsterClassFilter.innerHTML = [
      `<option value="">${escapeHtml(t("common.all.feminine"))}</option>`,
      ...state.monsterClasses.map((entry) => `<option value="${escapeHtml(entry)}">${escapeHtml(entry)}</option>`)
    ].join("");
    els.monsterClassFilter.value = state.monsterClass;
  }

  if (els.monsterTypeFilter) {
    els.monsterTypeFilter.innerHTML = [
      `<option value="">${escapeHtml(t("common.all.masculine"))}</option>`,
      ...state.monsterTypes.map((entry) => `<option value="${escapeHtml(entry)}">${escapeHtml(entry)}</option>`)
    ].join("");
    els.monsterTypeFilter.value = state.monsterType;
  }
}

function bindWeaknessFilterBar(container, targetView) {
  container?.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-weakness-toggle]");

    if (toggle) {
      state.weaknessDropdownOpen = !state.weaknessDropdownOpen;
      renderWeaknessFilters();
      return;
    }

    const button = event.target.closest("[data-weakness-filter]");

    if (!button) {
      return;
    }

    void setCreatureWeaknessFilter(button.dataset.weaknessFilter || "", targetView);
  });
}

async function setCreatureWeaknessFilter(elementKey, targetView = state.entityViewMode) {
  state.monsterWeaknessFilter = state.monsterWeaknessFilter === elementKey ? "" : elementKey;
  if (targetView === "bosses") state.bossCatalogLimit = 60;
  else state.monsterCatalogLimit = 60;
  state.weaknessDropdownOpen = false;
  renderWeaknessFilters();

  if (state.monsterWeaknessFilter) {
    renderFilteredCreatureLoading(targetView);
    await ensureCreatureWeaknessIndexLoaded();
  }

  if (targetView === "bosses") {
    renderBossCatalog();
    scrollElementIntoView(els.bossListPanel);
    return;
  }

  renderMonsterCatalog();
  scrollMonsterListIntoView();
}

function renderWeaknessFilters() {
  renderWeaknessFilterBar(els.monsterWeaknessFilter);
  renderWeaknessFilterBar(els.bossWeaknessFilter);
}

function renderWeaknessFilterBar(container) {
  if (!container) {
    return;
  }

  const activeKey = state.monsterWeaknessFilter;
  const activeLabel = getCreatureWeaknessFilterLabel(activeKey);
  container.innerHTML = normalizeUiText(`
    <button type="button" class="weakness-filter-toggle${state.weaknessDropdownOpen ? " open" : ""}" data-weakness-toggle aria-expanded="${state.weaknessDropdownOpen ? "true" : "false"}">
      <span>${activeLabel ? escapeHtml(t("npcs.weaknessPrefix", { name: activeLabel })) : escapeHtml(t("npcs.selectWeakness"))}</span>
      <span class="toggle-chevron" aria-hidden="true"></span>
    </button>
    <div class="weakness-filter-menu${state.weaknessDropdownOpen ? "" : " hidden"}">
      <button type="button" class="weakness-filter-button${activeKey ? "" : " active"}" data-weakness-filter="" data-tooltip="${escapeHtml(t("npcs.allWeaknesses"))}" aria-label="${escapeHtml(t("npcs.allWeaknesses"))}">
        <span aria-hidden="true">*</span>
      </button>
      ${CREATURE_WEAKNESS_FILTERS.map((element) => {
        const icon = ELEMENT_ICONS[element.iconKey] || "";
        const activeClass = activeKey === element.key ? " active" : "";
        return `
          <button type="button" class="weakness-filter-button${activeClass}" data-weakness-filter="${escapeHtml(element.key)}" data-tooltip="${escapeHtml(t("npcs.weakAgainst", { name: element.label }))}" aria-label="${escapeHtml(t("npcs.weakAgainst", { name: element.label }))}">
            ${icon ? `<img src="${escapeHtml(icon)}" alt="">` : ""}
          </button>
        `;
      }).join("")}
    </div>
  `);
  bindSkillDynamicTooltips(container);
}

function renderFilteredCreatureLoading(targetView) {
  const label = getCreatureWeaknessFilterLabel(state.monsterWeaknessFilter);
  const target = targetView === "bosses" ? els.bossListPanel : els.monsterListPanel;

  if (!target) {
    return;
  }

  target.innerHTML = `
    <div class="empty-inline">${escapeHtml(t("npcs.loadingWeaknessFilter", { name: label ? `: ${label}` : "" }))}</div>
  `;
}

async function ensureCreatureWeaknessIndexLoaded() {
  if (state.creatureWeaknessIndex) {
    return state.creatureWeaknessIndex;
  }

  if (state.creatureWeaknessIndexPromise) {
    return state.creatureWeaknessIndexPromise;
  }

  state.creatureWeaknessIndexLoading = true;
  state.creatureWeaknessIndexPromise = fetch("assets/data/creature-status-overrides.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(t("npcs.failedWeaknesses"));
      }

      return response.json();
    })
    .then((bundle) => {
      const overrides = bundle?.overrides || {};
      const index = {};

      Object.entries(overrides).forEach(([slug, detail]) => {
        const weaknesses = extractCreatureWeaknesses(detail);
        index[slug] = weaknesses;
        if (detail?.pageTitle) {
          index[slugifyItemInput(String(detail.pageTitle).replace(/_/g, " "))] = weaknesses;
        }
      });

      state.creatureWeaknessIndex = index;
      return index;
    })
    .finally(() => {
      state.creatureWeaknessIndexLoading = false;
      state.creatureWeaknessIndexPromise = null;
    });

  return state.creatureWeaknessIndexPromise;
}

function extractCreatureWeaknesses(detail) {
  const weaknesses = new Set();
  const modifiers = Array.isArray(detail?.damageModifiers) ? detail.damageModifiers : [];

  modifiers.forEach((modifier) => {
    const key = normalizeCreatureElementKey(modifier.key || modifier.label);
    const numericValue = parseCreaturePercent(modifier.value);

    if (key && numericValue > 100) {
      weaknesses.add(key);
    }
  });

  return weaknesses;
}

function normalizeCreatureElementKey(value) {
  const normalized = normalizeSearchText(value);
  const map = {
    fisico: "physical",
    physical: "physical",
    terra: "earth",
    earth: "earth",
    poison: "earth",
    fogo: "fire",
    fire: "fire",
    morte: "death",
    death: "death",
    energia: "energy",
    energy: "energy",
    sagrado: "holy",
    holy: "holy",
    gelo: "ice",
    ice: "ice",
    cura: "healing",
    healing: "healing"
  };

  return map[normalized] || "";
}

function isCreatureWeakToElement(creature, elementKey) {
  if (!elementKey) {
    return true;
  }

  const index = state.creatureWeaknessIndex;

  if (!index) {
    return false;
  }

  const keys = [
    creature?.slug,
    slugifyItemInput(creature?.name || "")
  ].filter(Boolean);

  return keys.some((key) => index[key]?.has(elementKey));
}

function getCreatureWeaknessFilterLabel(elementKey) {
  return CREATURE_WEAKNESS_FILTERS.find((element) => element.key === elementKey)?.label || "";
}

function renderMonsterCategories() {
  if (!els.monsterCategoryGrid) {
    return;
  }

  if (els.monsterCategoryToggle) {
    els.monsterCategoryToggle.innerHTML = `
      <span>${escapeHtml(state.monsterCategoriesCollapsed ? t("common.show") : t("common.minimize"))}</span>
      <span class="toggle-chevron" aria-hidden="true"></span>
    `;
    els.monsterCategoryToggle.classList.toggle("collapsed", state.monsterCategoriesCollapsed);
    els.monsterCategoryToggle.setAttribute(
      "aria-expanded",
      state.monsterCategoriesCollapsed ? "false" : "true"
    );
  }

  els.monsterCategoryGrid.classList.toggle("collapsed", state.monsterCategoriesCollapsed);

  const categories = Array.isArray(state.monsterCategories) ? state.monsterCategories : [];
  const allActiveClass = state.monsterCategory ? "" : " active";
  const allCount = state.monsterIndex.length;

  els.monsterCategoryGrid.innerHTML = normalizeUiText(`
    <button type="button" class="monster-category-card${allActiveClass}" data-monster-category="" data-tooltip="${escapeHtml(`${formatCompactNumber(allCount)} criaturas`)}">
      <img class="monster-category-icon all" src="assets/ui/bestiary/creature-category-all.png" alt="${escapeHtml(t("common.all.masculine"))}">
      <strong>${escapeHtml(t("common.all.masculine"))}</strong>
    </button>
    ${categories.map((category) => {
      const activeClass = category.slug === state.monsterCategory ? " active" : "";
      return `
        <button type="button" class="monster-category-card${activeClass}" data-monster-category="${escapeHtml(category.slug)}" data-tooltip="${escapeHtml(`${formatCompactNumber(category.count || 0)} criaturas`)}">
          <img src="${escapeHtml(category.imageSrc || "")}" alt="${escapeHtml(category.label)}" onerror="this.style.visibility='hidden'">
          <strong>${escapeHtml(category.label)}</strong>
        </button>
      `;
    }).join("")}
  `);
  bindSkillDynamicTooltips(els.monsterCategoryGrid);
}

function getFilteredNpcCatalogItems() {
  const query = normalizeSearchText(state.npcQuery);
  const signature = [query, state.npcCity, state.npcJob, state.npcTrade].join("\u0000");
  return state.npcCatalogFilterCache.get({
    source: state.npcIndex,
    signature,
    buildItems: () => state.npcIndex.filter((npc) => {
      const functionLabels = Array.isArray(npc.functionLabels) ? npc.functionLabels : [];
      const cityLabels = Array.isArray(npc.cityCategoryLabels) ? npc.cityCategoryLabels : [];
      const haystack = normalizeSearchText(
        `${npc.name} ${npc.city || ""} ${npc.location || ""} ${npc.job || ""} ${npc.job2 || ""} ${functionLabels.join(" ")} ${cityLabels.join(" ")}`
      );

      if (query && !haystack.includes(query)) {
        return false;
      }

      const cityMatches = state.npcCity
        ? npc.city === state.npcCity || cityLabels.includes(state.npcCity)
        : true;

      if (!cityMatches) {
        return false;
      }

      const jobLabels = functionLabels.length > 0 ? functionLabels : [npc.job, npc.job2].filter(Boolean);
      if (state.npcJob && !jobLabels.includes(state.npcJob)) {
        return false;
      }

      return !state.npcTrade || (npc.trade || "unknown") === state.npcTrade;
    })
  });
}

function renderNpcCatalog() {
  if (!els.npcListPanel) {
    return;
  }
  const renderStartedAt = performance.now();
  const items = getFilteredNpcCatalogItems();

  if (items.length === 0) {
    els.npcListPanel.innerHTML = `<div class="empty-inline">${escapeHtml(t("npcs.noneFound"))}</div>`;
    return;
  }

  const displayed = items.slice(0, state.npcCatalogLimit);
  els.npcListPanel.innerHTML = normalizeUiText(
    displayed.map(renderNpcCatalogCard).join("") +
      renderLibraryCatalogProgress("npc", displayed.length, items.length, t("npcs.foundNpcs", { count: formatCompactNumber(items.length) }))
  );
  bindSkillDynamicTooltips(els.npcListPanel);

  els.npcListPanel.querySelectorAll("[data-npc-name]").forEach((button) => {
    button.addEventListener("click", () => {
      void openNpcDetail(button.dataset.npcName);
    });
  });
  bindLibraryCatalogSpriteAnimations(els.npcListPanel);
  bindLibraryCatalogMore(els.npcListPanel);
  recordLibraryGridRenderMetric("npc", renderStartedAt, items.length, displayed.length, els.npcListPanel);
}

function getFilteredMonsterCatalogItems() {
  const query = normalizeSearchText(state.monsterQuery);
  const signature = [
    query,
    state.monsterCategory,
    state.monsterClass,
    state.monsterType,
    state.monsterWeaknessFilter
  ].join("\u0000");
  return state.monsterCatalogFilterCache.get({
    source: state.monsterIndex,
    dependencies: [state.creatureWeaknessIndex],
    signature,
    buildItems: () => state.monsterIndex.filter((monster) => {
      if (
        query &&
        !matchesNameSearch(monster.name, query) &&
        !matchesNameSearch(monster.slug, query)
      ) {
        return false;
      }

      if (state.monsterCategory && !(monster.categorySlugs || []).includes(state.monsterCategory)) {
        return false;
      }

      if (state.monsterClass && monster.creatureClass !== state.monsterClass) {
        return false;
      }

      if (
        state.monsterType &&
        monster.primaryType !== state.monsterType &&
        monster.secondaryType !== state.monsterType
      ) {
        return false;
      }

      return !state.monsterWeaknessFilter || isCreatureWeakToElement(monster, state.monsterWeaknessFilter);
    }).sort((left, right) => {
      if (!query) {
        return 0;
      }

      const leftRank = Math.min(
        getNameSearchRank(left.name, query),
        getNameSearchRank(left.slug, query)
      );
      const rightRank = Math.min(
        getNameSearchRank(right.name, query),
        getNameSearchRank(right.slug, query)
      );

      return leftRank - rightRank || String(left.name || "").localeCompare(String(right.name || ""), "en");
    })
  });
}

function renderMonsterCatalog() {
  if (!els.monsterListPanel) {
    return;
  }
  const renderStartedAt = performance.now();

  if (state.monsterWeaknessFilter && !state.creatureWeaknessIndex) {
    renderFilteredCreatureLoading("monsters");
    void ensureCreatureWeaknessIndexLoaded().then(() => renderMonsterCatalog()).catch((error) => {
      renderEntityError(els.monsterListPanel, error, "filtro de fraqueza");
    });
    return;
  }

  const items = getFilteredMonsterCatalogItems();

  if (items.length === 0) {
    els.monsterListPanel.innerHTML = `<div class="empty-inline">${escapeHtml(t("npcs.noneCreaturesFound"))}</div>`;
    return;
  }

  const displayed = items.slice(0, state.monsterCatalogLimit);
  els.monsterListPanel.innerHTML = normalizeUiText(
    displayed.map(renderMonsterCatalogCard).join("") +
      renderLibraryCatalogProgress("monster", displayed.length, items.length, t("npcs.foundCreatures", { count: formatCompactNumber(items.length) }))
  );
  bindSkillDynamicTooltips(els.monsterListPanel);

  els.monsterListPanel.querySelectorAll("[data-monster-name]").forEach((button) => {
    button.addEventListener("click", () => {
      void openMonsterDetail(button.dataset.monsterName);
    });
  });
  bindLibraryCatalogSpriteAnimations(els.monsterListPanel);
  bindLibraryCatalogMore(els.monsterListPanel);
  recordLibraryGridRenderMetric("creature", renderStartedAt, items.length, displayed.length, els.monsterListPanel);
}

function getFilteredBossCatalogItems() {
  const query = normalizeSearchText(state.bossQuery);
  const activeFilters = Object.entries(state.bossFilters)
    .filter(([, active]) => active)
    .map(([key]) => key);
  const signature = [query, activeFilters.join(","), state.monsterWeaknessFilter].join("\u0000");
  return state.bossCatalogFilterCache.get({
    source: state.monsterIndex,
    dependencies: [state.creatureWeaknessIndex],
    signature,
    buildItems: () => state.monsterIndex.filter((monster) => {
      const bossKey = normalizeSearchText(monster.bossCategory);

      if (!bossKey || !activeFilters.includes(bossKey)) {
        return false;
      }

      if (query && !normalizeSearchText(`${monster.name} ${monster.bossCategory}`).includes(query)) {
        return false;
      }

      return !state.monsterWeaknessFilter || isCreatureWeakToElement(monster, state.monsterWeaknessFilter);
    })
  });
}

function renderBossCatalog() {
  if (!els.bossListPanel) {
    return;
  }
  const renderStartedAt = performance.now();

  if (state.monsterWeaknessFilter && !state.creatureWeaknessIndex) {
    renderFilteredCreatureLoading("bosses");
    void ensureCreatureWeaknessIndexLoaded().then(() => renderBossCatalog()).catch((error) => {
      renderEntityError(els.bossListPanel, error, "filtro de fraqueza");
    });
    return;
  }

  const bosses = getFilteredBossCatalogItems();

  if (bosses.length === 0) {
    els.bossListPanel.innerHTML = `<div class="empty-inline">${escapeHtml(t("npcs.noneBossesFound"))}</div>`;
    return;
  }

  const displayed = bosses.slice(0, state.bossCatalogLimit);
  els.bossListPanel.innerHTML = normalizeUiText(
    displayed.map(renderBossCatalogCard).join("") +
      renderLibraryCatalogProgress("boss", displayed.length, bosses.length, t("npcs.foundBosses", { count: formatCompactNumber(bosses.length) }))
  );
  bindSkillDynamicTooltips(els.bossListPanel);

  els.bossListPanel.querySelectorAll("[data-monster-name]").forEach((button) => {
    button.addEventListener("click", () => {
      void openMonsterDetail(button.dataset.monsterName);
    });
  });
  bindLibraryCatalogSpriteAnimations(els.bossListPanel);
  bindLibraryCatalogMore(els.bossListPanel);
  recordLibraryGridRenderMetric("boss", renderStartedAt, bosses.length, displayed.length, els.bossListPanel);
}

function libraryCatalogUi() {
  const locale = state.localeController?.getLocale?.() || "pt-BR";
  return ({
    "pt-BR": { more: "Mostrar mais", showing: "Exibindo {shown} de {total}" },
    en: { more: "Show more", showing: "Showing {shown} of {total}" },
    de: { more: "Mehr anzeigen", showing: "{shown} von {total} angezeigt" }
  })[locale] || { more: "Mostrar mais", showing: "Exibindo {shown} de {total}" };
}

function renderLibraryCatalogProgress(kind, shown, total, summary) {
  const ui = libraryCatalogUi();
  const progress = ui.showing.replace("{shown}", formatCompactNumber(shown)).replace("{total}", formatCompactNumber(total));
  return `<div class="entity-count">${escapeHtml(summary)}<small>${escapeHtml(progress)}</small>${shown < total ? `<button type="button" class="entity-link-chip" data-library-catalog-more="${kind}">${escapeHtml(ui.more)}</button>` : ""}</div>`;
}

function bindLibraryCatalogMore(container) {
  container?.querySelector("[data-library-catalog-more]")?.addEventListener("click", (event) => {
    const kind = event.currentTarget.dataset.libraryCatalogMore;
    if (kind === "npc") { state.npcCatalogLimit += 60; renderNpcCatalog(); }
    if (kind === "monster") { state.monsterCatalogLimit += 60; renderMonsterCatalog(); }
    if (kind === "boss") { state.bossCatalogLimit += 60; renderBossCatalog(); }
  });
}

function renderNpcCatalogCard(npc) {
  const meta = npc.city || "Cidade nao informada";
  const occupation = [npc.job, npc.job2].filter(Boolean).join(" / ");

  return `
    <button type="button" class="entity-row npc-row" data-npc-name="${escapeHtml(npc.name)}" data-tooltip="${escapeHtml(t("common.viewDetails"))}">
      ${renderLibraryCatalogSprite(npc)}
      <span>
        <strong>${escapeHtml(npc.name)}</strong>
        <small>${escapeHtml(meta)}</small>
      </span>
      <em>${occupation ? escapeHtml(occupation) : "Funcao nao informada"}</em>
    </button>
  `;
}

function renderMonsterCatalogCard(monster) {
  const meta = [
    Array.isArray(monster.categoryLabels) ? monster.categoryLabels.slice(0, 2).join(" - ") : "",
    monster.hitpoints ? `${formatCompactNumber(monster.hitpoints)} HP` : "",
    monster.experience ? `${formatCompactNumber(monster.experience)} XP` : ""
  ].filter(Boolean).join(" - ") || "Detalhe sob demanda";

  return `
    <button type="button" class="entity-row" data-monster-name="${escapeHtml(monster.name)}" data-tooltip="${escapeHtml(t("common.viewDetails"))}">
      ${renderLibraryCatalogSprite(monster)}
      <span>
        <strong>${escapeHtml(monster.name)}</strong>
        <small>${escapeHtml(meta)}</small>
      </span>
    </button>
  `;
}

function renderBossCatalogCard(monster) {
  const key = normalizeSearchText(monster.bossCategory);
  const icon = BOSSTIARY_ICONS[key] || "";
  const thresholds = getBosstiaryThresholds(key);
  const title = monster.bossCategory || "Boss";

  return `
    <button type="button" class="boss-card" data-monster-name="${escapeHtml(monster.name)}" data-tooltip="${escapeHtml(t("common.viewDetails"))}">
      <div class="boss-card-title">
        ${icon ? `<img src="${escapeHtml(icon)}" alt="${escapeHtml(title)}" title="${escapeHtml(title)}">` : ""}
        <strong>${escapeHtml(monster.name)}</strong>
      </div>
      ${renderLibraryCatalogSprite(monster, "boss-card-image")}
      <small>Total Kills</small>
      <div class="boss-progress">
        ${thresholds.map((value) => `<span>${escapeHtml(value)}</span>`).join("")}
      </div>
      <em>${escapeHtml(title)}</em>
    </button>
  `;
}

function getBosstiaryThresholds(key) {
  if (key === "bane") return ["25", "100", "300"];
  if (key === "nemesis") return ["1", "3", "5"];
  return ["5", "20", "60"];
}

function renderLibraryCatalogSprite(entity = {}, className = "") {
  const animatedSrc = String(entity.imageSrc || "").trim();
  const stillSrc = String(entity.stillImageSrc || animatedSrc).trim();
  if (!stillSrc) return "";
  return `<img${className ? ` class="${escapeHtml(className)}"` : ""} src="${escapeHtml(stillSrc)}" data-library-still-src="${escapeHtml(stillSrc)}" data-library-animated-src="${escapeHtml(animatedSrc)}" alt="${escapeHtml(entity.name || "")}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">`;
}

function bindLibraryCatalogSpriteAnimations(container) {
  if (!container) return;
  container.querySelectorAll("img[data-library-animated-src]").forEach((image) => {
    const showAnimation = () => {
      const animatedSrc = image.dataset.libraryAnimatedSrc || "";
      if (animatedSrc && image.src !== animatedSrc) image.src = animatedSrc;
    };
    const showStill = () => {
      const stillSrc = image.dataset.libraryStillSrc || "";
      if (stillSrc && image.src !== stillSrc) image.src = stillSrc;
    };
    image.closest("button")?.addEventListener("pointerenter", showAnimation);
    image.closest("button")?.addEventListener("pointerleave", showStill);
    image.closest("button")?.addEventListener("focusin", showAnimation);
    image.closest("button")?.addEventListener("focusout", showStill);
  });
}

async function openNpcDetail(name, options = {}) {
  if (!name) {
    return;
  }

  if (!options.skipHistory) {
    pushCurrentNavigationEntry();
  }

  const requestId = ++state.npcDetailRequestId;
  showEntityLoading(`Carregando ${name}...`);
  scrollEntityDetailIntoView({ behavior: "auto" });
  showGlobalLoading(`Carregando ${name}...`);

  try {
    const detail = await fetchNpcDetail({ name });

    if (requestId !== state.npcDetailRequestId) {
      return;
    }

    renderNpcDetail(detail);
    scrollEntityDetailIntoView({ behavior: "auto" });
    setCurrentNavigationEntry({
      type: "npc",
      name: detail.name || name,
      slug: detail.slug || slugifyItemInput(detail.name || name)
    });
  } catch (error) {
    if (requestId === state.npcDetailRequestId) {
      renderEntityDetailError(error, "NPC");
    }
  } finally {
    hideGlobalLoading();
  }
}

async function openMonsterDetail(name, options = {}) {
  if (!name) {
    return;
  }

  if (!options.skipHistory) {
    pushCurrentNavigationEntry();
  }

  const requestId = ++state.monsterDetailRequestId;
  const detailCacheKey = getMonsterDetailMemoryCacheKey(name);
  const cachedDetail = state.monsterDetailMemoryCache.get(detailCacheKey) || null;

  if (cachedDetail) {
    // Navigation back to a detail already opened in this session must not
    // rebuild the local detail pipeline. Live boss data remains independent
    // and is still loaded by its own cache-aware background path below.
    state.currentMonsterDetail = cachedDetail;
    renderMonsterDetail(cachedDetail);
    void loadCreatureGearRecommendation(cachedDetail, requestId);
    void loadMonsterBossTracker(cachedDetail, requestId);
    scrollEntityDetailIntoView({ behavior: "auto" });
    setCurrentNavigationEntry({
      type: "creature",
      name: cachedDetail.name || name,
      slug: cachedDetail.slug || slugifyItemInput(cachedDetail.name || name),
      category: cachedDetail.bossCategory ? "boss" : "creature"
    });
    return;
  }

  state.currentMonsterDetail = null;
  state.currentBossTracker = null;
  state.bossRespawnHistoryLimit = 10;
  showEntityLoading(`Carregando ${name}...`);
  scrollEntityDetailIntoView({ behavior: "auto" });
  showGlobalLoading(`Carregando ${name}...`);

  try {
    const selectedWorld = getSelectedWorld();
    const detail = await fetchCreatureDetail({
      name,
      worldName: selectedWorld?.name || "",
      worldSlug: selectedWorld?.slug || "",
      includeBossTracker: false
    });

    if (requestId !== state.monsterDetailRequestId) {
      return;
    }

    state.currentMonsterDetail = detail;
    rememberMonsterDetail(detailCacheKey, detail);
    renderMonsterDetail(detail);
    void loadCreatureGearRecommendation(detail, requestId);
    void loadMonsterBossTracker(detail, requestId);
    scrollEntityDetailIntoView({ behavior: "auto" });
    setCurrentNavigationEntry({
      type: "creature",
      name: detail.name || name,
      slug: detail.slug || slugifyItemInput(detail.name || name),
      category: detail.bossCategory ? "boss" : "creature"
    });
  } catch (error) {
    if (requestId === state.monsterDetailRequestId) {
      renderEntityDetailError(error, "criatura");
    }
  } finally {
    hideGlobalLoading();
  }
}

function getMonsterDetailMemoryCacheKey(name) {
  return slugifyItemInput(name || "");
}

function rememberMonsterDetail(key, detail) {
  if (!key || !detail) {
    return;
  }

  state.monsterDetailMemoryCache.delete(key);
  state.monsterDetailMemoryCache.set(key, detail);
  while (state.monsterDetailMemoryCache.size > MONSTER_DETAIL_MEMORY_CACHE_LIMIT) {
    const oldestKey = state.monsterDetailMemoryCache.keys().next().value;
    state.monsterDetailMemoryCache.delete(oldestKey);
  }
}

function renderNpcDetail(detail) {
  const jobs = [detail.job, detail.job2].filter((job) => job && !isWeakNpcJobLabel(job));
  const description = detail.description || (jobs.length
    ? `Este NPC é ${jobs.map(escapeHtml).join(", ")}.`
    : "Ocupação não informada.");

  const detailRoot = setEntityDetailHtml(`
    <div class="entity-hero npc-hero" data-library-section="hero">
      <img src="${escapeHtml(detail.imageSrc || "")}" alt="${escapeHtml(detail.name)}" onerror="this.style.visibility='hidden'">
      <div>
        <p class="muted">${escapeHtml(detail.city || "Local nao informado")}</p>
        <h3>${escapeHtml(detail.name)}</h3>
      </div>
    </div>
    <div class="entity-chip-row" data-library-section="summary">
      ${renderEntityChip("Cidade", detail.city, "npc-city")}
      ${jobs.map((job) => renderEntityChip("Funcao", job, "npc-job")).join("")}
      ${renderEntityChip("Comercio", renderTradeLabel(detail.trade))}
      ${renderEntityChip("Adicionado", detail.implemented)}
    </div>
    ${renderNpcLocationSection(detail)}
    <div data-library-section="description">${renderEntityTextSection(t("common.description"), description)}</div>
    ${renderNpcNotes(detail)}
    <div data-library-section="sounds">${renderSoundList(detail.sounds, "npc")}</div>
    <div data-library-section="trade">${renderNpcTradeItems(detail.tradeItems)}</div>
    <div data-library-section="history">${renderEntityTextSectionWithInlineMaps(t("creature.history"), detail.history, detail.name)}</div>
    <div data-library-section="details">${renderNpcCanonicalFactsSection(detail)}</div>
    <div data-library-section="actions">${detail.wikiUrl ? `<button type="button" class="entity-link-chip entity-link-bottom" data-external-url="${escapeHtml(detail.wikiUrl)}">${escapeHtml(t("common.openWiki"))}</button>` : ""}</div>
  `);
  applyEditorialSectionOrder(detailRoot, detail.canonicalDocument?.presentation?.template);
}

function isWeakNpcJobLabel(value) {
  const normalized = normalizeSearchText(value);
  return !normalized || normalized === "unknown occupation" || normalized === "unknown" || normalized === "desconhecido" || normalized.includes("sem ocupacao");
}

function renderNpcLocationSection(detail) {
  const location = detail.location || detail.city || "";

  if (!location) {
    return "";
  }

  const mapActions = detail.map?.url
    ? renderBossLocationMapActions({
        ...detail,
        location
      })
    : "";

  return `
    <section data-library-section="location">
      <h4>Localiza&ccedil;&atilde;o</h4>
      <p>${escapeHtml(location)}</p>
      ${mapActions}
    </section>
  `;
}

function renderMonsterLocationSection(detail) {
  const location = detail.location || "";
  const isBossDetail = Boolean(detail.bossCategory || normalizeSearchText(detail.isBoss) === "yes");

  if (!location && !isBossDetail) {
    return "";
  }

  // Library maps always stay in the current detail view. A creature is not a
  // special case: the same inline, toggleable map used by bosses is safer and
  // avoids creating a desktop popup or opening an external browser.
  // Bosses podem receber mapa e rota somente depois da consulta ao Tracker.
  // Mantenha o ponto de montagem desde a ficha inicial; a linha fica oculta
  // ate que o acervo local ou o Hub entregue ao menos uma acao valida.
  const mapActions = (isBossDetail || detail.map?.url) ? renderBossLocationMapActions(detail) : "";

  return `
    <section data-library-section="location">
      <h4>${escapeHtml(t("common.locations"))}</h4>
      <p>${escapeHtml(location || "-")}</p>
      ${mapActions}
    </section>
  `;
}

function renderBossLocationMapActions(detail = {}) {
  const locationUrl = String(detail.map?.url || "").trim();
  const locationTitle = `${detail.name || "Boss"} - ${detail.location || "Mapa"}`;

  return `
    <div class="boss-map-action-row${locationUrl ? "" : " hidden"}" data-boss-map-actions data-location-map-url="${escapeHtml(locationUrl)}" data-location-map-title="${escapeHtml(locationTitle)}">
      ${locationUrl ? `<button type="button" class="entity-link-chip boss-map-toggle" data-boss-map-panel="location">${escapeHtml(t("common.showOnMap"))}</button>` : ""}
      <span data-boss-route-action-slot></span>
    </div>
    <div class="boss-inline-map hidden" data-boss-inline-map-panel></div>
  `;
}

function renderNpcNotes(detail = {}) {
  const spoilers = normalizeNpcSpoilers(detail);
  const regularNote = normalizeUiText(stripSpoilerPrefixFromNotes(detail.notes || ""));
  const isYasir = normalizeSearchText(detail.name) === "yasir";

  if (!regularNote && spoilers.length === 0 && !isYasir) {
    return "";
  }

  return `
    <section data-library-section="notes">
      <h4>${escapeHtml(t("common.notes"))}</h4>
      ${isYasir ? `<p class="npc-mini-world-change-note"><button type="button" class="inline-entity-link" data-open-mini-world-change="oriental-trader">${escapeHtml(t("npc.yasirMiniWorldChange"))}</button></p>` : ""}
      ${regularNote ? renderLibraryNarrative(regularNote, detail.name) : ""}
      ${spoilers.map((spoiler, index) => renderNpcSpoiler(spoiler, index)).join("")}
    </section>
  `;
}

function renderNpcCanonicalFactsSection(detail = {}) {
  // City, functions, trade, notes and history already have native blocks.
  // Keep any other published fact visible instead of silently losing it.
  const entries = canonicalFactEntries(detail.canonicalFacts, [
    "Cidade", "City", "Stadt", "Local", "Location", "Ort",
    "Função", "Funcao", "Function", "Funktion", "Funções", "Funcoes", "Functions", "Funktionen",
    "Comércio", "Comercio", "Trade", "Handel", "Venda", "Sale", "Verkauf", "Compra", "Purchase", "Kauf",
    "Implementado", "Implemented", "Implementiert", "Notas", "Notes", "Hinweise",
    "Falas", "Sounds", "Laute", "Aussagen", "História", "Historia", "History", "Geschichte"
  ]);
  if (!entries.length) return "";
  return `
    <section class="entity-fact-section">
      <h4>${escapeHtml(t("common.details"))}</h4>
      ${renderCanonicalFactList(entries, "entity-fact-list")}
    </section>
  `;
}

function normalizeNpcSpoilers(detail = {}) {
  const explicitSpoilers = Array.isArray(detail.spoilers) ? detail.spoilers : [];
  const parsedSpoilers = parseNpcSpoilersFromNotes(detail.notes || "");

  return [...explicitSpoilers, ...parsedSpoilers]
    .map((spoiler) => ({
      title: spoiler.title || t("common.spoiler"),
      text: normalizeUiText(spoiler.text || spoiler.description || "")
    }))
    .filter((spoiler) => spoiler.text.trim());
}

function parseNpcSpoilersFromNotes(notes) {
  const text = String(notes || "").trim();

  if (!text) {
    return [];
  }

  const marker = /Spoiler,\s*clique\s+para\s+mostrar\/esconder\s*/i;
  if (!marker.test(text)) {
    return [];
  }

  return text
    .split(marker)
    .slice(1)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => ({ title: t("common.spoiler"), text: entry }));
}

function stripSpoilerPrefixFromNotes(notes) {
  const text = String(notes || "").trim();

  if (!/Spoiler,\s*clique\s+para\s+mostrar\/esconder/i.test(text)) {
    return text;
  }

  return text.replace(/Spoiler,\s*clique\s+para\s+mostrar\/esconder[\s\S]*$/i, "").trim();
}

function renderNpcSpoiler(spoiler, index) {
  return `
    <div class="npc-spoiler">
      <div class="npc-spoiler-title">${escapeHtml(spoiler.title || t("common.spoiler"))}</div>
      <button type="button" class="npc-spoiler-toggle" data-npc-spoiler-toggle="${index}" aria-expanded="false">
        ${escapeHtml(t("common.clickHereTo"))} <span>${escapeHtml(t("common.show").toUpperCase())}</span>
      </button>
      <div class="npc-spoiler-body hidden" data-npc-spoiler-body="${index}">
        ${escapeHtml(spoiler.text)}
      </div>
    </div>
  `;
}

function renderMonsterDetail(detail) {
  const isBossDetail = Boolean(detail.bossCategory || normalizeSearchText(detail.isBoss) === "yes");
  const wikiButton = detail.wikiUrl
    ? `<button type="button" class="entity-link-chip entity-link-bottom" data-external-url="${escapeHtml(detail.wikiUrl)}">${escapeHtml(t("common.openWiki"))}</button>`
    : "";
  const stats = [
    ["HP", formatCreatureStatValue(detail.hitpoints, formatCompactNumber)],
    ["XP", formatCreatureExperienceValue(detail.experience, detail.bonusExperience)],
    ["Velocidade", formatCreatureStatValue(detail.speed)],
    ["Armadura", formatCreatureStatValue(detail.armor)],
    ["Mitigação", formatCreatureStatValue(detail.mitigation, (value) => `${value}%`)],
    ["Charms", formatCreatureStatValue(detail.charms)],
    ["Dificuldade", formatCreatureTextValue(detail.difficulty)],
    ["Ocorrencia", formatCreatureTextValue(detail.occurrence)]
  ];

  const detailRoot = setEntityDetailHtml(`
    <div data-tutorial-focus="creature-summary" data-library-section="hero">
      <div class="entity-hero creature-hero">
        <img src="${escapeHtml(detail.imageSrc || "")}" alt="${escapeHtml(detail.name)}" onerror="this.style.visibility='hidden'">
        <div>
          <p class="muted">${escapeHtml([detail.creatureClass, detail.primaryType].filter(Boolean).join(" - ") || t("creature.entity"))}</p>
          <h3>${escapeHtml(detail.name)}${renderBossCategoryBadge(detail.bossCategory)}</h3>
          <p>${escapeHtml([detail.secondaryType, detail.isBoss === "yes" ? "Boss" : ""].filter(Boolean).join(" - "))}</p>
        </div>
      </div>
    </div>
    <div data-library-section="status">${renderMonsterStatGrid(stats)}</div>
    <div data-library-section="warning">${renderCreatureBestiaryWarning(detail)}</div>
    <div data-library-section="damage">${renderDamageTable(detail.damageModifiers)}</div>
    <div data-library-section="traits">${renderCreatureTraits(detail)}</div>
    <div data-library-section="abilities">${renderCreatureAbilities(detail.abilities)}</div>
    <div data-library-section="location">${renderMonsterLocationSection(detail)}</div>
    <div data-library-section="description">${renderEntityTextSection(t("creature.behaviour"), detail.behaviour)}</div>
    <div data-library-section="notes">${renderEntityTextSectionWithInlineMaps(t("common.notes"), detail.notes, detail.name)}</div>
    <div data-library-section="sounds">${renderSoundList(detail.sounds, "monster")}</div>
    <div data-library-section="history">${renderEntityTextSection(t("creature.history"), detail.history)}</div>
    <div data-library-section="loot">${renderCreatureLoot(detail.loot)}</div>
    <div data-library-section="tables">${renderLibraryDataTables(detail.tables)}</div>
    <div data-tutorial-focus="boss-extra-details" data-library-section="details">${renderCreatureCanonicalFactsSection(detail)}</div>
    <div data-library-section="actions">${renderCreatureDetailActionRow(wikiButton)}</div>
    <div data-library-section="boss-tracker">${renderBossTrackerHost(detail)}</div>
    <div data-library-section="gear-recommendations">${renderCreatureGearRecommendationHost(detail)}</div>
  `);
  applyEditorialSectionOrder(detailRoot, detail.canonicalDocument?.presentation?.template);
}

function renderCreatureCanonicalFactsSection(detail = {}) {
  // A canonical fact must not repeat a richer visual section. Keep only
  // fields for which this screen has no dedicated presentation.
  const entries = canonicalFactEntries(detail.canonicalFacts, [
    "Vida", "Hitpoints", "Trefferpunkte", "Experiência", "Experience", "Erfahrung",
    "Classe", "Class", "Klasse", "Tipo", "Type", "Typ",
    "Localização", "Location", "Fundort", "Comportamento", "Behaviour", "Verhalten",
    "Notas", "Notes", "Hinweise", "História", "History", "Geschichte",
    "Falas", "Sounds", "Laute", "Aussagen", "Habilidades", "Abilities", "Fähigkeiten",
    "Empurrável", "Pushable", "Verschiebbar", "Empurra objetos", "Pushes objects", "Schiebt Objekte", "Kann Gegenstände schieben",
    "Imunidades", "Immunities", "Immunitäten", "Modificadores de dano", "Damage modifiers", "Schadensmodifikatoren",
    "Loot", "Beute", "Velocidade", "Speed", "Geschwindigkeit", "Armadura", "Armor", "Rüstung",
    "Mitigation", "Mitigação", "Schadensminderung", "Charms", "Dificuldade", "Difficulty", "Schwierigkeit",
    "Ocorrência", "Occurrence", "Vorkommen"
  ]);
  if (!entries.length) return "";
  return `
    <section class="entity-fact-section">
      <h4>${escapeHtml(t("creature.characteristics"))}</h4>
      ${renderCanonicalFactList(entries, "entity-fact-list")}
    </section>
  `;
}

function renderCreatureDetailActionRow(wikiButton) {
  return `
    <div class="creature-detail-action-row">
      <div class="creature-detail-action-left">${wikiButton || ""}</div>
    </div>
  `;
}

function renderCreatureGearRecommendationHost(detail) {
  const name = String(detail?.name || "").trim();

  if (!name) {
    return "";
  }

  return `
    <section class="creature-gear-section" data-creature-gear-shell data-creature-name="${escapeHtml(name)}">
      <div class="creature-gear-loading">
        <span class="global-loading-spinner boss-tracker-spinner" aria-hidden="true"></span>
        <strong>${escapeHtml(t("npcs.loadingCreatureRecommendations"))}</strong>
      </div>
    </section>
  `;
}

function renderMonsterBossHeader(detail, bossTracker) {
  return `${escapeHtml(detail.name)}${renderBossCategoryBadge(detail.bossCategory)}${renderBossAppearanceBadge(bossTracker)}`;
}

function renderBossTrackerHost(detail) {
  if (!detail.bossCategory && normalizeSearchText(detail.isBoss) !== "yes") {
    return "";
  }

  return `
    <section class="boss-tracker-section boss-tracker-shell" data-boss-tracker-shell>
      <div class="boss-tracker-loading" data-boss-tracker-loading>
        <span class="global-loading-spinner boss-tracker-spinner" aria-hidden="true"></span>
        <strong>${escapeHtml(t("creature.loadingBossStats"))}</strong>
      </div>
    </section>
  `;
}

function renderMonsterOverview(stats, detail = {}) {
  return `
    <section class="creature-overview">
      <div class="creature-status-wrap">
        ${renderMonsterStatGrid(stats)}
        ${renderCreatureBestiaryWarning(detail)}
      </div>
      <div class="creature-elements-wrap">
        ${renderDamageTable(detail.damageModifiers)}
        ${renderCreatureTraits(detail)}
      </div>
    </section>
  `;
}

function renderMonsterStatGrid(stats) {
  return `
    <div class="creature-status-panel">
      ${stats.map(([label, value]) => {
        const icon = getCreatureStatIcon(label, value) || "";
        const isEmpty = value === "-";
        const iconOnly = label === "Dificuldade" || label === "Ocorrencia";
        const displayLabel = creatureStatDisplayLabel(label);
        const tooltip = iconOnly && !isEmpty ? `${displayLabel}: ${value}` : "";
        return `
          <div class="creature-status-line${isEmpty ? " empty" : ""}${iconOnly ? " icon-only-stat" : ""}"${tooltip ? ` data-tooltip="${escapeHtml(tooltip)}"` : ""}>
            ${icon ? `<img src="${escapeHtml(icon)}" alt="">` : ""}
            ${
              iconOnly
                ? `<span>${escapeHtml(displayLabel)}</span>`
                : `<span><strong>${escapeHtml(value)}</strong> ${escapeHtml(displayLabel)}</span>`
            }
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function creatureStatDisplayLabel(label) {
  const keys = {
    Velocidade: "creature.speed",
    Armadura: "creature.armor",
    "Mitigação": "creature.mitigation",
    Dificuldade: "creature.difficulty",
    Ocorrencia: "creature.occurrence"
  };
  return keys[label] ? t(keys[label]) : label;
}

function getCreatureStatIcon(label, value) {
  const normalized = normalizeSearchText(value);

  if (label === "Dificuldade") {
    return CREATURE_DIFFICULTY_ICONS[normalized] || CREATURE_STAT_ICONS[label] || "";
  }

  if (label === "Ocorrencia") {
    return CREATURE_OCCURRENCE_ICONS[normalized] || CREATURE_STAT_ICONS[label] || "";
  }

  return CREATURE_STAT_ICONS[label] || "";
}

function renderBossCategoryBadge(category) {
  const normalized = normalizeSearchText(category);
  const icon = BOSSTIARY_ICONS[normalized];

  if (!icon) {
    return "";
  }

  const tooltip = BOSSTIARY_TOOLTIPS[normalized] || [];
  const tooltipText = tooltip.length ? tooltip.join("\n") : category;
  return `
    <span class="boss-category-badge" tabindex="0" data-tooltip="${escapeHtml(tooltipText)}">
      <img src="${escapeHtml(icon)}" alt="${escapeHtml(category)}">
      <span>${escapeHtml(category)}</span>
    </span>
  `;
}

function renderBossAppearanceBadge(bossTracker) {
  if (!bossTracker || (!bossTracker.chanceLabel && bossTracker.chancePercentage === null)) {
    return "";
  }

  const parts = [
    translateBossChanceLabel(bossTracker.chanceLabel),
    bossTracker.chancePercentage !== null ? `${bossTracker.chancePercentage}%` : ""
  ].filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return `
    <span class="tool-badge boss-appearance-badge" data-tooltip="${escapeHtml(`Chance de aparecer em ${bossTracker.worldName || "mundo atual"}`)}" tabindex="0">
      ${escapeHtml(parts.join(" - "))}
    </span>
  `;
}

function renderBossTrackerSections(bossTracker) {
  if (!bossTracker) {
    return "";
  }

  return `
    <div data-tutorial-focus="boss-statistics">
      ${renderBossWorldStatsSection(bossTracker)}
      ${renderBossGlobalStatsSection(bossTracker)}
    </div>
    ${renderBossProbabilityChartSection(bossTracker)}
    <div data-tutorial-focus="boss-history">
      ${renderBossRespawnHistorySection(bossTracker)}
    </div>
    ${renderBossCrossWorldsSection(bossTracker)}
  `;
}

function renderBossWorldStatsSection(bossTracker) {
  const worldName = bossTracker.worldName || "mundo atual";
  const worldStats = bossTracker.worldStats || null;
  const lastSeenValue = worldStats?.lastSeenOnWorld
    ? formatBossSeenDate(worldStats.lastSeenOnWorld)
    : formatBossSeenDate(bossTracker?.lastSeenDate) || formatBossLastSeenValue(bossTracker);
  const lastSeenNote = worldStats?.lastSeenOnWorldRelative
    ? `(${translateBossRelativeAge(worldStats.lastSeenOnWorldRelative)})`
    : bossTracker?.lastSeenRelative
      ? `(${translateBossRelativeAge(bossTracker.lastSeenRelative)})`
      : "";
  const cards = [
    {
      icon: BOSS_STAT_ICONS.spawnToday,
      label: "Spawn do boss hoje",
      value: formatBossChanceValue(worldStats?.spawnTodayLabel, worldStats?.spawnTodayPercentage),
      note: ""
    },
    {
      icon: BOSS_STAT_ICONS.expectedIn,
      label: "Esperado em",
      value: translateBossExpectedIn(worldStats?.expectedIn) || "-",
      note: translateBossExpectedWindow(worldStats?.expectedWindow)
    },
    {
      icon: BOSS_STAT_ICONS.lastSeenWorld,
      label: `Visto pela ultima vez em ${worldName}`,
      value: lastSeenValue || "-",
      note: lastSeenNote
    },
    {
      icon: BOSS_STAT_ICONS.killedWorld,
      label: `Morto em ${worldName}`,
      value: formatBossMetricNumber(worldStats?.killedOnWorld),
      note: ""
    },
    {
      icon: BOSS_STAT_ICONS.playersKilledWorld,
      label: `Jogadores mortos em ${worldName}`,
      value: formatBossMetricNumber(worldStats?.killedPlayersOnWorld),
      note: ""
    }
  ];
  const hasAnyValue = cards.some((entry) => entry.value && entry.value !== "-");

  if (!hasAnyValue) {
    return "";
  }

  return `
    <section class="boss-tracker-section">
      <h4>Estatisticas em ${escapeHtml(worldName)}</h4>
      <div class="boss-world-stats-grid">
        ${cards.map((card, index) => `
          ${renderBossStatCard(card, index < 2)}
        `).join("")}
      </div>
    </section>
  `;
}

function renderBossGlobalStatsSection(bossTracker) {
  const cards = [
    {
      icon: BOSS_STAT_ICONS.killedTotal,
      label: "Morto no total",
      value: formatBossMetricNumber(bossTracker.globalStats?.killedOverall)
    },
    {
      icon: BOSS_STAT_ICONS.playersKilledTotal,
      label: "Jogadores mortos no total",
      value: formatBossMetricNumber(bossTracker.globalStats?.killedPlayersOverall)
    },
    {
      icon: BOSS_STAT_ICONS.lastSeenTibia,
      label: "Visto pela ultima vez no Tibia",
      value: formatBossSeenDate(bossTracker.globalStats?.lastSeenInTibia) || formatBossLastSeenValue(bossTracker)
    },
    {
      icon: BOSS_STAT_ICONS.firstAppearance,
      label: "Primeira aparicao",
      value: formatBossSeenDate(bossTracker.globalStats?.firstOccurrence) || bossTracker.globalStats?.firstOccurrence || "-"
    }
  ];
  const hasAnyValue = cards.some((entry) => entry.value && entry.value !== "-");

  if (!hasAnyValue) {
    return "";
  }

  return `
    <section class="boss-tracker-section">
      <h4>Estatisticas globais</h4>
      <div class="boss-world-stats-grid boss-global-stats-grid">
        ${cards.map((card) => renderBossStatCard(card)).join("")}
      </div>
    </section>
  `;
}

function renderBossStatCard(card = {}, wide = false) {
  return `
    <article class="boss-world-stat-card${wide ? " boss-world-stat-card-wide" : ""}">
      ${card.icon ? `<img class="boss-world-stat-icon" src="${escapeHtml(card.icon)}" alt="" loading="lazy">` : ""}
      <span>${escapeHtml(card.label || "-")}</span>
      <strong>${escapeHtml(card.value || "-")}</strong>
      ${card.note ? `<small>${escapeHtml(card.note)}</small>` : ""}
    </article>
  `;
}

function renderBossProbabilityChartSection(bossTracker) {
  const points = getBossProbabilityChartPoints(bossTracker);

  if (points.length === 0) {
    return "";
  }

  const chartMode = state.bossProbabilityChartMode === "dates" ? "dates" : "days";
  const isDateMode = chartMode === "dates";
  const currentDay = getBossCurrentDay(bossTracker);
  const scalePoints = isDateMode && currentDay !== null
    ? points.filter((entry) => Number(entry.day) <= currentDay)
    : points;
  const maxPercentage = getBossChartMaxPercentage(scalePoints.length ? scalePoints : points);
  const axisLabels = [];
  for (let value = maxPercentage; value >= 0; value -= 5) {
    axisLabels.push(value);
  }

  return `
    <section class="boss-tracker-section boss-chart-card ${isDateMode ? "date-mode" : "days-mode"}">
      <div class="boss-chart-header">
        <h4>${escapeHtml(isDateMode ? "Grafico por data" : "Grafico de probabilidade de spawn")}</h4>
        <div class="boss-chart-actions">
          <button type="button" class="boss-chart-zoom-button" data-boss-chart-zoom="-1" data-tooltip="Reduzir zoom" aria-label="Reduzir zoom">-</button>
          <button type="button" class="boss-chart-zoom-button" data-boss-chart-zoom="1" data-tooltip="Aumentar zoom" aria-label="Aumentar zoom">+</button>
          <button type="button" class="boss-chart-mode-toggle" data-boss-chart-mode-toggle data-tooltip="${escapeHtml(isDateMode ? t("boss.chart.showDaysSinceLastVisit") : t("boss.chart.showCurrentCycleDates"))}">
            ${escapeHtml(isDateMode ? "Dias" : "Datas")}
          </button>
        </div>
      </div>
      <div class="boss-chart-layout">
        <div class="boss-chart-axis-title">Porcentagem de ocorrencias</div>
        <div class="boss-chart-panel">
          <div class="boss-chart-grid">
            ${axisLabels.map((label) => `
              <div class="boss-chart-grid-line" style="bottom:${(label / maxPercentage) * 100}%">
                <span>${escapeHtml(String(label))}%</span>
              </div>
            `).join("")}
            ${renderBossProbabilityChartColumns(points, {
              currentDay,
              maxPercentage,
              chartMode,
              datePoints: isDateMode ? getBossProbabilityDatePoints(points, bossTracker) : null,
              hideFutureDates: isDateMode,
              columnWidth: getBossChartColumnWidth()
            })}
          </div>
          <div class="boss-chart-axis-footer">${escapeHtml(isDateMode ? "Data do ciclo atual" : "Dias desde a ultima visita")}</div>
        </div>
      </div>
      ${bossTracker.occurrenceSummary ? `<p class="boss-tracker-summary">${escapeHtml(translateBossOccurrenceSummary(bossTracker.occurrenceSummary))}</p>` : ""}
    </section>
  `;
}

function renderBossRespawnHistorySection(bossTracker) {
  const rows = Array.isArray(bossTracker.respawnHistory) && bossTracker.respawnHistory.length > 0
    ? bossTracker.respawnHistory
    : getBossRespawnHistoryRows(bossTracker.chart, bossTracker.totalOccurrences);
  const historyNote = bossTracker.respawnHistoryNote || "";

  if (rows.length === 0) {
    return historyNote
      ? `
        <section class="boss-tracker-section">
          <h4>Historico de respawn</h4>
          <div class="empty-inline">${escapeHtml(historyNote)}</div>
        </section>
      `
      : "";
  }

  const limit = state.bossRespawnHistoryLimit === "all"
    ? "all"
    : Math.max(10, Number(state.bossRespawnHistoryLimit) || 10);
  const visibleRows = limit === "all" ? rows : rows.slice(0, limit);

  return `
    <section class="boss-tracker-section">
      <div class="boss-history-header">
        <h4>Historico de respawn</h4>
        <label class="find-party-page-size-field boss-history-limit-field">
          <select data-boss-history-limit>
            <option value="10"${limit === 10 ? " selected" : ""}>10</option>
            <option value="20"${limit === 20 ? " selected" : ""}>20</option>
            <option value="all"${limit === "all" ? " selected" : ""}>Todos</option>
          </select>
        </label>
      </div>
      <div class="boss-history-table boss-history-table-slim">
        <div class="boss-history-head">
          <span>Data</span>
          <span>Bosses mortos</span>
          <span>Jogadores mortos</span>
          <span>Mundo</span>
        </div>
        ${visibleRows.map((row) => `
          <div class="boss-history-body-row">
            <strong>${escapeHtml(row.date ? formatBossSeenDate(row.date) : `Dia ${row.day}`)}</strong>
            <span>${escapeHtml(row.date ? formatBossMetricNumber(row.killedBosses) : formatCompactNumber(row.occurrences))}</span>
            <span>${escapeHtml(row.date ? formatBossMetricNumber(row.killedPlayers) : `${row.share}%`)}</span>
            <span>${escapeHtml(row.world || "-")}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderBossCrossWorldsSection(bossTracker) {
  const rows = Array.isArray(bossTracker.crossWorlds) ? bossTracker.crossWorlds.slice(0, 8) : [];

  if (rows.length === 0) {
    return "";
  }

  return `
    <section class="boss-tracker-section">
      <h4>Outros mundos</h4>
      <div class="boss-history-table">
        ${rows.map((row) => {
          const chanceParts = [
            translateBossChanceLabel(row.chanceLabel),
            row.chancePercentage !== null && row.chancePercentage !== undefined ? `${row.chancePercentage}%` : ""
          ].filter(Boolean);
          return `
            <div class="metric-row">
              <span>${escapeHtml(row.worldName || row.worldSlug || "-")}</span>
              <strong>${escapeHtml(chanceParts.join(" - ") || formatBossSeenDate(row.lastSeenDate) || "-")}</strong>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderCreatureBestiaryWarning(detail = {}) {
  if (!detail.bestiaryWarning) {
    return "";
  }

  return `
    <div class="creature-warning">
      <strong><img src="assets/ui/combat-status/15px-Warning_Icon_Yellow.png" alt=""> ${escapeHtml(t("creature.warningTitle"))}</strong>
      <p>${escapeHtml(t("creature.warningText"))}</p>
    </div>
  `;
}

function renderCreatureTraits(detail = {}) {
  const immunities = [
    detail.paralyzeImmune ? { label: t("creature.paralysis"), value: detail.paralyzeImmune, icon: "assets/ui/combat-status/Slowed_Icon.gif" } : null,
    detail.senseInvisible ? { label: t("creature.invisible"), value: detail.senseInvisible, icon: "assets/ui/combat-status/9px-Invisible_Icon.gif" } : null
  ].filter(Boolean).filter((entry) => isTruthyTrait(entry.value));
  const walksThrough = parseCreatureElementList(detail.walksThrough);
  const hasAnyTrait =
    immunities.length > 0 ||
    walksThrough.length > 0 ||
    isKnownTrait(detail.pushable) ||
    isKnownTrait(detail.pushObjects);

  if (!hasAnyTrait) {
    return "";
  }

  return `
    <div class="creature-traits-grid">
      <div>
        <strong>${escapeHtml(t("creature.immunities"))}:</strong>
        ${renderTraitIcons(immunities, t("creature.none"))}
      </div>
      <div>
        <strong>${escapeHtml(t("creature.pullable"))}:</strong>
        ${renderBooleanTrait(detail.pushable)}
      </div>
      <div>
        <strong>${escapeHtml(t("creature.walksThrough"))}:</strong>
        ${renderElementTraitIcons(walksThrough, t("creature.none"))}
      </div>
      <div>
        <strong>${escapeHtml(t("creature.pushesObjects"))}:</strong>
        ${renderBooleanTrait(detail.pushObjects)}
      </div>
    </div>
  `;
}

function renderTraitIcons(entries, emptyText) {
  if (!entries.length) {
    return `<span class="trait-empty">${escapeHtml(emptyText)}</span>`;
  }

  return `
    <span class="trait-icon-list">
      ${entries.map((entry) => renderTraitIcon(entry.icon, entry.label)).join("")}
    </span>
  `;
}

function renderElementTraitIcons(elements, emptyText) {
  if (!elements.length) {
    return `<span class="trait-empty">${escapeHtml(emptyText)}</span>`;
  }

  return `
    <span class="trait-icon-list">
      ${elements.map((element) => {
        const icon = ELEMENT_ICONS[element] || "";
        return icon ? renderTraitIcon(icon, element) : `<span>${escapeHtml(element)}</span>`;
      }).join("")}
    </span>
  `;
}

function renderTraitIcon(icon, label) {
  return `
    <span class="instant-tooltip-wrap" data-tooltip="${escapeHtml(label)}" tabindex="0">
      <img src="${escapeHtml(icon)}" alt="${escapeHtml(label)}">
    </span>
  `;
}

function renderBooleanTrait(value) {
  if (!isKnownTrait(value)) {
    return `<span class="trait-empty">-</span>`;
  }

  const enabled = isTruthyTrait(value);
  return `<img class="trait-check-icon" src="assets/ui/${enabled ? "Tick.png" : "Cross.png"}" alt="${enabled ? "Sim" : "Nao"}">`;
}

function parseCreatureElementList(value) {
  const cleaned = String(value || "").trim();

  if (!isKnownTrait(cleaned) || /^none$/i.test(cleaned) || /^--$/.test(cleaned)) {
    return [];
  }

  const map = {
    physical: "Fisico",
    earth: "Terra",
    poison: "Terra",
    fire: "Fogo",
    death: "Morte",
    energy: "Energia",
    holy: "Sagrado",
    ice: "Gelo",
    healing: "Cura"
  };

  return cleaned
    .split(/\s*,\s*|\s*\/\s*/)
    .map((entry) => map[normalizeSearchText(entry)] || "")
    .filter(Boolean);
}

function isKnownTrait(value) {
  const normalized = normalizeSearchText(value);
  return Boolean(normalized && normalized !== "?" && normalized !== "unknown");
}

function isTruthyTrait(value) {
  const normalized = normalizeSearchText(value);
  return normalized === "yes" || normalized === "sim" || normalized === "true";
}

function formatCreatureStatValue(value, formatter = (entry) => entry) {
  return value || value === 0 ? formatter(value) : "-";
}

function formatCreatureExperienceValue(experience, bonusExperience) {
  if (!(experience || experience === 0)) {
    return "-";
  }

  return `${formatCompactNumber(experience)} (${formatCompactNumber(bonusExperience || 0)} com bonus)`;
}

function formatCreatureTextValue(value) {
  const text = String(value || "").trim();
  return text && text !== "?" && text.toLowerCase() !== "unknown" ? text : "-";
}

function formatBossMetricNumber(value) {
  return value || value === 0 ? Number(value).toLocaleString("pt-BR") : "-";
}

function formatBossSeenDate(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  if (/^never$/i.test(text)) {
    return "nunca";
  }

  if (/^unknown$/i.test(text)) {
    return "desconhecido";
  }

  if (text === "-") {
    return "-";
  }

  const parsed = new Date(`${text}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleDateString("pt-BR");
}

function translateBossRelativeAge(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  if (/^today$/i.test(text)) {
    return "hoje";
  }

  if (/^yesterday$/i.test(text)) {
    return "ontem";
  }

  const dayMatch = text.match(/^(\d+)\s+days?\s+ago$/i);
  if (dayMatch) {
    const days = Number(dayMatch[1]) || 0;
    return `há ${days} dia${days === 1 ? "" : "s"}`;
  }

  return text;
}

function formatBossLastSeenValue(bossTracker) {
  const dateText = formatBossSeenDate(bossTracker?.lastSeenDate);
  const relativeText = translateBossRelativeAge(bossTracker?.lastSeenRelative);

  if (dateText && relativeText) {
    return `${dateText} (${relativeText})`;
  }

  return dateText || relativeText || "-";
}

function translateBossChanceLabel(value) {
  const normalized = normalizeSearchText(value);

  if (normalized === "no chance") return "Sem chance";
  if (normalized === "low chance") return "Chance baixa";
  if (normalized === "medium chance") return "Chance média";
  if (normalized === "high chance") return "Chance alta";
  return String(value || "").trim();
}

function formatBossChanceValue(label, percentage) {
  const translatedLabel = translateBossChanceLabel(label);
  const formattedPercentage = formatBossPercentValue(percentage);

  if (translatedLabel && formattedPercentage) {
    return `${translatedLabel} (${formattedPercentage})`;
  }

  return translatedLabel || formattedPercentage || "-";
}

function formatBossPercentValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "";
  }

  const usesDecimals = Math.abs(number % 1) > 0.001;
  return `${number.toLocaleString("pt-BR", {
    minimumFractionDigits: usesDecimals ? 2 : 0,
    maximumFractionDigits: usesDecimals ? 2 : 0
  })}%`;
}

function translateBossExpectedIn(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  if (/^today$/i.test(text)) {
    return "hoje";
  }

  if (/^tomorrow$/i.test(text)) {
    return "amanhã";
  }

  const match = text.match(/^(?:in\s+)?(\d+)\s+days?$/i);
  if (match) {
    const days = Number(match[1]) || 0;
    return `em ${days} dia${days === 1 ? "" : "s"}`;
  }

  return text;
}

function translateBossExpectedWindow(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  return text
    .replace(/\bdays?\b/gi, (match) => match.toLowerCase() === "day" ? "dia" : "dias")
    .replace(/\bappears?\b/gi, "aparece")
    .replace(/\bspawns?\b/gi, "aparece")
    .replace(/\bevery\b/gi, "a cada")
    .replace(/\babout\b/gi, "cerca de");
}

function translateBossOccurrenceSummary(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  const match = text.match(/^According to our data,\s*(.+?)\s+has appeared\s+([\d,.]+)\s+times?\s+on the\s+(\d+)(?:st|nd|rd|th)?\s+day after it last appeared,\s+with\s+([\d,.]+)\s+total recorded occurrences\.?$/i);

  if (match) {
    const [, bossName, appearances, day, total] = match;
    const count = Number(String(appearances).replace(/[^\d]/g, ""));
    const appearedText = count === 0
      ? "não apareceu nenhuma vez"
      : `apareceu ${appearances} vez${count === 1 ? "" : "es"}`;

    return `Segundo nossos dados, ${bossName} ${appearedText} no ${day}º dia depois da última aparição, com ${total} ocorrências registradas no total.`;
  }

  return text
    .replace(/^According to our data,\s*/i, "Segundo nossos dados, ")
    .replace(/\bhas appeared\b/gi, "apareceu")
    .replace(/\btimes?\b/gi, "vezes")
    .replace(/\bon the\b/gi, "no")
    .replace(/\bday after it last appeared\b/gi, "dia depois da última aparição")
    .replace(/\bwith\b/gi, "com")
    .replace(/\btotal recorded occurrences\b/gi, "ocorrências registradas no total");
}

function renderBossProbabilityChartColumns(points, options = {}) {
  const currentDay = Number.isFinite(Number(options.currentDay)) ? Number(options.currentDay) : null;
  const maxPercentage = options.maxPercentage || 5;
  const chartMode = options.chartMode === "dates" ? "dates" : "days";
  const datePoints = Array.isArray(options.datePoints) ? options.datePoints : [];
  const hideFutureDates = Boolean(options.hideFutureDates);
  const columnWidth = Number(options.columnWidth) || getBossChartColumnWidth();
  const columnGap = Math.max(1, Math.round(columnWidth / (chartMode === "dates" ? 3 : 2)));
  const barWidth = getBossChartBarWidth(columnWidth);
  const visiblePoints = hideFutureDates && currentDay !== null
    ? points.filter((entry) => Number(entry.day) <= currentDay)
    : points;
  const currentIndex = currentDay !== null
    ? visiblePoints.findIndex((entry) => entry.day === currentDay)
    : -1;
  const currentMarkerLeft = currentIndex >= 0
    ? currentIndex * (columnWidth + columnGap) + columnWidth / 2
    : null;
  const currentPoint = currentIndex >= 0 ? visiblePoints[currentIndex] : null;
  const currentHeight = currentPoint
    ? Math.min(100, Math.max(2, ((Number(currentPoint.percentage) || 0) / maxPercentage) * 100))
    : 0;
  const tagHeightPercent = 8;
  const tagGapPercent = 5;
  const minTagTopPercent = 1;
  const maxTagTopPercent = 100 - tagHeightPercent - 4;
  const currentColumnTopPercent = 100 - currentHeight;
  const tagTopAbove = currentColumnTopPercent - tagHeightPercent - tagGapPercent;
  const tagTopBelow = currentColumnTopPercent + tagGapPercent;
  const currentTagPlacement = tagTopAbove >= minTagTopPercent ? "above" : "below";
  const currentTagTop = Math.min(
    maxTagTopPercent,
    Math.max(minTagTopPercent, currentTagPlacement === "above" ? tagTopAbove : tagTopBelow)
  );
  const currentTagStyle = currentMarkerLeft !== null
    ? `left:${currentMarkerLeft}px;top:${currentTagTop}%`
    : "";
  const currentLabel = currentDay !== null
    ? chartMode === "dates"
      ? "Hoje"
      : (currentDay === 0 ? "Visto hoje" : `Visto há ${currentDay} dia${currentDay === 1 ? "" : "s"}`)
    : "";

  return `
    <div class="boss-chart-plot" style="--boss-chart-column-width:${columnWidth}px;--boss-chart-column-gap:${columnGap}px;--boss-chart-bar-width:${barWidth}px;">
      <div class="boss-chart-scroll" data-boss-chart-scroll data-current-index="${escapeHtml(String(currentIndex))}" data-column-width="${escapeHtml(String(columnWidth))}" data-column-gap="${escapeHtml(String(columnGap))}">
        <div class="boss-chart-track">
          ${currentMarkerLeft !== null ? `<div class="boss-chart-current-line" style="left:${currentMarkerLeft}px"></div>` : ""}
          ${currentMarkerLeft !== null ? `<div class="boss-chart-current-tag ${escapeHtml(currentTagPlacement)}" style="${escapeHtml(currentTagStyle)}">${escapeHtml(currentLabel)}</div>` : ""}
          <div class="boss-chart-columns">
          ${visiblePoints.map((entry, index) => {
            const percentage = Number(entry.percentage) || 0;
            const height = Math.max(2, (percentage / maxPercentage) * 100);
            const isCurrent = currentDay !== null && entry.day === currentDay;
            const datePoint = datePoints.find((point) => point.day === entry.day) || null;
            const displayLabel = chartMode === "dates" && datePoint?.shortLabel ? datePoint.shortLabel : String(entry.day);
            const showLabel = shouldShowBossChartColumnLabel({ index, total: visiblePoints.length, isCurrent, chartMode, columnWidth });
            const tooltip = chartMode === "dates" && datePoint?.fullLabel
              ? `${datePoint.fullLabel} - dia ${entry.day}: ${formatBossPercentValue(percentage) || "0%"}`
              : `${entry.day} dia${entry.day === 1 ? "" : "s"}: ${formatBossPercentValue(percentage) || "0%"}`;
            return `
              <button type="button" class="boss-chart-column${isCurrent ? " current" : ""}" data-tooltip="${escapeHtml(tooltip)}" tabindex="0">
                <span class="boss-chart-bar-wrap">
                  <span class="boss-chart-bar" style="height:${Math.min(100, Math.max(0, height))}%"></span>
                </span>
                <small>${showLabel ? escapeHtml(displayLabel) : ""}</small>
              </button>
            `;
          }).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function shouldShowBossChartColumnLabel({ index, total, isCurrent, chartMode, columnWidth }) {
  if (isCurrent || index === 0 || index === total - 1) {
    return true;
  }

  if (columnWidth <= 5 && index > 0 && index < total - 1) {
    const step = chartMode === "dates" ? 12 : 8;
    return index % step === 0;
  }

  if (total <= 10 || columnWidth >= 12) {
    return true;
  }

  if (chartMode !== "dates" && total <= 35 && columnWidth >= 8) {
    return true;
  }

  const step = columnWidth <= 3 ? 8 : columnWidth <= 5 ? 5 : 3;
  return index % step === 0;
}

function getBossChartBarWidth(columnWidth) {
  if (columnWidth <= 3) {
    return 1;
  }

  if (columnWidth <= 5) {
    return 2;
  }

  if (columnWidth <= 8) {
    return 3;
  }

  return Math.max(4, Math.min(12, Math.round(columnWidth * 0.62)));
}

function getBossCurrentDay(bossTracker = {}) {
  const value = Number(bossTracker.currentDay ?? bossTracker.lastSeenDays);
  return Number.isFinite(value) ? value : null;
}

function getBossChartColumnWidth() {
  const index = Math.min(
    BOSS_CHART_ZOOM_LEVELS.length - 1,
    Math.max(0, Number(state.bossProbabilityChartZoom) || 0)
  );
  return BOSS_CHART_ZOOM_LEVELS[index] || BOSS_CHART_ZOOM_LEVELS[2];
}

function getBossProbabilityDatePoints(points = [], bossTracker = {}) {
  if (!Array.isArray(points) || points.length === 0) {
    return [];
  }

  const anchorDate = getBossLastSeenAnchorDate(bossTracker);
  if (!anchorDate) {
    return [];
  }

  return points.map((entry) => {
    const day = Number(entry.day) || 0;
    const date = addUtcDays(anchorDate, day);
    return {
      day,
      date,
      shortLabel: formatBossChartDate(date, false),
      fullLabel: formatBossChartDate(date, true)
    };
  });
}

function getBossLastSeenAnchorDate(bossTracker = {}) {
  const directDate =
    parseBossIsoDate(bossTracker.worldStats?.lastSeenOnWorld) ||
    parseBossIsoDate(bossTracker.lastSeenDate) ||
    parseBossIsoDate(bossTracker.globalStats?.lastSeenInTibia);

  if (directDate) {
    return directDate;
  }

  const currentDay = getBossCurrentDay(bossTracker);
  if (currentDay === null) {
    return null;
  }

  return addUtcDays(getCurrentTibiaServerDayDate(), -currentDay);
}

function parseBossIsoDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function getCurrentTibiaServerDayDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const getPart = (type) => parts.find((part) => part.type === type)?.value || "0";
  const year = Number(getPart("year"));
  const month = Number(getPart("month"));
  const day = Number(getPart("day"));
  const hour = Number(getPart("hour"));
  const date = new Date(Date.UTC(year, month - 1, day));

  return hour < 10 ? addUtcDays(date, -1) : date;
}

function addUtcDays(date, days) {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function formatBossChartDate(date, includeYear = false) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return includeYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

function getBossProbabilityChartPoints(bossTracker = {}) {
  const spawnChart = Array.isArray(bossTracker.spawnChart) ? bossTracker.spawnChart : [];
  if (spawnChart.length > 0) {
    return [...spawnChart]
      .map((entry) => ({
        day: Number(entry.day) || 0,
        percentage: Number(entry.percentage) || 0
      }))
      .filter((entry) => entry.day > 0)
      .sort((left, right) => left.day - right.day);
  }

  const chart = Array.isArray(bossTracker.chart) ? bossTracker.chart : [];
  if (chart.length === 0) {
    return [];
  }

  const totalOccurrences = Number(bossTracker.totalOccurrences) || chart.reduce((sum, entry) => sum + (Number(entry?.occurrences) || 0), 0);
  const sorted = [...chart]
    .map((entry) => ({
      day: Number(entry?.day) || 0,
      percentage: totalOccurrences > 0
        ? ((Number(entry?.occurrences) || 0) / totalOccurrences) * 100
        : 0
    }))
    .filter((entry) => entry.day > 0)
    .sort((left, right) => left.day - right.day);

  return sorted;
}

function getBossChartMaxPercentage(points = []) {
  const maxValue = Math.max(...points.map((entry) => Number(entry.percentage) || 0), 5);
  return Math.max(5, Math.ceil(maxValue / 5) * 5);
}

function getBossRespawnHistoryRows(chart = [], totalOccurrences = null) {
  if (!Array.isArray(chart) || chart.length === 0) {
    return [];
  }

  return [...chart]
    .filter((entry) => entry && (entry.occurrences || entry.occurrences === 0))
    .sort((left, right) => (right.occurrences || 0) - (left.occurrences || 0))
    .slice(0, 10)
    .map((entry) => ({
      day: entry.day,
      occurrences: entry.occurrences,
      share: totalOccurrences && totalOccurrences > 0
        ? ((entry.occurrences / totalOccurrences) * 100).toFixed(1)
        : "0.0"
    }));
}

async function loadMonsterBossTracker(detail, requestId) {
  if (!detail || (!detail.bossCategory && normalizeSearchText(detail.isBoss) !== "yes")) {
    return;
  }

  try {
    const bossTracker = await requestBossTracker(detail);

    if (requestId !== state.monsterDetailRequestId) {
      return;
    }

    applyMonsterBossTracker(detail, bossTracker);
  } catch (_error) {
    if (requestId !== state.monsterDetailRequestId) {
      return;
    }

    applyMonsterBossTracker(detail, null, true);
  }
}

function getBossTrackerRequestPayload(detail = {}) {
  const selectedWorld = getSelectedWorld();
  return {
    name: String(detail.name || "").trim(),
    worldName: selectedWorld?.name || "",
    worldSlug: selectedWorld?.slug || ""
  };
}

function getBossTrackerRequestKey(payload = {}) {
  return [
    normalizeSearchText(payload.worldSlug || payload.worldName),
    normalizeSearchText(payload.name)
  ].join(":");
}

function requestBossTracker(detail = {}) {
  const payload = getBossTrackerRequestPayload(detail);
  const key = getBossTrackerRequestKey(payload);

  if (!payload.name) {
    return Promise.resolve(null);
  }

  const activeRequest = bossTrackerInFlightRequests.get(key);
  if (activeRequest) {
    return activeRequest;
  }

  const request = fetchBossTracker(payload)
    .finally(() => {
      if (bossTrackerInFlightRequests.get(key) === request) {
        bossTrackerInFlightRequests.delete(key);
      }
    });
  bossTrackerInFlightRequests.set(key, request);
  return request;
}

function warmBossiaryTourBossTracker() {
  return requestBossTracker({ name: "Yaga the Crone" }).catch(() => null);
}

function applyMonsterBossTracker(detail, bossTracker, hasError = false) {
  const shell = els.entityDetailContent?.querySelector("[data-boss-tracker-shell]");
  const heroTitle = els.entityDetailContent?.querySelector(".entity-hero h3");
  const mapActions = els.entityDetailContent?.querySelector("[data-boss-map-actions]");

  if (!shell) {
    return;
  }

  if (heroTitle) {
    heroTitle.innerHTML = normalizeUiText(renderMonsterBossHeader(detail, bossTracker));
  }

  // Location belongs to the Library record and remains available while the
  // optional tracker request is slow or unavailable.
  syncBossMapActions(detail, bossTracker, mapActions);

  if (hasError) {
    state.currentBossTracker = null;
    shell.innerHTML = `<div class="empty-inline">Nao foi possivel carregar estatisticas adicionais do boss.</div>`;
    bindSkillDynamicTooltips(shell);
    return;
  }

  if (!bossTracker) {
    state.currentBossTracker = null;
    shell.innerHTML = `<div class="empty-inline">Nenhuma estatistica adicional encontrada para este boss.</div>`;
    bindSkillDynamicTooltips(shell);
    return;
  }

  state.currentBossTracker = bossTracker;
  const trackerSectionsHtml = renderBossTrackerSections(bossTracker);
  shell.innerHTML = normalizeUiText(
    trackerSectionsHtml || `<div class="empty-inline">Estatisticas encontradas, mas sem grafico ou historico disponivel para este boss.</div>`
  );
  bindEntityDetailActions(shell);
  bindSkillDynamicTooltips(shell);
  centerBossChartScrolls(shell);
}

function syncBossMapActions(detail = {}, bossTracker = null, mapActions = null) {
  if (!mapActions) {
    return;
  }

  const locationUrl = String(bossTracker?.mapUrl || detail.map?.url || mapActions.dataset.locationMapUrl || "").trim();
  if (locationUrl) {
    mapActions.dataset.locationMapUrl = locationUrl;
    mapActions.dataset.locationMapTitle = mapActions.dataset.locationMapTitle || `${detail.name || "Boss"} - ${detail.location || "Mapa"}`;
    if (!mapActions.querySelector('[data-boss-map-panel="location"]')) {
      mapActions.insertAdjacentHTML(
        "afterbegin",
        `<button type="button" class="entity-link-chip boss-map-toggle" data-boss-map-panel="location">${escapeHtml(t("common.showOnMap"))}</button>`
      );
    }
  }

  const hasRoute = hasBossRouteMap(bossTracker?.routeMap);
  const routeSlot = mapActions.querySelector("[data-boss-route-action-slot]");
  if (routeSlot) {
    routeSlot.innerHTML = hasRoute
      ? `<button type="button" class="entity-link-chip boss-map-toggle" data-boss-map-panel="route">Como chegar</button>`
      : "";
  }

  mapActions.classList.toggle("hidden", !locationUrl && !hasRoute);

  bindEntityDetailActions(mapActions);
}

function hasBossRouteMap(routeMap) {
  return Boolean(
    routeMap &&
      Array.isArray(routeMap.maps) &&
      routeMap.maps.some((map) =>
        Array.isArray(map?.paths) &&
          map.paths.some((pathEntry) => Array.isArray(pathEntry?.routes) && pathEntry.routes.length > 0)
      )
  );
}

function renderBossInlineMap(button) {
  const mode = button.dataset.bossMapPanel || "";
  const actions = button.closest("[data-boss-map-actions]");
  const mapBlock = actions?.parentElement;
  // Each action owns its immediate map panel. This prevents coordinate maps
  // embedded in Notes from ever hijacking the creature/boss location map.
  const panel = mapBlock?.querySelector(":scope > [data-boss-inline-map-panel]");

  if (!actions || !panel) {
    return;
  }

  const isSameOpen = !panel.classList.contains("hidden") && panel.dataset.bossMapMode === mode;
  mapBlock?.parentElement?.querySelectorAll("[data-boss-map-panel]").forEach((entry) => {
    entry.classList.remove("active");
  });
  stopTibiaInlineMaps(panel);

  if (isSameOpen) {
    panel.classList.add("hidden");
    panel.dataset.bossMapMode = "";
    panel.innerHTML = "";
    return;
  }

  if (mode === "location") {
    const url = actions.dataset.locationMapUrl || "";
    if (!url) {
      return;
    }

    button.classList.add("active");
    panel.dataset.bossMapMode = mode;
    panel.innerHTML = renderBossLocationMapPreview(url, actions.dataset.locationMapTitle || "Mapa");
    panel.classList.remove("hidden");
    panel.querySelectorAll("[data-tibia-inline-map]").forEach(initializeTibiaInlineMap);
    return;
  }

  if (mode === "route" && hasBossRouteMap(state.currentBossTracker?.routeMap)) {
    button.classList.add("active");
    panel.dataset.bossMapMode = mode;
    panel.innerHTML = renderBossRoutePreview(state.currentBossTracker.routeMap);
    panel.classList.remove("hidden");
    bindEntityDetailActions(panel);
    panel.querySelectorAll("[data-tibia-inline-map]").forEach(initializeTibiaInlineMap);
  }
}

function renderBossRoutePreview(routeMap) {
  const maps = Array.isArray(routeMap?.maps) ? routeMap.maps.filter((map) => Array.isArray(map?.paths) && map.paths.length) : [];
  const map = maps[0];
  const floors = getBossRouteFloors(map);
  const activeFloor = floors[0] ?? null;

  if (!map || activeFloor === null) {
    return "";
  }

  const mapId = registerInlineTibiaMapPayload({
    type: "route",
    title: "Como chegar",
    routeMap: map,
    floor: activeFloor
  });

  return `
    <div class="boss-route-preview-card">
      <div class="boss-route-preview-head">
        <strong>Como chegar</strong>
      </div>
      <div class="boss-route-preview-map tibia-inline-map" data-tibia-inline-map="${escapeHtml(mapId)}"></div>
      ${maps.length > 1 ? `<small class="boss-route-preview-note">Mostrando a primeira rota com caminho disponivel.</small>` : ""}
    </div>
  `;
}

function renderBossLocationMapPreview(url, title = "Mapa") {
  const position = parseTibiaMapPosition(url);

  if (!position) {
    return `
      <div class="boss-inline-map-frame-wrap">
        <iframe class="boss-inline-map-frame" src="${escapeHtml(getEmbeddedTibiaMapUrl(url))}" title="${escapeHtml(title)}"></iframe>
      </div>
    `;
  }

  const mapId = registerInlineTibiaMapPayload({
    type: "location",
    title,
    position
  });

  return `
    <div class="boss-route-preview-card boss-location-map-card">
      <div class="boss-route-preview-head">
        <strong>${escapeHtml(title)}</strong>
      </div>
      <div class="boss-route-preview-map tibia-inline-map boss-location-preview-map" data-tibia-inline-map="${escapeHtml(mapId)}"></div>
    </div>
  `;
}

function registerInlineTibiaMapPayload(payload = {}) {
  const id = `inline-tibia-map-${++inlineTibiaMapSequence}`;
  inlineTibiaMapPayloads.set(id, payload);
  return id;
}

function initializeTibiaInlineMap(container) {
  if (!container || container.dataset.tibiaInlineMapReady === "true") {
    return;
  }

  const payload = inlineTibiaMapPayloads.get(container.dataset.tibiaInlineMap);
  const L = window.L;

  if (!payload || !L) {
    container.innerHTML = `<p class="boss-route-preview-note">Nao foi possivel carregar o mapa.</p>`;
    return;
  }

  container.dataset.tibiaInlineMapReady = "true";

  const initialFloor = clampTibiaMapFloor(
    payload.type === "location" ? payload.position?.floor : payload.floor
  );
  const floorLayers = new Map();
  const overlayLayer = L.layerGroup();
  const map = L.map(container, {
    attributionControl: false,
    crs: L.CRS.Simple,
    fadeAnimation: false,
    keyboardPanOffset: 400,
    maxBounds: getTibiaLeafletMaxBounds(container, L),
    maxZoom: 4,
    minZoom: -2,
    scrollWheelZoom: true,
    unloadInvisibleTiles: false,
    updateWhenIdle: true,
    zoomAnimationThreshold: 4
  });
  const mapState = {
    L,
    container,
    floor: initialFloor,
    floorLayers,
    map,
    overlayLayer,
    payload
  };

  container._tibiaInlineMapState = mapState;
  getTibiaLeafletFloorLayer(mapState, initialFloor).addTo(map);
  overlayLayer.addTo(map);
  map.setView(getTibiaInlineInitialLatLng(mapState), getTibiaInlineInitialZoom(payload));
  addTibiaInlineFloorControl(mapState);
  addTibiaInlineResetControl(mapState);
  if (payload.type === "route") {
    addTibiaInlineRoutePlayControl(mapState);
  }
  redrawTibiaInlineOverlay(mapState, { fit: payload.type === "route" });

  window.requestAnimationFrame(() => {
    map.invalidateSize();
    centerTibiaInlineMap(mapState, { fit: payload.type === "route" });
  });
}

function getTibiaLeafletMaxBounds(container, L) {
  const paddingX = Math.max(256, (container?.clientWidth || 800) / 2);
  const paddingY = Math.max(256, (container?.clientHeight || 420) / 2);
  return L.latLngBounds(
    L.latLng(-paddingY, -paddingX),
    L.latLng(TIBIA_MAP_PIXEL_BOUNDS.height + paddingY, TIBIA_MAP_PIXEL_BOUNDS.width + paddingX)
  );
}

function getTibiaLeafletFloorLayer(mapState, floor) {
  const normalizedFloor = clampTibiaMapFloor(floor);
  const cached = mapState.floorLayers.get(normalizedFloor);
  if (cached) {
    return cached;
  }

  const { L } = mapState;
  const floorLabel = String(normalizedFloor).padStart(2, "0");
  const layer = L.imageOverlay(
    `${TIBIA_MAP_DATA_BASE_URL}floor-${floorLabel}-map.png?v=2026-08-08-r1`,
    [
      [0, 0],
      [TIBIA_MAP_PIXEL_BOUNDS.height, TIBIA_MAP_PIXEL_BOUNDS.width]
    ],
    {
      className: "tibia-inline-map-image",
      interactive: false
    }
  );

  mapState.floorLayers.set(normalizedFloor, layer);
  return layer;
}

function getTibiaInlineInitialLatLng(mapState) {
  const { payload } = mapState;
  if (payload.type === "location" && payload.position) {
    return tibiaCoordinateToInlineLatLng(payload.position.x, payload.position.y);
  }

  const points = getTibiaInlinePointsForFloor(payload, mapState.floor);
  const center = getBossRoutePointCenter(points);
  return tibiaCoordinateToInlineLatLng(center.x, center.y);
}

function getTibiaInlineInitialZoom(payload) {
  const zoom = payload.type === "location" ? Number(payload.position?.zoom) : 1;
  return Math.max(-2, Math.min(4, Number.isFinite(zoom) ? zoom : 1));
}

function addTibiaInlineFloorControl(mapState) {
  const { L, map } = mapState;
  const FloorControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const container = L.DomUtil.create("div", "leaflet-control-level-buttons-panel leaflet-bar boss-leaflet-floor-control");
      const up = L.DomUtil.create("a", "leaflet-control-level-buttons-a", container);
      up.href = "#";
      up.textContent = "▲";
      const value = L.DomUtil.create("span", "leaflet-control-level-buttons-span", container);
      const down = L.DomUtil.create("a", "leaflet-control-level-buttons-a", container);
      down.href = "#";
      down.textContent = "▼";

      container._floorValue = value;
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(up, "click", (event) => {
        L.DomEvent.preventDefault(event);
        setTibiaInlineFloor(mapState, mapState.floor - 1);
      });
      L.DomEvent.on(down, "click", (event) => {
        L.DomEvent.preventDefault(event);
        setTibiaInlineFloor(mapState, mapState.floor + 1);
      });
      return container;
    }
  });

  mapState.floorControl = new FloorControl().addTo(map);
  updateTibiaInlineFloorControl(mapState);
}

function addTibiaInlineResetControl(mapState) {
  const { L, map } = mapState;
  const ResetControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const reset = L.DomUtil.create("a", "boss-leaflet-control-link", container);
      reset.href = "#";
      reset.textContent = "R";
      reset.title = "Centralizar mapa";
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(reset, "click", (event) => {
        L.DomEvent.preventDefault(event);
        pauseTibiaInlineRoutePlayback(mapState);
        centerTibiaInlineMap(mapState, { start: mapState.payload.type === "route" });
      });
      return container;
    }
  });

  new ResetControl().addTo(map);
}

function addTibiaInlineRoutePlayControl(mapState) {
  const { L, map } = mapState;
  const PlayControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const play = L.DomUtil.create("a", "boss-leaflet-control-link", container);
      play.href = "#";
      play.textContent = "P";
      play.title = "Pausar/retomar rota";
      mapState.playControlButton = play;
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(play, "click", (event) => {
        L.DomEvent.preventDefault(event);
        toggleTibiaInlineRoutePlayback(mapState);
      });
      return container;
    }
  });

  mapState.playControl = new PlayControl().addTo(map);
}

function setTibiaInlineFloor(mapState, floor, options = {}) {
  const nextFloor = clampTibiaMapFloor(floor);
  if (nextFloor === mapState.floor) {
    return;
  }

  const previousLayer = mapState.floorLayers.get(mapState.floor);
  if (previousLayer) {
    mapState.map.removeLayer(previousLayer);
  }
  mapState.map.removeLayer(mapState.overlayLayer);
  mapState.floor = nextFloor;
  getTibiaLeafletFloorLayer(mapState, nextFloor).addTo(mapState.map);
  mapState.overlayLayer.addTo(mapState.map);
  updateTibiaInlineFloorControl(mapState);
  redrawTibiaInlineOverlay(mapState, { fit: Boolean(options.fit) });
}

function updateTibiaInlineFloorControl(mapState) {
  const container = mapState.floorControl?.getContainer?.();
  const value = container?._floorValue;
  if (value) {
    value.textContent = formatTibiaInlineFloorLabel(mapState.floor);
  }
}

function formatTibiaInlineFloorLabel(floor) {
  const value = Number(floor);
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (value === TIBIA_MAP_GROUND_FLOOR) {
    return "0";
  }
  if (value < TIBIA_MAP_GROUND_FLOOR) {
    return `+${TIBIA_MAP_GROUND_FLOOR - value}`;
  }
  return `-${value - TIBIA_MAP_GROUND_FLOOR}`;
}

function redrawTibiaInlineOverlay(mapState, options = {}) {
  const { L, map, overlayLayer, payload } = mapState;
  overlayLayer.clearLayers();

  if (payload.type === "location") {
    const position = payload.position;
    if (Number(position?.floor) === mapState.floor) {
      L.marker(tibiaCoordinateToInlineLatLng(position.x, position.y), {
        icon: createTibiaInlineMarkerIcon(L, "★", "boss-leaflet-location-marker")
      }).addTo(overlayLayer);
    }
    return;
  }

  const paths = Array.isArray(payload.routeMap?.paths)
    ? payload.routeMap.paths.filter((entry) => Number(entry?.floor) === mapState.floor && Array.isArray(entry?.routes) && entry.routes.length > 1)
    : [];
  const markers = Array.isArray(payload.routeMap?.markers)
    ? payload.routeMap.markers.filter((marker) => Number(marker?.floor) === mapState.floor)
    : [];

  paths.forEach((pathEntry) => {
    const latLngs = pathEntry.routes
      .filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)))
      .map((point) => tibiaCoordinateToInlineLatLng(Number(point.x), Number(point.y)));
    if (latLngs.length < 2) {
      return;
    }

    L.polyline(latLngs, {
      className: "boss-leaflet-route-shadow",
      color: "rgba(0, 0, 0, 0.72)",
      interactive: false,
      lineCap: "round",
      lineJoin: "round",
      weight: 8
    }).addTo(overlayLayer);
    L.polyline(latLngs, {
      className: "boss-leaflet-route-line",
      color: "#e79603",
      dashArray: "10 10",
      interactive: false,
      lineCap: "round",
      lineJoin: "round",
      weight: 4
    }).addTo(overlayLayer);
  });

  markers.forEach((marker) => {
    if (!Number.isFinite(Number(marker?.x)) || !Number.isFinite(Number(marker?.y))) {
      return;
    }

    L.marker(tibiaCoordinateToInlineLatLng(Number(marker.x), Number(marker.y)), {
      icon: createTibiaInlineMarkerIcon(L, getBossRouteMarkerLabel(marker.icon), "boss-leaflet-route-marker")
    }).addTo(overlayLayer);
  });

  if (options.fit) {
    centerTibiaInlineMap(mapState, { fit: true });
  }
}

function centerTibiaInlineMap(mapState, options = {}) {
  const { map, payload } = mapState;
  if (payload.type === "location" && payload.position) {
    map.setView(tibiaCoordinateToInlineLatLng(payload.position.x, payload.position.y), getTibiaInlineInitialZoom(payload));
    return;
  }

  const startPoint = options.start ? getTibiaInlineRouteStartPoint(payload) : null;
  if (startPoint) {
    if (Number(startPoint.floor) !== mapState.floor) {
      setTibiaInlineFloor(mapState, startPoint.floor, { fit: false });
    }
    map.setView(tibiaCoordinateToInlineLatLng(startPoint.x, startPoint.y), Math.max(map.getZoom(), 2), { animate: false });
    return;
  }

  const points = getTibiaInlinePointsForFloor(payload, mapState.floor);
  if (!points.length) {
    return;
  }

  const latLngs = points.map((point) => tibiaCoordinateToInlineLatLng(Number(point.x), Number(point.y)));
  if (options.fit && latLngs.length > 1) {
    map.fitBounds(latLngs, {
      animate: false,
      maxZoom: 4,
      padding: [36, 36]
    });
    return;
  }

  const center = getBossRoutePointCenter(points);
  map.panTo(tibiaCoordinateToInlineLatLng(center.x, center.y), { animate: false });
}

function toggleTibiaInlineRoutePlayback(mapState) {
  const playback = mapState.routePlayback;

  if (playback?.running) {
    pauseTibiaInlineRoutePlayback(mapState);
    return;
  }

  startTibiaInlineRoutePlayback(mapState);
}

function startTibiaInlineRoutePlayback(mapState) {
  const steps = getTibiaInlineRouteSteps(mapState.payload);
  if (!steps.length) {
    return;
  }

  const currentPlayback = mapState.routePlayback || {};
  const shouldRestart = !currentPlayback.steps || currentPlayback.index >= steps.length;
  mapState.routePlayback = {
    index: shouldRestart ? 0 : currentPlayback.index,
    running: true,
    steps,
    timeoutId: null
  };
  mapState.container.classList.remove("route-paused");
  mapState.playControlButton?.classList.add("active");
  mapState.playControlButton?.setAttribute("title", "Pausar rota");
  advanceTibiaInlineRoutePlayback(mapState, true);
}

function pauseTibiaInlineRoutePlayback(mapState) {
  const playback = mapState?.routePlayback;
  if (!playback) {
    return;
  }

  if (playback.timeoutId) {
    clearTimeout(playback.timeoutId);
    playback.timeoutId = null;
  }
  playback.running = false;
  mapState.container.classList.add("route-paused");
  mapState.playControlButton?.classList.remove("active");
  mapState.playControlButton?.setAttribute("title", "Retomar rota");
}

function stopTibiaInlineRoutePlayback(mapState) {
  if (!mapState?.routePlayback) {
    return;
  }

  pauseTibiaInlineRoutePlayback(mapState);
  mapState.routePlayback.index = 0;
}

function advanceTibiaInlineRoutePlayback(mapState, immediate = false) {
  const playback = mapState.routePlayback;
  if (!playback?.running) {
    return;
  }

  const step = playback.steps[playback.index];
  if (!step) {
    playback.running = false;
    playback.index = playback.steps.length;
    mapState.playControlButton?.classList.remove("active");
    mapState.playControlButton?.setAttribute("title", "Reiniciar rota");
    return;
  }

  if (Number(step.floor) !== mapState.floor) {
    setTibiaInlineFloor(mapState, step.floor, { fit: false });
  }

  const latLng = tibiaCoordinateToInlineLatLng(step.x, step.y);
  const zoom = Math.max(mapState.map.getZoom(), 2);
  if (immediate) {
    mapState.map.setView(latLng, zoom, { animate: false });
  } else {
    mapState.map.flyTo(latLng, zoom, {
      animate: true,
      duration: 0.42,
      easeLinearity: 0.3
    });
  }

  playback.index += 1;
  playback.timeoutId = window.setTimeout(() => {
    playback.timeoutId = null;
    advanceTibiaInlineRoutePlayback(mapState);
  }, immediate ? 360 : 620);
}

function stopTibiaInlineMaps(root) {
  root?.querySelectorAll("[data-tibia-inline-map]").forEach((container) => {
    stopTibiaInlineRoutePlayback(container._tibiaInlineMapState);
  });
}

function tibiaCoordinateToInlineLatLng(x, y) {
  const localX = Number(x) - TIBIA_MAP_PIXEL_BOUNDS.minX;
  const localY = Number(y) - TIBIA_MAP_PIXEL_BOUNDS.minY;
  return window.L.latLng(TIBIA_MAP_PIXEL_BOUNDS.height - localY, localX);
}

function getTibiaInlinePointsForFloor(payload, floor) {
  if (payload?.type !== "route") {
    return [];
  }

  const paths = Array.isArray(payload.routeMap?.paths) ? payload.routeMap.paths : [];
  const markers = Array.isArray(payload.routeMap?.markers) ? payload.routeMap.markers : [];
  return [
    ...paths
      .filter((entry) => Number(entry?.floor) === Number(floor))
      .flatMap((entry) => Array.isArray(entry?.routes) ? entry.routes : []),
    ...markers.filter((marker) => Number(marker?.floor) === Number(floor))
  ].filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)));
}

function getTibiaInlineRouteSteps(payload) {
  if (payload?.type !== "route" || !Array.isArray(payload.routeMap?.paths)) {
    return [];
  }

  const steps = [];
  payload.routeMap.paths.forEach((pathEntry) => {
    const floor = clampTibiaMapFloor(pathEntry?.floor);
    const routes = Array.isArray(pathEntry?.routes) ? pathEntry.routes : [];
    routes.forEach((point) => {
      if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y))) {
        return;
      }

      const step = {
        floor,
        x: Number(point.x),
        y: Number(point.y)
      };
      const previous = steps[steps.length - 1];
      if (previous && previous.floor === step.floor && previous.x === step.x && previous.y === step.y) {
        return;
      }
      steps.push(step);
    });
  });
  return steps;
}

function getTibiaInlineRouteStartPoint(payload) {
  return getTibiaInlineRouteSteps(payload)[0] || null;
}

function createTibiaInlineMarkerIcon(L, label, className) {
  return L.divIcon({
    className,
    html: `<span>${escapeHtml(label)}</span>`,
    iconAnchor: [11, 11],
    iconSize: [22, 22]
  });
}

function clampTibiaMapFloor(floor) {
  const value = Number(floor);
  if (!Number.isFinite(value)) {
    return TIBIA_MAP_GROUND_FLOOR;
  }
  return Math.max(TIBIA_MAP_MIN_FLOOR, Math.min(TIBIA_MAP_MAX_FLOOR, Math.round(value)));
}

function parseTibiaMapPosition(url) {
  const hash = String(url || "").split("#")[1] || "";
  const match = hash.match(/(-?\d+),(-?\d+),(-?\d+)(?::(\d+))?/);

  if (!match) {
    return null;
  }

  return {
    x: Number(match[1]),
    y: Number(match[2]),
    floor: Number(match[3]),
    zoom: Number(match[4] || 2)
  };
}

function getBossRouteFloors(routeMap = {}) {
  const floors = new Set();
  const paths = Array.isArray(routeMap?.paths) ? routeMap.paths : [];
  const markers = Array.isArray(routeMap?.markers) ? routeMap.markers : [];

  paths.forEach((pathEntry) => {
    const floor = Number(pathEntry?.floor);
    if (Number.isFinite(floor)) {
      floors.add(floor);
    }
  });
  markers.forEach((marker) => {
    const floor = Number(marker?.floor);
    if (Number.isFinite(floor)) {
      floors.add(floor);
    }
  });

  return [...floors];
}

function getBossRoutePointCenter(points) {
  const validPoints = points.filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)));

  if (!validPoints.length) {
    return { x: 0, y: 0 };
  }

  const xs = validPoints.map((point) => Number(point.x));
  const ys = validPoints.map((point) => Number(point.y));

  return {
    x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
    y: Math.round((Math.min(...ys) + Math.max(...ys)) / 2)
  };
}

function formatBossRouteFloorLabel(floor) {
  const value = Number(floor);

  if (!Number.isFinite(value)) {
    return "Andar";
  }

  if (value === 7) {
    return "Térreo";
  }

  if (value < 7) {
    return `+${7 - value}`;
  }

  return `-${value - 7}`;
}

function getBossRouteMarkerLabel(icon) {
  const normalized = normalizeSearchText(icon);
  if (normalized === "star") {
    return "★";
  }
  if (normalized === "up") {
    return "↑";
  }
  if (normalized === "down") {
    return "↓";
  }
  if (normalized === "cross") {
    return "×";
  }
  return "•";
}

function rerenderCurrentBossTrackerSections(options = {}) {
  const shell = els.entityDetailContent?.querySelector("[data-boss-tracker-shell]");

  if (!shell || !state.currentBossTracker) {
    return;
  }

  const chartScrollSnapshots = options.preserveChartScroll
    ? getBossChartScrollSnapshots(shell)
    : [];
  shell.innerHTML = normalizeUiText(renderBossTrackerSections(state.currentBossTracker));
  bindEntityDetailActions(shell);
  bindSkillDynamicTooltips(shell);
  if (options.preserveChartScroll) {
    restoreBossChartScrolls(shell, chartScrollSnapshots);
  } else {
    centerBossChartScrolls(shell);
  }
}

function centerBossChartScrolls(root = els.entityDetailContent) {
  window.requestAnimationFrame(() => {
    root?.querySelectorAll("[data-boss-chart-scroll]").forEach((scroll) => {
      const currentIndex = Number(scroll.dataset.currentIndex);
      const columnWidth = Number(scroll.dataset.columnWidth) || getBossChartColumnWidth();
      const columnGap = Number(scroll.dataset.columnGap) || 0;

      if (!Number.isFinite(currentIndex) || currentIndex < 0) {
        return;
      }

      const markerCenter = currentIndex * (columnWidth + columnGap) + columnWidth / 2;
      scroll.scrollLeft = Math.max(0, markerCenter - scroll.clientWidth / 2);
    });
  });
}

function getBossChartScrollSnapshots(root = els.entityDetailContent) {
  return Array.from(root?.querySelectorAll("[data-boss-chart-scroll]") || []).map((scroll) => {
    const maxScroll = Math.max(1, scroll.scrollWidth - scroll.clientWidth);
    return {
      ratio: scroll.scrollLeft / maxScroll,
      left: scroll.scrollLeft
    };
  });
}

function restoreBossChartScrolls(root = els.entityDetailContent, snapshots = []) {
  window.requestAnimationFrame(() => {
    root?.querySelectorAll("[data-boss-chart-scroll]").forEach((scroll, index) => {
      const snapshot = snapshots[index] || null;

      if (!snapshot) {
        return;
      }

      const maxScroll = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
      const restoredLeft = Number.isFinite(snapshot.ratio)
        ? snapshot.ratio * maxScroll
        : snapshot.left;
      scroll.scrollLeft = Math.max(0, Math.min(maxScroll, restoredLeft));
    });
  });
}

async function loadCreatureGearRecommendation(detail, requestId) {
  const shell = els.entityDetailContent?.querySelector("[data-creature-gear-shell]");
  if (!shell || !detail?.name) {
    return;
  }

  try {
    const entry = await fetchCreatureGearRecommendationEntry(detail);

    if (requestId !== state.monsterDetailRequestId) {
      return;
    }

    if (!entry) {
      state.creatureGearEntry = null;
      shell.innerHTML = `<div class="empty-inline">Nenhuma recomendacao de equipamento encontrada para esta criatura.</div>`;
      return;
    }

    state.creatureGearEntry = entry;
    renderCreatureGearRecommendationShell(shell, entry);
  } catch (_error) {
    if (requestId !== state.monsterDetailRequestId) {
      return;
    }

    state.creatureGearEntry = null;
    shell.remove();
  }
}

async function fetchCreatureGearRecommendationEntry(detail) {
  const candidates = getCreatureGearCandidateSlugs(detail);

  for (const slug of candidates) {
    if (state.creatureGearRecommendations[slug]) {
      return state.creatureGearRecommendations[slug];
    }

    if (state.creatureGearRecommendationMissingSlugs.has(slug)) {
      continue;
    }

    if (!state.creatureGearRecommendationPromises[slug]) {
      const recommendationPath = `${CREATURE_GEAR_RECOMMENDATIONS_DIR}/${slug}.json`;
      state.creatureGearRecommendationPromises[slug] = (window.desktopApi?.assets?.readJson
        ? window.desktopApi.assets.readJson(recommendationPath)
        : fetch(recommendationPath).then((response) => response.ok ? response.json() : null)
      )
        .then((entry) => {
          if (entry) {
            state.creatureGearRecommendations[slug] = entry;
          } else {
            state.creatureGearRecommendationMissingSlugs.add(slug);
          }
          return entry;
        })
        .catch((error) => {
          if (isMissingCreatureGearRecommendation(error)) {
            state.creatureGearRecommendationMissingSlugs.add(slug);
            return null;
          }
          throw error;
        })
        .finally(() => {
          delete state.creatureGearRecommendationPromises[slug];
        });
    }

    const entry = await state.creatureGearRecommendationPromises[slug];
    if (entry) {
      return entry;
    }
  }

  return null;
}

function isMissingCreatureGearRecommendation(error) {
  return /ENOENT|not found|404/i.test(
    error instanceof Error ? error.message : String(error || "")
  );
}

function getCreatureGearCandidateSlugs(detail) {
  return [
    detail?.slug,
    slugifyItemInput(detail?.name || ""),
    normalizeSearchText(detail?.name || "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  ].filter((slug, index, slugs) => slug && slugs.indexOf(slug) === index);
}

function renderCreatureGearRecommendationShell(shell, entry) {
  shell.innerHTML = normalizeUiText(renderCreatureGearRecommendation(entry, state.creatureGearVocation));
  updateCreatureGearStyleToolbar(entry);
  bindEntityDetailActions(shell);
  bindSkillDynamicTooltips(shell);
}

function updateCreatureGearStyleToolbar(entry) {
  void entry;
}

function renderCreatureGearRecommendation(entry, selectedVocation = "knight") {
  const availableVocation = entry?.vocations?.[selectedVocation]
    ? selectedVocation
    : CREATURE_GEAR_VOCATIONS.find((vocation) => entry?.vocations?.[vocation.key])?.key || "knight";
  const recommendation = getCreatureGearVocationRecommendation(entry, availableVocation, state.creatureGearWeaponStyle);
  const charm = entry?.charm || {};

  return `
    <div class="creature-gear-title-row">
      <h4>Recomendacoes</h4>
    </div>
    <div class="creature-gear-top">
      <div class="creature-gear-controls">
        <div class="creature-gear-vocations skill-vocation-grid" aria-label="Vocacao">
          ${CREATURE_GEAR_VOCATIONS.map((vocation) => {
            const disabled = !entry?.vocations?.[vocation.key];
            return `
              <button
                type="button"
                class="skill-vocation-button creature-gear-vocation-button${availableVocation === vocation.key ? " active" : ""}"
                data-creature-gear-vocation="${escapeHtml(vocation.key)}"
                data-tooltip="${escapeHtml(vocation.label)}"
                ${disabled ? "disabled" : ""}
              >
                <img src="${escapeHtml(vocation.icon)}" alt="">
                <span>${escapeHtml(vocation.label)}</span>
              </button>
            `;
          }).join("")}
        </div>
      </div>
      ${renderCreatureGearStyleToggle(recommendation)}
    </div>
    <div class="creature-gear-divider" aria-hidden="true"></div>
    <div class="creature-gear-body">
      <div class="creature-gear-charm-wrap">
        ${renderCreatureGearCharm(charm)}
      </div>
      <div class="creature-gear-grid" aria-label="Set recomendado">
        ${CREATURE_GEAR_SLOT_ORDER.map((slotKey) => renderCreatureGearSlot(recommendation.slots?.[slotKey], slotKey)).join("")}
      </div>
      ${renderCreatureGearDamagePanel(recommendation.damageBonuses || [])}
    </div>
  `;
}

function renderCreatureGearStyleToggle(recommendation = {}) {
  return `
    <div class="creature-gear-style-toggle" aria-label="Tipo de arma">
      ${CREATURE_GEAR_WEAPON_STYLES.map((style) => `
        <button type="button" class="creature-gear-style-button${recommendation.weaponStyle === style ? " active" : ""}" data-creature-gear-weapon-style="${escapeHtml(style)}" data-tooltip="${escapeHtml(style === "1H" ? "Arma de uma mao" : "Arma de duas maos")}">
          <img src="${escapeHtml(CREATURE_GEAR_WEAPON_STYLE_ICONS[style])}" alt="${escapeHtml(style)}">
        </button>
      `).join("")}
    </div>
  `;
}

function getCreatureGearVocationRecommendation(entry, vocation, weaponStyle = "1H") {
  const vocationEntry = entry?.vocations?.[vocation] || {};
  return vocationEntry.weaponStyles?.[weaponStyle] || vocationEntry.weaponStyles?.["1H"] || vocationEntry;
}

function renderCreatureGearSlot(slot, slotKey) {
  const label = slot?.label || getCreatureGearSlotFallbackLabel(slotKey);
  const name = String(slot?.name || "").trim();
  const isImbuement = slotKey === "armorImbuement" || slotKey === "offhandImbuement";
  const isEmpty = !name;
  const emptyLabel = isImbuement ? "Sem imbuement" : "Sem equipamento";
  const tooltip = isEmpty ? emptyLabel : slot?.tooltip || `${label}: ${name}`;
  const ariaLabel = isEmpty ? emptyLabel : `${label}: ${name}`;
  const imbuementKey = !isEmpty && isImbuement ? getCreatureGearImbuementKey(name) : "";
  const actionAttrs = isEmpty
    ? ""
    : isImbuement
      ? imbuementKey
        ? ` data-creature-gear-imbuement-key="${escapeHtml(imbuementKey)}"`
        : ""
      : ` data-entity-item-slug="${escapeHtml(slugifyItemInput(name))}" data-entity-item-name="${escapeHtml(name)}" data-entity-item-image="${escapeHtml(slot?.image || "")}"`;

  return `
    <button type="button" class="creature-gear-slot${isEmpty ? " empty" : ""}" data-tooltip="${escapeHtml(tooltip)}" aria-label="${escapeHtml(ariaLabel)}"${actionAttrs}>
      ${!isEmpty && slot?.image ? `<img src="${escapeHtml(slot.image)}" alt="${escapeHtml(name)}" onerror="this.style.visibility='hidden';">` : `<img class="creature-gear-empty-icon" src="assets/ui/Cross.png" alt="">`}
      <em>${escapeHtml(label)}</em>
    </button>
  `;
}

function getCreatureGearImbuementKey(name) {
  const normalizedName = normalizeSearchText(name).replace(/^powerful\s+/, "").trim();
  return IMBUEMENTS.find((imbuement) => normalizeSearchText(imbuement.name) === normalizedName)?.key || "";
}

function getCreatureGearSlotFallbackLabel(slotKey) {
  const labels = {
    amulet: "Amuleto",
    helmet: "Capacete",
    rune: "Runa",
    weapon: "Arma",
    armor: "Armadura",
    offhand: "Escudo",
    ring: "Anel",
    legs: "Calca",
    accessory: "Acessorio",
    armorImbuement: "Imbuement",
    boots: "Bota",
    offhandImbuement: "Imbuement"
  };
  return labels[slotKey] || "Item";
}

function renderCreatureGearCharm(charm) {
  if (!charm?.name && !charm?.image) {
    return "";
  }

  return `
    <div class="creature-gear-charm" data-tooltip="${escapeHtml(`Charm recomendado: ${charm.name || "-"}`)}" tabindex="0">
      ${charm.image ? `<img src="${escapeHtml(charm.image)}" alt="${escapeHtml(charm.name || "Charm")}" onerror="this.style.visibility='hidden';">` : ""}
      <strong>${escapeHtml(charm.name || "-")}</strong>
    </div>
  `;
}

function renderCreatureGearDamagePanel(damageBonuses = []) {
  if (!Array.isArray(damageBonuses) || damageBonuses.length === 0) {
    return "";
  }

  return `
    <div class="creature-gear-damage-panel">
      ${damageBonuses.slice(0, 7).map((entry) => `
        <div class="creature-gear-damage-row" data-tooltip="${escapeHtml((entry.sources || []).join(", "))}">
          <span>${renderCreatureGearElementIcon(entry)}${escapeHtml(entry.label || entry.element || "Dano")}</span>
          <strong>+${escapeHtml(formatCreatureGearPercent(entry.value))}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCreatureIncomingDamagePanel(damageEntries = []) {
  if (!Array.isArray(damageEntries) || damageEntries.length === 0) {
    return "";
  }

  return `
    <div class="creature-gear-incoming">
      <h4>Danos da criatura</h4>
      <div class="creature-gear-incoming-grid">
        ${damageEntries.map((entry) => `
          <div class="creature-gear-incoming-row">
            <span>${renderCreatureGearElementIcon(entry)}${escapeHtml(entry.label || entry.element || "Dano")}</span>
            <strong>${escapeHtml(formatCreatureGearPercent(entry.percentage))}</strong>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCreatureGearElementIcon(entry) {
  const icon = ELEMENT_ICONS[entry?.label] || ELEMENT_ICONS[entry?.element] || "";
  if (icon) {
    return `<img src="${escapeHtml(icon)}" alt="">`;
  }

  return "";
}

function formatCreatureGearPercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  return `${numericValue.toFixed(numericValue % 1 === 0 ? 0 : 1)}%`;
}

function renderCreatureAbilities(abilities = []) {
  const entries = Array.isArray(abilities)
    ? abilities.filter(Boolean)
    : String(abilities || "").split("|").map((entry) => entry.trim()).filter(Boolean);

  if (entries.length === 0) {
    return "";
  }

  const groups = entries.reduce((accumulator, entry) => {
    const normalizedEntry = typeof entry === "string"
      ? { element: inferCreatureAbilityElement(entry), name: entry, value: "" }
      : entry;
    const element = normalizedEntry.element || "Fisico";

    if (!accumulator[element]) {
      accumulator[element] = [];
    }

    accumulator[element].push(normalizedEntry);
    return accumulator;
  }, {});

  return `
    <section>
      <h4>${escapeHtml(t("creature.abilities"))}</h4>
      <div class="creature-ability-list">
        ${Object.entries(groups).map(([element, abilitiesByElement]) => {
          const icon = getCreatureAbilityGroupIcon(element);
          return `
            <div class="creature-ability-row">
              <strong>${icon ? `<img src="${escapeHtml(icon)}" alt="">` : ""}${escapeHtml(ELEMENT_DISPLAY_NAMES[element] || element)}:</strong>
              <span>
                ${abilitiesByElement.map((ability) => renderCreatureAbilityText(ability)).join("")}
              </span>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function getCreatureAbilityGroupIcon(element) {
  const normalized = normalizeSearchText(element);
  return ELEMENT_ICONS[element] || CREATURE_ABILITY_GROUP_ICONS[normalized] || "";
}

function renderCreatureAbilityText(ability) {
  const name = ability?.name || "";
  const value = ability?.value || "";

  return `
    <span class="creature-ability-hit">
      ${escapeHtml(name)}${value ? ` <em>(${escapeHtml(value)})</em>` : ""}
    </span>
  `;
}

function inferCreatureAbilityElement(entry) {
  const text = String(entry || "").toLowerCase();

  if (text.includes("heal") || text.includes("cura")) return "Cura";
  if (text.includes("poison") || text.includes("earth")) return "Terra";
  if (text.includes("fire")) return "Fogo";
  if (text.includes("death")) return "Morte";
  if (text.includes("energy")) return "Energia";
  if (text.includes("holy")) return "Sagrado";
  if (text.includes("ice")) return "Gelo";
  return "Fisico";
}

function renderSoundList(sounds = [], kind = "monster") {
  const lines = normalizeSoundLines(sounds);

  if (lines.length === 0) {
    return "";
  }

  return `
    <section>
      <h4>${escapeHtml(t("creature.sounds"))}</h4>
      <div class="sound-list ${kind === "npc" ? "npc-sounds" : "monster-sounds"}">
        ${lines.map((sound) => `<q>${escapeHtml(sound)}</q>`).join("")}
      </div>
    </section>
  `;
}

function normalizeSoundLines(sounds = []) {
  return sounds
    .flatMap((sound) => String(sound || "").split("|"))
    .map((sound) => sound.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function renderDamageTable(modifiers = []) {
  if (!Array.isArray(modifiers) || modifiers.length === 0) {
    return "";
  }

  return `
    <div class="creature-elements-panel">
      <h4>${escapeHtml(t("creature.elements"))}</h4>
      <div class="damage-grid creature-element-grid">
        ${modifiers.map((modifier) => {
          const numericValue = parseCreaturePercent(modifier.value);
          const tone = numericValue > 100 ? "weak" : numericValue < 100 ? "resist" : "neutral";
          const icon = ELEMENT_ICONS[modifier.label] || "";
          const elementKey = normalizeCreatureElementKey(modifier.key || modifier.label);
          const tooltip = t("creature.filterWeakness", { element: ELEMENT_DISPLAY_NAMES[modifier.label] || modifier.label });
          return `
            <button type="button" class="creature-element-card ${tone}" data-creature-weakness-filter="${escapeHtml(elementKey)}" data-tooltip="${escapeHtml(tooltip)}">
              <span class="creature-element-icon">${icon ? `<img src="${escapeHtml(icon)}" alt="">` : escapeHtml(modifier.label)}</span>
              <strong>${escapeHtml(modifier.value)}</strong>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function parseCreaturePercent(value) {
  const numericValue = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numericValue) ? numericValue : 100;
}

function renderEntityTextSection(title, text) {
  const value = String(text || "").trim();

  if (!value || value.toLowerCase() === "unknown" || value.toLowerCase() === "unknown.") {
    return "";
  }

  return `<section><h4>${escapeHtml(title)}</h4><p>${renderLibraryFactualText(value)}</p></section>`;
}

function renderEntityTextSectionWithInlineMaps(title, text, entityName = "") {
  const value = String(text || "").trim();
  if (!value || value.toLowerCase() === "unknown" || value.toLowerCase() === "unknown.") return "";

  return `
    <section class="library-inline-note-section">
      <h4>${escapeHtml(title)}</h4>
      ${renderLibraryNarrative(value, entityName)}
    </section>
  `;
}


function renderLibraryNarrative(value, entityName = "") {
  const blocks = String(value || "").replace(/\r\n?/g, "\n").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block, blockIndex) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const list = lines.length > 0 && lines.every((line) => /^[-*â€¢]\s+/.test(line));
    if (list) {
      return `<ul class="library-narrative-list">${lines.map((line, lineIndex) => `<li>${renderLibraryNarrativeInline(line.replace(/^[-*â€¢]\s+/, ""), entityName, `${blockIndex}-${lineIndex}`)}</li>`).join("")}</ul>`;
    }
    return `<p>${lines.map((line, lineIndex) => `${lineIndex ? "<br>" : ""}${renderLibraryNarrativeInline(line, entityName, `${blockIndex}-${lineIndex}`)}`).join("")}</p>`;
  }).join("");
}

function renderLibraryNarrativeInline(value, entityName, key) {
  const coordinatePattern = /\(\s*(\d{4,5})\s*,\s*(\d{4,5})\s*,\s*(\d{1,2})(?:\s*:\s*(\d+))?\s+(?:aqui|here)\s*\)/gi;
  const escaped = escapeHtml(String(value || ""));
  let cursor = 0;
  let result = "";
  let match;
  while ((match = coordinatePattern.exec(escaped))) {
    result += renderLibraryNarrativeEmphasis(escaped.slice(cursor, match.index));
    const [x, y, floor, zoom] = match.slice(1);
    const mapKey = `${x},${y},${floor}:${zoom || 2}`;
    const mapTitle = `${entityName || "Localizacao"} - Mapa (${x}, ${y}, ${floor})`;
    result += `<span class="library-note-map-inline">aqui <span class="library-note-map-block"><span class="boss-map-action-row library-note-map-action" data-boss-map-actions data-location-map-url="https://tibiamaps.io/map#${escapeHtml(mapKey)}" data-location-map-title="${escapeHtml(mapTitle)}"><button type="button" class="entity-link-chip boss-map-toggle" data-boss-map-panel="location">Abrir mapa</button></span><span class="boss-inline-map hidden" data-boss-inline-map-panel></span></span></span>`;
    cursor = match.index + match[0].length;
  }
  result += renderLibraryNarrativeEmphasis(escaped.slice(cursor));
  return result || `-${key}`;
}

function renderLibraryNarrativeEmphasis(escaped) {
  return escaped
    .replace(/\[\[(item|npc|creature|boss):([a-z0-9-]+)\|([^\]]+)\]\]/g, (_match, kind, slug, label) => `<button type="button" class="inline-entity-link" data-entity-kind="${kind}" data-entity-slug="${slug}" data-entity-name="${label}"><strong>${label}</strong></button>`)
    .replace(/\[([^\]]+)\]\(https?:\/\/(?:[^\s()]|\([^\s()]*\))+\)/g, (_match, label) => label)
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<em>$1</em>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

function renderInlineMapActions(maps = [], entityName = "") {
  return maps.map((map, index) => `
    <div class="library-note-map-block">
      <div class="boss-map-action-row library-note-map-action" data-boss-map-actions data-location-map-url="${escapeHtml(map.url)}" data-location-map-title="${escapeHtml(`${entityName || "Localizacao"} - ${map.label}`)}">
        <button type="button" class="entity-link-chip boss-map-toggle" data-boss-map-panel="location">${escapeHtml(index === 0 ? t("common.showOnMap") : `Mapa ${index + 1}`)}</button>
      </div>
      <div class="boss-inline-map hidden" data-boss-inline-map-panel></div>
    </div>
  `).join("");
}

function findInlineMapReferences(text) {
  const maps = [];
  const seen = new Set();
  const coordinatePattern = /\(?\s*(\d{4,5})\s*,\s*(\d{4,5})\s*,\s*(\d{1,2})(?:\s*:\s*(\d+))?\s*\)?/g;
  let match;
  while ((match = coordinatePattern.exec(String(text || "")))) {
    const [x, y, floor, zoom] = match.slice(1);
    const key = `${x},${y},${floor}:${zoom || 2}`;
    if (seen.has(key)) continue;
    seen.add(key);
    maps.push({ url: `https://tibiamaps.io/map#${key}`, label: `Mapa (${x}, ${y}, ${floor})` });
  }
  return maps;
}

function renderLibraryDataTables(tables = []) {
  if (!Array.isArray(tables) || tables.length === 0) return "";
  return tables.map((table) => {
    const headings = Array.isArray(table?.headings) ? table.headings : [];
    const rows = Array.isArray(table?.rows) ? table.rows : [];
    if (headings.length === 0 || rows.length === 0) return "";
    return `
      <section class="item-extra-section item-damage-section library-data-table-section">
        <h4>${escapeHtml(table.title || "Dados")}</h4>
        <div class="item-damage-table-wrap">
          <table class="item-damage-table">
            <thead><tr>${headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join("")}</tr></thead>
            <tbody>${rows.map((row) => `<tr>${(Array.isArray(row) ? row : []).map((cell) => `<td>${renderLibraryFactualText(cell || "-")}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>
      </section>
    `;
  }).join("");
}

function renderLibraryFactualText(value) {
  const source = presentLibraryNarrativeValue(value);
  if (!source.trim()) return "-";

  return source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      const bullet = line.match(/^(\s*)[*•]\s+(.+)$/);
      const content = bullet ? `${bullet[1]}• ${bullet[2]}` : line;
      return renderLibraryInlineFactualMarkdown(content);
    })
    .join("<br>");
}

// Match the website presentation rule.  Legacy MediaWiki image and `link=`
// transport fragments are not facts to show in the desktop UI; the original
// canonical record remains available to the editor/audit instead of being
// rewritten here.
function presentLibraryNarrativeValue(value) {
  return String(value ?? "")
    // Strip only the imported file token.  A caption after `|` may contain
    // factual prose and must not disappear from the rendered record.
    .replace(/(?:^|\s)\*?\s*(?:Arquivo|File|Image|Imagem):[^\s|]+\|?/giu, "")
    .replace(/\blink=\s*/giu, "")
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/[ \t]+([,.;:!?])/gu, "$1")
    .replace(/""/gu, "")
    .trim();
}

function renderLibraryInlineFactualMarkdown(value) {
  return escapeHtml(String(value ?? ""))
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<em>$1</em>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

function renderCreatureLoot(loot = []) {
  if (!Array.isArray(loot) || loot.length === 0) {
    return "";
  }

  const groups = [
    ["common", t("library.loot.common")],
    ["uncommon", t("library.loot.uncommon")],
    ["semi-rare", t("library.loot.semiRare")],
    ["rare", t("library.loot.rare")],
    ["very-rare", t("library.loot.veryRare")],
    ["event", t("library.loot.event")],
    ["event-common", `${t("library.loot.event")} - ${t("library.loot.common")}`],
    ["event-uncommon", `${t("library.loot.event")} - ${t("library.loot.uncommon")}`],
    ["event-semi-rare", `${t("library.loot.event")} - ${t("library.loot.semiRare")}`],
    ["event-rare", `${t("library.loot.event")} - ${t("library.loot.rare")}`],
    ["event-very-rare", `${t("library.loot.event")} - ${t("library.loot.veryRare")}`],
    ["event-always", `${t("library.loot.event")} - ${t("library.loot.always")}`],
    ["always", t("library.loot.always")],
    ["unknown", t("library.loot")]
  ];

  // Preserve unclassified reciprocal relations in the local dataset for the
  // audit, but do not show them to users under a fictitious loot category.
  const visibleLoot = loot.filter((item) => normalizeRenderedCreatureLootRarity(item.rarity) !== "unknown");
  const byRarity = visibleLoot.reduce((accumulator, item) => {
    const rarity = normalizeRenderedCreatureLootRarity(item.rarity);
    if (!accumulator[rarity]) {
      accumulator[rarity] = [];
    }
    accumulator[rarity].push(item);
    return accumulator;
  }, {});

  return `
    <section class="creature-loot-section">
      <h4>${escapeHtml(t("library.loot"))}</h4>
      <div class="creature-loot-table">
        ${groups.map(([rarity, label]) => {
          const items = byRarity[rarity] || [];
          if (items.length === 0) {
            return "";
          }

          return `
            <div class="creature-loot-row">
              <strong>${escapeHtml(label)}:</strong>
              <div class="creature-loot-grid">${items.map(renderCreatureLootItem).join("")}</div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

// Loot rarity is a structural key, not display copy. Older cached payloads
// may have passed through translation and changed its capitalization.
function normalizeRenderedCreatureLootRarity(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  const aliases = {
    common: "common",
    comum: "common",
    uncommon: "uncommon",
    incomum: "uncommon",
    "semi-rare": "semi-rare",
    "semi-raro": "semi-rare",
    rare: "rare",
    raro: "rare",
    "very-rare": "very-rare",
    "muito-raro": "very-rare",
    event: "event",
    evento: "event",
    "event-common": "event-common",
    "event-comum": "event-common",
    "evento-comum": "event-common",
    "event-uncommon": "event-uncommon",
    "event-incomum": "event-uncommon",
    "evento-incomum": "event-uncommon",
    "event-semi-rare": "event-semi-rare",
    "event-semi-raro": "event-semi-rare",
    "evento-semi-raro": "event-semi-rare",
    "event-rare": "event-rare",
    "event-raro": "event-rare",
    "evento-raro": "event-rare",
    "event-very-rare": "event-very-rare",
    "event-muito-raro": "event-very-rare",
    "evento-muito-raro": "event-very-rare",
    "event-always": "event-always",
    "event-sempre": "event-always",
    always: "always",
    sempre: "always"
  };

  return aliases[normalized] || "unknown";
}

function renderCreatureLootItem(item = {}) {
  const tooltip = item.amount ? `${item.name} (${item.amount})` : item.name;

  return `
    <button
      type="button"
      class="creature-loot-item"
      data-entity-item-slug="${escapeHtml(item.slug)}"
      data-entity-item-name="${escapeHtml(item.name)}"
      data-entity-item-image="${escapeHtml(item.imageSrc || "")}"
      data-tooltip="${escapeHtml(tooltip)}"
    >
      ${item.imageSrc ? `<img src="${escapeHtml(item.imageSrc)}" alt="${escapeHtml(item.name)}"${item.imageFallbackSrc ? ` data-fallback-src="${escapeHtml(item.imageFallbackSrc)}"` : ""} onerror="if(this.dataset.fallbackSrc && this.src !== this.dataset.fallbackSrc){this.onerror=null;this.src=this.dataset.fallbackSrc;}else{this.style.visibility='hidden';}">` : `<span>${escapeHtml(item.name.slice(0, 2))}</span>`}
      ${item.amount ? `<em>${escapeHtml(item.amount)}</em>` : ""}
    </button>
  `;
}

function renderNpcTradeItems(tradeItems = {}) {
  const buy = Array.isArray(tradeItems.buy) ? tradeItems.buy : [];
  const sell = Array.isArray(tradeItems.sell) ? tradeItems.sell : [];

  if (buy.length === 0 && sell.length === 0) {
    return `<section><h4>Itens negociaveis</h4><p class="muted">Nenhum item negociavel encontrado na base local.</p></section>`;
  }

  return `
    <section>
      <h4>Itens negociaveis</h4>
      <div class="npc-trade-grid">
        <div>
          <strong>Compra</strong>
          ${renderNpcTradeColumn(buy, "Nenhum item comprado.")}
        </div>
        <div>
          <strong>Venda</strong>
          ${renderNpcTradeColumn(sell, "Nenhum item vendido.")}
        </div>
      </div>
    </section>
  `;
}

function renderNpcTradeColumn(items, emptyMessage) {
  if (!items.length) {
    return `<p class="muted">${emptyMessage}</p>`;
  }

  return `
    <div class="npc-trade-items">
      ${items.slice(0, 120).map((item) => `
        <button type="button" class="npc-trade-item" data-entity-item-slug="${escapeHtml(item.slug)}" data-entity-item-name="${escapeHtml(item.name)}" data-entity-item-image="${escapeHtml(item.imageSrc || "")}" data-tooltip="${escapeHtml(t("common.viewDetails"))}">
          <img src="${escapeHtml(item.imageSrc || "")}" alt="${escapeHtml(item.name)}">
          <span>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${item.price ? renderCurrencyValue(item.price, "gold") : "-"}</small>
          </span>
        </button>
      `).join("")}
      ${items.length > 120 ? `<small class="muted">Mostrando 120 de ${formatCompactNumber(items.length)} itens.</small>` : ""}
    </div>
  `;
}

function renderEntityChip(label, value, action = "") {
  if (!value) {
    return "";
  }

  const attrs = action ? ` data-entity-filter="${action}" data-filter-value="${escapeHtml(value)}"` : "";
  const tag = action ? "button" : "span";
  const type = action ? ` type="button"` : "";

  return `<${tag}${type} class="entity-chip"${attrs}><small>${escapeHtml(label)}</small>${escapeHtml(value)}</${tag}>`;
}

function setEntityDetailHtml(markup) {
  els.entityDetailEmpty?.classList.add("hidden");
  els.entityDetailContent?.classList.remove("hidden");
  els.entityDetailContent.innerHTML = normalizeUiText(markup);
  bindEntityDetailActions();
  bindSkillDynamicTooltips(els.entityDetailContent);
  return els.entityDetailContent;
}

function applyEditorialSectionOrder(root, template) {
  if (!root || !Array.isArray(template?.sections) || !template.sections.length) return;
  const ordered = template.sections.map((section) => String(section?.id || "")).filter(Boolean);
  for (const anchor of Array.isArray(template.integrationAnchors) ? template.integrationAnchors : []) {
    const id = String(anchor?.id || "");
    const index = ordered.indexOf(String(anchor?.after || ""));
    if (id && index >= 0 && !ordered.includes(id)) ordered.splice(index + 1, 0, id);
  }
  const rank = new Map(ordered.map((id, index) => [id, index]));
  [...root.children]
    .filter((element) => element.hasAttribute("data-library-section"))
    .sort((left, right) => (rank.get(left.dataset.librarySection) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.dataset.librarySection) ?? Number.MAX_SAFE_INTEGER))
    .forEach((element) => root.append(element));
}

function scrollEntityDetailIntoView(options = {}) {
  const detailCard = els.entityDetailContent?.closest(".entity-detail-card") || els.entityDetailContent;
  detailCard?.scrollIntoView({
    block: options.block || "start",
    behavior: options.behavior || "smooth"
  });
}

function scrollMonsterListIntoView() {
  els.monsterListPanel?.scrollIntoView({ block: "start", behavior: "auto" });
}

function scrollElementIntoView(element) {
  element?.scrollIntoView({ block: "start", behavior: "auto" });
}

function showGlobalLoading(message = "Carregando...") {
  state.globalLoadingCount += 1;
  els.globalLoadingOverlay?.classList.remove("splash-mode");

  setGlobalLoadingMessage(message);
  renderGlobalLoadingAction();
  els.globalLoadingOverlay?.classList.remove("hidden");
  els.globalLoadingOverlay?.setAttribute("aria-hidden", "false");
}

function setGlobalLoadingMessage(message = "Carregando...") {
  if (els.globalLoadingText) {
    els.globalLoadingText.textContent = normalizeUiText(message);
  }
}

function setGlobalLoadingAction(action = null) {
  state.globalLoadingAction = action && typeof action.onClick === "function"
    ? {
        tooltip: action.tooltip || "Interromper Carregamento",
        onClick: action.onClick
      }
    : null;
  renderGlobalLoadingAction();
}

function renderGlobalLoadingAction() {
  if (!els.globalLoadingActionButton) {
    return;
  }

  const action = state.globalLoadingAction;
  const visible = Boolean(action) && !els.globalLoadingOverlay?.classList.contains("splash-mode");
  els.globalLoadingActionButton.classList.toggle("hidden", !visible);

  if (visible) {
    const tooltip = action.tooltip || "Interromper Carregamento";
    els.globalLoadingActionButton.dataset.tooltip = tooltip;
    els.globalLoadingActionButton.setAttribute("title", tooltip);
    els.globalLoadingActionButton.setAttribute("aria-label", tooltip);
  }
}

function showInitialSplash(progress = 0) {
  state.initialSplashStartedAt = performance.now();
  state.initialSplashProgress = 0;
  state.globalLoadingCount = Math.max(state.globalLoadingCount, 1);
  els.globalLoadingOverlay?.classList.add("splash-mode");
  els.globalLoadingOverlay?.classList.remove("hidden");
  els.globalLoadingOverlay?.setAttribute("aria-hidden", "false");
  updateInitialSplashProgress(progress);
}

function updateInitialSplashProgress(progress) {
  if (!els.globalLoadingProgress) {
    return;
  }

  const normalizedProgress = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  state.initialSplashProgress = Math.max(state.initialSplashProgress || 0, normalizedProgress);
  const elapsed = performance.now() - state.initialSplashStartedAt;
  const visibleProgress =
    state.initialSplashProgress >= 100 && elapsed < INITIAL_SPLASH_MIN_VISIBLE_MS
      ? 99
      : state.initialSplashProgress;
  els.globalLoadingProgress.textContent = `${visibleProgress}%`;
  const statusLabel = getInitialSplashStatus(visibleProgress);
  if (els.globalLoadingStatus) {
    els.globalLoadingStatus.textContent = statusLabel;
  }
  void setDesktopSplashProgress(visibleProgress).catch(() => {});
  void setDesktopSplashStatus(statusLabel).catch(() => {});
}

function hideInitialSplash() {
  const elapsed = performance.now() - state.initialSplashStartedAt;
  const remaining = Math.max(0, INITIAL_SPLASH_MIN_VISIBLE_MS - elapsed);

  window.setTimeout(() => {
    updateInitialSplashProgress(100);
    document.body.classList.remove("app-booting");
    els.globalLoadingOverlay?.classList.remove("splash-mode");
    state.globalLoadingCount = 1;
    hideGlobalLoading();
    void notifyDesktopReadyToShow().catch(() => {});
    schedulePostBootWork();
  }, remaining);
}

function recordPerformanceMetric(name, details = {}) {
  return window.desktopApi?.app?.performanceMetric?.(name, details).catch(() => {});
}

function bindTemporaryUiPerformanceDiagnostics() {
  if (!isDesktopOverlayApp() || window.__tibiaToolkitUiPerformanceDiagnosticsBound) {
    return;
  }

  window.__tibiaToolkitUiPerformanceDiagnosticsBound = true;
  let sequence = 0;
  void recordPerformanceMetric("ui-diagnostic-session-start", {
    selectedSection: state.selectedSection || "",
    selectedToolTab: state.selectedToolTab || ""
  });

  document.addEventListener("click", (event) => {
    const clicked = event.target instanceof Element
      ? event.target.closest("button, a, [role='button'], [data-section], [data-tool-tab], [data-tab], [data-action]")
      : null;

    if (!clicked) {
      return;
    }

    const clickId = ++sequence;
    const startedAt = performance.now();
    const label = String(
      clicked.getAttribute("aria-label")
      || clicked.getAttribute("data-tooltip")
      || clicked.getAttribute("title")
      || clicked.textContent
      || ""
    ).replace(/\s+/g, " ").trim().slice(0, 100);
    const target = {
      tag: clicked.tagName.toLowerCase(),
      id: String(clicked.id || "").slice(0, 80),
      section: String(clicked.dataset.section || "").slice(0, 80),
      toolTab: String(clicked.dataset.toolTab || "").slice(0, 80),
      tab: String(clicked.dataset.tab || "").slice(0, 80),
      action: String(clicked.dataset.action || "").slice(0, 80),
      label
    };

    queueMicrotask(() => {
      const context = {
        selectedSection: state.selectedSection || "",
        selectedToolTab: state.selectedToolTab || "",
        itemViewMode: state.itemViewMode || "",
        entityViewMode: state.entityViewMode || "",
        npcTab: state.npcTab || ""
      };
      void recordPerformanceMetric("ui-click-diagnostic", { clickId, target, context });

      window.setTimeout(() => {
        const memory = performance.memory;
        void recordPerformanceMetric("ui-click-settled-diagnostic", {
          clickId,
          target,
          context: {
            selectedSection: state.selectedSection || "",
            selectedToolTab: state.selectedToolTab || "",
            itemViewMode: state.itemViewMode || "",
            entityViewMode: state.entityViewMode || "",
            npcTab: state.npcTab || ""
          },
          elapsedMs: Math.round(performance.now() - startedAt),
          domNodes: document.getElementsByTagName("*").length,
          heapUsedMb: memory?.usedJSHeapSize
            ? Math.round((memory.usedJSHeapSize / 1048576) * 100) / 100
            : null
        });
      }, 250);
    });
  });
}

function recordLibraryGridRenderMetric(kind, startedAt, total, rendered, container) {
  const now = performance.now();
  const lastRecordedAt = libraryRenderMetricAt.get(kind) || -Infinity;
  if (now - lastRecordedAt < LIBRARY_RENDER_METRIC_THROTTLE_MS) {
    return;
  }

  libraryRenderMetricAt.set(kind, now);
  void recordPerformanceMetric("library-grid-rendered", {
    kind,
    total,
    rendered,
    domNodes: container?.children?.length || 0,
    elapsedMs: Math.round(now - startedAt)
  });
}

// Pause only decorative motion while the desktop window is not active. Timers,
// alerts and Mirror state continue in the main process and are not affected.
window.desktopApi?.app?.onActivityStateChanged?.(({ active }) => {
  document.body.classList.toggle("app-inactive", !active);
});

let postBootWorkScheduled = false;

function schedulePostBootWork() {
  if (postBootWorkScheduled) {
    return;
  }

  postBootWorkScheduled = true;
  void recordPerformanceMetric("renderer-ready", {
    elapsedMs: Math.round(performance.now() - state.initialSplashStartedAt)
  });
  const run = async () => {
    await import("./desktop/tutorial-tour.js").catch((error) => {
      console.warn("[startup] tutorial-module-failed", error);
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await import("./desktop/screen-vision/screen-vision.js").catch((error) => {
      console.warn("[startup] screen-vision-module-failed", error);
    });

    // Do not parse and render full Stash/Bestiary datasets right after the
    // splash. Their compact visual indexes remain available when a tab opens;
    // complete details are hydrated on demand with the existing loading UI.
  };

  window.setTimeout(() => void run(), 120);
}

function runInitialSplashTask(startProgress, endProgress, task) {
  updateInitialSplashProgress(startProgress);

  try {
    const result = typeof task === "function" ? task() : task;

    if (result && typeof result.then === "function") {
      return result.finally(() => {
        updateInitialSplashProgress(endProgress);
      });
    }

    updateInitialSplashProgress(endProgress);
    return result;
  } catch (error) {
    updateInitialSplashProgress(endProgress);
    throw error;
  }
}

async function waitForStartupTaskDeadline(taskPromise, startedAt, maxWaitMs) {
  const remainingMs = Math.max(0, Math.round(
    Number(maxWaitMs) - (performance.now() - Number(startedAt || performance.now()))
  ));

  if (remainingMs <= 0) {
    return false;
  }

  let timeoutId = 0;
  try {
    return await Promise.race([
      Promise.resolve(taskPromise).then(() => true),
      new Promise((resolve) => {
        timeoutId = window.setTimeout(() => resolve(false), remainingMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

function mapProgress(progress, startProgress, endProgress) {
  const normalized = Math.max(0, Math.min(100, Number(progress) || 0));
  return startProgress + ((endProgress - startProgress) * normalized) / 100;
}

function getInitialSplashStatus(progress) {
  const normalizedProgress = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));

  if (normalizedProgress < 4) {
    return t("splash.preparing");
  }

  if (normalizedProgress < 30) {
    return t("splash.loadingWorlds");
  }

  if (normalizedProgress < 36) {
    return t("splash.loadingRecentItems");
  }

  if (normalizedProgress < 40) {
    return t("splash.restoringDrafts");
  }

  if (normalizedProgress < 44) {
    return t("splash.restoringTools");
  }

  if (normalizedProgress < 48) {
    return t("splash.loadingSavedWorld");
  }

  if (normalizedProgress < 56) {
    return t("splash.organizingShortcuts");
  }

  if (normalizedProgress < 63) {
    return t("splash.loadingCatalog");
  }

  if (normalizedProgress < 74) {
    return t("splash.preparingCreatures");
  }

  if (normalizedProgress < 82) {
    return t("splash.loadingAssets");
  }

  if (normalizedProgress < 88) {
    return t("splash.updatingCurrencies");
  }

  if (normalizedProgress < 92) {
    return t("splash.preparingInitialItem");
  }

  if (normalizedProgress < 97) {
    return t("splash.loadingMarketPrices");
  }

  if (normalizedProgress < 99) {
    return t("splash.savingPreferences");
  }

  if (normalizedProgress < 100) {
    return t("splash.finalizing");
  }

  return t("splash.ready");
}

function hideGlobalLoading() {
  state.globalLoadingCount = Math.max(0, state.globalLoadingCount - 1);

  if (state.globalLoadingCount > 0) {
    return;
  }

  setGlobalLoadingAction(null);
  els.globalLoadingOverlay?.classList.add("hidden");
  els.globalLoadingOverlay?.setAttribute("aria-hidden", "true");
}

function bindEntityDetailActions(root = els.entityDetailContent) {
  root?.querySelectorAll("[data-external-url]").forEach((button) => {
    if (button.dataset.externalLinkBound === "true") {
      return;
    }

    button.dataset.externalLinkBound = "true";
    button.addEventListener("click", () => {
      const url = String(button.dataset.externalUrl || "").trim();
      if (url) {
        void openDesktopExternalLink(url);
      }
    });
  });

  root?.querySelectorAll("[data-open-mini-world-change]").forEach((button) => {
    button.addEventListener("click", () => {
      void openOrientalTraderWorldChange();
    });
  });

  root?.querySelectorAll("[data-boss-map-panel]").forEach((button) => {
    if (button.dataset.bossMapBound === "true") {
      return;
    }

    button.dataset.bossMapBound = "true";
    button.addEventListener("click", () => {
      renderBossInlineMap(button);
    });
  });

  root?.querySelectorAll("[data-npc-spoiler-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.npcSpoilerToggle;
      const body = els.entityDetailContent.querySelector(`[data-npc-spoiler-body="${CSS.escape(key)}"]`);
      const expanded = button.getAttribute("aria-expanded") === "true";

      button.setAttribute("aria-expanded", expanded ? "false" : "true");
      button.querySelector("span").textContent = expanded
        ? t("common.show").toUpperCase()
        : t("common.hide").toUpperCase();
      body?.classList.toggle("hidden", expanded);
    });
  });

  root?.querySelectorAll("[data-entity-item-slug]").forEach((button) => {
    button.addEventListener("click", async () => {
      const slug = button.dataset.entityItemSlug;

      if (!slug) {
        return;
      }

      state.selectedItemSuggestion = {
        slug,
        name: button.dataset.entityItemName || slug,
        category: "Item",
        imageSrc: button.dataset.entityItemImage || ""
      };
      pushCurrentNavigationEntry();
      els.itemInput.value = state.selectedItemSuggestion.name;
      switchSection("item-prices");
      await handleItemSearch(true);
    });
  });

  root?.querySelectorAll("[data-entity-kind][data-entity-slug]").forEach((button) => {
    button.addEventListener("click", async () => {
      const kind = button.dataset.entityKind;
      const slug = button.dataset.entitySlug;
      const name = button.dataset.entityName || slug;

      if (!kind || !slug) {
        return;
      }

      if (kind === "item") {
        state.selectedItemSuggestion = { slug, name, category: "Item", imageSrc: "" };
        pushCurrentNavigationEntry();
        els.itemInput.value = name;
        switchSection("item-prices");
        await handleItemSearch(true);
        return;
      }

      pushCurrentNavigationEntry();
      switchSection("npcs", { skipHistory: true });
      if (kind === "npc") {
        await setEntityViewMode("npcs", { skipHistory: true });
        await openNpcDetail(name, { skipHistory: true });
        return;
      }

      await setEntityViewMode(kind === "boss" ? "bosses" : "monsters", { skipHistory: true });
      await openMonsterDetail(name, { skipHistory: true });
    });
  });

  root?.querySelectorAll("[data-entity-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.filterValue || "";

      if (button.dataset.entityFilter === "npc-city") {
        state.npcCity = value;
        if (els.npcCityFilter) {
          els.npcCityFilter.value = value;
        }
      }

      if (button.dataset.entityFilter === "npc-job") {
        state.npcJob = value;
        if (els.npcJobFilter) {
          els.npcJobFilter.value = value;
        }
      }

      void setEntityViewMode("npcs");
      renderNpcCatalog();
    });
  });

  root?.querySelectorAll("[data-boss-chart-mode-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      state.bossProbabilityChartMode = state.bossProbabilityChartMode === "dates" ? "days" : "dates";
      rerenderCurrentBossTrackerSections();
    });
  });

  root?.querySelectorAll("[data-boss-chart-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = Number(button.dataset.bossChartZoom) || 0;
      const nextZoom = Math.min(
        BOSS_CHART_ZOOM_LEVELS.length - 1,
        Math.max(0, state.bossProbabilityChartZoom + direction)
      );

      if (nextZoom === state.bossProbabilityChartZoom) {
        return;
      }

      state.bossProbabilityChartZoom = nextZoom;
      rerenderCurrentBossTrackerSections({ preserveChartScroll: true });
    });
  });

  root?.querySelectorAll("[data-creature-weakness-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const elementKey = button.dataset.creatureWeaknessFilter || "";

      if (!elementKey) {
        return;
      }

      void setCreatureWeaknessFilter(elementKey, state.entityViewMode === "bosses" ? "bosses" : "monsters");
    });
  });

  root?.querySelectorAll("[data-creature-gear-vocation]").forEach((button) => {
    button.addEventListener("click", () => {
      const vocation = button.dataset.creatureGearVocation || "knight";
      const shell = els.entityDetailContent?.querySelector("[data-creature-gear-shell]");

      if (!shell || !state.creatureGearEntry || state.creatureGearVocation === vocation) {
        return;
      }

      state.creatureGearVocation = vocation;
      renderCreatureGearRecommendationShell(shell, state.creatureGearEntry);
    });
  });

  root?.querySelectorAll("[data-creature-gear-weapon-style]").forEach((button) => {
    button.addEventListener("click", () => {
      const weaponStyle = button.dataset.creatureGearWeaponStyle || "1H";
      const shell = els.entityDetailContent?.querySelector("[data-creature-gear-shell]");

      if (!shell || !state.creatureGearEntry || state.creatureGearWeaponStyle === weaponStyle) {
        return;
      }

      state.creatureGearWeaponStyle = weaponStyle;
      renderCreatureGearRecommendationShell(shell, state.creatureGearEntry);
    });
  });

  root?.querySelectorAll("[data-creature-gear-imbuement-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const imbuementKey = button.dataset.creatureGearImbuementKey || "";

      if (!imbuementKey) {
        return;
      }

      pushCurrentNavigationEntry();
      state.currentImbuementKey = imbuementKey;
      switchSection("tools");
      setToolTab("imbuement", { skipHistory: true });
      renderImbuementOptions();
      renderImbuement();
      void ensureIngredientMetadata()
        .then(() => renderImbuement())
        .catch(() => {});
    });
  });

  root?.querySelectorAll("[data-boss-history-limit]").forEach((select) => {
    select.addEventListener("change", () => {
      const nextValue = select.value === "all" ? "all" : Math.max(10, Number(select.value) || 10);
      if (state.bossRespawnHistoryLimit === nextValue || !state.currentBossTracker) {
        return;
      }

      state.bossRespawnHistoryLimit = nextValue;
      rerenderCurrentBossTrackerSections();
    });
  });

}

function getEmbeddedTibiaMapUrl(url) {
  const value = String(url || "");
  const hashIndex = value.indexOf("#");
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";

  if (/^https:\/\/tibiamaps\.io\/map\/embed/i.test(value)) {
    return value;
  }

  if (hash) {
    return `https://tibiamaps.io/map/embed${hash}`;
  }

  return value || "https://tibiamaps.io/map/embed";
}

function closeMapModal() {
  els.mapModal?.classList.add("hidden");
  els.mapModal?.setAttribute("aria-hidden", "true");

  if (els.mapModalFrame) {
    els.mapModalFrame.src = "about:blank";
  }
}

function startMapDrag(event) {
  if (!els.mapModalCard || event.target.closest("button")) {
    return;
  }

  const rect = els.mapModalCard.getBoundingClientRect();
  state.mapWindow.dragging = true;
  state.mapWindow.dragOffsetX = event.clientX - rect.left;
  state.mapWindow.dragOffsetY = event.clientY - rect.top;
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function moveMapDrag(event) {
  if (!state.mapWindow.dragging || !els.mapModalCard) {
    return;
  }

  const margin = 8;
  const rect = els.mapModalCard.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
  const nextLeft = Math.min(Math.max(margin, event.clientX - state.mapWindow.dragOffsetX), maxLeft);
  const nextTop = Math.min(Math.max(margin, event.clientY - state.mapWindow.dragOffsetY), maxTop);

  els.mapModalCard.style.left = `${nextLeft}px`;
  els.mapModalCard.style.top = `${nextTop}px`;
}

function stopMapDrag() {
  state.mapWindow.dragging = false;
}

function showEntityLoading(message) {
  els.entityDetailEmpty?.classList.add("hidden");
  els.entityDetailContent?.classList.remove("hidden");
  els.entityDetailContent.innerHTML = `<div class="empty-inline">${escapeHtml(message)}</div>`;
}

function renderEntityDetailError(error, label) {
  const message = error instanceof Error ? error.message : `Falha ao carregar ${label}.`;
  setEntityDetailHtml(`<div class="empty-inline error-text">${escapeHtml(message)}</div>`);
}

function renderEntityError(container, error, label) {
  if (!container) {
    return;
  }

  const message = error instanceof Error ? error.message : `Falha ao carregar ${label}.`;
  container.innerHTML = `<div class="empty-inline error-text">${escapeHtml(message)}</div>`;
}

function renderTradeLabel(value) {
  if (value === "yes") {
    return "Compra/vende";
  }

  if (value === "no") {
    return "Sem comercio";
  }

  return "Desconhecido";
}

function setNpcsStatus(message) {
  if (els.npcsStatus) {
    els.npcsStatus.textContent = normalizeUiText(message);
  }
}

function positionItemViewLayout() {
  const tabs = document.querySelector(".item-view-tabs");

  if (!els.panelItemHeader || !tabs || !els.itemStashView || !els.itemBooksView) {
    return;
  }

  els.panelItemHeader.insertAdjacentElement("afterend", tabs);
  tabs.insertAdjacentElement("afterend", els.itemStashView);
  els.itemStashView.insertAdjacentElement("afterend", els.itemBooksView);
}

async function ensureStashLoaded() {
  if (state.stashLoaded) {
    return;
  }

  if (state.stashLoadPromise) {
    return state.stashLoadPromise;
  }

  state.stashLoadPromise = (async () => {
    setStashStatus(t("stash.loadingLocal"));
    const data = await fetchStashItems();
    state.stashItems = Array.isArray(data?.items) ? data.items : [];
    state.stashItemBySlug = new Map(state.stashItems.flatMap((item) => {
      const keys = new Set([
        String(item?.slug || ""),
        slugifyItemInput(item?.name || "")
      ].filter(Boolean));
      return [...keys].map((key) => [key, item]);
    }));
    state.stashCategories = Array.isArray(data?.categories) ? data.categories : [];
    state.stashTraders = Array.isArray(data?.traders) ? data.traders : [];
    state.stashLoaded = true;
    void recordPerformanceMetric("stash-catalog-ready", { count: state.stashItems.length });
    renderStashFilters();
    setStashStatus(t("stash.localItemsCount", { count: formatCompactNumber(state.stashItems.length) }));
  })();

  try {
    await state.stashLoadPromise;
  } finally {
    state.stashLoadPromise = null;
  }
}

function setBooksStatus(message) {
  if (els.booksStatus) {
    // This value changes after the local catalog resolves.  It must no longer
    // be treated as the static "books.loading" label, otherwise a later
    // locale refresh replaces the result count with the loading fallback.
    els.booksStatus.removeAttribute("data-i18n");
    els.booksStatus.textContent = normalizeUiText(message || "");
  }
}

function fillBooksSelect(select, placeholder, values, selectedValue) {
  if (!select) return;
  select.innerHTML = [
    `<option value="">${escapeHtml(placeholder)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
  ].join("");
  select.value = values.includes(selectedValue) ? selectedValue : "";
}

function renderBooksFilters() {
  const listing = state.booksDocuments.listing;
  if (!listing?.facets) return;

  fillBooksSelect(els.booksLocationFilter, t("books.allLocations"), listing.facets.locations || [], state.booksDocuments.location);
  fillBooksSelect(els.booksLibraryFilter, t("books.allLibraries"), listing.facets.libraries || [], state.booksDocuments.library);
  fillBooksSelect(els.booksAuthorFilter, t("books.allAuthors"), listing.facets.authors || [], state.booksDocuments.author);
  if (els.booksSortFilter) {
    els.booksSortFilter.value = state.booksDocuments.sort;
  }
}

function renderBooksGrid() {
  const listing = state.booksDocuments.listing;
  if (!els.booksGrid || !els.booksPagination) return;

  if (!listing) {
    els.booksGrid.innerHTML = "";
    els.booksPagination.innerHTML = "";
    return;
  }

  const results = Array.isArray(listing.results) ? listing.results : [];
  if (!results.length) {
    els.booksGrid.innerHTML = `<p class="empty-inline books-empty">${escapeHtml(t("books.empty"))}</p>`;
    els.booksPagination.innerHTML = "";
    setBooksStatus(t("books.noResults"));
    return;
  }

  els.booksGrid.innerHTML = results.map((book) => {
    const subtitle = book.author || book.locations?.[0] || book.libraries?.[0] || t("books.noMetadata");
    const location = book.locations?.[0] || book.libraries?.[0] || "";
    return `
      <button type="button" class="book-card" data-book-slug="${escapeHtml(book.slug)}">
        <span class="book-card-art">${book.image ? `<img src="${escapeHtml(book.image)}" alt="">` : ""}</span>
        <span class="book-card-copy">
          <strong>${escapeHtml(book.name)}</strong>
          <span>${escapeHtml(subtitle)}</span>
          ${location && location !== subtitle ? `<small>${escapeHtml(location)}</small>` : ""}
        </span>
      </button>`;
  }).join("");
  els.booksGrid.querySelectorAll("[data-book-slug]").forEach((button) => {
    button.addEventListener("click", () => void selectBookDocument(button.dataset.bookSlug));
  });

  const totalPages = Math.max(1, Math.ceil(Number(listing.total || 0) / Number(listing.pageSize || 1)));
  els.booksPagination.innerHTML = `
    <button type="button" class="entity-link-chip" data-books-page="${Math.max(1, listing.page - 1)}" ${listing.page <= 1 ? "disabled" : ""}>${escapeHtml(t("books.previous"))}</button>
    <span>${escapeHtml(t("books.page", { current: listing.page, total: totalPages }))}</span>
    <button type="button" class="entity-link-chip" data-books-page="${Math.min(totalPages, listing.page + 1)}" ${listing.page >= totalPages ? "disabled" : ""}>${escapeHtml(t("books.next"))}</button>`;
  els.booksPagination.querySelectorAll("[data-books-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const page = Number(button.dataset.booksPage);
      if (!button.disabled && page !== state.booksDocuments.page) {
        state.booksDocuments.page = page;
        void loadBooksDocuments();
      }
    });
  });
  setBooksStatus(t("books.results", { count: formatCompactNumber(listing.total || 0) }));
}

function renderBookDetail() {
  const book = state.booksDocuments.detail;
  if (!els.booksDetail) return;
  if (!book) {
    els.booksDetail.classList.add("hidden");
    els.booksDetail.innerHTML = "";
    return;
  }

  const locale = state.localeController?.getLocale?.() || "pt-BR";
  const translatedText = book.translatedText || book.ptText || "";
  const originalText = book.englishText || book.originalText || book.rawText || "";
  const hasReviewedTranslation = locale === "pt-BR" && Boolean(translatedText);
  const readableText = hasReviewedTranslation ? translatedText : originalText;
  const textLabel = hasReviewedTranslation ? t("books.translation") : t("books.originalText");
  const metadata = [
    [t("books.author"), book.author],
    [t("books.genre"), book.genre],
    [t("books.version"), book.version],
    [t("books.description"), book.shortDescription]
  ].filter(([, value]) => Boolean(value));
  const appearances = Array.isArray(book.appearances) ? book.appearances : [];

  els.booksDetail.innerHTML = `
    <div class="books-detail-header" data-library-section="hero">
      <div class="books-detail-hero">${book.image ? `<img src="${escapeHtml(book.image)}" alt="">` : ""}<div><h3>${escapeHtml(book.name)}</h3>${book.tibn ? `<p>${escapeHtml(book.tibn)}</p>` : ""}</div></div>
      <button type="button" class="entity-link-chip" data-books-close>${escapeHtml(t("books.closeDetails"))}</button>
    </div>
    ${metadata.length ? `<div class="books-metadata" data-library-section="metadata">${metadata.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>` : ""}
    ${readableText ? `<section class="books-detail-section" data-library-section="text"><h4>${escapeHtml(textLabel)}</h4><div class="book-text">${renderLibraryFactualText(readableText)}</div></section>` : ""}
    ${book.notes ? `<section class="books-detail-section" data-library-section="notes"><h4>${escapeHtml(t("common.notes"))}</h4><p>${renderLibraryFactualText(book.notes)}</p></section>` : ""}
    ${book.relatedArticles ? `<section class="books-detail-section" data-library-section="related"><h4>${escapeHtml(t("books.related"))}</h4><p>${renderLibraryFactualText(book.relatedArticles)}</p></section>` : ""}
    <section class="books-detail-section" data-library-section="appearances"><h4>${escapeHtml(t("books.appearances"))}</h4><div class="books-appearances">${appearances.map((appearance, index) => `
      <article class="book-appearance-card">
        <div class="book-appearance-content">${appearance.image ? `<img src="${escapeHtml(appearance.image)}" alt="">` : ""}
          <div><strong>${escapeHtml(appearance.name || t("books.appearance"))}</strong><span>${escapeHtml([appearance.location, appearance.locationDetail].filter(Boolean).join(" "))}</span></div>
        </div>
        ${appearance.coordinates ? `<button type="button" class="entity-link-chip boss-map-toggle" data-book-map-index="${index}">${escapeHtml(t("books.showMap"))}</button>` : ""}
      </article>`).join("") || `<p class="empty-inline">${escapeHtml(t("common.noData"))}</p>`}</div><div class="boss-inline-map hidden" data-books-inline-map-panel></div></section>
    <div class="books-detail-actions" data-library-section="actions">${book.source ? `<button type="button" class="entity-link-chip" data-book-open-wiki>${escapeHtml(t("common.openWiki"))}</button>` : ""}</div>`;
  els.booksDetail.classList.remove("hidden");
  els.booksDetail.querySelector("[data-books-close]")?.addEventListener("click", () => {
    state.booksDocuments.detail = null;
    renderBookDetail();
  });
  els.booksDetail.querySelectorAll("[data-book-map-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const appearance = appearances[Number(button.dataset.bookMapIndex)];
      if (!appearance?.coordinates) return;
      renderBookInlineMap(button, appearance, book.name);
    });
  });
  els.booksDetail.querySelector("[data-book-open-wiki]")?.addEventListener("click", () => {
    if (book.source) void openDesktopExternalLink(book.source);
  });
}

function renderBookInlineMap(button, appearance, bookName) {
  const section = button.closest(".books-detail-section");
  const panel = section?.querySelector("[data-books-inline-map-panel]");
  if (!panel || !appearance?.coordinates) {
    return;
  }

  const { x, y, floor, zoom } = appearance.coordinates;
  const mapUrl = `https://tibiamaps.io/map#${x},${y},${floor}:${zoom || 2}`;
  const mapTitle = [bookName, appearance.location, appearance.locationDetail]
    .filter(Boolean)
    .join(" - ");
  const isSameOpen = !panel.classList.contains("hidden")
    && panel.dataset.bookMapIndex === String(button.dataset.bookMapIndex || "");

  section.querySelectorAll("[data-book-map-index]").forEach((entry) => entry.classList.remove("active"));
  stopTibiaInlineMaps(panel);

  if (isSameOpen) {
    panel.classList.add("hidden");
    panel.dataset.bookMapIndex = "";
    panel.innerHTML = "";
    return;
  }

  button.classList.add("active");
  panel.dataset.bookMapIndex = String(button.dataset.bookMapIndex || "");
  panel.innerHTML = renderBossLocationMapPreview(mapUrl, mapTitle || t("common.map"));
  panel.classList.remove("hidden");
  panel.querySelectorAll("[data-tibia-inline-map]").forEach(initializeTibiaInlineMap);
  panel.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
}

async function selectBookDocument(slug, { scrollIntoView = true } = {}) {
  const requestId = ++state.booksDocuments.requestId;
  try {
    const payload = await fetchBooksDocuments({ slug });
    if (requestId !== state.booksDocuments.requestId) return;
    state.booksDocuments.detail = payload?.detail || null;
    renderBookDetail();
    if (scrollIntoView) {
      els.booksDetail?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  } catch (_error) {
    setBooksStatus(t("books.failed"));
  }
}

async function loadBooksDocuments() {
  const books = state.booksDocuments;
  const requestId = ++books.requestId;
  books.loading = true;
  setBooksStatus(t("books.loading"));
  try {
    const payload = await fetchBooksDocuments({
      query: books.query,
      location: books.location,
      library: books.library,
      author: books.author,
      sort: books.sort,
      page: books.page,
      pageSize: books.pageSize
    });
    if (requestId !== books.requestId) return;
    books.listing = payload || null;
    renderBooksFilters();
    renderBooksGrid();
  } catch (_error) {
    if (requestId !== books.requestId) return;
    books.listing = null;
    renderBooksGrid();
    setBooksStatus(t("books.failed"));
  } finally {
    if (requestId === books.requestId) books.loading = false;
  }
}

async function prewarmTutorialData() {
  if (state.tutorialPreloadPromise) {
    return state.tutorialPreloadPromise;
  }

  const startedAt = performance.now();
  const worldSlug = state.currentWorldSlug;
  state.tutorialPreloadPromise = Promise.allSettled([
    fetchItemSuggestions({ query: "Plate Armor", limit: 8, showAll: false }),
    fetchItemStatic({ itemSlug: "plate-armor", worldSlug }),
    fetchNpcIndex(),
    fetchNpcDetail({ name: "Yaman" })
  ]).then((results) => {
    const [itemSuggestionsResult, _itemStaticResult, npcIndexResult] = results;
    if (itemSuggestionsResult.status === "fulfilled") {
      state.tutorialItemSuggestions = Array.isArray(itemSuggestionsResult.value)
        ? itemSuggestionsResult.value
        : [];
    }

    if (npcIndexResult.status === "fulfilled") {
      const data = npcIndexResult.value;
      state.npcIndex = Array.isArray(data?.items) ? data.items : [];
      state.npcCities = Array.isArray(data?.cities) ? data.cities : [];
      state.npcJobs = Array.isArray(data?.jobs) ? data.jobs : [];
      state.npcLoaded = state.npcIndex.length > 0;
    }

    state.tutorialPreloadReady = results.every((result) => result.status === "fulfilled");
    void recordPerformanceMetric("tutorial-data-ready", {
      elapsedMs: Math.round(performance.now() - startedAt),
      itemSuggestions: state.tutorialItemSuggestions.length,
      npcs: state.npcIndex.length,
      complete: state.tutorialPreloadReady
    });
    return {
      complete: state.tutorialPreloadReady,
      itemSuggestions: state.tutorialItemSuggestions.length,
      npcs: state.npcIndex.length
    };
  });

  return state.tutorialPreloadPromise;
}

async function prewarmStartupCaches(onProgress = null) {
  const worldSlug = state.currentWorldSlug;
  const report = (progress) => {
    if (typeof onProgress === "function") {
      onProgress(progress);
  }
};

  report(0);

  try {
    await ensureStashLoaded();
  } catch (_error) {
    // Static catalog failures should not block the app; market cache can still be used.
  }

  report(35);

  try {
    const creatureData = await fetchCreatureIndex();
    state.monsterIndex = Array.isArray(creatureData?.items) ? creatureData.items : [];
    state.monsterCategories = Array.isArray(creatureData?.categories) ? creatureData.categories : [];
    state.monsterClasses = Array.isArray(creatureData?.classes) ? creatureData.classes : [];
    state.monsterTypes = Array.isArray(creatureData?.types) ? creatureData.types : [];
    state.monstersLoaded = state.monsterIndex.length > 0;
    renderToolbarWorldStatus();
  } catch (_error) {
    // O analyzer ainda pode seguir com fallback de nomes mesmo sem o preload local.
  }

  report(100);
}

function renderStashFilters() {
  if (els.stashWeeklyFilter) {
    const weeklyTasksLabel = t("stash.weeklyTasks");
    els.stashWeeklyFilter.classList.toggle("active", state.stashWeeklyOnly);
    els.stashWeeklyFilter.setAttribute("aria-pressed", String(state.stashWeeklyOnly));
    els.stashWeeklyFilter.setAttribute("aria-label", weeklyTasksLabel);
    els.stashWeeklyFilter.dataset.tooltip = weeklyTasksLabel;
  }

  if (els.stashCategoryFilter) {
    els.stashCategoryFilter.innerHTML = [
      `<option value="">${escapeHtml(t("stash.showAll"))}</option>`,
      ...state.stashCategories.map((category) => (
        `<option value="${escapeHtml(category)}">${escapeHtml(t("stash.showCategory", { category }))}</option>`
      ))
    ].join("");
    els.stashCategoryFilter.value = state.stashCategory;
  }

  if (els.stashTraderFilter) {
    els.stashTraderFilter.innerHTML = [
      `<option value="">${escapeHtml(t("stash.noTraderSelected"))}</option>`,
      ...state.stashTraders.map((trader) => (
        `<option value="${escapeHtml(trader)}">${escapeHtml(t("stash.sellTo", { trader }))}</option>`
      ))
    ].join("");
    els.stashTraderFilter.value = state.stashTrader;
  }

  renderStashSortFilter();
}

function renderStashSortFilter() {
  if (!els.stashSortFilter) {
    return;
  }

  const options = [
    { value: "name-asc", label: t("stash.sort.nameAsc") },
    { value: "name-desc", label: t("stash.sort.nameDesc") },
    ...(state.stashValueMode === "market"
      ? [
          { value: "market-high", label: t("stash.sort.marketHigh") },
          { value: "market-low", label: t("stash.sort.marketLow") }
        ]
      : []),
    { value: "npc-high", label: t("stash.sort.npcHigh") },
    { value: "npc-low", label: t("stash.sort.npcLow") }
  ];
  const allowedValues = new Set(options.map((option) => option.value));

  if (!allowedValues.has(state.stashSort)) {
    state.stashSort = state.stashSort === "market-high"
      ? "npc-high"
      : state.stashSort === "market-low"
        ? "npc-low"
        : "name-asc";
  }

  els.stashSortFilter.innerHTML = options
    .map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`)
    .join("");
  els.stashSortFilter.value = state.stashSort;
}

function renderStashValueButtons() {
  els.stashValueButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.stashValueMode === state.stashValueMode);
  });
  if (els.stashMarketRefreshButton) {
    const marketModeActive = state.stashValueMode === "market";
    const cooldownActive = isStashMarketRefreshCoolingDown();
    const cooldownLabel = getStashMarketRefreshCooldownLabel();
    els.stashMarketRefreshButton.classList.toggle("hidden", !marketModeActive);
    els.stashMarketRefreshButton.disabled = !marketModeActive || state.stashLoadingMarket || state.stashMarketRefreshSyncing || cooldownActive;
    els.stashMarketRefreshButton.classList.toggle("blocked", marketModeActive && cooldownActive);
    els.stashMarketRefreshButton.setAttribute(
      "aria-disabled",
      marketModeActive && (cooldownActive || state.stashMarketRefreshSyncing) ? "true" : "false",
    );
    els.stashMarketRefreshButton.classList.toggle("loading", marketModeActive && state.stashLoadingMarket);
    els.stashMarketRefreshButton.dataset.tooltip =
      marketModeActive && cooldownActive
        ? cooldownLabel
        : "Atualizar preços do market";
    els.stashMarketRefreshButton.dataset.tooltipTone = marketModeActive && cooldownActive ? "danger" : "default";
    setLiveTooltip(els.stashMarketRefreshButton, els.stashMarketRefreshButton.dataset.tooltip);
    els.stashMarketRefreshButton.removeAttribute("title");
    els.stashMarketRefreshButton.setAttribute(
      "aria-label",
      marketModeActive && cooldownActive ? cooldownLabel : "Atualizar preços do market",
    );
  }
  if (state.stashValueMode !== "market") {
    hideStashMarketRefreshWarning();
  }
}

function getFilteredStashItems() {
  const query = normalizeSearchText(state.stashQuery);
  const cacheSignature = [
    query,
    state.stashWeeklyOnly ? "weekly" : "all",
    state.stashCategory,
    state.stashTrader,
    state.stashSort,
    state.stashValueMode,
    state.currentWorldSlug,
    state.stashMarketRevision
  ].join("\u0000");

  if (
    state.stashFilteredItemsCacheSource === state.stashItems &&
    state.stashFilteredItemsCacheSignature === cacheSignature
  ) {
    return state.stashFilteredItemsCache;
  }

  const filteredItems = state.stashItems
    .filter((item) => {
      if (state.stashWeeklyOnly && !item.isWeeklyTask) {
        return false;
      }

      if (query) {
        const haystack = normalizeSearchText(
          `${item.name} ${item.slug} ${item.category} ${(item.categoryTags || []).join(" ")}`
        );
        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (
        state.stashCategory &&
        !(Array.isArray(item.categoryTags) && item.categoryTags.includes(state.stashCategory))
      ) {
        return false;
      }

      if (state.stashTrader && !item.sellTo.includes(state.stashTrader)) {
        return false;
      }

      return true;
    })
    .sort(compareStashItems);

  state.stashFilteredItemsCacheSource = state.stashItems;
  state.stashFilteredItemsCacheSignature = cacheSignature;
  state.stashFilteredItemsCache = filteredItems;
  return filteredItems;
}

function compareStashItems(left, right) {
  const leftValue = getStashItemValue(left, getSortValueMode());
  const rightValue = getStashItemValue(right, getSortValueMode());

  if (state.stashSort === "name-desc") {
    return right.name.localeCompare(left.name);
  }

  if (state.stashSort.endsWith("-high")) {
    return (rightValue ?? -1) - (leftValue ?? -1) || left.name.localeCompare(right.name);
  }

  if (state.stashSort.endsWith("-low")) {
    return (leftValue ?? Number.MAX_SAFE_INTEGER) - (rightValue ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name);
  }

  return left.name.localeCompare(right.name);
}

function getSortValueMode() {
  if (state.stashSort.startsWith("market")) {
    return "market";
  }

  if (state.stashSort.startsWith("npc")) {
    return "npc";
  }

  return state.stashValueMode;
}

function getTargetStashMarketIds({ onlyVisible = false, includeLoaded = false } = {}) {
  const ids = (
    onlyVisible
      ? getVisibleStashMarketIds({ includeLoaded })
      : getFilteredStashItems()
        .map((item) => item.marketId)
        .filter(Boolean)
  )
    .filter((id, index, allIds) => allIds.indexOf(id) === index)
    .sort((left, right) => left - right);

  return ids;
}

function renderStashGrid() {
  if (!els.stashGrid) {
    return;
  }
  const renderStartedAt = performance.now();

  const filteredItems = getFilteredStashItems();

  if (filteredItems.length === 0) {
    els.stashGrid.innerHTML = `<div class="stash-empty">${escapeHtml(t("stash.noItemsFound"))}</div>`;
    setStashStatus(t("stash.noItemsCurrentFilters"));
    return;
  }

  const renderSignature = [
    state.stashQuery,
    state.stashWeeklyOnly ? "weekly" : "all",
    state.stashCategory,
    state.stashTrader,
    state.stashSort,
    state.stashValueMode
  ].join("\u0000");
  if (renderSignature !== state.stashRenderSignature) {
    state.stashRenderSignature = renderSignature;
    els.stashGrid.scrollTop = 0;
  }
  const previousScrollTop = els.stashGrid.scrollTop;
  const virtualWindow = STASH_GRID_VIRTUALIZATION_ENABLED
    ? getStashGridVirtualWindow(filteredItems.length)
    : {
        firstIndex: 0,
        endIndex: filteredItems.length,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0
      };
  const items = filteredItems.slice(virtualWindow.firstIndex, virtualWindow.endIndex);
  const topSpacer = renderStashGridSpacer(virtualWindow.topSpacerHeight);
  const bottomSpacer = renderStashGridSpacer(virtualWindow.bottomSpacerHeight);

  els.stashGrid.innerHTML = `${topSpacer}${items.map((item) => renderStashItem(item)).join("")}${bottomSpacer}`;
  els.stashGrid.scrollTop = previousScrollTop;
  setStashGridStatus(filteredItems);

  els.stashGrid.querySelectorAll("[data-stash-item-slug]").forEach((button) => {
    const getItem = () => {
      const slug = button.dataset.stashItemSlug;
      return state.stashItems.find((entry) => entry.slug === slug) || null;
    };

    const showAnimation = () => setStashItemAnimation(button, true);
    const showStill = () => setStashItemAnimation(button, false);
    button.addEventListener("mouseenter", () => {
      showAnimation();
      showStashItemTooltip(button, getItem());
    });
    button.addEventListener("focus", () => {
      showAnimation();
      showStashItemTooltip(button, getItem());
    });
    button.addEventListener("mouseleave", () => {
      showStill();
      hideStashItemTooltip();
    });
    button.addEventListener("blur", () => {
      showStill();
      hideStashItemTooltip();
    });
    button.addEventListener("click", () => {
      const item = getItem();

      if (item) {
        hideStashItemTooltip();
        void previewStashItem(item, { loadMarket: true });
      }
    });
  });
  recordLibraryGridRenderMetric("stash", renderStartedAt, filteredItems.length, items.length, els.stashGrid);
}

function shouldRenderStashGridAfterMarketUpdate(values) {
  if (state.itemViewMode !== "stash" || !els.stashGrid) {
    return false;
  }

  // A price can reorder the entire filtered catalogue when the active sort is
  // Market, including items that are currently outside the virtual window.
  // In every other sort, only cards currently mounted in the viewport need an
  // immediate repaint; off-screen cards read the updated cache on their next
  // virtual render.
  if (state.stashSort.startsWith("market")) {
    return true;
  }

  const updatedMarketIds = new Set(
    Object.keys(values && typeof values === "object" ? values : {})
      .map((id) => Number(id))
      .filter(Boolean)
  );
  if (updatedMarketIds.size === 0) {
    return false;
  }

  return Array.from(els.stashGrid.querySelectorAll("[data-market-id]")).some((button) => (
    updatedMarketIds.has(Number(button.dataset.marketId))
  ));
}

function renderStashGridAfterMarketUpdate(values) {
  if (shouldRenderStashGridAfterMarketUpdate(values)) {
    renderStashGrid();
    return;
  }

  void recordPerformanceMetric("stash-market-grid-render-deferred", {
    updatedCount: Object.keys(values && typeof values === "object" ? values : {}).length,
    reason: state.stashSort.startsWith("market") ? "inactive" : "offscreen"
  });
}

function handleStashGridScroll() {
  if (!els.stashGrid || state.itemViewMode !== "stash") return;
  scheduleStashGridVirtualRender();
}

function scheduleStashGridVirtualRender() {
  if (!els.stashGrid || !state.stashLoaded || state.itemViewMode !== "stash" || state.stashVirtualRenderFrame) {
    return;
  }

  state.stashVirtualRenderFrame = window.requestAnimationFrame(() => {
    state.stashVirtualRenderFrame = null;
    if (state.itemViewMode !== "stash" || !state.stashLoaded) {
      return;
    }
    renderStashGrid();
    scheduleStashMarketLoad();
  });
}

function getStashGridVirtualWindow(totalItems) {
  const styles = window.getComputedStyle(els.stashGrid);
  const cellSize = Number.parseFloat(styles.getPropertyValue("--stash-grid-cell-size")) || STASH_GRID_FALLBACK_CELL_SIZE;
  const gap = Number.parseFloat(styles.getPropertyValue("--stash-grid-gap")) || STASH_GRID_FALLBACK_GAP;
  const paddingInline =
    (Number.parseFloat(styles.paddingLeft) || 0) +
    (Number.parseFloat(styles.paddingRight) || 0);

  return getFixedGridVirtualWindow({
    totalItems,
    itemWidth: cellSize,
    itemHeight: cellSize,
    columnGap: gap,
    rowGap: gap,
    paddingInline,
    viewportWidth: els.stashGrid.clientWidth,
    viewportHeight: els.stashGrid.clientHeight,
    scrollTop: els.stashGrid.scrollTop,
    targetRenderedRows: STASH_GRID_TARGET_RENDERED_ROWS
  });
}

function renderStashGridSpacer(height) {
  const roundedHeight = Math.max(0, Math.round(Number(height) || 0));
  return roundedHeight > 0
    ? `<div class="stash-virtual-spacer" aria-hidden="true" style="height:${roundedHeight}px"></div>`
    : "";
}

function renderStashItem(item) {
  const value = getStashItemValue(item, state.stashValueMode);
  const borderClass = getStashValueClass(value);

  const sprite = item.sprite;
  const still = sprite
    ? `<span class="stash-item-static-sprite" aria-hidden="true" style="width:${sprite.tileSize}px;height:${sprite.tileSize}px;background-image:url('${escapeHtml(sprite.src)}');background-size:${sprite.width}px ${sprite.height}px;background-position:-${sprite.x}px -${sprite.y}px"></span>`
    : "";
  const imageAttributes = sprite
    ? `data-stash-animated-src="${escapeHtml(item.imageSrc)}"`
    : `src="${escapeHtml(item.imageSrc)}"`;

  return `
    <button type="button" class="stash-item ${borderClass}" aria-label="${escapeHtml(item.name)}" data-stash-item-slug="${escapeHtml(item.slug)}" data-market-id="${escapeHtml(item.marketId || "")}">
      ${still}
      <img class="stash-item-animated-sprite${sprite ? " is-deferred" : ""}" ${imageAttributes} alt="${escapeHtml(item.name)}" decoding="async">
    </button>
  `;
}

function setStashItemAnimation(button, active) {
  const image = button?.querySelector("img[data-stash-animated-src]");
  const still = button?.querySelector(".stash-item-static-sprite");
  if (!image || !still) return;
  if (active) {
    if (!image.getAttribute("src")) image.setAttribute("src", image.dataset.stashAnimatedSrc || "");
    image.classList.remove("is-deferred");
    still.classList.add("is-deferred");
    return;
  }
  image.classList.add("is-deferred");
  still.classList.remove("is-deferred");
  image.removeAttribute("src");
}

function showStashItemTooltip(anchor, item) {
  if (!anchor || !item?.name) {
    return;
  }

  const tooltip = getStashItemTooltip();
  tooltip.textContent = item.name;
  tooltip.classList.remove("hidden");

  const rect = anchor.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - tooltipRect.width / 2),
    window.innerWidth - tooltipRect.width - 8
  );
  const top = rect.top - tooltipRect.height - 8 > 8
    ? rect.top - tooltipRect.height - 8
    : rect.bottom + 8;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideStashItemTooltip() {
  document.querySelector("#stash-item-tooltip")?.classList.add("hidden");
}

function showStashItemDetail() {
  if (state.itemViewMode !== "stash") {
    return;
  }

  state.stashPreviewVisible = true;
  ensureItemDetailView()?.classList.remove("hidden");
}

function getStashItemTooltip() {
  let tooltip = document.querySelector("#stash-item-tooltip");

  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "stash-item-tooltip";
    tooltip.className = "stash-item-tooltip hidden";
    document.body.appendChild(tooltip);
  }

  return tooltip;
}

async function previewStashItem(item, { loadMarket = false } = {}) {
  if (!item?.slug) {
    return;
  }

  state.selectedItemSuggestion = {
    slug: item.slug,
    name: item.name,
    category: item.category || "Sem categoria",
    imageSrc: item.imageSrc || ""
  };
  els.itemInput.value = item.name;
  closeItemSuggestions();

  if (
    !loadMarket &&
    state.lastPreviewedStashSlug === item.slug &&
    state.currentItem?.item?.slug === item.slug
  ) {
    state.currentItem = applyStashMarketPreview(state.currentItem, item);
    renderItem();
    showStashItemDetail();
    scrollItemSummaryIntoView();
    return;
  }

  state.lastPreviewedStashSlug = item.slug;
  const requestId = ++state.stashPreviewRequestId;
  const loadingMessage = `Carregando ${item.name}...`;
  let loadingShown = false;
  // Opening a Stash item may require a local catalog read. Show the familiar
  // loading state immediately so the click always receives visible feedback.
  loadingShown = true;
  showGlobalLoading(loadingMessage);

  try {
    // The Stash catalog is already in memory. Use it for the first paint so a
    // click never waits on the detailed catalog or market enrichment.
    const staticData = await fetchStashItemPreview({
      itemSlug: item.slug,
      worldSlug: state.currentWorldSlug
    });

    if (requestId !== state.stashPreviewRequestId) {
      return;
    }

    state.currentItem = loadMarket ? staticData : applyStashMarketPreview(staticData, item);
    renderItem();
    showStashItemDetail();

    if (loadMarket) {
      scheduleStashPreviewHydration(item.slug, requestId);
    }

    // Let the local preview paint before forcing a layout-changing scroll.
    window.requestAnimationFrame(() => {
      if (requestId === state.stashPreviewRequestId) {
        scrollItemSummaryIntoView();
      }
    });
  } catch (error) {
    if (requestId === state.stashPreviewRequestId) {
      setFeedback(error instanceof Error ? error.message : "Falha ao abrir preview do item.", true);
    }
  } finally {
    if (loadingShown) {
      hideGlobalLoading();
    }
  }
}

function scheduleStashPreviewHydration(itemSlug, requestId) {
  const hydrate = () => {
    if (requestId === state.stashPreviewRequestId) {
      void hydrateStashPreviewItem(itemSlug, requestId);
    }
  };

  // The full item record can include market data and NPC detail lookups. It
  // should never compete with the first frame of the Stash preview.
  window.setTimeout(() => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(hydrate, { timeout: 800 });
      return;
    }

    hydrate();
  }, 0);
}

async function hydrateStashPreviewItem(itemSlug, requestId) {
  try {
    const data = await fetchItem({
      itemSlug,
      worldSlug: state.currentWorldSlug
    });

    if (requestId !== state.stashPreviewRequestId) {
      return;
    }

    state.currentItem = data;
    applyItemCurrencyRates(data);
    state.selectedItemSuggestion = {
      slug: data.item.slug,
      name: data.item.wiki_name || data.item.name,
      category: data.item.category || "Sem categoria",
      imageSrc: data.item.image_src || ""
    };
    els.itemInput.value = state.selectedItemSuggestion.name;
    closeItemSuggestions();
    renderItem();
    showStashItemDetail();
    saveRecentItemInBackground(data.item);
    scheduleWarmItemCache();
    setCurrentNavigationEntry({
      type: "item",
      slug: data.item.slug,
      name: data.item.wiki_name || data.item.name,
      category: data.item.category || "Sem categoria",
      imageSrc: data.item.image_src || ""
    });
    setFeedback("Item carregado.");
  } catch (_error) {
    if (requestId === state.stashPreviewRequestId) {
      setFeedback("Item carregado com cache local.", false);
    }
  }
}

function applyItemCurrencyRates(data) {
  if (!data?.currencyRates || typeof data.currencyRates !== "object") {
    return;
  }

  state.currencyRates = {
    tibiaCoinPrice: data.currencyRates.tibiaCoinPrice ?? null,
    goldTokenPrice: data.currencyRates.goldTokenPrice ?? null
  };
}

function saveRecentItemInBackground(item) {
  void saveRecentItem(item)
    .then(() => renderRecentItems())
    .catch(() => {});
}

function scrollItemSummaryIntoView(options = {}) {
  const target = els.itemSummaryContent?.closest(".item-summary-card") || els.itemSummaryContent;
  target?.scrollIntoView({
    block: options.block || "start",
    behavior: options.behavior || "smooth"
  });
}

function applyStashMarketPreview(data, item) {
  if (!data) {
    return data;
  }

  const selectedWorld = getSelectedWorld();
  const marketSnapshot = item?.marketId ? state.stashMarketById[item.marketId] : null;
  const market = {
    ...data.market
  };

  if (marketSnapshot) {
    market.sell_offer = marketSnapshot.sellOffer ?? marketSnapshot.current ?? null;
    market.buy_offer = marketSnapshot.buyOffer ?? null;
    market.current = market.sell_offer;
    market.captured_at = marketSnapshot.updatedAt || market.captured_at;
    market.status = marketSnapshot.updatedAt ? "preview do stash" : market.status;
  }

  return {
    ...data,
    selectedWorld: selectedWorld ? { ...data.selectedWorld, ...selectedWorld } : data.selectedWorld,
    market
  };
}

function setStashGridStatus(items) {
  if (state.stashValueMode !== "market") {
    setStashStatus(`${formatCompactNumber(items.length)} itens exibidos.`);
    return;
  }

  const eligibleCount = items.filter((item) => item.marketId).length;
  const freshCount = items.filter((item) => item.marketId && state.stashMarketFreshIds[item.marketId]).length;
  setStashStatus(`Market: ${formatCompactNumber(freshCount)}/${formatCompactNumber(eligibleCount)}`);
}

function getStashItemValue(item, mode) {
  if (mode === "market") {
    const market = state.stashMarketById[item.marketId];
    if (market?.hasActiveOffers === false) {
      return null;
    }
    return typeof market?.current === "number" ? market.current : null;
  }

  return typeof item.npcValue === "number" ? item.npcValue : null;
}

function getStashValueClass(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "no-value";
  }

  if (value >= 1000000) {
    return "value-legendary";
  }

  if (value >= 100000) {
    return "value-epic";
  }

  if (value >= 10000) {
    return "value-rare";
  }

  if (value >= 1000) {
    return "value-uncommon";
  }

  return "value-common";
}

function scheduleStashMarketLoad() {
  if (
    state.itemViewMode !== "stash" ||
    (state.stashValueMode !== "market" && !state.stashSort.startsWith("market"))
  ) {
    cancelStashMarketBackgroundRefresh();
    return;
  }

  cancelStashMarketBackgroundRefresh();

  if (state.stashMarketTimer) {
    window.clearTimeout(state.stashMarketTimer);
  }

  state.stashMarketTimer = window.setTimeout(() => {
    state.stashMarketTimer = null;
    void loadVisibleStashMarketValues();
  }, 350);
}

async function refreshFilteredStashMarketValues() {
  if (state.itemViewMode !== "stash" || state.stashValueMode !== "market") {
    return;
  }

  await loadVisibleStashMarketValues({
    forceFresh: true,
    onlyVisible: true,
    manual: true,
    continueInBackground: true
  });
}

function cancelStashMarketLoading() {
  if (state.stashMarketTimer) {
    window.clearTimeout(state.stashMarketTimer);
    state.stashMarketTimer = null;
  }

  cancelStashMarketBackgroundRefresh();
  state.stashMarketRequestId += 1;

  if (!state.stashLoadingMarket) {
    return;
  }

  state.stashLoadingMarket = false;
  renderStashValueButtons();
  setStashStatus("Atualizacao de market interrompida.");
  setStashGridStatus(getFilteredStashItems());
  setGlobalLoadingAction(null);
  hideGlobalLoading();
}

async function loadVisibleStashMarketValues(options = {}) {
  if (state.stashLoadingMarket) {
    return;
  }

  const forceFresh = options?.forceFresh === true;
  const onlyVisible = options?.onlyVisible !== false;
  const showBlockingProgress = options?.manual === true;
  const continueInBackground = options?.continueInBackground === true;
  const requestId = ++state.stashMarketRequestId;
  cancelStashMarketBackgroundRefresh();

  if (!forceFresh) {
    await loadStashWorldMarketSnapshot(requestId);
  }

  if (requestId !== state.stashMarketRequestId) {
    return;
  }

  const targetMarketIds = getTargetStashMarketIds({
    onlyVisible,
    includeLoaded: true
  });
  const marketIdsToLoad = [...targetMarketIds];
  const marketSignature = `${state.currentWorldSlug}:${marketIdsToLoad.join(",")}`;

  if (marketIdsToLoad.length === 0) {
    if (forceFresh) {
      setStashGridStatus(getFilteredStashItems());
    }
    state.stashMarketLoadedSignature = marketSignature;
    renderStashGrid();
    if (!showBlockingProgress || continueInBackground) {
      scheduleStashMarketBackgroundRefresh({ preferSnapshot: continueInBackground });
    }
    return;
  }

  const pendingMarketIds = forceFresh
    ? marketIdsToLoad
    : marketIdsToLoad.filter((id) => !state.stashMarketFreshIds[id]);

  if (pendingMarketIds.length === 0) {
    state.stashMarketLoadedSignature = marketSignature;
    renderStashGrid();
    if (!showBlockingProgress || continueInBackground) {
      scheduleStashMarketBackgroundRefresh({ preferSnapshot: continueInBackground });
    }
    return;
  }

  state.stashLoadingMarket = true;
  renderStashValueButtons();
  const totalToLoad = pendingMarketIds.length;
  let loadedCount = 0;
  if (showBlockingProgress) {
    setGlobalLoadingAction({
      tooltip: "Interromper Carregamento",
      onClick: () => {
        cancelStashMarketLoading();
      }
    });
    showGlobalLoading("Atualizando market do stash...");
  }
  const updateLoadingProgress = () => {
    setStashGridStatus(getFilteredStashItems());
    if (showBlockingProgress) {
      setGlobalLoadingMessage(`Atualizando market do stash: ${formatCompactNumber(loadedCount)}/${formatCompactNumber(totalToLoad)} itens...`);
    }
  };
  updateLoadingProgress();

  try {
    for (let index = 0; index < pendingMarketIds.length; index += 120) {
      const chunk = pendingMarketIds.slice(index, index + 120);
      const values = await fetchStashMarketValues({
        worldSlug: state.currentWorldSlug,
        marketIds: chunk,
        forceFresh: true,
        mergeIntoWorldCache: true
      });

      if (requestId !== state.stashMarketRequestId) {
        return;
      }

      state.stashMarketById = mergeStashMarketValuesPreservingCache(values);
      state.stashMarketRevision += 1;
      chunk.forEach((id) => {
        state.stashMarketFreshIds[id] = true;
      });

      loadedCount += chunk.length;
      updateLoadingProgress();
      renderStashGridAfterMarketUpdate(values);
    }

    state.stashMarketLoadedSignature = marketSignature;
    state.stashLoadingMarket = false;
    renderStashValueButtons();
    renderStashGrid();
  } catch (error) {
    if (requestId === state.stashMarketRequestId) {
      setStashStatus(error instanceof Error ? error.message : "Falha ao consultar market.");
    }
  } finally {
    if (requestId === state.stashMarketRequestId) {
      state.stashLoadingMarket = false;
      renderStashValueButtons();
      setGlobalLoadingAction(null);
      hideGlobalLoading();
      if (state.itemViewMode === "stash" && state.stashValueMode === "market") {
        setStashGridStatus(getFilteredStashItems());
        if (!showBlockingProgress || continueInBackground) {
          scheduleStashMarketBackgroundRefresh({ preferSnapshot: continueInBackground });
        }
      }
    }
  }
}

async function loadStashWorldMarketSnapshot(requestId) {
  if (
    state.stashWorldMarketLoading ||
    state.stashWorldMarketLoadedSlug === state.currentWorldSlug
  ) {
    return;
  }

  state.stashWorldMarketLoading = true;
  setStashStatus("Carregando snapshot do market salvo...");

  try {
    const values = await fetchStashMarketValues({
      worldSlug: state.currentWorldSlug,
      loadAllCached: true,
      localOnly: true
    });

    if (requestId !== state.stashMarketRequestId) {
      return;
    }

    state.stashWorldMarketLoadedSlug = state.currentWorldSlug;

    if (values && typeof values === "object") {
      state.stashMarketById = mergeStashMarketValuesPreservingCache(values);
      state.stashMarketRevision += 1;
      renderStashGridAfterMarketUpdate(values);
    }
  } catch (_error) {
    if (requestId === state.stashMarketRequestId) {
      state.stashWorldMarketLoadedSlug = state.currentWorldSlug;
    }
  } finally {
    if (requestId === state.stashMarketRequestId) {
      state.stashWorldMarketLoading = false;
    }
  }
}

function getStashMarketContextSignature() {
  return [
    state.currentWorldSlug,
    state.stashQuery,
    state.stashWeeklyOnly ? "weekly" : "all",
    state.stashCategory,
    state.stashTrader,
    state.stashSort,
    state.stashValueMode
  ].join("\u0000");
}

function cancelStashMarketBackgroundRefresh() {
  if (state.stashMarketBackgroundTimer) {
    window.clearTimeout(state.stashMarketBackgroundTimer);
    state.stashMarketBackgroundTimer = null;
  }
  state.stashMarketBackgroundRequestId += 1;
  state.stashMarketBackgroundLoading = false;
  state.stashMarketBackgroundPreferSnapshot = false;
}

function scheduleStashMarketBackgroundRefresh({ preferSnapshot = false } = {}) {
  if (
    state.itemViewMode !== "stash" ||
    state.stashValueMode !== "market" ||
    state.stashLoadingMarket
  ) {
    return;
  }

  state.stashMarketBackgroundPreferSnapshot = preferSnapshot === true;
  if (state.stashMarketBackgroundTimer) {
    window.clearTimeout(state.stashMarketBackgroundTimer);
  }

  const requestId = ++state.stashMarketBackgroundRequestId;
  const signature = getStashMarketContextSignature();
  state.stashMarketBackgroundTimer = window.setTimeout(() => {
    state.stashMarketBackgroundTimer = null;
    void refreshNextStashMarketBackgroundChunk(requestId, signature);
  }, 650);
}

async function refreshNextStashMarketBackgroundChunk(requestId, signature) {
  if (
    requestId !== state.stashMarketBackgroundRequestId ||
    signature !== getStashMarketContextSignature() ||
    state.itemViewMode !== "stash" ||
    state.stashValueMode !== "market"
  ) {
    return;
  }

  if (state.stashMarketBackgroundPreferSnapshot) {
    await refreshStashMarketSnapshotInBackground(requestId, signature);
    return;
  }

  const allFilteredIds = getTargetStashMarketIds({ onlyVisible: false, includeLoaded: true });
  const pendingIds = allFilteredIds.filter((id) => !state.stashMarketFreshIds[id]);
  if (pendingIds.length === 0) {
    state.stashMarketBackgroundLoading = false;
    setStashGridStatus(getFilteredStashItems());
    return;
  }

  const chunk = pendingIds.slice(0, 120);
  state.stashMarketBackgroundLoading = true;

  try {
    const values = await fetchStashMarketValues({
      worldSlug: state.currentWorldSlug,
      marketIds: chunk,
      forceFresh: true,
      mergeIntoWorldCache: true
    });

    if (
      requestId !== state.stashMarketBackgroundRequestId ||
      signature !== getStashMarketContextSignature()
    ) {
      return;
    }

    state.stashMarketById = mergeStashMarketValuesPreservingCache(values);
    chunk.forEach((id) => {
      state.stashMarketFreshIds[id] = true;
    });
    state.stashMarketRevision += 1;
    renderStashGridAfterMarketUpdate(values);

    setStashGridStatus(getFilteredStashItems());
  } catch (_error) {
    state.stashMarketBackgroundLoading = false;
    setStashGridStatus(getFilteredStashItems());
    return;
  }

  state.stashMarketBackgroundLoading = false;
  state.stashMarketBackgroundTimer = window.setTimeout(() => {
    state.stashMarketBackgroundTimer = null;
    void refreshNextStashMarketBackgroundChunk(requestId, signature);
  }, 450);
}

async function refreshStashMarketSnapshotInBackground(requestId, signature) {
  state.stashMarketBackgroundLoading = true;

  try {
    const values = await fetchStashMarketValues({
      worldSlug: state.currentWorldSlug,
      loadAllCached: true,
      forceFresh: true
    });

    if (
      requestId !== state.stashMarketBackgroundRequestId ||
      signature !== getStashMarketContextSignature()
    ) {
      return;
    }

    state.stashMarketById = mergeStashMarketValuesPreservingCache(values);
    Object.keys(values && typeof values === "object" ? values : {}).forEach((id) => {
      state.stashMarketFreshIds[id] = true;
    });
    state.stashMarketRevision += 1;
    renderStashGrid();
    setStashGridStatus(getFilteredStashItems());
  } catch (_error) {
    if (
      requestId === state.stashMarketBackgroundRequestId &&
      signature === getStashMarketContextSignature()
    ) {
      setStashGridStatus(getFilteredStashItems());
    }
  } finally {
    if (requestId === state.stashMarketBackgroundRequestId) {
      state.stashMarketBackgroundLoading = false;
      state.stashMarketBackgroundPreferSnapshot = false;
    }
  }

  if (
    requestId === state.stashMarketBackgroundRequestId &&
    signature === getStashMarketContextSignature()
  ) {
    const pendingIds = getTargetStashMarketIds({ onlyVisible: false, includeLoaded: true })
      .filter((id) => !state.stashMarketFreshIds[id]);
    if (pendingIds.length > 0) {
      scheduleStashMarketBackgroundRefresh();
    }
  }
}

function getVisibleStashMarketIds(options = {}) {
  if (!els.stashGrid) {
    return [];
  }

  const includeLoaded = options?.includeLoaded === true;
  const gridRect = els.stashGrid.getBoundingClientRect();
  const ids = [];

  els.stashGrid.querySelectorAll("[data-market-id]").forEach((button) => {
    const marketId = Number(button.dataset.marketId);

    if (!marketId || (!includeLoaded && state.stashMarketById[marketId])) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const isNearViewport = rect.bottom >= gridRect.top - 80 && rect.top <= gridRect.bottom + 160;

    if (isNearViewport) {
      ids.push(marketId);
    }
  });

  return ids.filter((id, index, allIds) => allIds.indexOf(id) === index);
}

function mergeStashMarketValuesPreservingCache(values) {
  const next = { ...state.stashMarketById };

  Object.entries(values && typeof values === "object" ? values : {}).forEach(([id, value]) => {
    const existing = next[id];
    if (!hasMeaningfulStashMarketValue(value) && hasMeaningfulStashMarketValue(existing)) {
      return;
    }
    next[id] = value;
  });

  return next;
}

function hasMeaningfulStashMarketValue(value) {
  return Boolean(
    value &&
    (
      value.updatedAt ||
      (value.current !== null && value.current !== undefined && Number.isFinite(Number(value.current))) ||
      (value.sellOffer !== null && value.sellOffer !== undefined && Number.isFinite(Number(value.sellOffer))) ||
      (value.buyOffer !== null && value.buyOffer !== undefined && Number.isFinite(Number(value.buyOffer)))
    )
  );
}

function isStashMarketRefreshCoolingDown() {
  return state.stashMarketRefreshCooldownDeadline > performance.now();
}

function getStashMarketRefreshCooldownSeconds() {
  return Math.max(1, Math.ceil((state.stashMarketRefreshCooldownDeadline - performance.now()) / 1000));
}

function formatStashMarketRefreshCooldown(seconds) {
  const totalSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const remainder = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function getStashMarketRefreshCooldownLabel() {
  return t("stash.refreshMarketCooldown", {
    time: formatStashMarketRefreshCooldown(getStashMarketRefreshCooldownSeconds())
  });
}

function applyStashMarketRefreshServerState(payload) {
  const retryAfterMs = Math.max(0, Math.ceil(Number(payload?.retryAfterSeconds) || 0) * 1000);
  state.stashMarketRefreshCooldownDeadline = retryAfterMs > 0
    ? performance.now() + retryAfterMs
    : 0;

  if (state.stashMarketRefreshCooldownTimer) {
    window.clearTimeout(state.stashMarketRefreshCooldownTimer);
  }

  const refreshCooldownVisual = () => {
    if (!isStashMarketRefreshCoolingDown()) {
      state.stashMarketRefreshCooldownDeadline = 0;
      state.stashMarketRefreshCooldownTimer = null;
      hideStashMarketRefreshWarning();
      renderStashValueButtons();
      return;
    }

    renderStashValueButtons();
    state.stashMarketRefreshCooldownTimer = window.setTimeout(refreshCooldownVisual, 1000);
  };

  if (retryAfterMs > 0) {
    state.stashMarketRefreshCooldownTimer = window.setTimeout(refreshCooldownVisual, 1000);
  } else {
    state.stashMarketRefreshCooldownTimer = null;
  }

  renderStashValueButtons();
}

async function syncStashMarketRefreshCooldown() {
  if (state.stashValueMode !== "market") {
    return;
  }

  state.stashMarketRefreshSyncing = true;
  renderStashValueButtons();

  try {
    const status = await fetchStashMarketRefreshStatus();
    applyStashMarketRefreshServerState(status);
  } catch (error) {
    setStashStatus(error instanceof Error ? error.message : "Nao foi possivel consultar o limite do market.");
  } finally {
    state.stashMarketRefreshSyncing = false;
    renderStashValueButtons();
  }
}

function showStashMarketRefreshWarning(
  message = "Voce deve aguardar um pouco antes de atualizar de novo."
) {
  if (!els.stashMarketRefreshWarning) {
    return;
  }

  els.stashMarketRefreshWarning.textContent = normalizeUiText(message);
  els.stashMarketRefreshWarning.classList.remove("hidden");

  if (state.stashMarketRefreshWarningTimer) {
    window.clearTimeout(state.stashMarketRefreshWarningTimer);
  }

  state.stashMarketRefreshWarningTimer = window.setTimeout(() => {
    hideStashMarketRefreshWarning();
  }, 3200);
}

function hideStashMarketRefreshWarning() {
  if (state.stashMarketRefreshWarningTimer) {
    window.clearTimeout(state.stashMarketRefreshWarningTimer);
    state.stashMarketRefreshWarningTimer = null;
  }

  els.stashMarketRefreshWarning?.classList.add("hidden");
}

function setStashStatus(message) {
  if (els.stashStatus) {
    els.stashStatus.textContent = message;
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesNameSearch(value, query) {
  const normalizedValue = slugifyItemInput(value || "");
  const normalizedQuery = slugifyItemInput(query || "");

  return Boolean(normalizedValue && normalizedQuery && normalizedValue.includes(normalizedQuery));
}

function getNameSearchRank(value, query) {
  const normalizedValue = slugifyItemInput(value || "");
  const normalizedQuery = slugifyItemInput(query || "");

  if (!normalizedQuery || normalizedValue === normalizedQuery) {
    return 0;
  }

  return normalizedValue.startsWith(normalizedQuery) ? 1 : 2;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function handleItemSearch(skipInputNormalization = false) {
  // Item links can originate from entity details while Books or Spells is the
  // active Library view. The search result belongs to the List view, so make
  // that transition before the first render instead of leaving the previous
  // tab visible over a successfully loaded item.
  if (state.itemViewMode !== "list") {
    await setItemViewMode("list", { skipHistory: true });
  }

  const rawInput = els.itemInput.value.trim();
  const itemSlug = state.selectedItemSuggestion?.slug
    ? state.selectedItemSuggestion.slug
    : skipInputNormalization
      ? rawInput
      : slugifyItemInput(rawInput);

  if (!itemSlug) {
    setItemSearchDropdownLoading(false);
    setFeedback("");
    return;
  }

  const itemSearchStartedAt = performance.now();
  setFeedback("Consultando item...");
  const searchRequestId = ++state.itemSearchRequestId;
  if (state.itemSearchGlobalLoadingRequestId) {
    hideGlobalLoading();
    state.itemSearchGlobalLoadingRequestId = 0;
  }
  state.itemSearchLoadingRequestId = searchRequestId;
  setItemSearchDropdownLoading(true);
  let itemSummaryScrolled = false;
  const scrollLoadedItemSummary = () => {
    if (itemSummaryScrolled || searchRequestId !== state.itemSearchRequestId) {
      return;
    }
    itemSummaryScrolled = true;
    window.requestAnimationFrame(() => scrollItemSummaryIntoView());
  };
  let itemLoadingShown = false;
  // Avoid a distracting flash for cached items, while making slower market
  // lookups feel responsive in both the packaged and local app.
  const itemLoadingTimer = window.setTimeout(() => {
    if (searchRequestId !== state.itemSearchRequestId) {
      return;
    }
    itemLoadingShown = true;
    state.itemSearchGlobalLoadingRequestId = searchRequestId;
    showGlobalLoading(t("common.loading"));
  }, 150);

  try {
    const staticData = await fetchItemStatic({
      itemSlug,
      worldSlug: state.currentWorldSlug
    }).catch(() => null);

    void recordPerformanceMetric("item-search-static-ready", {
      itemSlug,
      elapsedMs: Math.round(performance.now() - itemSearchStartedAt),
      available: Boolean(staticData)
    });

    if (staticData && searchRequestId === state.itemSearchRequestId) {
      state.currentItem = staticData;
      state.selectedItemSuggestion = {
        slug: staticData.item.slug,
        name: staticData.item.wiki_name || staticData.item.name,
        category: staticData.item.category || "Sem categoria",
        imageSrc: staticData.item.image_src || ""
      };
      els.itemInput.value = state.selectedItemSuggestion.name;
      closeItemSuggestions();
      renderItem();
      scrollLoadedItemSummary();
      setFeedback("Item carregado. Consultando market...");
    }

    const data = await fetchItem({
      itemSlug,
      worldSlug: state.currentWorldSlug
    });

    void recordPerformanceMetric("item-search-market-ready", {
      itemSlug,
      elapsedMs: Math.round(performance.now() - itemSearchStartedAt)
    });

    if (searchRequestId !== state.itemSearchRequestId) {
      return;
    }

    state.currentItem = data;
    applyItemCurrencyRates(data);
    state.selectedItemSuggestion = {
      slug: data.item.slug,
      name: data.item.wiki_name || data.item.name,
      category: data.item.category || "Sem categoria",
      imageSrc: data.item.image_src || ""
    };
    els.itemInput.value = state.selectedItemSuggestion.name;
    closeItemSuggestions();
    renderItem();
    scrollLoadedItemSummary();
    saveRecentItemInBackground(data.item);
    scheduleWarmItemCache();
    setCurrentNavigationEntry({
      type: "item",
      slug: data.item.slug,
      name: data.item.wiki_name || data.item.name,
      category: data.item.category || "Sem categoria",
      imageSrc: data.item.image_src || ""
    });
    setFeedback("Item carregado.");
  } catch (error) {
    void recordPerformanceMetric("item-search-failed", {
      itemSlug,
      elapsedMs: Math.round(performance.now() - itemSearchStartedAt),
      message: error instanceof Error ? error.message : "unknown"
    });
    if (searchRequestId !== state.itemSearchRequestId) {
      return;
    }

    setFeedback(error instanceof Error ? error.message : "Falha ao consultar item.", true);
  } finally {
    window.clearTimeout(itemLoadingTimer);
    if (itemLoadingShown && state.itemSearchGlobalLoadingRequestId === searchRequestId) {
      hideGlobalLoading();
      state.itemSearchGlobalLoadingRequestId = 0;
    }
    if (state.itemSearchLoadingRequestId === searchRequestId) {
      setItemSearchDropdownLoading(false);
    }
  }
}

function findExactItemSuggestion(query, suggestions = state.itemSuggestions) {
  const normalizedQuery = slugifyItemInput(query || "");

  if (!normalizedQuery) {
    return null;
  }

  return suggestions.find((suggestion) => {
    const suggestionName = slugifyItemInput(suggestion.name || "");
    const suggestionSlug = slugifyItemInput(suggestion.slug || "");
    return suggestionName === normalizedQuery || suggestionSlug === normalizedQuery;
  }) || null;
}

async function confirmExactItemInput() {
  const query = els.itemInput.value.trim();

  if (!query) {
    return false;
  }

  let exactSuggestion = findExactItemSuggestion(query);

  if (!exactSuggestion) {
    const suggestions = await fetchItemSuggestions({
      query,
      limit: 20,
      showAll: false
    }).catch(() => []);

    if (els.itemInput.value.trim() !== query) {
      return false;
    }

    exactSuggestion = findExactItemSuggestion(query, Array.isArray(suggestions) ? suggestions : []);
  }

  if (!exactSuggestion) {
    return false;
  }

  await selectItemSuggestion(exactSuggestion);
  return true;
}

async function updateItemSuggestions(options = {}) {
  const query = els.itemInput.value.trim();
  const requestId = ++state.itemSuggestionRequestId;
  const showAll = Boolean(options.showAll);

  if (!query && !showAll) {
    closeItemSuggestions();
    return;
  }

  try {
    const suggestions = await fetchItemSuggestions({
      query,
      limit: showAll ? ITEM_SUGGESTIONS_PAGE_SIZE : 8,
      offset: 0,
      showAll
    });

    if (requestId !== state.itemSuggestionRequestId) {
      return;
    }

    state.itemSuggestions = Array.isArray(suggestions) ? suggestions : [];
    state.activeItemSuggestionIndex = state.itemSuggestions.length > 0 ? 0 : -1;
    state.itemSuggestionsOpen = state.itemSuggestions.length > 0;
    state.itemSuggestionsShowAll = showAll;
    state.itemSuggestionsHasMore = showAll && state.itemSuggestions.length === ITEM_SUGGESTIONS_PAGE_SIZE;
    state.itemSuggestionsLoadingMore = false;
    renderItemSuggestions();
  } catch (_error) {
    if (requestId !== state.itemSuggestionRequestId) {
      return;
    }

    closeItemSuggestions();
  }
}

async function loadMoreItemSuggestions() {
  if (
    !state.itemSuggestionsShowAll ||
    !state.itemSuggestionsHasMore ||
    state.itemSuggestionsLoadingMore
  ) {
    return false;
  }

  const requestId = state.itemSuggestionRequestId;
  const offset = state.itemSuggestions.length;
  state.itemSuggestionsLoadingMore = true;

  try {
    const page = await fetchItemSuggestions({
      query: els.itemInput.value.trim(),
      limit: ITEM_SUGGESTIONS_PAGE_SIZE,
      offset,
      showAll: true
    });

    if (requestId !== state.itemSuggestionRequestId) {
      return false;
    }

    const nextPage = Array.isArray(page) ? page : [];
    if (!nextPage.length) {
      state.itemSuggestionsHasMore = false;
      return false;
    }

    state.itemSuggestions = [...state.itemSuggestions, ...nextPage];
    state.itemSuggestionsHasMore = nextPage.length === ITEM_SUGGESTIONS_PAGE_SIZE;
    renderItemSuggestions({ preserveScroll: true });
    return true;
  } catch (_error) {
    if (requestId === state.itemSuggestionRequestId) {
      state.itemSuggestionsHasMore = false;
    }
    return false;
  } finally {
    if (requestId === state.itemSuggestionRequestId) {
      state.itemSuggestionsLoadingMore = false;
    }
  }
}

function renderItemSuggestions(options = {}) {
  if (!state.itemSuggestionsOpen || state.itemSuggestions.length === 0) {
    els.itemSuggestions.innerHTML = "";
    els.itemSuggestions.classList.add("hidden");
    els.itemDropdownButton?.classList.remove("open");
    return;
  }

  const previousScrollTop = options.preserveScroll ? els.itemSuggestions.scrollTop : 0;
  els.itemSuggestions.innerHTML = state.itemSuggestions
    .map((suggestion, index) => {
      const activeClass = index === state.activeItemSuggestionIndex ? " active" : "";
      const sprite = suggestion.sprite;
      const spriteMarkup = sprite
        ? `<span class="suggestion-sprite-shell"><span class="suggestion-item-static-sprite" aria-hidden="true" style="width:${sprite.tileSize}px;height:${sprite.tileSize}px;background-image:url('${escapeHtml(sprite.src)}');background-size:${sprite.width}px ${sprite.height}px;background-position:-${sprite.x}px -${sprite.y}px"></span><img class="suggestion-item-animated-sprite is-deferred" data-suggestion-animated-src="${escapeHtml(suggestion.imageSrc)}" alt="${escapeHtml(suggestion.name)}" decoding="async"></span>`
        : `<img src="${escapeHtml(suggestion.imageSrc)}" alt="${escapeHtml(suggestion.name)}" decoding="async">`;

      return `
        <button class="suggestion-button${activeClass}" type="button" data-suggestion-index="${index}">
          ${spriteMarkup}
          <div class="suggestion-meta">
            <strong>${suggestion.name}</strong>
            <span>${suggestion.category}</span>
            <small>${suggestion.slug}</small>
          </div>
        </button>
      `;
    })
    .join("");

  showSuggestionsPanel(els.itemSuggestions);
  if (options.preserveScroll) {
    els.itemSuggestions.scrollTop = previousScrollTop;
  }
  els.itemDropdownButton?.classList.add("open");
  els.itemSuggestions.querySelectorAll("[data-suggestion-index]").forEach((button) => {
    button.addEventListener("pointerenter", () => setItemSuggestionAnimation(button, true));
    button.addEventListener("pointerleave", () => setItemSuggestionAnimation(button, false));
    button.addEventListener("focusin", () => setItemSuggestionAnimation(button, true));
    button.addEventListener("focusout", () => setItemSuggestionAnimation(button, false));
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.suggestionIndex);
      const suggestion = state.itemSuggestions[index];

      if (!suggestion) {
        return;
      }

      await selectItemSuggestion(suggestion);
    });
  });
}

function setItemSuggestionAnimation(button, active) {
  const image = button?.querySelector("img[data-suggestion-animated-src]");
  const still = button?.querySelector(".suggestion-item-static-sprite");
  if (!image || !still) return;
  if (active) {
    if (!image.getAttribute("src")) image.setAttribute("src", image.dataset.suggestionAnimatedSrc || "");
    image.classList.remove("is-deferred");
    still.classList.add("is-deferred");
    return;
  }
  image.classList.add("is-deferred");
  still.classList.remove("is-deferred");
  image.removeAttribute("src");
}

async function selectItemSuggestion(suggestion) {
  state.itemSuggestionRequestId += 1;
  state.selectedItemSuggestion = suggestion;
  els.itemInput.value = suggestion.name;
  closeItemSuggestions();
  await handleItemSearch(true);
}

function closeItemSuggestions() {
  state.itemSuggestionRequestId += 1;
  state.itemSuggestions = [];
  state.itemSuggestionsOpen = false;
  state.itemSuggestionsShowAll = false;
  state.itemSuggestionsHasMore = false;
  state.itemSuggestionsLoadingMore = false;
  state.activeItemSuggestionIndex = -1;
  els.itemDropdownButton?.classList.remove("open");
  hideSuggestionsPanel(els.itemSuggestions);
}

function setItemSearchDropdownLoading(isLoading) {
  const loading = Boolean(isLoading);
  els.itemDropdownButton?.classList.toggle("loading", loading);
  els.itemDropdownLoadingIndicator?.classList.toggle("loading", loading);
}

function bindSkillCalculatorEvents() {
  const inputs = [
    els.skillTypeSelect,
    els.skillVocationSelect,
    els.skillCurrentInput,
    els.skillTargetInput,
    els.skillRemainingRange,
    els.skillRemainingInput,
    els.skillLoyaltyRange,
    els.skillLoyaltyInput,
    els.skillDummyToggle,
    els.skillDoubleToggle
  ].filter(Boolean);

  inputs.forEach((input) => {
    input.addEventListener("input", syncSkillCalculatorFromInputs);
    input.addEventListener("change", syncSkillCalculatorFromInputs);
  });

  els.skillChoiceButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.skillType || "sword";
      if (els.skillTypeSelect) {
        els.skillTypeSelect.value = type;
      }
      syncSkillCalculatorFromInputs();
    });
  });

  els.skillVocationButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      const vocation = button.dataset.skillVocation || "knight";
      if (els.skillVocationSelect) {
        els.skillVocationSelect.value = vocation;
      }
      syncSkillCalculatorFromInputs();
    });
  });

  els.skillBonusButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      const bonus = button.dataset.skillBonus || "";
      if (bonus === "dummy" && els.skillDummyToggle) {
        els.skillDummyToggle.checked = !els.skillDummyToggle.checked;
      }
      if (bonus === "double" && els.skillDoubleToggle) {
        els.skillDoubleToggle.checked = !els.skillDoubleToggle.checked;
      }
      syncSkillCalculatorFromInputs();
    });
  });
}

function syncSkillCalculatorFromInputs(event) {
  const source = event?.target || null;
  const calculator = state.skillCalculator;

  calculator.type = SKILL_TYPES[els.skillTypeSelect?.value] ? els.skillTypeSelect.value : "sword";
  calculator.vocation = SKILL_VOCATION_FACTORS[els.skillVocationSelect?.value] ? els.skillVocationSelect.value : "knight";
  calculator.current = clampInteger(els.skillCurrentInput?.value, 0, 200, 80);
  calculator.target = clampInteger(els.skillTargetInput?.value, 1, 220, Math.max(calculator.current + 1, 90));
  calculator.remainingPercent = clampDecimal(
    source === els.skillRemainingRange ? els.skillRemainingRange.value : els.skillRemainingInput?.value,
    0,
    100,
    100
  );
  calculator.loyaltyPoints = clampInteger(
    source === els.skillLoyaltyRange ? els.skillLoyaltyRange.value : els.skillLoyaltyInput?.value,
    0,
    3600,
    0
  );
  calculator.useDummy = Boolean(els.skillDummyToggle?.checked);
  calculator.useDouble = Boolean(els.skillDoubleToggle?.checked);

  syncSkillCalculatorInputs();
  renderSkillCalculator();
}

function syncSkillCalculatorInputs() {
  const calculator = state.skillCalculator;
  const skill = SKILL_TYPES[calculator.type] || SKILL_TYPES.sword;
  const loyaltyBonus = getSkillLoyaltyBonus(calculator.loyaltyPoints);

  if (els.skillTypeSelect) els.skillTypeSelect.value = calculator.type;
  if (els.skillVocationSelect) els.skillVocationSelect.value = calculator.vocation;
  if (els.skillCurrentInput) els.skillCurrentInput.value = String(calculator.current);
  if (els.skillTargetInput) els.skillTargetInput.value = String(calculator.target);
  const remainingPercentValue = formatSkillRemainingPercent(calculator.remainingPercent);
  if (els.skillRemainingRange) els.skillRemainingRange.value = remainingPercentValue;
  if (els.skillRemainingInput) els.skillRemainingInput.value = remainingPercentValue;
  if (els.skillLoyaltyRange) els.skillLoyaltyRange.value = String(calculator.loyaltyPoints);
  if (els.skillLoyaltyInput) els.skillLoyaltyInput.value = String(calculator.loyaltyPoints);
  updateRangeProgress(els.skillRemainingRange, calculator.remainingPercent, 100);
  updateRangeProgress(els.skillLoyaltyRange, calculator.loyaltyPoints, 3600);
  if (els.skillDummyToggle) els.skillDummyToggle.checked = calculator.useDummy;
  if (els.skillDoubleToggle) els.skillDoubleToggle.checked = calculator.useDouble;

  if (els.skillLoyaltyBonus) {
    const nextStep = Math.min(3600, Math.ceil((calculator.loyaltyPoints + 1) / 360) * 360);
    els.skillLoyaltyBonus.textContent = `${t("skill.loyaltyBonus")}: ${formatSkillPercent(loyaltyBonus)}${loyaltyBonus < 50 ? ` | ${t("skill.nextBand")}: ${nextStep} pts` : ` | ${t("skill.maximum")}`}`;
  }

  if (els.skillPreviewTitle) {
    els.skillPreviewTitle.textContent = skill.label;
  }

  if (els.skillPreviewIcon) {
    els.skillPreviewIcon.src = skill.icon || SKILL_WEAPON_IMAGE_FALLBACKS[skill.weapon] || "assets/ui/tools/tool-skill-calculator.webp";
    els.skillPreviewIcon.alt = skill.label;
  }

  els.skillChoiceButtons?.forEach((button) => {
    button.classList.toggle("active", button.dataset.skillType === calculator.type);
  });

  els.skillVocationButtons?.forEach((button) => {
    button.classList.toggle("active", button.dataset.skillVocation === calculator.vocation);
  });

  els.skillBonusButtons?.forEach((button) => {
    const bonus = button.dataset.skillBonus || "";
    const active = bonus === "dummy" ? calculator.useDummy : bonus === "double" ? calculator.useDouble : false;
    button.classList.toggle("active", active);
  });
}

function updateRangeProgress(input, value, max) {
  if (!input) {
    return;
  }

  const safeMax = Math.max(Number(max) || 1, 1);
  const safeValue = Math.min(Math.max(Number(value) || 0, 0), safeMax);
  input.style.setProperty("--range-progress", `${(safeValue / safeMax) * 100}%`);
}

function renderSkillCalculator() {
  return renderSkillCalculatorCompact();
}

function renderSkillCalculatorLegacyUnused() {
  if (!els.skillSummaryGrid || !els.skillResultsGrid) {
    return;
  }

  syncSkillCalculatorInputs();

  const result = calculateSkillTraining();
  const skill = SKILL_TYPES[state.skillCalculator.type] || SKILL_TYPES.sword;
  const tcPrice = getSkillTibiaCoinGoldPrice();
  const tcIcon = state.currencyIconMap?.tc || GOLD_ICON_PATH;
  const npcIsBest = result.storeGoldEquivalent === null || result.npcGoldTotal <= result.storeGoldEquivalent;
  const storeIsBest = result.storeGoldEquivalent !== null && result.storeGoldEquivalent < result.npcGoldTotal;

  els.skillSummaryGrid.innerHTML = normalizeUiText(`
    <article class="skill-price-route-card${npcIsBest ? " best" : ""}">
      ${npcIsBest ? `<span class="skill-best-badge">${escapeHtml(t("skill.bestPrice"))}</span>` : ""}
      <h4>NPC</h4>
      <div class="skill-route-bullets">
        <div>
          <img src="assets/ui/economy/Crystal_Coin.gif" alt="">
          <span>Gold</span>
          <strong>${formatGoldValue(result.npcGoldTotal)}</strong>
        </div>
        <div>
          <img src="${escapeHtml(tcIcon)}" alt="">
          <span>Tibia Coin</span>
          <strong>${tcPrice ? renderCurrencyValue(Math.ceil(result.npcGoldTotal / tcPrice), "TC") : escapeHtml(t("skill.noWorldTc"))}</strong>
        </div>
      </div>
    </article>
    <article class="skill-price-route-card${storeIsBest ? " best" : ""}">
      ${storeIsBest ? `<span class="skill-best-badge">${escapeHtml(t("skill.bestPrice"))}</span>` : ""}
      <h4>${escapeHtml(t("skill.store"))}</h4>
      <div class="skill-route-bullets">
        <div>
          <img src="${escapeHtml(tcIcon)}" alt="">
          <span>Tibia Coin</span>
          <strong>${renderCurrencyValue(result.storeTcTotal, "TC")}</strong>
        </div>
        <div>
          <img src="assets/ui/economy/Crystal_Coin.gif" alt="">
          <span>${escapeHtml(t("skill.goldEquivalent"))}</span>
          <strong>${result.storeGoldEquivalent === null ? escapeHtml(t("skill.noWorldTc")) : formatGoldValue(result.storeGoldEquivalent)}</strong>
        </div>
      </div>
    </article>
  `);

  const weaponCards = result.weaponResults.map((weaponResult) => `
    <article class="skill-weapon-card">
      <span class="skill-count-badge">${formatCompactNumber(weaponResult.count)}x</span>
      <img src="${escapeHtml(weaponResult.imageSrc)}" alt="${escapeHtml(weaponResult.name)}">
      <strong>${escapeHtml(weaponResult.label)}</strong>
      <small>${formatCompactNumber(weaponResult.charges)} cargas</small>
    </article>
  `).join("");
  const timeParts = getSkillDurationParts(result.secondsNeeded);
  const timeCards = timeParts.map((part) => `
    <article class="skill-time-card">
      <strong>${formatNumberForUi(part.value, part.maximumFractionDigits || 0)}</strong>
      <span>${escapeHtml(part.label)}</span>
    </article>
  `).join("");

  els.skillResultsGrid.innerHTML = normalizeUiText(`
    <section class="skill-result-section">
      <div class="shortcut-heading">
        <h4>${escapeHtml(t("skill.weapons"))}</h4>
        <p>${formatCompactNumber(result.chargesNeeded)} cargas necessárias para ${escapeHtml(skill.label)}.</p>
      </div>
      <div class="skill-weapon-grid">${weaponCards}</div>
    </section>
    <section class="skill-result-section">
      <div class="shortcut-heading">
        <h4>${escapeHtml(t("skill.totalTime"))}</h4>
        <p>Considerando 1 carga a cada 2 segundos.</p>
      </div>
      <div class="skill-time-grid">${timeCards}</div>
    </section>
  `);
}

function renderSkillCalculatorCompact() {
  if (!els.skillSummaryGrid || !els.skillResultsGrid) {
    return;
  }

  ensureSkillCurrencyRates();
  syncSkillCalculatorInputs();

  const result = calculateSkillTraining();
  const skill = SKILL_TYPES[state.skillCalculator.type] || SKILL_TYPES.sword;
  const tcPrice = getSkillTibiaCoinGoldPrice();
  const tcIcon = state.currencyIconMap?.tc || GOLD_ICON_PATH;
  const npcIsBest = result.storeGoldEquivalent === null || result.npcGoldTotal <= result.storeGoldEquivalent;
  const storeIsBest = result.storeGoldEquivalent !== null && result.storeGoldEquivalent < result.npcGoldTotal;
  const weaponCards = result.weaponResults.map((weaponResult) => `
    <article class="skill-weapon-card" data-tooltip="${escapeHtml(`${weaponResult.name}: ${formatCompactNumber(weaponResult.charges)} cargas`)}">
      <span class="skill-count-badge">${formatCompactNumber(weaponResult.count)}x</span>
      <img src="${escapeHtml(weaponResult.imageSrc)}" alt="${escapeHtml(weaponResult.name)}">
    </article>
  `).join("");
  const timeCards = getSkillDurationParts(result.secondsNeeded).map((part) => `
    <article class="skill-time-card">
      <strong>${formatNumberForUi(part.value, part.maximumFractionDigits || 0)}</strong>
      <span>${escapeHtml(part.label)}</span>
    </article>
  `).join("");

  els.skillSummaryGrid.innerHTML = normalizeUiText(`
    <section class="skill-result-board">
      <div class="skill-route-grid">
        <article class="skill-price-route-card${npcIsBest ? " best" : ""}">
          ${renderTibiaCoinsCtaMarkup("skill-route-tibia-coins-cta")}
          ${npcIsBest ? `<span class="skill-best-badge">${escapeHtml(t("skill.bestPrice"))}</span>` : ""}
          <h4>NPC</h4>
          <div class="skill-route-bullets">
            <div>
              <img src="assets/ui/economy/Crystal_Coin.gif" alt="">
              <span>Gold</span>
              <strong>${formatGoldValue(result.npcGoldTotal)}</strong>
            </div>
            <div>
              <img src="${escapeHtml(tcIcon)}" alt="">
              <span>Tibia Coin</span>
              <strong>${tcPrice ? renderCurrencyValue(Math.ceil(result.npcGoldTotal / tcPrice), "TC") : escapeHtml(t("skill.noWorldTc"))}</strong>
            </div>
          </div>
        </article>
        <article class="skill-price-route-card${storeIsBest ? " best" : ""}">
          ${renderTibiaCoinsCtaMarkup("skill-route-tibia-coins-cta")}
          ${storeIsBest ? `<span class="skill-best-badge">${escapeHtml(t("skill.bestPrice"))}</span>` : ""}
          <h4>${escapeHtml(t("skill.store"))}</h4>
          <div class="skill-route-bullets">
            <div>
              <img src="${escapeHtml(tcIcon)}" alt="">
              <span>Tibia Coin</span>
              <strong>${renderCurrencyValue(result.storeTcTotal, "TC")}</strong>
            </div>
            <div>
              <img src="assets/ui/economy/Crystal_Coin.gif" alt="">
              <span>${escapeHtml(t("skill.goldEquivalent"))}</span>
              <strong>${result.storeGoldEquivalent === null ? escapeHtml(t("skill.noWorldTc")) : formatGoldValue(result.storeGoldEquivalent)}</strong>
            </div>
          </div>
        </article>
      </div>
      <div class="skill-outcome-grid">
        <div class="skill-outcome-block">
          <span>${escapeHtml(t("skill.weapons"))}</span>
          <div class="skill-weapon-grid">${weaponCards}</div>
        </div>
        <div class="skill-outcome-block">
          <span>${escapeHtml(t("skill.totalTime"))}</span>
          <div class="skill-time-grid">${timeCards}</div>
        </div>
      </div>
    </section>
  `);
  els.skillResultsGrid.innerHTML = "";
  bindSkillDynamicTooltips(els.skillSummaryGrid);
}

function renderTibiaCoinsCtaMarkup(className = "") {
  const extraClassName = className ? ` ${escapeHtml(className)}` : "";

  return `
    <button type="button" class="tibia-coins-cta${extraClassName}" data-tooltip="${escapeHtml(t("toolbar.buyTibiaCoins"))}" aria-label="${escapeHtml(t("toolbar.buyTibiaCoins"))}">
      <img src="${escapeHtml(TIBIA_COIN_CTA_ICON_PATH)}" alt="">
    </button>
  `;
}

function ensureSkillCurrencyRates() {
  if (getSkillTibiaCoinGoldPrice() || state.currencyRatesLoading) {
    return;
  }

  const now = Date.now();

  if (now - state.currencyRatesLastAttemptAt < 30000) {
    return;
  }

  state.currencyRatesLastAttemptAt = now;
  state.currencyRatesLoading = true;
  void refreshCurrencyRates()
    .then(() => renderSkillCalculator())
    .catch(() => {})
    .finally(() => {
      state.currencyRatesLoading = false;
    });
}

function calculateSkillTraining() {
  const calculator = state.skillCalculator;
  const skill = SKILL_TYPES[calculator.type] || SKILL_TYPES.sword;
  const current = Math.max(0, calculator.current);
  const target = Math.max(current + 1, calculator.target);
  const rawUnits = calculateSkillUnitsNeeded({
    type: calculator.type,
    vocation: calculator.vocation,
    current,
    target,
    remainingPercent: calculator.remainingPercent
  });
  const loyaltyBonus = getSkillLoyaltyBonus(calculator.loyaltyPoints);
  const multiplier = (1 + loyaltyBonus / 100) * (calculator.useDummy ? 1.1 : 1) * (calculator.useDouble ? 2 : 1);
  const adjustedUnits = rawUnits / Math.max(multiplier, 0.01);
  const unitsPerCharge = skill.unitsPerCharge || 1;
  const chargesNeeded = Math.ceil(adjustedUnits / unitsPerCharge);
  const secondsNeeded = chargesNeeded * 2;
  const weaponResults = calculateSkillWeaponBreakdown(chargesNeeded, skill);
  const npcGoldTotal = weaponResults.reduce((total, result) => total + result.count * result.npcPrice, 0);
  const storeTcTotal = weaponResults.reduce((total, result) => total + result.count * result.storeTc, 0);
  const tcPrice = getSkillTibiaCoinGoldPrice();
  const storeGoldEquivalent = tcPrice ? storeTcTotal * tcPrice : null;

  return {
    rawUnits,
    adjustedUnits,
    chargesNeeded,
    secondsNeeded,
    totalBonusPercent: (multiplier - 1) * 100,
    weaponResults,
    npcGoldTotal,
    storeTcTotal,
    storeGoldEquivalent
  };
}

function calculateSkillUnitsNeeded({ type, vocation, current, target, remainingPercent }) {
  let total = getSkillLevelUnits(type, vocation, current) * (remainingPercent / 100);

  for (let level = current + 1; level < target; level += 1) {
    total += getSkillLevelUnits(type, vocation, level);
  }

  return Math.max(0, total);
}

function getSkillLevelUnits(type, vocation, level) {
  const skill = SKILL_TYPES[type] || SKILL_TYPES.sword;
  const family = skill.family || "melee";
  const factors = SKILL_VOCATION_FACTORS[vocation] || SKILL_VOCATION_FACTORS.knight;
  const factor = factors[family] || 1.5;
  const exponent = family === "magic" ? level : Math.max(0, level - 10);

  return skill.base * Math.pow(factor, exponent);
}

function getSkillLoyaltyBonus(points) {
  return Math.min(50, Math.floor(Math.max(0, Number(points) || 0) / 360) * 5);
}

function getSkillWeaponName(tierKey, skill) {
  const tier = SKILL_WEAPON_TIERS.find((entry) => entry.key === tierKey) || SKILL_WEAPON_TIERS[0];
  const weaponNames = {
    sword: "Sword",
    bow: "Bow",
    rod: "Rod",
    shield: "Shield",
    wraps: "Wraps"
  };
  return `${tier.prefix} ${weaponNames[skill.weapon] || "Sword"}`;
}

function calculateSkillWeaponBreakdown(chargesNeeded, skill) {
  let remainingCharges = Math.max(0, Number(chargesNeeded) || 0);

  return SKILL_WEAPON_TIERS.map((tier, index) => {
    const isLastTier = index === SKILL_WEAPON_TIERS.length - 1;
    const count = isLastTier
      ? Math.ceil(remainingCharges / tier.charges)
      : Math.floor(remainingCharges / tier.charges);
    remainingCharges = Math.max(0, remainingCharges - count * tier.charges);

    return {
      ...tier,
      count,
      name: getSkillWeaponName(tier.key, skill),
      imageSrc: getSkillWeaponImage(tier.key, skill.weapon)
    };
  });
}

function getSkillWeaponImage(tierKey, weaponKey) {
  return SKILL_WEAPON_IMAGES[tierKey]?.[weaponKey] || SKILL_WEAPON_IMAGE_FALLBACKS[weaponKey] || "assets/ui/tools/tool-skill-calculator.webp";
}

function getSkillTibiaCoinGoldPrice() {
  const selectedWorld = getSelectedWorld();
  return selectedWorld?.tc_price || state.currencyRates.tibiaCoinPrice || null;
}

function getSkillDurationParts(seconds) {
  const totalMinutes = Math.max(0, Math.ceil((Number(seconds) || 0) / 60));
  const totalDays = totalMinutes / 1440;

  if (totalDays >= 3650) {
    const decades = truncateDecimal(totalDays / 3652.5, 2);
    return [{ value: decades, label: decades === 1 ? "decada" : "decadas", maximumFractionDigits: 2 }];
  }

  if (totalDays >= 365) {
    const years = truncateDecimal(totalDays / 365.25, 2);
    return [{ value: years, label: years === 1 ? "ano" : "anos", maximumFractionDigits: 2 }];
  }

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days > 0) {
    parts.push({ value: days, label: days === 1 ? "dia" : "dias" });
  }

  if (hours > 0 || days > 0) {
    parts.push({ value: hours, label: hours === 1 ? "hora" : "horas" });
  }

  parts.push({ value: minutes, label: minutes === 1 ? "minuto" : "minutos" });
  return parts;
}

function formatSkillPercent(value) {
  return `${formatNumberForUi(value, 1)}%`;
}

function formatSkillRemainingPercent(value) {
  const numericValue = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(2);
}

function formatSkillDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours <= 0) {
    return `${minutes}min`;
  }

  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

function formatNumberForUi(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(Number(value) || 0);
}

function truncateDecimal(value, decimalPlaces = 2) {
  const factor = 10 ** decimalPlaces;
  const numericValue = Number(value) || 0;
  return Math.sign(numericValue) * Math.floor(Math.abs(numericValue) * factor) / factor;
}

function formatAbbreviatedNumberForUi(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  if (Math.abs(numericValue) < 1000000) {
    return formatNumberForUi(numericValue);
  }

  const kkCount = Math.max(2, Math.floor(Math.log10(Math.abs(numericValue)) / 3));
  const compactValue = truncateDecimal(numericValue / (1000 ** kkCount), 2);
  const hasDecimals = Math.abs(compactValue % 1) > 0;
  return `${formatNumberForUi(compactValue, hasDecimals ? 2 : 0)}${"k".repeat(kkCount)}`;
}

function formatCurrencyText(value, unit = "", options = {}) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  const formattedValue = options.abbreviated === false || Math.abs(numericValue) < 1000000
    ? formatNumberForUi(numericValue, options.maximumFractionDigits || 0)
    : formatAbbreviatedNumberForUi(numericValue);
  return unit ? `${formattedValue} ${unit}` : formattedValue;
}

function renderCurrencyValue(value, unit = "", options = {}) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  const shortText = formatCurrencyText(numericValue, unit, options);
  const fullText = formatCurrencyText(numericValue, unit, {
    abbreviated: false,
    maximumFractionDigits: options.fullMaximumFractionDigits || options.maximumFractionDigits || 0
  });

  if (shortText === fullText) {
    return escapeHtml(shortText);
  }

  return `<span class="currency-value" data-tooltip="${escapeHtml(fullText)}">${escapeHtml(shortText)}</span>`;
}

function getConvertedCurrencyData(value, mode, rates, fallbackTcPrice = null) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const tibiaCoinPrice = rates?.tibiaCoinPrice ?? fallbackTcPrice;
  const goldTokenPrice = rates?.goldTokenPrice ?? null;

  if (mode === "tc") {
    if (!tibiaCoinPrice) {
      return null;
    }

    return { value: numericValue / tibiaCoinPrice, unit: "TC", maximumFractionDigits: 2 };
  }

  if (mode === "gt") {
    if (!goldTokenPrice) {
      return null;
    }

    return { value: numericValue / goldTokenPrice, unit: "GT", maximumFractionDigits: 2 };
  }

  return { value: numericValue, unit: "gold", maximumFractionDigits: 0 };
}

function formatConvertedCurrencyText(value, mode, rates, fallbackTcPrice = null) {
  const converted = getConvertedCurrencyData(value, mode, rates, fallbackTcPrice);

  if (!converted) {
    return "-";
  }

  return formatCurrencyText(converted.value, converted.unit, {
    maximumFractionDigits: converted.maximumFractionDigits
  });
}

function renderConvertedCurrencyValue(value, mode, rates, fallbackTcPrice = null) {
  const converted = getConvertedCurrencyData(value, mode, rates, fallbackTcPrice);

  if (!converted) {
    return "-";
  }

  return renderCurrencyValue(converted.value, converted.unit, {
    maximumFractionDigits: converted.maximumFractionDigits,
    fullMaximumFractionDigits: converted.maximumFractionDigits
  });
}

function setCurrencyElement(element, value, unit = "", options = {}) {
  if (!element) {
    return;
  }

  element.innerHTML = renderCurrencyValue(value, unit, options);
  bindSkillDynamicTooltips(element);
}

function formatGoldValue(value) {
  return renderCurrencyValue(value, "gold");
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function clampDecimal(value, min, max, fallback) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const clamped = Math.min(Math.max(parsed, min), max);
  return Math.round(clamped * 100) / 100;
}

function syncWheelOfDestinyLocale(locale = state.localeController?.getLocale?.() || "pt-BR") {
  els.wheelOfDestinyFrame?.contentWindow?.postMessage({
    type: "tibia-toolkit-wheel-locale",
    locale
  }, "*");
}

function getToolGroup(tab) {
  if (tab === "imbuement" || tab === "skill-calculator") {
    return "calculators";
  }
  if (tab === "loot-splitter" || tab === "find-party") {
    return "hunting";
  }
  return tab;
}

function syncToolNavigation() {
  const activeGroup = getToolGroup(state.selectedToolTab);

  els.toolTabs.forEach((button) => {
    const isGroupTab = button.dataset.toolGroupTab === "true";
    const isActive = isGroupTab
      ? button.dataset.toolGroup === activeGroup
      : button.dataset.toolTab === state.selectedToolTab
        && (!button.dataset.lootMode || button.dataset.lootMode === state.lootMode);
    button.classList.toggle("active", isActive);
  });

  els.toolSubnavs.forEach((subnav) => {
    subnav.classList.toggle("hidden", subnav.dataset.toolSubnav !== activeGroup);
  });
}

function setToolTab(tab, options = {}) {
  const validTabs = new Set(["imbuement", "loot-splitter", "find-party", "skill-calculator", "wheel-of-destiny", "screen-vision"]);
  const nextTab = validTabs.has(tab) ? tab : "imbuement";

  if (state.selectedToolTab === "loot-splitter" && nextTab !== "loot-splitter") {
    cancelLootVisualHydration();
  }

  if (nextTab !== state.selectedToolTab && !options.skipHistory && !state.navigationRestoring) {
    pushCurrentNavigationEntry();
  }

  state.selectedToolTab = nextTab;
  syncMirrorGameSelectorVisibility();
  const tabOpenedAt = performance.now();

  syncToolNavigation();

  els.toolPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.toolPanel !== nextTab);
    panel.classList.toggle("active", panel.dataset.toolPanel === nextTab);
  });

  if (nextTab === "loot-splitter") {
    if (getActiveLootAnalyzerText().trim()) {
      parseAndRenderLootSplitter();
    } else {
      renderLootSplitter();
    }
  }

  if (nextTab === "skill-calculator") {
    renderSkillCalculator();
  }

  if (nextTab === "find-party") {
    renderFindParty();
  }

  if (nextTab === "wheel-of-destiny") {
    syncWheelOfDestinyLocale();
  }

  if (state.selectedSection === "tools") {
    scheduleActiveToolLiveDataLoad();
  }

  setCurrentNavigationEntry(getCurrentSectionNavigationEntry());
  void recordPerformanceMetric("tool-tab-opened", {
    tab: nextTab,
    elapsedMs: Math.round(performance.now() - tabOpenedAt)
  });
}

function scheduleActiveToolLiveDataLoad() {
  if (state.activeToolLiveDataTimer) {
    window.clearTimeout(state.activeToolLiveDataTimer);
  }

  state.activeToolLiveDataTimer = window.setTimeout(() => {
    state.activeToolLiveDataTimer = null;
    if (state.selectedSection !== "tools") {
      return;
    }

    if (state.selectedToolTab === "imbuement") {
      void refreshImbuementWorldData().catch(() => {});
      return;
    }

    if (state.selectedToolTab === "skill-calculator") {
      renderSkillCalculator();
      return;
    }

    if (state.selectedToolTab === "find-party") {
      void ensureFindPartySnapshot({ force: true });
    }
  }, 0);
}

async function ensureFindPartySnapshot(options = {}) {
  const force = options.force === true;
  const selectedWorld = getSelectedWorld();

  if (!selectedWorld?.slug) {
    return;
  }

  if (
    !force &&
    !state.findPartyLoading &&
    state.findPartyLoadedWorldSlug === selectedWorld.slug &&
    state.findPartyWorldName &&
    !state.findPartyFeedbackIsError
  ) {
    renderFindParty();
    return;
  }

  const requestId = ++state.findPartyRequestId;
  state.findPartyLoading = true;
  if (!state.findPartyCharacterName && state.findPartyFeedbackIsError) {
    setFindPartyFeedback("");
  }
  renderFindParty();

  try {
    const snapshot = await fetchFindPartySnapshot({
      worldSlug: selectedWorld.slug,
      force
    });

    if (requestId !== state.findPartyRequestId || state.currentWorldSlug !== selectedWorld.slug) {
      return;
    }

    state.findPartyPlayers = Array.isArray(snapshot?.players) ? snapshot.players : [];
    state.findPartyGuilds = Array.isArray(snapshot?.guilds) ? snapshot.guilds : [];
    state.findPartyWorldName = snapshot?.world?.name || selectedWorld.name;
    state.findPartyLoadedWorldSlug = snapshot?.world?.slug || selectedWorld.slug;
    state.findPartySelectedGuilds = state.findPartySelectedGuilds.filter((guildName) =>
      state.findPartyGuilds.includes(guildName)
    );

    if (state.findPartySelectedGuilds.length > 0) {
      await ensureFindPartyBlockedGuildMembers();
    } else {
      state.findPartyBlockedGuildMemberNames = [];
      state.findPartyGuildMembersByName = {};
    }

    if (!state.findPartyCharacterName) {
      setFindPartyFeedback("");
    }
  } catch (error) {
    if (requestId !== state.findPartyRequestId) {
      return;
    }

    state.findPartyPlayers = [];
    state.findPartyGuilds = [];
    state.findPartyWorldName = selectedWorld.name || "";
    state.findPartyLoadedWorldSlug = selectedWorld.slug || "";
    setFindPartyFeedback(error instanceof Error ? error.message : t("findParty.loadFailed"), true);
  } finally {
    if (requestId === state.findPartyRequestId) {
      state.findPartyLoading = false;
      renderFindParty();
    }
  }
}

async function ensureFindPartyBlockedGuildMembers() {
  const guildNames = [...state.findPartySelectedGuilds];

  if (guildNames.length === 0) {
    state.findPartyBlockedGuildMemberNames = [];
    state.findPartyGuildMembersByName = {};
    renderFindParty();
    return;
  }

  const requestId = ++state.findPartyGuildMemberRequestId;

  try {
    const response = await fetchFindPartyGuildMembers({
      guildNames
    });

    if (requestId !== state.findPartyGuildMemberRequestId) {
      return;
    }

    state.findPartyGuildMembersByName = response?.guilds || {};
    state.findPartyBlockedGuildMemberNames = Array.isArray(response?.memberNames) ? response.memberNames : [];
  } catch (_error) {
    if (requestId !== state.findPartyGuildMemberRequestId) {
      return;
    }

    state.findPartyGuildMembersByName = {};
    state.findPartyBlockedGuildMemberNames = [];
  }

  renderFindParty();
}

async function resolveFindPartyReferenceCharacter() {
  const name = state.findPartyCharacterName.trim();

  if (!name) {
    state.findPartyCharacterProfile = null;
    setFindPartyFeedback("");
    renderFindParty();
    return;
  }

  const requestId = ++state.findPartyCharacterLookupRequestId;
  setFindPartyFeedback("Consultando personagem...");
  renderFindParty();

  try {
    const profiles = await fetchCharacterProfiles({
      names: [name]
    });

    if (requestId !== state.findPartyCharacterLookupRequestId || state.findPartyCharacterName.trim() !== name) {
      return;
    }

    const profile = profiles?.[name] || null;

    if (!profile?.level) {
      state.findPartyCharacterProfile = null;
      setFindPartyFeedback("Personagem não encontrado.", true);
      renderFindParty();
      return;
    }

    state.findPartyCharacterProfile = profile;
    setFindPartyFeedback("");
  } catch (_error) {
    if (requestId !== state.findPartyCharacterLookupRequestId) {
      return;
    }

    state.findPartyCharacterProfile = null;
    setFindPartyFeedback("Falha ao consultar personagem.", true);
  }

  renderFindParty();
}

function clearFindPartyFilters() {
  state.findPartyVocation = "";
  state.findPartyCharacterName = "";
  state.findPartyCharacterProfile = null;
  state.findPartyGuildQuery = "";
  state.findPartySelectedGuilds = [];
  state.findPartyBlockedGuildMemberNames = [];
  state.findPartyGuildMembersByName = {};
  state.findPartyPage = 1;

  if (state.findPartyCharacterLookupTimer) {
    window.clearTimeout(state.findPartyCharacterLookupTimer);
    state.findPartyCharacterLookupTimer = null;
  }

  closeFindPartyGuildSuggestions();
  setFindPartyFeedback("");
  renderFindParty();
}

function addFindPartyGuildFilter(guildName) {
  const name = String(guildName || "").trim();

  if (!name || state.findPartySelectedGuilds.includes(name)) {
    closeFindPartyGuildSuggestions();
    renderFindParty();
    return;
  }

  state.findPartySelectedGuilds = [...state.findPartySelectedGuilds, name];
  state.findPartyGuildQuery = "";
  state.findPartyPage = 1;
  closeFindPartyGuildSuggestions();
  renderFindParty();
  void ensureFindPartyBlockedGuildMembers();
}

function removeFindPartyGuildFilter(guildName) {
  const name = String(guildName || "").trim();

  if (!name) {
    return;
  }

  state.findPartySelectedGuilds = state.findPartySelectedGuilds.filter((entry) => entry !== name);
  state.findPartyPage = 1;

  if (state.findPartySelectedGuilds.length === 0) {
    state.findPartyBlockedGuildMemberNames = [];
    state.findPartyGuildMembersByName = {};
    renderFindParty();
    return;
  }

  renderFindParty();
  void ensureFindPartyBlockedGuildMembers();
}

function buildFindPartyGuildSuggestions(options = {}) {
  const query = normalizeSearchText(state.findPartyGuildQuery);
  const selectedGuilds = new Set(state.findPartySelectedGuilds);
  const showAll = options.showAll === true;

  return state.findPartyGuilds
    .filter((guildName) => !selectedGuilds.has(guildName))
    .filter((guildName) => showAll || !query || normalizeSearchText(guildName).includes(query))
    .slice(0, showAll ? 60 : 24);
}

function renderFindPartyGuildSuggestions(options = {}) {
  const query = state.findPartyGuildQuery.trim();
  const showAll = options.showAll === true;

  if (!showAll && !query) {
    closeFindPartyGuildSuggestions();
    return;
  }

  state.findPartyGuildSuggestions = buildFindPartyGuildSuggestions({ showAll });
  state.findPartyGuildSuggestionsOpen = state.findPartyGuildSuggestions.length > 0;
  state.activeFindPartyGuildSuggestionIndex = state.findPartyGuildSuggestions.length > 0 ? 0 : -1;
  paintFindPartyGuildSuggestions();
}

function paintFindPartyGuildSuggestions() {
  if (!els.findPartyGuildSuggestions) {
    return;
  }

  if (!state.findPartyGuildSuggestionsOpen || state.findPartyGuildSuggestions.length === 0) {
    els.findPartyGuildSuggestions.innerHTML = "";
    els.findPartyGuildSuggestions.classList.add("hidden");
    els.findPartyGuildDropdownButton?.classList.remove("open");
    return;
  }

  els.findPartyGuildSuggestions.innerHTML = normalizeUiText(
    state.findPartyGuildSuggestions
      .map((guildName, index) => {
        const activeClass = index === state.activeFindPartyGuildSuggestionIndex ? " active" : "";
        return `
          <button type="button" class="suggestion-button world-suggestion-button${activeClass}" data-find-party-guild-name="${escapeHtml(guildName)}">
            <div class="suggestion-meta world-suggestion-meta">
              <strong>${escapeHtml(guildName)}</strong>
              <div class="world-suggestion-line">
                <span>Guilda do mundo atual</span>
              </div>
            </div>
          </button>
        `;
      })
      .join("")
  );

  showSuggestionsPanel(els.findPartyGuildSuggestions);
  els.findPartyGuildDropdownButton?.classList.add("open");
  bindSkillDynamicTooltips(els.findPartyGuildSuggestions);
}

function closeFindPartyGuildSuggestions() {
  state.findPartyGuildSuggestions = [];
  state.findPartyGuildSuggestionsOpen = false;
  state.activeFindPartyGuildSuggestionIndex = -1;
  hideSuggestionsPanel(els.findPartyGuildSuggestions);
  els.findPartyGuildDropdownButton?.classList.remove("open");
}

function handleFindPartyGuildInputKeydown(event) {
  if (!state.findPartyGuildSuggestionsOpen || state.findPartyGuildSuggestions.length === 0) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      renderFindPartyGuildSuggestions({ showAll: true });
    } else if (event.key === "Escape") {
      closeFindPartyGuildSuggestions();
    }
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.activeFindPartyGuildSuggestionIndex =
      (state.activeFindPartyGuildSuggestionIndex + 1) % state.findPartyGuildSuggestions.length;
    paintFindPartyGuildSuggestions();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.activeFindPartyGuildSuggestionIndex =
      (state.activeFindPartyGuildSuggestionIndex - 1 + state.findPartyGuildSuggestions.length) %
      state.findPartyGuildSuggestions.length;
    paintFindPartyGuildSuggestions();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const exactMatch = state.findPartyGuildSuggestions.find(
      (guildName) => normalizeSearchText(guildName) === normalizeSearchText(state.findPartyGuildQuery)
    );
    const guildName =
      exactMatch || state.findPartyGuildSuggestions[state.activeFindPartyGuildSuggestionIndex] || "";

    if (guildName) {
      addFindPartyGuildFilter(guildName);
    }
    return;
  }

  if (event.key === "Escape") {
    closeFindPartyGuildSuggestions();
  }
}

function getFindPartyLevelRange(level) {
  const numericLevel = Number(level);

  if (!Number.isFinite(numericLevel) || numericLevel <= 0) {
    return {
      min: null,
      max: null,
      label: "-"
    };
  }

  const min = Math.ceil((numericLevel * 2) / 3);
  const max = Math.floor((numericLevel * 3) / 2);

  return {
    min,
    max,
    label: `${min} - ${max}`
  };
}

function canFindPartyShareWith(referenceLevel, candidateLevel) {
  const range = getFindPartyLevelRange(referenceLevel);
  const numericCandidateLevel = Number(candidateLevel);

  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || !Number.isFinite(numericCandidateLevel)) {
    return true;
  }

  return numericCandidateLevel >= range.min && numericCandidateLevel <= range.max;
}

function normalizeFindPartyVocationKey(vocation) {
  const normalized = String(vocation || "").toLowerCase().replace(/[^a-z]/g, "");

  if (normalized.includes("knight")) return "knight";
  if (normalized.includes("paladin")) return "paladin";
  if (normalized.includes("druid")) return "druid";
  if (normalized.includes("sorcerer")) return "sorcerer";
  if (normalized.includes("monk")) return "monk";
  return "";
}

function createFindPartyTutorialFallback() {
  return {
    guilds: ["Adventurers United", "Hunt Companions", "Tibia Explorers"],
    players: [
      { name: "Elder Tavia", world: "Antica", level: 480, vocation: "Elder Druid" },
      { name: "Druid Lyria", world: "Antica", level: 510, vocation: "Elder Druid" },
      { name: "Nature Mender", world: "Antica", level: 445, vocation: "Druid" },
      { name: "Arcane Friend", world: "Antica", level: 505, vocation: "Master Sorcerer" }
    ]
  };
}

function getFindPartyFilteredPlayers() {
  if (state.findPartyCharacterName && !state.findPartyCharacterProfile) {
    return [];
  }

  const selectedVocation = state.findPartyVocation;
  const blockedNames = new Set(
    state.findPartyBlockedGuildMemberNames.map((name) => normalizeSearchText(name))
  );
  const referenceLevel = state.findPartyCharacterProfile?.level || null;
  const referenceName = normalizeSearchText(state.findPartyCharacterProfile?.name || state.findPartyCharacterName);

  const filteredPlayers = state.findPartyPlayers
    .filter((player) => {
      const vocationKey = normalizeFindPartyVocationKey(player.vocation);

      if (!vocationKey) {
        return false;
      }

      if (selectedVocation && vocationKey !== selectedVocation) {
        return false;
      }

      if (referenceName && normalizeSearchText(player.name) === referenceName) {
        return false;
      }

      if (blockedNames.has(normalizeSearchText(player.name))) {
        return false;
      }

      if (referenceLevel && !canFindPartyShareWith(referenceLevel, player.level)) {
        return false;
      }

      return true;
    });

  return filteredPlayers.sort((left, right) => {
    if (state.findPartySortMode === "name") {
      const comparison = left.name.localeCompare(right.name);
      return state.findPartySortDirection === "desc" ? -comparison : comparison;
    }

    if ((right.level || 0) !== (left.level || 0)) {
      const comparison = (right.level || 0) - (left.level || 0);
      return state.findPartySortDirection === "asc" ? -comparison : comparison;
    }

    return left.name.localeCompare(right.name);
  });
}

function getFindPartyTotalPages() {
  const totalItems = getFindPartyFilteredPlayers().length;
  return Math.max(1, Math.ceil(totalItems / Math.max(state.findPartyPageSize, 1)));
}

function renderFindParty() {
  if (!els.findPartyResults) {
    return;
  }

  if (els.findPartyVocationSelect) {
    els.findPartyVocationSelect.value = state.findPartyVocation;
  }

  if (els.findPartyCharacterInput && els.findPartyCharacterInput.value !== state.findPartyCharacterName) {
    els.findPartyCharacterInput.value = state.findPartyCharacterName;
  }

  if (els.findPartyGuildInput && els.findPartyGuildInput.value !== state.findPartyGuildQuery) {
    els.findPartyGuildInput.value = state.findPartyGuildQuery;
  }

  if (els.findPartyPageSizeSelect) {
    els.findPartyPageSizeSelect.value = String(state.findPartyPageSize);
  }

  els.findPartyVocationButtons?.forEach((button) => {
    button.classList.toggle("active", button.dataset.findPartyVocation === state.findPartyVocation);
  });

  els.findPartySortNameButton?.classList.toggle("active", state.findPartySortMode === "name");
  els.findPartySortLevelButton?.classList.toggle("active", state.findPartySortMode === "level");
  els.findPartySortNameButton?.setAttribute("aria-pressed", state.findPartySortMode === "name" ? "true" : "false");
  els.findPartySortLevelButton?.setAttribute("aria-pressed", state.findPartySortMode === "level" ? "true" : "false");

  if (els.findPartyGuildChips) {
    els.findPartyGuildChips.innerHTML = normalizeUiText(
      state.findPartySelectedGuilds
        .map((guildName) => `
          <button type="button" class="entity-chip find-party-guild-chip" data-find-party-remove-guild="${escapeHtml(guildName)}" aria-label="Remover guilda ${escapeHtml(guildName)}">
            <small>Guilda</small>
            <strong>${escapeHtml(guildName)}</strong>
            <span class="find-party-guild-chip-remove" aria-hidden="true">×</span>
          </button>
        `)
        .join("")
    );
  }

  paintFindPartyGuildSuggestions();

  const range = getFindPartyLevelRange(state.findPartyCharacterProfile?.level);
  if (els.findPartyLevelRange) {
    els.findPartyLevelRange.textContent = range.label;
  }

  const totalOnline = state.findPartyPlayers.length;
  const filteredPlayers = getFindPartyFilteredPlayers();
  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / Math.max(state.findPartyPageSize, 1)));
  state.findPartyPage = Math.min(Math.max(state.findPartyPage, 1), totalPages);
  const startIndex = (state.findPartyPage - 1) * state.findPartyPageSize;
  const visiblePlayers = filteredPlayers.slice(startIndex, startIndex + state.findPartyPageSize);

  if (els.findPartyStatusBadge) {
    els.findPartyStatusBadge.textContent = state.findPartyLoading
      ? "Carregando..."
      : `${totalOnline} online`;
  }

  if (els.findPartyFeedback) {
    els.findPartyFeedback.textContent = normalizeUiText(state.findPartyFeedbackMessage);
    els.findPartyFeedback.classList.toggle("hidden", !state.findPartyFeedbackMessage);
    els.findPartyFeedback.classList.toggle("error-text", Boolean(state.findPartyFeedbackMessage && state.findPartyFeedbackIsError));
  }

  if (els.findPartyResultsSummary) {
    const worldName = state.findPartyWorldName || getSelectedWorld()?.name || "-";
    const rangeSuffix = range.label !== "-" ? ` | share ${range.label}` : "";
    const loadingSuffix = state.findPartyLoading && totalOnline === 0 ? " | carregando..." : "";
    els.findPartyResultsSummary.textContent = normalizeUiText(
      `${worldName} | ${filteredPlayers.length} após filtros${rangeSuffix}${loadingSuffix}`
    );
  }

  if (state.findPartyLoading && totalOnline === 0) {
    els.findPartyResults.innerHTML = `<div class="empty-inline">Carregando personagens do mundo...</div>`;
  } else if (visiblePlayers.length === 0) {
    const emptyMessage = state.findPartyFeedbackIsError && !totalOnline
      ? state.findPartyFeedbackMessage
      : "Nenhum personagem encontrado com os filtros atuais.";
    els.findPartyResults.innerHTML = `<div class="empty-inline">${escapeHtml(normalizeUiText(emptyMessage))}</div>`;
  } else {
    els.findPartyResults.innerHTML = normalizeUiText(
      visiblePlayers
        .map((player) => {
          const imageSrc = getVocationOutfitPath(player.vocation, "") || "assets/ui/tools/tibia-eye/profiles/no-vocation.png";
          const levelLabel = Number(player.level || 0).toLocaleString("pt-BR");
          return `
            <div class="find-party-result-card">
              <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(player.vocation || "Vocação")}">
              <div class="find-party-result-copy">
                <strong>${escapeHtml(player.name)}</strong>
                <span>${escapeHtml(player.world || state.findPartyWorldName || "")}</span>
              </div>
              <div class="find-party-result-side">
                <strong class="find-party-result-level">${escapeHtml(levelLabel)}</strong>
                <button type="button" class="imbuement-copy-button" data-find-party-copy-name="${escapeHtml(player.name)}" data-tooltip="Copiar nome" aria-label="Copiar nome de ${escapeHtml(player.name)}">
                  <span class="copy-sprite-stack" aria-hidden="true">
                    <img class="copy-sprite-icon copy-sprite-icon-off" src="assets/ui/copy/copiar-off.png" alt="">
                    <img class="copy-sprite-icon copy-sprite-icon-hover" src="assets/ui/copy/copiar-hover.png" alt="">
                    <img class="copy-sprite-icon copy-sprite-icon-on" src="assets/ui/copy/copiar-on.png" alt="">
                  </span>
                </button>
              </div>
            </div>
          `;
        })
        .join("")
    );
    bindSkillDynamicTooltips(els.findPartyResults);
  }

  if (els.findPartyPrevPageButton) {
    els.findPartyPrevPageButton.disabled = state.findPartyPage <= 1;
  }

  if (els.findPartyNextPageButton) {
    els.findPartyNextPageButton.disabled = state.findPartyPage >= totalPages;
  }

  if (els.findPartyPageIndicator) {
    els.findPartyPageIndicator.textContent = `${state.findPartyPage} / ${totalPages}`;
  }
}

function setFindPartyFeedback(message, isError = false) {
  state.findPartyFeedbackMessage = String(message || "").trim();
  state.findPartyFeedbackIsError = Boolean(state.findPartyFeedbackMessage && isError);
}

async function copyFindPartyCharacterName(button) {
  const name = button?.dataset?.findPartyCopyName || "";

  if (!name) {
    return;
  }

  button.dataset.copyState = "loading";

  try {
    await copyTextToClipboard(name);
    button.dataset.copyState = "done";
    button.dataset.tooltip = t("common.copied");
  } catch (_error) {
    button.dataset.copyState = "";
    button.dataset.tooltip = t("common.copyName");
    return;
  }

  window.setTimeout(() => {
    if (button.dataset.copyState === "done") {
      button.dataset.copyState = "";
      button.dataset.tooltip = t("common.copyName");
    }
  }, 1200);
}

function resetLootSplitter() {
  if (state.lootSoloMarketLoading) {
    cancelSoloLootMarketLoading({ silent: true, rerender: false });
  }

  if (state.lootMode === "solo") {
    state.lootSoloAnalyzerText = "";
    state.lootSoloCharacterName = "";
    state.lootSoloProfile = null;
  } else {
    state.lootPartyAnalyzerText = "";
  }
  state.lootAnalyzerText = getActiveLootAnalyzerText();
  state.lootParsed = null;
  state.lootManualPrices = {};
  state.lootItemHydrationRequestId += 1;
  state.lootMonsterHydrationRequestId += 1;

  if (els.lootInput) {
    els.lootInput.value = "";
  }
  if (state.lootMode === "solo" && els.lootCharacterInput) {
    els.lootCharacterInput.value = "";
  }

  void saveLootAnalyzerDrafts();
  renderLootSplitter();
}

function parseAndRenderLootSplitter() {
  const renderStartedAt = performance.now();
  state.lootAnalyzerText = getActiveLootAnalyzerText();
  const parsed = state.lootMode === "solo"
    ? parseSoloHuntAnalyzerText(getActiveLootAnalyzerText())
    : parseLootAnalyzerText(getActiveLootAnalyzerText());
  state.lootParsed = parsed;
  applySoloLootPricing(parsed);
  renderLootSplitter();
  if (state.lootMode === "solo") {
    void recordPerformanceMetric("solo-loot-initial-rendered", {
      elapsedMs: Math.round(performance.now() - renderStartedAt),
      itemCount: parsed?.items?.length || 0,
      monsterCount: parsed?.monsters?.length || 0
    });
  }

  const itemHydrationPromise = hydrateLootParsedItems(parsed);
  if (state.lootMode === "solo") {
    void itemHydrationPromise.then((completed) => recordPerformanceMetric(
      completed === false ? "solo-loot-items-hydration-cancelled" : "solo-loot-items-hydrated",
      {
      elapsedMs: Math.round(performance.now() - renderStartedAt),
      itemCount: state.lootParsed?.items?.length || 0
      }
    ));
  }
  void itemHydrationPromise;
  const monsterHydrationPromise = hydrateLootParsedMonsters(parsed);
  if (state.lootMode === "solo") {
    void monsterHydrationPromise.then(() => recordPerformanceMetric("solo-loot-monsters-hydrated", {
      elapsedMs: Math.round(performance.now() - renderStartedAt),
      monsterCount: state.lootParsed?.monsters?.length || 0
    }));
  }
  void monsterHydrationPromise;

  if (state.lootMode === "solo") {
    void enrichSoloLootProfile(parsed);
  } else {
    void enrichLootPlayerProfiles(parsed);
  }

  return itemHydrationPromise;
}

function cancelSoloLootMarketLoading(options = {}) {
  const silent = options?.silent === true;
  const rerender = options?.rerender !== false;

  state.lootSoloMarketRefreshRequestId += 1;
  state.lootSoloMarketLoading = false;
  state.lootItemHydrationRequestId += 1;

  setGlobalLoadingAction(null);
  hideGlobalLoading();

  if (!state.lootSoloUseMarket && rerender) {
    parseAndRenderLootSplitter();
  }

  if (!silent) {
    setLootFeedback("Atualizacao com valores de market interrompida.", true);
  }
}

async function refreshSoloLootMarketPricing() {
  if (state.lootSoloMarketLoading) {
    return;
  }

  const activeText = getActiveLootAnalyzerText().trim();
  if (!activeText || state.lootMode !== "solo") {
    void saveLootAnalyzerDrafts();
    parseAndRenderLootSplitter();
    return;
  }

  const requestId = ++state.lootSoloMarketRefreshRequestId;
  state.lootSoloMarketLoading = true;
  void saveLootAnalyzerDrafts();

  setGlobalLoadingAction({
    tooltip: "Interromper Carregamento",
    onClick: () => {
      state.lootSoloUseMarket = false;
      if (els.lootAutoModeToggle) {
        els.lootAutoModeToggle.checked = false;
      }
      void saveLootAnalyzerDrafts();
      cancelSoloLootMarketLoading();
    }
  });
  showGlobalLoading("Atualizando com valores do Market...");

  try {
    await Promise.resolve(parseAndRenderLootSplitter());
    if (requestId !== state.lootSoloMarketRefreshRequestId) {
      return;
    }
  } catch (_error) {
    if (requestId !== state.lootSoloMarketRefreshRequestId) {
      return;
    }
  } finally {
    if (requestId === state.lootSoloMarketRefreshRequestId) {
      state.lootSoloMarketLoading = false;
      setGlobalLoadingAction(null);
      hideGlobalLoading();
    }
  }
}

function setLootMode(mode) {
  if (state.lootSoloMarketLoading) {
    cancelSoloLootMarketLoading({ silent: true, rerender: false });
  }

  state.lootMode = mode === "solo" ? "solo" : "party";
  document.querySelector('[data-tool-panel="loot-splitter"]')?.classList.toggle(
    "loot-solo-mode",
    state.lootMode === "solo"
  );
  state.lootParsed = null;
  state.lootProfileRequestId += 1;
  state.lootItemHydrationRequestId += 1;
  state.lootMonsterHydrationRequestId += 1;
  state.lootAnalyzerText = getActiveLootAnalyzerText();

  els.lootSubtabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.lootMode === state.lootMode);
  });
  syncToolNavigation();

  if (els.lootInputLabel) {
    els.lootInputLabel.textContent = state.lootMode === "solo"
      ? t("tools.soloAnalyzerInputLabel")
      : t("tools.analyzerInputLabel");
  }

  if (els.lootInput) {
    els.lootInput.placeholder = state.lootMode === "solo"
      ? t("tools.soloAnalyzerInputPlaceholder")
      : t("tools.analyzerInputPlaceholder");
    els.lootInput.value = getActiveLootAnalyzerText();
  }

  els.lootCharacterField?.classList.toggle("hidden", state.lootMode !== "solo");
  parseAndRenderLootSplitter();
}

function getActiveLootAnalyzerText() {
  return state.lootMode === "solo" ? state.lootSoloAnalyzerText : state.lootPartyAnalyzerText;
}

function setActiveLootAnalyzerText(value) {
  const text = String(value || "");

  if (state.lootMode === "solo") {
    state.lootSoloAnalyzerText = text;
  } else {
    state.lootPartyAnalyzerText = text;
  }

  state.lootAnalyzerText = text;
}

async function loadLootAnalyzerDrafts() {
  const stored = await localStorageGet(LOOT_ANALYZER_DRAFTS_KEY).catch(() => ({}));
  const fallbackDrafts = readLootAnalyzerDraftsFallback();
  const storedDrafts = stored?.[LOOT_ANALYZER_DRAFTS_KEY];
  const drafts = (storedDrafts && typeof storedDrafts === "object")
    ? {
        ...fallbackDrafts,
        ...storedDrafts
      }
    : fallbackDrafts;

  state.lootPartyAnalyzerText = typeof drafts.party === "string" ? drafts.party : "";
  state.lootSoloAnalyzerText = typeof drafts.solo === "string" ? drafts.solo : "";
  state.lootSoloCharacterName =
    typeof drafts.soloCharacterName === "string" ? drafts.soloCharacterName : "";
  state.lootSoloUseMarket = Boolean(drafts.soloUseMarket);
  state.lootSoloDoubleXp = Boolean(drafts.soloDoubleXp);
  state.lootSoloDoubleLoot = Boolean(drafts.soloDoubleLoot);
  state.lootAnalyzerText = getActiveLootAnalyzerText();

  if (els.lootInput) {
    els.lootInput.value = state.lootAnalyzerText;
  }

  if (els.lootCharacterInput) {
    els.lootCharacterInput.value = state.lootSoloCharacterName;
  }

  if (els.lootDoubleXpToggle) {
    els.lootDoubleXpToggle.checked = state.lootSoloDoubleXp;
  }

  if (els.lootDoubleLootToggle) {
    els.lootDoubleLootToggle.checked = state.lootSoloDoubleLoot;
  }

  if (els.lootAutoModeToggle) {
    els.lootAutoModeToggle.checked = state.lootSoloUseMarket;
  }
}

async function loadOverlayToolsState() {
  const stored = await localStorageGet(OVERLAY_TOOLS_STORAGE_KEY).catch(() => ({}));
  const savedState = stored?.[OVERLAY_TOOLS_STORAGE_KEY] || null;
  const normalized = normalizeOverlayToolsState(savedState);

  state.overlayTools = normalized;

  if (!savedState) {
    await saveOverlayToolsState();
  }
}

async function saveOverlayToolsState() {
  const snapshot = cloneOverlayToolsStateForSave(state.overlayTools);
  state.overlayTools = snapshot;

  await localStorageSet({
    [OVERLAY_TOOLS_STORAGE_KEY]: snapshot
  }).catch(() => {});
}

async function handleTimerSave() {
  const draft = readTimerDraftFromInputs();

  if (!draft.name.trim()) {
    setTimerFeedback("Informe um nome para o timer.", true);
    return;
  }

  const existingTimer = state.timerEditingId
    ? state.overlayTools.timers.items.find((item) => item.id === state.timerEditingId)
    : null;
  const entry = createOverlayTimerEntryFromDraft(draft, {
    id: existingTimer?.id || undefined,
    enabled: existingTimer?.enabled !== false,
    createdAt: existingTimer?.createdAt || undefined
  });

  state.overlayTools.timers.items = [
    entry,
    ...state.overlayTools.timers.items.filter((item) => item.id !== entry.id)
  ];
  state.overlayTools.timers.draft = createDefaultOverlayTimerDraft();
  state.timerEditingId = null;
  await saveOverlayToolsState();
  renderTimerDraft();
  renderTimerTool();
  setTimerFeedback(existingTimer ? "Timer atualizado." : "Timer salvo.", false);
}

function readTimerDraftFromInputs() {
  return {
    name: els.timerNameInput?.value || "",
    durationSeconds: els.timerDurationInput?.value || 60,
    soundKey: els.timerSoundSelect?.value || "default",
    customSoundPath: "",
    volumePercent: els.timerVolumeInput?.value || 100,
    showVisualAlert: Boolean(els.timerVisualAlertToggle?.checked),
    repeatEnabled: Boolean(els.timerRepeatToggle?.checked),
    hotkey: {
      code: "",
      modifiers: []
    }
  };
}

function renderTimerDraft() {
  const draft = state.overlayTools.timers.draft || createDefaultOverlayTimerDraft();

  if (els.timerFormTitle) {
    els.timerFormTitle.textContent = state.timerEditingId ? t("timers.editTitle") : t("timers.newTitle");
  }

  if (els.timerNameInput) {
    els.timerNameInput.value = draft.name || "";
  }

  if (els.timerDurationInput) {
    els.timerDurationInput.value = String(draft.durationSeconds ?? 60);
  }

  if (els.timerVolumeInput) {
    els.timerVolumeInput.value = String(draft.volumePercent ?? 100);
  }

  if (els.timerSoundSelect) {
    els.timerSoundSelect.value = draft.soundKey || "default";
  }

  if (els.timerVisualAlertToggle) {
    els.timerVisualAlertToggle.checked = draft.showVisualAlert !== false;
  }

  if (els.timerRepeatToggle) {
    els.timerRepeatToggle.checked = Boolean(draft.repeatEnabled);
  }

  if (els.timerSaveButton) {
    els.timerSaveButton.textContent = state.timerEditingId ? t("timers.update") : t("timers.save");
  }
}

function renderTimerFilterTabs() {
  els.timerFilterTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.timerFilter === state.timerFilter);
  });
}

function renderTimerTool() {
  if (!els.timerList) {
    return;
  }

  const timers = getVisibleTimers();
  const activeCount = Object.keys(state.timerRuntime.activeById).length;

  if (els.timerStatusBadge) {
    els.timerStatusBadge.textContent = `${activeCount} ativo${activeCount === 1 ? "" : "s"}`;
  }

  if (!timers.length) {
    els.timerList.innerHTML = `<div class="timer-empty">Nenhum timer salvo ainda. Cadastre o primeiro no painel ao lado.</div>`;
    return;
  }

  els.timerList.innerHTML = timers.map((timer) => renderTimerCard(timer)).join("");
}

function getVisibleTimers() {
  const allTimers = state.overlayTools.timers.items || [];

  if (state.timerFilter === "running") {
    return allTimers.filter((timer) => Boolean(state.timerRuntime.activeById[timer.id]));
  }

  return allTimers;
}

function renderTimerCard(timer) {
  const runtime = state.timerRuntime.activeById[timer.id] || null;
  const summary = getOverlayTimerSummary(timer);
  const remainingLabel = runtime
    ? formatOverlayTimerDuration(runtime.remainingSeconds)
    : formatOverlayTimerDuration(timer.durationSeconds);
  const statusClass = runtime?.finished ? " status-finished" : runtime ? " status-running" : "";
  const cardClass = runtime?.finished ? " finished" : runtime ? " running" : "";
  const statusLabel = runtime?.finished ? "Concluido" : runtime ? "Rodando" : "Pronto";

  return `
    <article class="timer-card${cardClass}">
      <div class="timer-card-header">
        <div>
          <strong>${escapeHtml(summary.label)}</strong>
          <div class="timer-card-subtitle">${escapeHtml(summary.subtitle)}</div>
        </div>
        <span class="timer-chip${statusClass}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="timer-chip-row">
        <span class="timer-chip">Tempo: ${escapeHtml(remainingLabel)}</span>
        <span class="timer-chip">Volume: ${escapeHtml(String(timer.volumePercent))}%</span>
        <span class="timer-chip">${timer.showVisualAlert ? "Visual ligado" : "Visual desligado"}</span>
        <span class="timer-chip">${timer.repeatEnabled ? "Repete" : "Sem repeticao"}</span>
      </div>
      <div class="timer-card-actions">
        ${runtime && !runtime.finished
          ? `<button type="button" class="currency-button" data-timer-action="stop" data-timer-id="${escapeHtml(timer.id)}">Parar</button>`
          : `<button type="button" class="primary-button" data-timer-action="start" data-timer-id="${escapeHtml(timer.id)}">Iniciar</button>`}
        <button type="button" class="currency-button" data-timer-action="edit" data-timer-id="${escapeHtml(timer.id)}">${escapeHtml(t("common.edit"))}</button>
        <button type="button" class="currency-button" data-timer-action="delete" data-timer-id="${escapeHtml(timer.id)}">${escapeHtml(t("common.delete"))}</button>
      </div>
    </article>
  `;
}

function resetTimerDraft() {
  state.overlayTools.timers.draft = createDefaultOverlayTimerDraft();
  state.timerEditingId = null;
  void saveOverlayToolsState();
  renderTimerDraft();
  setTimerFeedback("", false);
}

function loadTimerIntoDraft(timerId) {
  const timer = state.overlayTools.timers.items.find((entry) => entry.id === timerId);

  if (!timer) {
    return;
  }

  state.overlayTools.timers.draft = {
    name: timer.name || "",
    durationSeconds: timer.durationSeconds,
    soundKey: timer.soundKey || "default",
    customSoundPath: timer.customSoundPath || "",
    volumePercent: timer.volumePercent,
    showVisualAlert: timer.showVisualAlert !== false,
    repeatEnabled: Boolean(timer.repeatEnabled),
    hotkey: timer.hotkey || { code: "", modifiers: [] }
  };
  state.timerEditingId = timer.id;

  void saveOverlayToolsState();
  renderTimerDraft();
  setTimerFeedback(`Timer "${timer.name}" carregado no editor.`, false);
}

async function deleteOverlayTimer(timerId) {
  stopOverlayTimer(timerId);
  state.overlayTools.timers.items = state.overlayTools.timers.items.filter((entry) => entry.id !== timerId);
  await saveOverlayToolsState();
  renderTimerTool();
  setTimerFeedback("Timer removido.", false);
}

async function startOverlayTimer(timerId) {
  const timer = state.overlayTools.timers.items.find((entry) => entry.id === timerId);

  if (!timer) {
    return;
  }

  state.timerRuntime.activeById[timerId] = {
    startedAt: Date.now(),
    endsAt: Date.now() + (Number(timer.durationSeconds) || 60) * 1000,
    remainingSeconds: Number(timer.durationSeconds) || 60,
    finished: false
  };

  state.overlayTools.timers.lastTriggeredTimerId = timerId;
  await saveOverlayToolsState();
  ensureTimerTicker();
  renderTimerTool();
  setTimerFeedback(`Timer "${timer.name}" iniciado.`, false);
}

function stopOverlayTimer(timerId) {
  delete state.timerRuntime.activeById[timerId];
  cleanupTimerTickerIfIdle();
  renderTimerTool();
}

function ensureTimerTicker() {
  if (state.timerRuntime.tickHandle) {
    return;
  }

  state.timerRuntime.tickHandle = window.setInterval(() => {
    const now = Date.now();
    let changed = false;

    Object.entries(state.timerRuntime.activeById).forEach(([timerId, runtime]) => {
      const remainingSeconds = Math.max(0, Math.ceil((runtime.endsAt - now) / 1000));

      if (runtime.remainingSeconds !== remainingSeconds) {
        runtime.remainingSeconds = remainingSeconds;
        changed = true;
      }

      if (!runtime.finished && remainingSeconds <= 0) {
        runtime.finished = true;
        changed = true;
        void finishOverlayTimer(timerId);
      }
    });

    if (changed) {
      renderTimerTool();
    }

    cleanupTimerTickerIfIdle();
  }, 250);
}

function cleanupTimerTickerIfIdle() {
  if (Object.keys(state.timerRuntime.activeById).length > 0) {
    return;
  }

  if (state.timerRuntime.tickHandle) {
    window.clearInterval(state.timerRuntime.tickHandle);
    state.timerRuntime.tickHandle = null;
  }
}

async function finishOverlayTimer(timerId) {
  const timer = state.overlayTools.timers.items.find((entry) => entry.id === timerId);

  if (!timer) {
    delete state.timerRuntime.activeById[timerId];
    cleanupTimerTickerIfIdle();
    return;
  }

  await playTimerCompletionSound(timer.volumePercent).catch(() => {});
  setTimerFeedback(`Timer "${timer.name}" concluido.`, false);

  if (timer.repeatEnabled) {
    state.timerRuntime.activeById[timerId] = {
      startedAt: Date.now(),
      endsAt: Date.now() + timer.durationSeconds * 1000,
      remainingSeconds: timer.durationSeconds,
      finished: false
    };
  } else {
    window.setTimeout(() => {
      delete state.timerRuntime.activeById[timerId];
      cleanupTimerTickerIfIdle();
      renderTimerTool();
    }, timer.showVisualAlert ? 2200 : 600);
  }

  renderTimerTool();
}

async function playTimerPreview() {
  const volume = Number(els.timerVolumeInput?.value || 100);
  await playTimerCompletionSound(volume);
  setTimerFeedback("Som de teste reproduzido.", false);
}

async function playTimerCompletionSound(volumePercent = 100) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const gainNode = context.createGain();
  gainNode.gain.value = Math.min(Math.max(Number(volumePercent) || 0, 0), 100) / 100 * 0.12;
  gainNode.connect(context.destination);

  const notes = [
    { frequency: 880, duration: 0.12, startAt: 0 },
    { frequency: 1320, duration: 0.16, startAt: 0.15 }
  ];

  notes.forEach((note) => {
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = note.frequency;
    oscillator.connect(gainNode);
    oscillator.start(context.currentTime + note.startAt);
    oscillator.stop(context.currentTime + note.startAt + note.duration);
  });

  window.setTimeout(() => {
    context.close().catch(() => {});
  }, 800);
}

function setTimerFeedback(message, isError = false) {
  if (!els.timerFeedback) {
    return;
  }

  els.timerFeedback.textContent = normalizeUiText(message || "");
  els.timerFeedback.classList.toggle("error", isError);
  els.timerFeedback.classList.toggle("hidden", !message);
}

async function saveLootAnalyzerDrafts() {
  const drafts = {
    party: state.lootPartyAnalyzerText,
    solo: state.lootSoloAnalyzerText,
    soloCharacterName: state.lootSoloCharacterName,
    soloUseMarket: state.lootSoloUseMarket,
    soloDoubleXp: state.lootSoloDoubleXp,
    soloDoubleLoot: state.lootSoloDoubleLoot,
    updatedAt: new Date().toISOString()
  };

  writeLootAnalyzerDraftsFallback(drafts);
  await localStorageSet({
    [LOOT_ANALYZER_DRAFTS_KEY]: drafts
  }).catch(() => {});
}

function readLootAnalyzerDraftsFallback() {
  try {
    const raw = window.localStorage?.getItem(LOOT_ANALYZER_DRAFTS_FALLBACK_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLootAnalyzerDraftsFallback(drafts) {
  try {
    window.localStorage?.setItem(LOOT_ANALYZER_DRAFTS_FALLBACK_KEY, JSON.stringify(drafts));
  } catch {
  }
}

async function hydrateLootParsedItems(parsed) {
  if (!parsed?.items?.length) {
    return true;
  }

  const requestId = ++state.lootItemHydrationRequestId;
  const hydrationStartedAt = performance.now();
  let firstResolvedRecorded = false;
  const worldSlug = state.currentWorldSlug || "antica";

  // O Stash já mantém um índice local completo com sprites e valores NPC.
  // Reutilizá-lo evita uma consulta IPC por item apenas para descobrir a
  // imagem que já existe no content pack.
  await ensureStashLoaded().catch(() => {});
  if (
    requestId !== state.lootItemHydrationRequestId
    || state.lootParsed !== parsed
    || !isLootVisualHydrationActive()
  ) {
    return false;
  }

  let staticItems = await mapLootItemsWithConcurrency(
    parsed.items,
    6,
    async (item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const fixedUnitValue = getAnalyzerItemUnitValue(item.name);
    const reportedValue = Number(item.reportedValue ?? item.value) || 0;
    const fallbackValue = fixedUnitValue ? fixedUnitValue * quantity : reportedValue || 0;
    const reportedUnitValue =
      Number(item.reportedUnitValue) ||
      (reportedValue && quantity ? Math.round(reportedValue / quantity) : 0);
    const fallbackUnitValue =
      reportedUnitValue ||
      fixedUnitValue ||
      (reportedValue && quantity ? Math.round(reportedValue / quantity) : 0);
    const lookupSlug = item.slug || slugifyItemInput(item.name);
    const localItem = state.stashItemBySlug.get(lookupSlug) || null;

    if (localItem) {
      const localMarket = state.stashMarketById?.[localItem.marketId] || null;
      const npcUnitValue = Number(localItem.npcValue) || 0;
      const marketUnitValue = getBestMarketBuyUnitValue(localMarket);
      const bestUnitValue = Math.max(npcUnitValue, marketUnitValue, 0);
      return {
        ...item,
        quantity,
        name: localItem.name || item.name,
        slug: localItem.slug || item.slug,
        category: localItem.category || item.category || "",
        imageSrc: localItem.imageSrc || item.imageSrc || "",
        marketId: Number(localItem.marketId) || Number(item.marketId) || 0,
        npcUnitValue,
        marketUnitValue,
        reportedUnitValue: reportedUnitValue || fallbackUnitValue,
        reportedValue: reportedValue || fallbackValue,
        optimizedUnitValue: bestUnitValue || (item.optimizedUnitValue ?? reportedUnitValue ?? fallbackUnitValue),
        optimizedValue: bestUnitValue > 0 ? bestUnitValue * quantity : (item.optimizedValue ?? reportedValue ?? fallbackValue),
        unitValue: reportedUnitValue || fallbackUnitValue,
        value: reportedValue || fallbackValue,
        reportedValueSource: item.reportedValueSource || (fixedUnitValue ? "coin" : ""),
         optimizedValueSource: bestUnitValue && marketUnitValue >= npcUnitValue ? "market" : bestUnitValue ? "npc" : "",
         valueSource: item.reportedValueSource || (fixedUnitValue ? "coin" : ""),
         staticResolved: true
       };
    }

    try {
      const staticData = await fetchItemStatic({
        itemSlug: slugifyItemInput(item.name),
        worldSlug
      });
      const itemDetail = staticData?.item || null;
      const priceInfo = getAnalyzerLootPriceBreakdown({
        itemName: item.name,
        itemDetail,
        market: staticData?.market || null
      });
      const npcUnitValue = priceInfo.npcUnitValue || 0;
      const marketUnitValue = priceInfo.marketUnitValue || 0;
      const bestUnitValue = priceInfo.bestUnitValue || 0;

      return {
        ...item,
        quantity,
        name: itemDetail?.wiki_name || itemDetail?.name || item.name,
        slug: itemDetail?.slug || item.slug,
        category: itemDetail?.category || item.category || "",
        imageSrc: itemDetail?.image_src || item.imageSrc || "",
        npcUnitValue,
        marketUnitValue,
        reportedUnitValue: reportedUnitValue || fallbackUnitValue,
        reportedValue: reportedValue || fallbackValue,
        optimizedUnitValue: bestUnitValue || (item.optimizedUnitValue ?? reportedUnitValue ?? fallbackUnitValue),
        optimizedValue: bestUnitValue > 0 ? bestUnitValue * quantity : (item.optimizedValue ?? reportedValue ?? fallbackValue),
        unitValue: reportedUnitValue || fallbackUnitValue,
        value: reportedValue || fallbackValue,
        reportedValueSource: item.reportedValueSource || (fixedUnitValue ? "coin" : ""),
         optimizedValueSource: priceInfo.bestSource || item.optimizedValueSource || "",
         valueSource: item.reportedValueSource || (fixedUnitValue ? "coin" : ""),
         staticResolved: false
       };
    } catch (_error) {
      return {
        ...item,
        quantity,
        npcUnitValue: Number(item.npcUnitValue) || 0,
        reportedUnitValue: reportedUnitValue || fallbackUnitValue,
        reportedValue: reportedValue || fallbackValue,
        optimizedUnitValue: item.optimizedUnitValue ?? reportedUnitValue ?? fallbackUnitValue,
         optimizedValue: item.optimizedValue ?? reportedValue ?? fallbackValue,
         unitValue: reportedUnitValue || fallbackUnitValue,
         value: reportedValue || fallbackValue,
         reportedValueSource: item.reportedValueSource || (fixedUnitValue ? "coin" : ""),
         optimizedValueSource: item.optimizedValueSource || "",
         valueSource: item.reportedValueSource || (fixedUnitValue ? "coin" : ""),
         staticResolved: false
       };
    }
    },
    (resolvedItems, resolvedIndex) => {
      if (
        requestId !== state.lootItemHydrationRequestId
        || state.lootParsed !== parsed
        || !isLootVisualHydrationActive()
      ) {
        return;
      }

      // A análise continua usando os mesmos dados e preços; só a apresentação
      // deixa de esperar todos os sprites antes de revelar o primeiro item.
      parsed.items = resolvedItems.slice();
      applySoloLootPricing(parsed);
      if (!firstResolvedRecorded && state.lootMode === "solo") {
        firstResolvedRecorded = true;
        void recordPerformanceMetric("solo-loot-first-item-hydrated", {
          elapsedMs: Math.round(performance.now() - hydrationStartedAt),
          itemCount: parsed.items.length
        });
      }
      // Não recrie todos os painéis a cada sprite: isso apagava e pintava de
      // novo itens e criaturas que já estavam visíveis no Solo Hunt.
      patchLootItemTile(parsed.items[resolvedIndex], resolvedIndex);
    },
    {
      // Uma nova análise invalida esta fila. As requisições já iniciadas não
      // podem ser abortadas pelo IPC atual, mas nenhuma próxima consulta deve
      // ser disparada para uma análise que não será mais exibida.
      shouldContinue: () => (
        requestId === state.lootItemHydrationRequestId
        && state.lootParsed === parsed
        && isLootVisualHydrationActive()
      )
    }
  );

  if (
    requestId !== state.lootItemHydrationRequestId
    || state.lootParsed !== parsed
    || !isLootVisualHydrationActive()
  ) {
    return false;
  }

  parsed.items = staticItems;
  parsed.pricingHydrated = true;
  applySoloLootPricing(parsed);
  renderLootSplitter();

  if (state.lootMode !== "solo") {
    return true;
  }

  // Known Stash items already have their static name, sprite, NPC value and
  // Market ID. If only the Market value is missing, resolve those IDs in the
  // existing batched Market path instead of issuing one full fetchItem request
  // per item. Unknown names keep the narrow fetchItem fallback below.
  if (state.lootSoloUseMarket) {
    const marketIds = [...new Set(
      staticItems
        .filter((item) => !item.marketUnitValue && Number(item.marketId) > 0)
        .map((item) => Number(item.marketId))
        .filter(Boolean)
    )];

    if (marketIds.length > 0) {
      const marketValues = await fetchStashMarketValues({
        worldSlug,
        marketIds,
        forceFresh: true,
        mergeIntoWorldCache: true
      }).catch(() => ({}));

      if (
        requestId !== state.lootItemHydrationRequestId
        || state.lootParsed !== parsed
        || !isLootVisualHydrationActive()
      ) {
        return false;
      }

      state.stashMarketById = mergeStashMarketValuesPreservingCache(marketValues);
      state.stashMarketRevision += 1;
      staticItems = staticItems.map((item) => {
        const market = state.stashMarketById?.[item.marketId] || null;
        const marketUnitValue = getBestMarketBuyUnitValue(market);
        if (!marketUnitValue) {
          return item;
        }

        const npcUnitValue = Number(item.npcUnitValue) || 0;
        const bestUnitValue = Math.max(npcUnitValue, marketUnitValue, 0);
        return {
          ...item,
          marketUnitValue,
          optimizedUnitValue: bestUnitValue,
          optimizedValue: bestUnitValue * (Math.max(1, Number(item.quantity) || 1)),
          optimizedValueSource: marketUnitValue >= npcUnitValue ? "market" : item.optimizedValueSource
        };
      });
      parsed.items = staticItems;
      applySoloLootPricing(parsed);
      renderLootSplitter();
    }
  }

  const itemsNeedingRefresh = staticItems.filter((item) => {
    if (item.staticResolved) {
      return false;
    }
    const needsNpcRefresh = !item.npcUnitValue;
    const needsMarketRefresh = state.lootSoloUseMarket && !item.marketUnitValue;
    return needsNpcRefresh || needsMarketRefresh;
  });

  if (!itemsNeedingRefresh.length) {
    return true;
  }

  const enrichedItems = await mapLootItemsWithConcurrency(staticItems, 6, async (item) => {
    if (!itemsNeedingRefresh.includes(item)) {
      return item;
    }

    const quantity = Math.max(1, Number(item.quantity) || 1);
    const fixedUnitValue = getAnalyzerItemUnitValue(item.name);
    const fallbackValue = fixedUnitValue ? fixedUnitValue * quantity : item.value || 0;

    try {
      const data = await fetchItem({
        itemSlug: item.slug || slugifyItemInput(item.name),
        worldSlug
      });
      const itemDetail = data?.item || null;
      const market = data?.market || null;
      const priceInfo = getAnalyzerLootPriceBreakdown({
        itemName: item.name,
        itemDetail,
        market
      });
      const npcUnitValue = priceInfo.npcUnitValue || 0;
      const marketUnitValue = priceInfo.marketUnitValue || 0;

      return {
        ...item,
        name: itemDetail?.wiki_name || itemDetail?.name || item.name,
        slug: itemDetail?.slug || item.slug,
        category: itemDetail?.category || item.category || "",
        imageSrc: itemDetail?.image_src || item.imageSrc || "",
        npcUnitValue,
        marketUnitValue,
        optimizedUnitValue: Math.max(npcUnitValue, marketUnitValue, 0),
        optimizedValue: Math.max(npcUnitValue, marketUnitValue, 0) * quantity,
        optimizedValueSource: priceInfo.bestSource || (fixedUnitValue ? "coin" : ""),
        valueSource: priceInfo.bestSource || (fixedUnitValue ? "coin" : item.valueSource || "")
      };
    } catch (_error) {
      return item;
    }
  }, undefined, {
    shouldContinue: () => (
      requestId === state.lootItemHydrationRequestId
      && state.lootParsed === parsed
      && isLootVisualHydrationActive()
    )
  });

  if (
    requestId !== state.lootItemHydrationRequestId
    || state.lootParsed !== parsed
    || !isLootVisualHydrationActive()
  ) {
    return false;
  }

  parsed.items = enrichedItems;
  parsed.pricingHydrated = true;
  applySoloLootPricing(parsed);
  renderLootSplitter();
  return true;
}

function isLootVisualHydrationActive() {
  return state.selectedSection === "tools" && state.selectedToolTab === "loot-splitter";
}

function cancelLootVisualHydration() {
  state.lootItemHydrationRequestId += 1;
  state.lootMonsterHydrationRequestId += 1;
}

async function mapLootItemsWithConcurrency(items, limit, worker, onProgress, options = {}) {
  const source = Array.isArray(items) ? items : [];
  const results = source.slice();
  const workerCount = Math.min(Math.max(1, Number(limit) || 1), source.length);
  const shouldContinue = typeof options.shouldContinue === "function" ? options.shouldContinue : null;
  let nextIndex = 0;

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < source.length) {
      if (shouldContinue && !shouldContinue()) {
        return;
      }
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(source[currentIndex], currentIndex);
      if (shouldContinue && !shouldContinue()) {
        return;
      }
      onProgress?.(results, currentIndex);
    }
  }));

  return results;
}

async function hydrateLootParsedMonsters(parsed) {
  if (!parsed?.monsters?.length || state.monstersLoaded) {
    if (parsed?.monsters?.length) {
      renderLootMonsters(parsed.monsters);
    }
    return;
  }

  const requestId = ++state.lootMonsterHydrationRequestId;

  try {
    const data = await fetchCreatureIndex();

    if (requestId !== state.lootMonsterHydrationRequestId || state.lootParsed !== parsed) {
      return;
    }

    state.monsterIndex = Array.isArray(data?.items) ? data.items : [];
    state.monsterCategories = Array.isArray(data?.categories) ? data.categories : [];
    state.monsterClasses = Array.isArray(data?.classes) ? data.classes : [];
    state.monsterTypes = Array.isArray(data?.types) ? data.types : [];
    state.monstersLoaded = true;
    renderLootMonsters(parsed.monsters);
  } catch (_error) {
    // O analyzer continua funcional mesmo sem a base local de criaturas.
  }
}

function parseLootAnalyzerText(text) {
  const raw = String(text || "").replace(/\r/g, "").trim();

  if (!raw) {
    return null;
  }

  const lines = raw.split("\n");
  const sessionDataLine = lines.find((line) => /^Session data:/i.test(line)) || "";
  const sessionLine = lines.find((line) => /^Session:\s*/i.test(line)) || "";
  const lootTypeLine = lines.find((line) => /^Loot Type:/i.test(line)) || "";
  const totalLootLine = lines.find((line) => /^Loot:\s*/i.test(line)) || "";
  const totalSuppliesLine = lines.find((line) => /^Supplies:\s*/i.test(line)) || "";
  const totalBalanceLine = lines.find((line) => /^Balance:\s*/i.test(line)) || "";
  const players = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed || trimmed.includes(":") || /^\s/.test(line)) {
      continue;
    }

    const block = lines.slice(index + 1, index + 8);

    if (!block.some((entry) => /^\s*Loot:\s*/i.test(entry))) {
      continue;
    }

    const isLeader = /\(Leader\)/i.test(trimmed);
    const name = trimmed.replace(/\s*\(Leader\)\s*/i, "").trim();
    players.push({
      name,
      isLeader,
      loot: parseAnalyzerNumber(findBlockValue(block, "Loot")),
      supplies: parseAnalyzerNumber(findBlockValue(block, "Supplies")),
      balance: parseAnalyzerNumber(findBlockValue(block, "Balance")),
      reportedLoot: parseAnalyzerNumber(findBlockValue(block, "Loot")),
      reportedSupplies: parseAnalyzerNumber(findBlockValue(block, "Supplies")),
      reportedBalance: parseAnalyzerNumber(findBlockValue(block, "Balance")),
      damage: parseAnalyzerNumber(findBlockValue(block, "Damage")),
      healing: parseAnalyzerNumber(findBlockValue(block, "Healing")),
      level: null,
      vocation: ""
    });
  }

  const totalBalance = totalBalanceLine
    ? parseAnalyzerNumber(totalBalanceLine.replace(/^Balance:\s*/i, ""))
    : null;
  const calculatedBalance = players.reduce((sum, player) => sum + player.balance, 0);
  const balanceTotal = Number.isFinite(totalBalance) ? totalBalance : calculatedBalance;
  const perPerson = players.length > 0 ? Math.floor(balanceTotal / players.length) : 0;

  return {
    raw,
    sessionData: sessionDataLine.replace(/^Session data:\s*/i, "").trim(),
    session: sessionLine.replace(/^Session:\s*/i, "").trim(),
    lootType: lootTypeLine.replace(/^Loot Type:\s*/i, "").trim(),
    totalLoot: parseAnalyzerNumber(totalLootLine.replace(/^Loot:\s*/i, "")),
    totalSupplies: parseAnalyzerNumber(totalSuppliesLine.replace(/^Supplies:\s*/i, "")),
    reportedTotalLoot: parseAnalyzerNumber(totalLootLine.replace(/^Loot:\s*/i, "")),
    reportedTotalSupplies: parseAnalyzerNumber(totalSuppliesLine.replace(/^Supplies:\s*/i, "")),
    reportedTotalBalance: balanceTotal,
    totalBalance: balanceTotal,
    players,
    perPerson,
    transfers: calculateLootTransfers(players, perPerson),
    items: parseLootAnalyzerItems(lines)
  };
}

function parseSoloHuntAnalyzerText(text) {
  const raw = String(text || "").replace(/\r/g, "").trim();

  if (!raw) {
    return null;
  }

  const lines = raw.split("\n");
  const getValue = (label) => {
    const line = lines.find((entry) => new RegExp(`^${label}:\\s*`, "i").test(entry.trim()));
    return line ? line.replace(new RegExp(`^${label}:\\s*`, "i"), "").trim() : "";
  };
  const lootedItems = parseAnalyzerSectionEntries(lines, "Looted Items").map((item) => {
    const unitValue = getAnalyzerItemUnitValue(item.name);
    return {
      ...item,
      value: unitValue ? unitValue * item.quantity : 0
    };
  });
  const killedMonsters = parseAnalyzerSectionEntries(lines, "Killed Monsters");

  return {
    raw,
    mode: "solo",
    pricingHydrated: false,
    sessionData: getValue("Session data"),
    session: getValue("Session"),
    rawXpGain: parseAnalyzerNumber(getValue("Raw XP Gain")),
    xpGain: parseAnalyzerNumber(getValue("XP Gain")),
    rawXpHour: parseAnalyzerNumber(getValue("Raw XP/h")),
    xpHour: parseAnalyzerNumber(getValue("XP/h")),
    reportedTotalLoot: parseAnalyzerNumber(getValue("Loot")),
    reportedTotalSupplies: parseAnalyzerNumber(getValue("Supplies")),
    reportedTotalBalance: parseAnalyzerNumber(getValue("Balance")),
    totalLoot: parseAnalyzerNumber(getValue("Loot")),
    totalSupplies: parseAnalyzerNumber(getValue("Supplies")),
    totalBalance: parseAnalyzerNumber(getValue("Balance")),
    damage: parseAnalyzerNumber(getValue("Damage")),
    damageHour: parseAnalyzerNumber(getValue("Damage/h")),
    healing: parseAnalyzerNumber(getValue("Healing")),
    healingHour: parseAnalyzerNumber(getValue("Healing/h")),
    items: lootedItems,
    monsters: killedMonsters
  };
}

async function enrichLootPlayerProfiles(parsed) {
  if (!parsed?.players?.length) {
    state.lootProfilesLoading = false;
    return;
  }

  const requestId = ++state.lootProfileRequestId;
  state.lootProfilesLoading = true;
  renderLootPlayers(parsed.players);

  try {
    const profiles = await fetchCharacterProfiles({
      names: parsed.players.map((player) => player.name)
    });

    if (requestId !== state.lootProfileRequestId || state.lootParsed !== parsed) {
      return;
    }

    parsed.players = parsed.players.map((player) => {
      const profile = profiles?.[player.name] || null;
      return {
        ...player,
        level: profile?.level || null,
        vocation: profile?.vocation || "",
        sex: profile?.sex || "",
        world: profile?.world || ""
      };
    });

    parsed.worldError = getPartyWorldError(parsed.players);
  } catch (_error) {
    // O split nao depende da consulta de personagem.
  } finally {
    if (requestId === state.lootProfileRequestId && state.lootParsed === parsed) {
      state.lootProfilesLoading = false;
      renderLootSplitter();
    }
  }
}

async function enrichSoloLootProfile(parsed) {
  if (!parsed || !state.lootSoloCharacterName) {
    state.lootSoloProfile = null;
    state.lootProfilesLoading = false;
    renderLootSplitter();
    return;
  }

  const requestId = ++state.lootProfileRequestId;
  state.lootProfilesLoading = true;
  renderLootSplitter();

  try {
    const profiles = await fetchCharacterProfiles({
      names: [state.lootSoloCharacterName]
    });

    if (requestId !== state.lootProfileRequestId || state.lootParsed !== parsed) {
      return;
    }

    state.lootSoloProfile = profiles?.[state.lootSoloCharacterName] || null;
  } catch (_error) {
    state.lootSoloProfile = null;
  } finally {
    if (requestId === state.lootProfileRequestId && state.lootParsed === parsed) {
      state.lootProfilesLoading = false;
      renderLootSplitter();
    }
  }
}

function getPartyWorldError(players = []) {
  const worlds = [...new Set(players.map((player) => String(player.world || "").trim()).filter(Boolean))];

  if (worlds.length > 1) {
    return t("tools.partyWorldMismatch", { worlds: worlds.join(", ") });
  }

  return "";
}

function findBlockValue(block, label) {
  const entry = block.find((line) => new RegExp(`^\\s*${label}:\\s*`, "i").test(line));
  return entry ? entry.replace(new RegExp(`^\\s*${label}:\\s*`, "i"), "") : "";
}

function parseAnalyzerNumber(value) {
  const normalized = String(value || "").replace(/,/g, "").replace(/[^\d-]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function calculateLootTransfers(players, perPerson) {
  const payers = players
    .map((player) => ({ name: player.name, amount: Math.max(0, player.balance - perPerson) }))
    .filter((entry) => entry.amount > 0);
  const receivers = players
    .map((player) => ({ name: player.name, amount: Math.max(0, perPerson - player.balance) }))
    .filter((entry) => entry.amount > 0);
  const transfers = [];
  let payerIndex = 0;

  receivers.forEach((receiver) => {
    let remaining = receiver.amount;

    while (remaining > 0 && payerIndex < payers.length) {
      const payer = payers[payerIndex];
      const amount = Math.min(payer.amount, remaining);

      if (amount > 0) {
        transfers.push({ from: payer.name, to: receiver.name, amount });
      }

      payer.amount -= amount;
      remaining -= amount;

      if (payer.amount <= 0) {
        payerIndex += 1;
      }
    }
  });

  return transfers;
}

function parseLootAnalyzerItems(lines) {
  const lootedItems = parseAnalyzerSectionEntries(lines, "Looted Items");

  if (lootedItems.length > 0) {
    return lootedItems.map((item) => {
      const unitValue = getAnalyzerItemUnitValue(item.name);
      const reportedValue = item.value || (unitValue ? unitValue * item.quantity : 0);
      return {
        ...item,
        reportedUnitValue:
          unitValue ||
          (reportedValue && item.quantity ? Math.round(reportedValue / item.quantity) : 0),
        reportedValue,
        reportedValueSource: unitValue ? "coin" : "",
        value: reportedValue,
        unitValue:
          unitValue ||
          (reportedValue && item.quantity ? Math.round(reportedValue / item.quantity) : 0)
      };
    });
  }

  const items = [];
  const itemLinePattern = /^\s*(\d+)\s*x?\s+(.+?)\s*(?:[:=-]\s*([\d,]+))?\s*$/i;

  lines.forEach((line) => {
    const match = line.match(itemLinePattern);

    if (!match) {
      return;
    }

    const name = match[2].trim();

    if (!name || /^(Loot|Supplies|Balance|Damage|Healing|Session)$/i.test(name)) {
      return;
    }

    items.push({
      quantity: Number(match[1]) || 1,
      name,
      reportedValue: parseAnalyzerNumber(match[3]) || getAnalyzerItemUnitValue(name) * (Number(match[1]) || 1),
      value: parseAnalyzerNumber(match[3]) || getAnalyzerItemUnitValue(name) * (Number(match[1]) || 1),
      reportedUnitValue:
        getAnalyzerItemUnitValue(name) ||
        (
          (parseAnalyzerNumber(match[3]) || getAnalyzerItemUnitValue(name) * (Number(match[1]) || 1)) &&
          (Number(match[1]) || 1)
            ? Math.round((parseAnalyzerNumber(match[3]) || getAnalyzerItemUnitValue(name) * (Number(match[1]) || 1)) / (Number(match[1]) || 1))
            : 0
        ),
      unitValue:
        getAnalyzerItemUnitValue(name) ||
        (
          (parseAnalyzerNumber(match[3]) || getAnalyzerItemUnitValue(name) * (Number(match[1]) || 1)) &&
          (Number(match[1]) || 1)
            ? Math.round((parseAnalyzerNumber(match[3]) || getAnalyzerItemUnitValue(name) * (Number(match[1]) || 1)) / (Number(match[1]) || 1))
            : 0
        ),
      reportedValueSource: getAnalyzerItemUnitValue(name) ? "coin" : ""
    });
  });

  return items;
}

function applySoloLootPricing(parsed) {
  if (!parsed || state.lootMode !== "solo") {
    return;
  }

  const reportedTotalLoot = Number(parsed.reportedTotalLoot ?? parsed.totalLoot) || 0;
  const reportedTotalSupplies = Number(parsed.reportedTotalSupplies ?? parsed.totalSupplies) || 0;
  const reportedTotalBalance = Number(parsed.reportedTotalBalance ?? parsed.totalBalance) || 0;
  const useMarketPricing = Boolean(state.lootSoloUseMarket);
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  parsed.items = items.map((item) => {
    const reportedUnitValue = Number(item.reportedUnitValue ?? item.unitValue) || 0;
    const reportedValue = Number(item.reportedValue ?? item.value) || 0;
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const npcUnitValue = Number(item.npcUnitValue) || 0;
    const marketUnitValue = Number(item.marketUnitValue) || 0;
    const selectedUnitValue = useMarketPricing ? marketUnitValue : npcUnitValue;
    const selectedSource = useMarketPricing ? "market" : "npc";

    return {
      ...item,
      value: selectedUnitValue > 0 ? selectedUnitValue * quantity : reportedValue,
      unitValue: selectedUnitValue > 0 ? selectedUnitValue : reportedUnitValue,
      valueSource: selectedUnitValue > 0 ? selectedSource : (item.reportedValueSource || "")
    };
  });

  if (!parsed.pricingHydrated) {
    parsed.totalLoot = reportedTotalLoot;
    parsed.totalSupplies = reportedTotalSupplies;
    parsed.totalBalance = reportedTotalBalance;
    return;
  }

  parsed.totalLoot = parsed.items.reduce(
    (sum, item) => sum + (Number(item.value) || 0),
    0
  );
  parsed.totalSupplies = reportedTotalSupplies;
  parsed.totalBalance = reportedTotalBalance + (parsed.totalLoot - reportedTotalLoot);
}

function parseAnalyzerSectionEntries(lines, sectionName) {
  const entries = [];
  const startIndex = lines.findIndex((line) => new RegExp(`^${sectionName}:\\s*$`, "i").test(line.trim()));

  if (startIndex < 0) {
    return entries;
  }

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (!/^\s/.test(line) || /:\s*$/.test(trimmed)) {
      break;
    }

    const match = trimmed.match(/^([\d,]+)\s*x?\s+(.+?)(?:\s*[:=-]\s*([\d,]+))?$/i);

    if (!match) {
      continue;
    }

    entries.push({
      quantity: parseAnalyzerNumber(match[1]) || 1,
      name: normalizeAnalyzerEntityName(match[2]),
      value: parseAnalyzerNumber(match[3])
    });
  }

  return entries;
}

function normalizeAnalyzerEntityName(name) {
  return String(name || "")
    .trim()
    .replace(/^an?\s+/i, "")
    .replace(/\s+/g, " ");
}

function getAnalyzerItemUnitValue(name) {
  const normalized = normalizeSearchText(name);

  if (/\bcrystal coin(s)?\b/.test(normalized)) {
    return 10000;
  }

  if (/\bplatinum coin(s)?\b/.test(normalized)) {
    return 100;
  }

  if (/\bgold coin(s)?\b/.test(normalized)) {
    return 1;
  }

  return 0;
}

function getAnalyzerLootPriceBreakdown({ itemName, itemDetail, market }) {
  const fixedUnitValue = getAnalyzerItemUnitValue(itemName);

  if (fixedUnitValue) {
    return {
      npcUnitValue: fixedUnitValue,
      marketUnitValue: fixedUnitValue,
      bestUnitValue: fixedUnitValue,
      bestSource: "coin"
    };
  }

  const npcBuyValue = getBestNpcBuyUnitValue(itemDetail?.npc_buy);
  const marketBuyValue = getBestMarketBuyUnitValue(market);
  const bestUnitValue = Math.max(npcBuyValue, marketBuyValue, 0);

  return {
    npcUnitValue: npcBuyValue,
    marketUnitValue: marketBuyValue,
    bestUnitValue,
    bestSource: bestUnitValue && marketBuyValue >= npcBuyValue ? "market" : bestUnitValue ? "npc" : ""
  };
}

function getBestMarketBuyUnitValue(market) {
  const value = Number(market?.buy_offer);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getBestNpcBuyUnitValue(npcTrades) {
  if (!Array.isArray(npcTrades)) {
    return 0;
  }

  const values = npcTrades
    .map((trade) => getNpcTradeUnitValue(trade))
    .filter((value) => Number.isFinite(value) && value > 0);

  return values.length ? Math.max(...values) : 0;
}

function getNpcTradeUnitValue(trade) {
  if (typeof trade === "number") {
    return trade;
  }

  // Points, tokens and barter values cannot be compared to market gold.
  // A numeric token amount is still a real price, just not a gold price.
  if (trade?.currency) {
    return 0;
  }

  const candidates = [
    trade?.price,
    trade?.value,
    trade?.npc_value,
    trade?.npcValue,
    trade?.npcPrice
  ];

  for (const candidate of candidates) {
    const digits = String(candidate ?? "").replace(/[^0-9]/g, "");

    if (digits) {
      return Number(digits);
    }
  }

  return 0;
}

function renderLootHelp() {
  els.lootHelpToggle?.setAttribute("aria-expanded", state.lootHelpOpen ? "true" : "false");

  if (!els.lootHelpPanel) {
    return;
  }

  const analyzerName = state.lootMode === "solo" ? "Hunt Analyzer" : "Party Hunt Analyzer";
  const imageSrc = state.lootMode === "solo"
    ? "assets/ui/analyzer/hunt-analyzer-help.png"
    : "assets/ui/analyzer/party-loot-help.jpg";
  const optimizationMarkup = state.lootMode === "solo"
    ? `
      <div class="loot-help-optimization">
        <p class="loot-help-warning">
          <img src="assets/ui/combat-status/15px-Warning_Icon_Yellow.png" alt="">
          <span>
            <strong>Importante:</strong>&nbsp;Para usar os valores de <strong>Market</strong>&nbsp;otimizado, primeiro defina os valores como <strong>NPC</strong>&nbsp;no loot pessoal do personagem.
          </span>
        </p>
      </div>
    `
    : `
      <div class="loot-help-optimization">
        <p>
          No <strong>Party Hunt</strong>,&nbsp;o app agora usa os valores exatamente como vieram no texto copiado. O tipo <strong>Leader</strong>&nbsp;ou&nbsp;<strong>Market</strong>&nbsp;fica exibido apenas como referencia da sessao.
        </p>
      </div>
    `;

  els.lootHelpPanel.innerHTML = normalizeUiText(`
    <div class="loot-help-copy">
      <p>
        No ${analyzerName} do Tibia, clique no&nbsp;
        <strong>Menu</strong>,&nbsp;depois em&nbsp;<strong>Copy to Clipboard</strong>,&nbsp;e&nbsp;
        <strong>Cole o texto</strong>&nbsp;copiado na caixa abaixo.
      </p>
    </div>
    <img src="${imageSrc}" alt="Menu do ${analyzerName}">
    ${optimizationMarkup}
  `);
  els.lootHelpPanel.classList.toggle("hidden", !state.lootHelpOpen);
}

function renderLootSplitter() {
  return renderLootSplitterV2();
  renderLootHelp();

  if (els.lootAutoModeToggle) {
    els.lootAutoModeToggle.checked = state.lootAutoMode;
  }

  const parsed = state.lootParsed;
  const canOptimize = isLeaderLootType(parsed?.lootType);
  els.lootModePanel?.classList.toggle("hidden", !canOptimize);

  if (!parsed) {
    setLootFeedback(state.lootAnalyzerText ? "Não consegui identificar uma party válida nesse texto." : "");
    if (els.lootSessionSummary) els.lootSessionSummary.innerHTML = "";
    if (els.lootPlayerGrid) els.lootPlayerGrid.innerHTML = "";
    els.lootItemsCard?.classList.add("hidden");
    els.lootOutputCard?.classList.add("hidden");
    if (els.lootOutput) els.lootOutput.innerHTML = "";
    return;
  }

  if (parsed.players.length === 0) {
    setLootFeedback("Não encontrei jogadores no padrão do Party Hunt Analyzer.", true);
    return;
  }

  setLootFeedback(
    canOptimize
      ? state.lootAutoMode
        ? "Loot Type: Leader detectado. Preço otimizado ativo."
        : "Loot Type: Leader detectado. Modo manual selecionado."
      : "Party Hunt usa os valores prontos do texto copiado. O tipo da sessao fica apenas como referencia."
  );
  renderLootSessionSummary(parsed);
  renderLootPlayers(parsed.players);
  renderLootItems(parsed.items);
  renderLootOutput(parsed);
}

function setLootFeedback(message, isError = false) {
  if (!els.lootFeedback) {
    return;
  }

  els.lootFeedback.textContent = message;
  els.lootFeedback.classList.toggle("hidden", !message);
  els.lootFeedback.classList.toggle("error", Boolean(isError));
}

function renderLootSessionSummary(parsed) {
  if (!els.lootSessionSummary) {
    return;
  }

  els.lootSessionSummary.innerHTML = normalizeUiText(`
    <div class="loot-summary-chip"><span>Sessão</span><strong>${escapeHtml(parsed.session || "-")}</strong></div>
    <div class="loot-summary-chip"><span>Período</span><strong>${escapeHtml(parsed.sessionData || "-")}</strong></div>
    <div class="loot-summary-chip"><span>Tipo</span><strong>${escapeHtml(parsed.lootType || "-")}</strong></div>
    <div class="loot-summary-chip"><span>Players</span><strong>${parsed.players.length}</strong></div>
    <div class="loot-summary-chip"><span>Balance total</span><strong class="${getBalanceClass(parsed.totalBalance)}">${formatLootGold(parsed.totalBalance)} gp</strong></div>
    <div class="loot-summary-chip"><span>Por pessoa</span><strong class="${getBalanceClass(parsed.perPerson)}">${formatLootGold(parsed.perPerson)} gp</strong></div>
  `);
  decoratePartyLootSessionSummary();
  bindSkillDynamicTooltips(els.lootSessionSummary);
}

function renderLootPlayers(players) {
  if (!els.lootPlayerGrid) {
    return;
  }

  els.lootPlayerGrid.innerHTML = normalizeUiText(players.map((player) => `
    <article class="loot-player-card">
      <div class="loot-player-avatar">${getPlayerAvatarMarkup(player)}</div>
      <div class="loot-player-main">
        <strong>${escapeHtml(player.name)}${player.isLeader ? " <span>Líder</span>" : ""}</strong>
        <small>${renderPlayerSubtitle(player)}</small>
      </div>
      <div class="loot-player-stat-grid">
        ${renderLootPlayerStatTile({ label: "Loot", value: player.loot, icon: "assets/ui/analyzer/analyzer-loot.gif" })}
        ${renderLootPlayerStatTile({ label: "Supplies", value: player.supplies, icon: "assets/ui/analyzer/analyzer-supplies.gif" })}
        ${renderLootPlayerStatTile({ label: "Balance", value: player.balance, icon: "assets/ui/analyzer/analyzer-balance.gif", signed: true })}
        ${renderLootPlayerStatTile({ label: "Damage", value: player.damage, icon: "assets/ui/analyzer/analyzer-damage.gif" })}
        ${renderLootPlayerStatTile({ label: "Healing", value: player.healing, icon: "assets/ui/analyzer/analyzer-healing.gif" })}
        ${typeof player.xpGain === "number" ? renderLootPlayerStatTile({
          label: "XP",
          value: player.xpGain,
          icon: player.xpGain < 0 ? "assets/ui/analyzer/analyzer-death.png" : "assets/ui/analyzer/analyzer-xp.gif",
          signed: true
        }) : ""}
      </div>
    </article>
  `).join(""));
  bindSkillDynamicTooltips(els.lootPlayerGrid);
}

function renderLootPlayerStatTile({ label, value, icon, signed = false }) {
  const numericValue = Number(value) || 0;
  const className = signed ? getBalanceClass(numericValue) : "";
  const iconSrc = getLootPlayerStatIcon({ label, numericValue, fallbackIcon: icon });
  return `
    <div class="loot-player-stat-tile" data-tooltip="${escapeHtml(label)}">
      <img src="${escapeHtml(iconSrc)}" alt="">
      <strong class="${className}">${renderLootValue(numericValue)}</strong>
    </div>
  `;
}

function getLootPlayerStatIcon({ label, numericValue, fallbackIcon }) {
  if (label === "Balance" && numericValue < 0) {
    return "assets/ui/analyzer/analyzer-balance-negative.gif";
  }

  if (label !== "Loot") {
    return fallbackIcon;
  }

  if (numericValue > 1000000) {
    return "assets/ui/analyzer/analyzer-loot-incomprehensible-riches.gif";
  }

  if (numericValue > 500000) {
    return "assets/ui/analyzer/analyzer-loot-chest-of-abundance.gif";
  }

  if (numericValue > 100000) {
    return "assets/ui/analyzer/analyzer-loot-treasure-chest.gif";
  }

  return fallbackIcon;
}

function getLootItemTileMarkup(item, index) {
  const quantity = Number(item.quantity) || 1;
  const isSolo = state.lootMode === "solo";
  const doubleLootActive = isSolo && Boolean(state.lootSoloDoubleLoot);
  const preferredUnitValue = isSolo
    ? (state.lootSoloUseMarket ? Number(item.marketUnitValue) || 0 : Number(item.npcUnitValue) || 0)
    : 0;
  const fallbackTotalValue = Number(item.value) || 0;
  const fallbackUnitValue = Number(item.unitValue) || Number(item.reportedUnitValue)
    || (fallbackTotalValue && quantity ? Math.round(fallbackTotalValue / quantity) : 0);
  const baseUnitValue = preferredUnitValue || fallbackUnitValue;
  const unitValue = doubleLootActive ? baseUnitValue * 2 : baseUnitValue;
  const totalValue = unitValue > 0 ? unitValue * quantity : (doubleLootActive ? fallbackTotalValue * 2 : fallbackTotalValue);

  return `
    <button type="button" class="loot-item-tile ${getValueTierClass(totalValue)}" data-loot-item-index="${index}" data-loot-item-name="${escapeHtml(item.name)}" data-tooltip="${escapeHtml(t("common.viewDetails"))}">
      ${item.imageSrc ? `<img class="loot-tile-icon" src="${escapeHtml(item.imageSrc)}" alt="${escapeHtml(item.name)}">` : ""}
      <span>${escapeHtml(quantity)}x</span>
      <strong>${escapeHtml(item.name)}</strong>
      ${unitValue ? `<small>${renderLootValue(unitValue, "gp")} cada</small>` : "<small>Sem valor</small>"}
      ${totalValue ? `<small class="loot-tile-total">Total: ${renderLootValue(totalValue, "gp")}</small>` : ""}
      ${doubleLootActive && unitValue ? '<small class="loot-monster-event">Evento Double</small>' : ""}
    </button>
  `;
}

function patchLootItemTile(item, index) {
  if (!els.lootItemsGrid || !Number.isInteger(index)) return;
  const current = els.lootItemsGrid.querySelector(`[data-loot-item-index="${index}"]`);
  if (!current) {
    renderLootItems(state.lootParsed?.items || []);
    return;
  }
  current.outerHTML = normalizeUiText(getLootItemTileMarkup(item, index));
  bindSkillDynamicTooltips(els.lootItemsGrid);
}

function renderLootItems(items) {
  if (!els.lootItemsCard || !els.lootItemsGrid) {
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    els.lootItemsCard.classList.add("hidden");
    els.lootItemsGrid.innerHTML = "";
    return;
  }

  els.lootItemsCard.classList.remove("hidden");
  els.lootItemsGrid.innerHTML = normalizeUiText(items.map((item, index) => {
    const quantity = Number(item.quantity) || 1;
    const isSolo = state.lootMode === "solo";
    const doubleLootActive = isSolo && Boolean(state.lootSoloDoubleLoot);
    const preferredUnitValue = isSolo
      ? (
        state.lootSoloUseMarket
          ? Number(item.marketUnitValue) || 0
          : Number(item.npcUnitValue) || 0
      )
      : 0;
    const fallbackTotalValue = Number(item.value) || 0;
    const fallbackUnitValue =
      Number(item.unitValue) ||
      Number(item.reportedUnitValue) ||
      (fallbackTotalValue && quantity ? Math.round(fallbackTotalValue / quantity) : 0);
    const baseUnitValue = preferredUnitValue || fallbackUnitValue;
    const unitValue = doubleLootActive ? baseUnitValue * 2 : baseUnitValue;
    const totalValue = unitValue > 0
      ? unitValue * quantity
      : (doubleLootActive ? fallbackTotalValue * 2 : fallbackTotalValue);

    return `
      <button type="button" class="loot-item-tile ${getValueTierClass(totalValue)}" data-loot-item-index="${index}" data-loot-item-name="${escapeHtml(item.name)}" data-tooltip="${escapeHtml(t("common.viewDetails"))}">
        ${item.imageSrc ? `<img class="loot-tile-icon" src="${escapeHtml(item.imageSrc)}" alt="${escapeHtml(item.name)}">` : ""}
        <span>${escapeHtml(quantity)}x</span>
        <strong>${escapeHtml(item.name)}</strong>
        ${unitValue ? `<small>${renderLootValue(unitValue, "gp")} cada</small>` : "<small>Sem valor</small>"}
        ${totalValue ? `<small class="loot-tile-total">Total: ${renderLootValue(totalValue, "gp")}</small>` : ""}
        ${doubleLootActive && unitValue ? '<small class="loot-monster-event">Evento Double</small>' : ""}
      </button>
    `;
  }).join(""));
  bindSkillDynamicTooltips(els.lootItemsGrid);
}

function renderLootOutput(parsed) {
  if (!els.lootOutput || !els.lootOutputCard) {
    return;
  }

  const lines = parsed.transfers.map(
    (transfer) => {
      const command = `transfer ${transfer.amount} to ${transfer.to}`;
      return `
      <div class="loot-output-line loot-output-transfer-line" data-transfer-command="${escapeHtml(command)}" data-tooltip="Copie o texto e envie ao NPC" role="button" tabindex="0">
        <span class="loot-output-transfer-text">
          <span class="loot-output-name">${escapeHtml(transfer.from)}</span>
          deve pagar
          <span class="loot-output-value">${formatLootGold(transfer.amount)} gp</span>
          para
          <span class="loot-output-name">${escapeHtml(transfer.to)}</span>.
          <span class="loot-output-command">(${escapeHtml(command)})</span>
        </span>
        <span class="loot-output-copy-icon" aria-hidden="true">
          <img class="copy-sprite-icon copy-sprite-icon-off" src="assets/ui/copy/copiar-off.png" alt="">
          <img class="copy-sprite-icon copy-sprite-icon-hover" src="assets/ui/copy/copiar-hover.png" alt="">
          <img class="copy-sprite-icon copy-sprite-icon-on" src="assets/ui/copy/copiar-on.png" alt="">
        </span>
      </div>`;
    }
  );
  lines.push(`<div class="loot-output-line">Saldo total: <span class="${getBalanceClass(parsed.totalBalance)}">${formatLootGold(parsed.totalBalance)} gp</span></div>`);
  lines.push(`<div class="loot-output-line">Numero de pessoas: <span class="loot-output-value">${parsed.players.length}</span></div>`);
  lines.push(`<div class="loot-output-line">Saldo por pessoa: <span class="${getBalanceClass(parsed.perPerson)}">${formatLootGold(parsed.perPerson)} gp</span></div>`);

  els.lootOutput.innerHTML = normalizeUiText(lines.join(""));
  els.lootOutputCard.classList.remove("hidden");
  bindSkillDynamicTooltips(els.lootOutput);
}

function renderLootSplitterV2() {
  renderLootHelp();
  document.querySelector('[data-tool-panel="loot-splitter"]')?.classList.toggle(
    "loot-solo-mode",
    state.lootMode === "solo"
  );

  els.lootSubtabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.lootMode === state.lootMode);
  });
  els.lootSoloControlsRow?.classList.toggle("hidden", state.lootMode !== "solo");
  els.lootCharacterField?.classList.toggle("hidden", state.lootMode !== "solo");

  if (els.lootInputLabel) {
    els.lootInputLabel.textContent = state.lootMode === "solo"
      ? t("tools.soloAnalyzerInputLabel")
      : t("tools.analyzerInputLabel");
  }

  if (els.lootInput) {
    els.lootInput.placeholder = state.lootMode === "solo"
      ? t("tools.soloAnalyzerInputPlaceholder")
      : t("tools.analyzerInputPlaceholder");
    const activeText = getActiveLootAnalyzerText();
    if (els.lootInput.value !== activeText) {
      els.lootInput.value = activeText;
    }
  }

  if (els.lootCharacterInput && els.lootCharacterInput.value !== state.lootSoloCharacterName) {
    els.lootCharacterInput.value = state.lootSoloCharacterName;
  }

  if (els.lootAutoModeToggle) {
    els.lootAutoModeToggle.checked = state.lootSoloUseMarket;
  }
  if (els.lootDoubleXpToggle) {
    els.lootDoubleXpToggle.checked = state.lootSoloDoubleXp;
  }
  if (els.lootDoubleLootToggle) {
    els.lootDoubleLootToggle.checked = state.lootSoloDoubleLoot;
  }
  if (els.lootModeToggleLabel) {
    els.lootModeToggleLabel.textContent = state.lootSoloUseMarket
      ? t("tools.useMarketPrice")
      : t("tools.useNpcPrice");
  }
  if (els.lootModeToggleHelp) {
    els.lootModeToggleHelp.dataset.tooltip = state.lootSoloUseMarket
      ? t("tools.useMarketPriceHelp")
      : t("tools.useNpcPriceHelp");
  }

  const parsed = state.lootParsed;
  els.lootModePanel?.classList.toggle("hidden", state.lootMode !== "solo");

  if (!parsed) {
    setLootFeedback(
      getActiveLootAnalyzerText()
        ? state.lootMode === "solo"
          ? "Não consegui identificar um Hunt Analyzer solo válido nesse texto."
          : "Não consegui identificar uma party válida nesse texto."
        : ""
    );
    clearLootRenderPanels();
    return;
  }

  if (state.lootMode === "solo") {
    setLootFeedback(state.lootSoloCharacterName ? "" : "Informe o nome do personagem.");
    renderSoloLootSessionSummary(parsed);
    renderSoloLootOutput(parsed);
    renderSoloLootPlayer(parsed);
    renderLootMonsters(parsed.monsters);
    renderLootItems(parsed.items);
    return;
  }

  renderPartyLootPanels(parsed);
  return;

  if (!parsed.players?.length) {
    setLootFeedback("Não encontrei jogadores no padrão do Party Hunt Analyzer.", true);
    clearLootRenderPanels();
    return;
  }

  setLootFeedback(parsed.worldError || (
    canOptimize
      ? state.lootAutoMode
        ? "Loot Type: Leader detectado. Preço otimizado ativo."
        : "Loot Type: Leader detectado. Modo manual selecionado."
      : "Loot Type: Market detectado. O split usa os valores prontos do texto copiado."
  ), Boolean(parsed.worldError));

  els.lootMonstersCard?.classList.add("hidden");
  if (els.lootMonstersGrid) els.lootMonstersGrid.innerHTML = "";
  renderLootPartySessionSummary(parsed);

  if (parsed.worldError) {
    els.lootOutputCard?.classList.add("hidden");
    if (els.lootOutput) els.lootOutput.innerHTML = "";
    renderLootPlayers(parsed.players);
    els.lootItemsCard?.classList.add("hidden");
    if (els.lootItemsGrid) els.lootItemsGrid.innerHTML = "";
    return;
  }

  renderLootPartyOutput(parsed);
  renderLootPlayers(parsed.players);
  renderLootItems(parsed.items);
}

function renderPartyLootPanels(parsed) {
  if (!parsed.players?.length) {
    setLootFeedback("Nao encontrei jogadores no padrao do Party Hunt Analyzer.", true);
    clearLootRenderPanels();
    return;
  }

  setLootFeedback(
    parsed.worldError || "Party Hunt usa os valores prontos do texto copiado. O tipo da sessao fica apenas como referencia.",
    Boolean(parsed.worldError)
  );

  els.lootMonstersCard?.classList.add("hidden");
  if (els.lootMonstersGrid) {
    els.lootMonstersGrid.innerHTML = "";
  }
  renderLootPartySessionSummary(parsed);

  if (parsed.worldError) {
    els.lootOutputCard?.classList.add("hidden");
    if (els.lootOutput) {
      els.lootOutput.innerHTML = "";
    }
    renderLootPlayers(parsed.players);
    els.lootItemsCard?.classList.add("hidden");
    if (els.lootItemsGrid) {
      els.lootItemsGrid.innerHTML = "";
    }
    return;
  }

  renderLootPartyOutput(parsed);
  renderLootPlayers(parsed.players);
  renderLootItems(parsed.items);
}

function rerenderSoloLootPanels() {
  if (state.lootMode !== "solo" || !state.lootParsed) {
    renderLootSplitter();
    return;
  }

  try {
    renderSoloLootSessionSummary(state.lootParsed);
    renderSoloLootOutput(state.lootParsed);
    renderSoloLootPlayer(state.lootParsed);
    renderLootMonsters(state.lootParsed.monsters);
    renderLootItems(state.lootParsed.items);
  } catch (error) {
    console.error(`[solo-loot-rerender] ${error?.stack || error?.message || String(error)}`);
    throw error;
  }
}

function clearLootRenderPanels() {
  if (els.lootSessionSummary) els.lootSessionSummary.innerHTML = "";
  if (els.lootPlayerGrid) els.lootPlayerGrid.innerHTML = "";
  els.lootMonstersCard?.classList.add("hidden");
  if (els.lootMonstersGrid) els.lootMonstersGrid.innerHTML = "";
  els.lootItemsCard?.classList.add("hidden");
  if (els.lootItemsGrid) els.lootItemsGrid.innerHTML = "";
  els.lootOutputCard?.classList.add("hidden");
  if (els.lootOutput) els.lootOutput.innerHTML = "";
}

function renderLootPartySessionSummary(parsed) {
  if (!els.lootSessionSummary) {
    return;
  }

  els.lootSessionSummary.innerHTML = normalizeUiText(`
    <div class="loot-summary-chip"><span>Sessão</span><strong>${escapeHtml(parsed.session || "-")}</strong></div>
    <div class="loot-summary-chip"><span>Período</span><strong>${escapeHtml(parsed.sessionData || "-")}</strong></div>
    <div class="loot-summary-chip"><span>Tipo</span><strong>${escapeHtml(parsed.lootType || "-")}</strong></div>
    <div class="loot-summary-chip"><span>Players</span><strong>${parsed.players.length}</strong></div>
    <div class="loot-summary-chip"><span>Balance total</span><strong class="${getBalanceClass(parsed.totalBalance)}">${renderLootValue(parsed.totalBalance, "gp")}</strong></div>
    <div class="loot-summary-chip"><span>Por pessoa</span><strong class="${getBalanceClass(parsed.perPerson)}">${renderLootValue(parsed.perPerson, "gp")}</strong></div>
  `);
  decoratePartyLootSessionSummary();
  bindSkillDynamicTooltips(els.lootSessionSummary);
}

function renderSoloLootSessionSummary(parsed) {
  if (!els.lootSessionSummary) {
    return;
  }

  els.lootSessionSummary.innerHTML = normalizeUiText(`
    <div class="loot-summary-chip"><span>Sessão</span><strong>${escapeHtml(parsed.session || "-")}</strong></div>
    <div class="loot-summary-chip"><span>Período</span><strong>${escapeHtml(parsed.sessionData || "-")}</strong></div>
    <div class="loot-summary-chip"><span>XP</span><strong>${renderLootValue(parsed.xpGain)} (${renderLootValue(parsed.xpHour)}/h)</strong></div>
    <div class="loot-summary-chip"><span>Raw XP</span><strong>${renderLootValue(parsed.rawXpGain)} (${renderLootValue(parsed.rawXpHour)}/h)</strong></div>
    <div class="loot-summary-chip"><span>Loot</span><strong>${renderLootValue(parsed.totalLoot, "gp")}</strong></div>
    <div class="loot-summary-chip"><span>Supplies</span><strong>${renderLootValue(parsed.totalSupplies, "gp")}</strong></div>
    <div class="loot-summary-chip"><span>Balance</span><strong class="${getBalanceClass(parsed.totalBalance)}">${renderLootValue(parsed.totalBalance, "gp")}</strong></div>
    <div class="loot-summary-chip"><span>Damage</span><strong>${renderLootValue(parsed.damage)} (${renderLootValue(parsed.damageHour)}/h)</strong></div>
    <div class="loot-summary-chip"><span>Healing</span><strong>${renderLootValue(parsed.healing)} (${renderLootValue(parsed.healingHour)}/h)</strong></div>
  `);
  decorateSoloLootSessionSummary();
  bindSkillDynamicTooltips(els.lootSessionSummary);
}

function decoratePartyLootSessionSummary() {
  if (!els.lootSessionSummary) {
    return;
  }

  const chips = [...els.lootSessionSummary.querySelectorAll(".loot-summary-chip")];
  const periodChip = chips.find((chip) => chip.querySelector("span")?.textContent?.trim() === "Período");
  decorateLootPeriodValue(periodChip?.querySelector("strong"));
}

function decorateSoloLootSessionSummary() {
  if (!els.lootSessionSummary) {
    return;
  }

  const chips = [...els.lootSessionSummary.querySelectorAll(".loot-summary-chip")];

  chips.forEach((chip) => {
    const label = chip.querySelector("span")?.textContent?.trim() || "";
    const strong = chip.querySelector("strong");

    if (!strong) {
      return;
    }

    if (label === "Período") {
      decorateLootPeriodValue(strong);
      return;
    }

    if (label === "Loot" || label === "Supplies" || label === "Balance") {
      strong.classList.add("loot-summary-currency");
    }

    if (label === "Damage") {
      strong.classList.add("loot-summary-damage");
    }

    if (!["XP", "Raw XP", "Damage", "Healing"].includes(label)) {
      return;
    }

    const text = (strong.textContent || "").trim();
    const match = text.match(/^(.*?)\s*\((.*?)\)$/);
    if (!match) {
      return;
    }

    strong.classList.add("loot-summary-metric");
    strong.innerHTML = `<span>${escapeHtml(match[1].trim())}</span><small>(${escapeHtml(match[2].trim())})</small>`;
  });
}

function decorateLootPeriodValue(strong) {
  if (!strong) {
    return;
  }

  const originalText = (strong.textContent || "").trim();
  strong.classList.add("loot-period-value");

  if (!originalText) {
    return;
  }

  const segmentMatch = originalText.match(
    /^(From)\s+(\d{4}-\d{2}-\d{2},?\s+\d{2}:\d{2}:\d{2})\s+(to)\s+(\d{4}-\d{2}-\d{2},?\s+\d{2}:\d{2}:\d{2})$/i
  );

  if (segmentMatch) {
    strong.innerHTML = [
      `<span class="loot-period-segment"><span class="loot-period-word">${escapeHtml(segmentMatch[1])}</span> <span class="loot-period-datetime">${escapeHtml(segmentMatch[2])}</span></span>`,
      `<span class="loot-period-segment"><span class="loot-period-word">${escapeHtml(segmentMatch[3])}</span> <span class="loot-period-datetime">${escapeHtml(segmentMatch[4])}</span></span>`
    ].join("");
    return;
  }

  strong.innerHTML = escapeHtml(originalText).replace(
    /(\d{4}-\d{2}-\d{2},?\s+\d{2}:\d{2}:\d{2})/g,
    '<span class="loot-period-datetime">$1</span>'
  );
}

function renderSoloLootPlayer(parsed) {
  const profile = state.lootSoloProfile || {};
  renderLootPlayers([{
    name: state.lootSoloCharacterName || "Personagem não informado",
    level: profile.level || null,
    vocation: profile.vocation || "",
    sex: profile.sex || "",
    world: profile.world || "",
    loot: parsed.totalLoot,
    supplies: parsed.totalSupplies,
    balance: parsed.totalBalance,
    damage: parsed.damage,
    healing: parsed.healing,
    xpGain: parsed.xpGain
  }]);
}

function renderLootMonsters(monsters) {
  if (!els.lootMonstersCard || !els.lootMonstersGrid) {
    return;
  }

  if (!Array.isArray(monsters) || monsters.length === 0) {
    els.lootMonstersCard.classList.add("hidden");
    els.lootMonstersGrid.innerHTML = "";
    return;
  }

  els.lootMonstersCard.classList.remove("hidden");
  els.lootMonstersGrid.innerHTML = normalizeUiText(monsters.map((monster) => {
    const local = findLocalCreature(monster.name);
    const name = local?.name || monster.name;
    const imageSrc = local?.imageSrc || getCreatureFallbackImageSrc(name);
    const quantity = Number(monster.quantity) || 1;
    const baseUnitXp = Number(local?.experience) || Number(local?.xp) || 0;
    const doubleXpActive = state.lootMode === "solo" && Boolean(state.lootSoloDoubleXp);
    const unitXp = doubleXpActive ? baseUnitXp * 2 : baseUnitXp;
    const totalXp = unitXp * quantity;

    return `
      <button type="button" class="loot-item-tile loot-monster-tile" data-loot-monster-name="${escapeHtml(name)}" data-tooltip="${escapeHtml(t("common.viewDetails"))}">
        ${imageSrc ? `<img class="loot-tile-icon" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(name)}">` : ""}
        <span>${escapeHtml(quantity)}x</span>
        <strong>${escapeHtml(name)}</strong>
        ${unitXp ? `<small>XP: ${renderLootValue(unitXp)}</small>` : ""}
        ${totalXp ? `<small class="loot-tile-total">Total: ${renderLootValue(totalXp, "XP")}</small>` : ""}
        ${doubleXpActive && unitXp ? '<small class="loot-monster-event">Evento Double</small>' : ""}
      </button>
    `;
  }).join(""));
  bindSkillDynamicTooltips(els.lootMonstersGrid);
}

function renderLootPartyOutputLegacy(parsed) {
  if (!els.lootOutput || !els.lootOutputCard) {
    return;
  }

  if (els.lootOutputSubtitle) {
    els.lootOutputSubtitle.textContent = "Transferências calculadas para igualar o balance da party.";
  }

  const lines = parsed.transfers.map(
    (transfer) => `
      <div class="loot-output-line">
        <span class="loot-output-name">${escapeHtml(transfer.from)}</span>
        deve pagar
        <span class="loot-output-value">${formatLootGold(transfer.amount)} gp</span>
        para
        <span class="loot-output-name">${escapeHtml(transfer.to)}</span>.
        <span class="loot-output-command">(transfer ${transfer.amount} to ${escapeHtml(transfer.to)})</span>
      </div>`
  );
  lines.push(`<div class="loot-output-line">Saldo total: <span class="${getBalanceClass(parsed.totalBalance)}">${formatLootGold(parsed.totalBalance)} gp</span></div>`);
  lines.push(`<div class="loot-output-line">Número de pessoas: <span class="loot-output-value">${parsed.players.length}</span></div>`);
  lines.push(`<div class="loot-output-line">Saldo por pessoa: <span class="${getBalanceClass(parsed.perPerson)}">${formatLootGold(parsed.perPerson)} gp</span></div>`);

  els.lootOutput.innerHTML = normalizeUiText(lines.join(""));
  els.lootOutputCard.classList.remove("hidden");
}

function renderLootPartyOutput(parsed) {
  if (!els.lootOutput || !els.lootOutputCard) {
    return;
  }

  if (els.lootOutputSubtitle) {
    els.lootOutputSubtitle.textContent = "Transferências calculadas para igualar o balance da party.";
  }

  const lines = parsed.transfers.map((transfer) => {
    const command = `transfer ${transfer.amount} to ${transfer.to}`;
    return `
      <div class="loot-output-line loot-output-transfer-line" data-transfer-command="${escapeHtml(command)}" data-tooltip="Copie o texto e envie ao NPC" role="button" tabindex="0">
        <span class="loot-output-transfer-text">
          <span class="loot-output-name">${escapeHtml(transfer.from)}</span>
          deve pagar
          <span class="loot-output-value">${renderLootValue(transfer.amount, "gp")}</span>
          para
          <span class="loot-output-name">${escapeHtml(transfer.to)}</span>.
          <span class="loot-output-command">(${escapeHtml(command)})</span>
        </span>
        <span class="loot-output-copy-icon" aria-hidden="true">
          <img class="copy-sprite-icon copy-sprite-icon-off" src="assets/ui/copy/copiar-off.png" alt="">
          <img class="copy-sprite-icon copy-sprite-icon-hover" src="assets/ui/copy/copiar-hover.png" alt="">
          <img class="copy-sprite-icon copy-sprite-icon-on" src="assets/ui/copy/copiar-on.png" alt="">
        </span>
      </div>
    `;
  });

  lines.push(`<div class="loot-output-line">Saldo total: <span class="${getBalanceClass(parsed.totalBalance)}">${renderLootValue(parsed.totalBalance, "gp")}</span></div>`);
  lines.push(`<div class="loot-output-line">Número de pessoas: <span class="loot-output-value">${parsed.players.length}</span></div>`);
  lines.push(`<div class="loot-output-line">Saldo por pessoa: <span class="${getBalanceClass(parsed.perPerson)}">${renderLootValue(parsed.perPerson, "gp")}</span></div>`);

  els.lootOutput.innerHTML = normalizeUiText(lines.join(""));
  els.lootOutputCard.classList.remove("hidden");
  bindSkillDynamicTooltips(els.lootOutput);
}

function renderSoloLootOutputLegacy(parsed) {
  if (!els.lootOutput || !els.lootOutputCard) {
    return;
  }

  if (els.lootOutputSubtitle) {
    els.lootOutputSubtitle.textContent = "Resumo calculado da hunt solo.";
  }

  els.lootOutput.innerHTML = normalizeUiText(`
    <div class="loot-output-line">Saldo da sessão: <span class="${getBalanceClass(parsed.totalBalance)}">${formatLootGold(parsed.totalBalance)} gp</span></div>
    <div class="loot-output-line">Loot: <span class="loot-output-value">${formatLootGold(parsed.totalLoot)} gp</span></div>
    <div class="loot-output-line">Supplies: <span class="loot-output-value">${formatLootGold(parsed.totalSupplies)} gp</span></div>
    <div class="loot-output-line">XP/h: <span class="loot-output-value">${formatLootGold(parsed.xpHour)}</span></div>
    <div class="loot-output-line">Damage/h: <span class="loot-output-value">${formatLootGold(parsed.damageHour)}</span></div>
    <div class="loot-output-line">Healing/h: <span class="loot-output-value">${formatLootGold(parsed.healingHour)}</span></div>
  `);
  els.lootOutputCard.classList.remove("hidden");
}

function renderSoloLootOutput(parsed) {
  if (!els.lootOutput || !els.lootOutputCard) {
    return;
  }

  if (els.lootOutputSubtitle) {
    els.lootOutputSubtitle.textContent = "Resumo calculado da hunt solo.";
  }

  els.lootOutput.innerHTML = normalizeUiText(`
    <div class="loot-output-line">Saldo da sessão: <span class="${getBalanceClass(parsed.totalBalance)}">${renderLootValue(parsed.totalBalance, "gp")}</span></div>
    <div class="loot-output-line">Loot: <span class="loot-output-value">${renderLootValue(parsed.totalLoot, "gp")}</span></div>
    <div class="loot-output-line">Supplies: <span class="loot-output-value">${renderLootValue(parsed.totalSupplies, "gp")}</span></div>
    <div class="loot-output-line">XP/h: <span class="loot-output-value">${renderLootValue(parsed.xpHour)}</span></div>
    <div class="loot-output-line">Damage/h: <span class="loot-output-value">${renderLootValue(parsed.damageHour)}</span></div>
    <div class="loot-output-line">Healing/h: <span class="loot-output-value">${renderLootValue(parsed.healingHour)}</span></div>
  `);
  els.lootOutputCard.classList.remove("hidden");
  bindSkillDynamicTooltips(els.lootOutput);
}

function findLocalCreature(name) {
  const normalizeCreatureReference = (value) => normalizeSearchText(
    String(value || "").replace(/\s+\((?:Criatura|Creature)\)$/i, "").trim()
  );
  const normalized = normalizeCreatureReference(name);
  return state.monsterIndex.find((creature) => (
    normalizeCreatureReference(creature.name) === normalized
    || normalizeCreatureReference(creature.slug) === normalized
  )) || null;
}

function getCreatureFallbackImageSrc(name) {
  const displayName = String(name || "")
    .replace(/\s+\(Creature\)$/i, "")
    .trim();

  if (!displayName) {
    return "";
  }

  const fileName = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const [first = "", ...rest] = word;
      return `${first.toLocaleUpperCase()}${rest.join("")}`;
    })
    .join("_");

  const sourceUrl = `https://www.tibiawiki.com.br/wiki/Special:Redirect/file/${encodeURIComponent(`${fileName}.gif`)}`;
  return getRendererCachedImageUrl("creatures", displayName, sourceUrl);
}

function getRendererCachedImageUrl(category, key, sourceUrl) {
  const normalizedSource = String(sourceUrl || "").trim();

  if (!isDesktopOverlayApp() || !/^https?:\/\//i.test(normalizedSource)) {
    return normalizedSource;
  }

  if (window.desktopApi?.app?.runtimeChannel === "portable-test") {
    return normalizedSource;
  }

  return `poioso-cache://${sanitizeCacheSegment(category || "misc")}/${encodeURIComponent(
    sanitizeCacheSegment(key || "asset")
  )}?url=${encodeURIComponent(normalizedSource)}`;
}

function sanitizeCacheSegment(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";
}

async function openLootMonster(name) {
  if (!name) {
    return;
  }

  const local = findLocalCreature(name);
  if (!local?.name) {
    return;
  }
  pushCurrentNavigationEntry();
  switchSection("npcs", { skipHistory: true });
  await setEntityViewMode(local?.bossCategory ? "bosses" : "monsters", {
    skipHistory: true
  });
  await openMonsterDetail(local.name, { skipHistory: true });
}

async function openLootItem(name) {
  if (!name) {
    return;
  }

  state.selectedItemSuggestion = {
    slug: slugifyItemInput(name),
    name,
    category: "Item",
    imageSrc: ""
  };
  els.itemInput.value = name;
  pushCurrentNavigationEntry();
  switchSection("item-prices", { skipHistory: true });
  await handleItemSearch(true);
}

async function ensureMiniWorldChangesLoaded() {
  if (state.miniWorldChangesLoaded || state.miniWorldChangesLoading) {
    renderMiniWorldChanges();
    return;
  }

  await loadMiniWorldChanges();
}

async function loadMiniWorldChanges(options = {}) {
  if (state.miniWorldChangesLoading && !options.force) {
    return;
  }

  const selectedWorld = getSelectedWorld();
  const requestId = ++state.miniWorldChangesRequestId;
  state.miniWorldChangesLoading = true;
  renderMiniWorldChanges();

  try {
    const payload = await fetchMiniWorldChanges({ worldName: selectedWorld?.name || "" });
    if (requestId !== state.miniWorldChangesRequestId) {
      return;
    }

    state.miniWorldChangesCatalog = groupMiniWorldChangesCatalog(
      Array.isArray(payload?.catalog) ? payload.catalog : []
    );
    registerProtectedPhrases(state.miniWorldChangesCatalog.flatMap((entry) => [
      entry.name,
      ...(Array.isArray(entry.sourceAliases) ? entry.sourceAliases : [])
    ]));
    state.miniWorldChangesActiveWorld = payload?.activeWorld || null;
    state.miniWorldChangesActiveError = String(payload?.activeError || "");
    state.miniWorldChangesLoaded = true;
    renderToolbarWorldStatus();
  } catch (error) {
    if (requestId === state.miniWorldChangesRequestId) {
      state.miniWorldChangesActiveError = error instanceof Error ? error.message : String(error || "");
    }
  } finally {
    if (requestId === state.miniWorldChangesRequestId) {
      state.miniWorldChangesLoading = false;
      renderMiniWorldChanges();
      renderToolbarWorldStatus();
    }
  }
}

async function loadToolbarWorldStatus() {
  if (!els.desktopWorldStatus || state.boostedStatus.loading) {
    return;
  }

  const requestId = ++state.boostedStatus.requestId;
  state.boostedStatus.loading = true;
  renderToolbarWorldStatus();

  try {
    const payload = await fetchBoosted();
    if (requestId !== state.boostedStatus.requestId) {
      return;
    }
    state.boostedStatus.creature = payload?.creature || null;
    state.boostedStatus.boss = payload?.boss || null;
  } catch (_error) {
    // The status keeps its last verified values if the shared cache is briefly unavailable.
  } finally {
    if (requestId === state.boostedStatus.requestId) {
      state.boostedStatus.loading = false;
      renderToolbarWorldStatus();
    }
  }
}

function renderToolbarWorldStatus() {
  if (!els.desktopWorldStatus) {
    return;
  }

  const renderBoostedCard = (button, image, entry, labelKey) => {
    if (!button || !image) return;
    const label = t(labelKey);
    const name = String(entry?.name || "").trim();
    const sources = getBoostedSpriteSources(name, entry);
    const source = sources[0] || "";
    const tooltip = name ? `${label}: ${name}` : t("toolbar.loadingBoosted");
    button.disabled = !name;
    button.dataset.tooltip = tooltip;
    button.setAttribute("aria-label", tooltip);
    if (source) {
      image.src = source;
      image.dataset.fallbackSources = JSON.stringify(sources.slice(1));
    } else {
      image.removeAttribute("src");
      image.removeAttribute("data-fallback-sources");
    }
    image.hidden = !source;
    image.alt = "";
  };

  renderBoostedCard(
    els.desktopBoostedCreature,
    els.desktopBoostedCreatureImage,
    state.boostedStatus.creature,
    "toolbar.boostedCreature"
  );
  renderBoostedCard(
    els.desktopBoostedBoss,
    els.desktopBoostedBossImage,
    state.boostedStatus.boss,
    "toolbar.boostedBoss"
  );

  const active = getActiveMiniWorldChangeEntries().some((entry) =>
    normalizeMiniWorldChangeName(entry.name) === "oriental trader" ||
    (entry.sourceAliases || []).some((alias) => normalizeMiniWorldChangeName(alias) === "oriental trader")
  );
  const worldName = getSelectedWorld()?.name || t("common.world");
  const yasirStatus = t(active ? "toolbar.yasirSeenInWorld" : "toolbar.yasirNotSeenInWorld", { world: worldName });
  els.desktopYasirPodium?.classList.toggle("is-active", active);
  els.desktopYasirPodium?.classList.toggle("is-inactive", !active);
  if (els.desktopYasirPodium) {
    els.desktopYasirPodium.dataset.tooltip = yasirStatus;
    els.desktopYasirPodium.setAttribute("aria-label", yasirStatus);
  }
  if (els.desktopYasirImage) {
    els.desktopYasirImage.src = active
      ? "assets/ui/world-status/yasir-active.gif"
      : "assets/ui/world-status/yasir-still.gif";
  }
  bindSkillDynamicTooltips(els.desktopWorldStatus);
}

function getBoostedAnimatedSprite(name) {
  const normalizedName = normalizeSearchText(name);
  if (!normalizedName || !Array.isArray(state.monsterIndex)) {
    return "";
  }

  const entry = state.monsterIndex.find((candidate) => (
    normalizeSearchText(candidate?.name) === normalizedName &&
    /\.gif(?:$|[?#])/i.test(String(candidate?.imageSrc || ""))
  ));

  return String(entry?.imageSrc || "").trim();
}

function getBoostedSpriteSources(name, entry) {
  const normalizedName = normalizeSearchText(name);
  const matchingEntry = Array.isArray(state.monsterIndex)
    ? state.monsterIndex.find((candidate) => normalizeSearchText(candidate?.name) === normalizedName)
    : null;
  const slug = slugifyItemInput(name);
  // The local content pack is authoritative for the desktop UI. The daily
  // Boosted endpoint may carry an external image that is unavailable offline
  // or blocked by a remote host, so it is only a last-resort fallback.
  return [...new Set([
    getBoostedAnimatedSprite(name),
    String(matchingEntry?.imageSrc || "").trim(),
    String(matchingEntry?.stillImageSrc || "").trim(),
    slug ? `assets/data/creatures/${slug}.gif` : "",
    slug ? `assets/data/library-thumbnails/creatures/${slug}.png` : "",
    String(entry?.animatedImage || "").trim(),
    String(entry?.image || "").trim()
  ].filter(Boolean))];
}

async function openBoostedEntity(name, entityViewMode) {
  if (!name) return;
  switchSection("npcs");
  await setEntityViewMode(entityViewMode, { skipHistory: true });
  await openMonsterDetail(name);
}

function renderMiniWorldChanges() {
  renderMiniWorldChangesRefreshControl();

  if (!els.miniWorldChangesActive || !els.miniWorldChangesCatalog) {
    return;
  }

  const selectedWorld = getSelectedWorld();
  const catalog = state.miniWorldChangesCatalog;
  const activeEntries = getActiveMiniWorldChangeEntries();

  if (els.miniWorldChangesToday) {
    els.miniWorldChangesToday.textContent = t("miniWorldChanges.todayInWorld", {
      world: selectedWorld?.name || t("common.world")
    });
  }
  if (els.miniWorldChangesCount) {
    els.miniWorldChangesCount.textContent = String(catalog.length);
  }
  if (state.miniWorldChangesLoading && catalog.length === 0) {
    els.miniWorldChangesActive.innerHTML = renderMiniWorldChangesMessage(
      t("miniWorldChanges.loading"),
      "loading"
    );
  } else if (activeEntries.length > 0) {
    els.miniWorldChangesActive.innerHTML = activeEntries
      .map((entry) => renderMiniWorldChangeActiveCard(entry))
      .join("");
  } else {
    const key = state.miniWorldChangesActiveError
      ? "miniWorldChanges.activeUnavailable"
      : "miniWorldChanges.noActive";
    els.miniWorldChangesActive.innerHTML = renderMiniWorldChangesMessage(t(key));
  }

  els.miniWorldChangesCatalog.innerHTML = catalog.length > 0
    ? catalog.map((entry) => renderMiniWorldChangeCatalogRow(entry)).join("")
    : renderMiniWorldChangesMessage(t("miniWorldChanges.catalogUnavailable"));

  if (state.currentMiniWorldChangeId) {
    const current = findMiniWorldChangeById(state.currentMiniWorldChangeId);
    if (current) {
      renderMiniWorldChangeDetail(current);
    }
  }
}

const MINI_WORLD_CHANGES_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

function getMiniWorldChangesRefreshCooldownSeconds() {
  return Math.max(0, Math.ceil((state.miniWorldChangesRefreshCooldownUntil - Date.now()) / 1000));
}

function formatMiniWorldChangesRefreshCountdown(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function renderMiniWorldChangesRefreshControl() {
  const button = els.miniWorldChangesRefreshButton;
  const countdown = els.miniWorldChangesRefreshCountdown;
  if (!button) {
    return;
  }

  const remainingSeconds = getMiniWorldChangesRefreshCooldownSeconds();
  const isCoolingDown = remainingSeconds > 0;
  const isLoading = state.miniWorldChangesLoading && !isCoolingDown;
  const countdownText = formatMiniWorldChangesRefreshCountdown(remainingSeconds);
  const tooltip = isCoolingDown
    ? `${t("miniWorldChanges.refreshWait")} ${countdownText}`
    : isLoading
      ? t("miniWorldChanges.refreshing")
      : t("miniWorldChanges.refresh");

  button.classList.toggle("is-cooldown", isCoolingDown);
  button.classList.toggle("is-loading", isLoading);
  button.setAttribute("aria-disabled", isCoolingDown || isLoading ? "true" : "false");
  button.dataset.tooltip = tooltip;
  button.dataset.tooltipTone = isCoolingDown ? "danger" : "";
  button.setAttribute("aria-label", tooltip);

  if (countdown) {
    countdown.hidden = !isCoolingDown;
    countdown.textContent = isCoolingDown ? countdownText : "";
  }

  if (isCoolingDown && !state.miniWorldChangesRefreshTimer) {
    state.miniWorldChangesRefreshTimer = window.setInterval(() => {
      renderMiniWorldChangesRefreshControl();
    }, 1000);
  } else if (!isCoolingDown && state.miniWorldChangesRefreshTimer) {
    window.clearInterval(state.miniWorldChangesRefreshTimer);
    state.miniWorldChangesRefreshTimer = null;
  }

  setLiveTooltip(button, tooltip);
}

function groupMiniWorldChangesCatalog(catalog) {
  const entries = Array.isArray(catalog) ? catalog.filter(Boolean) : [];
  const dworcCamp = entries.find((entry) => entry.name === "Dworc Camp");
  const hunterCamp = entries.find((entry) => entry.name === "Hunter Camp");

  if (!dworcCamp || !hunterCamp) {
    return entries;
  }

  const text = {
    type: "localized-text",
    translations: {
      "pt-BR": "A Jungle Camp pode aparecer em duas versões: Dworc Camp ou Hunter Camp. Confira abaixo os detalhes de cada possibilidade.",
      en: "Jungle Camp can appear in two versions: Dworc Camp or Hunter Camp. See the details of each possibility below.",
      de: "Jungle Camp kann in zwei Varianten erscheinen: Dworc Camp oder Hunter Camp. Unten findest du die Details zu beiden Möglichkeiten."
    }
  };
  const heading = (value) => ({
    type: "heading",
    level: 3,
    content: [{ type: "text", text: value, marks: [] }]
  });
  const distinct = (values) => [...new Set(values.map((value) => String(value || "").trim()).filter((value) => value && value !== "-"))];
  const grouped = {
    id: "jungle-camp",
    name: "Jungle Camp",
    location: distinct([dworcCamp.location, hunterCamp.location]).join(" / "),
    achievement: distinct([dworcCamp.achievement, hunterCamp.achievement]).join(" / "),
    reward: distinct([dworcCamp.reward, hunterCamp.reward]).join(" / "),
    sourceAliases: distinct([
      "Jungle Camp",
      "Dworc Camp",
      "Hunter Camp",
      ...(dworcCamp.sourceAliases || []),
      ...(hunterCamp.sourceAliases || [])
    ]),
    representative: dworcCamp.representative,
    representatives: [dworcCamp.representative, hunterCamp.representative].filter(Boolean),
    wikiUrl: "https://www.tibiawiki.com.br/wiki/Mini_World_Changes#Dworc_Camp",
    blocks: [
      { type: "callout", tone: "note", content: [text] },
      heading("Dworc Camp"),
      ...(dworcCamp.blocks || []),
      heading("Hunter Camp"),
      ...(hunterCamp.blocks || [])
    ]
  };

  return entries
    .filter((entry) => entry !== dworcCamp && entry !== hunterCamp)
    .concat(grouped)
    .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }));
}

function renderMiniWorldChangesMessage(message, kind = "empty") {
  const loading = kind === "loading"
    ? '<span class="global-loading-spinner mini-world-changes-spinner" aria-hidden="true"></span>'
    : '<img src="assets/ui/navigation/world-board.gif" alt="">';
  return `
    <div class="mini-world-changes-empty">
      ${loading}
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function getActiveMiniWorldChangeEntries() {
  const active = Array.isArray(state.miniWorldChangesActiveWorld?.activeMiniWorldChanges)
    ? state.miniWorldChangesActiveWorld.activeMiniWorldChanges
    : [];
  const matches = [];

  for (const activeEntry of active) {
    const names = [activeEntry?.name, activeEntry?.displayName]
      .map((value) => normalizeMiniWorldChangeName(value))
      .filter(Boolean);

    for (const entry of state.miniWorldChangesCatalog) {
      const aliases = [entry.name, ...(Array.isArray(entry.sourceAliases) ? entry.sourceAliases : [])]
        .map((value) => normalizeMiniWorldChangeName(value));
      if (names.some((name) => aliases.includes(name)) && !matches.some((item) => item.id === entry.id)) {
        matches.push(entry);
      }
    }
  }

  return matches;
}

function normalizeMiniWorldChangeName(value) {
  return String(value || "").trim().toLocaleLowerCase("en");
}

function isMiniWorldChangeActive(entry) {
  return getActiveMiniWorldChangeEntries().some((activeEntry) => activeEntry.id === entry?.id);
}

function renderMiniWorldChangeActiveCard(entry) {
  return `
    <button type="button" class="mini-world-change-active-card" data-mini-world-change-id="${escapeHtml(entry.id)}">
      <strong data-i18n-preserve>${escapeHtml(entry.name)}</strong>
      ${renderMiniWorldChangeRepresentatives(entry, "mini-world-change-active-image")}
      <small>${escapeHtml(t("miniWorldChanges.viewMore"))}</small>
    </button>
  `;
}

function renderMiniWorldChangeCatalogRow(entry) {
  const achievement = String(entry.achievement || "").trim();
  return `
    <button type="button" class="mini-world-change-catalog-row" data-mini-world-change-id="${escapeHtml(entry.id)}">
      ${renderMiniWorldChangeRepresentatives(entry, "mini-world-change-catalog-image")}
      <span class="mini-world-change-catalog-copy">
        <strong data-i18n-preserve>${escapeHtml(entry.name)}</strong>
        <small>${escapeHtml(t("miniWorldChanges.location"))}: ${escapeHtml(entry.location || t("common.noData"))}</small>
      </span>
      <span class="mini-world-change-achievement">
        <small>${escapeHtml(t("miniWorldChanges.achievement"))}</small>
        <strong>${escapeHtml(achievement && achievement !== "-" ? achievement : t("miniWorldChanges.noAchievement"))}</strong>
      </span>
    </button>
  `;
}

function findMiniWorldChangeById(id) {
  return state.miniWorldChangesCatalog.find((entry) => entry.id === id) || null;
}

function openMiniWorldChangeDetail(id, options = {}) {
  const entry = findMiniWorldChangeById(id);
  if (!entry) {
    return;
  }

  if (!options.skipHistory) {
    pushCurrentNavigationEntry();
  }

  state.currentMiniWorldChangeId = entry.id;
  renderMiniWorldChangeDetail(entry);
  els.miniWorldChangesOverview?.classList.add("hidden");
  els.miniWorldChangeDetail?.classList.remove("hidden");
  els.mainContent?.scrollTo({ top: 0, behavior: "auto" });
  setCurrentNavigationEntry({
    type: "mini-world-change",
    section: "mini-world-changes",
    name: entry.name,
    slug: entry.id
  });
}

async function openOrientalTraderWorldChange() {
  switchSection("mini-world-changes");
  await ensureMiniWorldChangesLoaded();
  const entry = state.miniWorldChangesCatalog.find((candidate) =>
    normalizeMiniWorldChangeName(candidate.name) === "oriental trader" ||
    (candidate.sourceAliases || []).some((alias) => normalizeMiniWorldChangeName(alias) === "oriental trader")
  );
  if (entry) {
    openMiniWorldChangeDetail(entry.id);
  }
}

async function openYasirNpcDetail() {
  switchSection("npcs");
  await setEntityViewMode("npcs", { skipHistory: true });
  await openNpcDetail("Yasir");
}

function closeMiniWorldChangeDetail() {
  closeMiniWorldChangeImageViewer();
  stopTibiaInlineMaps(els.miniWorldChangeDetailContent);
  state.currentMiniWorldChangeId = "";
  els.miniWorldChangeDetail?.classList.add("hidden");
  els.miniWorldChangesOverview?.classList.remove("hidden");
  const previous = state.navigationBackStack[state.navigationBackStack.length - 1];
  if (previous?.type === "section" && previous.section === "mini-world-changes") {
    state.navigationBackStack.pop();
  }
  setCurrentNavigationEntry(getCurrentSectionNavigationEntry());
  els.mainContent?.scrollTo({ top: 0, behavior: "auto" });
}

function renderMiniWorldChangeDetail(entry) {
  if (!els.miniWorldChangeDetailContent) {
    return;
  }

  els.miniWorldChangeDetailTitle.textContent = entry.name;
  els.miniWorldChangeActiveBadge?.classList.toggle("hidden", !isMiniWorldChangeActive(entry));
  const isOrientalTrader = normalizeMiniWorldChangeName(entry.name) === "oriental trader" ||
    (entry.sourceAliases || []).some((alias) => normalizeMiniWorldChangeName(alias) === "oriental trader");
  els.miniWorldChangeOpenNpc?.classList.toggle("hidden", !isOrientalTrader);
  els.miniWorldChangeDetailContent.innerHTML = `
    <section class="mini-world-change-detail-summary">
      ${renderMiniWorldChangeRepresentatives(entry, "mini-world-change-detail-representatives")}
      <div>
        <p><strong>${escapeHtml(t("miniWorldChanges.location"))}:</strong> ${escapeHtml(entry.location || t("common.noData"))}</p>
        <p><strong>${escapeHtml(t("miniWorldChanges.achievement"))}:</strong> ${escapeHtml(entry.achievement || t("miniWorldChanges.noAchievement"))}</p>
        ${entry.reward ? `<p><strong>${escapeHtml(t("miniWorldChanges.reward"))}:</strong> ${escapeHtml(entry.reward)}</p>` : ""}
      </div>
    </section>
    <div class="mini-world-change-blocks">
      ${(Array.isArray(entry.blocks) ? entry.blocks : []).map(renderMiniWorldChangeBlock).join("")}
    </div>
  `;
}

function renderMiniWorldChangeRepresentatives(entry, className) {
  const representatives = Array.isArray(entry?.representatives) && entry.representatives.length
    ? entry.representatives
    : [entry?.representative].filter(Boolean);
  const values = representatives.length
    ? representatives
    : [{ localPath: "assets/ui/navigation/world-board.gif", label: entry?.name || "Mini World Change" }];

  return `
    <span class="${escapeHtml(className)}">
      ${values.map((representative) => `
        <img src="${escapeHtml(representative.localPath || "assets/ui/navigation/world-board.gif")}" alt="${escapeHtml(representative.label || entry?.name || "")}">
      `).join("")}
    </span>
  `;
}

function renderMiniWorldChangeBlock(block) {
  if (!block?.type) {
    return "";
  }

  const content = renderMiniWorldChangeBlockContent(block);
  if (!content) {
    return "";
  }

  return `
    <div class="mini-world-change-content-block">
      ${content}
      ${miniWorldChangeBlockHasMap(block) ? '<div class="boss-inline-map hidden" data-mini-world-change-inline-map></div>' : ""}
    </div>
  `;
}

function renderMiniWorldChangeBlockContent(block) {

  if (block.type === "announcement" || block.type === "transcript") {
    return `
      <section class="mini-world-change-announcement ${escapeHtml(block.kind || "")}" data-i18n-preserve>
        ${renderMiniWorldChangeImage(block.image, "mini-world-change-speaker")}
        <div>${renderMiniWorldChangeSegments(block.content, { preserveText: true })}</div>
      </section>
    `;
  }

  if (block.type === "heading") {
    const level = Math.min(4, Math.max(3, Number(block.level) || 3));
    return `<h${level} class="mini-world-change-heading">${renderMiniWorldChangeSegments(block.content)}</h${level}>`;
  }

  if (block.type === "paragraph") {
    return `<p class="mini-world-change-paragraph tone-${escapeHtml(block.tone || "default")}">${renderMiniWorldChangeSegments(block.content)}</p>`;
  }

  if (block.type === "callout") {
    return `<aside class="mini-world-change-callout tone-${escapeHtml(block.tone || "default")}">${renderMiniWorldChangeSegments(block.content)}</aside>`;
  }

  if (block.type === "list") {
    const tag = block.ordered ? "ol" : "ul";
    return `<${tag} class="mini-world-change-list">${(block.items || [])
      .map((item) => `<li>${renderMiniWorldChangeSegments(item)}</li>`)
      .join("")}</${tag}>`;
  }

  if (block.type === "gallery") {
    return `<div class="mini-world-change-gallery">${(block.items || [])
      .map((item) => `
        <figure>
          <button type="button" class="mini-world-change-gallery-button" data-mini-world-change-image="${escapeHtml(item.image?.src || "")}" data-mini-world-change-image-caption="${escapeHtml(getMiniWorldChangePlainText(item.caption))}">
            ${renderMiniWorldChangeImage(item.image)}
          </button>
          ${item.caption?.length ? `<figcaption>${renderMiniWorldChangeSegments(item.caption)}</figcaption>` : ""}
        </figure>
      `)
      .join("")}</div>`;
  }

  if (block.type === "table") {
    return `
      <div class="mini-world-change-table-scroll">
        <table class="mini-world-change-table">
          ${(block.rows || []).map((row, rowIndex) => `
            <tr>${(row || []).map((cell) => {
              const tag = rowIndex === 0 ? "th" : "td";
              return `<${tag}>${renderMiniWorldChangeSegments(cell)}</${tag}>`;
            }).join("")}</tr>
          `).join("")}
        </table>
      </div>
    `;
  }

  return "";
}

function miniWorldChangeBlockHasMap(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.some(miniWorldChangeBlockHasMap);
  if (typeof value !== "object") return false;
  if (value.type === "map") return true;
  return Object.values(value).some(miniWorldChangeBlockHasMap);
}

function getMiniWorldChangePlainText(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment) => {
      if (segment?.type === "text") return getMiniWorldChangeSegmentText(segment);
      if (segment?.type === "localized-text") return getMiniWorldChangeLocalizedText(segment);
      if (segment?.type === "entity") return segment.label || segment.name || "";
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderMiniWorldChangeSegments(segments, options = {}) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment) => renderMiniWorldChangeSegment(segment, options))
    .join("");
}

function renderMiniWorldChangeSegment(segment, options = {}) {
  if (!segment?.type) {
    return "";
  }

  if (segment.type === "break") {
    return "<br>";
  }

  if (segment.type === "image") {
    return renderMiniWorldChangeImage(segment.image, "mini-world-change-inline-image");
  }

  if (segment.type === "map") {
    const coords = `${segment.x}, ${segment.y}, ${segment.z}`;
    return `
      <button type="button" class="entity-link-chip boss-map-toggle mini-world-change-map-button" data-mini-world-change-map="${escapeHtml(segment.url || "")}" data-mini-world-change-map-title="${escapeHtml(`${t("common.map")} - ${coords}`)}">
        ${escapeHtml(t("common.showOnMap"))}
      </button>
    `;
  }

  if (segment.type === "entity") {
    return `
      <button type="button" class="mini-world-change-entity-link" data-mini-world-change-entity="${escapeHtml(segment.kind || "")}" data-entity-name="${escapeHtml(segment.name || segment.label || "")}" data-entity-slug="${escapeHtml(segment.slug || "")}" data-entity-category="${escapeHtml(segment.category || "")}">
        ${renderMiniWorldChangeMarkedText(segment.label || segment.name || "", segment.marks)}
      </button>
    `;
  }

  if (segment.type === "text") {
    const value = options.preserveText
      ? decodeMojibakeText(segment.text || "")
      : getMiniWorldChangeSegmentText(segment);
    return renderMiniWorldChangeMarkedText(value, segment.marks);
  }

  if (segment.type === "localized-text") {
    return renderMiniWorldChangeMarkedText(getMiniWorldChangeLocalizedText(segment), segment.marks);
  }

  return "";
}

function getMiniWorldChangeSegmentText(segment) {
  if (!segment?.translations) {
    return normalizeUiText(segment?.text || "");
  }
  const locale = state.localeController?.getLocale?.() || "pt-BR";
  return normalizeUiText(
    segment.translations[locale] ||
    segment.translations[locale.split("-")[0]] ||
    segment.translations["pt-BR"] ||
    segment.text ||
    ""
  );
}

function getMiniWorldChangeLocalizedText(segment) {
  const locale = state.localeController?.getLocale?.() || "pt-BR";
  return normalizeUiText(
    segment?.translations?.[locale] ||
    segment?.translations?.[locale.split("-")[0]] ||
    segment?.translations?.["pt-BR"] ||
    segment?.text ||
    ""
  );
}

function renderMiniWorldChangeMarkedText(value, marks = []) {
  let html = escapeHtml(value);
  if (marks.includes("strong")) html = `<strong>${html}</strong>`;
  if (marks.includes("emphasis")) html = `<em>${html}</em>`;
  return html;
}

function renderMiniWorldChangeImage(image, className = "") {
  if (!image?.src) {
    return "";
  }

  return `<img class="${escapeHtml(className)}" src="${escapeHtml(image.src)}" alt="${escapeHtml(decodeMojibakeText(image.alt || ""))}" loading="lazy">`;
}

function renderMiniWorldChangeInlineMap(button) {
  const block = button.closest(".mini-world-change-content-block");
  const panel = block?.querySelector("[data-mini-world-change-inline-map]");
  const url = button.dataset.miniWorldChangeMap || "";

  if (!block || !panel || !url) {
    return;
  }

  const isSameOpen = !panel.classList.contains("hidden") && panel.dataset.mapUrl === url;
  block.querySelectorAll("[data-mini-world-change-map]").forEach((entry) => {
    entry.classList.remove("active");
  });
  stopTibiaInlineMaps(panel);

  if (isSameOpen) {
    panel.classList.add("hidden");
    panel.dataset.mapUrl = "";
    panel.innerHTML = "";
    return;
  }

  button.classList.add("active");
  panel.dataset.mapUrl = url;
  panel.innerHTML = renderBossLocationMapPreview(
    url,
    button.dataset.miniWorldChangeMapTitle || t("common.map")
  );
  panel.classList.remove("hidden");
  panel.querySelectorAll("[data-tibia-inline-map]").forEach(initializeTibiaInlineMap);
}

function openMiniWorldChangeImageViewer(button) {
  const src = String(button?.dataset?.miniWorldChangeImage || "").trim();
  const caption = normalizeUiText(button?.dataset?.miniWorldChangeImageCaption || "");
  if (!src || !els.miniWorldChangeImageViewer || !els.miniWorldChangeImageViewerImage) {
    return;
  }

  els.miniWorldChangeImageViewerImage.src = src;
  els.miniWorldChangeImageViewerImage.alt = caption;
  if (els.miniWorldChangeImageViewerTitle) {
    els.miniWorldChangeImageViewerTitle.textContent = caption || t("miniWorldChanges.image");
  }
  if (els.miniWorldChangeImageViewerCaption) {
    els.miniWorldChangeImageViewerCaption.textContent = caption;
    els.miniWorldChangeImageViewerCaption.classList.toggle("hidden", !caption);
  }
  els.miniWorldChangeImageViewer.classList.remove("hidden");
  els.miniWorldChangeImageViewer.setAttribute("aria-hidden", "false");
}

function closeMiniWorldChangeImageViewer() {
  els.miniWorldChangeImageViewer?.classList.add("hidden");
  els.miniWorldChangeImageViewer?.setAttribute("aria-hidden", "true");
  if (els.miniWorldChangeImageViewerImage) {
    els.miniWorldChangeImageViewerImage.removeAttribute("src");
    els.miniWorldChangeImageViewerImage.alt = "";
  }
}

async function openMiniWorldChangeEntity(button) {
  const kind = button.dataset.miniWorldChangeEntity || "";
  const name = button.dataset.entityName || "";
  if (!name) {
    return;
  }

  if (kind === "item") {
    await openLootItem(name);
    return;
  }

  if (kind === "npc") {
    pushCurrentNavigationEntry();
    switchSection("npcs", { skipHistory: true });
    await setEntityViewMode("npcs", { skipHistory: true });
    await openNpcDetail(name, { skipHistory: true });
    return;
  }

  if (kind === "creature") {
    await openLootMonster(name);
  }
}

function showFloatingTooltip(trigger) {
  const message = trigger?.dataset?.tooltip;

  if (!message) {
    return;
  }

  const isPrimaryNavButton = trigger?.classList?.contains("nav-button") || trigger?.classList?.contains("tool-tab");
  const effectiveWidth = getDesktopEffectiveWidth();

  if (isPrimaryNavButton && effectiveWidth >= 761) {
    return;
  }

  let tooltip = document.querySelector("#floating-tooltip");

  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "floating-tooltip";
    tooltip.className = "floating-tooltip";
    document.body.appendChild(tooltip);
  } else if (tooltip.parentElement !== document.body) {
    document.body.appendChild(tooltip);
  }

  tooltip.textContent = normalizeUiText(message);
  tooltip.classList.toggle("danger", trigger?.dataset?.tooltipTone === "danger");
  tooltip.setAttribute("aria-hidden", "false");
  tooltip.classList.add("visible");

  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 8;
  const preferredLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
  const left = Math.min(
    Math.max(margin, preferredLeft),
    Math.max(margin, window.innerWidth - tooltipRect.width - margin)
  );
  const shouldOpenBelow = trigger?.dataset?.tooltipPlacement === "bottom" || (isPrimaryNavButton && effectiveWidth < 761);
  const topAbove = triggerRect.top - tooltipRect.height - margin;
  const top = shouldOpenBelow
    ? triggerRect.bottom + margin
    : (topAbove >= margin ? topAbove : triggerRect.bottom + margin);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.min(top, window.innerHeight - tooltipRect.height - margin)}px`;
}

function hideFloatingTooltip() {
  const tooltip = document.querySelector("#floating-tooltip");
  tooltip?.classList.remove("visible");
  tooltip?.setAttribute("aria-hidden", "true");
}

function setLiveTooltip(trigger, message) {
  if (!trigger) {
    return;
  }

  trigger.dataset.tooltip = message;

  const isFocused = document.activeElement === trigger;
  const isHovered = Boolean(trigger.matches?.(":hover"));

  if (!isFocused && !isHovered) {
    return;
  }

  showFloatingTooltip(trigger);
}

async function copyTransferCommand(line) {
  const command = line?.dataset?.transferCommand || "";

  if (!command) {
    return;
  }

  line.dataset.copyState = "loading";

  try {
    await copyTextToClipboard(command);
    line.dataset.copyState = "done";
  } catch (_error) {
    line.dataset.copyState = "";
    return;
  }

  window.setTimeout(() => {
    if (line.dataset.copyState === "done") {
      line.dataset.copyState = "";
    }
  }, 1200);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function bindSkillDynamicTooltips(root) {
  if (!root) {
    return;
  }

  const triggers = [];
  if (root.matches?.("[data-tooltip]")) {
    triggers.push(root);
  }

  root.querySelectorAll?.("[data-tooltip]").forEach((trigger) => {
    triggers.push(trigger);
  });

  triggers.forEach((trigger) => {
    if (trigger.dataset.tooltipBound === "true") {
      return;
    }

    trigger.dataset.tooltipBound = "true";
    trigger.addEventListener("mouseenter", () => showFloatingTooltip(trigger));
    trigger.addEventListener("focus", () => showFloatingTooltip(trigger));
    trigger.addEventListener("mouseleave", hideFloatingTooltip);
    trigger.addEventListener("blur", hideFloatingTooltip);
  });
}

function isLeaderLootType(lootType) {
  return String(lootType || "").trim().toLowerCase() === "leader";
}

function getBalanceClass(value) {
  const number = Number(value) || 0;

  if (number < 0) {
    return "negative";
  }

  if (number > 0) {
    return "positive";
  }

  return "";
}

function renderPlayerSubtitle(player) {
  if (state.lootProfilesLoading && !player.level && !player.vocation) {
    return "Consultando personagem...";
  }

  const parts = [];

  if (player.level) {
    parts.push(`Level ${player.level}`);
  }

  if (player.vocation) {
    parts.push(escapeHtml(player.vocation));
  }

  if (player.world) {
    parts.push(escapeHtml(player.world));
  }

  return parts.length > 0 ? parts.join(" - ") : "Informe o nome do personagem";
}

function getPlayerAvatarMarkup(player) {
  const outfit = getVocationOutfitPath(player.vocation, player.sex);

  if (outfit) {
    return `<img src="${outfit}" alt="${escapeHtml(player.vocation || "Vocação")}">`;
  }

  return `<span>${escapeHtml(getPlayerInitials(player.name))}</span>`;
}

function getVocationOutfitPath(vocation, sex) {
  const normalized = String(vocation || "").toLowerCase().replace(/[^a-z]/g, "");
  const gender = String(sex || "").toLowerCase() === "female" ? "female" : "male";
  const baseKey = Object.keys(VOCATION_OUTFITS).find((key) => normalized.includes(key));

  if (!baseKey) {
    return "";
  }

  return VOCATION_OUTFITS[baseKey]?.[gender] || VOCATION_OUTFITS[baseKey]?.male || "";
}

function formatLootGold(value) {
  return formatAbbreviatedNumberForUi(Math.round(Number(value) || 0));
}

function renderLootValue(value, unit = "") {
  return renderCurrencyValue(Math.round(Number(value) || 0), unit);
}

function getPlayerInitials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

function getValueTierClass(value) {
  const amount = Number(value) || 0;

  if (amount >= 1000000) return "value-tier-legendary";
  if (amount >= 100000) return "value-tier-epic";
  if (amount >= 10000) return "value-tier-rare";
  if (amount >= 1000) return "value-tier-uncommon";
  if (amount > 0) return "value-tier-common";
  return "value-tier-empty";
}

async function refreshCurrencyRates(options = {}) {
  const worldSlug = options.worldSlug || state.currentWorldSlug;
  const requestId = ++state.currencyRatesRequestId;
  const nextRates = await fetchCurrencyRates({
    worldSlug,
    forceFresh: true
  });

  if (requestId !== state.currencyRatesRequestId || worldSlug !== state.currentWorldSlug) {
    return null;
  }

  state.currencyRates = nextRates;
  return nextRates;
}

async function refreshImbuementWorldDataLegacy() {
  const selectedWorld = getSelectedWorld();

  if (!selectedWorld?.name) {
    return;
  }

  const cachedEntry = await loadStoredImbuementMarket(selectedWorld.name);
  const cachedMarket = cachedEntry?.value || null;
  const hasCachedMarket = Boolean(cachedMarket);
  const shouldShowLoading = !hasCachedMarket;

  setImbuementLoading({
    active: true,
    message: `Carregando preços de ${selectedWorld.name}...`,
    progress: 18
  });
  state.imbuementMarket = null;
  state.imbuementRates = {
    tibiaCoinPrice: null,
    goldTokenPrice: null,
    goldTokenBuyPrice: null
  };
  renderImbuement();
  setImbuementFeedback("Carregando preços de imbuement...");
  els.imbuementStatusBadge.textContent = `Atualizado: ${formatIsoDateTime(state.imbuementMarket?.updatedAt)}`;

  try {
    state.imbuementMarket = await fetchImbuementMarket({
      worldName: selectedWorld.name,
      forceFresh: true
    });
    state.imbuementRates = state.imbuementMarket.rates || state.imbuementRates;
    setImbuementLoading({
      active: true,
      message: "Preços recebidos. Finalizando ingredientes...",
      progress: 62
    });
    renderImbuement();
    await ensureIngredientMetadata(getCurrentIngredients().map((ingredient) => ingredient.name));
    setImbuementLoading({
      active: true,
      message: "Montando comparação final...",
      progress: 92
    });
    renderImbuement();
    setImbuementFeedback("Calculadora pronta.");
    setImbuementLoading({
      active: false,
      message: "",
      progress: 100
    });
    void warmImbuementMetadata().catch(() => {});
  } catch (error) {
    setImbuementLoading({
      active: false,
      message: "",
      progress: 0
    });
    setImbuementFeedback(
      error instanceof Error ? error.message : "Falha ao carregar os imbuements.",
      true
    );
  }
}

async function refreshImbuementWorldData() {
  const selectedWorld = getSelectedWorld();

  if (!selectedWorld?.name) {
    return;
  }

  const requestId = ++state.imbuementRequestId;
  const refreshStartedAt = performance.now();
  state.imbuementRequestInFlightWorldSlug = selectedWorld.slug;
  const ingredientNames = getCurrentIngredients().map((ingredient) => ingredient.name);
  const metadataStartedAt = performance.now();
  // Item sprites are local and independent from Market. Start them immediately
  // from the same in-memory Stash index used by Solo Hunt instead of waiting
  // for the world-price request to finish first.
  const ingredientMetadataPromise = ensureIngredientMetadata(ingredientNames)
    .then(() => {
      if (requestId === state.imbuementRequestId && state.currentWorldSlug === selectedWorld.slug) {
        renderImbuement();
      }
      return true;
    })
    .catch(() => false);

  const cachedEntry = await loadStoredImbuementMarket(selectedWorld.name);
  const cachedMarket = cachedEntry?.value || null;
  const hasCachedMarket = Boolean(cachedMarket);
  const shouldShowLoading = !hasCachedMarket;
  void recordPerformanceMetric("imbuement-cache-ready", {
    worldSlug: selectedWorld.slug,
    elapsedMs: Math.round(performance.now() - refreshStartedAt),
    cached: hasCachedMarket
  });

  if (hasCachedMarket) {
    state.imbuementMarket = cachedMarket;
    state.imbuementRates = cachedMarket.rates || state.imbuementRates;
    renderImbuement();
    setImbuementFeedback(
      isImbuementCacheCurrentDay(cachedEntry)
        ? "Base salva do dia carregada."
        : "Base salva carregada. Atualizando em segundo plano..."
    );
    setImbuementLoading({
      active: false,
      message: "",
      progress: 100
    });
  } else {
    setImbuementLoading({
      active: true,
      message: `Carregando preços de ${selectedWorld.name}...`,
      progress: 18
    });
    state.imbuementMarket = null;
    state.imbuementRates = {
      tibiaCoinPrice: null,
      goldTokenPrice: null,
      goldTokenBuyPrice: null
    };
    renderImbuement();
    setImbuementFeedback("Carregando preços de imbuement...");
  }

  els.imbuementStatusBadge.textContent = `Atualizado: ${formatIsoDateTime(state.imbuementMarket?.updatedAt)}`;

  try {
    const fetchedMarket = await fetchImbuementMarket({
      worldName: selectedWorld.name,
      forceFresh: true
    });

    void recordPerformanceMetric("imbuement-market-ready", {
      worldSlug: selectedWorld.slug,
      elapsedMs: Math.round(performance.now() - refreshStartedAt),
      cached: hasCachedMarket
    });

    if (requestId !== state.imbuementRequestId || state.currentWorldSlug !== selectedWorld.slug) {
      return;
    }

    state.imbuementMarket = fetchedMarket;
    state.imbuementRates = state.imbuementMarket.rates || state.imbuementRates;

    if (shouldShowLoading) {
      setImbuementLoading({
        active: true,
        message: "Preços recebidos. Finalizando ingredientes...",
        progress: 62
      });
    }

    renderImbuement();
    const metadataReady = await ingredientMetadataPromise;
    void recordPerformanceMetric("imbuement-ingredients-ready", {
      worldSlug: selectedWorld.slug,
      elapsedMs: Math.round(performance.now() - refreshStartedAt),
      metadataElapsedMs: Math.round(performance.now() - metadataStartedAt),
      ingredientCount: ingredientNames.length,
      available: metadataReady
    });

    if (requestId !== state.imbuementRequestId || state.currentWorldSlug !== selectedWorld.slug) {
      return;
    }

    if (shouldShowLoading) {
      setImbuementLoading({
        active: true,
        message: "Montando comparação final...",
        progress: 92
      });
    }

    renderImbuement();
    setImbuementFeedback("Calculadora pronta.");

    if (shouldShowLoading) {
      setImbuementLoading({
        active: false,
        message: "",
        progress: 100
      });
    }

    void warmImbuementMetadata().catch(() => {});
  } catch (error) {
    void recordPerformanceMetric("imbuement-refresh-failed", {
      worldSlug: selectedWorld.slug,
      elapsedMs: Math.round(performance.now() - refreshStartedAt),
      stage: state.imbuementMarket ? "market-or-ingredients" : "initial-market"
    });
    setImbuementLoading({
      active: false,
      message: "",
      progress: 0
    });
    setImbuementFeedback(
      error instanceof Error ? error.message : "Falha ao carregar os imbuements.",
      true
    );
  } finally {
    if (requestId === state.imbuementRequestId && state.currentWorldSlug === selectedWorld.slug) {
      state.imbuementRequestInFlightWorldSlug = null;
    }
  }
}

function ensureIngredientMetadata(names = getCurrentIngredients().map((ingredient) => ingredient.name)) {
  const requestedNames = [...new Set(
    names
      .map((name) => String(name || "").trim())
      .filter(Boolean)
  )];
  const missingNames = requestedNames
    .filter((name) => !state.ingredientMetaByName[name]);

  if (missingNames.length === 0) {
    return Promise.resolve();
  }

  const worldSlug = state.currentWorldSlug || "";
  if (ingredientMetadataPromise) {
    const activePromise = ingredientMetadataPromise;
    const sameWorld = ingredientMetadataPromiseWorldSlug === worldSlug;
    const alreadyCovered = sameWorld && missingNames.every((name) => (
      ingredientMetadataPromiseNames.has(name)
    ));

    // Reuse the same request when it covers this set.  If another caller
    // needs additional names, wait for the active request and then re-check
    // the index; only the genuinely missing remainder starts a follow-up.
    if (alreadyCovered) {
      return activePromise;
    }
    return activePromise.then(() => ensureIngredientMetadata(requestedNames));
  }

  ingredientMetadataPromiseNames = new Set(missingNames);
  ingredientMetadataPromiseWorldSlug = worldSlug;

  const run = (async () => {
    // Reuse the one complete local index already shared by Stash and Solo
    // Hunt. This avoids one detailed item materialisation per ingredient and
    // lets the calculator paint its sprites while Market remains independent.
    await ensureStashLoaded().catch(() => {});
    const localMetadata = {};
    const unresolvedNames = [];
    for (const name of missingNames) {
      const lookupSlug = slugifyItemInput(name);
      const localItem = state.stashItemBySlug.get(lookupSlug) || null;
      if (!localItem) {
        unresolvedNames.push(name);
        continue;
      }
      localMetadata[name] = {
        slug: localItem.slug || lookupSlug,
        imageSrc: localItem.imageSrc || "",
        itemName: localItem.name || name
      };
    }

    const fallbackMetadata = unresolvedNames.length > 0
      ? await fetchIngredientMetadata({
          worldSlug,
          names: unresolvedNames
        })
      : {};

    state.ingredientMetaByName = {
      ...state.ingredientMetaByName,
      ...localMetadata,
      ...fallbackMetadata
    };
  })();

  let trackedPromise;
  trackedPromise = run.finally(() => {
    if (ingredientMetadataPromise === trackedPromise) {
      ingredientMetadataPromise = null;
      ingredientMetadataPromiseNames = new Set();
      ingredientMetadataPromiseWorldSlug = "";
    }
  });
  ingredientMetadataPromise = trackedPromise;
  return trackedPromise;
}

async function warmImbuementMetadata() {
  if (state.imbuementMetadataWarmupStarted) {
    return;
  }

  state.imbuementMetadataWarmupStarted = true;
  const missing = ALL_IMBUEMENT_INGREDIENT_NAMES.filter((name) => !state.ingredientMetaByName[name]);
  const batchSize = 10;

  for (let index = 0; index < missing.length; index += batchSize) {
    const batch = missing.slice(index, index + batchSize);
    await ensureIngredientMetadata(batch);
  }

  renderImbuementOptions();
  renderImbuement();
}

function hydrateWorldInputs() {
  syncWorldInputs();
}

function syncWorldInputs() {
  const selectedWorld = getSelectedWorld();
  const worldName = selectedWorld?.name || "";

  if (els.globalWorldInput) {
    els.globalWorldInput.value = worldName;
  }
  if (els.worldInput) {
    els.worldInput.value = worldName;
  }
  if (els.toolWorldInput) {
    els.toolWorldInput.value = worldName;
  }
  if (els.lootWorldInput) {
    els.lootWorldInput.value = worldName;
  }
}

function getWorldAutocompleteRefs(field) {
  if (field === "global") {
    return {
      input: els.globalWorldInput,
      button: els.globalWorldDropdownButton,
      panel: els.globalWorldSuggestions,
      suggestions: state.globalWorldSuggestions,
      open: state.globalWorldSuggestionsOpen,
      activeIndex: state.activeGlobalWorldSuggestionIndex
    };
  }

  if (field === "loot") {
    return {
      input: els.lootWorldInput,
      button: els.lootWorldDropdownButton,
      panel: els.lootWorldSuggestions,
      suggestions: state.lootWorldSuggestions,
      open: state.lootWorldSuggestionsOpen,
      activeIndex: state.activeLootWorldSuggestionIndex
    };
  }

  if (field === "tool") {
    return {
      input: els.toolWorldInput,
      button: els.toolWorldDropdownButton,
      panel: els.toolWorldSuggestions,
      suggestions: state.toolWorldSuggestions,
      open: state.toolWorldSuggestionsOpen,
      activeIndex: state.activeToolWorldSuggestionIndex
    };
  }

  return {
    input: els.worldInput,
    button: els.worldDropdownButton,
    panel: els.worldSuggestions,
    suggestions: state.itemWorldSuggestions,
    open: state.itemWorldSuggestionsOpen,
    activeIndex: state.activeItemWorldSuggestionIndex
  };
}

function setWorldAutocompleteState(field, { suggestions, open, activeIndex }) {
  if (field === "global") {
    state.globalWorldSuggestions = suggestions;
    state.globalWorldSuggestionsOpen = open;
    state.activeGlobalWorldSuggestionIndex = activeIndex;
    return;
  }

  if (field === "tool") {
    state.toolWorldSuggestions = suggestions;
    state.toolWorldSuggestionsOpen = open;
    state.activeToolWorldSuggestionIndex = activeIndex;
    return;
  }

  if (field === "loot") {
    state.lootWorldSuggestions = suggestions;
    state.lootWorldSuggestionsOpen = open;
    state.activeLootWorldSuggestionIndex = activeIndex;
    return;
  }

  state.itemWorldSuggestions = suggestions;
  state.itemWorldSuggestionsOpen = open;
  state.activeItemWorldSuggestionIndex = activeIndex;
}

function isCompactGlobalWorldPickerMode() {
  return document.body.classList.contains("desktop-mode") &&
    document.body.classList.contains("desktop-main-width-narrow") &&
    !document.body.classList.contains("desktop-docked-panel-open");
}

function resetCompactGlobalWorldPickerPosition(content) {
  if (!content) {
    return;
  }

  content.style.removeProperty("width");
  content.style.removeProperty("max-width");
  content.style.removeProperty("left");
  content.style.removeProperty("right");
  content.style.removeProperty("--global-world-compact-max-height");
  content.style.removeProperty("--global-world-compact-suggestions-max-height");
}

function syncGlobalWorldCompactState(open) {
  const shell = els.globalWorldDropdownButton?.closest(".global-world-shell");
  if (!shell) {
    return;
  }

  if (open) {
    shell.dataset.compactOpen = "true";
  } else {
    delete shell.dataset.compactOpen;
    resetCompactGlobalWorldPickerPosition(shell.querySelector(".global-world-dropdown-content"));
  }
}

function positionCompactGlobalWorldPicker() {
  const shell = els.globalWorldDropdownButton?.closest(".global-world-shell");
  const content = shell?.querySelector(".global-world-dropdown-content");
  if (!isCompactGlobalWorldPickerMode()) {
    resetCompactGlobalWorldPickerPosition(content);
    return;
  }

  if (!shell || !content || shell.dataset.compactOpen !== "true") {
    return;
  }

  const buttonRect = els.globalWorldDropdownButton.getBoundingClientRect();
  const gutter = 10;
  const availableWidth = Math.max(220, Math.floor(window.innerWidth - buttonRect.left - gutter));
  const preferredWidth = Math.min(320, Math.max(280, availableWidth));
  const width = Math.min(preferredWidth, availableWidth);
  const viewportMaxHeight = Math.max(180, Math.floor(window.innerHeight - buttonRect.bottom - gutter));
  const fiveCardsHeight = 352;
  const suggestionsMaxHeight = Math.min(fiveCardsHeight, Math.max(176, viewportMaxHeight - 50));
  const maxHeight = Math.min(viewportMaxHeight, suggestionsMaxHeight + 50);

  content.style.width = `${width}px`;
  content.style.maxWidth = `${width}px`;
  content.style.left = "0px";
  content.style.right = "auto";
  content.style.setProperty("--global-world-compact-max-height", `${maxHeight}px`);
  content.style.setProperty("--global-world-compact-suggestions-max-height", `${suggestionsMaxHeight}px`);
}

function getDesktopGlobalWorldPickerPayload() {
  return {
    anchor: (() => {
      const rect = els.globalWorldDropdownButton?.getBoundingClientRect();
      return rect
        ? { left: rect.left, top: rect.top, bottom: rect.bottom }
        : { left: 0, top: 0, bottom: 0 };
    })(),
    height: Math.min(424, Math.max(176, 44 + Math.min(6, state.worlds.length) * 53)),
    placeholder: t("toolbar.typeWorld"),
    selectedSlug: state.currentWorldSlug,
    worlds: state.worlds.map((world) => ({
      slug: String(world.slug || ""),
      name: String(world.name || ""),
      updatedLabel: world.last_update ? formatRelativeTimeFromNow(world.last_update) : "",
      battleyeIcon: getBattleyeIconPath(world),
      battleyeLabel: getBattleyeLabel(world),
      pvpLabel: getWorldPvpLabel(world.pvp_type)
    })).filter((world) => world.slug && world.name)
  };
}

async function toggleDesktopGlobalWorldPicker() {
  const button = els.globalWorldDropdownButton;
  if (!button || !window.desktopApi?.globalWorldPicker?.open) return;

  closeWorldSuggestions("global");
  const response = await window.desktopApi.globalWorldPicker.open(getDesktopGlobalWorldPickerPayload()).catch(() => null);
  button.classList.toggle("open", Boolean(response?.opened));
}

function scrollMainNav(direction) {
  if (!els.navSections) {
    return;
  }

  const distance = Math.max(120, Math.round(els.navSections.clientWidth * 0.72));
  els.navSections.scrollBy({
    left: direction * distance,
    behavior: "smooth"
  });

  window.setTimeout(updateMainNavScrollButtons, 220);
}

function updateMainNavScrollButtons() {
  if (!els.navSections || els.navScrollButtons.length === 0) {
    return;
  }

  const maxScroll = Math.max(0, els.navSections.scrollWidth - els.navSections.clientWidth);
  const hasOverflow = maxScroll > 2;
  const currentScroll = els.navSections.scrollLeft;

  els.navScrollButtons.forEach((button) => {
    const isLeft = button.dataset.navScroll === "left";
    const disabled = !hasOverflow || (isLeft ? currentScroll <= 2 : currentScroll >= maxScroll - 2);

    button.hidden = !hasOverflow;
    button.disabled = disabled;
    button.classList.toggle("soft-disabled", disabled);
  });
}

function buildWorldSuggestions(query, options = {}) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const selectedSlug = state.currentWorldSlug;
  const showAll = Boolean(options.showAll);

  return state.worlds
    .map((world) => {
      const worldName = String(world.name || "");
      const normalizedName = worldName.toLowerCase();
      let score = 0;

      if (showAll) {
        score = world.slug === selectedSlug ? 500 : 100;
      } else if (!normalizedQuery) {
        score = world.slug === selectedSlug ? 500 : 100;
      } else if (normalizedName === normalizedQuery) {
        score = 500;
      } else if (normalizedName.startsWith(normalizedQuery)) {
        score = 300;
      } else if (normalizedName.includes(normalizedQuery)) {
        score = 120;
      } else {
        return null;
      }

      return {
        score,
        world
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.world.name.localeCompare(right.world.name);
    })
    .slice(0, showAll ? state.worlds.length : 14)
    .map((entry) => entry.world);
}

async function updateWorldSuggestions(field, options = {}) {
  const { input } = getWorldAutocompleteRefs(field);
  if (!options.showAll && !input.value.trim()) {
    closeWorldSuggestions(field);
    return;
  }

  const suggestions = buildWorldSuggestions(input.value, options);

  setWorldAutocompleteState(field, {
    suggestions,
    open: suggestions.length > 0,
    activeIndex: suggestions.length > 0 ? 0 : -1
  });
  renderWorldSuggestions(field);
}

function renderWorldSuggestions(field) {
  const refs = getWorldAutocompleteRefs(field);

  if (!refs.open || refs.suggestions.length === 0) {
    refs.panel.innerHTML = "";
    refs.panel.classList.add("hidden");
    refs.button?.classList.remove("open");
    if (field === "global") {
      syncGlobalWorldCompactState(false);
    }
    return;
  }

  refs.panel.innerHTML = refs.suggestions
    .map((world, index) => {
      const activeClass = index === refs.activeIndex ? " active" : "";
      const battleyeIcon = getBattleyeIconPath(world);
      const battleyeLabel = getBattleyeLabel(world);
      const updatedLabel = world.last_update ? formatRelativeTimeFromNow(world.last_update) : "";
      const pvpLabel = getWorldPvpLabel(world.pvp_type);

      return `
        <button
          class="suggestion-button world-suggestion-button${activeClass}"
          type="button"
          data-world-field="${field}"
          data-world-index="${index}"
        >
          <div class="suggestion-meta world-suggestion-meta">
            <strong>${world.name}</strong>
            <div class="world-suggestion-line">
              ${updatedLabel ? `<span>${updatedLabel}</span>` : ""}
              ${
                battleyeIcon
                  ? `<img class="battleye-icon" src="${battleyeIcon}" alt="${battleyeLabel}" title="${battleyeLabel}">`
                  : battleyeLabel ? `<span>${battleyeLabel}</span>` : ""
              }
              ${pvpLabel ? `<span>${pvpLabel}</span>` : ""}
            </div>
          </div>
        </button>
      `;
    })
    .join("");

  showSuggestionsPanel(refs.panel);
  refs.button?.classList.add("open");
  if (field === "global") {
    syncGlobalWorldCompactState(true);
    window.requestAnimationFrame(positionCompactGlobalWorldPicker);
  }
  refs.panel.querySelectorAll("[data-world-index]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.worldIndex);
      const world = refs.suggestions[index];

      if (!world) {
        return;
      }

      await selectWorldSuggestion(field, world);
    });
  });
}

async function handleWorldInputKeydown(field, event) {
  const refs = getWorldAutocompleteRefs(field);

  if (event.key === "ArrowDown" && refs.suggestions.length > 0) {
    event.preventDefault();
    setWorldAutocompleteState(field, {
      suggestions: refs.suggestions,
      open: true,
      activeIndex: (refs.activeIndex + 1) % refs.suggestions.length
    });
    renderWorldSuggestions(field);
    return;
  }

  if (event.key === "ArrowUp" && refs.suggestions.length > 0) {
    event.preventDefault();
    setWorldAutocompleteState(field, {
      suggestions: refs.suggestions,
      open: true,
      activeIndex: (refs.activeIndex - 1 + refs.suggestions.length) % refs.suggestions.length
    });
    renderWorldSuggestions(field);
    return;
  }

  if (event.key === "Enter") {
    const world =
      refs.suggestions[refs.activeIndex] ||
      buildWorldSuggestions(refs.input.value).find(
        (entry) => entry.name.toLowerCase() === refs.input.value.trim().toLowerCase()
      ) ||
      null;

    if (world) {
      event.preventDefault();
      await selectWorldSuggestion(field, world);
    }

    return;
  }

  if (event.key === "Escape") {
    closeWorldSuggestions(field);
  }
}

async function selectWorldSuggestion(field, world) {
  if (!world?.slug) {
    return;
  }

  state.currentWorldSlug = world.slug;
  state.stashMarketById = {};
  state.stashMarketFreshIds = {};
  state.stashMarketRevision += 1;
  state.stashWorldMarketLoadedSlug = "";
  state.stashWorldMarketLoading = false;
  state.stashMarketRequestId += 1;
  state.stashLoadingMarket = false;
  state.stashMarketLoadedSignature = "";
  cancelStashMarketBackgroundRefresh();
  renderStashValueButtons();
  setGlobalLoadingAction(null);
  hideGlobalLoading();
  state.currencyRatesRequestId += 1;
  state.currencyRates = {
    tibiaCoinPrice: null,
    goldTokenPrice: null
  };
  state.currencyRatesLoading = false;
  state.currencyRatesLastAttemptAt = 0;
  state.findPartyPlayers = [];
  state.findPartyGuilds = [];
  state.findPartyWorldName = world.name;
  state.findPartyLoadedWorldSlug = "";
  state.findPartyGuildQuery = "";
  state.findPartySelectedGuilds = [];
  state.findPartyBlockedGuildMemberNames = [];
  state.findPartyGuildMembersByName = {};
  closeFindPartyGuildSuggestions();
  await saveLastWorldSlug(world.slug);
  syncWorldInputs();
  closeWorldSuggestions("item");
  closeWorldSuggestions("global");
  closeWorldSuggestions("tool");
  closeWorldSuggestions("loot");

  if (
    field !== "loot" &&
    state.selectedSection === "item-prices" &&
    state.itemViewMode === "list" &&
    state.currentItem
  ) {
    void handleItemSearch(true);
  }

  if (
    field !== "loot" &&
    state.selectedSection === "item-prices" &&
    state.itemViewMode === "stash"
  ) {
    renderStashGrid();
    scheduleStashMarketLoad();
  }

  if (field === "loot" && getActiveLootAnalyzerText().trim()) {
    parseAndRenderLootSplitter();
  }

  if (field !== "loot" && state.selectedSection === "tools") {
    scheduleActiveToolLiveDataLoad();
  }

  if (field !== "loot" && state.selectedSection === "npcs") {
    refreshOpenBossTrackerForCurrentWorld();
  }

  if (field !== "loot" && state.selectedSection === "mini-world-changes") {
    void loadMiniWorldChanges({ force: true });
  }
}

function refreshOpenBossTrackerForCurrentWorld() {
  const detail = state.currentMonsterDetail;
  const currentEntry = state.currentNavigationEntry;
  const isBossDetail = Boolean(
    detail &&
      (detail.bossCategory ||
        normalizeSearchText(detail.isBoss) === "yes" ||
        currentEntry?.category === "boss")
  );

  if (!isBossDetail) {
    return;
  }

  const shell = els.entityDetailContent?.querySelector("[data-boss-tracker-shell]");
  if (!shell) {
    return;
  }

  const requestId = ++state.monsterDetailRequestId;
  state.currentBossTracker = null;
  shell.innerHTML = normalizeUiText(`
    <div class="boss-tracker-loading" data-boss-tracker-loading>
      <span class="global-loading-spinner boss-tracker-spinner" aria-hidden="true"></span>
      <strong>Carregando estatisticas do boss...</strong>
    </div>
  `);

  const heroTitle = els.entityDetailContent?.querySelector(".entity-hero h3");
  if (heroTitle) {
    heroTitle.innerHTML = normalizeUiText(renderMonsterBossHeader(detail, null));
  }

  const mapActions = els.entityDetailContent?.querySelector("[data-boss-map-actions]");
  if (mapActions) {
    mapActions.querySelector("[data-boss-route-action-slot]")?.replaceChildren();
    const panel = mapActions.parentElement?.querySelector("[data-boss-inline-map-panel]");
    if (panel) {
      panel.classList.add("hidden");
      panel.dataset.bossMapMode = "";
      panel.innerHTML = "";
    }
  }

  void loadMonsterBossTracker(detail, requestId);
}

function closeWorldSuggestions(field) {
  setWorldAutocompleteState(field, {
    suggestions: [],
    open: false,
    activeIndex: -1
  });

  const { panel, button } = getWorldAutocompleteRefs(field);
  hideSuggestionsPanel(panel);
  button?.classList.remove("open");
  if (field === "global") {
    syncGlobalWorldCompactState(false);
  }
}

function showSuggestionsPanel(panel) {
  if (!panel) {
    return;
  }

  panel.dataset.closeId = "";
  panel.classList.remove("hidden", "closing");
}

function hideSuggestionsPanel(panel) {
  if (!panel || panel.classList.contains("hidden")) {
    return;
  }

  const closeId = `${Date.now()}-${Math.random()}`;
  panel.dataset.closeId = closeId;
  panel.classList.add("closing");
  window.setTimeout(() => {
    if (panel.dataset.closeId !== closeId) {
      return;
    }

    panel.innerHTML = "";
    panel.classList.add("hidden");
    panel.classList.remove("closing");
    panel.dataset.closeId = "";
  }, 130);
}

function getBattleyeIconPath(world) {
  if (
    !world ||
    !Object.prototype.hasOwnProperty.call(world, "battleye_protected") ||
    world.battleye_protected == null ||
    !world.battleye_protected
  ) {
    return "";
  }

  return world.battleye_date === "release"
    ? BATTLEYE_GREEN_ICON_PATH
    : BATTLEYE_YELLOW_ICON_PATH;
}

function getBattleyeLabel(world) {
  if (
    !world ||
    !Object.prototype.hasOwnProperty.call(world, "battleye_protected") ||
    world.battleye_protected == null
  ) {
    return "";
  }

  if (!world.battleye_protected) {
    return "Sem BattleEye";
  }

  return world.battleye_date === "release"
    ? "BattleEye desde o lancamento"
    : "BattleEye ativo";
}

function getWorldPvpLabel(pvpType) {
  const value = String(pvpType || "").trim();

  if (!value) {
    return "";
  }

  if (value.startsWith("Optional")) {
    return "Optional";
  }

  if (value.startsWith("Retro Hardcore")) {
    return "Retro Hardcore";
  }

  if (value.startsWith("Retro Open")) {
    return "Retro Open";
  }

  if (value.startsWith("Hardcore")) {
    return "Hardcore";
  }

  if (value.startsWith("Open")) {
    return "Open";
  }

  return value.replace(/\s+PvP$/i, "");
}

function renderItem() {
  if (!state.currentItem) {
    return;
  }

  const { item, market, selectedWorld, relatedItems } = state.currentItem;
  const formatter = (value) =>
    convertPrice(value, state.itemCurrencyMode, state.currencyRates, selectedWorld?.tc_price);
  const hasActiveMarketOffers = marketHasActiveOffers(market);
  const marketExplicitlyDisabled = isItemMarketExplicitlyDisabled(item);
  const hideCurrentMarketOfferSummary =
    marketExplicitlyDisabled || shouldHideCurrentMarketOfferSummary(item);

  els.itemSummaryEmpty.classList.add("hidden");
  els.itemSummaryContent.classList.remove("hidden");
  els.npcCard?.classList.remove("hidden");

  els.itemImage.src = item.image_src;
  els.itemImage.alt = item.name;
  els.itemCategory.textContent = item.category || "Sem categoria";
  els.itemName.textContent = item.wiki_name || item.name;
  renderItemDescription(item);
  renderItemWikiButton(item);
  renderItemStoreNote(item);
  setItemMarketVisibility(marketExplicitlyDisabled);
  setCurrentMarketOfferSummaryVisibility(hideCurrentMarketOfferSummary);
  els.connectionStatus.textContent = selectedWorld?.name || "-";
  if (!marketExplicitlyDisabled) {
    els.itemLowestSell.textContent = hasActiveMarketOffers
      ? formatter(market.sell_offer ?? market.day_lowest_sell)
      : "Sem ofertas";
    els.itemHighestBuy.textContent = hasActiveMarketOffers
      ? formatter(market.buy_offer ?? market.day_highest_buy)
      : "Sem ofertas";
    els.itemCurrentPrice.textContent = formatter(market.day_average_sell);
    els.itemMonthSell.textContent = formatter(market.month_average_sell);
    els.itemMonthBuy.textContent = formatter(market.month_average_buy);
    els.itemAvailability.textContent =
      typeof market.sell_offers === "number"
        ? `${formatCompactNumber(market.sell_offers)} ofertas de venda`
        : "-";
    renderMarketNote(market, formatter);
    els.itemDemandChip.textContent =
      typeof market.buy_offers === "number"
        ? `Buy offers: ${formatCompactNumber(market.buy_offers)}`
        : "Buy offers: -";
    els.itemStatusChip.textContent = `Dados: ${humanizeMarketStatus(market.status)}`;
    els.itemTcChip.innerHTML =
      typeof state.currencyRates.tibiaCoinPrice === "number"
        ? `TC market: ${renderCurrencyValue(state.currencyRates.tibiaCoinPrice, "gold")}`
        : "TC market: -";
    bindSkillDynamicTooltips(els.itemTcChip);
    els.itemUpdatedChip.textContent = `Atualizado: ${formatIsoDateTime(
      market.captured_at || selectedWorld.last_update
    )}`;
    renderSellRecommendation(item.npc_buy, market, formatter);
    renderMarketMetrics(market, formatter);
  } else {
    if (els.itemMarketDisabledNote) {
      els.itemMarketDisabledNote.textContent = "Esse item não pode ser comercializado pelo mercado.";
    }
    if (els.marketMetrics) {
      els.marketMetrics.innerHTML = "";
      els.marketMetrics.classList.add("hidden");
    }
    if (els.marketEmpty) {
      els.marketEmpty.textContent = "Esse item não pode ser comercializado pelo mercado.";
      els.marketEmpty.classList.remove("hidden");
    }
  }
  syncNpcTabForAvailableData(item);
  renderNpcList(els.npcBuyList, item.npc_sell, "Nenhum NPC vendedor encontrado.");
  renderNpcList(els.npcSellList, item.npc_buy, "Nenhum NPC comprador encontrado.");
  renderNpcTabs();
  renderRelatedItems(relatedItems);
  applyEditorialSectionOrder(els.itemSummaryContent, item.canonicalDocument?.presentation?.template);
}

function isItemMarketExplicitlyDisabled(item) {
  const value = String(item?.marketableExplicit || item?.marketable || "").trim().toLowerCase();
  return value === "no";
}

function shouldHideCurrentMarketOfferSummary(item) {
  const hiddenItems = new Set(["gold coin", "gold coins", "platinum coin", "crystal coin"]);
  const names = [item?.wiki_name, item?.name]
    .map((value) => normalizeSearchText(value).trim())
    .filter(Boolean);
  return names.some((name) => hiddenItems.has(name));
}

function setCurrentMarketOfferSummaryVisibility(hidden) {
  els.itemPriceSpotlightGrid?.classList.toggle("hidden", hidden);
}

function setItemMarketVisibility(disabled) {
  els.itemPriceSpotlightGrid?.classList.toggle("hidden", disabled);
  els.itemMarketNote?.classList.toggle("hidden", disabled);
  els.itemSellRecommendation?.classList.toggle("hidden", disabled);
  els.itemMarketStatGrid?.classList.toggle("hidden", disabled);
  els.itemMarketChips?.classList.toggle("hidden", disabled);
  els.itemMarketCard?.classList.toggle("hidden", disabled);
  els.itemMarketDisabledNote?.classList.toggle("hidden", !disabled);
}

function renderItemStoreNote(item) {
  if (!els.itemStoreNote) {
    return;
  }

  const meta = els.itemStoreNote.closest(".item-summary-meta");

  const storeTc = Number(item?.storeTc);

  if (!Number.isFinite(storeTc) || storeTc <= 0) {
    els.itemStoreNote.innerHTML = "";
    els.itemStoreNote.classList.add("hidden");
    meta?.classList.remove("has-store-note");
    return;
  }

  const tcLabel = storeTc === 1 ? "tibia coin" : "tibia coins";
  const storeTcText = Number(storeTc).toLocaleString("pt-BR");
  els.itemStoreNote.innerHTML = `
    <span class="store-note-line">
      <span>Esse item pode ser comprado na Store por</span>
      <img src="assets/ui/economy/Tibia_Coin_Icon.gif" alt="Tibia Coin">
      <strong>${escapeHtml(storeTcText)} ${escapeHtml(tcLabel)}</strong>
    </span>
  `;
  els.itemStoreNote.classList.remove("hidden");
  meta?.classList.add("has-store-note");
}

function renderItemWikiButton(item) {
  if (!els.itemOpenWiki) {
    return;
  }

  const wikiUrl = getPreferredItemWikiUrl(item);

  if (!wikiUrl) {
    els.itemOpenWiki.classList.add("hidden");
    els.itemOpenWiki.removeAttribute("data-external-url");
    els.itemOpenWiki.onclick = null;
    return;
  }

  els.itemOpenWiki.classList.remove("hidden");
  els.itemOpenWiki.dataset.externalUrl = wikiUrl;
  els.itemOpenWiki.onclick = null;
  if (els.itemOpenWiki.dataset.externalLinkBound !== "true") {
    els.itemOpenWiki.dataset.externalLinkBound = "true";
    els.itemOpenWiki.addEventListener("click", () => {
      const url = String(els.itemOpenWiki?.dataset.externalUrl || "").trim();
      if (url) {
        void openDesktopExternalLink(url);
      }
    });
  }
}

function getPreferredItemWikiUrl(item) {
  const explicit = String(item?.wikiUrl || "").trim();

  if (explicit && /tibiawiki\.com\.br/i.test(explicit)) {
    return explicit;
  }

  const pageTitle =
    String(item?.pageTitle || "").trim() ||
    extractWikiPageTitleFromUrl(explicit) ||
    getItemWikiBrTitleFromName(item?.wiki_name || item?.name || "");

  return pageTitle
    ? `https://www.tibiawiki.com.br/wiki/${encodeURIComponent(pageTitle)}`
    : "";
}

function extractWikiPageTitleFromUrl(urlValue) {
  try {
    const url = new URL(String(urlValue || "").trim());
    const parts = url.pathname.split("/").filter(Boolean);
    const wikiIndex = parts.findIndex((part) => part.toLowerCase() === "wiki");
    const rawTitle = wikiIndex >= 0 ? parts[wikiIndex + 1] : parts[parts.length - 1];
    return rawTitle ? decodeURIComponent(rawTitle).trim() : "";
  } catch (_error) {
    return "";
  }
}

function getItemWikiBrTitleFromName(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const [first = "", ...rest] = word;
      return `${first.toLocaleUpperCase()}${rest.join("")}`;
    })
    .join("_");
}

function renderItemDescription(item) {
  if (!els.itemDescription) {
    return;
  }

  const lines = Array.isArray(item?.description_lines)
    ? item.description_lines.filter((line) => line && !/^Loot de:/i.test(String(line).trim()))
    : [];
  const technicalLines = Array.isArray(item?.technical_description_lines)
    ? item.technical_description_lines.filter((line) => line && !/^Loot de:/i.test(String(line).trim()))
    : [];
  const droppedBy = Array.isArray(item?.droppedBy) ? item.droppedBy.filter(Boolean) : [];
  const unlinkedDroppedBy = Array.isArray(item?.unlinkedDroppedBy) ? item.unlinkedDroppedBy.filter(Boolean) : [];
  const editorialSections = {
    details: [renderItemAttributesSection(item), renderItemCanonicalFactsSection(item)].filter(Boolean).join(""),
    food: renderItemFoodSection(item),
    proficiency: renderItemProficiencySection(item),
    damageTable: [renderItemDamageTableSection(item), renderItemBaseDamageSection(item)].filter(Boolean).join(""),
    location: renderItemLocationSection(item),
    notes: renderItemNotesSection(item),
    tables: renderLibraryDataTables(item.tables)
  };
  const hasEditorialContent = Object.values(editorialSections).some(Boolean);

  if (lines.length === 0 && technicalLines.length === 0 && droppedBy.length === 0 && unlinkedDroppedBy.length === 0 && !hasEditorialContent) {
    els.itemDescription.innerHTML = "";
    els.itemDescription.classList.add("hidden");
    els.itemTechnicalDescription?.replaceChildren();
    els.itemTechnicalDescription?.classList.add("hidden");
    if (els.itemDroppedBy) {
      els.itemDroppedBy.innerHTML = "";
      els.itemDroppedBy.classList.add("hidden");
    }
    clearItemEditorialSections();
    return;
  }

  if (els.itemTechnicalDescription) {
    const technicalMarkup = technicalLines
      .map((line) => `<p>${escapeHtml(normalizeUiText(line))}</p>`)
      .join("");
    els.itemTechnicalDescription.innerHTML = technicalMarkup;
    els.itemTechnicalDescription.classList.toggle("hidden", technicalMarkup.length === 0);
    els.itemTechnicalDescription.dataset.librarySection = "technical-description";
  }

  const descriptionMarkup = lines
    .map((line) => `<p>${escapeHtml(normalizeUiText(line))}</p>`)
    .join("");
  els.itemDescription.innerHTML = descriptionMarkup;
  els.itemDescription.classList.toggle("hidden", descriptionMarkup.length === 0);
  els.itemDescription.dataset.librarySection = "description";

  if (els.itemDroppedBy) {
    const droppedByMarkup = renderItemDroppedBy(droppedBy, unlinkedDroppedBy);
    els.itemDroppedBy.innerHTML = droppedByMarkup;
    els.itemDroppedBy.classList.toggle("hidden", droppedByMarkup.length === 0);
    els.itemDroppedBy.dataset.librarySection = "loot-sources";
    bindSkillDynamicTooltips(els.itemDroppedBy);
    bindLibraryCatalogSpriteAnimations(els.itemDroppedBy);
  }

  setItemEditorialSection(els.itemDetails, editorialSections.details);
  setItemEditorialSection(els.itemFood, editorialSections.food);
  setItemEditorialSection(els.itemProficiency, editorialSections.proficiency);
  setItemEditorialSection(els.itemDamageTable, editorialSections.damageTable);
  setItemEditorialSection(els.itemLocation, editorialSections.location);
  setItemEditorialSection(els.itemNotes, editorialSections.notes);
  setItemEditorialSection(els.itemTables, editorialSections.tables);
  bindEntityDetailActions(els.itemSummaryContent);

  els.itemSummaryContent?.querySelectorAll("[data-item-spoiler-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.itemSpoilerToggle;
      const body = els.itemSummaryContent.querySelector(`[data-item-spoiler-body="${CSS.escape(key)}"]`);
      const expanded = button.getAttribute("aria-expanded") === "true";

      button.setAttribute("aria-expanded", expanded ? "false" : "true");
      button.querySelector("span").textContent = expanded
        ? t("common.show").toUpperCase()
        : t("common.hide").toUpperCase();
      body?.classList.toggle("hidden", expanded);
    });
  });

  els.itemDroppedBy?.querySelectorAll("[data-item-drop-monster]").forEach((button) => {
    button.addEventListener("click", () => {
      void openLootMonster(button.dataset.itemDropMonster || "");
    });
  });

  els.itemSummaryContent?.querySelectorAll("[data-proficiency-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const column = button.closest("[data-proficiency-column]");
      const description = column?.querySelector("[data-proficiency-description]");
      if (!column || !description) return;

      column.querySelectorAll("[data-proficiency-option]").forEach((option) => {
        const active = option === button;
        option.classList.toggle("is-active", active);
        option.setAttribute("aria-pressed", active ? "true" : "false");
      });
      description.textContent = button.dataset.proficiencyText || "";
    });
  });

  els.itemSummaryContent?.querySelectorAll("[data-item-damage-ammo]").forEach((select) => {
    select.addEventListener("change", () => {
      const table = select.closest(".item-base-damage")?.querySelector("[data-item-base-damage-table]");
      if (!table) return;
      const baseAttack = Number(select.dataset.baseAttack || 0);
      const ammoAttack = Number(select.selectedOptions?.[0]?.dataset.ammoAttack || 0);
      const model = select.dataset.damageModel;
      table.querySelectorAll("td[data-level][data-skill]").forEach((cell) => {
        const level = Number(cell.dataset.level || 0);
        const skill = Number(cell.dataset.skill || 0);
        cell.textContent = String(model === "melee"
          ? Math.round(.085 * (baseAttack + ammoAttack) * skill + level / 5)
          : Math.round(.09 * (baseAttack + ammoAttack) * skill + level / 5));
      });
    });
  });
}

function setItemEditorialSection(element, markup) {
  if (!element) return;
  element.innerHTML = markup || "";
  element.classList.toggle("hidden", !markup);
}

function clearItemEditorialSections() {
  [els.itemDetails, els.itemFood, els.itemProficiency, els.itemDamageTable, els.itemLocation, els.itemNotes, els.itemTables]
    .filter(Boolean)
    .forEach((element) => {
      element.innerHTML = "";
      element.classList.add("hidden");
    });
}

function renderItemBaseDamageSection(item = {}) {
  const model = item?.damageModel;
  // Research candidates remain stored for auditability, but must never be
  // presented as a player-facing damage table until verified against the
  // current client/server formula.
  if (!model || model.sourceStatus !== "verified-by-current-client" || !Number.isFinite(Number(model.attack))) return "";
  const ui = itemDamageUi();
  const ammunition = Array.isArray(model.ammunition) ? model.ammunition : [];
  const selected = ammunition[0] || null;
  const attack = Number(model.attack) + Number(selected?.attack || 0);
  const levels = [20, 50, 100, 200, 300, 400, 500];
  const skills = [40, 60, 80, 90, 100, 120];
  const calc = (level, skill, currentAttack) => model.model === "melee"
    ? Math.round(.085 * currentAttack * skill + level / 5)
    : Math.round(.09 * currentAttack * skill + level / 5);
  return `<section class="item-extra-section item-damage-section item-base-damage">
    <h4>${escapeHtml(ui.title)}</h4>
    ${ammunition.length ? `<label class="item-damage-ammo"><span>${escapeHtml(ui.ammunition)}</span><select data-item-damage-ammo data-base-attack="${escapeHtml(model.attack)}" data-damage-model="${escapeHtml(model.model)}">${ammunition.map((entry) => `<option value="${escapeHtml(entry.slug)}" data-ammo-attack="${escapeHtml(entry.attack)}">${escapeHtml(entry.name)} (+${escapeHtml(entry.attack)})</option>`).join("")}</select></label>` : ""}
    <div class="item-damage-table-wrap"><table class="item-damage-table" data-item-base-damage-table><thead><tr><th>${escapeHtml(ui.level)} / ${escapeHtml(ui.skill)}</th>${skills.map((skill) => `<th>${skill}</th>`).join("")}</tr></thead><tbody>${levels.map((level) => `<tr><th>${level}</th>${skills.map((skill) => `<td data-level="${level}" data-skill="${skill}">${calc(level, skill, attack)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <small>${escapeHtml(ui.note)}</small>
  </section>`;
}

function itemDamageUi() {
  const locale = state.localeController?.getLocale?.() || "pt-BR";
  return ({
    "pt-BR": { title: "Dano base", ammunition: "Munição", level: "Level", skill: "Skill", note: "Valores base calculados para a vocação correspondente, sem Roda do Destino, imbuements, crítico ou mitigação do alvo." },
    en: { title: "Base damage", ammunition: "Ammunition", level: "Level", skill: "Skill", note: "Calculated base values for the matching vocation; without Wheel, imbuements, critical hits or target mitigation." },
    de: { title: "Basisschaden", ammunition: "Munition", level: "Stufe", skill: "Skill", note: "Berechnete Basiswerte für die passende Berufung; ohne Schicksalsrad, Imbuements, kritische Treffer oder Zielminderung." }
  })[locale] || { title: "Dano base", ammunition: "Munição", level: "Level", skill: "Skill", note: "Valores base calculados para a vocação correspondente, sem Roda do Destino, imbuements, crítico ou mitigação do alvo." };
}

function renderItemFoodSection(item = {}) {
  const food = item?.food;
  if (!food || typeof food !== "object" || food.edible !== true) return "";

  const locale = state.localeController?.getLocale?.() || "pt-BR";
  const labels = {
    "pt-BR": { title: "Alimento", regeneration: "Regeneração", seconds: "segundos", quest: "Comida de quest", yes: "Sim", no: "Não", effect: "Efeito especial", recipe: "Receita" },
    en: { title: "Food", regeneration: "Regeneration", seconds: "seconds", quest: "Quest food", yes: "Yes", no: "No", effect: "Special effect", recipe: "Recipe" },
    de: { title: "Nahrung", regeneration: "Regeneration", seconds: "Sekunden", quest: "Quest-Nahrung", yes: "Ja", no: "Nein", effect: "Spezialeffekt", recipe: "Rezept" }
  }[locale] || {};
  const entries = [];
  if (Number.isFinite(Number(food.regenerationSeconds)) && Number(food.regenerationSeconds) > 0) {
    entries.push([labels.regeneration, `${food.regenerationSeconds} ${labels.seconds}`]);
  }
  if (food.questFood === true || String(food.quests || "").trim()) {
    entries.push([labels.quest, String(food.quests || labels.yes)]);
  }
  if (food.specialEffect) entries.push([labels.effect, String(food.specialEffect)]);
  if (food.recipe) entries.push([labels.recipe, String(food.recipe)]);
  const paragraphs = Array.isArray(food.paragraphs)
    ? food.paragraphs.map((paragraph) => String(paragraph || "").trim()).filter(Boolean)
    : [];
  if (!entries.length && !paragraphs.length) return "";

  return `
    <section class="item-extra-section item-food-section">
      <h4>${escapeHtml(labels.title)}</h4>
      ${renderCanonicalFactList(entries, "item-fact-list")}
      ${paragraphs.map((paragraph) => `<p>${renderLibraryNarrativeInline(paragraph, item.wiki_name || item.name || "Item", "food")}</p>`).join("")}
    </section>
  `;
}

function renderItemProficiencySection(item = {}) {
  const entries = Array.isArray(item?.proficiency)
    ? item.proficiency.map((entry) => ({
        ...entry,
        options: getItemProficiencyOptions(entry)
      }))
    : [];

  if (entries.every((entry) => entry.options.length === 0)) return "";

  const levelCount = Math.max(7, ...entries.map((entry) => Number(entry.level) || 0));
  const levels = Array.from({ length: levelCount }, (_unused, index) => {
    const level = index + 1;
    return entries.find((entry) => Number(entry.level) === level) || { level, options: [] };
  });

  return `
    <section class="item-extra-section item-proficiency-section">
      <h4>${escapeHtml(t("item.proficiency"))}</h4>
      <div class="item-proficiency-board">
        <div class="item-proficiency-grid" style="--proficiency-level-count: ${levelCount}">
          ${levels.map((entry) => {
            const options = entry.options;
            const firstText = normalizeUiText(options[0]?.text || "");
            return `
          <div class="item-proficiency-column${options.length === 0 ? " is-empty" : ""}" data-proficiency-column>
            <div class="item-proficiency-level">${escapeHtml(t("item.proficiencyLevel", { level: entry.level }))}</div>
            <div class="item-proficiency-options">
              ${options.map((option, optionIndex) => {
                const translatedText = normalizeUiText(option.text || "");
                return `
                <button
                  type="button"
                  class="item-proficiency-option${optionIndex === 0 ? " is-active" : ""}"
                  data-proficiency-option
                  data-proficiency-text="${escapeHtml(translatedText)}"
                  aria-label="${escapeHtml(translatedText)}"
                  aria-pressed="${optionIndex === 0 ? "true" : "false"}"
                >
                  <span class="item-proficiency-icon-stack" aria-hidden="true">
                    ${(option.images || []).map((image) => `
                      <img
                        src="${escapeHtml(image.src || "")}"
                        alt=""
                        title="${escapeHtml(image.title || image.alt || "")}"
                        loading="lazy"
                      >
                    `).join("")}
                  </span>
                </button>`;
              }).join("")}
            </div>
            <div class="item-proficiency-description" data-proficiency-description>${escapeHtml(firstText)}</div>
          </div>
            `;
          }).join("")}
        </div>
      </div>
    </section>
  `;
}

function getItemProficiencyOptions(entry = {}) {
  if (Array.isArray(entry.options)) return entry.options;
  return entry.text || entry.images?.length
    ? [{ text: entry.text || "", images: entry.images || [] }]
    : [];
}

function renderItemDamageTableSection(item = {}) {
  const rows = Array.isArray(item?.damageTable) ? item.damageTable : [];

  if (rows.length === 0) return "";

  return `
    <section class="item-extra-section item-damage-section">
      <h4>${escapeHtml(t("item.damageTable"))}</h4>
      <div class="item-damage-table-wrap">
        <table class="item-damage-table">
          <thead>
            <tr>
              <th rowspan="2">${escapeHtml(t("item.skill"))}</th>
              <th colspan="2">${escapeHtml(t("item.againstCreatures"))}</th>
              <th colspan="2">${escapeHtml(t("item.againstPlayers"))}</th>
            </tr>
            <tr>
              <th>${escapeHtml(t("item.average"))}</th>
              <th>${escapeHtml(t("item.maximum"))}</th>
              <th>${escapeHtml(t("item.average"))}</th>
              <th>${escapeHtml(t("item.maximum"))}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <th scope="row">${escapeHtml(row.skill)}</th>
                <td>${escapeHtml(row.creatureAverage)}</td>
                <td>${escapeHtml(row.creatureMaximum)}</td>
                <td>${escapeHtml(row.playerAverage)}</td>
                <td>${escapeHtml(row.playerMaximum)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderItemAttributesSection(item = {}) {
  const attributes = String(item?.attrib || "").trim();

  if (!attributes) {
    return "";
  }

  return `
    <section class="item-extra-section">
      <h4>Atributos</h4>
      <p>${escapeHtml(attributes)}</p>
    </section>
  `;
}

function canonicalFactEntries(facts, excludedLabels = []) {
  const excluded = new Set(excludedLabels.map((label) => normalizeSearchText(label)));
  return (Array.isArray(facts) ? facts : [])
    .map(([label, value]) => [String(label || "").trim(), String(value ?? "").trim()])
    .filter(([label, value]) => label && value && !excluded.has(normalizeSearchText(label)));
}

function renderCanonicalFactList(entries, className = "") {
  if (!entries.length) return "";
  return `
    <dl class="library-fact-list ${escapeHtml(className)}">
      ${entries.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${renderLibraryNarrativeInline(value, "Item", `fact-${label}`)}</dd></div>`).join("")}
    </dl>
  `;
}

function renderItemCanonicalFactsSection(item = {}) {
  // The app already has dedicated visuals for market, NPC prices, drops,
  // technical green text, notes, location and proficiency. Only facts that
  // do not belong to any of those existing surfaces appear here.
  const entries = canonicalFactEntries(item.canonicalFacts, [
    "Categoria", "Category", "Kategorie", "Peso", "Weight", "Gewicht",
    "Notas", "Notes", "Hinweise", "Localização", "Location", "Fundort", "Local", "Ort",
    "Drop de", "Dropped by", "Fallengelassen von", "Comprado por", "Bought by", "Gekauft von",
    "Vendido por", "Sold by", "Verkauft von", "Market", "Markt"
  ]).map(([label, value]) => [
    ["Implementado", "Implemented", "Implementiert"].includes(label) ? "Adicionado em" : label,
    value
  ]);
  if (!entries.length) return "";
  return `
    <section class="item-extra-section item-canonical-facts-section">
      <h4>Atributos</h4>
      ${renderCanonicalFactList(entries, "item-fact-list")}
    </section>
  `;
}

function renderItemLocationSection(item = {}) {
  const location = String(item?.location || "").trim();

  if (!location) {
    return "";
  }

  const mapActions = item.map?.url
    ? renderBossLocationMapActions({ ...item, name: item.wiki_name || item.name || "Item", location })
    : "";

  return `
    <section class="item-extra-section">
      <h4>${escapeHtml(t("common.locations"))}</h4>
      <p>${escapeHtml(location)}</p>
      ${mapActions}
    </section>
  `;
}

function renderItemNotesSection(item = {}) {
  const spoilers = normalizeItemSpoilersForUi(item);
  const regularNote = normalizeUiText(stripSpoilerPrefixFromNotes(sanitizeItemNoteForUi(item.notes || "")));
  const noteImage = String(item?.notes_image || "").trim();

  if (!regularNote && spoilers.length === 0 && !noteImage) {
    return "";
  }

  return `
    <section class="item-extra-section">
      <h4>${escapeHtml(t("common.notes"))}</h4>
      ${regularNote ? `<div class="npc-spoiler-body item-note-panel">${renderLibraryNarrative(regularNote, item.wiki_name || item.name || "Item")}</div>` : ""}
      ${noteImage ? `<img class="item-note-image" src="${escapeHtml(noteImage)}" alt="Conversao de Dust e Slivers na Exaltation Forge">` : ""}
      ${spoilers.map((spoiler, index) => renderItemSpoiler(spoiler, index)).join("")}
    </section>
  `;
}

function normalizeItemSpoilersForUi(item = {}) {
  const explicitSpoilers = Array.isArray(item.spoilers) ? item.spoilers : [];
  const noteText = sanitizeItemNoteForUi(item.notes || "");
  const parsedSpoilers = parseNpcSpoilersFromNotes(noteText);
  const derivedSpoilers = explicitSpoilers.length === 0 && parsedSpoilers.length === 0
    ? deriveQuestItemSpoilersFromNotes(noteText)
    : [];

  return [...explicitSpoilers, ...parsedSpoilers, ...derivedSpoilers]
    .map((spoiler) => ({
      title: spoiler.title || t("common.spoiler"),
      text: normalizeUiText(
        localizeQuestSpoilerText(
          sanitizeItemSpoilerTextForUi(spoiler.text || spoiler.description || "", noteText)
        )
      )
    }))
    .filter((spoiler) => String(spoiler.text || "").trim())
    .filter((spoiler) => !isBrokenItemSpoilerForUi(spoiler.text, noteText))
    .reduce((collection, spoiler) => {
      const spoilerKey = getItemSpoilerDedupKey(spoiler.text);
      const existingIndex = collection.findIndex((entry) => getItemSpoilerDedupKey(entry.text) === spoilerKey);

      if (existingIndex < 0) {
        collection.push(spoiler);
        return collection;
      }

      if (getItemSpoilerPriority(spoiler.text) > getItemSpoilerPriority(collection[existingIndex].text)) {
        collection[existingIndex] = spoiler;
      }

      return collection;
    }, []);
}

function deriveQuestItemSpoilersFromNotes(notes) {
  return String(notes || "")
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .filter((entry) => /quest/i.test(entry))
    .filter((entry) => /(obtained|obtainable|temporarily obtained|reward|recompensa|obtid[oa]s?|usad[oa]s?\s+durante|used during|part of|pode ser obtid[oa])/i.test(entry))
    .map((entry) => ({
      title: t("common.spoiler"),
      text: localizeQuestSpoilerText(entry)
    }));
}

function sanitizeItemNoteForUi(notes) {
  return String(notes || "")
    .replace(/\{\{\s*Spoiler Section[\s\S]*?(?:\}\}|$)/gi, " ")
    .replace(/\{\{\s*[A-Za-z0-9_ -]+$/g, " ")
    .replace(/\s+\*\s*(Recompensa da .*?Quest\.?|Obtained .*?Quest\.?|Temporarily obtained .*?Quest\.?|Item used on .*?Quest\.?|Item temporarily obtained .*?Quest\.?|Obtained during .*?Quest\.?|Part of .*?Quest\.?)\s*$/i, " ")
    .replace(/\s+\*\s*(Recompensa|Obtained|Temporarily obtained|Item used on|Item temporarily obtained|Obtained during|Part of)[\s\S]*?\}\}\s*$/i, " ")
    .replace(/\}\}\s*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeItemSpoilerTextForUi(text, regularNote = "") {
  return String(text || "")
    .replace(/\{\{\s*Spoiler Section\s*\|([^|}]+)(?:\|([^}]+))?(?:\|[^}]*)?(?:\}\}|$)/gi, (_match, first, second) =>
      [first, second].filter(Boolean).join(" - ").trim()
    )
    .replace(/\{\{\s*[A-Za-z0-9_ -]+$/g, " ")
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^{}]+\}\}/g, " ")
    .replace(/\s+\}\}\s*$/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(new RegExp(`^${escapeRegExp(regularNote)}\\s*`, "i"), "")
    .trim();
}

function isBrokenItemSpoilerForUi(text, regularNote = "") {
  const value = String(text || "").trim();
  if (!value) {
    return true;
  }
  if (/\}\}/.test(value)) {
    return true;
  }
  if (regularNote && value === regularNote) {
    return true;
  }
  return false;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function localizeQuestSpoilerText(text) {
  return String(text || "")
    .replace(/^Obtained in the\s+(.+?\s+Quest)\.?$/i, "Obtido na $1.")
    .replace(/^Obtained in\s+(.+?\s+Quest)\.?$/i, "Obtido na $1.")
    .replace(/^Obtained during the\s+(.+?\s+Quest)\.?$/i, "Obtido durante a $1.")
    .replace(/^Temporarily obtained in the\s+(.+?\s+Quest)\.?$/i, "Obtido temporariamente na $1.")
    .replace(/^Temporarily obtained in\s+(.+?\s+Quest)\.?$/i, "Obtido temporariamente na $1.")
    .replace(/^Item temporarily obtained in\s+(.+?\s+Quest)\.?$/i, "Item obtido temporariamente na $1.")
    .replace(/^Item used on\s+(.+?\s+Quest)\.?$/i, "Item usado na $1.")
    .replace(/^Used during the\s+(.+?\s+Quest)\.?$/i, "Usado durante a $1.")
    .replace(/^Part of the\s+(.+?\s+Quest)\.?$/i, "Faz parte da $1.")
    .trim();
}

function getItemSpoilerDedupKey(text) {
  const value = String(text || "").trim();
  const questName = extractQuestNameFromSpoilerText(value);

  if (questName) {
    return `quest::${questName.toLowerCase()}::${getItemSpoilerFamily(value)}`;
  }
  return value.toLowerCase();
}

function extractQuestNameFromSpoilerText(text) {
  const normalized = String(text || "")
    .trim()
    .replace(/^(Recompensa d[ao]\s+|Obtido(?: temporariamente| durante)?(?: na| no| em)?\s+|Obtained(?: during the| during| in the| in)?\s+|Temporarily obtained in the\s+|Temporarily obtained in\s+|Item temporarily obtained in\s+|Item used on\s+|Used during the\s+|Faz parte d[ao]\s+|Part of the\s+)/i, "");
  const questMatch = normalized.match(/([A-Z][A-Za-z' -]+Quest)\.?$/i);
  return questMatch ? questMatch[1].trim() : "";
}

function getItemSpoilerFamily(text) {
  const value = String(text || "").trim();

  if (/^Recompensa d[ao]\s+/i.test(value)) {
    return "acquire";
  }

  if (/^(Obtido|Obtained|Temporarily obtained|Item temporarily obtained|Obtido temporariamente|Obtido durante|Obtained during)\b/i.test(value)) {
    return "acquire";
  }

  if (/^(Item usado|Used during|Usado durante)\b/i.test(value)) {
    return "used";
  }

  if (/^(Faz parte d[ao]|Part of)\b/i.test(value)) {
    return "part";
  }

  return "other";
}

function getItemSpoilerPriority(text) {
  const value = String(text || "").trim();

  if (/^Recompensa d[ao]\s+/i.test(value)) {
    return 60;
  }

  if (/^(Temporarily obtained|Item temporarily obtained|Obtido temporariamente)\b/i.test(value)) {
    return 50;
  }

  if (/^(Obtido durante|Obtained during)\b/i.test(value)) {
    return 40;
  }

  if (/^(Item usado|Used during|Usado durante)\b/i.test(value)) {
    return 35;
  }

  if (/^(Obtido|Obtained)\b/i.test(value)) {
    return 30;
  }

  if (/^(Faz parte d[ao]|Part of)\b/i.test(value)) {
    return 20;
  }

  return 10;
}

function renderItemSpoiler(spoiler = {}, index = 0) {
  return `
    <div class="npc-spoiler item-spoiler">
      <div class="npc-spoiler-title">${escapeHtml(spoiler.title || t("common.spoiler"))}</div>
      <button type="button" class="npc-spoiler-toggle item-spoiler-toggle" data-item-spoiler-toggle="${index}" aria-expanded="false">
        ${escapeHtml(t("common.clickHereTo"))} <span>${escapeHtml(t("common.show").toUpperCase())}</span>
      </button>
      <div class="npc-spoiler-body item-spoiler-body hidden" data-item-spoiler-body="${index}">
        ${escapeHtml(spoiler.text || "")}
      </div>
    </div>
  `;
}

function renderItemDroppedBy(droppedBy, unlinkedDroppedBy = []) {
  if ((!Array.isArray(droppedBy) || droppedBy.length === 0) && (!Array.isArray(unlinkedDroppedBy) || unlinkedDroppedBy.length === 0)) {
    return "";
  }

  const uniqueDrops = [...new Set(droppedBy.map((name) => String(name || "").trim()).filter(Boolean))];
  const tiles = uniqueDrops.map((name) => {
    const creature = findLocalCreature(name);
    const displayName = creature?.name || name;
    const animatedSrc = creature?.imageSrc || getCreatureFallbackImageSrc(displayName);
    const stillSrc = creature?.stillImageSrc || animatedSrc;

    return `
      <button type="button" class="item-drop-tile" data-item-drop-monster="${escapeHtml(displayName)}" data-tooltip="${escapeHtml(displayName)}">
        ${stillSrc ? `<img src="${escapeHtml(stillSrc)}" data-library-still-src="${escapeHtml(stillSrc)}" data-library-animated-src="${escapeHtml(animatedSrc)}" alt="${escapeHtml(displayName)}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">` : ""}
      </button>
    `;
  }).join("") + [...new Set(unlinkedDroppedBy.map((name) => String(name || "").trim()).filter(Boolean))].map((name) => `<span class="item-drop-tile item-drop-source-text" data-tooltip="${escapeHtml(name)}">${escapeHtml(name)}</span>`).join("");

  return `
    <details class="item-drop-details">
      <summary>
        <span>${escapeHtml(t("common.lootFrom"))}</span>
        <span class="dropdown-chevron" aria-hidden="true"></span>
      </summary>
      <div class="item-drop-grid">${tiles}</div>
    </details>
  `;
}

function syncNpcTabForAvailableData(item) {
  const hasNpcSellers = Array.isArray(item?.npc_sell) && item.npc_sell.length > 0;
  const hasNpcBuyers = Array.isArray(item?.npc_buy) && item.npc_buy.length > 0;

  if (state.npcTab === "buy" && !hasNpcSellers && hasNpcBuyers) {
    state.npcTab = "sell";
    return;
  }

  if (state.npcTab === "sell" && !hasNpcBuyers && hasNpcSellers) {
    state.npcTab = "buy";
  }
}

function renderMarketNoteLegacy(market, formatter) {
  if (!els.itemMarketNote) {
    return;
  }

  const lowestSell = typeof market?.day_lowest_sell === "number" ? market.day_lowest_sell : null;
  const highestBuy = typeof market?.day_highest_buy === "number" ? market.day_highest_buy : null;

  if (!lowestSell && !highestBuy) {
    els.itemMarketNote.textContent =
      "Os destaques acima mostram os extremos registrados no dia quando houver negociações.";
    return;
  }

  if (lowestSell && highestBuy && highestBuy > lowestSell) {
    els.itemMarketNote.textContent =
      `Hoje a maior compra registrada (${formatter(highestBuy)}) ficou acima da menor venda registrada (${formatter(lowestSell)}). Isso acontece porque esses campos são extremos do dia, não um book ao vivo no mesmo instante.`;
    return;
  }

  els.itemMarketNote.textContent =
    "Os destaques acima mostram os extremos registrados no dia. O preço atual listado fica logo abaixo.";
}

function renderImbuementOptions() {
  const currentImbuement = getCurrentImbuement();
  els.imbuementPickerTriggerIcon.src = getImbuementIconUrl(currentImbuement.key);
  els.imbuementPickerTriggerIcon.alt = currentImbuement.name;
  els.imbuementPickerTriggerName.textContent = currentImbuement.name;
  if (els.imbuementPickerTriggerDescription) {
    els.imbuementPickerTriggerDescription.textContent = currentImbuement.description;
  }
  els.imbuementPickerGrid.innerHTML = IMBUEMENT_CATEGORY_ORDER.map((categoryKey) => {
    const categoryItems = IMBUEMENTS.filter((imbuement) => imbuement.category === categoryKey);

    if (categoryItems.length === 0) {
      return "";
    }

    return `
      <section class="imbuement-picker-group">
        <h4>
          <span class="category-label-full">${IMBUEMENT_CATEGORY_LABELS[categoryKey] || categoryKey}</span>
          <span class="category-label-short">${SHORT_IMBUEMENT_CATEGORY_LABELS[categoryKey] || IMBUEMENT_CATEGORY_LABELS[categoryKey] || categoryKey}</span>
        </h4>
        <div class="imbuement-picker-group-grid">
          ${categoryItems.map((imbuement) => {
            const selectedClass = imbuement.key === state.currentImbuementKey ? " active" : "";

            return `
              <button type="button" class="imbuement-picker-option${selectedClass}" data-imbuement-key="${imbuement.key}" aria-label="${escapeHtml(imbuement.name)}" data-tooltip="${escapeHtml(imbuement.name)}">
                <img src="${getImbuementIconUrl(imbuement.key)}" alt="${imbuement.name}">
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }).join("");
  syncImbuementPickerLayout();
  bindSkillDynamicTooltips(els.imbuementPickerGrid);
  renderImbuementPickerState();
}

function bindImbuementPickerResize() {
  if (!els.imbuementPickerGrid) {
    return;
  }

  const syncLayout = () => window.requestAnimationFrame(syncImbuementPickerLayout);
  window.addEventListener("resize", syncLayout);

  if ("ResizeObserver" in window) {
    const pickerObserver = new ResizeObserver(syncLayout);
    pickerObserver.observe(els.imbuementPickerGrid);
  }
}

function syncImbuementPickerLayout() {
  if (!els.imbuementPickerGrid) {
    return;
  }

  const width = els.imbuementPickerGrid.getBoundingClientRect().width;
  const widePickerMinWidth = 760;
  const mediumPickerMinWidth = 540;
  const isWide = width >= widePickerMinWidth;
  const isMedium = width >= mediumPickerMinWidth && width < widePickerMinWidth;
  const isNarrow = width < mediumPickerMinWidth;

  els.imbuementPickerGrid.classList.toggle("wide-picker", isWide);
  els.imbuementPickerGrid.classList.toggle("medium-picker", isMedium);
  els.imbuementPickerGrid.classList.toggle("narrow-picker", isNarrow);
  els.imbuementPickerGrid.classList.toggle("compact-picker", !isWide);
}

function renderSellRecommendationLegacy(npcBuyList, market, formatter) {
  const bestNpcPrice = Array.isArray(npcBuyList)
    ? npcBuyList.reduce((best, npc) => {
        const price = typeof npc?.price === "number" ? npc.price : null;
        return price !== null && price > best ? price : best;
      }, 0)
    : 0;
  const bestNpcEntry = Array.isArray(npcBuyList)
    ? npcBuyList.find((npc) => npc?.price === bestNpcPrice) || null
    : null;
  const bestMarketBuy = typeof market?.day_highest_buy === "number" ? market.day_highest_buy : null;

  els.itemSellRecommendation.classList.remove("npc", "market", "neutral");

  if (!bestMarketBuy && !bestNpcPrice) {
    els.itemSellRecommendation.innerHTML =
      `<span class="market-recommendation-copy">Sem dados suficientes para recomendar a melhor rota de venda.</span>`;
    els.itemSellRecommendation.classList.add("neutral");
    return;
  }

  if (bestNpcPrice && (!bestMarketBuy || bestNpcPrice > bestMarketBuy)) {
    const difference = bestMarketBuy ? bestNpcPrice - bestMarketBuy : 0;
    els.itemSellRecommendation.textContent = bestMarketBuy
      ? `Melhor vender para NPC: ${bestNpcEntry?.name || "NPC"} paga ${formatNpcPrice(bestNpcPrice)}, ${formatter(difference)} acima da melhor compra registrada hoje no market.`
      : `Melhor vender para NPC: ${bestNpcEntry?.name || "NPC"} paga ${formatNpcPrice(bestNpcPrice)}.`;
    els.itemSellRecommendation.classList.add("npc");
    return;
  }

  if (bestMarketBuy && bestNpcPrice && bestMarketBuy === bestNpcPrice) {
    els.itemSellRecommendation.innerHTML = `
      <span class="market-recommendation-copy">
        Empate entre&nbsp;<span class="market-rec-keyword">Market</span>&nbsp;e&nbsp;<span class="market-rec-keyword">NPC</span>:&nbsp;
        ambos estao em&nbsp;<span class="market-rec-gold">${escapeHtml(formatter(bestMarketBuy))}</span>&nbsp;
        para venda rapida.
      </span>
    `;
    els.itemSellRecommendation.classList.add("neutral");
    return;
  }

  els.itemSellRecommendation.textContent = bestNpcPrice
    ? `Melhor vender pelo market: a maior compra registrada hoje está em ${formatter(bestMarketBuy)}, acima do melhor NPC (${formatNpcPrice(bestNpcPrice)}).`
    : `Melhor vender pelo market: a maior compra registrada hoje está em ${formatter(bestMarketBuy)} e não há NPC comprador melhor.`;
  els.itemSellRecommendation.innerHTML = bestNpcPrice
    ? `
      <span class="market-recommendation-copy">
        Melhor vender pelo&nbsp;<span class="market-rec-keyword">Market</span>:&nbsp;
        o buy offer atual esta em&nbsp;<span class="market-rec-gold">${escapeHtml(formatter(bestMarketBuy))}</span>,&nbsp;
        acima do melhor&nbsp;<span class="market-rec-keyword">NPC</span>&nbsp;
        (<span class="market-rec-entity">${escapeHtml(bestNpcEntry?.name || "NPC")}</span>&nbsp;paga&nbsp;
        <span class="market-rec-gold">${escapeHtml(formatNpcPrice(bestNpcPrice))}</span>).
      </span>
    `
    : `
      <span class="market-recommendation-copy">
        Melhor vender pelo&nbsp;<span class="market-rec-keyword">Market</span>:&nbsp;
        o buy offer atual esta em&nbsp;<span class="market-rec-gold">${escapeHtml(formatter(bestMarketBuy))}</span>&nbsp;
        e nao ha&nbsp;<span class="market-rec-keyword">NPC</span>&nbsp;comprador melhor.
      </span>
    `;
  els.itemSellRecommendation.classList.add("market");
}

function renderImbuementLegacy() {
  const imbuement = getCurrentImbuement();
  const selectedWorld = getSelectedWorld();

  if (!imbuement) {
    return;
  }

  const ingredients = getCurrentIngredients();
  const feeGold = IMBUEMENT_FEES[state.currentImbuementTier] || 0;
  const rows = ingredients.map((ingredient) => {
    const priceEntry = state.imbuementMarket?.pricesByName?.[ingredient.name] || null;
    const onlineUnitPrice = priceEntry?.sellPrice ?? null;
    const manualEntry = state.manualIngredientPrices[ingredient.name] || {};
    const manualUnitPrice =
      manualEntry.enabled && typeof manualEntry.price === "number" ? manualEntry.price : null;
    const unitMarketPrice = manualUnitPrice ?? onlineUnitPrice;
    const ownedQuantity = state.mixedPurchaseEnabled
      ? Math.min(parseManualQuantityValue(state.ownedIngredientQuantities[ingredient.name]), ingredient.quantity)
      : 0;
    const missingQuantity = Math.max(ingredient.quantity - ownedQuantity, 0);

    return {
      ...ingredient,
      meta: state.ingredientMetaByName[ingredient.name] || null,
      buyPrice: priceEntry?.buyPrice ?? null,
      sellPrice: unitMarketPrice,
      onlineSellPrice: onlineUnitPrice,
      manualPriceEnabled: Boolean(manualEntry.enabled),
      ownedQuantity,
      missingQuantity,
      marketTotalGold:
        typeof unitMarketPrice === "number" ? unitMarketPrice * missingQuantity : null
    };
  });

  const marketMaterialsGold = rows.reduce(
    (total, row) => total + (typeof row.marketTotalGold === "number" ? row.marketTotalGold : 0),
    0
  );
  const hasFullMarketData = rows.every((row) => typeof row.marketTotalGold === "number");
  const marketGrandTotalGold = hasFullMarketData ? marketMaterialsGold + feeGold : null;
  const bundleTokens = imbuement.tokenBundle?.[state.currentImbuementTier] ?? null;
  const goldTokenPrice = getEffectiveGoldTokenPrice();
  const isManualGoldTokenPrice = state.manualGoldTokenEnabled && typeof state.manualGoldTokenPrice === "number";
  const bundleMarketGold =
    typeof bundleTokens === "number" && typeof goldTokenPrice === "number"
      ? bundleTokens * goldTokenPrice
      : null;
  const tokenGrandTotalGold =
    typeof bundleMarketGold === "number" ? bundleMarketGold + feeGold : null;

  els.imbuementIcon.src = getImbuementIconUrl(imbuement.key);
  els.imbuementIcon.alt = imbuement.name;
  els.imbuementName.textContent = imbuement.name;
  els.imbuementDescription.textContent = imbuement.description;
  if (els.imbuementPickerTriggerIcon) {
    els.imbuementPickerTriggerIcon.src = getImbuementIconUrl(imbuement.key);
    els.imbuementPickerTriggerIcon.alt = imbuement.name;
  }
  if (els.imbuementPickerTriggerName) {
    els.imbuementPickerTriggerName.textContent = imbuement.name;
  }
  if (els.imbuementPickerTriggerDescription) {
    els.imbuementPickerTriggerDescription.textContent = imbuement.description;
  }
  els.imbuementEffectChip.textContent = `${t("tools.effect")}: ${imbuement.effects[state.currentImbuementTier]}`;
  if (els.imbuementEffectDescription) {
    els.imbuementEffectDescription.innerHTML = buildImbuementEffectDetailsMarkup(imbuement);
  }
  if (els.imbuementUpdatedChip) {
    els.imbuementUpdatedChip.textContent = `Atualizado: ${formatIsoDateTime(
      state.imbuementMarket?.updatedAt
    )}`;
  }
  if (els.imbuementStatusBadge) {
    els.imbuementStatusBadge.textContent = `Atualizado: ${formatIsoDateTime(
      state.imbuementMarket?.updatedAt
    )}`;
  }

  setToolPriceElement(els.imbuementMarketTotal, marketMaterialsGold, hasFullMarketData);
  setToolPriceElement(els.imbuementFeeTotal, feeGold, true);
  setToolPriceElement(els.imbuementGrandTotal, marketGrandTotalGold, hasFullMarketData);
  els.imbuementGrandBreakdown.innerHTML = hasFullMarketData
    ? `${renderToolPrice(marketMaterialsGold, true)} + taxa do shrine`
    : "-";
  bindSkillDynamicTooltips(els.imbuementGrandBreakdown);
  els.imbuementTokenTotal.innerHTML =
    bundleTokens === null
      ? "Sem bundle"
      : renderToolPrice(tokenGrandTotalGold, typeof tokenGrandTotalGold === "number");
  bindSkillDynamicTooltips(els.imbuementTokenTotal);

  renderImbuementRecommendation({
    marketGrandTotalGold,
    bundleTokens,
    bundleMarketGold,
    tokenGrandTotalGold,
    isManualGoldTokenPrice,
    isManualGoldTokenMissing: state.manualGoldTokenEnabled && typeof state.manualGoldTokenPrice !== "number",
    worldName: selectedWorld?.name || "-"
  });
  renderImbuementIngredients(rows);
}

function renderImbuementRecommendationLegacy({
  marketGrandTotalGold,
  bundleTokens,
  bundleMarketGold,
  tokenGrandTotalGold,
  isManualGoldTokenPrice,
  isManualGoldTokenMissing,
  worldName
}) {
  els.imbuementRecommendation.classList.remove("good-token", "good-gold");

  if (state.imbuementLoading.active) {
    els.imbuementRecommendation.textContent = normalizeUiText("Carregando comparacao...");
    els.imbuementRouteNote.textContent = normalizeUiText("Assim que os dados do mundo fecharem, a sugestao aparece aqui.");
    return;
  }

  if (bundleTokens === null) {
    els.imbuementRecommendation.textContent =
      "Este imbuement não tem rota dedicada por gold token. A comparação fica só no market.";
    els.imbuementRouteNote.textContent =
      `No mundo ${worldName}, esta receita segue somente pelo market tradicional.`;
    return;
  }

  if (isManualGoldTokenMissing) {
    els.imbuementRecommendation.textContent = "Digite o valor manual do Gold Token para fechar a comparação.";
    els.imbuementRouteNote.textContent =
      `Bundle da Yana: ${bundleTokens} GT. O cálculo manual substitui o preço online do Gold Token.`;
    return;
  }

  if (typeof marketGrandTotalGold !== "number" || typeof tokenGrandTotalGold !== "number") {
    els.imbuementRecommendation.textContent =
      "Alguns ingredientes ainda não possuem preço retornado nesta base para este mundo.";
    els.imbuementRouteNote.textContent =
      `Bundle da Yana: ${bundleTokens} GT. Quando todos os valores deste mundo estiverem disponíveis, a recomendação fecha automaticamente.`;
    return;
  }

  const goldIsBetter = marketGrandTotalGold <= tokenGrandTotalGold;
  const difference = Math.abs(marketGrandTotalGold - tokenGrandTotalGold);

  els.imbuementRecommendation.innerHTML = goldIsBetter
    ? `Sugestão: Melhor comprar via <span class="recommendation-gold">gold</span>`
    : `Sugestão: Melhor comprar via <span class="recommendation-token">gold token</span>`;
  els.imbuementRecommendation.classList.add(goldIsBetter ? "good-gold" : "good-token");

  els.imbuementRouteNote.textContent = goldIsBetter
    ? `Market completo: ${formatToolPrice(marketGrandTotalGold, true)}. Bundle da Yana: ${bundleTokens} GT (${formatToolPrice(bundleMarketGold, true)}) + taxa do shrine. Economia estimada: ${formatToolPrice(difference, true)}.`
    : `Bundle da Yana: ${bundleTokens} GT (${formatToolPrice(bundleMarketGold, true)}) + taxa do shrine. Market completo: ${formatToolPrice(marketGrandTotalGold, true)}. Economia estimada: ${formatToolPrice(difference, true)}.`;

  if (isManualGoldTokenPrice) {
    els.imbuementRouteNote.textContent += " Valor do Gold Token definido manualmente.";
  }
}

function renderImbuement(options = {}) {
  const imbuement = getCurrentImbuement();
  const selectedWorld = getSelectedWorld();

  if (!imbuement) {
    return;
  }

  const ingredients = getCurrentIngredients();
  const feeGold = IMBUEMENT_FEES[state.currentImbuementTier] || 0;
  const appliedFeeGold = state.imbuementIncludeShrineFee ? feeGold : 0;
  const marketPriceMode = state.imbuementMarketPriceMode === "buy" ? "buy" : "sell";
  const rows = ingredients.map((ingredient) => {
    const priceEntry = state.imbuementMarket?.pricesByName?.[ingredient.name] || null;
    const onlineBuyPrice = priceEntry?.buyPrice ?? null;
    const onlineSellPrice = priceEntry?.sellPrice ?? null;
    const manualEntry = state.manualIngredientPrices[ingredient.name] || {};
    const manualUnitPrice =
      manualEntry.enabled && typeof manualEntry.price === "number" ? manualEntry.price : null;
    const ownedQuantity = state.mixedPurchaseEnabled
      ? Math.min(parseManualQuantityValue(state.ownedIngredientQuantities[ingredient.name]), ingredient.quantity)
      : 0;
    const missingQuantity = Math.max(ingredient.quantity - ownedQuantity, 0);
    const marketReferenceUnitPrice = marketPriceMode === "buy"
      ? onlineBuyPrice
      : (manualUnitPrice ?? onlineSellPrice);
    const rowValueMode = state.imbuementIngredientValueModeByName[ingredient.name] === "buy" ? "buy" : "sell";
    const rowValueUnitPrice = rowValueMode === "buy"
      ? onlineBuyPrice
      : (manualUnitPrice ?? onlineSellPrice);

    return {
      ...ingredient,
      meta: state.ingredientMetaByName[ingredient.name] || null,
      buyPrice: onlineBuyPrice,
      sellPrice: manualUnitPrice ?? onlineSellPrice,
      onlineSellPrice,
      manualPriceEnabled: Boolean(manualEntry.enabled),
      ownedQuantity,
      missingQuantity,
      marketPriceMode,
      marketReferenceUnitPrice,
      marketTotalGold:
        typeof marketReferenceUnitPrice === "number" ? marketReferenceUnitPrice * missingQuantity : null,
      valueMode: rowValueMode,
      valueTotalGold:
        typeof rowValueUnitPrice === "number" ? rowValueUnitPrice * missingQuantity : null
    };
  });
  const marketMaterialsGold = rows.reduce(
    (total, row) => total + (typeof row.marketTotalGold === "number" ? row.marketTotalGold : 0),
    0
  );
  const hasFullMarketData = rows.every((row) => typeof row.marketTotalGold === "number");
  const marketGrandTotalGold = hasFullMarketData ? marketMaterialsGold + appliedFeeGold : null;
  const bundleTokens = imbuement.tokenBundle?.[state.currentImbuementTier] ?? null;
  const goldTokenPrice = getEffectiveGoldTokenPrice();
  const isManualGoldTokenPrice = state.manualGoldTokenEnabled && typeof state.manualGoldTokenPrice === "number";
  const isManualGoldTokenMissing =
    state.manualGoldTokenEnabled &&
    typeof state.manualGoldTokenPrice !== "number" &&
    state.imbuementCurrencyMode === "gt";
  const bundleMarketGold =
    typeof bundleTokens === "number" && typeof goldTokenPrice === "number"
      ? bundleTokens * goldTokenPrice
      : null;
  const tokenGrandTotalGold =
    typeof bundleMarketGold === "number" ? bundleMarketGold + appliedFeeGold : null;
  const bestTokenRoute = calculateBestTokenRoute({
    imbuement,
    rows,
    feeGold: appliedFeeGold,
    goldTokenPrice
  });
  const preferredIngredientRoute = getImbuementIngredientRoute({
    bundleTokens,
    marketGrandTotalGold,
    tokenGrandTotalGold
  });
  const ingredientRows = rows.map((row) => {
    const rowRoute = getImbuementRowRoute({
      row,
      imbuement,
      rowIndex: rows.indexOf(row),
      goldTokenPrice
    });

    return {
      ...row,
      preferredRouteMode: rowRoute.mode,
      preferredRouteTooltip: rowRoute.tooltip
    };
  });

  els.imbuementIcon.src = getImbuementIconUrl(imbuement.key);
  els.imbuementIcon.alt = imbuement.name;
  els.imbuementName.textContent = imbuement.name;
  els.imbuementDescription.textContent = imbuement.description;
  els.imbuementEffectChip.textContent = `${t("tools.effect")}: ${imbuement.effects[state.currentImbuementTier]}`;
  if (els.imbuementEffectDescription) {
    els.imbuementEffectDescription.innerHTML = buildImbuementEffectDetailsMarkup(imbuement);
  }
  const imbuementUpdatedLabel = `Atualizado: ${formatIsoDateTime(state.imbuementMarket?.updatedAt)}`;
  if (els.imbuementUpdatedChip) {
    els.imbuementUpdatedChip.textContent = imbuementUpdatedLabel;
  }
  if (els.imbuementStatusBadge) {
    els.imbuementStatusBadge.textContent = imbuementUpdatedLabel;
  }
  setToolPriceElement(els.imbuementMarketTotal, marketMaterialsGold, hasFullMarketData);
  setToolPriceElement(els.imbuementFeeTotal, feeGold, true);
  setToolPriceElement(els.imbuementGrandTotal, marketGrandTotalGold, hasFullMarketData);
  els.imbuementGrandBreakdown.innerHTML = hasFullMarketData
    ? state.imbuementIncludeShrineFee
      ? `${renderToolPrice(marketMaterialsGold, true)} + taxa do shrine`
      : renderToolPrice(marketMaterialsGold, true)
    : "-";
  bindSkillDynamicTooltips(els.imbuementGrandBreakdown);
  els.imbuementTokenTotal.innerHTML = renderGoldTokenRouteTotal({
    bundleTokens,
    tokenGrandTotalGold,
    feeGold: appliedFeeGold
  });
  els.imbuementTokenBreakdown.innerHTML = renderGoldTokenRouteBreakdown({
    bundleTokens,
    bundleMarketGold,
    feeGold: appliedFeeGold
  });
  bindSkillDynamicTooltips(els.imbuementTokenTotal);
  bindSkillDynamicTooltips(els.imbuementTokenBreakdown);

  if (!options.preserveRouteControls) {
    renderImbuementRouteControls({
      rows: ingredientRows,
      imbuement,
      bundleTokens,
      bestTokenRoute
    });
  } else {
    renderMixedRouteHint(bestTokenRoute);
  }
  renderImbuementRecommendation({
    marketGrandTotalGold,
    bundleTokens,
    tokenGrandTotalGold,
    bestTokenRoute,
    isManualGoldTokenPrice,
    isManualGoldTokenMissing,
    worldName: selectedWorld?.name || "-",
    includeShrineFee: state.imbuementIncludeShrineFee,
    feeGold: appliedFeeGold
  });
  renderImbuementIngredients(ingredientRows);
}

function buildImbuementEffectDetailsMarkup(imbuement) {
  const tierOrder = [
    "basic",
    "intricate",
    "powerful",
    ...Object.keys(imbuement?.effects || {}).filter((tier) => !["basic", "intricate", "powerful"].includes(tier))
  ].filter((tier, index, list) => list.indexOf(tier) === index && tier in (imbuement?.effects || {}));
  const rows = tierOrder.map((tier) => {
    const effect = imbuement.effects?.[tier] || "-";
    const activeClass = tier === state.currentImbuementTier ? " active" : "";
    const description = buildCleanImbuementEffectTextMarkup(imbuement, effect);

    return `
      <div class="imbuement-effect-line${activeClass}">
        <strong>${IMBUEMENT_TIER_LABELS[tier] || tier}:</strong>
        <span>${description || escapeHtml(`${imbuement.description}: ${effect}`)}</span>
      </div>
    `;
  });

  return normalizeUiText(rows.join(""));
}

function buildImbuementEffectTextMarkup(imbuement, effect) {
  const meta = IMBUEMENT_EFFECT_META[imbuement.key] || {};
  const icon = meta.element ? getInlineElementIconMarkup(meta.element) : "";
  const safeEffect = escapeHtml(effect);

  switch (meta.type) {
    case "protection":
      return `Reduz em ${safeEffect} qualquer dano ${icon}<span class="imbuement-effect-link">${escapeHtml(meta.label)}</span> recebido.`;
    case "elemental-damage":
      return `Converte ${safeEffect} do dano da arma para ${icon}<span class="imbuement-effect-link">${escapeHtml(meta.label)}</span>.`;
    case "skill":
      return `Aumenta <span class="imbuement-effect-link">${escapeHtml(meta.label)}</span> em ${safeEffect}.`;
    case "leech":
      return `Converte ${safeEffect} do dano causado em absorção de ${escapeHtml(meta.label)}.`;
    case "critical": {
      const [chance = effect, extra = ""] = String(effect).split("/").map((part) => part.trim());
      return `Aumenta a chance de Critical Hit em ${escapeHtml(chance)}${extra ? ` e o dano crítico em ${escapeHtml(extra)}` : ""}.`;
    }
    case "speed":
      return `Aumenta a velocidade em ${safeEffect}.`;
    case "capacity":
      return `Aumenta a capacidade em ${safeEffect}.`;
    case "paralysis":
      return `Concede ${safeEffect} de chance de remover paralisia ao sofrer o efeito.`;
    default:
      return `${escapeHtml(imbuement.description)}: ${safeEffect}.`;
  }

  if (meta.type === "protection") {
    return `Reduz em ${safeEffect} qualquer dano ${icon}<span class="imbuement-effect-link">${escapeHtml(meta.label)}</span> recebido.`;
  }

  if (meta.type === "elemental-damage") {
    return `Converte ${safeEffect} do dano da arma para ${icon}<span class="imbuement-effect-link">${escapeHtml(meta.label)}</span>.`;
  }

  if (meta.type === "skill") {
    return `Aumenta <span class="imbuement-effect-link">${escapeHtml(meta.label)}</span> em ${safeEffect}.`;
  }

  if (meta.type === "leech") {
    return `Converte ${safeEffect} do dano causado em absorção de ${escapeHtml(meta.label)}.`;
  }

  if (meta.type === "critical") {
    const [chance = effect, extra = ""] = String(effect).split("/").map((part) => part.trim());
    return `Aumenta a chance de Critical Hit em ${escapeHtml(chance)}${extra ? ` e o dano crítico em ${escapeHtml(extra)}` : ""}.`;
  }

  if (meta.type === "speed") {
    return `Aumenta a velocidade em ${safeEffect}.`;
  }

  if (meta.type === "capacity") {
    return `Aumenta a capacidade em ${safeEffect}.`;
  }

  if (meta.type === "paralysis") {
    return `Concede ${safeEffect} de chance de remover paralisia ao sofrer o efeito.`;
  }

  return `${escapeHtml(imbuement.description)}: ${safeEffect}.`;
}

function buildCleanImbuementEffectTextMarkup(imbuement, effect) {
  const meta = IMBUEMENT_EFFECT_META[imbuement.key] || {};
  const icon = meta.element ? getInlineElementIconMarkup(meta.element) : "";
  const safeEffect = escapeHtml(effect);
  const localizedLabel = escapeHtml(normalizeUiText(meta.label || ""));
  const linkedLabel = `<span class="imbuement-effect-link">${localizedLabel}</span>`;

  switch (meta.type) {
    case "protection":
      return t("tools.imbuementEffectProtection", { effect: safeEffect, icon, label: linkedLabel });
    case "elemental-damage":
      return t("tools.imbuementEffectElementalDamage", { effect: safeEffect, icon, label: linkedLabel });
    case "skill":
      return t("tools.imbuementEffectSkill", { effect: safeEffect, label: linkedLabel });
    case "leech":
      return t("tools.imbuementEffectLeech", {
        effect: safeEffect,
        resource: t(meta.label === "vida" ? "tools.imbuementResource.life" : "tools.imbuementResource.mana")
      });
    case "critical": {
      const [chance = effect, extra = ""] = String(effect).split("/").map((part) => part.trim());
      return t(extra ? "tools.imbuementEffectCriticalExtra" : "tools.imbuementEffectCritical", {
        chance: escapeHtml(chance),
        extra: escapeHtml(extra)
      });
    }
    case "speed":
      return t("tools.imbuementEffectSpeed", { effect: safeEffect });
    case "capacity":
      return t("tools.imbuementEffectCapacity", { effect: safeEffect });
    case "paralysis":
      return t("tools.imbuementEffectParalysis", { effect: safeEffect });
    default:
      return t("tools.imbuementEffectFallback", {
        description: escapeHtml(normalizeUiText(imbuement.description)),
        effect: safeEffect
      });
  }
}

function getInlineElementIconMarkup(elementKey) {
  const src = ELEMENT_ICONS[elementKey] || "";

  if (!src) {
    return "";
  }

  return `<img class="inline-effect-icon" src="${escapeHtml(src)}" alt=""> `;
}

function renderImbuementRecommendation({
  marketGrandTotalGold,
  bundleTokens,
  tokenGrandTotalGold,
  bestTokenRoute,
  isManualGoldTokenPrice,
  isManualGoldTokenMissing,
  worldName,
  includeShrineFee,
  feeGold
}) {
  els.imbuementRecommendation.classList.remove("good-token", "good-gold");
  const feeLabel = includeShrineFee && feeGold > 0 ? " com taxa do shrine" : "";
  const marketModeLabel = state.imbuementMarketPriceMode === "buy" ? "melhor buy" : "melhor sell";

  if (state.imbuementLoading.active) {
    els.imbuementRecommendation.textContent = "Carregando comparação...";
    els.imbuementRouteNote.textContent = "Assim que os dados do mundo fecharem, a recomendação aparece aqui.";
    return;
  }

  if (bundleTokens === null) {
    els.imbuementRecommendation.textContent =
      normalizeUiText("Este imbuement nao tem rota dedicada por Gold Token. A comparacao fica so no market.");
    els.imbuementRouteNote.textContent =
      normalizeUiText(`No mundo ${worldName}, esta receita segue somente pelo market tradicional${feeLabel}.`);
    return;
  }

  if (isManualGoldTokenMissing) {
    els.imbuementRecommendation.textContent = normalizeUiText("Digite o valor manual do Gold Token para fechar a comparacao.");
    els.imbuementRouteNote.textContent =
      normalizeUiText(`Pacote da Yana: ${bundleTokens} Gold Tokens. O valor manual substitui o preco online do Gold Token${feeLabel}.`);
    return;
  }

  const comparisonTokenTotal =
    state.mixedPurchaseEnabled && bestTokenRoute ? bestTokenRoute.totalGold : tokenGrandTotalGold;
  const comparisonTokens =
    state.mixedPurchaseEnabled && bestTokenRoute ? bestTokenRoute.tokens : bundleTokens;

  if (typeof marketGrandTotalGold !== "number" || typeof comparisonTokenTotal !== "number") {
    els.imbuementRecommendation.textContent =
      normalizeUiText("Alguns ingredientes ainda nao possuem preco retornado nesta base para este mundo.");
    els.imbuementRouteNote.textContent =
      normalizeUiText(`Pacote da Yana: ${comparisonTokens ?? bundleTokens} Gold Tokens${feeLabel}. Quando os valores fecharem, a sugestao aparece automaticamente.`);
    return;
  }

  const goldIsBetter = marketGrandTotalGold <= comparisonTokenTotal;
  const difference = Math.abs(marketGrandTotalGold - comparisonTokenTotal);
  const goldIconMarkup = renderInlineImbuementIcon(CRYSTAL_COIN_STATIC_ICON_PATH, "Crystal Coin");
  const tokenIconMarkup = renderInlineImbuementIcon(state.currencyIconMap?.gt || GOLD_ICON_PATH, "Gold Token");

  els.imbuementRecommendation.innerHTML = goldIsBetter
    ? `Sugestao: Melhor comprar via <span class="recommendation-gold">gold ${goldIconMarkup}</span>`
    : `Sugestao: Melhor comprar via <span class="recommendation-token">gold token ${tokenIconMarkup}</span>`;
  els.imbuementRecommendation.classList.add(goldIsBetter ? "good-gold" : "good-token");
  els.imbuementRouteNote.textContent = goldIsBetter
    ? `Market direto via ${marketModeLabel}${feeLabel}: ${formatToolPrice(marketGrandTotalGold, true)}. Rota Yana/NPC${feeLabel}: ${comparisonTokens} Gold Tokens (${formatToolPrice(comparisonTokenTotal, true)}). Economia estimada: ${formatToolPrice(difference, true)}.`
    : `Rota Yana/NPC${feeLabel}: ${comparisonTokens} Gold Tokens (${formatToolPrice(comparisonTokenTotal, true)}). Market direto via ${marketModeLabel}${feeLabel}: ${formatToolPrice(marketGrandTotalGold, true)}. Economia estimada: ${formatToolPrice(difference, true)}.`;

  if (state.mixedPurchaseEnabled && bestTokenRoute) {
    els.imbuementRouteNote.textContent += ` Compra mista: melhor pacote para os itens restantes foi ${bestTokenRoute.label}.`;
  }

  if (isManualGoldTokenPrice) {
    els.imbuementRouteNote.textContent += " Valor do Gold Token definido manualmente.";
  }

  els.imbuementRouteNote.textContent = normalizeUiText(els.imbuementRouteNote.textContent);
}

function renderInlineImbuementIcon(src, alt) {
  const iconSrc = String(src || "").trim();

  if (!iconSrc) {
    return "";
  }

  return `<img class="imbuement-recommendation-icon" src="${escapeHtml(iconSrc)}" alt="${escapeHtml(alt || "")}">`;
}

function renderImbuementRouteControls({
  rows,
  imbuement,
  bundleTokens,
  bestTokenRoute
}) {
  const showManualToken = state.imbuementCurrencyMode === "gt" && bundleTokens !== null;
  const showGoldControls = state.imbuementCurrencyMode === "gold";

  els.manualTokenPanel?.classList.toggle("hidden", !showManualToken);
  els.ingredientTokenPanel?.classList.toggle("hidden", !showGoldControls);
  els.imbuementMixedRoutePanel?.classList.toggle("hidden", true);
  syncManualTokenState();

  if (!els.ingredientTokenPanel || !showGoldControls) {
    if (els.imbuementMixedRoutePanel) {
      els.imbuementMixedRoutePanel.innerHTML = "";
    }
    return;
  }

  const manualControls = rows
    .map((row) => {
      const manualEntry = state.manualIngredientPrices[row.name] || {};
      const checked = manualEntry.enabled ? " checked" : "";
      const inputValue = typeof manualEntry.price === "number" ? manualEntry.price : "";
      const inputHidden = manualEntry.enabled ? "" : " hidden";

      return `
        <div class="ingredient-manual-control">
          <label class="slide-switch">
            <input type="checkbox" data-manual-ingredient-toggle="${row.name}"${checked}>
            <span class="slide-track"></span>
            <strong>${row.name}</strong>
          </label>
          <input class="manual-token-input${inputHidden}" type="text" inputmode="numeric" value="${inputValue}" placeholder="${escapeHtml(t("tools.imbuementUnitValue"))}" data-manual-ingredient-price="${row.name}">
        </div>
      `;
    })
    .join("");
  const mixedChecked = state.mixedPurchaseEnabled ? " checked" : "";
  const shrineFeeChecked = state.imbuementIncludeShrineFee ? " checked" : "";
  const marketPriceChecked = state.imbuementMarketPriceMode === "buy" ? " checked" : "";
  const mixedControls = bundleTokens === null
    ? ""
    : `
      <div class="mixed-purchase-box">
        <div class="route-control-heading">
          <span>Compra mista</span>
          <label class="slide-switch mixed-purchase-toggle">
            <input type="checkbox" data-mixed-purchase-toggle${mixedChecked}>
            <span class="slide-track"></span>
          </label>
        </div>
${state.mixedPurchaseEnabled ? `<p>${escapeHtml(t("tools.imbuementOwnedHint"))}</p>` : ""}
        <div class="owned-ingredients-grid${state.mixedPurchaseEnabled ? "" : " hidden"}">
          ${rows.map((row) => {
            const ownedValue = state.ownedIngredientQuantities[row.name] || "";

            return `
              <label>
                <span>${row.name}</span>
                <input type="text" inputmode="numeric" placeholder="0" value="${ownedValue}" data-owned-ingredient-quantity="${row.name}">
              </label>
            `;
          }).join("")}
          <small data-mixed-route-hint>${state.mixedPurchaseEnabled && bestTokenRoute ? escapeHtml(t("tools.imbuementBestRemainingPackage", { package: bestTokenRoute.label })) : ""}</small>
        </div>
      </div>
    `;
  const marketPriceControls = `
    <div class="market-price-box">
      <div class="route-control-heading">
        <span>Preco de venda</span>
        <label class="slide-switch market-price-toggle">
          <input type="checkbox" data-imbuement-market-price-mode${marketPriceChecked}>
          <span class="slide-track"></span>
        </label>
        <span>Preco de compra</span>
        <span class="tooltip-help" tabindex="0" data-tooltip="Desligado usa o melhor sell do market para calcular o total.
Ligado usa o melhor buy do market.">?</span>
      </div>
    </div>
  `;
  const shrineFeeControls = `
    <div class="shrine-fee-box">
      <div class="route-control-heading">
        <span>Taxa do Shrine</span>
        <label class="slide-switch shrine-fee-toggle">
          <input type="checkbox" data-imbuement-shrine-fee-toggle${shrineFeeChecked}>
          <span class="slide-track"></span>
        </label>
        <span class="tooltip-help" tabindex="0" data-tooltip="Inclui ou remove a taxa do shrine nos totais finais e na sugestao.">?</span>
      </div>
    </div>
  `;

  els.ingredientTokenPanel.innerHTML = normalizeUiText(`
    <div class="ingredient-manual-panel">
      <small>${escapeHtml(t("tools.imbuementManualItems"))}</small>
      ${manualControls}
    </div>
  `);

  if (els.imbuementMixedRoutePanel) {
    els.imbuementMixedRoutePanel.innerHTML = normalizeUiText(`${mixedControls}${shrineFeeControls}${marketPriceControls}`);
    els.imbuementMixedRoutePanel.classList.toggle("hidden", false);
    bindSkillDynamicTooltips(els.imbuementMixedRoutePanel);
  }
}

function renderMixedRouteHint(bestTokenRoute) {
  const hint = els.imbuementMixedRoutePanel?.querySelector("[data-mixed-route-hint]");

  if (!hint) {
    return;
  }

  hint.textContent =
    state.mixedPurchaseEnabled && bestTokenRoute
      ? t("tools.imbuementBestRemainingPackage", { package: bestTokenRoute.label })
      : "";
}

function renderGoldTokenRouteTotal({ bundleTokens, tokenGrandTotalGold, feeGold }) {
  if (bundleTokens === null) {
    return "Sem bundle";
  }

  if (state.imbuementCurrencyMode === "gt") {
    return feeGold > 0
      ? `${renderCurrencyValue(bundleTokens, "Gold Tokens")} + ${renderCurrencyValue(feeGold, "gold")}`
      : renderCurrencyValue(bundleTokens, "Gold Tokens");
  }

  return renderToolPrice(tokenGrandTotalGold, typeof tokenGrandTotalGold === "number");
}

function renderGoldTokenRouteBreakdown({ bundleTokens, bundleMarketGold, feeGold }) {
  if (bundleTokens === null) {
    return "-";
  }

  if (state.imbuementCurrencyMode === "gt") {
    return feeGold > 0
      ? `${renderCurrencyValue(bundleTokens, "Gold Tokens")} + taxa do shrine`
      : renderCurrencyValue(bundleTokens, "Gold Tokens");
  }

  return typeof bundleMarketGold === "number"
    ? feeGold > 0
      ? `${renderToolPrice(bundleMarketGold, true)} + taxa do shrine`
      : renderToolPrice(bundleMarketGold, true)
    : "-";
}

function getImbuementIngredientRoute({
  bundleTokens,
  marketGrandTotalGold,
  tokenGrandTotalGold
}) {
  if (bundleTokens === null || typeof tokenGrandTotalGold !== "number") {
    return {
      mode: "market",
      tooltip: "Melhor comprando pelo Mercado"
    };
  }

  if (typeof marketGrandTotalGold !== "number") {
    return {
      mode: "gt",
      tooltip: "Melhor comprando por Gold Token"
    };
  }

  const useMarket = marketGrandTotalGold <= tokenGrandTotalGold;
  return {
    mode: useMarket ? "market" : "gt",
    tooltip: useMarket
      ? "Melhor comprando pelo Mercado"
      : "Melhor comprando por Gold Token"
  };
}

function getImbuementRowRoute({
  row,
  imbuement,
  rowIndex,
  goldTokenPrice
}) {
  const rowTokenAmount = getImbuementRowTokenAmount(imbuement, rowIndex);
  const rowTokenGold = typeof rowTokenAmount === "number" && typeof goldTokenPrice === "number"
    ? rowTokenAmount * goldTokenPrice
    : null;
  const rowMarketGold = typeof row?.valueTotalGold === "number" ? row.valueTotalGold : null;

  if (typeof rowMarketGold !== "number" && typeof rowTokenGold === "number") {
    return {
      mode: "gt",
      tooltip: "Melhor comprando por Gold Token"
    };
  }

  if (typeof rowMarketGold === "number" && typeof rowTokenGold !== "number") {
    return {
      mode: "market",
      tooltip: "Melhor comprando pelo Mercado"
    };
  }

  if (typeof rowMarketGold !== "number" || typeof rowTokenGold !== "number") {
    return {
      mode: "market",
      tooltip: "Melhor comprando pelo Mercado"
    };
  }

  return {
    mode: rowMarketGold <= rowTokenGold ? "market" : "gt",
    tooltip: rowMarketGold <= rowTokenGold
      ? "Melhor comprando pelo Mercado"
      : "Melhor comprando por Gold Token"
  };
}

function getImbuementRowTokenAmount(imbuement, rowIndex) {
  if (!imbuement?.tokenBundle || rowIndex < 0) {
    return null;
  }

  const tierSequence = ["basic", "intricate", "powerful"];
  const tierKey = tierSequence[rowIndex];

  if (!tierKey) {
    return null;
  }

  const currentBundle = Number(imbuement.tokenBundle?.[tierKey]);

  if (!Number.isFinite(currentBundle) || currentBundle <= 0) {
    return null;
  }

  const previousTierKey = tierSequence[rowIndex - 1];
  const previousBundle = previousTierKey
    ? Number(imbuement.tokenBundle?.[previousTierKey]) || 0
    : 0;
  const marginalTokens = currentBundle - previousBundle;

  return marginalTokens > 0 ? marginalTokens : currentBundle;
}

function calculateBestTokenRoute({ imbuement, rows, feeGold, goldTokenPrice }) {
  if (!state.mixedPurchaseEnabled || typeof goldTokenPrice !== "number" || !imbuement?.tokenBundle) {
    return null;
  }

  const options = getAvailableTokenPackageOptions(imbuement, rows.length)
    .map((option) => {
      const remainingMarketTotal = rows.reduce((total, row, index) => {
        const packageCoversIngredient = index < option.coveredCount;
        const quantityCoveredByPackage = packageCoversIngredient ? row.quantity : 0;
        const missingAfterOwned = Math.max(row.quantity - row.ownedQuantity, 0);
        const missingAfterPackage = Math.max(missingAfterOwned - quantityCoveredByPackage, 0);

        if (typeof row.marketReferenceUnitPrice !== "number") {
          return null;
        }

        return total === null ? null : total + missingAfterPackage * row.marketReferenceUnitPrice;
      }, 0);

      if (remainingMarketTotal === null) {
        return null;
      }

      return {
        ...option,
        totalGold: option.tokens * goldTokenPrice + remainingMarketTotal + feeGold
      };
    })
    .filter(Boolean);

  return options.sort((left, right) => left.totalGold - right.totalGold)[0] || null;
}

function getAvailableTokenPackageOptions(imbuement, ingredientCount) {
  const tierOrder = [
    { tier: "basic", coveredCount: 1, label: "Basic - 2 GT" },
    { tier: "intricate", coveredCount: 2, label: "Intricate - 4 GT" },
    { tier: "powerful", coveredCount: 3, label: "Powerful - 6 GT" }
  ];
  const maxTierIndex = tierOrder.findIndex((entry) => entry.tier === state.currentImbuementTier);
  const allowedTiers = tierOrder.slice(0, Math.max(maxTierIndex + 1, 0));

  return allowedTiers
    .filter((entry) => entry.coveredCount <= ingredientCount)
    .map((entry) => ({
      ...entry,
      tokens: imbuement.tokenBundle?.[entry.tier] ?? null
    }))
    .filter((entry) => typeof entry.tokens === "number");
}

function renderImbuementIngredientsLegacy(rows) {
  const header = `
    <div class="imbuement-row imbuement-row-head">
      <span>${escapeHtml(t("common.ingredient"))}</span>
      <span>${escapeHtml(t("tools.details"))}</span>
    </div>
  `;

  const body = rows
    .map((row) => {
      const slug = row.meta?.slug || "";
      const imageSrc = row.meta?.imageSrc || "";
      const quantityLabel = state.mixedPurchaseEnabled
        ? `${row.missingQuantity} falta / ${row.quantity} total`
        : row.quantity;
      const sellLabel =
        row.manualPriceEnabled && typeof row.sellPrice === "number" ? t("common.manualValue") : t("common.bestSell");
      const originalMarketLabel =
        row.manualPriceEnabled && typeof row.onlineSellPrice === "number"
          ? `<small class="imbuement-cell-subtle">Sell market: ${renderToolPrice(
              row.onlineSellPrice,
              true
            )}</small>`
          : "";

      return `
        <div class="imbuement-row">
          <button class="ingredient-button" type="button" data-slug="${slug}" data-name="${row.name}" data-image-src="${imageSrc}">
            <img src="${imageSrc}" alt="${row.name}">
            <div>
              <small class="ingredient-button-kicker">${escapeHtml(t("common.ingredient"))}</small>
              <strong>${name}</strong>
              <small class="ingredient-button-detail-label">${escapeHtml(t("tools.details"))}</small>
              <span>${escapeHtml(t("tools.openItemPriceTab"))}</span>
            </div>
          </button>
          <div class="imbuement-cells-grid">
            <div class="imbuement-cell">
              <span>${escapeHtml(t("tools.quantity"))}</span>
              <strong>${row.quantity}</strong>
            </div>
            <div class="imbuement-cell">
              <span>${escapeHtml(t("common.bestSell"))}</span>
              <strong>${renderToolPrice(row.sellPrice, typeof row.sellPrice === "number")}</strong>
            </div>
            <div class="imbuement-cell">
              <span>${escapeHtml(t("common.bestBuy"))}</span>
              <strong>${renderToolPrice(row.buyPrice, typeof row.buyPrice === "number")}</strong>
            </div>
            <div class="imbuement-cell">
              <span>${escapeHtml(t("tools.totalValue"))}</span>
              <strong>${renderToolPrice(
                row.marketTotalGold,
                typeof row.marketTotalGold === "number"
              )}</strong>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  els.imbuementIngredients.innerHTML = header + body;
  bindIngredientClicks();
  bindSkillDynamicTooltips(els.imbuementIngredients);
}

function renderImbuementIngredientsLegacyMarkup(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    els.imbuementIngredients.innerHTML =
      `<div class="empty-inline">${escapeHtml(t("tools.noIngredientsAvailable"))}</div>`;
    return;
  }

  const body = rows
    .map((row) => {
      const slug = escapeHtml(row.meta?.slug || "");
      const imageSrc = escapeHtml(row.meta?.imageSrc || "");
      const name = escapeHtml(row.name || "");
      const quantityLabel = state.mixedPurchaseEnabled
        ? escapeHtml(`${row.missingQuantity} falta / ${row.quantity} total`)
        : escapeHtml(String(row.quantity ?? "-"));
      const sellLabel =
        row.manualPriceEnabled && typeof row.sellPrice === "number" ? t("common.manualValue") : t("common.bestSell");
      const originalMarketLabel =
        row.manualPriceEnabled && typeof row.onlineSellPrice === "number"
          ? `<small class="imbuement-cell-subtle">Sell market: ${renderToolPrice(
              row.onlineSellPrice,
              true
            )}</small>`
          : "";

      return `
        <div class="imbuement-row">
          <button class="ingredient-button" type="button" data-slug="${slug}" data-name="${name}" data-image-src="${imageSrc}">
            <img src="${imageSrc}" alt="${name}" onerror="this.style.visibility='hidden'">
            <div>
              <small class="ingredient-button-kicker">${escapeHtml(t("common.ingredient"))}</small>
              <strong>${name}</strong>
              <span>${escapeHtml(t("tools.openItemPriceTab"))}</span>
            </div>
          </button>
          <div class="imbuement-details">
            <small class="ingredient-button-detail-label">${escapeHtml(t("tools.details"))}</small>
            <div class="imbuement-cells-grid">
              <div class="imbuement-cell">
                <span>${escapeHtml(t("tools.quantity"))}</span>
                <strong>${quantityLabel}</strong>
              </div>
              <div class="imbuement-cell">
                <span>${escapeHtml(t("common.bestBuy"))}</span>
                <strong>${renderToolPrice(row.buyPrice, typeof row.buyPrice === "number")}</strong>
              </div>
              <div class="imbuement-cell">
                <span>${escapeHtml(sellLabel)}</span>
                <strong>${renderToolPrice(row.sellPrice, typeof row.sellPrice === "number")}</strong>
                ${originalMarketLabel}
              </div>
              <div class="imbuement-cell">
                <span>${escapeHtml(t("tools.totalValue"))}</span>
                <strong>${renderToolPrice(
                  row.marketTotalGold,
                  typeof row.marketTotalGold === "number"
                )}</strong>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  els.imbuementIngredients.innerHTML = body;
  bindIngredientClicks();
  bindSkillDynamicTooltips(els.imbuementIngredients);
}

function renderImbuementIngredients(rows) {
  if (!els.imbuementIngredients) {
    return;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    els.imbuementIngredients.innerHTML =
      `<div class="empty-inline">${escapeHtml(t("tools.noIngredientsAvailable"))}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  rows.forEach((row) => {
    const slug = String(row.meta?.slug || "").trim();
    const imageSrc = String(row.meta?.imageSrc || "").trim();
    const ingredientLabel = t("common.ingredient");
    const name = String(row.name || ingredientLabel).trim() || ingredientLabel;
    const quantityLabel = state.mixedPurchaseEnabled
      ? `${row.missingQuantity} falta / ${row.quantity} total`
      : String(row.quantity ?? "-");
    const sellLabel =
      row.manualPriceEnabled && typeof row.sellPrice === "number" ? t("common.manualValue") : t("common.bestSell");
    const originalMarketLabel =
      row.manualPriceEnabled && typeof row.onlineSellPrice === "number"
        ? `Sell market: ${renderToolPrice(row.onlineSellPrice, true)}`
        : "";
    const routeMode = row.preferredRouteMode === "gt" ? "gt" : "market";
    const routeIconSrc = routeMode === "gt"
      ? (state.currencyIconMap?.gt || GOLD_ICON_PATH)
      : MARKET_ICON_PATH;
    const routeTooltip = row.preferredRouteTooltip || (
      routeMode === "gt"
        ? t("common.bestBuyingViaGoldToken")
        : t("common.bestBuyingViaMarket")
    );

    const rowElement = document.createElement("div");
    rowElement.className = "imbuement-row";

    const ingredientButton = document.createElement("div");
    ingredientButton.className = "ingredient-button";

    const imageButton = document.createElement("button");
    imageButton.className = "ingredient-image-button";
    imageButton.type = "button";
    imageButton.dataset.slug = slug;
    imageButton.dataset.name = name;
    imageButton.dataset.imageSrc = imageSrc;
    imageButton.dataset.tooltip = t("common.viewItemDescription");

    const image = document.createElement("img");
    image.src = imageSrc;
    image.alt = name;
    image.addEventListener("error", () => {
      image.style.visibility = "hidden";
    });
    imageButton.append(image);

    const buttonText = document.createElement("div");
    buttonText.className = "ingredient-button-content";
    const kicker = document.createElement("small");
    kicker.className = "ingredient-button-kicker";
    kicker.textContent = ingredientLabel;
    const titleRow = document.createElement("div");
    titleRow.className = "ingredient-title-row";
    const title = document.createElement("strong");
    title.textContent = name;
    const routeIcon = document.createElement("img");
    routeIcon.className = "imbuement-route-icon";
    routeIcon.src = routeIconSrc;
    routeIcon.alt = routeMode === "gt" ? "Gold Token" : "Mercado";
    routeIcon.dataset.tooltip = routeTooltip;
    const copyButton = document.createElement("button");
    copyButton.className = "imbuement-copy-button";
    copyButton.type = "button";
    copyButton.dataset.imbuementCopyName = name;
    copyButton.dataset.tooltip = t("common.copyName");
    copyButton.setAttribute("aria-label", t("common.copyNameOf", { name }));
    const copyIcon = document.createElement("span");
    copyIcon.className = "copy-sprite-stack";
    copyIcon.setAttribute("aria-hidden", "true");
    copyIcon.innerHTML = `
      <img class="copy-sprite-icon copy-sprite-icon-off" src="assets/ui/copy/copiar-off.png" alt="">
      <img class="copy-sprite-icon copy-sprite-icon-hover" src="assets/ui/copy/copiar-hover.png" alt="">
      <img class="copy-sprite-icon copy-sprite-icon-on" src="assets/ui/copy/copiar-on.png" alt="">
    `;
    copyButton.append(copyIcon);
    titleRow.append(title, routeIcon, copyButton);
    buttonText.append(kicker, titleRow);
    ingredientButton.append(imageButton, buttonText);

    const details = document.createElement("div");
    details.className = "imbuement-details";

    const detailsLabel = document.createElement("small");
    detailsLabel.className = "ingredient-button-detail-label";
    detailsLabel.textContent = t("tools.details");

    const cellsGrid = document.createElement("div");
    cellsGrid.className = "imbuement-cells-grid";

    const appendCell = ({
      label,
      value,
      subtle = "",
      valueClass = "",
      iconSrc = "",
      iconAlt = "",
      iconClass = "",
      cellClass = ""
    }) => {
      const cell = document.createElement("div");
      cell.className = `imbuement-cell${cellClass ? ` ${cellClass}` : ""}`;

      const labelElement = document.createElement("span");
      if (iconSrc) {
        const icon = document.createElement("img");
        icon.className = `imbuement-cell-label-icon${iconClass ? ` ${iconClass}` : ""}`;
        icon.src = iconSrc;
        icon.alt = iconAlt;
        labelElement.append(icon);
      }
      labelElement.append(document.createTextNode(label));

      const valueElement = document.createElement("strong");
      valueElement.innerHTML = value;
      if (valueClass) {
        valueElement.classList.add(valueClass);
      }

      cell.append(labelElement, valueElement);

      if (subtle) {
        const subtleElement = document.createElement("small");
        subtleElement.className = "imbuement-cell-subtle";
        subtleElement.innerHTML = subtle;
        cell.append(subtleElement);
      }

      cellsGrid.append(cell);
    };

    const appendPriceChoiceCell = ({
      label,
      value,
      valueClass,
      mode,
      tooltip
    }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `imbuement-cell imbuement-price-choice imbuement-cell--${mode}`;
      button.dataset.imbuementRowValueMode = mode;
      button.dataset.imbuementRowValueName = name;
      button.dataset.tooltip = tooltip;
      button.setAttribute("aria-pressed", row.valueMode === mode ? "true" : "false");
      button.classList.toggle("active", row.valueMode === mode);

      const labelElement = document.createElement("span");
      labelElement.textContent = label;

      const valueElement = document.createElement("strong");
      valueElement.innerHTML = value;
      valueElement.classList.add(valueClass);

      button.append(labelElement, valueElement);
      cellsGrid.append(button);
    };

    appendCell({
      label: t("tools.quantity"),
      value: quantityLabel,
      cellClass: "imbuement-cell--quantity"
    });
    appendCell({
      label: t("tools.totalValue"),
      value: renderToolPrice(row.valueTotalGold, typeof row.valueTotalGold === "number"),
      iconSrc: CRYSTAL_COIN_STATIC_ICON_PATH,
      iconAlt: "Crystal Coin",
      iconClass: "imbuement-cell-label-icon--small",
      cellClass: "imbuement-cell--total"
    });
    appendPriceChoiceCell({
      label: t("common.bestBuy"),
      value: renderToolPrice(row.buyPrice, typeof row.buyPrice === "number"),
      valueClass: "imbuement-buy-value",
      mode: "buy",
      tooltip: t("common.calculateBestBuy")
    });
    appendCell({
      label: sellLabel,
      value: renderToolPrice(row.sellPrice, typeof row.sellPrice === "number"),
      subtle: originalMarketLabel,
      valueClass: "imbuement-sell-value",
      cellClass: "imbuement-price-choice imbuement-cell--sell"
    });
    const sellCell = cellsGrid.lastElementChild;
    if (sellCell) {
      sellCell.dataset.imbuementRowValueMode = "sell";
      sellCell.dataset.imbuementRowValueName = name;
      sellCell.dataset.tooltip = t("common.calculateBestSell");
      sellCell.setAttribute("role", "button");
      sellCell.setAttribute("tabindex", "0");
      sellCell.setAttribute("aria-pressed", row.valueMode === "sell" ? "true" : "false");
      sellCell.classList.toggle("active", row.valueMode === "sell");
    }

    details.append(detailsLabel, cellsGrid);
    rowElement.append(ingredientButton, details);
    fragment.append(rowElement);
  });

  els.imbuementIngredients.replaceChildren(fragment);
  bindIngredientClicks();
  bindSkillDynamicTooltips(els.imbuementIngredients);
}

async function copyImbuementIngredientName(button) {
  const name = button?.dataset?.imbuementCopyName || "";

  if (!name) {
    return;
  }

  button.dataset.copyState = "loading";

  try {
    await copyTextToClipboard(name);
    button.dataset.copyState = "done";
    setLiveTooltip(button, "Copiado");
  } catch (_error) {
    button.dataset.copyState = "";
    setLiveTooltip(button, "Copiar nome");
    return;
  }

  window.setTimeout(() => {
    if (button.dataset.copyState === "done") {
      button.dataset.copyState = "";
      setLiveTooltip(button, "Copiar nome");
    }
  }, 1200);
}

function renderMarketMetricsLegacy(market, formatter) {
  const rows = [
    ["Venda mes alta", market.month_highest_sell, "price"],
    ["Venda mes media", market.month_average_sell, "price"],
    ["Venda mes baixa", market.month_lowest_sell, "price"],
    ["Compra mes alta", market.month_highest_buy, "price"],
    ["Compra mes media", market.month_average_buy, "price"],
    ["Compra mes baixa", market.month_lowest_buy, "price"],
    ["Venda dia alta", market.day_highest_sell, "price"],
    ["Venda dia media", market.day_average_sell, "price"],
    ["Venda dia baixa", market.day_lowest_sell, "price"],
    ["Compra dia alta", market.day_highest_buy, "price"],
    ["Compra dia baixa", market.day_lowest_buy, "price"],
    ["Vendidos no mes", market.month_sold, "count"],
    ["Comprados no mes", market.month_bought, "count"]
  ];

  els.marketMetrics.innerHTML = rows
    .map(([label, value, kind]) => {
      const displayValue = kind === "price"
        ? renderConvertedCurrencyValue(value, state.itemCurrencyMode, state.currencyRates, getSelectedWorld()?.tc_price)
        : renderCurrencyValue(value);

      return `
        <div class="metric-row">
          <span>${label}</span>
          <strong>${displayValue}</strong>
        </div>
      `;
    })
    .join("");
  bindSkillDynamicTooltips(els.marketMetrics);

  els.marketMetrics.classList.remove("hidden");
  els.marketEmpty.classList.add("hidden");
}

function renderNpcListLegacy(container, npcs, emptyMessage) {
  if (!Array.isArray(npcs) || npcs.length === 0) {
    container.innerHTML = `<div class="empty-inline">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = npcs
    .map(
      (npc) => `
        <div class="npc-row">
          <img class="npc-image" src="${npc.image_src || ""}" alt="${npc.name}">
          <div class="npc-meta">
            <strong>${npc.name}</strong>
            <span>${npc.location || "Local não informado"}</span>
          </div>
          <strong>${renderCurrencyValue(npc.price, "gold")}</strong>
        </div>
      `
    )
    .join("");
}

function renderRelatedItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    els.relatedItems.innerHTML = `<div class="empty-inline">Nenhum item relacionado disponivel.</div>`;
    return;
  }

  els.relatedItems.innerHTML = items
    .map((entry) =>
      createShortcutMarkup({
        slug: entry.item.slug,
        imageSrc: entry.item.image_src,
        name: entry.item.wiki_name || entry.item.name,
        category: entry.item.category || "Sem categoria",
        tone: "related-button"
      })
    )
    .join("");

  bindShortcutClicks(els.relatedItems, true);
}

function renderNpcTabs() {
  const activeTab = state.npcTab === "sell" ? "sell" : "buy";
  els.npcTabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.npcTab === activeTab);
  });
  els.npcBuyList.classList.toggle("hidden", activeTab !== "buy");
  els.npcSellList.classList.toggle("hidden", activeTab !== "sell");
}

function renderQuickPicks() {
  if (!els.quickPicks) {
    return;
  }

  if (!Array.isArray(state.quickPicks) || state.quickPicks.length === 0) {
    els.quickPicks.innerHTML = `<div class="empty-inline">Nenhum atalho encontrado.</div>`;
    return;
  }

  els.quickPicks.innerHTML = state.quickPicks
    .map((item) =>
      createShortcutMarkup({
        slug: item.slug,
        imageSrc: item.imageSrc,
        name: item.name,
        category: item.category,
        meta: item.maxTier > 0 ? `Tier max ${item.maxTier}` : "Market item"
      })
    )
    .join("");

  bindShortcutClicks(els.quickPicks);
}

function renderRecentItems() {
  if (!els.recentItems) {
    return;
  }

  if (!Array.isArray(state.recentItems) || state.recentItems.length === 0) {
    els.recentItems.innerHTML = `<div class="empty-inline">Os itens consultados vao aparecer aqui.</div>`;
    return;
  }

  els.recentItems.innerHTML = state.recentItems
    .map((item) =>
      createShortcutMarkup({
        slug: item.slug,
        imageSrc: item.imageSrc,
        name: item.name,
        category: item.category,
        metaLabel: "Consultado em",
        metaValue: item.lastViewedAt
      })
    )
    .join("");

  bindShortcutClicks(els.recentItems);
}

function renderCurrencyIcons() {
  const iconMap = {
    gold: GOLD_ICON_PATH,
    tc: TIBIA_COINS_CURRENCY_ICON_PATH,
    gt: GOLD_TOKEN_CURRENCY_ICON_PATH
  };
  state.currencyIconMap = {
    gold: GOLD_ICON_PATH,
    tc: iconMap.tc || GOLD_ICON_PATH,
    gt: iconMap.gt || GOLD_ICON_PATH
  };

  els.currencyIcons.forEach((icon) => {
    const mode = icon.dataset.iconMode;
    const src = iconMap[mode] || GOLD_ICON_PATH;
    icon.onerror = () => {
      icon.onerror = null;
      icon.src = GOLD_ICON_PATH;
    };
    icon.src = src;
  });

  els.imbuementMarketCardIcon.src = MARKET_ICON_PATH;
  els.imbuementFeeCardIcon.src = SHRINE_ICON_PATH;
  els.imbuementGrandCardIcon.onerror = () => {
    els.imbuementGrandCardIcon.onerror = null;
    els.imbuementGrandCardIcon.src = GOLD_ICON_PATH;
  };
  els.imbuementGrandCardIcon.src = GOLD_ICON_PATH;
  if (els.imbuementTokenCardIcon) {
    els.imbuementTokenCardIcon.onerror = () => {
      els.imbuementTokenCardIcon.onerror = null;
      els.imbuementTokenCardIcon.src = GOLD_ICON_PATH;
    };
    els.imbuementTokenCardIcon.src = GOLD_TOKEN_CURRENCY_ICON_PATH;
  }
}

function createShortcutMarkup({
  slug,
  imageSrc,
  name,
  category,
  meta = "",
  metaLabel = "",
  metaValue = "",
  tone = "shortcut-button"
}) {
  const metaMarkup = metaLabel || metaValue
    ? `
        <small class="shortcut-meta">
          ${metaLabel ? `<span class="shortcut-meta-label">${metaLabel}</span>` : ""}
          ${metaValue ? `<span class="shortcut-meta-value">${metaValue}</span>` : ""}
        </small>
      `
    : meta
      ? `<small>${meta}</small>`
      : "";

  return `
    <button
      class="${tone}"
      type="button"
      data-slug="${slug}"
      data-name="${name}"
      data-category="${category || ""}"
      data-image-src="${imageSrc || ""}"
    >
      <img src="${imageSrc || ""}" alt="${name}">
      <div>
        <strong>${name}</strong>
        <span>${category}</span>
        ${metaMarkup}
      </div>
    </button>
  `;
}

function bindShortcutClicks(container, shouldScrollToTop = false) {
  container.querySelectorAll("[data-slug]").forEach((button) => {
    button.addEventListener("click", async () => {
      const slug = button.dataset.slug || "";
      const name = button.dataset.name || slug;
      const category = button.dataset.category || "Sem categoria";
      const imageSrc = button.dataset.imageSrc || "";

      if (!slug) {
        return;
      }

      state.selectedItemSuggestion = {
        slug,
        name,
        category,
        imageSrc
      };
      els.itemInput.value = name;
      closeItemSuggestions();
      switchSection("item-prices");
      await handleItemSearch(true);
      if (shouldScrollToTop) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });
}

function bindIngredientClicks() {
  els.imbuementIngredients.querySelectorAll("[data-slug]").forEach((button) => {
    button.addEventListener("click", async () => {
      const slug = button.dataset.slug;
      if (!slug) {
        return;
      }

      const name = button.dataset.name || slug;
      const imageSrc = button.dataset.imageSrc || "";
      state.selectedItemSuggestion = {
        slug,
        name,
        category: t("common.ingredient"),
        imageSrc
      };
      els.itemInput.value = name;
      switchSection("item-prices");
      await handleItemSearch(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  els.imbuementIngredients.querySelectorAll("[data-imbuement-copy-name]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void copyImbuementIngredientName(button);
    });
  });

  els.imbuementIngredients.querySelectorAll("[data-imbuement-row-value-mode]").forEach((button) => {
    const activateValueMode = () => {
      const ingredientName = button.dataset.imbuementRowValueName || "";
      const nextMode = button.dataset.imbuementRowValueMode === "buy" ? "buy" : "sell";

      if (!ingredientName) {
        return;
      }

      state.imbuementIngredientValueModeByName[ingredientName] = nextMode;
      renderImbuement({ preserveRouteControls: true });
    };

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      activateValueMode();
    });

    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        activateValueMode();
      }
    });
  });
}

function renderMarketNote(market, formatter) {
  if (!els.itemMarketNote) {
    return;
  }

  const lowestSell = typeof market?.sell_offer === "number" ? market.sell_offer : null;
  const highestBuy = typeof market?.buy_offer === "number" ? market.buy_offer : null;

  if (!marketHasActiveOffers(market)) {
    els.itemMarketNote.textContent =
      "Base sincronizada, mas este item esta sem ofertas abertas no market agora.";
    return;
  }

  if (lowestSell && highestBuy && highestBuy > lowestSell) {
    els.itemMarketNote.textContent =
      `O book atual veio invertido na base: buy offer ${formatter(highestBuy)} e sell offer ${formatter(lowestSell)}.`;
    return;
  }

  els.itemMarketNote.textContent =
    "Os destaques acima mostram o book atual do market. As medias do dia e do mes ficam logo abaixo.";
}

function renderSellRecommendationPanel(npcBuyList, market, formatter) {
  const bestNpcPrice = Array.isArray(npcBuyList)
    ? npcBuyList.reduce((best, npc) => {
        const price = typeof npc?.price === "number" ? npc.price : null;
        return price !== null && price > best ? price : best;
      }, 0)
    : 0;
  const bestNpcEntry = Array.isArray(npcBuyList)
    ? npcBuyList.find((npc) => npc?.price === bestNpcPrice) || null
    : null;
  const bestMarketBuy = typeof market?.buy_offer === "number" ? market.buy_offer : null;

  els.itemSellRecommendation.classList.remove("npc", "market", "neutral");

  if (!bestMarketBuy && !bestNpcPrice) {
    els.itemSellRecommendation.innerHTML =
      `<span class="market-recommendation-copy">Sem dados suficientes para recomendar a melhor rota de venda.</span>`;
    els.itemSellRecommendation.classList.add("neutral");
    return;
  }

  if (bestNpcPrice && (!bestMarketBuy || bestNpcPrice > bestMarketBuy)) {
    const difference = bestMarketBuy ? bestNpcPrice - bestMarketBuy : 0;
    const npcName = escapeHtml(bestNpcEntry?.name || "NPC");
    const bestNpcText = escapeHtml(formatNpcPrice(bestNpcPrice));
    const differenceText = escapeHtml(formatter(difference));

    els.itemSellRecommendation.innerHTML = bestMarketBuy
      ? `
        <span class="market-recommendation-copy">
          Melhor vender para&nbsp;<span class="market-rec-keyword">NPC</span>:&nbsp;
          <span class="market-rec-entity">${npcName}</span>&nbsp;paga&nbsp;
          <span class="market-rec-gold">${bestNpcText}</span>,&nbsp;
          <span class="market-rec-gold">${differenceText}</span>&nbsp;acima do buy offer atual do&nbsp;
          <span class="market-rec-keyword">Market</span>.
        </span>
      `
      : `
        <span class="market-recommendation-copy">
          Melhor vender para&nbsp;<span class="market-rec-keyword">NPC</span>:&nbsp;
          <span class="market-rec-entity">${npcName}</span>&nbsp;paga&nbsp;
          <span class="market-rec-gold">${bestNpcText}</span>.
        </span>
      `;
    els.itemSellRecommendation.classList.add("npc");
    return;
  }

  if (bestMarketBuy && bestNpcPrice && bestMarketBuy === bestNpcPrice) {
    els.itemSellRecommendation.innerHTML = `
      <span class="market-recommendation-copy">
        Empate entre&nbsp;<span class="market-rec-keyword">Market</span>&nbsp;e&nbsp;<span class="market-rec-keyword">NPC</span>:&nbsp;
        ambos estao em&nbsp;<span class="market-rec-gold">${escapeHtml(formatter(bestMarketBuy))}</span>&nbsp;
        para venda rapida.
      </span>
    `;
    els.itemSellRecommendation.classList.add("neutral");
    return;
  }

  els.itemSellRecommendation.innerHTML = bestNpcPrice
    ? `
      <span class="market-recommendation-copy">
        Melhor vender pelo&nbsp;<span class="market-rec-keyword">Market</span>:&nbsp;
        o buy offer atual esta em&nbsp;<span class="market-rec-gold">${escapeHtml(formatter(bestMarketBuy))}</span>,&nbsp;
        acima do melhor&nbsp;<span class="market-rec-keyword">NPC</span>&nbsp;
        (<span class="market-rec-entity">${escapeHtml(bestNpcEntry?.name || "NPC")}</span>&nbsp;paga&nbsp;
        <span class="market-rec-gold">${escapeHtml(formatNpcPrice(bestNpcPrice))}</span>).
      </span>
    `
    : `
      <span class="market-recommendation-copy">
        Melhor vender pelo&nbsp;<span class="market-rec-keyword">Market</span>:&nbsp;
        o buy offer atual esta em&nbsp;<span class="market-rec-gold">${escapeHtml(formatter(bestMarketBuy))}</span>&nbsp;
        e nao ha&nbsp;<span class="market-rec-keyword">NPC</span>&nbsp;comprador melhor.
      </span>
    `;
  els.itemSellRecommendation.classList.add("market");
}

function renderSellRecommendation(npcBuyList, market, formatter) {
  return renderSellRecommendationPanel(npcBuyList, market, formatter);

  const bestNpcPrice = Array.isArray(npcBuyList)
    ? npcBuyList.reduce((best, npc) => {
        const price = typeof npc?.price === "number" ? npc.price : null;
        return price !== null && price > best ? price : best;
      }, 0)
    : 0;
  const bestNpcEntry = Array.isArray(npcBuyList)
    ? npcBuyList.find((npc) => npc?.price === bestNpcPrice) || null
    : null;
  const bestMarketBuy = typeof market?.buy_offer === "number" ? market.buy_offer : null;

  els.itemSellRecommendation.classList.remove("npc", "market", "neutral");

  if (!bestMarketBuy && !bestNpcPrice) {
    els.itemSellRecommendation.textContent =
      "Sem dados suficientes para recomendar a melhor rota de venda.";
    els.itemSellRecommendation.classList.add("neutral");
    return;
  }

  if (bestNpcPrice && (!bestMarketBuy || bestNpcPrice > bestMarketBuy)) {
    const difference = bestMarketBuy ? bestNpcPrice - bestMarketBuy : 0;
    const npcName = escapeHtml(bestNpcEntry?.name || "NPC");
    const bestNpcText = escapeHtml(formatNpcPrice(bestNpcPrice));
    const differenceText = escapeHtml(formatter(difference));
    els.itemSellRecommendation.innerHTML = bestMarketBuy
      ? `
        <span class="market-recommendation-copy">
          Melhor vender para <span class="market-rec-keyword">NPC</span>:
          <span class="market-rec-entity">${npcName}</span> paga
          <span class="market-rec-gold">${bestNpcText}</span>,
          <span class="market-rec-gold">${differenceText}</span> acima do buy offer atual do
          <span class="market-rec-keyword">Market</span>.
        </span>
      `
      : `
        <span class="market-recommendation-copy">
          Melhor vender para <span class="market-rec-keyword">NPC</span>:
          <span class="market-rec-entity">${npcName}</span> paga
          <span class="market-rec-gold">${bestNpcText}</span>.
        </span>
      `;
    els.itemSellRecommendation.classList.add("npc");
    return;
  }

  if (bestMarketBuy && bestNpcPrice && bestMarketBuy === bestNpcPrice) {
    els.itemSellRecommendation.innerHTML = `
      <span class="market-recommendation-copy">
        Empate entre <span class="market-rec-keyword">Market</span> e <span class="market-rec-keyword">NPC</span>:
        ambos estao em <span class="market-rec-gold">${escapeHtml(formatter(bestMarketBuy))}</span>
        para venda rapida.
      </span>
    `;
    els.itemSellRecommendation.classList.add("neutral");
    return;
  }

  els.itemSellRecommendation.textContent = bestNpcPrice
    ? `Melhor vender pelo market: o buy offer atual está em ${formatter(bestMarketBuy)}, acima do melhor NPC (${formatNpcPrice(bestNpcPrice)}).`
    : `Melhor vender pelo market: o buy offer atual está em ${formatter(bestMarketBuy)} e não há NPC comprador melhor.`;
  els.itemSellRecommendation.classList.add("market");
}

function marketHasActiveOffers(market) {
  return Boolean(
    market &&
    (
      (typeof market.sell_offers === "number" && market.sell_offers > 0) ||
      (typeof market.buy_offers === "number" && market.buy_offers > 0) ||
      (typeof market.sell_offer === "number" && market.sell_offer > 0) ||
      (typeof market.buy_offer === "number" && market.buy_offer > 0)
    )
  );
}

function renderMarketMetrics(market, formatter) {
  const rows = [
    ["Sell offer atual", market.sell_offer, "price"],
    ["Buy offer atual", market.buy_offer, "price"],
    ["Venda mes alta", market.month_highest_sell, "price"],
    ["Venda mes media", market.month_average_sell, "price"],
    ["Venda mes baixa", market.month_lowest_sell, "price"],
    ["Compra mes alta", market.month_highest_buy, "price"],
    ["Compra mes media", market.month_average_buy, "price"],
    ["Compra mes baixa", market.month_lowest_buy, "price"],
    ["Venda dia alta", market.day_highest_sell, "price"],
    ["Venda dia media", market.day_average_sell, "price"],
    ["Venda dia baixa", market.day_lowest_sell, "price"],
    ["Compra dia alta", market.day_highest_buy, "price"],
    ["Compra dia baixa", market.day_lowest_buy, "price"],
    ["Vendidos no mes", market.month_sold, "count"],
    ["Comprados no mes", market.month_bought, "count"]
  ];

  els.marketMetrics.innerHTML = rows
    .map(([label, value, kind]) => {
      const displayValue = kind === "price" ? formatter(value) : formatCompactNumber(value);

      return `
        <div class="metric-row">
          <span>${label}</span>
          <strong>${displayValue}</strong>
        </div>
      `;
    })
    .join("");

  els.marketMetrics.classList.remove("hidden");
  els.marketEmpty.classList.add("hidden");
}

function renderNpcList(container, npcs, emptyMessage) {
  if (!Array.isArray(npcs) || npcs.length === 0) {
    container.innerHTML = `<div class="empty-inline">${emptyMessage}</div>`;
    return;
  }

  const npcMarkup = npcs
    .map((npc) => {
      const fallbackImageSrc = getNpcFallbackImagePath(npc?.name);
      const imageSrc = npc?.image_src || npc?.imageSrc || getNpcTradeImageSrc(npc?.name) || fallbackImageSrc || "";
      const fallbackOnError =
        fallbackImageSrc && imageSrc !== fallbackImageSrc
          ? ` onerror="this.onerror=null;this.src='${fallbackImageSrc}'"`
          : "";

      return `
        <button type="button" class="npc-row" data-open-npc-name="${escapeHtml(npc.name)}" data-tooltip="${escapeHtml(t("common.viewDetails"))}">
          ${imageSrc ? `<img class="npc-image" src="${imageSrc}" alt="${npc.name}"${fallbackOnError}>` : ""}
          <div class="npc-meta">
            <strong>${npc.name}</strong>
            <span>${npc.location || "Local não informado"}</span>
          </div>
          <div class="npc-price">
            <span>Preço</span>
            <strong>${escapeHtml(formatNpcTradePrice(npc))}</strong>
          </div>
        </button>
      `;
    })
    .join("");

  container.innerHTML = normalizeUiText(npcMarkup);
  bindSkillDynamicTooltips(container);
  container.querySelectorAll("[data-open-npc-name]").forEach((button) => {
    button.addEventListener("click", () => {
      switchSection("npcs");
      void setEntityViewMode("npcs").then(() => openNpcDetail(button.dataset.openNpcName));
    });
  });
}

function formatNpcTradePrice(npc) {
  const rawPrice = String(npc?.price ?? "").trim();
  const currency = String(npc?.currency || "").trim();
  const locale = state.localeController?.getLocale?.() || "pt-BR";
  // Barter has no numeric currency. Keep the factual requirement visible,
  // e.g. "1 Giant Sword", instead of labelling it as gold.
  if (currency === "item-barter") return rawPrice || "-";
  const labels = {
    "hunting-task-points": { "pt-BR": "Hunting Task Points", en: "Hunting Task Points", de: "Jagdaufgabenpunkte" },
    "event-points": { "pt-BR": "Event Points", en: "Event Points", de: "Event Points" },
    "gold-tokens": { "pt-BR": "Gold Tokens", en: "Gold Tokens", de: "Gold Tokens" },
    "christmas-tokens": { "pt-BR": "Christmas Tokens", en: "Christmas Tokens", de: "Weihnachtstoken" },
    "theons": { "pt-BR": "Theons", en: "Theons", de: "Theons" },
    "drome-points": { "pt-BR": "Drome Points", en: "Drome Points", de: "Drome Points" },
    "arena-badges": { "pt-BR": "Arena Badges", en: "Arena Badges", de: "Arena-Abzeichen" },
    "minor-crystalline-tokens": { "pt-BR": "Minor Crystalline Tokens", en: "Minor Crystalline Tokens", de: "Minor Crystalline Tokens" },
    "major-crystalline-tokens": { "pt-BR": "Major Crystalline Tokens", en: "Major Crystalline Tokens", de: "Major Crystalline Tokens" }
  };
  if (currency) {
    const amount = Number(rawPrice.replace(/[^0-9.-]/g, ""));
    const formatted = Number.isFinite(amount) ? amount.toLocaleString(locale === "de" ? "de-DE" : locale === "en" ? "en-US" : "pt-BR") : rawPrice;
    return `${formatted} ${labels[currency]?.[locale] || currency}`;
  }
  // A Sweaty Cyclops and similar merchants barter named items. Never turn
  // a value such as "1 Giant Sword" into a fictitious 1 gold price.
  return /^\s*[0-9][0-9.,]*\s*$/.test(rawPrice) ? formatCurrencyText(rawPrice, "gold") : rawPrice || "-";
}

// Trade rows are intentionally lean: the factual trade bundle stores only
// name, location and price. Resolve the sprite from the same local NPC pack
// used by the NPC browser instead of leaving a broken image or requesting a
// remote wiki image for every merchant card.
function getNpcTradeImageSrc(npcName) {
  // The stored sprite file names separate apostrophe words (Nah'Bob becomes
  // nah-bob).  Use that canonical spelling for lean trade entries too.
  const normalizedName = slugifyItemInput(String(npcName || "").replace(/[\u0027\u2019]/g, " "));
  if (!normalizedName) return "";
  const indexed = state.npcIndex.find((entry) => slugifyItemInput(entry?.name || "") === normalizedName);
  if (indexed?.imageSrc || indexed?.stillImageSrc) return indexed.stillImageSrc || indexed.imageSrc;
  return `assets/data/npcs/${normalizedName}.gif`;
}

function getNpcFallbackImagePath(npcName) {
  const normalizedNpcName = String(npcName || "")
    .trim()
    .toLowerCase();

  if (normalizedNpcName.includes("hireling")) {
    return NPC_HIRELING_FALLBACK_ICON_PATH;
  }

  if (normalizedNpcName.includes("wes") && normalizedNpcName.includes("blacksmith")) {
    return NPC_WES_FALLBACK_ICON_PATH;
  }

  return "";
}

function getCurrentImbuement() {
  return IMBUEMENTS_BY_KEY[state.currentImbuementKey] || IMBUEMENTS[0];
}

function getCurrentIngredients() {
  return getCurrentImbuement()?.tiers?.[state.currentImbuementTier] || [];
}

function getSelectedWorld() {
  return state.worlds.find((world) => world.slug === state.currentWorldSlug) || null;
}

function getImbuementIconUrl(imbuementKey) {
  const tierSuffixMap = {
    basic: "1",
    intricate: "2",
    powerful: "3"
  };
  const tierSuffix = tierSuffixMap[state.currentImbuementTier] || "1";
  return `assets/imbuements/${imbuementKey}-${tierSuffix}.webp`;
}

function renderImbuementPickerState() {
  els.imbuementPickerPanel.classList.toggle("hidden", !state.imbuementPickerOpen);
  els.imbuementPickerTrigger.classList.toggle("active", state.imbuementPickerOpen);
  if (els.imbuementPickerTrigger) {
    els.imbuementPickerTrigger.setAttribute("aria-expanded", state.imbuementPickerOpen ? "true" : "false");
    els.imbuementPickerTrigger.dataset.tooltip = state.imbuementPickerOpen
      ? t("tools.closeImbuementList")
      : t("tools.openImbuementList");
    bindSkillDynamicTooltips(els.imbuementPickerTrigger.parentElement || els.imbuementPickerTrigger);
    if (
      els.imbuementPickerTrigger.matches(":hover") ||
      els.imbuementPickerTrigger === document.activeElement
    ) {
      showFloatingTooltip(els.imbuementPickerTrigger);
    }
  }
  window.requestAnimationFrame(syncImbuementPickerLayout);
}

function renderImbuementLoading() {
  els.imbuementLoading.classList.toggle("hidden", !state.imbuementLoading.active);
  els.imbuementLoadingFill.style.width = `${state.imbuementLoading.progress}%`;
  els.imbuementLoadingText.textContent = state.imbuementLoading.message;
}

function setImbuementLoading({ active, message, progress }) {
  state.imbuementLoading = {
    active,
    message: normalizeUiText(message),
    progress
  };
  renderImbuementLoading();
  syncImbuementLoadingDrift();
}

function syncImbuementLoadingDrift() {
  if (!state.imbuementLoading.active || state.imbuementLoading.progress >= 58) {
    stopImbuementLoadingDrift();
    return;
  }

  if (state.imbuementLoadingTimer) {
    return;
  }

  state.imbuementLoadingTimer = window.setInterval(() => {
    if (!state.imbuementLoading.active) {
      stopImbuementLoadingDrift();
      return;
    }

    state.imbuementLoading.progress = Math.min(state.imbuementLoading.progress + 4, 58);
    renderImbuementLoading();

    if (state.imbuementLoading.progress >= 58) {
      stopImbuementLoadingDrift();
    }
  }, 900);
}

function stopImbuementLoadingDrift() {
  if (!state.imbuementLoadingTimer) {
    return;
  }

  window.clearInterval(state.imbuementLoadingTimer);
  state.imbuementLoadingTimer = null;
}

function formatToolPrice(value, hasValue) {
  if (!hasValue || typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return formatConvertedCurrencyText(value, state.imbuementCurrencyMode, getEffectiveImbuementRates());
}

function renderToolPrice(value, hasValue) {
  if (!hasValue || typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return renderConvertedCurrencyValue(value, state.imbuementCurrencyMode, getEffectiveImbuementRates());
}

function setToolPriceElement(element, value, hasValue) {
  if (!element) {
    return;
  }

  element.innerHTML = renderToolPrice(value, hasValue);
  bindSkillDynamicTooltips(element);
}

function humanizeMarketStatus(status) {
  return status === "coleta completa" ? "completos" : "parciais";
}

function getEffectiveImbuementRates() {
  return {
    ...state.imbuementRates,
    goldTokenPrice: getEffectiveGoldTokenPrice()
  };
}

function getEffectiveGoldTokenPrice() {
  if (state.manualGoldTokenEnabled) {
    return typeof state.manualGoldTokenPrice === "number" ? state.manualGoldTokenPrice : null;
  }

  return state.imbuementMarketPriceMode === "buy"
    ? (state.imbuementRates.goldTokenBuyPrice ?? state.imbuementRates.goldTokenPrice)
    : state.imbuementRates.goldTokenPrice;
}

function parseManualGoldValue(value) {
  const numericValue = Number(String(value || "").replace(/[^0-9]/g, ""));
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function parseManualQuantityValue(value) {
  const numericValue = Number(String(value || "").replace(/[^0-9]/g, ""));
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.trunc(numericValue) : 0;
}

function syncManualTokenState() {
  if (!els.manualTokenToggle || !els.manualTokenInput) {
    return;
  }

  const currentImbuement = getCurrentImbuement();
  const hasGoldTokenBundle = currentImbuement?.tokenBundle?.[state.currentImbuementTier] !== undefined;
  const shouldShowManualPanel = state.imbuementCurrencyMode === "gt" && hasGoldTokenBundle;
  els.manualTokenToggle.checked = state.manualGoldTokenEnabled;
  els.manualTokenInput.disabled = !state.manualGoldTokenEnabled;
  els.manualTokenPanel?.classList.toggle("hidden", !shouldShowManualPanel);
  els.manualTokenInput.classList.toggle("hidden", !shouldShowManualPanel || !state.manualGoldTokenEnabled);
  els.manualTokenInput.classList.toggle("active", shouldShowManualPanel && state.manualGoldTokenEnabled);
}

function normalizeUiText(value) {
  return String(value || "")
    .replaceAll("PreÃ§o", "Preço")
    .replaceAll("preÃ§os", "preços")
    .replaceAll("PreÃ§os", "Preços")
    .replaceAll("nÃ£o", "não")
    .replaceAll("comparacao", "comparação")
    .replaceAll("compararacao", "comparação")
    .replaceAll("recomendacao", "recomendação")
    .replaceAll("Absorcao", "Absorção")
    .replaceAll("Ã§", "ç")
    .replaceAll("Ã£", "ã")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ãº", "ú")
    .replaceAll("Ã¡", "á")
    .replaceAll("Ãª", "ê")
    .replaceAll("Ã©", "é")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã´", "ô");
}

function normalizeStaticLabels() {
  const staticNodes = [
    els.imbuementLoadingText,
    els.imbuementDescription,
    els.imbuementRecommendation,
    els.itemSellRecommendation,
    document.querySelector(".shortcut-heading p")
  ];

  staticNodes.forEach((node) => {
    if (!node) {
      return;
    }

    node.textContent = normalizeUiText(node.textContent);
  });
}

function normalizeStaticLabelsDeep() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    node.textContent = decodeMojibakeText(node.textContent);
  });

  document.querySelectorAll("[title], [aria-label], [placeholder], [data-tooltip]").forEach((node) => {
    ["title", "aria-label", "placeholder", "data-tooltip"].forEach((attribute) => {
      if (node.hasAttribute(attribute)) {
        node.setAttribute(attribute, decodeMojibakeText(node.getAttribute(attribute)));
      }
    });
  });
}

function decodeMojibakeText(value) {
  let text = String(value || "");

  for (let index = 0; index < 3 && /[ÃÂâ]/.test(text); index += 1) {
    try {
      text = decodeURIComponent(escape(text));
    } catch (_error) {
      break;
    }
  }

  return text;
}

const normalizeUiTextBeforeDecode = normalizeUiText;
normalizeUiText = function normalizeUiTextDecoded(value) {
  const decoded = decodeMojibakeText(normalizeUiTextBeforeDecode(value));

  if (!decoded || /<[^>]+>/.test(decoded)) {
    return decoded;
  }

  const locale = state.localeController?.getLocale?.()
    || document.documentElement?.dataset?.appLocale
    || "en";

  return translatePhraseSync(locale, decoded, state.phraseTranslationMap || {});
};

async function loadRecentItems() {
  const stored = await localStorageGet(RECENT_ITEMS_KEY);
  return Array.isArray(stored[RECENT_ITEMS_KEY]) ? stored[RECENT_ITEMS_KEY] : [];
}

async function loadLastWorldSlug() {
  const stored = await localStorageGet(LAST_WORLD_KEY);
  return typeof stored[LAST_WORLD_KEY] === "string" ? stored[LAST_WORLD_KEY] : null;
}

async function saveLastWorldSlug(worldSlug) {
  if (!worldSlug) {
    return;
  }

  await localStorageSet({ [LAST_WORLD_KEY]: worldSlug });
}

function getImbuementCacheStorageKey(worldName) {
  return `imbuements:${String(worldName || "").trim().toLowerCase()}`;
}

async function loadStoredImbuementMarket(worldName) {
  if (!worldName) {
    return null;
  }

  const cacheKey = getImbuementCacheStorageKey(worldName);
  const stored = await localStorageGet(cacheKey);
  const entry = stored?.[cacheKey];

  return entry && typeof entry === "object" ? entry : null;
}

function isImbuementCacheCurrentDay(entry) {
  const updatedAt = entry?.value?.updatedAt;

  if (!updatedAt) {
    return false;
  }

  const updatedDate = new Date(updatedAt);
  const now = new Date();

  return (
    updatedDate.getFullYear() === now.getFullYear() &&
    updatedDate.getMonth() === now.getMonth() &&
    updatedDate.getDate() === now.getDate()
  );
}

async function saveRecentItem(item) {
  if (!item?.slug) {
    return;
  }

  const current = await loadRecentItems();
  const next = [
    {
      slug: item.slug,
      imageSrc: item.image_src || "",
      name: item.wiki_name || item.name || item.slug,
      category: item.category || "Sem categoria",
      lastViewedAt: formatIsoDateTime(new Date().toISOString())
    },
    ...current.filter((entry) => entry.slug !== item.slug)
  ].slice(0, MAX_RECENT_ITEMS);

  state.recentItems = next;
  await localStorageSet({ [RECENT_ITEMS_KEY]: next });
}

function scheduleWarmItemCache() {
  if (state.itemCacheWarmupTimer) {
    window.clearTimeout(state.itemCacheWarmupTimer);
  }

  const requestId = ++state.itemCacheWarmupRequestId;
  state.itemCacheWarmupTimer = window.setTimeout(async () => {
    if (requestId !== state.itemCacheWarmupRequestId) {
      return;
    }

    state.itemCacheWarmupTimer = null;
    await warmCurrentWorldItemCache();
  }, 2500);
}

async function warmCurrentWorldItemCache() {
  const worldSlug = state.currentWorldSlug;
  const warmSlugs = [
    state.currentItem?.item?.slug || state.selectedItemSuggestion?.slug || null,
    ...state.recentItems.map((entry) => entry.slug)
  ]
    .filter(Boolean)
    .filter((slug, index, items) => items.indexOf(slug) === index)
    .slice(0, 4);

  for (const itemSlug of warmSlugs) {
    try {
      await fetchItemStatic({
        itemSlug,
        worldSlug
      });
    } catch (_error) {
      // Warmup is opportunistic and should never interrupt the UI flow.
    }
  }
}

function syncCurrencyButtons(buttons, activeMode, dataKey = "mode") {
  buttons.forEach((button) =>
    button.classList.toggle("active", button.dataset[dataKey] === activeMode)
  );
}

function setFeedback(message, isError = false) {
  const normalizedMessage = normalizeUiText(message);
  els.feedback.textContent = normalizedMessage;
  els.feedback.classList.toggle("error", isError);
  els.feedback.classList.toggle("hidden", !normalizedMessage);
}

function setImbuementFeedback(message, isError = false) {
  const normalizedMessage = normalizeUiText(message);
  els.imbuementFeedback.textContent = normalizedMessage;
  els.imbuementFeedback.classList.toggle("error", isError);
  els.imbuementFeedback.classList.toggle("hidden", !normalizedMessage);
}
