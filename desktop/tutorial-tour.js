import { driver } from "../node_modules/driver.js/dist/driver.js.mjs";
import { getAppLocale, setAppLocale, t } from "../lib/app-i18n.js";

const TUTORIAL_ASSETS = {
  welcome: "assets/ui/tutorial/tibia-toolkit-logo.png",
  market: "assets/ui/tutorial/mercado.gif",
  analyzer: "assets/ui/tutorial/analyzer-loupe.gif",
  partyHunt: "assets/ui/tutorial/party-hunt.gif",
  soloHunt: "assets/ui/tutorial/lutando.gif",
  partyFinder: "assets/ui/tutorial/taverna.gif",
  npcsCreatures: "assets/ui/tutorial/npcs-criaturas.gif",
  bestiary: "assets/ui/tutorial/bestiario.gif",
  bosstiary: "assets/ui/tutorial/bosstiario.gif",
  skillCalculator: "assets/ui/tutorial/transacao-treino.gif",
  skillDummy: "assets/ui/tutorial/treino-dummy.gif",
  skillBonus: "assets/ui/tutorial/duo-sword.gif",
  sqmFinder: "assets/ui/tutorial/sqmfindertutorial.gif",
  alerts: "assets/ui/tutorial/alertas.gif",
  obs: "assets/ui/tutorial/obs.gif",
  bossCategoryIcons: [
    "assets/ui/Bosstiary_Bane.png",
    "assets/ui/Bosstiary_Archfoe.png",
    "assets/ui/Bosstiary_Nemesis.png"
  ],
  waiting: "assets/ui/tools/tibia-eye/states/esperando.gif",
  tibiaMirror: "assets/ui/tutorial/casadosespelhos.gif",
  analyzerHelp: "assets/ui/party-loot-help.jpg",
  soloAnalyzerHelp: "assets/ui/hunt-analyzer-help.png",
  npcMarket: "assets/ui/tutorial/npc-mercado.png",
  worldList: "assets/ui/tutorial/lista-mundos.gif",
  list: "assets/ui/tutorial/lista.gif",
  tools: "assets/ui/tutorial/ferramentas-canivete.gif",
  imbuement: "assets/ui/tutorial/imbuement.gif",
  default: "assets/ui/tutorial/inicio.gif",
  invisible: "assets/ui/tutorial/invisivel.gif",
  update: "assets/ui/tutorial/update.gif",
  coffee: "assets/ui/tools/tibia-eye/buy-me-a-coffee/coffee-hero.gif",
  supporters: "assets/ui/tutorial/top-apoiadores.gif",
  supportersThanks: "assets/ui/tutorial/obrigado.gif",
  itemStatus: "assets/ui/tutorial/item-status.gif",
  question: "assets/ui/tutorial/balao-interrogacao.gif",
  continue: "assets/ui/tutorial/continuar.png",
  tick: "assets/ui/Tick.png",
  cancel: "assets/ui/Cross.png"
};

const PARTY_ANALYZER_TUTORIAL_SAMPLE = `Session data: From 2019-12-02, 15:00:18 to 2019-12-02, 15:56:19
Session: 00:56h
Loot Type: Market
Loot: 711,112
Supplies: 662,148
Balance: 48,964
Poioso Curandeiro
	Loot: 349,363
	Supplies: 98,318
	Balance: 251,045
	Damage: 215,683
	Healing: 117,408
Poioso (Leader)
	Loot: 205,479
	Supplies: 123,737
	Balance: 81,742
	Damage: 885,460
	Healing: 332,423
Poioso Atirador
	Loot: 46,904
	Supplies: 174,424
	Balance: -127,520
	Damage: 628,303
	Healing: 223`;

const SOLO_ANALYZER_TUTORIAL_SAMPLE = `Session data: From 2026-07-05, 10:47:45 to 2026-07-05, 13:42:02
Session: 02:54h
Raw XP Gain: 5,101,137
XP Gain: 16,913,913
Raw XP/h: 1,756,014
XP/h: 5,822,441
Loot: 1,811,756
Supplies: 376,631
Balance: 1,435,125
Damage: 8,615,954
Damage/h: 3,283,528
Healing: 1,341,433
Healing/h: 511,218
Killed Monsters:
  1x demon
  3x dragon hatchling
  8x dragon lord
  4x dragon lord hatchling
  378x draken abomination
  269x draken elite
  393x draken spellweaver
  343x draken warmaster
  5x lizard chosen
  1x lizard dragon priest
  11x lizard zaogun
  4x serpent spawn
  4x wyrm
Looted Items:
  2x a strong health potion
  1x a strong mana potion
  165x a great mana potion
  26x a great health potion
  37x a terra hood
  23x a small diamond
  1x a small sapphire
  65x a small ruby
  121221x a gold coin
  2207x a platinum coin
  3x a green gem
  9x a wand of inferno
  1x a fire axe
  2x a tower shield
  2x a green mushroom
  4x draken boots
  1x lizard leather
  2x a lizard scale
  5x magic sulphur
  5x an assassin dagger
  37x a great spirit potion
  136x an ultimate health potion
  7x a focus cape
  4x a wand of voodoo
  25x a small topaz
  2x a wyrm scale
  1x a snake skin
  2x a Zaoan armor
  3x a Zaoan helmet
  15x Zaoan shoes
  14x Zaoan legs
  5x a drakinata
  1x a Zaoan sword
  77x a weaver's wandtip
  38x a bone shoulderplate
  19x warmaster's wristguards
  1x a zaogun flag
  4x zaogun shoulderplates
  5x a spellweaver's robe
  8x a Zaoan robe
  10x a luminous orb
  1x a twiceslicer
  29x draken sulphur
  28x draken wristbands
  42x a broken draken mail
  53x a broken slicer
  43x an eye of corruption
  21x a tail of corruption
  45x a scale of corruption
  1x bamboo leaves`;

const TUTORIAL_LOCALE_OPTIONS = [
  { code: "pt-BR", flagSrc: "assets/ui/flags/pt-BR.svg", flagAlt: "Português (Brasil)", labelKey: "locale.current.pt-BR" },
  { code: "en", flagSrc: "assets/ui/flags/en.svg", flagAlt: "English", labelKey: "locale.current.en" },
  { code: "de", flagSrc: "assets/ui/flags/de.svg", flagAlt: "Deutsch", labelKey: "locale.current.de" }
];

const TUTORIAL_WELCOME_COPY = {
  "pt-BR": {
    ariaLabel: "Bem-vindo ao Tibia Toolkit",
    title: "Bem-vindo ao",
    lead: 'Essa é a <strong>ferramenta definitiva</strong> do jogador Tibiano.',
    paragraphOne: "Aqui você encontra preços de market atualizados, descrição de itens, NPCs, bosses e várias ferramentas para ajudar na sua hunt diária.",
    paragraphTwo: "Escolha o idioma se quiser e clique no botão abaixo para fazer um tour rápido pelo app.",
    cancelTooltip: "Cancelar",
    cancelAria: "Cancelar tutorial",
    startTooltip: "Começar",
    startAria: "Começar tutorial"
  },
  en: {
    ariaLabel: "Welcome to Tibia Toolkit",
    title: "Welcome to",
    lead: 'This is the <strong>ultimate tool</strong> for Tibian players.',
    paragraphOne: "Here you will find updated market prices, item descriptions, NPCs, bosses and several tools to help with your daily hunt.",
    paragraphTwo: "Choose your language if you want and click the button below for a quick tour of the app.",
    cancelTooltip: "Cancel",
    cancelAria: "Cancel tutorial",
    startTooltip: "Start",
    startAria: "Start tutorial"
  },
  de: {
    ariaLabel: "Willkommen bei Tibia Toolkit",
    title: "Willkommen bei",
    lead: 'Das ist das <strong>ultimative Tool</strong> für Tibia-Spieler.',
    paragraphOne: "Hier findest du aktuelle Marktpreise, Item-Beschreibungen, NPCs, Bosse und mehrere Tools für deine tägliche Hunt.",
    paragraphTwo: "Wähle bei Bedarf deine Sprache und starte unten eine kurze Tour durch die App.",
    cancelTooltip: "Abbrechen",
    cancelAria: "Tutorial abbrechen",
    startTooltip: "Starten",
    startAria: "Tutorial starten"
  }
};

const TUTORIAL_ACTION_COPY = {
  "pt-BR": {
    next: "Continuar",
    done: "Finalizar",
    cancel: "Sair do tutorial"
  },
  en: {
    next: "Continue",
    done: "Finish",
    cancel: "Exit tutorial"
  },
  de: {
    next: "Weiter",
    done: "Fertig",
    cancel: "Tutorial beenden"
  }
};

const TUTORIAL_CONFIRMATION_COPY = {
  "pt-BR": {
    title: "Iniciar tutorial",
    contextTooltip: "Como usar",
    message: "Deseja iniciar o tutorial desta tela?",
    resetTitle: "Reiniciar tutoriais",
    resetMessage: "Deseja reiniciar todos os tutoriais do aplicativo?",
    cancelTooltip: "Cancelar",
    cancelAria: "Cancelar",
    confirmTooltip: "Comecar",
    confirmAria: "Comecar tutorial"
  },
  en: {
    title: "Start tutorial",
    contextTooltip: "How to use",
    message: "Do you want to start this screen tutorial?",
    resetTitle: "Restart tutorials",
    resetMessage: "Do you want to restart all app tutorials?",
    cancelTooltip: "Cancel",
    cancelAria: "Cancel",
    confirmTooltip: "Start",
    confirmAria: "Start tutorial"
  },
  de: {
    title: "Tutorial starten",
    contextTooltip: "So verwendest du es",
    message: "Moechtest du das Tutorial dieser Ansicht starten?",
    resetTitle: "Tutorials neu starten",
    resetMessage: "Moechtest du alle App-Tutorials neu starten?",
    cancelTooltip: "Abbrechen",
    cancelAria: "Abbrechen",
    confirmTooltip: "Starten",
    confirmAria: "Tutorial starten"
  }
};

// Every route uses durable first-visit state. Manual question buttons bypass
// this gate, while Settings can clear all keys and start the welcome flow again.
const TUTORIAL_ROUTE_CONFIG = Object.freeze({
  "item-prices": {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:item-prices:seen"
  },
  stash: {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:stash:seen"
  },
  tools: {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:tools:seen"
  },
  analyzer: {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:analyzer:seen"
  },
  "solo-analyzer": {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:solo-analyzer:seen"
  },
  "party-finder": {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:party-finder:seen"
  },
  "skill-calculator": {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:skill-calculator:seen"
  },
  npcs: {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:npcs:seen"
  },
  bestiary: {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:bestiary:seen"
  },
  bosstiary: {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:bosstiary:seen"
  },
  "tibia-mirror": {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:tibia-mirror:seen"
  },
  "tibia-mirror-intro": {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:tibia-mirror:intro:seen"
  },
  "sqm-finder": {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:sqm-finder:seen"
  },
  alerts: {
    launchPolicy: "first-visit",
    firstVisitStorageKey: "tibia-tools:tutorial:v2:alerts:seen"
  }
});

const TUTORIAL_STEP_META = [
  {
    selector: '[data-section="item-prices"]',
    gif: TUTORIAL_ASSETS.market,
    before: async () => {
      getTutorialApi()?.switchSection?.("item-prices");
      await getTutorialApi()?.setItemViewMode?.("list");
      await wait(180);
    }
  },
  {
    selector: "#item-slug-input",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.switchSection?.("item-prices");
      await getTutorialApi()?.setItemViewMode?.("list");
      await typeSearchText("Plate armor");
      await wait(220);
    }
  },
  {
    selector: "#item-suggestions",
    placement: "bottom",
    before: async () => {
      await getTutorialApi()?.typeItemSearch?.("Plate armor");
      await wait(250);
    }
  },
  {
    selector: ".item-summary-card",
    gif: TUTORIAL_ASSETS.itemStatus,
    before: async () => {
      await getTutorialApi()?.setItemViewMode?.("list");
      await getTutorialApi()?.selectItemByName?.("Plate Armor");
      getTutorialApi()?.scrollToSelector?.(".item-summary-card", "center");
      await wait(620);
    }
  },
  {
    selector: "#item-price-spotlight-grid",
    placement: "top-right",
    gif: TUTORIAL_ASSETS.market,
    before: async () => {
      await getTutorialApi()?.setItemViewMode?.("list");
      getTutorialApi()?.scrollToSelector?.("#item-price-spotlight-grid", "center");
      await wait(280);
    }
  },
  {
    selector: "#global-world-input",
    gif: TUTORIAL_ASSETS.worldList,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#global-world-input", "start");
      await wait(220);
    }
  },
  {
    selector: ".desktop-opacity-control",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.invisible,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#desktop-toolbar", "start");
      await wait(220);
    }
  },
  {
    selector: "#desktop-toolbar-brand",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.update,
    simulateUpdate: true,
    textByLocale: {
      "pt-BR": "Quando uma nova atualização estiver disponível, este ícone aparecerá. Basta clicar para começar a baixar a nova versão.",
      en: "When a new update is available, this icon will appear. Just click it to start downloading the new version.",
      de: "Wenn ein neues Update verfügbar ist, erscheint dieses Symbol. Klicke darauf, um die neue Version herunterzuladen."
    },
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#desktop-toolbar", "start");
      await wait(220);
    }
  },
  {
    selector: "#desktop-coffee-button",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.coffee,
    popoverHeight: 500,
    requiresCoffee: true,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#desktop-toolbar", "start");
      await wait(220);
    }
  },
  {
    selector: "#desktop-supporters-button",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.supporters,
    gifNatural: true,
    popoverHeight: 420,
    requiresSupporters: true,
    before: async () => {
      await window.desktopApi?.app?.tutorial?.ensureWide?.();
      await wait(180);
    }
  },
  {
    selector: ".docked-supporter-card:first-child",
    placement: "left",
    hideGif: true,
    longCopy: true,
    popoverHeight: 290,
    requiresSupporters: true,
    before: async () => {
      await window.desktopApi?.app?.tutorial?.restoreWindowBounds?.();
      await getTutorialApi()?.openSupportersTutorialPanel?.();
      await wait(300);
    }
  },
  {
    selector: ".docked-supporters-content",
    placement: "left",
    gif: TUTORIAL_ASSETS.supportersThanks,
    gifNatural: true,
    popoverHeight: 420,
    requiresSupporters: true,
    done: true,
    before: async () => {
      await wait(80);
    }
  }
];

const TUTORIAL_STASH_STEP_META = [
  {
    selector: '[data-item-view="stash"]',
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.switchSection?.("item-prices");
      await getTutorialApi()?.setItemViewMode?.("stash");
      await wait(0);
    }
  },
  {
    selector: "#item-stash-view",
    before: async () => {
      await getTutorialApi()?.setItemViewMode?.("stash");
      getTutorialApi()?.scrollToSelector?.("#item-stash-view", "start");
      await wait(100);
    }
  },
  {
    selector: "#stash-trader-filter",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.setItemViewMode?.("stash");
      getTutorialApi()?.setStashQuery?.("");
      getTutorialApi()?.scrollToSelector?.(".stash-toolbar", "start");
      await wait(90);
    }
  },
  {
    selector: "#stash-category-filter",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.setItemViewMode?.("stash");
      getTutorialApi()?.scrollToSelector?.(".stash-toolbar", "start");
      await wait(90);
    }
  },
  {
    selector: "#stash-sort-filter",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.setItemViewMode?.("stash");
      getTutorialApi()?.scrollToSelector?.(".stash-toolbar", "start");
      await wait(90);
    }
  },
  {
    selector: ".stash-item.value-legendary, .stash-item.value-epic, .stash-item.value-rare, #stash-grid",
    before: async () => {
      await getTutorialApi()?.setItemViewMode?.("stash");
      getTutorialApi()?.setStashValueMode?.("npc");
      getTutorialApi()?.setStashSort?.("npc-high");
      await wait(140);
      getTutorialApi()?.scrollToSelector?.(".stash-item.value-legendary, .stash-item.value-epic, .stash-item.value-rare, #stash-grid", "center");
      await wait(120);
    }
  },
  {
    selector: "#stash-value-switch",
    placement: "top-center",
    gif: TUTORIAL_ASSETS.npcMarket,
    before: async () => {
      await getTutorialApi()?.setItemViewMode?.("stash");
      getTutorialApi()?.scrollToSelector?.("#stash-value-switch", "center");
      await wait(110);
    }
  },
  {
    selector: ".stash-item.value-legendary, .stash-item.value-epic, .stash-item.value-rare, #stash-grid",
    gif: TUTORIAL_ASSETS.itemStatus,
    done: true,
    before: async () => {
      await getTutorialApi()?.setItemViewMode?.("stash");
      getTutorialApi()?.setStashSort?.("npc-high");
      await wait(130);
      getTutorialApi()?.scrollToSelector?.(".stash-item.value-legendary, .stash-item.value-epic, .stash-item.value-rare, #stash-grid", "center");
      await wait(110);
    }
  }
];

const TUTORIAL_TOOLS_STEP_META = [
  {
    selector: '[data-section="tools"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.tools,
    before: async () => {
      getTutorialApi()?.switchSection?.("tools");
      getTutorialApi()?.setToolTab?.("imbuement");
      await wait(120);
    }
  },
  {
    selector: '[data-tool-tab="imbuement"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.imbuement,
    before: async () => {
      getTutorialApi()?.setToolTab?.("imbuement");
      await wait(90);
    }
  },
  {
    selector: "#imbuement-tier-switch",
    placement: "bottom",
    before: async () => {
      await runImbuementTierDemo();
    }
  },
  {
    selector: "#imbuement-currency-switch",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.configureImbuementTour?.({
        toolTab: "imbuement",
        tier: "powerful",
        currency: "gold",
        pickerOpen: false,
        manualIngredientsEnabled: false,
        mixedPurchaseEnabled: false
      });
      await wait(90);
    }
  },
  {
    selector: "#imbuement-picker-panel",
    placement: "top-center",
    before: async () => {
      getTutorialApi()?.configureImbuementTour?.({
        toolTab: "imbuement",
        pickerOpen: true,
        currency: "gold"
      });
      await wait(110);
    }
  },
  {
    selector: "#ingredient-token-panel",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.configureImbuementTour?.({
        toolTab: "imbuement",
        pickerOpen: false,
        currency: "gold",
        manualIngredientsEnabled: true,
        mixedPurchaseEnabled: false
      });
      await wait(110);
    }
  },
  {
    selector: "#imbuement-mixed-route-panel",
    placement: "top-center",
    before: async () => {
      getTutorialApi()?.configureImbuementTour?.({
        toolTab: "imbuement",
        pickerOpen: false,
        currency: "gold",
        manualIngredientsEnabled: false,
        mixedPurchaseEnabled: true
      });
      await wait(120);
    }
  },
  {
    selector: ".tool-stat-grid",
    placement: "top-center",
    before: async () => {
      getTutorialApi()?.configureImbuementTour?.({
        toolTab: "imbuement",
        includeShrineFee: true,
        marketPriceMode: "buy",
        mixedPurchaseEnabled: true
      });
      getTutorialApi()?.scrollToSelector?.(".tool-stat-grid", "center");
      await wait(120);
    }
  },
  {
    selector: ".imbuement-ingredients-card",
    placement: "top",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.(".imbuement-ingredients-card", "center");
      await wait(120);
    }
  },
  {
    selector: "#imbuement-ingredients .imbuement-route-icon",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#imbuement-ingredients .imbuement-route-icon", "center");
      await wait(100);
    }
  },
  {
    selector: "#imbuement-ingredients [data-imbuement-copy-name]",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#imbuement-ingredients [data-imbuement-copy-name]", "center");
      await wait(100);
    }
  },
  {
    selector: "#imbuement-ingredients .imbuement-row .imbuement-details",
    placement: "top",
    done: true,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#imbuement-ingredients .imbuement-row .imbuement-details", "center");
      await wait(100);
    }
  }
];

const TUTORIAL_ANALYZER_STEP_META = [
  {
    selector: '[data-tool-tab="loot-splitter"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.analyzer,
    before: async () => {
      getTutorialApi()?.setToolTab?.("loot-splitter");
      getTutorialApi()?.configureLootAnalyzerTour?.({ mode: "party" });
      await wait(110);
    }
  },
  {
    selector: '[data-loot-mode="party"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.partyHunt,
    before: async () => {
      getTutorialApi()?.configureLootAnalyzerTour?.({ mode: "party" });
      await wait(90);
    }
  },
  {
    selector: ".loot-input-field",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.analyzerHelp,
    before: async () => {
      getTutorialApi()?.configureLootAnalyzerTour?.({ mode: "party", text: "" });
      getTutorialApi()?.scrollToSelector?.(".loot-input-field", "center");
      await wait(100);
    }
  },
  {
    selector: "#loot-feedback",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.configureLootAnalyzerTour?.({
        mode: "party",
        text: PARTY_ANALYZER_TUTORIAL_SAMPLE
      });
      getTutorialApi()?.scrollToSelector?.("#loot-feedback", "center");
      await wait(240);
    }
  },
  {
    selector: ".loot-session-card",
    placement: "top-center",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.(".loot-session-card", "center");
      await wait(100);
    }
  },
  {
    selector: "#loot-output-card",
    placement: "top-center",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#loot-output-card", "center");
      await wait(100);
    }
  },
  {
    selector: "#loot-output .loot-output-copy-icon",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#loot-output .loot-output-copy-icon", "center");
      await wait(100);
    }
  },
  {
    selector: "#loot-player-grid .loot-player-card",
    placement: "top-center",
    done: true,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#loot-player-grid .loot-player-card", "center");
      await wait(100);
    }
  }
];

const TUTORIAL_SOLO_ANALYZER_STEP_META = [
  {
    selector: '[data-loot-mode="solo"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.soloHunt,
    popoverDelayMs: 140,
    before: async () => {
      getTutorialApi()?.configureLootAnalyzerTour?.({ mode: "solo" });
      await wait(100);
    }
  },
  {
    selector: "#loot-character-field",
    placement: "bottom",
    popoverDelayMs: 140,
    before: async () => {
      getTutorialApi()?.configureLootAnalyzerTour?.({ mode: "solo", characterName: "Poioso" });
      await wait(100);
    }
  },
  {
    selector: "#loot-mode-panel",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.configureLootAnalyzerTour?.({ mode: "solo", characterName: "Poioso" });
      await wait(100);
    }
  },
  {
    selector: ".loot-input-field",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.soloAnalyzerHelp,
    before: async () => {
      getTutorialApi()?.configureLootAnalyzerTour?.({
        mode: "solo",
        characterName: "Poioso",
        text: SOLO_ANALYZER_TUTORIAL_SAMPLE
      });
      getTutorialApi()?.scrollToSelector?.(".loot-input-field", "center");
      await wait(220);
    }
  },
  {
    selector: ".loot-session-card",
    placement: "top-center",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.(".loot-session-card", "center");
      await wait(100);
    }
  },
  {
    selector: "#loot-player-grid .loot-player-card",
    placement: "top-center",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#loot-player-grid .loot-player-card", "center");
      await wait(100);
    }
  },
  {
    selector: "#loot-monsters-grid .loot-item-tile",
    placement: "top-center",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#loot-monsters-grid .loot-item-tile", "center");
      await wait(100);
    }
  },
  {
    selector: "#loot-items-grid .loot-item-tile",
    placement: "top-center",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#loot-items-grid .loot-item-tile", "center");
      await wait(100);
    }
  },
  {
    selector: "#tt-solo-events-focus",
    placement: "top-center",
    done: true,
    before: async () => {
      await window.desktopApi?.app?.tutorial?.ensureWide?.();
      getTutorialApi()?.prepareSoloAnalyzerEventsTutorial?.();
      await wait(150);
    }
  }
];

const TUTORIAL_PARTY_FINDER_STEP_META = [
  {
    selector: '[data-tool-tab="find-party"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.partyFinder,
    gifNatural: true,
    popoverHeight: 380,
    before: async () => {
      getTutorialApi()?.configureFindPartyTour?.({ sortMode: "level", sortDirection: "desc" });
      await wait(120);
    }
  },
  {
    selector: ".find-party-vocation-grid",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.partyHunt,
    before: async () => {
      getTutorialApi()?.configureFindPartyTour?.({ vocation: "druid" });
      await wait(100);
    }
  },
  {
    selector: "#find-party-character-input",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.configureFindPartyTour?.({ characterName: "Poioso" });
      await wait(100);
    }
  },
  {
    selector: "#find-party-guild-control",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.configureFindPartyTour?.({ selectFirstGuilds: true });
      await wait(100);
    }
  },
  {
    selector: "#find-party-clear-button",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#find-party-clear-button", "center");
      await wait(90);
    }
  },
  {
    selector: "#find-party-level-range",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#find-party-level-range", "center");
      await wait(90);
    }
  },
  {
    selector: "#find-party-results .find-party-result-card",
    placement: "top-center",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#find-party-results .find-party-result-card", "center");
      await wait(100);
    }
  },
  {
    selector: "#find-party-results [data-find-party-copy-name]",
    placement: "top-center",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#find-party-results [data-find-party-copy-name]", "center");
      await wait(100);
    }
  },
  {
    selector: ".find-party-results-filter-row",
    placement: "top-center",
    done: true,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.(".find-party-results-filter-row", "center");
      await wait(100);
    }
  }
];

const TUTORIAL_SKILL_CALCULATOR_STEP_META = [
  {
    selector: '[data-tool-tab="skill-calculator"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.skillCalculator,
    before: async () => {
      getTutorialApi()?.configureSkillCalculatorTour?.({ type: "sword", vocation: "knight", current: 80, target: 90 });
      await wait(120);
    }
  },
  {
    selector: ".skill-choice-grid",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.skillDummy,
    before: async () => {
      getTutorialApi()?.configureSkillCalculatorTour?.({ type: "sword" });
      await wait(100);
    }
  },
  {
    selector: ".skill-vocation-grid",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.configureSkillCalculatorTour?.({ vocation: "knight" });
      await wait(100);
    }
  },
  {
    selector: ".skill-form-grid",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      getTutorialApi()?.configureSkillCalculatorTour?.({ current: 80, target: 90 });
      await wait(100);
    }
  },
  {
    selector: "#skill-remaining-field",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#skill-remaining-field", "center");
      await wait(90);
    }
  },
  {
    selector: "#skill-loyalty-field",
    placement: "bottom",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#skill-loyalty-field", "center");
      await wait(90);
    }
  },
  {
    selector: ".skill-bonus-grid.tt-tutorial-compact-focus",
    placement: "top-center",
    gif: TUTORIAL_ASSETS.skillBonus,
    before: async () => {
      document.querySelector(".skill-bonus-grid")?.classList.add("tt-tutorial-compact-focus");
      getTutorialApi()?.scrollToSelector?.(".skill-bonus-grid", "center");
      await wait(100);
    }
  },
  {
    selector: "#skill-summary-grid .skill-route-grid",
    placement: "top-center",
    gif: TUTORIAL_ASSETS.market,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#skill-summary-grid .skill-route-grid", "center");
      await wait(100);
    }
  },
  {
    selector: "#skill-summary-grid .skill-best-badge",
    placement: "top-center",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#skill-summary-grid .skill-best-badge", "center");
      await wait(90);
    }
  },
  {
    selector: "#skill-summary-grid .skill-outcome-block:first-child",
    placement: "top-center",
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#skill-summary-grid .skill-outcome-block:first-child", "center");
      await wait(100);
    }
  },
  {
    selector: "#skill-summary-grid .skill-outcome-block:nth-child(2)",
    placement: "top-center",
    done: true,
    before: async () => {
      getTutorialApi()?.scrollToSelector?.("#skill-summary-grid .skill-outcome-block:nth-child(2)", "center");
      await wait(100);
    }
  }
];

const TUTORIAL_TIBIA_MIRROR_STEP_META = [
  {
    selector: "#empty-state",
    // Prefer above the profile fields; main.js falls back automatically when
    // that side has no room on the current display.
    placement: "top",
    gif: TUTORIAL_ASSETS.default,
    popoverHeight: 400,
    before: async () => {
      getTutorialApi()?.setToolTab?.("screen-vision");
      getTibiaMirrorTutorialApi()?.startProfileDemo?.();
      getTibiaMirrorTutorialApi()?.fillProfileDemo?.("Painel do Knight", "Poioso");
      await wait(150);
    }
  },
  {
    selector: "#settings-button",
    placement: "left",
    before: async () => {
      getTibiaMirrorTutorialApi()?.commitProfileDemo?.();
      await wait(120);
    }
  },
  {
    selector: `[data-profile-card-path="__tibia_mirror_tutorial_profile__"]`,
    placement: "left",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.openProfilesPanel?.();
      await wait(320);
    }
  },
  {
    selector: '[data-docked-action="create-profile"]',
    placement: "left",
    before: async () => {
      await wait(80);
    }
  },
  {
    selector: '[data-docked-action="export-profile"]',
    placement: "left",
    before: async () => {
      await wait(80);
    }
  },
  {
    selector: '[data-docked-action="import-profile"]',
    placement: "left",
    before: async () => {
      await wait(80);
    }
  },
  {
    selector: "#tt-mirror-create-focus",
    placement: "top-center",
    before: async () => {
      await getTibiaMirrorTutorialApi()?.closeProfilesPanel?.();
      getTibiaMirrorTutorialApi()?.createFocus?.("tt-mirror-create-focus", ["#add-region-button", "#crop-tool-button"]);
      await wait(180);
    }
  },
  {
    selector: "#grid-overlay-button",
    placement: "bottom",
    before: async () => {
      await getTibiaMirrorTutorialApi()?.showGridDemo?.();
      await wait(120);
    }
  },
  {
    selector: "#obs-mirror-button",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.obs,
    done: true,
    before: async () => {
      await wait(100);
    }
  }
];

// This introduction must remain independent from the Tibia window state. The
// practical profile/mirror walkthrough below starts only after Tibia is ready.
const TUTORIAL_TIBIA_MIRROR_INTRO_STEP_META = [
  {
    selector: '[data-tool-tab="screen-vision"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.tibiaMirror,
    gifNatural: true,
    longCopy: true,
    popoverHeight: 590,
    done: true,
    before: async () => {
      getTutorialApi()?.setToolTab?.("screen-vision");
      await wait(120);
    }
  }
];

const TUTORIAL_SQM_FINDER_STEP_META = [
  {
    selector: '[data-docked-action="sqm-toggle-marker"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.sqmFinder,
    gifNatural: true,
    popoverHeight: 400,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.startSqmFinderDemo?.();
      await window.desktopApi?.app?.tutorial?.prepareDockedPanel?.("sqm-finder-panel");
      await getTibiaMirrorTutorialApi()?.setSqmFinderDemoStage?.("intro");
      await wait(320);
    }
  },
  {
    selector: '[data-docked-action="sqm-toggle-marker"]',
    placement: "left",
    hideGif: true,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setSqmFinderDemoStage?.("marker");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-action="sqm-cycle-shape"]',
    placement: "left",
    hideGif: true,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setSqmFinderDemoStage?.("shape");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-field="sqm-charLocSize"]',
    placement: "left",
    hideGif: true,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setSqmFinderDemoStage?.("size");
      await wait(140);
    }
  },
  {
    selector: '[data-docked-field="sqm-charLocIntensity"]',
    placement: "left",
    hideGif: true,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setSqmFinderDemoStage?.("intensity");
      await wait(140);
    }
  },
  {
    selector: '[data-sqm-card="marker"] .docked-sqm-color-row',
    placement: "left",
    hideGif: true,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setSqmFinderDemoStage?.("color");
      await wait(140);
    }
  },
  {
    selector: '[data-docked-action="sqm-toggle-cursor-glow"]',
    placement: "left",
    hideGif: true,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setSqmFinderDemoStage?.("cursor");
      await wait(120);
    }
  },
  {
    selector: '[data-sqm-card="cursor"]',
    placement: "left",
    hideGif: true,
    done: true,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setSqmFinderDemoStage?.("cursor-editor");
      await wait(120);
    }
  }
];

const TUTORIAL_NPCS_STEP_META = [
  {
    selector: '[data-section="npcs"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.npcsCreatures,
    gifNatural: true,
    popoverHeight: 420,
    before: async () => {
      await getTutorialApi()?.configureNpcCatalogTour?.();
      await wait(160);
    }
  },
  {
    selector: "#npc-search-input",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.configureNpcCatalogTour?.();
      await wait(120);
    }
  },
  {
    selector: "#npc-job-filter",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.configureNpcCatalogTour?.({ job: "Comerciante", focusJob: true });
      await wait(120);
    }
  },
  {
    selector: "#npc-city-filter",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.configureNpcCatalogTour?.({
        job: "Comerciante",
        city: "Southern Darama",
        trade: "yes"
      });
      await wait(120);
    }
  },
  {
    selector: "#npc-list-panel",
    placement: "right",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.configureNpcCatalogTour?.({
        job: "Comerciante",
        trade: "yes"
      });
      await wait(120);
    }
  },
  {
    selector: "#entity-detail-content",
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureNpcCatalogTour?.({ openYaman: true });
      await wait(280);
    }
  },
  {
    selector: '#entity-detail-content [data-boss-inline-map-panel]:not(.hidden)',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureNpcCatalogTour?.({ openYaman: true, openMap: true });
      await wait(260);
    }
  },
  {
    selector: "#entity-detail-content .npc-trade-grid",
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    gifNatural: true,
    popoverHeight: 400,
    before: async () => {
      getTutorialApi()?.closeNpcCatalogTourMap?.();
      await getTutorialApi()?.configureNpcCatalogTour?.({ openYaman: true });
      await wait(180);
    }
  },
  {
    selector: '#entity-detail-content [data-external-url]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    done: true,
    before: async () => {
      await getTutorialApi()?.configureNpcCatalogTour?.({ openYaman: true });
      await wait(160);
    }
  }
];

const TUTORIAL_BESTIARY_STEP_META = [
  {
    selector: '[data-entity-view="monsters"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.bestiary,
    gifNatural: true,
    popoverHeight: 420,
    before: async () => {
      await getTutorialApi()?.configureBestiaryTour?.();
      await wait(180);
    }
  },
  {
    selector: "#monster-search-input",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureBestiaryTour?.();
      await wait(120);
    }
  },
  {
    selector: "#monster-weakness-filter .weakness-filter-menu:not(.hidden)",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.configureBestiaryTour?.({ weaknessMenuOpen: true });
      await wait(120);
    }
  },
  {
    selector: "#monster-category-grid",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.configureBestiaryTour?.({ weaknessMenuOpen: false });
      await wait(120);
    }
  },
  {
    selector: "#monster-list-panel",
    placement: "right",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureBestiaryTour?.({ category: "vermes" });
      await wait(150);
    }
  },
  {
    selector: '[data-tutorial-focus="creature-summary"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureBestiaryTour?.({ category: "vermes", openCreature: "Afflicted Strider" });
      await wait(280);
    }
  },
  {
    selector: ".creature-loot-section",
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureBestiaryTour?.({ category: "vermes", openCreature: "Afflicted Strider", scrollTo: ".creature-loot-section" });
      await wait(220);
    }
  },
  {
    selector: "[data-creature-gear-shell]",
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureBestiaryTour?.({ category: "vermes", openCreature: "Afflicted Strider", scrollTo: "[data-creature-gear-shell]" });
      await wait(220);
    }
  },
  {
    selector: "[data-creature-gear-weapon-style]",
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    done: true,
    before: async () => {
      await getTutorialApi()?.configureBestiaryTour?.({ category: "vermes", openCreature: "Afflicted Strider", scrollTo: "[data-creature-gear-shell]" });
      await wait(220);
    }
  }
];

const TUTORIAL_BOSSTIARY_STEP_META = [
  {
    selector: '[data-entity-view="bosses"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.bosstiary,
    gifNatural: true,
    popoverHeight: 420,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.();
      await wait(180);
    }
  },
  {
    selector: "#boss-search-input",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.();
      await wait(120);
    }
  },
  {
    selector: ".boss-filter-group",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    supplementalImages: TUTORIAL_ASSETS.bossCategoryIcons,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.();
      await wait(120);
    }
  },
  {
    selector: "#boss-weakness-filter .weakness-filter-menu:not(.hidden)",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.({ weaknessMenuOpen: true });
      await wait(120);
    }
  },
  {
    selector: "#boss-list-panel",
    placement: "right",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.({ weaknessMenuOpen: false });
      await wait(150);
    }
  },
  {
    selector: '[data-tutorial-focus="creature-summary"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.({ openBoss: "Yaga the Crone" });
      await wait(280);
    }
  },
  {
    selector: '[data-tutorial-focus="boss-extra-details"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.({ openBoss: "Yaga the Crone" });
      await wait(220);
    }
  },
  {
    selector: '#entity-detail-content [data-boss-inline-map-panel]:not(.hidden)',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.({ openBoss: "Yaga the Crone", openMap: "location" });
      await wait(300);
    }
  },
  {
    selector: '#entity-detail-content [data-boss-inline-map-panel]:not(.hidden)',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.({ openBoss: "Yaga the Crone", openMap: "route" });
      await wait(300);
    }
  },
  {
    selector: ".creature-loot-section",
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      getTutorialApi()?.closeBossiaryTourMap?.();
      await getTutorialApi()?.configureBossiaryTour?.({ openBoss: "Yaga the Crone", scrollTo: ".creature-loot-section" });
      await wait(220);
    }
  },
  {
    selector: '[data-tutorial-focus="boss-statistics"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.({ openBoss: "Yaga the Crone", scrollTo: '[data-tutorial-focus="boss-statistics"]' });
      await wait(360);
    }
  },
  {
    selector: ".boss-chart-card",
    placement: "left",
    gif: TUTORIAL_ASSETS.list,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.({ openBoss: "Yaga the Crone", scrollTo: ".boss-chart-card" });
      await wait(360);
    }
  },
  {
    selector: '[data-tutorial-focus="boss-history"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    gifNatural: true,
    popoverHeight: 400,
    before: async () => {
      await getTutorialApi()?.configureBossiaryTour?.({ openBoss: "Yaga the Crone", scrollTo: '[data-tutorial-focus="boss-history"]' });
      await wait(360);
    }
  }
];

const TUTORIAL_ALERTS_STEP_META = [
  {
    selector: "#open-alertas-button",
    placement: "bottom",
    gif: TUTORIAL_ASSETS.alerts,
    gifNatural: true,
    popoverHeight: 410,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.startAlertDemo?.();
      await window.desktopApi?.app?.tutorial?.prepareDockedPanel?.("alertas-panel");
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("intro");
      await wait(320);
    }
  },
  {
    selector: '[data-docked-action="toggle-alerts-global"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("global-sound");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-action="toggle-alerts-view"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("magic-panel");
      await wait(120);
    }
  },
  {
    selector: '[data-alert-tutorial-focus="magic-vocations"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("magic-vocation");
      await wait(120);
    }
  },
  {
    selector: '[data-alert-magic-category="cura"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("magic-healing");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-action="create-alert-spell-blank"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("magic-create");
      await wait(120);
    }
  },
  {
    selector: '[data-alert-timer-id="__tibia_alert_tutorial__"] .docked-alert-card-title-row, [data-alert-timer-id="__tibia_alert_tutorial__"] [data-docked-action="toggle-alert-config"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("select-utura");
      await wait(140);
    }
  },
  {
    selector: '[data-docked-field="timerDurationSeconds"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.waiting,
    gifNatural: true,
    popoverHeight: 380,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("cooldown");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-hotkey-capture="true"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("hotkey");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-action="toggle-alert-retrigger"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("retrigger");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-action="toggle-alert-reminder"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("reminder");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-action="toggle-alert-sound"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("sound");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-action="pick-alert-sound-custom"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("sound-custom");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-field="timerVolumePercent"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("card-volume");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-field="globalVolumePercent"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("global-volume");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-action="toggle-alerts-visual-global"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("global-visual");
      await wait(120);
    }
  },
  {
    selector: '[data-alert-tutorial-focus="visual-toggle"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("visual-card");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-action="toggle-alert-lock"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "left",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("visual-lock");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-action="toggle-alert-lock"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "right",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("visual-preview");
      await wait(150);
    }
  },
  {
    selector: '[data-docked-field="timerMessage"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("visual-message");
      await wait(120);
    }
  },
  {
    selector: '[data-docked-field="timerAlertDurationSeconds"][data-timer-id="__tibia_alert_tutorial__"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("visual-duration");
      await wait(120);
    }
  },
  {
    selector: '[data-alert-tutorial-focus="visual-fonts"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.default,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("visual-fonts");
      await wait(120);
    }
  },
  {
    selector: '[data-alert-tutorial-focus="visual-style"]',
    placement: "bottom",
    gif: TUTORIAL_ASSETS.default,
    done: true,
    before: async () => {
      await getTibiaMirrorTutorialApi()?.setAlertDemoStage?.("visual-style");
      await wait(120);
    }
  }
];

const TUTORIAL_STEP_COPY = {
  "pt-BR": [
    {
      text: "Essa é a área de preços dos itens. Aqui você consulta itens do jogo, valores de NPC, ofertas de market e informações úteis para decidir compra, venda ou loot."
    },
    {
      text: "Digite aqui o nome do item que você quer consultar."
    },
    {
      text: "O item digitado aparece neste menu. Clique no resultado para abrir a ficha completa."
    },
    {
      text: "Aqui fica a ficha do item, com imagem, categoria, notas, informações de uso e criaturas que podem dropar esse item."
    },
    {
      text: "Essa é uma das partes mais importantes: Sell offer atual mostra o menor valor de venda no market, e Buy offer atual mostra a maior oferta de compra."
    },
    {
      text: "Aqui em cima você seleciona o mundo usado pelo Tibia Toolkit. Esse mundo vale para todas as ferramentas do aplicativo."
    },
    {
      text: "Essa é a barra de opacidade. Aqui você controla a visibilidade da tela do Tibia Toolkit."
    },
    {
      text: "O Tibia Toolkit é um aplicativo Always Free, e você pode usar enquanto existirmos. Mas recursos online têm custos de manutenção e VPS.",
      html: 'O Tibia Toolkit é um aplicativo <strong>Always Free</strong>, e você pode usar enquanto existirmos.<br><br>Mas recursos online têm custos de manutenção e servidores VPS.<br><br>Se o app estiver sendo útil para você, dá uma olhada nesse botão e paga um cafezinho para nós.'
    },
    {
      text: "Se você fizer sua doação, o nome do seu char virá para o Hall de apoiadores e poderá ser acessado clicando aqui."
    },
    {
      html: 'Se sua doação estiver entre as 5 maiores, você ficará em destaque com esses painéis personalizados.<br><br><strong>Além disso, você poderá enviar uma imagem ou GIF animado para que ele fique passando em looping aqui nesse painel. Assim outros poderão ver mais sobre você ou o serviço que você oferece.</strong>'
    },
    {
      text: "De antemão já agradecemos seu apoio. Qualquer quantia fortalece o projeto e coloca você neste painel de apoiadores."
    }
  ],
  en: [
    {
      text: "This is the item prices area. Here you can check game items, NPC values, market offers and useful information to decide what to buy, sell or loot."
    },
    {
      text: "Type the name of the item you want to check here."
    },
    {
      text: "The typed item appears in this menu. Click the result to open the full item card."
    },
    {
      text: "This is the item card, with image, category, notes, usage information and creatures that can drop this item."
    },
    {
      text: "This is one of the most important parts: Current sell offer shows the lowest selling price on the market, and Current buy offer shows the highest buying offer."
    },
    {
      text: "Up here you select the world used by Tibia Toolkit. This world is shared by all tools in the app."
    },
    {
      text: "This is the opacity bar. Here you control how visible the Tibia Toolkit window is."
    },
    {
      text: "Tibia Toolkit is an Always Free application, and you can keep using it while we exist. But online resources still have maintenance and VPS costs.",
      html: 'Tibia Toolkit is an <strong>Always Free</strong> application, and you can keep using it while we exist.<br><br>But online resources still have maintenance and VPS server costs.<br><br>If the app has been useful to you, take a look at this button and buy us a coffee.'
    },
    {
      text: "If you make a donation, your character name will be added to the Supporters Hall, which you can access by clicking here."
    },
    {
      html: 'If your donation is among the top 5, you will be highlighted with these personalized panels.<br><br><strong>In addition, you can send an image or animated GIF to loop in this panel, so others can learn more about you or the service you offer.</strong>'
    },
    {
      text: "Thank you in advance for your support. Any amount strengthens the project and places you in this supporters panel."
    }
  ],
  de: [
    {
      text: "Das ist der Bereich für Item-Preise. Hier prüfst du Spiel-Items, NPC-Werte, Marktangebote und nützliche Informationen für Kauf, Verkauf oder Loot."
    },
    {
      text: "Gib hier den Namen des Items ein, das du prüfen möchtest."
    },
    {
      text: "Das eingegebene Item erscheint in diesem Menü. Klicke auf das Ergebnis, um die vollständige Item-Karte zu öffnen."
    },
    {
      text: "Hier siehst du die Item-Karte mit Bild, Kategorie, Notizen, Nutzungsinfos und Kreaturen, die dieses Item droppen können."
    },
    {
      text: "Das ist einer der wichtigsten Bereiche: Aktuelles Sell Offer zeigt den niedrigsten Verkaufspreis im Markt, und Aktuelles Buy Offer zeigt das höchste Kaufangebot."
    },
    {
      text: "Hier oben wählst du die Welt aus, die vom Tibia Toolkit verwendet wird. Diese Welt gilt für alle Tools der App."
    },
    {
      text: "Das ist die Transparenzleiste. Hier steuerst du, wie sichtbar das Tibia-Toolkit-Fenster ist."
    },
    {
      text: "Tibia Toolkit ist eine Always-Free-Anwendung, und du kannst sie nutzen, solange es uns gibt. Online-Ressourcen verursachen aber weiterhin Wartungs- und VPS-Kosten.",
      html: 'Tibia Toolkit ist eine <strong>Always-Free</strong>-Anwendung, und du kannst sie nutzen, solange es uns gibt.<br><br>Online-Ressourcen verursachen aber weiterhin Wartungs- und VPS-Server-Kosten.<br><br>Wenn dir die App hilft, schau dir diesen Button an und spendiere uns einen Kaffee.'
    },
    {
      text: "Wenn du spendest, erscheint der Name deines Chars in der Unterstützer-Halle, die du hier per Klick öffnen kannst."
    },
    {
      html: 'Wenn deine Spende zu den 5 größten gehört, wirst du mit diesen personalisierten Panels hervorgehoben.<br><br><strong>Außerdem kannst du ein Bild oder animiertes GIF senden, das hier in diesem Panel wiederholt wird. So können andere mehr über dich oder deinen Service erfahren.</strong>'
    },
    {
      text: "Vielen Dank im Voraus für deine Unterstützung. Jeder Betrag stärkt das Projekt und bringt dich in dieses Unterstützer-Panel."
    }
  ]
};

const TUTORIAL_STASH_STEP_COPY = {
  "pt-BR": [
    {
      text: "O Stash mostra os itens do jogo em grade, parecido com a visualização do próprio Tibia."
    },
    {
      text: "Aqui você navega pelos itens visualmente, sem precisar digitar o nome primeiro."
    },
    {
      text: "Este filtro limita os itens por NPC comerciante. É útil quando você quer saber o que um trader compra ou vende."
    },
    {
      text: "Este filtro separa os itens por categoria, como armas, armaduras, runas e outros tipos."
    },
    {
      text: "Aqui você muda a ordem dos itens, por nome ou por valor."
    },
    {
      html: 'A borda indica a faixa de valor: <strong class="tt-tour-value-gold">dourado</strong> acima de 1kk, <strong class="tt-tour-value-purple">roxo</strong> de 100k a 1kk, <strong class="tt-tour-value-blue">azul</strong> de 10k a 100k, <strong class="tt-tour-value-green">verde</strong> de 1k a 10k e <strong class="tt-tour-value-white">branco</strong> até 1k. Itens sem borda não têm preço de venda para NPC definido.'
    },
    {
      text: "Aqui você alterna entre valores de NPC e valores de market. Consultas de market podem demorar um pouco dependendo da quantidade de itens."
    },
    {
      text: "Clique em um item do Stash para abrir a ficha completa dele na lista principal.",
      done: true
    }
  ],
  en: [
    {
      text: "Stash shows game items in a grid, similar to Tibia's own stash view."
    },
    {
      text: "Here you can browse items visually without typing the name first."
    },
    {
      text: "This filter limits items by trader NPC. It is useful when you want to see what a trader buys or sells."
    },
    {
      text: "This filter separates items by category, such as weapons, armors, runes and other types."
    },
    {
      text: "Here you change the item order, by name or by value."
    },
    {
      html: 'The border shows the value range: <strong class="tt-tour-value-gold">gold</strong> above 1kk, <strong class="tt-tour-value-purple">purple</strong> from 100k to 1kk, <strong class="tt-tour-value-blue">blue</strong> from 10k to 100k, <strong class="tt-tour-value-green">green</strong> from 1k to 10k and <strong class="tt-tour-value-white">white</strong> up to 1k. Items without a border have no defined NPC sell price.'
    },
    {
      text: "Here you switch between NPC values and market values. Market checks can take a while depending on how many items are being queried."
    },
    {
      text: "Click a Stash item to open its full card in the main list.",
      done: true
    }
  ],
  de: [
    {
      text: "Der Stash zeigt Spiel-Items in einem Raster, ähnlich wie die Stash-Ansicht in Tibia."
    },
    {
      text: "Hier kannst du Items visuell durchsuchen, ohne zuerst einen Namen einzugeben."
    },
    {
      text: "Dieser Filter begrenzt Items nach Händler-NPC. Das ist nützlich, wenn du sehen willst, was ein Trader kauft oder verkauft."
    },
    {
      text: "Dieser Filter trennt Items nach Kategorie, zum Beispiel Waffen, Rüstungen, Runen und andere Typen."
    },
    {
      text: "Hier änderst du die Reihenfolge der Items, nach Name oder Wert."
    },
    {
      html: 'Der Rand zeigt die Wertstufe: <strong class="tt-tour-value-gold">gold</strong> über 1kk, <strong class="tt-tour-value-purple">lila</strong> von 100k bis 1kk, <strong class="tt-tour-value-blue">blau</strong> von 10k bis 100k, <strong class="tt-tour-value-green">grün</strong> von 1k bis 10k und <strong class="tt-tour-value-white">weiß</strong> bis 1k. Items ohne Rand haben keinen definierten NPC-Verkaufspreis.'
    },
    {
      text: "Hier wechselst du zwischen NPC-Werten und Marktwerten. Markt-Abfragen kÃ¶nnen je nach Anzahl der Items etwas dauern."
    },
    {
      text: "Klicke auf ein Item im Stash, um die vollständige Item-Karte in der Hauptliste zu öffnen.",
      done: true
    }
  ]
};

const TUTORIAL_TOOLS_STEP_COPY = {
  "pt-BR": [
    {
      text: "Essa e a nossa aba de Ferramentas. E aqui que voce encontra recursos para otimizar sua organizacao e sua experiencia nas hunts diarias."
    },
    {
      html: "Essa e a <strong>Calculadora de Imbuement</strong>. Uma ferramenta simples para prever o tempo e a quantidade de varinhas de treino, alem de ter uma previa do valor investido."
    },
    {
      text: "Primeiro, selecione o nivel do imbuement que quer pesquisar entre Basic, Intricate e Powerful."
    },
    {
      text: "Aqui voce escolhe em qual moeda deseja ver o valor final: Gold, Gold Token ou Tibia Coins."
    },
    {
      text: "Aqui voce seleciona o imbuement que deseja calcular. Basta abrir o menu e clicar na imagem do imbuement escolhido."
    },
    {
      text: "Se preferir nao usar os valores do TibiToolkit, voce pode informar manualmente o preco de cada ingrediente. O total sera calculado com esses valores."
    },
    {
      text: "Se voce ja possui algum ingrediente, informe a quantidade separadamente. O valor final dos imbuements sera descontado desses itens."
    },
    {
      text: "Aqui fica o resumo do que voce vai desembolsar: materiais via market, taxa do shrine, total via gold e total via Gold Token. A taxa do shrine pode ser desligada no primeiro switch, e os itens do market podem usar preco de venda ou de compra no segundo."
    },
    {
      text: "Por fim, aqui voce ve todos os ingredientes e o valor individual de cada item."
    },
    {
      text: "Este icone mostra que existe uma rota de compra mais vantajosa via market ou Gold Token."
    },
    {
      text: "Aqui voce copia rapidamente o nome do ingrediente."
    },
    {
      text: "Nesta area voce ve o valor total dos ingredientes e pode escolher, item por item, se o calculo usa preco de compra ou de venda.",
      done: true
    }
  ],
  en: [
    {
      text: "This is our Tools tab. Here you will find resources to improve your organization and your daily hunting experience."
    },
    {
      html: "This is the <strong>Imbuement Calculator</strong>. A simple tool to estimate training wand time and quantity, plus a preview of the required investment."
    },
    {
      text: "First, select the imbuement level you want to research: Basic, Intricate or Powerful."
    },
    {
      text: "Here you choose which currency displays the final value: Gold, Gold Token or Tibia Coins."
    },
    {
      text: "Here you select the imbuement you want to calculate. Open the menu and click the image of the chosen imbuement."
    },
    {
      text: "If you prefer not to use TibiToolkit values, you can enter the price of each ingredient manually. The total will be calculated from those values."
    },
    {
      text: "If you already own an ingredient, enter its quantity separately. The imbuement total will discount those items."
    },
    {
      text: "This is the total summary: market materials, shrine fee, total via gold and total via Gold Token. The shrine fee can be disabled in the first switch, and market prices can use selling or buying prices in the second."
    },
    {
      text: "Finally, here you can see every ingredient and the individual value of each item."
    },
    {
      text: "This icon indicates a more advantageous purchase route through market or Gold Token."
    },
    {
      text: "Here you can quickly copy the ingredient name."
    },
    {
      text: "In this area you can see the total ingredient value and choose, item by item, whether the calculation uses buy or sell price.",
      done: true
    }
  ],
  de: [
    {
      text: "Das ist unser Werkzeuge-Tab. Hier findest du Ressourcen, die deine Organisation und deine taegliche Hunt verbessern."
    },
    {
      html: "Das ist der <strong>Imbuement-Rechner</strong>. Ein einfaches Werkzeug, um Trainingsstab-Zeit und Menge sowie die benoetigte Investition zu schaetzen."
    },
    {
      text: "Waehle zuerst die Imbuement-Stufe aus, die du pruefen willst: Basic, Intricate oder Powerful."
    },
    {
      text: "Hier waehlt du die Waehrung fuer den Endwert: Gold, Gold Token oder Tibia Coins."
    },
    {
      text: "Hier waehlt du das Imbuement aus, das du berechnen moechtest. Oeffne das Menue und klicke auf das Bild des gewuenschten Imbuements."
    },
    {
      text: "Wenn du keine TibiToolkit-Werte nutzen moechtest, kannst du den Preis jedes Ingredients manuell eingeben. Der Gesamtwert wird daraus berechnet."
    },
    {
      text: "Wenn du bereits einen Ingredient besitzt, gib seine Menge separat ein. Der Imbuement-Gesamtwert zieht diese Items ab."
    },
    {
      text: "Hier ist die Gesamtuebersicht: Marktmaterialien, Shrine-Gebuehr, Gesamtwert in Gold und Gesamtwert in Gold Token. Die Shrine-Gebuehr kann im ersten Switch deaktiviert werden; im zweiten waehlst du Markt-Verkaufs- oder Kaufpreise."
    },
    {
      text: "Zum Schluss siehst du hier alle Ingredients und den Einzelwert jedes Items."
    },
    {
      text: "Dieses Icon zeigt eine guenstigere Kaufroute ueber Market oder Gold Token an."
    },
    {
      text: "Hier kopierst du den Namen des Ingredients schnell."
    },
    {
      text: "In diesem Bereich siehst du den Gesamtwert der Ingredients und kannst pro Item zwischen Kauf- und Verkaufspreis waehlen.",
      done: true
    }
  ]
};

const TUTORIAL_ANALYZER_STEP_COPY = {
  "pt-BR": [
    {
      text: "Essa e a ferramenta Analyzer. Aqui voce encontra recursos para analisar e otimizar sua hunt."
    },
    {
      text: "Essa e a ferramenta de analise de hunts em Party. Ela mostra a performance de cada personagem e os valores que precisam ser distribuidos entre todos."
    },
    {
      html: 'Primeiro, abra o <strong>Party Hunt Analyzer</strong> no Tibia, clique no menu a direita, em <strong>Copy to Clipboard</strong> e cole o texto nesta caixa.'
    },
    {
      text: "Se houver algum problema com o texto copiado, ele sera descrito aqui. Os jogadores precisam estar no mesmo mundo para o calculo funcionar."
    },
    {
      text: "Aqui voce tem uma visao geral do resumo da sessao: tempo, data, hora, jogadores e o balance geral e por pessoa."
    },
    {
      text: "Aqui existe um resumo do resultado da hunt e dos valores que cada jogador deve pagar ou receber."
    },
    {
      text: "Clique neste botao para copiar o texto completo e enviar ao NPC banqueiro."
    },
    {
      text: "Aqui voce tem um resumo visual de cada jogador: Loot, Supplies, Balance final, dano exercido e o total de vida curada.",
      done: true
    }
  ],
  en: [
    {
      text: "This is the Analyzer tool. Here you will find resources to analyze and optimize your hunt."
    },
    {
      text: "This is the Party Hunt analysis tool. It shows each character's performance and the values that need to be distributed among everyone."
    },
    {
      html: 'First, open the <strong>Party Hunt Analyzer</strong> in Tibia, click the menu on the right, choose <strong>Copy to Clipboard</strong>, then paste the text into this box.'
    },
    {
      text: "If there is a problem with the copied text, it will be described here. Players need to be on the same world for the calculation to work."
    },
    {
      text: "Here you get an overview of the session: time, date, players, total balance and balance per person."
    },
    {
      text: "This is a summary of the hunt result and the values each player must pay or receive."
    },
    {
      text: "Click this button to copy the complete text and send it to the banker NPC."
    },
    {
      text: "Here you get a visual summary for each player: Loot, Supplies, final Balance, damage dealt and total healing.",
      done: true
    }
  ],
  de: [
    {
      text: "Das ist das Analyzer-Werkzeug. Hier findest du Funktionen, um deine Hunt zu analysieren und zu optimieren."
    },
    {
      text: "Das ist das Analysewerkzeug fuer Party Hunts. Es zeigt die Leistung jedes Charakters und die Werte, die unter allen verteilt werden muessen."
    },
    {
      html: 'Oeffne zuerst den <strong>Party Hunt Analyzer</strong> in Tibia, klicke rechts auf das Menue, waehle <strong>Copy to Clipboard</strong> und fuege den Text in dieses Feld ein.'
    },
    {
      text: "Falls es ein Problem mit dem kopierten Text gibt, wird es hier beschrieben. Alle Spieler muessen auf derselben Welt sein, damit die Berechnung funktioniert."
    },
    {
      text: "Hier bekommst du eine Uebersicht der Sitzung: Zeit, Datum, Spieler, Gesamtbalance und Balance pro Person."
    },
    {
      text: "Hier siehst du eine Zusammenfassung des Hunt-Ergebnisses und der Werte, die jeder Spieler zahlen oder erhalten muss."
    },
    {
      text: "Klicke auf diesen Button, um den vollstaendigen Text zu kopieren und an den Banker-NPC zu senden."
    },
    {
      text: "Hier bekommst du fuer jeden Spieler eine visuelle Zusammenfassung: Loot, Supplies, finale Balance, verursachter Schaden und gesamte Heilung.",
      done: true
    }
  ]
};

const TUTORIAL_SOLO_ANALYZER_STEP_COPY = {
  "pt-BR": [
    {
      text: "Este e o Solo Hunt Analyzer, onde voce tera um resumo completo da sua performance, experiencia, lucro, dano, loot e criaturas mortas."
    },
    {
      text: "Primeiramente, coloque aqui o nome do seu personagem."
    },
    {
      text: "Ao ativar este switch, os valores do seu Loot serao convertidos para os valores reais do Mercado do mundo ativo. Deixe no jogo os valores dos itens como valores de NPC ao usar esta opcao."
    },
    {
      html: 'Primeiramente, abra o <strong>Hunt Analyzer</strong> no Tibia, clique no menu a direita, em <strong>Copy to Clipboard</strong>, e cole o texto nesta caixa. Para uma melhor analise, deixe marcada a opcao <strong>Show War XP</strong>.'
    },
    {
      text: "Aqui voce tera uma visao geral do resumo da sessao: tempo, data e hora, XP, Supplies gastos, Balance, dano e cura total."
    },
    {
      text: "Aqui voce tera uma visao grafica de todo o seu loot, os Supplies gastos, Balance geral, dano exercido, quantidade de cura realizada e o resumo da sua experiencia feita."
    },
    {
      text: "Aqui voce tera um resumo de todas as criaturas que derrotou: quantidade, nome, XP individual e o total de XP feito com essa criatura. Clique para abrir a visao detalhada da criatura."
    },
    {
      text: "Aqui voce tera uma visao de todo o loot coletado: quantidade, nome, valor unitario e valor total dos itens. Clique nesta caixa para abrir a visao geral do item."
    },
    {
      text: "Aqui estao os switches de eventos. Ao marca-los, os valores de XP e Loot serao duplicados.",
      done: true
    }
  ],
  en: [
    {
      text: "This is the Solo Hunt Analyzer, where you get a complete summary of your performance, experience, profit, damage, loot and defeated creatures."
    },
    {
      text: "First, enter your character name here."
    },
    {
      text: "When this switch is enabled, Loot values are converted to the real Market values for the active world. Keep the item values in your game set to NPC values when using this option."
    },
    {
      html: 'First, open the <strong>Hunt Analyzer</strong> in Tibia, click the menu on the right, choose <strong>Copy to Clipboard</strong>, and paste the text into this box. For a better analysis, keep <strong>Show War XP</strong> enabled.'
    },
    {
      text: "Here you get an overview of the session: duration, date and time, XP, Supplies spent, Balance, total damage and healing."
    },
    {
      text: "Here you get a graphical overview of your loot, Supplies spent, total Balance, damage dealt, healing done and experience gained."
    },
    {
      text: "Here you get a summary of every creature you defeated: quantity, name, individual XP and total XP from that creature. Click to open its detailed view."
    },
    {
      text: "Here you get an overview of all collected loot: quantity, name, unit value and total item value. Click this card to open the item overview."
    },
    {
      text: "These are the event switches. When enabled, XP and Loot values are doubled.",
      done: true
    }
  ],
  de: [
    {
      text: "Das ist der Solo Hunt Analyzer. Hier bekommst du eine vollstaendige Uebersicht ueber Leistung, Erfahrung, Gewinn, Schaden, Loot und besiegte Kreaturen."
    },
    {
      text: "Gib hier zuerst den Namen deines Charakters ein."
    },
    {
      text: "Wenn dieser Schalter aktiv ist, werden die Loot-Werte in die echten Marktwerte der aktiven Welt umgerechnet. Stelle die Itemwerte im Spiel auf NPC-Werte, wenn du diese Option nutzt."
    },
    {
      html: 'Oeffne zuerst den <strong>Hunt Analyzer</strong> in Tibia, klicke rechts auf das Menue, waehle <strong>Copy to Clipboard</strong> und fuege den Text in dieses Feld ein. Fuer eine bessere Analyse sollte <strong>Show War XP</strong> aktiviert bleiben.'
    },
    {
      text: "Hier bekommst du eine Uebersicht der Sitzung: Dauer, Datum und Uhrzeit, XP, verbrauchte Supplies, Balance, gesamter Schaden und Heilung."
    },
    {
      text: "Hier bekommst du eine grafische Uebersicht ueber Loot, verbrauchte Supplies, Gesamtbalance, verursachten Schaden, Heilung und gewonnene Erfahrung."
    },
    {
      text: "Hier findest du eine Zusammenfassung aller besiegten Kreaturen: Menge, Name, einzelne XP und gesamte XP dieser Kreatur. Klicke fuer die Detailansicht."
    },
    {
      text: "Hier findest du den gesamten gesammelten Loot: Menge, Name, Einzelwert und Gesamtwert. Klicke auf diese Karte, um die Itemuebersicht zu oeffnen."
    },
    {
      text: "Das sind die Event-Schalter. Wenn sie aktiv sind, werden XP- und Loot-Werte verdoppelt.",
      done: true
    }
  ]
};

const TUTORIAL_PARTY_FINDER_STEP_COPY = {
  "pt-BR": [
    {
      text: "Este e o Party Finder. Aqui voce conseguira encontrar players da sua faixa de level para montar uma boa party para suas hunts diarias."
    },
    {
      text: "Escolha a vocacao que voce quer encontrar para fazer parte da sua Party."
    },
    {
      text: "Digite o nome do seu personagem. A pesquisa se adequara a sua faixa de level."
    },
    {
      text: "Aqui voce pode excluir as guildas que nao tem interesse em cacar junto."
    },
    {
      text: "Se quiser limpar o filtro de guildas, aperte este botao."
    },
    {
      text: "Aqui aparece o level minimo e maximo que podera aparecer na lista de personagens."
    },
    {
      text: "Os personagens encontrados aparecerao nesta lista. Voce pode conferir nome, mundo, level e a vocacao pela imagem."
    },
    {
      text: "Clique neste botao para copiar o nome rapidamente."
    },
    {
      text: "Voce pode ordenar a lista por nome ou level clicando nestes botoes. Clique novamente para inverter a ordem.",
      done: true
    }
  ],
  en: [
    {
      text: "This is Party Finder. Here you can find players in your level range to build a good party for your daily hunts."
    },
    {
      text: "Choose the vocation you want to find for your Party."
    },
    {
      text: "Enter your character name. The search adapts to your level range."
    },
    {
      text: "Here you can exclude guilds you are not interested in hunting with."
    },
    {
      text: "Use this button to clear the guild filter."
    },
    {
      text: "This shows the minimum and maximum level that can appear in the character list."
    },
    {
      text: "Found characters appear in this list. You can check their name, world, level and vocation from the image."
    },
    {
      text: "Click this button to copy the name quickly."
    },
    {
      text: "You can sort the list by name or level with these buttons. Click again to reverse the order.",
      done: true
    }
  ],
  de: [
    {
      text: "Das ist der Party Finder. Hier findest du Spieler in deiner Levelspanne, um eine gute Party fuer deine taeglichen Hunts zusammenzustellen."
    },
    {
      text: "Waehle die Vocation aus, die du fuer deine Party finden moechtest."
    },
    {
      text: "Gib den Namen deines Charakters ein. Die Suche passt sich deiner Levelspanne an."
    },
    {
      text: "Hier kannst du Guilds ausschliessen, mit denen du nicht zusammen hunten moechtest."
    },
    {
      text: "Mit diesem Button loeschst du den Guild-Filter."
    },
    {
      text: "Hier siehst du das minimale und maximale Level, das in der Charakterliste erscheinen kann."
    },
    {
      text: "Gefundene Charaktere erscheinen in dieser Liste. Du siehst Name, Welt, Level und Vocation anhand des Bildes."
    },
    {
      text: "Klicke auf diesen Button, um den Namen schnell zu kopieren."
    },
    {
      text: "Mit diesen Buttons kannst du die Liste nach Name oder Level sortieren. Klicke erneut, um die Reihenfolge umzudrehen.",
      done: true
    }
  ]
};

const TUTORIAL_SKILL_CALCULATOR_STEP_COPY = {
  "pt-BR": [
    {
      text: "Na Calculadora de Skill voce vai conseguir calcular o gasto e o tempo necessarios para treinar a skill desejada no seu personagem."
    },
    {
      text: "Selecione a skill desejada entre os cinco tipos. O botao de Sword tambem serve para Club e Axe."
    },
    {
      text: "Selecione a vocacao desejada para configurar o calculo corretamente."
    },
    {
      text: "Digite a skill atual do seu personagem e a skill desejada para o calculo."
    },
    {
      text: "Selecione a porcentagem que falta para a proxima skill."
    },
    {
      text: "Digite quantos pontos de Loyalty voce tem. Abaixo, voce conseguira ver a porcentagem do seu bonus de Loyalty."
    },
    {
      text: "Caso voce tenha um Dummy privado ou algum evento de bonus esteja acontecendo, voce pode selecionar aqui."
    },
    {
      text: "Os valores que voce vai investir em varinhas aparecerao aqui. Eles tambem sao convertidos para Tibia Coin no mundo ativo."
    },
    {
      text: "O valor mais em conta ficara destacado para ajudar voce a decidir onde comprar."
    },
    {
      text: "Aqui esta a quantidade de cada varinha que voce precisara comprar para chegar ao seu objetivo."
    },
    {
      text: "Este e o tempo necessario treinando para usar todas as varinhas.",
      done: true
    }
  ],
  en: [
    {
      text: "In the Skill Calculator, you can calculate the cost and time needed to train the desired skill for your character."
    },
    {
      text: "Select the desired skill from the five types. The Sword button also covers Club and Axe."
    },
    {
      text: "Select the desired vocation to configure the calculation correctly."
    },
    {
      text: "Enter your character's current skill and the desired skill for the calculation."
    },
    {
      text: "Select the percentage remaining until the next skill."
    },
    {
      text: "Enter how many Loyalty points you have. Below, you can see your Loyalty bonus percentage."
    },
    {
      text: "If you have a private Dummy or a bonus event is active, you can select it here."
    },
    {
      text: "The values you will invest in exercise weapons appear here. They are also converted to Tibia Coin in the active world."
    },
    {
      text: "The best value is highlighted to help you decide where to buy."
    },
    {
      text: "Here is the amount of each exercise weapon you need to buy to reach your goal."
    },
    {
      text: "This is the training time required to use all exercise weapons.",
      done: true
    }
  ],
  de: [
    {
      text: "Im Skill Calculator kannst du die Kosten und die benoetigte Zeit berechnen, um den gewuenschten Skill deines Charakters zu trainieren."
    },
    {
      text: "Waehle den gewuenschten Skill aus den fuenf Typen. Der Sword-Button gilt auch fuer Club und Axe."
    },
    {
      text: "Waehle die gewuenschte Vocation aus, damit die Berechnung korrekt konfiguriert wird."
    },
    {
      text: "Gib den aktuellen Skill deines Charakters und den Zielskill fuer die Berechnung ein."
    },
    {
      text: "Waehle den Prozentsatz, der bis zum naechsten Skill noch fehlt."
    },
    {
      text: "Gib ein, wie viele Loyalty-Punkte du hast. Darunter siehst du deinen Loyalty-Bonus in Prozent."
    },
    {
      text: "Wenn du einen privaten Dummy hast oder ein Bonusevent aktiv ist, kannst du es hier auswaehlen."
    },
    {
      text: "Hier erscheinen die Werte, die du in Exercise Weapons investieren wirst. Sie werden auch in Tibia Coin der aktiven Welt umgerechnet."
    },
    {
      text: "Der guenstigste Wert wird hervorgehoben, damit du entscheiden kannst, wo du kaufen moechtest."
    },
    {
      text: "Hier siehst du die Menge jeder Exercise Weapon, die du brauchst, um dein Ziel zu erreichen."
    },
    {
      text: "Das ist die benoetigte Trainingszeit, um alle Exercise Weapons zu verwenden.",
      done: true
    }
  ]
};

const TUTORIAL_TIBIA_MIRROR_INTRO_STEP_COPY = {
  "pt-BR": [
    {
      html: "<strong style=\"font-size:18px;color:#67d98a\">Tibia Mirror</strong><br><br>Uma ferramenta totalmente segura, sem injeção, que usa um sistema semelhante ao streaming de tela do OBS Studio.<br><br>Ela ajuda você a selecionar e mover partes do HUD do Tibia, criar feedbacks visuais e sonoros, barras de cooldown e textos em destaque.<br><br><strong style=\"font-size:16px;color:#ff766d\">IMPORTANTE</strong><br><strong style=\"color:#ff766d\">Não há automação, macros ou vantagens desonestas nesta ferramenta.</strong><br>Prezamos por um jogo saudável e não apoiamos esse tipo de atitude.",
      done: true
    }
  ],
  en: [
    {
      html: "<strong style=\"font-size:18px;color:#67d98a\">Tibia Mirror</strong><br><br>A completely safe, injection-free tool that uses a system similar to OBS Studio screen streaming.<br><br>It helps you select and move Tibia HUD areas, create visual and audio feedback, cooldown bars and highlighted on-screen text.<br><br><strong style=\"font-size:16px;color:#ff766d\">IMPORTANT</strong><br><strong style=\"color:#ff766d\">There is no automation, macros or unfair advantage in this tool.</strong><br>We value a healthy game and do not support that kind of behavior.",
      done: true
    }
  ],
  de: [
    {
      html: "<strong style=\"font-size:18px;color:#67d98a\">Tibia Mirror</strong><br><br>Ein vollstaendig sicheres Tool ohne Injection, das aehnlich wie OBS Studio Screen-Streaming funktioniert.<br><br>Damit kannst du Bereiche des Tibia-HUD verschieben sowie visuelle und akustische Hinweise, Cooldown-Balken und hervorgehobene Texte erstellen.<br><br><strong style=\"font-size:16px;color:#ff766d\">WICHTIG</strong><br><strong style=\"color:#ff766d\">Dieses Tool enthaelt keine Automatisierung, Makros oder unfairen Vorteile.</strong><br>Wir stehen fuer ein gesundes Spiel und unterstuetzen dieses Verhalten nicht.",
      done: true
    }
  ]
};

const TUTORIAL_SQM_FINDER_STEP_COPY = {
  "pt-BR": [
    { text: "Esse é o SQM Finder. Uma ferramenta para destacar um SQM específico e também o cursor da sua tela." },
    { text: "Clicando neste botão, você consegue visualizar o destaque do SQM." },
    { text: "Ao clicar neste botão, você alterna o formato do destaque entre quadrado, círculo e setas." },
    { text: "Nesta barra você consegue controlar o tamanho do destaque." },
    { text: "Aqui você consegue alternar a intensidade de cada tipo de destaque." },
    { text: "Você também pode escolher a cor do destaque, salvar um preset no ícone de salvar ou apagar no ícone de lixeira." },
    { text: "Aqui você consegue destacar a posição do seu cursor." },
    { text: "Neste card você também pode controlar o tamanho e a cor do destaque do cursor.", done: true }
  ],
  en: [
    { text: "This is SQM Finder. It highlights a specific SQM and also your on-screen cursor." },
    { text: "Clicking this button lets you view the SQM highlight." },
    { text: "Click this button to switch the highlight between square, circle and arrows." },
    { text: "Use this slider to control the highlight size." },
    { text: "Here you can change the intensity for each highlight type." },
    { text: "You can also choose the highlight color, save a preset with the save icon or delete it with the trash icon." },
    { text: "Here you can highlight the position of your cursor." },
    { text: "In this card you can also control the cursor highlight size and color.", done: true }
  ],
  de: [
    { text: "Das ist der SQM Finder. Damit hebst du ein bestimmtes SQM und auch deinen Cursor hervor." },
    { text: "Mit diesem Button kannst du die SQM-Hervorhebung anzeigen." },
    { text: "Mit diesem Button wechselst du die Hervorhebung zwischen Quadrat, Kreis und Pfeilen." },
    { text: "Mit diesem Regler steuerst du die Groesse der Hervorhebung." },
    { text: "Hier kannst du die Intensitaet jedes Hervorhebungstyps aendern." },
    { text: "Du kannst auch die Farbe waehlen, ein Preset mit dem Speichern-Symbol sichern oder es mit dem Papierkorb loeschen." },
    { text: "Hier kannst du die Position deines Cursors hervorheben." },
    { text: "In dieser Karte steuerst du auch Groesse und Farbe der Cursor-Hervorhebung.", done: true }
  ]
};

const TUTORIAL_NPCS_STEP_COPY = {
  "pt-BR": [
    { text: "Neste painel você vai encontrar informações detalhadas de NPCs, criaturas e bosses do jogo." },
    { text: "Você pode pesquisar manualmente um NPC digitando o nome dele nesta caixa." },
    { text: "Você pode filtrar pela função do NPC nesta lista." },
    { text: "Você também pode filtrar pela cidade do NPC ou verificar se ele realmente compra e vende alguma coisa nestes filtros." },
    { text: "Aqui vão aparecer os NPCs filtrados. Clique em um para abrir os detalhes." },
    { text: "Você verá o resumo das informações do NPC aqui." },
    { text: "Clique aqui para ver a localização deste NPC no mapa." },
    { text: "Aqui você verá a lista de itens que o NPC compra ou vende, caso ele negocie alguma coisa. Clique nos itens para ver a descrição." },
    { text: "Você também pode clicar neste botão para ver mais informações do NPC no site do TibiaWiki BR.", done: true }
  ],
  en: [
    { text: "In this panel you can find detailed information about NPCs, creatures and bosses in the game." },
    { text: "You can manually search for an NPC by typing its name in this field." },
    { text: "You can filter NPCs by their role in this list." },
    { text: "You can also filter by the NPC's city or whether they actually buy and sell something with these filters." },
    { text: "The filtered NPCs appear here. Click one to open its details." },
    { text: "You can see a summary of this NPC's information here." },
    { text: "Click here to see this NPC's location on the map." },
    { text: "Here you can see the items this NPC buys or sells, when available. Click an item to open its description." },
    { text: "You can also click this button to see more NPC information on the TibiaWiki BR website.", done: true }
  ],
  de: [
    { text: "In diesem Bereich findest du detaillierte Informationen zu NPCs, Kreaturen und Bossen im Spiel." },
    { text: "Du kannst einen NPC manuell suchen, indem du seinen Namen in dieses Feld eingibst." },
    { text: "In dieser Liste kannst du NPCs nach ihrer Funktion filtern." },
    { text: "Mit diesen Filtern kannst du auch nach Stadt filtern oder pruefen, ob ein NPC wirklich etwas kauft oder verkauft." },
    { text: "Hier erscheinen die gefilterten NPCs. Klicke einen an, um seine Details zu oeffnen." },
    { text: "Hier siehst du eine Zusammenfassung der Informationen dieses NPCs." },
    { text: "Klicke hier, um den Standort dieses NPCs auf der Karte zu sehen." },
    { text: "Hier siehst du die Gegenstaende, die dieser NPC kauft oder verkauft, falls vorhanden. Klicke einen Gegenstand an, um seine Beschreibung zu oeffnen." },
    { text: "Mit diesem Button kannst du weitere Informationen zum NPC auf der Website von TibiaWiki BR ansehen.", done: true }
  ]
};

const TUTORIAL_BESTIARY_STEP_COPY = {
  "pt-BR": [
    { text: "Na aba Bestiário você encontra informações da maioria das criaturas do Tibia, como descrição, loot, fraquezas, danos e status." },
    { text: "Digite o nome da criatura que quer pesquisar nesta caixa para filtrá-la." },
    { text: "Você também pode filtrar os monstros da lista pelas fraquezas contra determinados elementos." },
    { text: "Você também pode escolher a categoria do monstro neste painel." },
    { text: "A lista de criaturas aparecerá aqui. Clique na criatura desejada para ver as informações dela." },
    { text: "Os status da criatura, fraquezas, imunidades e habilidades aparecerão aqui." },
    { text: "Você poderá conferir os drops da criatura nesta seção." },
    { html: "Nesta caixa de recomendações, você pode escolher uma vocação e receber sugestões de equipamentos conforme as fraquezas da criatura.<br><br><strong style=\"color:#ff9a68\">Estas informações ainda estão em desenvolvimento. Você pode nos ajudar enviando sugestões de equipamentos para cada criatura.</strong>" },
    { text: "Selecione aqui as sugestões de equipamentos para armas de uma mão e duas mãos.", done: true }
  ],
  en: [
    { text: "In the Bestiary tab you can find information about most Tibia creatures, including descriptions, loot, weaknesses, damage and stats." },
    { text: "Type the name of the creature you want to search for in this field to filter it." },
    { text: "You can also filter the monster list by weaknesses against specific elements." },
    { text: "You can also choose the monster category in this panel." },
    { text: "The creature list appears here. Click the desired creature to view its information." },
    { text: "The creature's stats, weaknesses, immunities and abilities appear here." },
    { text: "You can check the creature's drops in this section." },
    { html: "In this recommendations box, you can choose a vocation and receive equipment suggestions based on the creature's weaknesses.<br><br><strong style=\"color:#ff9a68\">This information is still under development. You can help us by sending equipment suggestions for each creature.</strong>" },
    { text: "Select the equipment suggestions for one-handed and two-handed weapons here.", done: true }
  ],
  de: [
    { text: "Im Bestiarium findest du Informationen zu den meisten Tibia-Kreaturen, etwa Beschreibungen, Beute, Schwächen, Schaden und Werte." },
    { text: "Gib den Namen der Kreatur in dieses Feld ein, um die Liste zu filtern." },
    { text: "Du kannst die Monsterliste auch nach Schwächen gegen bestimmte Elemente filtern." },
    { text: "In diesem Bereich kannst du auch die Kategorie des Monsters auswählen." },
    { text: "Hier erscheint die Kreaturenliste. Klicke auf die gewünschte Kreatur, um ihre Informationen zu sehen." },
    { text: "Hier erscheinen die Werte, Schwächen, Immunitäten und Fähigkeiten der Kreatur." },
    { text: "In diesem Bereich kannst du die Drops der Kreatur prüfen." },
    { html: "In diesem Empfehlungsbereich kannst du eine Vocation wählen und Ausrüstungsvorschläge anhand der Schwächen der Kreatur erhalten.<br><br><strong style=\"color:#ff9a68\">Diese Informationen befinden sich noch in Entwicklung. Du kannst uns mit Ausrüstungsvorschlägen für jede Kreatur helfen.</strong>" },
    { text: "Wähle hier Ausrüstungsvorschläge für Einhand- und Zweihandwaffen aus.", done: true }
  ]
};

const TUTORIAL_BOSSTIARY_STEP_COPY = {
  "pt-BR": [
    { text: "No Bossiary você encontrará informações sobre os bosses, como categorias, fraquezas, drops, histórico de mortes e aparecimentos." },
    { text: "Você pode pesquisar o nome do boss diretamente nesta caixa." },
    { text: "Filtre aqui a categoria do boss." },
    { text: "Você pode filtrar o boss pela fraqueza neste menu." },
    { text: "A lista de bosses filtrados aparecerá nesta caixa." },
    { text: "Os status, fraquezas, imunidades e habilidades do boss podem ser vistos aqui." },
    { text: "Mais detalhes e descrições do boss podem ser vistos aqui." },
    { text: "Você pode ver a localização exata do boss neste mapa." },
    { text: "Você também consegue conferir a rota exata até encontrar o boss neste mapa, clicando em \"Como chegar\"." },
    { text: "Descrições do loot do boss podem ser vistas aqui." },
    { text: "As estatísticas de aparecimento e morte do boss podem ser vistas aqui." },
    { text: "Neste gráfico você consegue ter uma visão da probabilidade de aparecimento do boss." },
    { text: "Aqui há um histórico dos últimos aparecimentos do boss no mundo ativo.", done: true }
  ],
  en: [
    { text: "In Bossiary you can find information about bosses, including categories, weaknesses, drops, death history and appearances." },
    { text: "You can search for a boss directly by name in this field." },
    { text: "Filter the boss category here." },
    { text: "You can filter bosses by weakness in this menu." },
    { text: "The filtered boss list appears in this box." },
    { text: "The boss stats, weaknesses, immunities and abilities are shown here." },
    { text: "More details and descriptions of the boss are available here." },
    { text: "You can view the boss's exact location on this map." },
    { text: "You can also view the exact route to reach the boss on this map by clicking \"How to get there\"." },
    { text: "The boss loot descriptions are shown here." },
    { text: "The boss appearance and death statistics can be seen here." },
    { text: "This chart gives you a view of the boss appearance probability." },
    { text: "Here you can see a history of the boss's latest appearances in the active world.", done: true }
  ],
  de: [
    { text: "Im Bossiary findest du Informationen zu Bossen, darunter Kategorien, Schwächen, Beute, Todeshistorie und Erscheinungen." },
    { text: "Du kannst den Namen des Bosses direkt in diesem Feld suchen." },
    { text: "Filtere hier die Kategorie des Bosses." },
    { text: "In diesem Menü kannst du Bosse nach Schwächen filtern." },
    { text: "Die gefilterte Bossliste erscheint in diesem Bereich." },
    { text: "Hier werden Werte, Schwächen, Immunitäten und Fähigkeiten des Bosses angezeigt." },
    { text: "Weitere Details und Beschreibungen des Bosses findest du hier." },
    { text: "Auf dieser Karte siehst du den genauen Standort des Bosses." },
    { text: "Mit \"Wie komme ich hin\" kannst du auf dieser Karte auch die genaue Route zum Boss sehen." },
    { text: "Hier werden die Loot-Beschreibungen des Bosses angezeigt." },
    { text: "Hier siehst du Statistiken zu Erscheinungen und Toden des Bosses." },
    { text: "Dieses Diagramm zeigt die Wahrscheinlichkeit, dass der Boss erscheint." },
    { text: "Hier findest du eine Historie der letzten Erscheinungen des Bosses in der aktiven Welt.", done: true }
  ]
};

const TUTORIAL_ALERTS_STEP_COPY = {
  "pt-BR": [
    { text: "Este é o painel de Alertas do Tibia Mirror. Aqui você configura alertas visuais e sonoros para receber feedback das suas magias no jogo." },
    { html: "Ligue e desligue os alertas clicando neste botão.<br><br><strong style=\"color:#ff766d\">IMPORTANTE: você só conseguirá editar se os alertas estiverem desligados.</strong>" },
    { text: "Clique neste botão para abrir o painel de magias." },
    { text: "Selecione uma vocação para filtrar as magias." },
    { text: "Clique em uma magia para selecioná-la. Um card será criado com nome, palavra mágica e tempo equivalentes à magia escolhida." },
    { text: "Você também pode configurar um alerta do zero neste botão." },
    { text: "Você pode editar o nome do alerta aqui. Ele serve apenas para identificação." },
    { text: "Aqui você pode configurar o tempo de cooldown." },
    { text: "Clique aqui e digite a combinação de teclas que ativará este alerta." },
    { text: "Se este botão estiver ativado, pressionar a hotkey novamente reinicia o tempo do zero. Deixe desligado para uma contagem contínua." },
    { text: "Aqui você pode configurar lembretes para usar a magia novamente. Por exemplo, duas lembranças extras em intervalos de 10 segundos quando não houve tempo de usar Utura Gran." },
    { text: "Você também pode trocar o áudio do alerta clicando neste botão." },
    { text: "Se preferir, carregue um áudio próprio aqui. Por exemplo, você pode gravar um áudio no WhatsApp, baixar e usar neste alerta." },
    { text: "Aqui você altera o volume deste alerta individualmente." },
    { text: "Arrastar este controle altera o volume geral de todos os alertas." },
    { text: "Além do alerta sonoro, você também pode ativar alertas visuais clicando aqui." },
    { text: "Clique aqui para abrir a edição do alerta visual deste card." },
    { text: "Você não conseguirá editar enquanto a trava do alerta visual estiver ativa. Destrave para editar." },
    { text: "Ao destravar, o texto do alerta aparece flutuando na tela e pode ser arrastado livremente." },
    { text: "Aqui você escolhe o texto que será exibido." },
    { text: "Nesta caixa você define por quanto tempo o texto permanecerá na tela." },
    { text: "Altere a fonte e a grossura do texto nestas opções." },
    { text: "Nestas opções, você pode adicionar sombra e mudar a cor do texto.", done: true }
  ],
  en: [
    { text: "This is the Tibia Mirror Alerts panel. Here you configure visual and audio alerts for in-game spell feedback." },
    { html: "Turn alerts on and off with this button.<br><br><strong style=\"color:#ff766d\">IMPORTANT: you can only edit while alerts are turned off.</strong>" },
    { text: "Click this button to open the spells panel." },
    { text: "Select a vocation to filter the spells." },
    { text: "Click a spell to select it. A card is created with the selected spell's name, magic words and cooldown." },
    { text: "You can also create an alert from scratch with this button." },
    { text: "You can edit the alert name here. It is only used for identification." },
    { text: "Here you can configure the cooldown time." },
    { text: "Click here and enter the key combination that will activate this alert." },
    { text: "When this button is enabled, pressing the hotkey again restarts the timer from zero. Leave it off for a continuous countdown." },
    { text: "Here you can configure reminders to use the spell again. For example, two extra reminders every 10 seconds when there was no time to use Utura Gran." },
    { text: "You can also change the alert audio with this button." },
    { text: "If you prefer, load your own audio here. For example, record a WhatsApp audio, download it and use it for this alert." },
    { text: "Here you can change this alert's volume individually." },
    { text: "Dragging this control changes the global volume of all alerts." },
    { text: "Besides audio alerts, you can also enable visual alerts here." },
    { text: "Click here to open this card's visual alert editor." },
    { text: "You cannot edit while the visual alert lock is active. Unlock it to edit." },
    { text: "When unlocked, the alert text appears floating on the screen and can be freely dragged." },
    { text: "Here you choose the text that will be shown." },
    { text: "In this field, define how long the text stays on screen." },
    { text: "Change the text font and weight with these options." },
    { text: "With these options, you can add a shadow and change the text color.", done: true }
  ],
  de: [
    { text: "Das ist das Alerts-Panel von Tibia Mirror. Hier konfigurierst du visuelle und akustische Hinweise fuer deine Magien im Spiel." },
    { html: "Mit diesem Button schaltest du Alerts ein und aus.<br><br><strong style=\"color:#ff766d\">WICHTIG: Du kannst nur bearbeiten, wenn die Alerts ausgeschaltet sind.</strong>" },
    { text: "Klicke diesen Button, um das Magie-Panel zu oeffnen." },
    { text: "Waehle eine Vocation aus, um die Magien zu filtern." },
    { text: "Klicke eine Magie an. Eine Karte wird mit Name, Magic Words und Cooldown der gewaehlten Magie erstellt." },
    { text: "Mit diesem Button kannst du auch einen Alert von Grund auf erstellen." },
    { text: "Hier kannst du den Namen des Alerts bearbeiten. Er dient nur zur Identifikation." },
    { text: "Hier konfigurierst du die Cooldown-Zeit." },
    { text: "Klicke hier und gib die Tastenkombination ein, die diesen Alert aktiviert." },
    { text: "Wenn dieser Button aktiv ist, startet ein erneutes Druecken der Hotkey den Timer bei null. Lass ihn aus fuer einen fortlaufenden Timer." },
    { text: "Hier konfigurierst du Erinnerungen, um die Magie erneut zu benutzen. Zum Beispiel zwei weitere Erinnerungen im Abstand von 10 Sekunden, wenn keine Zeit fuer Utura Gran war." },
    { text: "Mit diesem Button kannst du auch den Alert-Sound wechseln." },
    { text: "Wenn du moechtest, kannst du hier eine eigene Audiodatei laden. Zum Beispiel eine WhatsApp-Aufnahme herunterladen und fuer diesen Alert verwenden." },
    { text: "Hier aenderst du die Lautstaerke dieses Alerts einzeln." },
    { text: "Wenn du diesen Regler bewegst, aenderst du die globale Lautstaerke aller Alerts." },
    { text: "Neben Audio-Alerts kannst du hier auch visuelle Alerts aktivieren." },
    { text: "Klicke hier, um den visuellen Alert dieses Cards zu bearbeiten." },
    { text: "Solange die Sperre des visuellen Alerts aktiv ist, kannst du nicht bearbeiten. Entsperre ihn zum Bearbeiten." },
    { text: "Nach dem Entsperren erscheint der Alert-Text schwebend auf dem Bildschirm und kann frei verschoben werden." },
    { text: "Hier waehlst du den Text aus, der angezeigt wird." },
    { text: "In diesem Feld legst du fest, wie lange der Text auf dem Bildschirm bleibt." },
    { text: "Aendere Schriftart und Schriftstaerke mit diesen Optionen." },
    { text: "Mit diesen Optionen kannst du einen Schatten hinzufuegen und die Textfarbe aendern.", done: true }
  ]
};

const TUTORIAL_TIBIA_MIRROR_STEP_COPY = {
  "pt-BR": [
    {
      text: "Adicione o nome do seu personagem, renomeie o seu Profile e clique no botão salvar."
    },
    {
      text: "Seu perfil criado ficará salvo aqui nesse painel."
    },
    {
      text: "Esse é o perfil criado, e você poderá editá-lo, duplicá-lo ou excluí-lo por aqui."
    },
    {
      text: "Você pode criar um Profile novo clicando aqui."
    },
    {
      text: "Você pode exportar o seu Profile clicando nesse botão."
    },
    {
      text: "Você pode importar seu Profile exportado por esse botão."
    },
    {
      text: "Você poderá criar seus primeiros espelhos clicando aqui."
    },
    {
      text: "Você pode ativar a Grade de suporte para te ajudar a posicionar seus espelhos com precisão.",
      done: true
    },
    {
      text: "Ative esta op\u00e7\u00e3o se quiser que os espelhos do Tibia Mirror apare\u00e7am na sua tela ao gravar ou fazer stream com o OBS Studio.",
      done: true
    }
  ],
  en: [
    {
      text: "Add your character name, rename your Profile and click the save button."
    },
    {
      text: "Your created profile will be saved in this panel."
    },
    {
      text: "This is the created profile. You can edit, duplicate or delete it here."
    },
    {
      text: "You can create a new Profile by clicking here."
    },
    {
      text: "You can export your Profile by clicking this button."
    },
    {
      text: "You can import an exported Profile through this button."
    },
    {
      text: "You can create your first mirrors by clicking here."
    },
    {
      text: "You can enable the support Grid to help position your mirrors precisely.",
      done: true
    },
    {
      text: "Enable this option if you want Tibia Mirror mirrors to appear in your recording or stream with OBS Studio.",
      done: true
    }
  ],
  de: [
    {
      text: "Gib den Namen deines Charakters ein, benenne dein Profile um und klicke auf Speichern."
    },
    {
      text: "Dein erstelltes Profile wird hier in diesem Panel gespeichert."
    },
    {
      text: "Das ist das erstellte Profile. Hier kannst du es bearbeiten, duplizieren oder löschen."
    },
    {
      text: "Du kannst hier ein neues Profile erstellen."
    },
    {
      text: "Du kannst dein Profile mit diesem Button exportieren."
    },
    {
      text: "Du kannst ein exportiertes Profile über diesen Button importieren."
    },
    {
      text: "Hier kannst du deine ersten Spiegel erstellen."
    },
    {
      text: "Du kannst das unterstützende Grid aktivieren, um deine Spiegel präzise zu positionieren.",
      done: true
    },
    {
      text: "Aktiviere diese Option, wenn die Tibia-Mirror-Spiegel in deiner OBS-Studio-Aufnahme oder deinem Stream erscheinen sollen.",
      done: true
    }
  ]
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

let activeTour = null;
let activeStepIndex = -1;
let activeTourName = "item-prices";
let removeNextListener = null;
let removeCancelListener = null;
let activeStepTransitionId = 0;
let tutorialInteractionBlocked = false;
const tutorialRoutesStartedThisSession = new Set();
let imbuementTourStateSnapshot = null;
let analyzerTourStateSnapshot = null;
let findPartyTourStateSnapshot = null;
let skillCalculatorTourStateSnapshot = null;
let npcCatalogTourStateSnapshot = null;
let bestiaryTourStateSnapshot = null;
let bosstiaryTourStateSnapshot = null;
let tibiaMirrorTutorialRestartPending = false;
const TUTORIAL_WELCOME_STORAGE_KEY = "tibia-tools:tutorial:v2:welcome:seen";

function getTutorialApi() {
  return window.TibiaToolsTutorialApi || null;
}

function getTibiaMirrorTutorialApi() {
  return window.TibiaMirrorTutorialApi || null;
}

async function waitForTibiaMirrorTutorialApi(timeoutMs = 1200) {
  const deadline = Date.now() + timeoutMs;
  let api = getTibiaMirrorTutorialApi();

  while (!api && Date.now() < deadline) {
    await wait(25);
    api = getTibiaMirrorTutorialApi();
  }

  return api;
}

function getElement(selector) {
  if (!selector) {
    return document.body;
  }

  return document.querySelector(selector) || document.body;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getTutorialLocale() {
  return getAppLocale();
}

function getTutorialWelcomeCopy() {
  return TUTORIAL_WELCOME_COPY[getTutorialLocale()] || TUTORIAL_WELCOME_COPY.en;
}

function getTutorialActionCopy() {
  return TUTORIAL_ACTION_COPY[getTutorialLocale()] || TUTORIAL_ACTION_COPY.en;
}

function getTutorialConfirmationCopy() {
  return TUTORIAL_CONFIRMATION_COPY[getTutorialLocale()] || TUTORIAL_CONFIRMATION_COPY.en;
}

function hasTutorialBeenSeen(config) {
  if (!config?.firstVisitStorageKey) {
    return false;
  }

  try {
    return window.localStorage.getItem(config.firstVisitStorageKey) === "true";
  } catch (_error) {
    return false;
  }
}

function markTutorialSeen(config) {
  if (!config?.firstVisitStorageKey) {
    return;
  }

  try {
    window.localStorage.setItem(config.firstVisitStorageKey, "true");
  } catch (_error) {
  }
}

function markWelcomeSeen() {
  try {
    window.localStorage.setItem(TUTORIAL_WELCOME_STORAGE_KEY, "true");
  } catch (_error) {
  }
}

function clearTutorialProgress() {
  try {
    window.localStorage.removeItem(TUTORIAL_WELCOME_STORAGE_KEY);
    Object.values(TUTORIAL_ROUTE_CONFIG).forEach((config) => {
      if (config?.firstVisitStorageKey) {
        window.localStorage.removeItem(config.firstVisitStorageKey);
      }
    });
  } catch (_error) {
  }
  tutorialRoutesStartedThisSession.clear();
}

function getTourSteps(tourName = "item-prices") {
  const route = tourName === "stash"
    ? { meta: TUTORIAL_STASH_STEP_META, copy: TUTORIAL_STASH_STEP_COPY }
    : tourName === "tools"
      ? { meta: TUTORIAL_TOOLS_STEP_META, copy: TUTORIAL_TOOLS_STEP_COPY }
      : tourName === "analyzer"
        ? { meta: TUTORIAL_ANALYZER_STEP_META, copy: TUTORIAL_ANALYZER_STEP_COPY }
        : tourName === "solo-analyzer"
          ? { meta: TUTORIAL_SOLO_ANALYZER_STEP_META, copy: TUTORIAL_SOLO_ANALYZER_STEP_COPY }
          : tourName === "party-finder"
            ? { meta: TUTORIAL_PARTY_FINDER_STEP_META, copy: TUTORIAL_PARTY_FINDER_STEP_COPY }
            : tourName === "skill-calculator"
              ? { meta: TUTORIAL_SKILL_CALCULATOR_STEP_META, copy: TUTORIAL_SKILL_CALCULATOR_STEP_COPY }
              : tourName === "npcs"
                ? { meta: TUTORIAL_NPCS_STEP_META, copy: TUTORIAL_NPCS_STEP_COPY }
                : tourName === "bestiary"
                  ? { meta: TUTORIAL_BESTIARY_STEP_META, copy: TUTORIAL_BESTIARY_STEP_COPY }
                : tourName === "bosstiary"
                  ? { meta: TUTORIAL_BOSSTIARY_STEP_META, copy: TUTORIAL_BOSSTIARY_STEP_COPY }
                : tourName === "tibia-mirror"
                ? { meta: TUTORIAL_TIBIA_MIRROR_STEP_META, copy: TUTORIAL_TIBIA_MIRROR_STEP_COPY }
                : tourName === "tibia-mirror-intro"
                  ? { meta: TUTORIAL_TIBIA_MIRROR_INTRO_STEP_META, copy: TUTORIAL_TIBIA_MIRROR_INTRO_STEP_COPY }
                  : tourName === "sqm-finder"
                    ? { meta: TUTORIAL_SQM_FINDER_STEP_META, copy: TUTORIAL_SQM_FINDER_STEP_COPY }
                    : tourName === "alerts"
                      ? { meta: TUTORIAL_ALERTS_STEP_META, copy: TUTORIAL_ALERTS_STEP_COPY }
                    : { meta: TUTORIAL_STEP_META, copy: TUTORIAL_STEP_COPY };
  const copySource = route.copy;
  const copy = copySource[getTutorialLocale()] || copySource.en;
  const supporterState = tourName === "item-prices"
    ? getTutorialApi()?.getSupportersTutorialState?.() || {}
    : {};
  let copyIndex = 0;
  const entries = route.meta.map((entry) => ({
    entry,
    copy: entry.textByLocale
      ? { text: entry.textByLocale[getTutorialLocale()] || entry.textByLocale.en || "" }
      : copy[copyIndex++] || {}
  }))
    .filter(({ entry }) => {
      if (entry.requiresCoffee && !supporterState.coffeeVisible) {
        return false;
      }
      if (entry.requiresSupporters && !supporterState.carouselActive) {
        return false;
      }
      return true;
    });

  return entries.map(({ entry, copy: stepCopy }, index) => ({
    ...entry,
    ...stepCopy,
    done: index === entries.length - 1
  }));
}

async function beginTutorialRoute(tourName, options = {}) {
  const force = options.force === true;
  const config = TUTORIAL_ROUTE_CONFIG[tourName];

  if (!config || activeStepIndex >= 0) {
    return;
  }

  if (tourName === "tibia-mirror" || tourName === "sqm-finder" || tourName === "alerts") {
    const mirrorApi = await waitForTibiaMirrorTutorialApi();
    const ready = await mirrorApi?.ensureTibiaReady?.();
    if (!ready) {
      tibiaMirrorTutorialRestartPending = tourName;
      return;
    }
  }

  if (!force && config.launchPolicy === "first-visit" && hasTutorialBeenSeen(config)) {
    return;
  }

  if (!force && config.launchPolicy === "session" && tutorialRoutesStartedThisSession.has(tourName)) {
    return;
  }

  if (!force) {
    tutorialRoutesStartedThisSession.add(tourName);
    markTutorialSeen(config);
  }

  if (tourName === "tools") {
    imbuementTourStateSnapshot ??= getTutorialApi()?.getImbuementTourState?.() || null;
  }
  if (tourName === "analyzer" || tourName === "solo-analyzer") {
    analyzerTourStateSnapshot ??= getTutorialApi()?.getLootAnalyzerTourState?.() || null;
  }
  if (tourName === "party-finder") {
    findPartyTourStateSnapshot ??= getTutorialApi()?.getFindPartyTourState?.() || null;
  }
  if (tourName === "skill-calculator") {
    skillCalculatorTourStateSnapshot ??= getTutorialApi()?.getSkillCalculatorTourState?.() || null;
  }
  if (tourName === "npcs") {
    npcCatalogTourStateSnapshot ??= getTutorialApi()?.getNpcCatalogTourState?.() || null;
  }
  if (tourName === "bestiary") {
    bestiaryTourStateSnapshot ??= getTutorialApi()?.getBestiaryTourState?.() || null;
  }
  if (tourName === "bosstiary") {
    bosstiaryTourStateSnapshot ??= getTutorialApi()?.getBossiaryTourState?.() || null;
  }

  await runStep(0, tourName);
}

async function typeSearchText(text) {
  const input = document.querySelector("#item-slug-input");

  if (!input) {
    return;
  }

  input.focus();
  input.value = "";

  for (const char of text) {
    input.value += char;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(35);
  }

  await getTutorialApi()?.typeItemSearch?.(text);
}

async function runImbuementTierDemo() {
  const api = getTutorialApi();
  api?.configureImbuementTour?.({
    toolTab: "imbuement",
    pickerOpen: false,
    currency: "gold",
    manualIngredientsEnabled: false,
    mixedPurchaseEnabled: false
  });

  const tiers = ["basic", "intricate", "powerful"];
  for (const tier of tiers) {
    const button = document.querySelector(`#imbuement-tier-switch [data-tier="${tier}"]`);
    button?.classList.add("tt-tutorial-demo-hover");
    button?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await wait(240);
    button?.classList.remove("tt-tutorial-demo-hover");
  }

  api?.configureImbuementTour?.({ tier: "powerful" });
  const powerfulButton = document.querySelector('#imbuement-tier-switch [data-tier="powerful"]');
  powerfulButton?.classList.add("tt-tutorial-demo-hover");
  powerfulButton?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
}

function blockTutorialInteraction(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function setTutorialInteractionBlocked(blocked) {
  if (tutorialInteractionBlocked === blocked) {
    return;
  }

  tutorialInteractionBlocked = blocked;
  document.body.classList.toggle("tt-tutorial-interaction-blocked", blocked);
  const method = blocked ? "addEventListener" : "removeEventListener";
  for (const eventName of [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "click",
    "contextmenu",
    "keydown",
    "keyup",
    "wheel",
    "touchstart",
    "touchend",
    "submit"
  ]) {
    document[method](eventName, blockTutorialInteraction, true);
  }
}

function toAbsoluteAssetUrl(assetPath) {
  return new URL(assetPath, window.location.href).href;
}

function setTutorialUpdateDemo(active) {
  const updateButton = document.querySelector("#desktop-update-button");

  if (active) {
    if (updateButton && updateButton.dataset.tutorialWasHidden === undefined) {
      updateButton.dataset.tutorialWasHidden = String(updateButton.hidden);
      updateButton.hidden = false;
    }
    document.body.classList.add("tt-tutorial-update-demo");
    return;
  }

  document.body.classList.remove("tt-tutorial-update-demo");
  if (updateButton?.dataset.tutorialWasHidden !== undefined) {
    updateButton.hidden = updateButton.dataset.tutorialWasHidden === "true";
    delete updateButton.dataset.tutorialWasHidden;
  }
}

async function closeActiveStep({
  releaseInteraction = true,
  unlockWindow = true,
  restoreTourState = true,
  cleanupTransient = true,
  invalidateTransition = true
} = {}) {
  if (invalidateTransition) {
    activeStepTransitionId += 1;
  }
  const closingTourName = activeTourName;
  if (cleanupTransient) {
    setTutorialUpdateDemo(false);
    document.body.classList.remove("tt-solo-events-tutorial");
    document.querySelector("#tt-solo-events-focus")?.remove();
    document.querySelectorAll(".tt-tutorial-demo-hover").forEach((element) => {
      element.classList.remove("tt-tutorial-demo-hover");
    });
    document.querySelectorAll(".tt-tutorial-compact-focus").forEach((element) => {
      element.classList.remove("tt-tutorial-compact-focus");
    });
  }
  removeNextListener?.();
  removeNextListener = null;
  removeCancelListener?.();
  removeCancelListener = null;
  activeTour?.destroy?.();
  activeTour = null;
  activeStepIndex = -1;
  activeTourName = "item-prices";
  ensureContextTutorialButton();
  if (releaseInteraction) {
    setTutorialInteractionBlocked(false);
  }
  if (unlockWindow) {
    await window.desktopApi?.app?.tutorial?.restoreWindowBounds?.();
    await window.desktopApi?.app?.tutorial?.setWindowLocked?.(false);
  }
  await window.desktopApi?.app?.tutorial?.closeStep?.();
  if (restoreTourState && closingTourName === "tools" && imbuementTourStateSnapshot) {
    getTutorialApi()?.restoreImbuementTourState?.(imbuementTourStateSnapshot);
    imbuementTourStateSnapshot = null;
  }
  if (restoreTourState && closingTourName === "analyzer" && analyzerTourStateSnapshot) {
    getTutorialApi()?.restoreLootAnalyzerTourState?.(analyzerTourStateSnapshot, { endMode: "party" });
    analyzerTourStateSnapshot = null;
  }
  if (restoreTourState && closingTourName === "solo-analyzer" && analyzerTourStateSnapshot) {
    getTutorialApi()?.restoreLootAnalyzerTourState?.(analyzerTourStateSnapshot, { endMode: "solo" });
    analyzerTourStateSnapshot = null;
  }
  if (restoreTourState && closingTourName === "party-finder" && findPartyTourStateSnapshot) {
    getTutorialApi()?.restoreFindPartyTourState?.(findPartyTourStateSnapshot);
    findPartyTourStateSnapshot = null;
  }
  if (restoreTourState && closingTourName === "skill-calculator" && skillCalculatorTourStateSnapshot) {
    getTutorialApi()?.restoreSkillCalculatorTourState?.(skillCalculatorTourStateSnapshot);
    skillCalculatorTourStateSnapshot = null;
  }
  if (restoreTourState && closingTourName === "npcs" && npcCatalogTourStateSnapshot) {
    getTutorialApi()?.restoreNpcCatalogTourState?.(npcCatalogTourStateSnapshot);
    npcCatalogTourStateSnapshot = null;
  }
  if (restoreTourState && closingTourName === "bestiary" && bestiaryTourStateSnapshot) {
    getTutorialApi()?.restoreBestiaryTourState?.(bestiaryTourStateSnapshot);
    bestiaryTourStateSnapshot = null;
  }
  if (restoreTourState && closingTourName === "bosstiary" && bosstiaryTourStateSnapshot) {
    getTutorialApi()?.restoreBossiaryTourState?.(bosstiaryTourStateSnapshot);
    bosstiaryTourStateSnapshot = null;
  }
  if (restoreTourState && closingTourName === "tibia-mirror") {
    await getTibiaMirrorTutorialApi()?.finishProfileDemo?.();
  }
  if (restoreTourState && closingTourName === "sqm-finder") {
    await getTibiaMirrorTutorialApi()?.finishSqmFinderDemo?.();
  }
  if (restoreTourState && closingTourName === "alerts") {
    await getTibiaMirrorTutorialApi()?.finishAlertDemo?.();
  }
}

async function runStep(index = 0, tourName = "item-prices") {
  const steps = getTourSteps(tourName);

  if (index >= steps.length) {
    await closeActiveStep();
    if (tourName === "tibia-mirror-intro") {
      await beginTutorialRoute("tibia-mirror");
    }
    return;
  }

  // Stop listening to the previous popover before any asynchronous setup.
  // Otherwise a slower item/network transition can accept the same click more
  // than once and start overlapping runs of the same step.
  removeNextListener?.();
  removeNextListener = null;
  removeCancelListener?.();
  removeCancelListener = null;
  const transitionId = ++activeStepTransitionId;

  activeStepIndex = index;
  activeTourName = tourName;
  ensureContextTutorialButton();
  setTutorialInteractionBlocked(true);
  await window.desktopApi?.app?.tutorial?.setWindowLocked?.(true);
  if (transitionId !== activeStepTransitionId) {
    return;
  }

  // Remove the old clickable popover while the new screen state is prepared.
  await window.desktopApi?.app?.tutorial?.closeStep?.();
  if (transitionId !== activeStepTransitionId) {
    return;
  }

  const step = steps[index];
  try {
    await step.before?.();
  } catch (error) {
    console.error(`[tutorial] Failed to prepare ${tourName} step ${index + 1}`, error);
  }
  if (transitionId !== activeStepTransitionId) {
    return;
  }

  const selector = typeof step.selector === "function" ? step.selector() : step.selector;
  const element = getElement(selector);

  const preserveTransient = tourName === "solo-analyzer" && index === steps.length - 1;
  await closeActiveStep({
    releaseInteraction: false,
    unlockWindow: false,
    restoreTourState: false,
    cleanupTransient: !preserveTransient,
    invalidateTransition: false
  });
  if (transitionId !== activeStepTransitionId) {
    return;
  }
  setTutorialUpdateDemo(step.simulateUpdate === true);
  activeStepIndex = index;
  activeTourName = tourName;
  activeTour = driver({
    animate: true,
    allowClose: false,
    overlayOpacity: 0.66,
    stagePadding: 8,
    stageRadius: 4,
    showButtons: [],
    disableActiveInteraction: true,
    steps: [
      {
        element
      }
    ]
  });

  activeTour.drive();
  setTutorialInteractionBlocked(true);
  // Some screens replace their own controls right before the first tooltip.
  // Let those DOM updates settle before opening the separate animated window.
  await wait(Number(step.popoverDelayMs) || (tourName === "stash" ? 10 : 60));

  const rect = element.getBoundingClientRect();
  const actionCopy = getTutorialActionCopy();
  await window.desktopApi?.app?.tutorial?.showStep?.({
    rect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    },
    gif: toAbsoluteAssetUrl(step.gif || TUTORIAL_ASSETS.default),
    hideGif: step.hideGif === true,
    gifFit: step.gifFit || "cover",
    gifNatural: step.gifNatural === true,
    supplementalImages: Array.isArray(step.supplementalImages)
      ? step.supplementalImages.map((assetPath) => toAbsoluteAssetUrl(assetPath))
      : [],
    longCopy: step.longCopy === true,
    text: step.text || "",
    html: step.html || "",
    placement: step.placement || "",
    height: step.popoverHeight || 0,
    autoHeight: true,
    progress: `${index + 1}/${steps.length}`,
    buttonIcon: toAbsoluteAssetUrl(step.done ? TUTORIAL_ASSETS.tick : TUTORIAL_ASSETS.continue),
    buttonLabel: step.done ? actionCopy.done : actionCopy.next,
    cancelIcon: toAbsoluteAssetUrl(TUTORIAL_ASSETS.cancel),
    cancelLabel: actionCopy.cancel
  });
  if (transitionId !== activeStepTransitionId) {
    return;
  }

  removeNextListener = window.desktopApi?.app?.tutorial?.onNext?.(() => {
    removeNextListener?.();
    removeNextListener = null;
    void runStep(index + 1, tourName);
  }) || null;
  removeCancelListener = window.desktopApi?.app?.tutorial?.onCancel?.(() => {
    removeCancelListener?.();
    removeCancelListener = null;
    tibiaMirrorTutorialRestartPending = false;
    void closeActiveStep();
  }) || null;
}

function renderTutorialLocaleButtons() {
  const activeLocale = getTutorialLocale();

  return TUTORIAL_LOCALE_OPTIONS.map((option) => `
    <button
      type="button"
      class="tt-tour-locale-button${option.code === activeLocale ? " active" : ""}"
      data-tt-tour-locale="${option.code}"
      title="${escapeHtml(t(option.labelKey))}"
      aria-label="${escapeHtml(t(option.labelKey))}"
    >
      <img src="${escapeHtml(option.flagSrc)}" alt="${escapeHtml(option.flagAlt)}">
    </button>
  `).join("");
}

function closeWelcome() {
  document.querySelector(".tt-tour-welcome-overlay")?.remove();
  ensureContextTutorialButton();
}

function openWelcome() {
  closeWelcome();
  void window.desktopApi?.app?.tutorial?.setWindowLocked?.(true);
  const copy = getTutorialWelcomeCopy();

  const overlay = document.createElement("div");
  overlay.className = "tt-tour-welcome-overlay";
  overlay.innerHTML = `
    <section class="tt-tour-welcome-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(copy.ariaLabel)}">
      <div class="tt-tour-welcome-topbar">
        <div class="tt-tour-locale-selector" aria-label="${escapeHtml(t("locale.switcher.aria"))}">
          ${renderTutorialLocaleButtons()}
        </div>
      </div>
      <h2>${escapeHtml(copy.title)}</h2>
      <img class="tt-tour-welcome-gif" src="${escapeHtml(TUTORIAL_ASSETS.welcome)}" alt="">
      <p class="tt-tour-welcome-lead">${copy.lead}</p>
      <p>${escapeHtml(copy.paragraphOne)}</p>
      <p>${escapeHtml(copy.paragraphTwo)}</p>
      <div class="tt-tour-welcome-actions">
        <button type="button" class="tt-tour-modal-button" data-tt-tour-cancel data-tooltip="${escapeHtml(copy.cancelTooltip)}" aria-label="${escapeHtml(copy.cancelAria)}">
          <img src="${escapeHtml(TUTORIAL_ASSETS.cancel)}" alt="">
        </button>
        <button type="button" class="tt-tour-modal-button" data-tt-tour-start data-tooltip="${escapeHtml(copy.startTooltip)}" aria-label="${escapeHtml(copy.startAria)}">
          <img src="${escapeHtml(TUTORIAL_ASSETS.tick)}" alt="">
        </button>
      </div>
    </section>
  `;

  document.body.appendChild(overlay);
  ensureContextTutorialButton();

  overlay.querySelectorAll("[data-tt-tour-locale]").forEach((button) => {
    button.addEventListener("click", async () => {
      const locale = button.getAttribute("data-tt-tour-locale") || "en";
      if (locale === getTutorialLocale()) {
        return;
      }

      setAppLocale(locale);
      await window.desktopApi?.locale?.set?.(locale).catch(() => {});
      openWelcome();
    });
  });

  overlay.querySelector("[data-tt-tour-cancel]")?.addEventListener("click", () => {
    markWelcomeSeen();
    closeWelcome();
    void window.desktopApi?.app?.tutorial?.setWindowLocked?.(false);
  });

  overlay.querySelector("[data-tt-tour-start]")?.addEventListener("click", () => {
    markWelcomeSeen();
    markTutorialSeen(TUTORIAL_ROUTE_CONFIG["item-prices"]);
    closeWelcome();
    void beginTutorialRoute("item-prices", { force: true });
  });
}

function openWelcomeIfNeeded() {
  try {
    if (window.localStorage.getItem(TUTORIAL_WELCOME_STORAGE_KEY) === "true") {
      return;
    }
  } catch (_error) {
  }

  const tryOpen = () => {
    if (document.body.classList.contains("app-booting")) {
      window.setTimeout(tryOpen, 350);
      return;
    }

    window.setTimeout(() => {
      openWelcome();
    }, 500);
  };

  tryOpen();
}

function closeTutorialConfirmation() {
  document.querySelector(".tt-tour-confirm-overlay")?.remove();
  ensureContextTutorialButton();
}

function openTutorialConfirmation({ tourName = "item-prices", resetAll = false } = {}) {
  if (activeStepIndex >= 0 || document.querySelector(".tt-tour-confirm-overlay")) {
    return;
  }

  const copy = getTutorialConfirmationCopy();
  const title = resetAll ? copy.resetTitle : copy.title;
  const message = resetAll ? copy.resetMessage : copy.message;
  const overlay = document.createElement("div");
  overlay.className = "tt-tour-confirm-overlay";
  overlay.innerHTML = `
    <section class="tt-tour-confirm-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <h2>${escapeHtml(title)}</h2>
      <img class="tt-tour-confirm-gif" src="${escapeHtml(getTutorialConfirmationGif())}" alt="">
      <p>${escapeHtml(message)}</p>
      <div class="tt-tour-welcome-actions">
        <button type="button" class="tt-tour-modal-button" data-tt-tour-confirm-cancel data-tooltip="${escapeHtml(copy.cancelTooltip)}" aria-label="${escapeHtml(copy.cancelAria)}">
          <img src="${escapeHtml(TUTORIAL_ASSETS.cancel)}" alt="">
        </button>
        <button type="button" class="tt-tour-modal-button" data-tt-tour-confirm-accept data-tooltip="${escapeHtml(copy.confirmTooltip)}" aria-label="${escapeHtml(copy.confirmAria)}">
          <img src="${escapeHtml(TUTORIAL_ASSETS.tick)}" alt="">
        </button>
      </div>
    </section>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("[data-tt-tour-confirm-cancel]")?.addEventListener("click", closeTutorialConfirmation);
  overlay.querySelector("[data-tt-tour-confirm-accept]")?.addEventListener("click", () => {
    closeTutorialConfirmation();
    if (resetAll) {
      clearTutorialProgress();
      openWelcome();
      return;
    }
    void beginTutorialRoute(tourName, { force: true });
  });
}

function getTutorialConfirmationGif() {
  return window.desktopApi?.app?.runtimeChannel === "production"
    ? "assets/ui/tutorial/tutorial.gif"
    : TUTORIAL_ASSETS.default;
}

function getActiveContextTourName() {
  const activeSection = document.querySelector(".nav-button.active")?.dataset.section || "item-prices";
  if (activeSection === "item-prices") {
    return document.querySelector('[data-item-view="stash"].active') ? "stash" : "item-prices";
  }
  if (activeSection === "npcs") {
    const entityView = document.querySelector(".entity-tab.active")?.dataset.entityView || "npcs";
    return entityView === "monsters" ? "bestiary" : entityView === "bosses" ? "bosstiary" : "npcs";
  }
  if (activeSection !== "tools") {
    return "item-prices";
  }

  const toolTab = document.querySelector(".tool-tab.active")?.dataset.toolTab || "imbuement";
  if (toolTab === "loot-splitter") {
    return document.querySelector('[data-loot-mode="solo"].active') ? "solo-analyzer" : "analyzer";
  }
  if (toolTab === "find-party") {
    return "party-finder";
  }
  if (toolTab === "skill-calculator") {
    return "skill-calculator";
  }
  if (toolTab === "screen-vision") {
    return "tibia-mirror-intro";
  }
  return "tools";
}

function ensureContextTutorialButton() {
  let button = document.querySelector("#tt-tour-context-button");
  if (!button) {
    button = document.createElement("button");
    button.id = "tt-tour-context-button";
    button.type = "button";
    button.className = "tt-tour-context-button";
    button.innerHTML = `<img src="${escapeHtml(TUTORIAL_ASSETS.question)}" alt="">`;
    button.addEventListener("click", () => {
      openTutorialConfirmation({ tourName: button.dataset.tourName || "item-prices" });
    });
  }

  // In the desktop shell, the main-section tabs live in the sidebar row. Keep
  // the contextual tutorial entry point in that same row so it follows the
  // active workspace instead of floating over the content below it.
  const host = document.querySelector("body.desktop-mode .sidebar") || document.body;
  if (button.parentElement !== host) {
    host.appendChild(button);
  }

  const tourName = getActiveContextTourName();
  button.dataset.tourName = tourName;
  const copy = getTutorialConfirmationCopy();
  button.dataset.tooltip = copy.contextTooltip;
  button.title = copy.contextTooltip;
  button.setAttribute("aria-label", copy.contextTooltip);
  button.hidden = activeStepIndex >= 0 || Boolean(document.querySelector(".tt-tour-welcome-overlay"));
}

function bindContextTutorialButton() {
  ensureContextTutorialButton();
  document.addEventListener("click", () => {
    window.setTimeout(ensureContextTutorialButton, 0);
  }, true);
  new MutationObserver(() => ensureContextTutorialButton()).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"]
  });
}

window.desktopApi?.locale?.onChanged?.((locale) => {
  setAppLocale(locale);

  if (document.querySelector(".tt-tour-welcome-overlay")) {
    openWelcome();
    return;
  }

  if (activeStepIndex >= 0) {
    void runStep(activeStepIndex, activeTourName);
  }

  ensureContextTutorialButton();
});

window.desktopApi?.app?.tutorial?.onResetAll?.(() => {
  openTutorialConfirmation({ resetAll: true });
});

window.addEventListener("tibia-mirror:tibia-readiness", (event) => {
  // A tutorial only needs Tibia physically open and visible. The stricter
  // mirror-overlay flag can momentarily change while its own popover owns the
  // foreground, which must not restart the walkthrough.
  const ready = event?.detail?.tutorialReady === true;

  if (!ready && ["tibia-mirror", "sqm-finder", "alerts"].includes(activeTourName) && activeStepIndex >= 0) {
    const closingRoute = activeTourName;
    tibiaMirrorTutorialRestartPending = closingRoute;
    if (closingRoute === "sqm-finder") {
      void getTibiaMirrorTutorialApi()?.finishSqmFinderDemo?.({ closePanel: true });
    }
    if (closingRoute === "alerts") {
      void getTibiaMirrorTutorialApi()?.finishAlertDemo?.({ closePanel: true });
    }
    void closeActiveStep();
    return;
  }

  if (ready && tibiaMirrorTutorialRestartPending) {
    const restartRoute = tibiaMirrorTutorialRestartPending;
    tibiaMirrorTutorialRestartPending = false;
    window.setTimeout(() => {
      void beginTutorialRoute(restartRoute, { force: true });
    }, 180);
  }
});

window.TibiaToolsTutorial = {
  openWelcome,
  startItemPricesTour: () => beginTutorialRoute("item-prices", { force: true }),
  startStashTour: () => beginTutorialRoute("stash", { force: true }),
  startToolsTour: () => beginTutorialRoute("tools", { force: true }),
  startAnalyzerTour: () => beginTutorialRoute("analyzer", { force: true }),
  startSoloAnalyzerTour: () => beginTutorialRoute("solo-analyzer", { force: true }),
  startPartyFinderTour: () => beginTutorialRoute("party-finder", { force: true }),
  startSkillCalculatorTour: () => beginTutorialRoute("skill-calculator", { force: true }),
  startNpcsTour: () => beginTutorialRoute("npcs", { force: true }),
  startBestiaryTour: () => beginTutorialRoute("bestiary", { force: true }),
  startBossiaryTour: () => beginTutorialRoute("bosstiary", { force: true }),
  startTibiaMirrorTour: () => beginTutorialRoute("tibia-mirror-intro", { force: true }),
  startSqmFinderTour: () => beginTutorialRoute("sqm-finder", { force: true }),
  startAlertsTour: () => beginTutorialRoute("alerts", { force: true }),
  close: () => {
    void closeActiveStep();
    closeWelcome();
  },
  resetAll: () => openTutorialConfirmation({ resetAll: true })
};

function bindStashTourTrigger() {
  const stashTab = document.querySelector('[data-item-view="stash"]');
  if (!stashTab || stashTab.dataset.tutorialStashBound === "true") {
    return;
  }

  stashTab.dataset.tutorialStashBound = "true";
  stashTab.addEventListener("click", () => {
    void beginTutorialRoute("stash");
  });
}

function bindToolsTourTrigger() {
  const toolsTab = document.querySelector('[data-section="tools"]');
  if (!toolsTab || toolsTab.dataset.tutorialToolsBound === "true") {
    return;
  }

  toolsTab.dataset.tutorialToolsBound = "true";
  toolsTab.addEventListener("click", () => {
    void beginTutorialRoute("tools");
  });
}

function bindAnalyzerTourTrigger() {
  const analyzerTab = document.querySelector('[data-tool-tab="loot-splitter"]');
  if (!analyzerTab || analyzerTab.dataset.tutorialAnalyzerBound === "true") {
    return;
  }

  analyzerTab.dataset.tutorialAnalyzerBound = "true";
  analyzerTab.addEventListener("click", () => {
    void beginTutorialRoute("analyzer");
  });
}

function bindSoloAnalyzerTourTrigger() {
  const soloTab = document.querySelector('[data-loot-mode="solo"]');
  if (!soloTab || soloTab.dataset.tutorialSoloAnalyzerBound === "true") {
    return;
  }

  soloTab.dataset.tutorialSoloAnalyzerBound = "true";
  soloTab.addEventListener("click", () => {
    void beginTutorialRoute("solo-analyzer");
  });
}

function bindPartyFinderTourTrigger() {
  const partyFinderTab = document.querySelector('[data-tool-tab="find-party"]');
  if (!partyFinderTab || partyFinderTab.dataset.tutorialPartyFinderBound === "true") {
    return;
  }

  partyFinderTab.dataset.tutorialPartyFinderBound = "true";
  partyFinderTab.addEventListener("click", () => {
    void beginTutorialRoute("party-finder");
  });
}

function bindSkillCalculatorTourTrigger() {
  const skillCalculatorTab = document.querySelector('[data-tool-tab="skill-calculator"]');
  if (!skillCalculatorTab || skillCalculatorTab.dataset.tutorialSkillCalculatorBound === "true") {
    return;
  }

  skillCalculatorTab.dataset.tutorialSkillCalculatorBound = "true";
  skillCalculatorTab.addEventListener("click", () => {
    void beginTutorialRoute("skill-calculator");
  });
}

function bindNpcsTourTrigger() {
  const npcsTab = document.querySelector('[data-section="npcs"]');
  if (!npcsTab || npcsTab.dataset.tutorialNpcsBound === "true") {
    return;
  }

  npcsTab.dataset.tutorialNpcsBound = "true";
  npcsTab.addEventListener("click", () => {
    // Let the regular tab handler load the local NPC catalog first.
    window.setTimeout(() => void beginTutorialRoute("npcs"), 180);
  });
}

function bindBestiaryTourTrigger() {
  const bestiaryTab = document.querySelector('[data-entity-view="monsters"]');
  if (!bestiaryTab || bestiaryTab.dataset.tutorialBestiaryBound === "true") {
    return;
  }

  bestiaryTab.dataset.tutorialBestiaryBound = "true";
  bestiaryTab.addEventListener("click", () => {
    // The normal tab handler loads the local creature catalog before the tour
    // creates its first spotlight.
    window.setTimeout(() => void beginTutorialRoute("bestiary"), 180);
  });
}

function bindBossiaryTourTrigger() {
  const bosstiaryTab = document.querySelector('[data-entity-view="bosses"]');
  if (!bosstiaryTab || bosstiaryTab.dataset.tutorialBossiaryBound === "true") {
    return;
  }

  bosstiaryTab.dataset.tutorialBossiaryBound = "true";
  bosstiaryTab.addEventListener("click", () => {
    window.setTimeout(() => void beginTutorialRoute("bosstiary"), 180);
  });
}

function bindTibiaMirrorTourTrigger() {
  const tibiaMirrorTab = document.querySelector('[data-tool-tab="screen-vision"]');
  if (!tibiaMirrorTab || tibiaMirrorTab.dataset.tutorialTibiaMirrorBound === "true") {
    return;
  }

  tibiaMirrorTab.dataset.tutorialTibiaMirrorBound = "true";
  tibiaMirrorTab.addEventListener("click", () => {
    void beginTutorialRoute("tibia-mirror-intro");
  });
}

function bindSqmFinderTourTrigger() {
  const sqmFinderButton = document.querySelector("#open-visual-customization-button");
  if (!sqmFinderButton || sqmFinderButton.dataset.tutorialSqmFinderBound === "true") {
    return;
  }

  sqmFinderButton.dataset.tutorialSqmFinderBound = "true";
  sqmFinderButton.addEventListener("click", () => {
    // The regular handler opens the docked panel. Start after that transition
    // so the first spotlight always receives a real panel control.
    window.setTimeout(() => void beginTutorialRoute("sqm-finder"), 260);
  });
}

function bindAlertsTourTrigger() {
  const alertsButton = document.querySelector("#open-alertas-button");
  if (!alertsButton || alertsButton.dataset.tutorialAlertsBound === "true") {
    return;
  }

  alertsButton.dataset.tutorialAlertsBound = "true";
  alertsButton.addEventListener("click", () => {
    // Let the regular handler open the docked panel before the tour anchors
    // itself to its controls.
    window.setTimeout(() => void beginTutorialRoute("alerts"), 260);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bindStashTourTrigger();
    bindToolsTourTrigger();
    bindAnalyzerTourTrigger();
    bindSoloAnalyzerTourTrigger();
    bindPartyFinderTourTrigger();
    bindSkillCalculatorTourTrigger();
    bindNpcsTourTrigger();
    bindBestiaryTourTrigger();
    bindBossiaryTourTrigger();
    bindTibiaMirrorTourTrigger();
    bindSqmFinderTourTrigger();
    bindAlertsTourTrigger();
    bindContextTutorialButton();
    openWelcomeIfNeeded();
  }, { once: true });
} else {
  bindStashTourTrigger();
  bindToolsTourTrigger();
  bindAnalyzerTourTrigger();
  bindSoloAnalyzerTourTrigger();
  bindPartyFinderTourTrigger();
  bindSkillCalculatorTourTrigger();
  bindNpcsTourTrigger();
  bindBestiaryTourTrigger();
  bindBossiaryTourTrigger();
  bindTibiaMirrorTourTrigger();
  bindSqmFinderTourTrigger();
  bindAlertsTourTrigger();
  bindContextTutorialButton();
  openWelcomeIfNeeded();
}
