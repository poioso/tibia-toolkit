const { contextBridge, ipcRenderer } = require("electron");

const dialogIdArg = process.argv.find((value) => value.startsWith("--screenvision-confirm-dialog-id=")) || "";
const dialogId = dialogIdArg.slice("--screenvision-confirm-dialog-id=".length);

contextBridge.exposeInMainWorld("screenVisionConfirmDialog", {
  submit(action, value = "", checked = false) {
    const allowedActions = new Set(["confirm", "cancel", "tray", "quit"]);
    ipcRenderer.send("screen-vision:confirm-dialog:action", {
      dialogId,
      action: allowedActions.has(action) ? action : "cancel",
      value: String(value ?? ""),
      checked: Boolean(checked)
    });
  },
  resizeToContent(height) {
    ipcRenderer.send("screen-vision:confirm-dialog:resize", {
      dialogId,
      height: Number(height) || 0
    });
  },
  onUpdate(callback) {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("screen-vision:confirm-dialog:update", listener);
    return () => ipcRenderer.removeListener("screen-vision:confirm-dialog:update", listener);
  }
});
