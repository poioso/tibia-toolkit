import { fetchBazaarOverview as fetchLegacyBazaarOverview } from "./bazaar-scraper.mjs";

const DEFAULT_TIMEOUT_MS = 120_000;
const EXEVOPAN_AUCTIONS_API_URL = "https://www.exevopan.com/api/auctions";
const EXEVOPAN_PAGE_URL = "https://www.exevopan.com/pt";
const TIBIA_COM_CHARACTER_TRADE_URL = "https://www.tibia.com/charactertrade/";
const TDZ_CURRENT_URL = "https://www.tibiadozero.com.br/ferramentas/bazaar";
const TDZ_HISTORY_URL = "https://www.tibiadozero.com.br/ferramentas/bazaar/historico";
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
  Accept: "application/json,text/x-component;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};
const TDZ_CURRENT_HEADERS = {
  accept: "text/x-component",
  "content-type": "text/plain;charset=UTF-8",
  origin: "https://www.tibiadozero.com.br",
  referer: TDZ_CURRENT_URL,
  "next-action": "4056af54af880d7430d73a64db353dc09e20fd099d",
  "next-router-state-tree":
    "%5B%22%22%2C%7B%22children%22%3A%5B%22ferramentas%22%2C%7B%22children%22%3A%5B%22bazaar%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D",
  "x-deployment-id": "dpl_5njDEkv5k51jjvDkWEuvq82tNqMp"
};
const TDZ_HISTORY_HEADERS = {
  accept: "text/x-component",
  "content-type": "text/plain;charset=UTF-8",
  origin: "https://www.tibiadozero.com.br",
  referer: TDZ_HISTORY_URL,
  "next-action": "4095e0651153c83ffc7f5899a377b21e16f68f57b8",
  "next-router-state-tree":
    "%5B%22%22%2C%7B%22children%22%3A%5B%22ferramentas%22%2C%7B%22children%22%3A%5B%22bazaar%22%2C%7B%22children%22%3A%5B%22historico%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D",
  "x-deployment-id": "dpl_5njDEkv5k51jjvDkWEuvq82tNqMp"
};
const VOCATION_BY_ID = {
  1: "Knight",
  2: "Paladin",
  3: "Sorcerer",
  4: "Druid",
  5: "Monk"
};

export async function fetchBazaarOverview({
  subtopic = "currentcharactertrades",
  filters = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const normalizedSubtopic = normalizeBazaarSubtopic(subtopic);
  const normalizedFilters = normalizeBazaarFilters(filters, normalizedSubtopic);

  if (shouldUseLegacyOverview(normalizedSubtopic, normalizedFilters)) {
    return fetchLegacyBazaarOverview({
      subtopic: normalizedSubtopic,
      filters: normalizedFilters,
      timeoutMs
    });
  }

  try {
    return normalizedSubtopic === "pastcharactertrades"
      ? await fetchTdzOverview({
          subtopic: normalizedSubtopic,
          filters: normalizedFilters,
          timeoutMs
        })
      : await fetchExevopanOverview({
          subtopic: normalizedSubtopic,
          filters: normalizedFilters,
          timeoutMs
        });
  } catch (_error) {
    return fetchLegacyBazaarOverview({
      subtopic: normalizedSubtopic,
      filters: normalizedFilters,
      timeoutMs
    });
  }
}

export function buildBazaarOverviewSourceUrl(subtopic = "currentcharactertrades", filters = {}) {
  const normalizedSubtopic = normalizeBazaarSubtopic(subtopic);
  const normalizedFilters = normalizeBazaarFilters(filters, normalizedSubtopic);
  const currentPage = parsePositiveInteger(normalizedFilters.currentpage, 1);

  if (shouldUseLegacyOverview(normalizedSubtopic, normalizedFilters)) {
    return buildLegacyBazaarUrl(normalizedSubtopic, normalizedFilters);
  }

  if (normalizedSubtopic === "pastcharactertrades") {
    return `${TDZ_HISTORY_URL}?page=${currentPage}`;
  }

  return `${EXEVOPAN_AUCTIONS_API_URL}?currentPage=${currentPage}`;
}

async function fetchExevopanOverview({ subtopic, filters, timeoutMs }) {
  const currentPage = parsePositiveInteger(filters.currentpage, 1);
  const response = await fetchWithTimeout(
    `${EXEVOPAN_AUCTIONS_API_URL}?currentPage=${currentPage}`,
    {
      headers: DEFAULT_HEADERS,
      timeoutMs
    }
  );
  const payload = await response.json();
  const auctions = Array.isArray(payload?.page) ? payload.page : [];
  const pageSize = Math.max(inferRangeSize(payload?.startOffset, payload?.endOffset, auctions.length), 1);
  const totalItems = Math.max(parsePositiveInteger(payload?.totalItems, auctions.length), auctions.length);
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), currentPage, 1);
  const sourceUrl = new URL(EXEVOPAN_PAGE_URL);
  sourceUrl.searchParams.set("currentPage", String(currentPage));

  return {
    title: "Leiloes - Exevo Pan",
    requestUrl: sourceUrl.toString(),
    subtopic,
    pageTitle: "Leiloes Ativos",
    totalResults: totalItems,
    currentPage,
    totalPages,
    filters,
    auctions: auctions.map((entry) => mapExevopanAuction(entry, subtopic)),
    paginationLinks: buildPaginationLinks({
      baseUrl: EXEVOPAN_PAGE_URL,
      pageParam: "currentPage",
      currentPage,
      totalPages
    }),
    bodyPreview: [
      `${formatCompactNumber((payload?.startOffset || 0) + 1)} - ${formatCompactNumber(
        payload?.endOffset || auctions.length
      )} de ${formatCompactNumber(totalItems)}`,
      payload?.hasNext ? "Ha mais paginas disponiveis." : "Ultima pagina carregada."
    ],
    source: "exevopan",
    sourcePayload: {
      pageIndex: payload?.pageIndex ?? currentPage,
      totalItems,
      startOffset: payload?.startOffset ?? 0,
      endOffset: payload?.endOffset ?? auctions.length,
      hasPrev: Boolean(payload?.hasPrev),
      hasNext: Boolean(payload?.hasNext),
      sortingMode: payload?.sortingMode ?? null,
      descendingOrder: payload?.descendingOrder ?? null
    },
    fetchedAt: new Date().toISOString()
  };
}

async function fetchTdzOverview({ subtopic, filters, timeoutMs }) {
  const currentPage = parsePositiveInteger(filters.currentpage, 1);
  const isHistory = subtopic === "pastcharactertrades";
  const url = new URL(isHistory ? TDZ_HISTORY_URL : TDZ_CURRENT_URL);
  const requestBody = currentPage > 1 ? JSON.stringify([{ page: String(currentPage) }]) : "[{}]";
  const headers = {
    ...DEFAULT_HEADERS,
    ...(isHistory ? TDZ_HISTORY_HEADERS : TDZ_CURRENT_HEADERS),
    referer: `${url.toString()}${currentPage > 1 ? `?page=${currentPage}` : ""}`
  };

  if (currentPage > 1) {
    url.searchParams.set("page", String(currentPage));
  }

  const response = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers,
    body: requestBody,
    timeoutMs
  });
  const text = await response.text();
  const payload = parseTdzActionResponse(text);
  const auctions = Array.isArray(payload?.auctions) ? payload.auctions : [];
  const pageSize = Math.max(parsePositiveInteger(payload?.pageSize, auctions.length), 1);
  const totalItems = Math.max(parsePositiveInteger(payload?.totalCount, auctions.length), auctions.length);
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), currentPage, 1);

  return {
    title: isHistory ? "Historico do Bazaar - Tibia do Zero" : "Bazaar - Tibia do Zero",
    requestUrl: url.toString(),
    subtopic,
    pageTitle: isHistory ? "Historico do Bazaar" : "Leiloes Ativos",
    totalResults: totalItems,
    currentPage,
    totalPages,
    filters,
    auctions: auctions.map((entry) => mapTdzAuction(entry, subtopic)),
    paginationLinks: buildPaginationLinks({
      baseUrl: isHistory ? TDZ_HISTORY_URL : TDZ_CURRENT_URL,
      pageParam: "page",
      currentPage,
      totalPages
    }),
    bodyPreview: [
      `${formatCompactNumber((currentPage - 1) * pageSize + 1)} - ${formatCompactNumber(
        Math.min(currentPage * pageSize, totalItems)
      )} de ${formatCompactNumber(totalItems)}`,
      isHistory ? "Fonte: Tibia do Zero (historico)." : "Fonte: Tibia do Zero (pagina enriquecida)."
    ],
    source: isHistory ? "tibiadozero-history" : "tibiadozero-current",
    sourcePayload: {
      totalCount: totalItems,
      page: payload?.page ?? currentPage,
      pageSize
    },
    fetchedAt: new Date().toISOString()
  };
}

async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = {}) {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(new Error(`Timeout after ${timeoutMs}ms.`)), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: abortController.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Bazaar source request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    return response;
  } finally {
    clearTimeout(timer);
  }
}

function parseTdzActionResponse(text) {
  const normalized = String(text || "").trim();
  const match = normalized.match(/(?:^|\n)1:(\{.*\})\s*$/s);

  if (!match) {
    throw new Error("Nao foi possivel interpretar a resposta do Tibia do Zero.");
  }

  return JSON.parse(match[1]);
}

function mapExevopanAuction(entry, subtopic) {
  const auctionId = parsePositiveInteger(entry?.id, 0);
  const vocation = getVocationLabel(entry?.vocationId);
  const worldName = normalizeText(entry?.serverData?.serverName);
  const charmPoints = parsePositiveInteger(entry?.charmInfo?.total, 0);
  const highlights = [];

  if (charmPoints > 0) {
    highlights.push(`Charm Points: ${formatCompactNumber(charmPoints)}`);
  }
  if (parsePositiveInteger(entry?.bossPoints, 0) > 0) {
    highlights.push(`Total Boss Points: ${formatCompactNumber(entry.bossPoints)}`);
  }
  const slots = [];
  if (entry?.preySlot) {
    slots.push("Prey");
  }
  if (entry?.huntingSlot) {
    slots.push("Weekly Tasks");
  }
  if (entry?.transfer) {
    slots.push("World Transfer");
  }
  if (slots.length > 0) {
    highlights.push(`Additional Slots: ${slots.join(", ")}`);
  }

  return {
    auctionId,
    subtopic,
    detailUrl: buildTibiaAuctionDetailUrl(subtopic, auctionId),
    characterName: normalizeText(entry?.nickname),
    level: parsePositiveInteger(entry?.level, 0),
    vocation,
    sex: entry?.sex ? "Female" : "Male",
    world: worldName,
    worldUrl: buildWorldUrl(worldName),
    outfitImage: buildOutfitImageUrl(entry?.outfitId),
    isNew: false,
    displayItems: [],
    countdownText: formatCountdownOrDate(entry?.auctionEnd),
    auctionStart: null,
    auctionEnd: formatAuctionDate(entry?.auctionEnd),
    bidType: "Current Bid",
    bidAmount: parsePositiveInteger(entry?.currentBid, 0),
    status: entry?.hasBeenBidded ? "has bids" : "no bids",
    highlights,
    rawLines: [],
    sourceData: entry || null
  };
}

function mapTdzAuction(entry, subtopic) {
  const auctionId = parsePositiveInteger(entry?.id, 0);
  const isHistory = subtopic === "pastcharactertrades";
  const skillHighlights = buildTdzSkillHighlights(entry);
  const charmPoints = parsePositiveInteger(entry?.charmPoints, 0);
  const bossPoints = parsePositiveInteger(entry?.bossPoints, 0);

  if (charmPoints > 0) {
    skillHighlights.push(`Charm Points: ${formatCompactNumber(charmPoints)}`);
  }
  if (bossPoints > 0) {
    skillHighlights.push(`Total Boss Points: ${formatCompactNumber(bossPoints)}`);
  }

  return {
    auctionId,
    subtopic,
    detailUrl: buildTibiaAuctionDetailUrl(subtopic, auctionId),
    characterName: normalizeText(entry?.characterName),
    level: parsePositiveInteger(entry?.level, 0),
    vocation: getVocationLabel(entry?.vocationId),
    sex: "",
    world: normalizeText(entry?.serverName),
    worldUrl: buildWorldUrl(entry?.serverName),
    outfitImage: buildOutfitImageUrl(entry?.outfitId),
    isNew: false,
    displayItems: [],
    countdownText: isHistory ? null : formatCountdownOrDate(entry?.auctionEnd),
    auctionStart: null,
    auctionEnd: formatAuctionDate(entry?.auctionEnd),
    bidType: isHistory ? "Winning Bid" : "Current Bid",
    bidAmount: parsePositiveInteger(entry?.currentBid, 0),
    status: normalizeText(entry?.status) || null,
    highlights: skillHighlights,
    rawLines: [],
    sourceData: entry || null
  };
}

function buildTdzSkillHighlights(entry) {
  const candidates = [
    ["Magic", entry?.magicLevel],
    ["Distance", entry?.distance],
    ["Sword", entry?.sword],
    ["Axe", entry?.axe],
    ["Club", entry?.club],
    ["Fist", entry?.fist],
    ["Shielding", entry?.shielding]
  ];
  const highlights = [];

  for (const [label, value] of candidates) {
    const numeric = toFiniteNumber(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      continue;
    }

    highlights.push(`${label}: ${formatDecimal(numeric)}`);
    if (highlights.length >= 3) {
      break;
    }
  }

  return highlights;
}

function buildPaginationLinks({ baseUrl, pageParam, currentPage, totalPages }) {
  const pages = new Set([1, currentPage, Math.max(currentPage - 1, 1), Math.min(currentPage + 1, totalPages), totalPages]);

  return [...pages]
    .sort((left, right) => left - right)
    .map((page) => {
      const url = new URL(baseUrl);
      if (page > 1) {
        url.searchParams.set(pageParam, String(page));
      }
      return {
        label: String(page),
        href: url.toString(),
        currentPage: page
      };
    });
}

function shouldUseLegacyOverview(subtopic, filters) {
  const defaults = getDefaultFilters(subtopic);

  for (const [key, value] of Object.entries(filters || {})) {
    if (key === "currentpage") {
      continue;
    }

    if (String(value ?? "") !== String(defaults[key] ?? "")) {
      return true;
    }
  }

  return false;
}

function normalizeBazaarFilters(filters, subtopic) {
  const defaults = getDefaultFilters(subtopic);
  const normalized = { ...defaults };

  for (const [key, value] of Object.entries(filters || {})) {
    normalized[key] = String(value ?? "").trim();
  }

  normalized.currentpage = String(parsePositiveInteger(normalized.currentpage, 1));
  return normalized;
}

function getDefaultFilters(subtopic) {
  return {
    currentpage: "1",
    filter_levelrangefrom: "0",
    filter_levelrangeto: "0",
    filter_profession: "0",
    filter_skillid: "",
    filter_skillrangefrom: "0",
    filter_skillrangeto: "0",
    filter_world: "",
    filter_worldbattleyestate: "0",
    filter_worldpvptype: "9",
    order_column: "101",
    order_direction: "1",
    searchstring: "",
    searchtype: subtopic === "pastcharactertrades" ? "0" : "1"
  };
}

function buildLegacyBazaarUrl(subtopic, filters) {
  const url = new URL(TIBIA_COM_CHARACTER_TRADE_URL);
  url.searchParams.set("subtopic", subtopic);

  for (const [key, value] of Object.entries(filters || {})) {
    url.searchParams.set(key, String(value ?? ""));
  }

  return url.toString();
}

function normalizeBazaarSubtopic(value) {
  return String(value || "").toLowerCase() === "pastcharactertrades"
    ? "pastcharactertrades"
    : "currentcharactertrades";
}

function buildTibiaAuctionDetailUrl(subtopic, auctionId) {
  const url = new URL(TIBIA_COM_CHARACTER_TRADE_URL);
  url.searchParams.set("subtopic", subtopic);
  url.searchParams.set("page", "details");
  url.searchParams.set("auctionid", String(auctionId));
  return url.toString();
}

function buildWorldUrl(worldName) {
  const normalized = normalizeText(worldName);
  if (!normalized) {
    return null;
  }

  const url = new URL("https://www.tibia.com/community/");
  url.searchParams.set("subtopic", "worlds");
  url.searchParams.set("world", normalized);
  return url.toString();
}

function buildOutfitImageUrl(outfitId) {
  const normalized = normalizeText(outfitId);
  return normalized ? `https://static.tibia.com/images/charactertrade/outfits/${normalized}.gif` : null;
}

function getVocationLabel(vocationId) {
  return VOCATION_BY_ID[parsePositiveInteger(vocationId, 0)] || "";
}

function formatCountdownOrDate(value) {
  const date = parseAuctionDate(value);
  if (!date) {
    return null;
  }

  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) {
    return formatAuctionDate(value);
  }

  const totalMinutes = Math.max(Math.round(diffMs / 60_000), 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatAuctionDate(value) {
  const date = parseAuctionDate(value);
  return date ? date.toISOString() : null;
}

function parseAuctionDate(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function inferRangeSize(startOffset, endOffset, fallback) {
  const start = toFiniteNumber(startOffset);
  const end = toFiniteNumber(endOffset);

  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return end - start + 1;
  }

  return parsePositiveInteger(fallback, 10);
}

function formatCompactNumber(value) {
  const numeric = parsePositiveInteger(value, 0);
  return numeric.toLocaleString("en-US");
}

function formatDecimal(value) {
  const numeric = toFiniteNumber(value);
  if (!Number.isFinite(numeric)) {
    return "0";
  }

  return numeric % 1 === 0 ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
}

function parsePositiveInteger(value, fallback) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
