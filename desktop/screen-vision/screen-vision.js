import {
  cloneOverlayToolsStateForSave,
  createDefaultOverlayToolsState,
  normalizeOverlayToolsState,
  OVERLAY_TOOLS_STORAGE_KEY
} from "../../lib/overlay-tools-state.js";
import {
  AUTHENTICATOR_LABEL_MAX_LENGTH,
  AUTHENTICATOR_SECRET_MAX_LENGTH,
  createDefaultOverlayAuthenticatorDraft,
  normalizeOverlayAuthenticatorEntry
} from "../../lib/overlay-authenticator.js";
import {
  createDefaultOverlayTimerDraft,
  createOverlayTimerEntryFromDraft,
  formatOverlayTimerDuration,
  normalizeOverlayTimerEntry,
  ALERT_DISPLAY_DURATION_MIN_SECONDS,
  ALERT_DISPLAY_DURATION_MAX_SECONDS,
  ALERT_DISPLAY_DURATION_DEFAULT_SECONDS
} from "../../lib/overlay-timers.js";
import { generateOtp, normalizeTokenDraft } from "../../lib/totp-core.js";
import { bootstrapRendererLocale } from "../../lib/renderer-locale.js";
import { getAppLocale, t } from "../../lib/app-i18n.js";
import { translateObjectTextFields } from "../../lib/phrase-translations.js";
import { SCREEN_VISION_SPELL_PRESETS } from "./spell-presets.js";

const PERFORMANCE_NOTICE_THRESHOLD = 20;
const ALERT_PANEL_MAX_TIMERS = 10;
const COUNTDOWN_COLOR_OPTIONS = [
  { value: "gradient", label: "Gradiente", swatch: "linear-gradient(90deg, #4ade80 0%, #ffd84d 48%, #ff5353 100%)" },
  { value: "#58c470", label: "Verde padrao", swatch: "#58c470" },
  { value: "#ff4444", label: "Vermelho", swatch: "#ff4444" },
  { value: "#ffd700", label: "Amarelo", swatch: "#ffd700" },
  { value: "#4ade80", label: "Verde", swatch: "#4ade80" },
  { value: "#0088ff", label: "Azul", swatch: "#0088ff" },
  { value: "#8800ff", label: "Roxo", swatch: "#8800ff" },
  { value: "#ffffff", label: "Branco", swatch: "#ffffff" }
];

const COUNTDOWN_BORDER_COLOR_OPTIONS = [
  { value: "#ffffff", label: "Branco", swatch: "#ffffff" },
  { value: "#58c470", label: "Verde padrao", swatch: "#58c470" },
  { value: "#ff4444", label: "Vermelho", swatch: "#ff4444" },
  { value: "#ffd700", label: "Amarelo", swatch: "#ffd700" },
  { value: "#4ade80", label: "Verde", swatch: "#4ade80" },
  { value: "#0088ff", label: "Azul", swatch: "#0088ff" },
  { value: "#8800ff", label: "Roxo", swatch: "#8800ff" }
];

const TOOLBAR_STATE_ASSETS = {
  visible: "assets/ui/tools/tibia-eye/toolbar/visivel.png",
  hidden: "assets/ui/tools/tibia-eye/toolbar/oculto.png",
  locked: "assets/ui/tools/tibia-eye/toolbar/trancado.png",
  unlocked: "assets/ui/tools/tibia-eye/toolbar/destrancado.png"
};

const PROFILE_PANEL_ASSETS = {
  create: "assets/ui/tools/tibia-eye/profiles/novo-perfil.png",
  import: "assets/ui/tools/tibia-eye/profiles/importar-perfil.png",
  export: "assets/ui/tools/tibia-eye/profiles/exportar-perfil.png",
  noVocation: "assets/ui/tools/tibia-eye/profiles/no-vocation.png",
  firstProfileState: "assets/ui/tools/tibia-eye/states/crie-um-perfil.gif"
};
const PROFILE_CREATE_SENTINEL = "__create__";
const TUTORIAL_PROFILE_DEMO_PATH = "__tibia_mirror_tutorial_profile__";
const AUTHENTICATOR_CREATE_SENTINEL = "__authenticator_create__";
const AUTHENTICATOR_PANEL_ASSETS = {
  toolbar: "assets/ui/tools/tibia-eye/authenticator/qr-code-white-icon.webp",
  create: "assets/ui/tools/tibia-eye/authenticator/addqrcode.png",
  hotp: "assets/ui/tools/tibia-eye/authenticator/contagem.png",
  totp: "assets/ui/tools/tibia-eye/authenticator/horario.png"
};

const COUNTDOWN_ASSETS = {
  bar: "assets/ui/tools/tibia-eye/cooldown/barra.gif",
  barStill: "assets/ui/tools/tibia-eye/cooldown/barra-still.png",
  flash: "assets/ui/tools/tibia-eye/cooldown/flash.gif",
  flashStill: "assets/ui/tools/tibia-eye/cooldown/flash-still.png",
  playtest: "assets/ui/tools/tibia-eye/cooldown/playtest.gif",
  playtestStill: "assets/ui/tools/tibia-eye/cooldown/playtest-still.png"
};

const SQM_FINDER_ASSETS = {
  sqm: "assets/ui/tools/tibia-eye/sqm/sqmfinder.gif",
  cursorGlow: "assets/ui/tools/tibia-eye/sqm/cursorglow.gif"
};

const TIBIA_COINS_PANEL_ASSETS = {
  coin: "assets/ui/Tibia_Coin_Icon.gif",
  loading: "assets/ui/tools/tibia-eye/tibia-coins/loading.gif",
  brandLogo: "assets/ui/tools/tibia-eye/tibia-coins/daniel-hatano-logo.webp",
  resellerLogo: "assets/ui/tools/tibia-eye/tibia-coins/cipsoft-authorized-reseller.png",
  tiers: [
    { max: 250, icon: "assets/ui/tools/tibia-eye/tibia-coins/Tibia_Coins250.png" },
    { max: 750, icon: "assets/ui/tools/tibia-eye/tibia-coins/Tibia_Coins750.png" },
    { max: 1500, icon: "assets/ui/tools/tibia-eye/tibia-coins/Tibia_Coins1500.png" },
    { max: 3000, icon: "assets/ui/tools/tibia-eye/tibia-coins/Tibia_Coins3000.png" },
    { max: 4500, icon: "assets/ui/tools/tibia-eye/tibia-coins/Tibia_Coins4500.png" },
    { max: Infinity, icon: "assets/ui/tools/tibia-eye/tibia-coins/Tibia_Coins15000.png" }
  ]
};
const TIBIA_COINS_QUANTITY_MIN = 25;
const TIBIA_COINS_QUANTITY_MAX = 15000;
const TIBIA_COINS_QUANTITY_STEP = 25;
const TIBIA_COINS_PRODUCT_ID = 717;
const TIBIA_COINS_CHARACTER_OPTION_ID = 1071;
const TIBIA_COINS_TRACKING = "TibiaTools";
const TIBIA_COINS_QUICKBUY_URL = "https://www.danielhatano.com.br/index.php";
const TIBIA_COINS_BRAND_URL = "https://www.danielhatano.com.br/tibia/?tracking=TibiaTools";
const TIBIA_COINS_PRICE_TIERS = [
  { min: 750, unitPrice: 0.2293 },
  { min: 250, unitPrice: 0.2472 },
  { min: 125, unitPrice: 0.2522 },
  { min: 25, unitPrice: 0.2547 }
];
const TIBIA_COINS_PACKAGES = [250, 750, 1500, 3000, 4500, 15000];
const TIBIA_COINS_PACKAGE_BASE_PER_250 = new Map([
  [250, 61.81],
  [750, 57.30],
  [1500, 57.31],
  [3000, 57.31],
  [4500, 57.31],
  [15000, 57.31]
]);
const TIBIA_COINS_BASE_UNIT_PRICE = 0.2547;
const TIBIA_COINS_APP_DISCOUNT_RATE = 0.01;
const COFFEE_PANEL_ASSETS = {
  toolbar: "assets/ui/tools/tibia-eye/buy-me-a-coffee/coffee-toolbar.gif",
  hero: "assets/ui/tools/tibia-eye/buy-me-a-coffee/coffee-hero.gif",
  thankYou: "assets/ui/tools/tibia-eye/buy-me-a-coffee/thank-you.gif",
  pix: "assets/ui/tools/tibia-eye/buy-me-a-coffee/pix.png",
  mercadoPago: "assets/ui/tools/tibia-eye/buy-me-a-coffee/mercado-pago.png",
  pixQr: "assets/ui/tools/tibia-eye/buy-me-a-coffee/pix-qr.png",
  qr: "assets/ui/tools/tibia-eye/authenticator/qr-code-white-icon.webp",
  discord: "assets/ui/tools/tibia-eye/buy-me-a-coffee/discord.svg",
  tick: "assets/ui/Tick.png",
  coin: "assets/ui/Tibia_Coin_Icon.gif"
};
const COFFEE_PIX_CODE = "00020101021126810014BR.GOV.BCB.PIX2559pix-qr.mercadopago.com/instore/ol/v2/3Z932g6kQLGlQwJjHaWjOF5204000053039865802BR5925LUAN MONTENEGRO WEBDESIGN6009SAO PAULO62080504mpis630482FE";
const COFFEE_DISCORD_URL = "https://discord.gg/geKX9ewCy";
const SETTINGS_PANEL_DISCORD_URL = "https://discord.gg/geKX9ewCy";
const SETTINGS_PANEL_YOUTUBE_URL = "https://www.youtube.com/@poioso?sub_confirmation=1";
const SETTINGS_PANEL_ASSETS = {
  discord: "assets/ui/tools/tibia-eye/settings/discord-button.png",
  youtube: "assets/ui/tools/tibia-eye/settings/youtube-button.png",
  authenticator: "assets/ui/tools/tibia-eye/settings/authenticator-button.png",
  tutorial: "assets/ui/tools/tibia-eye/settings/tutorial-button.png",
  website: "assets/ui/tools/tibia-eye/settings/website-button.png"
};
const COFFEE_DONATION_OPTIONS = [
  { value: "9,90", image: "9-90.png", url: "https://mpago.li/1yc9P3b" },
  { value: "19,90", image: "19-90.png", url: "https://mpago.li/2zEJCSs" },
  { value: "49,90", image: "49-90.png", url: "https://mpago.li/2Uxh2b2" },
  { value: "99,90", image: "99-90.png", url: "https://mpago.li/2KcXo5a" },
  { value: "199,90", image: "199-90.png", url: "https://mpago.li/33zR9Ap" },
  { value: "499,90", image: "499-90.png", url: "https://mpago.li/1hiBYf4" },
  { value: "999,90", image: "999-90.png", url: "https://mpago.li/13pvU3N" }
];
const DEFAULT_COFFEE_WORLD = "Honbra";
const SUPPORTER_PANEL_TIER_ORDER = ["diamond", "gold", "silver", "bronze", "iron"];
const SUPPORTER_PANEL_TIER_META = {
  diamond: { labelKey: "screenVision.supporters.tier.diamond", medalPath: "assets/ui/supporters/medalha-diamante.png" },
  gold: { labelKey: "screenVision.supporters.tier.gold", medalPath: "assets/ui/supporters/medalha-ouro.png" },
  silver: { labelKey: "screenVision.supporters.tier.silver", medalPath: "assets/ui/supporters/medalha-prata.png" },
  bronze: { labelKey: "screenVision.supporters.tier.bronze", medalPath: "assets/ui/supporters/medalha-bronze.png" },
  iron: { labelKey: "screenVision.supporters.tier.iron", medalPath: "assets/ui/supporters/medalha-ferro.png" },
  default: { labelKey: "screenVision.supporters.tier.default", medalPath: "assets/ui/supporters/medalha-ferro.png" }
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
const SUPPORTER_PANEL_MOCK_SEEDS = [
  {
    name: "Poioso",
    totalAmountCents: 25000
  },
  {
    name: "Poioso Curandeiro",
    totalAmountCents: 20000
  },
  {
    name: "Poioso Arqueiro",
    totalAmountCents: 16000
  },
  {
    name: "Poioso Atirador",
    totalAmountCents: 12000
  },
  {
    name: "Pato Donald Ninja",
    totalAmountCents: 9000
  },
  {
    name: "Aacen",
    totalAmountCents: 4500
  },
  {
    name: "Abdala Ragab",
    totalAmountCents: 3500
  },
  {
    name: "Abi Alowarrior",
    totalAmountCents: 2500
  },
  {
    name: "Adam",
    totalAmountCents: 2000
  }
];

const SQM_INTENSITY_OPTIONS = [
  { value: 5, label: "Baixa" },
  { value: 10, label: "Media" },
  { value: 20, label: "Alta" },
  { value: 30, label: "Maxima" }
];

const SQM_DEFAULT_SAVED_COLORS = ["#58c470", "#ffffff", "#ff4444", "#0088ff"];
const SQM_SHAPE_SEQUENCE = ["Circle", "Arrow", "Square"];

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

const ALERT_DOCKED_SOUND_OPTIONS = [
  {
    value: "utura-gran",
    label: "utura gran",
    file: new URL("../../assets/screen-vision/reference/sounds/utura gran.ogg", import.meta.url).href
  },
  {
    value: "exura-gran-ico",
    label: "exura gran ico",
    file: new URL("../../assets/screen-vision/reference/sounds/exura gran ico.ogg", import.meta.url).href
  },
  {
    value: "utito-tempo",
    label: "utito tempo",
    file: new URL("../../assets/screen-vision/reference/sounds/utito tempo.ogg", import.meta.url).href
  }
];

const DOCKED_ALERT_MAGIC_CREATE_ASSET = "assets/ui/tools/tibia-eye/tibia-coins/loading.gif";
const DOCKED_ALERT_MAGIC_VOCATION_OPTIONS = [
  { key: "knight", label: "Knight", asset: "assets/ui/vocations/knight-male.png" },
  { key: "paladin", label: "Paladin", asset: "assets/ui/vocations/paladin-male.png" },
  { key: "druid", label: "Druid", asset: "assets/ui/vocations/druid-male.png" },
  { key: "sorcerer", label: "Sorcerer", asset: "assets/ui/vocations/sorcerer-male.png" },
  { key: "monk", label: "Monk", asset: "assets/ui/vocations/monk-male.png" }
];
const DOCKED_ALERT_MAGIC_CATEGORY_ORDER = ["cura", "suporte", "ataque", "stance"];
const DOCKED_ALERT_MAGIC_CATEGORY_LABELS = {
  cura: "Magias de cura",
  suporte: "Magias de Suporte",
  ataque: "Magias de Ataque",
  stance: "Magias de Stance"
};
const DOCKED_ALERT_SOUND_CUSTOM_VALUE = "__custom__";
const DOCKED_ALERT_SOUND_LIBRARY = buildDockedAlertSoundLibrary();
const DOCKED_ALERT_SOUND_OPTIONS_BY_KEY = new Map(DOCKED_ALERT_SOUND_LIBRARY.map((entry) => [entry.value, entry]));

const ALERT_DOCKED_FONT_FAMILY_OPTIONS = [
  { value: "nunito", label: "Nunito" },
  { value: "toolkit", label: "Toolkit UI" },
  { value: "montserrat", label: "Montserrat" },
  { value: "poppins", label: "Poppins" },
  { value: "sora", label: "Sora" },
  { value: "merriweather", label: "Merriweather" },
  { value: "playfair", label: "Playfair" },
  { value: "rajdhani", label: "Rajdhani" },
  { value: "orbitron", label: "Orbitron" }
];

const ALERT_DOCKED_FONT_WEIGHT_OPTIONS = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Media" },
  { value: 600, label: "Semi negrito" },
  { value: 700, label: "Negrito" },
  { value: 800, label: "Extra negrito" },
  { value: 900, label: "Preta" }
];

const ICONS = {
  eye: "M2,12 C2,12 6,5 12,5 C18,5 22,12 22,12 C22,12 18,19 12,19 C6,19 2,12 2,12 Z M12,9 C10.34,9 9,10.34 9,12 C9,13.66 10.34,15 12,15 C13.66,15 15,13.66 15,12 C15,10.34 13.66,9 12,9 Z",
  "eye-off": "M2,12 C2,12 6,5 12,5 C18,5 22,12 22,12 M1,1 L23,23 M9.9,4.24 C10.57,4.08 11.27,4 12,4 C18,4 22,12 22,12 C22,12 21.18,13.53 19.69,15.15 M17.07,17.07 C15.68,18.04 13.97,19 12,19 C6,19 2,12 2,12 C2,12 4.32,8.04 6.93,6.93",
  "lock-closed": "M7,11 L7,7 C7,4.24 9.24,2 12,2 C14.76,2 17,4.24 17,7 L17,11 M5,11 L19,11 C20.1,11 21,11.9 21,13 L21,20 C21,21.1 20.1,22 19,22 L5,22 C3.9,22 3,21.1 3,20 L3,13 C3,11.9 3.9,11 5,11 Z",
  "lock-open": "M7,11 L7,7 C7,4.24 9.24,2 12,2 C14.76,2 17,4.24 17,7 M5,11 L19,11 C20.1,11 21,11.9 21,13 L21,20 C21,21.1 20.1,22 19,22 L5,22 C3.9,22 3,21.1 3,20 L3,13 C3,11.9 3.9,11 5,11 Z",
  edit: "M17,3 C17.55,2.45 18.45,2.45 19,3 L21,5 C21.55,5.55 21.55,6.45 21,7 L7,21 L3,21 L3,17 Z M15,5 L19,9",
  trash: "M3,6 L5,6 L21,6 M19,6 L19,20 C19,21.1 18.1,22 17,22 L7,22 C5.9,22 5,21.1 5,20 L5,6 M8,6 L8,4 C8,2.9 8.9,2 10,2 L14,2 C15.1,2 16,2.9 16,4 L16,6",
  gear: "M12,15 C13.66,15 15,13.66 15,12 C15,10.34 13.66,9 12,9 C10.34,9 9,10.34 9,12 C9,13.66 10.34,15 12,15 Z M19.4,15 C19.13,15.66 19.25,16.42 19.72,16.96 L19.82,17.06 C20.21,17.45 20.21,18.08 19.82,18.47 L18.47,19.82 C18.08,20.21 17.45,20.21 17.06,19.82 L16.96,19.72 C16.42,19.25 15.66,19.13 15,19.4 C14.36,19.65 13.93,20.26 13.93,20.94 L13.93,21.11 C13.93,21.6 13.53,22 13.04,22 L10.96,22 C10.47,22 10.07,21.6 10.07,21.11 L10.07,20.94 C10.07,20.26 9.64,19.65 9,19.4 C8.34,19.13 7.58,19.25 7.04,19.72 L6.94,19.82 C6.55,20.21 5.92,20.21 5.53,19.82 L4.18,18.47 C3.79,18.08 3.79,17.45 4.18,17.06 L4.28,16.96 C4.75,16.42 4.87,15.66 4.6,15 C4.35,14.36 3.74,13.93 3.06,13.93 L2.89,13.93 C2.4,13.93 2,13.53 2,13.04 L2,10.96 C2,10.47 2.4,10.07 2.89,10.07 L3.06,10.07 C3.74,10.07 4.35,9.64 4.6,9 C4.87,8.34 4.75,7.58 4.28,7.04 L4.18,6.94 C3.79,6.55 3.79,5.92 4.18,5.53 L5.53,4.18 C5.92,3.79 6.55,3.79 6.94,4.18 L7.04,4.28 C7.58,4.75 8.34,4.87 9,4.6 C9.64,4.35 10.07,3.74 10.07,3.06 L10.07,2.89 C10.07,2.4 10.47,2 10.96,2 L13.04,2 C13.53,2 13.93,2.4 13.93,2.89 L13.93,3.06 C13.93,3.74 14.36,4.35 15,4.6 C15.66,4.87 16.42,4.75 16.96,4.28 L17.06,4.18 C17.45,3.79 18.08,3.79 18.47,4.18 L19.82,5.53 C20.21,5.92 20.21,6.55 19.82,6.94 L19.72,7.04 C19.25,7.58 19.13,8.34 19.4,9 C19.65,9.64 20.26,10.07 20.94,10.07 L21.11,10.07 C21.6,10.07 22,10.47 22,10.96 L22,13.04 C22,13.53 21.6,13.93 21.11,13.93 L20.94,13.93 C20.26,13.93 19.65,14.36 19.4,15 Z",
  music: "M9,18 C9,19.66 7.66,21 6,21 C4.34,21 3,19.66 3,18 C3,16.34 4.34,15 6,15 C6.35,15 6.69,15.06 7,15.17 L7,3 L21,3 L21,6 L9,6 Z M21,15 C21,16.66 19.66,18 18,18 C16.34,18 15,16.66 15,15 C15,13.34 16.34,12 18,12 C18.35,12 18.69,12.06 19,12.17 L19,8",
  notes: "M6,2 C5.45,2 5,2.45 5,3 L5,21 C5,21.55 5.45,22 6,22 L18,22 C18.55,22 19,21.55 19,21 L19,8 L13,2 Z M13,2 L13,8 L19,8 M8,13 L16,13 M8,17 L13,17",
  countdown: "M12,5 L12,12 L16,14 M9,2 L15,2 M5,4 L3,2 M19,4 L21,2 M12,22 C6.48,22 2,17.52 2,12 C2,6.48 6.48,2 12,2 C17.52,2 22,6.48 22,12 C22,17.52 17.52,22 12,22 Z",
  unsnap: "M6,6 L10,10 M10,6 L6,10 M14,10 L18,14 M18,10 L14,14",
  volume: "M5,9 L9,9 L14,4 L14,20 L9,15 L5,15 Z M18,9 C19.66,10.12 20.75,11.97 20.75,14 C20.75,16.03 19.66,17.88 18,19",
  "volume-off": "M5,9 L9,9 L14,4 L14,20 L9,15 L5,15 Z M18,10 L22,14 M22,10 L18,14",
  refresh: "M20,11 A8,8 0 0 0 6.6,6.2 M4,4 L7.2,4 L7.2,7.2 M4,13 A8,8 0 0 0 17.4,17.8 M20,20 L16.8,20 L16.8,16.8",
  duplicate: "M9,9 L9,5 C9,3.9 9.9,3 11,3 L19,3 C20.1,3 21,3.9 21,5 L21,13 C21,14.1 20.1,15 19,15 L15,15 M5,9 L13,9 C14.1,9 15,9.9 15,11 L15,19 C15,20.1 14.1,21 13,21 L5,21 C3.9,21 3,20.1 3,19 L3,11 C3,9.9 3.9,9 5,9",
  message: "M4,5 L20,5 C21.1,5 22,5.9 22,7 L22,15 C22,16.1 21.1,17 20,17 L10,17 L5,21 L5,17 L4,17 C2.9,17 2,16.1 2,15 L2,7 C2,5.9 2.9,5 4,5 Z",
  thought: "M9.5,18.5 L6.5,21 L6.8,17.4 C4.07,17.18 2,14.89 2,12.1 C2,9.15 4.34,6.76 7.24,6.68 C8.1,4.06 10.57,2.19 13.45,2.19 C17.03,2.19 19.97,5.05 20.13,8.62 C22.42,9.1 24,11.1 24,13.38 C24,16.04 21.84,18.19 19.18,18.19 Z M5.15,22.25 A1.1,1.1 0 1 1 5.15,20.05 A1.1,1.1 0 1 1 5.15,22.25 Z M2.8,24 A0.8,0.8 0 1 1 2.8,22.4 A0.8,0.8 0 1 1 2.8,24 Z",
  sparkle: "M12,3 L13.7,8.3 L19,10 L13.7,11.7 L12,17 L10.3,11.7 L5,10 L10.3,8.3 Z",
  shadow: "M24,2.5 A21.4773,21.4773 0 0 0 3.5833,30.7122 A10.2206,10.2206 0 1 1 17.2878,44.4167 A21.4964,21.4964 0 1 0 24,2.5 Z",
  palette: "M12,3 C7.03,3 3,6.58 3,11 C3,14.87 6.13,18 10,18 L11.4,18 C12.28,18 13,18.72 13,19.6 C13,20.92 14.08,22 15.4,22 C19.6,22 23,18.6 23,14.4 C23,8.66 18.08,3 12,3 Z M7.5,12.5 A1.5,1.5 0 1 1 7.5,9.5 A1.5,1.5 0 1 1 7.5,12.5 Z M11,8 A1.5,1.5 0 1 1 11,5 A1.5,1.5 0 1 1 11,8 Z M16,8 A1.5,1.5 0 1 1 16,5 A1.5,1.5 0 1 1 16,8 Z M18.5,13 A1.5,1.5 0 1 1 18.5,10 A1.5,1.5 0 1 1 18.5,13 Z",
  save: "M5,3 L17,3 L21,7 L21,21 L3,21 L3,5 C3,3.9 3.9,3 5,3 Z M7,5 L7,10 L15,10 L15,5 Z M7,17 L17,17 L17,13 L7,13 Z",
  close: "M18,6 L6,18 M6,6 L18,18",
  minimize: "M5,12 L19,12"
};

const els = {
  shell: document.querySelector("#vision-shell"),
  windowMinimizeButton: document.querySelector("#window-minimize-button"),
  windowCloseButton: document.querySelector("#window-close-button"),
  toggleAllVisibilityButton: document.querySelector("#toggle-all-visibility-button"),
  toggleAllLockButton: document.querySelector("#toggle-all-lock-button"),
  obsMirrorButton: document.querySelector("#obs-mirror-button"),
  desktopVisibilityButton: document.querySelector("#desktop-screen-vision-visibility-button"),
  desktopAuthenticatorButton: document.querySelector("#desktop-authenticator-button"),
  desktopCoffeeButton: document.querySelector("#desktop-coffee-button"),
  desktopTibiaCoinsButton: document.querySelector("#desktop-tibia-coins-button"),
  settingsButton: document.querySelector("#settings-button"),
  openAlertasButton: document.querySelector("#open-alertas-button"),
  openVisualCustomizationButton: document.querySelector("#open-visual-customization-button"),
  gridOverlayButton: document.querySelector("#grid-overlay-button"),
  addRegionButton: document.querySelector("#add-region-button"),
  cropToolButton: document.querySelector("#crop-tool-button"),
  regionCount: document.querySelector("#region-count"),
  regionGrid: document.querySelector("#region-grid"),
  emptyState: document.querySelector("#empty-state"),
  emptyStateWaiting: document.querySelector("#empty-state-waiting"),
  emptyStateDot: document.querySelector("#empty-state-dot"),
  emptyStateTitle: document.querySelector("#empty-state-title"),
  emptyStateCopy: document.querySelector("#empty-state-copy"),
  emptyStateExtra: document.querySelector("#empty-state-extra"),
  performanceNotice: document.querySelector("#performance-notice"),
  modalRoot: document.querySelector("#modal-root"),
  floatingTooltip: document.querySelector("#floating-tooltip"),
  dockedPanelHost: document.querySelector("#desktop-docked-panel"),
  dockedPanelTitle: document.querySelector("#desktop-docked-panel-title"),
  dockedPanelDescription: document.querySelector("#desktop-docked-panel-description"),
  dockedPanelEmptyTitle: document.querySelector("#desktop-docked-panel-empty-title"),
  dockedPanelEmptyCopy: document.querySelector("#desktop-docked-panel-empty-copy"),
  dockedPanelCloseButton: document.querySelector("#desktop-docked-panel-close")
};

const state = {
  regions: [],
  loading: false,
  creatingRegion: false,
  tibiaState: null,
  tibiaReadyLastPoll: false,
  obsMirrorStatus: {
    enabled: false,
    connected: false,
    error: ""
  },
  overlayTools: createDefaultOverlayToolsState(),
  authenticatorRuntimeById: {},
  alertRuntimeById: {},
  alertProfileLabel: "tibia mirror",
  alertDefaultsApplied: false,
  visualCustomization: null,
  visualCustomizationFieldTimers: new Map(),
  sqmTutorialDemo: null,
  alertTutorialDemo: null,
  sqmExpandedEditor: "",
  openAlertEditorIds: new Set(),
  dockedAlertsView: "cards",
  dockedAlertExpandedConfigId: "",
  dockedAlertExpandedVisualId: "",
  dockedAlertExpandedReminderId: "",
  dockedAlertExpandedSoundId: "",
  dockedAlertSoundMenuTimerId: "",
  dockedAlertColorPickerTimerId: "",
  dockedAlertCapturingHotkeyId: "",
  dockedPanelPendingScrollTargetId: "",
  dockedAlertVolumeMemory: new Map(),
  dockedAlertsMagicVocation: "knight",
  profilesIndex: [],
  profilesPanelLoading: false,
  profileCreateSubmitting: false,
  profilesPanelExpandedEditPath: "",
  profileDraft: {
    profileName: "",
    characterName: ""
  },
  tutorialProfileDemo: null,
  authenticatorExpandedId: "",
  authenticatorDraft: createDefaultOverlayAuthenticatorDraft(),
  authenticatorCopyDoneId: "",
  authenticatorCopyResetTimer: 0,
  profileCharacterSummaries: {},
  profileSummaryRequestId: 0,
  supportersIndex: [],
  supporterProfilesRequestId: 0,
  supporterShowcaseTimerIds: [],
  supportersDataUrl: "",
  coffeeConfig: createDefaultCoffeeConfig(),
  tibiaCoinsCharacterName: "",
  tibiaCoinsCharacterSummary: null,
  tibiaCoinsCharacterLookupState: "idle",
  tibiaCoinsCharacterLookupTimer: 0,
  tibiaCoinsCharacterRequestId: 0,
  tibiaCoinsQuantity: TIBIA_COINS_QUANTITY_MIN,
  tibiaCoinsPrice: null,
  tibiaCoinsPriceError: false,
  tibiaCoinsPriceLoading: false,
  tibiaCoinsPriceLookupTimer: 0,
  tibiaCoinsPriceRequestId: 0,
  coffeeThankYouVisible: false,
  coffeePixQrVisible: false,
  coffeePixCopied: false,
  coffeePixCopyResetTimer: 0,
  mirrorCreationNudgeDismissed: false,
  mirrorCreationNudgeHandle: 0,
  emptyStateModeKey: "",
  emptyStateExtraKey: "",
  tibiaTutorialReadyLastPoll: false,
  pollHandle: 0,
  opacityPreviewTimers: new Map(),
  opacityPreviewValues: new Map(),
  opacityCommitTimers: new Map(),
  regionNamePatchTimers: new Map(),
  countdownPatchTimers: new Map(),
  countdownPatchValues: new Map(),
  openCountdownRegionId: "",
  openRegionNameEditorId: "",
  countdownCapturingHotkeyRegionId: "",
  modal: null,
  activeTooltipTrigger: null,
  tutorialTooltipSuppressed: false,
  profileSelectionPath: "",
  deferredRefreshPending: false,
  dockedPanel: {
    open: false,
    panelKey: "",
    side: "right",
    phase: "closed",
    width: 0
  },
  dockedPanelRenderedState: {
    open: false,
    side: "right",
    phase: "closed"
  },
  dockedPanelMainWidthLock: 0,
  wheelPerksSummary: null,
  grid: {
    enabled: false,
    gridSize: 32
  }
};

if (typeof window !== "undefined" && !window.screenVisionApi && window.desktopApi?.screenVisionApi) {
  window.screenVisionApi = window.desktopApi.screenVisionApi;
}

if (typeof window !== "undefined") {
  window.TibiaMirrorTutorialApi = {
    isTibiaReady() {
      return isTibiaWindowReadyForTutorial();
    },
    async ensureTibiaReady() {
      await refreshTibiaState();
      return isTibiaWindowReadyForTutorial();
    },
    startProfileDemo() {
      return startTibiaMirrorProfileTutorialDemo();
    },
    fillProfileDemo(profileName, characterName) {
      fillTibiaMirrorProfileTutorialDemo(profileName, characterName);
    },
    commitProfileDemo() {
      commitTibiaMirrorProfileTutorialDemo();
    },
    async openProfilesPanel() {
      await openTibiaMirrorTutorialProfilesPanel();
    },
    async closeProfilesPanel() {
      await closeTibiaMirrorTutorialProfilesPanel();
    },
    async showGridDemo() {
      await showTibiaMirrorTutorialGrid();
    },
    createFocus(id, selectors) {
      createTibiaMirrorTutorialFocus(id, selectors);
    },
    async finishProfileDemo() {
      await finishTibiaMirrorProfileTutorialDemo();
    },
    async startSqmFinderDemo() {
      return startSqmFinderTutorialDemo();
    },
    async setSqmFinderDemoStage(stage) {
      await setSqmFinderTutorialStage(stage);
    },
    async finishSqmFinderDemo(options) {
      await finishSqmFinderTutorialDemo(options);
    },
    async startAlertDemo() {
      return startDockedAlertTutorialDemo();
    },
    async setAlertDemoStage(stage) {
      await setDockedAlertTutorialStage(stage);
    },
    async finishAlertDemo(options) {
      await finishDockedAlertTutorialDemo(options);
    },
    setTutorialTooltipSuppressed(suppressed) {
      setTutorialTooltipSuppressed(suppressed);
    }
  };
}

if (typeof window !== "undefined" && window.screenVisionApi && els.shell) {
  boot();
}

async function boot() {
  await bootstrapRendererLocale({
    root: document.body,
    onChanged() {
      renderDockedPanel();
      render();
      syncDesktopAuthenticatorButtonState();
      syncDesktopCoffeeButtonState();
    }
  });
  bindEvents();
  replaceStaticIcons();
  bindExternalEvents();
  const bootstrap = await window.screenVisionApi.data.sendMessage({ type: "bootstrap" }).catch(() => ({}));
  state.supportersDataUrl = String(bootstrap?.supportersDataUrl || "").trim();
  await Promise.all([
    loadDockedAlertsState(),
    loadDockedProfilesState(),
    loadDockedSupportersState({ supportersDataUrl: state.supportersDataUrl }),
    loadDockedVisualState(),
    loadAlertRuntimeState()
  ]);
  state.obsMirrorStatus = await window.screenVisionApi.obs.getStatus().catch(() => state.obsMirrorStatus);
  await refreshDockedAuthenticatorRuntime({ render: false, force: true });
  await refreshDockedAlertProfileLabel();
  renderDockedPanel();
  await refreshAll();
  startPolling();
}

function bindEvents() {
  window.addEventListener("message", handleWheelOfDestinyMessage);

  els.windowMinimizeButton?.addEventListener("click", () => {
    void window.screenVisionApi.window.minimize();
  });

  els.windowCloseButton?.addEventListener("click", () => {
    void window.screenVisionApi.window.close();
  });

  els.toggleAllVisibilityButton?.addEventListener("click", () => {
    if (blockMirrorToolbarAction(els.toggleAllVisibilityButton, { requiresRegion: true })) {
      return;
    }
    void toggleAllRegionsVisibility();
  });

  els.desktopVisibilityButton?.addEventListener("click", () => {
    if (blockMirrorToolbarAction(els.desktopVisibilityButton, { requiresRegion: true })) {
      return;
    }
    void toggleAllRegionsVisibility();
  });

  els.toggleAllLockButton?.addEventListener("click", () => {
    if (blockMirrorToolbarAction(els.toggleAllLockButton, { requiresRegion: true })) {
      return;
    }
    void toggleAllRegionsLock();
  });

  els.obsMirrorButton?.addEventListener("click", async () => {
    const button = els.obsMirrorButton;
    if (!button) {
      return;
    }

    button.disabled = true;
    const nextStatus = await window.screenVisionApi.obs.toggle().catch((error) => ({
      ...state.obsMirrorStatus,
      enabled: false,
      error: String(error?.message || error || "Nao foi possivel conectar ao OBS.")
    }));
    button.disabled = false;
    state.obsMirrorStatus = nextStatus || state.obsMirrorStatus;
    renderToolbar();

    if (state.obsMirrorStatus.error) {
      await window.screenVisionApi.dialogs.confirm({
        title: t("screenVision.obs.enable"),
        message: state.obsMirrorStatus.error,
        confirmLabel: t("dialog.confirm"),
        tone: "success",
        mediaPath: "assets/ui/tutorial/websocketobs.gif",
        mediaWidth: 320,
        width: 500,
        hideCancel: true,
        autoHeight: true,
        external: true,
        flat: true
      }).catch(() => null);
    }
  });

  els.desktopTibiaCoinsButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void window.screenVisionApi.tools.open("tibia-coins-panel").catch(() => null);
  });

  els.openAlertasButton?.addEventListener("click", () => {
    if (blockMirrorToolbarAction(els.openAlertasButton)) {
      return;
    }
    void window.screenVisionApi.tools.open("alertas-panel").catch(() => null);
  });

  els.openVisualCustomizationButton?.addEventListener("click", () => {
    if (blockMirrorToolbarAction(els.openVisualCustomizationButton)) {
      return;
    }
    void window.screenVisionApi.tools.open("sqm-finder-panel").catch(() => null);
  });

  els.gridOverlayButton?.addEventListener("click", async () => {
    if (blockMirrorToolbarAction(els.gridOverlayButton)) {
      return;
    }
    const next = await window.screenVisionApi.grid.toggle().catch(() => null);

    if (!next) {
      return;
    }

    state.grid = {
      enabled: Boolean(next.enabled),
      gridSize: Number(next.gridSize) || 32
    };
    render();
  });

  els.settingsButton?.addEventListener("click", () => {
    if (blockMirrorToolbarAction(els.settingsButton)) {
      return;
    }
    void window.screenVisionApi.tools.open("profiles-panel").catch(() => null);
  });

  els.addRegionButton?.addEventListener("click", async () => {
    // The toolbar can regain focus before the background poll observes Tibia
    // behind it. Refresh now so the first click uses the current window state.
    await refreshTibiaState();
    if (blockMirrorToolbarAction(els.addRegionButton)) {
      return;
    }
    if (blockMirrorCreationWithoutProfile(els.addRegionButton)) {
      return;
    }
    if (blockMirrorCreationWhileHidden(els.addRegionButton)) {
      return;
    }

    state.mirrorCreationNudgeDismissed = true;
    stopMirrorCreationNudge();
    void addRegion();
  });

  els.addRegionButton?.addEventListener("mouseenter", () => {
    els.addRegionButton?.classList.remove("attention-shake", "attention-white");
  });

  els.cropToolButton?.addEventListener("click", async () => {
    await refreshTibiaState();
    if (blockMirrorToolbarAction(els.cropToolButton)) {
      return;
    }
    if (blockMirrorCreationWithoutProfile(els.cropToolButton)) {
      return;
    }
    if (blockMirrorCreationWhileHidden(els.cropToolButton)) {
      return;
    }

    void addFixedRegion();
  });

  els.emptyState?.addEventListener("click", (event) => {
    void handleEmptyStateClick(event);
  });

  els.emptyState?.addEventListener("input", (event) => {
    handleEmptyStateInput(event);
  });

  els.dockedPanelHost?.addEventListener("click", (event) => {
    void handleDockedPanelClick(event);
  });

  els.dockedPanelHost?.addEventListener("mousedown", (event) => {
    handleDockedPanelPointerDown(event);
  });

  els.dockedPanelHost?.addEventListener("input", (event) => {
    void handleDockedPanelInput(event);
  });

  els.dockedPanelHost?.addEventListener("change", (event) => {
    void handleDockedPanelChange(event);
  });

  els.dockedPanelHost?.addEventListener("keydown", (event) => {
    void handleDockedPanelKeydown(event);
  });

  els.regionGrid?.addEventListener("click", (event) => {
    const hotkeyButton = event.target.closest("[data-countdown-hotkey]");

    if (hotkeyButton) {
      const regionId = hotkeyButton.dataset.regionId || "";
      state.countdownCapturingHotkeyRegionId = regionId;
      render();
      window.requestAnimationFrame(() => {
        els.regionGrid
          ?.querySelector(`[data-countdown-hotkey="true"][data-region-id="${cssEscape(regionId)}"]`)
          ?.focus();
      });
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    const colorButton = event.target.closest("[data-countdown-color]");

    if (colorButton) {
      const regionId = colorButton.dataset.regionId || "";
      const color = colorButton.dataset.countdownColor || "gradient";
      const field = colorButton.dataset.countdownColorField || "color";
      applyLocalRegionPatch(regionId, { countdown: { [field]: color } });
      render();
      scheduleCountdownPatch(regionId, { [field]: color }, { immediate: true });
      return;
    }

    if (!actionButton) {
      return;
    }

    hideFloatingTooltip();

    const regionId = actionButton.dataset.regionId || "";
    const action = actionButton.dataset.action || "";

    if (!action) {
      return;
    }

    if (action === "toggle-name-editor") {
      state.openRegionNameEditorId = state.openRegionNameEditorId === regionId ? "" : regionId;
      render();
      if (state.openRegionNameEditorId === regionId) {
        window.requestAnimationFrame(() => {
          const input = els.regionGrid?.querySelector(`[data-region-name-field][data-region-id="${cssEscape(regionId)}"]`);
          input?.focus();
          input?.select?.();
        });
      }
      return;
    }

    if (action === "toggle-visibility") {
      void toggleRegionVisibility(regionId);
      return;
    }

    if (action === "toggle-lock") {
      void toggleRegionLock(regionId);
      return;
    }

    if (action === "delete") {
      const region = findRegion(regionId);
      if (region) {
        openDeleteRegionModal(region);
      }
      return;
    }

    if (action === "toggle-countdown-panel") {
      state.openCountdownRegionId = state.openCountdownRegionId === regionId ? "" : regionId;
      render();
      return;
    }

    if (action === "toggle-countdown-run") {
      const region = findRegion(regionId);

      if (region?.countdownIsRunning) {
        void stopCountdown(regionId);
      } else {
        void startCountdown(regionId);
      }

      return;
    }

    if (action === "countdown-toggle-field") {
      const field = actionButton.dataset.countdownField || "";
      const region = findRegion(regionId);

      if (!field || !region) {
        return;
      }

      const countdown = normalizeCountdown(region.countdown);
      const value = !Boolean(countdown[field]);
      applyLocalRegionPatch(regionId, { countdown: { [field]: value } });
      render();
      scheduleCountdownPatch(regionId, { [field]: value }, { immediate: true });
      return;
    }

    if (action === "countdown-choice") {
      const field = actionButton.dataset.countdownField || "";
      const value = actionButton.dataset.countdownValue || "";
      const region = findRegion(regionId);

      if (!field || !value || !region) {
        return;
      }

      const countdown = normalizeCountdown(region.countdown);
      const patch = { [field]: field === "side" ? normalizeCountdownSide(value) : normalizeCountdownDirection(value) };

      if (field === "side") {
        const nextSide = normalizeCountdownSide(value);
        const currentDefaults = getCountdownDefaultsForSide(countdown.side);
        const nextDefaults = getCountdownDefaultsForSide(nextSide);
        const currentDimensions = getCountdownDimensionFields(countdown.side);
        const nextDimensions = getCountdownDimensionFields(nextSide);
        const visibleWidth = countdown[currentDimensions.width];
        const visibleHeight = countdown[currentDimensions.height];
        const stillUsingSideDefaults = countdown.barThickness === currentDefaults.barThickness
          && countdown.barLength === currentDefaults.barLength
          && countdown.direction === currentDefaults.direction;

        if (stillUsingSideDefaults) {
          patch.barThickness = nextDefaults.barThickness;
          patch.barLength = nextDefaults.barLength;
          patch.direction = nextDefaults.direction;
        } else {
          patch[nextDimensions.width] = visibleWidth;
          patch[nextDimensions.height] = visibleHeight;
        }
      }

      applyLocalRegionPatch(regionId, { countdown: patch });
      render();
      scheduleCountdownPatch(regionId, patch, { immediate: true });
      return;
    }

    if (action === "countdown-save-color" || action === "countdown-delete-color") {
      const field = actionButton.dataset.countdownField || "";
      const colorField = actionButton.dataset.countdownColorField || "";
      const region = findRegion(regionId);

      if (!field || !colorField || !region) {
        return;
      }

      const countdown = normalizeCountdown(region.countdown);
      const currentColor = normalizeCountdownColor(countdown[field]);

      if (currentColor === "gradient") {
        flashBlockedActionTooltip(actionButton, "Escolha uma cor para salvar");
        return;
      }

      const existing = normalizeCountdownSavedColors(countdown[colorField], field);
      const normalizedCurrent = currentColor.toLowerCase();
      const nextColors = action === "countdown-save-color"
        ? existing.some((color) => color.toLowerCase() === normalizedCurrent)
          ? existing
          : [...existing, currentColor].slice(0, 10)
        : existing.filter((color) => color.toLowerCase() !== normalizedCurrent);

      if (action === "countdown-save-color" && existing.length >= 10 && nextColors.length === existing.length) {
        flashBlockedActionTooltip(actionButton, "Apague uma cor para salvar outra");
        return;
      }

      applyLocalRegionPatch(regionId, { countdown: { [colorField]: nextColors } });
      render();
      scheduleCountdownPatch(regionId, { [colorField]: nextColors }, { immediate: true });
      return;
    }

    if (action === "unsnap") {
      void unsnapRegion(regionId);
    }
  });

  els.regionGrid?.addEventListener("input", (event) => {
    const opacityInput = event.target.closest("[data-opacity-region-id]");

    if (opacityInput) {
      const regionId = opacityInput.dataset.opacityRegionId || "";
      const value = Number.parseInt(opacityInput.value, 10);
      const valueLabel = opacityInput.closest(".region-opacity")?.querySelector("[data-opacity-value]");
      const percent = Number.isFinite(value) ? ((value - 15) / 85) * 100 : 100;

      if (valueLabel && Number.isFinite(value)) {
        valueLabel.textContent = `${value}%`;
      }

      opacityInput.style.setProperty("--region-opacity-progress", `${Math.max(0, Math.min(100, percent))}%`);
      scheduleRegionOpacity(regionId, value);
      return;
    }

    const regionNameInput = event.target.closest("[data-region-name-field]");

    if (regionNameInput) {
      const regionId = regionNameInput.dataset.regionId || "";
      const name = String(regionNameInput.value || "").slice(0, 80);

      if (regionId) {
        applyLocalRegionPatch(regionId, { name });
        scheduleRegionNamePatch(regionId, name);
      }

      return;
    }

    const countdownInput = event.target.closest("[data-countdown-field]");

    if (!countdownInput) {
      return;
    }

    const regionId = countdownInput.dataset.regionId || "";
    const field = countdownInput.dataset.countdownField || "";
    const value = readCountdownFieldValue(countdownInput, field);

    if (!regionId || !field) {
      return;
    }

    applyLocalRegionPatch(regionId, { countdown: { [field]: value } });
    updateCountdownInlineUi(countdownInput, field, value);
    scheduleCountdownPatch(regionId, { [field]: value });
  });

  els.regionGrid?.addEventListener("change", (event) => {
    const opacityInput = event.target.closest("[data-opacity-region-id]");

    if (opacityInput) {
      const regionId = opacityInput.dataset.opacityRegionId || "";
      const value = Number.parseInt(opacityInput.value, 10);
      flushRegionOpacity(regionId, value);
      return;
    }

    const regionNameInput = event.target.closest("[data-region-name-field]");

    if (regionNameInput) {
      const regionId = regionNameInput.dataset.regionId || "";
      const name = String(regionNameInput.value || "").trim().slice(0, 80);

      if (regionId && name) {
        applyLocalRegionPatch(regionId, { name });
        scheduleRegionNamePatch(regionId, name, { immediate: true });
      }

      return;
    }

    const countdownInput = event.target.closest("[data-countdown-field]");

    if (!countdownInput) {
      return;
    }

    const regionId = countdownInput.dataset.regionId || "";
    const field = countdownInput.dataset.countdownField || "";
    const value = readCountdownFieldValue(countdownInput, field);

    if (!regionId || !field) {
      return;
    }

    applyLocalRegionPatch(regionId, { countdown: { [field]: value } });
    if (field === "color" || field === "borderColor") {
      render();
    }
    scheduleCountdownPatch(regionId, { [field]: value }, { immediate: true });
  });

  els.regionGrid?.addEventListener("keydown", (event) => {
    const regionNameInput = event.target.closest("[data-region-name-field]");

    if (regionNameInput) {
      if (event.key === "Enter") {
        event.preventDefault();
        const regionId = regionNameInput.dataset.regionId || "";
        const name = String(regionNameInput.value || "").trim().slice(0, 80);

        if (regionId && name) {
          applyLocalRegionPatch(regionId, { name });
          scheduleRegionNamePatch(regionId, name, { immediate: true });
        }

        regionNameInput.blur();
      }

      return;
    }

    const hotkeyInput = event.target.closest("[data-countdown-hotkey]");

    if (!hotkeyInput) {
      return;
    }

    if (event.key === "Tab") {
      return;
    }

    event.preventDefault();
    const regionId = hotkeyInput.dataset.regionId || "";

    if (event.key === "Escape") {
      applyLocalRegionPatch(regionId, {
        countdown: {
          hotkey: "",
          hotkeyKeyCode: "",
          hotkeyModifiers: []
        }
      });
      scheduleCountdownPatch(regionId, {
        hotkey: "",
        hotkeyKeyCode: "",
        hotkeyModifiers: []
      }, { immediate: true });
      state.countdownCapturingHotkeyRegionId = "";
      hotkeyInput.blur();
      render();
      return;
    }

    const binding = toHotkeyBinding(event);

    if (!binding) {
      return;
    }

    hotkeyInput.value = binding.label;
    applyLocalRegionPatch(regionId, {
      countdown: {
        hotkey: binding.label,
        hotkeyKeyCode: binding.keyCode,
        hotkeyModifiers: binding.modifiers
      }
    });
    scheduleCountdownPatch(regionId, {
      hotkey: binding.label,
      hotkeyKeyCode: binding.keyCode,
      hotkeyModifiers: binding.modifiers
    }, { immediate: true });
    state.countdownCapturingHotkeyRegionId = "";
    render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.modal) {
      closeModal();
    }
  });

  els.modalRoot?.addEventListener("click", (event) => {
    if (event.target === els.modalRoot) {
      closeModal();
      return;
    }

    if (state.modal?.kind === "countdown") {
      const colorButton = event.target.closest("[data-countdown-color]");

      if (colorButton) {
        const regionId = colorButton.dataset.regionId || "";
        const color = colorButton.dataset.countdownColor || "gradient";
        const field = colorButton.dataset.countdownColorField || "color";
        applyLocalRegionPatch(regionId, { countdown: { [field]: color } });
        renderModal();
        scheduleCountdownPatch(regionId, { [field]: color }, { immediate: true });
        return;
      }

      const countdownButton = event.target.closest("[data-action='toggle-countdown-run']");

      if (countdownButton) {
        const regionId = countdownButton.dataset.regionId || "";
        const region = findRegion(regionId);

        if (region?.countdownIsRunning) {
          void stopCountdown(regionId);
        } else {
          void startCountdown(regionId);
        }

        return;
      }
    }

    if (state.modal?.kind === "profiles") {
      const profileRow = event.target.closest("[data-profile-path]");

      if (profileRow) {
        state.profileSelectionPath = profileRow.dataset.profilePath || "";
        renderModal();
        return;
      }

      const profileActionButton = event.target.closest("[data-profile-action]");

      if (profileActionButton) {
        void handleProfilesModalAction(profileActionButton.dataset.profileAction || "");
        return;
      }
    }

    const button = event.target.closest("[data-modal-action]");

    if (!button || !state.modal) {
      return;
    }

    if (button.dataset.modalAction === "cancel") {
      closeModal();
      return;
    }

    if (button.dataset.modalAction === "confirm") {
      const input = els.modalRoot.querySelector("[data-modal-input]");
      const value = input ? String(input.value || "") : "";
      const modal = state.modal;
      closeModal();
      void modal.onConfirm?.(value);
    }
  });

  els.modalRoot?.addEventListener("input", (event) => {
    if (state.modal?.kind !== "countdown") {
      return;
    }

    const countdownInput = event.target.closest("[data-countdown-field]");

    if (!countdownInput) {
      return;
    }

    const regionId = countdownInput.dataset.regionId || "";
    const field = countdownInput.dataset.countdownField || "";
    const value = readCountdownFieldValue(countdownInput, field);

    if (!regionId || !field) {
      return;
    }

    applyLocalRegionPatch(regionId, { countdown: { [field]: value } });
    updateCountdownInlineUi(countdownInput, field, value);
    scheduleCountdownPatch(regionId, { [field]: value });
  });

  els.modalRoot?.addEventListener("change", (event) => {
    if (state.modal?.kind !== "countdown") {
      return;
    }

    const countdownInput = event.target.closest("[data-countdown-field]");

    if (!countdownInput) {
      return;
    }

    const regionId = countdownInput.dataset.regionId || "";
    const field = countdownInput.dataset.countdownField || "";
    const value = readCountdownFieldValue(countdownInput, field);

    if (!regionId || !field) {
      return;
    }

    applyLocalRegionPatch(regionId, { countdown: { [field]: value } });
    scheduleCountdownPatch(regionId, { [field]: value }, { immediate: true });
  });

  els.modalRoot?.addEventListener("keydown", (event) => {
    if (state.modal?.kind !== "countdown") {
      return;
    }

    const hotkeyInput = event.target.closest("[data-countdown-hotkey]");

    if (!hotkeyInput) {
      return;
    }

    if (event.key === "Tab") {
      return;
    }

    event.preventDefault();
    const regionId = hotkeyInput.dataset.regionId || "";

    if (event.key === "Escape") {
      hotkeyInput.blur();
      return;
    }

    const binding = toHotkeyBinding(event);

    if (!binding) {
      return;
    }

    hotkeyInput.value = binding.label;
    applyLocalRegionPatch(regionId, {
      countdown: {
        hotkey: binding.label,
        hotkeyKeyCode: binding.keyCode,
        hotkeyModifiers: binding.modifiers
      }
    });
    scheduleCountdownPatch(regionId, {
      hotkey: binding.label,
      hotkeyKeyCode: binding.keyCode,
      hotkeyModifiers: binding.modifiers
    }, { immediate: true });
  });
}

function bindExternalEvents() {
  window.screenVisionApi.events?.onOverlayStateChanged?.(() => {
    // The alert tour intentionally swaps in an in-memory timer. Do not let
    // unrelated storage events replace it halfway through the walkthrough.
    if (state.alertTutorialDemo?.active) {
      return;
    }

    if (shouldPreserveInteractiveSurface()) {
      state.deferredRefreshPending = true;
      return;
    }

    void reloadDockedAlertsState();
    void loadDockedProfilesState();
    void loadDockedVisualState();
    void refreshAll();
  });

  window.screenVisionApi.events?.onProfilesChanged?.((payload) => {
    void refreshDockedAlertProfileLabel();
    void (async () => {
      await loadDockedProfilesState({ items: payload?.items });
      await refreshAll();
    })();

    if (state.modal?.kind === "profiles" && Array.isArray(payload?.items)) {
      const fallbackPath = payload.items.find((entry) => entry?.isActive)?.path || payload.items[0]?.path || "";
      if (!payload.items.some((entry) => entry?.path === state.profileSelectionPath)) {
        state.profileSelectionPath = fallbackPath;
      }
      state.modal.items = payload.items;
      renderModal();
    }
  });

  window.screenVisionApi.events?.onTimerRuntimeChanged?.((payload) => {
    state.alertRuntimeById = payload?.snapshot?.activeById && typeof payload.snapshot.activeById === "object"
      ? payload.snapshot.activeById
      : {};

    if (isDockedAlertPanelOpen()) {
      syncDockedAlertRuntimeUiFromState();
    }
  });

  window.screenVisionApi.events?.onDockedToolPanelStateChanged?.((payload) => {
    const previousPanelKey = state.dockedPanel?.panelKey || "";
    const previousWasOpen = Boolean(state.dockedPanel?.open);
    state.dockedPanel = {
      open: Boolean(payload?.open),
      panelKey: typeof payload?.panelKey === "string" ? payload.panelKey : "",
      side: payload?.side === "left" ? "left" : "right",
      phase: typeof payload?.phase === "string" ? payload.phase : (payload?.open ? "open" : "closed"),
      width: Number(payload?.width) || 0
    };
    if (
      (previousWasOpen && previousPanelKey === "alertas-panel" && state.dockedPanel.panelKey !== "alertas-panel")
      || (!state.dockedPanel.open && previousPanelKey === "alertas-panel")
    ) {
      resetDockedAlertTransientUiState();
    }
    if (!state.dockedPanel.open || state.dockedPanel.panelKey !== "buy-me-a-coffee-panel") {
      resetCoffeePanelState();
    }
    if (state.dockedPanel.open && state.dockedPanel.panelKey === "authenticator-panel") {
      void refreshDockedAuthenticatorRuntime({ force: true });
    }
    renderDockedPanel();
  });
}

function getDockedPanelCopy(panelKey) {
  if (panelKey === "alertas-panel") {
    return {
      title: t("screenVision.alerts"),
      description: "",
      emptyTitle: t("screenVision.alerts"),
      emptyCopy: t("sidePanel.pendingCopy")
    };
  }

  if (panelKey === "profiles-panel") {
    return {
      title: t("sidePanel.profiles.title"),
      description: "",
      emptyTitle: t("sidePanel.profiles.pendingTitle"),
      emptyCopy: t("sidePanel.pendingCopy")
    };
  }

  if (panelKey === "authenticator-panel") {
    return {
      title: t("screenVision.authenticator.title"),
      description: "",
      emptyTitle: t("screenVision.authenticator.title"),
      emptyCopy: ""
    };
  }

  if (panelKey === "sqm-finder-panel") {
    return {
      title: t("screenVision.sqmFinder"),
      description: "",
      emptyTitle: t("screenVision.sqmFinder"),
      emptyCopy: ""
    };
  }

  if (panelKey === "tibia-coins-panel") {
    return {
      title: t("screenVision.tibiaCoins.title"),
      description: "",
      emptyTitle: t("screenVision.tibiaCoins.title"),
      emptyCopy: ""
    };
  }

  if (panelKey === "buy-me-a-coffee-panel") {
    return {
      title: t("screenVision.coffee.title"),
      description: "",
      emptyTitle: t("screenVision.coffee.title"),
      emptyCopy: ""
    };
  }

  if (panelKey === "supporters-panel") {
    return {
      title: t("screenVision.supporters.title"),
      description: "",
      emptyTitle: t("screenVision.supporters.title"),
      emptyCopy: ""
    };
  }

  if (panelKey === "settings-panel") {
    return {
      title: t("screenVision.settings.title"),
      description: "",
      emptyTitle: t("screenVision.settings.title"),
      emptyCopy: ""
    };
  }

  if (panelKey === "wheel-perks-panel") {
    return {
      title: t("wheel.summary.title"),
      description: "",
      emptyTitle: t("wheel.summary.title"),
      emptyCopy: t("wheel.summary.empty")
    };
  }

  return {
    title: t("sidePanel.title"),
    description: "",
    emptyTitle: t("sidePanel.readyTitle"),
    emptyCopy: t("sidePanel.pendingCopy")
  };
}

function setDockedPanelMainWidthLock(width) {
  const normalizedWidth = Math.max(0, Math.round(width || 0));

  if (!normalizedWidth) {
    return;
  }

  state.dockedPanelMainWidthLock = normalizedWidth;
  document.body.style.setProperty("--desktop-docked-main-column-width", `${normalizedWidth}px`);
  document.body.classList.add("desktop-docked-panel-main-locked");
}

function releaseDockedPanelMainWidthLock() {
  state.dockedPanelMainWidthLock = 0;
  document.body.style.removeProperty("--desktop-docked-main-column-width");
  document.body.classList.remove("desktop-docked-panel-main-locked");
}

function captureDockedPanelMainWidthLock() {
  const mainContent = document.querySelector(".main-content");
  const width = Math.round(mainContent?.getBoundingClientRect().width || 0);

  if (width > 0) {
    setDockedPanelMainWidthLock(width);
  }
}

function isDockedAlertPanelOpen() {
  return state.dockedPanel.open && state.dockedPanel.panelKey === "alertas-panel";
}

function isDockedAuthenticatorPanelOpen() {
  return state.dockedPanel.open && state.dockedPanel.panelKey === "authenticator-panel";
}

function isDockedSqmFinderPanelOpen() {
  return state.dockedPanel.open && state.dockedPanel.panelKey === "sqm-finder-panel";
}

function isDockedTibiaCoinsPanelOpen() {
  return state.dockedPanel.open && state.dockedPanel.panelKey === "tibia-coins-panel";
}

function isDockedCoffeePanelOpen() {
  return state.dockedPanel.open && state.dockedPanel.panelKey === "buy-me-a-coffee-panel";
}

async function loadDockedVisualState(options = {}) {
  state.visualCustomization = normalizeDockedVisualState(
    await window.screenVisionApi.visual.get().catch(() => null)
  );

  if (isDockedSqmFinderPanelOpen() && options.render !== false) {
    renderDockedPanel();
  }
}

function normalizeDockedVisualState(value) {
  const visual = value && typeof value === "object" ? value : {};
  return {
    charLocEnabled: Boolean(visual.charLocEnabled),
    charLocX: Number.isFinite(Number(visual.charLocX)) ? Number(visual.charLocX) : 0,
    charLocY: Number.isFinite(Number(visual.charLocY)) ? Number(visual.charLocY) : 0,
    charLocSize: clampInteger(visual.charLocSize, 20, 160, 40),
    charLocShape: normalizeSqmShape(visual.charLocShape),
    charLocColor: normalizeSqmAccentColor(visual.charLocColor),
    charLocIntensity: clampInteger(visual.charLocIntensity, 1, 30, 10),
    charLocPulse: Boolean(visual.charLocPulse),
    charLocLocked: Boolean(visual.charLocLocked),
    charLocSavedColors: normalizeSqmSavedColors(visual.charLocSavedColors),
    cursorGlowEnabled: Boolean(visual.cursorGlowEnabled),
    cursorGlowSize: clampInteger(visual.cursorGlowSize, 20, 160, 40),
    cursorGlowColor: normalizeSqmAccentColor(visual.cursorGlowColor),
    cursorGlowSavedColors: normalizeSqmSavedColors(visual.cursorGlowSavedColors)
  };
}

function normalizeSqmSavedColors(value) {
  const source = Array.isArray(value) && value.length ? value : SQM_DEFAULT_SAVED_COLORS;
  return source
    .map((entry) => normalizeSqmAccentColor(entry))
    .filter(Boolean)
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, 10);
}

function normalizeSqmAccentColor(value) {
  const normalized = normalizeAlertHex(value || "#58c470");
  return normalized === "#ff7f00" ? "#58c470" : normalized;
}

function normalizeSqmShape(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "arrow") {
    return "Arrow";
  }
  if (normalized === "square") {
    return "Square";
  }
  return "Circle";
}

async function loadDockedAlertsState() {
  const stored = await window.screenVisionApi.storage.get(OVERLAY_TOOLS_STORAGE_KEY).catch(() => ({}));
  state.overlayTools = normalizeOverlayToolsState(stored?.[OVERLAY_TOOLS_STORAGE_KEY] || null);
  const repairResult = repairDockedAlertTimersState(state.overlayTools?.timers?.items);

  if (repairResult.changed) {
    state.overlayTools.timers.items = repairResult.items;
  }

  if (!state.alertDefaultsApplied) {
    state.alertDefaultsApplied = true;
    state.overlayTools.timers.isListening = false;
    state.overlayTools.timers.visualsEnabled = false;
    await persistDockedAlertsState();
    return;
  }

  if (repairResult.changed) {
    await persistDockedAlertsState();
  }
}

function repairDockedAlertTimersState(items) {
  if (!Array.isArray(items) || !items.length) {
    return {
      changed: false,
      items: Array.isArray(items) ? items : []
    };
  }

  let changed = false;

  const nextItems = items.map((entry) => {
    const timer = normalizeOverlayTimerEntry(entry);

    if (!timer) {
      return entry;
    }

    if (timer.showVisualAlert !== false && timer.locked !== true) {
      const hasSavedPosition = Number.isFinite(timer.alertPositionX) && Number.isFinite(timer.alertPositionY);

      changed = true;

      return normalizeOverlayTimerEntry({
        ...timer,
        locked: hasSavedPosition ? true : false,
        showVisualAlert: hasSavedPosition ? timer.showVisualAlert : false
      });
    }

    return timer;
  });

  return {
    changed,
    items: nextItems
  };
}

async function reloadDockedAlertsState(options = {}) {
  if (state.alertTutorialDemo?.active) {
    return;
  }

  await loadDockedAlertsState();
  await loadAlertRuntimeState();
  await refreshDockedAuthenticatorRuntime({ render: false, force: true });

  if (options.render !== false && isDockedAlertPanelOpen()) {
    renderDockedPanel();
    return;
  }

  if (options.render !== false && isDockedAuthenticatorPanelOpen()) {
    renderDockedPanel();
  }
}

async function loadAlertRuntimeState() {
  const getRuntime = window.screenVisionApi?.timers?.getRuntime;
  const runtime = typeof getRuntime === "function"
    ? await getRuntime().catch(() => ({ activeById: {} }))
    : { activeById: {} };
  state.alertRuntimeById = runtime?.activeById && typeof runtime.activeById === "object"
    ? runtime.activeById
    : {};
}

async function refreshDockedAlertProfileLabel() {
  const profiles = await window.screenVisionApi.profiles.list().catch(() => []);
  const activeProfile = Array.isArray(profiles) ? profiles.find((entry) => entry?.isActive) || null : null;
  state.alertProfileLabel = activeProfile?.name || "tibia mirror";

  if (isDockedAlertPanelOpen()) {
    renderDockedPanel();
  }
}

function isDockedProfilesPanelOpen() {
  return state.dockedPanel.open && state.dockedPanel.panelKey === "profiles-panel";
}

function isDockedSupportersPanelOpen() {
  return state.dockedPanel.open && state.dockedPanel.panelKey === "supporters-panel";
}

function isDockedSettingsPanelOpen() {
  return state.dockedPanel.open && state.dockedPanel.panelKey === "settings-panel";
}

function isDockedWheelPerksPanelOpen() {
  return state.dockedPanel.open && state.dockedPanel.panelKey === "wheel-perks-panel";
}

async function loadDockedProfilesState(options = {}) {
  const requestId = ++state.profileSummaryRequestId;
  state.profilesPanelLoading = true;

  const items = Array.isArray(options.items)
    ? options.items
    : await window.screenVisionApi.profiles.list().catch(() => []);

  const normalizedItems = Array.isArray(items)
    ? items.map((entry) => normalizeDockedProfileEntry(entry)).filter(Boolean)
    : [];
  normalizedItems.sort((left, right) => {
    if (Boolean(left.isActive) !== Boolean(right.isActive)) {
      return left.isActive ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" });
  });
  const characterNames = normalizedItems
    .map((entry) => entry.characterName)
    .filter(Boolean);

  let summaries = {};

  if (characterNames.length) {
    summaries = await window.screenVisionApi.profiles.resolveCharacters(characterNames).catch(() => ({}));
  }

  if (requestId !== state.profileSummaryRequestId) {
    return;
  }

  state.profileCharacterSummaries = summaries && typeof summaries === "object" ? summaries : {};
  state.profilesIndex = normalizedItems.map((entry) => ({
    ...entry,
    characterSummary: state.profileCharacterSummaries[entry.characterName] || null
  }));
  state.profilesPanelLoading = false;

  if (!state.profilesPanelExpandedEditPath || !state.profilesIndex.some((entry) => entry.path === state.profilesPanelExpandedEditPath)) {
    state.profilesPanelExpandedEditPath = state.profilesPanelExpandedEditPath === PROFILE_CREATE_SENTINEL
      ? PROFILE_CREATE_SENTINEL
      : "";
  }

  const activeProfile = state.profilesIndex.find((entry) => entry.isActive) || state.profilesIndex[0] || null;

  if (activeProfile && !state.profileDraft.profileName && !state.profileDraft.characterName) {
    state.profileDraft.profileName = activeProfile.name || "";
    state.profileDraft.characterName = activeProfile.characterName || "";
  } else if (!activeProfile && state.profilesPanelExpandedEditPath !== PROFILE_CREATE_SENTINEL) {
    clearProfileDraft();
  }

  renderEmptyState();

  if (isDockedProfilesPanelOpen() && options.render !== false) {
    renderDockedPanel();
  }
}

async function loadDockedSupportersState(options = {}) {
  const supportersDataUrl = String(options.supportersDataUrl || state.supportersDataUrl || "").trim();
  const requestId = ++state.supporterProfilesRequestId;
  state.supportersDataUrl = supportersDataUrl;
  const cachedDocument = await loadCachedSupportersDocument().catch(() => null);
  let sourceEntries = Array.isArray(options.seeds) ? options.seeds : [];
  let coffeeConfig = normalizeCoffeeConfig(options.coffee);

  const canFetchSupporters = Boolean(
    supportersDataUrl
    || window.screenVisionApi?.supporters?.fetchDocument
  );

  if (sourceEntries.length <= 0 && canFetchSupporters) {
    try {
      const document = await fetchSupportersDocument(supportersDataUrl);
      const payload = normalizeSupportersPayload(document);
      sourceEntries = payload.supporters;
      coffeeConfig = payload.coffee;
      await saveCachedSupportersDocument({
        updatedAt: document?.updatedAt || new Date().toISOString(),
        supporters: sourceEntries,
        coffee: coffeeConfig
      }).catch(() => {});
    } catch (_error) {
      sourceEntries = cachedDocument?.supporters || [];
      coffeeConfig = normalizeCoffeeConfig(cachedDocument?.coffee);
    }
  }

  if (sourceEntries.length <= 0 && !canFetchSupporters) {
    sourceEntries = [];
  }

  state.coffeeConfig = coffeeConfig;
  const baseEntries = buildSupporterPanelEntries(sourceEntries);
  state.supportersIndex = baseEntries;
  syncDesktopCoffeeButtonState();

  if (isDockedSupportersPanelOpen() && options.render !== false) {
    renderDockedPanel();
  }

  const supporterNames = baseEntries.map((entry) => entry.name).filter(Boolean);

  if (!supporterNames.length) {
    return;
  }

  const profiles = await window.screenVisionApi.profiles.resolveCharacters(supporterNames).catch(() => ({}));

  if (requestId !== state.supporterProfilesRequestId) {
    return;
  }

  const profileEntries = Object.entries(profiles || {});
  const profileMap = new Map(
    profileEntries.map(([name, profile]) => [String(name || "").trim().toLowerCase(), profile || null])
  );

  state.supportersIndex = buildSupporterPanelEntries(baseEntries.map((entry) => {
    const profile = profileMap.get(String(entry.name || "").trim().toLowerCase()) || null;

    if (!profile) {
      return entry;
    }

    return {
      ...entry,
      name: String(profile.name || entry.name || "").trim(),
      vocation: String(profile.vocation || entry.vocation || "").trim(),
      sex: String(profile.sex || entry.sex || "").trim(),
      level: Number.isFinite(Number(profile.level)) ? Math.max(0, Math.round(Number(profile.level))) : entry.level,
      world: String(profile.world || entry.world || "").trim(),
      guild: String(profile.guild || "").trim()
    };
  }));

  if (isDockedSupportersPanelOpen() && options.render !== false) {
    renderDockedPanel();
  }
}

function normalizeDockedProfileEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const path = typeof entry.path === "string" ? entry.path : "";

  if (!path) {
    return null;
  }

  return {
    path,
    name: String(entry.name || "Perfil").trim().slice(0, 80) || "Perfil",
    characterName: String(entry.characterName || "").trim().slice(0, 64),
    isActive: Boolean(entry.isActive)
  };
}

async function persistDockedAlertsState() {
  if (state.alertTutorialDemo?.active) {
    return;
  }

  state.overlayTools = cloneOverlayToolsStateForSave(state.overlayTools);
  await window.screenVisionApi.storage.set({
    [OVERLAY_TOOLS_STORAGE_KEY]: state.overlayTools
  }).catch(() => {});
}

function renderDockedPanel() {
  const host = els.dockedPanelHost;

  if (!host) {
    return;
  }

  clearSupporterShowcaseTimers();

  syncDesktopAuthenticatorButtonState();
  syncDesktopCoffeeButtonState();

  const panelState = state.dockedPanel || {
    open: false,
    panelKey: "",
    side: "right",
    phase: "closed",
    width: 0
  };
  const copy = getDockedPanelCopy(panelState.panelKey);
  const side = panelState.side === "left" ? "left" : "right";
  const phase = panelState.phase || (panelState.open ? "open" : "closed");
  const previousPanelState = state.dockedPanelRenderedState || {
    open: false,
    panelKey: "",
    side: "right",
    phase: "closed"
  };
  const previousContent = host.querySelector(".desktop-docked-panel-content");
  const previousScrollTop = previousContent?.scrollTop || 0;
  const shouldRestoreScroll = Boolean(
    panelState.open
    && previousPanelState.open
    && previousPanelState.panelKey === panelState.panelKey
  );

  if (phase === "left-pre-shift") {
    captureDockedPanelMainWidthLock();
  } else if (phase === "opening" && !previousPanelState.open) {
    captureDockedPanelMainWidthLock();
  } else if (phase === "closing" && previousPanelState.open) {
    captureDockedPanelMainWidthLock();
  } else if ((phase === "switch-out" || phase === "switch-in") && !state.dockedPanelMainWidthLock) {
    captureDockedPanelMainWidthLock();
  } else if (phase === "open" || phase === "closed") {
    releaseDockedPanelMainWidthLock();
  }

  document.body.style.setProperty("--desktop-docked-panel-width", `${Math.max(320, panelState.width || 418)}px`);
  document.body.classList.toggle("desktop-docked-panel-open", Boolean(panelState.open));
  document.body.classList.toggle("desktop-docked-panel-left", Boolean(panelState.open) && side === "left");
  document.body.classList.toggle("desktop-docked-panel-right", Boolean(panelState.open) && side === "right");
  document.body.dataset.dockedPanelKey = panelState.open ? (panelState.panelKey || "") : "";
  document.body.dataset.dockedPanelSide = side;
  document.body.dataset.dockedPanelPhase = phase;
  host.classList.toggle("hidden", (!panelState.open && phase === "closed") || phase === "left-pre-shift");
  host.setAttribute("aria-hidden", panelState.open ? "false" : "true");
  state.dockedPanelRenderedState = {
    open: Boolean(panelState.open),
    panelKey: panelState.panelKey || "",
    side,
    phase
  };

  if (!panelState.open && phase === "closed") {
    host.innerHTML = "";
    return;
  }

  host.innerHTML = renderDockedPanelShell(panelState, copy);
  bindDynamicTooltips(host);
  initializeSupporterShowcaseCycles(host);

  if (shouldRestoreScroll && previousScrollTop > 0) {
    const nextContent = host.querySelector(".desktop-docked-panel-content");
    if (nextContent) {
      nextContent.scrollTop = previousScrollTop;
      window.requestAnimationFrame(() => {
        nextContent.scrollTop = previousScrollTop;
      });
    }
  }

  const pendingScrollTargetId = String(state.dockedPanelPendingScrollTargetId || "").trim();
  if (pendingScrollTargetId) {
    const targetCard = host.querySelector(`[data-alert-timer-id="${cssEscape(pendingScrollTargetId)}"]`);

    if (targetCard instanceof HTMLElement) {
      window.requestAnimationFrame(() => {
        targetCard.scrollIntoView({
          block: "nearest",
          inline: "nearest"
        });
      });
    }

    state.dockedPanelPendingScrollTargetId = "";
  }
}

function syncDesktopAuthenticatorButtonState() {
  const button = els.desktopAuthenticatorButton;

  if (!button) {
    return;
  }

  const isOpen = isDockedAuthenticatorPanelOpen();
  const label = isOpen ? t("toolbar.closeAuthenticator") : t("toolbar.openAuthenticator");

  button.setAttribute("aria-label", label);
  setLiveTooltip(button, label);
  button.classList.toggle("active", isOpen);
}

function syncDesktopCoffeeButtonState() {
  const button = els.desktopCoffeeButton;

  if (!button) {
    return;
  }

  const shouldShow = shouldShowCoffeeButton();
  button.hidden = !shouldShow;
  button.disabled = !shouldShow;
  button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  button.style.display = shouldShow ? "" : "none";

  if (!shouldShow) {
    button.classList.remove("active");
    if (isDockedCoffeePanelOpen()) {
      resetCoffeePanelState();
    }
    return;
  }

  const isOpen = isDockedCoffeePanelOpen();
  const label = isOpen ? t("toolbar.closeBuyCoffee") : t("toolbar.openBuyCoffee");

  button.setAttribute("aria-label", label);
  setLiveTooltip(button, label);
  button.classList.toggle("active", isOpen);
}

function renderDockedPanelShell(panelState, copy) {
  if (panelState.panelKey === "alertas-panel") {
    return renderDockedAlertPanel(panelState, copy);
  }

  if (panelState.panelKey === "authenticator-panel") {
    return renderDockedAuthenticatorPanel(panelState, copy);
  }

  if (panelState.panelKey === "profiles-panel") {
    return renderDockedProfilesPanel(panelState, copy);
  }

  if (panelState.panelKey === "sqm-finder-panel") {
    return renderDockedSqmFinderPanel(panelState, copy);
  }

  if (panelState.panelKey === "tibia-coins-panel") {
    return renderDockedTibiaCoinsPanel(panelState, copy);
  }

  if (panelState.panelKey === "supporters-panel") {
    return renderDockedSupportersPanel(panelState, copy);
  }

  if (panelState.panelKey === "buy-me-a-coffee-panel") {
    return renderDockedCoffeePanel(panelState, copy);
  }

  if (panelState.panelKey === "settings-panel") {
    return renderDockedSettingsPanel(panelState, copy);
  }

  if (panelState.panelKey === "wheel-perks-panel") {
    return renderDockedWheelPerksPanel(panelState, copy);
  }

  return renderDockedGenericPlaceholderPanel(panelState, copy);
}

function renderDockedToolShell(options = {}) {
  const side = options.side === "left" ? "left" : "right";
  const title = options.title || "Painel";
  const subtitle = options.subtitle || "";
  const shellClassName = options.shellClassName ? ` ${options.shellClassName}` : "";
  const contentClassName = options.contentClassName ? ` ${options.contentClassName}` : "";
  const bodyMarkup = options.bodyMarkup || "";

  return `
    <div class="desktop-docked-panel-shell${shellClassName}">
      <header class="desktop-docked-tool-header desktop-docked-tool-header-${escapeHtml(side)}">
        ${side === "right" ? renderDockedPanelCloseButton(side) : ""}
        <div class="desktop-docked-tool-heading">
          <strong>${escapeHtml(title)}</strong>
          ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
        </div>
        ${side === "left" ? renderDockedPanelCloseButton(side) : ""}
      </header>
      <div class="desktop-docked-panel-content${contentClassName}">
        ${bodyMarkup}
      </div>
    </div>
  `;
}

function renderDockedToolStage(options = {}) {
  const className = options.className ? ` ${options.className}` : "";
  const toolbarMarkup = options.toolbarMarkup || "";
  const dividerMarkup = options.dividerMarkup || "";
  const bodyMarkup = options.bodyMarkup || "";

  return `
    <section class="desktop-docked-tool-stage${className}">
      ${toolbarMarkup}
      ${dividerMarkup}
      ${bodyMarkup}
    </section>
  `;
}

function renderDockedToolPlaceholderCard(title, copy, className = "") {
  const extraClassName = className ? ` ${className}` : "";

  return `
    <div class="desktop-docked-panel-empty-card desktop-docked-tool-placeholder-card${extraClassName}">
      <div class="desktop-docked-panel-empty-icon" aria-hidden="true"></div>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(copy)}</p>
    </div>
  `;
}

function renderDockedGenericPlaceholderPanel(panelState, copy) {
  return renderDockedToolShell({
    side: panelState.side,
    title: copy.title,
    bodyMarkup: renderDockedToolStage({
      bodyMarkup: renderDockedToolPlaceholderCard(copy.emptyTitle, copy.emptyCopy)
    })
  });
}

function normalizeWheelPerksSummary(value) {
  const summary = value && typeof value === "object" ? value : {};
  const sections = Array.isArray(summary.sections) ? summary.sections : [];

  return {
    sections: sections.slice(0, 4).map((section) => ({
      key: String(section?.key || "").slice(0, 40),
      title: String(section?.title || "").slice(0, 120),
      rows: (Array.isArray(section?.rows) ? section.rows : []).slice(0, 80).map((row) => ({
        label: String(row?.label || "").slice(0, 240),
        value: String(row?.value || "").slice(0, 240),
        icon: row?.icon && typeof row.icon === "object" ? {
          src: String(row.icon.src || "").slice(0, 2048),
          iconIndex: Number.isInteger(Number(row.icon.iconIndex))
            ? Math.max(0, Math.min(10000, Number(row.icon.iconIndex)))
            : null,
          frameSize: Number.isFinite(Number(row.icon.frameSize))
            ? Math.max(1, Math.min(256, Number(row.icon.frameSize)))
            : null,
          offsetX: Math.max(-4000, Math.min(0, Number(row.icon.offsetX) || 0)),
          cropped: Boolean(row.icon.cropped)
        } : null
      })).filter((row) => row.label || row.value)
    })).filter((section) => section.title)
  };
}

function handleWheelOfDestinyMessage(event) {
  const frame = document.querySelector("#wheel-of-destiny-frame");

  if (!frame || event.source !== frame.contentWindow) {
    return;
  }

  const type = String(event.data?.type || "");
  if (type !== "tibia-toolkit-wheel-summary" && type !== "tibia-toolkit-wheel-summary-open") {
    return;
  }

  state.wheelPerksSummary = normalizeWheelPerksSummary(event.data?.summary);

  if (type === "tibia-toolkit-wheel-summary-open") {
    if (isDockedWheelPerksPanelOpen()) {
      renderDockedPanel();
    } else {
      void window.screenVisionApi.tools.open("wheel-perks-panel").catch(() => null);
    }
    return;
  }

  if (isDockedWheelPerksPanelOpen()) {
    renderDockedPanel();
  }
}

function renderWheelSummaryIcon(icon) {
  if (!icon?.src) {
    return "";
  }

  return `
    <span class="docked-wheel-perk-icon" aria-hidden="true">
      <img src="${escapeHtml(icon.src)}" alt="" style="width:18px;height:18px;object-fit:contain;">
    </span>
  `;
}

function renderDockedWheelPerksPanel(panelState, copy) {
  const sections = state.wheelPerksSummary?.sections || [];
  const bodyMarkup = sections.length
    ? `<div class="docked-wheel-perks-list">
        ${sections.map((section) => `
          <section class="docked-wheel-perk-section">
            <h3>${escapeHtml(section.title)}</h3>
            <div class="docked-wheel-perk-rows">
              ${section.rows.length ? section.rows.map((row) => `
                <div class="docked-wheel-perk-row">
                  <div class="docked-wheel-perk-label">
                    ${renderWheelSummaryIcon(row.icon)}
                    <span>${escapeHtml(row.label)}</span>
                  </div>
                  <strong>${escapeHtml(row.value)}</strong>
                </div>
              `).join("") : `<p class="docked-wheel-perk-empty">${escapeHtml(t("wheel.summary.empty"))}</p>`}
            </div>
          </section>
        `).join("")}
      </div>`
    : renderDockedToolPlaceholderCard(copy.emptyTitle, copy.emptyCopy);

  return renderDockedToolShell({
    side: panelState.side,
    title: copy.title,
    contentClassName: "docked-wheel-perks-content",
    bodyMarkup: renderDockedToolStage({
      className: "docked-wheel-perks-stage",
      bodyMarkup
    })
  });
}

function renderDockedSettingsPanel(panelState, copy) {
  const settingsItems = [
    {
      label: t("screenVision.settings.discordLabel"),
      tooltip: t("screenVision.settings.discordTooltip"),
      image: SETTINGS_PANEL_ASSETS.discord,
      action: "open-settings-discord"
    },
    {
      label: t("screenVision.settings.youtubeLabel"),
      tooltip: t("screenVision.settings.youtubeTooltip"),
      image: SETTINGS_PANEL_ASSETS.youtube,
      action: "open-settings-youtube"
    },
    {
      label: t("screenVision.settings.authenticatorLabel"),
      tooltip: t("screenVision.settings.authenticatorTooltip"),
      image: SETTINGS_PANEL_ASSETS.authenticator,
      action: "open-settings-authenticator"
    },
    {
      label: t("screenVision.settings.tutorialLabel"),
      tooltip: t("screenVision.settings.tutorialTooltip"),
      image: SETTINGS_PANEL_ASSETS.tutorial,
      action: "reset-app-tutorials"
    },
    {
      label: t("screenVision.settings.websiteLabel"),
      tooltip: t("screenVision.settings.websiteTooltip"),
      image: SETTINGS_PANEL_ASSETS.website,
      action: ""
    }
  ];

  return renderDockedToolShell({
    side: panelState.side,
    title: copy.title || t("screenVision.settings.title"),
    shellClassName: "docked-settings-shell",
    contentClassName: "docked-settings-content",
    bodyMarkup: renderDockedToolStage({
      className: "docked-settings-stage",
      bodyMarkup: `
        <div class="desktop-settings-panel">
          ${settingsItems.map((entry) => `
            <section class="desktop-settings-option">
              <strong class="desktop-settings-option-label">${escapeHtml(entry.label)}</strong>
              <button
                type="button"
                class="desktop-settings-image-button"
                ${entry.action ? `data-docked-action="${escapeHtml(entry.action)}"` : ""}
                data-tooltip="${escapeHtml(entry.tooltip)}"
                aria-label="${escapeHtml(entry.tooltip)}"
              >
                <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.label)}">
              </button>
            </section>
          `).join("")}
        </div>
      `
    })
  });
}

function renderDockedSupportersPanel(panelState, copy) {
  const supporters = state.supportersIndex.length
    ? state.supportersIndex
    : buildSupporterPanelEntries([]);
  const topSupporters = supporters.slice(0, 5);
  const otherSupporters = supporters.slice(5);

  if (supporters.length <= 0) {
    return renderDockedToolShell({
      side: panelState.side,
      title: copy.title || t("screenVision.supporters.title"),
      subtitle: "",
      shellClassName: "docked-supporters-shell",
      contentClassName: "docked-supporters-content",
      bodyMarkup: renderDockedToolStage({
        className: "docked-supporters-stage",
        bodyMarkup: ""
      })
    });
  }

  return renderDockedToolShell({
    side: panelState.side,
    title: copy.title || t("screenVision.supporters.title"),
    subtitle: "",
    shellClassName: "docked-supporters-shell",
    contentClassName: "docked-supporters-content",
    bodyMarkup: renderDockedToolStage({
      className: "docked-supporters-stage",
      bodyMarkup: `
        <section class="docked-supporters-section">
          <div class="docked-supporters-section-heading">
            <strong>${escapeHtml(t("screenVision.supporters.heading"))}</strong>
            ${shouldShowCoffeeButton() ? `<span>${escapeHtml(t("screenVision.supporters.ctaPrefix"))} <button type="button" class="docked-supporters-inline-link" data-docked-action="open-supporters-coffee" aria-label="${escapeHtml(t("screenVision.supporters.openCoffee"))}">${escapeHtml(t("screenVision.supporters.ctaAction"))}</button></span>` : ""}
          </div>
          <div class="docked-profile-cards docked-supporters-cards">
            ${topSupporters.map(renderSupporterPanelCardMarkup).join("")}
          </div>
          ${otherSupporters.length > 0 ? `
            <div class="docked-profile-cards docked-supporters-cards secondary">
              ${otherSupporters.map(renderSupporterPanelCardMarkup).join("")}
            </div>
          ` : ""}
        </section>
      `
    })
  });
}

function buildSupporterPanelEntries(entries = SUPPORTER_PANEL_MOCK_SEEDS) {
  return [...entries]
    .map((entry) => {
      const totalAmountCents = resolveSupporterPanelAmountCents(entry);
      const currency = resolveSupporterPanelCurrency(entry);

      return {
        ...entry,
        name: String(entry.name || entry.characterName || "").trim(),
        vocation: String(entry.vocation || "").trim(),
        sex: String(entry.sex || "").trim(),
        level: Number.isFinite(Number(entry.level)) ? Math.max(0, Math.round(Number(entry.level))) : null,
        world: String(entry.world || "").trim(),
        guild: String(entry.guild || "").trim(),
        linkUrl: resolveSupporterLinkUrl(entry),
        linkLabel: resolveSupporterLinkLabel(entry),
        showcase: resolveSupporterShowcaseConfig(entry),
        currency,
        totalAmountCents,
        amountLabel: formatSupporterPanelAmount(totalAmountCents, currency)
      };
    })
    .filter((entry) => Boolean(entry.name))
    .sort((left, right) => right.totalAmountCents - left.totalAmountCents || String(left.name || "").localeCompare(String(right.name || "")))
    .map((entry, index) => {
      const tier = SUPPORTER_PANEL_TIER_ORDER[index] || "default";
      return {
        ...entry,
        tier,
        tierMeta: getSupporterPanelTierMeta(tier)
      };
    });
}

function resolveSupporterLinkUrl(entry = {}) {
  const linkSource = entry.link && typeof entry.link === "object"
    ? entry.link
    : {};
  const enabled = coerceSupporterShowcaseBoolean(
    linkSource.enabled ?? entry.linkEnabled,
    false
  );

  if (!enabled) {
    return "";
  }

  return normalizeExternalHttpUrl(linkSource.url ?? entry.linkUrl);
}

function resolveSupporterLinkLabel(entry = {}) {
  const linkSource = entry.link && typeof entry.link === "object"
    ? entry.link
    : {};
  return String(linkSource.label ?? entry.linkLabel ?? "").trim().slice(0, 140);
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

async function fetchSupportersDocument(url) {
  if (window.screenVisionApi?.supporters?.fetchDocument) {
    return await window.screenVisionApi.supporters.fetchDocument();
  }

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
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
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
    coffee: normalizeCoffeeConfig(document?.coffee)
  };
}

async function loadCachedSupportersDocument() {
  const stored = await window.screenVisionApi.storage.get(SUPPORTERS_STORAGE_CACHE_KEY).catch(() => ({}));
  const entry = stored?.[SUPPORTERS_STORAGE_CACHE_KEY];

  if (!entry || typeof entry !== "object") {
    return null;
  }

  return {
    updatedAt: String(entry.updatedAt || "").trim(),
    supporters: normalizeSupportersDocument(entry),
    coffee: normalizeCoffeeConfig(entry?.coffee)
  };
}

async function saveCachedSupportersDocument(document) {
  const payload = normalizeSupportersPayload(document);
  await window.screenVisionApi.storage.set({
    [SUPPORTERS_STORAGE_CACHE_KEY]: {
      updatedAt: String(document?.updatedAt || new Date().toISOString()).trim(),
      supporters: payload.supporters,
      coffee: payload.coffee
    }
  });
}

function createDefaultCoffeeConfig() {
  return {
    buttonVisible: true,
    discordUrl: COFFEE_DISCORD_URL,
    tibiaCoins: {
      enabled: true,
      characterName: "Poioso",
      world: DEFAULT_COFFEE_WORLD,
      discordUrl: COFFEE_DISCORD_URL,
      linkUrl: "",
      linkLabel: ""
    },
    pix: {
      enabled: true,
      pixCode: COFFEE_PIX_CODE,
      qrImageUrl: COFFEE_PANEL_ASSETS.pixQr,
      linkUrl: "",
      linkLabel: ""
    },
    mercadoPago: {
      enabled: true,
      heading: "",
      options: COFFEE_DONATION_OPTIONS.map((option) => ({
        ...option,
        enabled: true
      }))
    }
  };
}

function normalizeCoffeeConfig(source = {}) {
  const defaults = createDefaultCoffeeConfig();
  const sections = source?.sections && typeof source.sections === "object"
    ? source.sections
    : {};
  const tibiaCoinsSource = source?.tibiaCoins && typeof source.tibiaCoins === "object"
    ? source.tibiaCoins
    : {};
  const pixSource = source?.pix && typeof source.pix === "object"
    ? source.pix
    : {};
  const mercadoPagoSource = source?.mercadoPago && typeof source.mercadoPago === "object"
    ? source.mercadoPago
    : source?.mercadopago && typeof source.mercadopago === "object"
      ? source.mercadopago
      : {};
  const globalDiscordUrl = firstNonEmptyString([
    source?.discordUrl,
    source?.discord,
    source?.communityUrl
  ], defaults.discordUrl);

  return {
    buttonVisible: coerceCoffeeBoolean(
      source?.buttonVisible ?? source?.showButton ?? source?.enabled,
      defaults.buttonVisible
    ),
    discordUrl: globalDiscordUrl,
    tibiaCoins: {
      enabled: coerceCoffeeBoolean(
        sections.tibiaCoins ?? tibiaCoinsSource.enabled ?? source?.tibiaCoinsEnabled,
        defaults.tibiaCoins.enabled
      ),
      characterName: firstNonEmptyString([
        tibiaCoinsSource.characterName,
        tibiaCoinsSource.character,
        tibiaCoinsSource.nickname
      ], defaults.tibiaCoins.characterName),
      world: firstNonEmptyString([
        tibiaCoinsSource.world,
        tibiaCoinsSource.server
      ], defaults.tibiaCoins.world),
      discordUrl: firstNonEmptyString([
        tibiaCoinsSource.discordUrl,
        tibiaCoinsSource.discord,
        globalDiscordUrl
      ], defaults.tibiaCoins.discordUrl),
      linkUrl: firstNonEmptyString([
        tibiaCoinsSource.linkUrl,
        tibiaCoinsSource.url,
        tibiaCoinsSource.supportUrl
      ], defaults.tibiaCoins.linkUrl),
      linkLabel: firstNonEmptyString([
        tibiaCoinsSource.linkLabel,
        tibiaCoinsSource.buttonLabel
      ], defaults.tibiaCoins.linkLabel)
    },
    pix: {
      enabled: coerceCoffeeBoolean(
        sections.pix ?? pixSource.enabled ?? source?.pixEnabled,
        defaults.pix.enabled
      ),
      pixCode: firstNonEmptyString([
        pixSource.pixCode,
        pixSource.copyCode,
        pixSource.code,
        pixSource.key
      ], defaults.pix.pixCode),
      qrImageUrl: firstNonEmptyString([
        pixSource.qrImageUrl,
        pixSource.qrUrl,
        pixSource.imageUrl,
        pixSource.assetUrl
      ], defaults.pix.qrImageUrl),
      linkUrl: firstNonEmptyString([
        pixSource.linkUrl,
        pixSource.url,
        pixSource.supportUrl
      ], defaults.pix.linkUrl),
      linkLabel: firstNonEmptyString([
        pixSource.linkLabel,
        pixSource.buttonLabel
      ], defaults.pix.linkLabel)
    },
    mercadoPago: {
      enabled: coerceCoffeeBoolean(
        sections.mercadoPago ?? sections.mercadopago ?? mercadoPagoSource.enabled ?? source?.mercadoPagoEnabled,
        defaults.mercadoPago.enabled
      ),
      heading: firstNonEmptyString([
        mercadoPagoSource.heading,
        mercadoPagoSource.title
      ], defaults.mercadoPago.heading),
      options: normalizeCoffeeDonationOptions(mercadoPagoSource.options)
    }
  };
}

function normalizeCoffeeDonationOptions(options) {
  const fallbackOptions = createDefaultCoffeeConfig().mercadoPago.options;
  const sourceOptions = Array.isArray(options) && options.length > 0
    ? options
    : fallbackOptions;

  return sourceOptions.map((option, index) => {
    const fallback = fallbackOptions[index] || fallbackOptions[fallbackOptions.length - 1] || {
      value: "",
      image: "",
      url: "",
      enabled: true
    };

    return {
      value: firstNonEmptyString([
        option?.value,
        option?.label,
        option?.amount
      ], fallback.value),
      image: firstNonEmptyString([
        option?.image,
        option?.imageName,
        option?.imageFile
      ], fallback.image),
      url: firstNonEmptyString([
        option?.url,
        option?.linkUrl,
        option?.href
      ], fallback.url),
      enabled: coerceCoffeeBoolean(option?.enabled, true)
    };
  });
}

function firstNonEmptyString(values, fallback = "") {
  const match = (Array.isArray(values) ? values : [])
    .find((value) => typeof value === "string" && value.trim());
  return match ? String(match).trim() : String(fallback || "").trim();
}

function coerceCoffeeBoolean(value, fallback = false) {
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

function getVisibleCoffeeDonationOptions(config = state.coffeeConfig) {
  return Array.isArray(config?.mercadoPago?.options)
    ? config.mercadoPago.options.filter((option) => option?.enabled !== false && String(option?.url || "").trim())
    : [];
}

function hasVisibleCoffeeMethods(config = state.coffeeConfig) {
  return Boolean(
    config?.tibiaCoins?.enabled
    || config?.pix?.enabled
    || (config?.mercadoPago?.enabled && getVisibleCoffeeDonationOptions(config).length > 0)
  );
}

function shouldShowCoffeeButton(config = state.coffeeConfig) {
  return Boolean(config?.buttonVisible && hasVisibleCoffeeMethods(config));
}

function getSupporterPanelTierMeta(tier) {
  const meta = SUPPORTER_PANEL_TIER_META[tier] || SUPPORTER_PANEL_TIER_META.default;
  return {
    ...meta,
    label: t(meta.labelKey)
  };
}

function resolveSupporterPanelAmountCents(entry = {}) {
  if (Number.isFinite(Number(entry.amountTotalCents))) {
    return Math.max(0, Math.round(Number(entry.amountTotalCents)));
  }

  if (Number.isFinite(Number(entry.totalAmountCents))) {
    return Math.max(0, Math.round(Number(entry.totalAmountCents)));
  }

  if (Number.isFinite(Number(entry.amountCents))) {
    return Math.max(0, Math.round(Number(entry.amountCents)));
  }

  const parsedTotalAmount = parseSupporterPanelAmountToCents(entry.totalAmount);
  if (parsedTotalAmount !== null) {
    return parsedTotalAmount;
  }

  const parsedAmount = parseSupporterPanelAmountToCents(entry.amount);
  if (parsedAmount !== null) {
    return parsedAmount;
  }

  if (Array.isArray(entry.donations)) {
    return entry.donations.reduce((total, donation) => {
      if (Number.isFinite(Number(donation?.amountCents))) {
        return total + Math.max(0, Math.round(Number(donation.amountCents)));
      }

      const parsedDonationAmount = parseSupporterPanelAmountToCents(donation?.amount);
      if (parsedDonationAmount !== null) {
        return total + parsedDonationAmount;
      }

      return total;
    }, 0);
  }

  return 0;
}

function parseSupporterPanelAmountToCents(value) {
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

function resolveSupporterPanelCurrency(entry = {}) {
  const directCurrency = [
    entry.currency,
    entry.currencyLabel,
    entry.currencySymbol,
    entry.unit,
    entry.amountCurrency
  ].find((value) => String(value || "").trim());

  if (directCurrency) {
    return String(directCurrency).trim();
  }

  if (Array.isArray(entry.donations)) {
    const donationCurrency = entry.donations
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

function renderSupporterPanelCardMarkup(supporter = {}) {
  const tierMeta = getSupporterPanelTierMeta(supporter.tier || "default");
  const subtitle = buildSupporterPanelSubtitle(supporter);
  const highlightedSubtitle = buildHighlightedSupporterPanelSubtitle(supporter);
  const avatarPath = getVocationOutfitPath(supporter.vocation, supporter.sex) || PROFILE_PANEL_ASSETS.noVocation;
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
      ${isHighlighted ? `
        <span class="docked-supporter-card-border-line top" aria-hidden="true"></span>
        <span class="docked-supporter-card-border-line right" aria-hidden="true"></span>
        <span class="docked-supporter-card-border-line bottom" aria-hidden="true"></span>
        <span class="docked-supporter-card-border-line left" aria-hidden="true"></span>
      ` : ""}
      ${showcaseMarkup}
      <div class="docked-profile-card-main docked-supporter-card-main">
        ${isHighlighted ? `
          <div class="docked-supporter-card-layout">
            <div class="docked-supporter-amount-wrap">
              <strong class="docked-supporter-amount">${escapeHtml(supporter.amountLabel || formatSupporterPanelAmount(supporter.totalAmountCents, supporter.currency))}</strong>
              <strong class="docked-supporter-name">${escapeHtml(supporter.name || "-")}</strong>
            </div>
            <div class="docked-supporter-identity">
              <div class="docked-profile-avatar-button docked-supporter-avatar" aria-hidden="true">
                <img src="${escapeHtml(avatarPath)}" alt="${escapeHtml(supporter.vocation || "Vocacao")}">
              </div>
              <span class="docked-supporter-card-subtitle">${escapeHtml(highlightedSubtitle)}</span>
            </div>
          </div>
        ` : `
          <div class="docked-profile-card-title-row docked-supporter-card-title-row">
            <div class="docked-profile-avatar-button docked-supporter-avatar" aria-hidden="true">
              <img src="${escapeHtml(avatarPath)}" alt="${escapeHtml(supporter.vocation || "Vocacao")}">
            </div>
            <div class="docked-profile-card-center docked-supporter-card-center">
              <strong>${escapeHtml(supporter.name || "-")}</strong>
              <span class="docked-supporter-card-subtitle">${escapeHtml(subtitle)}</span>
            </div>
            <div class="docked-profile-card-meta docked-supporter-card-meta">
              <strong class="docked-supporter-amount">${escapeHtml(supporter.amountLabel || formatSupporterPanelAmount(supporter.totalAmountCents, supporter.currency))}</strong>
              <img class="docked-supporter-medal" src="${escapeHtml(tierMeta.medalPath)}" alt="${escapeHtml(tierMeta.label)}">
            </div>
          </div>
        `}
      </div>
    </article>
  `;
}

function buildSupporterPanelSubtitle(supporter = {}) {
  const parts = [];

  if (Number.isFinite(Number(supporter.level)) && Number(supporter.level) > 0) {
    parts.push(`${t("tools.level")} ${formatSupporterPanelNumber(supporter.level)}`);
  }

  if (supporter.world) {
    parts.push(String(supporter.world));
  }

  if (supporter.guild) {
    parts.push(String(supporter.guild));
  }

  return parts.join(" - ") || t("screenVision.supporters.emptyHighlight");
}

function buildHighlightedSupporterPanelSubtitle(supporter = {}) {
  const parts = [];

  if (Number.isFinite(Number(supporter.level)) && Number(supporter.level) > 0) {
    parts.push(`${t("tools.level")} ${formatSupporterPanelNumber(supporter.level)}`);
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

async function handleDockedSupportersPanelClick(event) {
  const linkCard = event.target.closest("[data-supporter-link-url]");

  if (linkCard) {
    event.preventDefault();
    event.stopPropagation();
    await openSupporterExternalUrl(linkCard);
    return;
  }

  const button = event.target.closest("[data-docked-action]");

  if (!button) {
    return;
  }

  hideFloatingTooltip();
  const action = button.dataset.dockedAction || "";

  if (action === "close-panel") {
    await window.screenVisionApi.tools.open("supporters-panel").catch(() => null);
    return;
  }

  if (action === "open-supporters-coffee") {
    if (!shouldShowCoffeeButton()) {
      return;
    }
    await window.screenVisionApi.tools.open("buy-me-a-coffee-panel").catch(() => null);
  }
}

async function openSupporterExternalUrl(card) {
  const url = normalizeExternalHttpUrl(card?.dataset?.supporterLinkUrl);
  if (!url) {
    return false;
  }

  card.dataset.supporterLinkStatus = "opening";
  const openExternal = window.desktopApi?.links?.openExternal;

  try {
    if (typeof openExternal === "function") {
      await openExternal(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }

    card.dataset.supporterLinkStatus = "opened";
    return true;
  } catch (error) {
    card.dataset.supporterLinkStatus = "error";
    console.error("[supporter-link] Nao foi possivel abrir o link externo.", error);
    return false;
  }
}

async function handleDockedSettingsPanelClick(event) {
  const button = event.target.closest("[data-docked-action]");

  if (!button) {
    return;
  }

  hideFloatingTooltip();
  const action = button.dataset.dockedAction || "";

  if (action === "close-panel") {
    await window.screenVisionApi.tools.open("settings-panel").catch(() => null);
    return;
  }

  if (action === "open-settings-discord") {
    await openCoffeeExternalUrl(SETTINGS_PANEL_DISCORD_URL);
    return;
  }

  if (action === "open-settings-youtube") {
    await openCoffeeExternalUrl(SETTINGS_PANEL_YOUTUBE_URL);
    return;
  }

  if (action === "open-settings-authenticator") {
    await window.screenVisionApi.tools.open("authenticator-panel").catch(() => null);
    return;
  }

  if (action === "reset-app-tutorials") {
    const result = await window.screenVisionApi.dialogs.confirm({
      title: t("screenVision.settings.resetTutorialTitle"),
      message: t("screenVision.settings.resetTutorialMessage"),
      confirmLabel: t("screenVision.settings.resetTutorialConfirm"),
      cancelLabel: t("common.cancel"),
      tone: "success",
      mediaPath: "assets/ui/tutorial/inicio.gif",
      flat: true
    }).catch(() => null);
    if (result?.confirmed) {
      await window.screenVisionApi.tutorial.resetAll().catch(() => null);
    }
  }
}

function formatSupporterPanelAmount(amountCents, currency = "R$") {
  const safeAmountCents = Number.isFinite(Number(amountCents)) ? Math.max(0, Math.round(Number(amountCents))) : 0;
  const minimumFractionDigits = safeAmountCents % 100 === 0 ? 0 : 2;
  const numberLabel = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits,
    maximumFractionDigits: 2
  }).format(safeAmountCents / 100);
  const currencyLabel = String(currency || "").trim();
  return currencyLabel ? `${currencyLabel} ${numberLabel}` : numberLabel;
}

function formatSupporterPanelNumber(value) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function renderDockedSqmFinderPanel(panelState, copy) {
  const visual = state.visualCustomization || normalizeDockedVisualState(null);
  const sqmActive = Boolean(visual.charLocEnabled);
  const cursorActive = Boolean(visual.cursorGlowEnabled);
  const markerTooltip = sqmActive
    ? t("screenVision.sqm.toggleMarkerOff")
    : t("screenVision.sqm.toggleMarkerOn");
  const cursorTooltip = cursorActive
    ? t("screenVision.sqm.toggleCursorOff")
    : t("screenVision.sqm.toggleCursorOn");

  return renderDockedToolShell({
    side: panelState.side,
    title: copy.title || "SQM Finder",
    subtitle: "tibia mirror",
    shellClassName: "docked-sqm-shell",
    contentClassName: "docked-sqm-content",
    bodyMarkup: renderDockedToolStage({
      className: "docked-sqm-stage",
      toolbarMarkup: `
        <div class="desktop-docked-tool-toolbar docked-sqm-toolbar">
          <div class="desktop-docked-tool-toolbar-left">
            <button
              type="button"
              class="docked-alert-tile${sqmActive ? " active" : " inactive"}"
              data-docked-action="sqm-toggle-marker"
              data-tooltip="${escapeHtml(markerTooltip)}"
              aria-label="${escapeHtml(markerTooltip)}"
            >
              <img src="${escapeHtml(SQM_FINDER_ASSETS.sqm)}" alt="">
            </button>
            <button
              type="button"
              class="docked-alert-tile${cursorActive ? " active" : " inactive"}"
              data-docked-action="sqm-toggle-cursor-glow"
              data-tooltip="${escapeHtml(cursorTooltip)}"
              aria-label="${escapeHtml(cursorTooltip)}"
            >
              <img src="${escapeHtml(SQM_FINDER_ASSETS.cursorGlow)}" alt="">
            </button>
          </div>
        </div>
      `,
      dividerMarkup: `<div class="desktop-docked-tool-divider" aria-hidden="true"></div>`,
      bodyMarkup: `
        <div class="docked-sqm-cards">
          ${renderDockedSqmMarkerCard(visual)}
          ${renderDockedCursorGlowCard(visual)}
        </div>
      `
    })
  });
}

function renderDockedSqmMarkerCard(visual) {
  const shape = normalizeSqmShape(visual.charLocShape);
  const expanded = state.sqmExpandedEditor === "marker";
  const shapeLabel =
    shape === "Arrow"
      ? t("screenVision.sqm.shape.arrow")
      : shape === "Square"
        ? t("screenVision.sqm.shape.square")
        : t("screenVision.sqm.shape.circle");
  const shapeTooltip = t("screenVision.sqm.currentShape", { shape: shapeLabel });
  const markerLockTooltip = visual.charLocLocked
    ? t("screenVision.sqm.unlockMarker")
    : t("screenVision.sqm.lockMarker");
  const pulseTooltip = visual.charLocPulse
    ? t("screenVision.sqm.disablePulse")
    : t("screenVision.sqm.enablePulse");
  const editorTooltip = expanded
    ? t("screenVision.sqm.closeMarkerEditor")
    : t("screenVision.sqm.editMarker");

  return `
    <article class="docked-alert-card docked-sqm-card${expanded ? " expanded" : ""}" data-sqm-card="marker">
      <div class="docked-alert-card-main">
        <div class="docked-alert-card-title-row">
          <strong>SQM Finder</strong>
        </div>
        <div class="docked-alert-card-control-row">
          <div class="docked-alert-card-actions">
            <button type="button" class="docked-alert-icon-button active" data-docked-action="sqm-cycle-shape" data-tooltip="${escapeHtml(shapeTooltip)}" aria-label="${escapeHtml(t("screenVision.sqm.cycleShape"))}">${renderSqmShapeIcon(shape)}</button>
            <button type="button" class="docked-alert-icon-button${visual.charLocLocked ? " active" : " inactive"}" data-docked-action="sqm-toggle-marker-lock" data-tooltip="${escapeHtml(markerLockTooltip)}" aria-label="${escapeHtml(t("screenVision.sqm.markerLock"))}">${renderIcon(visual.charLocLocked ? "lock-closed" : "lock-open")}</button>
            <button type="button" class="docked-alert-icon-button${visual.charLocPulse ? " active" : " inactive"}" data-docked-action="sqm-toggle-pulse" data-tooltip="${escapeHtml(pulseTooltip)}" aria-label="${escapeHtml(t("screenVision.sqm.pulse"))}">${renderIcon("sparkle")}</button>
            <button type="button" class="docked-alert-icon-button${expanded ? " active" : ""}" data-docked-action="sqm-toggle-marker-editor" data-tooltip="${escapeHtml(editorTooltip)}" aria-label="${escapeHtml(t("screenVision.sqm.editMarkerAria"))}">${renderIcon("edit")}</button>
          </div>
        </div>
      </div>
      ${expanded ? renderDockedSqmMarkerEditor(visual) : ""}
    </article>
  `;
}

function renderDockedCursorGlowCard(visual) {
  const expanded = state.sqmExpandedEditor === "cursor";
  const editorTooltip = expanded
    ? t("screenVision.sqm.closeCursorEditor")
    : t("screenVision.sqm.editCursor");

  return `
    <article class="docked-alert-card docked-sqm-card${expanded ? " expanded" : ""}" data-sqm-card="cursor">
      <div class="docked-alert-card-main">
        <div class="docked-alert-card-title-row">
          <strong>${escapeHtml(t("screenVision.sqm.cursorTitle"))}</strong>
        </div>
        <div class="docked-alert-card-control-row">
          <div class="docked-alert-card-actions">
            <button type="button" class="docked-alert-icon-button${expanded ? " active" : ""}" data-docked-action="sqm-toggle-cursor-editor" data-tooltip="${escapeHtml(editorTooltip)}" aria-label="${escapeHtml(t("screenVision.sqm.editCursorAria"))}">${renderIcon("edit")}</button>
          </div>
        </div>
      </div>
      ${expanded ? renderDockedCursorGlowEditor(visual) : ""}
    </article>
  `;
}

function renderDockedSqmMarkerEditor(visual) {
  return `
    <div class="docked-alert-extension docked-sqm-extension">
      ${renderDockedSqmSliderRow("Tamanho:", "charLocSize", visual.charLocSize, 20, 160)}
      <div class="docked-alert-grid-row docked-sqm-grid-row">
        <label>Intensidade:</label>
        <select data-docked-field="sqm-charLocIntensity" data-tooltip="${escapeHtml(t("screenVision.sqm.intensityTooltip"))}">
          ${SQM_INTENSITY_OPTIONS.map((option) => `<option value="${option.value}" ${Number(visual.charLocIntensity) === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </div>
      ${renderDockedSqmColorRow("Cor:", "charLocColor", visual.charLocColor, visual.charLocSavedColors)}
    </div>
  `;
}

function renderDockedCursorGlowEditor(visual) {
  return `
    <div class="docked-alert-extension docked-sqm-extension">
      ${renderDockedSqmSliderRow("Tamanho:", "cursorGlowSize", visual.cursorGlowSize, 20, 160)}
      ${renderDockedSqmColorRow("Cor:", "cursorGlowColor", visual.cursorGlowColor, visual.cursorGlowSavedColors)}
    </div>
  `;
}

function renderDockedSqmSliderRow(label, field, value, min, max) {
  const numeric = clampInteger(value, min, max, min);
  const tooltip = t("screenVision.sqm.adjustField", {
    field: t("screenVision.sqm.field.size")
  });
  return `
    <div class="docked-alert-grid-row docked-sqm-grid-row docked-sqm-slider-row">
      <label>${escapeHtml(label)}</label>
      <input type="range" min="${min}" max="${max}" step="1" value="${escapeHtml(String(numeric))}" style="--alert-volume-percent:${escapeHtml(String(((numeric - min) / (max - min)) * 100))}%;" data-docked-field="sqm-${escapeHtml(field)}" data-tooltip="${escapeHtml(tooltip)}">
      <input type="number" min="${min}" max="${max}" step="1" value="${escapeHtml(String(numeric))}" data-docked-field="sqm-${escapeHtml(field)}" data-tooltip="${escapeHtml(tooltip)}">
    </div>
  `;
}

function renderDockedSqmColorRow(label, field, selectedColor, savedColors) {
  const selected = normalizeSqmAccentColor(selectedColor);
  const colors = normalizeSqmSavedColors(savedColors);
  return `
    <div class="docked-alert-grid-row docked-sqm-grid-row docked-sqm-color-row">
      <label>${escapeHtml(label)}</label>
      <div class="docked-alert-color-picker docked-sqm-color-picker">
        <div class="docked-alert-color-picker-shell">
          <div class="docked-alert-color-picker-footer">
            <label class="docked-alert-color-picker-native" data-tooltip="${escapeHtml(t("screenVision.sqm.openColorPicker"))}">
              <input type="color" value="${escapeHtml(selected)}" data-docked-field="sqm-${escapeHtml(field)}">
              ${renderIcon("palette")}
            </label>
            <input type="text" value="${escapeHtml(selected.toUpperCase())}" maxlength="7" data-docked-field="sqm-${escapeHtml(field)}">
            <button type="button" class="docked-alert-icon-button small" data-docked-action="sqm-save-color" data-sqm-color-field="${escapeHtml(field)}" data-tooltip="${escapeHtml(t("screenVision.sqm.saveColor"))}" aria-label="${escapeHtml(t("screenVision.sqm.saveColorAria"))}">${renderIcon("save")}</button>
            <button type="button" class="docked-alert-icon-button small danger" data-docked-action="sqm-delete-color" data-sqm-color-field="${escapeHtml(field)}" data-tooltip="${escapeHtml(t("screenVision.sqm.deleteColor"))}" aria-label="${escapeHtml(t("screenVision.sqm.deleteColorAria"))}">${renderIcon("trash")}</button>
          </div>
          <div class="docked-alert-color-picker-divider" aria-hidden="true"></div>
          <div class="docked-alert-color-swatches">
            ${colors.map((color) => `
              <button
                type="button"
                class="docked-alert-color-swatch${selected === color ? " active" : ""}${color === "#ffffff" ? " is-white" : ""}"
                style="background:${escapeHtml(color)}"
                data-docked-action="sqm-set-color"
                data-sqm-color-field="${escapeHtml(field)}"
                data-sqm-color="${escapeHtml(color)}"
                data-tooltip="${escapeHtml(color.toUpperCase())}"
                aria-label="${escapeHtml(t("screenVision.sqm.useColor", { color: color.toUpperCase() }))}"
              ></button>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSqmShapeIcon(shape) {
  if (shape === "Arrow") {
    return '<span class="docked-sqm-shape-icon docked-sqm-shape-arrow" aria-hidden="true"></span>';
  }
  if (shape === "Square") {
    return '<span class="docked-sqm-shape-icon docked-sqm-shape-square" aria-hidden="true"></span>';
  }
  return '<span class="docked-sqm-shape-icon docked-sqm-shape-circle" aria-hidden="true"></span>';
}

function renderDockedTibiaCoinsPanel(panelState, copy) {
  const quantity = normalizeTibiaCoinsQuantity(state.tibiaCoinsQuantity);
  const summary = state.tibiaCoinsCharacterSummary;
  const characterName = state.tibiaCoinsCharacterName || "";
  const characterLookupState = state.tibiaCoinsCharacterLookupState || "idle";
  const outfit = getTibiaCoinsCharacterAvatar(summary, characterName, characterLookupState);
  const tierIcon = getTibiaCoinsTierIcon(quantity);
  const progress = getTibiaCoinsQuantityProgress(quantity);
  const canConfirm = isTibiaCoinsCharacterValid();
  state.tibiaCoinsPrice = calculateTibiaCoinsPrice(quantity);
  state.tibiaCoinsPriceLoading = false;
  state.tibiaCoinsPriceError = false;

  return renderDockedToolShell({
    side: panelState.side,
    title: copy.title || t("screenVision.tibiaCoins.title"),
    subtitle: t("screenVision.tibiaCoins.subtitle"),
    shellClassName: "docked-tibia-coins-shell",
    contentClassName: "docked-tibia-coins-content",
    bodyMarkup: renderDockedToolStage({
      className: "docked-tibia-coins-stage",
      bodyMarkup: `
        <article class="docked-alert-card docked-tibia-coins-card">
          <div class="docked-tibia-coins-character-row">
            <div class="docked-tibia-coins-avatar">
              <img src="${escapeHtml(outfit)}" alt="">
            </div>
            <div class="docked-tibia-coins-character-fields">
              <label class="docked-tibia-coins-field">
                <input type="text" value="${escapeHtml(characterName)}" placeholder="${escapeHtml(t("screenVision.tibiaCoins.characterPlaceholder"))}" data-docked-field="tibiaCoinsCharacterName">
              </label>
              <div class="docked-tibia-coins-character-summary">
                ${renderTibiaCoinsCharacterSummaryMarkup()}
              </div>
            </div>
          </div>

          <div class="desktop-docked-tool-divider" aria-hidden="true"></div>

          <div class="docked-tibia-coins-quantity-block">
            <div class="docked-tibia-coins-quantity-heading">
              <img src="${escapeHtml(tierIcon)}" alt="">
              <div>
                <strong>${escapeHtml(String(quantity))} Tibia Coins</strong>
                <span class="docked-tibia-coins-price-status">${getTibiaCoinsPriceStatusMarkup()}</span>
              </div>
            </div>
            <div class="docked-alert-volume-row docked-alert-master-volume docked-tibia-coins-quantity-row">
              <input type="range" min="${TIBIA_COINS_QUANTITY_MIN}" max="${TIBIA_COINS_QUANTITY_MAX}" step="${TIBIA_COINS_QUANTITY_STEP}" value="${escapeHtml(String(quantity))}" style="--alert-volume-percent:${escapeHtml(String(progress))}%;" data-docked-field="tibiaCoinsQuantity">
              <input type="number" min="${TIBIA_COINS_QUANTITY_MIN}" max="${TIBIA_COINS_QUANTITY_MAX}" step="${TIBIA_COINS_QUANTITY_STEP}" value="${escapeHtml(String(quantity))}" data-docked-field="tibiaCoinsQuantity">
            </div>
          </div>

          <div class="docked-tibia-coins-packages">
            ${TIBIA_COINS_PACKAGES.map((packageQuantity) => renderTibiaCoinsPackageButton(packageQuantity, quantity)).join("")}
          </div>

          <button type="button" class="docked-tibia-coins-confirm desktop-window-image-button${canConfirm ? "" : " disabled"}" data-docked-action="confirm-tibia-coins" data-tooltip="${escapeHtml(canConfirm ? t("screenVision.tibiaCoins.buyNow") : t("screenVision.tibiaCoins.invalidCharacter"))}" aria-label="${escapeHtml(t("screenVision.tibiaCoins.buyAria"))}"${canConfirm ? "" : " disabled"}>
            <span class="desktop-window-icon-stack" aria-hidden="true">
              <img class="desktop-window-icon desktop-window-icon-idle" src="assets/ui/Tick.png" alt="">
              <img class="desktop-window-icon desktop-window-icon-active" src="assets/ui/Tick.png" alt="">
            </span>
          </button>
        </article>

        <div class="docked-tibia-coins-partner-logos">
          <button type="button" class="docked-tibia-coins-brand-link" data-docked-action="open-tibia-coins-brand" data-tooltip="${escapeHtml(t("screenVision.tibiaCoins.openPartner"))}" aria-label="${escapeHtml(t("screenVision.tibiaCoins.openPartner"))}">
            <img class="docked-tibia-coins-brand-logo" src="${escapeHtml(TIBIA_COINS_PANEL_ASSETS.brandLogo)}" alt="Daniel Hatano">
          </button>
          <img class="docked-tibia-coins-reseller-logo" src="${escapeHtml(TIBIA_COINS_PANEL_ASSETS.resellerLogo)}" alt="${escapeHtml(t("screenVision.tibiaCoins.cipsoftReseller"))}">
        </div>
      `
    })
  });
}

function renderDockedCoffeePanel(panelState, copy) {
  return renderDockedToolShell({
    side: panelState.side,
    title: copy.title || t("screenVision.coffee.title"),
    subtitle: "",
    shellClassName: "docked-coffee-shell",
    contentClassName: "docked-coffee-content",
    bodyMarkup: renderDockedToolStage({
      className: "docked-coffee-stage",
      bodyMarkup: state.coffeeThankYouVisible
        ? renderDockedCoffeeThankYou()
        : renderDockedCoffeeSupportOptions()
    })
  });
}

function renderDockedCoffeeSupportOptions() {
  const coffeeConfig = state.coffeeConfig || createDefaultCoffeeConfig();
  const tibiaCoinsConfig = coffeeConfig.tibiaCoins || createDefaultCoffeeConfig().tibiaCoins;
  const pixConfig = coffeeConfig.pix || createDefaultCoffeeConfig().pix;
  const mercadoPagoConfig = coffeeConfig.mercadoPago || createDefaultCoffeeConfig().mercadoPago;
  const visibleDonationOptions = getVisibleCoffeeDonationOptions(coffeeConfig);
  const pixIcon = state.coffeePixCopied ? COFFEE_PANEL_ASSETS.tick : COFFEE_PANEL_ASSETS.pix;
  const pixTooltip = state.coffeePixCopied ? t("screenVision.coffee.pixCopied") : t("screenVision.coffee.copyPix");
  const characterName = String(tibiaCoinsConfig.characterName || "Poioso").trim() || "Poioso";
  const characterButton = `<button type="button" class="docked-coffee-character-copy imbuement-copy-button" data-docked-action="copy-coffee-character" data-coffee-character="${escapeHtml(characterName)}" data-tooltip="${escapeHtml(t("screenVision.coffee.copyCharacterName"))}" aria-label="${escapeHtml(t("screenVision.coffee.copyCharacterName"))}"><strong>${escapeHtml(characterName)}</strong><span class="copy-sprite-stack" aria-hidden="true"><img class="copy-sprite-icon copy-sprite-icon-off" src="assets/ui/copy/copiar-off.png" alt=""><img class="copy-sprite-icon copy-sprite-icon-hover" src="assets/ui/copy/copiar-hover.png" alt=""><img class="copy-sprite-icon copy-sprite-icon-on" src="assets/ui/copy/copiar-on.png" alt=""></span></button>`;
  const supportMethodsMarkup = getCoffeeSupportMethodsMarkup(coffeeConfig);
  const sections = [];

  if (tibiaCoinsConfig.enabled) {
    sections.push(`
      <section class="docked-coffee-method">
        <div class="docked-coffee-method-heading">
          <img src="${escapeHtml(COFFEE_PANEL_ASSETS.coin)}" alt="">
          <strong>Tibia Coins</strong>
        </div>
        <p>${t("screenVision.coffee.coinInstruction", { characterButton, world: `<strong>${escapeHtml(tibiaCoinsConfig.world || DEFAULT_COFFEE_WORLD)}</strong>` })}</p>
        <p>${escapeHtml(t("screenVision.coffee.discordProof"))}</p>
        ${[
          tibiaCoinsConfig.discordUrl ? renderCoffeeActionButton({
            label: t("screenVision.coffee.joinDiscord"),
            url: tibiaCoinsConfig.discordUrl,
            iconPath: COFFEE_PANEL_ASSETS.discord
          }) : "",
          tibiaCoinsConfig.linkUrl ? renderCoffeeActionButton({
            label: tibiaCoinsConfig.linkLabel || t("screenVision.coffee.openLink"),
            url: tibiaCoinsConfig.linkUrl,
            iconPath: COFFEE_PANEL_ASSETS.coin
          }) : ""
        ].filter(Boolean).join("")}
      </section>
    `);
  }

  if (pixConfig.enabled) {
    const pixActionButtons = [
      String(pixConfig.qrImageUrl || "").trim() ? `
        <button type="button" class="desktop-window-image-button docked-coffee-icon-button${state.coffeePixQrVisible ? " active" : ""}" data-docked-action="toggle-coffee-pix-qr" data-tooltip="${escapeHtml(t("screenVision.coffee.generateQr"))}" aria-label="${escapeHtml(t("screenVision.coffee.generateQr"))}">
          <span class="desktop-window-icon-stack" aria-hidden="true">
            <img class="desktop-window-icon desktop-window-icon-idle" src="${escapeHtml(COFFEE_PANEL_ASSETS.qr)}" alt="">
            <img class="desktop-window-icon desktop-window-icon-active" src="${escapeHtml(COFFEE_PANEL_ASSETS.qr)}" alt="">
          </span>
        </button>
      ` : "",
      String(pixConfig.pixCode || "").trim() ? `
        <button type="button" class="desktop-window-image-button docked-coffee-icon-button${state.coffeePixCopied ? " copied" : ""}" data-docked-action="copy-coffee-pix" data-tooltip="${escapeHtml(pixTooltip)}" aria-label="${escapeHtml(pixTooltip)}">
          <span class="desktop-window-icon-stack" aria-hidden="true">
            <img class="desktop-window-icon desktop-window-icon-idle" src="${escapeHtml(pixIcon)}" alt="">
            <img class="desktop-window-icon desktop-window-icon-active" src="${escapeHtml(pixIcon)}" alt="">
          </span>
        </button>
      ` : ""
    ].filter(Boolean).join("");

    sections.push(`
      <section class="docked-coffee-method">
        <div class="docked-coffee-method-heading">
          <img src="${escapeHtml(COFFEE_PANEL_ASSETS.pix)}" alt="">
          <strong>PIX</strong>
        </div>
        <p>${escapeHtml(t("screenVision.coffee.pixPrompt"))}</p>
        ${pixActionButtons ? `<div class="docked-coffee-pix-actions">${pixActionButtons}</div>` : ""}
        ${state.coffeePixQrVisible && String(pixConfig.qrImageUrl || "").trim() ? `
          <div class="docked-coffee-pix-qr">
            <img src="${escapeHtml(pixConfig.qrImageUrl)}" alt="${escapeHtml(t("screenVision.coffee.pixQrAlt"))}">
          </div>
        ` : ""}
        ${pixConfig.linkUrl ? renderCoffeeActionButton({
          label: pixConfig.linkLabel || t("screenVision.coffee.openLink"),
          url: pixConfig.linkUrl,
          iconPath: COFFEE_PANEL_ASSETS.pix
        }) : ""}
      </section>
    `);
  }

  if (mercadoPagoConfig.enabled && visibleDonationOptions.length > 0) {
    sections.push(`
      <section class="docked-coffee-method">
        <div class="docked-coffee-method-heading docked-coffee-method-heading-text">
          <strong>${escapeHtml(mercadoPagoConfig.heading || t("screenVision.coffee.marketHeading"))}</strong>
        </div>
        <div class="docked-tibia-coins-packages docked-coffee-donation-grid">
          ${visibleDonationOptions.map(renderCoffeeDonationButton).join("")}
        </div>
      </section>
    `);
  }

  return `
    <article class="docked-alert-card docked-coffee-card">
      <img class="docked-coffee-hero" src="${escapeHtml(COFFEE_PANEL_ASSETS.hero)}" alt="">

      <div class="docked-coffee-copy">
        <p>${escapeHtml(t("screenVision.coffee.thanks"))}</p>
        <p>${escapeHtml(t("screenVision.coffee.alwaysFree")).replace("Always Free", `<strong class="docked-coffee-highlight">Always Free</strong>`)}</p>
        ${supportMethodsMarkup}
        <p class="docked-coffee-supporter-note">${escapeHtml(t("screenVision.coffee.supporterNote"))}</p>
      </div>

      ${sections.length > 0 ? `
        <div class="desktop-docked-tool-divider" aria-hidden="true"></div>
        ${sections.join('<div class="desktop-docked-tool-divider" aria-hidden="true"></div>')}
      ` : ""}
    </article>
  `;
}

function getCoffeeSupportMethodsMarkup(config = state.coffeeConfig) {
  const methods = [];

  if (config?.tibiaCoins?.enabled) {
    methods.push(`<span class="docked-coffee-inline-method"><img src="${escapeHtml(COFFEE_PANEL_ASSETS.coin)}" alt=""> Tibia Coins</span>`);
  }

  if (config?.pix?.enabled) {
    methods.push(`<span class="docked-coffee-inline-method"><img src="${escapeHtml(COFFEE_PANEL_ASSETS.pix)}" alt=""> PIX</span>`);
  }

  if (config?.mercadoPago?.enabled && getVisibleCoffeeDonationOptions(config).length > 0) {
    methods.push(`<span class="docked-coffee-inline-method"><img src="${escapeHtml(COFFEE_PANEL_ASSETS.mercadoPago)}" alt=""> Mercado Pago</span>`);
  }

  if (methods.length <= 0) {
    return `<p>${escapeHtml(t("screenVision.coffee.noMethods"))}</p>`;
  }

  return `<p>${t("screenVision.coffee.supportMethodsAvailable", {
    methods: methods.join(" ")
  })}</p>`;
}

function renderCoffeeDonationButton(option) {
  const image = `assets/ui/tools/tibia-eye/buy-me-a-coffee/${option.image}`;
  const label = t("screenVision.coffee.donateValue", { value: option.value });

  return `
    <button type="button" class="docked-tibia-coins-package docked-coffee-donation-card" data-docked-action="open-coffee-donation" data-coffee-url="${escapeHtml(option.url)}" data-tooltip="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
      <img src="${escapeHtml(image)}" alt="">
      <strong>${escapeHtml(label)}</strong>
      <span>Mercado Pago</span>
    </button>
  `;
}

function renderDockedCoffeeThankYou() {
  const receiptUrl = firstNonEmptyString([
    state.coffeeConfig?.discordUrl,
    state.coffeeConfig?.tibiaCoins?.discordUrl
  ], COFFEE_DISCORD_URL);

  return `
    <article class="docked-alert-card docked-coffee-card docked-coffee-thank-you">
      <img class="docked-coffee-hero" src="${escapeHtml(COFFEE_PANEL_ASSETS.thankYou)}" alt="">
      <strong class="docked-coffee-thank-you-title">${escapeHtml(t("screenVision.coffee.thankYouTitle"))}</strong>
      <p>${escapeHtml(t("screenVision.coffee.thankYouCopy")).replace("Discord", "<strong>Discord</strong>")}</p>
      ${renderCoffeeActionButton({
        label: t("screenVision.coffee.discordReceipt"),
        url: receiptUrl,
        iconPath: COFFEE_PANEL_ASSETS.discord
      })}
    </article>
  `;
}

function renderCoffeeActionButton({ label, url, iconPath }) {
  if (!String(url || "").trim()) {
    return "";
  }

  return `
    <button type="button" class="docked-coffee-discord-button" data-docked-action="open-coffee-external" data-coffee-url="${escapeHtml(url)}" data-tooltip="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
      <img src="${escapeHtml(iconPath || COFFEE_PANEL_ASSETS.discord)}" alt="">
      <strong>${escapeHtml(label)}</strong>
    </button>
  `;
}

function getTibiaCoinsTierIcon(quantity) {
  const normalized = normalizeTibiaCoinsQuantity(quantity);
  const tier = TIBIA_COINS_PANEL_ASSETS.tiers.find((entry) => normalized <= entry.max) || TIBIA_COINS_PANEL_ASSETS.tiers[TIBIA_COINS_PANEL_ASSETS.tiers.length - 1];
  return tier.icon;
}

function getTibiaCoinsCharacterAvatar(summary, characterName, lookupState) {
  if (!String(characterName || "").trim() || lookupState === "pending") {
    return TIBIA_COINS_PANEL_ASSETS.loading;
  }

  return getVocationOutfitPath(summary?.vocation, summary?.sex) || PROFILE_PANEL_ASSETS.noVocation;
}

function isTibiaCoinsCharacterValid() {
  return Boolean(state.tibiaCoinsCharacterName.trim() && state.tibiaCoinsCharacterSummary);
}

function renderTibiaCoinsCharacterSummaryMarkup() {
  const summary = state.tibiaCoinsCharacterSummary;
  const characterName = state.tibiaCoinsCharacterName.trim();
  const lookupState = state.tibiaCoinsCharacterLookupState || "idle";

  if (summary) {
    return `
      <strong>${escapeHtml(characterName)}</strong>
      <span>${escapeHtml(summary.vocation || t("screenVision.tibiaCoins.vocationUnknown"))} - ${escapeHtml(t("tools.level"))} ${escapeHtml(String(summary.level || "-"))}</span>
      <small>${escapeHtml(summary.world || t("screenVision.tibiaCoins.worldUnknown"))} ${summary.sex ? `- ${escapeHtml(summary.sex)}` : ""}</small>
    `;
  }

  if (characterName && lookupState === "invalid") {
    return `<span class="docked-tibia-coins-invalid">${escapeHtml(t("screenVision.tibiaCoins.characterInvalid"))}</span>`;
  }

  return "";
}

function getTibiaCoinsPackagePriceLabel(quantity) {
  const normalized = normalizeTibiaCoinsQuantity(quantity);
  const packageBasePer250 = TIBIA_COINS_PACKAGE_BASE_PER_250.get(normalized);
  const tier = getTibiaCoinsPriceTier(normalized);
  const basePer250 = typeof packageBasePer250 === "number" ? packageBasePer250 : tier.unitPrice * 250;
  const per250 = basePer250 * (1 - TIBIA_COINS_APP_DISCOUNT_RATE);
  return `${formatTibiaCoinsCurrency(per250)} cada 250`;
}

function renderTibiaCoinsPackageButton(packageQuantity, currentQuantity) {
  const active = normalizeTibiaCoinsQuantity(currentQuantity) === packageQuantity;
  const icon = getTibiaCoinsTierIcon(packageQuantity);

  return `
    <button type="button" class="docked-tibia-coins-package${active ? " active" : ""}" data-docked-action="select-tibia-coins-package" data-tibia-coins-quantity="${escapeHtml(String(packageQuantity))}" data-tooltip="${escapeHtml(t("screenVision.tibiaCoins.selectPackage", { quantity: String(packageQuantity) }))}" aria-label="${escapeHtml(t("screenVision.tibiaCoins.selectPackage", { quantity: String(packageQuantity) }))}">
      <img src="${escapeHtml(icon)}" alt="">
      <strong>${escapeHtml(String(packageQuantity))} Tibia Coins</strong>
      <span>${escapeHtml(getTibiaCoinsPackagePriceLabel(packageQuantity))}</span>
    </button>
  `;
}

function getTibiaCoinsQuantityProgress(quantity) {
  const normalized = normalizeTibiaCoinsQuantity(quantity);
  return ((normalized - TIBIA_COINS_QUANTITY_MIN) / (TIBIA_COINS_QUANTITY_MAX - TIBIA_COINS_QUANTITY_MIN)) * 100;
}

function normalizeTibiaCoinsQuantity(value) {
  const numeric = clampInteger(value, TIBIA_COINS_QUANTITY_MIN, TIBIA_COINS_QUANTITY_MAX, TIBIA_COINS_QUANTITY_MIN);
  const stepped = Math.round(numeric / TIBIA_COINS_QUANTITY_STEP) * TIBIA_COINS_QUANTITY_STEP;
  return clampInteger(stepped, TIBIA_COINS_QUANTITY_MIN, TIBIA_COINS_QUANTITY_MAX, TIBIA_COINS_QUANTITY_MIN);
}

function formatTibiaCoinsCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function calculateTibiaCoinsPrice(quantity) {
  const normalized = normalizeTibiaCoinsQuantity(quantity);
  const tier = getTibiaCoinsPriceTier(normalized);
  const unitPrice = tier.unitPrice;
  const totalPrice = normalized * unitPrice;
  const originalTotalPrice = normalized * TIBIA_COINS_BASE_UNIT_PRICE;
  const discountedTotalPrice = totalPrice * (1 - TIBIA_COINS_APP_DISCOUNT_RATE);

  return {
    product_id: TIBIA_COINS_PRODUCT_ID,
    requested_quantity: normalized,
    unit_price: unitPrice,
    unit_price_formatted: formatTibiaCoinsCurrency(unitPrice),
    total_price: totalPrice,
    total_price_formatted: formatTibiaCoinsCurrency(totalPrice),
    original_total_price: originalTotalPrice,
    original_total_price_formatted: formatTibiaCoinsCurrency(originalTotalPrice),
    discounted_total_price: discountedTotalPrice,
    discounted_total_price_formatted: formatTibiaCoinsCurrency(discountedTotalPrice)
  };
}

function getTibiaCoinsPriceTier(quantity) {
  const normalized = normalizeTibiaCoinsQuantity(quantity);
  return TIBIA_COINS_PRICE_TIERS.find((entry) => normalized >= entry.min) || TIBIA_COINS_PRICE_TIERS[TIBIA_COINS_PRICE_TIERS.length - 1];
}

function buildTibiaCoinsQuickbuyUrl() {
  const url = new URL(TIBIA_COINS_QUICKBUY_URL);
  url.searchParams.set("route", "extension/module/quickbuy");
  url.searchParams.set("product_id", String(TIBIA_COINS_PRODUCT_ID));
  url.searchParams.set("quantity", String(normalizeTibiaCoinsQuantity(state.tibiaCoinsQuantity)));
  url.searchParams.set(`option[${TIBIA_COINS_CHARACTER_OPTION_ID}]`, state.tibiaCoinsCharacterName.trim());
  url.searchParams.set("tracking", TIBIA_COINS_TRACKING);
  return url.toString();
}

function getTibiaCoinsPriceStatusMarkup() {
  const price = calculateTibiaCoinsPrice(state.tibiaCoinsQuantity);
  const originalPrice = price.original_total_price_formatted || "";
  const discountedPrice = price.discounted_total_price_formatted || "";

  if (originalPrice && discountedPrice) {
    return `
      <span class="docked-tibia-coins-old-price">${escapeHtml(originalPrice)}</span>
      <span class="docked-tibia-coins-new-price">${escapeHtml(discountedPrice)}</span>
    `;
  }

  return t("screenVision.tibiaCoins.checkoutPending");
}

function updateTibiaCoinsPriceStatusUi() {
  const status = els.dockedPanelHost?.querySelector(".docked-tibia-coins-price-status");

  if (status) {
    status.innerHTML = getTibiaCoinsPriceStatusMarkup();
  }
}

function updateTibiaCoinsCharacterUi() {
  const host = els.dockedPanelHost;

  if (!host || !isDockedTibiaCoinsPanelOpen()) {
    return;
  }

  const summary = state.tibiaCoinsCharacterSummary;
  const characterName = state.tibiaCoinsCharacterName || "";
  const lookupState = state.tibiaCoinsCharacterLookupState || "idle";
  const avatar = host.querySelector(".docked-tibia-coins-avatar img");
  const summaryBox = host.querySelector(".docked-tibia-coins-character-summary");
  const confirmButton = host.querySelector('[data-docked-action="confirm-tibia-coins"]');

  if (avatar) {
    avatar.src = getTibiaCoinsCharacterAvatar(summary, characterName, lookupState);
  }

  if (summaryBox) {
    summaryBox.innerHTML = renderTibiaCoinsCharacterSummaryMarkup();
  }

  if (confirmButton) {
    const canConfirm = isTibiaCoinsCharacterValid();
    confirmButton.disabled = !canConfirm;
    confirmButton.classList.toggle("disabled", !canConfirm);
    confirmButton.dataset.tooltip = canConfirm ? t("screenVision.tibiaCoins.buyNow") : t("screenVision.tibiaCoins.invalidCharacter");
  }
}

function updateTibiaCoinsQuantityUi(target) {
  const quantity = normalizeTibiaCoinsQuantity(target?.value || state.tibiaCoinsQuantity);
  state.tibiaCoinsQuantity = quantity;
  const progress = getTibiaCoinsQuantityProgress(quantity);
  const host = els.dockedPanelHost;

  host?.querySelectorAll('[data-docked-field="tibiaCoinsQuantity"]').forEach((element) => {
    if (element !== target) {
      element.value = String(quantity);
    }
    element.style?.setProperty?.("--alert-volume-percent", `${progress}%`);
  });

  const icon = host?.querySelector(".docked-tibia-coins-quantity-heading img");
  if (icon) {
    icon.src = getTibiaCoinsTierIcon(quantity);
  }
  const title = host?.querySelector(".docked-tibia-coins-quantity-heading strong");
  if (title) {
    title.textContent = `${quantity} Tibia Coins`;
  }
  host?.querySelectorAll(".docked-tibia-coins-package").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.tibiaCoinsQuantity) === quantity);
  });

  state.tibiaCoinsPrice = calculateTibiaCoinsPrice(quantity);
  state.tibiaCoinsPriceLoading = false;
  state.tibiaCoinsPriceError = false;
  updateTibiaCoinsPriceStatusUi();
}

function scheduleTibiaCoinsCharacterLookup() {
  if (state.tibiaCoinsCharacterLookupTimer) {
    window.clearTimeout(state.tibiaCoinsCharacterLookupTimer);
  }

  state.tibiaCoinsCharacterLookupTimer = window.setTimeout(() => {
    void resolveTibiaCoinsCharacter();
  }, 450);
}

async function resolveTibiaCoinsCharacter() {
  const name = state.tibiaCoinsCharacterName.trim();
  const requestId = ++state.tibiaCoinsCharacterRequestId;

  if (!name) {
    state.tibiaCoinsCharacterSummary = null;
    state.tibiaCoinsCharacterLookupState = "idle";
    updateTibiaCoinsCharacterUi();
    return;
  }

  state.tibiaCoinsCharacterLookupState = "pending";
  updateTibiaCoinsCharacterUi();

  const result = await window.screenVisionApi.profiles.resolveCharacters([name]).catch(() => ({}));

  if (requestId !== state.tibiaCoinsCharacterRequestId) {
    return;
  }

  state.tibiaCoinsCharacterSummary = result?.[name] || null;
  state.tibiaCoinsCharacterLookupState = state.tibiaCoinsCharacterSummary ? "valid" : "invalid";
  updateTibiaCoinsCharacterUi();
}

async function handleDockedTibiaCoinsPanelClick(event) {
  const actionTarget = event.target.closest("[data-docked-action]");

  if (!actionTarget) {
    return;
  }

  const action = actionTarget.dataset.dockedAction || "";

  if (action === "close-panel") {
    await window.screenVisionApi.tools.open("tibia-coins-panel").catch(() => null);
    return;
  }

  if (action === "open-tibia-coins-brand") {
    const openExternal = window.desktopApi?.links?.openExternal;

    if (typeof openExternal === "function") {
      await openExternal(TIBIA_COINS_BRAND_URL).catch(() => {
        window.open(TIBIA_COINS_BRAND_URL, "_blank", "noopener,noreferrer");
      });
      return;
    }

    window.open(TIBIA_COINS_BRAND_URL, "_blank", "noopener,noreferrer");
    return;
  }

  if (action === "select-tibia-coins-package") {
    updateTibiaCoinsQuantityUi({ value: actionTarget.dataset.tibiaCoinsQuantity || TIBIA_COINS_QUANTITY_MIN });
    return;
  }

  if (action !== "confirm-tibia-coins") {
    return;
  }

  const characterName = state.tibiaCoinsCharacterName.trim();

  if (!characterName || !isTibiaCoinsCharacterValid()) {
    const field = els.dockedPanelHost?.querySelector('[data-docked-field="tibiaCoinsCharacterName"]');
    field?.focus?.();
    flashBlockedActionTooltip(actionTarget, characterName ? t("screenVision.tibiaCoins.characterInvalid") : t("screenVision.tibiaCoins.enterNickname"));
    return;
  }

  const url = buildTibiaCoinsQuickbuyUrl();
  const openExternal = window.desktopApi?.links?.openExternal;

  if (typeof openExternal === "function") {
    await openExternal(url).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function resetCoffeePanelState() {
  state.coffeeThankYouVisible = false;
  state.coffeePixQrVisible = false;
  state.coffeePixCopied = false;

  if (state.coffeePixCopyResetTimer) {
    window.clearTimeout(state.coffeePixCopyResetTimer);
    state.coffeePixCopyResetTimer = 0;
  }
}

async function openCoffeeExternalUrl(url) {
  if (!url) {
    return;
  }

  const openExternal = window.desktopApi?.links?.openExternal;

  if (typeof openExternal === "function") {
    await openExternal(url).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

async function handleDockedCoffeePanelClick(event) {
  const button = event.target.closest("[data-docked-action]");

  if (!button) {
    return;
  }

  hideFloatingTooltip();
  const action = button.dataset.dockedAction || "";

  if (action === "close-panel") {
    resetCoffeePanelState();
    await window.screenVisionApi.tools.open("buy-me-a-coffee-panel").catch(() => null);
    return;
  }

  if (action === "copy-coffee-character") {
    const characterName = String(button.dataset.coffeeCharacter || state.coffeeConfig?.tibiaCoins?.characterName || "Poioso").trim() || "Poioso";
    await copyTextToClipboard(characterName);
    button.dataset.copyState = "done";
    setLiveTooltip(button, t("common.copied"));
    window.setTimeout(() => {
      if (button.isConnected) {
        button.dataset.copyState = "";
        setLiveTooltip(button, t("screenVision.coffee.copyCharacterName"));
      }
    }, 1200);
    return;
  }

  if (action === "open-coffee-external") {
    await openCoffeeExternalUrl(button.dataset.coffeeUrl || "");
    return;
  }

  if (action === "toggle-coffee-pix-qr") {
    if (!String(state.coffeeConfig?.pix?.qrImageUrl || "").trim()) {
      return;
    }
    state.coffeePixQrVisible = !state.coffeePixQrVisible;
    renderDockedPanel();
    return;
  }

  if (action === "copy-coffee-pix") {
    const pixCode = String(state.coffeeConfig?.pix?.pixCode || "").trim();
    if (!pixCode) {
      return;
    }
    await copyTextToClipboard(pixCode);
    state.coffeePixCopied = true;

    if (state.coffeePixCopyResetTimer) {
      window.clearTimeout(state.coffeePixCopyResetTimer);
    }

    renderDockedPanel();
    state.coffeePixCopyResetTimer = window.setTimeout(() => {
      state.coffeePixCopied = false;
      state.coffeePixCopyResetTimer = 0;

      if (isDockedCoffeePanelOpen()) {
        renderDockedPanel();
      }
    }, 2000);
    return;
  }

  if (action === "open-coffee-donation") {
    const url = button.dataset.coffeeUrl || "";
    state.coffeeThankYouVisible = true;
    state.coffeePixQrVisible = false;
    renderDockedPanel();
    await openCoffeeExternalUrl(url);
  }
}

async function handleDockedTibiaCoinsPanelInput(event, options = {}) {
  const field = event.target?.dataset?.dockedField || "";

  if (field === "tibiaCoinsCharacterName") {
    state.tibiaCoinsCharacterName = String(event.target.value || "").slice(0, 64);
    state.tibiaCoinsCharacterSummary = null;
    state.tibiaCoinsCharacterLookupState = state.tibiaCoinsCharacterName.trim() ? "pending" : "idle";
    updateTibiaCoinsCharacterUi();
    scheduleTibiaCoinsCharacterLookup();
    return;
  }

  if (field === "tibiaCoinsQuantity") {
    updateTibiaCoinsQuantityUi(event.target);
  }
}

function renderDockedPanelCloseButton(side) {
  const useForward = side === "left";
  const idle = useForward
    ? "assets/ui/desktop-history/avancar-off.png"
    : "assets/ui/desktop-history/voltar-off.png";
  const active = useForward
    ? "assets/ui/desktop-history/avancar-on.png"
    : "assets/ui/desktop-history/voltar-on.png";

  return `
    <button
      type="button"
      class="desktop-docked-arrow-close desktop-history-button desktop-window-image-button"
      data-docked-action="close-panel"
      aria-label="${escapeHtml(t("common.close"))}"
      data-tooltip="${escapeHtml(t("common.close"))}"
    >
      <span class="desktop-window-icon-stack" aria-hidden="true">
        <img class="desktop-window-icon desktop-window-icon-idle" src="${escapeHtml(idle)}" alt="">
        <img class="desktop-window-icon desktop-window-icon-active" src="${escapeHtml(active)}" alt="">
      </span>
    </button>
  `;
}

function renderDockedAuthenticatorPanel(panelState, copy) {
  const items = getDockedAuthenticatorItems();
  const count = items.length;
  const showCreateCard = state.authenticatorExpandedId === AUTHENTICATOR_CREATE_SENTINEL;

  return renderDockedToolShell({
    side: panelState.side,
    title: copy.title || t("screenVision.authenticator.title"),
    shellClassName: "docked-authenticator-shell",
    contentClassName: "docked-authenticator-content",
    bodyMarkup: renderDockedToolStage({
      className: "docked-authenticator-stage",
      toolbarMarkup: `
        <div class="desktop-docked-tool-toolbar docked-authenticator-toolbar">
          <div class="desktop-docked-tool-toolbar-left docked-authenticator-toolbar-left">
            <button
              type="button"
              class="docked-alert-tile docked-authenticator-toolbar-tile"
              data-docked-action="create-authenticator"
              data-tooltip="${escapeHtml(t("screenVision.authenticator.addToken"))}"
              aria-label="${escapeHtml(t("screenVision.authenticator.addToken"))}"
            >
              <img src="${escapeHtml(AUTHENTICATOR_PANEL_ASSETS.create)}" alt="">
            </button>
          </div>
          <div class="desktop-docked-tool-toolbar-right docked-authenticator-toolbar-right">
            <strong class="desktop-docked-tool-count docked-profile-count">${escapeHtml(String(count))}</strong>
          </div>
        </div>
      `,
      dividerMarkup: '<div class="desktop-docked-tool-divider"></div>',
      bodyMarkup: `
        <div class="docked-auth-cards">
          ${showCreateCard ? renderDockedAuthenticatorCreateCard() : ""}
          ${count
            ? items.map((entry) => renderDockedAuthenticatorCard(entry)).join("")
            : showCreateCard ? "" : `<div class="profiles-empty-state">${escapeHtml(t("screenVision.authenticator.empty"))}</div>`}
        </div>
      `
    })
  });
}

function renderDockedAuthenticatorCreateCard() {
  const confirmState = getDockedAuthenticatorConfirmState("create");

  return `
    <article class="docked-alert-card docked-auth-card expanded docked-auth-create-card">
      <div class="docked-alert-card-main">
        <div class="docked-alert-card-title-row">
          <strong>${escapeHtml(t("screenVision.authenticator.title"))}</strong>
        </div>
      </div>
      <div class="docked-alert-extension docked-auth-extension">
        <div class="desktop-docked-tool-divider"></div>
        <div class="docked-profile-grid-row">
          <label for="auth-create-label">${escapeHtml(t("screenVision.authenticator.nameLabel"))}</label>
          <input id="auth-create-label" type="text" value="${escapeHtml(state.authenticatorDraft.label || "")}" maxlength="${AUTHENTICATOR_LABEL_MAX_LENGTH}" placeholder="${escapeHtml(t("screenVision.authenticator.namePlaceholder"))}" data-docked-field="authLabel">
        </div>
        <div class="docked-profile-grid-row">
          <label for="auth-create-secret">${escapeHtml(t("screenVision.authenticator.secretLabel"))}</label>
          <input id="auth-create-secret" type="text" value="${escapeHtml(state.authenticatorDraft.secret || "")}" maxlength="${AUTHENTICATOR_SECRET_MAX_LENGTH}" placeholder="${escapeHtml(t("screenVision.authenticator.secretPlaceholder"))}" data-docked-field="authSecret">
        </div>
        <div class="docked-profile-grid-row stacked">
          <label>${escapeHtml(t("screenVision.authenticator.modeLabel"))}</label>
          <div class="docked-auth-mode-buttons">
            ${renderDockedAuthenticatorModeTile("totp", t("screenVision.authenticator.modeTime"), AUTHENTICATOR_PANEL_ASSETS.totp)}
            ${renderDockedAuthenticatorModeTile("hotp", t("screenVision.authenticator.modeCounter"), AUTHENTICATOR_PANEL_ASSETS.hotp)}
          </div>
        </div>
        ${renderDockedAuthenticatorInlineActions({
          mode: "create",
          confirmAction: "save-auth-create",
          cancelAction: "cancel-auth-create",
          confirmState
        })}
      </div>
    </article>
  `;
}

function renderDockedAuthenticatorCard(entry) {
  const runtime = state.authenticatorRuntimeById[entry.id] || {
    code: "000000",
    formattedCode: "000 000",
    secondsRemaining: 30,
    progressPercent: 0,
    counter: entry.counter || 0
  };
  const expanded = state.authenticatorExpandedId === entry.id;
  const progressValue = entry.otpType === "hotp"
    ? `#${escapeHtml(String(runtime.counter || entry.counter || 0))}`
    : `${escapeHtml(String(runtime.secondsRemaining || 0))}s`;
  const progressTooltip = entry.otpType === "hotp"
    ? t("screenVision.authenticator.progressCounter")
    : t("screenVision.authenticator.progressTime");
  const copyDone = state.authenticatorCopyDoneId === entry.id;

  return `
    <article class="docked-alert-card docked-auth-card${expanded ? " expanded" : ""}" data-auth-card-id="${escapeHtml(entry.id)}">
      <div class="docked-alert-card-main">
        <div class="docked-alert-card-title-row">
          <strong>${escapeHtml(entry.label || t("screenVision.authenticator.title"))}</strong>
        </div>
        <div class="docked-auth-code-row">
          <strong class="docked-auth-code">${escapeHtml(runtime.formattedCode || "000 000")}</strong>
        </div>
        <div class="docked-auth-progress-row" data-tooltip="${escapeHtml(progressTooltip)}">
          <strong class="docked-auth-progress-value">${progressValue}</strong>
          <div
            class="docked-auth-progress-track"
            style="--auth-progress-percent:${escapeHtml(String(Math.max(0, Math.min(100, Number(runtime.progressPercent) || 0))))}%"
          ></div>
        </div>
        <div class="docked-alert-card-control-row">
          <div class="docked-alert-card-actions">
            <button
              type="button"
              class="docked-alert-icon-button${expanded ? " active" : ""}"
              data-docked-action="toggle-auth-edit"
              data-auth-id="${escapeHtml(entry.id)}"
              data-tooltip="${escapeHtml(expanded ? t("screenVision.authenticator.closeEdit") : t("screenVision.authenticator.edit"))}"
              aria-label="${escapeHtml(t("screenVision.authenticator.edit"))}"
            >${renderIcon("edit")}</button>
            <button
              type="button"
              class="docked-alert-icon-button danger"
              data-docked-action="delete-auth"
              data-auth-id="${escapeHtml(entry.id)}"
              data-tooltip="${escapeHtml(t("screenVision.authenticator.delete"))}"
              aria-label="${escapeHtml(t("screenVision.authenticator.delete"))}"
            >${renderIcon("trash")}</button>
            <button
              type="button"
              class="imbuement-copy-button docked-auth-copy-button"
              data-docked-action="copy-auth-code"
              data-auth-id="${escapeHtml(entry.id)}"
              data-copy-state="${copyDone ? "done" : ""}"
              data-tooltip="${escapeHtml(copyDone ? t("common.copied") : t("screenVision.authenticator.copy"))}"
              aria-label="${escapeHtml(t("screenVision.authenticator.copy"))}"
            >
              <span class="copy-sprite-stack" aria-hidden="true">
                <img class="copy-sprite-icon copy-sprite-icon-off" src="assets/ui/copy/copiar-off.png" alt="">
                <img class="copy-sprite-icon copy-sprite-icon-hover" src="assets/ui/copy/copiar-hover.png" alt="">
                <img class="copy-sprite-icon copy-sprite-icon-on" src="assets/ui/copy/copiar-on.png" alt="">
              </span>
            </button>
          </div>
        </div>
      </div>
      ${expanded ? renderDockedAuthenticatorEditExtension(entry) : ""}
    </article>
  `;
}

function renderDockedAuthenticatorEditExtension(entry) {
  const confirmState = getDockedAuthenticatorConfirmState("edit", entry);

  return `
    <div class="docked-alert-extension docked-auth-extension">
      <div class="desktop-docked-tool-divider"></div>
      <div class="docked-profile-grid-row">
        <label for="auth-edit-label-${escapeHtml(entry.id)}">${escapeHtml(t("screenVision.authenticator.nameLabel"))}</label>
        <input id="auth-edit-label-${escapeHtml(entry.id)}" type="text" value="${escapeHtml(state.authenticatorDraft.label ?? entry.label ?? "")}" maxlength="${AUTHENTICATOR_LABEL_MAX_LENGTH}" placeholder="${escapeHtml(t("screenVision.authenticator.namePlaceholder"))}" data-docked-field="authLabel" data-auth-id="${escapeHtml(entry.id)}">
      </div>
      ${renderDockedAuthenticatorInlineActions({
        mode: "edit",
        authId: entry.id,
        confirmAction: "save-auth-edit",
        cancelAction: "cancel-auth-edit",
        confirmState
      })}
    </div>
  `;
}

function renderDockedAuthenticatorModeTile(otpType, tooltip, assetPath) {
  const selected = String(state.authenticatorDraft.otpType || "") === otpType;

  return `
    <button
      type="button"
      class="docked-alert-tile docked-auth-mode-tile${selected ? " active" : " inactive"}"
      data-docked-action="select-auth-mode"
      data-auth-mode="${escapeHtml(otpType)}"
      data-tooltip="${escapeHtml(tooltip)}"
      aria-label="${escapeHtml(tooltip)}"
    >
      <img src="${escapeHtml(assetPath)}" alt="">
    </button>
  `;
}

function renderDockedAuthenticatorInlineActions(options = {}) {
  const confirmState = options.confirmState || { disabled: false, tooltip: t("common.save") };
  const authId = options.authId ? ` data-auth-id="${escapeHtml(options.authId)}"` : "";
  const confirmTooltipTone = confirmState.disabled ? ' data-tooltip-tone="danger"' : "";

  return `
    <div class="docked-auth-inline-actions">
      <button
        type="button"
        class="docked-auth-inline-action-button"
        data-docked-action="${escapeHtml(options.cancelAction || "cancel")}"
        ${authId}
        data-tooltip="${escapeHtml(t("common.cancel"))}"
        aria-label="${escapeHtml(t("common.cancel"))}"
      >
        <img src="assets/ui/Cross.png" alt="">
      </button>
      <button
        type="button"
        class="docked-auth-inline-action-button primary${confirmState.disabled ? " is-disabled" : ""}"
        data-docked-action="${escapeHtml(options.confirmAction || "confirm")}"
        data-auth-confirm-mode="${escapeHtml(options.mode || "create")}"
        ${authId}
        data-tooltip="${escapeHtml(confirmState.tooltip || t("common.save"))}"${confirmTooltipTone}
        aria-label="${escapeHtml(t("common.confirm"))}"
        aria-disabled="${confirmState.disabled ? "true" : "false"}"
      >
        <img src="assets/ui/Tick.png" alt="">
      </button>
    </div>
  `;
}

function getDockedAuthenticatorItems() {
  const items = Array.isArray(state.overlayTools?.authenticator?.items)
    ? state.overlayTools.authenticator.items.map((entry) => normalizeOverlayAuthenticatorEntry(entry)).filter(Boolean)
    : [];

  return items.sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || "") || 0;
    const rightTime = Date.parse(right.createdAt || "") || 0;

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base" });
  });
}

function findDockedAuthenticatorEntry(authId) {
  return getDockedAuthenticatorItems().find((entry) => entry.id === authId) || null;
}

function setAuthenticatorDraftFromEntry(entry) {
  state.authenticatorDraft.label = entry?.label || "";
  state.authenticatorDraft.secret = entry?.secret || "";
  state.authenticatorDraft.otpType = entry?.otpType || "";
}

function clearAuthenticatorDraft() {
  state.authenticatorDraft = createDefaultOverlayAuthenticatorDraft();
}

function getDockedAuthenticatorConfirmState(mode, entry = null) {
  const label = String(state.authenticatorDraft.label ?? "").trim();
  const secret = String(state.authenticatorDraft.secret || "").trim();
  const otpType = String(state.authenticatorDraft.otpType || "").trim();

  if (mode === "edit") {
    const disabled = !label;
    return {
      disabled,
      tooltip: disabled ? t("screenVision.authenticator.fillAllFields") : t("screenVision.authenticator.save")
    };
  }

  const disabled = !label || !secret || !otpType;
  return {
    disabled,
    tooltip: disabled ? t("screenVision.authenticator.fillAllFields") : t("screenVision.authenticator.save")
  };
}

function buildDockedAuthenticatorEntryFromDraft(existingEntry = null) {
  const id = existingEntry?.id || (globalThis.crypto?.randomUUID?.() || `auth-${Date.now()}`);
  const createdAt = existingEntry?.createdAt || new Date().toISOString();

  normalizeTokenDraft({
    label: state.authenticatorDraft.label,
    secret: state.authenticatorDraft.secret,
    otpType: state.authenticatorDraft.otpType || existingEntry?.otpType || "totp",
    counter: existingEntry?.counter || 0,
    digits: 6,
    period: 30,
    algorithm: "SHA-1"
  });

  return normalizeOverlayAuthenticatorEntry({
    id,
    label: state.authenticatorDraft.label,
    secret: state.authenticatorDraft.secret,
    otpType: state.authenticatorDraft.otpType || existingEntry?.otpType || "totp",
    counter: existingEntry?.counter || 0,
    createdAt
  });
}

async function saveDockedAuthenticatorCreate() {
  const nextEntry = buildDockedAuthenticatorEntryFromDraft();

  if (!nextEntry) {
    throw new Error("Confira a chave informada.");
  }

  state.overlayTools.authenticator.items = [...getDockedAuthenticatorItems(), nextEntry];
  clearAuthenticatorDraft();
  state.authenticatorExpandedId = "";
  await persistDockedAlertsState();
  await refreshDockedAuthenticatorRuntime({ render: false, force: true });
  renderDockedPanel();
}

async function saveDockedAuthenticatorEdit(authId) {
  const currentEntry = findDockedAuthenticatorEntry(authId);

  if (!currentEntry) {
    return;
  }

  const nextEntry = buildDockedAuthenticatorEntryFromDraft(currentEntry);

  if (!nextEntry) {
    throw new Error("Confira a chave informada.");
  }

  state.overlayTools.authenticator.items = getDockedAuthenticatorItems().map((entry) => (
    entry.id === authId
      ? {
        ...entry,
        label: nextEntry.label
      }
      : entry
  ));
  state.authenticatorExpandedId = "";
  clearAuthenticatorDraft();
  await persistDockedAlertsState();
  await refreshDockedAuthenticatorRuntime({ render: false, force: true });
  renderDockedPanel();
}

async function deleteDockedAuthenticatorEntry(authId) {
  const entry = findDockedAuthenticatorEntry(authId);

  if (!entry) {
    return;
  }

  const confirmed = await confirmExternalModal({
    title: "Confirmar Exclusao",
    message: `Deletar autenticador "${entry.label}"?`,
    confirmLabel: "Sim",
    cancelLabel: "Cancelar",
    checkboxLabel: "Nao perguntar novamente nesta sessao",
    sessionKey: "delete-authenticator-v1"
  });

  if (!confirmed.confirmed) {
    return;
  }

  state.overlayTools.authenticator.items = getDockedAuthenticatorItems().filter((item) => item.id !== authId);
  state.authenticatorRuntimeById = Object.fromEntries(
    Object.entries(state.authenticatorRuntimeById || {}).filter(([id]) => id !== authId)
  );

  if (state.authenticatorExpandedId === authId) {
    state.authenticatorExpandedId = "";
    clearAuthenticatorDraft();
  }

  if (state.authenticatorCopyDoneId === authId) {
    state.authenticatorCopyDoneId = "";
  }

  await persistDockedAlertsState();
  renderDockedPanel();
}

async function copyDockedAuthenticatorCode(authId) {
  const entry = findDockedAuthenticatorEntry(authId);

  if (!entry) {
    return;
  }

  await refreshDockedAuthenticatorRuntime({ render: false, force: true });

  const runtime = state.authenticatorRuntimeById[authId] || null;
  const code = String(runtime?.code || "").trim();

  if (!code) {
    return;
  }

  await copyTextToClipboard(code);
  setDockedAuthenticatorCopyState(authId);

  if (entry.otpType === "hotp") {
    state.overlayTools.authenticator.items = getDockedAuthenticatorItems().map((item) => (
      item.id === authId
        ? {
          ...item,
          counter: clampInteger((item.counter || 0) + 1, 0, Number.MAX_SAFE_INTEGER, 0)
        }
        : item
    ));
    await persistDockedAlertsState();
    await refreshDockedAuthenticatorRuntime({ render: false, force: true });
  }

  renderDockedPanel();
}

function setDockedAuthenticatorCopyState(authId) {
  state.authenticatorCopyDoneId = authId;
  window.clearTimeout(state.authenticatorCopyResetTimer);
  state.authenticatorCopyResetTimer = window.setTimeout(() => {
    if (state.authenticatorCopyDoneId !== authId) {
      return;
    }

    state.authenticatorCopyDoneId = "";
    if (isDockedAuthenticatorPanelOpen()) {
      renderDockedPanel();
    }
  }, 1200);
}

async function refreshDockedAuthenticatorRuntime(options = {}) {
  const items = getDockedAuthenticatorItems();
  const nowMs = Number.isFinite(options.epochMs) ? Number(options.epochMs) : Date.now();
  const nextRuntime = {};

  for (const entry of items) {
    nextRuntime[entry.id] = await buildDockedAuthenticatorRuntime(
      entry,
      state.authenticatorRuntimeById?.[entry.id] || null,
      nowMs,
      options.force === true
    );
  }

  state.authenticatorRuntimeById = nextRuntime;

  if (options.render && isDockedAuthenticatorPanelOpen() && !shouldPreserveInteractiveSurface()) {
    renderDockedPanel();
  }

  return nextRuntime;
}

async function buildDockedAuthenticatorRuntime(entry, cachedRuntime, nowMs, force = false) {
  const isHotp = entry.otpType === "hotp";
  const periodSeconds = 30;
  const windowKey = isHotp ? entry.counter : Math.floor(nowMs / (periodSeconds * 1000));
  const secondsIntoWindow = Math.floor(nowMs / 1000) % periodSeconds;
  const secondsRemaining = isHotp ? 0 : Math.max(1, periodSeconds - secondsIntoWindow);
  const progressPercent = isHotp
    ? 100
    : Math.max(0, Math.min(100, ((periodSeconds - secondsRemaining) / periodSeconds) * 100));
  const canReuseCode = Boolean(
    cachedRuntime
    && !force
    && cachedRuntime.windowKey === windowKey
    && cachedRuntime.secret === entry.secret
    && cachedRuntime.otpType === entry.otpType
    && cachedRuntime.counterSource === entry.counter
  );

  if (canReuseCode) {
    return {
      ...cachedRuntime,
      secondsRemaining,
      progressPercent
    };
  }

  const generated = await generateOtp(
    {
      label: entry.label,
      secret: entry.secret,
      otpType: entry.otpType,
      counter: entry.counter,
      digits: 6,
      period: 30,
      algorithm: "SHA-1"
    },
    {
      epochMs: nowMs,
      counter: entry.counter
    }
  ).catch(() => null);
  const code = String(generated?.code || cachedRuntime?.code || "000000");

  return {
    code,
    formattedCode: formatDockedAuthenticatorCode(code),
    secondsRemaining,
    progressPercent,
    counter: Number.isFinite(Number(generated?.counter)) ? Number(generated.counter) : entry.counter,
    windowKey,
    otpType: entry.otpType,
    secret: entry.secret,
    counterSource: entry.counter
  };
}

function formatDockedAuthenticatorCode(code) {
  const normalized = String(code || "").replace(/\D/g, "").padStart(6, "0").slice(-6);
  return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
}

function syncDockedAuthenticatorConfirmButtons() {
  els.dockedPanelHost?.querySelectorAll("[data-auth-confirm-mode]").forEach((button) => {
    const mode = button.dataset.authConfirmMode || "create";
    const authId = button.dataset.authId || "";
    const entry = authId ? findDockedAuthenticatorEntry(authId) : null;
    const confirmState = getDockedAuthenticatorConfirmState(mode, entry);

    button.dataset.tooltip = confirmState.tooltip || t("screenVision.authenticator.save");
    if (confirmState.disabled) {
      button.dataset.tooltipTone = "danger";
    } else {
      delete button.dataset.tooltipTone;
    }
    button.setAttribute("aria-disabled", confirmState.disabled ? "true" : "false");
    button.classList.toggle("is-disabled", confirmState.disabled);
  });
}

async function handleDockedAuthenticatorPanelClick(event) {
  const button = event.target.closest("[data-docked-action]");

  if (!button) {
    return;
  }

  hideFloatingTooltip();

  const action = button.dataset.dockedAction || "";
  const authId = button.dataset.authId || "";

  if (action === "close-panel") {
    state.authenticatorExpandedId = "";
    clearAuthenticatorDraft();
    await window.screenVisionApi.tools.open("authenticator-panel").catch(() => null);
    return;
  }

  if (action === "create-authenticator") {
    state.authenticatorExpandedId = AUTHENTICATOR_CREATE_SENTINEL;
    clearAuthenticatorDraft();
    renderDockedPanel();
    return;
  }

  if (action === "select-auth-mode") {
    state.authenticatorDraft.otpType = button.dataset.authMode || "";
    renderDockedPanel();
    return;
  }

  if (action === "cancel-auth-create") {
    state.authenticatorExpandedId = "";
    clearAuthenticatorDraft();
    renderDockedPanel();
    return;
  }

  if (action === "save-auth-create") {
    const confirmState = getDockedAuthenticatorConfirmState("create");

    if (confirmState.disabled) {
      flashBlockedActionTooltip(button, confirmState.tooltip);
      return;
    }

    try {
      await saveDockedAuthenticatorCreate();
    } catch (error) {
      flashBlockedActionTooltip(button, error instanceof Error ? error.message : "Confira a chave informada.");
    }
    return;
  }

  if (!authId) {
    return;
  }

  const entry = findDockedAuthenticatorEntry(authId);

  if (!entry) {
    return;
  }

  if (action === "toggle-auth-edit") {
    const nextOpen = state.authenticatorExpandedId !== authId;
    state.authenticatorExpandedId = nextOpen ? authId : "";
    if (nextOpen) {
      setAuthenticatorDraftFromEntry(entry);
    } else {
      clearAuthenticatorDraft();
    }
    renderDockedPanel();
    return;
  }

  if (action === "cancel-auth-edit") {
    state.authenticatorExpandedId = "";
    clearAuthenticatorDraft();
    renderDockedPanel();
    return;
  }

  if (action === "save-auth-edit") {
    const confirmState = getDockedAuthenticatorConfirmState("edit", entry);

    if (confirmState.disabled) {
      flashBlockedActionTooltip(button, confirmState.tooltip);
      return;
    }

    try {
      await saveDockedAuthenticatorEdit(authId);
    } catch (error) {
      flashBlockedActionTooltip(button, error instanceof Error ? error.message : "Confira a chave informada.");
    }
    return;
  }

  if (action === "delete-auth") {
    await deleteDockedAuthenticatorEntry(authId);
    return;
  }

  if (action === "copy-auth-code") {
    await copyDockedAuthenticatorCode(authId).catch(() => {});
  }
}

function handleDockedAuthenticatorPanelInput(event) {
  const field = event.target.dataset.dockedField || "";

  if (!field) {
    return;
  }

  if (field === "authLabel") {
    state.authenticatorDraft.label = String(event.target.value || "").slice(0, AUTHENTICATOR_LABEL_MAX_LENGTH);
    syncDockedAuthenticatorConfirmButtons();
    return;
  }

  if (field === "authSecret") {
    const normalizedSecret = String(event.target.value || "")
      .toUpperCase()
      .replace(/\s+/g, "")
      .slice(0, AUTHENTICATOR_SECRET_MAX_LENGTH);

    state.authenticatorDraft.secret = normalizedSecret;
    if (event.target.value !== normalizedSecret) {
      event.target.value = normalizedSecret;
    }
    syncDockedAuthenticatorConfirmButtons();
  }
}

function handleDockedAuthenticatorPanelChange(event) {
  handleDockedAuthenticatorPanelInput(event);
}

async function handleDockedAuthenticatorPanelKeydown(event) {
  const input = event.target.closest("input[data-docked-field]");

  if (!input) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    state.authenticatorExpandedId = "";
    clearAuthenticatorDraft();
    renderDockedPanel();
    return;
  }

  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  if (state.authenticatorExpandedId === AUTHENTICATOR_CREATE_SENTINEL) {
    const confirmState = getDockedAuthenticatorConfirmState("create");

    if (confirmState.disabled) {
      const confirmButton = els.dockedPanelHost?.querySelector('[data-docked-action="save-auth-create"]');
      if (confirmButton) {
        flashBlockedActionTooltip(confirmButton, confirmState.tooltip);
      }
      return;
    }

    try {
      await saveDockedAuthenticatorCreate();
    } catch (error) {
      const confirmButton = els.dockedPanelHost?.querySelector('[data-docked-action="save-auth-create"]');
      if (confirmButton) {
        flashBlockedActionTooltip(confirmButton, error instanceof Error ? error.message : "Confira a chave informada.");
      }
    }
    return;
  }

  const authId = input.dataset.authId || "";
  const entry = findDockedAuthenticatorEntry(authId);

  if (!authId || !entry) {
    return;
  }

  const confirmState = getDockedAuthenticatorConfirmState("edit", entry);

  if (confirmState.disabled) {
    const confirmButton = els.dockedPanelHost?.querySelector(`[data-docked-action="save-auth-edit"][data-auth-id="${cssEscape(authId)}"]`);
    if (confirmButton) {
      flashBlockedActionTooltip(confirmButton, confirmState.tooltip);
    }
    return;
  }

  await saveDockedAuthenticatorEdit(authId).catch((error) => {
    const confirmButton = els.dockedPanelHost?.querySelector(`[data-docked-action="save-auth-edit"][data-auth-id="${cssEscape(authId)}"]`);
    if (confirmButton) {
      flashBlockedActionTooltip(confirmButton, error instanceof Error ? error.message : "Confira a chave informada.");
    }
  });
}

function renderDockedProfilesPanel(panelState, copy) {
  const profiles = [...getRenderableProfilesForPanel()];
  const count = profiles.length;
  const showCreateCard = state.profilesPanelExpandedEditPath === PROFILE_CREATE_SENTINEL;

  return renderDockedToolShell({
    side: panelState.side,
    title: copy.title,
    shellClassName: "docked-profiles-shell",
    contentClassName: "docked-profiles-content",
    bodyMarkup: renderDockedToolStage({
      className: "docked-profiles-stage",
      toolbarMarkup: `
        <div class="desktop-docked-tool-toolbar docked-profiles-toolbar">
          <div class="desktop-docked-tool-toolbar-left docked-profiles-toolbar-left">
            <button
              type="button"
              class="docked-alert-tile docked-profile-toolbar-tile"
              data-docked-action="create-profile"
              data-tooltip="${escapeHtml(t("screenVision.profiles.createEmpty"))}"
              aria-label="${escapeHtml(t("screenVision.profiles.createEmpty"))}"
            >
              <img src="${escapeHtml(PROFILE_PANEL_ASSETS.create)}" alt="">
            </button>
            <button
              type="button"
              class="docked-alert-tile docked-profile-toolbar-tile"
              data-docked-action="import-profile"
              data-tooltip="${escapeHtml(t("screenVision.profiles.importSaved"))}"
              aria-label="${escapeHtml(t("screenVision.profiles.importSaved"))}"
            >
              <img src="${escapeHtml(PROFILE_PANEL_ASSETS.import)}" alt="">
            </button>
            <button
              type="button"
              class="docked-alert-tile docked-profile-toolbar-tile${count ? "" : " inactive"}"
              data-docked-action="export-profile"
              data-tooltip="${escapeHtml(t("screenVision.profiles.exportSelected"))}"
              aria-label="${escapeHtml(t("screenVision.profiles.exportSelected"))}"
            >
              <img src="${escapeHtml(PROFILE_PANEL_ASSETS.export)}" alt="">
            </button>
          </div>
          <div class="desktop-docked-tool-toolbar-right docked-profiles-toolbar-right">
            <strong class="desktop-docked-tool-count docked-profile-count">${escapeHtml(String(count))}</strong>
          </div>
        </div>
      `,
      dividerMarkup: '<div class="desktop-docked-tool-divider"></div>',
      bodyMarkup: `
        <div class="docked-profile-cards">
          ${showCreateCard ? renderDockedProfileCreateCard() : ""}
          ${profiles.length
            ? profiles.map((profile) => renderDockedProfileCard(profile)).join("")
            : showCreateCard ? "" : `<div class="profiles-empty-state">${escapeHtml(t("screenVision.profiles.noneCreated"))}</div>`}
        </div>
      `
    })
  });
}

function getRenderableProfilesForPanel() {
  const demo = state.tutorialProfileDemo;
  if (demo?.active && demo.profileCreated && demo.profile) {
    return [demo.profile];
  }

  return state.profilesIndex;
}

function renderDockedProfileCard(profile) {
  const summary = profile.characterSummary || null;
  const avatarPath = getDockedProfileAvatarPath(summary);
  const showMeta = Boolean(profile.characterName && summary?.level);
  const expanded = state.profilesPanelExpandedEditPath === profile.path;

  return `
    <article class="docked-profile-card${profile.isActive ? " active" : ""}${expanded ? " expanded" : ""}" data-profile-card-path="${escapeHtml(profile.path)}">
      <div class="docked-profile-card-main">
        <div class="docked-profile-card-title-row">
          <button
            type="button"
            class="docked-profile-avatar-button"
            data-docked-action="activate-profile"
            data-profile-path="${escapeHtml(profile.path)}"
            data-tooltip="${escapeHtml(t("screenVision.profiles.choose"))}"
            aria-label="${escapeHtml(t("screenVision.profiles.choose"))}"
          >
            <img src="${escapeHtml(avatarPath)}" alt="">
          </button>
          <div class="docked-profile-card-center">
            <strong>${escapeHtml(profile.name || "Perfil")}</strong>
            <div class="docked-profile-card-actions">
              <button type="button" class="docked-alert-icon-button" data-docked-action="toggle-profile-edit" data-profile-path="${escapeHtml(profile.path)}" data-tooltip="${escapeHtml(t("screenVision.profiles.edit"))}" aria-label="${escapeHtml(t("screenVision.profiles.edit"))}">${renderIcon("edit")}</button>
              <button type="button" class="docked-alert-icon-button" data-docked-action="duplicate-profile" data-profile-path="${escapeHtml(profile.path)}" data-tooltip="${escapeHtml(t("screenVision.profiles.duplicate"))}" aria-label="${escapeHtml(t("screenVision.profiles.duplicate"))}">${renderIcon("duplicate")}</button>
              <button type="button" class="docked-alert-icon-button danger" data-docked-action="delete-profile" data-profile-path="${escapeHtml(profile.path)}" data-tooltip="${escapeHtml(t("screenVision.profiles.delete"))}" aria-label="${escapeHtml(t("screenVision.profiles.delete"))}">${renderIcon("trash")}</button>
            </div>
          </div>
          <div class="docked-profile-card-meta${showMeta ? "" : " empty"}">
            ${showMeta ? `
              <span>${escapeHtml(profile.characterName)}</span>
              <small>Level ${escapeHtml(String(summary.level))}</small>
            ` : ""}
          </div>
        </div>
      </div>
      ${expanded ? renderDockedProfileEditExtension(profile) : ""}
    </article>
  `;
}

function renderDockedProfileEditExtension(profile) {
  const draftName = escapeHtml(state.profileDraft.profileName || profile.name || "");
  const draftCharacterName = escapeHtml(state.profileDraft.characterName || profile.characterName || "");
  const saveImage = "assets/ui/Tick.png";

  return `
    <div class="docked-profile-extension">
      <div class="desktop-docked-tool-divider"></div>
      <div class="docked-profile-grid-row">
        <label for="profile-name-${escapeHtml(profile.path)}">${escapeHtml(t("screenVision.profiles.nameLabel"))}</label>
        <input id="profile-name-${escapeHtml(profile.path)}" type="text" value="${draftName}" maxlength="80" data-docked-field="profileName" data-profile-path="${escapeHtml(profile.path)}">
      </div>
      <div class="docked-profile-grid-row">
        <label for="profile-character-${escapeHtml(profile.path)}">${escapeHtml(t("screenVision.profiles.characterLabel"))}</label>
        <input id="profile-character-${escapeHtml(profile.path)}" type="text" value="${draftCharacterName}" maxlength="64" data-docked-field="profileCharacterName" data-profile-path="${escapeHtml(profile.path)}">
      </div>
      <div class="docked-profile-save-row">
        <button type="button" class="docked-profile-save-button" data-docked-action="save-profile-edit" data-profile-path="${escapeHtml(profile.path)}" data-tooltip="${escapeHtml(t("sidePanel.profiles.save"))}" aria-label="${escapeHtml(t("sidePanel.profiles.save"))}">
          <img src="${escapeHtml(saveImage)}" alt="">
        </button>
      </div>
    </div>
  `;
}

function renderDockedProfileCreateCard(options = {}) {
  const emptyStateMode = options.emptyStateMode === true;
  const idSuffix = options.idSuffix ? `-${escapeHtml(String(options.idSuffix))}` : "";
  const profileName = escapeHtml(state.profileDraft.profileName || "");
  const characterName = escapeHtml(state.profileDraft.characterName || "");
  const saveImage = "assets/ui/Tick.png";
  const submitting = Boolean(state.profileCreateSubmitting);
  const emptyStateFields = emptyStateMode
    ? `
      <div class="docked-profile-grid-row empty-state-inline empty-state-inputs-only">
        <input id="profile-create-name${idSuffix}" type="text" value="${profileName}" maxlength="80" placeholder="${escapeHtml(t("screenVision.profiles.namePlaceholder"))}" data-docked-field="profileCreateName" data-empty-field="profileCreateName">
        <input id="profile-create-char${idSuffix}" type="text" value="${characterName}" maxlength="64" placeholder="${escapeHtml(t("screenVision.profiles.characterPlaceholder"))}" data-docked-field="profileCreateCharacterName" data-empty-field="profileCreateCharacterName">
      </div>
    `
    : `
      <div class="docked-profile-grid-row">
        <label for="profile-create-name${idSuffix}">${escapeHtml(t("screenVision.profiles.nameLabel"))}</label>
        <input id="profile-create-name${idSuffix}" type="text" value="${profileName}" maxlength="80" data-docked-field="profileCreateName">
      </div>
      <div class="docked-profile-grid-row">
        <label for="profile-create-char${idSuffix}">${escapeHtml(t("screenVision.profiles.characterLabel"))}</label>
        <input id="profile-create-char${idSuffix}" type="text" value="${characterName}" maxlength="64" data-docked-field="profileCreateCharacterName">
      </div>
    `;

  return `
    <div class="docked-profile-create-card${emptyStateMode ? " empty-state-mode" : ""}">
      ${emptyStateFields}
      <div class="docked-profile-save-row${emptyStateMode ? " centered" : ""}">
        <button
          type="button"
          class="docked-profile-save-button${submitting ? " is-submitting" : ""}"
          data-docked-action="save-profile-create"
          ${emptyStateMode ? 'data-empty-action="save-profile-create"' : ""}
          data-tooltip="${escapeHtml(submitting ? t("sidePanel.profiles.creating") : t("sidePanel.profiles.save"))}"
          aria-label="${escapeHtml(submitting ? t("sidePanel.profiles.creating") : t("sidePanel.profiles.save"))}"
          ${submitting ? "disabled" : ""}
        >
          <img src="${escapeHtml(saveImage)}" alt="">
        </button>
      </div>
    </div>
  `;
}

function getDockedProfileAvatarPath(summary) {
  const outfitPath = getVocationOutfitPath(summary?.vocation, summary?.sex);
  return outfitPath || PROFILE_PANEL_ASSETS.noVocation;
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

function renderFirstMirrorPromptCard() {
  return "";
}

function setProfileDraftFromEntry(profile) {
  state.profileDraft.profileName = profile?.name || "";
  state.profileDraft.characterName = profile?.characterName || "";
}

function clearProfileDraft() {
  state.profileDraft.profileName = "";
  state.profileDraft.characterName = "";
}

async function createDockedProfileFromDraft() {
  if (state.profileCreateSubmitting) {
    return;
  }

  state.profileCreateSubmitting = true;
  document
    .querySelectorAll('[data-docked-action="save-profile-create"], [data-empty-action="save-profile-create"]')
    .forEach((button) => {
      button.disabled = true;
      button.classList.add("is-submitting");
      button.setAttribute("aria-label", t("sidePanel.profiles.creating"));
      button.dataset.tooltip = t("sidePanel.profiles.creating");
    });

  const profileName = String(state.profileDraft.profileName || "").trim() || "Perfil";
  const characterName = String(state.profileDraft.characterName || "").trim();

  try {
    await window.screenVisionApi.profiles.create(profileName, characterName).catch(() => null);
    clearProfileDraft();
    state.profilesPanelExpandedEditPath = "";
    state.mirrorCreationNudgeDismissed = false;
    await loadDockedProfilesState();
    await refreshAll();
  } finally {
    state.profileCreateSubmitting = false;
    document
      .querySelectorAll('[data-docked-action="save-profile-create"], [data-empty-action="save-profile-create"]')
      .forEach((button) => {
        button.disabled = false;
        button.classList.remove("is-submitting");
        button.setAttribute("aria-label", t("sidePanel.profiles.save"));
        button.dataset.tooltip = t("sidePanel.profiles.save");
      });
  }
}

async function saveDockedProfileEdit(profilePath) {
  const profile = state.profilesIndex.find((entry) => entry.path === profilePath) || null;

  if (!profile) {
    return;
  }

  const profileName = String(state.profileDraft.profileName || profile.name || "").trim() || "Perfil";
  const characterName = String(state.profileDraft.characterName || profile.characterName || "").trim();

  await window.screenVisionApi.profiles.update(profilePath, {
    profileName,
    characterName
  }).catch(() => null);

  state.profilesPanelExpandedEditPath = "";
  await loadDockedProfilesState();
  await refreshAll();
}

async function handleDockedProfilesPanelClick(event) {
  const button = event.target.closest("[data-docked-action]");

  if (!button) {
    return;
  }

  hideFloatingTooltip();

  const action = button.dataset.dockedAction || "";
  const profilePath = button.dataset.profilePath || "";

  if (action === "close-panel") {
    state.profilesPanelExpandedEditPath = "";
    clearProfileDraft();
    await window.screenVisionApi.tools.open("profiles-panel").catch(() => null);
    return;
  }

  if (action === "create-profile") {
    state.profilesPanelExpandedEditPath = PROFILE_CREATE_SENTINEL;
    clearProfileDraft();
    renderDockedPanel();
    return;
  }

  if (action === "save-profile-create") {
    await createDockedProfileFromDraft();
    return;
  }

  if (action === "import-profile") {
    await window.screenVisionApi.profiles.import().catch(() => null);
    await loadDockedProfilesState();
    await refreshAll();
    return;
  }

  if (action === "export-profile") {
    const activeProfile = state.profilesIndex.find((entry) => entry.isActive) || state.profilesIndex[0] || null;
    if (!activeProfile) {
      return;
    }
    await window.screenVisionApi.profiles.export(activeProfile.path).catch(() => null);
    return;
  }

  if (!profilePath) {
    return;
  }

  const profile = state.profilesIndex.find((entry) => entry.path === profilePath) || null;
  if (!profile) {
    return;
  }

  if (action === "activate-profile") {
    await window.screenVisionApi.profiles.activate(profilePath).catch(() => null);
    state.profilesPanelExpandedEditPath = "";
    await loadDockedProfilesState();
    await refreshAll();
    return;
  }

  if (action === "toggle-profile-edit") {
    const nextOpen = state.profilesPanelExpandedEditPath !== profilePath;
    state.profilesPanelExpandedEditPath = nextOpen ? profilePath : "";
    if (nextOpen) {
      setProfileDraftFromEntry(profile);
    } else {
      clearProfileDraft();
    }
    renderDockedPanel();
    return;
  }

  if (action === "save-profile-edit") {
    await saveDockedProfileEdit(profilePath);
    return;
  }

  if (action === "duplicate-profile") {
    const confirmed = await confirmExternalModal({
      title: t("screenVision.profiles.duplicateModalTitle"),
      message: t("screenVision.profiles.duplicateModalMessage", { name: profile.name }),
      confirmLabel: t("screenVision.profiles.duplicateButton"),
      cancelLabel: t("common.cancel"),
      tone: "warning",
      mediaPath: "assets/ui/tools/tibia-eye/states/atencao.gif"
    });

    if (!confirmed.confirmed) {
      return;
    }

    await window.screenVisionApi.profiles.duplicate(profilePath).catch(() => null);
    await loadDockedProfilesState();
    await refreshAll();
    return;
  }

  if (action === "delete-profile") {
    const confirmed = await confirmExternalModal({
      title: "Confirmar Exclusao",
      message: `Deletar perfil "${profile.name}"?`,
      confirmLabel: "Sim",
      cancelLabel: "Cancelar",
      checkboxLabel: "Nao perguntar novamente nesta sessao",
      sessionKey: "delete-profile-v2"
    });

    if (!confirmed.confirmed) {
      return;
    }

    await window.screenVisionApi.profiles.delete(profilePath).catch(() => null);
    if (state.profilesPanelExpandedEditPath === profilePath) {
      state.profilesPanelExpandedEditPath = "";
    }
    await loadDockedProfilesState();
    await refreshAll();
  }
}

function handleDockedProfilesPanelInput(event) {
  const field = event.target.dataset.dockedField || "";
  if (!field) {
    return;
  }

  if (field === "profileCreateName" || field === "profileName") {
    state.profileDraft.profileName = String(event.target.value || "").slice(0, 80);
    return;
  }

  if (field === "profileCreateCharacterName" || field === "profileCharacterName") {
    state.profileDraft.characterName = String(event.target.value || "").slice(0, 64);
  }
}

function handleDockedProfilesPanelChange(event) {
  handleDockedProfilesPanelInput(event);
}

async function handleEmptyStateClick(event) {
  const button = event.target.closest("[data-empty-action]");

  if (!button) {
    return;
  }

  const action = button.dataset.emptyAction || "";
  if (action === "save-profile-create") {
    await createDockedProfileFromDraft();
  }
}

function handleEmptyStateInput(event) {
  const field = event.target.dataset.emptyField || "";
  if (!field) {
    return;
  }

  if (field === "profileCreateName") {
    state.profileDraft.profileName = String(event.target.value || "").slice(0, 80);
    return;
  }

  if (field === "profileCreateCharacterName") {
    state.profileDraft.characterName = String(event.target.value || "").slice(0, 64);
  }
}

function buildDockedAlertSoundLibrary() {
  const unique = new Map();

  for (const option of ALERT_DOCKED_SOUND_OPTIONS) {
    if (!option?.value || unique.has(option.value)) {
      continue;
    }
    unique.set(option.value, option);
  }

  for (const preset of SCREEN_VISION_SPELL_PRESETS) {
    if (!preset?.soundKey || preset.soundKey === "default" || !preset.soundPath || unique.has(preset.soundKey)) {
      continue;
    }

    unique.set(preset.soundKey, {
      value: preset.soundKey,
      label: preset.name || preset.soundLabel || preset.words || preset.soundKey,
      soundPath: preset.soundPath,
      spellWords: preset.words || "",
      presetId: preset.id || ""
    });
  }

  return [...unique.values()];
}

function getDockedAlertSpellPresetsForVocation(vocationKey) {
  const key = String(vocationKey || "").trim().toLowerCase();
  if (!key) {
    return [];
  }
  return SCREEN_VISION_SPELL_PRESETS.filter((preset) => Array.isArray(preset.vocations) && preset.vocations.includes(key));
}

function getDockedAlertSpellPresetsByCategory(vocationKey) {
  const presets = getDockedAlertSpellPresetsForVocation(vocationKey);
  return DOCKED_ALERT_MAGIC_CATEGORY_ORDER.map((categoryKey) => ({
    key: categoryKey,
    label: DOCKED_ALERT_MAGIC_CATEGORY_LABELS[categoryKey] || categoryKey,
    items: presets.filter((preset) => preset.category === categoryKey)
  })).filter((section) => section.items.length > 0);
}

function getDockedAlertSoundOption(soundKey) {
  return DOCKED_ALERT_SOUND_OPTIONS_BY_KEY.get(String(soundKey || "").trim()) || null;
}

function extractFileName(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/").trim();
  if (!normalized) {
    return "";
  }
  return normalized.split("/").filter(Boolean).pop() || normalized;
}

function getDockedAlertSelectedSoundLabel(timer) {
  if (!timer) {
    return "Som padrao";
  }

  if (typeof timer.customSoundPath === "string" && timer.customSoundPath.trim()) {
    return extractFileName(timer.customSoundPath.trim());
  }

  const option = getDockedAlertSoundOption(timer.soundKey);
  return option?.label || "Som padrao";
}

async function createDockedAlertTimerFromDraft(draft, options = {}) {
  const items = Array.isArray(state.overlayTools?.timers?.items) ? state.overlayTools.timers.items : [];

  if (items.length >= ALERT_PANEL_MAX_TIMERS) {
    if (options.trigger) {
      flashBlockedActionTooltip(options.trigger, `Limite atual de ${ALERT_PANEL_MAX_TIMERS} alertas atingido.`);
    }
    return null;
  }

  const timer = createOverlayTimerEntryFromDraft({
    ...createDefaultOverlayTimerDraft(),
    ...draft
  });

  state.overlayTools.timers.items.push(timer);
  resetDockedAlertTransientUiState();
  state.dockedAlertsView = "cards";
  state.dockedPanelPendingScrollTargetId = timer.id;
  state.dockedAlertExpandedConfigId = timer.id;
  state.dockedAlertExpandedSoundId = options.expandSound === true ? timer.id : "";
  state.dockedAlertSoundMenuTimerId = options.openSoundMenu === true ? timer.id : "";
  state.dockedAlertCapturingHotkeyId = "";
  renderDockedPanel();

  const focusField = String(options.focusField || "").trim();
  if (focusField) {
    focusDockedAlertField(timer.id, focusField);
    window.requestAnimationFrame(() => {
      els.dockedPanelHost
        ?.querySelector(`[data-docked-field="${cssEscape(focusField)}"][data-timer-id="${cssEscape(timer.id)}"]`)
        ?.select?.();
    });
  }

  await persistDockedAlertsState();

  return timer;
}

async function createDockedBlankSpellAlert(trigger = null) {
  return createDockedAlertTimerFromDraft({
    name: "",
    durationSeconds: 60,
    soundKey: "default",
    customSoundPath: "",
    message: "",
    showVisualAlert: true,
    reminderEnabled: false,
    retriggerEnabled: true,
    locked: false
  }, {
    trigger,
    focusField: "timerName"
  });
}

async function createDockedSpellPresetAlert(spellPreset, trigger = null) {
  if (!spellPreset) {
    return null;
  }

  return createDockedAlertTimerFromDraft({
    name: spellPreset.name || "",
    durationSeconds: clampInteger(spellPreset.cooldownSeconds, 1, 43200, 60),
    soundKey: spellPreset.soundPath ? (spellPreset.soundKey || "default") : "default",
    customSoundPath: "",
    message: spellPreset.words || "",
    showVisualAlert: false,
    reminderEnabled: false,
    retriggerEnabled: true,
    locked: false
  }, {
    trigger,
    focusField: "timerName"
  });
}

function renderDockedAlertSpellPicker() {
  const vocationKey = String(state.dockedAlertsMagicVocation || "knight").trim().toLowerCase();
  const activeVocation = DOCKED_ALERT_MAGIC_VOCATION_OPTIONS.find((entry) => entry.key === vocationKey) || DOCKED_ALERT_MAGIC_VOCATION_OPTIONS[0];
  const sections = getDockedAlertSpellPresetsByCategory(activeVocation.key);

  return `
    <div class="docked-alert-magic-panel">
      <div class="docked-alert-magic-create">
        <button
          type="button"
          class="docked-alert-magic-create-button"
          data-docked-action="create-alert-spell-blank"
          data-tooltip="${escapeHtml(t("screenVision.alerts.createSpell"))}"
          aria-label="${escapeHtml(t("screenVision.alerts.createSpell"))}"
        >
          <img src="${escapeHtml(DOCKED_ALERT_MAGIC_CREATE_ASSET)}" alt="">
        </button>
      </div>
      <div class="desktop-docked-tool-divider" aria-hidden="true"></div>
      <div class="docked-alert-magic-vocations" data-alert-tutorial-focus="magic-vocations">
        ${DOCKED_ALERT_MAGIC_VOCATION_OPTIONS.map((entry) => `
          <button
            type="button"
            class="docked-alert-magic-vocation-button${entry.key === activeVocation.key ? " active" : ""}"
            data-docked-action="select-alert-magic-vocation"
            data-vocation-key="${escapeHtml(entry.key)}"
            data-tooltip="${escapeHtml(t("screenVision.alerts.spellsOf", { vocation: entry.label }))}"
            aria-label="${escapeHtml(t("screenVision.alerts.spellsOf", { vocation: entry.label }))}"
          >
            <img src="${escapeHtml(entry.asset)}" alt="">
          </button>
        `).join("")}
      </div>
      <div class="desktop-docked-tool-divider" aria-hidden="true"></div>
      <div class="docked-alert-magic-sections">
        ${sections.map((section, sectionIndex) => `
          <section class="docked-alert-magic-section" data-alert-magic-category="${escapeHtml(section.key)}">
            ${sectionIndex > 0 ? '<div class="desktop-docked-tool-divider" aria-hidden="true"></div>' : ""}
            <h4>${escapeHtml(section.label)}</h4>
            <div class="docked-alert-magic-grid">
              ${section.items.map((preset) => `
                <button
                  type="button"
                  class="docked-alert-magic-spell-button"
                  data-docked-action="create-alert-from-spell-preset"
                  data-spell-preset-id="${escapeHtml(preset.id)}"
                  data-tooltip="${escapeHtml(`${preset.name}\n${preset.words}`)}"
                  aria-label="${escapeHtml(preset.name)}"
                >
                  <img src="${escapeHtml(preset.imagePath)}" alt="${escapeHtml(preset.name)}">
                </button>
              `).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    </div>
  `;
}

function renderDockedAlertSoundExtension(timer, expanded, menuOpen) {
  if (!expanded) {
    return "";
  }

  const selectedLabel = getDockedAlertSelectedSoundLabel(timer);

  return `
    <div class="docked-alert-extension audio-setting">
      <div class="docked-alert-extension-divider" aria-hidden="true"></div>
      <div class="docked-alert-sound-panel">
        <div class="docked-alert-sound-row">
          <span class="docked-alert-sound-label">${escapeHtml(t("screenVision.alerts.audioLabel"))}</span>
          <button
            type="button"
            class="docked-alert-sound-select-button${menuOpen ? " active" : ""}"
            data-docked-action="toggle-alert-sound-menu"
            data-timer-id="${escapeHtml(timer.id)}"
            data-tooltip="${escapeHtml(t("screenVision.alerts.selectAudio"))}"
            aria-label="${escapeHtml(t("screenVision.alerts.selectAudio"))}"
          >
            <strong>${escapeHtml(selectedLabel)}</strong>
            <span class="docked-alert-sound-chevron" aria-hidden="true">▾</span>
          </button>
        </div>
        ${menuOpen ? `
          <div class="docked-alert-sound-menu">
            <button
              type="button"
              class="docked-alert-sound-option is-custom"
              data-docked-action="pick-alert-sound-custom"
              data-timer-id="${escapeHtml(timer.id)}"
              data-tooltip="${escapeHtml(t("screenVision.alerts.loadOwnAudio"))}"
              aria-label="${escapeHtml(t("screenVision.alerts.loadOwnAudio"))}"
            >
              ${escapeHtml(t("screenVision.alerts.loadOwnAudio"))}
            </button>
            ${DOCKED_ALERT_SOUND_LIBRARY.map((option) => `
              <button
                type="button"
                class="docked-alert-sound-option${timer.soundKey === option.value && !timer.customSoundPath ? " active" : ""}"
                data-docked-action="select-alert-sound-preset"
                data-timer-id="${escapeHtml(timer.id)}"
                data-sound-key="${escapeHtml(option.value)}"
                data-tooltip="${escapeHtml(option.label)}"
                aria-label="${escapeHtml(option.label)}"
              >
                ${escapeHtml(option.label)}
              </button>
            `).join("")}
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function renderDockedAlertPanel(panelState, copy) {
  const timers = Array.isArray(state.overlayTools?.timers?.items)
    ? state.overlayTools.timers.items.map((entry) => normalizeOverlayTimerEntry(entry)).filter(Boolean)
    : [];
  const listeningDesired = Boolean(state.overlayTools?.timers?.isListening);
  const visualsDesired = Boolean(state.overlayTools?.timers?.visualsEnabled);
  const tibiaReadyForAlerts = isTibiaReadyForAlertSignals();
  const listening = tibiaReadyForAlerts && listeningDesired;
  const visualsEnabled = tibiaReadyForAlerts && visualsDesired;
  const listeningPaused = !tibiaReadyForAlerts && listeningDesired;
  const visualsPaused = !tibiaReadyForAlerts && visualsDesired;
  const globalVolumePercent = clampInteger(state.overlayTools?.timers?.globalVolumePercent, 0, 100, 70);
  const magicMode = state.dockedAlertsView === "magias";

  return renderDockedToolShell({
    side: panelState.side,
    title: copy.title || "Alertas",
    subtitle: state.alertProfileLabel || "tibia mirror",
    shellClassName: "docked-alerts-shell",
    contentClassName: "docked-alerts-content",
    bodyMarkup: renderDockedToolStage({
      className: "docked-alerts-stage",
      toolbarMarkup: `
        <div class="desktop-docked-tool-toolbar docked-alerts-toolbar">
          <div class="desktop-docked-tool-toolbar-left docked-alerts-toolbar-left">
            <button
              type="button"
              class="docked-alert-tile${listening ? " active" : " inactive"}${listeningPaused ? " paused" : ""}"
              data-docked-action="toggle-alerts-global"
              data-tooltip="${escapeHtml(listening ? t("screenVision.alerts.disableAllSounds") : t("screenVision.alerts.enableAllSounds"))}"
              aria-label="${escapeHtml(listening ? t("screenVision.alerts.disableAllSounds") : t("screenVision.alerts.enableAllSounds"))}"
            >
              <img src="${escapeHtml("assets/ui/tools/tibia-eye/toolbar/avisos.gif")}" alt="">
            </button>
            <button
              type="button"
              class="docked-alert-tile${visualsEnabled ? " active" : " inactive"}${visualsPaused ? " paused" : ""}"
              data-docked-action="toggle-alerts-visual-global"
              data-tooltip="${escapeHtml(visualsEnabled ? t("screenVision.alerts.disableAllVisuals") : t("screenVision.alerts.enableAllVisuals"))}"
              aria-label="${escapeHtml(visualsEnabled ? t("screenVision.alerts.disableAllVisuals") : t("screenVision.alerts.enableAllVisuals"))}"
            >
              <img src="${escapeHtml(visualsEnabled ? TOOLBAR_STATE_ASSETS.visible : TOOLBAR_STATE_ASSETS.hidden)}" alt="">
            </button>
            <label class="docked-alert-master-volume audio-setting${listening ? " blocked" : ""}" data-tooltip="${escapeHtml(t("screenVision.alerts.globalVolume"))}">
              <input type="range" min="0" max="100" step="1" value="${escapeHtml(String(globalVolumePercent))}" style="--alert-volume-percent:${escapeHtml(String(globalVolumePercent))}%;" data-docked-field="globalVolumePercent">
              <strong>${escapeHtml(String(globalVolumePercent))}%</strong>
            </label>
          </div>
          <div class="desktop-docked-tool-toolbar-right docked-alerts-toolbar-right">
            <button
              type="button"
              class="docked-alert-tile docked-alert-action-tile"
              data-docked-action="toggle-alerts-view"
              data-tooltip="${escapeHtml(magicMode ? t("screenVision.alerts.closeSpellPanel") : t("screenVision.alerts.openSpellPanel"))}"
              aria-label="${escapeHtml(magicMode ? t("screenVision.alerts.closeSpellPanel") : t("screenVision.alerts.openSpellPanel"))}"
            >
              <img src="${escapeHtml("assets/data/hakai/icons/images-static-items-lion-spellbook.gif")}" alt="">
            </button>
            <strong class="desktop-docked-tool-count docked-alert-count">${escapeHtml(String(timers.length))}/${ALERT_PANEL_MAX_TIMERS}</strong>
          </div>
        </div>
      `,
      dividerMarkup: `<div class="desktop-docked-tool-divider docked-alerts-toolbar-divider" aria-hidden="true"></div>`,
      bodyMarkup: magicMode
        ? renderDockedAlertSpellPicker()
        : renderDockedAlertCards(timers)
    })
  });
}

function renderDockedAlertCards(timers) {
  if (!timers.length) {
    return `<div class="profiles-empty-state">${escapeHtml(t("screenVision.alerts.noneCreated"))}</div>`;
  }

  return `
    <div class="docked-alert-cards">
      ${timers.map((timer, index) => renderDockedAlertCard(timer, index)).join("")}
    </div>
  `;
}

function renderDockedAlertCard(timer, index) {
  const globalListening = Boolean(state.overlayTools?.timers?.isListening);
  const globalVisualsEnabled = Boolean(state.overlayTools?.timers?.visualsEnabled);
  const visualEnabled = timer.showVisualAlert !== false;
  const reminderEnabled = Boolean(timer.reminderEnabled);
  const reminderEditLocked = globalListening || globalVisualsEnabled;
  const runtime = state.alertRuntimeById?.[timer.id] || null;
  const muted = Boolean(timer.volumeMuted);
  const volumePercent = clampInteger(timer.volumePercent, 0, 100, 100);
  const audioEnabled = timer.enabled !== false && !muted && volumePercent > 0;
  const editingLocked = Boolean(timer.locked);
  const audioUiLocked = globalListening;
  const showVisualDurationField = !globalListening || !audioEnabled;
  const expandedConfig = state.dockedAlertExpandedConfigId === timer.id;
  const expandedVisual = !visualEnabled && !globalVisualsEnabled;
  const expandedReminder = reminderEnabled;
  const expandedSound = state.dockedAlertExpandedSoundId === timer.id;
  const soundMenuOpen = state.dockedAlertSoundMenuTimerId === timer.id;
  const pickerOpen = state.dockedAlertColorPickerTimerId === timer.id;
  const capturingHotkey = state.dockedAlertCapturingHotkeyId === timer.id;
  const savedColors = Array.isArray(timer.savedAlertColors) && timer.savedAlertColors.length
    ? timer.savedAlertColors
    : ["#ffffff", "#ff4444", "#0088ff", "#69df72"];
  const panelOpen = expandedConfig || expandedVisual || expandedReminder || expandedSound;
  const visualDurationValue = formatDockedAlertVisualDuration(timer.alertDurationSeconds);

  return `
    <article class="docked-alert-card${panelOpen ? " expanded" : ""}${audioUiLocked ? " audio-locked" : ""}" data-alert-timer-id="${escapeHtml(timer.id)}">
      <div class="docked-alert-card-main">
        <div class="docked-alert-card-title-row">
          <strong>${escapeHtml(timer.name || `Alerta ${index + 1}`)}</strong>
          <div class="docked-alert-card-title-meta">
            ${renderDockedAlertHotkeySummaryButton(timer, capturingHotkey)}
            ${runtime ? `<span class="docked-alert-runtime-chip${runtime.phase === "waiting-reminder" ? " reminder" : ""}">${escapeHtml(formatOverlayTimerDuration(runtime.remainingSeconds))}</span>` : ""}
          </div>
        </div>
        <div class="docked-alert-card-control-row">
          <div class="docked-alert-card-actions">
            <button type="button" class="docked-alert-icon-button audio-setting${expandedConfig ? " active" : ""}" data-docked-action="toggle-alert-config" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.editNameTimeHotkey"))}" aria-label="${escapeHtml(t("screenVision.alerts.editNameTimeHotkey"))}">${renderIcon("edit")}</button>
            <button type="button" class="docked-alert-icon-button danger" data-docked-action="delete-alert" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("common.deleteAlert"))}" aria-label="${escapeHtml(t("common.deleteAlert"))}">${renderIcon("trash")}</button>
            <button type="button" class="docked-alert-icon-button audio-setting${timer.retriggerEnabled ? "" : " inactive slashed"}" data-docked-action="toggle-alert-retrigger" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(timer.retriggerEnabled ? t("screenVision.alerts.retriggerOff") : t("screenVision.alerts.retriggerOn"))}" aria-label="${escapeHtml(t("screenVision.alerts.retriggerAria"))}">${renderIcon("refresh")}</button>
            <button type="button" class="docked-alert-icon-button${visualEnabled || expandedVisual ? "" : " inactive"}" data-docked-action="toggle-alert-visual" data-alert-tutorial-focus="visual-toggle" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(visualEnabled ? t("screenVision.alerts.disableVisual") : t("screenVision.alerts.prepareVisual"))}" aria-label="${escapeHtml(t("screenVision.alerts.visualAria"))}">${renderIcon(visualEnabled ? "eye" : "eye-off")}</button>
            <button type="button" class="docked-alert-icon-button audio-setting${reminderEnabled ? "" : " inactive slashed"}" data-docked-action="toggle-alert-reminder" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(reminderEnabled ? t("screenVision.alerts.disableReminder") : t("screenVision.alerts.enableReminder"))}" aria-label="${escapeHtml(t("screenVision.alerts.reminderAria"))}">${renderIcon("thought")}</button>
            <button type="button" class="docked-alert-icon-button audio-setting${expandedSound ? " active" : ""}" data-docked-action="toggle-alert-sound" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.alertSound"))}" aria-label="${escapeHtml(t("screenVision.alerts.alertSoundAria"))}">${renderIcon("music")}</button>
          </div>
          <div class="docked-alert-volume-row">
            <button type="button" class="docked-alert-icon-button small${audioEnabled ? "" : " inactive"}" data-docked-action="toggle-alert-muted" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(audioEnabled ? t("screenVision.alerts.mute") : t("screenVision.alerts.enableSound"))}" aria-label="${escapeHtml(t("screenVision.alerts.alertVolumeAria"))}">${renderIcon(audioEnabled ? "volume" : "volume-off")}</button>
            <label class="docked-alert-inline-volume audio-setting" data-tooltip="${escapeHtml("Ajustar o volume deste alerta.")}">
              <input type="range" min="0" max="100" step="1" value="${escapeHtml(String(volumePercent))}" style="--alert-volume-percent:${escapeHtml(String(volumePercent))}%;" data-docked-field="timerVolumePercent" data-timer-id="${escapeHtml(timer.id)}">
              <strong>${escapeHtml(String(volumePercent))}%</strong>
            </label>
          </div>
        </div>
      </div>
      ${expandedConfig ? `
        <div class="docked-alert-extension docked-alert-config-extension audio-setting">
          <div class="docked-alert-extension-divider" aria-hidden="true"></div>
          <div class="docked-alert-grid-row docked-alert-grid-row-config">
            <label>${escapeHtml(t("screenVision.alerts.cardNameLabel"))}</label>
            <input type="text" maxlength="80" value="${escapeHtml(timer.name || "")}" placeholder="${escapeHtml(t("screenVision.alerts.cardNamePlaceholder"))}" data-docked-field="timerName" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.cardNameTooltip"))}">
            <label>${escapeHtml(t("screenVision.alerts.timeLabel"))}</label>
            <input type="number" min="1" max="43200" step="1" value="${escapeHtml(String(timer.durationSeconds || 60))}" data-docked-field="timerDurationSeconds" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.durationTooltip"))}">
          </div>
          <div class="docked-alert-hotkey-builder">
            <span class="docked-alert-hotkey-builder-label${capturingHotkey ? " capturing" : ""}">${escapeHtml(capturingHotkey ? t("screenVision.alerts.hotkeyClearPrompt") : t("screenVision.alerts.hotkeyPickPrompt"))}</span>
            <button type="button" class="docked-alert-hotkey-capture${capturingHotkey ? " capturing" : ""}" data-docked-action="focus-alert-hotkey" data-docked-hotkey-capture="true" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.hotkeyCapture"))}" aria-label="${escapeHtml(t("screenVision.alerts.hotkeyAria"))}">
              ${renderDockedAlertHotkeyKeycaps(timer, capturingHotkey)}
            </button>
          </div>
        </div>
      ` : ""}
      ${expandedVisual ? `
        <div class="docked-alert-extension visual-setting${editingLocked ? " locked" : ""}">
          <div class="docked-alert-extension-divider" aria-hidden="true"></div>
          <div class="docked-alert-grid-row docked-alert-grid-row-message${showVisualDurationField ? " with-duration" : ""}" data-alert-tutorial-focus="visual-message-duration">
            <label>${escapeHtml(t("screenVision.alerts.messageLabel"))}</label>
            <input type="text" maxlength="25" value="${escapeHtml(timer.message || "")}" placeholder="${escapeHtml(t("screenVision.alerts.messagePlaceholder"))}" data-docked-field="timerMessage" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.messageTooltip"))}">
            ${showVisualDurationField ? `
              <label>${escapeHtml(t("screenVision.alerts.screenLabel"))}</label>
              <input type="number" min="${ALERT_DISPLAY_DURATION_MIN_SECONDS}" max="${ALERT_DISPLAY_DURATION_MAX_SECONDS}" step="0.1" value="${escapeHtml(visualDurationValue)}" data-docked-field="timerAlertDurationSeconds" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.screenDurationTooltip"))}">
            ` : ""}
          </div>
          <div class="docked-alert-grid-row docked-alert-grid-row-fonts" data-alert-tutorial-focus="visual-fonts">
            <label>${escapeHtml(t("screenVision.alerts.fontLabel"))}</label>
            <select data-docked-field="timerFontFamily" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.fontTooltip"))}">
              ${ALERT_DOCKED_FONT_FAMILY_OPTIONS.map((option) => `
                <option value="${escapeHtml(option.value)}"${option.value === timer.alertFontFamily ? " selected" : ""}>${escapeHtml(option.label)}</option>
              `).join("")}
            </select>
            <label>${escapeHtml(t("screenVision.alerts.weightLabel"))}</label>
            <select data-docked-field="timerFontWeight" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.weightTooltip"))}">
              ${ALERT_DOCKED_FONT_WEIGHT_OPTIONS.map((option) => `
                <option value="${option.value}"${Number(timer.alertFontWeight) === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>
              `).join("")}
            </select>
          </div>
          <div class="docked-alert-grid-row docked-alert-grid-row-visual" data-alert-tutorial-focus="visual-style">
            <button type="button" class="docked-alert-icon-button${timer.locked ? "" : " inactive"}" data-docked-action="toggle-alert-lock" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(timer.locked ? t("screenVision.alerts.unlockPreview") : t("screenVision.alerts.lockPreview"))}" aria-label="${escapeHtml(t("screenVision.alerts.previewLockAria"))}">${renderIcon(timer.locked ? "lock-closed" : "lock-open")}</button>
            <button type="button" class="docked-alert-icon-button${timer.alertShadowEnabled !== false ? "" : " inactive slashed"}" data-docked-action="toggle-alert-shadow" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(timer.alertShadowEnabled !== false ? t("screenVision.alerts.disableShadow") : t("screenVision.alerts.enableShadow"))}" aria-label="${escapeHtml(t("screenVision.alerts.shadowAria"))}">${renderIcon("shadow")}</button>
            <button type="button" class="docked-alert-color-trigger" data-docked-action="toggle-alert-color-picker" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.chooseColor"))}" aria-label="${escapeHtml(t("screenVision.alerts.colorAria"))}">
              <span style="background:${escapeHtml(timer.alertColor || "#ffffff")}"></span>
            </button>
            <div class="docked-alert-inline-hint">${escapeHtml(timer.locked ? t("screenVision.alerts.unlockHint") : t("screenVision.alerts.lockHint"))}</div>
          </div>
          ${pickerOpen ? `
            <div class="docked-alert-color-picker">
              <div class="docked-alert-color-picker-shell">
                <div class="docked-alert-color-picker-footer">
                  <label class="docked-alert-color-picker-native" data-tooltip="${escapeHtml(t("screenVision.sqm.openColorPicker"))}">
                    <input type="color" value="${escapeHtml(timer.alertColor || "#ffffff")}" data-docked-field="timerAlertColorLive" data-timer-id="${escapeHtml(timer.id)}">
                    ${renderIcon("palette")}
                  </label>
                  <input type="text" value="${escapeHtml((timer.alertColor || "#ffffff").toUpperCase())}" maxlength="7" data-docked-field="timerAlertColorHex" data-timer-id="${escapeHtml(timer.id)}">
                  <button type="button" class="docked-alert-icon-button small" data-docked-action="save-alert-color" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.sqm.saveColor"))}" aria-label="${escapeHtml(t("screenVision.sqm.saveColorAria"))}">${renderIcon("save")}</button>
                  <button type="button" class="docked-alert-icon-button small danger" data-docked-action="delete-alert-color" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.sqm.deleteColor"))}" aria-label="${escapeHtml(t("screenVision.sqm.deleteColorAria"))}">${renderIcon("trash")}</button>
                </div>
                <div class="docked-alert-color-picker-divider" aria-hidden="true"></div>
                <div class="docked-alert-color-swatches">
                  ${savedColors.map((color) => `
                    <button type="button" class="docked-alert-color-swatch${String(timer.alertColor || "").toLowerCase() === String(color).toLowerCase() ? " active" : ""}${String(color).toLowerCase() === "#ffffff" ? " is-white" : ""}" style="background:${escapeHtml(color)}" data-alert-color-swatch="${escapeHtml(color)}" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(color.toUpperCase())}" aria-label="${escapeHtml(t("screenVision.sqm.useColor", { color: color.toUpperCase() }))}"></button>
                  `).join("")}
                </div>
              </div>
            </div>
          ` : ""}
        </div>
      ` : ""}
      ${expandedReminder ? `
        <div class="docked-alert-extension audio-setting${reminderEditLocked ? " reminder-locked" : ""}">
          <div class="docked-alert-extension-divider" aria-hidden="true"></div>
          <div class="docked-alert-grid-row docked-alert-grid-row-reminder">
            <label data-tooltip="${escapeHtml(t("screenVision.alerts.reminderDelayTooltip"))}">${escapeHtml(t("screenVision.alerts.timeLabel"))}</label>
            <input type="number" min="1" max="3600" step="1" value="${escapeHtml(String(timer.reminderDelaySeconds || 10))}" data-docked-field="timerReminderDelaySeconds" data-timer-id="${escapeHtml(timer.id)}">
            <label data-tooltip="${escapeHtml(t("screenVision.alerts.reminderCountTooltip"))}">${escapeHtml(t("screenVision.alerts.reminderCountLabel"))}</label>
            <input type="number" min="1" max="10" step="1" value="${escapeHtml(String(timer.reminderRepeatCount || 2))}" data-docked-field="timerReminderRepeatCount" data-timer-id="${escapeHtml(timer.id)}">
          </div>
        </div>
      ` : ""}
      ${renderDockedAlertSoundExtension(timer, expandedSound, soundMenuOpen)}
    </article>
  `;
}

async function handleDockedPanelClick(event) {
  if (isDockedSqmFinderPanelOpen()) {
    await handleDockedSqmFinderPanelClick(event);
    return;
  }

  if (isDockedSupportersPanelOpen()) {
    await handleDockedSupportersPanelClick(event);
    return;
  }

  if (isDockedSettingsPanelOpen()) {
    await handleDockedSettingsPanelClick(event);
    return;
  }

  if (isDockedCoffeePanelOpen()) {
    await handleDockedCoffeePanelClick(event);
    return;
  }

  if (isDockedTibiaCoinsPanelOpen()) {
    await handleDockedTibiaCoinsPanelClick(event);
    return;
  }

  if (isDockedAuthenticatorPanelOpen()) {
    await handleDockedAuthenticatorPanelClick(event);
    return;
  }

  if (isDockedProfilesPanelOpen()) {
    await handleDockedProfilesPanelClick(event);
    return;
  }

  if (!isDockedAlertPanelOpen()) {
    const closeButton = event.target.closest("[data-docked-action='close-panel']");

      if (closeButton) {
        const panelKey = state.dockedPanel.panelKey || "";
        if (panelKey) {
          await window.screenVisionApi.tools.open(panelKey).catch(() => null);
      }
    }
    return;
  }

  const colorSwatch = event.target.closest("[data-alert-color-swatch]");

  if (colorSwatch) {
    const timerId = colorSwatch.dataset.timerId || "";
    const timer = findDockedAlertTimer(timerId);
    if (isDockedAlertVisualsGloballyEnabled()) {
      blockDockedAlertVisualEditing(colorSwatch, timerId);
      return;
    }
    if (timer?.showVisualAlert !== false) {
      blockDockedAlertVisualCardEditing(timerId, colorSwatch);
      return;
    }
    if (timer?.locked) {
      blockDockedAlertEditing(timerId, colorSwatch);
      return;
    }
    const color = colorSwatch.dataset.alertColorSwatch || "";
    updateDockedAlertTimer(timerId, { alertColor: color });
    await syncDockedAlertEditorForTimer(findDockedAlertTimer(timerId));
    return;
  }

  const fieldTarget = event.target.closest("[data-docked-field]");
  if (fieldTarget) {
    const timerId = fieldTarget.dataset.timerId || "";
    const field = fieldTarget.dataset.dockedField || "";
    const timer = findDockedAlertTimer(timerId);
    if (timer?.locked && isDockedAlertEditField(field)) {
      event.preventDefault();
      fieldTarget.blur?.();
      blockDockedAlertEditing(timerId, fieldTarget);
      return;
    }
  }

  const button = event.target.closest("[data-docked-action]");

  if (!button) {
    return;
  }

  hideFloatingTooltip();

  const action = button.dataset.dockedAction || "";
  const timerId = button.dataset.timerId || "";

  if (action === "close-panel") {
    resetDockedAlertTransientUiState();
    await window.screenVisionApi.tools.open("alertas-panel").catch(() => null);
    return;
  }

  if (action === "toggle-alerts-global") {
    if (!isTibiaReadyForAlertSignals()) {
      blockDockedAlertTibiaActivation(button);
      return;
    }

    state.overlayTools.timers.isListening = !state.overlayTools.timers.isListening;

    if (!state.overlayTools.timers.isListening) {
      const activeIds = Object.keys(state.alertRuntimeById || {});
      await Promise.all(activeIds.map((activeTimerId) => (
        window.screenVisionApi.timers.stop({ timerId: activeTimerId }).catch(() => null)
      )));
      state.alertRuntimeById = {};
    }

    await persistDockedAlertsState();
    renderDockedPanel();
    return;
  }

  if (action === "toggle-alerts-visual-global") {
    if (!isTibiaReadyForAlertSignals()) {
      blockDockedAlertTibiaActivation(button);
      return;
    }

    const next = !isDockedAlertVisualsGloballyEnabled();
    state.overlayTools.timers.visualsEnabled = next;

    if (!next) {
      state.dockedAlertColorPickerTimerId = "";
      await Promise.all(
        (Array.isArray(state.overlayTools?.timers?.items) ? state.overlayTools.timers.items : [])
          .map((entry) => normalizeOverlayTimerEntry(entry))
          .filter(Boolean)
          .map((timer) => window.screenVisionApi.timers.hideVisualAlert({ timerId: timer.id }).catch(() => null))
      );
    }

    await persistDockedAlertsState();
    await syncDockedAlertEditors();
    renderDockedPanel();
    return;
  }

  if (action === "toggle-alerts-view") {
    state.dockedAlertsView = state.dockedAlertsView === "cards" ? "magias" : "cards";
    renderDockedPanel();
    return;
  }

  if (action === "create-alert-spell-blank") {
    await createDockedBlankSpellAlert(button);
    return;
  }

  if (action === "select-alert-magic-vocation") {
    const vocationKey = String(button.dataset.vocationKey || "").trim().toLowerCase();
    if (!vocationKey) {
      return;
    }
    state.dockedAlertsMagicVocation = vocationKey;
    renderDockedPanel();
    return;
  }

  if (action === "create-alert-from-spell-preset") {
    const presetId = String(button.dataset.spellPresetId || "").trim();
    const preset = SCREEN_VISION_SPELL_PRESETS.find((entry) => entry.id === presetId) || null;
    await createDockedSpellPresetAlert(preset, button);
    return;
  }

  if (!timerId) {
    return;
  }

  const timer = findDockedAlertTimer(timerId);

  if (action === "toggle-alert-reminder" && isDockedAlertReminderEditingLocked()) {
    blockDockedAlertReminderEditing(button);
    return;
  }

  if (action === "toggle-alert-visual" && isDockedAlertVisualsGloballyEnabled()) {
    blockDockedAlertVisualEditing(button, timerId);
    return;
  }

  if (isDockedAlertAudioAction(action) && isDockedAlertAudioGloballyEnabled()) {
    blockDockedAlertAudioEditing(button);
    return;
  }

  if (isDockedAlertVisualAction(action) && isDockedAlertVisualsGloballyEnabled()) {
    blockDockedAlertVisualEditing(button);
    return;
  }

  if (isDockedAlertVisualAction(action) && timer?.showVisualAlert !== false) {
    blockDockedAlertVisualCardEditing(timerId, button);
    return;
  }

  if (isDockedAlertEditAction(action)) {
    if (timer?.locked) {
      blockDockedAlertEditing(timerId, button);
      return;
    }
  }

  if (action === "toggle-alert-config") {
    state.dockedAlertExpandedConfigId = state.dockedAlertExpandedConfigId === timerId ? "" : timerId;
    if (state.dockedAlertExpandedConfigId !== timerId) {
      state.dockedAlertCapturingHotkeyId = "";
    }
    renderDockedPanel();
    return;
  }

  if (action === "toggle-alert-sound") {
    const nextExpanded = state.dockedAlertExpandedSoundId === timerId ? "" : timerId;
    state.dockedAlertExpandedSoundId = nextExpanded;
    if (nextExpanded !== timerId) {
      state.dockedAlertSoundMenuTimerId = "";
    }
    renderDockedPanel();
    return;
  }

  if (action === "toggle-alert-sound-menu") {
    state.dockedAlertExpandedSoundId = timerId;
    state.dockedAlertSoundMenuTimerId = state.dockedAlertSoundMenuTimerId === timerId ? "" : timerId;
    renderDockedPanel();
    return;
  }

  if (action === "select-alert-sound-preset") {
    const soundKey = String(button.dataset.soundKey || "").trim();
    if (!soundKey) {
      return;
    }
    updateDockedAlertTimer(timerId, {
      soundKey,
      customSoundPath: ""
    }, { render: false });
    state.dockedAlertExpandedSoundId = timerId;
    state.dockedAlertSoundMenuTimerId = "";
    renderDockedPanel();
    return;
  }

  if (action === "pick-alert-sound-custom") {
    const selectedPath = await (
      window.screenVisionApi.dialogs.pickAudioFile
        ? window.screenVisionApi.dialogs.pickAudioFile()
        : Promise.resolve("")
    ).catch(() => "");
    if (!selectedPath) {
      return;
    }
    updateDockedAlertTimer(timerId, {
      soundKey: "default",
      customSoundPath: String(selectedPath || "").trim()
    }, { render: false });
    state.dockedAlertExpandedSoundId = timerId;
    state.dockedAlertSoundMenuTimerId = "";
    renderDockedPanel();
    return;
  }

  if (action === "focus-alert-hotkey") {
    state.dockedAlertExpandedConfigId = timerId;
    state.dockedAlertCapturingHotkeyId = timerId;
    renderDockedPanel();
    window.requestAnimationFrame(() => {
      els.dockedPanelHost?.querySelector(`[data-docked-hotkey-capture="true"][data-timer-id="${cssEscape(timerId)}"]`)?.focus();
    });
    return;
  }

  if (action === "delete-alert") {
    await deleteDockedAlertTimer(timerId);
    return;
  }

  if (action === "toggle-alert-enabled") {
    return;
  }

  if (action === "toggle-alert-visual") {
    const timer = findDockedAlertTimer(timerId);
    if (!timer) {
      return;
    }
    const next = !(timer.showVisualAlert !== false);
    if (!next) {
      await window.screenVisionApi.timers.hideVisualAlert({ timerId }).catch(() => null);
    }
    updateDockedAlertTimer(timerId, { showVisualAlert: next });
    state.dockedAlertColorPickerTimerId = "";
    renderDockedPanel();
    await syncDockedAlertEditorForTimer(findDockedAlertTimer(timerId));
    return;
  }

  if (action === "toggle-alert-retrigger") {
    const timer = findDockedAlertTimer(timerId);
    if (!timer) {
      return;
    }
    updateDockedAlertTimer(timerId, { retriggerEnabled: !timer.retriggerEnabled });
    return;
  }

  if (action === "toggle-alert-reminder") {
    const timer = findDockedAlertTimer(timerId);
    if (!timer) {
      return;
    }
    const next = !Boolean(timer.reminderEnabled);
    updateDockedAlertTimer(timerId, { reminderEnabled: next });
    renderDockedPanel();
    return;
  }

  if (action === "toggle-alert-muted") {
    const timer = findDockedAlertTimer(timerId);
    if (!timer) {
      return;
    }

    if (timer.volumeMuted) {
      const restored = clampInteger(state.dockedAlertVolumeMemory.get(timerId), 1, 100, 100);
      updateDockedAlertTimer(timerId, { enabled: true, volumeMuted: false, volumePercent: restored });
    } else {
      state.dockedAlertVolumeMemory.set(timerId, clampInteger(timer.volumePercent, 1, 100, 100));
      await window.screenVisionApi.timers.stop({ timerId }).catch(() => null);
      updateDockedAlertTimer(timerId, { enabled: false, volumeMuted: true, volumePercent: 0 });
    }
    renderDockedPanel();
    focusDockedAlertAction(timerId, "toggle-alert-muted");
    return;
  }

  if (action === "toggle-alert-lock") {
    await toggleDockedAlertLock(timerId);
    return;
  }

  if (action === "toggle-alert-shadow") {
    const timer = findDockedAlertTimer(timerId);
    if (!timer) {
      return;
    }
    updateDockedAlertTimer(timerId, { alertShadowEnabled: timer.alertShadowEnabled === false });
    await syncDockedAlertEditorForTimer(findDockedAlertTimer(timerId));
    return;
  }

  if (action === "toggle-alert-color-picker") {
    state.dockedAlertColorPickerTimerId = state.dockedAlertColorPickerTimerId === timerId ? "" : timerId;
    renderDockedPanel();
    return;
  }

  if (action === "save-alert-color") {
    const timer = findDockedAlertTimer(timerId);
    if (!timer) {
      return;
    }
    const nextColors = Array.isArray(timer.savedAlertColors) ? [...timer.savedAlertColors] : [];
    const color = normalizeAlertHex(timer.alertColor || "#ffffff");
    if (!nextColors.includes(color)) {
      nextColors.push(color);
    }
    updateDockedAlertTimer(timerId, { savedAlertColors: nextColors.slice(-12) });
    return;
  }

  if (action === "delete-alert-color") {
    const timer = findDockedAlertTimer(timerId);
    if (!timer) {
      return;
    }
    const selected = normalizeAlertHex(timer.alertColor || "#ffffff");
    const nextColors = (Array.isArray(timer.savedAlertColors) ? timer.savedAlertColors : [])
      .map((entry) => normalizeAlertHex(entry))
      .filter((entry, index, list) => list.indexOf(entry) === index)
      .filter((entry) => entry !== selected);
    const fallbackColor = nextColors[0] || "#ffffff";
    updateDockedAlertTimer(timerId, {
      alertColor: fallbackColor,
      savedAlertColors: nextColors
    });
    await syncDockedAlertEditorForTimer(findDockedAlertTimer(timerId));
    return;
  }
}

async function handleDockedSqmFinderPanelClick(event) {
  const button = event.target.closest("[data-docked-action]");
  if (!button) {
    return;
  }

  hideFloatingTooltip();

  const action = button.dataset.dockedAction || "";
  const visual = state.visualCustomization || normalizeDockedVisualState(null);

  if (action === "close-panel") {
    await window.screenVisionApi.tools.open("sqm-finder-panel").catch(() => null);
    return;
  }

  if (action === "sqm-toggle-marker") {
    await updateDockedVisualState({ charLocEnabled: !visual.charLocEnabled });
    return;
  }

  if (action === "sqm-toggle-cursor-glow") {
    await updateDockedVisualState({ cursorGlowEnabled: !visual.cursorGlowEnabled });
    return;
  }

  if (action === "sqm-cycle-shape") {
    const currentIndex = SQM_SHAPE_SEQUENCE.indexOf(normalizeSqmShape(visual.charLocShape));
    const nextShape = SQM_SHAPE_SEQUENCE[(currentIndex + 1) % SQM_SHAPE_SEQUENCE.length];
    await updateDockedVisualState({ charLocShape: nextShape });
    return;
  }

  if (action === "sqm-toggle-marker-lock") {
    await updateDockedVisualState({ charLocLocked: !visual.charLocLocked });
    return;
  }

  if (action === "sqm-toggle-pulse") {
    await updateDockedVisualState({ charLocPulse: !visual.charLocPulse });
    return;
  }

  if (action === "sqm-toggle-marker-editor") {
    state.sqmExpandedEditor = state.sqmExpandedEditor === "marker" ? "" : "marker";
    renderDockedPanel();
    return;
  }

  if (action === "sqm-toggle-cursor-editor") {
    state.sqmExpandedEditor = state.sqmExpandedEditor === "cursor" ? "" : "cursor";
    renderDockedPanel();
    return;
  }

  if (action === "sqm-set-color") {
    const field = button.dataset.sqmColorField || "";
    const color = normalizeSqmAccentColor(button.dataset.sqmColor || "");
    if (!field) {
      return;
    }
    await updateDockedVisualState({ [field]: color });
    return;
  }

  if (action === "sqm-save-color" || action === "sqm-delete-color") {
    const field = button.dataset.sqmColorField || "";
    const savedField = getDockedSqmSavedColorField(field);
    if (!field || !savedField) {
      return;
    }

    const selected = normalizeSqmAccentColor(visual[field]);
    const current = normalizeSqmSavedColors(visual[savedField]);
    const nextColors = action === "sqm-save-color"
      ? [...current.filter((entry) => entry !== selected), selected].slice(-10)
      : current.filter((entry) => entry !== selected);
    const patch = { [savedField]: nextColors.length ? nextColors : SQM_DEFAULT_SAVED_COLORS };

    if (action === "sqm-delete-color") {
      patch[field] = patch[savedField][0] || "#58c470";
    }

    await updateDockedVisualState(patch);
  }
}

async function handleDockedSqmFinderPanelInput(event, options = {}) {
  const target = event.target.closest("[data-docked-field]");
  if (!target) {
    return;
  }

  const rawField = target.dataset.dockedField || "";
  if (!rawField.startsWith("sqm-")) {
    return;
  }

  const field = rawField.slice(4);
  let value = target.value;

  if (field === "charLocSize" || field === "cursorGlowSize") {
    value = clampInteger(value, 20, 160, 40);
  } else if (field === "charLocIntensity") {
    value = clampInteger(value, 1, 30, 10);
  } else if (field === "charLocColor" || field === "cursorGlowColor") {
    if (!/^#[0-9a-f]{6}$/i.test(String(value || "").trim())) {
      return;
    }
    value = normalizeSqmAccentColor(value || "#58c470");
  }

  applyDockedVisualLocalPatch({ [field]: value });
  syncDockedSqmFieldUi(field, value, target);
  previewDockedVisualState({ [field]: value });

  if (options.commit) {
    clearDockedVisualCommit(field);
    await updateDockedVisualState({ [field]: value }, { render: false });
    return;
  }

  scheduleDockedVisualCommit(field, value);
}

function applyDockedVisualLocalPatch(patch) {
  state.visualCustomization = normalizeDockedVisualState({
    ...(state.visualCustomization || {}),
    ...patch
  });
}

function syncDockedSqmFieldUi(field, value, sourceElement = null) {
  els.dockedPanelHost?.querySelectorAll(`[data-docked-field="sqm-${cssEscape(field)}"]`).forEach((element) => {
    if (element !== sourceElement && "value" in element && String(element.value) !== String(value)) {
      element.value = String(value);
    }
    syncDockedSqmRangeFill(element, value);
  });
}

function syncDockedSqmRangeFill(element, value) {
  if (element instanceof HTMLInputElement && element.type === "range") {
    const min = Number(element.min) || 0;
    const max = Number(element.max) || 100;
    const percent = max > min ? ((Number(value) - min) / (max - min)) * 100 : 0;
    element.style.setProperty("--alert-volume-percent", `${Math.max(0, Math.min(100, percent))}%`);
  }
}

function getDockedSqmSavedColorField(field) {
  if (field === "charLocColor") {
    return "charLocSavedColors";
  }
  if (field === "cursorGlowColor") {
    return "cursorGlowSavedColors";
  }
  return "";
}

function scheduleDockedVisualCommit(field, value) {
  clearDockedVisualCommit(field);
  const timer = window.setTimeout(() => {
    state.visualCustomizationFieldTimers.delete(field);
    void updateDockedVisualState({ [field]: value }, { render: false });
  }, 120);
  state.visualCustomizationFieldTimers.set(field, timer);
}

function previewDockedVisualState(patch) {
  if (!window.screenVisionApi?.visual?.preview) {
    return;
  }
  void window.screenVisionApi.visual.preview(patch).catch(() => null);
}

function clearDockedVisualCommit(field) {
  const timer = state.visualCustomizationFieldTimers.get(field);
  if (!timer) {
    return;
  }
  window.clearTimeout(timer);
  state.visualCustomizationFieldTimers.delete(field);
}

async function updateDockedVisualState(patch, options = {}) {
  applyDockedVisualLocalPatch(patch);
  const nextState = await window.screenVisionApi.visual.update(patch).catch(() => null);
  if (nextState) {
    state.visualCustomization = normalizeDockedVisualState(nextState);
  }
  if (options.render !== false) {
    renderDockedPanel();
  }
}

async function copyTextToClipboard(text) {
  const normalized = String(text || "");

  if (!normalized) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(normalized);
    return;
  }

  const tempInput = document.createElement("textarea");
  tempInput.value = normalized;
  tempInput.setAttribute("readonly", "");
  tempInput.style.position = "fixed";
  tempInput.style.opacity = "0";
  tempInput.style.pointerEvents = "none";
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  tempInput.remove();
}

function handleDockedPanelPointerDown(event) {
  if (isDockedSqmFinderPanelOpen()) {
    return;
  }

  if (isDockedAuthenticatorPanelOpen()) {
    return;
  }

  if (isDockedProfilesPanelOpen()) {
    return;
  }

  if (!isDockedAlertPanelOpen()) {
    return;
  }

  const timerField = event.target.closest("[data-docked-field]");
  if (timerField) {
    const field = timerField.dataset.dockedField || "";
    if (field === "globalVolumePercent" && isDockedAlertAudioGloballyEnabled()) {
      event.preventDefault();
      event.stopPropagation();
      timerField.blur?.();
      blockDockedAlertAudioEditing(timerField);
      return;
    }

    const timerId = timerField.dataset.timerId || "";
    const timer = findDockedAlertTimer(timerId);
    if (timer && isDockedAlertReminderField(field) && isDockedAlertReminderEditingLocked()) {
      event.preventDefault();
      event.stopPropagation();
      timerField.blur?.();
      blockDockedAlertReminderEditing(timerField);
      return;
    }
    if (timer && isDockedAlertAudioField(field) && isDockedAlertAudioGloballyEnabled()) {
      event.preventDefault();
      event.stopPropagation();
      timerField.blur?.();
      blockDockedAlertAudioEditing(timerField);
      return;
    }
    if (timer && isDockedAlertVisualField(field) && isDockedAlertVisualsGloballyEnabled()) {
      event.preventDefault();
      event.stopPropagation();
      timerField.blur?.();
      blockDockedAlertVisualEditing(timerField);
      return;
    }
    if (timer && isDockedAlertVisualField(field) && timer.showVisualAlert !== false) {
      event.preventDefault();
      event.stopPropagation();
      timerField.blur?.();
      blockDockedAlertVisualCardEditing(timerId, timerField);
      return;
    }
    if (timer?.locked && isDockedAlertEditField(field)) {
      event.preventDefault();
      event.stopPropagation();
      timerField.blur?.();
      blockDockedAlertEditing(timerId, timerField);
      return;
    }
  }

  const timerAction = event.target.closest("[data-docked-action]");
  if (timerAction) {
    const timerId = timerAction.dataset.timerId || "";
    const action = timerAction.dataset.dockedAction || "";
    const timer = findDockedAlertTimer(timerId);
    if (timer && action === "toggle-alert-reminder" && isDockedAlertReminderEditingLocked()) {
      event.preventDefault();
      event.stopPropagation();
      blockDockedAlertReminderEditing(timerAction);
      return;
    }
    if (timer && isDockedAlertAudioAction(action) && isDockedAlertAudioGloballyEnabled()) {
      event.preventDefault();
      event.stopPropagation();
      blockDockedAlertAudioEditing(timerAction);
      return;
    }
    if (timer && isDockedAlertVisualAction(action) && isDockedAlertVisualsGloballyEnabled()) {
      event.preventDefault();
      event.stopPropagation();
      blockDockedAlertVisualEditing(timerAction);
      return;
    }
    if (timer && isDockedAlertVisualAction(action) && timer.showVisualAlert !== false) {
      event.preventDefault();
      event.stopPropagation();
      blockDockedAlertVisualCardEditing(timerId, timerAction);
      return;
    }
    if (timer?.locked && isDockedAlertEditAction(action)) {
      event.preventDefault();
      event.stopPropagation();
      blockDockedAlertEditing(timerId, timerAction);
    }
  }
}

async function handleDockedPanelInput(event) {
  if (isDockedSqmFinderPanelOpen()) {
    await handleDockedSqmFinderPanelInput(event);
    return;
  }

  if (isDockedTibiaCoinsPanelOpen()) {
    await handleDockedTibiaCoinsPanelInput(event);
    return;
  }

  if (isDockedAuthenticatorPanelOpen()) {
    handleDockedAuthenticatorPanelInput(event);
    return;
  }

  if (isDockedProfilesPanelOpen()) {
    handleDockedProfilesPanelInput(event);
    return;
  }

  if (!isDockedAlertPanelOpen()) {
    return;
  }

  const field = event.target.dataset.dockedField || "";
  const timerId = event.target.dataset.timerId || "";

  if (field === "globalVolumePercent") {
    if (isDockedAlertAudioGloballyEnabled()) {
      event.target.blur?.();
      blockDockedAlertAudioEditing(event.target);
      syncDockedAlertVolumeUiFromState();
      return;
    }
    const globalVolumePercent = clampInteger(event.target.value, 0, 100, 70);
    state.overlayTools.timers.globalVolumePercent = globalVolumePercent;
    event.target.style.setProperty("--alert-volume-percent", `${globalVolumePercent}%`);
    const valueLabel = event.target.parentElement?.querySelector("strong");
    if (valueLabel) {
      valueLabel.textContent = `${globalVolumePercent}%`;
    }
    await persistDockedAlertsState();
    return;
  }

  if (!timerId || !field) {
    return;
  }

  if (isDockedAlertReminderField(field) && isDockedAlertReminderEditingLocked()) {
    event.target.blur?.();
    blockDockedAlertReminderEditing(event.target);
    return;
  }

  if (isDockedAlertAudioField(field) && isDockedAlertAudioGloballyEnabled()) {
    event.target.blur?.();
    blockDockedAlertAudioEditing(event.target);
    return;
  }

  if (isDockedAlertVisualField(field) && isDockedAlertVisualsGloballyEnabled()) {
    event.target.blur?.();
    blockDockedAlertVisualEditing(event.target);
    return;
  }
  if (isDockedAlertVisualField(field) && findDockedAlertTimer(timerId)?.showVisualAlert !== false) {
    event.target.blur?.();
    blockDockedAlertVisualCardEditing(timerId, event.target);
    return;
  }

  if (isDockedAlertEditField(field)) {
    const timer = findDockedAlertTimer(timerId);
    if (timer?.locked) {
      event.target.blur?.();
      blockDockedAlertEditing(timerId, event.target);
      return;
    }
  }

  if (field === "timerVolumePercent") {
    const currentTimer = findDockedAlertTimer(timerId);
    const value = clampInteger(event.target.value, 0, 100, 100);
    const muted = value <= 0;
    const previousMuted = Boolean(currentTimer?.volumeMuted) || clampInteger(currentTimer?.volumePercent, 0, 100, 100) <= 0;
    if (value > 0) {
      state.dockedAlertVolumeMemory.set(timerId, value);
    } else {
      await window.screenVisionApi.timers.stop({ timerId }).catch(() => null);
    }
    event.target.style.setProperty("--alert-volume-percent", `${value}%`);
    const valueLabel = event.target.parentElement?.querySelector("strong");
    if (valueLabel) {
      valueLabel.textContent = `${value}%`;
    }
    const volumeButton = event.target.closest(".docked-alert-volume-row")?.querySelector("[data-docked-action='toggle-alert-muted']");
    if (volumeButton) {
      volumeButton.classList.toggle("inactive", muted);
      volumeButton.setAttribute("data-tooltip", muted ? t("screenVision.alerts.enableSound") : t("screenVision.alerts.mute"));
      volumeButton.setAttribute("aria-label", muted ? t("screenVision.alerts.enableSound") : t("screenVision.alerts.mute"));
      volumeButton.innerHTML = renderIcon(muted ? "volume-off" : "volume");
    }
    updateDockedAlertTimer(timerId, { enabled: !muted, volumePercent: value, volumeMuted: muted }, { renderOnly: true, render: false });
    if (previousMuted !== muted) {
      syncDockedAlertVolumeUiFromState();
    }
    return;
  }

  if (field === "timerMessage") {
    updateDockedAlertTimer(timerId, { message: String(event.target.value || "").slice(0, 25) }, { renderOnly: true, render: false });
    await syncDockedAlertEditorForTimer(findDockedAlertTimer(timerId));
    return;
  }

  if (field === "timerName") {
    updateDockedAlertTimer(timerId, { name: String(event.target.value || "").slice(0, 80) }, { renderOnly: true, render: false });
    return;
  }

  if (field === "timerDurationSeconds") {
    updateDockedAlertTimer(timerId, { durationSeconds: clampInteger(event.target.value, 1, 43200, 60) }, { renderOnly: true, render: false });
    return;
  }

  if (field === "timerAlertDurationSeconds") {
    updateDockedAlertTimer(timerId, { alertDurationSeconds: normalizeDockedAlertDisplayDuration(event.target.value) }, { renderOnly: true, render: false });
    await syncDockedAlertEditorForTimer(findDockedAlertTimer(timerId));
    return;
  }

  if (field === "timerAlertColorLive") {
    updateDockedAlertTimer(timerId, { alertColor: normalizeAlertHex(event.target.value || "#ffffff") }, { renderOnly: true, render: false });
    return;
  }

  if (field === "timerAlertColorHex") {
    updateDockedAlertTimer(timerId, { alertColor: normalizeAlertHex(event.target.value || "#ffffff") }, { renderOnly: true, render: false });
  }
}

async function handleDockedPanelChange(event) {
  if (isDockedSqmFinderPanelOpen()) {
    await handleDockedSqmFinderPanelInput(event, { commit: true });
    return;
  }

  if (isDockedTibiaCoinsPanelOpen()) {
    await handleDockedTibiaCoinsPanelInput(event, { commit: true });
    return;
  }

  if (isDockedAuthenticatorPanelOpen()) {
    handleDockedAuthenticatorPanelChange(event);
    return;
  }

  if (isDockedProfilesPanelOpen()) {
    handleDockedProfilesPanelChange(event);
    return;
  }

  if (!isDockedAlertPanelOpen()) {
    return;
  }

  const field = event.target.dataset.dockedField || "";
  const timerId = event.target.dataset.timerId || "";

  if (!timerId || !field) {
    return;
  }

  if (isDockedAlertReminderField(field) && isDockedAlertReminderEditingLocked()) {
    event.target.blur?.();
    blockDockedAlertReminderEditing(event.target);
    return;
  }

  if (isDockedAlertAudioField(field) && isDockedAlertAudioGloballyEnabled()) {
    event.target.blur?.();
    blockDockedAlertAudioEditing(event.target);
    return;
  }

  if (isDockedAlertVisualField(field) && isDockedAlertVisualsGloballyEnabled()) {
    event.target.blur?.();
    blockDockedAlertVisualEditing(event.target);
    return;
  }
  if (isDockedAlertVisualField(field) && findDockedAlertTimer(timerId)?.showVisualAlert !== false) {
    event.target.blur?.();
    blockDockedAlertVisualCardEditing(timerId, event.target);
    return;
  }

  if (isDockedAlertEditField(field)) {
    const timer = findDockedAlertTimer(timerId);
    if (timer?.locked) {
      event.target.blur?.();
      blockDockedAlertEditing(timerId, event.target);
      return;
    }
  }

  const value = readDockedAlertFieldValue(field, event.target.value);
  updateDockedAlertTimer(timerId, { [fieldToTimerPatchKey(field)]: value }, { render: false });

  if (field.startsWith("timerFont") || field === "timerAlertColorLive" || field === "timerAlertColorHex" || field === "timerMessage") {
    await syncDockedAlertEditorForTimer(findDockedAlertTimer(timerId));
  }

  if (field === "timerAlertColorLive" || field === "timerAlertColorHex") {
    renderDockedPanel();
  }

  if (field === "timerName" || field === "timerDurationSeconds") {
    renderDockedPanel();
  }
}

async function handleDockedPanelKeydown(event) {
  if (isDockedSqmFinderPanelOpen()) {
    return;
  }

  if (isDockedSupportersPanelOpen()) {
    const linkCard = event.target.closest("[data-supporter-link-url]");
    if (linkCard && !event.repeat && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
      await openSupporterExternalUrl(linkCard);
    }
    return;
  }

  if (isDockedAuthenticatorPanelOpen()) {
    await handleDockedAuthenticatorPanelKeydown(event);
    return;
  }

  if (isDockedProfilesPanelOpen()) {
    if (event.key === "Enter") {
      const input = event.target.closest("input[data-docked-field]");
      if (input) {
        event.preventDefault();
        const profilePath = input.dataset.profilePath || "";
        if (profilePath) {
          await saveDockedProfileEdit(profilePath);
          return;
        }

        if (input.dataset.dockedField === "profileCreateName" || input.dataset.dockedField === "profileCreateCharacterName") {
          await createDockedProfileFromDraft();
        }
      }
    }
    return;
  }

  if (!isDockedAlertPanelOpen()) {
    return;
  }

  const hotkeyTarget = event.target.closest("[data-docked-hotkey-capture='true']");
  if (hotkeyTarget) {
    if (event.key === "Tab") {
      return;
    }

    event.preventDefault();
    const timerId = hotkeyTarget.dataset.timerId || "";

    if (event.key === "Escape") {
      if (timerId) {
        updateDockedAlertTimer(timerId, {
          hotkeyLabel: "",
          hotkeyKeyCode: "",
          hotkeyModifiers: [],
          hotkey: null
        }, { render: false });
      }
      state.dockedAlertCapturingHotkeyId = "";
      hotkeyTarget.blur();
      renderDockedPanel();
      return;
    }

    const binding = toHotkeyBinding(event);

    if (!binding || !timerId) {
      return;
    }

    updateDockedAlertTimer(timerId, {
      hotkeyLabel: binding.label,
      hotkeyKeyCode: binding.keyCode,
      hotkeyModifiers: binding.modifiers,
      hotkey: buildTimerHotkeyObject(event)
    }, { render: false });
    state.dockedAlertCapturingHotkeyId = "";
    renderDockedPanel();
    return;
  }

  if (event.key !== "Escape") {
    return;
  }

  if (state.dockedAlertColorPickerTimerId) {
    state.dockedAlertColorPickerTimerId = "";
    renderDockedPanel();
  }
}

function fieldToTimerPatchKey(field) {
  const map = {
    timerName: "name",
    timerDurationSeconds: "durationSeconds",
    timerAlertDurationSeconds: "alertDurationSeconds",
    timerFontFamily: "alertFontFamily",
    timerFontWeight: "alertFontWeight",
    timerReminderDelaySeconds: "reminderDelaySeconds",
    timerReminderRepeatCount: "reminderRepeatCount",
    timerMessage: "message",
    timerVolumePercent: "volumePercent",
    timerAlertColorLive: "alertColor",
    timerAlertColorHex: "alertColor"
  };
  return map[field] || field;
}

function readDockedAlertFieldValue(field, rawValue) {
  if (field === "timerFontWeight") {
    return clampInteger(rawValue, 400, 900, 700);
  }

  if (field === "timerReminderDelaySeconds") {
    return clampInteger(rawValue, 1, 3600, 10);
  }

  if (field === "timerReminderRepeatCount") {
    return clampInteger(rawValue, 1, 10, 2);
  }

  if (field === "timerDurationSeconds") {
    return clampInteger(rawValue, 1, 43200, 60);
  }

  if (field === "timerAlertDurationSeconds") {
    return normalizeDockedAlertDisplayDuration(rawValue);
  }

  if (field === "timerVolumePercent") {
    return clampInteger(rawValue, 0, 100, 100);
  }

  if (field === "timerAlertColorLive" || field === "timerAlertColorHex") {
    return normalizeAlertHex(rawValue);
  }

  return String(rawValue || "").trim();
}

function normalizeAlertHex(value) {
  const text = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : "#ffffff";
}

function normalizeDockedAlertDisplayDuration(value) {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return ALERT_DISPLAY_DURATION_DEFAULT_SECONDS;
  }
  return Math.round(Math.min(Math.max(parsed, ALERT_DISPLAY_DURATION_MIN_SECONDS), ALERT_DISPLAY_DURATION_MAX_SECONDS) * 10) / 10;
}

function formatDockedAlertVisualDuration(value) {
  const normalized = normalizeDockedAlertDisplayDuration(value);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
}

function buildTimerHotkeyObject(event) {
  return {
    code: String(event.code || "").trim(),
    modifiers: [
      event.ctrlKey ? "ctrl" : "",
      event.altKey ? "alt" : "",
      event.shiftKey ? "shift" : "",
      event.metaKey ? "win" : ""
    ].filter(Boolean)
  };
}

function buildDockedAlertHotkeyParts(timer) {
  const hotkey = timer?.hotkey && typeof timer.hotkey === "object" ? timer.hotkey : {};
  const modifiers = Array.isArray(hotkey.modifiers) ? hotkey.modifiers : [];
  const code = String(hotkey.code || "").trim();
  const parts = [];

  for (const modifier of modifiers) {
    if (modifier === "ctrl") {
      parts.push("Ctrl");
    } else if (modifier === "alt") {
      parts.push("Alt");
    } else if (modifier === "shift") {
      parts.push("Shift");
    } else if (modifier === "win") {
      parts.push("Win");
    }
  }

  const displayKey = displayStoredHotkeyCode(code);
  if (displayKey) {
    parts.push(displayKey);
  }

  if (!parts.length && typeof timer?.hotkeyLabel === "string" && timer.hotkeyLabel.trim()) {
    return timer.hotkeyLabel.split("+").map((entry) => entry.trim()).filter(Boolean);
  }

  return parts;
}

function buildDockedAlertHotkeyLabel(timer) {
  const parts = buildDockedAlertHotkeyParts(timer);
  return parts.join(" + ");
}

function renderDockedAlertHotkeySummaryButton(timer, capturing) {
  const parts = buildDockedAlertHotkeyParts(timer);

  if (!parts.length && !capturing) {
    return "";
  }

  return `
    <button
      type="button"
      class="docked-alert-hotkey-summary-button${capturing ? " capturing" : ""}"
      data-docked-action="focus-alert-hotkey"
      data-timer-id="${escapeHtml(timer.id)}"
      data-tooltip="${escapeHtml(t("screenVision.alerts.hotkeyChange"))}"
      aria-label="${escapeHtml(t("screenVision.alerts.hotkeyAria"))}"
    >
      ${renderDockedAlertHotkeyKeycaps(timer, capturing, { compact: true })}
    </button>
  `;
}

function renderDockedAlertHotkeyKeycaps(timer, capturing, options = {}) {
  const parts = buildDockedAlertHotkeyParts(timer);
  const compact = options.compact === true;

  if (!parts.length) {
    return `<span class="docked-alert-hotkey-placeholder${compact ? " compact" : ""}">${capturing ? "Pressione a hotkey" : "Clique para definir"}</span>`;
  }

  return parts
    .map((part, index) => `
      ${index > 0 ? `<span class="docked-alert-hotkey-plus${compact ? " compact" : ""}">+</span>` : ""}
      <span class="docked-alert-hotkey-chip${compact ? " compact" : ""}">${escapeHtml(part)}</span>
    `)
    .join("");
}

function displayStoredHotkeyCode(code) {
  const text = String(code || "").trim();

  if (!text) {
    return "";
  }

  if (/^Key[A-Z]$/.test(text)) {
    return text.slice(3);
  }

  if (/^Digit[0-9]$/.test(text)) {
    return text.slice(5);
  }

  if (/^Numpad[0-9]$/.test(text)) {
    return text.slice(6);
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(text)) {
    return text.toUpperCase();
  }

  const aliases = {
    Backquote: "`",
    Equal: "+",
    Minus: "-",
    BracketLeft: "[",
    BracketRight: "]",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
    Space: "Espaco",
    Enter: "Enter",
    Escape: "Esc",
    Tab: "Tab",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right"
  };

  return aliases[text] || text;
}

function formatDockedAlertHotkeyDuration(totalSeconds) {
  const safeSeconds = clampInteger(totalSeconds, 1, 43200, 60);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function findDockedAlertTimer(timerId) {
  return Array.isArray(state.overlayTools?.timers?.items)
    ? state.overlayTools.timers.items
      .map((entry) => normalizeOverlayTimerEntry(entry))
      .find((entry) => entry?.id === timerId) || null
    : null;
}

function isTibiaReadyForAlertSignals() {
  return Boolean(
    state.tibiaState
    && state.tibiaState.title
    && state.tibiaState.shouldShowOverlays === true
  );
}

function isTibiaReadyForMirrorActions() {
  return Boolean(
    state.tibiaState
    && state.tibiaState.title
    && state.tibiaState.shouldShowMirrorUi === true
  );
}

// Tutorials run in a separate topmost instruction window. Its own z-order can
// briefly make `shouldShowOverlays` false, even though Tibia is still open and
// maximized. Keep that stricter flag for real overlays, but use physical Tibia
// availability to decide whether a guided tour must be cancelled.
function isTibiaWindowReadyForTutorial() {
  const tibia = state.tibiaState;
  return Boolean(
    tibia
    && tibia.title
    && tibia.isVisible === true
    && tibia.isMinimized !== true
  );
}

function blockMirrorToolbarAction(trigger, options = {}) {
  if (!isTibiaReadyForMirrorActions()) {
    flashBlockedActionTooltip(trigger, t("screenVision.tibiaRequired"));
    flashAttention(els.emptyStateWaiting);
    return true;
  }

  if (options.requiresRegion === true && state.regions.length <= 0) {
    flashBlockedActionTooltip(trigger, t("screenVision.createMirrorFirst"));
    flashAttention(trigger);
    return true;
  }

  return false;
}

function isDockedAlertAudioGloballyEnabled() {
  return Boolean(state.overlayTools?.timers?.isListening);
}

function isDockedAlertVisualsGloballyEnabled() {
  return Boolean(state.overlayTools?.timers?.visualsEnabled);
}

function isDockedAlertAudioAction(action) {
  return [
    "toggle-alert-config",
    "focus-alert-hotkey",
    "toggle-alert-retrigger",
    "toggle-alert-reminder",
    "toggle-alert-sound",
    "toggle-alert-sound-menu",
    "select-alert-sound-preset",
    "pick-alert-sound-custom"
  ].includes(action);
}

function isDockedAlertVisualAction(action) {
  return [
    "toggle-alert-lock",
    "toggle-alert-shadow",
    "toggle-alert-color-picker",
    "save-alert-color",
    "delete-alert-color"
  ].includes(action);
}

function isDockedAlertAudioField(field) {
  return [
    "timerName",
    "timerDurationSeconds",
    "timerReminderDelaySeconds",
    "timerReminderRepeatCount",
    "timerVolumePercent"
  ].includes(field);
}

function isDockedAlertReminderField(field) {
  return [
    "timerReminderDelaySeconds",
    "timerReminderRepeatCount"
  ].includes(field);
}

function isDockedAlertVisualField(field) {
  return [
    "timerMessage",
    "timerFontFamily",
    "timerFontWeight",
    "timerAlertColorLive",
    "timerAlertColorHex"
  ].includes(field);
}

function updateDockedAlertTimer(timerId, partial, options = {}) {
  const items = Array.isArray(state.overlayTools?.timers?.items) ? state.overlayTools.timers.items : [];
  const timerIndex = items.findIndex((entry) => normalizeOverlayTimerEntry(entry)?.id === timerId);

  if (timerIndex < 0) {
    return;
  }

  const current = normalizeOverlayTimerEntry(items[timerIndex]);
  const next = normalizeOverlayTimerEntry({
    ...current,
    ...partial
  });

  state.overlayTools.timers.items[timerIndex] = next;

  if (options.renderOnly !== true) {
    void persistDockedAlertsState();
  }

  if (isDockedAlertPanelOpen() && options.render !== false) {
    renderDockedPanel();
  }
}

async function promptDockedAlertRename(timerId) {
  const timer = findDockedAlertTimer(timerId);

  if (!timer) {
    return;
  }

  const value = await window.screenVisionApi.dialogs.prompt({
    title: t("screenVision.alerts.renameTitle"),
    message: t("screenVision.alerts.renameMessage"),
    inputValue: timer.name || "Alerta",
    placeholder: t("screenVision.alerts.cardNamePlaceholder"),
    confirmLabel: t("common.save"),
    cancelLabel: t("common.cancel"),
    maxLength: 80
  }).catch(() => null);

  const nextName = String(value || "").trim();

  if (!nextName) {
    return;
  }

  updateDockedAlertTimer(timerId, { name: nextName });
}

async function deleteDockedAlertTimer(timerId) {
  const timer = findDockedAlertTimer(timerId);

  if (!timer) {
    return;
  }

  const dialogResult = await window.screenVisionApi.dialogs.confirm({
    title: "Confirmar Exclusao",
      message: `Deletar alerta "${timer.name || "Alerta"}"?`,
      confirmLabel: "Sim",
      cancelLabel: "Cancelar",
      checkboxLabel: "Nao perguntar novamente nesta sessao",
      sessionKey: "delete-timer-v2"
  }).catch(() => null);

  const confirmed = Boolean(dialogResult?.confirmed ?? dialogResult);

  if (!confirmed) {
    return;
  }

  await window.screenVisionApi.timers.stop({ timerId }).catch(() => {});
  await closeDockedAlertEditor(timerId);
  state.overlayTools.timers.items = state.overlayTools.timers.items.filter((entry) => normalizeOverlayTimerEntry(entry)?.id !== timerId);
  if (state.dockedAlertExpandedConfigId === timerId) {
    state.dockedAlertExpandedConfigId = "";
  }
  if (state.dockedAlertExpandedSoundId === timerId) {
    state.dockedAlertExpandedSoundId = "";
  }
  if (state.dockedAlertSoundMenuTimerId === timerId) {
    state.dockedAlertSoundMenuTimerId = "";
  }
  if (state.dockedAlertCapturingHotkeyId === timerId) {
    state.dockedAlertCapturingHotkeyId = "";
  }
  await persistDockedAlertsState();
  renderDockedPanel();
}

async function toggleDockedAlertLock(timerId) {
  const timer = findDockedAlertTimer(timerId);

  if (!timer) {
    return;
  }

  if (timer.locked) {
    await window.screenVisionApi.timers.hideVisualAlert({ timerId }).catch(() => null);
    updateDockedAlertTimer(timerId, { locked: false });
    await ensureDockedAlertEditor(findDockedAlertTimer(timerId));
    return;
  }

  if (!state.openAlertEditorIds.has(timerId)) {
    await ensureDockedAlertEditor(timer);
    return;
  }

  const center = await closeDockedAlertEditor(timerId);
  await window.screenVisionApi.timers.hideVisualAlert({ timerId }).catch(() => null);
  updateDockedAlertTimer(timerId, {
    locked: true,
    alertPositionX: center?.x ?? timer.alertPositionX ?? null,
    alertPositionY: center?.y ?? timer.alertPositionY ?? null
  });
}

function isDockedAlertEditAction(action) {
  return [
    "toggle-alert-shadow",
    "toggle-alert-color-picker",
    "save-alert-color",
    "delete-alert-color"
  ].includes(action);
}

function isDockedAlertEditField(field) {
  return [
    "timerMessage",
    "timerFontFamily",
    "timerFontWeight",
    "timerAlertColorLive",
    "timerAlertColorHex"
  ].includes(field);
}

function blockDockedAlertEditing(timerId, trigger) {
  const timerCard = els.dockedPanelHost?.querySelector(`[data-alert-timer-id="${cssEscape(timerId)}"]`);
  const lockButton = timerCard?.querySelector('[data-docked-action="toggle-alert-lock"]');
  flashBlockedActionTooltip(trigger, "Destrave para poder editar.");
  flashAttention(lockButton);
}

function blockDockedAlertAudioEditing(trigger) {
  const masterButton = els.dockedPanelHost?.querySelector('[data-docked-action="toggle-alerts-global"]');
  flashBlockedActionTooltip(trigger, "Desative os Alertas sonoros para editar.");
  flashAttention(masterButton);
}

function blockDockedAlertVisualEditing(trigger, timerId = "") {
  const masterButton = els.dockedPanelHost?.querySelector('[data-docked-action="toggle-alerts-visual-global"]');
  flashBlockedActionTooltip(trigger, "Desative os Alertas visuais para editar.");
  flashAttention(masterButton);

  if (timerId) {
    const timerCard = els.dockedPanelHost?.querySelector(`[data-alert-timer-id="${cssEscape(timerId)}"]`);
    const visualButton = timerCard?.querySelector('[data-docked-action="toggle-alert-visual"]');
    flashAttention(visualButton);
  }
}

function blockDockedAlertVisualCardEditing(timerId, trigger) {
  const timerCard = els.dockedPanelHost?.querySelector(`[data-alert-timer-id="${cssEscape(timerId)}"]`);
  const visualButton = timerCard?.querySelector('[data-docked-action="toggle-alert-visual"]');
  flashBlockedActionTooltip(trigger, "Desative o alerta visual para editar.");
  flashAttention(visualButton);
}

function isDockedAlertReminderEditingLocked() {
  return isDockedAlertAudioGloballyEnabled() || isDockedAlertVisualsGloballyEnabled();
}

function blockDockedAlertReminderEditing(trigger) {
  const audioEnabled = isDockedAlertAudioGloballyEnabled();
  const visualEnabled = isDockedAlertVisualsGloballyEnabled();
  const audioButton = els.dockedPanelHost?.querySelector('[data-docked-action="toggle-alerts-global"]');
  const visualButton = els.dockedPanelHost?.querySelector('[data-docked-action="toggle-alerts-visual-global"]');

  if (audioEnabled && visualEnabled) {
    flashBlockedActionTooltip(trigger, "Desative os alertas para editar.");
    flashAttention(audioButton);
    flashAttention(visualButton);
    return;
  }

  if (audioEnabled) {
    flashBlockedActionTooltip(trigger, "Desative o alerta sonoro para editar.");
    flashAttention(audioButton);
    return;
  }

  if (visualEnabled) {
    flashBlockedActionTooltip(trigger, "Desative o alerta visual para editar.");
    flashAttention(visualButton);
  }
}

function blockDockedAlertTibiaActivation(trigger) {
  flashBlockedActionTooltip(trigger, "Abra o Tibia Maximisado para ligar");
  flashAttention(els.emptyStateWaiting);
}

function hasMirrorProfile() {
  return Array.isArray(state.profilesIndex) && state.profilesIndex.length > 0;
}

function isCreateProfileEmptyStateActive() {
  return Boolean(
    els.emptyState
    && !els.emptyState.classList.contains("hidden")
    && els.emptyState.classList.contains("create-profile-layout")
    && !hasMirrorProfile()
  );
}

function blockMirrorCreationWithoutProfile(trigger) {
  if (!isCreateProfileEmptyStateActive()) {
    return false;
  }

  flashBlockedActionTooltip(trigger, "Crie um perfil primeiro");
  flashAttention(trigger);
  return true;
}

function blockMirrorCreationWhileHidden(trigger) {
  const allExistingMirrorsHidden = state.regions.length > 0
    && state.regions.every((region) => region.isVisible === false);

  if (!allExistingMirrorsHidden) {
    return false;
  }

  flashBlockedActionTooltip(trigger, t("screenVision.enableMirrorsBeforeCreating"));
  flashAttention(els.toggleAllVisibilityButton);
  return true;
}

function startTibiaMirrorProfileTutorialDemo() {
  if (!isTibiaReadyForMirrorActions()) {
    return false;
  }

  setTutorialTooltipSuppressed(true);

  if (!state.tutorialProfileDemo?.active) {
    state.tutorialProfileDemo = {
      active: true,
      profileCreated: false,
      originalDraft: { ...state.profileDraft },
      originalGrid: { ...state.grid },
      profile: {
        path: TUTORIAL_PROFILE_DEMO_PATH,
        name: "Painel do Knight",
        characterName: "Poioso",
        isActive: true,
        characterSummary: {
          name: "Poioso",
          vocation: "knight",
          sex: "male",
          level: 500,
          world: "Antica"
        }
      }
    };
  }

  state.profileDraft.profileName = "";
  state.profileDraft.characterName = "";
  state.profilesPanelExpandedEditPath = "";
  render();
  return true;
}

function fillTibiaMirrorProfileTutorialDemo(profileName, characterName) {
  const demo = state.tutorialProfileDemo;
  if (!demo?.active) {
    return;
  }

  demo.profile.name = String(profileName || "Painel do Knight").trim() || "Painel do Knight";
  demo.profile.characterName = String(characterName || "Poioso").trim() || "Poioso";
  state.profileDraft.profileName = demo.profile.name;
  state.profileDraft.characterName = demo.profile.characterName;
  render();
}

function commitTibiaMirrorProfileTutorialDemo() {
  const demo = state.tutorialProfileDemo;
  if (!demo?.active) {
    return;
  }

  demo.profileCreated = true;
  state.profileDraft.profileName = "";
  state.profileDraft.characterName = "";
  render();
}

async function openTibiaMirrorTutorialProfilesPanel() {
  if (!state.tutorialProfileDemo?.active) {
    return;
  }

  // The normal profile button intentionally toggles this panel. A tutorial
  // step must only ever open it, even if renderer state arrives a frame late.
  await window.screenVisionApi.tools.open("profiles-panel", {
    forceOpen: true,
    focusWindow: false
  }).catch(() => null);
  renderDockedPanel();
}

async function closeTibiaMirrorTutorialProfilesPanel() {
  if (state.dockedPanel.open && state.dockedPanel.panelKey === "profiles-panel") {
    await window.screenVisionApi.tools.open("profiles-panel").catch(() => null);
  }
}

async function showTibiaMirrorTutorialGrid() {
  const demo = state.tutorialProfileDemo;
  if (!demo?.active || state.grid?.enabled) {
    return;
  }

  const next = await window.screenVisionApi.grid.toggle().catch(() => null);
  if (next) {
    state.grid = {
      enabled: Boolean(next.enabled),
      gridSize: Number(next.gridSize) || 32
    };
    render();
  }
}

async function finishTibiaMirrorProfileTutorialDemo() {
  const demo = state.tutorialProfileDemo;
  if (!demo?.active) {
    return;
  }

  if (state.grid?.enabled !== demo.originalGrid?.enabled) {
    const next = await window.screenVisionApi.grid.toggle().catch(() => null);
    if (next) {
      state.grid = {
        enabled: Boolean(next.enabled),
        gridSize: Number(next.gridSize) || 32
      };
    }
  }

  state.profileDraft = { ...demo.originalDraft };
  state.profilesPanelExpandedEditPath = "";
  state.tutorialProfileDemo = null;
  setTutorialTooltipSuppressed(false);
  document.querySelector("#tt-mirror-create-focus")?.remove();
  render();
}

function getSqmFinderTutorialPosition() {
  const bounds = state.tibiaState?.clientBounds || state.tibiaState?.bounds || {};
  const width = Math.max(1, Number(bounds.width) || 1);
  const height = Math.max(1, Number(bounds.height) || 1);
  return {
    x: Math.round((Number(bounds.x) || 0) + (width * 0.26)),
    y: Math.round((Number(bounds.y) || 0) + (height * 0.5))
  };
}

async function previewSqmFinderTutorialVisual(visual) {
  await window.screenVisionApi.visual.preview(visual).catch(() => null);
}

function stopSqmFinderTutorialLoop() {
  const demo = state.sqmTutorialDemo;
  if (demo?.loopTimer) {
    window.clearInterval(demo.loopTimer);
    demo.loopTimer = null;
  }
}

function applySqmFinderTutorialPatch(patch, options = {}) {
  const demo = state.sqmTutorialDemo;
  if (!demo?.active) {
    return;
  }

  demo.visual = normalizeDockedVisualState({ ...demo.visual, ...patch });
  state.visualCustomization = { ...demo.visual };
  if (Object.hasOwn(options, "editor")) {
    state.sqmExpandedEditor = options.editor;
  }
  void previewSqmFinderTutorialVisual(demo.visual);
  renderDockedPanel();
}

function createSqmFinderTutorialPreviewTarget(kind = "sqm") {
  const id = "tt-sqm-finder-preview-focus";
  document.querySelector(`#${id}`)?.remove();
  const target = document.createElement("div");
  target.id = id;
  target.setAttribute("aria-hidden", "true");
  target.className = `tt-sqm-finder-preview-target ${kind}`;
  document.body.appendChild(target);
}

const ALERT_TUTORIAL_TIMER_ID = "__tibia_alert_tutorial__";

function getDockedAlertTutorialTimer() {
  return findDockedAlertTimer(ALERT_TUTORIAL_TIMER_ID);
}

function patchDockedAlertTutorialTimer(patch = {}) {
  if (!state.alertTutorialDemo?.active) {
    return null;
  }

  updateDockedAlertTimer(ALERT_TUTORIAL_TIMER_ID, patch, {
    renderOnly: true,
    render: false
  });
  return getDockedAlertTutorialTimer();
}

async function startDockedAlertTutorialDemo() {
  if (!isTibiaWindowReadyForTutorial()) {
    return false;
  }

  setTutorialTooltipSuppressed(true);

  if (state.alertTutorialDemo?.active) {
    return true;
  }

  const originalOverlayTools = cloneOverlayToolsStateForSave(state.overlayTools);
  const originalPanel = { ...state.dockedPanel };
  const originalUi = {
    view: state.dockedAlertsView,
    expandedConfigId: state.dockedAlertExpandedConfigId,
    expandedVisualId: state.dockedAlertExpandedVisualId,
    expandedReminderId: state.dockedAlertExpandedReminderId,
    expandedSoundId: state.dockedAlertExpandedSoundId,
    soundMenuTimerId: state.dockedAlertSoundMenuTimerId,
    colorPickerTimerId: state.dockedAlertColorPickerTimerId,
    capturingHotkeyId: state.dockedAlertCapturingHotkeyId
  };
  const tutorialTimer = createOverlayTimerEntryFromDraft({
    ...createDefaultOverlayTimerDraft(),
    name: "Utura Gran",
    durationSeconds: 60,
    message: "Utura Gran",
    alertColor: "#ffffff",
    alertDurationSeconds: 2.5,
    alertFontFamily: "nunito",
    alertFontWeight: 700,
    reminderEnabled: false,
    reminderDelaySeconds: 10,
    reminderRepeatCount: 2,
    retriggerEnabled: true,
    showVisualAlert: false,
    locked: false,
    volumePercent: 70,
    volumeMuted: false,
    hotkeyLabel: "Ctrl + U",
    hotkeyKeyCode: 85,
    hotkey: {
      code: "KeyU",
      modifiers: ["ctrl"]
    }
  }, {
    id: ALERT_TUTORIAL_TIMER_ID,
    enabled: true
  });

  // A tutorial must never activate or persist a real alert. Keep a complete
  // in-memory replacement and restore the user's profile state on exit.
  state.alertTutorialDemo = {
    active: true,
    originalOverlayTools,
    originalPanel,
    originalUi
  };
  state.overlayTools = cloneOverlayToolsStateForSave({
    ...originalOverlayTools,
    timers: {
      ...originalOverlayTools.timers,
      isListening: false,
      visualsEnabled: false,
      globalVolumePercent: 70,
      items: [tutorialTimer]
    }
  });
  resetDockedAlertTransientUiState();

  if (!isDockedAlertPanelOpen()) {
    await window.screenVisionApi.tools.open("alertas-panel").catch(() => null);
  }

  renderDockedPanel();
  return true;
}

async function setDockedAlertTutorialStage(stage = "intro") {
  if (!state.alertTutorialDemo?.active) {
    return;
  }

  const setUi = (patch = {}) => {
    Object.assign(state, patch);
  };
  const timerId = ALERT_TUTORIAL_TIMER_ID;

  if (stage === "intro" || stage === "global-sound" || stage === "global-volume" || stage === "global-visual") {
    setUi({
      dockedAlertsView: "cards",
      dockedAlertExpandedConfigId: "",
      dockedAlertExpandedSoundId: "",
      dockedAlertSoundMenuTimerId: "",
      dockedAlertColorPickerTimerId: ""
    });
    patchDockedAlertTutorialTimer({ showVisualAlert: true, locked: false, reminderEnabled: false });
  } else if (stage === "magic-panel" || stage === "magic-vocation" || stage === "magic-healing" || stage === "magic-create") {
    setUi({ dockedAlertsView: "magias", dockedAlertsMagicVocation: "knight" });
  } else if (stage === "select-utura") {
    setUi({ dockedAlertsView: "magias", dockedAlertsMagicVocation: "knight" });
    renderDockedPanel();
    const spell = els.dockedPanelHost?.querySelector('[data-spell-preset-id="intense-recovery"]')
      || els.dockedPanelHost?.querySelector('[data-spell-preset-id="utura-gran"]');
    spell?.classList.add("tt-tutorial-demo-hover");
    await new Promise((resolve) => window.setTimeout(resolve, 620));
    spell?.classList.remove("tt-tutorial-demo-hover");
    setUi({ dockedAlertsView: "cards", dockedAlertExpandedConfigId: timerId });
  } else if (["config", "cooldown", "hotkey", "retrigger"].includes(stage)) {
    setUi({ dockedAlertsView: "cards", dockedAlertExpandedConfigId: timerId });
    if (stage === "hotkey") {
      state.dockedAlertCapturingHotkeyId = "";
    }
  } else if (stage === "reminder") {
    setUi({ dockedAlertsView: "cards", dockedAlertExpandedConfigId: "", dockedAlertExpandedReminderId: timerId });
    patchDockedAlertTutorialTimer({ reminderEnabled: true });
  } else if (stage === "sound" || stage === "sound-custom") {
    setUi({
      dockedAlertsView: "cards",
      dockedAlertExpandedConfigId: "",
      dockedAlertExpandedReminderId: "",
      dockedAlertExpandedSoundId: timerId,
      dockedAlertSoundMenuTimerId: stage === "sound-custom" ? timerId : ""
    });
    patchDockedAlertTutorialTimer({ reminderEnabled: false });
  } else if (stage === "card-volume") {
    setUi({ dockedAlertsView: "cards", dockedAlertExpandedSoundId: "", dockedAlertSoundMenuTimerId: "" });
  } else if (stage === "visual-card") {
    setUi({ dockedAlertsView: "cards", dockedAlertExpandedSoundId: "", dockedAlertSoundMenuTimerId: "" });
    patchDockedAlertTutorialTimer({ showVisualAlert: false, locked: true, reminderEnabled: false });
  } else if (stage === "visual-lock") {
    setUi({ dockedAlertsView: "cards" });
    patchDockedAlertTutorialTimer({ showVisualAlert: false, locked: true });
    await closeDockedAlertEditor(timerId);
  } else if (["visual-preview", "visual-message", "visual-duration", "visual-fonts", "visual-style"].includes(stage)) {
    setUi({ dockedAlertsView: "cards" });
    patchDockedAlertTutorialTimer({
      showVisualAlert: false,
      locked: false,
      alertPositionX: null,
      alertPositionY: null
    });
    if (stage === "visual-preview") {
      await ensureDockedAlertEditor(getDockedAlertTutorialTimer());
    } else {
      // Keep the floating preview exclusive to its explanation step so it
      // never covers the editable controls highlighted by the following steps.
      await closeDockedAlertEditor(timerId);
    }
  }

  renderDockedPanel();
}

async function finishDockedAlertTutorialDemo(options = {}) {
  const demo = state.alertTutorialDemo;
  if (!demo?.active) {
    return;
  }

  await closeDockedAlertEditor(ALERT_TUTORIAL_TIMER_ID);
  await window.screenVisionApi.timers.hideVisualAlert({ timerId: ALERT_TUTORIAL_TIMER_ID }).catch(() => null);

  state.overlayTools = cloneOverlayToolsStateForSave(demo.originalOverlayTools);
  state.dockedAlertsView = demo.originalUi.view;
  state.dockedAlertExpandedConfigId = demo.originalUi.expandedConfigId;
  state.dockedAlertExpandedVisualId = demo.originalUi.expandedVisualId;
  state.dockedAlertExpandedReminderId = demo.originalUi.expandedReminderId;
  state.dockedAlertExpandedSoundId = demo.originalUi.expandedSoundId;
  state.dockedAlertSoundMenuTimerId = demo.originalUi.soundMenuTimerId;
  state.dockedAlertColorPickerTimerId = demo.originalUi.colorPickerTimerId;
  state.dockedAlertCapturingHotkeyId = demo.originalUi.capturingHotkeyId;
  state.alertTutorialDemo = null;
  setTutorialTooltipSuppressed(false);

  if ((options.closePanel === true || !demo.originalPanel.open) && isDockedAlertPanelOpen()) {
    await window.screenVisionApi.tools.open("alertas-panel").catch(() => null);
    return;
  }

  renderDockedPanel();
}

async function startSqmFinderTutorialDemo() {
  if (!isTibiaReadyForMirrorActions()) {
    return false;
  }

  setTutorialTooltipSuppressed(true);

  if (state.sqmTutorialDemo?.active) {
    return true;
  }

  const originalVisual = normalizeDockedVisualState(
    state.visualCustomization || await window.screenVisionApi.visual.get().catch(() => null)
  );
  const originalPanel = { ...state.dockedPanel };
  const markerPosition = getSqmFinderTutorialPosition();

  state.sqmTutorialDemo = {
    active: true,
    originalVisual,
    originalPanel,
    visual: normalizeDockedVisualState({
      ...originalVisual,
      charLocEnabled: false,
      cursorGlowEnabled: false,
      charLocSize: 100,
      charLocShape: "Square",
      charLocColor: "#58c470",
      charLocIntensity: 10,
      charLocLocked: true,
      charLocPulse: false,
      charLocX: markerPosition.x,
      charLocY: markerPosition.y
    }),
    loopTimer: null
  };
  state.visualCustomization = { ...state.sqmTutorialDemo.visual };
  state.sqmExpandedEditor = "";

  // Suppress any active real marker/glow before the panel rearranges. The
  // original preference remains in the demo snapshot and is restored on exit.
  await previewSqmFinderTutorialVisual(state.sqmTutorialDemo.visual);

  if (!isDockedSqmFinderPanelOpen()) {
    await window.screenVisionApi.tools.open("sqm-finder-panel").catch(() => null);
  }
  renderDockedPanel();
  createSqmFinderTutorialPreviewTarget("sqm");
  return true;
}

async function setSqmFinderTutorialStage(stage = "intro") {
  const demo = state.sqmTutorialDemo;
  if (!demo?.active) {
    return;
  }

  stopSqmFinderTutorialLoop();
  const markerPosition = getSqmFinderTutorialPosition();
  const setMarker = (patch = {}, options = {}) => applySqmFinderTutorialPatch({
    charLocEnabled: true,
    cursorGlowEnabled: false,
    charLocSize: 100,
    charLocShape: "Square",
    charLocColor: "#58c470",
    charLocIntensity: 10,
    charLocLocked: true,
    charLocPulse: false,
    charLocX: markerPosition.x,
    charLocY: markerPosition.y,
    ...patch
  }, options);

  if (stage === "intro") {
    applySqmFinderTutorialPatch({ charLocEnabled: false, cursorGlowEnabled: false });
    createSqmFinderTutorialPreviewTarget("sqm");
    return;
  }

  if (stage === "marker") {
    setMarker();
    createSqmFinderTutorialPreviewTarget("sqm");
    return;
  }

  if (stage === "shape") {
    const shapes = ["Square", "Circle", "Arrow"];
    let index = 0;
    setMarker({ charLocShape: shapes[index] });
    demo.loopTimer = window.setInterval(() => {
      index = (index + 1) % shapes.length;
      setMarker({ charLocShape: shapes[index] });
    }, 1000);
    createSqmFinderTutorialPreviewTarget("sqm");
    return;
  }

  if (stage === "size") {
    const sizes = [64, 100, 140, 88];
    let index = 0;
    setMarker({ charLocSize: sizes[index] }, { editor: "marker" });
    demo.loopTimer = window.setInterval(() => {
      index = (index + 1) % sizes.length;
      setMarker({ charLocSize: sizes[index] }, { editor: "marker" });
    }, 720);
    createSqmFinderTutorialPreviewTarget("sqm");
    return;
  }

  if (stage === "intensity") {
    const intensities = [5, 10, 20, 30];
    let index = 0;
    setMarker({ charLocIntensity: intensities[index] }, { editor: "marker" });
    demo.loopTimer = window.setInterval(() => {
      index = (index + 1) % intensities.length;
      setMarker({ charLocIntensity: intensities[index] }, { editor: "marker" });
    }, 820);
    createSqmFinderTutorialPreviewTarget("sqm");
    return;
  }

  if (stage === "color") {
    const colors = ["#58c470", "#ffffff", "#ff4444", "#0088ff"];
    let index = 0;
    setMarker({ charLocColor: colors[index] }, { editor: "marker" });
    demo.loopTimer = window.setInterval(() => {
      index = (index + 1) % colors.length;
      setMarker({ charLocColor: colors[index] }, { editor: "marker" });
    }, 820);
    createSqmFinderTutorialPreviewTarget("sqm");
    return;
  }

  const cursorColors = ["#58c470", "#ffffff", "#0088ff"];
  let index = 0;
  applySqmFinderTutorialPatch({
    charLocEnabled: false,
    cursorGlowEnabled: true,
    cursorGlowSize: 96,
    cursorGlowColor: cursorColors[index]
  }, { editor: stage === "cursor-editor" ? "cursor" : "" });
  demo.loopTimer = window.setInterval(() => {
    index = (index + 1) % cursorColors.length;
    applySqmFinderTutorialPatch({ cursorGlowSize: [72, 112, 92][index], cursorGlowColor: cursorColors[index] }, {
      editor: stage === "cursor-editor" ? "cursor" : ""
    });
  }, 820);
  createSqmFinderTutorialPreviewTarget("cursor");
}

async function finishSqmFinderTutorialDemo(options = {}) {
  const demo = state.sqmTutorialDemo;
  if (!demo?.active) {
    return;
  }

  stopSqmFinderTutorialLoop();
  state.sqmExpandedEditor = "";
  state.visualCustomization = { ...demo.originalVisual };
  await previewSqmFinderTutorialVisual(demo.originalVisual);
  document.querySelector("#tt-sqm-finder-preview-focus")?.remove();

  const shouldClosePanel = options.closePanel === true || !demo.originalPanel?.open;
  state.sqmTutorialDemo = null;
  setTutorialTooltipSuppressed(false);
  if (shouldClosePanel && isDockedSqmFinderPanelOpen()) {
    await window.screenVisionApi.tools.open("sqm-finder-panel").catch(() => null);
  }
  renderDockedPanel();
}

function createTibiaMirrorTutorialFocus(id, selectors = []) {
  document.querySelector(`#${id}`)?.remove();
  const elements = selectors
    .map((selector) => document.querySelector(selector))
    .filter(Boolean);
  if (!elements.length) {
    return;
  }

  const rects = elements.map((element) => element.getBoundingClientRect());
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const focus = document.createElement("div");
  focus.id = id;
  focus.setAttribute("aria-hidden", "true");
  focus.style.cssText = [
    "position:fixed",
    "pointer-events:none",
    "z-index:-1",
    `left:${left}px`,
    `top:${top}px`,
    `width:${right - left}px`,
    `height:${bottom - top}px`
  ].join(";");
  document.body.appendChild(focus);
}

function isDockedAlertInteractiveEditing() {
  if (!isDockedAlertPanelOpen()) {
    return false;
  }

  const activeElement = document.activeElement;
  if (state.dockedAlertCapturingHotkeyId) {
    return true;
  }

  if (
    state.dockedAlertExpandedConfigId
    || state.dockedAlertExpandedSoundId
    || state.dockedAlertSoundMenuTimerId
    || state.dockedAlertColorPickerTimerId
  ) {
    return true;
  }

  if (els.dockedPanelHost?.matches?.(":hover")) {
    return true;
  }

  return Boolean(
    activeElement
    && els.dockedPanelHost?.contains(activeElement)
    && (
      activeElement instanceof HTMLInputElement
      || activeElement instanceof HTMLSelectElement
      || activeElement instanceof HTMLTextAreaElement
      || activeElement instanceof HTMLButtonElement
    )
  );
}

function isDockedProfilesInteractiveEditing() {
  if (!isDockedProfilesPanelOpen()) {
    return false;
  }

  const activeElement = document.activeElement;
  return Boolean(
    activeElement
    && els.dockedPanelHost?.contains(activeElement)
    && (
      activeElement instanceof HTMLInputElement
      || activeElement instanceof HTMLSelectElement
      || activeElement instanceof HTMLTextAreaElement
    )
  );
}

function isDockedAuthenticatorInteractiveEditing() {
  if (!isDockedAuthenticatorPanelOpen()) {
    return false;
  }

  const activeElement = document.activeElement;
  return Boolean(
    activeElement
    && els.dockedPanelHost?.contains(activeElement)
    && (
      activeElement instanceof HTMLInputElement
      || activeElement instanceof HTMLSelectElement
      || activeElement instanceof HTMLTextAreaElement
    )
  );
}

function syncDockedAlertVolumeUiFromState() {
  const items = Array.isArray(state.overlayTools?.timers?.items)
    ? state.overlayTools.timers.items.map((entry) => normalizeOverlayTimerEntry(entry)).filter(Boolean)
    : [];

  for (const timer of items) {
    const card = els.dockedPanelHost?.querySelector(`[data-alert-timer-id="${cssEscape(timer.id)}"]`);
    if (!card) {
      continue;
    }

    const volumePercent = clampInteger(timer.volumePercent, 0, 100, 100);
    const audioEnabled = timer.enabled !== false && !timer.volumeMuted && volumePercent > 0;
    const slider = card.querySelector('[data-docked-field="timerVolumePercent"]');
    const valueLabel = card.querySelector(".docked-alert-inline-volume strong");
    const volumeButton = card.querySelector('[data-docked-action="toggle-alert-muted"]');

    if (slider) {
      slider.value = String(volumePercent);
      slider.style.setProperty("--alert-volume-percent", `${volumePercent}%`);
    }

    if (valueLabel) {
      valueLabel.textContent = `${volumePercent}%`;
    }

    if (volumeButton) {
      volumeButton.classList.toggle("inactive", !audioEnabled);
      volumeButton.setAttribute("data-tooltip", audioEnabled ? t("screenVision.alerts.mute") : t("screenVision.alerts.enableSound"));
      volumeButton.setAttribute("aria-label", audioEnabled ? t("screenVision.alerts.mute") : t("screenVision.alerts.enableSound"));
      volumeButton.innerHTML = renderIcon(audioEnabled ? "volume" : "volume-off");
    }
  }
}

function syncDockedAlertRuntimeUiFromState() {
  const items = Array.isArray(state.overlayTools?.timers?.items)
    ? state.overlayTools.timers.items.map((entry) => normalizeOverlayTimerEntry(entry)).filter(Boolean)
    : [];

  for (const timer of items) {
    const card = els.dockedPanelHost?.querySelector(`[data-alert-timer-id="${cssEscape(timer.id)}"]`);
    const meta = card?.querySelector(".docked-alert-card-title-meta");

    if (!meta) {
      continue;
    }

    const runtime = state.alertRuntimeById?.[timer.id] || null;
    let chip = meta.querySelector(".docked-alert-runtime-chip");

    if (!runtime) {
      chip?.remove();
      continue;
    }

    if (!chip) {
      chip = document.createElement("span");
      chip.className = "docked-alert-runtime-chip";
      meta.appendChild(chip);
    }

    chip.classList.toggle("reminder", runtime.phase === "waiting-reminder");
    chip.textContent = formatOverlayTimerDuration(runtime.remainingSeconds);
  }
}

function focusDockedAlertAction(timerId, action) {
  window.requestAnimationFrame(() => {
    els.dockedPanelHost
      ?.querySelector(`[data-docked-action="${cssEscape(action)}"][data-timer-id="${cssEscape(timerId)}"]`)
      ?.focus({ preventScroll: true });
  });
}

function focusDockedAlertField(timerId, field) {
  window.requestAnimationFrame(() => {
    els.dockedPanelHost
      ?.querySelector(`[data-docked-field="${cssEscape(field)}"][data-timer-id="${cssEscape(timerId)}"]`)
      ?.focus({ preventScroll: true });
  });
}

async function syncDockedAlertEditors() {
  const timers = Array.isArray(state.overlayTools?.timers?.items)
    ? state.overlayTools.timers.items.map((entry) => normalizeOverlayTimerEntry(entry)).filter(Boolean)
    : [];

  for (const timer of timers) {
    await syncDockedAlertEditorForTimer(timer);
  }
}

async function syncDockedAlertEditorForTimer(timer) {
  if (!timer?.id) {
    return;
  }

  if (isDockedAlertVisualsGloballyEnabled() || timer.showVisualAlert !== false || timer.locked) {
    await closeDockedAlertEditor(timer.id);
    return;
  }

  await ensureDockedAlertEditor(timer);
}

async function ensureDockedAlertEditor(timer) {
  if (!timer || isDockedAlertVisualsGloballyEnabled() || timer.showVisualAlert !== false || timer.locked) {
    if (timer?.id) {
      await closeDockedAlertEditor(timer.id);
    }
    return null;
  }

  const payload = buildDockedAlertEditorPayload(timer);
  const center = state.openAlertEditorIds.has(timer.id)
    ? await window.screenVisionApi.timers.updatePositionEditor(payload).catch(() => null)
    : await window.screenVisionApi.timers.openPositionEditor(payload).catch(() => null);

  state.openAlertEditorIds.add(timer.id);

  if (center && (timer.alertPositionX !== center.x || timer.alertPositionY !== center.y)) {
    updateDockedAlertTimer(timer.id, {
      alertPositionX: center.x,
      alertPositionY: center.y
    }, { renderOnly: true });
  }

  return center;
}

async function closeDockedAlertEditor(timerId) {
  if (!timerId) {
    return null;
  }

  state.openAlertEditorIds.delete(timerId);
  return await window.screenVisionApi.timers.closePositionEditor({ timerId }).catch(() => null);
}

async function closeAllDockedAlertEditors() {
  const ids = [...state.openAlertEditorIds];
  for (const timerId of ids) {
    await closeDockedAlertEditor(timerId);
  }
}

function resetDockedAlertTransientUiState() {
  state.dockedAlertsView = "cards";
  state.dockedAlertExpandedConfigId = "";
  state.dockedAlertExpandedSoundId = "";
  state.dockedAlertSoundMenuTimerId = "";
  state.dockedAlertCapturingHotkeyId = "";
  state.dockedAlertColorPickerTimerId = "";
}

function buildDockedAlertEditorPayload(timer) {
  return {
    timerId: timer.id,
    name: timer.name || "Alerta",
    message: (timer.message || timer.name || "Alerta pronto").trim(),
    color: timer.alertColor || "#FFFFFF",
    fontSize: fontSizeKeyToValue(timer.fontSizeKey),
    fontFamily: timer.alertFontFamily || "nunito",
    fontWeight: timer.alertFontWeight || 700,
    shadowEnabled: timer.alertShadowEnabled !== false,
    durationSeconds: timer.alertDurationSeconds ?? 1.6,
    x: timer.alertPositionX,
    y: timer.alertPositionY
  };
}

function fontSizeKeyToValue(sizeKey) {
  const map = {
    small: 18,
    medium: 24,
    large: 30,
    "x-large": 36,
    huge: 44
  };
  return map[sizeKey] || 30;
}

async function refreshAll() {
  await Promise.all([
    refreshTibiaState(),
    refreshRegions(),
    refreshGridState()
  ]);
}

async function refreshRegions() {
  state.loading = true;
  const items = await window.screenVisionApi.regions.list().catch(() => []);
  state.regions = Array.isArray(items) ? items : [];
  state.loading = false;

  if (shouldPreserveInteractiveSurface()) {
    state.deferredRefreshPending = true;
    renderToolbar();
    renderNotice();
    renderEmptyState();
    return;
  }

  render();
}

async function refreshTibiaState() {
  const wasReady = state.tibiaReadyLastPoll;
  const wasTutorialReady = state.tibiaTutorialReadyLastPoll;
  state.tibiaState = await window.screenVisionApi.tibia.getState().catch(() => null);
  const isReady = isTibiaReadyForMirrorActions();
  const isTutorialReady = isTibiaWindowReadyForTutorial();
  state.tibiaReadyLastPoll = isReady;
  state.tibiaTutorialReadyLastPoll = isTutorialReady;

  if (wasReady !== isReady || wasTutorialReady !== isTutorialReady) {
    window.dispatchEvent(new CustomEvent("tibia-mirror:tibia-readiness", {
      detail: {
        ready: isReady,
        tutorialReady: isTutorialReady
      }
    }));
  }

  if (wasReady && !isReady) {
    await suspendTibiaDependentAlertTools();
  }

  renderEmptyState();
  if (isDockedAlertPanelOpen()) {
    if (shouldPreserveInteractiveSurface()) {
      state.deferredRefreshPending = true;
      syncDockedAlertRuntimeUiFromState();
      syncDockedAlertVolumeUiFromState();
    } else {
      renderDockedPanel();
    }
  }

  if (isDockedAuthenticatorPanelOpen()) {
    if (shouldPreserveInteractiveSurface()) {
      state.deferredRefreshPending = true;
      void refreshDockedAuthenticatorRuntime({ render: false });
    } else {
      void refreshDockedAuthenticatorRuntime({ render: true });
    }
  }

  if (!shouldPreserveInteractiveSurface()) {
    renderToolbar();
  } else {
    state.deferredRefreshPending = true;
  }
}

async function suspendTibiaDependentAlertTools() {
  const timers = Array.isArray(state.overlayTools?.timers?.items)
    ? state.overlayTools.timers.items.map((entry) => normalizeOverlayTimerEntry(entry)).filter(Boolean)
    : [];

  state.overlayTools.timers.isListening = false;
  state.overlayTools.timers.visualsEnabled = false;
  state.dockedAlertColorPickerTimerId = "";

  await Promise.all([
    ...Object.keys(state.alertRuntimeById || {}).map((timerId) => (
      window.screenVisionApi.timers.stop({ timerId }).catch(() => null)
    )),
    ...timers.map((timer) => (
      window.screenVisionApi.timers.hideVisualAlert({ timerId: timer.id }).catch(() => null)
    ))
  ]);
  state.alertRuntimeById = {};

  // Mirror visibility is a user setting. Losing Tibia focus only hides the
  // native windows; it must never persistently turn their cards off.

  await persistDockedAlertsState();
}

async function refreshGridState() {
  state.grid = await window.screenVisionApi.grid.get().catch(() => ({
    enabled: false,
    gridSize: 32
  }));
  render();
}

function startPolling() {
  if (state.pollHandle) {
    return;
  }

  state.pollHandle = window.setInterval(() => {
    if (state.deferredRefreshPending && !shouldPreserveInteractiveSurface()) {
      state.deferredRefreshPending = false;
      void refreshAll();
      return;
    }

    void refreshTibiaState();

    if (canBackgroundRefreshRegions()) {
      void refreshRegions();
    }
  }, 900);

  window.addEventListener("beforeunload", () => {
    if (state.pollHandle) {
      window.clearInterval(state.pollHandle);
      state.pollHandle = 0;
    }

    resetDockedAlertTransientUiState();
    hideFloatingTooltip();
  });
}

function canBackgroundRefreshRegions() {
  if (state.modal) {
    return false;
  }

  const blockedTooltipActive = Boolean(
    state.activeTooltipTrigger
    && Number(state.activeTooltipTrigger.dataset.blockedTooltipUntil || 0) > Date.now()
  );

  if (blockedTooltipActive) {
    return false;
  }

  if (shouldPreserveInteractiveSurface()) {
    return false;
  }

  const activeElement = document.activeElement;

  return !(activeElement instanceof HTMLInputElement || activeElement instanceof HTMLSelectElement || activeElement instanceof HTMLTextAreaElement);
}

function shouldPreserveInteractiveSurface() {
  const blockedTooltipActive = Boolean(
    state.activeTooltipTrigger
    && Number(state.activeTooltipTrigger.dataset.blockedTooltipUntil || 0) > Date.now()
  );

  if (blockedTooltipActive) {
    return true;
  }

  if (state.openRegionNameEditorId || state.openCountdownRegionId) {
    return true;
  }

  if (isDockedAlertInteractiveEditing()) {
    return true;
  }

  if (isDockedProfilesInteractiveEditing()) {
    return true;
  }

  if (isDockedAuthenticatorInteractiveEditing()) {
    return true;
  }

  const activeElement = document.activeElement;
  const isInteractiveElement = activeElement instanceof HTMLInputElement
    || activeElement instanceof HTMLSelectElement
    || activeElement instanceof HTMLTextAreaElement;

  if (state.modal?.kind === "countdown" && isInteractiveElement && els.modalRoot?.contains(activeElement)) {
    return true;
  }

  if (isInteractiveElement && els.regionGrid?.contains(activeElement)) {
    return true;
  }

  if (isInteractiveElement && els.emptyState?.contains(activeElement)) {
    return true;
  }

  return false;
}

function shouldPreserveCountdownModalRender() {
  if (state.modal?.kind !== "countdown") {
    return false;
  }

  const activeElement = document.activeElement;
  return Boolean(
    activeElement
    && els.modalRoot?.contains(activeElement)
    && (
      activeElement instanceof HTMLInputElement
      || activeElement instanceof HTMLSelectElement
      || activeElement instanceof HTMLTextAreaElement
    )
  );
}

async function addRegion() {
  if (state.creatingRegion) {
    return;
  }

  state.creatingRegion = true;
  try {
    const result = await window.screenVisionApi.regions.add().catch(() => null);
    applyRegionsResponse(result);
    if (result?.cancelled && result?.reason === "outside-tibia") {
      flashBlockedActionTooltip(els.addRegionButton, t("screenVision.selectionTooSmall"));
    }
    if (result?.cancelled && result?.reason === "mirrors-hidden") {
      flashBlockedActionTooltip(els.addRegionButton, t("screenVision.enableMirrorsBeforeCreating"));
      flashAttention(els.toggleAllVisibilityButton);
    }
  } finally {
    state.creatingRegion = false;
  }
}

async function addFixedRegion() {
  if (state.creatingRegion) {
    return;
  }

  state.creatingRegion = true;
  try {
    const result = await window.screenVisionApi.regions.addFixed().catch(() => null);
    applyRegionsResponse(result);
    if (result?.cancelled && result?.reason === "outside-tibia") {
      flashBlockedActionTooltip(els.cropToolButton, t("screenVision.selectionOutsideTibia"));
    }
    if (result?.cancelled && result?.reason === "mirrors-hidden") {
      flashBlockedActionTooltip(els.cropToolButton, t("screenVision.enableMirrorsBeforeCreating"));
      flashAttention(els.toggleAllVisibilityButton);
    }
  } finally {
    state.creatingRegion = false;
  }
}

async function reselectRegion(regionId) {
  const result = await window.screenVisionApi.regions.reselect(regionId).catch(() => null);
  applyRegionsResponse(result);
}

async function toggleRegionVisibility(regionId) {
  const result = await window.screenVisionApi.regions.toggleVisibility(regionId).catch(() => null);
  applyRegionsResponse(result);
}

async function toggleRegionLock(regionId) {
  const region = findRegion(regionId);

  if (region?.isLocked && region?.isVisible === false) {
    const lockButton = els.regionGrid?.querySelector(`[data-action="toggle-lock"][data-region-id="${cssEscape(regionId)}"]`);
    const visibilityButton = els.regionGrid?.querySelector(`[data-action="toggle-visibility"][data-region-id="${cssEscape(regionId)}"]`);
    flashBlockedActionTooltip(lockButton, "O card deve estar visivel.");
    flashAttention(visibilityButton, { whiteWhileShaking: true });
    return;
  }

  if (region) {
    applyLocalRegionPatch(regionId, { isLocked: !region.isLocked });
    render();
  }

  const result = await window.screenVisionApi.regions.toggleLock(regionId).catch(() => null);
  applyRegionsResponse(result);
}

async function toggleAllRegionsVisibility() {
  const nextVisible = state.regions.some((region) => region.isVisible === false);

  if (state.regions.length) {
    state.regions.forEach((region) => {
      region.isVisible = nextVisible;
    });
    render();
  }

  const result = await window.screenVisionApi.regions.toggleAllVisibility().catch(() => null);
  applyRegionsResponse(result);
}

async function toggleAllRegionsLock() {
  const allLocked = state.regions.length > 0 && state.regions.every((region) => region.isLocked);
  const allVisible = state.regions.length > 0 && state.regions.every((region) => region.isVisible !== false);

  if (allLocked && !allVisible) {
    flashBlockedActionTooltip(els.toggleAllLockButton, "Todos os cards tem que estar visiveis.");
    flashAttention(els.toggleAllVisibilityButton);
    return;
  }

  if (state.regions.length) {
    state.regions.forEach((region) => {
      region.isLocked = !allLocked;
    });
    render();
  }

  const result = await window.screenVisionApi.regions.toggleAllLock().catch(() => null);
  applyRegionsResponse(result);
}

async function deleteRegion(regionId) {
  const result = await window.screenVisionApi.regions.delete(regionId).catch(() => null);
  applyRegionsResponse(result);
}

async function confirmExternalModal(options = {}) {
  const localizedOptions = await translateObjectTextFields(
    getAppLocale(),
    options,
    ["title", "message", "confirmLabel", "cancelLabel", "checkboxLabel", "placeholder"]
  );
  const result = await window.screenVisionApi.dialogs.confirm(localizedOptions).catch(() => null);

  if (result && typeof result === "object") {
    return {
      confirmed: Boolean(result.confirmed),
      rememberChoice: Boolean(result.rememberChoice),
      skipped: Boolean(result.skipped)
    };
  }

  return {
    confirmed: Boolean(result),
    rememberChoice: false,
    skipped: false
  };
}

async function promptExternalModal(options = {}) {
  const localizedOptions = await translateObjectTextFields(
    getAppLocale(),
    options,
    ["title", "message", "confirmLabel", "cancelLabel", "placeholder"]
  );
  const value = await window.screenVisionApi.dialogs.prompt(localizedOptions).catch(() => null);
  return typeof value === "string" ? value : null;
}

async function startCountdown(regionId) {
  const result = await window.screenVisionApi.regions.startCountdown(regionId).catch(() => null);
  applyRegionsResponse(result);
}

async function stopCountdown(regionId) {
  const result = await window.screenVisionApi.regions.stopCountdown(regionId).catch(() => null);
  applyRegionsResponse(result);
}

async function unsnapRegion(regionId) {
  const result = await window.screenVisionApi.regions.unsnap(regionId).catch(() => null);
  applyRegionsResponse(result);
}

function applyRegionsResponse(result) {
  if (Array.isArray(result?.items)) {
    state.regions = result.items;
    if (shouldPreserveInteractiveSurface()) {
      state.deferredRefreshPending = true;
      renderToolbar();
      renderNotice();
      renderEmptyState();
      return;
    }
    render();
    return;
  }

  void refreshRegions();
}

function scheduleRegionNamePatch(regionId, rawName, options = {}) {
  if (!regionId) {
    return;
  }

  const name = String(rawName || "").trim().slice(0, 80);

  if (!name) {
    return;
  }

  const previousTimer = state.regionNamePatchTimers.get(regionId);

  if (previousTimer) {
    window.clearTimeout(previousTimer);
    state.regionNamePatchTimers.delete(regionId);
  }

  const commit = async () => {
    state.regionNamePatchTimers.delete(regionId);
    const result = await window.screenVisionApi.regions.update(regionId, { name }).catch(() => null);
    applyRegionsResponse(result);
  };

  if (options.immediate) {
    void commit();
    return;
  }

  state.regionNamePatchTimers.set(regionId, window.setTimeout(() => {
    void commit();
  }, 300));
}

function scheduleRegionOpacity(regionId, rawValue) {
  if (!regionId) {
    return;
  }

  updateRegionOpacityState(regionId, rawValue);
  state.opacityPreviewValues.set(regionId, rawValue);

  if (state.opacityPreviewTimers.has(regionId)) {
    return;
  }

  const nextTimer = window.setTimeout(() => {
    state.opacityPreviewTimers.delete(regionId);
    const nextValue = state.opacityPreviewValues.get(regionId);
    state.opacityPreviewValues.delete(regionId);

    if (Number.isFinite(nextValue)) {
      void previewRegionOpacity(regionId, nextValue);
    }
  }, 33);

  state.opacityPreviewTimers.set(regionId, nextTimer);
}

function flushRegionOpacity(regionId, rawValue) {
  if (!regionId) {
    return;
  }

  const previewTimer = state.opacityPreviewTimers.get(regionId);

  if (previewTimer) {
    window.clearTimeout(previewTimer);
    state.opacityPreviewTimers.delete(regionId);
  }

  state.opacityPreviewValues.delete(regionId);

  const previousTimer = state.opacityCommitTimers.get(regionId);

  if (previousTimer) {
    window.clearTimeout(previousTimer);
    state.opacityCommitTimers.delete(regionId);
  }

  updateRegionOpacityState(regionId, rawValue);
  void previewRegionOpacity(regionId, rawValue);
  void setRegionOpacity(regionId, rawValue);
}

async function setRegionOpacity(regionId, rawValue) {
  if (!regionId) {
    return null;
  }

  const opacity = clampInteger(rawValue, 15, 100, 100) / 100;
  const result = await window.screenVisionApi.regions.setOpacity(regionId, opacity).catch(() => null);

  if (Array.isArray(result?.items)) {
    state.regions = result.items;
    render();
  }

  return result;
}

async function previewRegionOpacity(regionId, rawValue) {
  if (!regionId) {
    return null;
  }

  const opacity = clampInteger(rawValue, 15, 100, 100) / 100;
  return window.screenVisionApi.regions.previewOpacity(regionId, opacity).catch(() => null);
}

function updateRegionOpacityState(regionId, rawValue) {
  const nextOpacity = clampInteger(rawValue, 15, 100, 100);
  const region = findRegion(regionId);

  if (region) {
    region.opacity = nextOpacity;
  }
}

function scheduleCountdownPatch(regionId, patch, options = {}) {
  if (!regionId) {
    return;
  }

  const mergedPatch = {
    ...(state.countdownPatchValues.get(regionId) || {}),
    ...patch
  };

  state.countdownPatchValues.set(regionId, mergedPatch);

  if (options.immediate) {
    flushCountdownPatch(regionId);
    return;
  }

  const existingTimer = state.countdownPatchTimers.get(regionId);

  if (existingTimer) {
    return;
  }

  const nextTimer = window.setTimeout(() => {
    state.countdownPatchTimers.delete(regionId);
    void flushCountdownPatch(regionId);
  }, 90);

  state.countdownPatchTimers.set(regionId, nextTimer);
}

async function flushCountdownPatch(regionId) {
  const timer = state.countdownPatchTimers.get(regionId);

  if (timer) {
    window.clearTimeout(timer);
    state.countdownPatchTimers.delete(regionId);
  }

  const patch = state.countdownPatchValues.get(regionId);
  state.countdownPatchValues.delete(regionId);

  if (!patch) {
    return;
  }

  const result = await window.screenVisionApi.regions.update(regionId, { countdown: patch }).catch(() => null);
  applyRegionsResponse(result);
}

function applyLocalRegionPatch(regionId, patch) {
  const region = findRegion(regionId);

  if (!region) {
    return;
  }

  if ("countdown" in patch && patch.countdown && typeof patch.countdown === "object") {
    region.countdown = {
      ...(region.countdown || {}),
      ...patch.countdown
    };
  }

  if ("name" in patch) {
    region.name = patch.name;
  }

  if ("isVisible" in patch) {
    region.isVisible = patch.isVisible;
  }

  if ("isLocked" in patch) {
    region.isLocked = patch.isLocked;
  }
}

function render() {
  renderToolbar();
  renderNotice();
  renderEmptyState();
  els.gridOverlayButton?.classList.toggle("active", Boolean(state.grid?.enabled));

  if (!els.regionGrid) {
    return;
  }

  if (!state.regions.length) {
    els.regionGrid.innerHTML = "";
    bindDynamicTooltips(els.regionGrid);
    if (!shouldPreserveCountdownModalRender()) {
      renderModal();
    }
    return;
  }

  els.regionGrid.innerHTML = state.regions.map((region) => renderRegionCard(region)).join("");
  bindDynamicTooltips(els.regionGrid);
  if (!shouldPreserveCountdownModalRender()) {
    renderModal();
  }
}

function renderToolbar() {
  const count = state.regions.length;
  const allVisible = count > 0 && state.regions.every((region) => region.isVisible !== false);
  const allLocked = count > 0 && state.regions.every((region) => region.isLocked);

  if (els.regionCount) {
    els.regionCount.innerHTML = `${count}/&infin;`;
  }

  if (els.obsMirrorButton) {
    const obsEnabled = Boolean(state.obsMirrorStatus?.enabled && state.obsMirrorStatus?.connected);
    const obsLabel = obsEnabled ? t("screenVision.obs.disable") : t("screenVision.obs.enable");
    els.obsMirrorButton.classList.toggle("active", obsEnabled);
    els.obsMirrorButton.classList.toggle("inactive", !obsEnabled);
    els.obsMirrorButton.setAttribute("aria-label", obsLabel);
    setLiveTooltip(
      els.obsMirrorButton,
      state.obsMirrorStatus?.error || obsLabel,
      state.obsMirrorStatus?.error ? "danger" : "default"
    );
  }

  if (els.toggleAllVisibilityButton) {
    const toggleAllVisibilityTooltip = resolveTooltipState(
      els.toggleAllVisibilityButton,
      allVisible ? t("screenVision.toggleMirrorsHide") : t("screenVision.toggleMirrorsShow")
    );
    renderToolbarStateTile(
      els.toggleAllVisibilityButton,
      allVisible ? TOOLBAR_STATE_ASSETS.visible : TOOLBAR_STATE_ASSETS.hidden,
      allVisible
    );
    setLiveTooltip(
      els.toggleAllVisibilityButton,
      toggleAllVisibilityTooltip.message,
      toggleAllVisibilityTooltip.tone
    );
  }

  if (els.desktopVisibilityButton) {
    const desktopVisibilityTooltip = resolveTooltipState(
      els.desktopVisibilityButton,
      allVisible ? t("screenVision.toggleMirrorsHide") : t("screenVision.toggleMirrorsShow")
    );
    renderToolbarStateTile(
      els.desktopVisibilityButton,
      allVisible ? TOOLBAR_STATE_ASSETS.visible : TOOLBAR_STATE_ASSETS.hidden,
      allVisible
    );
    setLiveTooltip(
      els.desktopVisibilityButton,
      desktopVisibilityTooltip.message,
      desktopVisibilityTooltip.tone
    );
  }

  if (els.toggleAllLockButton) {
    const toggleAllLockTooltip = resolveTooltipState(
      els.toggleAllLockButton,
      allLocked ? t("screenVision.toggleLocksUnlock") : t("screenVision.toggleLocksLock")
    );
    renderToolbarStateTile(
      els.toggleAllLockButton,
      allLocked ? TOOLBAR_STATE_ASSETS.locked : TOOLBAR_STATE_ASSETS.unlocked,
      allLocked
    );
    setLiveTooltip(
      els.toggleAllLockButton,
      toggleAllLockTooltip.message,
      toggleAllLockTooltip.tone
    );
  }

  if (els.settingsButton) {
    const profilesLabel = t("screenVision.profiles.title");
    els.settingsButton.setAttribute("aria-label", profilesLabel);
    setLiveTooltip(els.settingsButton, profilesLabel);
    if (!els.settingsButton.querySelector("img")) {
      els.settingsButton.innerHTML = `<img src="${escapeHtml("assets/ui/tools/tibia-eye/toolbar/perfis.gif")}" alt="">`;
    }
  }

  if (els.openAlertasButton && !els.openAlertasButton.querySelector("img")) {
    els.openAlertasButton.innerHTML = `<img src="${escapeHtml("assets/ui/tools/tibia-eye/toolbar/avisos.gif")}" alt="">`;
  }

  if (els.openVisualCustomizationButton && !els.openVisualCustomizationButton.querySelector("img")) {
    els.openVisualCustomizationButton.innerHTML = `<img src="${escapeHtml(SQM_FINDER_ASSETS.sqm)}" alt="">`;
  }

  bindDynamicTooltips(els.shell);
}

function renderToolbarStateTile(button, imagePath, active) {
  if (!button) {
    return;
  }

  button.classList.toggle("active", Boolean(active));
  button.classList.toggle("inactive", !active);

  const currentImage = button.querySelector("img");
  if (currentImage) {
    currentImage.src = imagePath;
    return;
  }

  button.innerHTML = `<img src="${escapeHtml(imagePath)}" alt="">`;
}

function setLiveTooltip(trigger, message, tone = "") {
  if (!trigger) {
    return;
  }

  trigger.dataset.tooltip = message;

  if (tone) {
    trigger.dataset.tooltipTone = tone;
  } else {
    delete trigger.dataset.tooltipTone;
  }

  if (state.activeTooltipTrigger === trigger) {
    showFloatingTooltip(trigger);
  }
}

function resolveTooltipState(trigger, fallbackMessage, fallbackTone = "") {
  if (!trigger) {
    return {
      message: fallbackMessage,
      tone: fallbackTone
    };
  }

  const blockedUntil = Number(trigger.dataset.blockedTooltipUntil || 0);

  if (blockedUntil > Date.now()) {
    return {
      message: trigger.dataset.blockedTooltipMessage || fallbackMessage,
      tone: trigger.dataset.blockedTooltipTone || fallbackTone
    };
  }

  delete trigger.dataset.blockedTooltipUntil;
  delete trigger.dataset.blockedTooltipMessage;
  delete trigger.dataset.blockedTooltipTone;

  return {
    message: fallbackMessage,
    tone: fallbackTone
  };
}

function renderNotice() {
  if (!els.performanceNotice) {
    return;
  }

  const shouldWarn = state.regions.length > PERFORMANCE_NOTICE_THRESHOLD;
  els.performanceNotice.classList.toggle("hidden", !shouldWarn);
}

function renderEmptyState() {
  if (!els.emptyState) {
    return;
  }

  const tutorialProfileDemo = state.tutorialProfileDemo;
  const tutorialProfileDemoActive = Boolean(tutorialProfileDemo?.active);
  const hasRegions = state.regions.length > 0;
  const hasProfiles = tutorialProfileDemoActive
    ? Boolean(tutorialProfileDemo?.profileCreated)
    : state.profilesIndex.length > 0;
  // The cards are application UI, not native overlays. OBS is an allowed
  // companion surface only while the mirror output itself is active.
  const tibiaDetected = Boolean(
    state.tibiaState
    && state.tibiaState.title
    && state.tibiaState.shouldShowMirrorUi === true
  );
  const shouldShowWaitingState = !tibiaDetected;
  const shouldShowCreateProfileState = tibiaDetected && !hasProfiles;
  const shouldShowFirstMirrorState = tibiaDetected && hasProfiles && !hasRegions;
  const shouldShowGrid = tibiaDetected && hasRegions && !tutorialProfileDemoActive;
  const shouldShowEmptyState = shouldShowWaitingState || shouldShowCreateProfileState || shouldShowFirstMirrorState;

  els.emptyState.classList.toggle("hidden", !shouldShowEmptyState);
  els.regionGrid?.classList.toggle("hidden", !shouldShowGrid);

  if (!shouldShowEmptyState) {
    stopMirrorCreationNudge();
    state.emptyStateModeKey = "";
    state.emptyStateExtraKey = "";
    els.emptyStateExtra?.classList.add("hidden");
    if (els.emptyStateExtra && els.emptyStateExtra.innerHTML) {
      els.emptyStateExtra.innerHTML = "";
    }
    return;
  }

  if (els.emptyStateDot) {
    els.emptyStateDot.classList.toggle("hidden", true);
    els.emptyStateDot.classList.toggle("online", tibiaDetected);
  }

  if (els.emptyStateWaiting) {
    const waitingImage = shouldShowCreateProfileState
      ? PROFILE_PANEL_ASSETS.firstProfileState
      : "assets/ui/tools/tibia-eye/states/abra-o-tibia.gif";
    if (els.emptyStateWaiting.getAttribute("src") !== waitingImage) {
      els.emptyStateWaiting.src = waitingImage;
    }
    els.emptyStateWaiting.classList.remove("hidden");
  }

  if (els.emptyStateTitle) {
    let nextTitle = "Crie seu Primeiro Espelho";
    if (shouldShowWaitingState) {
      nextTitle = "Aguardando o Tibia";
    } else if (shouldShowCreateProfileState) {
      nextTitle = "Crie um Perfil";
    }
    if (els.emptyStateTitle.textContent !== nextTitle) {
      els.emptyStateTitle.textContent = nextTitle;
    }
  }

  if (els.emptyStateCopy) {
    let nextCopy = t("screenVision.emptyState.createMirrorHint");
    if (shouldShowWaitingState) {
      nextCopy = hasRegions
        ? t("screenVision.emptyState.restoreMirrorsHint")
        : t("screenVision.waitingCopy");
    } else if (shouldShowCreateProfileState) {
      nextCopy = t("screenVision.emptyState.createProfileHint");
    }
    if (els.emptyStateCopy.textContent !== nextCopy) {
      els.emptyStateCopy.textContent = nextCopy;
    }
  }

  const nextModeKey = shouldShowWaitingState
    ? `waiting:${hasRegions ? "regions" : "empty"}`
    : shouldShowCreateProfileState
      ? "create-profile"
      : "first-mirror";

  if (shouldShowCreateProfileState) {
    els.emptyState.classList.add("create-profile-layout");
    if (els.emptyStateExtra && els.emptyStateWaiting && els.emptyState.firstElementChild !== els.emptyStateExtra) {
      els.emptyState.insertBefore(els.emptyStateExtra, els.emptyStateWaiting);
    }
  } else {
    els.emptyState.classList.remove("create-profile-layout");
    if (els.emptyStateExtra && els.emptyStateCopy && els.emptyStateCopy.nextElementSibling !== els.emptyStateExtra) {
      els.emptyState.insertBefore(els.emptyStateExtra, els.emptyStateCopy.nextSibling);
    }
  }

  if (els.emptyStateExtra) {
    let nextExtraMarkup = "";
    let nextExtraKey = "";

    if (shouldShowCreateProfileState) {
      nextExtraMarkup = renderDockedProfileCreateCard({ emptyStateMode: true, idSuffix: "empty" });
      nextExtraKey = "create-profile";
      els.emptyStateExtra.classList.remove("hidden");
    } else if (shouldShowFirstMirrorState) {
      nextExtraMarkup = "";
      nextExtraKey = "";
      els.emptyStateExtra.classList.add("hidden");
    } else {
      nextExtraKey = "";
      els.emptyStateExtra.classList.add("hidden");
    }

    if (state.emptyStateExtraKey !== nextExtraKey) {
      els.emptyStateExtra.innerHTML = nextExtraMarkup;
      state.emptyStateExtraKey = nextExtraKey;
    }
  }

  state.emptyStateModeKey = nextModeKey;

  if (shouldShowFirstMirrorState && !state.mirrorCreationNudgeDismissed) {
    startMirrorCreationNudge();
  } else {
    stopMirrorCreationNudge();
  }
}

function startMirrorCreationNudge() {
  if (state.mirrorCreationNudgeHandle) {
    return;
  }

  const tick = () => {
    const button = els.addRegionButton;
    if (!button || state.mirrorCreationNudgeDismissed || state.regions.length > 0 || state.profilesIndex.length === 0) {
      stopMirrorCreationNudge();
      return;
    }

    if (button.matches(":hover")) {
      return;
    }

    flashAttention(button);
  };

  tick();
  state.mirrorCreationNudgeHandle = window.setInterval(tick, 1800);
}

function stopMirrorCreationNudge() {
  if (!state.mirrorCreationNudgeHandle) {
    return;
  }

  window.clearInterval(state.mirrorCreationNudgeHandle);
  state.mirrorCreationNudgeHandle = 0;
}

function renderRegionCard(region) {
  const opacity = clampInteger(region?.opacity, 15, 100, 100);
  const lockIcon = region?.isLocked ? "lock-closed" : "lock-open";
  const isInSnapGroup = Boolean(region?.isInSnapGroup);
  const showUnsnapButton = isInSnapGroup && !region?.isLocked;
  const isNameEditorOpen = state.openRegionNameEditorId === region.id;
  const isCountdownOpen = state.openCountdownRegionId === region.id;
  const countdown = normalizeCountdown(region?.countdown);
  const countdownButtonLabel = region?.countdownIsRunning ? "Cancelar" : "Testar";

  return `
    <article class="region-card${region?.isVisible === false ? " hidden-state" : ""}${region?.isLocked ? " locked-state" : ""}${isNameEditorOpen ? " name-editor-open" : ""}${isCountdownOpen ? " countdown-open" : ""}">
      <div class="region-card-surface">
        <div class="region-main">
          <div class="region-main-header">
            <h3 class="region-title">${escapeHtml(region?.name || "Espelho")}</h3>
          </div>

          <div class="region-controls">
            <button
              type="button"
              class="edit-menu-button icon-button${isNameEditorOpen ? " active" : ""}"
              data-action="toggle-name-editor"
              data-region-id="${escapeHtml(region.id)}"
              aria-label="${escapeHtml(t("screenVision.mirror.editName"))}"
              data-tooltip="${escapeHtml(isNameEditorOpen ? t("screenVision.mirror.closeNameEdit") : t("screenVision.mirror.editName"))}"
            >${renderIcon("edit")}</button>

            <button
              type="button"
              class="region-action-button icon-button${region?.isVisible === false ? " muted" : ""}"
              data-action="toggle-visibility"
              data-region-id="${escapeHtml(region.id)}"
              aria-label="${escapeHtml(t("screenVision.mirror.visibilityAria"))}"
              data-tooltip="${escapeHtml(region?.isVisible === false ? t("screenVision.mirror.show") : t("screenVision.mirror.hide"))}"
            >${renderIcon(region?.isVisible === false ? "eye-off" : "eye")}</button>

            <button
              type="button"
              class="region-action-button icon-button danger"
              data-action="delete"
              data-region-id="${escapeHtml(region.id)}"
              aria-label="${escapeHtml(t("screenVision.mirror.deleteAria"))}"
              data-tooltip="${escapeHtml(t("screenVision.mirror.delete"))}"
            >${renderIcon("trash")}</button>

            <button
              type="button"
              class="region-action-button icon-button ${region?.isLocked ? "lock-closed" : "lock-open"}"
              data-action="toggle-lock"
              data-region-id="${escapeHtml(region.id)}"
              aria-label="${escapeHtml(t("screenVision.mirror.lockAria"))}"
              data-tooltip="${escapeHtml(region?.isLocked ? t("screenVision.mirror.unlock") : t("screenVision.mirror.lock"))}"
            >${renderIcon(lockIcon)}</button>

            ${showUnsnapButton ? `
              <button
                type="button"
                class="region-action-button icon-button"
                data-action="unsnap"
                data-region-id="${escapeHtml(region.id)}"
                aria-label="${escapeHtml(t("screenVision.mirror.unsnapAria"))}"
                data-tooltip="${escapeHtml(t("screenVision.mirror.unsnap"))}"
              >${renderIcon("unsnap")}</button>
            ` : ""}

            <button
              type="button"
              class="region-action-button icon-button"
              data-action="toggle-countdown-panel"
              data-region-id="${escapeHtml(region.id)}"
              aria-label="${escapeHtml(t("screenVision.mirror.addCooldownBarAria"))}"
              data-tooltip="${escapeHtml(t("screenVision.mirror.addCooldownBar"))}"
            >${renderIcon("countdown")}</button>

            <div class="region-controls-right">
              <label class="region-opacity" data-tooltip="${escapeHtml(t("screenVision.mirror.opacityTooltip"))}">
                <span class="region-opacity-shell">
                  <img class="region-opacity-icon" src="assets/ui/tools/tibia-eye/opacity-sparkles.gif" alt="">
                  <input type="range" min="15" max="100" step="1" value="${opacity}" style="--region-opacity-progress:${escapeHtml(String(((opacity - 15) / 85) * 100))}%;" data-opacity-region-id="${escapeHtml(region.id)}">
                </span>
                <span data-opacity-value>${opacity}%</span>
              </label>
            </div>
          </div>
        </div>
        ${isNameEditorOpen ? renderRegionNameExtension(region) : ""}
        ${isCountdownOpen ? renderCountdownPanel(region, countdown, countdownButtonLabel, { card: true }) : ""}
      </div>
    </article>
  `;
}

function renderRegionNameExtension(region) {
  return `
    <div class="region-name-extension docked-alert-extension docked-alert-config-extension">
      <div class="docked-alert-grid-row docked-alert-grid-row-message">
        <label for="region-name-${escapeHtml(region.id)}">${escapeHtml(t("screenVision.mirror.nameLabel"))}</label>
        <input
          id="region-name-${escapeHtml(region.id)}"
          type="text"
          maxlength="80"
          value="${escapeHtml(region?.name || "")}"
          placeholder="${escapeHtml(t("screenVision.mirror.namePlaceholder"))}"
          data-region-id="${escapeHtml(region.id)}"
          data-region-name-field="true"
          data-tooltip="${escapeHtml(t("screenVision.mirror.nameTooltip"))}"
        >
      </div>
    </div>
  `;
}

function renderCountdownPanel(region, countdown, countdownButtonLabel, options = {}) {
  const locked = Boolean(region?.isLocked);
  const sideValue = String(countdown.side || "Above");
  const directionValue = String(countdown.direction || "LeftToRight");
  const modalClass = options.modal ? " countdown-panel-modal" : "";
  const cardClass = options.card ? " countdown-panel-card" : "";
  const enabled = Boolean(countdown.enabled);
  const running = countdownButtonLabel === "Cancelar";
  const dimensionFields = getCountdownDimensionFields(sideValue);
  const widthValue = countdown[dimensionFields.width];
  const heightValue = countdown[dimensionFields.height];
  const capturingHotkey = state.countdownCapturingHotkeyRegionId === region.id;

  return `
    <section class="countdown-panel${modalClass}${cardClass}">
      <div class="countdown-body${locked ? "" : " disabled"}">
        ${locked ? "" : `<div class="countdown-warning">${escapeHtml(t("screenVision.countdown.lockMirrorWarning"))}</div>`}

        <div class="countdown-field-grid">
          <div class="countdown-hero-row">
            <div class="countdown-hero-left">
              <button
                type="button"
                class="countdown-image-toggle${enabled ? " active" : " inactive"}"
                data-action="countdown-toggle-field"
                data-region-id="${escapeHtml(region.id)}"
                data-countdown-field="enabled"
                data-tooltip="${escapeHtml(enabled ? t("screenVision.countdown.disableBar") : t("screenVision.countdown.enableBar"))}"
                aria-label="${escapeHtml(enabled ? t("screenVision.countdown.disableBar") : t("screenVision.countdown.enableBar"))}"
              >
                <img src="${escapeHtml(enabled ? COUNTDOWN_ASSETS.bar : COUNTDOWN_ASSETS.barStill)}" alt="">
              </button>

              <span class="countdown-mini-divider" aria-hidden="true"></span>

              <button
                type="button"
                class="countdown-image-toggle${countdown.flashEnabled ? " active" : " inactive"}"
                data-action="countdown-toggle-field"
                data-region-id="${escapeHtml(region.id)}"
                data-countdown-field="flashEnabled"
                data-tooltip="${escapeHtml(t("screenVision.countdown.flashTooltip"))}"
                aria-label="${escapeHtml(t("screenVision.countdown.flashAria"))}"
              >
                <img src="${escapeHtml(countdown.flashEnabled ? COUNTDOWN_ASSETS.flash : COUNTDOWN_ASSETS.flashStill)}" alt="">
              </button>

              <button
                type="button"
                class="countdown-lock-toggle docked-alert-icon-button${countdown.retriggerEnabled ? "" : " inactive"}"
                data-action="countdown-toggle-field"
                data-region-id="${escapeHtml(region.id)}"
                data-countdown-field="retriggerEnabled"
                data-tooltip="${escapeHtml(countdown.retriggerEnabled ? t("screenVision.countdown.blockRestart") : t("screenVision.countdown.allowRestart"))}"
                aria-label="${escapeHtml(t("screenVision.countdown.restartLockAria"))}"
              >${renderIcon(countdown.retriggerEnabled ? "lock-closed" : "lock-open")}</button>
            </div>

            <button
              type="button"
              class="countdown-image-toggle countdown-test-image${running ? " active" : " inactive"}"
              data-action="toggle-countdown-run"
              data-region-id="${escapeHtml(region.id)}"
              data-tooltip="${escapeHtml(running ? t("screenVision.countdown.cancelRun") : t("screenVision.countdown.testNow"))}"
              aria-label="${escapeHtml(running ? t("screenVision.countdown.cancelTestAria") : t("screenVision.countdown.testAria"))}"
            >
              <img src="${escapeHtml(running ? COUNTDOWN_ASSETS.playtest : COUNTDOWN_ASSETS.playtestStill)}" alt="">
            </button>
          </div>

          <div class="countdown-row countdown-row-three countdown-control-row">
            <div class="countdown-field countdown-hotkey-field">
              <label>${escapeHtml(t("screenVision.countdown.hotkeyLabel"))}</label>
              <button type="button" class="docked-alert-hotkey-capture countdown-hotkey-capture${countdown.hotkey ? " has-hotkey" : " needs-hotkey"}${capturingHotkey ? " capturing" : ""}" data-region-id="${escapeHtml(region.id)}" data-countdown-field="hotkey" data-countdown-hotkey="true" data-tooltip="${escapeHtml(capturingHotkey ? t("screenVision.countdown.hotkeyClear") : countdown.hotkey ? t("screenVision.countdown.hotkeyChange") : t("screenVision.countdown.hotkeySet"))}" aria-label="${escapeHtml(t("screenVision.countdown.hotkeyAria"))}">
                ${renderCountdownHotkeyKeycaps(countdown, capturingHotkey)}
              </button>
            </div>

            <div class="countdown-field">
              <label>${escapeHtml(t("screenVision.countdown.durationLabel"))}</label>
              <div class="countdown-slider-stack">
                <input type="range" min="1" max="600" step="1" value="${escapeHtml(String(countdown.durationSeconds))}" style="${escapeHtml(renderCountdownRangeStyle(countdown.durationSeconds, 1, 600))}" data-region-id="${escapeHtml(region.id)}" data-countdown-field="durationSeconds" data-tooltip="${escapeHtml(t("screenVision.countdown.durationTooltip"))}">
                <input type="number" min="1" max="43200" step="1" value="${escapeHtml(String(countdown.durationSeconds))}" data-region-id="${escapeHtml(region.id)}" data-countdown-field="durationSeconds" data-tooltip="${escapeHtml(t("screenVision.countdown.durationTooltip"))}">
              </div>
            </div>

            <div class="countdown-choice-pair">
              <div class="countdown-field">
                <label>${escapeHtml(t("screenVision.countdown.positionLabel"))}</label>
                <div class="countdown-key-grid">
                ${renderCountdownSideRadio(region.id, "Above", "Cima", "up", sideValue)}
                ${renderCountdownSideRadio(region.id, "Below", "Baixo", "down", sideValue)}
                ${renderCountdownSideRadio(region.id, "Left", "Esquerda", "left", sideValue)}
                ${renderCountdownSideRadio(region.id, "Right", "Direita", "right", sideValue)}
                </div>
              </div>

              <span class="countdown-mini-divider countdown-choice-divider" aria-hidden="true"></span>

              <div class="countdown-field">
                <label>${escapeHtml(t("screenVision.countdown.directionLabel"))}</label>
                <div class="countdown-key-grid">
                ${renderCountdownDirectionRadio(region.id, "TopToBottom", "Cima para baixo", "down", directionValue)}
                ${renderCountdownDirectionRadio(region.id, "BottomToTop", "Baixo para cima", "up", directionValue)}
                ${renderCountdownDirectionRadio(region.id, "LeftToRight", "Esquerda para direita", "right", directionValue)}
                ${renderCountdownDirectionRadio(region.id, "RightToLeft", "Direita para esquerda", "left", directionValue)}
                </div>
              </div>
            </div>
          </div>

          <div class="countdown-section-title">${escapeHtml(t("screenVision.countdown.barSizeTitle"))}</div>
          <div class="countdown-row countdown-row-three countdown-size-row">
            <div class="countdown-field">
              <label>${escapeHtml(t("screenVision.countdown.widthLabel"))}</label>
              <div class="countdown-number-stack">
                  <input type="range" min="1" max="240" step="1" value="${escapeHtml(String(widthValue))}" style="${escapeHtml(renderCountdownRangeStyle(widthValue, 1, 240))}" data-region-id="${escapeHtml(region.id)}" data-countdown-field="${escapeHtml(dimensionFields.width)}" data-tooltip="${escapeHtml(t("screenVision.countdown.widthTooltip"))}">
                  <input type="number" min="1" max="2000" step="1" value="${escapeHtml(String(widthValue))}" data-region-id="${escapeHtml(region.id)}" data-countdown-field="${escapeHtml(dimensionFields.width)}" data-tooltip="${escapeHtml(t("screenVision.countdown.widthTooltip"))}">
              </div>
            </div>

            <div class="countdown-field">
              <label>${escapeHtml(t("screenVision.countdown.heightLabel"))}</label>
              <div class="countdown-number-stack">
                <input type="range" min="1" max="600" step="1" value="${escapeHtml(String(heightValue))}" style="${escapeHtml(renderCountdownRangeStyle(heightValue, 1, 600))}" data-region-id="${escapeHtml(region.id)}" data-countdown-field="${escapeHtml(dimensionFields.height)}" data-tooltip="${escapeHtml(t("screenVision.countdown.heightTooltip"))}">
                <input type="number" min="1" max="4000" step="1" value="${escapeHtml(String(heightValue))}" data-region-id="${escapeHtml(region.id)}" data-countdown-field="${escapeHtml(dimensionFields.height)}" data-tooltip="${escapeHtml(t("screenVision.countdown.heightTooltip"))}">
              </div>
            </div>

            <div class="countdown-field">
              <label class="countdown-color-label">${escapeHtml(t("screenVision.countdown.barColorLabel"))}</label>
              ${renderCountdownColorControl(region.id, "color", countdown.color, countdown.savedColors, { withGradient: true })}
            </div>
          </div>

          <div class="countdown-row countdown-row-three countdown-border-row">
            <div class="countdown-field">
              <label>${escapeHtml(t("screenVision.countdown.borderWidthLabel"))}</label>
              <div class="countdown-slider-stack">
                <input type="range" min="0" max="24" step="1" value="${escapeHtml(String(countdown.borderWidth))}" style="${escapeHtml(renderCountdownRangeStyle(countdown.borderWidth, 0, 24))}" data-region-id="${escapeHtml(region.id)}" data-countdown-field="borderWidth" data-tooltip="${escapeHtml(t("screenVision.countdown.borderWidthTooltip"))}">
                <input type="number" min="0" max="64" step="1" value="${escapeHtml(String(countdown.borderWidth))}" data-region-id="${escapeHtml(region.id)}" data-countdown-field="borderWidth" data-tooltip="${escapeHtml(t("screenVision.countdown.borderWidthTooltip"))}">
              </div>
            </div>

            <div class="countdown-field">
              <label>${escapeHtml(t("screenVision.countdown.roundingLabel"))}</label>
              <div class="countdown-slider-stack">
                <input type="range" min="0" max="60" step="1" value="${escapeHtml(String(countdown.borderRadius))}" style="${escapeHtml(renderCountdownRangeStyle(countdown.borderRadius, 0, 60))}" data-region-id="${escapeHtml(region.id)}" data-countdown-field="borderRadius" data-tooltip="${escapeHtml(t("screenVision.countdown.roundingTooltip"))}">
                <input type="number" min="0" max="200" step="1" value="${escapeHtml(String(countdown.borderRadius))}" data-region-id="${escapeHtml(region.id)}" data-countdown-field="borderRadius" data-tooltip="${escapeHtml(t("screenVision.countdown.roundingTooltip"))}">
              </div>
            </div>

            <div class="countdown-field">
              <label class="countdown-color-label">${escapeHtml(t("screenVision.countdown.borderColorLabel"))}</label>
              ${renderCountdownColorControl(region.id, "borderColor", countdown.borderColor, countdown.savedBorderColors, { withGradient: false })}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderCountdownSideRadio(regionId, value, label, icon, selectedValue) {
  const tooltip = {
    Above: t("screenVision.countdown.positionAbove"),
    Below: t("screenVision.countdown.positionBelow"),
    Left: t("screenVision.countdown.positionLeft"),
    Right: t("screenVision.countdown.positionRight")
  }[value] || t("screenVision.countdown.choosePosition");

  return `
    <button
      type="button"
      class="countdown-key-button${value === selectedValue ? " active" : ""}"
      data-action="countdown-choice"
      data-region-id="${escapeHtml(regionId)}"
      data-countdown-field="side"
      data-countdown-value="${escapeHtml(value)}"
      data-tooltip="${escapeHtml(tooltip)}"
      aria-label="${escapeHtml(label)}"
    >${renderCountdownArrowIcon(icon)}</button>
  `;
}

function renderCountdownDirectionRadio(regionId, value, label, icon, selectedValue) {
  const tooltip = {
    TopToBottom: t("screenVision.countdown.directionTopToBottom"),
    BottomToTop: t("screenVision.countdown.directionBottomToTop"),
    LeftToRight: t("screenVision.countdown.directionLeftToRight"),
    RightToLeft: t("screenVision.countdown.directionRightToLeft")
  }[value] || t("screenVision.countdown.chooseDirection");

  return `
    <button
      type="button"
      class="countdown-key-button${value === selectedValue ? " active" : ""}"
      data-action="countdown-choice"
      data-region-id="${escapeHtml(regionId)}"
      data-countdown-field="direction"
      data-countdown-value="${escapeHtml(value)}"
      data-tooltip="${escapeHtml(tooltip)}"
      aria-label="${escapeHtml(label)}"
    >${renderCountdownArrowIcon(icon)}</button>
  `;
}

function renderCountdownArrowIcon(direction) {
  const arrows = {
    up: "↑",
    down: "↓",
    left: "←",
    right: "→"
  };

  return `<span aria-hidden="true">${escapeHtml(arrows[direction] || "•")}</span>`;
}

function renderCountdownColorControl(regionId, field, selectedValue, savedColors = [], options = {}) {
  const safeValue = normalizeCountdownColor(selectedValue);
  const selectedColor = safeValue === "gradient" ? "#58c470" : safeValue;
  const colorField = field === "borderColor" ? "savedBorderColors" : "savedColors";
  const colors = normalizeCountdownSavedColors(savedColors, field);

  return `
    <div class="countdown-color-control">
      <div class="countdown-color-actions">
        ${options.withGradient ? `
          <button
            type="button"
            class="countdown-color-orb countdown-color-gradient${safeValue === "gradient" ? " active" : ""}"
            data-region-id="${escapeHtml(regionId)}"
            data-countdown-color-field="${escapeHtml(field)}"
            data-countdown-color="gradient"
            data-tooltip="${escapeHtml(t("screenVision.countdown.dynamicColor"))}"
            aria-label="${escapeHtml(t("screenVision.countdown.dynamicColorAria"))}"
          ></button>
        ` : ""}
        <label class="countdown-color-orb countdown-color-picker" data-tooltip="${escapeHtml(t("screenVision.sqm.openColorPicker"))}">
          <input type="color" value="${escapeHtml(selectedColor)}" data-region-id="${escapeHtml(regionId)}" data-countdown-field="${escapeHtml(field)}">
          <span style="background:${escapeHtml(selectedColor)}"></span>
        </label>
        <button
          type="button"
          class="docked-alert-icon-button small"
          data-action="countdown-save-color"
          data-region-id="${escapeHtml(regionId)}"
          data-countdown-field="${escapeHtml(field)}"
          data-countdown-color-field="${escapeHtml(colorField)}"
          data-tooltip="${escapeHtml(t("screenVision.sqm.saveColor"))}"
          aria-label="${escapeHtml(t("screenVision.sqm.saveColorAria"))}"
        >${renderIcon("save")}</button>
        <button
          type="button"
          class="docked-alert-icon-button small danger"
          data-action="countdown-delete-color"
          data-region-id="${escapeHtml(regionId)}"
          data-countdown-field="${escapeHtml(field)}"
          data-countdown-color-field="${escapeHtml(colorField)}"
          data-tooltip="${escapeHtml(t("screenVision.sqm.deleteColor"))}"
          aria-label="${escapeHtml(t("screenVision.sqm.deleteColorAria"))}"
        >${renderIcon("trash")}</button>
      </div>
      <div class="countdown-color-swatches">
        ${colors.map((color) => `
          <button
            type="button"
            class="countdown-color-chip${String(color).toLowerCase() === String(selectedColor).toLowerCase() ? " selected" : ""}${String(color).toLowerCase() === "#ffffff" ? " is-white" : ""}"
            style="background:${escapeHtml(color)};"
            data-region-id="${escapeHtml(regionId)}"
            data-countdown-color-field="${escapeHtml(field)}"
            data-countdown-color="${escapeHtml(color)}"
            data-tooltip="${escapeHtml(color.toUpperCase())}"
            aria-label="${escapeHtml(t("screenVision.sqm.useColor", { color: color.toUpperCase() }))}"
          ></button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCountdownHotkeyKeycaps(countdown, capturing = false) {
  const label = countdown.hotkey || "";

  if (!label) {
    return `<span class="docked-alert-hotkey-placeholder compact">${escapeHtml(capturing ? t("screenVision.countdown.hotkeyPress") : t("screenVision.countdown.hotkeyPlaceholder"))}</span>`;
  }

  return label.split("+").map((part, index, parts) => `
    <span class="docked-alert-hotkey-chip compact">${escapeHtml(part.trim() || "+")}</span>
    ${index < parts.length - 1 ? '<span class="docked-alert-hotkey-plus compact">+</span>' : ""}
  `).join("");
}

function renderCountdownRangeStyle(value, min, max) {
  const numeric = Number(value);
  const lower = Number(min);
  const upper = Number(max);
  const safeValue = Number.isFinite(numeric) ? numeric : lower;
  const fill = upper > lower ? ((safeValue - lower) / (upper - lower)) * 100 : 0;
  return `--countdown-fill:${Math.max(0, Math.min(100, fill)).toFixed(2)}%;`;
}

function replaceStaticIcons() {
  document.querySelectorAll("[data-icon]").forEach((element) => {
    const kind = element.dataset.icon || "";
    element.innerHTML = renderIcon(kind);
  });
}

function renderIcon(kind) {
  const pathData = ICONS[kind];
  const viewBox = kind === "shadow" ? "0 0 48 48" : "0 0 24 24";

  if (!pathData) {
    return "";
  }

  return `
    <svg viewBox="${viewBox}" aria-hidden="true">
      <path
        d="${pathData}"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

function normalizeCountdown(countdown) {
  const source = countdown && typeof countdown === "object" ? countdown : {};
  const side = normalizeCountdownSide(source.side);
  const sideDefaults = getCountdownDefaultsForSide(side);
  const hasThickness = source.barThickness !== undefined && source.barThickness !== null;
  const hasLength = source.barLength !== undefined && source.barLength !== null;
  const hasDirection = source.direction !== undefined && source.direction !== null;

  return {
    enabled: Boolean(source.enabled),
    durationSeconds: clampInteger(source.durationSeconds, 1, 43200, 60),
    hotkey: typeof source.hotkey === "string" ? source.hotkey.trim().toUpperCase() : "",
    side,
    direction: hasDirection ? normalizeCountdownDirection(source.direction) : sideDefaults.direction,
    barThickness: hasThickness ? clampInteger(source.barThickness, 1, 2000, sideDefaults.barThickness) : sideDefaults.barThickness,
    barLength: hasLength ? clampInteger(source.barLength, 1, 4000, sideDefaults.barLength) : sideDefaults.barLength,
    color: normalizeCountdownColor(source.color),
    borderWidth: clampInteger(source.borderWidth, 0, 64, 1),
    borderRadius: clampInteger(source.borderRadius, 0, 200, 3),
    borderColor: normalizeCountdownColor(source.borderColor || "#ffffff"),
    flashEnabled: source.flashEnabled !== false,
    retriggerEnabled: Boolean(source.retriggerEnabled),
    savedColors: normalizeCountdownSavedColors(source.savedColors, "color"),
    savedBorderColors: normalizeCountdownSavedColors(source.savedBorderColors, "borderColor")
  };
}

function getCountdownDefaultsForSide(side) {
  const normalizedSide = normalizeCountdownSide(side);

  if (normalizedSide === "Left" || normalizedSide === "Right") {
    return {
      barThickness: 5,
      barLength: 32,
      direction: "TopToBottom"
    };
  }

  return {
    barThickness: 5,
    barLength: 32,
    direction: "RightToLeft"
  };
}

function getCountdownDimensionFields(side) {
  const normalizedSide = normalizeCountdownSide(side);

  if (normalizedSide === "Left" || normalizedSide === "Right") {
    return {
      width: "barThickness",
      height: "barLength"
    };
  }

  return {
    width: "barLength",
    height: "barThickness"
  };
}

function normalizeCountdownSavedColors(colors, field = "color") {
  const defaults = field === "borderColor"
    ? ["#ffffff", "#58c470", "#ff4444", "#0088ff"]
    : ["#58c470", "#ffffff", "#ff4444", "#0088ff"];
  const source = Array.isArray(colors) && colors.length ? colors : defaults;
  const seen = new Set();

  return source
    .map((color) => normalizeCountdownColor(color))
    .filter((color) => color && color !== "gradient")
    .filter((color) => {
      const key = color.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

function normalizeCountdownSide(value) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (text === "left") {
    return "Left";
  }

  if (text === "right") {
    return "Right";
  }

  if (text === "below") {
    return "Below";
  }

  return "Above";
}

function normalizeCountdownColor(value) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return "gradient";
  }

  if (text.toLowerCase() === "gradient") {
    return "gradient";
  }

  return /^#[0-9a-f]{6,8}$/i.test(text) ? text : "gradient";
}

function normalizeCountdownDirection(value) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (text === "toptobottom" || text === "top-to-bottom") {
    return "TopToBottom";
  }

  if (text === "bottomtotop" || text === "bottom-to-top") {
    return "BottomToTop";
  }

  if (text === "righttoleft" || text === "right-to-left") {
    return "RightToLeft";
  }

  return "LeftToRight";
}

function readCountdownFieldValue(input, field) {
  if (field === "enabled" || field === "flashEnabled" || field === "retriggerEnabled") {
    return Boolean(input.checked);
  }

  if (field === "durationSeconds" || field === "barThickness" || field === "barLength" || field === "borderWidth" || field === "borderRadius") {
    if (field === "durationSeconds") {
      return clampInteger(input.value, 1, 43200, 1);
    }

    if (field === "barThickness") {
      return clampInteger(input.value, 1, 2000, 1);
    }

    if (field === "borderWidth") {
      return clampInteger(input.value, 0, 64, 1);
    }

    if (field === "borderRadius") {
      return clampInteger(input.value, 0, 200, 3);
    }

    return clampInteger(input.value, 1, 4000, 1);
  }

  if (field === "side") {
    return normalizeCountdownSide(input.value);
  }

  if (field === "direction") {
    return normalizeCountdownDirection(input.value);
  }

  if (field === "hotkey") {
    return String(input.value || "").trim().toUpperCase();
  }

  if (field === "color" || field === "borderColor") {
    return normalizeCountdownColor(input.value);
  }

  return input.value;
}

function updateCountdownInlineUi(input, field, value) {
  if (field === "durationSeconds" || field === "barThickness" || field === "barLength" || field === "borderWidth" || field === "borderRadius") {
    updateCountdownRangeFill(input);
    const regionId = input.dataset.regionId || "";
    const allMatches = document.querySelectorAll(
      `[data-region-id="${cssEscape(regionId)}"][data-countdown-field="${cssEscape(field)}"]`
    );

    allMatches.forEach((match) => {
      if (match === input) {
        return;
      }

      match.value = String(value);
      updateCountdownRangeFill(match);
    });
  }

  if (field === "color" || field === "borderColor") {
    const picker = input.closest(".countdown-color-picker");
    const preview = picker?.querySelector("span");
    const color = normalizeCountdownColor(value);
    if (preview && color !== "gradient") {
      preview.style.background = color;
    }
  }
}

function updateCountdownRangeFill(input) {
  if (!input || input.type !== "range") {
    return;
  }

  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || min);
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  input.style.setProperty("--countdown-fill", `${Math.max(0, Math.min(100, fill)).toFixed(2)}%`);
}

async function openProfilesModal() {
  const items = await window.screenVisionApi.profiles.list().catch(() => []);
  const selectedPath = items.find((entry) => entry?.isActive)?.path || items[0]?.path || "";
  state.profileSelectionPath = selectedPath;
  state.modal = {
    kind: "profiles",
    items
  };
  renderModal();
}

async function handleProfilesModalAction(action) {
  const selectedPath = state.profileSelectionPath || "";
  const selectedProfile = state.modal?.items?.find((entry) => entry?.path === selectedPath) || null;

  if (action === "create") {
    state.modal = {
      title: t("screenVision.profiles.createTitle"),
      message: t("screenVision.profiles.createMessage"),
      inputValue: "",
      confirmLabel: t("screenVision.profiles.newButton"),
      cancelLabel: t("common.cancel"),
      onConfirm: async (value) => {
        await window.screenVisionApi.profiles.create(String(value || "").trim() || t("screenVision.profiles.defaultName")).catch(() => null);
        await refreshAll();
        await openProfilesModal();
      }
    };
    renderModal();
    return;
  }

  if (action === "import") {
    await window.screenVisionApi.profiles.import().catch(() => null);
    await refreshAll();
    await openProfilesModal();
    return;
  }

  if (action === "export") {
    await window.screenVisionApi.profiles.export(selectedProfile?.path || "").catch(() => null);
    return;
  }

  if (!selectedProfile) {
    return;
  }

  if (action === "rename") {
    state.modal = {
      title: t("screenVision.profiles.renameTitle"),
      message: t("screenVision.profiles.renameMessage", { name: selectedProfile.name }),
      inputValue: selectedProfile.name || "",
      confirmLabel: t("common.save"),
      cancelLabel: t("common.cancel"),
      onConfirm: async (value) => {
        const nextName = String(value || "").trim();

        if (!nextName) {
          return;
        }

        await window.screenVisionApi.profiles.rename(selectedProfile.path, nextName).catch(() => null);
        await openProfilesModal();
      }
    };
    renderModal();
    return;
  }

  if (action === "duplicate") {
    await window.screenVisionApi.profiles.duplicate(selectedProfile.path).catch(() => null);
    await refreshAll();
    await openProfilesModal();
    return;
  }

  if (action === "activate") {
    await window.screenVisionApi.profiles.activate(selectedProfile.path).catch(() => null);
    await refreshAll();
    await openProfilesModal();
    return;
  }

  if (action === "delete") {
    const dialogResult = await confirmExternalModal({
      title: "Confirmar Exclusao",
    message: `Deletar perfil "${selectedProfile.name}"?`,
    confirmLabel: "Sim",
    cancelLabel: "Cancelar",
    checkboxLabel: "Nao perguntar novamente nesta sessao",
    sessionKey: "delete-profile-v2"
    });

    if (!dialogResult.confirmed) {
      return;
    }

    await window.screenVisionApi.profiles.delete(selectedProfile.path).catch(() => null);
    await refreshAll();
    await openProfilesModal();
    return;
  }
}

async function openDeleteRegionModal(region) {
  const dialogResult = await confirmExternalModal({
    title: "Confirmar Exclusao",
    message: `Deletar espelho "${region.name || "Espelho"}"?`,
    confirmLabel: "Sim",
    cancelLabel: "Cancelar",
    checkboxLabel: "Nao perguntar novamente nesta sessao",
    sessionKey: "delete-region-v2"
  });

  if (!dialogResult.confirmed) {
    return;
  }

  await deleteRegion(region.id);
}

function openCountdownModal(region) {
  void window.screenVisionApi.regions.openCountdownEditor(region.id);
}

function closeModal() {
  state.modal = null;
  renderModal();
}

function renderModal() {
  if (!els.modalRoot) {
    return;
  }

  if (!state.modal) {
    els.modalRoot.classList.add("hidden");
    els.modalRoot.innerHTML = "";
    return;
  }

  if (state.modal.kind === "countdown") {
    const region = findRegion(state.modal.regionId);

    if (!region) {
      closeModal();
      return;
    }

    const countdown = normalizeCountdown(region.countdown);
    const countdownButtonLabel = region.countdownIsRunning ? "Cancelar" : "Testar";

    els.modalRoot.classList.remove("hidden");
    els.modalRoot.innerHTML = `
      <div class="screen-vision-modal-card screen-vision-modal-card-countdown" role="dialog" aria-modal="true">
        <div class="screen-vision-modal-head">
          <div>
            <h2 class="screen-vision-modal-title">${escapeHtml(t("screenVision.countdown.title"))}</h2>
            <p class="screen-vision-modal-copy">${escapeHtml(t("screenVision.countdown.configureForMirror", { name: region.name || t("screenVision.mirror.defaultName") }))}</p>
          </div>
          <button type="button" class="screen-vision-modal-close" data-modal-action="cancel" aria-label="${escapeHtml(t("common.close"))}" data-tooltip="${escapeHtml(t("screenVision.modal.closeWindow"))}">&times;</button>
        </div>
        ${renderCountdownPanel(region, countdown, countdownButtonLabel, { modal: true })}
        <div class="screen-vision-modal-actions">
          <button type="button" class="screen-vision-modal-button" data-modal-action="cancel" data-tooltip="${escapeHtml(t("screenVision.modal.closeWindow"))}">${escapeHtml(t("common.close"))}</button>
        </div>
      </div>
    `;

    bindDynamicTooltips(els.modalRoot);
    return;
  }

  if (state.modal.kind === "profiles") {
    const items = Array.isArray(state.modal.items) ? state.modal.items : [];

    els.modalRoot.classList.remove("hidden");
    els.modalRoot.innerHTML = `
      <div class="screen-vision-modal-card screen-vision-modal-card-profiles" role="dialog" aria-modal="true">
        <div class="screen-vision-modal-head">
          <div>
            <h2 class="screen-vision-modal-title">${escapeHtml(t("sidePanel.profiles.title"))}</h2>
            <p class="screen-vision-modal-copy">${escapeHtml(t("screenVision.profiles.modalCopy"))}</p>
          </div>
          <button type="button" class="screen-vision-modal-close" data-modal-action="cancel" aria-label="${escapeHtml(t("common.close"))}" data-tooltip="${escapeHtml(t("screenVision.profiles.closeList"))}">&times;</button>
        </div>
        <div class="profiles-modal-list">
          ${items.length ? items.map((item) => `
            <button
              type="button"
              class="profile-list-row${item.path === state.profileSelectionPath ? " selected" : ""}"
              data-profile-path="${escapeHtml(item.path)}"
              data-tooltip="${escapeHtml(t("screenVision.profiles.selectProfile"))}"
            >
              <span class="profile-list-name">${escapeHtml(item.name || "Perfil")}</span>
              ${item.isActive ? `<span class="profile-list-active">${escapeHtml(t("screenVision.profiles.activeBadge"))}</span>` : ""}
            </button>
          `).join("") : `<div class="profiles-empty-state">${escapeHtml(t("screenVision.profiles.noneFound"))}</div>`}
        </div>
        <div class="profiles-modal-actions-grid">
          <button type="button" class="screen-vision-modal-button" data-profile-action="create" data-tooltip="${escapeHtml(t("screenVision.profiles.createEmpty"))}">${escapeHtml(t("screenVision.profiles.newButton"))}</button>
          <button type="button" class="screen-vision-modal-button" data-profile-action="rename" data-tooltip="${escapeHtml(t("screenVision.profiles.rename"))}">${escapeHtml(t("screenVision.profiles.renameButton"))}</button>
          <button type="button" class="screen-vision-modal-button" data-profile-action="duplicate" data-tooltip="${escapeHtml(t("screenVision.profiles.duplicate"))}">${escapeHtml(t("screenVision.profiles.duplicateButton"))}</button>
          <button type="button" class="screen-vision-modal-button" data-profile-action="activate" data-tooltip="${escapeHtml(t("screenVision.profiles.switchTo"))}">${escapeHtml(t("screenVision.profiles.switchButton"))}</button>
          <button type="button" class="screen-vision-modal-button" data-profile-action="import" data-tooltip="${escapeHtml(t("screenVision.profiles.importSaved"))}">${escapeHtml(t("screenVision.profiles.importButton"))}</button>
          <button type="button" class="screen-vision-modal-button" data-profile-action="export" data-tooltip="${escapeHtml(t("screenVision.profiles.exportSelected"))}">${escapeHtml(t("screenVision.profiles.exportButton"))}</button>
          <button type="button" class="screen-vision-modal-button danger" data-profile-action="delete" data-tooltip="${escapeHtml(t("screenVision.profiles.deleteSelected"))}">${escapeHtml(t("screenVision.profiles.deleteButton"))}</button>
        </div>
        <div class="screen-vision-modal-actions">
          <button type="button" class="screen-vision-modal-button" data-modal-action="cancel" data-tooltip="${escapeHtml(t("screenVision.profiles.closeList"))}">${escapeHtml(t("common.close"))}</button>
        </div>
      </div>
    `;

    bindDynamicTooltips(els.modalRoot);
    return;
  }

  const needsInput = typeof state.modal.inputValue === "string";
  els.modalRoot.classList.remove("hidden");
  els.modalRoot.innerHTML = `
    <div class="screen-vision-modal-card" role="dialog" aria-modal="true">
      <h2 class="screen-vision-modal-title">${escapeHtml(state.modal.title)}</h2>
      <p class="screen-vision-modal-copy">${escapeHtml(state.modal.message)}</p>
      ${needsInput ? `
        <input
          class="screen-vision-modal-input"
          data-modal-input
          type="text"
          value="${escapeHtml(state.modal.inputValue)}"
          maxlength="80"
        >
      ` : ""}
      <div class="screen-vision-modal-actions">
        <button type="button" class="screen-vision-modal-button" data-modal-action="cancel" data-tooltip="${escapeHtml(t("screenVision.modal.closeNotice"))}">${escapeHtml(state.modal.cancelLabel || t("common.cancel"))}</button>
        <button type="button" class="screen-vision-modal-button primary" data-modal-action="confirm" data-tooltip="${escapeHtml(t("screenVision.modal.confirmAction"))}">${escapeHtml(state.modal.confirmLabel || "OK")}</button>
      </div>
    </div>
  `;

  const modalInput = els.modalRoot.querySelector("[data-modal-input]");
  modalInput?.focus();
  modalInput?.select();
  bindDynamicTooltips(els.modalRoot);
}

function bindDynamicTooltips(root = document) {
  root.querySelectorAll("[data-tooltip], [title], [aria-label]").forEach((trigger) => {
    if (trigger.dataset.screenVisionTooltipBound === "true") {
      return;
    }

    if (!trigger.dataset.tooltip) {
      const fallbackText = trigger.getAttribute("title") || trigger.getAttribute("aria-label") || "";

      if (fallbackText) {
        trigger.dataset.tooltip = fallbackText;
      }
    }

    if (trigger.hasAttribute("title")) {
      trigger.removeAttribute("title");
    }

    if (!trigger.dataset.tooltip) {
      return;
    }

    trigger.dataset.screenVisionTooltipBound = "true";
    trigger.addEventListener("mouseenter", () => showFloatingTooltip(trigger));
    trigger.addEventListener("focus", () => showFloatingTooltip(trigger));
    trigger.addEventListener("mouseleave", hideFloatingTooltip);
    trigger.addEventListener("blur", hideFloatingTooltip);
  });
}

function showFloatingTooltip(trigger) {
  if (state.tutorialTooltipSuppressed) {
    return;
  }

  const tooltip = els.floatingTooltip;
  const tooltipState = resolveTooltipState(trigger, trigger?.dataset?.tooltip || "", trigger?.dataset?.tooltipTone || "");
  const text = tooltipState.message || "";

  if (!tooltip || !text) {
    return;
  }

  state.activeTooltipTrigger = trigger;
  tooltip.textContent = text;
  tooltip.classList.toggle("danger", tooltipState.tone === "danger");
  tooltip.classList.add("visible");
  tooltip.setAttribute("aria-hidden", "false");
  positionFloatingTooltip(trigger);
}

function hideFloatingTooltip(force = false) {
  const tooltip = els.floatingTooltip;

  if (!tooltip) {
    return;
  }

  if (!force && state.activeTooltipTrigger) {
    const blockedUntil = Number(state.activeTooltipTrigger.dataset.blockedTooltipUntil || 0);
    if (blockedUntil > Date.now()) {
      return;
    }
  }

  state.activeTooltipTrigger = null;
  tooltip.classList.remove("danger");
  tooltip.classList.remove("visible");
  tooltip.setAttribute("aria-hidden", "true");
}

function setTutorialTooltipSuppressed(suppressed) {
  state.tutorialTooltipSuppressed = Boolean(suppressed);
  if (state.tutorialTooltipSuppressed) {
    hideFloatingTooltip(true);
  }
}

function positionFloatingTooltip(trigger) {
  const tooltip = els.floatingTooltip;

  if (!tooltip || !trigger) {
    return;
  }

  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const top = Math.max(8, triggerRect.top - tooltipRect.height - 8);
  const centeredLeft = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
  const left = Math.min(
    window.innerWidth - tooltipRect.width - 8,
    Math.max(8, centeredLeft)
  );

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function findRegion(regionId) {
  return state.regions.find((entry) => entry?.id === regionId) || null;
}

function flashBlockedActionTooltip(trigger, message) {
  if (!trigger || !message) {
    return;
  }

  const originalTooltip = trigger.dataset.tooltip || "";
  const wasActive = state.activeTooltipTrigger === trigger;
  const durationMs = 2800;

  trigger.dataset.blockedTooltipMessage = message;
  trigger.dataset.blockedTooltipTone = "danger";
  trigger.dataset.blockedTooltipUntil = String(Date.now() + durationMs);

  showFloatingTooltip(trigger);

  window.clearTimeout(Number(trigger.dataset.tooltipRestoreTimer || 0));
  const restoreTimer = window.setTimeout(() => {
    delete trigger.dataset.blockedTooltipUntil;
    delete trigger.dataset.blockedTooltipMessage;
    delete trigger.dataset.blockedTooltipTone;

    if (state.activeTooltipTrigger !== trigger) {
      return;
    }

    if (wasActive && originalTooltip) {
      showFloatingTooltip(trigger);
      return;
    }

    hideFloatingTooltip();
  }, durationMs);

  trigger.dataset.tooltipRestoreTimer = String(restoreTimer);
}

function flashAttention(trigger, options = {}) {
  if (!trigger) {
    return;
  }

  trigger.classList.remove("attention-shake", "attention-white");
  void trigger.offsetWidth;
  trigger.classList.add("attention-shake");

  if (options.whiteWhileShaking) {
    trigger.classList.add("attention-white");
  }

  window.clearTimeout(Number(trigger.dataset.attentionTimer || 0));
  const timer = window.setTimeout(() => {
    trigger.classList.remove("attention-shake", "attention-white");
  }, 700);
  trigger.dataset.attentionTimer = String(timer);
}

function toHotkeyBinding(event) {
  const key = String(event.key || "");
  const code = String(event.code || "");

  if (
    key === "Escape"
    || key === "Tab"
    || code === "Tab"
    || code === "ShiftLeft"
    || code === "ShiftRight"
    || code === "ControlLeft"
    || code === "ControlRight"
    || code === "AltLeft"
    || code === "AltRight"
    || code === "MetaLeft"
    || code === "MetaRight"
  ) {
    return null;
  }

  const keyCode = toWindowsVirtualKeyCode(event);
  const baseKey = normalizeHotkeyDisplayKey(event);

  if (!keyCode || !baseKey) {
    return null;
  }

  const modifiers = (
    (event.ctrlKey ? 2 : 0)
    | (event.altKey ? 1 : 0)
    | (event.shiftKey ? 4 : 0)
    | (event.metaKey ? 8 : 0)
  );
  const parts = [];

  if (event.ctrlKey) {
    parts.push("Ctrl");
  }

  if (event.altKey) {
    parts.push("Alt");
  }

  if (event.shiftKey) {
    parts.push("Shift");
  }

  if (event.metaKey) {
    parts.push("Win");
  }

  parts.push(baseKey);

  return {
    label: parts.join("+"),
    keyCode,
    modifiers
  };
}

function normalizeHotkeyDisplayKey(event) {
  const code = String(event.code || "");
  const key = String(event.key || "");

  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }

  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }

  if (/^Numpad[0-9]$/.test(code)) {
    return code.slice(6);
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return code.toUpperCase();
  }

  if (code === "Backquote" || key === "`") {
    return "`";
  }

  if (code === "NumpadAdd" || key === "+") {
    return "+";
  }

  const aliases = {
    Backspace: "Backspace",
    Delete: "Delete",
    Enter: "Enter",
    Space: "Space",
    Insert: "Insert",
    Home: "Home",
    End: "End",
    PageUp: "PgUp",
    PageDown: "PgDn",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\"
  };

  if (aliases[code]) {
    return aliases[code];
  }

  if (/^[a-z0-9]$/i.test(key)) {
    return key.toUpperCase();
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(key)) {
    return key.toUpperCase();
  }

  return "";
}

function toWindowsVirtualKeyCode(event) {
  const code = String(event.code || "");
  const key = String(event.key || "");

  if (/^Key[A-Z]$/.test(code)) {
    return code.charCodeAt(3);
  }

  if (/^Digit[0-9]$/.test(code)) {
    return 48 + Number.parseInt(code.slice(5), 10);
  }

  if (/^Numpad[0-9]$/.test(code)) {
    return 96 + Number.parseInt(code.slice(6), 10);
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return 111 + Number.parseInt(code.slice(1), 10);
  }

  if (code === "Backquote" || key === "`") {
    return 192;
  }

  if (code === "NumpadAdd" || key === "+") {
    return 107;
  }

  const virtualKeys = {
    Enter: 13,
    Backspace: 8,
    Delete: 46,
    Space: 32,
    Insert: 45,
    Home: 36,
    End: 35,
    PageUp: 33,
    PageDown: 34,
    ArrowUp: 38,
    ArrowDown: 40,
    ArrowLeft: 37,
    ArrowRight: 39,
    Minus: 189,
    Equal: 187,
    BracketLeft: 219,
    BracketRight: 221,
    Semicolon: 186,
    Quote: 222,
    Comma: 188,
    Period: 190,
    Slash: 191,
    Backslash: 220
  };

  if (virtualKeys[code]) {
    return virtualKeys[code];
  }

  if (/^[a-z]$/i.test(key)) {
    return key.toUpperCase().charCodeAt(0);
  }

  if (/^[0-9]$/.test(key)) {
    return 48 + Number.parseInt(key, 10);
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(key)) {
    return 111 + Number.parseInt(key.slice(1), 10);
  }

  return 0;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cssEscape(value) {
  return String(value ?? "").replace(/["\\]/g, "\\$&");
}
