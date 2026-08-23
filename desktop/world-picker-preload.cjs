const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("worldPicker", {
  select(slug) {
    ipcRenderer.send("desktop:global-world-picker:select", String(slug || ""));
  },
  close() {
    ipcRenderer.send("desktop:global-world-picker:close");
  },
  onRender(callback) {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("desktop:global-world-picker:render", listener);
    return () => ipcRenderer.removeListener("desktop:global-world-picker:render", listener);
  }
});
