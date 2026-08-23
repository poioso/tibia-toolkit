const { contextBridge, ipcRenderer } = require("electron");

// The selector reuses the existing Tibia Mirror selection surface, but its
// IPC is intentionally isolated so selecting a screenshot never touches a
// saved Mirror region.
contextBridge.exposeInMainWorld("screenVisionApi", {
  selection: {
    complete(payload) {
      return ipcRenderer.invoke("desktop:screenshot-selector:complete", payload || {});
    },
    cancel() {
      return ipcRenderer.invoke("desktop:screenshot-selector:cancel");
    }
  },
  preview: {
    get() {
      return ipcRenderer.invoke("desktop:screenshot-selector:get-preview");
    }
  },
  locale: {
    get() {
      return ipcRenderer.invoke("storage:get", "appLocale");
    },
    set(locale) {
      return ipcRenderer.invoke("storage:set", { appLocale: locale });
    },
    onChanged(callback) {
      const listener = (_event, locale) => callback(locale);
      ipcRenderer.on("app:locale-changed", listener);
      return () => ipcRenderer.removeListener("app:locale-changed", listener);
    }
  }
});
