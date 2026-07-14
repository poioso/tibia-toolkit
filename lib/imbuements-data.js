export const IMBUEMENT_TIER_ORDER = ["basic", "intricate", "powerful"];

export const IMBUEMENT_FEES = {
  basic: 7500,
  intricate: 60000,
  powerful: 250000
};

export const IMBUEMENTS = [
  {
    key: "vampirism",
    name: "Vampirism",
    category: "suporte",
    description: "Absorção de vida",
    effects: { basic: "5%", intricate: "10%", powerful: "25%" },
    tokenBundle: { basic: 2, intricate: 4, powerful: 6 },
    tiers: {
      basic: [{ name: "Vampire Teeth", quantity: 25 }],
      intricate: [
        { name: "Vampire Teeth", quantity: 25 },
        { name: "Bloody Pincers", quantity: 15 }
      ],
      powerful: [
        { name: "Vampire Teeth", quantity: 25 },
        { name: "Bloody Pincers", quantity: 15 },
        { name: "Piece of Dead Brain", quantity: 5 }
      ]
    }
  },
  {
    key: "void",
    name: "Void",
    category: "suporte",
    description: "Absorção de mana",
    effects: { basic: "3%", intricate: "5%", powerful: "8%" },
    tokenBundle: { basic: 2, intricate: 4, powerful: 6 },
    tiers: {
      basic: [{ name: "Rope Belt", quantity: 25 }],
      intricate: [
        { name: "Rope Belt", quantity: 25 },
        { name: "Silencer Claws", quantity: 25 }
      ],
      powerful: [
        { name: "Rope Belt", quantity: 25 },
        { name: "Silencer Claws", quantity: 25 },
        { name: "Some Grimeleech Wings", quantity: 5 }
      ]
    }
  },
  {
    key: "strike",
    name: "Strike",
    category: "suporte",
    description: "Dano crítico",
    effects: {
      basic: "15% / +15",
      intricate: "25% / +25",
      powerful: "50% / +50"
    },
    tokenBundle: { basic: 2, intricate: 4, powerful: 6 },
    tiers: {
      basic: [{ name: "Protective Charm", quantity: 20 }],
      intricate: [
        { name: "Protective Charm", quantity: 20 },
        { name: "Sabretooth", quantity: 25 }
      ],
      powerful: [
        { name: "Protective Charm", quantity: 20 },
        { name: "Sabretooth", quantity: 25 },
        { name: "Vexclaw Talon", quantity: 5 }
      ]
    }
  },
  {
    key: "swiftness",
    name: "Swiftness",
    category: "suporte",
    description: "Aumento de velocidade",
    effects: { basic: "+10", intricate: "+15", powerful: "+30" },
    tiers: {
      basic: [{ name: "Damselfly Wing", quantity: 15 }],
      intricate: [
        { name: "Damselfly Wing", quantity: 15 },
        { name: "Compass", quantity: 25 }
      ],
      powerful: [
        { name: "Damselfly Wing", quantity: 15 },
        { name: "Compass", quantity: 25 },
        { name: "Waspoid Wing", quantity: 20 }
      ]
    }
  },
  {
    key: "featherweight",
    name: "Featherweight",
    category: "suporte",
    description: "Aumento de capacidade",
    effects: { basic: "3%", intricate: "8%", powerful: "15%" },
    tiers: {
      basic: [{ name: "Fairy Wings", quantity: 20 }],
      intricate: [
        { name: "Fairy Wings", quantity: 20 },
        { name: "Little Bowl of Myrrh", quantity: 10 }
      ],
      powerful: [
        { name: "Fairy Wings", quantity: 20 },
        { name: "Little Bowl of Myrrh", quantity: 10 },
        { name: "Goosebump Leather", quantity: 5 }
      ]
    }
  },
  {
    key: "vibrancy",
    name: "Vibrancy",
    category: "suporte",
    description: "Remoção de paralisia",
    effects: { basic: "15%", intricate: "25%", powerful: "50%" },
    tiers: {
      basic: [{ name: "Wereboar Hooves", quantity: 20 }],
      intricate: [
        { name: "Wereboar Hooves", quantity: 20 },
        { name: "Crystallized Anger", quantity: 15 }
      ],
      powerful: [
        { name: "Wereboar Hooves", quantity: 20 },
        { name: "Crystallized Anger", quantity: 15 },
        { name: "Quill", quantity: 5 }
      ]
    }
  },
  {
    key: "lich-shroud",
    name: "Lich Shroud",
    category: "protecao-elemental",
    description: "Proteção de morte",
    effects: { basic: "2%", intricate: "5%", powerful: "10%" },
    tiers: {
      basic: [{ name: "Flask of Embalming Fluid", quantity: 25 }],
      intricate: [
        { name: "Flask of Embalming Fluid", quantity: 25 },
        { name: "Gloom Wolf Fur", quantity: 20 }
      ],
      powerful: [
        { name: "Flask of Embalming Fluid", quantity: 25 },
        { name: "Gloom Wolf Fur", quantity: 20 },
        { name: "Mystical Hourglass", quantity: 5 }
      ]
    }
  },
  {
    key: "snake-skin",
    name: "Snake Skin",
    category: "protecao-elemental",
    description: "Proteção de terra",
    effects: { basic: "3%", intricate: "8%", powerful: "15%" },
    tiers: {
      basic: [{ name: "Piece of Swampling Wood", quantity: 25 }],
      intricate: [
        { name: "Piece of Swampling Wood", quantity: 25 },
        { name: "Snake Skin", quantity: 20 }
      ],
      powerful: [
        { name: "Piece of Swampling Wood", quantity: 25 },
        { name: "Snake Skin", quantity: 20 },
        { name: "Brimstone Fangs", quantity: 10 }
      ]
    }
  },
  {
    key: "dragon-hide",
    name: "Dragon Hide",
    category: "protecao-elemental",
    description: "Proteção de fogo",
    effects: { basic: "3%", intricate: "8%", powerful: "15%" },
    tiers: {
      basic: [{ name: "Green Dragon Leather", quantity: 20 }],
      intricate: [
        { name: "Green Dragon Leather", quantity: 20 },
        { name: "Blazing Bone", quantity: 10 }
      ],
      powerful: [
        { name: "Green Dragon Leather", quantity: 20 },
        { name: "Blazing Bone", quantity: 10 },
        { name: "Draken Sulphur", quantity: 5 }
      ]
    }
  },
  {
    key: "quara-scale",
    name: "Quara Scale",
    category: "protecao-elemental",
    description: "Proteção de gelo",
    effects: { basic: "3%", intricate: "8%", powerful: "15%" },
    tiers: {
      basic: [{ name: "Winter Wolf Fur", quantity: 25 }],
      intricate: [
        { name: "Winter Wolf Fur", quantity: 25 },
        { name: "Thick Fur", quantity: 15 }
      ],
      powerful: [
        { name: "Winter Wolf Fur", quantity: 25 },
        { name: "Thick Fur", quantity: 15 },
        { name: "Deepling Warts", quantity: 10 }
      ]
    }
  },
  {
    key: "cloud-fabric",
    name: "Cloud Fabric",
    category: "protecao-elemental",
    description: "Proteção de energia",
    effects: { basic: "3%", intricate: "8%", powerful: "15%" },
    tiers: {
      basic: [{ name: "Wyvern Talisman", quantity: 20 }],
      intricate: [
        { name: "Wyvern Talisman", quantity: 20 },
        { name: "Crawler Head Plating", quantity: 15 }
      ],
      powerful: [
        { name: "Wyvern Talisman", quantity: 20 },
        { name: "Crawler Head Plating", quantity: 15 },
        { name: "Wyrm Scale", quantity: 10 }
      ]
    }
  },
  {
    key: "demon-presence",
    name: "Demon Presence",
    category: "protecao-elemental",
    description: "Proteção sagrada",
    effects: { basic: "3%", intricate: "8%", powerful: "15%" },
    tiers: {
      basic: [{ name: "Cultish Robe", quantity: 25 }],
      intricate: [
        { name: "Cultish Robe", quantity: 25 },
        { name: "Cultish Mask", quantity: 25 }
      ],
      powerful: [
        { name: "Cultish Robe", quantity: 25 },
        { name: "Cultish Mask", quantity: 25 },
        { name: "Hellspawn Tail", quantity: 20 }
      ]
    }
  },
  {
    key: "precision",
    name: "Precision",
    category: "aumento-de-skill",
    description: "Combate a distancia",
    effects: { basic: "+1", intricate: "+2", powerful: "+4" },
    tiers: {
      basic: [{ name: "Elven Scouting Glass", quantity: 25 }],
      intricate: [
        { name: "Elven Scouting Glass", quantity: 25 },
        { name: "Elven Hoof", quantity: 20 }
      ],
      powerful: [
        { name: "Elven Scouting Glass", quantity: 25 },
        { name: "Elven Hoof", quantity: 20 },
        { name: "Metal Spike", quantity: 10 }
      ]
    }
  },
  {
    key: "epiphany",
    name: "Epiphany",
    category: "aumento-de-skill",
    description: "Magic level",
    effects: { basic: "+1", intricate: "+2", powerful: "+4" },
    tiers: {
      basic: [{ name: "Elvish Talisman", quantity: 25 }],
      intricate: [
        { name: "Elvish Talisman", quantity: 25 },
        { name: "Broken Shamanic Staff", quantity: 15 }
      ],
      powerful: [
        { name: "Elvish Talisman", quantity: 25 },
        { name: "Broken Shamanic Staff", quantity: 15 },
        { name: "Strand of Medusa Hair", quantity: 15 }
      ]
    }
  },
  {
    key: "scorch",
    name: "Scorch",
    category: "dano-elemental",
    description: "Dano de fogo",
    effects: { basic: "10%", intricate: "25%", powerful: "50%" },
    tiers: {
      basic: [{ name: "Fiery Heart", quantity: 25 }],
      intricate: [
        { name: "Fiery Heart", quantity: 25 },
        { name: "Green Dragon Scale", quantity: 5 }
      ],
      powerful: [
        { name: "Fiery Heart", quantity: 25 },
        { name: "Green Dragon Scale", quantity: 5 },
        { name: "Demon Horn", quantity: 5 }
      ]
    }
  },
  {
    key: "venom",
    name: "Venom",
    category: "dano-elemental",
    description: "Dano de terra",
    effects: { basic: "10%", intricate: "25%", powerful: "50%" },
    tiers: {
      basic: [{ name: "Swamp Grass", quantity: 25 }],
      intricate: [
        { name: "Swamp Grass", quantity: 25 },
        { name: "Poisonous Slime", quantity: 20 }
      ],
      powerful: [
        { name: "Swamp Grass", quantity: 25 },
        { name: "Poisonous Slime", quantity: 20 },
        { name: "Slime Heart", quantity: 5 }
      ]
    }
  },
  {
    key: "frost",
    name: "Frost",
    category: "dano-elemental",
    description: "Dano de gelo",
    effects: { basic: "10%", intricate: "25%", powerful: "50%" },
    tiers: {
      basic: [{ name: "Frosty Heart", quantity: 25 }],
      intricate: [
        { name: "Frosty Heart", quantity: 25 },
        { name: "Seacrest Hair", quantity: 10 }
      ],
      powerful: [
        { name: "Frosty Heart", quantity: 25 },
        { name: "Seacrest Hair", quantity: 10 },
        { name: "Polar Bear Paw", quantity: 5 }
      ]
    }
  },
  {
    key: "electrify",
    name: "Electrify",
    category: "dano-elemental",
    description: "Dano de energia",
    effects: { basic: "10%", intricate: "25%", powerful: "50%" },
    tiers: {
      basic: [{ name: "Rorc Feather", quantity: 25 }],
      intricate: [
        { name: "Rorc Feather", quantity: 25 },
        { name: "Peacock Feather Fan", quantity: 5 }
      ],
      powerful: [
        { name: "Rorc Feather", quantity: 25 },
        { name: "Peacock Feather Fan", quantity: 5 },
        { name: "Energy Vein", quantity: 1 }
      ]
    }
  },
  {
    key: "reap",
    name: "Reap",
    category: "dano-elemental",
    description: "Dano de morte",
    effects: { basic: "10%", intricate: "25%", powerful: "50%" },
    tiers: {
      basic: [{ name: "Pile of Grave Earth", quantity: 25 }],
      intricate: [
        { name: "Pile of Grave Earth", quantity: 25 },
        { name: "Demonic Skeletal Hand", quantity: 20 }
      ],
      powerful: [
        { name: "Pile of Grave Earth", quantity: 25 },
        { name: "Demonic Skeletal Hand", quantity: 20 },
        { name: "Petrified Scream", quantity: 5 }
      ]
    }
  },
  {
    key: "chop",
    name: "Chop",
    category: "aumento-de-skill",
    description: "Combate com machado",
    effects: { basic: "+1", intricate: "+2", powerful: "+4" },
    tiers: {
      basic: [{ name: "Orc Tooth", quantity: 20 }],
      intricate: [
        { name: "Orc Tooth", quantity: 20 },
        { name: "Battle Stone", quantity: 25 }
      ],
      powerful: [
        { name: "Orc Tooth", quantity: 20 },
        { name: "Battle Stone", quantity: 25 },
        { name: "Moohtant Horn", quantity: 20 }
      ]
    }
  },
  {
    key: "slash",
    name: "Slash",
    category: "aumento-de-skill",
    description: "Combate com espada",
    effects: { basic: "+1", intricate: "+2", powerful: "+4" },
    tiers: {
      basic: [{ name: "Lion's Mane", quantity: 25 }],
      intricate: [
        { name: "Lion's Mane", quantity: 25 },
        { name: "Mooh'tah Shell", quantity: 25 }
      ],
      powerful: [
        { name: "Lion's Mane", quantity: 25 },
        { name: "Mooh'tah Shell", quantity: 25 },
        { name: "War Crystal", quantity: 5 }
      ]
    }
  },
  {
    key: "bash",
    name: "Bash",
    category: "aumento-de-skill",
    description: "Combate com clava",
    effects: { basic: "+1", intricate: "+2", powerful: "+4" },
    tiers: {
      basic: [{ name: "Cyclops Toe", quantity: 20 }],
      intricate: [
        { name: "Cyclops Toe", quantity: 20 },
        { name: "Ogre Nose Ring", quantity: 15 }
      ],
      powerful: [
        { name: "Cyclops Toe", quantity: 20 },
        { name: "Ogre Nose Ring", quantity: 15 },
        { name: "Warmaster's Wristguards", quantity: 10 }
      ]
    }
  },
  {
    key: "blockade",
    name: "Blockade",
    category: "aumento-de-skill",
    description: "Escudo",
    effects: { basic: "+1", intricate: "+2", powerful: "+4" },
    tiers: {
      basic: [{ name: "Piece of Scarab Shell", quantity: 20 }],
      intricate: [
        { name: "Piece of Scarab Shell", quantity: 20 },
        { name: "Brimstone Shell", quantity: 25 }
      ],
      powerful: [
        { name: "Piece of Scarab Shell", quantity: 20 },
        { name: "Brimstone Shell", quantity: 25 },
        { name: "Frazzle Skin", quantity: 25 }
      ]
    }
  }
];

export const IMBUEMENTS_BY_KEY = Object.fromEntries(
  IMBUEMENTS.map((imbuement) => [imbuement.key, imbuement])
);

export const IMBUEMENT_CATEGORY_ORDER = [
  "aumento-de-skill",
  "dano-elemental",
  "protecao-elemental",
  "suporte"
];

export const IMBUEMENT_CATEGORY_LABELS = {
  "aumento-de-skill": "Aumento de Skill",
  "dano-elemental": "Dano Elemental",
  "protecao-elemental": "Proteção Elemental",
  suporte: "Suporte"
};

export const ALL_IMBUEMENT_INGREDIENT_NAMES = [
  ...new Set(
    IMBUEMENTS.flatMap((imbuement) =>
      IMBUEMENT_TIER_ORDER.flatMap((tier) =>
        (imbuement.tiers[tier] || []).map((ingredient) => ingredient.name)
      )
    )
  )
];
