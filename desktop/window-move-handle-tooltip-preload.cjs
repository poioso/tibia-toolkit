const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("windowMoveHandleTooltipApi", {
  onRender(callback) {
    const listener = (_event, payload) => callback(
      payload && typeof payload === "object"
        ? { text: String(payload.text || ""), tone: payload.tone === "error" ? "error" : "default" }
        : { text: String(payload || ""), tone: "default" }
    );
    ipcRenderer.on("window-move-handle:tooltip", listener);
    return () => ipcRenderer.removeListener("window-move-handle:tooltip", listener);
  }
});
