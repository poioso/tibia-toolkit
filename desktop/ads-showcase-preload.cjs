const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAdsApi", {
  onRender(callback) {
    const listener = (_event, payload) => callback(payload || null);
    ipcRenderer.on("desktop-ads:render", listener);
    return () => ipcRenderer.removeListener("desktop-ads:render", listener);
  },
  ready() {
    ipcRenderer.send("desktop-ads:ready");
  },
  open(url) {
    ipcRenderer.send("desktop-ads:open", String(url || ""));
  },
  hover(text, rect) {
    ipcRenderer.send("desktop-ads:hover", {
      text: String(text || "").slice(0, 500),
      rect: {
        left: Number(rect?.left) || 0,
        top: Number(rect?.top) || 0,
        width: Number(rect?.width) || 0,
        height: Number(rect?.height) || 0,
        screenLeft: Number(rect?.screenLeft) || 0,
        screenTop: Number(rect?.screenTop) || 0
      }
    });
  },
  leave() {
    ipcRenderer.send("desktop-ads:leave");
  },
  onResume(callback) {
    const listener = () => callback();
    ipcRenderer.on("desktop-ads:resume", listener);
    return () => ipcRenderer.removeListener("desktop-ads:resume", listener);
  }
});
