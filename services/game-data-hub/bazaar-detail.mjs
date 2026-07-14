import { fetchBazaarOverview } from "./bazaar-overview.mjs";
import { fetchBazaarAuctionDetail as fetchLegacyBazaarAuctionDetail } from "./bazaar-scraper.mjs";

const DEFAULT_FILTERS_BY_SUBTOPIC = {
  currentcharactertrades: {
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
    searchtype: "1"
  },
  pastcharactertrades: {
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
    searchtype: "0"
  }
};

export async function fetchBazaarAuctionDetail({
  auctionId,
  subtopic = "currentcharactertrades",
  timeoutMs = 120_000
} = {}) {
  const normalizedSubtopic = normalizeBazaarSubtopic(subtopic);
  const legacyTimeoutMs = Math.min(timeoutMs, 20_000);

  try {
    return await fetchLegacyBazaarAuctionDetail({
      auctionId,
      subtopic: normalizedSubtopic,
      timeoutMs: legacyTimeoutMs
    });
  } catch (error) {
    const fallback = await buildOverviewBackedAuctionDetail({
      auctionId,
      subtopic: normalizedSubtopic,
      timeoutMs
    });

    if (!fallback) {
      throw error;
    }

    return fallback;
  }
}

async function buildOverviewBackedAuctionDetail({ auctionId, subtopic, timeoutMs }) {
  const numericAuctionId = Number.parseInt(String(auctionId || ""), 10);

  if (!Number.isFinite(numericAuctionId) || numericAuctionId <= 0) {
    return null;
  }

  const pageCandidates =
    subtopic === "currentcharactertrades" ? [1, 2, 3, 4, 5] : [1, 2, 3];

  for (const currentpage of pageCandidates) {
    const overview = await fetchBazaarOverview({
      subtopic,
      filters: {
        ...DEFAULT_FILTERS_BY_SUBTOPIC[subtopic],
        currentpage: String(currentpage)
      },
      timeoutMs
    }).catch(() => null);
    const auction = overview?.auctions?.find((entry) => Number(entry?.auctionId) === numericAuctionId);

    if (!auction) {
      continue;
    }

    return mapOverviewAuctionToDetail(auction);
  }

  return null;
}

function mapOverviewAuctionToDetail(auction) {
  const sourceData = auction?.sourceData || {};
  const fields = {
    Name: auction?.characterName || "",
    Level: stringify(auction?.level),
    Vocation: auction?.vocation || "",
    Sex: auction?.sex || "",
    World: auction?.world || "",
    "Auction Status": auction?.status || "",
    "Achievement Points": stringify(
      sourceData?.achievementPoints ?? sourceData?.sourceData?.achievementPoints
    ),
    "Boss Points": stringify(sourceData?.bossPoints),
    "Charm Points": stringify(sourceData?.charmInfo?.total ?? sourceData?.charmPoints),
    "TC Invested": stringify(sourceData?.tcInvested),
    "Hirelings": stringify(
      sourceData?.hirelings?.count ?? sourceData?.hirelingCount
    ),
    "Prey Slot": boolToYesNo(sourceData?.preySlot),
    "Hunting Task Slot": boolToYesNo(sourceData?.huntingSlot),
    "World Transfer": boolToYesNo(
      sourceData?.transfer ?? sourceData?.transferAvailable
    )
  };
  const skills = buildSkills(sourceData);

  return {
    title: `${auction?.characterName || "Auction"} - Fallback`,
    requestUrl: auction?.detailUrl || null,
    detailUrl: auction?.detailUrl || null,
    subtopic: auction?.subtopic || "currentcharactertrades",
    auctionId: Number(auction?.auctionId || 0),
    characterName: auction?.characterName || "",
    level: Number(auction?.level || 0),
    vocation: auction?.vocation || "",
    sex: auction?.sex || "",
    world: auction?.world || "",
    hiddenAuctionId: Number(auction?.auctionId || 0),
    outfitImage: auction?.outfitImage || null,
    displayItems: Array.isArray(auction?.displayItems) ? auction.displayItems : [],
    summary: {
      countdownText: auction?.countdownText || null,
      auctionStart: auction?.auctionStart || null,
      auctionEnd: auction?.auctionEnd || null,
      bidType: auction?.bidType || null,
      bidAmount: Number(auction?.bidAmount || 0),
      lines: Array.isArray(auction?.highlights) ? auction.highlights : []
    },
    general: {
      fields: compactObject(fields),
      skills: compactObject(skills)
    },
    sectionPageCounts: {},
    itemSummary: normalizeItemEntries(sourceData?.items),
    storeItemSummary: normalizeItemEntries(sourceData?.storeItems),
    mounts: normalizeStringArray(sourceData?.mounts),
    storeMounts: normalizeStringArray(sourceData?.storeMounts),
    outfits: normalizeOutfits(sourceData?.outfits),
    storeOutfits: normalizeOutfits(sourceData?.storeOutfits),
    familiars: [],
    blessings: [],
    imbuements: normalizeStringArray(sourceData?.imbuements),
    charms: normalizeCharms(sourceData),
    completedCyclopediaMapAreas: [],
    completedQuestLines: normalizeStringArray(sourceData?.quests),
    titles: [],
    achievements: normalizeStringArray(sourceData?.rareAchievements),
    bestiaryProgress: [],
    sourceData,
    fallbackSource: "overview",
    fetchedAt: new Date().toISOString()
  };
}

function buildSkills(sourceData) {
  return {
    "Magic Level": numberOrNull(sourceData?.skills?.magic ?? sourceData?.magicLevel),
    Sword: numberOrNull(sourceData?.skills?.sword ?? sourceData?.sword),
    Axe: numberOrNull(sourceData?.skills?.axe ?? sourceData?.axe),
    Club: numberOrNull(sourceData?.skills?.club ?? sourceData?.club),
    Distance: numberOrNull(sourceData?.skills?.distance ?? sourceData?.distance),
    Shielding: numberOrNull(sourceData?.skills?.shielding ?? sourceData?.shielding),
    Fist: numberOrNull(sourceData?.skills?.fist ?? sourceData?.fist),
    Fishing: numberOrNull(sourceData?.skills?.fishing ?? sourceData?.fishing)
  };
}

function normalizeItemEntries(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => {
    if (typeof value === "number") {
      return {
        title: `Item #${value}`,
        amount: 1
      };
    }

    return {
      title: String(value?.name || value || "").trim(),
      amount: Number(value?.amount || 1)
    };
  });
}

function normalizeOutfits(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      if (typeof value === "string") {
        return { name: value, addons: 0 };
      }

      return {
        name: String(value?.name || "").trim(),
        addons: Number(value?.type || 0)
      };
    })
    .filter((entry) => entry.name);
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function normalizeCharms(sourceData) {
  const charmPoints = numberOrNull(sourceData?.charmInfo?.total ?? sourceData?.charmPoints);
  if (charmPoints === null) {
    return [];
  }

  return [
    {
      name: "Charm Points",
      value: charmPoints
    }
  ];
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, entryValue]) => {
      if (entryValue === null || entryValue === undefined) {
        return false;
      }
      if (typeof entryValue === "string") {
        return entryValue.trim().length > 0;
      }
      return true;
    })
  );
}

function boolToYesNo(value) {
  if (value === true) {
    return "yes";
  }
  if (value === false) {
    return "no";
  }
  return "";
}

function stringify(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeBazaarSubtopic(value) {
  return String(value || "").toLowerCase() === "pastcharactertrades"
    ? "pastcharactertrades"
    : "currentcharactertrades";
}
