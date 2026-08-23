const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("screenshotAssistantApi", {
  openDirectory() {
    return ipcRenderer.invoke("desktop:screenshot-assistant:open-directory");
  },
  reselect() {
    return ipcRenderer.invoke("desktop:screenshot-assistant:reselect");
  },
  getState() {
    return ipcRenderer.invoke("desktop:screenshot-assistant:get-state");
  },
  setEnabled(value) {
    return ipcRenderer.invoke("desktop:screenshot-assistant:set-enabled", Boolean(value));
  },
  toggleDeleteOriginal() {
    return ipcRenderer.invoke("desktop:screenshot-assistant:toggle-delete-original");
  },
  showAssistantHelp() {
    return ipcRenderer.invoke("desktop:screenshot-assistant:show-help");
  },
  onStatus(callback) {
    const listener = (_event, message) => callback(String(message || ""));
    ipcRenderer.on("desktop:screenshot:assistant-status", listener);
    return () => ipcRenderer.removeListener("desktop:screenshot:assistant-status", listener);
  },
  onNewScreenshotCount(callback) {
    const listener = (_event, count) => callback(Math.max(0, Number(count) || 0));
    ipcRenderer.on("desktop:screenshot:assistant-new-count", listener);
    return () => ipcRenderer.removeListener("desktop:screenshot:assistant-new-count", listener);
  },
  onState(callback) {
    const listener = (_event, payload) => callback(payload && typeof payload === "object" ? payload : {});
    ipcRenderer.on("desktop:screenshot:assistant-state", listener);
    return () => ipcRenderer.removeListener("desktop:screenshot:assistant-state", listener);
  },
  onTutorialFocus(callback) {
    const listener = (_event, active) => callback(Boolean(active));
    ipcRenderer.on("desktop:screenshot:assistant-tutorial-focus", listener);
    return () => ipcRenderer.removeListener("desktop:screenshot:assistant-tutorial-focus", listener);
  },
  close() {
    return ipcRenderer.invoke("desktop:screenshot-assistant:close");
  }
});
