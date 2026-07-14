import { getAppLocale } from "./app-i18n.js";
import { loadPhraseTranslationMap, translatePhraseSync } from "./phrase-translations.js";

const STRUCTURED_TRANSLATION_SKIP_KEYS = new Set([
  "name",
  "wiki_name",
  "slug",
  "pageTitle",
  "rarity",
  "imageSrc",
  "image_src",
  "icon",
  "id",
  "url",
  "wikiUrl",
  "city",
  "location",
  "worldName",
  "worldSlug",
  "assetPath",
  "assetId",
  "createdAt",
  "updatedAt"
]);

const STRUCTURED_TRANSLATION_SKIP_ARRAY_PARENTS = new Set([
  "droppedBy",
  "cities",
  "itemSlugs",
  "categorySlugs",
  "availableWorlds"
]);

export async function fetchBootstrap() {
  return sendMessage({ type: "bootstrap" });
}

export async function fetchItem(payload) {
  return localizeRuntimePayload("fetch-item", sendMessage({ type: "fetch-item", payload }));
}

export async function fetchItemStatic(payload) {
  return localizeRuntimePayload("fetch-item-static", sendMessage({ type: "fetch-item-static", payload }));
}

export async function fetchItemSuggestions(payload) {
  return sendMessage({ type: "fetch-item-suggestions", payload });
}

export async function fetchStashItems() {
  return sendMessage({ type: "fetch-stash-items" });
}

export async function fetchStashMarketValues(payload) {
  return sendMessage({ type: "fetch-stash-market-values", payload });
}

export async function fetchNpcIndex() {
  return localizeRuntimePayload("fetch-npc-index", sendMessage({ type: "fetch-npc-index" }));
}

export async function fetchNpcDetail(payload) {
  return localizeRuntimePayload("fetch-npc-detail", sendMessage({ type: "fetch-npc-detail", payload }));
}

export async function fetchCreatureIndex() {
  return localizeRuntimePayload("fetch-creature-index", sendMessage({ type: "fetch-creature-index" }));
}

export async function fetchCreatureDetail(payload) {
  return localizeRuntimePayload("fetch-creature-detail", sendMessage({ type: "fetch-creature-detail", payload }));
}

export async function fetchBossTracker(payload) {
  return localizeRuntimePayload("fetch-boss-tracker", sendMessage({ type: "fetch-boss-tracker", payload }));
}

export async function fetchCharacterProfiles(payload) {
  return sendMessage({ type: "fetch-character-profiles", payload });
}

export async function fetchFindPartySnapshot(payload) {
  return sendMessage({ type: "fetch-find-party-snapshot", payload });
}

export async function fetchFindPartyGuildMembers(payload) {
  return sendMessage({ type: "fetch-find-party-guild-members", payload });
}

export async function fetchCurrencyRates(payload) {
  return sendMessage({ type: "fetch-currency-rates", payload });
}

export async function fetchImbuementMarket(payload) {
  return sendMessage({ type: "fetch-imbuement-market", payload });
}

export async function fetchIngredientMetadata(payload) {
  return sendMessage({ type: "fetch-ingredient-metadata", payload });
}

export async function setDataLocale(locale) {
  return sendMessage({ type: "set-locale", payload: { locale } });
}

export async function localStorageGet(key) {
  if (hasDesktopApi()) {
    return window.desktopApi.storage.get(key);
  }

  throw new Error("App desktop nao inicializado.");
}

export async function localStorageSet(value) {
  if (hasDesktopApi()) {
    return window.desktopApi.storage.set(value);
  }

  throw new Error("App desktop nao inicializado.");
}

export function isDesktopOverlayApp() {
  return hasDesktopApi() || isDesktopModeQueryEnabled();
}

export async function getDesktopOverlayState() {
  if (!hasDesktopApi()) {
    return null;
  }

  return window.desktopApi.overlay.getState();
}

export async function setDesktopOverlayOpacity(opacity) {
  if (!hasDesktopApi()) {
    return null;
  }

  return window.desktopApi.overlay.setOpacity(opacity);
}

export async function setDesktopSplashProgress(progress) {
  if (!hasDesktopApi() || !window.desktopApi.app?.splashProgress) {
    return null;
  }

  return window.desktopApi.app.splashProgress(progress);
}

export async function setDesktopSplashStatus(status) {
  if (!hasDesktopApi() || !window.desktopApi.app?.splashStatus) {
    return null;
  }

  return window.desktopApi.app.splashStatus(status);
}

export async function notifyDesktopReadyToShow() {
  if (!hasDesktopApi() || !window.desktopApi.app?.readyToShow) {
    return null;
  }

  return window.desktopApi.app.readyToShow();
}

export async function minimizeDesktopOverlay() {
  if (!hasDesktopApi()) {
    return;
  }

  return window.desktopApi.overlay.minimize();
}

export async function closeDesktopOverlay() {
  if (!hasDesktopApi()) {
    return;
  }

  return window.desktopApi.overlay.close();
}

export async function openDesktopExternalLink(url) {
  if (hasDesktopApi()) {
    return window.desktopApi.links.openExternal(url);
  }

  if (typeof window !== "undefined" && url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export async function openDesktopMapWindow(url, title) {
  if (hasDesktopApi() && window.desktopApi.maps?.open) {
    return window.desktopApi.maps.open(url, title);
  }

  return false;
}

export async function openDesktopScreenVisionWindow(tool = "screen-vision") {
  if (hasDesktopApi() && window.desktopApi.screenVision?.open) {
    return window.desktopApi.screenVision.open(tool);
  }

  return false;
}

async function sendMessage(message) {
  if (hasDesktopApi()) {
    return window.desktopApi.data.sendMessage(message);
  }

  throw new Error("App desktop nao inicializado.");
}

function hasDesktopApi() {
  return typeof window !== "undefined" && Boolean(window.desktopApi);
}

function isDesktopModeQueryEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return new URLSearchParams(window.location.search).get("mode") === "desktop";
  } catch (_error) {
    return false;
  }
}

async function localizeRuntimePayload(type, payloadPromise) {
  const payload = await payloadPromise;

  if (!shouldLocalizeRuntimePayload(type)) {
    return payload;
  }

  const locale = getAppLocale();
  const phraseMap = await loadPhraseTranslationMap(locale).catch(() => ({}));
  return translateStructuredRuntimeValue(payload, locale, phraseMap);
}

function shouldLocalizeRuntimePayload(type) {
  return [
    "fetch-item",
    "fetch-item-static",
    "fetch-npc-index",
    "fetch-npc-detail",
    "fetch-creature-index",
    "fetch-creature-detail",
    "fetch-boss-tracker"
  ].includes(type);
}

function translateStructuredRuntimeValue(value, locale, phraseMap, path = []) {
  if (typeof value === "string") {
    if (shouldSkipStructuredString(path, value)) {
      return value;
    }

    return translatePhraseSync(locale, value, phraseMap);
  }

  if (Array.isArray(value)) {
    const parentKey = path[path.length - 1] || "";
    if (STRUCTURED_TRANSLATION_SKIP_ARRAY_PARENTS.has(parentKey)) {
      return value;
    }

    return value.map((entry) => translateStructuredRuntimeValue(entry, locale, phraseMap, path));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const next = Array.isArray(value) ? [] : {};

  for (const [key, entry] of Object.entries(value)) {
    next[key] = translateStructuredRuntimeValue(entry, locale, phraseMap, [...path, key]);
  }

  return next;
}

function shouldSkipStructuredString(path, value) {
  const key = path[path.length - 1] || "";
  const text = String(value || "");

  if (STRUCTURED_TRANSLATION_SKIP_KEYS.has(key)) {
    return true;
  }

  if (/^(?:https?:|file:|data:|assets\/)/i.test(text)) {
    return true;
  }

  if (/^[A-Za-z]:\\/.test(text)) {
    return true;
  }

  return false;
}
