import {
  convertPrice,
  formatCompactNumber,
  formatIsoDateTime,
  formatRelativeTimeFromNow,
  formatNpcPrice,
  slugifyItemInput
} from "./lib/formatters.js";
import {
  closeDesktopOverlay,
  fetchBossTracker,
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
  fetchItemSuggestions,
  fetchNpcDetail,
  fetchNpcIndex,
  fetchStashItems,
  fetchStashMarketValues,
  isDesktopOverlayApp,
  localStorageGet,
  localStorageSet,
  minimizeDesktopOverlay,
  openDesktopExternalLink,
  openDesktopMapWindow,
  openDesktopScreenVisionWindow,
  notifyDesktopReadyToShow,
  setDataLocale,
  setDesktopOverlayOpacity,
  setDesktopSplashProgress,
  setDesktopSplashStatus
} from "./lib/runtime-api.js";
import { bootstrapRendererLocale } from "./lib/renderer-locale.js";
import { t } from "./lib/app-i18n.js";
import { loadPhraseTranslationMap, translatePhraseSync } from "./lib/phrase-translations.js";
import {
  ALL_IMBUEMENT_INGREDIENT_NAMES,
  IMBUEMENT_CATEGORY_LABELS,
  IMBUEMENT_CATEGORY_ORDER,
  IMBUEMENT_FEES,
  IMBUEMENTS,
  IMBUEMENTS_BY_KEY
} from "./lib/imbuements-data.js";
import {
  cloneOverlayToolsStateForSave,
  createDefaultOverlayToolsState,
  OVERLAY_TOOLS_STORAGE_KEY,
  normalizeOverlayToolsState
} from "./lib/overlay-tools-state.js";
import {
  createDefaultOverlayTimerDraft,
  createOverlayTimerEntryFromDraft,
  formatOverlayTimerDuration,
  getOverlayTimerSummary
} from "./lib/overlay-timers.js";

const RECENT_ITEMS_KEY = "recentItems";
const LAST_WORLD_KEY = "lastWorldSlug";
const LOOT_ANALYZER_DRAFTS_KEY = "lootAnalyzerDrafts";
const LOOT_ANALYZER_DRAFTS_FALLBACK_KEY = "poioso:lootAnalyzerDrafts";
const MAX_RECENT_ITEMS = 8;
const NAVIGATION_HISTORY_LIMIT = 30;
const INITIAL_SPLASH_MIN_VISIBLE_MS = 4000;
const STASH_MARKET_REFRESH_COOLDOWN_MS = 1000 * 60;
const DEFAULT_IMBUEMENT_KEY = "vampirism";
const DEFAULT_IMBUEMENT_TIER = "powerful";
const GOLD_ICON_PATH = "assets/ui/Crystal_Coin.gif";
const TIBIA_COIN_CTA_ICON_PATH = "assets/ui/Tibia_Coin_Icon.gif";
const CRYSTAL_COIN_STATIC_ICON_PATH = "assets/ui/crystal-coin.webp";
const MARKET_ICON_PATH = "assets/ui/The_Market_(Object).gif";
const SHRINE_ICON_PATH = "assets/ui/Imbuing_Shrine.gif";
const DESKTOP_SETTINGS_DISCORD_URL = "https://discord.gg/geKX9ewCy";
const DESKTOP_SETTINGS_YOUTUBE_URL = "https://www.youtube.com/@poioso?sub_confirmation=1";
const DESKTOP_SETTINGS_ASSETS = {
  discord: "assets/ui/tools/tibia-eye/settings/discord-button.png",
  youtube: "assets/ui/tools/tibia-eye/settings/youtube-button.png",
  authenticator: "assets/ui/tools/tibia-eye/settings/authenticator-button.png",
  tutorial: "assets/ui/tools/tibia-eye/settings/tutorial-button.png",
  website: "assets/ui/tools/tibia-eye/settings/website-button.png"
};
const BATTLEYE_GREEN_ICON_PATH = "assets/ui/icon_battleyeinitial.gif";
const BATTLEYE_YELLOW_ICON_PATH = "assets/ui/icon_battleye.gif";
const NPC_WES_FALLBACK_ICON_PATH = "assets/ui/Wes_The_Blacksmith.gif";
const NPC_HIRELING_FALLBACK_ICON_PATH = "assets/ui/Hireling_(Trader).gif";
const CREATURE_GEAR_RECOMMENDATIONS_DIR = "assets/data/hakai/creature-gear-recommendations";
const CREATURE_GEAR_VOCATIONS = [
  { key: "knight", label: "Knight", icon: "assets/ui/vocations/knight-male.png" },
  { key: "sorcerer", label: "Sorcerer", icon: "assets/ui/vocations/sorcerer-male.png" },
  { key: "druid", label: "Druid", icon: "assets/ui/vocations/druid-female.png" },
  { key: "paladin", label: "Paladin", icon: "assets/ui/vocations/paladin-male.png" },
  { key: "monk", label: "Monk", icon: "assets/ui/vocations/monk-male.png" }
];
const CREATURE_GEAR_WEAPON_STYLES = ["1H", "2H"];
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
const SUPPORTERS_FETCH_TIMEOUT_MS = 12000;
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
  HP: "assets/ui/Hearthp.png",
  XP: "assets/ui/Xpbestiary.png",
  Velocidade: "assets/ui/Haste_Icon.gif",
  Armadura: "assets/ui/Armor_Icon.gif",
  "Mitigação": "assets/ui/12px-Mitigation_Icon_Wheel.gif",
  Charms: "assets/ui/Charm.gif"
};
const CREATURE_ABILITY_GROUP_ICONS = {
  velocidade: "assets/ui/Haste_Icon.gif",
  speed: "assets/ui/Haste_Icon.gif",
  haste: "assets/ui/Haste_Icon.gif",
  invoca: "assets/ui/Summon_icon.png",
  summon: "assets/ui/Summon_icon.png",
  summons: "assets/ui/Summon_icon.png",
  paralyze: "assets/ui/Slowed_Icon.gif",
  debuff: "assets/ui/Weakened_Icon.png",
  invisibilidade: "assets/ui/Invisible_Icon.gif",
  invisibility: "assets/ui/Invisible_Icon.gif",
  drunk: "assets/ui/Weakened_Icon.png",
  drowning: "assets/ui/Life_Drain_Icone.gif",
  "anti-trap": "assets/ui/Cross.png"
};
const CREATURE_DIFFICULTY_ICONS = {
  harmless: "assets/ui/Bestiario_Inofensivo.gif",
  inofensivo: "assets/ui/Bestiario_Inofensivo.gif",
  trivial: "assets/ui/Bestiario_Trivial.gif",
  easy: "assets/ui/Bestiario_Facil.gif",
  facil: "assets/ui/Bestiario_Facil.gif",
  medium: "assets/ui/Bestiario_Medio_(3).gif",
  medio: "assets/ui/Bestiario_Medio_(3).gif",
  hard: "assets/ui/Bestiario_Dificil.gif",
  dificil: "assets/ui/Bestiario_Dificil.gif"
};
const CREATURE_OCCURRENCE_ICONS = {
  common: "assets/ui/comum.png",
  comum: "assets/ui/comum.png",
  uncommon: "assets/ui/Incomum.png",
  incomum: "assets/ui/Incomum.png",
  rare: "assets/ui/Raro.png",
  raro: "assets/ui/Raro.png",
  "very rare": "assets/ui/muito_raro.png",
  "muito raro": "assets/ui/muito_raro.png"
};
const BOSSTIARY_ICONS = {
  archfoe: "assets/ui/Bosstiary_Archfoe.png",
  bane: "assets/ui/Bosstiary_Bane.png",
  nemesis: "assets/ui/Bosstiary_Nemesis.png"
};
const BOSSTIARY_TOOLTIPS = {
  archfoe: ["1 estrela: 5 mortes - 10 pontos", "2 estrelas: 20 mortes - 30 pontos", "3 estrelas: 60 mortes - 60 pontos"],
  bane: ["1 estrela: 25 mortes - 5 pontos", "2 estrelas: 100 mortes - 15 pontos", "3 estrelas: 300 mortes - 30 pontos"],
  nemesis: ["1 estrela: 1 morte - 10 pontos", "2 estrelas: 3 mortes - 30 pontos", "3 estrelas: 5 mortes - 60 pontos"]
};
const ELEMENT_ICONS = {
  Fisico: "assets/ui/Fisico.png",
  "Físico": "assets/ui/Fisico.png",
  Physical: "assets/ui/Fisico.png",
  physical: "assets/ui/Fisico.png",
  Terra: "assets/ui/Poisoned_Icon.gif",
  Earth: "assets/ui/Poisoned_Icon.gif",
  earth: "assets/ui/Poisoned_Icon.gif",
  Poison: "assets/ui/Poisoned_Icon.gif",
  Fogo: "assets/ui/Burning_Icon.gif",
  Fire: "assets/ui/Burning_Icon.gif",
  fire: "assets/ui/Burning_Icon.gif",
  Morte: "assets/ui/Cursed_Icon.gif",
  Death: "assets/ui/Cursed_Icon.gif",
  death: "assets/ui/Cursed_Icon.gif",
  Energia: "assets/ui/Electrified_Icon.gif",
  Energy: "assets/ui/Electrified_Icon.gif",
  energy: "assets/ui/Electrified_Icon.gif",
  Sagrado: "assets/ui/Dazzled_Icon.gif",
  Holy: "assets/ui/Dazzled_Icon.gif",
  holy: "assets/ui/Dazzled_Icon.gif",
  Gelo: "assets/ui/Freezing_Icon.gif",
  Ice: "assets/ui/Freezing_Icon.gif",
  ice: "assets/ui/Freezing_Icon.gif",
  Cura: "assets/ui/Heal_Icon.png",
  Healing: "assets/ui/Heal_Icon.png",
  healing: "assets/ui/Heal_Icon.png",
  "Life Drain": "assets/ui/Life_Drain_Icone.gif",
  "Mana Drain": "assets/ui/Life_Drain_Icone.gif"
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
  sword: { label: "Sword/Axe/Club", family: "melee", base: 50, weapon: "sword", icon: "assets/ui/skill-melee.gif", unitsPerCharge: 7.2 },
  distance: { label: "Distance", family: "distance", base: 30, weapon: "bow", icon: "assets/ui/skill-distance.gif", unitsPerCharge: 4.32 },
  magic: { label: "Magic Level", family: "magic", base: 1600, weapon: "rod", icon: "assets/ui/skill-magic.gif", unitsPerCharge: 600 },
  shielding: { label: "Shielding", family: "shielding", base: 50, weapon: "shield", icon: "assets/ui/skill-shielding.gif", unitsPerCharge: 14.4 },
  fist: { label: "Fist", family: "fist", base: 50, weapon: "wraps", icon: "assets/ui/skill-fist.gif", unitsPerCharge: 7.2 }
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
  supporterShowcaseTimerIds: [],
  supportersDataUrl: "",
  supportersDataUrls: [],
  coffeeConfig: createDefaultSupporterCoffeeConfig(),
  requestedDockedPanelKey: "",
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
  activeItemSuggestionIndex: -1,
  selectedItemSuggestion: null,
  itemSuggestionRequestId: 0,
  itemSearchRequestId: 0,
  itemSearchLoadingRequestId: 0,
  itemCacheWarmupTimer: null,
  itemCacheWarmupRequestId: 0,
  itemViewMode: "list",
  overlayTools: createDefaultOverlayToolsState(),
  stashItems: [],
  stashCategories: [],
  stashTraders: [],
  stashMarketById: {},
  stashLoaded: false,
  stashLoadingMarket: false,
  stashQuery: "",
  stashCategory: "",
  stashTrader: "",
  stashSort: "name-asc",
  stashValueMode: "npc",
  stashMarketTimer: null,
  stashMarketRequestId: 0,
  stashMarketLoadedSignature: "",
  stashWorldMarketLoadedSlug: "",
  stashWorldMarketLoading: false,
  stashMarketRefreshCooldownUntil: 0,
  stashMarketRefreshCooldownTimer: null,
  stashMarketRefreshWarningTimer: null,
  stashPreviewRequestId: 0,
  lastPreviewedStashSlug: null,
  localeRefreshRequestId: 0,
  phraseTranslationMap: {},
  entityViewMode: "npcs",
  npcIndex: [],
  npcCities: [],
  npcJobs: [],
  npcQuery: "",
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
  monsterCategory: "",
  monsterClass: "",
  monsterType: "",
  monsterWeaknessFilter: "",
  weaknessDropdownOpen: false,
  creatureWeaknessIndex: null,
  creatureWeaknessIndexLoading: false,
  creatureWeaknessIndexPromise: null,
  bossQuery: "",
  bossFilters: {
    bane: true,
    archfoe: true,
    nemesis: true
  },
  monstersLoaded: false,
  monsterDetailRequestId: 0,
  currentMonsterDetail: null,
  currentBossTracker: null,
  bossProbabilityChartMode: "days",
  bossProbabilityChartZoom: 2,
  bossRespawnHistoryLimit: 10,
  creatureGearRecommendations: {},
  creatureGearRecommendationPromises: {},
  creatureGearEntry: null,
  creatureGearVocation: "knight",
  creatureGearWeaponStyle: "1H",
  monsterCategoriesCollapsed: false,
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
  localeController: null
};

const els = {
  appShell: document.querySelector(".app-shell"),
  mainContent: document.querySelector(".main-content"),
  desktopToolbar: document.querySelector("#desktop-toolbar"),
  desktopToolbarBrand: document.querySelector("#desktop-toolbar-brand"),
  desktopUpdateButton: document.querySelector("#desktop-update-button"),
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
  itemViewTabs: document.querySelectorAll(".item-view-tab"),
  itemListView: document.querySelector("#item-list-view"),
  itemStashView: document.querySelector("#item-stash-view"),
  stashSearchInput: document.querySelector("#stash-search-input"),
  stashClearSearch: document.querySelector("#stash-clear-search"),
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
    npcs: document.querySelector("#panel-npcs")
  },
  itemSummaryEmpty: document.querySelector("#item-summary-empty"),
  itemSummaryContent: document.querySelector("#item-summary-content"),
  itemImage: document.querySelector("#item-image"),
  itemCategory: document.querySelector("#item-category"),
  itemName: document.querySelector("#item-name"),
  itemDescription: document.querySelector("#item-description"),
  itemDroppedBy: document.querySelector("#item-dropped-by"),
  itemExtraDetails: document.querySelector("#item-extra-details"),
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
  npcBuyList: document.querySelector("#npc-buy-list"),
  npcSellList: document.querySelector("#npc-sell-list"),
  relatedItems: document.querySelector("#related-items"),
  quickPicks: document.querySelector("#quick-picks"),
  recentItems: document.querySelector("#recent-items"),
  currencyIcons: document.querySelectorAll(".currency-icon")
};

boot();

async function boot() {
  await applyDesktopMode();
  initializeSupporterState();
  state.localeController = await bootstrapRendererLocale({
    root: document.body,
    onChanged(locale) {
      updateLocaleSwitcher();
      renderDesktopUpdateUi();
      void refreshLocaleSensitiveContent(locale);
    }
  });
  await setDataLocale(state.localeController.getLocale()).catch(() => {});
  state.phraseTranslationMap = await loadPhraseTranslationMap(state.localeController.getLocale()).catch(() => ({}));
  renderLocaleSwitcher();
  renderSupporterToolbar();
  normalizeStaticLabels();
  normalizeStaticLabelsDeep();
  positionItemViewLayout();
  bindEvents();
  void initializeDesktopUpdateUi();
  bindImbuementPickerResize();
  renderImbuementOptions();
  syncManualTokenState();
  syncCurrencyButtons(els.imbuementTierButtons, state.currentImbuementTier, "tier");
  renderImbuementLoading();

  showInitialSplash(0);
  try {
    updateInitialSplashProgress(4);
    const bootstrap = await runInitialSplashTask(4, 30, () => fetchBootstrap());
    state.worlds = bootstrap.worlds || [];
    state.quickPicks = bootstrap.quickPicks || [];
    state.supportersDataUrls = normalizeSupportersDataUrls(
      bootstrap.supportersDataUrls,
      bootstrap.supportersDataUrl
    );
    state.supportersDataUrl = state.supportersDataUrls[0] || "";
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
    await prewarmStartupCaches((progress) => {
      updateInitialSplashProgress(mapProgress(progress, 56, 74));
    });
    await runInitialSplashTask(74, 82, () => renderCurrencyIcons());
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

    await runInitialSplashTask(92, 97, () => loadSupportersData({
      supportersDataUrls: state.supportersDataUrls
    }));
    await runInitialSplashTask(97, 98, () => saveLastWorldSlug(state.currentWorldSlug));
    runInitialSplashTask(98, 99, () => {
      scheduleWarmItemCache();
      void refreshImbuementWorldData();
    });
    updateInitialSplashProgress(100);
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
  const showUpdate = phase === "available" || phase === "downloading" || phase === "downloaded";
  const tooltip = phase === "available"
    ? t("updater.availableTooltip")
    : phase === "downloading"
      ? t("updater.downloadNow")
      : phase === "downloaded"
        ? t("updater.downloadedTitle")
        : "";

  els.desktopToolbarBrand?.classList.toggle("has-update", showUpdate);
  if (els.desktopUpdateButton) {
    els.desktopUpdateButton.hidden = !showUpdate;
    els.desktopUpdateButton.disabled = phase !== "available";
    els.desktopUpdateButton.dataset.tooltip = tooltip;
    els.desktopUpdateButton.setAttribute("aria-label", tooltip || "Tibia Toolkit");
  }
}

function exposeTutorialApi() {
  window.TibiaToolsTutorialApi = {
    switchSection(section) {
      switchSection(section);
    },
    async setItemViewMode(mode) {
      await setItemViewMode(mode);
    },
    async typeItemSearch(value, options = {}) {
      const text = String(value || "");
      els.itemInput.value = text;
      state.selectedItemSuggestion = null;
      state.itemSuggestions = [];
      state.itemSuggestionsOpen = false;
      await updateItemSuggestions({ showAll: Boolean(options.showAll) });
    },
    async selectItemByName(name) {
      const wantedName = slugifyItemInput(name || "");
      let suggestion =
        state.itemSuggestions.find((entry) => slugifyItemInput(entry.name || "") === wantedName) ||
        state.itemSuggestions.find((entry) => slugifyItemInput(entry.name || "").includes(wantedName));

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
      setLootMode(options.mode === "solo" ? "solo" : "party");

      if (typeof options.characterName === "string") {
        state.lootSoloCharacterName = options.characterName.trim();
        if (els.lootCharacterInput) {
          els.lootCharacterInput.value = state.lootSoloCharacterName;
        }
      }

      if (typeof options.text === "string") {
        setActiveLootAnalyzerText(options.text);
        if (els.lootInput) {
          els.lootInput.value = options.text;
        }
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
      parseAndRenderLootSplitter();
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
        await openMonsterDetail(options.openBoss, { skipHistory: true });
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

function setLocaleMenuOpen(open) {
  if (!els.localeSwitcherMenu || !els.localeSwitcherButton) {
    return;
  }

  els.localeSwitcherMenu.classList.toggle("hidden", !open);
  els.localeSwitcherButton.setAttribute("aria-expanded", open ? "true" : "false");
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
  syncWheelOfDestinyLocale(locale);

  if (state.itemViewMode === "stash") {
    renderStashGrid();
  }

  if (getActiveLootAnalyzerText().trim()) {
    parseAndRenderLootSplitter();
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

  if (state.currentItem) {
    await handleItemSearch(true).catch(() => {});
  }

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
  }
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
      !els.localeSwitcher?.contains(target)
    ) {
      setLocaleMenuOpen(false);
    }

  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isLocaleMenuOpen()) {
      setLocaleMenuOpen(false);
    }
  });

  els.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.section;
      if (section) {
        switchSection(section);
        updateMainNavScrollButtons();
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
  window.addEventListener("message", (event) => {
    const frame = els.wheelOfDestinyFrame;
    if (!frame?.contentWindow || event.source !== frame.contentWindow) return;

    if (event.data?.type === "tibia-toolkit-wheel-ready") {
      syncWheelOfDestinyLocale();
      return;
    }

    if (event.data?.type === "tibia-toolkit-wheel-height") {
      const height = Math.ceil(Number(event.data.height));
      if (Number.isFinite(height) && height > 0) {
        frame.style.height = `${Math.max(760, Math.min(height + 4, 2400))}px`;
      }
    }
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

  els.localeSwitcherMenu?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-locale-option]");

    if (!button || !state.localeController) {
      return;
    }

    const localeCode = button.getAttribute("data-locale-option") || "pt-BR";
    setLocaleMenuOpen(false);
    void state.localeController.setLocale(localeCode);
  });

  els.toolTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setToolTab(button.dataset.toolTab || "imbuement");
    });
  });

  els.findPartyVocationButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      const vocation = button.dataset.findPartyVocation || "";
      state.findPartyVocation = state.findPartyVocation === vocation ? "" : vocation;
      state.findPartyPage = 1;
      renderFindParty();
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

  els.stashSearchInput?.addEventListener("input", () => {
    state.stashQuery = els.stashSearchInput.value.trim();
    renderStashGrid();
    scheduleStashMarketLoad();
  });

  els.stashClearSearch?.addEventListener("click", () => {
    state.stashQuery = "";
    els.stashSearchInput.value = "";
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
      scheduleStashMarketLoad();
    });
  });

  els.stashMarketRefreshButton?.addEventListener("click", () => {
    if (state.stashLoadingMarket) {
      return;
    }

    if (isStashMarketRefreshCoolingDown()) {
      showStashMarketRefreshWarning();
      return;
    }

    const filteredIds = getTargetStashMarketIds({ onlyVisible: false });

    if (filteredIds.length === 0) {
      showStashMarketRefreshWarning("Nao ha itens de market no filtro atual para atualizar.");
      return;
    }

    setStashMarketRefreshCooldown(STASH_MARKET_REFRESH_COOLDOWN_MS);
    hideStashMarketRefreshWarning();
    void refreshFilteredStashMarketValues();
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
    renderNpcCatalog();
  });

  els.npcCityFilter?.addEventListener("change", () => {
    state.npcCity = els.npcCityFilter.value;
    renderNpcCatalog();
  });

  els.npcJobFilter?.addEventListener("change", () => {
    state.npcJob = els.npcJobFilter.value;
    renderNpcCatalog();
  });

  els.npcTradeFilter?.addEventListener("change", () => {
    state.npcTrade = els.npcTradeFilter.value;
    renderNpcCatalog();
  });

  els.monsterSearchInput?.addEventListener("input", () => {
    state.monsterQuery = els.monsterSearchInput.value.trim();
    renderMonsterCatalog();
  });

  els.bossSearchInput?.addEventListener("input", () => {
    state.bossQuery = els.bossSearchInput.value.trim();
    renderBossCatalog();
  });

  els.bossFilterInputs?.forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.bossFilter;
      if (key) {
        state.bossFilters[key] = input.checked;
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
    renderMonsterCategories();
    renderMonsterCatalog();
    scrollMonsterListIntoView();
  });

  els.monsterClassFilter?.addEventListener("change", () => {
    state.monsterClass = els.monsterClassFilter.value;
    renderMonsterCatalog();
  });

  els.monsterTypeFilter?.addEventListener("change", () => {
    state.monsterType = els.monsterTypeFilter.value;
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

  els.itemInput.addEventListener("input", () => {
    state.selectedItemSuggestion = null;
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

    els.desktopMinimizeButton?.addEventListener("click", () => {
      void minimizeDesktopOverlay();
    });

    els.desktopCloseButton?.addEventListener("click", () => {
      void closeDesktopOverlay();
    });

    els.desktopUpdateButton?.addEventListener("click", () => {
      if (state.appUpdate?.phase !== "available") {
        return;
      }
      void window.desktopApi?.updater?.requestDownload?.();
    });

    els.desktopSettingsButton?.addEventListener("click", () => {
      void requestDesktopDockedPanel("settings-panel");
    });

    els.desktopTibiaCoinsButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void openDesktopScreenVisionWindow("tibia-coins-panel");
    });

    document.addEventListener("click", (event) => {
      const tibiaCoinsButton = event.target.closest(".tibia-coins-cta");
      const settingsActionButton = event.target.closest("[data-settings-action]");

      if (settingsActionButton) {
        event.preventDefault();
        const action = settingsActionButton.dataset.settingsAction || "";

        if (action === "open-discord") {
          void openDesktopExternalLink(DESKTOP_SETTINGS_DISCORD_URL);
        } else if (action === "open-youtube") {
          void openDesktopExternalLink(DESKTOP_SETTINGS_YOUTUBE_URL);
        } else if (action === "open-authenticator") {
          void requestDesktopDockedPanel("authenticator-panel");
        }
        return;
      }

      if (!tibiaCoinsButton) {
        return;
      }

      event.preventDefault();
      void openDesktopScreenVisionWindow("tibia-coins-panel");
    });

    els.desktopAuthenticatorButton?.addEventListener("click", () => {
      void requestDesktopDockedPanel("authenticator-panel");
    });

    els.desktopCoffeeButton?.addEventListener("click", () => {
      void requestDesktopDockedPanel("buy-me-a-coffee-panel");
    });

    els.desktopSupportersButton?.addEventListener("click", () => {
      void requestDesktopDockedPanel(SUPPORTER_DOCKED_PANEL_KEY);
    });

    els.apiDocsButton?.addEventListener("click", () => {
      const docsUrl = new URL("docs/apis.html", window.location.href).href;
      void openDesktopExternalLink(docsUrl);
    });

    els.desktopDockedPanelClose?.addEventListener("click", () => {
      const currentPanelKey = state.dockedToolPanelState.panelKey || SUPPORTER_DOCKED_PANEL_KEY;
      void openDesktopScreenVisionWindow(currentPanelKey);
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

  if (supportersDataUrls.length <= 0) {
    applySupportersPayload({
      supporters: [],
      coffee: createDefaultSupporterCoffeeConfig()
    });
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
    applySupportersPayload(payload);

    if (payload.supporters.length > 0) {
      void hydrateSupporterProfiles();
    }
    return;
  } catch (_error) {
    if (cachedDocument) {
      applySupportersPayload(cachedDocument);
      if (cachedDocument.supporters?.length) {
        void hydrateSupporterProfiles();
      }
      return;
    }
  }

  applySupportersPayload({
    supporters: [],
    coffee: createDefaultSupporterCoffeeConfig()
  });
}

function applySupportersPayload(payload = {}) {
  const normalizedPayload = normalizeSupportersPayload(payload);
  state.supporters = buildSupporterEntries(normalizedPayload.supporters);
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
  return openDesktopScreenVisionWindow(normalizedPanelKey);
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

function buildSupporterEntries(seeds = []) {
  return [...seeds]
    .map((seed) => {
      const totalAmountCents = resolveSupporterAmountCents(seed);
      const currency = resolveSupporterCurrency(seed);
      return {
        name: String(seed.characterName || seed.name || "").trim(),
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
        amountLabel: formatSupporterAmount(totalAmountCents, currency)
      };
    })
    .filter((entry) => Boolean(entry.name))
    .sort((left, right) => right.totalAmountCents - left.totalAmountCents || left.name.localeCompare(right.name))
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

  return "R$";
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

function renderSupporterToolbar() {
  const supporters = state.supporters;
  const activeSupporter = supporters[0] || null;
  const narrowSupporters = supporters.slice(0, 3);
  const narrowSupporter = narrowSupporters[state.supporterNarrowMedalIndex] || activeSupporter;

  if (!els.desktopSupportersSlot || !els.desktopSupportersButton) {
    return;
  }

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
  if (panelState.panelKey) {
    state.requestedDockedPanelKey = panelState.panelKey;
  } else if (!panelState.open && (panelState.phase || "closed") === "closed") {
    state.requestedDockedPanelKey = "";
  }

  state.dockedToolPanelState = {
    open: Boolean(panelState.open),
    panelKey: panelState.panelKey || "",
    side: panelState.side === "left" ? "left" : "right",
    phase: panelState.phase || "closed",
    width: Number(panelState.width) || 0
  };

  syncDockedToolPanelShell();
  renderActiveDockedToolPanel();
  window.requestAnimationFrame(syncDesktopEffectiveBreakpoints);
}

function syncDockedToolPanelShell() {
  if (!els.desktopDockedPanel) {
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
  document.body.dataset.dockedPanelSide = side;
  document.body.dataset.dockedPanelPhase = phase;

  els.desktopDockedPanel.classList.toggle("hidden", !isVisible || phase === "left-pre-shift");
  els.desktopDockedPanel.setAttribute("aria-hidden", panelState.open ? "false" : "true");
}

function renderActiveDockedToolPanel() {
  if (!els.desktopDockedPanelContent || !els.desktopDockedPanelTitle || !els.desktopDockedPanelDescription) {
    return;
  }

  clearSupporterShowcaseTimers();

  const panelState = state.dockedToolPanelState;
  const effectivePanelKey = panelState.panelKey || state.requestedDockedPanelKey || "";
  const isDockedPanelVisible = panelState.open || panelState.phase !== "closed";
  const isSupporterPanel = effectivePanelKey === SUPPORTER_DOCKED_PANEL_KEY && isDockedPanelVisible;
  const isSettingsPanel = effectivePanelKey === "settings-panel" && isDockedPanelVisible;

  if (isSupporterPanel) {
    els.desktopDockedPanelTitle.textContent = t("screenVision.supporters.title");
    els.desktopDockedPanelDescription.textContent = "";
    els.desktopDockedPanelContent.innerHTML = renderSupporterDockedPanelMarkup();
    bindSupporterCardActions(els.desktopDockedPanelContent);
    initializeSupporterShowcaseCycles(els.desktopDockedPanelContent);
    return;
  }

  if (isSettingsPanel) {
    els.desktopDockedPanelTitle.textContent = t("screenVision.settings.title");
    els.desktopDockedPanelDescription.textContent = "";
    els.desktopDockedPanelContent.innerHTML = renderDesktopSettingsPanelMarkup();
    return;
  }

  els.desktopDockedPanelTitle.textContent = "Painel";
  els.desktopDockedPanelDescription.textContent = "Painel lateral acoplado ao app principal.";
  els.desktopDockedPanelContent.innerHTML = `
    <section class="desktop-docked-panel-empty-card">
      <div class="desktop-docked-panel-empty-icon" aria-hidden="true"></div>
      <strong id="desktop-docked-panel-empty-title">Painel em preparacao</strong>
      <p id="desktop-docked-panel-empty-copy">Vamos preencher este painel lateral no proximo passo.</p>
    </section>
  `;
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
  const settingsItems = [
    {
      label: t("screenVision.settings.discordLabel"),
      tooltip: t("screenVision.settings.discordTooltip"),
      image: DESKTOP_SETTINGS_ASSETS.discord,
      action: "open-discord"
    },
    {
      label: t("screenVision.settings.youtubeLabel"),
      tooltip: t("screenVision.settings.youtubeTooltip"),
      image: DESKTOP_SETTINGS_ASSETS.youtube,
      action: "open-youtube"
    },
    {
      label: t("screenVision.settings.authenticatorLabel"),
      tooltip: t("screenVision.settings.authenticatorTooltip"),
      image: DESKTOP_SETTINGS_ASSETS.authenticator,
      action: "open-authenticator"
    },
    {
      label: t("screenVision.settings.tutorialLabel"),
      tooltip: t("screenVision.settings.tutorialTooltip"),
      image: DESKTOP_SETTINGS_ASSETS.tutorial,
      action: ""
    },
    {
      label: t("screenVision.settings.websiteLabel"),
      tooltip: t("screenVision.settings.websiteTooltip"),
      image: DESKTOP_SETTINGS_ASSETS.website,
      action: ""
    }
  ];

  return `
    <div class="desktop-settings-panel">
      ${settingsItems.map((entry) => `
        <section class="desktop-settings-option">
          <strong class="desktop-settings-option-label">${escapeHtml(entry.label)}</strong>
          <button
            type="button"
            class="desktop-settings-image-button"
            ${entry.action ? `data-settings-action="${escapeHtml(entry.action)}"` : ""}
            data-tooltip="${escapeHtml(entry.tooltip)}"
            aria-label="${escapeHtml(entry.tooltip)}"
          >
            <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.label)}">
          </button>
        </section>
      `).join("")}
    </div>
  `;
}

function renderSupporterCardMarkup(supporter = {}) {
  const tierMeta = getSupporterTierMeta(supporter.tier || "default");
  const subtitle = buildSupporterSubtitle(supporter);
  const highlightedSubtitle = buildHighlightedSupporterSubtitle(supporter);
  const avatarMarkup = getPlayerAvatarMarkup({
    name: supporter.name,
    vocation: supporter.vocation,
    sex: supporter.sex
  });
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

  if (sectionChanged && !options.skipHistory && !state.navigationRestoring) {
    pushCurrentNavigationEntry();
  }

  state.selectedSection = nextSection;
  els.navButtons.forEach((navButton) =>
    navButton.classList.toggle("active", navButton.dataset.section === nextSection)
  );

  Object.entries(els.panels).forEach(([key, panel]) => {
    panel.classList.toggle("active", key === nextSection);
  });

  if (nextSection === "npcs") {
    void ensureActiveEntityCatalogLoaded();
  }

  if (sectionChanged || !state.currentNavigationEntry) {
    setCurrentNavigationEntry(getCurrentSectionNavigationEntry());
  }
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

async function setItemViewMode(mode, options = {}) {
  const nextMode = mode === "stash" ? "stash" : "list";

  if (nextMode !== state.itemViewMode && !options.skipHistory && !state.navigationRestoring) {
    pushCurrentNavigationEntry();
  }

  state.itemViewMode = nextMode;
  els.itemViewTabs.forEach((button) =>
    button.classList.toggle("active", button.dataset.itemView === state.itemViewMode)
  );
  els.itemListView?.classList.remove("hidden");
  els.controlsCard?.classList.toggle("hidden", state.itemViewMode === "stash");
  els.shortcutsCard?.classList.toggle("hidden", state.itemViewMode === "stash");
  els.itemStashView?.classList.toggle("hidden", state.itemViewMode !== "stash");

  if (state.itemViewMode === "stash") {
    try {
      await ensureStashLoaded();
      renderStashFilters();
      renderStashGrid();
      scheduleStashMarketLoad();
    } catch (error) {
      setStashStatus(error instanceof Error ? error.message : "Falha ao carregar stash.");
    }
  }

  if (!options.skipCurrentEntry) {
    setCurrentNavigationEntry(getCurrentSectionNavigationEntry());
  }
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
    renderNpcCatalog();
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
      <img class="monster-category-icon all" src="assets/ui/creature-category-all.png" alt="${escapeHtml(t("common.all.masculine"))}">
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

function renderNpcCatalog() {
  if (!els.npcListPanel) {
    return;
  }

  const query = normalizeSearchText(state.npcQuery);
  const items = state.npcIndex.filter((npc) => {
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

    if (state.npcTrade && (npc.trade || "unknown") !== state.npcTrade) {
      return false;
    }

    return true;
  });

  if (items.length === 0) {
    els.npcListPanel.innerHTML = `<div class="empty-inline">${escapeHtml(t("npcs.noneFound"))}</div>`;
    return;
  }

  els.npcListPanel.innerHTML = normalizeUiText(
    items.slice(0, 240).map(renderNpcCatalogCard).join("") +
      `<div class="entity-count">${escapeHtml(t("npcs.foundNpcs", { count: formatCompactNumber(items.length) }))}</div>`
  );
  bindSkillDynamicTooltips(els.npcListPanel);

  els.npcListPanel.querySelectorAll("[data-npc-name]").forEach((button) => {
    button.addEventListener("click", () => {
      void openNpcDetail(button.dataset.npcName);
    });
  });
}

function renderMonsterCatalog() {
  if (!els.monsterListPanel) {
    return;
  }

  if (state.monsterWeaknessFilter && !state.creatureWeaknessIndex) {
    renderFilteredCreatureLoading("monsters");
    void ensureCreatureWeaknessIndexLoaded().then(() => renderMonsterCatalog()).catch((error) => {
      renderEntityError(els.monsterListPanel, error, "filtro de fraqueza");
    });
    return;
  }

  const query = normalizeSearchText(state.monsterQuery);
  const items = state.monsterIndex.filter((monster) => {
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

    if (state.monsterWeaknessFilter && !isCreatureWeakToElement(monster, state.monsterWeaknessFilter)) {
      return false;
    }

    return true;
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
  });

  if (items.length === 0) {
    els.monsterListPanel.innerHTML = `<div class="empty-inline">${escapeHtml(t("npcs.noneCreaturesFound"))}</div>`;
    return;
  }

  els.monsterListPanel.innerHTML = normalizeUiText(
    items.slice(0, 240).map(renderMonsterCatalogCard).join("") +
      `<div class="entity-count">${escapeHtml(t("npcs.foundCreatures", { count: formatCompactNumber(items.length) }))}</div>`
  );
  bindSkillDynamicTooltips(els.monsterListPanel);

  els.monsterListPanel.querySelectorAll("[data-monster-name]").forEach((button) => {
    button.addEventListener("click", () => {
      void openMonsterDetail(button.dataset.monsterName);
    });
  });
}

function renderBossCatalog() {
  if (!els.bossListPanel) {
    return;
  }

  if (state.monsterWeaknessFilter && !state.creatureWeaknessIndex) {
    renderFilteredCreatureLoading("bosses");
    void ensureCreatureWeaknessIndexLoaded().then(() => renderBossCatalog()).catch((error) => {
      renderEntityError(els.bossListPanel, error, "filtro de fraqueza");
    });
    return;
  }

  const query = normalizeSearchText(state.bossQuery);
  const activeFilters = Object.entries(state.bossFilters)
    .filter(([, active]) => active)
    .map(([key]) => key);
  const bosses = state.monsterIndex.filter((monster) => {
    const bossKey = normalizeSearchText(monster.bossCategory);

    if (!bossKey || !activeFilters.includes(bossKey)) {
      return false;
    }

    if (query && !normalizeSearchText(`${monster.name} ${monster.bossCategory}`).includes(query)) {
      return false;
    }

    if (state.monsterWeaknessFilter && !isCreatureWeakToElement(monster, state.monsterWeaknessFilter)) {
      return false;
    }

    return true;
  });

  if (bosses.length === 0) {
    els.bossListPanel.innerHTML = `<div class="empty-inline">${escapeHtml(t("npcs.noneBossesFound"))}</div>`;
    return;
  }

  els.bossListPanel.innerHTML = normalizeUiText(
    bosses.slice(0, 240).map(renderBossCatalogCard).join("") +
      `<div class="entity-count">${escapeHtml(t("npcs.foundBosses", { count: formatCompactNumber(bosses.length) }))}</div>`
  );
  bindSkillDynamicTooltips(els.bossListPanel);

  els.bossListPanel.querySelectorAll("[data-monster-name]").forEach((button) => {
    button.addEventListener("click", () => {
      void openMonsterDetail(button.dataset.monsterName);
    });
  });
}

function renderNpcCatalogCard(npc) {
  const meta = npc.city || "Cidade nao informada";
  const occupation = [npc.job, npc.job2].filter(Boolean).join(" / ");

  return `
    <button type="button" class="entity-row npc-row" data-npc-name="${escapeHtml(npc.name)}" data-tooltip="${escapeHtml(t("common.viewDetails"))}">
      <img src="${escapeHtml(npc.imageSrc || "")}" alt="${escapeHtml(npc.name)}" onerror="this.style.visibility='hidden'">
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
      <img src="${escapeHtml(monster.imageSrc || "")}" alt="${escapeHtml(monster.name)}" onerror="this.style.visibility='hidden'">
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
      <img class="boss-card-image" src="${escapeHtml(monster.imageSrc || "")}" alt="${escapeHtml(monster.name)}" onerror="this.style.visibility='hidden'">
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

function renderNpcDetail(detail) {
  const jobs = [detail.job, detail.job2].filter((job) => job && !isWeakNpcJobLabel(job));
  const description = jobs.length
    ? `Este NPC é ${jobs.map(escapeHtml).join(", ")}.`
    : "Ocupação não informada.";

  setEntityDetailHtml(`
    <div class="entity-hero npc-hero">
      <img src="${escapeHtml(detail.imageSrc || "")}" alt="${escapeHtml(detail.name)}" onerror="this.style.visibility='hidden'">
      <div>
        <p class="muted">${escapeHtml(detail.city || "Local nao informado")}</p>
        <h3>${escapeHtml(detail.name)}</h3>
        <p>${description}</p>
      </div>
    </div>
    <div class="entity-chip-row">
      ${renderEntityChip("Cidade", detail.city, "npc-city")}
      ${jobs.map((job) => renderEntityChip("Funcao", job, "npc-job")).join("")}
      ${renderEntityChip("Comercio", renderTradeLabel(detail.trade))}
      ${renderEntityChip("Adicionado", detail.implemented)}
    </div>
    ${renderNpcLocationSection(detail)}
    ${renderNpcNotes(detail)}
    ${renderSoundList(detail.sounds, "npc")}
    ${renderNpcTradeItems(detail.tradeItems)}
    ${detail.wikiUrl ? `<button type="button" class="entity-link-chip entity-link-bottom" data-external-url="${escapeHtml(detail.wikiUrl)}">${escapeHtml(t("common.openWiki"))}</button>` : ""}
  `);
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
    <section>
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

  const mapLink = !isBossDetail && detail.map?.url
    ? ` <span class="inline-map-wrap">(<button type="button" class="inline-map-link" data-map-url="${escapeHtml(detail.map.url)}" data-map-title="${escapeHtml(`${detail.name} - ${location}`)}">aqui<img src="assets/ui/18px-Map_(Colour).gif" alt="Mapa"></button>)</span>`
    : "";
  const bossMapActions = isBossDetail
    ? renderBossLocationMapActions(detail)
    : "";

  return `
    <section>
      <h4>${escapeHtml(t("common.locations"))}</h4>
      <p>${escapeHtml(location || "-")}${mapLink}</p>
      ${bossMapActions}
    </section>
  `;
}

function renderBossLocationMapActions(detail = {}) {
  const locationUrl = String(detail.map?.url || "").trim();
  const locationTitle = `${detail.name || "Boss"} - ${detail.location || "Mapa"}`;

  return `
    <div class="boss-map-action-row" data-boss-map-actions data-location-map-url="${escapeHtml(locationUrl)}" data-location-map-title="${escapeHtml(locationTitle)}">
      ${locationUrl ? `<button type="button" class="entity-link-chip boss-map-toggle" data-boss-map-panel="location">${escapeHtml(t("common.showOnMap"))}</button>` : ""}
      <span data-boss-route-action-slot></span>
    </div>
    <div class="boss-inline-map hidden" data-boss-inline-map-panel></div>
  `;
}

function renderNpcNotes(detail = {}) {
  const spoilers = normalizeNpcSpoilers(detail);
  const regularNote = normalizeUiText(stripSpoilerPrefixFromNotes(detail.notes || ""));

  if (!regularNote && spoilers.length === 0) {
    return "";
  }

  return `
    <section>
      <h4>${escapeHtml(t("common.notes"))}</h4>
      ${regularNote ? `<p>${escapeHtml(regularNote)}</p>` : ""}
      ${spoilers.map((spoiler, index) => renderNpcSpoiler(spoiler, index)).join("")}
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

  setEntityDetailHtml(`
    <div data-tutorial-focus="creature-summary">
      <div class="entity-hero creature-hero">
        <img src="${escapeHtml(detail.imageSrc || "")}" alt="${escapeHtml(detail.name)}" onerror="this.style.visibility='hidden'">
        <div>
          <p class="muted">${escapeHtml([detail.creatureClass, detail.primaryType].filter(Boolean).join(" - ") || "Criatura")}</p>
          <h3>${escapeHtml(detail.name)}${renderBossCategoryBadge(detail.bossCategory)}</h3>
          <p>${escapeHtml([detail.secondaryType, detail.isBoss === "yes" ? "Boss" : ""].filter(Boolean).join(" - "))}</p>
        </div>
      </div>
      ${renderMonsterOverview(stats, detail)}
      ${renderCreatureAbilities(detail.abilities)}
    </div>
    <div data-tutorial-focus="boss-extra-details">
      ${renderEntityTextSection("Comportamento", detail.behaviour)}
      ${renderMonsterLocationSection(detail)}
      ${renderSoundList(detail.sounds, "monster")}
    </div>
    ${renderEntityTextSection("Historia", detail.history)}
    ${renderCreatureLoot(detail.loot)}
    ${renderCreatureDetailActionRow(wikiButton)}
    ${renderBossTrackerHost(detail)}
    ${renderCreatureGearRecommendationHost(detail)}
  `);
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
        <strong>Carregando estatisticas do boss...</strong>
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
        const tooltip = iconOnly && !isEmpty ? `${label}: ${value}` : "";
        return `
          <div class="creature-status-line${isEmpty ? " empty" : ""}${iconOnly ? " icon-only-stat" : ""}"${tooltip ? ` data-tooltip="${escapeHtml(tooltip)}"` : ""}>
            ${icon ? `<img src="${escapeHtml(icon)}" alt="">` : ""}
            ${
              iconOnly
                ? `<span>${escapeHtml(label)}</span>`
                : `<span><strong>${escapeHtml(value)}</strong> ${escapeHtml(label)}</span>`
            }
          </div>
        `;
      }).join("")}
    </div>
  `;
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
      <strong><img src="assets/ui/15px-Warning_Icon_Yellow.png" alt=""> Aviso importante</strong>
      <p>Essa criatura nao faz parte do bestiario; informacoes sobre fraquezas, resistencias e loots podem estar imprecisas.</p>
    </div>
  `;
}

function renderCreatureTraits(detail = {}) {
  const immunities = [
    detail.paralyzeImmune ? { label: "Paralisia", value: detail.paralyzeImmune, icon: "assets/ui/Slowed_Icon.gif" } : null,
    detail.senseInvisible ? { label: "Invisivel", value: detail.senseInvisible, icon: "assets/ui/9px-Invisible_Icon.gif" } : null
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
        <strong>Imunidades:</strong>
        ${renderTraitIcons(immunities, "Nada.")}
      </div>
      <div>
        <strong>Pode ser Puxado:</strong>
        ${renderBooleanTrait(detail.pushable)}
      </div>
      <div>
        <strong>Passa por:</strong>
        ${renderElementTraitIcons(walksThrough, "Nada.")}
      </div>
      <div>
        <strong>Empurra Objetos:</strong>
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

  const selectedWorld = getSelectedWorld();

  try {
    const bossTracker = await fetchBossTracker({
      name: detail.name,
      worldName: selectedWorld?.name || "",
      worldSlug: selectedWorld?.slug || ""
    });

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
  syncBossMapActions(detail, bossTracker, mapActions);
  bindEntityDetailActions(shell);
  bindSkillDynamicTooltips(shell);
  centerBossChartScrolls(shell);
}

function syncBossMapActions(detail = {}, bossTracker = null, mapActions = null) {
  if (!mapActions) {
    return;
  }

  const locationUrl = String(bossTracker?.mapUrl || mapActions.dataset.locationMapUrl || "").trim();
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

  const routeSlot = mapActions.querySelector("[data-boss-route-action-slot]");
  if (routeSlot) {
    routeSlot.innerHTML = hasBossRouteMap(bossTracker?.routeMap)
      ? `<button type="button" class="entity-link-chip boss-map-toggle" data-boss-map-panel="route">Como chegar</button>`
      : "";
  }

  bindEntityDetailActions(mapActions);
}

function hasBossRouteMap(routeMap) {
  return Boolean(
    routeMap &&
      Array.isArray(routeMap.maps) &&
      routeMap.maps.some((map) =>
        Array.isArray(map?.paths) &&
          map.paths.some((pathEntry) => Array.isArray(pathEntry?.routes) && pathEntry.routes.length > 1)
      )
  );
}

function renderBossInlineMap(button) {
  const mode = button.dataset.bossMapPanel || "";
  const actions = button.closest("[data-boss-map-actions]");
  const panel = actions?.parentElement?.querySelector("[data-boss-inline-map-panel]");

  if (!actions || !panel) {
    return;
  }

  const isSameOpen = !panel.classList.contains("hidden") && panel.dataset.bossMapMode === mode;
  actions.querySelectorAll("[data-boss-map-panel]").forEach((entry) => {
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
    `${TIBIA_MAP_DATA_BASE_URL}floor-${floorLabel}-map.png`,
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

    if (!state.creatureGearRecommendationPromises[slug]) {
      const recommendationPath = `${CREATURE_GEAR_RECOMMENDATIONS_DIR}/${slug}.json`;
      state.creatureGearRecommendationPromises[slug] = (window.desktopApi?.assets?.readJson
        ? window.desktopApi.assets.readJson(recommendationPath)
        : fetch(recommendationPath).then((response) => response.ok ? response.json() : null)
      )
        .then((entry) => {
          if (entry) {
            state.creatureGearRecommendations[slug] = entry;
          }
          return entry;
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
      <h4>Habilidades</h4>
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
      <h4>Sons</h4>
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
      <h4>Elementos</h4>
      <div class="damage-grid creature-element-grid">
        ${modifiers.map((modifier) => {
          const numericValue = parseCreaturePercent(modifier.value);
          const tone = numericValue > 100 ? "weak" : numericValue < 100 ? "resist" : "neutral";
          const icon = ELEMENT_ICONS[modifier.label] || "";
          const elementKey = normalizeCreatureElementKey(modifier.key || modifier.label);
          const tooltip = `Filtrar fraqueza: ${ELEMENT_DISPLAY_NAMES[modifier.label] || modifier.label}`;
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

  return `<section><h4>${escapeHtml(title)}</h4><p>${escapeHtml(value)}</p></section>`;
}

function renderCreatureLoot(loot = []) {
  if (!Array.isArray(loot) || loot.length === 0) {
    return "";
  }

  const groups = [
    ["common", "Comum"],
    ["uncommon", "Incomum"],
    ["semi-rare", "Semi-raro"],
    ["rare", "Raro"],
    ["very-rare", "Muito raro"],
    ["event", "Eventos"],
    ["event-common", "Eventos - Comum"],
    ["event-uncommon", "Eventos - Incomum"],
    ["event-semi-rare", "Eventos - Semi-raro"],
    ["event-rare", "Eventos - Raro"],
    ["event-very-rare", "Eventos - Muito raro"],
    ["event-always", "Eventos - Sempre"],
    ["always", "Sempre"],
    ["unknown", "Outros"]
  ];

  const byRarity = loot.reduce((accumulator, item) => {
    const rarity = normalizeRenderedCreatureLootRarity(item.rarity);
    if (!accumulator[rarity]) {
      accumulator[rarity] = [];
    }
    accumulator[rarity].push(item);
    return accumulator;
  }, {});

  return `
    <section class="creature-loot-section">
      <h4>Loot</h4>
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
  }, remaining);
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
    button.addEventListener("click", () => {
      void openDesktopExternalLink(button.dataset.externalUrl);
    });
  });

  root?.querySelectorAll("[data-map-url]").forEach((button) => {
    button.addEventListener("click", () => {
      void openMapModal(button.dataset.mapUrl, button.dataset.mapTitle || "Mapa");
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

async function openMapModal(url, title = "Mapa") {
  const mapUrl = getEmbeddedTibiaMapUrl(url);
  closeMapModal();

  const openedInDesktop = await openDesktopMapWindow(mapUrl, normalizeUiText(title)).catch(() => false);

  if (openedInDesktop) {
    return;
  }

  if (isDesktopOverlayApp()) {
    void openDesktopExternalLink(mapUrl);
    return;
  }

  if (!els.mapModal || !els.mapModalFrame || !els.mapModalCard) {
    void openDesktopExternalLink(mapUrl);
    return;
  }

  els.mapModalTitle.textContent = normalizeUiText(title);
  els.mapModalFrame.src = mapUrl;
  if (!els.mapModalCard.style.left || !els.mapModalCard.style.top) {
    els.mapModalCard.style.left = "28px";
    els.mapModalCard.style.top = "84px";
  }
  els.mapModal.classList.remove("hidden");
  els.mapModal.setAttribute("aria-hidden", "false");
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

  if (!els.panelItemHeader || !tabs || !els.itemStashView) {
    return;
  }

  els.panelItemHeader.insertAdjacentElement("afterend", tabs);
  tabs.insertAdjacentElement("afterend", els.itemStashView);
}

async function ensureStashLoaded() {
  if (state.stashLoaded) {
    return;
  }

  setStashStatus(t("stash.loadingLocal"));
  const data = await fetchStashItems();
  state.stashItems = Array.isArray(data?.items) ? data.items : [];
  state.stashCategories = Array.isArray(data?.categories) ? data.categories : [];
  state.stashTraders = Array.isArray(data?.traders) ? data.traders : [];
  state.stashLoaded = true;
  renderStashFilters();
  setStashStatus(t("stash.localItemsCount", { count: formatCompactNumber(state.stashItems.length) }));
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
  } catch (_error) {
    // O analyzer ainda pode seguir com fallback de nomes mesmo sem o preload local.
  }

  report(100);
}

function renderStashFilters() {
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
    const cooldownSeconds = getStashMarketRefreshCooldownSeconds();
    els.stashMarketRefreshButton.classList.toggle("hidden", !marketModeActive);
    els.stashMarketRefreshButton.disabled = !marketModeActive || state.stashLoadingMarket;
    els.stashMarketRefreshButton.classList.toggle("blocked", marketModeActive && cooldownActive);
    els.stashMarketRefreshButton.setAttribute("aria-disabled", marketModeActive && cooldownActive ? "true" : "false");
    els.stashMarketRefreshButton.classList.toggle("loading", marketModeActive && state.stashLoadingMarket);
    els.stashMarketRefreshButton.dataset.tooltip =
      marketModeActive && cooldownActive
        ? `Atualizar preços do market (aguarde ${cooldownSeconds}s)`
        : "Atualizar preços do market";
  }
  if (state.stashValueMode !== "market") {
    hideStashMarketRefreshWarning();
  }
}

function getFilteredStashItems() {
  const query = normalizeSearchText(state.stashQuery);

  return state.stashItems
    .filter((item) => {
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

  const items = getFilteredStashItems();

  if (items.length === 0) {
    els.stashGrid.innerHTML = `<div class="stash-empty">${escapeHtml(t("stash.noItemsFound"))}</div>`;
    setStashStatus(t("stash.noItemsCurrentFilters"));
    return;
  }

  els.stashGrid.innerHTML = items.map((item) => renderStashItem(item)).join("");
  setStashGridStatus(items);

  els.stashGrid.querySelectorAll("[data-stash-item-slug]").forEach((button) => {
    const getItem = () => {
      const slug = button.dataset.stashItemSlug;
      return state.stashItems.find((entry) => entry.slug === slug) || null;
    };

    button.addEventListener("mouseenter", () => showStashItemTooltip(button, getItem()));
    button.addEventListener("focus", () => showStashItemTooltip(button, getItem()));
    button.addEventListener("mouseleave", hideStashItemTooltip);
    button.addEventListener("blur", hideStashItemTooltip);
    button.addEventListener("click", () => {
      const item = getItem();

      if (item) {
        hideStashItemTooltip();
        void previewStashItem(item, { loadMarket: true });
      }
    });
  });
}

function renderStashItem(item) {
  const value = getStashItemValue(item, state.stashValueMode);
  const borderClass = getStashValueClass(value);

  return `
    <button type="button" class="stash-item ${borderClass}" aria-label="${escapeHtml(item.name)}" data-stash-item-slug="${escapeHtml(item.slug)}" data-market-id="${escapeHtml(item.marketId || "")}">
      <img src="${item.imageSrc}" alt="${escapeHtml(item.name)}">
    </button>
  `;
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
    scrollItemSummaryIntoView();
    return;
  }

  state.lastPreviewedStashSlug = item.slug;
  const requestId = ++state.stashPreviewRequestId;
  const loadingMessage = `Carregando ${item.name}...`;
  let loadingShown = false;
  const loadingTimer = window.setTimeout(() => {
    loadingShown = true;
    showGlobalLoading(loadingMessage);
  }, 180);

  try {
    const staticData = await fetchItemStatic({
      itemSlug: item.slug,
      worldSlug: state.currentWorldSlug
    });

    if (requestId !== state.stashPreviewRequestId) {
      return;
    }

    state.currentItem = loadMarket ? staticData : applyStashMarketPreview(staticData, item);
    renderItem();

    if (loadMarket) {
      void hydrateStashPreviewItem(item.slug, requestId);
    }

    scrollItemSummaryIntoView();
  } catch (error) {
    if (requestId === state.stashPreviewRequestId) {
      setFeedback(error instanceof Error ? error.message : "Falha ao abrir preview do item.", true);
    }
  } finally {
    window.clearTimeout(loadingTimer);
    if (loadingShown) {
      hideGlobalLoading();
    }
  }
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
    await refreshCurrencyRates();
    await saveRecentItem(data.item);
    state.selectedItemSuggestion = {
      slug: data.item.slug,
      name: data.item.wiki_name || data.item.name,
      category: data.item.category || "Sem categoria",
      imageSrc: data.item.image_src || ""
    };
    els.itemInput.value = state.selectedItemSuggestion.name;
    closeItemSuggestions();
    renderRecentItems();
    renderItem();
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
  const loadedCount = items.filter((item) => item.marketId && state.stashMarketById[item.marketId]).length;
  const loadingSuffix = state.stashLoadingMarket ? " carregando..." : "";
  setStashStatus(
    `${formatCompactNumber(items.length)} itens exibidos. Market: ${formatCompactNumber(loadedCount)}/${formatCompactNumber(eligibleCount)}${loadingSuffix}`
  );
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
    return;
  }

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
    onlyVisible: false
  });
}

function cancelStashMarketLoading() {
  if (!state.stashLoadingMarket) {
    return;
  }

  if (state.stashMarketTimer) {
    window.clearTimeout(state.stashMarketTimer);
    state.stashMarketTimer = null;
  }

  state.stashMarketRequestId += 1;
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
  const onlyVisible = options?.onlyVisible === true;
  const requestId = ++state.stashMarketRequestId;
  const targetMarketIds = getTargetStashMarketIds({
    onlyVisible,
    includeLoaded: forceFresh || onlyVisible
  });
  const marketIdsToLoad = [...targetMarketIds];
  const marketSignature = `${state.currentWorldSlug}:${marketIdsToLoad.join(",")}`;

  if (marketIdsToLoad.length === 0) {
    if (forceFresh) {
      setStashGridStatus(getFilteredStashItems());
    }
    state.stashMarketLoadedSignature = marketSignature;
    renderStashGrid();
    return;
  }

  if (!forceFresh) {
    await loadStashWorldMarketSnapshot(requestId);
  }

  if (requestId !== state.stashMarketRequestId) {
    return;
  }

  const hasMarketEntry = (id) => Object.prototype.hasOwnProperty.call(state.stashMarketById, id);
  const pendingMarketIds = forceFresh
    ? marketIdsToLoad
    : marketIdsToLoad.filter((id) => !hasMarketEntry(id));

  if (pendingMarketIds.length === 0) {
    state.stashMarketLoadedSignature = marketSignature;
    renderStashGrid();
    return;
  }

  state.stashLoadingMarket = true;
  renderStashValueButtons();
  const totalToLoad = pendingMarketIds.length;
  let loadedCount = 0;
  setGlobalLoadingAction({
    tooltip: "Interromper Carregamento",
    onClick: () => {
      cancelStashMarketLoading();
    }
  });
  showGlobalLoading(forceFresh ? "Atualizando market do stash..." : "Carregando market do stash...");
  const updateLoadingProgress = () => {
    const actionLabel = forceFresh ? "Atualizando market" : "Carregando market";
    const overlayLabel = forceFresh ? "Atualizando market do stash" : "Carregando market do stash";
    setStashStatus(`${actionLabel}: ${formatCompactNumber(loadedCount)}/${formatCompactNumber(totalToLoad)} itens.`);
    setGlobalLoadingMessage(`${overlayLabel}: ${formatCompactNumber(loadedCount)}/${formatCompactNumber(totalToLoad)} itens...`);
  };
  updateLoadingProgress();

  try {
    for (let index = 0; index < pendingMarketIds.length; index += 120) {
      const chunk = pendingMarketIds.slice(index, index + 120);
      const values = await fetchStashMarketValues({
        worldSlug: state.currentWorldSlug,
        marketIds: chunk,
        forceFresh,
        mergeIntoWorldCache: true
      });

      if (requestId !== state.stashMarketRequestId) {
        return;
      }

      state.stashMarketById = {
        ...state.stashMarketById,
        ...Object.fromEntries(chunk.map((id) => [id, { current: null, hasActiveOffers: false }])),
        ...(values || {})
      };

      loadedCount += chunk.length;
      updateLoadingProgress();
      renderStashGrid();
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
      loadAllCached: true
    });

    if (requestId !== state.stashMarketRequestId) {
      return;
    }

    state.stashWorldMarketLoadedSlug = state.currentWorldSlug;

    if (values && typeof values === "object") {
      state.stashMarketById = {
        ...state.stashMarketById,
        ...values
      };
      renderStashGrid();
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

function isStashMarketRefreshCoolingDown() {
  return state.stashMarketRefreshCooldownUntil > Date.now();
}

function getStashMarketRefreshCooldownSeconds() {
  return Math.max(1, Math.ceil((state.stashMarketRefreshCooldownUntil - Date.now()) / 1000));
}

function setStashMarketRefreshCooldown(durationMs) {
  state.stashMarketRefreshCooldownUntil = Date.now() + Math.max(0, Number(durationMs) || 0);

  if (state.stashMarketRefreshCooldownTimer) {
    window.clearTimeout(state.stashMarketRefreshCooldownTimer);
  }

  state.stashMarketRefreshCooldownTimer = window.setTimeout(() => {
    state.stashMarketRefreshCooldownUntil = 0;
    state.stashMarketRefreshCooldownTimer = null;
    hideStashMarketRefreshWarning();
    renderStashValueButtons();
  }, Math.max(0, state.stashMarketRefreshCooldownUntil - Date.now()));

  renderStashValueButtons();
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

  setFeedback("Consultando item...");
  const searchRequestId = ++state.itemSearchRequestId;
  state.itemSearchLoadingRequestId = searchRequestId;
  setItemSearchDropdownLoading(true);

  try {
    const staticData = await fetchItemStatic({
      itemSlug,
      worldSlug: state.currentWorldSlug
    }).catch(() => null);

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
      setFeedback("Item carregado. Consultando market...");
    }

    const data = await fetchItem({
      itemSlug,
      worldSlug: state.currentWorldSlug
    });

    if (searchRequestId !== state.itemSearchRequestId) {
      return;
    }

    state.currentItem = data;
    await refreshCurrencyRates();
    await saveRecentItem(data.item);
    state.selectedItemSuggestion = {
      slug: data.item.slug,
      name: data.item.wiki_name || data.item.name,
      category: data.item.category || "Sem categoria",
      imageSrc: data.item.image_src || ""
    };
    els.itemInput.value = state.selectedItemSuggestion.name;
    closeItemSuggestions();
    renderRecentItems();
    renderItem();
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
    if (searchRequestId !== state.itemSearchRequestId) {
      return;
    }

    setFeedback(error instanceof Error ? error.message : "Falha ao consultar item.", true);
  } finally {
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
      limit: showAll ? 6000 : 8,
      showAll
    });

    if (requestId !== state.itemSuggestionRequestId) {
      return;
    }

    state.itemSuggestions = Array.isArray(suggestions) ? suggestions : [];
    state.activeItemSuggestionIndex = state.itemSuggestions.length > 0 ? 0 : -1;
    state.itemSuggestionsOpen = state.itemSuggestions.length > 0;
    renderItemSuggestions();
  } catch (_error) {
    if (requestId !== state.itemSuggestionRequestId) {
      return;
    }

    closeItemSuggestions();
  }
}

function renderItemSuggestions() {
  if (!state.itemSuggestionsOpen || state.itemSuggestions.length === 0) {
    els.itemSuggestions.innerHTML = "";
    els.itemSuggestions.classList.add("hidden");
    els.itemDropdownButton?.classList.remove("open");
    return;
  }

  els.itemSuggestions.innerHTML = state.itemSuggestions
    .map((suggestion, index) => {
      const activeClass = index === state.activeItemSuggestionIndex ? " active" : "";

      return `
        <button class="suggestion-button${activeClass}" type="button" data-suggestion-index="${index}">
          <img src="${suggestion.imageSrc}" alt="${suggestion.name}">
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
  els.itemDropdownButton?.classList.add("open");
  els.itemSuggestions.querySelectorAll("[data-suggestion-index]").forEach((button) => {
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
    els.skillPreviewIcon.src = skill.icon || SKILL_WEAPON_IMAGE_FALLBACKS[skill.weapon] || "assets/ui/tool-skill-calculator.webp";
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
          <img src="assets/ui/Crystal_Coin.gif" alt="">
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
          <img src="assets/ui/Crystal_Coin.gif" alt="">
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
              <img src="assets/ui/Crystal_Coin.gif" alt="">
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
              <img src="assets/ui/Crystal_Coin.gif" alt="">
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
  return SKILL_WEAPON_IMAGES[tierKey]?.[weaponKey] || SKILL_WEAPON_IMAGE_FALLBACKS[weaponKey] || "assets/ui/tool-skill-calculator.webp";
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

function getWheelOfDestinyLocale() {
  return state.localeController?.getLocale?.() || "pt-BR";
}

function ensureWheelOfDestinyFrameLoaded() {
  const frame = els.wheelOfDestinyFrame;
  if (!frame || frame.getAttribute("src")) return;
  const baseSource = frame.dataset.src || "assets/wheel-of-destiny/frame.html";
  const source = new URL(baseSource, window.location.href);
  source.searchParams.set("locale", getWheelOfDestinyLocale());
  frame.setAttribute("src", source.href);
}

function syncWheelOfDestinyLocale(locale = getWheelOfDestinyLocale()) {
  const frame = els.wheelOfDestinyFrame;
  if (!frame?.contentWindow || !frame.getAttribute("src")) return;
  frame.contentWindow.postMessage({ type: "tibia-toolkit-wheel-locale", locale }, "*");
}

function setToolTab(tab, options = {}) {
  const validTabs = new Set(["imbuement", "loot-splitter", "find-party", "skill-calculator", "wheel-of-destiny", "screen-vision"]);
  const nextTab = validTabs.has(tab) ? tab : "imbuement";

  if (nextTab !== state.selectedToolTab && !options.skipHistory && !state.navigationRestoring) {
    pushCurrentNavigationEntry();
  }

  state.selectedToolTab = nextTab;

  els.toolTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.toolTab === nextTab);
  });

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
    void ensureFindPartySnapshot();
    renderFindParty();
  }

  if (nextTab === "wheel-of-destiny") {
    ensureWheelOfDestinyFrameLoaded();
  }

  setCurrentNavigationEntry(getCurrentSectionNavigationEntry());
}

async function ensureFindPartySnapshot() {
  const selectedWorld = getSelectedWorld();

  if (!selectedWorld?.slug) {
    return;
  }

  if (
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
      worldSlug: selectedWorld.slug
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
  state.lootAnalyzerText = getActiveLootAnalyzerText();
  state.lootParsed = state.lootMode === "solo"
    ? parseSoloHuntAnalyzerText(getActiveLootAnalyzerText())
    : parseLootAnalyzerText(getActiveLootAnalyzerText());
  applySoloLootPricing(state.lootParsed);
  renderLootSplitter();

  const itemHydrationPromise = hydrateLootParsedItems(state.lootParsed);
  void itemHydrationPromise;
  void hydrateLootParsedMonsters(state.lootParsed);

  if (state.lootMode === "solo") {
    void enrichSoloLootProfile(state.lootParsed);
  } else {
    void enrichLootPlayerProfiles(state.lootParsed);
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
    return;
  }

  const requestId = ++state.lootItemHydrationRequestId;
  const worldSlug = state.currentWorldSlug || "antica";

  const staticItems = await Promise.all(parsed.items.map(async (item) => {
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
        valueSource: item.reportedValueSource || (fixedUnitValue ? "coin" : "")
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
        valueSource: item.reportedValueSource || (fixedUnitValue ? "coin" : "")
      };
    }
  }));

  if (requestId !== state.lootItemHydrationRequestId || state.lootParsed !== parsed) {
    return;
  }

  parsed.items = staticItems;
  parsed.pricingHydrated = true;
  applySoloLootPricing(parsed);
  renderLootSplitter();

  if (state.lootMode !== "solo") {
    return;
  }

  const itemsNeedingRefresh = staticItems.filter((item) => {
    const needsNpcRefresh = !item.npcUnitValue;
    const needsMarketRefresh = state.lootSoloUseMarket && !item.marketUnitValue;
    return needsNpcRefresh || needsMarketRefresh;
  });

  if (!itemsNeedingRefresh.length) {
    return;
  }

  const enrichedItems = await Promise.all(staticItems.map(async (item) => {
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
  }));

  if (requestId !== state.lootItemHydrationRequestId || state.lootParsed !== parsed) {
    return;
  }

  parsed.items = enrichedItems;
  parsed.pricingHydrated = true;
  applySoloLootPricing(parsed);
  renderLootSplitter();
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
    ? "assets/ui/hunt-analyzer-help.png"
    : "assets/ui/party-loot-help.jpg";
  const optimizationMarkup = state.lootMode === "solo"
    ? `
      <div class="loot-help-optimization">
        <p class="loot-help-warning">
          <img src="assets/ui/15px-Warning_Icon_Yellow.png" alt="">
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
        ${renderLootPlayerStatTile({ label: "Loot", value: player.loot, icon: "assets/ui/analyzer-loot.gif" })}
        ${renderLootPlayerStatTile({ label: "Supplies", value: player.supplies, icon: "assets/ui/analyzer-supplies.gif" })}
        ${renderLootPlayerStatTile({ label: "Balance", value: player.balance, icon: "assets/ui/analyzer-balance.gif", signed: true })}
        ${renderLootPlayerStatTile({ label: "Damage", value: player.damage, icon: "assets/ui/analyzer-damage.gif" })}
        ${renderLootPlayerStatTile({ label: "Healing", value: player.healing, icon: "assets/ui/analyzer-healing.gif" })}
        ${typeof player.xpGain === "number" ? renderLootPlayerStatTile({
          label: "XP",
          value: player.xpGain,
          icon: player.xpGain < 0 ? "assets/ui/analyzer-death.png" : "assets/ui/analyzer-xp.gif",
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
    return "assets/ui/analyzer-balance-negative.gif";
  }

  if (label !== "Loot") {
    return fallbackIcon;
  }

  if (numericValue > 1000000) {
    return "assets/ui/analyzer-loot-incomprehensible-riches.gif";
  }

  if (numericValue > 500000) {
    return "assets/ui/analyzer-loot-chest-of-abundance.gif";
  }

  if (numericValue > 100000) {
    return "assets/ui/analyzer-loot-treasure-chest.gif";
  }

  return fallbackIcon;
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
  els.lootItemsGrid.innerHTML = normalizeUiText(items.map((item) => {
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
      <button type="button" class="loot-item-tile ${getValueTierClass(totalValue)}" data-loot-item-name="${escapeHtml(item.name)}" data-tooltip="${escapeHtml(t("common.viewDetails"))}">
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
  const normalized = normalizeSearchText(name);
  return state.monsterIndex.find((creature) => normalizeSearchText(creature.name) === normalized) || null;
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
  pushCurrentNavigationEntry();
  switchSection("npcs", { skipHistory: true });
  await setEntityViewMode(local?.bossCategory ? "bosses" : "monsters", {
    skipHistory: true
  });
  await openMonsterDetail(local?.name || name, { skipHistory: true });
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
  state.imbuementRequestInFlightWorldSlug = selectedWorld.slug;

  const cachedEntry = await loadStoredImbuementMarket(selectedWorld.name);
  const cachedMarket = cachedEntry?.value || null;
  const hasCachedMarket = Boolean(cachedMarket);
  const shouldShowLoading = !hasCachedMarket;

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
    await ensureIngredientMetadata(getCurrentIngredients().map((ingredient) => ingredient.name));

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

async function ensureIngredientMetadata(names = getCurrentIngredients().map((ingredient) => ingredient.name)) {
  const missingNames = names
    .filter((name) => !state.ingredientMetaByName[name]);

  if (missingNames.length === 0) {
    return;
  }

  const metadata = await fetchIngredientMetadata({
    worldSlug: state.currentWorldSlug,
    names: missingNames
  });

  state.ingredientMetaByName = {
    ...state.ingredientMetaByName,
    ...metadata
  };
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

function syncGlobalWorldCompactState(open) {
  const shell = els.globalWorldDropdownButton?.closest(".global-world-shell");
  if (!shell) {
    return;
  }

  if (open) {
    shell.dataset.compactOpen = "true";
  } else {
    delete shell.dataset.compactOpen;
  }
}

function positionCompactGlobalWorldPicker() {
  if (!isCompactGlobalWorldPickerMode()) {
    return;
  }

  const shell = els.globalWorldDropdownButton?.closest(".global-world-shell");
  const content = shell?.querySelector(".global-world-dropdown-content");
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
  state.stashWorldMarketLoadedSlug = "";
  state.stashWorldMarketLoading = false;
  state.stashMarketRequestId += 1;
  state.stashMarketLoadedSignature = "";
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
  renderSkillCalculator();

  void refreshCurrencyRates({ worldSlug: world.slug }).catch(() => {});

  if (field !== "loot") {
    void refreshImbuementWorldData().catch(() => {});
  }

  if (field !== "loot" && state.currentItem) {
    void handleItemSearch(true);
  }

  if (field !== "loot" && state.itemViewMode === "stash") {
    renderStashGrid();
    scheduleStashMarketLoad();
  }

  if (field === "loot" && getActiveLootAnalyzerText().trim()) {
    parseAndRenderLootSplitter();
  }

  if (field !== "loot" && (state.selectedToolTab === "find-party" || state.findPartyRequestId > 0)) {
    void ensureFindPartySnapshot();
  }

  refreshOpenBossTrackerForCurrentWorld();
  scheduleWarmItemCache();
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

  els.itemSummaryEmpty.classList.add("hidden");
  els.itemSummaryContent.classList.remove("hidden");

  els.itemImage.src = item.image_src;
  els.itemImage.alt = item.name;
  els.itemCategory.textContent = item.category || "Sem categoria";
  els.itemName.textContent = item.wiki_name || item.name;
  renderItemDescription(item);
  renderItemWikiButton(item);
  renderItemStoreNote(item);
  setItemMarketVisibility(marketExplicitlyDisabled);
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
}

function isItemMarketExplicitlyDisabled(item) {
  const value = String(item?.marketableExplicit || item?.marketable || "").trim().toLowerCase();
  return value === "no";
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
      <img src="assets/ui/Tibia_Coin_Icon.gif" alt="Tibia Coin">
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
  els.itemOpenWiki.onclick = () => {
    void openDesktopExternalLink(wikiUrl);
  };
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
  const droppedBy = Array.isArray(item?.droppedBy) ? item.droppedBy.filter(Boolean) : [];
  const extraMarkup = renderItemExtraDetails(item);

  if (lines.length === 0 && droppedBy.length === 0 && !extraMarkup) {
    els.itemDescription.innerHTML = "";
    els.itemDescription.classList.add("hidden");
    if (els.itemDroppedBy) {
      els.itemDroppedBy.innerHTML = "";
      els.itemDroppedBy.classList.add("hidden");
    }
    if (els.itemExtraDetails) {
      els.itemExtraDetails.innerHTML = "";
      els.itemExtraDetails.classList.add("hidden");
    }
    return;
  }

  const descriptionMarkup = lines
    .map((line) => `<p>${escapeHtml(normalizeUiText(line))}</p>`)
    .join("");
  els.itemDescription.innerHTML = descriptionMarkup;
  els.itemDescription.classList.toggle("hidden", descriptionMarkup.length === 0);

  if (els.itemDroppedBy) {
    const droppedByMarkup = renderItemDroppedBy(droppedBy);
    els.itemDroppedBy.innerHTML = droppedByMarkup;
    els.itemDroppedBy.classList.toggle("hidden", droppedByMarkup.length === 0);
    bindSkillDynamicTooltips(els.itemDroppedBy);
  }

  if (els.itemExtraDetails) {
    els.itemExtraDetails.innerHTML = extraMarkup;
    els.itemExtraDetails.classList.toggle("hidden", !extraMarkup);
  }

  els.itemExtraDetails?.querySelectorAll("[data-item-spoiler-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.itemSpoilerToggle;
      const body = els.itemExtraDetails.querySelector(`[data-item-spoiler-body="${CSS.escape(key)}"]`);
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

  els.itemExtraDetails?.querySelectorAll("[data-map-url]").forEach((button) => {
    button.addEventListener("click", () => {
      void openMapModal(button.dataset.mapUrl, button.dataset.mapTitle || "Mapa");
    });
  });

  els.itemExtraDetails?.querySelectorAll("[data-proficiency-option]").forEach((button) => {
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
}

function renderItemExtraDetails(item = {}) {
  const sections = [
    renderItemAttributesSection(item),
    renderItemProficiencySection(item),
    renderItemDamageTableSection(item),
    renderItemLocationSection(item),
    renderItemNotesSection(item)
  ].filter(Boolean);

  return sections.join("");
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

function renderItemLocationSection(item = {}) {
  const location = String(item?.location || "").trim();

  if (!location) {
    return "";
  }

  const mapLink = item.map?.url
    ? ` <span class="inline-map-wrap">(<button type="button" class="inline-map-link" data-map-url="${escapeHtml(item.map.url)}" data-map-title="${escapeHtml(`${item.wiki_name || item.name || "Item"} - ${location}`)}">${escapeHtml(t("common.here"))}<img src="assets/ui/18px-Map_(Colour).gif" alt="Mapa"></button>)</span>`
    : "";

  return `
    <section class="item-extra-section">
      <h4>${escapeHtml(t("common.locations"))}</h4>
      <p>${escapeHtml(location)}${mapLink}</p>
    </section>
  `;
}

function renderItemNotesSection(item = {}) {
  const spoilers = normalizeItemSpoilersForUi(item);
  const regularNote = normalizeUiText(stripSpoilerPrefixFromNotes(sanitizeItemNoteForUi(item.notes || "")));

  if (!regularNote && spoilers.length === 0) {
    return "";
  }

  return `
    <section class="item-extra-section">
      <h4>${escapeHtml(t("common.notes"))}</h4>
      ${regularNote ? `<div class="npc-spoiler-body item-note-panel">${escapeHtml(regularNote)}</div>` : ""}
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

function renderItemDroppedBy(droppedBy) {
  if (!Array.isArray(droppedBy) || droppedBy.length === 0) {
    return "";
  }

  const uniqueDrops = [...new Set(droppedBy.map((name) => String(name || "").trim()).filter(Boolean))];
  const tiles = uniqueDrops.map((name) => {
    const creature = findLocalCreature(name);
    const displayName = creature?.name || name;
    const imageSrc = creature?.imageSrc || getCreatureFallbackImageSrc(displayName);

    return `
      <button type="button" class="item-drop-tile" data-item-drop-monster="${escapeHtml(displayName)}" data-tooltip="${escapeHtml(displayName)}">
        ${imageSrc ? `<img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(displayName)}" onerror="this.style.visibility='hidden'">` : ""}
      </button>
    `;
  }).join("");

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

async function renderCurrencyIcons() {
  const metadata = await fetchIngredientMetadata({
    worldSlug: state.currentWorldSlug,
    names: ["Tibia Coins", "Gold Token"]
  }).catch(() => ({}));
  const iconMap = {
    gold: GOLD_ICON_PATH,
    tc: metadata["Tibia Coins"]?.imageSrc || "",
    gt: metadata["Gold Token"]?.imageSrc || ""
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
    els.imbuementTokenCardIcon.src = metadata["Gold Token"]?.imageSrc || GOLD_ICON_PATH;
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
      const imageSrc = npc?.image_src || fallbackImageSrc || "";
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
            <strong>${escapeHtml(formatCurrencyText(npc.price, "gold"))}</strong>
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
      await fetchItem({
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
