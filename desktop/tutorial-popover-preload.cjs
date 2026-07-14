const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tutorialPopoverApi", {
  storage: {
    get(key) {
      return ipcRenderer.invoke("storage:get", key);
    },
    set(value) {
      return ipcRenderer.invoke("storage:set", value);
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
  },
  onRender(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("tutorial-popover:render", listener);
    return () => ipcRenderer.removeListener("tutorial-popover:render", listener);
  },
  resizeToContent(height) {
    ipcRenderer.send("tutorial-popover:resize-to-content", height);
  },
  next() {
    ipcRenderer.send("tutorial-popover:next");
  }
});
