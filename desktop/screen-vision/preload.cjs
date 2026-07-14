const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("screenVisionApi", {
  data: {
    sendMessage(message) {
      return ipcRenderer.invoke("data:send-message", message);
    }
  },
  storage: {
    get(key) {
      return ipcRenderer.invoke("storage:get", key);
    },
    set(value) {
      return ipcRenderer.invoke("storage:set", value);
    }
  },
  locale: {
    get() {
      return ipcRenderer.invoke("storage:get", "appLocale");
    },
    set(locale) {
      return ipcRenderer.invoke("storage:set", { appLocale: locale });
    },
    onChanged(callback) {
      const listener = (_event, locale) => callback(locale);
      ipcRenderer.on("app:locale-changed", listener);
      return () => ipcRenderer.removeListener("app:locale-changed", listener);
    }
  },
  window: {
    minimize() {
      return ipcRenderer.invoke("screen-vision-window:minimize");
    },
    close() {
      return ipcRenderer.invoke("screen-vision-window:close");
    },
    resizeToContent(width, height) {
      return ipcRenderer.invoke("screen-vision-window:resize-to-content", { width, height });
    }
  },
  tools: {
    open(tool, options) {
      return ipcRenderer.invoke("screen-vision:open", { tool, options });
    }
  },
  tutorial: {
    resetAll() {
      return ipcRenderer.invoke("screen-vision:tutorial:reset-all");
    }
  },
  dialogs: {
    confirm(payload) {
      return ipcRenderer.invoke("screen-vision:dialogs:confirm", payload);
    },
    prompt(payload) {
      return ipcRenderer.invoke("screen-vision:dialogs:prompt", payload);
    },
    pickAudioFile() {
      return ipcRenderer.invoke("screen-vision:dialogs:pick-audio-file");
    }
  },
  obs: {
    getStatus() {
      return ipcRenderer.invoke("screen-vision:obs:get-status");
    },
    toggle() {
      return ipcRenderer.invoke("screen-vision:obs:toggle");
    }
  },
  profiles: {
    list() {
      return ipcRenderer.invoke("screen-vision:profiles:list");
    },
    create(profileName, characterName) {
      return ipcRenderer.invoke("screen-vision:profiles:create", { profileName, characterName });
    },
    duplicate(profilePath) {
      return ipcRenderer.invoke("screen-vision:profiles:duplicate", { profilePath });
    },
    rename(profilePath, profileName) {
      return ipcRenderer.invoke("screen-vision:profiles:rename", { profilePath, profileName });
    },
    update(profilePath, payload = {}) {
      return ipcRenderer.invoke("screen-vision:profiles:update", {
        profilePath,
        profileName: payload.profileName,
        characterName: payload.characterName
      });
    },
    delete(profilePath) {
      return ipcRenderer.invoke("screen-vision:profiles:delete", { profilePath });
    },
    activate(profilePath) {
      return ipcRenderer.invoke("screen-vision:profiles:activate", { profilePath });
    },
    import() {
      return ipcRenderer.invoke("screen-vision:profiles:import");
    },
    export(profilePath) {
      return ipcRenderer.invoke("screen-vision:profiles:export", { profilePath });
    },
    resolveCharacters(names) {
      return ipcRenderer.invoke("screen-vision:profiles:resolve-characters", { names });
    }
  },
  regions: {
    list() {
      return ipcRenderer.invoke("screen-vision:regions:list");
    },
    get(regionId) {
      return ipcRenderer.invoke("screen-vision:regions:get", { regionId });
    },
    add() {
      return ipcRenderer.invoke("screen-vision:regions:add");
    },
    addFixed() {
      return ipcRenderer.invoke("screen-vision:regions:add-fixed");
    },
    reselect(regionId) {
      return ipcRenderer.invoke("screen-vision:regions:reselect", { regionId });
    },
    toggleVisibility(regionId) {
      return ipcRenderer.invoke("screen-vision:regions:toggle-visibility", { regionId });
    },
    toggleAllVisibility() {
      return ipcRenderer.invoke("screen-vision:regions:toggle-all-visibility");
    },
    toggleLock(regionId) {
      return ipcRenderer.invoke("screen-vision:regions:toggle-lock", { regionId });
    },
    toggleAllLock() {
      return ipcRenderer.invoke("screen-vision:regions:toggle-all-lock");
    },
    update(regionId, patch) {
      return ipcRenderer.invoke("screen-vision:regions:update", { regionId, patch });
    },
    previewOpacity(regionId, opacity) {
      return ipcRenderer.invoke("screen-vision:regions:preview-opacity", { regionId, opacity });
    },
    setOpacity(regionId, opacity) {
      return ipcRenderer.invoke("screen-vision:regions:set-opacity", { regionId, opacity });
    },
    openCountdownEditor(regionId) {
      return ipcRenderer.invoke("screen-vision:regions:open-countdown-editor", { regionId });
    },
    startCountdown(regionId) {
      return ipcRenderer.invoke("screen-vision:regions:start-countdown", { regionId });
    },
    stopCountdown(regionId) {
      return ipcRenderer.invoke("screen-vision:regions:stop-countdown", { regionId });
    },
    unsnap(regionId) {
      return ipcRenderer.invoke("screen-vision:regions:unsnap", { regionId });
    },
    delete(regionId) {
      return ipcRenderer.invoke("screen-vision:regions:delete", { regionId });
    }
  },
  visual: {
    get() {
      return ipcRenderer.invoke("screen-vision:visual:get");
    },
    update(patch) {
      return ipcRenderer.invoke("screen-vision:visual:update", { patch });
    },
    preview(patch) {
      return ipcRenderer.invoke("screen-vision:visual:preview", { patch });
    }
  },
  grid: {
    get() {
      return ipcRenderer.invoke("screen-vision:grid:get");
    },
    toggle() {
      return ipcRenderer.invoke("screen-vision:grid:toggle");
    }
  },
  selection: {
    complete(payload) {
      return ipcRenderer.invoke("screen-vision:selection:complete", payload);
    },
    cancel() {
      return ipcRenderer.invoke("screen-vision:selection:cancel");
    },
    getCursorPoint() {
      return ipcRenderer.invoke("screen-vision:selection:get-cursor-point");
    }
  },
  tibia: {
    getState() {
      return ipcRenderer.invoke("screen-vision:tibia:get-state");
    }
  },
  capture: {
    async getScreenSources() {
      return ipcRenderer.invoke("screen-vision:capture:get-screen-sources");
    },
    async getWindowSources() {
      return ipcRenderer.invoke("screen-vision:capture:get-window-sources");
    }
  },
  timers: {
    getRuntime() {
      return ipcRenderer.invoke("screen-vision:timers:get-runtime");
    },
    start(payload) {
      return ipcRenderer.invoke("screen-vision:timers:start", payload);
    },
    stop(payload) {
      return ipcRenderer.invoke("screen-vision:timers:stop", payload);
    },
    showVisualAlert(payload) {
      return ipcRenderer.invoke("screen-vision:timers:show-visual-alert", payload);
    },
    hideVisualAlert(payload) {
      return ipcRenderer.invoke("screen-vision:timers:hide-visual-alert", payload);
    },
    openPositionEditor(payload) {
      return ipcRenderer.invoke("screen-vision:timers:open-position-editor", payload);
    },
    updatePositionEditor(payload) {
      return ipcRenderer.invoke("screen-vision:timers:update-position-editor", payload);
    },
    closePositionEditor(payload) {
      return ipcRenderer.invoke("screen-vision:timers:close-position-editor", payload);
    }
  },
  events: {
    onOverlayStateChanged(callback) {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("screen-vision:overlay-state-changed", listener);
      return () => ipcRenderer.removeListener("screen-vision:overlay-state-changed", listener);
    },
    onProfilesChanged(callback) {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("screen-vision:profiles-changed", listener);
      return () => ipcRenderer.removeListener("screen-vision:profiles-changed", listener);
    },
    onTimerRuntimeChanged(callback) {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("screen-vision:timers:runtime", listener);
      return () => ipcRenderer.removeListener("screen-vision:timers:runtime", listener);
    }
  }
});
