const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mirrorGameSelectorApi", {
  choose(sourceGame) {
    return ipcRenderer.invoke("mirror-game-selector:choose", sourceGame);
  },
  hover(sourceGame) {
    ipcRenderer.send("mirror-game-selector:hover", sourceGame);
  },
  leave() {
    ipcRenderer.send("mirror-game-selector:leave");
  },
  onRender(callback) {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("mirror-game-selector:render", listener);
    return () => ipcRenderer.removeListener("mirror-game-selector:render", listener);
  }
});
