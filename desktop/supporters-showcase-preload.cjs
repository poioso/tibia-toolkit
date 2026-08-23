const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("supportersShowcaseApi", {
  onRender(callback) {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("supporters-showcase:render", listener);
    return () => ipcRenderer.removeListener("supporters-showcase:render", listener);
  },
  onTutorialFocus(callback) {
    const listener = (_event, target) => callback(String(target || ""));
    ipcRenderer.on("supporters-showcase:tutorial-focus", listener);
    return () => ipcRenderer.removeListener("supporters-showcase:tutorial-focus", listener);
  },
  openPanel() {
    ipcRenderer.send("supporters-showcase:open-panel");
  },
  openCoffeePanel() {
    ipcRenderer.send("supporters-showcase:open-coffee-panel");
  }
});
