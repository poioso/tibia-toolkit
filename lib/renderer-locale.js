import {
  getAppLocale,
  loadStoredAppLocale,
  persistAppLocale,
  setAppLocale,
  syncDocumentLocale
} from "./app-i18n.js";
import { createDomLocalizer } from "./dom-localizer.js";

function resolveStorageBridge() {
  if (typeof window === "undefined") {
    return {};
  }

  return (
    window.desktopApi?.storage
    || window.screenVisionApi?.storage
    || window.desktopApi?.screenVisionApi?.storage
    || window.tutorialPopoverApi?.storage
    || {}
  );
}

function resolveLocaleBridge() {
  if (typeof window === "undefined") {
    return {};
  }

  return (
    window.desktopApi?.locale
    || window.screenVisionApi?.locale
    || window.desktopApi?.screenVisionApi?.locale
    || window.tutorialPopoverApi?.locale
    || {}
  );
}

export async function bootstrapRendererLocale({
  root = typeof document !== "undefined" ? document.body : null,
  onChanged
} = {}) {
  const storageBridge = resolveStorageBridge();
  const localeBridge = resolveLocaleBridge();
  const domLocalizer = createDomLocalizer({ root });
  await loadStoredAppLocale(
    typeof storageBridge.get === "function"
      ? storageBridge.get.bind(storageBridge)
      : null
  );
  syncDocumentLocale();
  await domLocalizer.start();

  if (typeof localeBridge.onChanged === "function") {
    localeBridge.onChanged((locale) => {
      setAppLocale(locale);
      syncDocumentLocale();
      void domLocalizer.refresh(root);
      if (typeof onChanged === "function") {
        onChanged(locale);
      }
    });
  }

  return {
    domLocalizer,
    getLocale: getAppLocale,
    async setLocale(locale) {
      const nextLocale = setAppLocale(locale);
      syncDocumentLocale();
      await persistAppLocale(
        typeof storageBridge.set === "function"
          ? storageBridge.set.bind(storageBridge)
          : null,
        nextLocale
      );
      await domLocalizer.refresh(root);
      if (typeof onChanged === "function") {
        onChanged(nextLocale);
      }
      return nextLocale;
    }
  };
}
