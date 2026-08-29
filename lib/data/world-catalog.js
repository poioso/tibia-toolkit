function worldKey(value) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
}

export function normalizeRegularWorldCatalog(entries, slugifyWorldName) {
  const bySlug = new Map();

  for (const entry of Array.isArray(entries) ? entries : []) {
    const name = String(entry?.name || "").trim();
    const slug = slugifyWorldName(name);
    if (!name || !slug || bySlug.has(slug)) continue;
    bySlug.set(slug, { ...entry, name, slug });
  }

  return [...bySlug.values()].sort((left, right) => left.name.localeCompare(right.name, "en"));
}

export function mergeAuthoritativeWorldCatalog(regularWorlds, marketWorlds, slugifyWorldName) {
  const marketBySlug = new Map(
    (Array.isArray(marketWorlds) ? marketWorlds : [])
      .map((entry) => [slugifyWorldName(entry?.name || ""), entry])
      .filter(([slug]) => Boolean(slug)),
  );

  return normalizeRegularWorldCatalog(regularWorlds, slugifyWorldName).map((world) => {
    const market = marketBySlug.get(world.slug) || null;
    return {
      ...world,
      last_update: market?.last_update || world.last_update || null,
    };
  });
}

export function resolveWorldSlug(input, worlds, preferred = "antica") {
  const requested = worldKey(input);
  const exact = (Array.isArray(worlds) ? worlds : []).find(
    (world) => worldKey(world?.slug) === requested || worldKey(world?.name) === requested,
  );
  if (exact?.slug) return exact.slug;
  const fallback = worlds.find((world) => worldKey(world?.slug) === worldKey(preferred));
  return fallback?.slug || worlds[0]?.slug || "";
}

export async function loadAuthoritativeWorldCatalog({
  fetchRegularWorlds,
  fetchMarketWorlds,
  cachedWorlds,
  slugifyWorldName,
}) {
  try {
    const regularWorlds = await fetchRegularWorlds();
    const marketWorlds = await fetchMarketWorlds().catch(() => []);
    const worlds = mergeAuthoritativeWorldCatalog(regularWorlds, marketWorlds, slugifyWorldName);
    if (worlds.length === 0) throw new Error("A API TibiaData retornou um catálogo de mundos vazio.");
    return { worlds, source: "fresh" };
  } catch (error) {
    if (Array.isArray(cachedWorlds) && cachedWorlds.length > 0) {
      return { worlds: cachedWorlds, source: "cache" };
    }
    throw error;
  }
}
