const { contextBridge, ipcRenderer } = require("electron");
const runtimeChannelArgument = process.argv.find((argument) => argument.startsWith("--tibia-toolkit-runtime-channel="));
const runtimeChannel = runtimeChannelArgument
  ? runtimeChannelArgument.slice("--tibia-toolkit-runtime-channel=".length)
  : "production";

contextBridge.exposeInMainWorld("desktopApi", {
  app: {
    runtimeChannel,
    splashProgress(progress) {
      return ipcRenderer.invoke("app:splash-progress", progress);
    },
    splashStatus(status) {
      return ipcRenderer.invoke("app:splash-status", status);
    },
    readyToShow() {
      return ipcRenderer.invoke("app:ready-to-show");
    },
    getVersion() {
      return ipcRenderer.invoke("app:get-version");
    },
    tutorial: {
      showStep(payload) {
        return ipcRenderer.invoke("tutorial:show-step", payload);
      },
      closeStep() {
        return ipcRenderer.invoke("tutorial:close-step");
      },
      setWindowLocked(locked) {
        return ipcRenderer.invoke("tutorial:set-window-locked", Boolean(locked));
      },
      ensureWide() {
        return ipcRenderer.invoke("tutorial:ensure-wide");
      },
      ensureCompactCentered() {
        return ipcRenderer.invoke("tutorial:ensure-compact-centered");
      },
      prepareDockedPanel(panelKey) {
        return ipcRenderer.invoke("tutorial:prepare-docked-panel", panelKey);
      },
      restoreWindowBounds() {
        return ipcRenderer.invoke("tutorial:restore-window-bounds");
      },
      onNext(callback) {
        const listener = () => callback();
        ipcRenderer.on("tutorial:next", listener);
        return () => ipcRenderer.removeListener("tutorial:next", listener);
      },
      onResetAll(callback) {
        const listener = () => callback();
        ipcRenderer.on("tutorial:reset-all", listener);
        return () => ipcRenderer.removeListener("tutorial:reset-all", listener);
      }
    }
  },
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
  assets: {
    readJson(relativePath) {
      return ipcRenderer.invoke("assets:read-json", relativePath);
    }
  },
  supporters: {
    fetchDocument() {
      return ipcRenderer.invoke("supporters:fetch-document");
    }
  },
  updater: {
    getState() {
      return ipcRenderer.invoke("app-updater:get-state");
    },
    requestDownload() {
      return ipcRenderer.invoke("app-updater:request-download");
    },
    onChanged(callback) {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("app-updater:state", listener);
      return () => ipcRenderer.removeListener("app-updater:state", listener);
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
  overlay: {
    getState() {
      return ipcRenderer.invoke("overlay:get-state");
    },
    setOpacity(opacity) {
      return ipcRenderer.invoke("overlay:set-opacity", opacity);
    },
    minimize() {
      return ipcRenderer.invoke("overlay:minimize");
    },
    close() {
      return ipcRenderer.invoke("overlay:close");
    }
  },
  links: {
    openExternal(url) {
      return ipcRenderer.invoke("links:open-external", url);
    }
  },
  maps: {
    open(url, title) {
      return ipcRenderer.invoke("maps:open", { url, title });
    }
  },
  screenVision: {
    open(tool) {
      return ipcRenderer.invoke("screen-vision:open", { tool });
    },
    events: {
      onDockedToolPanelStateChanged(callback) {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on("docked-tool-panel:state", listener);
        return () => ipcRenderer.removeListener("docked-tool-panel:state", listener);
      }
    }
  },
  screenVisionApi: {
    data: {
      sendMessage(message) {
        return ipcRenderer.invoke("data:send-message", message);
      }
    },
    supporters: {
      fetchDocument() {
        return ipcRenderer.invoke("supporters:fetch-document");
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
    dialogs: {
      confirm(payload) {
        return ipcRenderer.invoke("screen-vision:dialogs:confirm", payload);
      },
      prompt(payload) {
        return ipcRenderer.invoke("screen-vision:dialogs:prompt", payload);
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
      hideVisualAlert(payload) {
        return ipcRenderer.invoke("screen-vision:timers:hide-visual-alert", payload);
      },
      showVisualAlert(payload) {
        return ipcRenderer.invoke("screen-vision:timers:show-visual-alert", payload);
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
      onTimerHotkey(callback) {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on("screen-vision:timers:hotkey", listener);
        return () => ipcRenderer.removeListener("screen-vision:timers:hotkey", listener);
      },
      onTimerRuntimeChanged(callback) {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on("screen-vision:timers:runtime", listener);
        return () => ipcRenderer.removeListener("screen-vision:timers:runtime", listener);
      },
      onDockedToolPanelStateChanged(callback) {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on("docked-tool-panel:state", listener);
        return () => ipcRenderer.removeListener("docked-tool-panel:state", listener);
      }
    }
  }
});
