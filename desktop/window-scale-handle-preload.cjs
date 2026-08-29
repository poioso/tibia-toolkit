const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("windowScaleHandleApi", {
  setHovering(hovering) {
    ipcRenderer.send("window-scale-handle:hover", Boolean(hovering));
  },
  startDrag(point) {
    ipcRenderer.send("window-scale-handle:drag-start", point || {});
  },
  endDrag() {
    ipcRenderer.send("window-scale-handle:drag-end");
  }
});
