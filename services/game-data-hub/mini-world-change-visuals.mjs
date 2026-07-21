const WIKI_BASE_URL = "https://www.tibiawiki.com.br/wiki";

export const MINI_WORLD_CHANGE_VISUALS = Object.freeze({
  "Bank Robbery": defineVisual({
    sourceId: 24,
    displayName: "Bank Robbery",
    wikiPage: "Bank_Robbery",
    images: [itemImage("Treasure Chest", "treasure-chest", 2286)]
  }),
  Bored: defineVisual({
    sourceId: 6,
    displayName: "Bored Witch",
    wikiPage: "Bored_Witch",
    images: [itemImage("Torn Teddy", "torn-teddy", 1939)]
  }),
  "Chakoya Iceberg": defineVisual({
    sourceId: 18,
    displayName: "Chakoya Iceberg",
    wikiPage: "Chakoya_Iceberg",
    images: [creatureImage("Chakoya Tribewarden", "chakoya-tribewarden")]
  }),
  Chyllfroest: defineVisual({
    sourceId: 25,
    displayName: "Chyllfroest",
    wikiPage: "Chyllfroest",
    images: [creatureImage("Ursagrodon", "ursagrodon")]
  }),
  "Devovorga's Essence": defineVisual({
    sourceId: 1,
    displayName: "Devovorga's Essence",
    wikiPage: "Devovorga's_Essence",
    images: [creatureImage("Devovorga", "devovorga")]
  }),
  "Down the Drain": defineVisual({
    sourceId: 14,
    displayName: "River Flood",
    wikiPage: "River_Flood",
    images: [creatureImage("Water Elemental", "water-elemental")]
  }),
  "Fire from the Earth": defineVisual({
    sourceId: 21,
    displayName: "Goroma Eruption",
    wikiPage: "Goroma_Eruption",
    images: [creatureImage("Morgaroth", "morgaroth")]
  }),
  "Fury Gates": defineVisual({
    sourceId: 16,
    displayName: "Fury Gates",
    wikiPage: "Fury_Gates",
    images: [creatureImage("Fury", "fury")]
  }),
  Grimvale: defineVisual({
    sourceId: 19,
    displayName: "Grimvale Moon",
    wikiPage: "Grimvale_Moon",
    images: [
      creatureImage("Feroxa (Imune)", "feroxa", {
        imageFile: "Feroxa_(Imune).gif",
        wikiPage: "Feroxa_(Imune)"
      })
    ]
  }),
  "Hive Outpost": defineVisual({
    sourceId: 7,
    displayName: "Hive Outpost",
    wikiPage: "Hive_Outpost",
    images: [creatureImage("The Mean Masher", "the-mean-masher")]
  }),
  "Jungle Camp": defineVisual({
    sourceId: 11,
    displayName: "Dworc Camp / Hunter Camp",
    wikiPage: "Mini_World_Changes#Dworc_Camp",
    variants: [
      defineVariant({
        displayName: "Dworc Camp",
        wikiPage: "Dworc_Camp",
        images: [creatureImage("Oodok Witchmaster", "oodok-witchmaster")]
      }),
      defineVariant({
        displayName: "Hunter Camp",
        wikiPage: "Hunter_Camp",
        images: [creatureImage("Arthom the Hunter", "arthom-the-hunter")]
      })
    ],
    images: [
      creatureImage("Oodok Witchmaster", "oodok-witchmaster"),
      creatureImage("Arthom the Hunter", "arthom-the-hunter")
    ]
  }),
  Kingsday: defineVisual({
    sourceId: 12,
    displayName: "Thais Kingsday",
    wikiPage: "Thais_Kingsday",
    images: [npcImage("King Tibianus", "king-tibianus")]
  }),
  Lumberjack: defineVisual({
    sourceId: 13,
    displayName: "Lumberjack",
    wikiPage: "Lumberjack",
    images: [itemImage("Wood", "wood", 5780)]
  }),
  "Nightmare Isles": defineVisual({
    sourceId: 4,
    displayName: "Nightmare",
    wikiPage: "Nightmare",
    images: [itemImage("Nightmare Teddy", "nightmare-teddy", 1699)]
  }),
  Nomads: defineVisual({
    sourceId: 3,
    displayName: "Nomads",
    wikiPage: "Nomads",
    images: [creatureImage("Nomad", "nomad-basic")]
  }),
  "Noodles is Gone": defineVisual({
    sourceId: 10,
    displayName: "Noodles is Gone",
    wikiPage: "Noodles_is_Gone",
    images: [npcImage("Noodles", "noodles")]
  }),
  "Oriental Trader": defineVisual({
    sourceId: 20,
    displayName: "Oriental Trader",
    wikiPage: "Oriental_Trader",
    images: [npcImage("Yasir", "yasir")]
  }),
  "Poacher Caves": defineVisual({
    sourceId: 26,
    displayName: "Orc Land",
    wikiPage: "Orc_Land",
    images: [creatureImage("Gloom Wolf", "gloom-wolf")]
  }),
  "River Runs Deep": defineVisual({
    sourceId: 15,
    displayName: "River Runs Deep",
    wikiPage: "River_Runs_Deep",
    images: [itemImage("Sandfish", "sandfish", 2854)]
  }),
  "Spiders Nest": defineVisual({
    sourceId: 8,
    displayName: "Spider's Nest",
    wikiPage: "Spider's_Nest",
    images: [creatureImage("Mamma Longlegs", "mamma-longlegs")]
  }),
  "Spirit Grounds": defineVisual({
    sourceId: 17,
    displayName: "Spirit Gate",
    wikiPage: "Spirit_Gate",
    images: [creatureImage("Phantasm", "phantasm")]
  }),
  Stampede: defineVisual({
    sourceId: 2,
    displayName: "Stampede",
    wikiPage: "Stampede",
    images: [creatureImage("Elephant", "elephant")]
  }),
  Thawing: defineVisual({
    sourceId: 5,
    displayName: "Thawing",
    wikiPage: "Thawing",
    images: [itemImage("Ice Flower Seeds", "ice-flower-seeds", 4600)]
  }),
  Warpath: defineVisual({
    sourceId: 9,
    displayName: "Bibby Bloodbath",
    wikiPage: "Bibby_Bloodbath",
    images: [creatureImage("Bibby Bloodbath", "bibby-bloodbath")]
  })
});

export function getMiniWorldChangeVisual(sourceName) {
  return MINI_WORLD_CHANGE_VISUALS[String(sourceName || "").trim()] || null;
}

export function enrichMiniWorldChange(entry = {}) {
  const visual = getMiniWorldChangeVisual(entry.name);

  if (!visual) {
    return { ...entry };
  }

  return {
    ...entry,
    displayName: visual.displayName,
    wikiUrl: visual.wikiUrl,
    images: visual.images,
    ...(visual.variants.length > 0 ? { variants: visual.variants } : {})
  };
}

function defineVisual({ sourceId, displayName, wikiPage, images, variants = [] }) {
  return Object.freeze({
    sourceId,
    displayName,
    wikiUrl: wikiUrl(wikiPage),
    images: Object.freeze(images),
    variants: Object.freeze(variants)
  });
}

function defineVariant({ displayName, wikiPage, images }) {
  return Object.freeze({
    displayName,
    wikiUrl: wikiUrl(wikiPage),
    images: Object.freeze(images)
  });
}

function creatureImage(label, slug, options = {}) {
  return imageRef("creature", label, slug, options);
}

function itemImage(label, slug, assetId) {
  return imageRef("item", label, slug, {
    assetId,
    localPath: `assets/data/items/sprites/${assetId}.png`
  });
}

function npcImage(label, slug) {
  return imageRef("npc", label, slug);
}

function imageRef(kind, label, slug, options = {}) {
  return Object.freeze({
    kind,
    label,
    slug,
    ...(options.assetId ? { assetId: options.assetId } : {}),
    ...(options.localPath ? { localPath: options.localPath } : {}),
    ...(options.imageFile ? { imageFile: options.imageFile } : {}),
    ...(options.wikiPage ? { wikiUrl: wikiUrl(options.wikiPage) } : {})
  });
}

function wikiUrl(page) {
  const [pageTitle, fragment] = String(page || "").split("#", 2);
  const base = `${WIKI_BASE_URL}/${encodeURIComponent(pageTitle)}`;
  return fragment ? `${base}#${encodeURIComponent(fragment)}` : base;
}
