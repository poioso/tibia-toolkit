const SYNC_SCHEMA_VERSION = 1;
const KINDS = new Set(["items", "npcs", "creatures", "bosses", "books-documents"]);
const LOCALES = new Set(["pt-BR", "en", "de"]);
const PROFILE_FIELDS = new Set(["technicalDescription", "buy", "sell", "droppedBy", "loot", "abilities", "damageModifiers", "traits", "tables", "bestiaryWarning", "food", "proficiency", "damageTable", "damageModel", "noteImage", "bestSell"]);

const cleanText = (value, maximum = 500) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const recordKey = (change) => `${change.kind}:${change.slug}:${change.locale}`;

export function createEmptyLibraryCatalogOverlay() {
  return { schemaVersion: SYNC_SCHEMA_VERSION, cursor: null, records: {} };
}

export function normalizeLibraryCatalogSyncPage(raw) {
  if (!raw || Number(raw.schemaVersion) !== SYNC_SCHEMA_VERSION || !Array.isArray(raw.changes)) {
    throw new Error("invalid-library-catalog-sync-page");
  }
  const changes = raw.changes.map((entry) => {
    const kind = cleanText(entry?.kind, 30);
    const slug = cleanText(entry?.slug, 160);
    const locale = cleanText(entry?.locale, 10);
    const version = Number(entry?.version || 0);
    const publishedAt = cleanText(entry?.publishedAt, 80);
    if (!KINDS.has(kind) || !slug || !LOCALES.has(locale) || !Number.isInteger(version) || version < 1 || !publishedAt || !entry?.fields || typeof entry.fields !== "object" || Array.isArray(entry.fields)) {
      throw new Error("invalid-library-catalog-change");
    }
    return { id: cleanText(entry.id, 100), kind, slug, locale, version, publishedAt, fields: structuredClone(entry.fields) };
  });
  return { schemaVersion: SYNC_SCHEMA_VERSION, cursor: cleanText(raw.cursor, 1000) || null, hasMore: Boolean(raw.hasMore), changes };
}

export function mergeLibraryCatalogOverlay(current, page) {
  const normalizedPage = normalizeLibraryCatalogSyncPage(page);
  const next = current?.schemaVersion === SYNC_SCHEMA_VERSION
    ? { schemaVersion: SYNC_SCHEMA_VERSION, cursor: current.cursor || null, records: { ...(current.records || {}) } }
    : createEmptyLibraryCatalogOverlay();
  for (const change of normalizedPage.changes) {
    const key = recordKey(change);
    const previous = next.records[key];
    if (!previous || change.version > Number(previous.version || 0) || change.publishedAt > String(previous.publishedAt || "")) next.records[key] = change;
  }
  next.cursor = normalizedPage.cursor || next.cursor;
  return next;
}

function baseRecord(kind, slug, fields) {
  const name = cleanText(fields.title, 500) || slug;
  return {
    kind,
    slug,
    name,
    subtitle: cleanText(fields.subtitle, 500),
    image: cleanText(fields.image, 300) || null,
    description: cleanText(fields.description, 10000),
    facts: Array.isArray(fields.facts) ? structuredClone(fields.facts) : [],
    meta: {},
    profile: {},
    localizedFacts: {},
    localizedDescriptions: {},
    localizedProfiles: {},
    aliases: []
  };
}

function profilePatch(fields) {
  const patch = fields?.profile && typeof fields.profile === "object" && !Array.isArray(fields.profile)
    ? structuredClone(fields.profile)
    : {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (PROFILE_FIELDS.has(key)) patch[key] = structuredClone(value);
  }
  return patch;
}

function applyBaseFields(record, fields) {
  const next = { ...record, meta: { ...(record.meta || {}) }, profile: { ...(record.profile || {}) } };
  if (cleanText(fields.title, 500)) next.name = cleanText(fields.title, 500);
  if (Object.prototype.hasOwnProperty.call(fields, "subtitle")) next.subtitle = cleanText(fields.subtitle, 500);
  if (Object.prototype.hasOwnProperty.call(fields, "description")) next.description = cleanText(fields.description, 10000);
  if (Object.prototype.hasOwnProperty.call(fields, "image")) next.image = cleanText(fields.image, 300) || null;
  if (Array.isArray(fields.facts)) next.facts = structuredClone(fields.facts);
  const patch = profilePatch(fields);
  if (Object.keys(patch).length) next.profile = { ...next.profile, ...patch };
  return next;
}

function applyLocalizedFields(record, locale, fields) {
  const next = {
    ...record,
    localizedFacts: { ...(record.localizedFacts || {}) },
    localizedDescriptions: { ...(record.localizedDescriptions || {}) },
    localizedProfiles: { ...(record.localizedProfiles || {}) }
  };
  if (Array.isArray(fields.facts)) next.localizedFacts[locale] = structuredClone(fields.facts);
  if (Object.prototype.hasOwnProperty.call(fields, "description")) next.localizedDescriptions[locale] = cleanText(fields.description, 10000);
  const patch = profilePatch(fields);
  if (Object.keys(patch).length) next.localizedProfiles[locale] = { ...(next.localizedProfiles[locale] || {}), ...patch };
  if (cleanText(fields.title, 500)) {
    next.localizedTitles = { ...(next.localizedTitles || {}), [locale]: cleanText(fields.title, 500) };
  }
  if (Object.prototype.hasOwnProperty.call(fields, "subtitle")) {
    next.localizedSubtitles = { ...(next.localizedSubtitles || {}), [locale]: cleanText(fields.subtitle, 500) };
  }
  return next;
}

function applyBookFields(record, fields, locale) {
  const next = { ...record };
  const direct = ["author", "genre", "shortDescription", "version", "englishText", "rawText", "translatedText", "translated", "untranslated", "tibn", "notes", "relatedArticles", "source", "locations", "libraries", "appearances"];
  if (locale === "pt-BR") {
    if (cleanText(fields.title, 500)) next.name = cleanText(fields.title, 500);
    if (Object.prototype.hasOwnProperty.call(fields, "image")) next.image = cleanText(fields.image, 300) || null;
    for (const key of direct) if (Object.prototype.hasOwnProperty.call(fields, key)) next[key] = structuredClone(fields[key]);
  } else {
    next.localized = { ...(next.localized || {}), [locale]: { ...(next.localized?.[locale] || {}), ...structuredClone(fields) } };
  }
  return next;
}

export function applyLibraryCatalogOverlay(bundle, overlay) {
  if (!bundle?.records || overlay?.schemaVersion !== SYNC_SCHEMA_VERSION) return bundle;
  const records = Object.fromEntries(Object.entries(bundle.records).map(([kind, entries]) => [kind, Array.isArray(entries) ? [...entries] : entries]));
  const changes = Object.values(overlay.records || {}).sort((left, right) => String(left.publishedAt).localeCompare(String(right.publishedAt)) || String(left.id).localeCompare(String(right.id)));
  for (const change of changes) {
    const targetKind = change.kind === "books-documents" ? "books" : change.kind;
    const entries = Array.isArray(records[targetKind]) ? records[targetKind] : [];
    const index = entries.findIndex((entry) => entry?.slug === change.slug);
    let record = index >= 0 ? entries[index] : targetKind === "books"
      ? { slug: change.slug, name: cleanText(change.fields.title, 500) || change.slug, pageName: cleanText(change.fields.title, 500) || change.slug, image: null, locations: [], libraries: [], appearances: [] }
      : baseRecord(targetKind, change.slug, change.fields);
    record = targetKind === "books"
      ? applyBookFields(record, change.fields, change.locale)
      : change.locale === "pt-BR"
        ? applyBaseFields(record, change.fields)
        : applyLocalizedFields(record, change.locale, change.fields);
    if (index >= 0) entries[index] = record;
    else entries.push(record);
    records[targetKind] = entries;
  }
  return { ...bundle, records, appliedOverlay: { cursor: overlay.cursor || null, records: changes.length } };
}

export const LIBRARY_CATALOG_SYNC_SCHEMA_VERSION = SYNC_SCHEMA_VERSION;
