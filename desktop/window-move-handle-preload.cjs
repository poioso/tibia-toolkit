const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("windowMoveHandleApi", {
  setHovering(hovering) {
    ipcRenderer.send("window-move-handle:hover", Boolean(hovering));
  },
  startDrag(point) {
    ipcRenderer.send("window-move-handle:drag-start", point || {});
  },
  moveDrag(point) {
    ipcRenderer.send("window-move-handle:drag-move", point || {});
  },
  endDrag() {
    ipcRenderer.send("window-move-handle:drag-end");
  }
});
