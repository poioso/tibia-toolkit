import {
  APP_LOCALE_STORAGE_KEY,
  DEFAULT_LOCALE,
  INITIAL_APP_LOCALE,
  getActiveLocale,
  getIntlLocale,
  normalizeLocale,
  setActiveLocale
} from "./locale-state.js";
import { translateUiString } from "./ui-translations.js";

const listeners = new Set();

export function getAppLocale() {
  return getActiveLocale();
}

export function setAppLocale(locale) {
  const nextLocale = setActiveLocale(locale);
  for (const listener of listeners) {
    try {
      listener(nextLocale);
    } catch (_error) {
      // Ignore listener failures to keep locale changes resilient.
    }
  }
  return nextLocale;
}

export function t(key, variables = {}, locale = getActiveLocale()) {
  return translateUiString(locale, key, variables);
}

export function formatLocaleNumber(value, options = {}, locale = getActiveLocale()) {
  return new Intl.NumberFormat(getIntlLocale(locale), options).format(value);
}

export function formatLocaleDate(value, options = {}, locale = getActiveLocale()) {
  return new Intl.DateTimeFormat(getIntlLocale(locale), options).format(value);
}

export function formatLocaleRelativeTime(value, unit, options = {}, locale = getActiveLocale()) {
  return new Intl.RelativeTimeFormat(getIntlLocale(locale), options).format(value, unit);
}

export function translateStaticNode(node, key, variables = {}) {
  if (!node) {
    return;
  }

  node.textContent = t(key, variables);
}

export function syncDocumentLocale(documentRef = typeof document !== "undefined" ? document : null) {
  if (!documentRef?.documentElement) {
    return;
  }

  documentRef.documentElement.lang = normalizeLocale(getActiveLocale());
  documentRef.documentElement.dataset.appLocale = getActiveLocale();
}

export function onLocaleChange(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadStoredAppLocale(storageGet) {
  if (typeof storageGet !== "function") {
    return INITIAL_APP_LOCALE;
  }

  const stored = await storageGet(APP_LOCALE_STORAGE_KEY).catch(() => ({}));
  return setAppLocale(stored?.[APP_LOCALE_STORAGE_KEY] || INITIAL_APP_LOCALE);
}

export async function persistAppLocale(storageSet, locale = getActiveLocale()) {
  if (typeof storageSet !== "function") {
    return;
  }

  await storageSet({
    [APP_LOCALE_STORAGE_KEY]: normalizeLocale(locale)
  });
}
