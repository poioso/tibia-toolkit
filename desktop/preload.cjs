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
    performanceMetric(name, details) {
      return ipcRenderer.invoke("app:performance-metric", name, details || {});
    },
    setMirrorGameSelectorVisible(visible) {
      return ipcRenderer.invoke("screen-vision:mirror-source:set-selector-visible", Boolean(visible));
    },
    onActivityStateChanged(callback) {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("app:activity-state", listener);
      return () => ipcRenderer.removeListener("app:activity-state", listener);
    },
      tutorial: {
        preload() {
          return ipcRenderer.invoke("tutorial:preload");
        },
        showStep(payload) {
        return ipcRenderer.invoke("tutorial:show-step", payload);
      },
      closeStep() {
        return ipcRenderer.invoke("tutorial:close-step");
      },
      setWindowLocked(locked) {
        return ipcRenderer.invoke("tutorial:set-window-locked", Boolean(locked));
      },
      setPriority(active) {
        return ipcRenderer.invoke("tutorial:set-priority", Boolean(active));
      },
      ensureWide() {
        return ipcRenderer.invoke("tutorial:ensure-wide");
      },
      focusSupportersShowcase(target) {
        return ipcRenderer.invoke("tutorial:focus-supporters-showcase", target);
      },
      focusMirrorGameSelector(active) {
        return ipcRenderer.invoke("tutorial:focus-mirror-game-selector", Boolean(active));
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
      onCancel(callback) {
        const listener = () => callback();
        ipcRenderer.on("tutorial:cancel", listener);
        return () => ipcRenderer.removeListener("tutorial:cancel", listener);
      },
      onResetAll(callback) {
        const listener = () => callback();
        ipcRenderer.on("tutorial:reset-all", listener);
        return () => ipcRenderer.removeListener("tutorial:reset-all", listener);
      },
      resetAll() {
        return ipcRenderer.invoke("screen-vision:tutorial:reset-all");
      }
    },
    wheelInformation: {
      show(payload) {
        return ipcRenderer.invoke("wheel-information:show", payload);
      },
      hide() {
        return ipcRenderer.invoke("wheel-information:hide");
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
    },
    fetchRankingRates() {
      return ipcRenderer.invoke("supporters:fetch-ranking-rates");
    }
  },
  supportersShowcase: {
    update(payload) {
      ipcRenderer.send("supporters-showcase:update", payload || {});
    },
    onOpenPanel(callback) {
      const listener = () => callback();
      ipcRenderer.on("supporters-showcase:open-panel", listener);
      return () => ipcRenderer.removeListener("supporters-showcase:open-panel", listener);
    },
    onOpenCoffeePanel(callback) {
      const listener = () => callback();
      ipcRenderer.on("supporters-showcase:open-coffee-panel", listener);
      return () => ipcRenderer.removeListener("supporters-showcase:open-coffee-panel", listener);
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
  libraryContent: {
    getState() {
      return ipcRenderer.invoke("library-content:get-state");
    },
    check() {
      return ipcRenderer.invoke("library-content:check");
    },
    activate() {
      return ipcRenderer.invoke("library-content:activate");
    },
    onChanged(callback) {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("library-content:state", listener);
      return () => ipcRenderer.removeListener("library-content:state", listener);
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
  screenshots: {
    getSettings() {
      return ipcRenderer.invoke("desktop:screenshot:get-settings");
    },
    setUpscale(value) {
      return ipcRenderer.invoke("desktop:screenshot:set-upscale", value);
    },
    setDeleteOriginal(value) {
      return ipcRenderer.invoke("desktop:screenshot:set-delete-original", Boolean(value));
    },
    getAvailability() {
      return ipcRenderer.invoke("desktop:screenshot:get-availability");
    },
    chooseDirectory() {
      return ipcRenderer.invoke("desktop:screenshot:choose-directory");
    },
    chooseSourceDirectory() {
      return ipcRenderer.invoke("desktop:screenshot:choose-source-directory");
    },
    openDirectory() {
      return ipcRenderer.invoke("desktop:screenshot:open-directory");
    },
    showAssistant(options = {}) {
      return ipcRenderer.invoke("desktop:screenshot-assistant:show", options);
    },
    setEnabled(value) {
      return ipcRenderer.invoke("desktop:screenshot-assistant:set-enabled", Boolean(value));
    },
    showAssistantHelp() {
      return ipcRenderer.invoke("desktop:screenshot-assistant:show-help");
    },
    clearAssistantTutorialFocus() {
      return ipcRenderer.invoke("desktop:screenshot-assistant:set-tutorial-focus", false);
    },
    capture() {
      return ipcRenderer.invoke("desktop:screenshot:capture");
    },
    onStatus(callback) {
      const listener = (_event, message) => callback(String(message || ""));
      ipcRenderer.on("desktop:screenshot:status", listener);
      return () => ipcRenderer.removeListener("desktop:screenshot:status", listener);
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
    onDiscoveryState(callback) {
      const listener = (_event, payload) => callback(payload || {});
      ipcRenderer.on("desktop:screenshot:discovery-state", listener);
      return () => ipcRenderer.removeListener("desktop:screenshot:discovery-state", listener);
    }
  },
  globalWorldPicker: {
    open(payload) {
      return ipcRenderer.invoke("desktop:global-world-picker:open", payload || {});
    },
    onSelected(callback) {
      const listener = (_event, slug) => callback(String(slug || ""));
      ipcRenderer.on("desktop:global-world-picker:selected", listener);
      return () => ipcRenderer.removeListener("desktop:global-world-picker:selected", listener);
    },
    onClosed(callback) {
      const listener = () => callback();
      ipcRenderer.on("desktop:global-world-picker:closed", listener);
      return () => ipcRenderer.removeListener("desktop:global-world-picker:closed", listener);
    }
  },
  account: {
    getState() {
      return ipcRenderer.invoke("account:get-state");
    },
    refresh() {
      return ipcRenderer.invoke("account:refresh");
    },
    getCampaigns() {
      return ipcRenderer.invoke("account:get-campaigns");
    },
    submitFeedback(payload) {
      return ipcRenderer.invoke("account:submit-feedback", payload || {});
    },
    openPage(page) {
      return ipcRenderer.invoke("account:open-page", page);
    },
    connect() {
      return ipcRenderer.invoke("account:connect");
    },
    disconnect() {
      return ipcRenderer.invoke("account:disconnect");
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
      },
      fetchRankingRates() {
        return ipcRenderer.invoke("supporters:fetch-ranking-rates");
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
      },
      close(panelKey) {
        return ipcRenderer.invoke("screen-vision:close-docked-panel", { panelKey });
      }
    },
    // The docked Buy me a Coffee panel runs in the main renderer, but it uses
    // this nested bridge. Keep the account contract identical to the regular
    // desktop bridge so the proof-upload page can own its login/return flow
    // instead of behaving like a no-op.
    account: {
      getState() {
        return ipcRenderer.invoke("account:get-state");
      },
      refresh() {
        return ipcRenderer.invoke("account:refresh");
      },
      connect() {
        return ipcRenderer.invoke("account:connect");
      },
      disconnect() {
        return ipcRenderer.invoke("account:disconnect");
      },
      openPage(page) {
        return ipcRenderer.invoke("account:open-page", page);
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
      isWindowAvailable() {
        return ipcRenderer.invoke("screen-vision:obs-window:is-available");
      },
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
      addObs() {
        return ipcRenderer.invoke("screen-vision:regions:add-obs");
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
    magnifier: {
      get() {
        return ipcRenderer.invoke("screen-vision:magnifier:get");
      },
      toggle() {
        return ipcRenderer.invoke("screen-vision:magnifier:toggle");
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
      },
      onMirrorSourceChanged(callback) {
        const listener = (_event, payload) => callback(payload || {});
        ipcRenderer.on("screen-vision:mirror-source-changed", listener);
        return () => ipcRenderer.removeListener("screen-vision:mirror-source-changed", listener);
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
      previewSound(payload) {
        return ipcRenderer.invoke("screen-vision:timers:preview-sound", payload);
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
