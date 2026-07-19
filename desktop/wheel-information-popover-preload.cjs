const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wheelInformationPopoverApi", {
  onRender(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("wheel-information:render", listener);
    return () => ipcRenderer.removeListener("wheel-information:render", listener);
  },
  resizeToContent(height) {
    ipcRenderer.send("wheel-information:resize", height);
  }
});
