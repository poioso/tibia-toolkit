export const DEFAULT_LOCALE = "pt-BR";
export const INITIAL_APP_LOCALE = "en";
export const SUPPORTED_LOCALES = ["pt-BR", "en", "de"];
export const APP_LOCALE_STORAGE_KEY = "appLocale";

const LOCALE_ALIASES = new Map([
  ["pt", "pt-BR"],
  ["pt-br", "pt-BR"],
  ["en", "en"],
  ["en-us", "en"],
  ["en-gb", "en"],
  ["de", "de"],
  ["de-de", "de"]
]);

const INTL_LOCALE_MAP = {
  "pt-BR": "pt-BR",
  en: "en-US",
  de: "de-DE"
};

let activeLocale = INITIAL_APP_LOCALE;

export function normalizeLocale(locale) {
  const normalized = String(locale || "").trim().toLowerCase();
  return LOCALE_ALIASES.get(normalized) || INITIAL_APP_LOCALE;
}

export function isSupportedLocale(locale) {
  return SUPPORTED_LOCALES.includes(normalizeLocale(locale));
}

export function getActiveLocale() {
  return activeLocale;
}

export function setActiveLocale(locale) {
  activeLocale = normalizeLocale(locale);
  return activeLocale;
}

export function getIntlLocale(locale = activeLocale) {
  return INTL_LOCALE_MAP[normalizeLocale(locale)] || INTL_LOCALE_MAP[DEFAULT_LOCALE];
}

export function createLocaleCollator(locale = activeLocale, options = {}) {
  return new Intl.Collator(getIntlLocale(locale), options);
}

export function interpolateTemplate(template, variables = {}) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, token) => {
    const value = variables[token];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function getLocaleMeta(locale = activeLocale) {
  const normalized = normalizeLocale(locale);
  return {
    code: normalized,
    intlCode: getIntlLocale(normalized)
  };
}
