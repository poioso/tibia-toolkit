import { getAppLocale, onLocaleChange, syncDocumentLocale, t } from "./app-i18n.js";
import { DEFAULT_LOCALE } from "./locale-state.js";
import {
  decodeMojibakeText,
  loadPhraseTranslationMap,
  translatePhraseSync
} from "./phrase-translations.js";

const TEXT_SOURCE_MAP = new WeakMap();
const TEXT_RENDERED_MAP = new WeakMap();
const ATTRIBUTE_SOURCE_MAP = new WeakMap();
const ATTRIBUTE_RENDERED_MAP = new WeakMap();
const TRANSLATABLE_ATTRIBUTES = ["title", "aria-label", "placeholder", "data-tooltip"];
const I18N_KEYED_ATTRIBUTE_MAP = {
  "data-i18n-title": "title",
  "data-i18n-aria-label": "aria-label",
  "data-i18n-placeholder": "placeholder",
  "data-i18n-tooltip": "data-tooltip"
};

function getAttributeMap(store, element) {
  let value = store.get(element);
  if (!value) {
    value = new Map();
    store.set(element, value);
  }
  return value;
}

function shouldSkipTextNode(node) {
  if (!node || !node.parentElement) {
    return true;
  }

  if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "PRE", "CODE", "KBD", "SAMP"].includes(node.parentElement.tagName)) {
    return true;
  }

  return Boolean(
    node.parentElement.closest(
      "[data-i18n],[data-i18n-html],[data-i18n-preserve],svg,picture,video,audio,canvas,iframe,object,embed"
    )
  );
}

function shouldSkipPhraseAttributes(element) {
  return Boolean(
    element?.matches?.("img,svg,picture,video,audio,source,track,canvas,iframe,object,embed,[data-i18n-preserve]")
    || element?.closest?.("[data-i18n-preserve]")
  );
}

function syncSourceText(node) {
  const currentText = String(node.textContent ?? "");
  const lastRendered = TEXT_RENDERED_MAP.get(node);

  if (!TEXT_SOURCE_MAP.has(node) || decodeMojibakeText(currentText) !== decodeMojibakeText(lastRendered ?? "")) {
    TEXT_SOURCE_MAP.set(node, currentText);
  }

  return TEXT_SOURCE_MAP.get(node) ?? currentText;
}

function preserveInlineTextSpacing(sourceText, translatedText) {
  const source = String(sourceText ?? "");
  const translated = String(translatedText ?? "");
  const leadingWhitespace = source.match(/^\s*/u)?.[0] || "";
  const trailingWhitespace = source.match(/\s*$/u)?.[0] || "";
  let next = translated.trim();

  // Phrase translations commonly trim their output. Preserve the separator
  // after punctuation so adjacent styled spans do not merge visually.
  const punctuationPrefix = source.match(/^([,.:;!?])(\s+)/u);
  if (punctuationPrefix && next.startsWith(punctuationPrefix[1])) {
    next = `${punctuationPrefix[1]}${punctuationPrefix[2]}${next.slice(1).trimStart()}`;
  }

  return `${leadingWhitespace}${next}${trailingWhitespace}`;
}

function syncSourceAttribute(element, attributeName) {
  const sourceMap = getAttributeMap(ATTRIBUTE_SOURCE_MAP, element);
  const renderedMap = getAttributeMap(ATTRIBUTE_RENDERED_MAP, element);
  const currentValue = String(element.getAttribute(attributeName) ?? "");
  const lastRendered = renderedMap.get(attributeName);

  if (!sourceMap.has(attributeName) || decodeMojibakeText(currentValue) !== decodeMojibakeText(lastRendered ?? "")) {
    sourceMap.set(attributeName, currentValue);
  }

  return sourceMap.get(attributeName) ?? currentValue;
}

function applyKeyedTranslations(root) {
  if (!(root instanceof Element) && root !== document.body && root !== document.documentElement) {
    return;
  }

  const keyedElements = [];

  if (root instanceof Element && (root.hasAttribute("data-i18n") || root.hasAttribute("data-i18n-html"))) {
    keyedElements.push(root);
  }

  if (root.querySelectorAll) {
    keyedElements.push(...root.querySelectorAll("[data-i18n],[data-i18n-html]"));
  }

  keyedElements.forEach((element) => {
    const htmlKey = element.getAttribute("data-i18n-html");
    const textKey = element.getAttribute("data-i18n");

    if (htmlKey) {
      element.innerHTML = t(htmlKey);
    } else if (textKey) {
      element.textContent = t(textKey);
    }

    Object.entries(I18N_KEYED_ATTRIBUTE_MAP).forEach(([sourceAttribute, targetAttribute]) => {
      const key = element.getAttribute(sourceAttribute);
      if (!key) {
        return;
      }
      element.setAttribute(targetAttribute, t(key));
    });
  });
}

function applyPhraseTranslations(root, locale, phraseMap) {
  const rootNode = root?.nodeType ? root : document.body;

  if (!rootNode) {
    return;
  }

  const textWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (textWalker.nextNode()) {
    textNodes.push(textWalker.currentNode);
  }

  textNodes.forEach((node) => {
    if (shouldSkipTextNode(node)) {
      return;
    }

    const sourceText = syncSourceText(node);
    const decodedText = decodeMojibakeText(sourceText);

    if (!decodedText.trim()) {
      return;
    }

    const nextText = preserveInlineTextSpacing(
      decodedText,
      translatePhraseSync(locale, decodedText, phraseMap)
    );

    if (node.textContent !== nextText) {
      node.textContent = nextText;
    }

    TEXT_RENDERED_MAP.set(node, nextText);
  });

  const elements = [];

  if (rootNode instanceof Element) {
    elements.push(rootNode);
  }

  if (rootNode.querySelectorAll) {
    elements.push(...rootNode.querySelectorAll("*"));
  }

  elements.forEach((element) => {
    // Only human-facing metadata is localized. Sources, styles, dimensions and
    // media elements stay untouched so translations cannot affect image layout.
    if (shouldSkipPhraseAttributes(element)) {
      return;
    }

    TRANSLATABLE_ATTRIBUTES.forEach((attributeName) => {
      if (!element.hasAttribute(attributeName)) {
        return;
      }

      const sourceValue = syncSourceAttribute(element, attributeName);
      const decodedValue = decodeMojibakeText(sourceValue);

      if (!decodedValue.trim()) {
        return;
      }

      const nextValue = translatePhraseSync(locale, decodedValue, phraseMap);

      if (element.getAttribute(attributeName) !== nextValue) {
        element.setAttribute(attributeName, nextValue);
      }

      getAttributeMap(ATTRIBUTE_RENDERED_MAP, element).set(attributeName, nextValue);
    });
  });
}

export function createDomLocalizer({ root = typeof document !== "undefined" ? document.body : null } = {}) {
  let observer = null;
  let queuedRoots = new Set();
  let flushTimer = 0;

  async function localize(targetRoot = root) {
    if (!targetRoot || typeof document === "undefined") {
      return;
    }

    const locale = getAppLocale();
    const phraseMap = await loadPhraseTranslationMap(locale);

    syncDocumentLocale(document);
    applyKeyedTranslations(targetRoot);
    applyPhraseTranslations(targetRoot, locale, phraseMap);
  }

  function queueRefresh(targetRoot) {
    if (!targetRoot) {
      return;
    }

    queuedRoots.add(targetRoot.nodeType === Node.TEXT_NODE ? targetRoot.parentElement : targetRoot);

    if (flushTimer) {
      return;
    }

    flushTimer = window.setTimeout(async () => {
      const roots = [...queuedRoots].filter(Boolean);
      queuedRoots = new Set();
      flushTimer = 0;

      if (roots.length === 0) {
        await localize(root);
        return;
      }

      for (const entry of roots) {
        await localize(entry);
      }
    }, 24);
  }

  return {
    async start() {
      if (!root || typeof document === "undefined") {
        return;
      }

      await localize(root);

      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              queueRefresh(node.nodeType === Node.TEXT_NODE ? mutation.target : node);
            });
            continue;
          }

          queueRefresh(mutation.target);
        }
      });

      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          ...TRANSLATABLE_ATTRIBUTES,
          ...Object.keys(I18N_KEYED_ATTRIBUTE_MAP),
          "data-i18n",
          "data-i18n-html"
        ]
      });

      onLocaleChange(() => {
        void localize(root);
      });
    },
    async refresh(targetRoot = root) {
      await localize(targetRoot);
    },
    stop() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (flushTimer) {
        window.clearTimeout(flushTimer);
        flushTimer = 0;
      }
    }
  };
}
