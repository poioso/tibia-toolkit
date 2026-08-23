const ITEM_SPRITE_ROOT = "assets/data/items/sprites";
const POTION_SOUND_ROOT = "assets/screen-vision/reference/sounds/potions";

export const SCREEN_VISION_POTION_PRESETS = [
  {
    id: "bullseye-potion",
    name: "Bullseye Potion",
    durationSeconds: 10 * 60,
    imagePath: `${ITEM_SPRITE_ROOT}/2014.png`,
    soundKey: "potion-bullseye",
    soundPath: `${POTION_SOUND_ROOT}/bullseye-potion.ogg`,
    vocations: ["paladin"]
  },
  {
    id: "berserk-potion",
    name: "Berserk Potion",
    durationSeconds: 10 * 60,
    imagePath: `${ITEM_SPRITE_ROOT}/1975.png`,
    soundKey: "potion-berserk",
    soundPath: `${POTION_SOUND_ROOT}/berserk-potion.ogg`,
    vocations: ["knight"]
  },
  {
    id: "mastermind-potion",
    name: "Mastermind Potion",
    durationSeconds: 10 * 60,
    imagePath: `${ITEM_SPRITE_ROOT}/2301.png`,
    soundKey: "potion-mastermind",
    soundPath: `${POTION_SOUND_ROOT}/mastermind-potion.ogg`,
    vocations: ["sorcerer", "druid"]
  },
  {
    id: "transcendence-potion",
    name: "Transcendence Potion",
    durationSeconds: 10 * 60,
    imagePath: `${ITEM_SPRITE_ROOT}/2471.png`,
    soundKey: "potion-transcendence",
    soundPath: `${POTION_SOUND_ROOT}/transcendence-potion.ogg`,
    vocations: ["monk"]
  }
];

export const SCREEN_VISION_FOOD_PRESETS = [
  ["banana-chocolate-shake", "Banana Chocolate Shake", 10 * 60, 1932],
  ["blessed-acorn", "Blessed Acorn", 10 * 60 * 60, 4108],
  ["blessed-steak", "Blessed Steak", 10 * 60, 1892],
  ["blueberry-cupcake", "Blueberry Cupcake", 10 * 60, 1923],
  ["carrion-casserole", "Carrion Casserole", 10 * 60, 2061],
  ["carrot-cake", "Carrot Cake", 60 * 60, 2051],
  ["carrot-pie", "Carrot Pie", 60 * 60, 2095],
  ["chilli-con-carniphila", "Chilli Con Carniphila", 60 * 60, 2106],
  ["coconut-shrimp-bake", "Coconut Shrimp Bake", 24 * 60 * 60, 2171],
  ["consecrated-beef", "Consecrated Beef", 10 * 60, 2181],
  ["delicatessen-salad", "Delicatessen Salad", 10 * 60, 2234],
  ["demonic-candy-ball", "Demonic Candy Ball", 10 * 60, 2265],
  ["filled-jalapeno-peppers", "Filled Jalapeño Peppers", 60 * 60, 2320],
  ["hydra-tongue-salad", "Hydra Tongue Salad", 10 * 60, 2439],
  ["lemon-cupcake", "Lemon Cupcake", 10 * 60, 2519],
  ["northern-fishburger", "Northern Fishburger", 60 * 60, 2643],
  ["overcooked-noodles", "Overcooked Noodles", 10 * 60, 2660],
  ["pot-of-blackjack", "Pot of Blackjack", 10 * 60, 2716],
  ["roasted-dragon-wings", "Roasted Dragon Wings", 60 * 60, 2798],
  ["roasted-wyvern-wings", "Roasted Wyvern Wings", 10 * 60, 2820],
  ["rotworm-stew", "Rotworm Stew", 10 * 60, 2848],
  ["strawberry-cupcake", "Strawberry Cupcake", 10 * 60, 2948],
  ["svargrond-salmon-filet", "Svargrond Salmon Filet", 60 * 60, 2943],
  ["sweet-mangonaise-elixir", "Sweet Mangonaise Elixir", 10 * 60, 2458],
  ["tropical-fried-terrorbird", "Tropical Fried Terrorbird", 10 * 60, 2984],
  ["tropical-marinated-tiger", "Tropical Marinated Tiger", 10 * 60, 3011],
  ["veggie-casserole", "Veggie Casserole", 10 * 60, 3034],
  ["zaoan-sauce", "Zaoan Sauce", 10 * 60, 3053]
].map(([id, name, durationSeconds, spriteId]) => ({
  id,
  name,
  durationSeconds,
  imagePath: `${ITEM_SPRITE_ROOT}/${spriteId}.png`,
  soundKey: "none",
  soundPath: ""
}));

