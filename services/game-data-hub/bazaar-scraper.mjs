const BAZAAR_BASE_URL = "https://www.tibia.com/charactertrade/";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_VIEWPORT = { width: 1440, height: 1600 };
const BAZAAR_HEADERS = {
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  locale: "en-US"
};

let playwrightModulePromise = null;
let browserPromise = null;

export async function fetchBazaarOverview({
  subtopic = "currentcharactertrades",
  filters = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const normalizedSubtopic = normalizeBazaarSubtopic(subtopic);
  return withBazaarContext(async (page) => {
    const url = buildBazaarOverviewUrl(normalizedSubtopic, filters);
    await gotoBazaarUrl(page, url, timeoutMs);

    return page.evaluate(({ subtopic: currentSubtopic, requestUrl }) => {
      const allLines = normalizeLines(document.body.innerText);
      const resultsMatch = document.body.innerText.match(/Results:\s*([\d,]+)/i);
      const auctions = [...document.querySelectorAll(".Auction")].map((auction) =>
        extractAuctionCard(auction, currentSubtopic)
      );
      const pagination = extractPagination(currentSubtopic);

      return {
        title: document.title,
        requestUrl,
        subtopic: currentSubtopic,
        pageTitle: normalizeText(
          document.querySelector(".Text")?.querySelector(".BigBoldText")?.textContent ||
            document.querySelector(".InnerTableContainer")?.querySelector(".Text")?.textContent ||
            ""
        ),
        totalResults: parseNumber(resultsMatch?.[1] || "0"),
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        filters: extractActiveFilters(document.forms, currentSubtopic),
        auctions,
        paginationLinks: pagination.links,
        bodyPreview: allLines.slice(0, 20),
        fetchedAt: new Date().toISOString()
      };

      function extractAuctionCard(auction, currentSubtopicInner) {
        const header = auction.querySelector(".AuctionHeader");
        const detailHref =
          auction.querySelector(".AuctionCharacterName a")?.href ||
          auction.querySelector("a[href*='auctionid=']")?.href ||
          null;
        const auctionId = parseAuctionId(detailHref);
        const lines = normalizeLines(auction.innerText);
        const headerLine = lines[1] || "";
        const startIndex = lines.indexOf("Auction Start:");
        const endIndex = lines.indexOf("Auction End:");
        const bidIndex = lines.findIndex((line) => /Bid:$/i.test(line));
        const afterBid = bidIndex >= 0 ? lines.slice(bidIndex + 2) : [];
        const cleanedAfterBid = afterBid.filter((line) => line !== "My Bid Limit");
        const status =
          cleanedAfterBid[0] &&
          !/^[\d.,]+$/.test(cleanedAfterBid[0]) &&
          !/Achievement Points|Charm Points|Gold total|Blessings active|Store Mounts|Level|Magic Level|Distance Fighting|Sword Fighting|Fist Fighting|Quests completed|Regular World Transfer|Unused Hunting Task Points/i.test(
            cleanedAfterBid[0]
          )
            ? cleanedAfterBid[0]
            : null;

        return {
          auctionId,
          subtopic: currentSubtopicInner,
          detailUrl: detailHref,
          characterName: lines[0] || "",
          ...parseHeaderLine(headerLine),
          worldUrl:
            header?.querySelector("a[href*='subtopic=worlds']")?.href || null,
          outfitImage:
            auction.querySelector(".AuctionOutfitImage")?.getAttribute("src") || null,
          isNew: Boolean(auction.querySelector(".AuctionNewIcon")),
          displayItems: [...auction.querySelectorAll(".AuctionItemsViewBox .CVIconObject")]
            .map((item) => normalizeText(item.getAttribute("title") || ""))
            .filter(Boolean),
          countdownText:
            normalizeText(
              auction.querySelector(".AuctionTimer")?.innerText ||
                auction.querySelector(".AuctionTimer")?.getAttribute("date-timestring") ||
                ""
            ) || null,
          auctionStart: startIndex >= 0 ? lines[startIndex + 1] || null : null,
          auctionEnd: endIndex >= 0 ? lines[endIndex + 1] || null : null,
          bidType:
            bidIndex >= 0 ? normalizeText(lines[bidIndex].replace(/:$/, "")) : null,
          bidAmount:
            bidIndex >= 0 ? parseNumber(lines[bidIndex + 1] || "0") : 0,
          status,
          highlights: cleanedAfterBid.slice(status ? 1 : 0),
          rawLines: lines
        };
      }

      function extractPagination(currentSubtopicInner) {
        const currentUrl = new URL(window.location.href);
        const currentPage = parseNumber(currentUrl.searchParams.get("currentpage") || "1") || 1;
        const links = [...document.querySelectorAll(`a[href*='subtopic=${currentSubtopicInner}']`)]
          .map((link) => {
            const href = link.href || "";
            const parsed = safeUrl(href);
            return {
              label: normalizeText(link.textContent || ""),
              href,
              currentPage: parsed ? parseNumber(parsed.searchParams.get("currentpage") || "0") : 0
            };
          })
          .filter((entry) => entry.href);
        const totalPages = Math.max(
          currentPage,
          ...links.map((entry) => entry.currentPage || 0).filter(Boolean),
          1
        );

        return {
          currentPage,
          totalPages,
          links
        };
      }

      function extractActiveFilters(forms, currentSubtopicInner) {
        const actionForm = [...forms].find((form) => {
          const action = form.getAttribute("action") || "";
          return action.includes(`subtopic=${currentSubtopicInner}`) && form.querySelector("select[name='filter_world']");
        });

        if (!actionForm) {
          return {};
        }

        const fields = [
          "filter_world",
          "filter_worldpvptype",
          "filter_worldbattleyestate",
          "filter_profession",
          "filter_levelrangefrom",
          "filter_levelrangeto",
          "filter_skillid",
          "filter_skillrangefrom",
          "filter_skillrangeto",
          "order_column",
          "order_direction",
          "searchtype",
          "searchstring",
          "currentpage"
        ];

        const output = {};
        for (const field of fields) {
          const element = actionForm.querySelector(`[name='${field}']`);
          if (!element) {
            continue;
          }
          output[field] = element.value ?? "";
        }

        return output;
      }

      function parseHeaderLine(line) {
        const match = line.match(
          /^Level:\s*(\d+)\s*\|\s*Vocation:\s*(.*?)\s*\|\s*(Male|Female)\s*\|\s*World:\s*(.*)$/i
        );

        return {
          level: parseNumber(match?.[1] || "0"),
          vocation: normalizeText(match?.[2] || ""),
          sex: normalizeText(match?.[3] || ""),
          world: normalizeText(match?.[4] || "")
        };
      }

      function normalizeLines(value) {
        return String(value || "")
          .split(/\r?\n/)
          .map((line) => normalizeText(line))
          .filter(Boolean);
      }

      function normalizeText(value) {
        return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      }

      function parseAuctionId(href) {
        const parsed = safeUrl(href);
        return parsed ? parseNumber(parsed.searchParams.get("auctionid") || "0") : 0;
      }

      function parseNumber(value) {
        const digits = String(value || "").replace(/[^\d-]/g, "");
        const parsed = Number.parseInt(digits, 10);
        return Number.isFinite(parsed) ? parsed : 0;
      }

      function safeUrl(value) {
        try {
          return value ? new URL(value) : null;
        } catch {
          return null;
        }
      }
    }, { subtopic: normalizedSubtopic, requestUrl: url.toString() });
  });
}

export async function fetchBazaarAuctionDetail({
  auctionId,
  subtopic = "currentcharactertrades",
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const normalizedSubtopic = normalizeBazaarSubtopic(subtopic);
  const normalizedAuctionId = Number.parseInt(String(auctionId || ""), 10);

  if (!Number.isFinite(normalizedAuctionId) || normalizedAuctionId <= 0) {
    throw new Error("Invalid auction id.");
  }

  return withBazaarContext(async (page) => {
    const url = buildBazaarDetailUrl(normalizedSubtopic, normalizedAuctionId);
    await gotoBazaarUrl(page, url, timeoutMs);

    return page.evaluate(async ({ subtopic: currentSubtopic, auctionId: currentAuctionId, requestUrl }) => {
      const sectionTypeMap = {
        ItemSummary: 0,
        StoreItemSummary: 1,
        Mounts: 2,
        StoreMounts: 3,
        Outfits: 4,
        StoreOutfits: 5
      };

      const generalRoot = document.querySelector("#General");
      const general = extractGeneralSection(generalRoot);

      const detailUrl = window.location.href;
      const sectionPageCounts = {};
      for (const [sectionId, sectionType] of Object.entries(sectionTypeMap)) {
        sectionPageCounts[sectionId] = {
          sectionType,
          pages: Math.max(document.querySelectorAll(`#${sectionId} .PageLink`).length, 1)
        };
      }

      const itemSummary = await collectPagedItems("ItemSummary");
      const storeItemSummary = await collectPagedItems("StoreItemSummary");
      const mounts = await collectPagedMounts("Mounts");
      const storeMounts = await collectPagedMounts("StoreMounts");
      const outfits = await collectPagedOutfits("Outfits");
      const storeOutfits = await collectPagedOutfits("StoreOutfits");

      return {
        title: document.title,
        requestUrl,
        detailUrl,
        subtopic: currentSubtopic,
        auctionId: currentAuctionId,
        characterName: normalizeText(document.querySelector(".AuctionCharacterName a")?.textContent || document.querySelector(".AuctionCharacterName")?.textContent || ""),
        ...parseHeaderLine(normalizeText(document.querySelector(".AuctionHeader")?.innerText || "")),
        hiddenAuctionId: parseNumber(document.querySelector("input[name='auctionid']")?.value || "0"),
        outfitImage:
          document.querySelector(".AuctionOutfitImage")?.getAttribute("src") || null,
        displayItems: parseDisplayItems(document),
        summary: {
          countdownText:
            normalizeText(
              document.querySelector(".AuctionTimer")?.innerText ||
                document.querySelector(".AuctionTimer")?.getAttribute("date-timestring") ||
                ""
            ) || null,
          auctionStart: extractShortField("Auction Start"),
          auctionEnd: extractShortField("Auction End"),
          bidType: extractBidType(),
          bidAmount: extractBidAmount(),
          lines: normalizeLines(document.querySelector(".ShortAuctionData")?.innerText || "")
        },
        general,
        sectionPageCounts,
        itemSummary,
        storeItemSummary,
        mounts,
        storeMounts,
        outfits,
        storeOutfits,
        familiars: parseMountTitles(document.querySelector("#Familiars")),
        blessings: parseBlessings(document.querySelector("#Blessings")),
        imbuements: parseSimpleList(document.querySelector("#Imbuements"), "No imbuements."),
        charms: parseCharms(document.querySelector("#Charms")),
        completedCyclopediaMapAreas: parseSimpleList(
          document.querySelector("#CompletedCyclopediaMapAreas"),
          "No areas explored."
        ),
        completedQuestLines: parseSimpleList(document.querySelector("#CompletedQuestLines"), ""),
        titles: parseSimpleList(document.querySelector("#Titles"), ""),
        achievements: parseSimpleList(document.querySelector("#Achievements"), ""),
        bestiaryProgress: parseBestiary(document.querySelector("#BestiaryProgress")),
        fetchedAt: new Date().toISOString()
      };

      async function collectPagedItems(sectionId) {
        const sectionRoot = document.querySelector(`#${sectionId}`);
        const pages = Math.max(sectionRoot?.querySelectorAll(".PageLink").length || 0, 1);
        const aggregated = aggregateItems(parseItems(sectionRoot));

        for (let pageIndex = 2; pageIndex <= pages; pageIndex += 1) {
          const html = await fetchAjaxSection(sectionTypeMap[sectionId], pageIndex);
          const root = createFragmentRoot(html);
          aggregated.push(...parseItems(root));
        }

        return aggregateItems(aggregated);
      }

      async function collectPagedMounts(sectionId) {
        const sectionRoot = document.querySelector(`#${sectionId}`);
        const pages = Math.max(sectionRoot?.querySelectorAll(".PageLink").length || 0, 1);
        const aggregated = [...parseMountTitles(sectionRoot)];

        for (let pageIndex = 2; pageIndex <= pages; pageIndex += 1) {
          const html = await fetchAjaxSection(sectionTypeMap[sectionId], pageIndex);
          const root = createFragmentRoot(html);
          aggregated.push(...parseMountTitles(root));
        }

        return [...new Set(aggregated)];
      }

      async function collectPagedOutfits(sectionId) {
        const sectionRoot = document.querySelector(`#${sectionId}`);
        const pages = Math.max(sectionRoot?.querySelectorAll(".PageLink").length || 0, 1);
        const aggregated = [...parseOutfits(sectionRoot)];

        for (let pageIndex = 2; pageIndex <= pages; pageIndex += 1) {
          const html = await fetchAjaxSection(sectionTypeMap[sectionId], pageIndex);
          const root = createFragmentRoot(html);
          aggregated.push(...parseOutfits(root));
        }

        return dedupeOutfits(aggregated);
      }

      async function fetchAjaxSection(sectionType, pageIndex) {
        const response = await fetch(
          `https://www.tibia.com/websiteservices/handle_charactertrades.php?auctionid=${currentAuctionId}&type=${sectionType}&currentpage=${pageIndex}`,
          {
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              "Content-Type": "application/json"
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Bazaar ajax section failed (${response.status}) for type ${sectionType} page ${pageIndex}.`);
        }

        const payload = await response.json();
        return payload?.AjaxObjects?.[0]?.Data || "";
      }

      function createFragmentRoot(html) {
        const parser = new DOMParser();
        return parser.parseFromString(`<body>${html}</body>`, "text/html").body;
      }

      function extractGeneralSection(root) {
        const fields = {};
        const skills = {};

        root?.querySelectorAll(".LabelV").forEach((label) => {
          const key = normalizeText(label.textContent || "").replace(/:$/, "");
          const value = normalizeText(label.nextElementSibling?.textContent || "");
          if (key) {
            fields[key] = value;
          }
        });

        root?.querySelectorAll(".LabelColumn").forEach((label) => {
          const key = normalizeText(label.textContent || "").replace(/:$/, "");
          const value = parseNumber(label.nextElementSibling?.textContent || "0");
          if (key) {
            skills[key] = value;
          }
        });

        return { fields, skills };
      }

      function parseDisplayItems(root) {
        return [...root.querySelectorAll(".AuctionItemsViewBox .CVIconObject")]
          .map((item) => normalizeText(item.getAttribute("title") || ""))
          .filter(Boolean);
      }

      function extractShortField(label) {
        const nodes = normalizeLines(document.querySelector(".ShortAuctionData")?.innerText || "");
        const index = nodes.indexOf(`${label}:`);
        return index >= 0 ? nodes[index + 1] || null : null;
      }

      function extractBidType() {
        const nodes = normalizeLines(document.querySelector(".ShortAuctionData")?.innerText || "");
        const bidIndex = nodes.findIndex((line) => /Bid:$/i.test(line));
        return bidIndex >= 0 ? normalizeText(nodes[bidIndex].replace(/:$/, "")) : null;
      }

      function extractBidAmount() {
        const nodes = normalizeLines(document.querySelector(".ShortAuctionData")?.innerText || "");
        const bidIndex = nodes.findIndex((line) => /Bid:$/i.test(line));
        return bidIndex >= 0 ? parseNumber(nodes[bidIndex + 1] || "0") : 0;
      }

      function parseItems(root) {
        const items = [];
        root?.querySelectorAll(".CVIconObject").forEach((icon) => {
          const rawTitle = normalizeText(icon.getAttribute("title") || "");
          if (!rawTitle || rawTitle === "(no item for display selected)") {
            return;
          }
          const firstLine = normalizeText(rawTitle.split("\n")[0] || rawTitle);
          const match = firstLine.match(/^([\d,.]+)x\s+(.+)$/i);
          items.push({
            name: normalizeText(match?.[2] || firstLine),
            amount: parseNumber(match?.[1] || "1"),
            rawTitle
          });
        });
        return items;
      }

      function aggregateItems(items) {
        const totals = new Map();
        for (const item of items || []) {
          if (!item?.name) {
            continue;
          }
          const existing = totals.get(item.name) || { ...item, amount: 0 };
          existing.amount += item.amount || 0;
          totals.set(item.name, existing);
        }
        return [...totals.values()].sort((left, right) => left.name.localeCompare(right.name));
      }

      function parseMountTitles(root) {
        return [...(root?.querySelectorAll(".CVIcon") || [])]
          .map((icon) => normalizeText(icon.getAttribute("title") || ""))
          .filter(Boolean);
      }

      function parseOutfits(root) {
        return [...(root?.querySelectorAll(".CVIcon") || [])]
          .map((icon) => {
            const rawTitle = normalizeText(icon.getAttribute("title") || "");
            if (!rawTitle) {
              return null;
            }
            return {
              name: normalizeText(rawTitle.split(" (")[0] || rawTitle),
              addon1: /addon 1/i.test(rawTitle),
              addon2: /addon 2/i.test(rawTitle),
              rawTitle
            };
          })
          .filter(Boolean);
      }

      function dedupeOutfits(outfits) {
        const seen = new Map();
        for (const outfit of outfits || []) {
          if (!outfit?.name) {
            continue;
          }
          seen.set(`${outfit.name}:${outfit.addon1}:${outfit.addon2}`, outfit);
        }
        return [...seen.values()].sort((left, right) => left.name.localeCompare(right.name));
      }

      function parseBlessings(root) {
        return [...(root?.querySelectorAll(".Odd, .Even") || [])]
          .map((row) => {
            const text = normalizeLines(row.innerText);
            if (text.length < 2) {
              return null;
            }
            return {
              count: parseNumber(text[0]),
              name: text.slice(1).join(" ")
            };
          })
          .filter(Boolean);
      }

      function parseSimpleList(root, emptyMarker) {
        return [...(root?.querySelectorAll(".Odd, .Even") || [])]
          .map((row) => normalizeText(row.innerText || ""))
          .filter((value) => value && (!emptyMarker || !value.includes(emptyMarker)))
          .filter((value) => !/indicate more entries/i.test(value));
      }

      function parseCharms(root) {
        return [...(root?.querySelectorAll(".Odd, .Even") || [])]
          .map((row) => {
            const text = normalizeLines(row.innerText);
            if (text.length < 2 || /No charms\./i.test(text[0])) {
              return null;
            }
            return {
              cost: parseNumber(text[0]),
              name: text.slice(1).join(" ")
            };
          })
          .filter(Boolean);
      }

      function parseBestiary(root) {
        return [...(root?.querySelectorAll(".Odd, .Even") || [])]
          .map((row) => {
            const text = normalizeLines(row.innerText);
            if (text.length < 3) {
              return null;
            }
            return {
              step: parseNumber(text[0]),
              kills: parseNumber(text[1]),
              name: text.slice(2).join(" ")
            };
          })
          .filter(Boolean);
      }

      function parseHeaderLine(line) {
        const cleaned = normalizeText(line);
        const match = cleaned.match(
          /^(.*?)\s*Level:\s*(\d+)\s*\|\s*Vocation:\s*(.*?)\s*\|\s*(Male|Female)\s*\|\s*World:\s*(.*)$/i
        );
        return {
          headerText: cleaned,
          level: parseNumber(match?.[2] || "0"),
          vocation: normalizeText(match?.[3] || ""),
          sex: normalizeText(match?.[4] || ""),
          world: normalizeText(match?.[5] || "")
        };
      }

      function normalizeLines(value) {
        return String(value || "")
          .split(/\r?\n/)
          .map((line) => normalizeText(line))
          .filter(Boolean);
      }

      function normalizeText(value) {
        return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      }

      function parseNumber(value) {
        const digits = String(value || "").replace(/[^\d-]/g, "");
        const parsed = Number.parseInt(digits, 10);
        return Number.isFinite(parsed) ? parsed : 0;
      }
    }, {
      subtopic: normalizedSubtopic,
      auctionId: normalizedAuctionId,
      requestUrl: url.toString()
    });
  });
}

export async function closeBazaarBrowser() {
  if (!browserPromise) {
    return;
  }

  const browser = await browserPromise.catch(() => null);
  browserPromise = null;

  await browser?.close().catch(() => {});
}

async function withBazaarContext(task) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: DEFAULT_VIEWPORT,
    userAgent: BAZAAR_HEADERS.userAgent,
    locale: BAZAAR_HEADERS.locale
  });
  const page = await context.newPage();

  try {
    return await task(page);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      if (!playwrightModulePromise) {
        playwrightModulePromise = import("playwright");
      }

      const { chromium } = await playwrightModulePromise;
      return chromium.launch({ headless: true });
    })().catch((error) => {
      browserPromise = null;
      throw error;
    });
  }

  return browserPromise;
}

async function gotoBazaarUrl(page, url, timeoutMs) {
  await page.goto(url.toString(), {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs
  });

  await page.waitForFunction(
    () => {
      const bodyText = document.body?.innerText || "";
      if (/Enable JavaScript and cookies to continue/i.test(bodyText)) {
        return false;
      }
      return Boolean(document.querySelector(".Auction")) || /Results:/i.test(bodyText);
    },
    undefined,
    { timeout: timeoutMs }
  );

  await page.waitForLoadState("networkidle", {
    timeout: Math.min(timeoutMs, 30_000)
  }).catch(() => {});
}

function buildBazaarOverviewUrl(subtopic, filters = {}) {
  const url = new URL(BAZAAR_BASE_URL);
  url.searchParams.set("subtopic", subtopic);

  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null) {
      continue;
    }

    const normalized = String(value).trim();
    if (!normalized && key !== "filter_world" && key !== "filter_skillid" && key !== "searchstring") {
      continue;
    }

    url.searchParams.set(key, normalized);
  }

  return url;
}

function buildBazaarDetailUrl(subtopic, auctionId) {
  const url = new URL(BAZAAR_BASE_URL);
  url.searchParams.set("subtopic", subtopic);
  url.searchParams.set("page", "details");
  url.searchParams.set("auctionid", String(auctionId));
  return url;
}

function normalizeBazaarSubtopic(value) {
  return String(value || "").toLowerCase() === "pastcharactertrades"
    ? "pastcharactertrades"
    : "currentcharactertrades";
}
