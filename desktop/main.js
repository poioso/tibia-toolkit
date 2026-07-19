import path from "node:path";
import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import crypto from "node:crypto";
import net from "node:net";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, Menu, nativeImage, net as electronNet, protocol, safeStorage, screen, shell, Tray } from "electron";
import { configureDataService, handleDataServiceMessage } from "../lib/data-service.js";
import {
  createDefaultOverlayToolsState,
  cloneOverlayToolsStateForSave,
  OVERLAY_TOOLS_STORAGE_KEY,
  normalizeOverlayToolsState
} from "../lib/overlay-tools-state.js";
import {
  createOverlayMirrorEntry,
  normalizeOverlayMirrorEntry
} from "../lib/overlay-mirrors.js";
import { formatOverlayTimerDuration } from "../lib/overlay-timers.js";
import {
  createEmptyMirrorAudioProfile,
  createEmptyMirrorProfile,
  overlayStateToMirrorAudioProfile,
  overlayStateToMirrorProfile,
  mirrorProfileToOverlayState
} from "../lib/screen-vision-profile-format.js";
import {
  APP_LOCALE_STORAGE_KEY,
  getActiveLocale,
  INITIAL_APP_LOCALE,
  normalizeLocale,
  setActiveLocale
} from "../lib/locale-state.js";
import { translateUiString } from "../lib/ui-translations.js";
import { normalizeTibiaDisplayState } from "./screen-vision/tibia-window-state.js";
import { SCREEN_VISION_SPELL_PRESETS } from "./screen-vision/spell-presets.js";
import { ObsMirrorSync } from "./obs-integration/obs-mirror-sync.js";
import { ensureContentPack } from "./content-pack.js";
import { startAppUpdater } from "./app-updater.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const execFileAsync = promisify(execFile);
const runtimeChannel = resolveRuntimeChannel();
const isProductionRuntime = runtimeChannel === "production";
const runtimeIdentity = {
  production: {
    displayName: "Tibia Toolkit",
    userDataDirectoryName: "Poioso Tibia Toolkit",
    documentsDirectoryName: "Tibia Toolkit",
    nativeHostPipeId: "poioso-screen-vision"
  },
  development: {
    displayName: "Tibia Toolkit Dev",
    userDataDirectoryName: "Poioso Tibia Toolkit Dev",
    documentsDirectoryName: "Tibia Toolkit Dev",
    nativeHostPipeId: "poioso-screen-vision-dev"
  }
}[runtimeChannel];

function normalizeRuntimeChannel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["production", "development"].includes(normalized) ? normalized : null;
}

function resolveRuntimeChannel() {
  const forcedChannel = normalizeRuntimeChannel(process.env.TIBIA_TOOLKIT_RUNTIME_CHANNEL);
  if (forcedChannel) {
    return forcedChannel;
  }

  if (!app.isPackaged) {
    return "development";
  }

  try {
    const packageMetadataPath = path.join(app.getAppPath(), "package.json");
    const packageMetadata = JSON.parse(fsSync.readFileSync(packageMetadataPath, "utf8"));
    return normalizeRuntimeChannel(packageMetadata?.tibiaToolkitChannel) || "production";
  } catch {
    return "production";
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "tibiatoolkit",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);
const runtimeUserDataPath = path.join(app.getPath("appData"), runtimeIdentity.userDataDirectoryName);
app.setPath("userData", runtimeUserDataPath);
const overlayStorePath = path.join(app.getPath("userData"), "overlay-storage.json");
const overlayToolsStorePath = path.join(app.getPath("userData"), "overlay-tools-storage.json");
const obsWebSocketPasswordStorageKey = "obsWebSocketPasswordEncrypted";
const legacyTibiaToolsDocumentsDir = path.join(app.getPath("documents"), "TibiaTools");
const tibiaToolsDocumentsDir = path.join(app.getPath("documents"), runtimeIdentity.documentsDirectoryName);
const appDocumentsDataDir = path.join(tibiaToolsDocumentsDir, "Dados");
const screenVisionCustomAudioDir = path.join(tibiaToolsDocumentsDir, "audios");
const runtimeCacheStorePath = path.join(appDocumentsDataDir, "cache-storage.json");
const screenVisionSpellSoundMap = new Map(
  SCREEN_VISION_SPELL_PRESETS
    .filter((preset) => preset?.soundKey && preset.soundKey !== "default" && preset.soundPath)
    .map((preset) => [
      preset.soundKey,
      path.join(projectRoot, ...String(preset.soundPath).split("/"))
    ])
);
const screenVisionProfilesDir = path.join(app.getPath("userData"), "ScreenVision", "Profiles");
const screenVisionLastProfilePath = path.join(app.getPath("userData"), "ScreenVision", "last-profile.txt");
const assetCacheRoot = path.join(app.getPath("userData"), "assets-cache");
const debugLogPath = path.join(projectRoot, "desktop-debug.log");
const defaultOverlayOpacity = 1;
const overlayBoundsSaveDelayMs = 250;
const bootstrapAssetsRoot = path.join(projectRoot, "desktop", "build", "bootstrap");
const appIconPath = path.join(bootstrapAssetsRoot, "loading-emblem.png");
const splashIconPath = path.join(bootstrapAssetsRoot, "loading-emblem.png");
const runtimeConfigPath = path.join(projectRoot, "desktop", "app-config.json");
const closePreferenceStorageKey = "appClosePreference";
const tibiaWindowProbeScriptPath = path.join(projectRoot, "desktop", "screen-vision", "tibia-window-probe.ps1");
const nativeHostProjectPath = path.join(projectRoot, "desktop", "screen-vision-native", "ScreenVision.NativeHost", "ScreenVision.NativeHost.csproj");
const nativeHostPublishedDllPath = path.join(projectRoot, "desktop", "screen-vision-native", "publish", "win-x64", "ScreenVision.NativeHost.dll");
const nativeHostPublishedExePath = path.join(projectRoot, "desktop", "screen-vision-native", "publish", "win-x64", "ScreenVision.NativeHost.exe");
const nativeHostDebugDllPath = path.join(projectRoot, "desktop", "screen-vision-native", "ScreenVision.NativeHost", "bin", "Debug", "net10.0-windows", "win-x64", "ScreenVision.NativeHost.dll");

async function migrateLegacyDocumentsDirectory() {
  if (!isProductionRuntime) {
    return;
  }

  try {
    await fs.access(tibiaToolsDocumentsDir);
    return;
  } catch {}

  let legacyStats;
  try {
    legacyStats = await fs.stat(legacyTibiaToolsDocumentsDir);
  } catch {
    return;
  }
  if (!legacyStats.isDirectory()) return;

  try {
    await fs.rename(legacyTibiaToolsDocumentsDir, tibiaToolsDocumentsDir);
  } catch (error) {
    if (error?.code !== "EXDEV") throw error;
    await fs.cp(legacyTibiaToolsDocumentsDir, tibiaToolsDocumentsDir, { recursive: true, force: false, errorOnExist: false });
    await fs.rm(legacyTibiaToolsDocumentsDir, { recursive: true, force: true });
  }
}
const nativeHostDllPath = nativeHostDebugDllPath;
const nativeHostDotnetPath = String(process.env.DOTNET_HOST_PATH || "dotnet").trim() || "dotnet";
const nativeHostPipeId = runtimeIdentity.nativeHostPipeId;
const nativeHostPipeName = `\\\\.\\pipe\\${nativeHostPipeId}`;
const tibiaWindowPollIntervalMs = 220;
const nativeHostEventPollIntervalMs = 35;
const nativeHostStartupTimeoutMs = 20000;
const nativeHostPipeTimeoutMs = 2500;
// Region selection is intentionally user-paced. It must not inherit the
// short request timeout used by the background mirror/window polling.
const nativeHostSelectionPipeTimeoutMs = 5 * 60 * 1000;
const obsMirrorSync = new ObsMirrorSync({
  onError: (error) => {
    void writeDebugLog(`obs-mirror-sync-error ${error?.message || String(error)}`);
  },
  onLog: (message) => {
    void writeDebugLog(`obs-mirror-sync ${message}`);
  }
});
let mainWindow = null;
let mapWindow = null;
let tray = null;
let appIsQuitting = false;
let applicationShutdownPromise = null;
let applicationShutdownComplete = false;
let nativeHostShutdownRequested = false;
let closeChoiceDialogOpen = false;
let activeClosePreference = null;
let wheelInformationWindow = null;
let wheelInformationAnchor = null;
let tutorialPopoverWindow = null;
let tutorialExpandedWindowBounds = null;
const screenVisionWindows = new Map();
const countdownEditorWindows = new Map();
const regionMirrorWindows = new Map();
const alertPositionEditorWindows = new Map();
let dockedToolPanelKey = "";
let dockedToolPanelSide = "right";
let dockedToolPanelAnimationTimer = null;
let dockedToolPanelBoundsAnimationInFlight = false;
let dockedToolPanelBaseBounds = null;
let dockedToolPanelIsOpen = false;
let dockedToolPanelPhase = "closed";
const dockedToolPanelOpenDurationMs = 220;
const dockedToolPanelCloseDurationMs = 180;
const screenVisionSessionConfirmSkips = new Map();
const screenVisionConfirmDialogWindows = new Map();
const regionMirrorBoundsSaveTimers = new Map();
const regionMirrorCloseSuppressions = new Set();
let splashWindow = null;
let splashProgress = 0;
let splashStatus = "Preparando interface";
let runtimeAssetsRoot = path.join(projectRoot, "assets");
let runtimeSupportersDataUrls = [];
let appUpdaterController = null;
let appUpdateState = { phase: "idle", info: null };
const APP_UPDATE_DOWNLOAD_DIALOG_ROLE = "app-update-download";
let storeWriteQueue = Promise.resolve();
let cacheStoreWriteQueue = Promise.resolve();
let overlayToolsStoreWriteQueue = Promise.resolve();
let overlayToolsMutationQueue = Promise.resolve();
let mapWatermarkDataUrlPromise = null;
let overlayBoundsSaveTimer = null;
let tibiaWindowMonitorTimer = null;
let nativeHostEventPollTimer = null;
let tibiaWindowStateRequest = null;
let lastTibiaWindowState = null;
let lastGridOverlayTibiaSignature = "";
let selectionInProgress = false;
let nativeHostProcess = null;
let nativeHostStartPromise = null;
let nativeMirrorRegionCount = 0;
let nativeMirrorsAlwaysOnTop = true;
let nativeHostEventSyncInFlight = false;
let nativeHostRpcQueue = Promise.resolve();
let alertTimerListeningActive = false;
let alertTimerRuntimeSnapshotTimer = null;
let alertAudioRuntimeWindow = null;
let alertTimerSignalsAllowedByTibia = true;
let controllerWindowFocusState = false;
const activeTimerVisualAlertWindows = new Map();
const countdownRunningRegionIds = new Set();
const countdownShortcutRegionMap = new Map();
const alertTimerShortcutMap = new Map();
const alertTimerRuntimeById = new Map();
const screenVisionConfirmDialogResolvers = new Map();
let activeScreenVisionProfilePath = null;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const dockedToolPanelDefinitions = {
  "alertas-panel": {
    titleKey: "screenVision.alerts",
    descriptionKey: "sidePanel.description",
    width: 418
  },
  "authenticator-panel": {
    titleKey: "screenVision.authenticator.title",
    descriptionKey: "sidePanel.description",
    width: 418
  },
  "profiles-panel": {
    titleKey: "screenVision.profiles.title",
    descriptionKey: "sidePanel.description",
    width: 418
  },
  "sqm-finder-panel": {
    titleKey: "screenVision.sqmFinder",
    descriptionKey: "sidePanel.description",
    width: 418
  },
  "tibia-coins-panel": {
    titleKey: "screenVision.tibiaCoins.title",
    description: "",
    width: 418
  },
  "supporters-panel": {
    title: "Top apoiadores",
    description: "Obrigado por fortalecer o Tibia Toolkit.",
    width: 418
  },
  "settings-panel": {
    titleKey: "screenVision.settings.title",
    description: "",
    width: 418
  },
  "buy-me-a-coffee-panel": {
    titleKey: "screenVision.coffee.title",
    description: "",
    width: 418
  },
  "wheel-perks-panel": {
    titleKey: "wheel.summary.title",
    description: "",
    width: 390
  }
};

function tr(key, variables = {}) {
  return translateUiString(getActiveLocale(), key, variables);
}

function broadcastLocaleChange(locale) {
  const normalizedLocale = normalizeLocale(locale);

  if (tray && !tray.isDestroyed()) {
    ensureAppTray();
  }

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window || window.isDestroyed()) {
      continue;
    }

    window.webContents.send("app:locale-changed", normalizedLocale);
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "poioso-cache",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    app.setName(runtimeIdentity.displayName);
    registerAssetCacheProtocol();
    await migrateLegacyDocumentsDirectory().catch(() => {});
    await ensureRuntimeCacheStoreReady().catch(() => {});
    await migrateLegacyRuntimeCacheStore().catch(() => {});
    const storedLocale = await readStorageValue(APP_LOCALE_STORAGE_KEY).catch(() => ({}));
    setActiveLocale(storedLocale?.[APP_LOCALE_STORAGE_KEY] || INITIAL_APP_LOCALE);
    splashStatus = tr("splash.preparing");
    await createSplashWindow();
    const runtimeConfig = await loadRuntimeConfig();
    runtimeSupportersDataUrls = normalizeRuntimeBaseList(
      runtimeConfig.supportersDataUrls || [],
      runtimeConfig.supportersDataUrl || ""
    );
    registerRuntimeContentProtocol();
    try {
      await bootstrapRuntimeContentWithRetry(runtimeConfig);
    } catch (error) {
      await writeDebugLog(`content-pack-bootstrap-failed ${error?.message || String(error)}`);
      closeSplashWindow();
      app.quit();
      return;
    }
    await prepareClosePreferenceForCurrentSession();

    configureDataService({
      marketApiBase: runtimeConfig.marketApiBase || null,
      marketApiBases: runtimeConfig.marketApiBases || [],
      gameDataHubBase: runtimeConfig.gameDataHubBase || null,
      gameDataHubBases: runtimeConfig.gameDataHubBases || [],
      supportersDataUrl: runtimeSupportersDataUrls[0] || null,
      supportersDataUrls: runtimeSupportersDataUrls,
      getAssetUrl(relativePath) {
        return `tibiatoolkit://app/${String(relativePath || "").replace(/^\/+/, "")}`;
      },
      getCachedImageUrl(category, key, sourceUrl) {
        return getCachedImageProtocolUrl(category, key, sourceUrl);
      },
      async readJsonAsset(relativePath) {
        const assetPath = resolveRuntimeFilePath(relativePath);
        if (!assetPath) {
          throw new Error(`Caminho de asset invalido: ${relativePath}`);
        }
        const contents = await fs.readFile(assetPath, "utf8");
        return JSON.parse(contents);
      },
      async storageGet(key) {
        return readStorageValue(key);
      },
      async storageSet(value) {
        return writeStorageValue(value);
      },
      async storageRemove(key) {
        return removeStorageValue(key);
      }
    });

    await writeDebugLog("app.whenReady");
    await ensureNativeHostStarted().catch(async (error) => {
      await writeDebugLog(`native-host-start-failed ${error?.message || String(error)}`);
    });
    await writeDebugLog("bootstrap-screen-vision-profiles:start");
    await bootstrapScreenVisionProfiles();
    await writeDebugLog("bootstrap-screen-vision-profiles:finish");
    await resetMirrorVisibilityForNewProcess();
    registerIpcHandlers();
    await writeDebugLog("create-overlay-window:start");
    mainWindow = await createOverlayWindow();
    await writeDebugLog("create-overlay-window:finish");
    if (isProductionRuntime) {
      appUpdaterController = startAppUpdater({
        appIsPackaged: app.isPackaged,
        urls: runtimeConfig.updateUrls,
        onStatus(message) {
          void writeDebugLog(`app-updater ${message}`);
        },
        onError(error) {
          closeScreenVisionConfirmDialogsByRole(APP_UPDATE_DOWNLOAD_DIALOG_ROLE);
          void writeDebugLog(`app-updater-error ${error?.message || String(error)}`);
        },
        onAvailable(info) {
          appUpdateState = { phase: "available", info: normalizeAppUpdateInfo(info) };
          broadcastAppUpdateState();
        },
        onProgress(progress) {
          const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
          appUpdateState = {
            ...appUpdateState,
            phase: "downloading",
            progress: percent
          };
          updateScreenVisionConfirmDialogsByRole(APP_UPDATE_DOWNLOAD_DIALOG_ROLE, {
            message: tr("updater.downloadingMessage", { percent: Math.round(percent) }),
            progress: percent
          });
          broadcastAppUpdateState();
        },
        onDownloaded(info) {
          closeScreenVisionConfirmDialogsByRole(APP_UPDATE_DOWNLOAD_DIALOG_ROLE);
          appUpdateState = { phase: "downloaded", info: normalizeAppUpdateInfo(info) };
          broadcastAppUpdateState();
          void showAppUpdateDownloadedDialog(info);
        }
      });
    } else {
      await writeDebugLog(`app-updater-skipped channel=${runtimeChannel}`);
    }
    await syncRegionMirrorWindows();
    await syncAlertTimerHotkeys();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = await createOverlayWindow();
      }
      await syncRegionMirrorWindows();
    });
  });

  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  appIsQuitting = true;
  nativeHostShutdownRequested = true;

  if (applicationShutdownComplete) {
    return;
  }

  event.preventDefault();
  if (!applicationShutdownPromise) {
    applicationShutdownPromise = shutdownApplicationProcesses();
  }

  void applicationShutdownPromise.finally(() => {
    applicationShutdownComplete = true;
    app.quit();
  });
});

async function shutdownApplicationProcesses() {
  // Disable only the sources created by this optional integration. Existing
  // OBS sources, including the user's Tibia Game Capture, are never touched.
  await Promise.allSettled([
    obsMirrorSync.disable(),
    closeDockedToolPanel({ animate: false }),
    clearAlertPositionEditorWindows()
  ]);
  unregisterAllCountdownShortcuts();
  unregisterAllAlertTimerShortcuts();
  stopAllAlertTimerRuntimes({ emit: false });
  for (const window of countdownEditorWindows.values()) {
    try {
      window?.close();
    } catch {
    }
  }
  countdownEditorWindows.clear();
  if (alertAudioRuntimeWindow && !alertAudioRuntimeWindow.isDestroyed()) {
    try {
      alertAudioRuntimeWindow.close();
    } catch {
    }
  }
  alertAudioRuntimeWindow = null;
  if (nativeHostEventPollTimer) {
    clearInterval(nativeHostEventPollTimer);
    nativeHostEventPollTimer = null;
  }
  stopNativeHostProcess();
  await cleanupNativeHostProcesses();
  tray?.destroy();
  tray = null;
}

ipcMain.on("screen-vision:confirm-dialog:action", (_event, payload = {}) => {
  const dialogId = typeof payload?.dialogId === "string" ? payload.dialogId : "";
  const resolver = screenVisionConfirmDialogResolvers.get(dialogId);

  if (!resolver) {
    return;
  }

  resolver(payload);
});

ipcMain.on("screen-vision:confirm-dialog:resize", (event, payload = {}) => {
  const dialogId = typeof payload?.dialogId === "string" ? payload.dialogId : "";
  const entry = screenVisionConfirmDialogWindows.get(dialogId);

  if (!entry || entry.window.isDestroyed() || event.sender !== entry.window.webContents) {
    return;
  }

  const currentBounds = entry.window.getBounds();
  const display = screen.getDisplayMatching(currentBounds);
  const height = Math.max(240, Math.min(
    display.workArea.height - 24,
    Math.ceil(Number(payload.height) || currentBounds.height)
  ));
  const positionedBounds = getConfirmDialogBounds({
    parentBounds: entry.parentBounds,
    workArea: display.workArea,
    width: currentBounds.width,
    height,
    external: entry.external,
    centerOnDisplay: entry.centerOnDisplay
  });

  entry.window.setBounds(positionedBounds, false);
});

async function createOverlayWindow() {
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { workArea } = activeDisplay;
  const storedState = await readStorageValue("overlayPrefs");
  const overlayPrefs = storedState.overlayPrefs || {};
  const width = clamp(Math.round(workArea.width * 0.26), 520, 620);
  const height = clamp(Math.round(workArea.height * 0.78), 620, 920);
  const minWidth = 500;
  const maxWidth = 860;
  const minHeight = Math.max(320, Math.round(height * 0.5));
  const maxHeight = Math.min(workArea.height, Math.round(workArea.height * 0.7) + 300);
  const defaultWidth = Math.min(maxWidth, workArea.width);
  const defaultHeight = maxHeight;
  const defaultX = workArea.x + Math.round((workArea.width - defaultWidth) / 2);
  const defaultY = workArea.y;
  const restoredBounds = getRestoredOverlayBounds(overlayPrefs.bounds, {
    x: defaultX,
    y: defaultY,
    width: defaultWidth,
    height: defaultHeight,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight
  });
  const bounds = restoredBounds || {
    x: defaultX,
    y: defaultY,
    width: defaultWidth,
    height: defaultHeight
  };
  const opacity = defaultOverlayOpacity;

  const window = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    resizable: true,
    backgroundColor: "#1d2129",
    icon: appIconPath,
    frame: false,
    roundedCorners: false,
    show: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: "Tibia Toolkit",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--tibia-toolkit-runtime-channel=${runtimeChannel}`]
    }
  });

  window.__dockedToolPanelBaseMinWidth = minWidth;
  window.__dockedToolPanelBaseMinHeight = minHeight;
  window.__dockedToolPanelBaseMaxWidth = maxWidth;
  window.__dockedToolPanelBaseMaxHeight = maxHeight;

  await writeDebugLog(
    `window-created width=${bounds.width} height=${bounds.height} x=${bounds.x} y=${bounds.y} restored=${Boolean(restoredBounds)} minWidth=${minWidth} maxWidth=${maxWidth} minHeight=${minHeight} maxHeight=${maxHeight} opacity=${opacity}`
  );

  restoreMainWindowTopmost(window);
  window.setOpacity(opacity);
  window.on("show", () => {
    void writeDebugLog("window-show");
  });
  window.on("focus", () => {
    controllerWindowFocusState = true;
    restoreMainWindowTopmost(window);
    void writeDebugLog("window-focus");
    void syncDockedToolPanelWindow({ forceShow: true, animateSideChange: false });
  });
  window.on("blur", () => {
    restoreMainWindowTopmost(window);
    void writeDebugLog("window-blur");
    void refreshControllerWindowFocusState();
  });
  window.on("ready-to-show", () => {
    void writeDebugLog("window-ready-to-show");
  });
  window.on("move", () => {
    scheduleOverlayBoundsSave(window);
    void syncDockedToolPanelWindow();
  });
  window.on("resize", () => {
    scheduleOverlayBoundsSave(window);
    void syncDockedToolPanelWindow();
  });
  window.on("restore", () => {
    if (dockedToolPanelIsOpen) {
      void syncDockedToolPanelWindow({ forceShow: true });
    }
  });
  window.on("show", () => {
    if (dockedToolPanelIsOpen) {
      void syncDockedToolPanelWindow({ forceShow: true });
    }
  });
  window.on("close", (event) => {
    if (appIsQuitting) {
      return;
    }

    event.preventDefault();
    void requestMainWindowClose();
  });
  window.on("closed", () => {
    closeDockedToolPanel();
  });
  window.on("close", () => {
    void saveOverlayBounds(window);
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    void writeDebugLog(`did-fail-load ${errorCode} ${errorDescription}`);
    if (!window.isVisible()) {
      window.show();
    }
  });
  window.webContents.on("did-finish-load", () => {
    void writeDebugLog("did-finish-load");
  });
  window.webContents.on("console-message", (_event, level, message) => {
    void writeDebugLog(`renderer-console level=${level} message=${message}`);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    void writeDebugLog(`render-process-gone reason=${details?.reason || "unknown"} exitCode=${details?.exitCode ?? "unknown"}`);
  });
  window.webContents.on("unresponsive", () => {
    void writeDebugLog("renderer-unresponsive");
  });
  window.webContents.on("responsive", () => {
    void writeDebugLog("renderer-responsive");
  });
  await window.loadURL("tibiatoolkit://app/index.html?mode=desktop");
  await writeDebugLog("after-loadURL");
  await writeDebugLog(`waiting-for-renderer-ready visible=${window.isVisible()} minimized=${window.isMinimized()}`);

  return window;
}

function restoreMainWindowTopmost(window = mainWindow) {
  if (!window || window.isDestroyed()) {
    return;
  }

  try {
    window.setAlwaysOnTop(true, "screen-saver");
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    restoreMapWindowTopmost();
    restoreActiveTimerVisualAlertsTopmost();
  } catch (_error) {
  }
}

function restoreMapWindowTopmost() {
  if (!mapWindow || mapWindow.isDestroyed()) {
    return;
  }

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mapWindow.setParentWindow(mainWindow);
    }
    mapWindow.setAlwaysOnTop(true, "screen-saver");
    mapWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (mapWindow.isVisible()) {
      mapWindow.moveTop();
    }
  } catch (_error) {
  }
}

function getWheelInformationBounds(owner, rect, width, height) {
  const ownerBounds = owner.getBounds();
  const target = {
    x: ownerBounds.x + Math.round(Number(rect?.x) || 0),
    y: ownerBounds.y + Math.round(Number(rect?.y) || 0),
    width: Math.max(1, Math.round(Number(rect?.width) || 1)),
    height: Math.max(1, Math.round(Number(rect?.height) || 1))
  };
  const area = screen.getDisplayMatching(target).workArea;
  const gap = 12;
  const right = { x: target.x + target.width + gap, y: target.y + 8 };
  const left = { x: target.x - width - gap, y: target.y + 8 };
  const candidate = right.x + width <= area.x + area.width ? right : left;
  return {
    x: Math.max(area.x, Math.min(candidate.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(candidate.y, area.y + area.height - height)),
    width,
    height
  };
}

function registerIpcHandlers() {
  ipcMain.handle("wheel-information:show", async (event, payload = {}) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!owner || owner.isDestroyed()) return false;
    const width = 350;
    const height = 260;
    wheelInformationAnchor = { owner, rect: payload.rect || {} };
    const bounds = getWheelInformationBounds(owner, wheelInformationAnchor.rect, width, height);
    if (!wheelInformationWindow || wheelInformationWindow.isDestroyed()) {
      wheelInformationWindow = new BrowserWindow({
        ...bounds,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        focusable: false,
        show: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        parent: owner,
        hasShadow: false,
        webPreferences: {
          preload: path.join(__dirname, "wheel-information-popover-preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false
        }
      });
      wheelInformationWindow.setIgnoreMouseEvents(true);
      wheelInformationWindow.setAlwaysOnTop(true, "pop-up-menu");
      wheelInformationWindow.on("closed", () => {
        wheelInformationWindow = null;
        wheelInformationAnchor = null;
      });
      await wheelInformationWindow.loadFile(path.join(__dirname, "wheel-information-popover.html"));
    } else {
      wheelInformationWindow.setParentWindow(owner);
      wheelInformationWindow.setBounds(bounds, false);
    }
    wheelInformationWindow.webContents.send("wheel-information:render", payload);
    wheelInformationWindow.showInactive();
    wheelInformationWindow.moveTop();
    return true;
  });

  ipcMain.handle("wheel-information:hide", async () => {
    if (wheelInformationWindow && !wheelInformationWindow.isDestroyed()) {
      wheelInformationWindow.hide();
    }
    return true;
  });

  ipcMain.on("wheel-information:resize", (event, requestedHeight) => {
    if (!wheelInformationWindow || wheelInformationWindow.isDestroyed()
      || event.sender !== wheelInformationWindow.webContents || !wheelInformationAnchor
      || wheelInformationAnchor.owner.isDestroyed()) {
      return;
    }
    const height = Math.max(120, Math.min(520, Math.round(Number(requestedHeight) || 260)));
    const bounds = getWheelInformationBounds(
      wheelInformationAnchor.owner,
      wheelInformationAnchor.rect,
      wheelInformationWindow.getBounds().width,
      height
    );
    wheelInformationWindow.setBounds(bounds, false);
  });

  ipcMain.handle("tutorial:show-step", async (event, payload = {}) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!owner || owner.isDestroyed()) {
      return false;
    }

    const width = 390;
    // Most tours keep the familiar 330px baseline. A few text-only steps use
    // a smaller explicit height so they fit their content without dead space.
    const height = Math.max(260, Math.min(680, Math.round(Number(payload.height) || 330)));
    const ownerBounds = owner.getBounds();
    const rect = payload.rect || {};
    const target = {
      x: ownerBounds.x + Math.round(Number(rect.x) || 0),
      y: ownerBounds.y + Math.round(Number(rect.y) || 0),
      width: Math.max(1, Math.round(Number(rect.width) || 1)),
      height: Math.max(1, Math.round(Number(rect.height) || 1))
    };
    const display = screen.getDisplayMatching(target);
    const area = display.workArea;
    const gap = 12;
    const buildCandidate = (placement) => {
      if (placement === "bottom") {
        return { x: target.x + Math.round((target.width - width) / 2), y: target.y + target.height + gap };
      }
      if (placement === "top") {
        return { x: target.x + Math.round((target.width - width) / 2), y: target.y - height - gap };
      }
      if (placement === "top-right") {
        return { x: target.x + target.width - width, y: target.y - height - gap };
      }
      if (placement === "top-center") {
        return { x: target.x + Math.round((target.width - width) / 2), y: target.y - height - gap };
      }
      if (placement === "left") {
        return { x: target.x - width - gap, y: target.y + Math.round((target.height - height) / 2) };
      }
      return { x: target.x + target.width + gap, y: target.y + Math.round((target.height - height) / 2) };
    };
    const preferredPlacement = String(payload.placement || "right");
    const orderedPlacements = [
      preferredPlacement,
      "right",
      "left",
      "bottom",
      "top"
    ].filter((placement, index, placements) => placement && placements.indexOf(placement) === index);
    const candidates = orderedPlacements.map(buildCandidate);
    const fits = ({ x, y }) => x >= area.x && y >= area.y
      && x + width <= area.x + area.width
      && y + height <= area.y + area.height;
    const chosen = candidates.find(fits) || candidates[0];
    const x = Math.max(area.x, Math.min(chosen.x, area.x + area.width - width));
    const y = Math.max(area.y, Math.min(chosen.y, area.y + area.height - height));

    if (!tutorialPopoverWindow || tutorialPopoverWindow.isDestroyed()) {
      tutorialPopoverWindow = new BrowserWindow({
        width,
        height,
        x,
        y,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        show: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        parent: owner,
        hasShadow: false,
        webPreferences: {
          preload: path.join(__dirname, "tutorial-popover-preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false
        }
      });
      tutorialPopoverWindow.setAlwaysOnTop(true, "pop-up-menu");
      tutorialPopoverWindow.on("closed", () => {
        tutorialPopoverWindow = null;
      });
      await tutorialPopoverWindow.loadFile(path.join(__dirname, "tutorial-popover.html"));
    } else {
      tutorialPopoverWindow.setParentWindow(owner);
      tutorialPopoverWindow.setBounds({ x, y, width, height }, false);
    }

    tutorialPopoverWindow.showInactive();
    tutorialPopoverWindow.moveTop();
    // Wait for a composed frame before every step render. Reusing the floating
    // BrowserWindow otherwise lets some routes (notably Solo Analyzer) skip
    // the CSS entrance animation after a normal app re-render.
    await tutorialPopoverWindow.webContents.executeJavaScript(
      "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
    ).catch(() => {});
    tutorialPopoverWindow.webContents.send("tutorial-popover:render", payload);
    return true;
  });

  ipcMain.handle("tutorial:close-step", async () => {
    if (tutorialPopoverWindow && !tutorialPopoverWindow.isDestroyed()) {
      tutorialPopoverWindow.close();
    }
    tutorialPopoverWindow = null;
    return true;
  });

  ipcMain.on("tutorial-popover:resize-to-content", (event, requestedHeight) => {
    if (!tutorialPopoverWindow || tutorialPopoverWindow.isDestroyed()
      || event.sender !== tutorialPopoverWindow.webContents) {
      return;
    }

    const bounds = tutorialPopoverWindow.getBounds();
    const height = Math.max(260, Math.min(680, Math.round(Number(requestedHeight) || bounds.height)));
    if (height <= bounds.height) {
      return;
    }

    const area = screen.getDisplayMatching(bounds).workArea;
    const y = Math.max(area.y, Math.min(
      bounds.y - Math.round((height - bounds.height) / 2),
      area.y + area.height - height
    ));
    tutorialPopoverWindow.setBounds({ x: bounds.x, y, width: bounds.width, height }, false);
  });

  ipcMain.handle("tutorial:set-window-locked", async (event, locked) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!owner || owner.isDestroyed()) {
      return false;
    }

    owner.setResizable(!locked);
    return true;
  });

  ipcMain.handle("tutorial:ensure-wide", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!owner || owner.isDestroyed()) {
      return false;
    }

    const currentBounds = owner.getBounds();
    const targetDisplay = screen.getDisplayMatching(currentBounds);
    const workArea = targetDisplay.workArea;
    const targetWidth = Math.min(1120, workArea.width);
    if (currentBounds.width >= targetWidth) {
      return false;
    }

    if (!tutorialExpandedWindowBounds) {
      tutorialExpandedWindowBounds = {
        ownerId: owner.id,
        bounds: currentBounds
      };
    }

    const centerX = currentBounds.x + Math.round(currentBounds.width / 2);
    const nextX = Math.max(
      workArea.x,
      Math.min(centerX - Math.round(targetWidth / 2), workArea.x + workArea.width - targetWidth)
    );
    owner.setBounds({
      x: nextX,
      y: currentBounds.y,
      width: targetWidth,
      height: currentBounds.height
    }, false);
    return true;
  });

  ipcMain.handle("tutorial:ensure-compact-centered", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!owner || owner.isDestroyed()) {
      return false;
    }

    const currentBounds = owner.getBounds();
    const targetDisplay = screen.getDisplayMatching(currentBounds);
    const workArea = targetDisplay.workArea;
    const [minimumWidth] = owner.getMinimumSize();
    const targetWidth = Math.max(520, Math.min(Number(minimumWidth) || 520, workArea.width));

    if (!tutorialExpandedWindowBounds) {
      tutorialExpandedWindowBounds = {
        ownerId: owner.id,
        bounds: currentBounds
      };
    }

    owner.setBounds({
      x: Math.max(workArea.x, Math.round(workArea.x + ((workArea.width - targetWidth) / 2))),
      y: Math.max(workArea.y, Math.round(workArea.y + ((workArea.height - currentBounds.height) / 2))),
      width: targetWidth,
      height: currentBounds.height
    }, false);
    return true;
  });

  ipcMain.handle("tutorial:prepare-docked-panel", async (event, panelKey) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const definition = getDockedToolPanelDefinition(panelKey);
    if (!owner || owner.isDestroyed() || !definition || owner !== mainWindow) {
      return false;
    }

    // The docked panel raises the window's minimum width. Reset to the narrow
    // base first, then reopen it so the app pane stays clear of native previews.
    if (dockedToolPanelIsOpen) {
      await closeDockedToolPanel({ animate: false });
    }

    const currentBounds = owner.getBounds();
    const targetDisplay = screen.getDisplayMatching(currentBounds);
    const workArea = targetDisplay.workArea;
    const baseWidth = Math.max(500, Math.round(owner.__dockedToolPanelBaseMinWidth || 500));

    if (!tutorialExpandedWindowBounds) {
      tutorialExpandedWindowBounds = {
        ownerId: owner.id,
        bounds: currentBounds
      };
    }

    owner.setBounds({
      x: Math.max(workArea.x, Math.round(workArea.x + ((workArea.width - baseWidth) / 2))),
      y: Math.max(workArea.y, Math.round(workArea.y + ((workArea.height - currentBounds.height) / 2))),
      width: baseWidth,
      height: currentBounds.height
    }, false);

    await openDockedToolPanel(panelKey, { focusWindow: false });
    return true;
  });

  ipcMain.handle("tutorial:restore-window-bounds", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const restoreState = tutorialExpandedWindowBounds;
    tutorialExpandedWindowBounds = null;
    if (!owner || owner.isDestroyed() || !restoreState || restoreState.ownerId !== owner.id) {
      return false;
    }

    owner.setBounds(restoreState.bounds, false);
    return true;
  });

  ipcMain.on("tutorial-popover:next", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      mainWindow.webContents.send("tutorial:next");
    }
  });

  ipcMain.on("tutorial-popover:cancel", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      mainWindow.webContents.send("tutorial:cancel");
    }
  });

  ipcMain.handle("app:splash-progress", async (_event, progress) => {
    await updateSplashProgress(progress);
    return true;
  });

  ipcMain.handle("app:splash-status", async (_event, status) => {
    await updateSplashStatus(status);
    return true;
  });

  ipcMain.handle("app:ready-to-show", async (event) => {
    await updateSplashProgress(100);
    closeSplashWindow();

    const window = mainWindow && !mainWindow.isDestroyed()
      ? mainWindow
      : BrowserWindow.fromWebContents(event.sender);

    if (window && !window.isDestroyed()) {
      window.show();
      restoreMainWindowTopmost(window);
      window.focus();
      await writeDebugLog(`renderer-ready-show visible=${window.isVisible()} minimized=${window.isMinimized()}`);
    }

    return true;
  });

  ipcMain.handle("data:send-message", async (_event, message) => {
    return handleDataServiceMessage(message);
  });

  ipcMain.handle("storage:get", async (_event, key) => {
    return readStorageValue(key);
  });

  ipcMain.handle("storage:set", async (_event, value) => {
    await writeStorageValue(value);

    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, APP_LOCALE_STORAGE_KEY)) {
      const nextLocale = setActiveLocale(value[APP_LOCALE_STORAGE_KEY]);
      broadcastLocaleChange(nextLocale);
    }

    return true;
  });

  ipcMain.handle("assets:read-json", async (_event, relativePath) => {
    const normalizedPath = String(relativePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
    if (!normalizedPath.startsWith("assets/")) {
      throw new Error("Caminho de asset invalido.");
    }

    const assetPath = resolveRuntimeFilePath(normalizedPath);
    if (!assetPath) {
      throw new Error("Caminho de asset invalido.");
    }

    return JSON.parse(await fs.readFile(assetPath, "utf8"));
  });

  ipcMain.handle("app:get-version", () => app.getVersion());

  ipcMain.handle("app-updater:get-state", () => appUpdateState);

  ipcMain.handle("app-updater:request-download", async () => {
    if (appUpdateState.phase !== "available" || !appUpdaterController) {
      return appUpdateState;
    }

    const updateInfo = appUpdateState.info || appUpdaterController.getInfo();
    const confirmed = await showScreenVisionConfirmDialog(mainWindow, {
      title: tr("updater.availableTitle"),
      message: tr("updater.availableMessage", { version: updateInfo?.version || tr("updater.newVersion") }),
      confirmLabel: tr("updater.downloadNow"),
      cancelLabel: tr("updater.downloadLater"),
      confirmTooltip: tr("updater.downloadNow"),
      cancelTooltip: tr("updater.downloadLater"),
      tone: "success",
      flat: true,
      mediaPath: path.join("assets", "ui", "tutorial", "update.gif"),
      mediaWidth: 280,
      width: 456,
      height: 620,
      autoHeight: true,
      external: true,
      centerOnDisplay: true
    });

    if (confirmed.confirmed) {
      appUpdateState = { phase: "downloading", info: normalizeAppUpdateInfo(updateInfo) };
      broadcastAppUpdateState();
      showAppUpdateDownloadProgressDialog(updateInfo);
      try {
        await appUpdaterController.download();
      } catch (error) {
        closeScreenVisionConfirmDialogsByRole(APP_UPDATE_DOWNLOAD_DIALOG_ROLE);
        appUpdateState = { phase: "available", info: normalizeAppUpdateInfo(updateInfo) };
        broadcastAppUpdateState();
        throw error;
      }
    }

    return appUpdateState;
  });

  ipcMain.handle("supporters:fetch-document", async () => {
    let lastError = null;

    for (const url of runtimeSupportersDataUrls) {
      try {
        const response = await electronNet.fetch(url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Nenhuma fonte de apoiadores esta disponivel.");
  });

  ipcMain.handle("overlay:get-state", async () => {
    return {
      opacity: mainWindow?.getOpacity() ?? defaultOverlayOpacity,
      alwaysOnTop: mainWindow?.isAlwaysOnTop() ?? true
    };
  });

  ipcMain.handle("overlay:set-opacity", async (_event, opacity) => {
    const normalized = clampNumber(opacity, 0.45, 1, defaultOverlayOpacity);
    mainWindow?.setOpacity(normalized);
    await writeStorageValue({
      overlayPrefs: {
        ...(await getOverlayPrefs()),
        opacity: normalized
      }
    });
    return {
      opacity: normalized
    };
  });

  ipcMain.handle("overlay:minimize", async () => {
    mainWindow?.minimize();
    return true;
  });

  ipcMain.handle("overlay:close", async () => {
    await requestMainWindowClose();
    return true;
  });

  ipcMain.handle("links:open-external", async (_event, url) => {
    if (typeof url === "string" && url) {
      await shell.openExternal(url);
    }

    return true;
  });

  ipcMain.handle("maps:open", async (_event, payload = {}) => {
    const url = typeof payload.url === "string" ? payload.url : "";
    const title = typeof payload.title === "string" ? payload.title : "Mapa";

    if (!url) {
      return false;
    }

    await openMapWindow(url, title);
    return true;
  });

  ipcMain.handle("screen-vision:open", async (_event, payload = {}) => {
    const tool = typeof payload.tool === "string" ? payload.tool : "screen-vision";
    const options = payload?.options && typeof payload.options === "object" ? payload.options : {};
    await openScreenVisionWindow(tool, options);
    return true;
  });

  ipcMain.handle("screen-vision:tutorial:reset-all", async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return false;
    }

    mainWindow.webContents.send("tutorial:reset-all");
    return true;
  });

  ipcMain.handle("screen-vision-window:minimize", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
    return true;
  });

  ipcMain.handle("screen-vision-window:close", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window?.screenVisionTool === "alertas") {
      window.hide();
      return true;
    }

    window?.close();
    return true;
  });

  ipcMain.handle("screen-vision-window:resize-to-content", async (event, payload = {}) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window || window.isDestroyed()) {
      return false;
    }

    const width = clamp(Math.round(Number(payload.width) || window.getContentBounds().width), 320, 1400);
    const height = clamp(Math.round(Number(payload.height) || window.getContentBounds().height), 200, 1200);
    window.setContentSize(width, height, true);
    return true;
  });

  ipcMain.handle("screen-vision:profiles:list", async () => {
    return listScreenVisionProfiles();
  });

  ipcMain.handle("screen-vision:profiles:create", async (_event, payload = {}) => {
    const profileName = typeof payload.profileName === "string" ? payload.profileName : "";
    const characterName = typeof payload.characterName === "string" ? payload.characterName : "";
    const profilePath = await createScreenVisionProfileFile(profileName || undefined, characterName || undefined);
    await activateScreenVisionProfile(profilePath, { saveCurrentFirst: true });
    return listScreenVisionProfiles();
  });

  ipcMain.handle("screen-vision:profiles:duplicate", async (_event, payload = {}) => {
    const profilePath = typeof payload.profilePath === "string" ? payload.profilePath : "";
    const duplicatePath = await duplicateScreenVisionProfileFile(profilePath);
    await activateScreenVisionProfile(duplicatePath, { saveCurrentFirst: true });
    return listScreenVisionProfiles();
  });

  ipcMain.handle("screen-vision:profiles:rename", async (_event, payload = {}) => {
    const profilePath = typeof payload.profilePath === "string" ? payload.profilePath : "";
    const profileName = typeof payload.profileName === "string" ? payload.profileName : "";
    await renameScreenVisionProfileFile(profilePath, profileName);
    return listScreenVisionProfiles();
  });

  ipcMain.handle("screen-vision:profiles:update", async (_event, payload = {}) => {
    const profilePath = typeof payload.profilePath === "string" ? payload.profilePath : "";
    const profileName = typeof payload.profileName === "string" ? payload.profileName : "";
    const characterName = typeof payload.characterName === "string" ? payload.characterName : "";
    await updateScreenVisionProfileMetadata(profilePath, {
      profileName,
      characterName
    });
    return listScreenVisionProfiles();
  });

  ipcMain.handle("screen-vision:profiles:delete", async (_event, payload = {}) => {
    const profilePath = typeof payload.profilePath === "string" ? payload.profilePath : "";
    await deleteScreenVisionProfileFile(profilePath);
    return listScreenVisionProfiles();
  });

  ipcMain.handle("screen-vision:profiles:activate", async (_event, payload = {}) => {
    const profilePath = typeof payload.profilePath === "string" ? payload.profilePath : "";
    await activateScreenVisionProfile(profilePath, { saveCurrentFirst: true });
    return listScreenVisionProfiles();
  });

  ipcMain.handle("screen-vision:profiles:import", async () => {
    const importedPath = await importScreenVisionProfileFromDialog();
    if (importedPath) {
      await activateScreenVisionProfile(importedPath, { saveCurrentFirst: true });
    }
    return listScreenVisionProfiles();
  });

  ipcMain.handle("screen-vision:profiles:export", async (_event, payload = {}) => {
    const profilePath = typeof payload.profilePath === "string" ? payload.profilePath : "";
    await exportScreenVisionProfileToDialog(profilePath);
    return true;
  });

  ipcMain.handle("screen-vision:profiles:resolve-characters", async (_event, payload = {}) => {
    const names = Array.isArray(payload?.names) ? payload.names : [];
    return resolveScreenVisionProfileCharacterSummaries(names);
  });

  ipcMain.handle("screen-vision:dialogs:confirm", async (event, payload = {}) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const title = typeof payload.title === "string" ? payload.title : tr("dialog.confirm");
    const message = typeof payload.message === "string" ? payload.message : "";
    const confirmLabel = typeof payload.confirmLabel === "string" ? payload.confirmLabel : tr("dialog.confirm");
    const cancelLabel = typeof payload.cancelLabel === "string" ? payload.cancelLabel : tr("dialog.cancel");
    const checkboxLabel = typeof payload.checkboxLabel === "string" ? payload.checkboxLabel : "";
    const sessionKey = typeof payload.sessionKey === "string" ? payload.sessionKey : "";
    const requestedTone = String(payload.tone || "danger").trim().toLowerCase();
    const tone = ["warning", "success"].includes(requestedTone) ? requestedTone : "danger";
    const mediaPath = typeof payload.mediaPath === "string" ? payload.mediaPath : "";
    const width = Number.isFinite(Number(payload.width)) ? Number(payload.width) : undefined;
    const height = Number.isFinite(Number(payload.height)) ? Number(payload.height) : undefined;
    const mediaWidth = Number.isFinite(Number(payload.mediaWidth)) ? Number(payload.mediaWidth) : undefined;

    return showScreenVisionConfirmDialog(ownerWindow, {
      title,
      message,
      confirmLabel,
      cancelLabel,
      checkboxLabel,
      sessionKey,
      tone,
      mediaPath,
      width,
      height,
      mediaWidth,
      hideCancel: payload.hideCancel === true,
      autoHeight: payload.autoHeight === true,
      external: payload.external === true,
      centerOnDisplay: payload.centerOnDisplay === true,
      flat: payload.flat === true
    });
  });

  ipcMain.handle("screen-vision:dialogs:prompt", async (event, payload = {}) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const title = typeof payload.title === "string" ? payload.title : tr("common.edit");
    const message = typeof payload.message === "string" ? payload.message : "";
    const confirmLabel = typeof payload.confirmLabel === "string" ? payload.confirmLabel : tr("dialog.save");
    const cancelLabel = typeof payload.cancelLabel === "string" ? payload.cancelLabel : tr("dialog.cancel");
    const inputValue = typeof payload.inputValue === "string" ? payload.inputValue : "";
    const placeholder = typeof payload.placeholder === "string" ? payload.placeholder : "";
    const maxLength = Number.isFinite(Number(payload.maxLength)) ? Math.max(1, Math.min(200, Number(payload.maxLength))) : 80;

    return showScreenVisionPromptDialog(ownerWindow, {
      title,
      message,
      confirmLabel,
      cancelLabel,
      inputValue,
      placeholder,
      maxLength
    });
  });

  ipcMain.handle("screen-vision:obs:get-status", async () => obsMirrorSync.getStatus());

  ipcMain.handle("screen-vision:obs:toggle", async (event) => {
    if (obsMirrorSync.getStatus().enabled) {
      return obsMirrorSync.disable();
    }

    const overlayToolsState = await readOverlayToolsState();
    const tibiaState = await getTibiaWindowState({ forceFresh: true });
    const ownerWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const payload = {
      regions: overlayToolsState.mirrors.items.filter((entry) => entry.isVisible !== false),
      tibiaState
    };

    try {
      return await obsMirrorSync.enable(payload);
    } catch (firstError) {
      const firstMessage = String(firstError?.message || firstError || "");
      if (!/auth|password|identify/i.test(firstMessage)) {
        await writeDebugLog(`obs-mirror-enable-failed ${firstMessage}`);
        return {
          ...obsMirrorSync.getStatus(),
          error: tr("screenVision.obs.setupRequired")
        };
      }

      const savedPassword = await readSavedObsWebSocketPassword();
      const promptResult = await showScreenVisionPromptDialog(ownerWindow, {
        title: "OBS Studio",
        message: tr("screenVision.obs.passwordPrompt"),
        confirmLabel: tr("screenVision.obs.connect"),
        cancelLabel: tr("dialog.cancel"),
        inputType: "password",
        inputValue: savedPassword,
        placeholder: tr("screenVision.obs.passwordPlaceholder"),
        maxLength: 200,
        checkboxLabel: tr("screenVision.obs.savePassword"),
        checkboxChecked: Boolean(savedPassword),
        mediaPath: path.join("assets", "ui", "tutorial", "websocketobs.gif"),
        external: true,
        flat: true,
        returnPayload: true
      });

      if (promptResult === null) {
        return obsMirrorSync.getStatus();
      }

      const password = String(promptResult?.value || "");

      try {
        const status = await obsMirrorSync.enable({ ...payload, password });
        if (promptResult?.checked) {
          await saveObsWebSocketPassword(password);
        } else {
          await clearSavedObsWebSocketPassword();
        }
        return status;
      } catch (retryError) {
        await writeDebugLog(`obs-mirror-auth-failed ${retryError?.message || String(retryError)}`);
        return {
          ...obsMirrorSync.getStatus(),
          error: tr("screenVision.obs.connectionFailed")
        };
      }
    }
  });

  ipcMain.handle("screen-vision:dialogs:pick-audio-file", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const defaultAudioDir = await ensureScreenVisionCustomAudioDir();
    const result = await dialog.showOpenDialog(ownerWindow, {
      title: tr("screenVision.alerts.selectAudio"),
      defaultPath: defaultAudioDir,
      properties: ["openFile"],
      filters: [
        {
          name: "Arquivos de audio",
          extensions: ["ogg", "mp3", "wav", "flac", "m4a", "aac", "opus"]
        }
      ]
    });

    if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
      return "";
    }

    return importScreenVisionCustomAudioFile(result.filePaths[0]);
  });

  ipcMain.handle("screen-vision:timers:show-visual-alert", async (_event, payload = {}) => {
    await showTimerVisualAlertWindow(payload);
    return true;
  });

  ipcMain.handle("screen-vision:timers:hide-visual-alert", async (_event, payload = {}) => {
    await hideTimerVisualAlertWindow(payload);
    return true;
  });

  ipcMain.handle("screen-vision:timers:get-runtime", async () => {
    return buildAlertTimerRuntimeSnapshot();
  });

  ipcMain.handle("screen-vision:timers:start", async (_event, payload = {}) => {
    const timerId = typeof payload?.timerId === "string" ? payload.timerId.trim() : "";
    return startAlertTimerById(timerId, {
      restart: Boolean(payload?.restart),
      source: "manual"
    });
  });

  ipcMain.handle("screen-vision:timers:stop", async (_event, payload = {}) => {
    const timerId = typeof payload?.timerId === "string" ? payload.timerId.trim() : "";
    return stopAlertTimerById(timerId, {
      reason: "timer-stopped-manual"
    });
  });

  ipcMain.handle("screen-vision:timers:open-position-editor", async (_event, payload = {}) => {
    return openAlertPositionEditorWindow(payload);
  });

  ipcMain.handle("screen-vision:timers:update-position-editor", async (_event, payload = {}) => {
    return updateAlertPositionEditorWindow(payload);
  });

  ipcMain.handle("screen-vision:timers:close-position-editor", async (_event, payload = {}) => {
    return closeAlertPositionEditorWindow(payload);
  });

  ipcMain.handle("screen-vision:regions:list", async () => {
    const overlayToolsState = await readOverlayToolsState();
    return decorateScreenVisionRegions(overlayToolsState.mirrors.items);
  });

  ipcMain.handle("screen-vision:regions:get", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    const overlayToolsState = await readOverlayToolsState();
    const items = decorateScreenVisionRegions(overlayToolsState.mirrors.items);
    return items.find((entry) => entry.id === regionId) || null;
  });

  ipcMain.handle("screen-vision:regions:open-countdown-editor", async (event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";

    if (!regionId) {
      return false;
    }

    const ownerWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    await openCountdownEditorWindow(ownerWindow, regionId);
    return true;
  });

  ipcMain.handle("screen-vision:regions:add", async () => {
    const tibiaState = await getTibiaWindowState({ forceFresh: true });
    const initialOverlayToolsState = await readOverlayToolsState();

    if (!canUseTibiaWindowForScreenVision(tibiaState)) {
      return {
        cancelled: true,
        reason: "tibia-unavailable",
        items: initialOverlayToolsState.mirrors.items
      };
    }

    if (initialOverlayToolsState.mirrors.items.length > 0
      && initialOverlayToolsState.mirrors.items.every((entry) => entry.isVisible === false)) {
      return {
        cancelled: true,
        reason: "mirrors-hidden",
        items: initialOverlayToolsState.mirrors.items
      };
    }

    let selection = null;
    try {
      selection = await withSuspendedGridOverlay(() => openNativeRegionSelectionWindow({
        preferredDisplayId: tibiaState.displayId || null
      }));
    } catch (error) {
      await writeDebugLog(`screen-vision-region-selection-error ${error?.message || String(error)}`);
      return {
        cancelled: true,
        reason: "selection-failed",
        items: initialOverlayToolsState.mirrors.items
      };
    }
    const overlayToolsState = await readOverlayToolsState();

    if (!selection) {
      await writeDebugLog("screen-vision-region-selection-cancelled");
      return {
        cancelled: true,
        items: overlayToolsState.mirrors.items
      };
    }

    const sourceBounds = tibiaState.clientBounds || tibiaState.bounds;
    const constrainedCaptureBounds = intersectBounds(selection.captureBounds, sourceBounds);

    if (!constrainedCaptureBounds) {
      await writeDebugLog(`screen-vision-region-selection-outside-tibia selection=${JSON.stringify(selection.captureBounds)} source=${JSON.stringify(sourceBounds)}`);
      return {
        cancelled: true,
        reason: "outside-tibia",
        items: overlayToolsState.mirrors.items
      };
    }

    const { region, savedState } = await appendOverlayMirrorEntry((currentItems) => ({
      name: createNextRegionName(currentItems),
      displayId: selection.displayId,
      displayLabel: selection.displayLabel,
      displayBounds: selection.displayBounds,
      sourceBounds,
      sourceWindowTitle: tibiaState.title,
      sourceProcessName: tibiaState.processName,
      captureBounds: constrainedCaptureBounds,
      relativeBounds: toRelativeBounds(constrainedCaptureBounds, sourceBounds),
      mirrorBounds: toInitialMirrorBounds(constrainedCaptureBounds, selection.displayBounds),
      opacity: 100,
      isVisible: true,
      isLocked: false,
      isFixedCrop: false,
      scale: 1,
      glowEnabled: false,
      glowColor: "#FFFFFF",
      glowSavedColors: ["#FFFFFF"],
      glowIntensity: 10
    }));

    await writeDebugLog(`screen-vision-region-create region=${JSON.stringify(region)}`);
    await writeDebugLog(`screen-vision-region-saved count=${savedState.mirrors.items.length} regionId=${region.id}`);
    await syncRegionMirrorWindows(savedState);

    return {
      cancelled: false,
      region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === region.id) || region),
      items: decorateScreenVisionRegions(savedState.mirrors.items)
    };
  });

  ipcMain.handle("screen-vision:regions:add-fixed", async () => {
    const tibiaState = await getTibiaWindowState({ forceFresh: true });
    const initialOverlayToolsState = await readOverlayToolsState();

    if (!canUseTibiaWindowForScreenVision(tibiaState)) {
      return {
        cancelled: true,
        reason: "tibia-unavailable",
        items: initialOverlayToolsState.mirrors.items
      };
    }

    if (initialOverlayToolsState.mirrors.items.length > 0
      && initialOverlayToolsState.mirrors.items.every((entry) => entry.isVisible === false)) {
      return {
        cancelled: true,
        reason: "mirrors-hidden",
        items: initialOverlayToolsState.mirrors.items
      };
    }

    let selection = null;
    try {
      selection = await withSuspendedGridOverlay(() => openNativeRegionSelectionWindow({
        preferredDisplayId: tibiaState.displayId || null,
        mode: "fixed-icon-crop",
        fixedSize: 32
      }));
    } catch (error) {
      await writeDebugLog(`screen-vision-fixed-region-selection-error ${error?.message || String(error)}`);
      return {
        cancelled: true,
        reason: "selection-failed",
        items: initialOverlayToolsState.mirrors.items
      };
    }
    const overlayToolsState = await readOverlayToolsState();

    if (!selection) {
      await writeDebugLog("screen-vision-fixed-region-selection-cancelled");
      return {
        cancelled: true,
        items: overlayToolsState.mirrors.items
      };
    }

    const sourceBounds = tibiaState.clientBounds || tibiaState.bounds;
    const constrainedCaptureBounds = intersectBounds(selection.captureBounds, sourceBounds, 1);

    if (!constrainedCaptureBounds) {
      await writeDebugLog(`screen-vision-fixed-region-selection-outside-tibia selection=${JSON.stringify(selection.captureBounds)} source=${JSON.stringify(sourceBounds)}`);
      return {
        cancelled: true,
        reason: "outside-tibia",
        items: overlayToolsState.mirrors.items
      };
    }

    const { region, savedState } = await appendOverlayMirrorEntry((currentItems) => ({
      name: createNextRegionName(currentItems),
      displayId: selection.displayId,
      displayLabel: selection.displayLabel,
      displayBounds: selection.displayBounds,
      sourceBounds,
      sourceWindowTitle: tibiaState.title,
      sourceProcessName: tibiaState.processName,
      captureBounds: constrainedCaptureBounds,
      relativeBounds: toRelativeBounds(constrainedCaptureBounds, sourceBounds),
      mirrorBounds: toInitialMirrorBounds(constrainedCaptureBounds, selection.displayBounds),
      opacity: 100,
      isVisible: true,
      isLocked: false,
      isFixedCrop: true,
      scale: 1,
      glowEnabled: false,
      glowColor: "#FFFFFF",
      glowSavedColors: ["#FFFFFF"],
      glowIntensity: 10
    }));

    await writeDebugLog(`screen-vision-fixed-region-create region=${JSON.stringify(region)}`);
    await writeDebugLog(`screen-vision-fixed-region-saved count=${savedState.mirrors.items.length} regionId=${region.id}`);
    await syncRegionMirrorWindows(savedState);

    return {
      cancelled: false,
      region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === region.id) || region),
      items: decorateScreenVisionRegions(savedState.mirrors.items)
    };
  });

  ipcMain.handle("screen-vision:regions:reselect", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    return reselectRegionById(regionId);
  });

  ipcMain.handle("screen-vision:regions:toggle-visibility", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      isVisible: !region.isVisible
    }));
    await syncRegionMirrorWindows(savedState);
    return {
      region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === regionId) || null),
      items: decorateScreenVisionRegions(savedState.mirrors.items)
    };
  });

  ipcMain.handle("screen-vision:regions:toggle-lock", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      isLocked: !region.isLocked
    }));
    const nextRegion = savedState.mirrors.items.find((entry) => entry.id === regionId) || null;

    if (nextRegion && !nextRegion.isLocked) {
      countdownRunningRegionIds.delete(regionId);
      await stopNativeRegionCountdown(regionId).catch(() => {});
    }

    await syncRegionMirrorWindows(savedState);
    return {
      region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === regionId) || null),
      items: decorateScreenVisionRegions(savedState.mirrors.items)
    };
  });

  ipcMain.handle("screen-vision:regions:preview-opacity", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    const nextOpacity = clampNumber(payload.opacity, 0.15, 1, 1);

    if (!regionId) {
      return { ok: false };
    }

    await previewNativeMirrorOpacity(regionId, Math.round(nextOpacity * 100));
    return { ok: true };
  });

  ipcMain.handle("screen-vision:regions:set-opacity", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    const nextOpacity = clampNumber(payload.opacity, 0.15, 1, 1);
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      opacity: Math.round(nextOpacity * 100)
    }));
    await syncRegionMirrorWindows(savedState);
    return {
      region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === regionId) || null),
      items: decorateScreenVisionRegions(savedState.mirrors.items)
    };
  });

  ipcMain.handle("screen-vision:regions:update", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    const patch = normalizeScreenVisionRegionPatch(payload.patch);
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      ...patch,
      countdown: patch.countdown
        ? {
            ...(region.countdown || {}),
            ...patch.countdown
          }
        : region.countdown
    }));

    if (patch.countdown?.enabled === false) {
      countdownRunningRegionIds.delete(regionId);
      await stopNativeRegionCountdown(regionId).catch(() => {});
    }

    await syncRegionMirrorWindows(savedState);
    return {
      region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === regionId) || null),
      items: decorateScreenVisionRegions(savedState.mirrors.items)
    };
  });

  ipcMain.handle("screen-vision:regions:toggle-all-visibility", async () => {
    const overlayToolsState = await readOverlayToolsState();
    const shouldShowAll = overlayToolsState.mirrors.items.some((entry) => entry.isVisible === false);
    overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.map((entry) => ({
      ...entry,
      isVisible: shouldShowAll
    }));
    const savedState = await writeOverlayToolsState(overlayToolsState);
    await syncRegionMirrorWindows(savedState);
    return {
      items: decorateScreenVisionRegions(savedState.mirrors.items)
    };
  });

  ipcMain.handle("screen-vision:regions:toggle-all-lock", async () => {
    const overlayToolsState = await readOverlayToolsState();
    const shouldLockAll = overlayToolsState.mirrors.items.some((entry) => !entry.isLocked);
    overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.map((entry) => ({
      ...entry,
      isLocked: shouldLockAll
    }));
    const savedState = await writeOverlayToolsState(overlayToolsState);

    if (!shouldLockAll) {
      for (const region of savedState.mirrors.items) {
        countdownRunningRegionIds.delete(region.id);
        await stopNativeRegionCountdown(region.id).catch(() => {});
      }
    }

    await syncRegionMirrorWindows(savedState);
    return {
      items: decorateScreenVisionRegions(savedState.mirrors.items)
    };
  });

  ipcMain.handle("screen-vision:regions:delete", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    countdownRunningRegionIds.delete(regionId);
    await stopNativeRegionCountdown(regionId).catch(() => {});
    const overlayToolsState = await readOverlayToolsState();
    overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.filter((entry) => entry.id !== regionId);
    const savedState = await writeOverlayToolsState(overlayToolsState);
    await closeRegionMirrorWindow(regionId, { persistClosedState: false });
    return {
      items: decorateScreenVisionRegions(savedState.mirrors.items)
    };
  });

  ipcMain.handle("screen-vision:regions:unsnap", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    await forceUnsnapNativeMirror(regionId).catch(() => {});
    await drainNativeHostEvents().catch(() => {});
    const overlayToolsState = await readOverlayToolsState();
    return {
      region: decorateScreenVisionRegion(overlayToolsState.mirrors.items.find((entry) => entry.id === regionId) || null),
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  });

  ipcMain.handle("screen-vision:regions:start-countdown", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    const result = await triggerRegionCountdown(regionId, { forceRestart: false });
    return {
      ok: result.ok,
      ignored: result.ignored,
      region: decorateScreenVisionRegion(result.region),
      items: decorateScreenVisionRegions(result.items)
    };
  });

  ipcMain.handle("screen-vision:regions:stop-countdown", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    const result = await stopRegionCountdown(regionId);
    return {
      ok: result.ok,
      region: decorateScreenVisionRegion(result.region),
      items: decorateScreenVisionRegions(result.items)
    };
  });

  ipcMain.handle("screen-vision:visual:get", async () => {
    const overlayToolsState = await readOverlayToolsState();
    return getScreenVisionVisualSettings(overlayToolsState);
  });

  ipcMain.handle("screen-vision:visual:update", async (_event, payload = {}) => {
    const patch = normalizeScreenVisionVisualPatch(payload.patch);
    const overlayToolsState = await readOverlayToolsState();
    overlayToolsState.settings = overlayToolsState.settings || {};
    overlayToolsState.settings.screenVision = overlayToolsState.settings.screenVision || {};
    overlayToolsState.settings.screenVision.visualCustomization = {
      ...getScreenVisionVisualSettings(overlayToolsState),
      ...patch
    };
    const savedState = await writeOverlayToolsState(overlayToolsState);
    await syncNativeVisualCustomization(savedState).catch(() => {});
    return getScreenVisionVisualSettings(savedState);
  });

  ipcMain.handle("screen-vision:visual:preview", async (_event, payload = {}) => {
    const patch = normalizeScreenVisionVisualPatch(payload.patch);
    const overlayToolsState = await readOverlayToolsState();
    overlayToolsState.settings = overlayToolsState.settings || {};
    overlayToolsState.settings.screenVision = overlayToolsState.settings.screenVision || {};
    overlayToolsState.settings.screenVision.visualCustomization = {
      ...getScreenVisionVisualSettings(overlayToolsState),
      ...patch
    };
    await syncNativeVisualCustomization(overlayToolsState).catch(() => {});
    return getScreenVisionVisualSettings(overlayToolsState);
  });

  ipcMain.handle("screen-vision:grid:get", async () => {
    const overlayToolsState = await readOverlayToolsState();
    return getScreenVisionGridSettings(overlayToolsState);
  });

  ipcMain.handle("screen-vision:grid:toggle", async () => {
    const overlayToolsState = await readOverlayToolsState();
    const current = getScreenVisionGridSettings(overlayToolsState);
    overlayToolsState.settings = overlayToolsState.settings || {};
    overlayToolsState.settings.screenVision = overlayToolsState.settings.screenVision || {};
    overlayToolsState.settings.screenVision.gridEnabled = !current.enabled;
    const savedState = await writeOverlayToolsState(overlayToolsState);
    const next = getScreenVisionGridSettings(savedState);
    await syncNativeGridOverlay(savedState).catch(() => {});
    return next;
  });

  ipcMain.handle("screen-vision:tibia:get-state", async () => {
    const tibiaState = await getTibiaWindowState({ forceFresh: true });
    const shouldShowOverlays = await shouldShowScreenVisionOverlays(tibiaState).catch(() => false);
    // OBS is an allowed companion surface for the Mirror UI. Keep this separate
    // from the actual overlay visibility rule, which must still stay below OBS.
    const obsStudioFocused = !shouldShowOverlays && await isObsStudioFocused();
    const shouldShowMirrorUi = Boolean(
      shouldShowOverlays
      || (
        obsStudioFocused
        && nativeMirrorRegionCount > 0
        && canUseTibiaWindowForScreenVision(tibiaState)
      )
    );
    const payload = tibiaState
      ? {
          ...tibiaState,
          shouldShowOverlays,
          shouldShowMirrorUi
        }
      : {
          shouldShowOverlays: false,
          shouldShowMirrorUi: false
        };
    await writeDebugLog(`screen-vision-tibia-state ${JSON.stringify(payload)}`);
    return payload;
  });

  ipcMain.handle("screen-vision:capture:get-screen-sources", async () => {
    return listDesktopSources("screen");
  });

  ipcMain.handle("screen-vision:capture:get-window-sources", async () => {
    return listDesktopSources("window");
  });
}

function normalizeAppUpdateInfo(info = {}) {
  const localizedNotes = info?.releaseNotesByLocale && typeof info.releaseNotesByLocale === "object"
    ? info.releaseNotesByLocale
    : {};
  const locale = getActiveLocale();
  const releaseNotes = [locale, locale.toLowerCase(), "en", "pt-BR"]
    .map((key) => localizedNotes[key])
    .find((value) => typeof value === "string" && value.trim());

  return {
    version: String(info?.version || "").trim(),
    releaseNotes: typeof releaseNotes === "string"
      ? releaseNotes.trim()
      : (typeof info?.releaseNotes === "string" ? info.releaseNotes.trim() : "")
  };
}

function broadcastAppUpdateState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("app-updater:state", appUpdateState);
}

function closeScreenVisionConfirmDialogsByRole(role) {
  for (const entry of screenVisionConfirmDialogWindows.values()) {
    if (entry.role !== role || entry.window.isDestroyed()) {
      continue;
    }
    entry.window.close();
  }
}

function updateScreenVisionConfirmDialogsByRole(role, payload = {}) {
  for (const entry of screenVisionConfirmDialogWindows.values()) {
    if (entry.role !== role || entry.window.isDestroyed()) {
      continue;
    }
    entry.window.webContents.send("screen-vision:confirm-dialog:update", payload);
  }
}

function showAppUpdateDownloadProgressDialog(info = {}) {
  const normalizedInfo = normalizeAppUpdateInfo(info);
  void showScreenVisionConfirmDialog(mainWindow, {
    title: tr("updater.downloadingTitle"),
    message: tr("updater.downloadingMessage", { percent: 0 }),
    tone: "success",
    flat: true,
    mediaPath: path.join("assets", "ui", "tutorial", "update.gif"),
    mediaWidth: 280,
    width: 456,
    height: 560,
    autoHeight: true,
    external: true,
    centerOnDisplay: true,
    passive: true,
    showProgress: true,
    progress: 0,
    dialogRole: APP_UPDATE_DOWNLOAD_DIALOG_ROLE,
    version: normalizedInfo.version
  });
}

async function showAppUpdateDownloadedDialog(info = {}) {
  const normalizedInfo = normalizeAppUpdateInfo(info);
  const message = [
    tr("updater.downloadedMessage", { version: normalizedInfo.version || tr("updater.newVersion") }),
    normalizedInfo.releaseNotes,
    tr("updater.installOnClose")
  ].filter(Boolean).join("\n\n");
  const result = await showScreenVisionConfirmDialog(mainWindow, {
    title: tr("updater.downloadedTitle"),
    message,
    confirmLabel: tr("updater.installNow"),
    confirmTooltip: tr("updater.installNow"),
    hideCancel: true,
    tone: "success",
    flat: true,
    mediaPath: path.join("assets", "ui", "tutorial", "update.gif"),
    mediaWidth: 280,
    width: 456,
    height: 660,
    autoHeight: true,
    external: true,
    centerOnDisplay: true
  });

  if (result.confirmed && appUpdaterController?.install?.()) {
    appIsQuitting = true;
  }
}

async function readOverlayToolsState() {
  const stored = await readOverlayToolsStore();
  return normalizeOverlayToolsState(stored?.[OVERLAY_TOOLS_STORAGE_KEY] || null);
}

async function bootstrapScreenVisionProfiles() {
  await writeDebugLog("bootstrap-screen-vision-profiles:ensure-dir:start");
  await ensureScreenVisionProfilesDir();
  await writeDebugLog("bootstrap-screen-vision-profiles:ensure-dir:finish");
  let profilePath = await readLastScreenVisionProfilePath();
  let overlayToolsState = null;
  await writeDebugLog(`bootstrap-screen-vision-profiles:last-profile ${profilePath || "<empty>"}`);

  if (!profilePath || !(await fileExists(profilePath))) {
    await writeDebugLog("bootstrap-screen-vision-profiles:list-profiles:start");
    const profiles = await listScreenVisionProfiles();
    await writeDebugLog(`bootstrap-screen-vision-profiles:list-profiles:finish count=${profiles.length}`);
    profilePath = profiles[0]?.path || null;
  }

  if (!profilePath) {
    activeScreenVisionProfilePath = null;
    overlayToolsState = createEmptyProfileOverlayState();
    await writeDebugLog("bootstrap-screen-vision-profiles:no-profile-using-empty-state");
    await saveLastScreenVisionProfilePath("");
    await writeDebugLog("bootstrap-screen-vision-profiles:save-last-profile:finish");
  } else {
    activeScreenVisionProfilePath = profilePath;
    await writeDebugLog(`bootstrap-screen-vision-profiles:active path=${profilePath}`);
    await saveLastScreenVisionProfilePath(profilePath);
    await writeDebugLog("bootstrap-screen-vision-profiles:save-last-profile:finish");
    await writeDebugLog("bootstrap-screen-vision-profiles:load-profile:start");
    overlayToolsState = await loadOverlayToolsStateFromProfile(profilePath);
    await writeDebugLog(`bootstrap-screen-vision-profiles:load-profile:finish mirrors=${overlayToolsState?.mirrors?.items?.length || 0} timers=${overlayToolsState?.timers?.items?.length || 0}`);
  }

  await writeDebugLog("bootstrap-screen-vision-profiles:write-state:start");
  await writeOverlayToolsState(overlayToolsState, {
    reason: "bootstrap-profile",
    skipPersistProfile: true,
    skipSyncHotkeys: true,
    skipEmit: true
  });
  await writeDebugLog("bootstrap-screen-vision-profiles:write-state:finish");
}

async function ensureScreenVisionProfilesDir() {
  await fs.mkdir(screenVisionProfilesDir, { recursive: true });
}

async function listScreenVisionProfiles() {
  await ensureScreenVisionProfilesDir();
  const entries = await fs.readdir(screenVisionProfilesDir, { withFileTypes: true }).catch(() => []);
  const items = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json") || entry.name.toLowerCase().endsWith(".audio.json")) {
      continue;
    }

    const profilePath = path.join(screenVisionProfilesDir, entry.name);
    let profileName = path.basename(entry.name, ".json");
    let characterName = "";

    try {
      const profileJson = JSON.parse(await fs.readFile(profilePath, "utf8"));
      if (typeof profileJson?.ProfileName === "string" && profileJson.ProfileName.trim()) {
        profileName = profileJson.ProfileName.trim();
      }
      characterName = sanitizeProfileCharacterName(profileJson?.CharacterName);
    } catch (_error) {
    }

    items.push({
      path: profilePath,
      name: profileName,
      characterName,
      isActive: Boolean(activeScreenVisionProfilePath && pathsEqual(profilePath, activeScreenVisionProfilePath))
    });
  }

  items.sort((left, right) => {
    if (left.isActive && !right.isActive) {
      return -1;
    }
    if (!left.isActive && right.isActive) {
      return 1;
    }
    return left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" });
  });

  return items;
}

async function readLastScreenVisionProfilePath() {
  try {
    const value = (await fs.readFile(screenVisionLastProfilePath, "utf8")).trim();
    return value || null;
  } catch (_error) {
    return null;
  }
}

async function saveLastScreenVisionProfilePath(profilePath) {
  await fs.mkdir(path.dirname(screenVisionLastProfilePath), { recursive: true });
  await fs.writeFile(screenVisionLastProfilePath, String(profilePath || ""), "utf8");
}

function getScreenVisionAudioProfilePath(profilePath) {
  return path.join(
    path.dirname(profilePath),
    `${path.basename(profilePath, ".json")}.audio.json`
  );
}

async function createScreenVisionProfileFile(requestedName, requestedCharacterName) {
  await writeDebugLog("create-screen-vision-profile-file:ensure-dir:start");
  await ensureScreenVisionProfilesDir();
  await writeDebugLog("create-screen-vision-profile-file:ensure-dir:finish");
  const profileName = await allocateUniqueProfileName(requestedName || "Profile");
  const characterName = sanitizeProfileCharacterName(requestedCharacterName);
  await writeDebugLog(`create-screen-vision-profile-file:allocated-name ${profileName}`);
  const profilePath = path.join(screenVisionProfilesDir, `${profileName}.json`);
  const emptyState = createEmptyProfileOverlayState();
  emptyState.settings.screenVision.profileCharacterName = characterName;
  const tibiaProfile = overlayStateToMirrorProfile(emptyState, { profileName });
  const audioProfile = overlayStateToMirrorAudioProfile(emptyState);
  await writeDebugLog(`create-screen-vision-profile-file:write-profile:start path=${profilePath}`);
  writeJsonFileAtomicSync(profilePath, tibiaProfile);
  await writeDebugLog("create-screen-vision-profile-file:write-profile:finish");
  await writeDebugLog("create-screen-vision-profile-file:write-audio:start");
  writeJsonFileAtomicSync(getScreenVisionAudioProfilePath(profilePath), audioProfile);
  await writeDebugLog("create-screen-vision-profile-file:write-audio:finish");
  return profilePath;
}

async function duplicateScreenVisionProfileFile(profilePath) {
  if (!profilePath || !(await fileExists(profilePath))) {
    throw new Error("profile-not-found");
  }

  const baseName = path.basename(profilePath, ".json");
  const nextName = await allocateUniqueProfileName(`${baseName} copy`);
  const nextPath = path.join(screenVisionProfilesDir, `${nextName}.json`);
  await fs.copyFile(profilePath, nextPath);

  const audioPath = getScreenVisionAudioProfilePath(profilePath);
  const nextAudioPath = getScreenVisionAudioProfilePath(nextPath);

  if (await fileExists(audioPath)) {
    await fs.copyFile(audioPath, nextAudioPath);
  } else {
    await writeJsonFileAtomic(nextAudioPath, createEmptyMirrorAudioProfile());
  }

  const profileJson = JSON.parse(await fs.readFile(nextPath, "utf8"));
  profileJson.ProfileName = nextName;
  await writeJsonFileAtomic(nextPath, profileJson);
  return nextPath;
}

async function renameScreenVisionProfileFile(profilePath, requestedName) {
  if (!profilePath || !(await fileExists(profilePath))) {
    throw new Error("profile-not-found");
  }

  const sanitized = sanitizeProfileFileStem(requestedName);
  if (!sanitized) {
    throw new Error("invalid-profile-name");
  }

  const nextPath = path.join(screenVisionProfilesDir, `${sanitized}.json`);
  if (!pathsEqual(profilePath, nextPath) && await fileExists(nextPath)) {
    throw new Error("profile-name-taken");
  }

  if (!pathsEqual(profilePath, nextPath)) {
    await fs.rename(profilePath, nextPath);
    const currentAudioPath = getScreenVisionAudioProfilePath(profilePath);
    const nextAudioPath = getScreenVisionAudioProfilePath(nextPath);
    if (await fileExists(currentAudioPath)) {
      await fs.rename(currentAudioPath, nextAudioPath);
    }
    if (activeScreenVisionProfilePath && pathsEqual(activeScreenVisionProfilePath, profilePath)) {
      activeScreenVisionProfilePath = nextPath;
      await saveLastScreenVisionProfilePath(nextPath);
    }
    profilePath = nextPath;
  }

  const profileJson = JSON.parse(await fs.readFile(profilePath, "utf8"));
  profileJson.ProfileName = sanitized;
  await writeJsonFileAtomic(profilePath, profileJson);
  return profilePath;
}

async function deleteScreenVisionProfileFile(profilePath) {
  if (!profilePath) {
    return;
  }

  const wasActive = Boolean(activeScreenVisionProfilePath && pathsEqual(activeScreenVisionProfilePath, profilePath));
  await fs.rm(profilePath, { force: true }).catch(() => {});
  await fs.rm(getScreenVisionAudioProfilePath(profilePath), { force: true }).catch(() => {});

  if (!wasActive) {
    return;
  }

  // A profile owns its alert runtime. Clear every live window before selecting
  // a fallback so text from the deleted profile cannot remain on the screen.
  stopAllAlertTimerRuntimes({ emit: false });
  await clearAllTimerVisualAlertWindows();
  await clearAlertPositionEditorWindows();

  const profiles = await listScreenVisionProfiles();
  let fallbackPath = profiles[0]?.path || null;

  if (!fallbackPath) {
    activeScreenVisionProfilePath = null;
    await saveLastScreenVisionProfilePath("");
    const overlayToolsState = createEmptyProfileOverlayState();
    await writeOverlayToolsState(overlayToolsState, {
      reason: "profile-deleted-empty",
      skipPersistProfile: true
    });
    await syncRegionMirrorWindows(overlayToolsState);
    await emitScreenVisionProfilesChanged();
    return;
  }

  await activateScreenVisionProfile(fallbackPath, { saveCurrentFirst: false });
}

async function updateScreenVisionProfileMetadata(profilePath, payload = {}) {
  if (!profilePath || !(await fileExists(profilePath))) {
    throw new Error("profile-not-found");
  }

  const nextName = sanitizeProfileFileStem(payload.profileName);
  const nextCharacterName = sanitizeProfileCharacterName(payload.characterName);
  let finalPath = profilePath;

  if (nextName) {
    finalPath = await renameScreenVisionProfileFile(profilePath, nextName);
  }

  const profileJson = JSON.parse(await fs.readFile(finalPath, "utf8"));
  profileJson.CharacterName = nextCharacterName;
  await writeJsonFileAtomic(finalPath, profileJson);

  if (activeScreenVisionProfilePath && pathsEqual(activeScreenVisionProfilePath, finalPath)) {
    const overlayToolsState = await readOverlayToolsState();
    overlayToolsState.settings.screenVision.profileCharacterName = nextCharacterName;
    await writeOverlayToolsState(overlayToolsState, {
      reason: "profile-meta-updated"
    });
  }

  return finalPath;
}

async function resolveScreenVisionProfileCharacterSummaries(names) {
  const uniqueNames = [...new Set(
    (Array.isArray(names) ? names : [])
      .map((entry) => sanitizeProfileCharacterName(entry))
      .filter(Boolean)
  )];

  if (!uniqueNames.length) {
    return {};
  }

  const response = await handleDataServiceMessage({
    type: "fetch-character-profiles",
    payload: {
      names: uniqueNames
    }
  }).catch(() => ({}));

  const result = {};

  for (const name of uniqueNames) {
    const profile = response?.[name] || null;
    result[name] = profile ? {
      name: typeof profile.name === "string" ? profile.name : name,
      level: Number.isFinite(Number(profile.level)) ? Math.max(0, Math.round(Number(profile.level))) : null,
      vocation: typeof profile.vocation === "string" ? profile.vocation : "",
      sex: typeof profile.sex === "string" ? profile.sex : "",
      world: typeof profile.world === "string" ? profile.world : "",
      guild: typeof profile.guild === "string" ? profile.guild : ""
    } : null;
  }

  return result;
}

async function activateScreenVisionProfile(profilePath, options = {}) {
  if (!profilePath || !(await fileExists(profilePath))) {
    throw new Error("profile-not-found");
  }

  if (options.saveCurrentFirst !== false) {
    await persistActiveScreenVisionProfileSnapshot();
  }

  activeScreenVisionProfilePath = profilePath;
  await saveLastScreenVisionProfilePath(profilePath);
  const overlayToolsState = await loadOverlayToolsStateFromProfile(profilePath, {
    useLiveTibiaState: true
  });
  await writeOverlayToolsState(overlayToolsState, {
    reason: "profile-activated"
  });
  await syncRegionMirrorWindows(overlayToolsState);
  await restoreAlertasWindowAnchor();
  await emitScreenVisionProfilesChanged();
}

async function loadOverlayToolsStateFromProfile(profilePath, options = {}) {
  const tibiaProfile = await readJsonFile(profilePath, createEmptyMirrorProfile(path.basename(profilePath, ".json")));
  const audioProfile = await readJsonFile(getScreenVisionAudioProfilePath(profilePath), createEmptyMirrorAudioProfile());
  const shouldUseLiveTibiaState = options.useLiveTibiaState === true;
  const tibiaState = shouldUseLiveTibiaState
    ? await getTibiaWindowState({ forceFresh: true }).catch(() => null)
    : null;
  const converted = mirrorProfileToOverlayState(tibiaProfile, audioProfile, {
    tibiaState,
    fallbackProfileName: path.basename(profilePath, ".json")
  });
  return converted.overlayToolsState;
}

async function persistActiveScreenVisionProfileSnapshot(overlayToolsState = null) {
  if (!activeScreenVisionProfilePath) {
    return;
  }

  const state = overlayToolsState || await readOverlayToolsState();
  const profileName = path.basename(activeScreenVisionProfilePath, ".json");
  const tibiaProfile = overlayStateToMirrorProfile(state, {
    profileName,
    sourceTitle: state.mirrors?.items?.[0]?.sourceWindowTitle || "",
    sourceProcessName: state.mirrors?.items?.[0]?.sourceProcessName || ""
  });
  const alertWindowBounds = getAlertasWindowAnchor();
  const audioProfile = overlayStateToMirrorAudioProfile(state, {
    alertWindowBounds
  });

  await writeJsonFileAtomic(activeScreenVisionProfilePath, tibiaProfile);
  await writeJsonFileAtomic(getScreenVisionAudioProfilePath(activeScreenVisionProfilePath), audioProfile);
}

function getAlertasWindowAnchor() {
  const window = screenVisionWindows.get("alertas");

  if (!window || window.isDestroyed()) {
    return {
      left: null,
      top: null
    };
  }

  const bounds = window.getBounds();
  return {
    left: bounds.x,
    top: bounds.y
  };
}

function getVisualCustomizationWindowAnchorFromWindow() {
  const window = screenVisionWindows.get("visual-customization");

  if (!window || window.isDestroyed()) {
    return {
      left: null,
      top: null
    };
  }

  const bounds = window.getBounds();
  return {
    left: bounds.x,
    top: bounds.y
  };
}

async function readActiveAlertWindowAnchor() {
  if (!activeScreenVisionProfilePath) {
    return { left: null, top: null };
  }

  const audioProfile = await readJsonFile(
    getScreenVisionAudioProfilePath(activeScreenVisionProfilePath),
    createEmptyMirrorAudioProfile()
  );

  return {
    left: normalizeOptionalNumber(audioProfile.WindowLeft),
    top: normalizeOptionalNumber(audioProfile.WindowTop)
  };
}

async function readVisualCustomizationWindowAnchor() {
  const overlayToolsState = await readOverlayToolsState();
  const visual = getScreenVisionVisualSettings(overlayToolsState);
  return {
    left: normalizeOptionalNumber(visual.windowLeft),
    top: normalizeOptionalNumber(visual.windowTop)
  };
}

async function persistVisualCustomizationWindowAnchor() {
  const overlayToolsState = await readOverlayToolsState();
  overlayToolsState.settings = overlayToolsState.settings || {};
  overlayToolsState.settings.screenVision = overlayToolsState.settings.screenVision || {};
  overlayToolsState.settings.screenVision.visualCustomization = {
    ...getScreenVisionVisualSettings(overlayToolsState),
    ...getVisualCustomizationWindowAnchorFromWindow()
  };
  await writeOverlayToolsState(overlayToolsState, {
    skipSyncNativeAuxiliary: true
  });
}

async function restoreAlertasWindowAnchor() {
  const window = screenVisionWindows.get("alertas");

  if (!window || window.isDestroyed()) {
    return;
  }

  const anchor = await readActiveAlertWindowAnchor();

  if (!Number.isFinite(anchor.left) || !Number.isFinite(anchor.top)) {
    return;
  }

  const bounds = window.getBounds();
  window.setBounds({
    ...bounds,
    x: Math.round(anchor.left),
    y: Math.round(anchor.top)
  });
}

async function importScreenVisionProfileFromDialog() {
  const result = await dialog.showOpenDialog({
    title: tr("screenVision.profiles.importButton"),
    filters: [
      { name: "Tibia Mirror Profile", extensions: ["tvprofile"] },
      { name: "JSON Profile", extensions: ["json"] }
    ],
    properties: ["openFile"]
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  const sourcePath = result.filePaths[0];
  const ext = path.extname(sourcePath).toLowerCase();
  const profileName = await allocateUniqueProfileName(path.basename(sourcePath, ext));
  const targetProfilePath = path.join(screenVisionProfilesDir, `${profileName}.json`);

  if (ext === ".tvprofile") {
    const tempDir = path.join(app.getPath("temp"), `poioso-tvprofile-import-${Date.now()}`);
    await extractZipWithPowerShell(sourcePath, tempDir);
    const extractedProfilePath = path.join(tempDir, "profile.json");
    const extractedAudioPath = path.join(tempDir, "profile.audio.json");
    const profileJson = await readJsonFile(extractedProfilePath, createEmptyMirrorProfile(profileName));
    profileJson.ProfileName = profileName;
    await writeJsonFileAtomic(targetProfilePath, profileJson);

    if (await fileExists(extractedAudioPath)) {
      await writeJsonFileAtomic(getScreenVisionAudioProfilePath(targetProfilePath), await readJsonFile(extractedAudioPath, createEmptyMirrorAudioProfile()));
    } else {
      await writeJsonFileAtomic(getScreenVisionAudioProfilePath(targetProfilePath), createEmptyMirrorAudioProfile());
    }

    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    return targetProfilePath;
  }

  const profileJson = await readJsonFile(sourcePath, createEmptyMirrorProfile(profileName));
  profileJson.ProfileName = profileName;
  await writeJsonFileAtomic(targetProfilePath, profileJson);
  await writeJsonFileAtomic(getScreenVisionAudioProfilePath(targetProfilePath), createEmptyMirrorAudioProfile());
  return targetProfilePath;
}

async function exportScreenVisionProfileToDialog(profilePath) {
  const hasExistingProfile = Boolean(profilePath && await fileExists(profilePath));
  let exportProfilePath = hasExistingProfile ? profilePath : null;
  let exportAudioPath = hasExistingProfile ? getScreenVisionAudioProfilePath(profilePath) : null;
  let tempDir = null;

  if (exportProfilePath && activeScreenVisionProfilePath && pathsEqual(activeScreenVisionProfilePath, exportProfilePath)) {
    await persistActiveScreenVisionProfileSnapshot();
  }

  if (!exportProfilePath) {
    tempDir = path.join(app.getPath("temp"), `poioso-tvprofile-export-current-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    const currentState = await readOverlayToolsState();
    const profileName = "Profile 1";
    const tibiaProfile = overlayStateToMirrorProfile(currentState, { profileName });
    const audioProfile = overlayStateToMirrorAudioProfile(currentState, {
      alertWindowBounds: getAlertasWindowAnchor()
    });
    exportProfilePath = path.join(tempDir, "current-profile.json");
    exportAudioPath = path.join(tempDir, "current-profile.audio.json");
    await writeJsonFileAtomic(exportProfilePath, tibiaProfile);
    await writeJsonFileAtomic(exportAudioPath, audioProfile);
  }

  const defaultFileName = `${path.basename(exportProfilePath, ".json")}.tvprofile`;
  const result = await dialog.showSaveDialog({
    title: tr("screenVision.profiles.exportButton"),
    defaultPath: defaultFileName,
    filters: [
      { name: "Tibia Mirror Profile", extensions: ["tvprofile"] }
    ]
  });

  if (result.canceled || !result.filePath) {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    return false;
  }

  const exportTempDir = path.join(app.getPath("temp"), `poioso-tvprofile-export-${Date.now()}`);
  await fs.mkdir(exportTempDir, { recursive: true });
  await fs.copyFile(exportProfilePath, path.join(exportTempDir, "profile.json"));
  if (exportAudioPath && await fileExists(exportAudioPath)) {
    await fs.copyFile(exportAudioPath, path.join(exportTempDir, "profile.audio.json"));
  }
  await createZipWithPowerShell(exportTempDir, result.filePath);
  await fs.rm(exportTempDir, { recursive: true, force: true }).catch(() => {});
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
  return true;
}

async function extractZipWithPowerShell(zipPath, destinationDir) {
  await fs.mkdir(destinationDir, { recursive: true });
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; if(Test-Path -LiteralPath '${escapePowerShellLiteral(destinationDir)}'){Remove-Item -LiteralPath '${escapePowerShellLiteral(destinationDir)}' -Recurse -Force}; [System.IO.Compression.ZipFile]::ExtractToDirectory('${escapePowerShellLiteral(zipPath)}','${escapePowerShellLiteral(destinationDir)}')`
  ]);
}

async function createZipWithPowerShell(sourceDir, destinationZipPath) {
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; if(Test-Path -LiteralPath '${escapePowerShellLiteral(destinationZipPath)}'){Remove-Item -LiteralPath '${escapePowerShellLiteral(destinationZipPath)}' -Force}; [System.IO.Compression.ZipFile]::CreateFromDirectory('${escapePowerShellLiteral(sourceDir)}','${escapePowerShellLiteral(destinationZipPath)}')`
  ]);
}

function escapePowerShellLiteral(value) {
  return String(value || "").replace(/'/g, "''");
}

async function allocateUniqueProfileName(requestedName) {
  const base = sanitizeProfileFileStem(requestedName);
  let candidate = base || "Profile";
  let index = 2;

  while (await fileExists(path.join(screenVisionProfilesDir, `${candidate}.json`))) {
    candidate = `${base || "Profile"} ${index}`;
    index += 1;
  }

  return candidate;
}

function sanitizeProfileFileStem(value) {
  return String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function sanitizeProfileCharacterName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 64);
}

async function ensureScreenVisionCustomAudioDir() {
  await fs.mkdir(screenVisionCustomAudioDir, { recursive: true });
  return screenVisionCustomAudioDir;
}

function sanitizeScreenVisionAudioFileStem(value) {
  return String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

async function importScreenVisionCustomAudioFile(sourcePath) {
  const normalizedSourcePath = String(sourcePath || "").trim();
  if (!normalizedSourcePath) {
    return "";
  }

  const audioDir = path.resolve(await ensureScreenVisionCustomAudioDir());
  const resolvedSourcePath = path.resolve(normalizedSourcePath);
  const normalizedAudioDir = audioDir.toLowerCase();
  const sourceStat = await fs.stat(resolvedSourcePath).catch(() => null);

  if (!sourceStat) {
    throw new Error("audio-file-not-found");
  }

  if (path.dirname(resolvedSourcePath).toLowerCase() === normalizedAudioDir) {
    return resolvedSourcePath;
  }

  const parsedSource = path.parse(resolvedSourcePath);
  const safeBaseName = sanitizeScreenVisionAudioFileStem(parsedSource.name) || "custom-audio";
  const safeExtension = String(parsedSource.ext || "").slice(0, 12);
  let candidatePath = path.join(audioDir, `${safeBaseName}${safeExtension}`);
  let suffix = 2;

  while (await fileExists(candidatePath)) {
    const existingStat = await fs.stat(candidatePath).catch(() => null);
    if (
      existingStat &&
      existingStat.size === sourceStat.size &&
      existingStat.mtimeMs === sourceStat.mtimeMs
    ) {
      return candidatePath;
    }
    candidatePath = path.join(audioDir, `${safeBaseName} ${suffix}${safeExtension}`);
    suffix += 1;
  }

  await fs.copyFile(resolvedSourcePath, candidatePath);
  return candidatePath;
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (_error) {
    return fallback;
  }
}

async function writeJsonFileAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");

  if (await fileExists(filePath)) {
    await fs.copyFile(filePath, backupPath).catch(() => {});
  }

  await fs.rm(filePath, { force: true }).catch(() => {});
  await fs.rename(tempPath, filePath);
}

function writeJsonFileAtomicSync(filePath, value) {
  fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;
  fsSync.writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf8");

  if (fsSync.existsSync(filePath)) {
    try {
      fsSync.copyFileSync(filePath, backupPath);
    } catch (_error) {
    }
  }

  try {
    fsSync.rmSync(filePath, { force: true });
  } catch (_error) {
  }

  fsSync.renameSync(tempPath, filePath);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function pathsEqual(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

function createEmptyProfileOverlayState() {
  return createDefaultOverlayToolsState(new Date().toISOString());
}

async function writeOverlayToolsState(overlayToolsState, options = {}) {
  const snapshot = cloneOverlayToolsStateForSave(overlayToolsState);
  if (options.reason === "bootstrap-profile") {
    await writeDebugLog("write-overlay-tools-state:bootstrap:store:start");
  }
  await writeOverlayToolsStore({
    [OVERLAY_TOOLS_STORAGE_KEY]: snapshot
  });
  if (options.reason === "bootstrap-profile") {
    await writeDebugLog("write-overlay-tools-state:bootstrap:store:finish");
  }

  if (options.skipPersistProfile !== true) {
    if (options.reason === "bootstrap-profile") {
      await writeDebugLog("write-overlay-tools-state:bootstrap:snapshot:start");
    }
    await persistActiveScreenVisionProfileSnapshot(snapshot).catch(() => {});
    if (options.reason === "bootstrap-profile") {
      await writeDebugLog("write-overlay-tools-state:bootstrap:snapshot:finish");
    }
  }

  if (options.skipSyncHotkeys !== true) {
    if (options.reason === "bootstrap-profile") {
      await writeDebugLog("write-overlay-tools-state:bootstrap:hotkeys:start");
    }
    await syncAlertTimerHotkeys(snapshot).catch(() => {});
    if (options.reason === "bootstrap-profile") {
      await writeDebugLog("write-overlay-tools-state:bootstrap:hotkeys:finish");
    }
  }
  if (options.skipSyncNativeAuxiliary !== true) {
    await syncNativeAuxiliaryOverlays(snapshot).catch(() => {});
  }
  if (options.skipEmit !== true) {
    if (options.reason === "bootstrap-profile") {
      await writeDebugLog("write-overlay-tools-state:bootstrap:emit:start");
    }
    await emitOverlayToolsStateChanged(options.reason || "overlay-state-updated");
    if (options.reason === "bootstrap-profile") {
      await writeDebugLog("write-overlay-tools-state:bootstrap:emit:finish");
    }
  }
  return snapshot;
}

function enqueueOverlayToolsMutation(mutation) {
  const pendingMutation = overlayToolsMutationQueue.then(mutation, mutation);
  overlayToolsMutationQueue = pendingMutation.then(() => undefined, () => undefined);
  return pendingMutation;
}

async function appendOverlayMirrorEntry(createEntryOptions) {
  return enqueueOverlayToolsMutation(async () => {
    const overlayToolsState = await readOverlayToolsState();
    const currentItems = Array.isArray(overlayToolsState.mirrors?.items)
      ? overlayToolsState.mirrors.items
      : [];
    const region = createOverlayMirrorEntry(createEntryOptions(currentItems));

    overlayToolsState.mirrors.items = [...currentItems, region];
    const savedState = await writeOverlayToolsState(overlayToolsState);
    return { region, savedState };
  });
}

async function mutateRegion(regionId, updater) {
  return enqueueOverlayToolsMutation(async () => {
    const overlayToolsState = await readOverlayToolsState();
    overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.map((entry) => {
      if (entry.id !== regionId) {
        return entry;
      }

      return normalizeOverlayMirrorEntry(updater(entry));
    }).filter(Boolean);
    return writeOverlayToolsState(overlayToolsState);
  });
}

async function resetMirrorVisibilityForNewProcess() {
  const overlayToolsState = await readOverlayToolsState();
  if (!overlayToolsState.mirrors.items.some((entry) => entry.isVisible)) {
    return overlayToolsState;
  }

  // This is intentionally a process-start default only. Focus and minimize
  // handling only hide native windows temporarily; they never change this
  // persisted user toggle or the OBS capture state.
  overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.map((entry) => ({
    ...entry,
    isVisible: false
  }));
  return writeOverlayToolsState(overlayToolsState, {
    reason: "process-start-mirrors-hidden"
  });
}

function decorateScreenVisionRegions(items) {
  const normalizedItems = (Array.isArray(items) ? items : []).map((entry) => normalizeOverlayMirrorEntry(entry)).filter(Boolean);
  const snapGroupIds = computeSnapGroupRegionIds(normalizedItems);
  return normalizedItems.map((entry) => decorateScreenVisionRegion(entry, snapGroupIds)).filter(Boolean);
}

function decorateScreenVisionRegion(entry, snapGroupIds = null) {
  const region = normalizeOverlayMirrorEntry(entry);

  if (!region?.id) {
    return null;
  }

  const groups = snapGroupIds instanceof Set ? snapGroupIds : computeSnapGroupRegionIds([region]);

  return {
    ...region,
    countdownIsRunning: countdownRunningRegionIds.has(region.id),
    isInSnapGroup: groups.has(region.id)
  };
}

function computeSnapGroupRegionIds(items) {
  const regions = (Array.isArray(items) ? items : [])
    .map((entry) => normalizeOverlayMirrorEntry(entry))
    .filter((entry) => entry?.id && entry.allowSnapping !== false && entry.isVisible !== false);
  const groupedIds = new Set();
  const visited = new Set();

  for (const region of regions) {
    if (visited.has(region.id)) {
      continue;
    }

    const queue = [region];
    const component = [];
    visited.add(region.id);

    while (queue.length) {
      const current = queue.shift();
      component.push(current.id);

      for (const candidate of regions) {
        if (visited.has(candidate.id) || candidate.id === current.id) {
          continue;
        }

        if (areMirrorBoundsAdjacent(current.mirrorBounds, candidate.mirrorBounds)) {
          visited.add(candidate.id);
          queue.push(candidate);
        }
      }
    }

    if (component.length > 1) {
      for (const regionId of component) {
        groupedIds.add(regionId);
      }
    }
  }

  return groupedIds;
}

function areMirrorBoundsAdjacent(leftBounds, rightBounds) {
  const left = normalizeBoundsForAdjacency(leftBounds);
  const right = normalizeBoundsForAdjacency(rightBounds);
  const threshold = 4;
  const sameTop = Math.abs(left.y - right.y) <= threshold;
  const sameLeft = Math.abs(left.x - right.x) <= threshold;
  const rightTouch = Math.abs((left.x + left.width) - right.x) <= threshold;
  const leftTouch = Math.abs((right.x + right.width) - left.x) <= threshold;
  const bottomTouch = Math.abs((left.y + left.height) - right.y) <= threshold;
  const topTouch = Math.abs((right.y + right.height) - left.y) <= threshold;

  if (sameTop && (rightTouch || leftTouch)) {
    return true;
  }

  if (sameLeft && (bottomTouch || topTouch)) {
    return true;
  }

  return false;
}

function normalizeBoundsForAdjacency(bounds) {
  const source = bounds && typeof bounds === "object" ? bounds : {};
  const framePadding = 12;
  const width = clampInteger(source.width, 1, 50000, 24);
  const height = clampInteger(source.height, 1, 50000, 24);
  return {
    x: clampInteger(source.x, -50000, 50000, 0) + framePadding,
    y: clampInteger(source.y, -50000, 50000, 0) + framePadding,
    width: Math.max(1, width - (framePadding * 2)),
    height: Math.max(1, height - (framePadding * 2))
  };
}

function normalizeScreenVisionRegionPatch(rawPatch) {
  const patch = rawPatch && typeof rawPatch === "object" ? rawPatch : {};
  const next = {};

  if (typeof patch.name === "string") {
    next.name = patch.name.trim().slice(0, 80);
  }

  if (typeof patch.isVisible === "boolean") {
    next.isVisible = patch.isVisible;
  }

  if (typeof patch.isLocked === "boolean") {
    next.isLocked = patch.isLocked;
  }

  if (typeof patch.isFixedCrop === "boolean") {
    next.isFixedCrop = patch.isFixedCrop;
  }

  if (typeof patch.allowSnapping === "boolean") {
    next.allowSnapping = patch.allowSnapping;
  }

  if (patch.scale !== undefined) {
    next.scale = clampNumber(patch.scale, 0.5, 4, 1);
  }

  if (patch.glowEnabled !== undefined) {
    next.glowEnabled = Boolean(patch.glowEnabled);
  }

  if (patch.glowColor !== undefined) {
    next.glowColor = normalizeHexColor(patch.glowColor, "#FFFFFF");
  }

  if (Array.isArray(patch.glowSavedColors)) {
    next.glowSavedColors = normalizeMirrorGlowSavedColors(patch.glowSavedColors);
  }

  if (patch.glowIntensity !== undefined) {
    next.glowIntensity = clampNumber(patch.glowIntensity, 1, 30, 10);
  }

  if (patch.countdown && typeof patch.countdown === "object") {
    next.countdown = {};

    if (patch.countdown.enabled !== undefined) {
      next.countdown.enabled = Boolean(patch.countdown.enabled);
    }

    if (patch.countdown.durationSeconds !== undefined) {
      next.countdown.durationSeconds = clampInteger(patch.countdown.durationSeconds, 1, 43200, 60);
    }

    if (typeof patch.countdown.hotkey === "string") {
      next.countdown.hotkey = patch.countdown.hotkey.trim().slice(0, 64).toUpperCase();
    }

    if (patch.countdown.hotkeyKeyCode !== undefined) {
      next.countdown.hotkeyKeyCode = clampInteger(patch.countdown.hotkeyKeyCode, 0, 255, 0);
    }

    if (patch.countdown.hotkeyModifiers !== undefined) {
      next.countdown.hotkeyModifiers = clampInteger(patch.countdown.hotkeyModifiers, 0, 15, 0);
    }

    if (patch.countdown.side !== undefined) {
      next.countdown.side = normalizeCountdownSide(patch.countdown.side);
    }

    if (patch.countdown.direction !== undefined) {
      next.countdown.direction = normalizeCountdownDirectionValue(patch.countdown.direction);
    }

    if (patch.countdown.barThickness !== undefined) {
      next.countdown.barThickness = clampInteger(patch.countdown.barThickness, 1, 2000, 22);
    }

    if (patch.countdown.barLength !== undefined) {
      next.countdown.barLength = clampInteger(patch.countdown.barLength, 1, 4000, 200);
    }

    if (patch.countdown.color !== undefined) {
      next.countdown.color = normalizeCountdownColorValue(patch.countdown.color);
    }

    if (patch.countdown.borderWidth !== undefined) {
      next.countdown.borderWidth = clampInteger(patch.countdown.borderWidth, 0, 64, 1);
    }

    if (patch.countdown.borderRadius !== undefined) {
      next.countdown.borderRadius = clampInteger(patch.countdown.borderRadius, 0, 200, 3);
    }

    if (patch.countdown.borderColor !== undefined) {
      next.countdown.borderColor = normalizeCountdownColorValue(patch.countdown.borderColor);
    }

    if (patch.countdown.flashEnabled !== undefined) {
      next.countdown.flashEnabled = Boolean(patch.countdown.flashEnabled);
    }

    if (patch.countdown.retriggerEnabled !== undefined) {
      next.countdown.retriggerEnabled = Boolean(patch.countdown.retriggerEnabled);
    }

    if (Array.isArray(patch.countdown.savedColors)) {
      next.countdown.savedColors = patch.countdown.savedColors
        .map((entry) => normalizeCountdownColorValue(entry))
        .filter((entry) => entry && entry !== "gradient")
        .slice(0, 10);
    }

    if (Array.isArray(patch.countdown.savedBorderColors)) {
      next.countdown.savedBorderColors = patch.countdown.savedBorderColors
        .map((entry) => normalizeCountdownColorValue(entry))
        .filter((entry) => entry && entry !== "gradient")
        .slice(0, 10);
    }
  }

  return next;
}

function getScreenVisionSettings(overlayToolsState) {
  return overlayToolsState?.settings?.screenVision || {};
}

function getScreenVisionVisualSettings(overlayToolsState) {
  const visual = getScreenVisionSettings(overlayToolsState)?.visualCustomization || {};

  return {
    windowLeft: normalizeOptionalNumber(visual.windowLeft),
    windowTop: normalizeOptionalNumber(visual.windowTop),
    charLocEnabled: Boolean(visual.charLocEnabled),
    charLocX: clampNumber(visual.charLocX, -50000, 50000, 0),
    charLocY: clampNumber(visual.charLocY, -50000, 50000, 0),
    charLocSize: clampNumber(visual.charLocSize, 20, 160, 40),
    charLocShape: normalizeVisualMarkerShape(visual.charLocShape),
    charLocColor: normalizeVisualAccentColor(visual.charLocColor),
    charLocIntensity: clampNumber(visual.charLocIntensity, 1, 30, 10),
    charLocPulse: Boolean(visual.charLocPulse),
    charLocLocked: Boolean(visual.charLocLocked),
    charLocSavedColors: normalizeVisualSavedColors(visual.charLocSavedColors),
    cursorGlowEnabled: Boolean(visual.cursorGlowEnabled),
    cursorGlowSize: clampNumber(visual.cursorGlowSize, 20, 160, 40),
    cursorGlowColor: normalizeVisualAccentColor(visual.cursorGlowColor),
    cursorGlowSavedColors: normalizeVisualSavedColors(visual.cursorGlowSavedColors)
  };
}

function getScreenVisionGridSettings(overlayToolsState) {
  const settings = getScreenVisionSettings(overlayToolsState);
  return {
    enabled: Boolean(settings.gridEnabled),
    gridSize: clampInteger(settings.gridSize, 8, 256, 32)
  };
}

function normalizeScreenVisionVisualPatch(rawPatch) {
  const patch = rawPatch && typeof rawPatch === "object" ? rawPatch : {};
  const next = {};

  if (patch.windowLeft !== undefined) {
    next.windowLeft = normalizeOptionalNumber(patch.windowLeft);
  }

  if (patch.windowTop !== undefined) {
    next.windowTop = normalizeOptionalNumber(patch.windowTop);
  }

  if (patch.charLocEnabled !== undefined) {
    next.charLocEnabled = Boolean(patch.charLocEnabled);
  }

  if (patch.charLocX !== undefined) {
    next.charLocX = clampNumber(patch.charLocX, -50000, 50000, 0);
  }

  if (patch.charLocY !== undefined) {
    next.charLocY = clampNumber(patch.charLocY, -50000, 50000, 0);
  }

  if (patch.charLocSize !== undefined) {
    next.charLocSize = clampNumber(patch.charLocSize, 20, 160, 40);
  }

  if (patch.charLocShape !== undefined) {
    next.charLocShape = normalizeVisualMarkerShape(patch.charLocShape);
  }

  if (patch.charLocColor !== undefined) {
    next.charLocColor = normalizeVisualAccentColor(patch.charLocColor);
  }

  if (patch.charLocIntensity !== undefined) {
    next.charLocIntensity = clampNumber(patch.charLocIntensity, 1, 30, 10);
  }

  if (patch.charLocPulse !== undefined) {
    next.charLocPulse = Boolean(patch.charLocPulse);
  }

  if (patch.charLocLocked !== undefined) {
    next.charLocLocked = Boolean(patch.charLocLocked);
  }

  if (patch.cursorGlowEnabled !== undefined) {
    next.cursorGlowEnabled = Boolean(patch.cursorGlowEnabled);
  }

  if (patch.cursorGlowSize !== undefined) {
    next.cursorGlowSize = clampNumber(patch.cursorGlowSize, 20, 160, 40);
  }

  if (patch.cursorGlowColor !== undefined) {
    next.cursorGlowColor = normalizeVisualAccentColor(patch.cursorGlowColor);
  }

  if (patch.charLocSavedColors !== undefined) {
    next.charLocSavedColors = normalizeVisualSavedColors(patch.charLocSavedColors);
  }

  if (patch.cursorGlowSavedColors !== undefined) {
    next.cursorGlowSavedColors = normalizeVisualSavedColors(patch.cursorGlowSavedColors);
  }

  return next;
}

function normalizeVisualSavedColors(value) {
  const source = Array.isArray(value) && value.length
    ? value
    : ["#58C470", "#FFFFFF", "#FF4444", "#0088FF"];
  return source
    .map((entry) => normalizeVisualAccentColor(entry))
    .filter(Boolean)
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, 10);
}

function normalizeVisualAccentColor(value) {
  const normalized = normalizeHexColor(value, "#58C470");
  return String(normalized).toLowerCase() === "#ff7f00" ? "#58C470" : normalized;
}

function normalizeVisualMarkerShape(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "arrow") {
    return "Arrow";
  }
  if (normalized === "square") {
    return "Square";
  }
  return "Circle";
}

async function reselectRegionById(regionId) {
  const overlayToolsState = await readOverlayToolsState();
  const currentRegion = overlayToolsState.mirrors.items.find((entry) => entry.id === regionId) || null;

  if (!currentRegion) {
    return {
      cancelled: true,
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  const tibiaState = await getTibiaWindowState({ forceFresh: true });

  if (!canUseTibiaWindowForScreenVision(tibiaState)) {
    return {
      cancelled: true,
      reason: "tibia-unavailable",
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  const selection = await withSuspendedGridOverlay(() => openNativeRegionSelectionWindow({
    preferredDisplayId: tibiaState.displayId || currentRegion.displayId || null,
    initialCaptureBounds: currentRegion.captureBounds
  }));

  if (!selection) {
    return {
      cancelled: true,
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  const sourceBounds = tibiaState.clientBounds || tibiaState.bounds;
  const constrainedCaptureBounds = intersectBounds(selection.captureBounds, sourceBounds);

  if (!constrainedCaptureBounds) {
    return {
      cancelled: true,
      reason: "outside-tibia",
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.map((entry) => {
    if (entry.id !== regionId) {
      return entry;
    }

    return normalizeOverlayMirrorEntry({
      ...entry,
      displayId: selection.displayId,
      displayLabel: selection.displayLabel,
      displayBounds: selection.displayBounds,
      sourceBounds,
      sourceWindowTitle: tibiaState.title,
      sourceProcessName: tibiaState.processName,
      captureBounds: constrainedCaptureBounds,
      relativeBounds: toRelativeBounds(constrainedCaptureBounds, sourceBounds),
      mirrorBounds: toInitialMirrorBounds(constrainedCaptureBounds, selection.displayBounds)
    });
  }).filter(Boolean);

  const savedState = await writeOverlayToolsState(overlayToolsState);
  await reopenRegionMirrorWindow(regionId, savedState);

  return {
    cancelled: false,
    region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === regionId) || null),
    items: decorateScreenVisionRegions(savedState.mirrors.items)
  };
}

async function makeNewCropForRegionById(regionId) {
  const overlayToolsState = await readOverlayToolsState();
  const currentRegion = overlayToolsState.mirrors.items.find((entry) => entry.id === regionId) || null;

  if (!currentRegion) {
    return {
      cancelled: true,
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  const tibiaState = await getTibiaWindowState({ forceFresh: true });

  if (!canUseTibiaWindowForScreenVision(tibiaState)) {
    return {
      cancelled: true,
      reason: "tibia-unavailable",
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  const fixedSize = currentRegion.isFixedCrop
    ? clampInteger(Math.min(currentRegion.captureBounds?.width || 32, currentRegion.captureBounds?.height || 32), 1, 512, 32)
    : null;

  const selection = await withSuspendedGridOverlay(() => openNativeRegionSelectionWindow({
    preferredDisplayId: tibiaState.displayId || currentRegion.displayId || null,
    mode: currentRegion.isFixedCrop ? "fixed-icon-crop" : "standard",
    fixedSize
  }));

  if (!selection) {
    return {
      cancelled: true,
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  const sourceBounds = tibiaState.clientBounds || tibiaState.bounds;
  const constrainedCaptureBounds = intersectBounds(selection.captureBounds, sourceBounds, 1);

  if (!constrainedCaptureBounds) {
    return {
      cancelled: true,
      reason: "outside-tibia",
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  const savedState = await mutateRegion(regionId, (region) => ({
    ...region,
    displayId: selection.displayId || region.displayId || "",
    displayLabel: selection.displayLabel || region.displayLabel || "",
    displayBounds: selection.displayBounds || region.displayBounds,
    sourceBounds,
    sourceWindowTitle: tibiaState.title || region.sourceWindowTitle || "",
    sourceProcessName: tibiaState.processName || region.sourceProcessName || "",
    captureBounds: constrainedCaptureBounds,
    relativeBounds: toRelativeBounds(constrainedCaptureBounds, sourceBounds),
    mirrorBounds: toInitialMirrorBounds(constrainedCaptureBounds, selection.displayBounds),
    scale: 1
  }));

  await syncRegionMirrorWindows(savedState);

  return {
    cancelled: false,
    region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === regionId) || null),
    items: decorateScreenVisionRegions(savedState.mirrors.items)
  };
}

function createNextRegionName(existingRegions) {
  const nextIndex = Array.isArray(existingRegions) ? existingRegions.length + 1 : 1;
  return `Area ${nextIndex}`;
}

function normalizeSelectionBounds(bounds, minSize = 24) {
  if (!bounds || typeof bounds !== "object") {
    return null;
  }

  const x = Math.round(Number(bounds.x ?? bounds.X));
  const y = Math.round(Number(bounds.y ?? bounds.Y));
  const width = Math.round(Number(bounds.width ?? bounds.Width));
  const height = Math.round(Number(bounds.height ?? bounds.Height));

  if (![x, y, width, height].every(Number.isFinite) || width < minSize || height < minSize) {
    return null;
  }

  return { x, y, width, height };
}

async function openNativeRegionSelectionWindow({ preferredDisplayId = null, initialCaptureBounds = null, mode = "standard", fixedSize = null } = {}) {
  await ensureNativeHostStarted();

  await writeDebugLog(
    `screen-vision-native-select request=${JSON.stringify({
      preferredDisplayId,
      initialCaptureBounds,
      mode,
      fixedSize
    })}`
  );

  selectionInProgress = true;

  try {
    const response = await callNativeHost({
      command: "selectRegion",
      preferredDisplayId,
      initialCaptureBounds,
      mode,
      fixedSize
    }, {
      timeoutMs: nativeHostSelectionPipeTimeoutMs
    });

    await writeDebugLog(`screen-vision-native-select response=${JSON.stringify(response)}`);

    if (!response?.ok) {
      throw new Error(response?.error || "native-select-region-failed");
    }

    // Keep the native selector and the persistence layer on the same contract:
    // a manual mirror must have a usable crop, never a transient 1px click.
    const captureBounds = normalizeSelectionBounds(response?.data?.captureBounds, 24);

    await writeDebugLog(
      `screen-vision-native-select normalized=${JSON.stringify({
        cancelled: Boolean(response?.data?.cancelled),
        captureBounds
      })}`
    );

    if (response?.data?.cancelled || !captureBounds) {
      return null;
    }

    const matchedDisplay = screen.getDisplayMatching(captureBounds);
    const displayBounds = normalizeSelectionBounds(matchedDisplay?.bounds, 1);

    if (!displayBounds) {
      return null;
    }

    return {
      displayId: String(matchedDisplay.id),
      displayLabel: matchedDisplay.label || `Display ${matchedDisplay.id}`,
      displayBounds,
      captureBounds
    };
  } finally {
    selectionInProgress = false;
    restoreMainWindowTopmost();
    void syncTibiaMirrorVisibility(true);
  }
}

async function withSuspendedGridOverlay(action) {
  const overlayToolsState = await readOverlayToolsState();
  const gridSettings = getScreenVisionGridSettings(overlayToolsState);
  const shouldRestoreGrid = Boolean(gridSettings.enabled);

  try {
    if (shouldRestoreGrid) {
      await callNativeHost({
        command: "setGridOverlay",
        enabled: false,
        gridSize: gridSettings.gridSize
      }).catch(() => null);
    }

    return await action();
  } finally {
    if (shouldRestoreGrid) {
      await syncNativeGridOverlay(overlayToolsState).catch(async (error) => {
        await writeDebugLog(`screen-vision-grid-restore-error ${error?.message || String(error)}`);
      });
    }
  }
}

function getTargetSelectionDisplay(preferredDisplayId = null) {
  if (preferredDisplayId !== null && preferredDisplayId !== undefined) {
    const matchedDisplay = screen.getAllDisplays().find((entry) => String(entry.id) === String(preferredDisplayId));
    if (matchedDisplay) {
      return matchedDisplay;
    }
  }

  const cursorPoint = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursorPoint);
}

async function syncRegionMirrorWindows(overlayToolsState = null) {
  const state = overlayToolsState || await readOverlayToolsState();
  const visibleRegions = state.mirrors.items.filter((entry) => entry.isVisible);
  nativeMirrorRegionCount = visibleRegions.length;
  await syncNativeMirrorWindows(visibleRegions);
  await syncCountdownHotkeys(state);

  ensureTibiaWindowMonitor();
  await syncTibiaMirrorVisibility(true);

  // OBS is strictly downstream from the native mirrors. A failure here must
  // never block region creation, editing, visibility, or Tibia focus rules.
  obsMirrorSync.scheduleSync({
    regions: visibleRegions,
    tibiaState: lastTibiaWindowState
  });
}

async function reopenRegionMirrorWindow(regionId, overlayToolsState = null) {
  const state = overlayToolsState || await readOverlayToolsState();
  await syncRegionMirrorWindows(state);
}

async function openOrUpdateRegionMirrorWindow(rawRegion) {
  const region = normalizeOverlayMirrorEntry(rawRegion);
  if (!region?.id) {
    return;
  }
  await syncNativeMirrorWindows(region.isVisible ? [region] : []);
}

async function closeRegionMirrorWindow(regionId, options = {}) {
  if (options.persistClosedState) {
    const overlayToolsState = await mutateRegion(regionId, (region) => ({
      ...region,
      isVisible: false
    }));
    return overlayToolsState;
  }

  const overlayToolsState = await readOverlayToolsState();
  nativeMirrorRegionCount = overlayToolsState.mirrors.items.filter((entry) => entry.isVisible).length;
  await syncNativeMirrorWindows(overlayToolsState.mirrors.items.filter((entry) => entry.isVisible));
  await syncCountdownHotkeys(overlayToolsState);
  ensureTibiaWindowMonitor();
  return null;
}

async function handleRegionMirrorClosed(regionId) {
  if (regionMirrorCloseSuppressions.has(regionId)) {
    regionMirrorCloseSuppressions.delete(regionId);
    return;
  }

  const overlayToolsState = await readOverlayToolsState();
  const region = overlayToolsState.mirrors.items.find((entry) => entry.id === regionId);

  if (!region || !region.isVisible) {
    return;
  }

  overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.map((entry) =>
    entry.id === regionId
      ? normalizeOverlayMirrorEntry({
          ...entry,
          isVisible: false
        })
      : entry
  ).filter(Boolean);
  await writeOverlayToolsState(overlayToolsState);
}

function scheduleRegionMirrorBoundsSave(regionId, window) {
  if (!window || window.isDestroyed()) {
    return;
  }

  clearRegionMirrorBoundsSaveTimer(regionId);
  const timer = setTimeout(() => {
    regionMirrorBoundsSaveTimers.delete(regionId);
    void persistRegionMirrorBounds(regionId, window);
  }, 180);
  regionMirrorBoundsSaveTimers.set(regionId, timer);
}

function clearRegionMirrorBoundsSaveTimer(regionId) {
  const timer = regionMirrorBoundsSaveTimers.get(regionId);
  if (timer) {
    clearTimeout(timer);
    regionMirrorBoundsSaveTimers.delete(regionId);
  }
}

async function persistRegionMirrorBounds(regionId, window) {
  if (!window || window.isDestroyed()) {
    return;
  }

  const bounds = window.getBounds();
  await mutateRegion(regionId, (region) => ({
    ...region,
    mirrorBounds: bounds
  }));
}

function registerAssetCacheProtocol() {
  protocol.handle("poioso-cache", async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const category = sanitizeAssetCacheSegment(requestUrl.hostname || "misc");
      const key = sanitizeAssetCacheSegment(decodeURIComponent(requestUrl.pathname.replace(/^\/+/, "")) || "asset");
      const sourceUrl = requestUrl.searchParams.get("url") || "";

      if (!/^(https?|file):\/\//i.test(sourceUrl)) {
        return new Response("Invalid asset source.", { status: 422 });
      }

      if (/^file:\/\//i.test(sourceUrl)) {
        const localPath = fileURLToPath(sourceUrl);
        const localBytes = await fs.readFile(localPath).catch(() => null);

        if (!localBytes) {
          return new Response("Local asset not found.", { status: 404 });
        }

        return new Response(localBytes, {
          status: 200,
          headers: {
            "content-type": getImageContentType(localPath, localBytes),
            "cache-control": "public, max-age=31536000, immutable"
          }
        });
      }

      const cachedPath = getAssetCachePath(category, key, sourceUrl);
      const cached = await fs.readFile(cachedPath).catch(() => null);

      if (cached) {
        return new Response(cached, {
          status: 200,
          headers: {
            "content-type": getImageContentType(cachedPath, cached),
            "cache-control": "public, max-age=31536000, immutable"
          }
        });
      }

      const downloaded = await fetch(sourceUrl, {
        redirect: "follow",
        headers: {
          "user-agent": "Tibia Toolkit asset cache"
        }
      });

      if (!downloaded.ok) {
        return new Response("Asset not found.", { status: downloaded.status || 404 });
      }

      const bytes = Buffer.from(await downloaded.arrayBuffer());
      await fs.mkdir(path.dirname(cachedPath), { recursive: true });
      await fs.writeFile(cachedPath, bytes);

      return new Response(bytes, {
        status: 200,
        headers: {
          "content-type": downloaded.headers.get("content-type") || getImageContentType(cachedPath, bytes),
          "cache-control": "public, max-age=31536000, immutable"
        }
      });
    } catch (error) {
      await writeDebugLog(`asset-cache-error ${error instanceof Error ? error.message : String(error)}`);
      return new Response("Asset cache error.", { status: 500 });
    }
  });
}

function getCachedImageProtocolUrl(category, key, sourceUrl) {
  const normalizedSource = String(sourceUrl || "").trim();

  if (!/^(https?|file):\/\//i.test(normalizedSource)) {
    return normalizedSource;
  }

  return `poioso-cache://${sanitizeAssetCacheSegment(category || "misc")}/${encodeURIComponent(
    sanitizeAssetCacheSegment(key || "asset")
  )}?url=${encodeURIComponent(normalizedSource)}`;
}

function getAssetCachePath(category, key, sourceUrl) {
  const hash = crypto.createHash("sha1").update(sourceUrl).digest("hex").slice(0, 16);
  const extension = getImageExtension(sourceUrl);

  return path.join(assetCacheRoot, category, `${key}-${hash}${extension}`);
}

function sanitizeAssetCacheSegment(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";
}

function getImageExtension(sourceUrl) {
  const decoded = decodeURIComponent(String(sourceUrl || "")).toLowerCase();

  if (decoded.includes(".png")) {
    return ".png";
  }

  if (decoded.includes(".jpg") || decoded.includes(".jpeg")) {
    return ".jpg";
  }

  if (decoded.includes(".webp")) {
    return ".webp";
  }

  if (decoded.includes(".gif")) {
    return ".gif";
  }

  return ".png";
}

function getImageContentType(filePath, bytes = null) {
  const detectedType = detectImageContentType(bytes);

  if (detectedType) {
    return detectedType;
  }

  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  if (extension === ".gif") {
    return "image/gif";
  }

  return "application/octet-stream";
}

function detectImageContentType(bytes) {
  if (!bytes || bytes.length < 12) {
    return "";
  }

  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }

  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return "";
}

async function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    return splashWindow;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { workArea } = activeDisplay;
  const width = 392;
  const height = 292;
  const x = Math.round(workArea.x + (workArea.width - width) / 2);
  const y = Math.round(workArea.y + (workArea.height - height) / 2);
  const iconUrl = await getSplashIconDataUrl();

  splashWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    frame: false,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: " ",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  splashWindow.setIgnoreMouseEvents(true, { forward: true });
  splashWindow.setAlwaysOnTop(true, "screen-saver");
  splashWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  splashWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.showInactive();
      void updateSplashProgress(splashProgress);
      void updateSplashStatus(splashStatus);
    }
  });
  splashWindow.on("closed", () => {
    splashWindow = null;
  });

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: visible;
        background: transparent;
        font-family: Arial, sans-serif;
        user-select: none;
      }
      body {
        display: grid;
        place-items: center;
        padding: 30px;
      }
      .card {
        width: 260px;
        min-height: 164px;
        display: grid;
        place-items: center;
        gap: 10px;
        padding: 24px 28px 20px;
        border: 1px solid rgba(88, 196, 112, 0.88);
        border-radius: 24px;
        background: rgba(27, 32, 42, 0.98);
        box-shadow: none;
      }
      .spinner {
        position: relative;
        display: grid;
        place-items: center;
        width: 112px;
        height: 112px;
        border-radius: 999px;
        filter: none;
      }
      .spinner::before {
        content: "";
        position: absolute;
        inset: 10px;
        border-radius: 50%;
        background: rgba(16, 20, 28, 0.92);
      }
      .spinner::after {
        content: "";
        position: absolute;
        inset: 0;
        border: 3px solid rgba(88, 196, 112, 0.18);
        border-top-color: #58c470;
        border-right-color: rgba(185, 244, 198, 0.72);
        border-radius: 50%;
        animation: spin 0.85s linear infinite;
      }
      img {
        position: relative;
        z-index: 1;
        width: 72px;
        height: 72px;
        object-fit: contain;
        image-rendering: pixelated;
      }
      #progress {
        color: #aeb8c8;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.06em;
      }
      #status {
        max-width: 210px;
        color: rgba(186, 197, 214, 0.68);
        font-size: 0.65rem;
        font-weight: 500;
        letter-spacing: 0.03em;
        text-align: center;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner"><img src="${iconUrl}" alt=""></div>
      <div id="progress">0%</div>
      <div id="status">${escapeHtml(splashStatus)}</div>
    </div>
    <script>
      window.setSplashProgress = (value) => {
        const progress = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
        document.getElementById("progress").textContent = progress + "%";
      };
      window.setSplashStatus = (value) => {
        document.getElementById("status").textContent = String(value || "");
      };
    </script>
  </body>
</html>`;

  await splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return splashWindow;
}

async function updateSplashProgress(progress) {
  splashProgress = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));

  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }

  await splashWindow.webContents
    .executeJavaScript(`window.setSplashProgress && window.setSplashProgress(${splashProgress});`)
    .catch(() => {});
}

async function updateSplashStatus(status) {
  splashStatus = String(status || "").trim() || tr("splash.preparing");

  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }

  const serializedStatus = JSON.stringify(splashStatus);
  await splashWindow.webContents
    .executeJavaScript(`window.setSplashStatus && window.setSplashStatus(${serializedStatus});`)
    .catch(() => {});
}

async function getSplashIconDataUrl() {
  try {
    const contents = await fs.readFile(splashIconPath);
    return `data:image/png;base64,${contents.toString("base64")}`;
  } catch (_error) {
    return pathToFileURL(splashIconPath).href;
  }
}

function closeSplashWindow() {
  if (!splashWindow || splashWindow.isDestroyed()) {
    splashWindow = null;
    return;
  }

  splashWindow.close();
  splashWindow = null;
}

function normalizeRuntimeBaseList(...values) {
  return values
    .flatMap((value) => Array.isArray(value) ? value : String(value || "").split(","))
    .map((value) => String(value || "").trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

function resolveRuntimeFilePath(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
  const baseRoot = normalized === "assets" || normalized.startsWith("assets/")
    ? runtimeAssetsRoot
    : projectRoot;
  const nestedPath = normalized === "assets" ? "" : normalized.replace(/^assets\/?/, "");
  const resolved = path.resolve(baseRoot, nestedPath);
  const allowedRoot = path.resolve(baseRoot);
  if (resolved !== allowedRoot && !resolved.startsWith(`${allowedRoot}${path.sep}`)) {
    return null;
  }
  return resolved;
}

function registerRuntimeContentProtocol() {
  protocol.handle("tibiatoolkit", async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== "app") {
        return new Response("Not found", { status: 404 });
      }
      const filePath = resolveRuntimeFilePath(decodeURIComponent(url.pathname));
      if (!filePath || !fsSync.existsSync(filePath)) {
        return new Response("Not found", { status: 404 });
      }
      return electronNet.fetch(pathToFileURL(filePath).href);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

async function bootstrapRuntimeContent(runtimeConfig) {
  const manifestUrls = normalizeRuntimeBaseList(
    runtimeConfig.contentPackManifestUrls || [],
    runtimeConfig.contentPackManifestUrl || ""
  );
  const result = await ensureContentPack({
    appIsPackaged: app.isPackaged,
    sourceAssetsRoot: path.join(projectRoot, "assets"),
    userDataPath: app.getPath("userData"),
    manifestUrls,
    onStatus({ phase } = {}) {
      const key = phase === "verifying"
        ? "contentPack.verifying"
        : "contentPack.downloading";
      void updateSplashStatus(tr(key));
    },
    onProgress({ received, total }) {
      if (!total) {
        return;
      }
      const progress = Math.max(2, Math.min(62, Math.round((received / total) * 60)));
      void updateSplashProgress(progress);
    }
  });
  runtimeAssetsRoot = result.assetsRoot;
  await writeDebugLog(`content-pack-ready source=${result.source} version=${result.version} root=${runtimeAssetsRoot}`);
}

async function bootstrapRuntimeContentWithRetry(runtimeConfig) {
  while (true) {
    try {
      await bootstrapRuntimeContent(runtimeConfig);
      return;
    } catch (error) {
      const choice = await dialog.showMessageBox(splashWindow || undefined, {
        type: "error",
        title: "Tibia Toolkit",
        message: tr("contentPack.failedTitle"),
        detail: tr("contentPack.failedDetail"),
        buttons: [tr("contentPack.retry"), tr("contentPack.exit")],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });

      if (choice.response !== 0) {
        throw error;
      }
    }
  }
}

async function loadRuntimeConfig() {
  const envBase = String(
    process.env.POIOSO_MARKET_API_BASE || process.env.MARKET_CACHE_API_BASE || ""
  ).trim();
  const envBases = String(
    process.env.POIOSO_MARKET_API_BASES || process.env.MARKET_CACHE_API_BASES || ""
  ).trim();
  const envGameDataHubBase = String(
    process.env.POIOSO_GAME_DATA_HUB_BASE || process.env.GAME_DATA_HUB_API_BASE || ""
  ).trim();
  const envGameDataHubBases = String(
    process.env.POIOSO_GAME_DATA_HUB_BASES || process.env.GAME_DATA_HUB_API_BASES || ""
  ).trim();
  const envSupportersDataUrl = String(
    process.env.POIOSO_SUPPORTERS_DATA_URL || process.env.SUPPORTERS_DATA_URL || ""
  ).trim();
  const envSupportersDataUrls = String(
    process.env.POIOSO_SUPPORTERS_DATA_URLS || process.env.SUPPORTERS_DATA_URLS || ""
  ).trim();
  const envContentPackUrls = String(process.env.TIBIA_TOOLKIT_CONTENT_PACK_MANIFEST_URLS || "").trim();
  const envUpdateUrls = String(process.env.TIBIA_TOOLKIT_UPDATE_URLS || "").trim();

  if (envBase || envBases || envGameDataHubBase || envGameDataHubBases || envSupportersDataUrl || envSupportersDataUrls || envContentPackUrls || envUpdateUrls) {
    const marketApiBases = normalizeRuntimeBaseList(envBases, envBase);
    const gameDataHubBases = normalizeRuntimeBaseList(envGameDataHubBases, envGameDataHubBase);

    return {
      marketApiBase: marketApiBases[0] || null,
      marketApiBases,
      gameDataHubBase: gameDataHubBases[0] || null,
      gameDataHubBases,
      supportersDataUrl: normalizeRuntimeBaseList(envSupportersDataUrls, envSupportersDataUrl)[0] || null,
      supportersDataUrls: normalizeRuntimeBaseList(envSupportersDataUrls, envSupportersDataUrl),
      contentPackManifestUrls: normalizeRuntimeBaseList(envContentPackUrls),
      updateUrls: normalizeRuntimeBaseList(envUpdateUrls)
    };
  }

  try {
    const raw = await fs.readFile(runtimeConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    const fileBase = String(parsed?.marketApiBase || "").trim();
    const fileBases = normalizeRuntimeBaseList(parsed?.marketApiBases || [], fileBase);
    const fileGameDataHubBase = String(parsed?.gameDataHubBase || "").trim();
    const fileGameDataHubBases = normalizeRuntimeBaseList(parsed?.gameDataHubBases || [], fileGameDataHubBase);
    const fileSupportersDataUrl = String(parsed?.supportersDataUrl || "").trim();
    const fileSupportersDataUrls = normalizeRuntimeBaseList(parsed?.supportersDataUrls || [], fileSupportersDataUrl);
    const fileContentPackManifestUrls = normalizeRuntimeBaseList(parsed?.contentPackManifestUrls || [], parsed?.contentPackManifestUrl || "");
    const fileUpdateUrls = normalizeRuntimeBaseList(parsed?.updateUrls || [], parsed?.updateUrl || "");

    return {
      marketApiBase: fileBases[0] || null,
      marketApiBases: fileBases,
      gameDataHubBase: fileGameDataHubBases[0] || null,
      gameDataHubBases: fileGameDataHubBases,
      supportersDataUrl: fileSupportersDataUrls[0] || null,
      supportersDataUrls: fileSupportersDataUrls,
      contentPackManifestUrls: fileContentPackManifestUrls,
      updateUrls: fileUpdateUrls
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        marketApiBase: null,
        marketApiBases: [],
        gameDataHubBase: null,
        gameDataHubBases: [],
      supportersDataUrl: null,
      supportersDataUrls: [],
        contentPackManifestUrls: [],
        updateUrls: []
      };
    }

    await writeDebugLog(
      `runtime-config-error ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      marketApiBase: null,
      marketApiBases: [],
      gameDataHubBase: null,
      gameDataHubBases: [],
        supportersDataUrl: null,
        supportersDataUrls: [],
      contentPackManifestUrls: [],
      updateUrls: []
    };
  }
}

async function openMapWindow(url, title = "Mapa") {
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { workArea } = activeDisplay;
  const width = clamp(Math.round(workArea.width * 0.42), 520, 860);
  const height = clamp(Math.round(workArea.height * 0.48), 380, 720);
  const x = Math.max(workArea.x + 20, cursorPoint.x - Math.round(width / 2));
  const y = Math.max(workArea.y + 20, cursorPoint.y - 60);

  if (!mapWindow || mapWindow.isDestroyed()) {
    mapWindow = new BrowserWindow({
      width,
      height,
      x: Math.min(x, workArea.x + workArea.width - width - 20),
      y: Math.min(y, workArea.y + workArea.height - height - 20),
      minWidth: 360,
      minHeight: 260,
      resizable: true,
      backgroundColor: "#111827",
      icon: appIconPath,
      frame: true,
      show: false,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      title: " ",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    mapWindow.webContents.on("page-title-updated", (event) => {
      event.preventDefault();
      mapWindow?.setTitle(" ");
    });
    mapWindow.webContents.on("did-finish-load", () => {
      void injectMapChromeStyle();
      void injectMapWatermark();
      void injectMapWheelZoom();
    });
    mapWindow.setAlwaysOnTop(true, "screen-saver");
    mapWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mapWindow.on("closed", () => {
      mapWindow = null;
    });
  }

  mapWindow.setTitle(" ");
  await mapWindow.loadURL(url);
  await injectMapChromeStyle();
  await injectMapWatermark();
  await injectMapWheelZoom();
  mapWindow.show();
  mapWindow.focus();
}

function stopDockedToolPanelAnimation() {
  if (dockedToolPanelAnimationTimer) {
    clearInterval(dockedToolPanelAnimationTimer);
    dockedToolPanelAnimationTimer = null;
  }
}

function getDockedToolPanelDefinition(panelKey) {
  const definition = dockedToolPanelDefinitions[panelKey] || null;

  if (!definition) {
    return null;
  }

  return {
    ...definition,
    title: definition.titleKey ? tr(definition.titleKey) : String(definition.title || ""),
    description: definition.descriptionKey ? tr(definition.descriptionKey) : String(definition.description || "")
  };
}

function getDesktopHorizontalWorkAreaBounds() {
  const displays = screen.getAllDisplays();

  if (!displays.length) {
    return { left: 0, right: 0 };
  }

  return displays.reduce((accumulator, display) => {
    const left = display.workArea?.x ?? 0;
    const right = left + (display.workArea?.width ?? 0);
    return {
      left: Math.min(accumulator.left, left),
      right: Math.max(accumulator.right, right)
    };
  }, {
    left: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY
  });
}

function getDockedToolPanelAvailableSpace(mainBounds, side, desktopBounds) {
  if (side === "left") {
    return Math.round(mainBounds.x - desktopBounds.left);
  }

  return Math.round(desktopBounds.right - (mainBounds.x + mainBounds.width));
}

function canDockToolPanel(mainBounds, panelWidth, side, desktopBounds) {
  return getDockedToolPanelAvailableSpace(mainBounds, side, desktopBounds) >= panelWidth;
}

function resolveDockedToolPanelSide(mainBounds, panelWidth, currentSide = "") {
  const desktopBounds = getDesktopHorizontalWorkAreaBounds();
  const rightFits = canDockToolPanel(mainBounds, panelWidth, "right", desktopBounds);
  const leftFits = canDockToolPanel(mainBounds, panelWidth, "left", desktopBounds);

  if (currentSide === "right" && rightFits) {
    return "right";
  }

  if (currentSide === "left" && leftFits) {
    return "left";
  }

  if (currentSide === "right" && !rightFits && leftFits) {
    return "left";
  }

  if (currentSide === "left" && !leftFits && rightFits) {
    return "right";
  }

  if (!currentSide) {
    if (rightFits) {
      return "right";
    }

    if (leftFits) {
      return "left";
    }
  }

  const rightSpace = getDockedToolPanelAvailableSpace(mainBounds, "right", desktopBounds);
  const leftSpace = getDockedToolPanelAvailableSpace(mainBounds, "left", desktopBounds);

  return rightSpace >= leftSpace ? "right" : "left";
}

function getDockedToolPanelExpandedBounds(mainBounds, panelWidth, side) {
  return {
    x: side === "left"
      ? Math.round(mainBounds.x - panelWidth)
      : Math.round(mainBounds.x),
    y: Math.round(mainBounds.y),
    width: Math.round(mainBounds.width + panelWidth),
    height: Math.round(mainBounds.height)
  };
}

function deriveDockedToolPanelBaseBounds(expandedBounds, panelWidth, side) {
  if (!expandedBounds) {
    return null;
  }

  return {
    x: side === "left"
      ? Math.round(expandedBounds.x + panelWidth)
      : Math.round(expandedBounds.x),
    y: Math.round(expandedBounds.y),
    width: Math.max(320, Math.round(expandedBounds.width - panelWidth)),
    height: Math.round(expandedBounds.height)
  };
}

function waitForDockedToolPanelDuration(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(80, Math.round(durationMs || 0)));
  });
}

function waitForDockedToolPanelFrame(durationMs = 18) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Math.round(durationMs || 0)));
  });
}

function setMainWindowResizeBackdrop(color = "#1d2129") {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    mainWindow.setBackgroundColor(color);
  } catch {
  }
}

function setMainWindowBoundsImmediate(window, bounds) {
  if (!window || window.isDestroyed() || !bounds) {
    return;
  }

  const currentBounds = window.getBounds();
  const nextBounds = {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height)
  };

  if (
    currentBounds.x === nextBounds.x
    && currentBounds.y === nextBounds.y
    && currentBounds.width === nextBounds.width
    && currentBounds.height === nextBounds.height
  ) {
    return;
  }

  window.setBounds(nextBounds, false);
}

async function animateMainWindowBounds(window, fromBounds, toBounds, durationMs) {
  stopDockedToolPanelAnimation();

  if (!window || window.isDestroyed()) {
    return;
  }

  const safeDuration = Math.max(80, Math.round(durationMs || 0));
  const startBounds = {
    x: Math.round(fromBounds.x),
    y: Math.round(fromBounds.y),
    width: Math.round(fromBounds.width),
    height: Math.round(fromBounds.height)
  };
  const endBounds = {
    x: Math.round(toBounds.x),
    y: Math.round(toBounds.y),
    width: Math.round(toBounds.width),
    height: Math.round(toBounds.height)
  };

  if (
    startBounds.x === endBounds.x
    && startBounds.y === endBounds.y
    && startBounds.width === endBounds.width
    && startBounds.height === endBounds.height
  ) {
    window.setBounds(endBounds, false);
    return;
  }

  await new Promise((resolve) => {
    const startTime = Date.now();
    dockedToolPanelBoundsAnimationInFlight = true;
    dockedToolPanelAnimationTimer = setInterval(() => {
      if (!window || window.isDestroyed()) {
        stopDockedToolPanelAnimation();
        dockedToolPanelBoundsAnimationInFlight = false;
        resolve();
        return;
      }

      const elapsed = Date.now() - startTime;
      const rawProgress = Math.min(1, elapsed / safeDuration);
      const easedProgress = 1 - Math.pow(1 - rawProgress, 3);
      const nextBounds = {
        x: Math.round(startBounds.x + ((endBounds.x - startBounds.x) * easedProgress)),
        y: Math.round(startBounds.y + ((endBounds.y - startBounds.y) * easedProgress)),
        width: Math.round(startBounds.width + ((endBounds.width - startBounds.width) * easedProgress)),
        height: Math.round(startBounds.height + ((endBounds.height - startBounds.height) * easedProgress))
      };

      window.setBounds(nextBounds, false);

      if (rawProgress >= 1) {
        stopDockedToolPanelAnimation();
        dockedToolPanelBoundsAnimationInFlight = false;
        resolve();
      }
    }, 1000 / 60);
  });
}

function emitDockedToolPanelState(payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("docked-tool-panel:state", {
    open: Boolean(payload.open),
    panelKey: payload.panelKey || "",
    side: payload.side === "left" ? "left" : "right",
    phase: payload.phase || "closed",
    width: Number(payload.width) || 0
  });
}

function setDockedToolPanelRendererContext(panelKey, side, phase = "open") {
  const definition = getDockedToolPanelDefinition(panelKey);
  emitDockedToolPanelState({
    open: dockedToolPanelIsOpen,
    panelKey,
    side,
    phase,
    width: definition?.width || 0
  });
}

function emitDockedToolPanelRendererPreview(panelKey, side, phase = "closed") {
  const definition = getDockedToolPanelDefinition(panelKey);
  emitDockedToolPanelState({
    open: false,
    panelKey,
    side,
    phase,
    width: definition?.width || 0
  });
}

function setDockedToolPanelWindowConstraints(panelWidth) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const minWidth = Math.max(320, Math.round((mainWindow.__dockedToolPanelBaseMinWidth || 500) + panelWidth));
  const minHeight = Math.max(240, Math.round(mainWindow.__dockedToolPanelBaseMinHeight || 320));
  const maxWidth = Math.round((mainWindow.__dockedToolPanelBaseMaxWidth || 860) + panelWidth);
  const maxHeight = Math.round(mainWindow.__dockedToolPanelBaseMaxHeight || screen.getPrimaryDisplay().workArea.height);
  mainWindow.setMinimumSize(minWidth, minHeight);
  mainWindow.setMaximumSize(maxWidth, maxHeight);
}

function restoreDockedToolPanelWindowConstraints() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.setMinimumSize(
    Math.round(mainWindow.__dockedToolPanelBaseMinWidth || 500),
    Math.round(mainWindow.__dockedToolPanelBaseMinHeight || 320)
  );
  mainWindow.setMaximumSize(
    Math.round(mainWindow.__dockedToolPanelBaseMaxWidth || 860),
    Math.round(mainWindow.__dockedToolPanelBaseMaxHeight || screen.getPrimaryDisplay().workArea.height)
  );
}

function setMainWindowDockedPanelState(isOpen) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    mainWindow.setHasShadow(!isOpen);
  } catch {
  }
}

async function closeDockedToolPanel(options = {}) {
  stopDockedToolPanelAnimation();

  if (!dockedToolPanelIsOpen || !mainWindow || mainWindow.isDestroyed()) {
    dockedToolPanelKey = "";
    dockedToolPanelBaseBounds = null;
    dockedToolPanelIsOpen = false;
    dockedToolPanelPhase = "closed";
    restoreDockedToolPanelWindowConstraints();
    setMainWindowDockedPanelState(false);
    emitDockedToolPanelState({ open: false, panelKey: "", side: dockedToolPanelSide, phase: "closed", width: 0 });
    return;
  }

  const panelDefinition = getDockedToolPanelDefinition(dockedToolPanelKey);
  const panelKey = dockedToolPanelKey;
  const side = dockedToolPanelSide;
  const currentBounds = mainWindow.getBounds();
  const baseBounds = dockedToolPanelBaseBounds || deriveDockedToolPanelBaseBounds(currentBounds, panelDefinition?.width || 0, side);
  const shouldAnimate = options.animate !== false && panelDefinition && baseBounds;

  dockedToolPanelPhase = "closing";
  setDockedToolPanelRendererContext(panelKey, side, "closing");
  setMainWindowResizeBackdrop("#20242d");

  if (shouldAnimate) {
    await waitForDockedToolPanelDuration(dockedToolPanelCloseDurationMs);
  }

  restoreDockedToolPanelWindowConstraints();
  setMainWindowBoundsImmediate(mainWindow, baseBounds);
  dockedToolPanelBaseBounds = null;
  dockedToolPanelKey = "";
  dockedToolPanelIsOpen = false;
  dockedToolPanelPhase = "closed";
  setMainWindowDockedPanelState(false);
  setMainWindowResizeBackdrop("#1d2129");
  emitDockedToolPanelState({
    open: false,
    panelKey,
    side,
    phase: "closed",
    width: panelDefinition?.width || 0
  });
}

async function transitionDockedToolPanelSide(definition, fromSide, toSide) {
  if (!mainWindow || mainWindow.isDestroyed() || !definition || !dockedToolPanelIsOpen) {
    return;
  }

  const currentBounds = mainWindow.getBounds();
  const baseBounds = deriveDockedToolPanelBaseBounds(currentBounds, definition.width, fromSide);

  if (!baseBounds) {
    return;
  }

  dockedToolPanelPhase = "switch-out";
  setDockedToolPanelRendererContext(dockedToolPanelKey, fromSide, "switch-out");
  await waitForDockedToolPanelDuration(dockedToolPanelCloseDurationMs);

  if (!mainWindow || mainWindow.isDestroyed() || !dockedToolPanelIsOpen) {
    return;
  }

  dockedToolPanelSide = toSide;
  dockedToolPanelBaseBounds = baseBounds;
  const targetBounds = getDockedToolPanelExpandedBounds(baseBounds, definition.width, toSide);
  setMainWindowBoundsImmediate(mainWindow, targetBounds);
  dockedToolPanelPhase = "switch-in";
  setDockedToolPanelRendererContext(dockedToolPanelKey, toSide, "switch-in");
  await waitForDockedToolPanelDuration(dockedToolPanelOpenDurationMs);
  dockedToolPanelPhase = "open";
  setDockedToolPanelRendererContext(dockedToolPanelKey, toSide, "open");
}

async function syncDockedToolPanelWindow(options = {}) {
  if (!dockedToolPanelIsOpen || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (dockedToolPanelBoundsAnimationInFlight && options.forceShow !== true) {
    return;
  }

  const animateSideChange = options.animateSideChange !== false;
  const definition = getDockedToolPanelDefinition(dockedToolPanelKey);

  if (!definition) {
    return;
  }

  const currentBounds = mainWindow.getBounds();
  const baseBounds = deriveDockedToolPanelBaseBounds(currentBounds, definition.width, dockedToolPanelSide);

  if (!baseBounds) {
    return;
  }

  dockedToolPanelBaseBounds = baseBounds;
  const nextSide = resolveDockedToolPanelSide(baseBounds, definition.width, dockedToolPanelSide || "");

  if (nextSide !== dockedToolPanelSide && animateSideChange) {
    await transitionDockedToolPanelSide(definition, dockedToolPanelSide, nextSide);
    return;
  }

  dockedToolPanelPhase = "open";
  setDockedToolPanelRendererContext(dockedToolPanelKey, dockedToolPanelSide, "open");
}

async function openDockedToolPanel(panelKey, options = {}) {
  const definition = getDockedToolPanelDefinition(panelKey);

  if (!definition || !mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  if (dockedToolPanelIsOpen && dockedToolPanelKey === panelKey) {
    if (options.forceOpen) {
      setDockedToolPanelRendererContext(panelKey, dockedToolPanelSide, "open");
      if (options.focusWindow !== false) {
        mainWindow.focus();
      }
      return mainWindow;
    }
    await closeDockedToolPanel();
    return null;
  }

  if (dockedToolPanelIsOpen && dockedToolPanelKey !== panelKey) {
    await closeDockedToolPanel();
  }

  dockedToolPanelKey = panelKey;
  dockedToolPanelBaseBounds = mainWindow.getBounds();
  dockedToolPanelSide = resolveDockedToolPanelSide(dockedToolPanelBaseBounds, definition.width, "");
  setMainWindowResizeBackdrop("#20242d");

  if (dockedToolPanelSide === "left") {
    emitDockedToolPanelRendererPreview(panelKey, "left", "left-pre-shift");
    await waitForDockedToolPanelFrame();
    setMainWindowBoundsImmediate(mainWindow, {
      x: Math.round(dockedToolPanelBaseBounds.x - definition.width),
      y: Math.round(dockedToolPanelBaseBounds.y),
      width: Math.round(dockedToolPanelBaseBounds.width),
      height: Math.round(dockedToolPanelBaseBounds.height)
    });
  }

  dockedToolPanelIsOpen = true;
  setDockedToolPanelWindowConstraints(definition.width);
  setMainWindowDockedPanelState(true);
  dockedToolPanelPhase = "opening";
  setDockedToolPanelRendererContext(panelKey, dockedToolPanelSide, "opening");
  const targetBounds = getDockedToolPanelExpandedBounds(dockedToolPanelBaseBounds, definition.width, dockedToolPanelSide);
  setMainWindowBoundsImmediate(mainWindow, targetBounds);
  await waitForDockedToolPanelDuration(dockedToolPanelOpenDurationMs);
  dockedToolPanelPhase = "open";
  setDockedToolPanelRendererContext(panelKey, dockedToolPanelSide, "open");
  setMainWindowResizeBackdrop("#1d2129");

  if (options.focusWindow !== false) {
    mainWindow.focus();
  }

  return null;
}

async function openScreenVisionWindow(tool = "screen-vision", options = {}) {
  const showWindow = options?.showWindow !== false;
  const focusWindow = options?.focusWindow !== false;
  if (tool === "alertas-panel" || tool === "authenticator-panel" || tool === "profiles-panel" || tool === "sqm-finder-panel" || tool === "tibia-coins-panel" || tool === "supporters-panel" || tool === "buy-me-a-coffee-panel" || tool === "settings-panel" || tool === "wheel-perks-panel") {
    return openDockedToolPanel(tool, { ...options, focusWindow });
  }
  const normalizedTool = tool === "alertas" || tool === "visual-customization"
    ? tool
    : "screen-vision";

  if (normalizedTool === "screen-vision") {
    const legacyWindow = screenVisionWindows.get("screen-vision");

    if (legacyWindow && !legacyWindow.isDestroyed()) {
      legacyWindow.close();
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }

    ensureTibiaWindowMonitor();
    return;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { workArea } = activeDisplay;
  const savedAlertAnchor = normalizedTool === "alertas"
    ? await readActiveAlertWindowAnchor()
    : normalizedTool === "visual-customization"
      ? await readVisualCustomizationWindowAnchor()
    : { left: null, top: null };
  const windowPreset = normalizedTool === "alertas"
    ? {
        width: 494,
        height: 452,
        minWidth: 470,
        minHeight: 420,
        title: tr("screenVision.alerts")
      }
    : normalizedTool === "visual-customization"
      ? {
          width: 360,
          height: 520,
          minWidth: 340,
          minHeight: 320,
          title: tr("screenVision.visualCustomization.title")
        }
    : {
        width: 528,
        height: 624,
        minWidth: 500,
        minHeight: 520,
        title: tr("screenVision.title")
      };
  const width = windowPreset.width;
  const height = windowPreset.height;
  const fallbackX = Math.max(workArea.x + 24, Math.round(workArea.x + (workArea.width - width) / 2));
  const fallbackY = Math.max(workArea.y + 24, Math.round(workArea.y + (workArea.height - height) / 2));
  const x = Number.isFinite(savedAlertAnchor.left) ? Math.round(savedAlertAnchor.left) : fallbackX;
  const y = Number.isFinite(savedAlertAnchor.top) ? Math.round(savedAlertAnchor.top) : fallbackY;
  let window = screenVisionWindows.get(normalizedTool);

  if (!window || window.isDestroyed()) {
    window = new BrowserWindow({
      width,
      height,
      x: Math.min(x, workArea.x + workArea.width - width - 20),
      y: Math.min(y, workArea.y + workArea.height - height - 20),
      minWidth: windowPreset.minWidth,
      minHeight: windowPreset.minHeight,
      resizable: true,
      backgroundColor: "#1b2029",
      icon: appIconPath,
      frame: false,
      show: false,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      title: windowPreset.title,
      webPreferences: {
        preload: path.join(__dirname, "screen-vision", "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: normalizedTool === "alertas" ? false : true
      }
    });
    window.screenVisionTool = normalizedTool;

    window.setAlwaysOnTop(true, "screen-saver");
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.webContents.on("console-message", (_event, level, message) => {
      void writeDebugLog(`screen-vision-console tool=${normalizedTool} level=${level} message=${message}`);
    });
    window.on("closed", () => {
      screenVisionWindows.delete(normalizedTool);
      ensureTibiaWindowMonitor();

      if (normalizedTool === "screen-vision") {
        void closeScreenVisionChildWindows();
      }
      if (normalizedTool === "visual-customization") {
        void persistVisualCustomizationWindowAnchor();
      }
    });
    window.on("move", () => {
      if (normalizedTool === "visual-customization") {
        void persistVisualCustomizationWindowAnchor();
      }
    });
    screenVisionWindows.set(normalizedTool, window);
  }

  const htmlPath = path.join(projectRoot, "desktop", "screen-vision", `${normalizedTool}.html`);
  const expectedUrl = pathToFileURL(htmlPath).href;

  if (window.webContents.getURL() !== expectedUrl) {
    await window.loadFile(htmlPath);
  }

  if (normalizedTool === "screen-vision") {
    await syncRegionMirrorWindows();
  }
  if (showWindow) {
    window.show();
  }

  if (focusWindow && showWindow) {
    window.focus();
  }

  ensureTibiaWindowMonitor();
  return window;
}

async function openCountdownEditorWindow(ownerWindow, regionId) {
  const normalizedRegionId = typeof regionId === "string" ? regionId.trim() : "";

  if (!normalizedRegionId) {
    return null;
  }

  let window = countdownEditorWindows.get(normalizedRegionId);

  if (window && !window.isDestroyed()) {
    window.show();
    window.focus();
    ensureTibiaWindowMonitor();
    return window;
  }

  const parentWindow = ownerWindow && !ownerWindow.isDestroyed() ? ownerWindow : mainWindow;
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { workArea } = activeDisplay;
  const width = 780;
  const height = 680;
  const x = Math.max(workArea.x + 20, Math.round(workArea.x + ((workArea.width - width) / 2)));
  const y = Math.max(workArea.y + 20, Math.round(workArea.y + ((workArea.height - height) / 2)));

  window = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 700,
    minHeight: 360,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    movable: true,
    frame: false,
    transparent: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    parent: parentWindow && !parentWindow.isDestroyed() ? parentWindow : undefined,
    webPreferences: {
      preload: path.join(__dirname, "screen-vision", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.screenVisionTool = `countdown-editor:${normalizedRegionId}`;
  window.removeMenu();
  window.setMenuBarVisibility(false);
  window.setAlwaysOnTop(true, "screen-saver");
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.webContents.on("console-message", (_event, level, message) => {
    void writeDebugLog(`screen-vision-console tool=countdown-editor region=${normalizedRegionId} level=${level} message=${message}`);
  });
  window.on("closed", () => {
    if (countdownEditorWindows.get(normalizedRegionId) === window) {
      countdownEditorWindows.delete(normalizedRegionId);
    }
    ensureTibiaWindowMonitor();
  });

  countdownEditorWindows.set(normalizedRegionId, window);
  await window.loadFile(path.join(projectRoot, "desktop", "screen-vision", "countdown-editor.html"), {
    query: {
      regionId: normalizedRegionId
    }
  });
  window.show();
  window.focus();
  ensureTibiaWindowMonitor();
  return window;
}

async function closeScreenVisionChildWindows() {
  const alertasWindow = screenVisionWindows.get("alertas");
  const visualCustomizationWindow = screenVisionWindows.get("visual-customization");

  if (alertasWindow && !alertasWindow.isDestroyed()) {
    alertasWindow.close();
  }

  if (visualCustomizationWindow && !visualCustomizationWindow.isDestroyed()) {
    visualCustomizationWindow.close();
  }

  for (const window of countdownEditorWindows.values()) {
    if (!window || window.isDestroyed()) {
      continue;
    }

    window.close();
  }

  countdownEditorWindows.clear();

  nativeMirrorRegionCount = 0;
  countdownRunningRegionIds.clear();
  unregisterAllCountdownShortcuts();
  await clearNativeMirrorWindows();
}

function ensureNativeHostEventMonitor() {
  const shouldMonitor = screenVisionWindows.size > 0 || nativeMirrorRegionCount > 0 || alertTimerListeningActive;

  if (!shouldMonitor) {
    if (nativeHostEventPollTimer) {
      clearInterval(nativeHostEventPollTimer);
      nativeHostEventPollTimer = null;
    }
    return;
  }

  if (nativeHostEventPollTimer) {
    return;
  }

  nativeHostEventPollTimer = setInterval(() => {
    void drainNativeHostEvents();
  }, nativeHostEventPollIntervalMs);

  void drainNativeHostEvents();
}

function ensureTibiaWindowMonitor() {
  ensureNativeHostEventMonitor();
  const shouldMonitor = screenVisionWindows.size > 0 || nativeMirrorRegionCount > 0 || alertTimerListeningActive;

  if (!shouldMonitor) {
    if (tibiaWindowMonitorTimer) {
      clearInterval(tibiaWindowMonitorTimer);
      tibiaWindowMonitorTimer = null;
    }
    return;
  }

  if (tibiaWindowMonitorTimer) {
    return;
  }

  tibiaWindowMonitorTimer = setInterval(() => {
    void syncTibiaMirrorVisibility(true);
  }, tibiaWindowPollIntervalMs);

  void syncTibiaMirrorVisibility(true);
}

async function syncTibiaMirrorVisibility(forceFresh = false) {
  // The native selector owns focus while the user creates or crops a mirror.
  // Do not let its normal blur (or a Windows toast during it) be interpreted
  // as an external app and hide the mirrors mid-selection.
  if (selectionInProgress) {
    return;
  }

  const tibiaState = await getTibiaWindowState({ forceFresh });
  const shouldShowOverlays = await shouldShowScreenVisionOverlays(tibiaState);
  const obsCaptureFocused = Boolean(
    !shouldShowOverlays
    && nativeMirrorRegionCount > 0
    && await isObsStudioFocused()
  );
  // OBS needs active native mirror windows to remain rendered while its
  // preview is focused. They stay non-topmost above Tibia, behind OBS.
  const shouldShowMirrorOverlays = Boolean(
    shouldShowOverlays
    || (obsCaptureFocused && canUseTibiaWindowForScreenVision(tibiaState))
  );
  const mirrorsShouldBeTopmost = Boolean(
    tibiaState
    && tibiaState.title
    && tibiaState.isForeground === true
  );
  await syncAlertTimerTibiaVisibilityGate(shouldShowOverlays);
  await setNativeMirrorsTopmost(mirrorsShouldBeTopmost);
  await setNativeMirrorsVisible(shouldShowMirrorOverlays);
  await syncNativeAuxiliaryOverlays(null, { tibiaState, visible: shouldShowOverlays }).catch(async (error) => {
    await writeDebugLog(`native-aux-visibility-sync-error ${error?.message || String(error)}`);
  });

  const nextGridSignature = buildGridOverlayTibiaSignature(tibiaState);

  if (nextGridSignature !== lastGridOverlayTibiaSignature) {
    lastGridOverlayTibiaSignature = nextGridSignature;
    await syncNativeGridOverlay(null, { tibiaState, visible: shouldShowOverlays }).catch(async (error) => {
      await writeDebugLog(`native-grid-monitor-sync-error ${error?.message || String(error)}`);
    });
  }
}

async function isObsStudioFocused() {
  try {
    await ensureNativeHostStarted();
    const response = await callNativeHost({ command: "getForegroundProcess" });
    const processName = String(response?.data?.processName || "").trim().toLowerCase();
    const focused = processName === "obs64" || processName === "obs" || processName === "obs64.exe" || processName === "obs.exe";
    await writeDebugLog(`obs-studio-focus-probe process=${processName || "none"} focused=${focused}`);
    return focused;
  } catch (error) {
    await writeDebugLog(`obs-mirror-focus-probe-failed ${error?.message || String(error)}`);
    return false;
  }
}

async function getTibiaWindowState({ forceFresh = false } = {}) {
  if (!forceFresh && tibiaWindowStateRequest) {
    return tibiaWindowStateRequest;
  }

  tibiaWindowStateRequest = (async () => {
    try {
      const normalized = await getTibiaWindowStateViaNativeHost();
      lastTibiaWindowState = normalized;
      return normalized;
    } catch (error) {
      await writeDebugLog(`tibia-window-native-error ${error?.message || String(error)}`);

      try {
        const fallbackState = await getTibiaWindowStateViaPowerShell();
        lastTibiaWindowState = fallbackState;
        return fallbackState;
      } catch (fallbackError) {
        await writeDebugLog(`tibia-window-probe-error ${fallbackError?.message || String(fallbackError)}`);
        return lastTibiaWindowState;
      }
    } finally {
      tibiaWindowStateRequest = null;
    }
  })();

  return tibiaWindowStateRequest;
}

async function getTibiaWindowStateViaNativeHost() {
  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "getTibiaWindow"
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-host-request-failed");
  }

  const normalized = normalizeTibiaDisplayState(response.data);

  if (!normalized?.bounds) {
    return null;
  }

  const display = screen.getDisplayMatching(normalized.bounds);
  return normalizeTibiaDisplayState(response.data, display);
}

async function getTibiaWindowStateViaPowerShell() {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    tibiaWindowProbeScriptPath
  ], {
    windowsHide: true,
    timeout: 5000
  });

  const output = typeof stdout === "string" ? stdout.trim() : "";

  if (!output || output === "null") {
    return null;
  }

  const parsed = JSON.parse(output);
  const display = screen.getDisplayMatching(parsed.bounds);
  return normalizeTibiaDisplayState(parsed, display);
}

async function ensureNativeHostStarted() {
  if (nativeHostShutdownRequested || appIsQuitting) {
    throw new Error("native-host-shutdown-in-progress");
  }

  if (nativeHostProcess && nativeHostProcess.exitCode === null && nativeHostProcess.killed !== true) {
    return true;
  }

  if (nativeHostStartPromise) {
    return nativeHostStartPromise;
  }

  nativeHostStartPromise = (async () => {
    await cleanupNativeHostProcesses();
    await buildNativeHostIfNeeded();

    const nativeHostCommand = app.isPackaged ? nativeHostPublishedExePath : nativeHostDotnetPath;
    const nativeHostArgs = app.isPackaged
      ? ["--pipe", nativeHostPipeId]
      : [nativeHostDllPath, "--pipe", nativeHostPipeId];
    const child = spawn(nativeHostCommand, nativeHostArgs, {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"]
    });

    nativeHostProcess = child;

    child.on("exit", (code, signal) => {
      void writeDebugLog(`native-host-exit code=${code ?? "null"} signal=${signal ?? "null"}`);
      if (nativeHostProcess === child) {
        nativeHostProcess = null;
      }
    });

    child.stderr?.on("data", (chunk) => {
      const text = String(chunk || "").trim();

      if (text) {
        void writeDebugLog(`native-host-stderr ${text}`);
      }
    });

    await waitForNativeHostReady();
    await writeDebugLog("native-host-ready");
    return true;
  })();

  try {
    return await nativeHostStartPromise;
  } finally {
    nativeHostStartPromise = null;
  }
}

async function buildNativeHostIfNeeded() {
  if (app.isPackaged) {
    await fs.access(nativeHostPublishedExePath);
    return;
  }

  if (path.isAbsolute(nativeHostDotnetPath) || nativeHostDotnetPath.includes("/") || nativeHostDotnetPath.includes("\\")) {
    await fs.access(nativeHostDotnetPath);
  }

  let shouldBuild = false;

  try {
    const nativeHostSourceRoot = path.dirname(nativeHostProjectPath);
    const [latestSourceMtimeMs, dllStat] = await Promise.all([
      getLatestModifiedTimeMs(nativeHostSourceRoot),
      fs.stat(nativeHostDllPath)
    ]);

    shouldBuild = dllStat.mtimeMs < latestSourceMtimeMs;
  } catch (_error) {
    shouldBuild = true;
  }

  if (!shouldBuild) {
    return;
  }

  await writeDebugLog("native-host-build-start");
  const nativeHostBuildArgs = ["build", nativeHostProjectPath, "-r", "win-x64", "--self-contained", "true"];

  await execFileAsync(nativeHostDotnetPath, nativeHostBuildArgs, {
    cwd: projectRoot,
    windowsHide: true,
    timeout: 120000
  });
  await writeDebugLog("native-host-build-finish");
}

async function cleanupNativeHostProcesses() {
  try {
    const nativeHostProcessFilter = "(($_.Name -eq 'dotnet.exe' -and $_.CommandLine -like '*ScreenVision.NativeHost.dll*') -or ($_.Name -eq 'ScreenVision.NativeHost.exe')) -and $_.CommandLine -like '*--pipe " + nativeHostPipeId + "*'";

    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      [
        "Get-CimInstance Win32_Process |",
        `Where-Object { ${nativeHostProcessFilter} } |`,
        "ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }"
      ].join(" ")
    ], {
      windowsHide: true,
      timeout: 12000
    });
  } catch (error) {
    await writeDebugLog(`native-host-cleanup-error ${error?.message || String(error)}`);
  }
}

async function getLatestModifiedTimeMs(rootDir) {
  let latest = 0;
  const pending = [rootDir];

  while (pending.length) {
    const currentDir = pending.pop();
    const entries = await fs.readdir(currentDir, {
      withFileTypes: true
    });

    for (const entry of entries) {
      if (entry.name === "bin" || entry.name === "obj") {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }

      const stat = await fs.stat(fullPath);
      latest = Math.max(latest, stat.mtimeMs);
    }
  }

  return latest;
}

async function waitForNativeHostReady() {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < nativeHostStartupTimeoutMs) {
    try {
      const response = await callNativeHost({
        command: "ping"
      });

      if (response?.ok) {
        return true;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(180);
  }

  throw lastError || new Error("native-host-timeout");
}

function callNativeHost(payload, options = {}) {
  const run = () => callNativeHostOnce(payload, options);
  const queued = nativeHostRpcQueue.then(run, run);
  nativeHostRpcQueue = queued.then(() => undefined, () => undefined);
  return queued;
}

function callNativeHostOnce(payload, options = {}) {
  return new Promise((resolve, reject) => {
    let socket = null;
    let settled = false;
    let buffer = "";
    let connectAttempts = 0;
    let connectRetryTimer = null;
    let responseReceived = false;

    const timeoutMs = Math.max(250, Number(options.timeoutMs) || nativeHostPipeTimeoutMs);
    const timeout = setTimeout(() => {
      cleanup("destroy");
      reject(new Error("native-host-pipe-timeout"));
    }, timeoutMs);

    const cleanup = (mode = "destroy") => {
      clearTimeout(timeout);
      if (connectRetryTimer) {
        clearTimeout(connectRetryTimer);
        connectRetryTimer = null;
      }
      if (socket) {
        socket.removeAllListeners();

        if (mode === "end" && !socket.destroyed) {
          try {
            socket.end();
          } catch (_error) {
          }
          return;
        }

        if (!socket.destroyed) {
          socket.destroy();
        }
      }
    };

    const connect = () => {
      connectAttempts += 1;
      socket = net.createConnection(nativeHostPipeName);

      socket.on("connect", () => {
        socket.write(`${JSON.stringify(payload)}\n`);
      });

      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");

        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex < 0 || settled) {
          return;
        }

        settled = true;
        responseReceived = true;
        const line = buffer.slice(0, newlineIndex).trim();
        cleanup("end");

        if (!line) {
          reject(new Error("native-host-empty-response"));
          return;
        }

        try {
          resolve(JSON.parse(line));
        } catch (error) {
          reject(error);
        }
      });

      socket.on("error", (error) => {
        const message = String(error?.message || "");

        if (!settled && connectAttempts < 8 && (message.includes("ENOENT") || message.includes("EPIPE"))) {
          if (socket && !socket.destroyed) {
            socket.destroy();
          }
          connectRetryTimer = setTimeout(connect, 90);
          return;
        }

        cleanup("destroy");
        reject(error);
      });

      socket.on("end", () => {
        if (!settled && !responseReceived) {
          cleanup("destroy");
          reject(new Error("native-host-ended-without-response"));
        }
      });
    };

    connect();
  });
}

async function syncNativeMirrorWindows(regions) {
  const mirrors = regions
    .map((entry) => normalizeOverlayMirrorEntry(entry))
    .filter(Boolean)
    .map((region) => ({
      id: region.id,
      name: region.name,
      captureBounds: region.captureBounds,
      mirrorBounds: region.mirrorBounds,
      relativeBounds: region.relativeBounds,
      opacity: region.opacity,
      isLocked: region.isLocked,
      isVisible: region.isVisible,
      isFixedCrop: Boolean(region.isFixedCrop),
      allowSnapping: region.allowSnapping !== false,
      scale: clampNumber(region.scale, 0.5, 4, 1),
      glowEnabled: Boolean(region.glowEnabled),
      glowColor: normalizeHexColor(region.glowColor, "#FFFFFF"),
      glowSavedColors: normalizeMirrorGlowSavedColors(region.glowSavedColors),
      glowIntensity: clampNumber(region.glowIntensity, 1, 30, 10),
      countdown: {
        enabled: Boolean(region.countdown?.enabled),
        durationSeconds: clampInteger(region.countdown?.durationSeconds, 1, 43200, 60),
        side: normalizeCountdownSide(region.countdown?.side),
        direction: normalizeCountdownDirectionValue(region.countdown?.direction || getCountdownDefaultsForSide(region.countdown?.side).direction),
        color: normalizeCountdownColorValue(region.countdown?.color),
        barThickness: clampInteger(region.countdown?.barThickness, 1, 2000, getCountdownDefaultsForSide(region.countdown?.side).barThickness),
        barLength: clampInteger(region.countdown?.barLength, 1, 4000, getCountdownDefaultsForSide(region.countdown?.side).barLength),
        borderWidth: clampInteger(region.countdown?.borderWidth, 0, 64, 1),
        borderRadius: clampInteger(region.countdown?.borderRadius, 0, 200, 3),
        borderColor: normalizeCountdownColorValue(region.countdown?.borderColor || "#ffffff"),
        flashEnabled: region.countdown?.flashEnabled !== false,
        hotkey: typeof region.countdown?.hotkey === "string" ? region.countdown.hotkey.trim().toUpperCase() : "",
        hotkeyKeyCode: clampInteger(region.countdown?.hotkeyKeyCode, 0, 255, 0),
        hotkeyModifiers: clampInteger(region.countdown?.hotkeyModifiers, 0, 15, 0),
        retriggerEnabled: Boolean(region.countdown?.retriggerEnabled),
        savedColors: Array.isArray(region.countdown?.savedColors) ? region.countdown.savedColors : undefined,
        savedBorderColors: Array.isArray(region.countdown?.savedBorderColors) ? region.countdown.savedBorderColors : undefined
      }
    }));

  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "syncMirrors",
    mirrors
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-sync-mirrors-failed");
  }

  return response;
}

async function previewNativeMirrorOpacity(regionId, opacityPercent) {
  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "previewOpacity",
    regionId,
    opacity: clampInteger(opacityPercent, 15, 100, 100)
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-preview-opacity-failed");
  }

  return response;
}

async function startNativeRegionCountdown(regionId) {
  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "startCountdown",
    regionId
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-start-countdown-failed");
  }

  return response;
}

async function stopNativeRegionCountdown(regionId) {
  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "stopCountdown",
    regionId
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-stop-countdown-failed");
  }

  return response;
}

async function setNativeMirrorsVisible(visible) {
  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "setMirrorsVisible",
    visible
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-set-mirrors-visible-failed");
  }

  return response;
}

async function setNativeMirrorsTopmost(enabled) {
  const next = Boolean(enabled);

  if (nativeMirrorsAlwaysOnTop === next) {
    return { ok: true, skipped: true, enabled: next };
  }

  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "setMirrorsTopmost",
    enabled: next
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-set-mirrors-topmost-failed");
  }

  nativeMirrorsAlwaysOnTop = next;
  return response;
}

async function clearNativeMirrorWindows() {
  try {
    await ensureNativeHostStarted();
    const response = await callNativeHost({
      command: "clearMirrors"
    });

    if (!response?.ok) {
      throw new Error(response?.error || "native-clear-mirrors-failed");
    }
  } catch (error) {
    await writeDebugLog(`native-clear-mirrors-error ${error?.message || String(error)}`);
  }
}

async function forceUnsnapNativeMirror(regionId) {
  if (!regionId) {
    return null;
  }

  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "unsnapMirror",
    regionId
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-unsnap-mirror-failed");
  }

  return response;
}

async function syncNativeAuxiliaryOverlays(overlayToolsState = null, options = {}) {
  const state = overlayToolsState || await readOverlayToolsState();
  const tibiaState = options.tibiaState ?? await getTibiaWindowState().catch(() => null);
  const visible = options.visible ?? await shouldShowScreenVisionOverlays(tibiaState);
  await Promise.allSettled([
    syncNativeGridOverlay(state, { tibiaState, visible }),
    syncNativeVisualCustomization(state, { tibiaState, visible })
  ]);
}

async function syncNativeGridOverlay(overlayToolsState = null, options = {}) {
  const state = overlayToolsState || await readOverlayToolsState();
  const grid = getScreenVisionGridSettings(state);
  const tibiaState = options.tibiaState ?? await getTibiaWindowState().catch(() => null);
  const visible = options.visible ?? await shouldShowScreenVisionOverlays(tibiaState);
  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "setGridOverlay",
    enabled: grid.enabled,
    gridSize: grid.gridSize,
    visible
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-grid-overlay-failed");
  }

  return response;
}

async function syncNativeVisualCustomization(overlayToolsState = null, options = {}) {
  const state = overlayToolsState || await readOverlayToolsState();
  const visual = getScreenVisionVisualSettings(state);
  const tibiaState = options.tibiaState ?? await getTibiaWindowState().catch(() => null);
  const visible = options.visible ?? await shouldShowScreenVisionOverlays(tibiaState);
  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "syncVisualCustomization",
    visualCustomization: visual,
    visible
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-visual-customization-failed");
  }

  return response;
}

async function drainNativeHostEvents() {
  if (nativeHostEventSyncInFlight) {
    return;
  }

  nativeHostEventSyncInFlight = true;

  try {
    await ensureNativeHostStarted();
    const response = await callNativeHost({
      command: "drainEvents"
    });

    if (!response?.ok) {
      throw new Error(response?.error || "native-drain-events-failed");
    }

    const events = Array.isArray(response?.data?.events) ? response.data.events : [];

    for (const event of events) {
      await handleNativeHostEvent(event);
    }
  } catch (error) {
    await writeDebugLog(`native-drain-events-error ${error?.message || String(error)}`);
  } finally {
    nativeHostEventSyncInFlight = false;
  }
}

async function handleNativeHostEvent(event) {
  const type = typeof event?.Type === "string"
    ? event.Type
    : typeof event?.type === "string"
      ? event.type
      : "";
  const regionId = typeof event?.RegionId === "string"
    ? event.RegionId
    : typeof event?.regionId === "string"
      ? event.regionId
      : "";
  const bounds = event?.Bounds || event?.bounds || null;
  const intValue = Number.isFinite(Number(event?.IntValue ?? event?.intValue))
    ? Math.round(Number(event.IntValue ?? event.intValue))
    : null;
  const boolValue = typeof (event?.BoolValue ?? event?.boolValue) === "boolean"
    ? Boolean(event.BoolValue ?? event.boolValue)
    : null;
  const stringValue = typeof (event?.StringValue ?? event?.stringValue) === "string"
    ? String(event.StringValue ?? event.stringValue)
    : null;

  if (!type) {
    return;
  }

  if (type === "visual-charloc-position-changed" && bounds) {
    const overlayToolsState = await readOverlayToolsState();
    overlayToolsState.settings = overlayToolsState.settings || {};
    overlayToolsState.settings.screenVision = overlayToolsState.settings.screenVision || {};
    overlayToolsState.settings.screenVision.visualCustomization = {
      ...getScreenVisionVisualSettings(overlayToolsState),
      charLocX: clampNumber(bounds.x ?? bounds.X, -50000, 50000, 0),
      charLocY: clampNumber(bounds.y ?? bounds.Y, -50000, 50000, 0)
    };
    await writeOverlayToolsState(overlayToolsState, {
      skipSyncNativeAuxiliary: true
    });
    return;
  }

  if (type === "global-hotkey-pressed" && Number.isFinite(intValue)) {
    const modifiers = clampInteger(event?.StringValue ?? event?.stringValue, 0, 15, 0);
    const overlayToolsState = await readOverlayToolsState();

    if (shouldEmitAlertTimerHotkey(intValue, modifiers, overlayToolsState)) {
      await handleAlertTimerHotkey(intValue, modifiers, overlayToolsState);
    }

    return;
  }

  if (!regionId) {
    return;
  }

  if (type === "mirror-bounds-changed" && bounds) {
    await writeDebugLog(`native-event type=${type} region=${regionId} bounds=${JSON.stringify(bounds)}`);
    const savedState = await mutateRegion(regionId, (region) => {
      const nextBounds = normalizeBoundsForPersistence(bounds, region.mirrorBounds);

      if (areBoundsEqual(region.mirrorBounds, nextBounds)) {
        return region;
      }

      return {
        ...region,
        mirrorBounds: nextBounds
      };
    });

    // Moving/resizing an unlocked mirror is already completed by the native
    // window. Only propagate the new geometry to OBS; re-syncing native here
    // would feed the same bounds back into the drag interaction.
    obsMirrorSync.scheduleSync({
      regions: savedState.mirrors.items.filter((entry) => entry.isVisible),
      tibiaState: lastTibiaWindowState
    });
    return;
  }

  if (type === "mirror-delete-region") {
    await writeDebugLog(`native-event type=${type} region=${regionId}`);
    countdownRunningRegionIds.delete(regionId);
    await stopNativeRegionCountdown(regionId).catch(() => {});
    const overlayToolsState = await readOverlayToolsState();
    overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.filter((entry) => entry.id !== regionId);
    const savedState = await writeOverlayToolsState(overlayToolsState);
    await syncRegionMirrorWindows(savedState);
    return;
  }

  if (type === "mirror-toggle-visibility" || type === "mirror-closed") {
    await writeDebugLog(`native-event type=${type} region=${regionId}`);
    countdownRunningRegionIds.delete(regionId);
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      isVisible: type === "mirror-closed" ? false : !region.isVisible
    }));
    await syncRegionMirrorWindows(savedState);
    return;
  }

  if (type === "mirror-toggle-lock") {
    await writeDebugLog(`native-event type=${type} region=${regionId}`);
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      isLocked: !region.isLocked
    }));
    await syncRegionMirrorWindows(savedState);
    return;
  }

  if (type === "mirror-set-allow-snapping") {
    await writeDebugLog(`native-event type=${type} region=${regionId} value=${boolValue}`);
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      allowSnapping: boolValue !== false
    }));
    await syncRegionMirrorWindows(savedState);
    return;
  }

  if (type === "mirror-unsnap") {
    await writeDebugLog(`native-event type=${type} region=${regionId}`);
    await forceUnsnapNativeMirror(regionId).catch(() => {});
    await drainNativeHostEvents().catch(() => {});
    const overlayToolsState = await readOverlayToolsState();
    await syncRegionMirrorWindows(overlayToolsState);
    return;
  }

  if (type === "mirror-make-new-crop") {
    await writeDebugLog(`native-event type=${type} region=${regionId}`);
    await makeNewCropForRegionById(regionId);
    return;
  }

  if (type === "mirror-delete") {
    await writeDebugLog(`native-event type=${type} region=${regionId}`);
    countdownRunningRegionIds.delete(regionId);
    const overlayToolsState = await readOverlayToolsState();
    overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.filter((entry) => entry.id !== regionId);
    const savedState = await writeOverlayToolsState(overlayToolsState);
    await syncRegionMirrorWindows(savedState);
    return;
  }

  if (type === "mirror-set-opacity" && Number.isFinite(intValue)) {
    await writeDebugLog(`native-event type=${type} region=${regionId} value=${intValue}`);
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      opacity: clampInteger(intValue, 15, 100, region.opacity)
    }));
    await syncRegionMirrorWindows(savedState);
    return;
  }

  if (type === "mirror-reselect") {
    await writeDebugLog(`native-event type=${type} region=${regionId}`);
    await reselectRegionById(regionId);
    return;
  }

  if (type === "mirror-crop-current-mirror" && typeof stringValue === "string" && stringValue.trim()) {
    await writeDebugLog(`native-event type=${type} region=${regionId}`);

    let payload = null;

    try {
      payload = JSON.parse(stringValue);
    } catch (_error) {
      payload = null;
    }

    if (payload?.captureBounds && payload?.relativeBounds && payload?.mirrorBounds) {
      const savedState = await mutateRegion(regionId, (region) => ({
        ...region,
        captureBounds: normalizeBoundsForPersistence(payload.captureBounds, region.captureBounds),
        relativeBounds: normalizeBoundsForPersistence(payload.relativeBounds, region.relativeBounds),
        mirrorBounds: normalizeBoundsForPersistence(payload.mirrorBounds, region.mirrorBounds),
        scale: clampNumber(payload.scale, 0.5, 4, region.scale || 1)
      }));
      await syncRegionMirrorWindows(savedState);
    }

    return;
  }

  if (type === "mirror-set-scale" && typeof stringValue === "string" && stringValue.trim()) {
    const parsedScale = Number(stringValue);

    if (!Number.isFinite(parsedScale)) {
      return;
    }

    await writeDebugLog(`native-event type=${type} region=${regionId} value=${parsedScale}`);
    await mutateRegion(regionId, (region) => ({
      ...region,
      scale: clampNumber(parsedScale, 0.5, 4, region.scale || 1)
    }));
    return;
  }

  if (type === "mirror-set-glow-enabled") {
    await writeDebugLog(`native-event type=${type} region=${regionId} value=${boolValue}`);
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      glowEnabled: Boolean(boolValue)
    }));
    await syncRegionMirrorWindows(savedState);
    return;
  }

  if (type === "mirror-set-glow-color" && typeof stringValue === "string" && stringValue.trim()) {
    await writeDebugLog(`native-event type=${type} region=${regionId} value=${stringValue}`);
    await mutateRegion(regionId, (region) => ({
      ...region,
      glowEnabled: true,
      glowColor: normalizeHexColor(stringValue, region.glowColor || "#FFFFFF")
    }));
    return;
  }

  if (type === "mirror-set-glow-saved-colors" && typeof stringValue === "string" && stringValue.trim()) {
    let colors = [];

    try {
      colors = JSON.parse(stringValue);
    } catch {
      colors = [];
    }

    if (!Array.isArray(colors)) {
      return;
    }

    await writeDebugLog(`native-event type=${type} region=${regionId} count=${colors.length}`);
    await mutateRegion(regionId, (region) => ({
      ...region,
      glowSavedColors: normalizeMirrorGlowSavedColors(colors)
    }));
    return;
  }

  if (type === "mirror-set-glow-intensity" && typeof stringValue === "string" && stringValue.trim()) {
    const parsedIntensity = Number(stringValue);

    if (!Number.isFinite(parsedIntensity)) {
      return;
    }

    await writeDebugLog(`native-event type=${type} region=${regionId} value=${parsedIntensity}`);
    await mutateRegion(regionId, (region) => ({
      ...region,
      glowEnabled: true,
      glowIntensity: clampNumber(parsedIntensity, 1, 30, region.glowIntensity || 10)
    }));
    return;
  }

  if (type === "mirror-countdown-started") {
    countdownRunningRegionIds.add(regionId);
    return;
  }

  if (type === "mirror-countdown-stopped" || type === "mirror-countdown-finished") {
    countdownRunningRegionIds.delete(regionId);
  }
}

async function triggerRegionCountdown(regionId, { forceRestart = false } = {}) {
  const overlayToolsState = await readOverlayToolsState();
  const region = overlayToolsState.mirrors.items.find((entry) => entry.id === regionId) || null;

  if (!region) {
    return { ok: false, ignored: false, region: null, items: overlayToolsState.mirrors.items };
  }

  const countdown = region.countdown || {};

  if (!countdown.enabled || !region.isLocked) {
    return { ok: false, ignored: false, region, items: overlayToolsState.mirrors.items };
  }

  const isRunning = countdownRunningRegionIds.has(regionId);

  if (isRunning && countdown.retriggerEnabled && !forceRestart) {
    return { ok: true, ignored: true, region, items: overlayToolsState.mirrors.items };
  }

  await startNativeRegionCountdown(regionId);
  countdownRunningRegionIds.add(regionId);
  return { ok: true, ignored: false, region, items: overlayToolsState.mirrors.items };
}

async function stopRegionCountdown(regionId) {
  const overlayToolsState = await readOverlayToolsState();
  const region = overlayToolsState.mirrors.items.find((entry) => entry.id === regionId) || null;

  if (!region) {
    return { ok: false, region: null, items: overlayToolsState.mirrors.items };
  }

  await stopNativeRegionCountdown(regionId);
  countdownRunningRegionIds.delete(regionId);
  return { ok: true, region, items: overlayToolsState.mirrors.items };
}

async function syncCountdownHotkeys(overlayToolsState = null) {
  void overlayToolsState;
  unregisterAllCountdownShortcuts();
}

function unregisterAllCountdownShortcuts() {
  for (const accelerator of countdownShortcutRegionMap.keys()) {
    globalShortcut.unregister(accelerator);
  }

  countdownShortcutRegionMap.clear();
}

async function syncAlertTimerHotkeys(overlayToolsState = null) {
  unregisterAllAlertTimerShortcuts();
  const resolvedState = overlayToolsState || await readOverlayToolsState();
  alertTimerListeningActive = Boolean(
    (resolvedState?.timers?.isListening || resolvedState?.timers?.visualsEnabled)
    && Array.isArray(resolvedState?.timers?.items)
    && resolvedState.timers.items.length > 0
  );
  ensureNativeHostEventMonitor();
  if (alertTimerListeningActive) {
    const tibiaState = await getTibiaWindowState({ forceFresh: true }).catch(() => null);
    const shouldShowOverlays = await shouldShowScreenVisionOverlays(tibiaState).catch(() => false);
    await syncAlertTimerTibiaVisibilityGate(shouldShowOverlays);
  } else {
    alertTimerSignalsAllowedByTibia = true;
  }
  ensureTibiaWindowMonitor();
  await syncAlertTimerRuntimeState(resolvedState).catch(() => {});

  return resolvedState;
}

function unregisterAllAlertTimerShortcuts() {
  for (const accelerator of alertTimerShortcutMap.keys()) {
    globalShortcut.unregister(accelerator);
  }

  alertTimerShortcutMap.clear();
}

function toAlertTimerAccelerator(keyCode, modifiers) {
  const keyLabel = keyCodeToElectronAccelerator(keyCode);

  if (!keyLabel) {
    return "";
  }

  const parts = [];
  if (modifiers & 2) {
    parts.push("CommandOrControl");
  }
  if (modifiers & 1) {
    parts.push("Alt");
  }
  if (modifiers & 4) {
    parts.push("Shift");
  }
  if (modifiers & 8) {
    parts.push("Super");
  }
  parts.push(keyLabel);
  return parts.join("+");
}

function keyCodeToElectronAccelerator(keyCode) {
  if (keyCode >= 65 && keyCode <= 90) {
    return String.fromCharCode(keyCode);
  }
  if (keyCode >= 48 && keyCode <= 57) {
    return String.fromCharCode(keyCode);
  }
  if (keyCode >= 96 && keyCode <= 105) {
    return `num${keyCode - 96}`;
  }
  if (keyCode >= 112 && keyCode <= 135) {
    return `F${keyCode - 111}`;
  }

  switch (keyCode) {
    case 32: return "Space";
    case 13: return "Enter";
    case 9: return "Tab";
    case 27: return "Escape";
    case 192: return "`";
    case 107: return "numadd";
    case 189: return "-";
    case 187: return "=";
    default: return "";
  }
}

function shouldEmitAlertTimerHotkey(keyCode, modifiers, overlayToolsState) {
  if (!alertTimerSignalsAllowedByTibia) {
    return false;
  }

  if (!overlayToolsState?.timers?.isListening && !overlayToolsState?.timers?.visualsEnabled) {
    return false;
  }

  return Array.isArray(overlayToolsState.timers.items)
    && overlayToolsState.timers.items.some((timer) => (
      isAlertTimerSignalEnabled(timer, overlayToolsState)
      &&
      clampInteger(timer?.hotkeyKeyCode, 0, 255, 0) === keyCode
      && clampInteger(timer?.hotkeyModifiers, 0, 15, 0) === modifiers
    ));
}

function buildAlertTimerRuntimeSnapshot() {
  const now = Date.now();
  const activeById = {};

  for (const [timerId, runtime] of alertTimerRuntimeById.entries()) {
    const remainingMs = runtime.pausedByTibia
      ? Math.max(0, Number(runtime.pausedRemainingMs) || 0)
      : Math.max(0, runtime.endsAt - now);
    activeById[timerId] = {
      startedAt: runtime.startedAt,
      endsAt: runtime.endsAt,
      remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
      phase: runtime.phase || "running",
      pausedByTibia: runtime.pausedByTibia === true,
      remindersSent: clampInteger(runtime.remindersSent, 0, 999, 0),
      reminderRepeatCount: clampInteger(runtime.reminderRepeatCount, 0, 999, 0)
    };
  }

  return { activeById };
}

async function emitAlertTimerRuntimeChanged(reason = "runtime-updated", payload = {}) {
  const eventPayload = {
    reason,
    snapshot: buildAlertTimerRuntimeSnapshot(),
    ...payload
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("screen-vision:timers:runtime", eventPayload);
  }

  for (const window of screenVisionWindows.values()) {
    if (!window || window.isDestroyed()) {
      continue;
    }

    window.webContents.send("screen-vision:timers:runtime", eventPayload);
  }
}

function ensureAlertTimerSnapshotTicker() {
  if (alertTimerRuntimeSnapshotTimer) {
    return;
  }

  alertTimerRuntimeSnapshotTimer = setInterval(() => {
    if (alertTimerRuntimeById.size === 0) {
      clearInterval(alertTimerRuntimeSnapshotTimer);
      alertTimerRuntimeSnapshotTimer = null;
      return;
    }

    void emitAlertTimerRuntimeChanged("tick");
  }, 250);
}

function cleanupAlertTimerSnapshotTicker() {
  if (alertTimerRuntimeById.size > 0) {
    return;
  }

  if (alertTimerRuntimeSnapshotTimer) {
    clearInterval(alertTimerRuntimeSnapshotTimer);
    alertTimerRuntimeSnapshotTimer = null;
  }
}

function stopAlertTimerRuntimeInternal(timerId) {
  const runtime = alertTimerRuntimeById.get(timerId);

  if (!runtime) {
    return false;
  }

  if (runtime.timeout) {
    clearTimeout(runtime.timeout);
    runtime.timeout = null;
  }

  alertTimerRuntimeById.delete(timerId);
  cleanupAlertTimerSnapshotTicker();
  return true;
}

function pauseAlertTimerRuntimeInternal(timerId) {
  const runtime = alertTimerRuntimeById.get(timerId);

  if (!runtime || runtime.pausedByTibia) {
    return false;
  }

  if (runtime.timeout) {
    clearTimeout(runtime.timeout);
    runtime.timeout = null;
  }

  runtime.pausedByTibia = true;
  runtime.pausedRemainingMs = Math.max(0, runtime.endsAt - Date.now());
  return true;
}

function resumeAlertTimerRuntimeInternal(timerId) {
  const runtime = alertTimerRuntimeById.get(timerId);

  if (!runtime || !runtime.pausedByTibia) {
    return false;
  }

  const remainingMs = Math.max(1, Math.round(Number(runtime.pausedRemainingMs) || 0));
  const now = Date.now();
  runtime.pausedByTibia = false;
  runtime.pausedRemainingMs = 0;
  runtime.startedAt = now;
  runtime.endsAt = now + remainingMs;
  runtime.timeout = setTimeout(() => {
    if (runtime.phase === "waiting-reminder") {
      void handleAlertTimerReminder(timerId);
      return;
    }
    void completeAlertTimerRuntime(timerId);
  }, remainingMs);
  return true;
}

async function syncAlertTimerTibiaVisibilityGate(allowed) {
  const nextAllowed = Boolean(allowed);

  if (alertTimerSignalsAllowedByTibia === nextAllowed) {
    return;
  }

  alertTimerSignalsAllowedByTibia = nextAllowed;

  if (!nextAllowed) {
    for (const [timerId] of alertTimerRuntimeById.entries()) {
      await hideTimerVisualAlertWindow({ timerId }).catch(() => false);
    }
  }
}

function resolveAlertReminderDelayMs(timer) {
  return Math.max(1000, clampInteger(timer?.reminderDelaySeconds, 1, 3600, 10) * 1000);
}

function resolveAlertReminderRepeatCount(timer) {
  return clampInteger(timer?.reminderRepeatCount, 1, 10, 2);
}

function scheduleAlertTimerReminder(runtime, timerId) {
  if (!runtime || !timerId) {
    return;
  }

  if (runtime.timeout) {
    clearTimeout(runtime.timeout);
  }

  const now = Date.now();
  runtime.phase = "waiting-reminder";
  runtime.startedAt = now;
  runtime.endsAt = now + runtime.reminderDelayMs;
  runtime.timeout = setTimeout(() => {
    void handleAlertTimerReminder(timerId);
  }, runtime.reminderDelayMs);
}

async function stopAlertTimerById(timerId, options = {}) {
  const normalizedTimerId = typeof timerId === "string" ? timerId.trim() : "";

  if (!normalizedTimerId) {
    return {
      ok: false,
      stopped: false,
      snapshot: buildAlertTimerRuntimeSnapshot()
    };
  }

  const stopped = stopAlertTimerRuntimeInternal(normalizedTimerId);

  if (stopped && options.emit !== false) {
    await emitAlertTimerRuntimeChanged(options.reason || "timer-stopped", {
      timerId: normalizedTimerId
    });
  }

  return {
    ok: true,
    stopped,
    snapshot: buildAlertTimerRuntimeSnapshot()
  };
}

function stopAllAlertTimerRuntimes(options = {}) {
  for (const timerId of [...alertTimerRuntimeById.keys()]) {
    stopAlertTimerRuntimeInternal(timerId);
  }

  if (options.emit !== false) {
    void emitAlertTimerRuntimeChanged(options.reason || "all-timers-stopped");
  }
}

function resolveAlertTimerSoundFile(timer) {
  const soundKey = typeof timer?.soundKey === "string" ? timer.soundKey.trim() : "";
  const bundled = {
    "utura-gran": resolveRuntimeFilePath("assets/screen-vision/reference/sounds/utura gran.ogg"),
    "exura-gran-ico": resolveRuntimeFilePath("assets/screen-vision/reference/sounds/exura gran ico.ogg"),
    "utito-tempo": resolveRuntimeFilePath("assets/screen-vision/reference/sounds/utito tempo.ogg")
  };

  if (typeof timer?.customSoundPath === "string" && timer.customSoundPath.trim()) {
    try {
      return path.resolve(timer.customSoundPath.trim());
    } catch {
      return "";
    }
  }

  if (screenVisionSpellSoundMap.has(soundKey)) {
    return screenVisionSpellSoundMap.get(soundKey) || "";
  }

  if (bundled[soundKey]) {
    return bundled[soundKey];
  }

  return "";
}

async function ensureAlertAudioRuntimeWindow() {
  if (alertAudioRuntimeWindow && !alertAudioRuntimeWindow.isDestroyed()) {
    return alertAudioRuntimeWindow;
  }

  const window = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    frame: false,
    transparent: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    webPreferences: {
      autoplayPolicy: "no-user-gesture-required",
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  window.on("closed", () => {
    if (alertAudioRuntimeWindow === window) {
      alertAudioRuntimeWindow = null;
    }
  });

  const html = `<!doctype html><html><body><script>
  (() => {
    const queue = [];
    let playing = false;
    async function playNext() {
      if (playing || queue.length === 0) return;
      playing = true;
      const entry = queue.shift() || {};
      const audio = new Audio(entry.file || "");
      audio.volume = Math.max(0, Math.min(1, Number(entry.volume) || 0));
      await new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          try { audio.pause(); } catch {}
          audio.src = "";
          resolve();
        };
        audio.addEventListener("ended", finish, { once: true });
        audio.addEventListener("error", finish, { once: true });
        setTimeout(finish, Math.max(1000, Number(entry.maxDurationMs) || 6000));
        audio.play().catch(finish);
      });
      playing = false;
      playNext();
    }
    window.__alertAudioRuntime = {
      enqueue(entry) {
        queue.push(entry || {});
        playNext();
      }
    };
  })();
  </script></body></html>`;

  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  window.webContents.setAudioMuted(false);
  alertAudioRuntimeWindow = window;
  return window;
}

async function playAlertTimerSound(timer, overlayToolsState = null) {
  const state = overlayToolsState || await readOverlayToolsState();

  if (!state?.timers?.isListening || timer?.enabled === false) {
    return true;
  }

  if (timer?.volumeMuted) {
    await writeDebugLog(`alert-timer-audio-muted timer=${timer?.id || "unknown"}`);
    return true;
  }

  const file = resolveAlertTimerSoundFile(timer);

  if (!file) {
    await writeDebugLog(`alert-timer-sound-missing timer=${timer?.id || "unknown"} key=${timer?.soundKey || ""}`);
    return false;
  }

  const globalVolume = clampInteger(state?.timers?.globalVolumePercent, 0, 100, 70) / 100;
  const timerVolume = clampInteger(timer?.volumePercent, 0, 100, 100) / 100;
  const volume = Math.max(0, Math.min(1, globalVolume * timerVolume));
  await ensureNativeHostStarted().catch(() => {});
  const response = await callNativeHost({
    command: "playAlertSound",
    filePath: file,
    volume
  }).catch(async (error) => {
    await writeDebugLog(`alert-timer-audio-native-error timer=${timer?.id || "unknown"} message=${error?.message || String(error)}`);
    return null;
  });

  if (!response?.ok) {
    await writeDebugLog(`alert-timer-audio-native-failed timer=${timer?.id || "unknown"} error=${response?.error || "unknown"}`);
    return false;
  }

  await writeDebugLog(`alert-timer-audio-enqueued timer=${timer?.id || "unknown"} file=${file} volume=${volume.toFixed(3)} mode=native`);

  return true;
}

async function dispatchAlertTimerSignal(timer, overlayToolsState, options = {}) {
  if (!alertTimerSignalsAllowedByTibia) {
    return {
      played: false,
      message: `Timer "${timer?.name || "Sem nome"}" pausado porque o Tibia nao esta visivel.`,
      tone: "info"
    };
  }

  const isReminder = options.isReminder === true;
  const reminderIndex = clampInteger(options.reminderIndex, 1, 999, 1);
  const reminderTotal = clampInteger(options.reminderTotal, 1, 999, 1);
  const timerName = timer?.name || "Sem nome";
  const visualsEnabled = Boolean(overlayToolsState?.timers?.visualsEnabled);
  let message = "";
  let tone = "info";

  const played = await playAlertTimerSound(timer, overlayToolsState);

  if (visualsEnabled && timer.showVisualAlert && timer.locked) {
    await showTimerVisualAlertWindow({
      timerId: timer.id,
      name: timer.name || "Timer",
      message: (timer.message || timer.name || "Timer pronto").trim(),
      color: timer.alertColor || "#FFFFFF",
      fontSize: fontSizeKeyToValue(timer.fontSizeKey),
      fontFamily: timer.alertFontFamily || "nunito",
      fontWeight: timer.alertFontWeight || 700,
      shadowEnabled: timer.alertShadowEnabled !== false,
      durationSeconds: timer.alertDurationSeconds ?? 1.6,
      x: timer.alertPositionX,
      y: timer.alertPositionY
    }).catch(() => {});
    message = isReminder
      ? `Lembrete ${reminderIndex}/${reminderTotal} de "${timerName}" disparado com alerta visual.`
      : `Timer "${timerName}" concluido com alerta visual.`;
  } else if (visualsEnabled && timer.showVisualAlert && !timer.locked) {
    tone = "danger";
    message = isReminder
      ? `Lembrete ${reminderIndex}/${reminderTotal} de "${timerName}" tocou, mas o texto nao apareceu porque a posicao ainda esta destravada. Clique em Travado para salvar e ativar o alerta visual.`
      : `Timer "${timerName}" tocou, mas o texto nao apareceu porque a posicao ainda esta destravada. Clique em Travado para salvar e ativar o alerta visual.`;
  } else {
    message = played
      ? (isReminder
        ? `Lembrete ${reminderIndex}/${reminderTotal} de "${timerName}" concluido.`
        : `Timer "${timerName}" concluido.`)
      : (isReminder
        ? `Lembrete ${reminderIndex}/${reminderTotal} de "${timerName}" concluiu, mas nenhum som valido foi encontrado.`
        : `Timer "${timerName}" concluiu, mas nenhum som valido foi encontrado.`);
    if (!played) {
      tone = "danger";
    }
  }

  return { played, message, tone };
}

async function completeAlertTimerRuntime(timerId) {
  const normalizedTimerId = typeof timerId === "string" ? timerId.trim() : "";
  const runtime = normalizedTimerId ? alertTimerRuntimeById.get(normalizedTimerId) : null;

  if (!normalizedTimerId || !runtime) {
    return;
  }

  const overlayToolsState = await readOverlayToolsState();
  const timer = Array.isArray(overlayToolsState?.timers?.items)
    ? overlayToolsState.timers.items.find((entry) => entry?.id === normalizedTimerId) || null
    : null;

  let message = "";
  let tone = "info";

  if (timer) {
    if (!alertTimerSignalsAllowedByTibia) {
      stopAlertTimerRuntimeInternal(normalizedTimerId);
      await emitAlertTimerRuntimeChanged("timer-expired-while-tibia-hidden", {
        timerId: normalizedTimerId,
        message: `Timer "${timer.name || "Sem nome"}" expirou fora do Tibia e foi descartado.`,
        tone: "info"
      });
      return;
    }

    await writeDebugLog(`alert-timer-finished timer=${timer.id} name=${timer.name || "Sem nome"} soundKey=${timer.soundKey || ""} custom=${timer.customSoundPath || ""}`);
    const reminderEnabled = Boolean(timer.reminderEnabled);
    const reminderRepeatCount = resolveAlertReminderRepeatCount(timer);
    const hasReminderCycle = reminderEnabled && reminderRepeatCount > 0;

    if (hasReminderCycle) {
      runtime.remindersSent = 0;
      runtime.reminderRepeatCount = reminderRepeatCount;
      runtime.reminderDelayMs = resolveAlertReminderDelayMs(timer);
      scheduleAlertTimerReminder(runtime, normalizedTimerId);
    } else {
      stopAlertTimerRuntimeInternal(normalizedTimerId);
    }

    const result = await dispatchAlertTimerSignal(timer, overlayToolsState);
    message = result.message;
    tone = result.tone;

    if (hasReminderCycle && alertTimerRuntimeById.get(normalizedTimerId) === runtime) {
      message = `${message} Proximo lembrete em ${formatOverlayTimerDuration(Math.ceil(runtime.reminderDelayMs / 1000))}.`;
    }
  } else {
    stopAlertTimerRuntimeInternal(normalizedTimerId);
  }

  await emitAlertTimerRuntimeChanged("timer-finished", {
    timerId: normalizedTimerId,
    message,
    tone
  });
}

async function handleAlertTimerReminder(timerId) {
  const normalizedTimerId = typeof timerId === "string" ? timerId.trim() : "";
  const runtime = normalizedTimerId ? alertTimerRuntimeById.get(normalizedTimerId) : null;

  if (!normalizedTimerId || !runtime || runtime.phase !== "waiting-reminder") {
    return;
  }

  const overlayToolsState = await readOverlayToolsState();
  const timer = Array.isArray(overlayToolsState?.timers?.items)
    ? overlayToolsState.timers.items.find((entry) => entry?.id === normalizedTimerId) || null
    : null;

  if (!timer) {
    stopAlertTimerRuntimeInternal(normalizedTimerId);
    await emitAlertTimerRuntimeChanged("timer-reminder-missing", {
      timerId: normalizedTimerId
    });
    return;
  }

  if (!alertTimerSignalsAllowedByTibia) {
    stopAlertTimerRuntimeInternal(normalizedTimerId);
    await emitAlertTimerRuntimeChanged("timer-reminder-expired-while-tibia-hidden", {
      timerId: normalizedTimerId,
      message: `Lembrete de "${timer.name || "Sem nome"}" venceu fora do Tibia e foi descartado.`,
      tone: "info"
    });
    return;
  }

  const reminderIndex = clampInteger(runtime.remindersSent, 0, 999, 0) + 1;
  const reminderTotal = clampInteger(runtime.reminderRepeatCount, 1, 999, 1);
  runtime.remindersSent = reminderIndex;

  const hasMoreReminders = reminderIndex < reminderTotal;
  if (hasMoreReminders) {
    scheduleAlertTimerReminder(runtime, normalizedTimerId);
  } else {
    stopAlertTimerRuntimeInternal(normalizedTimerId);
  }

  const result = await dispatchAlertTimerSignal(timer, overlayToolsState, {
    isReminder: true,
    reminderIndex,
    reminderTotal
  });

  const suffix = hasMoreReminders
    ? ` Proximo lembrete em ${formatOverlayTimerDuration(Math.ceil((runtime.reminderDelayMs || 0) / 1000))}.`
    : "";

  await emitAlertTimerRuntimeChanged("timer-reminder-fired", {
    timerId: normalizedTimerId,
    message: `${result.message}${suffix}`,
    tone: result.tone
  });
}

async function startAlertTimerRuntime(timer, _overlayToolsState = null, options = {}) {
  if (!timer?.id) {
    return {
      ok: false,
      started: false,
      snapshot: buildAlertTimerRuntimeSnapshot()
    };
  }

  const restart = Boolean(options.restart);

  if (alertTimerRuntimeById.has(timer.id) && !restart) {
    return {
      ok: true,
      started: false,
      ignored: true,
      snapshot: buildAlertTimerRuntimeSnapshot()
    };
  }

  stopAlertTimerRuntimeInternal(timer.id);

  const now = Date.now();
  const durationMs = Math.max(1000, clampInteger(timer.durationSeconds, 1, 43200, 60) * 1000);
  const runtime = {
    timerId: timer.id,
    phase: "running",
    startedAt: now,
    endsAt: now + durationMs,
    reminderDelayMs: resolveAlertReminderDelayMs(timer),
    reminderRepeatCount: resolveAlertReminderRepeatCount(timer),
    remindersSent: 0,
    timeout: setTimeout(() => {
      void completeAlertTimerRuntime(timer.id);
    }, durationMs)
  };

  alertTimerRuntimeById.set(timer.id, runtime);
  ensureAlertTimerSnapshotTicker();

  await emitAlertTimerRuntimeChanged("timer-started", {
    timerId: timer.id,
    message: options.source === "hotkey"
      ? `Hotkey detectada: "${timer.name || "Sem nome"}" iniciada.`
      : `Timer "${timer.name || "Sem nome"}" iniciado.`,
    tone: "info"
  });

  return {
    ok: true,
    started: true,
    snapshot: buildAlertTimerRuntimeSnapshot()
  };
}

async function startAlertTimerById(timerId, options = {}) {
  if (!alertTimerSignalsAllowedByTibia) {
    return {
      ok: false,
      started: false,
      snapshot: buildAlertTimerRuntimeSnapshot()
    };
  }

  const normalizedTimerId = typeof timerId === "string" ? timerId.trim() : "";
  const overlayToolsState = await readOverlayToolsState();
  const timer = Array.isArray(overlayToolsState?.timers?.items)
    ? overlayToolsState.timers.items.find((entry) => entry?.id === normalizedTimerId) || null
    : null;

  if (!timer) {
    return {
      ok: false,
      started: false,
      snapshot: buildAlertTimerRuntimeSnapshot()
    };
  }

  if (!isAlertTimerSignalEnabled(timer, overlayToolsState)) {
    return {
      ok: false,
      started: false,
      snapshot: buildAlertTimerRuntimeSnapshot()
    };
  }

  return startAlertTimerRuntime(timer, overlayToolsState, options);
}

async function handleAlertTimerHotkey(keyCode, modifiers, overlayToolsState = null) {
  if (!alertTimerSignalsAllowedByTibia) {
    return { matched: 0, started: 0 };
  }

  const state = overlayToolsState || await readOverlayToolsState();

  if (!state?.timers?.isListening && !state?.timers?.visualsEnabled) {
    return { matched: 0, started: 0 };
  }

  const matches = Array.isArray(state?.timers?.items)
    ? state.timers.items.filter((timer) => (
      isAlertTimerSignalEnabled(timer, state)
      && clampInteger(timer?.hotkeyKeyCode, 0, 255, 0) === keyCode
      && clampInteger(timer?.hotkeyModifiers, 0, 15, 0) === modifiers
    ))
    : [];

  if (matches.length === 0) {
    return { matched: 0, started: 0 };
  }

  let started = 0;

  for (const timer of matches) {
    const runtime = alertTimerRuntimeById.get(timer.id) || null;
    const isRunning = Boolean(runtime);

    if (!isRunning) {
      const result = await startAlertTimerRuntime(timer, state, {
        restart: false,
        source: "hotkey"
      });
      if (result.started) {
        started += 1;
      }
      continue;
    }

    if (runtime?.phase === "waiting-reminder") {
      const result = await startAlertTimerRuntime(timer, state, {
        restart: true,
        source: "hotkey"
      });
      if (result.started) {
        started += 1;
      }
      continue;
    }

    if (timer?.retriggerEnabled) {
      const result = await startAlertTimerRuntime(timer, state, {
        restart: true,
        source: "hotkey"
      });
      if (result.started) {
        started += 1;
      }
    }
  }

  if (matches.length === 1 && started === 0) {
    await emitAlertTimerRuntimeChanged("timer-hotkey-ignored", {
      timerId: matches[0].id,
      message: `Hotkey detectada: "${matches[0].name || "Sem nome"}" ja estava rodando.`,
      tone: "info"
    });
  } else if (matches.length > 1) {
    await emitAlertTimerRuntimeChanged("timer-hotkey-batch", {
      message: `Hotkey detectada: ${started} timer(s) disparado(s).`,
      tone: "info"
    });
  }

  return {
    matched: matches.length,
    started
  };
}

async function syncAlertTimerRuntimeState(overlayToolsState = null) {
  const state = overlayToolsState || await readOverlayToolsState();
  const listening = Boolean(state?.timers?.isListening);
  const visualsEnabled = Boolean(state?.timers?.visualsEnabled);
  const validIds = new Set(
    Array.isArray(state?.timers?.items)
      ? state.timers.items.map((timer) => String(timer?.id || "").trim()).filter(Boolean)
      : []
  );
  let changed = false;

  if (!listening && !visualsEnabled) {
    if (alertTimerRuntimeById.size > 0) {
      stopAllAlertTimerRuntimes({ emit: false });
      changed = true;
    }
  } else {
    for (const timerId of [...alertTimerRuntimeById.keys()]) {
      const timer = Array.isArray(state?.timers?.items)
        ? state.timers.items.find((entry) => String(entry?.id || "").trim() === timerId) || null
        : null;
      if (!validIds.has(timerId) || !isAlertTimerSignalEnabled(timer, state)) {
        stopAlertTimerRuntimeInternal(timerId);
        changed = true;
      }
    }
  }

  if (changed) {
    await emitAlertTimerRuntimeChanged("runtime-synced");
  }
}

function isAlertTimerSignalEnabled(timer, overlayToolsState) {
  if (!timer) {
    return false;
  }

  const audioEnabled = Boolean(
    overlayToolsState?.timers?.isListening
    && timer.enabled !== false
    && !timer.volumeMuted
    && clampInteger(timer.volumePercent, 0, 100, 100) > 0
  );

  const visualEnabled = Boolean(
    overlayToolsState?.timers?.visualsEnabled
    && timer.showVisualAlert !== false
    && timer.locked === true
  );

  return audioEnabled || visualEnabled;
}

async function emitOverlayToolsStateChanged(reason = "overlay-state-updated") {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("screen-vision:overlay-state-changed", { reason });
  }

  for (const window of screenVisionWindows.values()) {
    if (!window || window.isDestroyed()) {
      continue;
    }

    window.webContents.send("screen-vision:overlay-state-changed", { reason });
  }
}

async function emitScreenVisionProfilesChanged() {
  const items = await listScreenVisionProfiles();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("screen-vision:profiles-changed", { items });
  }

  for (const window of screenVisionWindows.values()) {
    if (!window || window.isDestroyed()) {
      continue;
    }

    window.webContents.send("screen-vision:profiles-changed", { items });
  }
}

async function prepareClosePreferenceForCurrentSession() {
  const stored = await readStorageValue(closePreferenceStorageKey);
  const preference = stored?.[closePreferenceStorageKey];
  const remainingSessions = Math.max(0, Math.round(Number(preference?.remainingSessions) || 0));
  const action = preference?.action === "tray" || preference?.action === "quit"
    ? preference.action
    : "";

  activeClosePreference = action && remainingSessions > 0 ? { action } : null;

  if (!activeClosePreference) {
    if (preference) {
      await writeStorageValue({ [closePreferenceStorageKey]: null });
    }
    return;
  }

  await writeStorageValue({
    [closePreferenceStorageKey]: {
      action,
      remainingSessions: remainingSessions - 1
    }
  });
}

function restoreMainWindowFromTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  restoreMainWindowTopmost(mainWindow);
  mainWindow.focus();
  void syncDockedToolPanelWindow({ forceShow: true, animateSideChange: false });
}

function ensureAppTray() {
  const trayIcon = nativeImage.createFromPath(appIconPath);
  const openIcon = nativeImage.createFromPath(appIconPath).resize({ width: 16, height: 16 });
  const closeIcon = nativeImage
    .createFromPath(resolveRuntimeFilePath("assets/ui/Cross.png") || appIconPath)
    .resize({ width: 16, height: 16 });

  if (!tray || tray.isDestroyed()) {
    tray = new Tray(trayIcon);
    tray.on("click", restoreMainWindowFromTray);
  }

  tray.setToolTip("Tibia Toolkit");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: tr("common.open"),
      icon: openIcon,
      click: restoreMainWindowFromTray
    },
    {
      label: tr("common.close"),
      icon: closeIcon,
      click: () => {
        appIsQuitting = true;
        app.quit();
      }
    }
  ]));

  return tray;
}

async function performMainWindowCloseChoice(action, rememberChoice = false) {
  const normalizedAction = action === "quit" ? "quit" : "tray";

  if (rememberChoice) {
    await writeStorageValue({
      [closePreferenceStorageKey]: {
        action: normalizedAction,
        remainingSessions: 10
      }
    });
  }

  if (normalizedAction === "quit") {
    appIsQuitting = true;
    app.quit();
    return;
  }

  ensureAppTray();
  mainWindow?.hide();
}

function buildAppCloseChoiceDialogHtml() {
  const minimizeIdleUrl = readDialogAssetDataUrl(path.join("assets", "ui", "desktop-minimize-idle.png"));
  const minimizeActiveUrl = readDialogAssetDataUrl(path.join("assets", "ui", "desktop-minimize-active.png"));
  const closeIdleUrl = readDialogAssetDataUrl(path.join("assets", "ui", "desktop-close-idle.png"));
  const closeActiveUrl = readDialogAssetDataUrl(path.join("assets", "ui", "desktop-close-active.png"));
  const checkboxIconUrl = readDialogAssetDataUrl(path.join("assets", "ui", "Tick.png"));
  const dialogTitle = escapeDialogHtml(tr("dialog.closeApp.title"));
  const dialogMessage = escapeDialogHtml(tr("dialog.closeApp.message"));
  const minimizeLabel = escapeDialogHtml(tr("common.minimize"));
  const closeLabel = escapeDialogHtml(tr("common.close"));
  const rememberLabel = escapeDialogHtml(tr("dialog.closeApp.remember"));

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${dialogTitle}</title>
        <style>
          :root { color-scheme: dark; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: visible;
            background: transparent;
            color: #f7f9fc;
            font-family: "Nunito", "Segoe UI", Tahoma, sans-serif;
          }
          body {
            display: grid;
            place-items: center;
            padding: 24px;
            -webkit-app-region: drag;
          }
          .dialog-card {
            width: 100%;
            border: 1px solid rgba(88, 196, 112, 0.72);
            border-radius: 12px;
            padding: 22px 24px 18px;
            background: #1e232d;
            box-shadow: none;
            opacity: 0;
            transform: translateY(5px) scale(0.985);
            animation: dialog-in 160ms ease-out forwards;
          }
          h1 {
            margin: 0 0 8px;
            font-size: 18px;
            line-height: 1.2;
            text-align: center;
          }
          p {
            margin: 0 0 18px;
            color: rgba(247, 249, 252, 0.88);
            font-size: 14px;
            line-height: 1.45;
            text-align: center;
          }
          .actions {
            display: flex;
            justify-content: center;
            gap: 14px;
            margin-bottom: 16px;
            -webkit-app-region: no-drag;
          }
          .choice {
            position: relative;
            display: grid;
            place-items: center;
            width: 112px;
            height: 62px;
            padding: 0;
            border: 0;
            background: transparent;
            cursor: pointer;
            transition: transform 100ms ease, filter 100ms ease;
          }
          .choice:hover, .choice:focus-visible {
            transform: translateY(-2px);
            filter: brightness(1.08);
            outline: none;
          }
          .choice:active { transform: translateY(1px) scale(0.97); }
          .icon-stack {
            position: relative;
            display: block;
            width: 54px;
            height: 54px;
          }
          .icon-stack img {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
            image-rendering: pixelated;
            transition: opacity 100ms ease;
            pointer-events: none;
          }
          .icon-active { opacity: 0; }
          .choice:hover .icon-idle, .choice:focus-visible .icon-idle { opacity: 0; }
          .choice:hover .icon-active, .choice:focus-visible .icon-active { opacity: 1; }
          .remember {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: rgba(247, 249, 252, 0.84);
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            user-select: none;
            -webkit-app-region: no-drag;
          }
          .remember input {
            position: absolute;
            width: 1px;
            height: 1px;
            clip-path: inset(50%);
          }
          .check {
            display: grid;
            place-items: center;
            width: 20px;
            height: 20px;
            border: 1px solid rgba(235, 241, 250, 0.22);
            border-radius: 2px;
            background: rgba(255, 255, 255, 0.02);
          }
          .check img {
            width: 20px;
            height: 20px;
            object-fit: contain;
            image-rendering: pixelated;
            opacity: 0.25;
            filter: grayscale(1);
          }
          .remember input:checked + .check img {
            opacity: 1;
            filter: none;
          }
          .tooltip {
            position: fixed;
            z-index: 10;
            display: none;
            padding: 6px 9px;
            border: 1px solid rgba(88, 196, 112, 0.36);
            border-radius: 6px;
            background: #242b37;
            color: #fff;
            font-size: 12px;
            font-weight: 700;
            pointer-events: none;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.42);
          }
          @keyframes dialog-in {
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        </style>
      </head>
      <body>
        <main class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <h1 id="dialog-title">${dialogTitle}</h1>
          <p>${dialogMessage}</p>
          <div class="actions">
            <button class="choice" type="button" data-action="tray" data-tooltip="${minimizeLabel}" aria-label="${minimizeLabel}">
              <span class="icon-stack">
                <img class="icon-idle" src="${minimizeIdleUrl}" alt="">
                <img class="icon-active" src="${minimizeActiveUrl}" alt="">
              </span>
            </button>
            <button class="choice" type="button" data-action="quit" data-tooltip="${closeLabel}" aria-label="${closeLabel}">
              <span class="icon-stack">
                <img class="icon-idle" src="${closeIdleUrl}" alt="">
                <img class="icon-active" src="${closeActiveUrl}" alt="">
              </span>
            </button>
          </div>
          <label class="remember">
            <input id="remember-choice" type="checkbox">
            <span class="check"><img src="${checkboxIconUrl}" alt=""></span>
            <span>${rememberLabel}</span>
          </label>
        </main>
        <div id="tooltip" class="tooltip"></div>
        <script>
          const remember = document.getElementById("remember-choice");
          const tooltip = document.getElementById("tooltip");
          const submit = (action) => {
            window.screenVisionConfirmDialog?.submit?.(action, "", Boolean(remember?.checked));
          };
          document.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action]");
            if (button) submit(button.dataset.action);
          });
          document.addEventListener("pointerover", (event) => {
            const target = event.target.closest("[data-tooltip]");
            if (!target) return;
            const bounds = target.getBoundingClientRect();
            tooltip.textContent = target.dataset.tooltip || "";
            tooltip.style.display = "block";
            tooltip.style.left = Math.round(bounds.left + bounds.width / 2 - tooltip.offsetWidth / 2) + "px";
            tooltip.style.top = Math.round(bounds.bottom + 4) + "px";
          });
          document.addEventListener("pointerout", (event) => {
            if (event.target.closest("[data-tooltip]")) tooltip.style.display = "none";
          });
          window.addEventListener("keydown", (event) => {
            if (event.key === "Escape") submit("cancel");
          });
        </script>
      </body>
    </html>
  `;
}

async function showAppCloseChoiceDialog() {
  if (!mainWindow || mainWindow.isDestroyed() || closeChoiceDialogOpen) {
    return "";
  }

  closeChoiceDialogOpen = true;
  const dialogId = crypto.randomUUID();
  const width = 430;
  const height = 286;
  const parentBounds = mainWindow.getBounds();
  const dialogWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(parentBounds.x + ((parentBounds.width - width) / 2)),
    y: Math.round(parentBounds.y + ((parentBounds.height - height) / 2)),
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    transparent: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    parent: mainWindow,
    modal: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(projectRoot, "desktop", "screen-vision", "confirm-dialog-preload.cjs"),
      contextIsolation: true,
      sandbox: false,
      additionalArguments: [`--screenvision-confirm-dialog-id=${dialogId}`]
    }
  });

  const htmlPath = path.join(app.getPath("temp"), `tibia-toolkit-close-${dialogId}.html`);
  await fs.writeFile(htmlPath, buildAppCloseChoiceDialogHtml(), "utf8");

  return await new Promise(async (resolve) => {
    let settled = false;
    const finish = (payload = {}) => {
      if (settled) return;
      settled = true;
      screenVisionConfirmDialogResolvers.delete(dialogId);
      resolve({
        action: payload.action || "cancel",
        rememberChoice: Boolean(payload.checked)
      });
      if (!dialogWindow.isDestroyed()) dialogWindow.close();
    };

    screenVisionConfirmDialogResolvers.set(dialogId, finish);
    dialogWindow.on("closed", () => {
      void fs.rm(htmlPath, { force: true }).catch(() => {});
      closeChoiceDialogOpen = false;
      if (!settled) {
        settled = true;
        screenVisionConfirmDialogResolvers.delete(dialogId);
        resolve({ action: "cancel", rememberChoice: false });
      }
    });
    dialogWindow.once("ready-to-show", () => {
      dialogWindow.show();
      dialogWindow.focus();
    });
    await dialogWindow.loadFile(htmlPath);
  });
}

async function requestMainWindowClose() {
  if (appIsQuitting || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (activeClosePreference?.action) {
    await performMainWindowCloseChoice(activeClosePreference.action, false);
    return;
  }

  const result = await showAppCloseChoiceDialog();
  if (result.action === "tray" || result.action === "quit") {
    await performMainWindowCloseChoice(result.action, result.rememberChoice);
  }
}

function escapeDialogHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readDialogAssetDataUrl(relativePath) {
  try {
    const assetPath = resolveRuntimeFilePath(relativePath);
    if (!fsSync.existsSync(assetPath)) {
      return "";
    }
    const buffer = fsSync.readFileSync(assetPath);
    const ext = path.extname(assetPath).toLowerCase();
    const mimeType =
      ext === ".png" ? "image/png"
      : ext === ".gif" ? "image/gif"
      : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
      : ext === ".svg" ? "image/svg+xml"
      : "application/octet-stream";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

function buildScreenVisionConfirmDialogHtml(options = {}) {
  const title = escapeDialogHtml(options.title || tr("dialog.confirm"));
  const message = escapeDialogHtml(options.message || "");
  const confirmLabel = escapeDialogHtml(options.confirmLabel || tr("dialog.confirm"));
  const cancelLabel = escapeDialogHtml(options.cancelLabel || tr("dialog.cancel"));
  const requestedTone = String(options.tone || "danger").trim().toLowerCase();
  const tone = ["warning", "success"].includes(requestedTone) ? requestedTone : "danger";
  const flat = options.flat === true;
  const autoHeight = options.autoHeight === true;
  const passive = options.passive === true;
  const hideCancel = passive || options.hideCancel === true;
  const hideActions = passive || options.hideActions === true;
  const showProgress = options.showProgress === true;
  const initialProgress = Math.max(0, Math.min(100, Number(options.progress) || 0));
  const mediaWidth = Math.max(180, Math.min(320, Number(options.mediaWidth) || 208));
  const confirmTooltip = escapeDialogHtml(options.confirmTooltip || confirmLabel);
  const cancelTooltip = escapeDialogHtml(options.cancelTooltip || cancelLabel);
  const checkboxIconUrl = readDialogAssetDataUrl(path.join("assets", "ui", "Tick.png"));
  const confirmIconUrl = readDialogAssetDataUrl(path.join("assets", "ui", "Tick.png"));
  const cancelIconUrl = readDialogAssetDataUrl(path.join("assets", "ui", "Cross.png"));
  const mediaPath = typeof options.mediaPath === "string" && options.mediaPath.trim()
    ? options.mediaPath.trim()
    : tone === "warning"
      ? path.join("assets", "ui", "tools", "tibia-eye", "states", "atencao.gif")
      : path.join("assets", "ui", "tools", "tibia-eye", "states", "cuidado.gif");
  const warningGifUrl = readDialogAssetDataUrl(mediaPath);
  const checkboxLabel = typeof options.checkboxLabel === "string" && options.checkboxLabel.trim()
    ? escapeDialogHtml(options.checkboxLabel.trim())
    : "";
  const accentText = tone === "success" ? "#83f29b" : tone === "warning" ? "#ffd15f" : "#ff7d7d";
  const borderColor = tone === "success" ? "#3f9f5b" : tone === "warning" ? "#d6a63d" : "#c74949";
  const accentButtonHover = tone === "success" ? "rgba(24, 105, 51, 0.78)" : tone === "warning" ? "rgba(118, 85, 17, 0.8)" : "rgba(120, 23, 23, 0.76)";
  const accentBorder = tone === "success" ? "rgba(88, 196, 112, 0.82)" : tone === "warning" ? "rgba(214, 166, 61, 0.82)" : "rgba(239, 87, 87, 0.8)";
  const accentBorderHover = tone === "success" ? "rgba(120, 232, 145, 0.94)" : tone === "warning" ? "rgba(214, 166, 61, 0.94)" : "rgba(239, 87, 87, 0.92)";
  const accentHoverText = tone === "success" ? "#e0ffe7" : tone === "warning" ? "#fff1c6" : "#ffd9d9";
  const warningMarkup = warningGifUrl
    ? `<img class="dialog-warning-media" src="${warningGifUrl}" alt="" aria-hidden="true">`
    : "";
  const checkboxMarkup = checkboxLabel
    ? `
          <label class="dialog-check">
            <input id="dialog-check" class="dialog-check-input" type="checkbox">
            <span class="dialog-check-visual" aria-hidden="true">
              <img src="${checkboxIconUrl}" alt="">
            </span>
            <span class="dialog-check-text">${checkboxLabel}</span>
          </label>
    `
    : "";
  const progressMarkup = showProgress
    ? `<div class="dialog-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${initialProgress}"><span style="width:${initialProgress}%"></span></div>`
    : "";

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title}</title>
        <style>
          :root {
            color-scheme: dark;
            --bg: #1e232d;
            --border: ${borderColor};
            --text: #ffffff;
            --muted: rgba(255, 255, 255, 0.9);
            --button-border: rgba(255, 255, 255, 0.16);
            --button-hover: rgba(255, 255, 255, 0.09);
            --accent: ${accentText};
            --accent-hover: ${accentButtonHover};
            --media-width: ${mediaWidth}px;
          }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            color: var(--text);
            overflow: visible;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          }
          body {
            display: grid;
            place-items: center;
            padding: 28px;
            -webkit-app-region: drag;
          }
          .dialog-card {
            position: relative;
            width: 100%;
            max-width: 380px;
            border-radius: 16px;
            border: 2px solid var(--border);
            background: var(--bg);
            padding: 22px 24px 20px;
            box-shadow: ${flat ? "none" : `
              0 0 0 1px rgba(199, 73, 73, 0.18),
              0 0 24px rgba(199, 73, 73, 0.26),
              0 0 40px rgba(199, 73, 73, 0.14),
              0 20px 42px rgba(0, 0, 0, 0.68)`};
            opacity: 0;
            transform: translateY(6px) scale(0.985);
            animation: ${flat ? "dialog-in 180ms ease-out forwards" : "dialog-in 180ms ease-out forwards, dialog-danger-breathe 2200ms ease-in-out infinite 180ms"};
          }
          .dialog-title {
            margin: 0 0 6px;
            color: var(--accent);
            font-size: 18px;
            line-height: 1.2;
            font-weight: 800;
            text-align: center;
          }
          .dialog-message {
            margin: 0 0 10px;
            color: var(--muted);
            font-size: 14px;
            line-height: 1.45;
            text-align: center;
            white-space: pre-wrap;
          }
          .dialog-check {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin: 0 0 8px;
            color: var(--muted);
            font-size: 12px;
            font-weight: 800;
            -webkit-app-region: no-drag;
            user-select: none;
            cursor: pointer;
          }
          .dialog-check-input {
            position: absolute;
            width: 1px;
            height: 1px;
            margin: -1px;
            padding: 0;
            border: 0;
            overflow: hidden;
            clip: rect(0 0 0 0);
            clip-path: inset(50%);
            white-space: nowrap;
          }
          .dialog-check-visual {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            flex: 0 0 20px;
            border-radius: 2px;
            border: 1px solid rgba(235, 241, 250, 0.18);
            background: rgba(255, 255, 255, 0.02);
            box-shadow: inset 0 0 0 1px rgba(10, 15, 22, 0.18);
          }
          .dialog-check-visual img {
            display: block;
            width: 20px;
            height: 20px;
            object-fit: contain;
            image-rendering: pixelated;
            opacity: 0.28;
            filter: grayscale(1) brightness(0.82);
            transition: opacity 120ms ease, filter 120ms ease;
          }
          .dialog-check-input:checked + .dialog-check-visual img {
            opacity: 1;
            filter: none;
          }
          .dialog-check-input:checked + .dialog-check-visual {
            box-shadow: none;
          }
          .dialog-check-input:focus-visible + .dialog-check-visual {
            outline: 1px solid rgba(255, 255, 255, 0.28);
            outline-offset: 2px;
            border-radius: 6px;
          }
          .dialog-check-text {
            line-height: 1.3;
          }
          .dialog-progress {
            width: 100%;
            height: 5px;
            margin: 4px 0 12px;
            overflow: hidden;
            border-radius: 3px;
            background: rgba(119, 134, 157, 0.42);
          }
          .dialog-progress span {
            display: block;
            width: 0;
            height: 100%;
            border-radius: inherit;
            background: #58c470;
            transition: width 160ms ease-out;
          }
          .dialog-warning-media {
            display: block;
             width: min(var(--media-width), 100%);
            height: auto;
            margin: 0 auto 10px;
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 8px;
            object-fit: contain;
            image-rendering: pixelated;
          }
          .dialog-actions {
            display: flex;
            justify-content: center;
            gap: 10px;
            -webkit-app-region: no-drag;
          }
          .dialog-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 104px;
            height: 40px;
            padding: 0 10px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 7px;
            background:
              linear-gradient(145deg, rgba(52, 59, 72, 0.16), rgba(34, 40, 50, 0.08)),
              repeating-linear-gradient(135deg, rgba(125, 147, 184, 0.06) 0 4px, transparent 4px 10px);
            color: var(--text);
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: transform 120ms ease, background 120ms ease, border-color 120ms ease, color 120ms ease, filter 120ms ease;
          }
          .dialog-button:hover,
          .dialog-button:focus-visible {
            background:
              linear-gradient(145deg, rgba(52, 59, 72, 0.22), rgba(34, 40, 50, 0.12)),
              repeating-linear-gradient(135deg, rgba(125, 147, 184, 0.08) 0 4px, transparent 4px 10px);
            border-color: rgba(255, 255, 255, 0.18);
            transform: translateY(-1px);
            outline: none;
          }
           .dialog-button img {
            width: 24px;
            height: 24px;
            object-fit: contain;
            image-rendering: pixelated;
            pointer-events: none;
           }
           .dialog-tooltip {
             position: fixed;
             z-index: 10;
             display: none;
             max-width: 220px;
             padding: 6px 9px;
             border: 1px solid rgba(88, 196, 112, 0.75);
             border-radius: 5px;
             background: #202733;
             color: #f4f8ff;
             font-size: 12px;
             font-weight: 800;
             pointer-events: none;
             -webkit-app-region: no-drag;
           }
          .dialog-button.primary {
            border-color: ${accentBorder};
            background:
              linear-gradient(145deg, rgba(52, 59, 72, 0.16), rgba(34, 40, 50, 0.08)),
              repeating-linear-gradient(135deg, rgba(125, 147, 184, 0.06) 0 4px, transparent 4px 10px);
            color: var(--accent);
          }
          .dialog-button.primary:hover,
          .dialog-button.primary:focus-visible {
            background:
              linear-gradient(145deg, rgba(52, 59, 72, 0.22), rgba(34, 40, 50, 0.12)),
              repeating-linear-gradient(135deg, rgba(125, 147, 184, 0.08) 0 4px, transparent 4px 10px);
            border-color: ${accentBorderHover};
            color: var(--accent);
          }
          @keyframes dialog-danger-breathe {
            0%, 100% {
              box-shadow:
                0 0 0 1px rgba(199, 73, 73, 0.16),
                0 0 16px rgba(199, 73, 73, 0.16),
                0 0 28px rgba(199, 73, 73, 0.1),
                0 20px 42px rgba(0, 0, 0, 0.68);
            }
            50% {
              box-shadow:
                0 0 0 1px rgba(199, 73, 73, 0.34),
                0 0 30px rgba(199, 73, 73, 0.42),
                0 0 56px rgba(199, 73, 73, 0.24),
                0 20px 42px rgba(0, 0, 0, 0.68);
            }
          }
          @keyframes dialog-in {
            from {
              opacity: 0;
              transform: translateY(6px) scale(0.985);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        </style>
      </head>
      <body>
        <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <h1 class="dialog-title" id="dialog-title">${title}</h1>
          ${warningMarkup}
          <p class="dialog-message">${message}</p>
          ${progressMarkup}
          ${checkboxMarkup}
          ${hideActions ? "" : `<div class="dialog-actions">
            ${hideCancel ? "" : `<button type="button" class="dialog-button" data-action="cancel" data-tooltip="${cancelTooltip}"><img src="${cancelIconUrl}" alt=""></button>`}
            <button type="button" class="dialog-button primary" data-action="confirm" data-tooltip="${confirmTooltip}">
              <img src="${confirmIconUrl}" alt="">
            </button>
          </div>`}
        </div>
        <div id="dialog-tooltip" class="dialog-tooltip"></div>
        <script>
          const checkbox = document.getElementById("dialog-check");
          const tooltip = document.getElementById("dialog-tooltip");
          const submit = (action) => {
            if (window.screenVisionConfirmDialog && typeof window.screenVisionConfirmDialog.submit === "function") {
              window.screenVisionConfirmDialog.submit(action, "", checkbox ? checkbox.checked : false);
            }
          };
          document.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action]");
            if (!button) return;
            submit(button.dataset.action || "cancel");
          });
          document.addEventListener("pointerover", (event) => {
            const target = event.target.closest("[data-tooltip]");
            if (!target || !tooltip) return;
            const bounds = target.getBoundingClientRect();
            tooltip.textContent = target.dataset.tooltip || "";
            tooltip.style.display = "block";
            tooltip.style.left = Math.round(bounds.left + bounds.width / 2 - tooltip.offsetWidth / 2) + "px";
            tooltip.style.top = Math.round(bounds.top - tooltip.offsetHeight - 6) + "px";
          });
          document.addEventListener("pointerout", (event) => {
            if (event.target.closest("[data-tooltip]") && tooltip) tooltip.style.display = "none";
          });
          ${passive ? "" : `window.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              submit("cancel");
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              submit("confirm");
            }
          });`}
          window.screenVisionConfirmDialog?.onUpdate?.((payload = {}) => {
            const messageElement = document.querySelector(".dialog-message");
            if (messageElement && typeof payload.message === "string") {
              messageElement.textContent = payload.message;
            }
            const progressElement = document.querySelector(".dialog-progress");
            const progressFill = progressElement?.querySelector("span");
            if (progressElement && progressFill && Number.isFinite(Number(payload.progress))) {
              const progress = Math.max(0, Math.min(100, Number(payload.progress)));
              progressElement.setAttribute("aria-valuenow", String(Math.round(progress)));
              progressFill.style.width = progress + "%";
            }
          });
          ${autoHeight ? `const resizeToContent = () => {
            const card = document.querySelector(".dialog-card");
            if (!card || !window.screenVisionConfirmDialog?.resizeToContent) return;
            const bodyPadding = Number.parseFloat(getComputedStyle(document.body).paddingTop) || 0;
            window.screenVisionConfirmDialog.resizeToContent(Math.ceil(card.scrollHeight + (bodyPadding * 2)));
          };
          window.addEventListener("load", () => requestAnimationFrame(() => requestAnimationFrame(resizeToContent)));
          document.querySelector(".dialog-warning-media")?.addEventListener("load", resizeToContent);` : ""}
        </script>
      </body>
    </html>
  `;
}

function buildScreenVisionPromptDialogHtml(options = {}) {
  const title = escapeDialogHtml(options.title || tr("common.edit"));
  const message = escapeDialogHtml(options.message || "");
  const confirmLabel = escapeDialogHtml(options.confirmLabel || tr("dialog.save"));
  const cancelLabel = escapeDialogHtml(options.cancelLabel || tr("dialog.cancel"));
  const inputValue = escapeDialogHtml(options.inputValue || "");
  const placeholder = escapeDialogHtml(options.placeholder || "");
  const maxLength = Number.isFinite(Number(options.maxLength)) ? Math.max(1, Math.min(200, Number(options.maxLength))) : 80;
  const inputType = options.inputType === "password" ? "password" : "text";
  const checkboxLabel = typeof options.checkboxLabel === "string" ? escapeDialogHtml(options.checkboxLabel.trim()) : "";
  const checkboxChecked = options.checkboxChecked === true ? " checked" : "";
  const flat = options.flat === true;
  const checkboxIconUrl = readDialogAssetDataUrl(path.join("assets", "ui", "Tick.png"));
  const confirmIconUrl = readDialogAssetDataUrl(path.join("assets", "ui", "Tick.png"));
  const cancelIconUrl = readDialogAssetDataUrl(path.join("assets", "ui", "Cross.png"));
  const mediaPath = typeof options.mediaPath === "string" && options.mediaPath.trim() ? options.mediaPath.trim() : "";
  const mediaFilePath = resolveRuntimeFilePath(mediaPath);
  const mediaUrl = mediaFilePath && fsSync.existsSync(mediaFilePath)
    ? pathToFileURL(mediaFilePath).href
    : "";
  const mediaMarkup = mediaUrl
    ? `<img class="dialog-prompt-media" src="${mediaUrl}" alt="" aria-hidden="true">`
    : "";
  const checkboxMarkup = checkboxLabel
    ? `<label class="dialog-check"><input id="dialog-check" class="dialog-check-input" type="checkbox"${checkboxChecked}><span class="dialog-check-visual" aria-hidden="true"><img src="${checkboxIconUrl}" alt=""></span><span>${checkboxLabel}</span></label>`
    : "";

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title}</title>
        <style>
          :root {
            color-scheme: dark;
            --bg: #1e232d;
            --border: #58c470;
            --text: #ffffff;
            --muted: rgba(255, 255, 255, 0.88);
            --field: #2d3340;
            --field-border: rgba(255, 255, 255, 0.12);
            --button: #2d3340;
            --button-border: rgba(255, 255, 255, 0.12);
            --button-hover: #353c4b;
            --accent: #58c470;
            --accent-hover: #6edf86;
          }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            color: var(--text);
            overflow: visible;
            font-family: "Nunito", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          }
          body {
            display: grid;
            place-items: center;
            padding: 14px;
            -webkit-app-region: drag;
          }
          .dialog-card {
            width: 100%;
            max-width: 452px;
            border-radius: 16px;
            border: 2px solid var(--border);
            background: var(--bg);
            padding: 20px 24px 18px;
            max-height: calc(100vh - 28px);
            overflow-y: auto;
            scrollbar-width: none;
            box-shadow: ${flat ? "none" : "0 0 24px rgba(26, 118, 57, 0.32), 0 20px 42px rgba(0, 0, 0, 0.68)"};
            opacity: 0;
            transform: translateY(6px) scale(0.985);
            animation: dialog-in 180ms ease-out forwards;
          }
          .dialog-card::-webkit-scrollbar { width: 0; height: 0; }
          .dialog-title {
            margin: 0 0 8px;
            color: var(--accent);
            font-size: 18px;
            line-height: 1.2;
            font-weight: 800;
            text-align: center;
          }
          .dialog-message {
            margin: 0 0 12px;
            color: var(--muted);
            font-size: 14px;
            line-height: 22px;
            text-align: center;
            white-space: pre-wrap;
          }
          .dialog-input {
            width: 100%;
            height: 40px;
            margin-bottom: 12px;
            border-radius: 7px;
            border: 1px solid var(--field-border);
            background: var(--field);
            color: var(--text);
            padding: 0 14px;
            font-size: 15px;
            font-weight: 700;
            outline: none;
            -webkit-app-region: no-drag;
          }
          .dialog-input:focus {
            border-color: rgba(88, 196, 112, 0.66);
            box-shadow: 0 0 0 1px rgba(88, 196, 112, 0.22);
          }
          .dialog-prompt-media {
            display: block;
            width: 100%;
            max-height: min(270px, 38vh);
            margin: 0 auto 10px;
            object-fit: contain;
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 5px;
            background: #10131a;
          }
          .dialog-check {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin: 0 0 12px;
            color: var(--muted);
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            user-select: none;
            -webkit-app-region: no-drag;
          }
          .dialog-check-input {
            position: absolute;
            width: 1px;
            height: 1px;
            margin: -1px;
            clip: rect(0 0 0 0);
            clip-path: inset(50%);
            overflow: hidden;
          }
          .dialog-check-visual {
            display: inline-flex;
            width: 20px;
            height: 20px;
            align-items: center;
            justify-content: center;
            flex: 0 0 20px;
            border: 1px solid rgba(235, 241, 250, 0.18);
            border-radius: 2px;
          }
          .dialog-check-visual img {
            width: 20px;
            height: 20px;
            opacity: .28;
            filter: grayscale(1) brightness(.82);
          }
          .dialog-check-input:checked + .dialog-check-visual img { opacity: 1; filter: none; }
          .dialog-actions {
            display: flex;
            justify-content: center;
            gap: 12px;
            -webkit-app-region: no-drag;
          }
          .dialog-button {
            display: inline-flex;
            width: 104px;
            height: 40px;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--button-border);
            border-radius: 7px;
            background: linear-gradient(145deg, rgba(52, 59, 72, .16), rgba(34, 40, 50, .08)), repeating-linear-gradient(135deg, rgba(125, 147, 184, .06) 0 4px, transparent 4px 10px);
            color: var(--text);
            font-size: 15px;
            font-weight: 800;
            cursor: pointer;
            transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
          }
          .dialog-button:hover,
          .dialog-button:focus-visible {
            background: linear-gradient(145deg, rgba(52, 59, 72, .22), rgba(34, 40, 50, .12)), repeating-linear-gradient(135deg, rgba(125, 147, 184, .08) 0 4px, transparent 4px 10px);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
            outline: none;
          }
          .dialog-button:active {
            transform: translateY(0);
          }
          .dialog-button.primary {
            border-color: rgba(88, 196, 112, 0.82);
            color: var(--accent);
          }
          .dialog-button img { width: 25px; height: 25px; object-fit: contain; image-rendering: pixelated; pointer-events: none; }
          @keyframes dialog-in {
            from {
              opacity: 0;
              transform: translateY(6px) scale(0.985);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        </style>
      </head>
      <body>
        <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <h1 class="dialog-title" id="dialog-title">${title}</h1>
          ${mediaMarkup}
          <p class="dialog-message">${message}</p>
          <input id="dialog-input" class="dialog-input" type="${inputType}" value="${inputValue}" placeholder="${placeholder}" maxlength="${maxLength}">
          ${checkboxMarkup}
          <div class="dialog-actions">
            <button type="button" class="dialog-button" data-action="cancel" aria-label="${cancelLabel}"><img src="${cancelIconUrl}" alt=""></button>
            <button type="button" class="dialog-button primary" data-action="confirm" aria-label="${confirmLabel}"><img src="${confirmIconUrl}" alt=""></button>
          </div>
        </div>
        <script>
          const input = document.getElementById("dialog-input");
          const checkbox = document.getElementById("dialog-check");
          const submit = (action) => {
            if (window.screenVisionConfirmDialog && typeof window.screenVisionConfirmDialog.submit === "function") {
              window.screenVisionConfirmDialog.submit(action, input ? input.value : "", Boolean(checkbox?.checked));
            }
          };
          document.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action]");
            if (!button) return;
            submit(button.dataset.action || "cancel");
          });
          window.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              submit("cancel");
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              submit("confirm");
            }
          });
          window.addEventListener("load", () => {
            const resizeToContent = () => {
              const card = document.querySelector(".dialog-card");
              if (card && window.screenVisionConfirmDialog?.resizeToContent) {
                const bodyPadding = Number.parseFloat(getComputedStyle(document.body).paddingTop) || 0;
                window.screenVisionConfirmDialog.resizeToContent(Math.ceil(card.scrollHeight + (bodyPadding * 2)));
              }
            };
            requestAnimationFrame(() => requestAnimationFrame(resizeToContent));
            document.querySelector(".dialog-prompt-media")?.addEventListener("load", resizeToContent);
            if (input) {
              input.focus();
              input.select();
            }
          });
        </script>
      </body>
    </html>
  `;
}

function getConfirmDialogBounds({
  parentBounds,
  workArea,
  width,
  height,
  external = false,
  centerOnDisplay = false
}) {
  const gap = 14;
  const clampX = (value) => Math.max(workArea.x, Math.min(value, workArea.x + workArea.width - width));
  const clampY = (value) => Math.max(workArea.y, Math.min(value, workArea.y + workArea.height - height));

  if (centerOnDisplay) {
    return {
      x: workArea.x + Math.round((workArea.width - width) / 2),
      y: workArea.y + Math.round((workArea.height - height) / 2),
      width,
      height
    };
  }

  if (!parentBounds) {
    return {
      x: workArea.x + Math.round((workArea.width - width) / 2),
      y: workArea.y + Math.round((workArea.height - height) / 2),
      width,
      height
    };
  }

  const centeredY = clampY(parentBounds.y + Math.round((parentBounds.height - height) / 2));
  if (external) {
    const rightX = parentBounds.x + parentBounds.width + gap;
    if (rightX + width <= workArea.x + workArea.width) {
      return { x: rightX, y: centeredY, width, height };
    }

    const leftX = parentBounds.x - width - gap;
    if (leftX >= workArea.x) {
      return { x: leftX, y: centeredY, width, height };
    }
  }

  return {
    x: clampX(parentBounds.x + Math.round((parentBounds.width - width) / 2)),
    y: centeredY,
    width,
    height
  };
}

async function showScreenVisionConfirmDialog(ownerWindow, options = {}) {
  const sessionKey = typeof options.sessionKey === "string" ? options.sessionKey.trim() : "";

  if (sessionKey && screenVisionSessionConfirmSkips.get(sessionKey) === true) {
    return {
      confirmed: true,
      rememberChoice: true,
      skipped: true
    };
  }

  const dialogId = crypto.randomUUID();
  const parentWindow = ownerWindow && !ownerWindow.isDestroyed() ? ownerWindow : mainWindow;
  const requestedWidth = Number(options.width) || 456;
  const requestedTone = String(options.tone || "danger").trim().toLowerCase();
  const tone = ["warning", "success"].includes(requestedTone) ? requestedTone : "danger";
  const hasMedia = Boolean(
    (typeof options.mediaPath === "string" && options.mediaPath.trim())
    || tone === "warning"
    || tone === "danger"
    || tone === "success"
  );
  const requestedHeight = options.height || (options.checkboxLabel
    ? (hasMedia ? 406 : 338)
    : (hasMedia ? 322 : 252));
  const parentBounds = parentWindow && !parentWindow.isDestroyed() ? parentWindow.getBounds() : null;
  const parentDisplay = parentBounds ? screen.getDisplayMatching(parentBounds) : screen.getPrimaryDisplay();
  const availableWidth = Math.max(320, parentDisplay.workArea.width - 24);
  const availableHeight = Math.max(240, parentDisplay.workArea.height - 24);
  const width = Math.min(Math.max(320, requestedWidth), availableWidth);
  const height = Math.min(Math.max(240, requestedHeight), availableHeight);
  const external = options.external === true;
  const centerOnDisplay = options.centerOnDisplay === true;
  const role = typeof options.dialogRole === "string" ? options.dialogRole.trim() : "";
  const initialBounds = getConfirmDialogBounds({
    parentBounds,
    workArea: parentDisplay.workArea,
    width,
    height,
    external,
    centerOnDisplay
  });
  const dialogWindow = new BrowserWindow({
    ...initialBounds,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    movable: true,
    frame: false,
    transparent: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    parent: parentWindow && !parentWindow.isDestroyed() ? parentWindow : undefined,
    modal: Boolean(parentWindow && !parentWindow.isDestroyed()),
    webPreferences: {
      preload: path.join(projectRoot, "desktop", "screen-vision", "confirm-dialog-preload.cjs"),
      contextIsolation: true,
      sandbox: false,
      additionalArguments: [`--screenvision-confirm-dialog-id=${dialogId}`]
    }
  });

  dialogWindow.removeMenu();
  dialogWindow.setMenuBarVisibility(false);
  dialogWindow.setAlwaysOnTop(true, "screen-saver");
  screenVisionConfirmDialogWindows.set(dialogId, {
    window: dialogWindow,
    parentBounds,
    external,
    centerOnDisplay,
    role
  });

  const html = buildScreenVisionConfirmDialogHtml(options);
  const dialogHtmlPath = path.join(app.getPath("temp"), `poioso-screenvision-confirm-${dialogId}.html`);
  await fs.writeFile(dialogHtmlPath, html, "utf8");

  return await new Promise(async (resolve) => {
    let settled = false;

    const finish = (payload) => {
      if (settled) {
        return;
      }

      settled = true;
      screenVisionConfirmDialogResolvers.delete(dialogId);
      screenVisionConfirmDialogWindows.delete(dialogId);
      const confirmed = (payload?.action || "cancel") === "confirm";
      const rememberChoice = Boolean(payload?.checked);

      if (confirmed && rememberChoice && sessionKey) {
        screenVisionSessionConfirmSkips.set(sessionKey, true);
      }

      resolve({
        confirmed,
        rememberChoice,
        skipped: false
      });

      if (!dialogWindow.isDestroyed()) {
        dialogWindow.close();
      }
    };

    screenVisionConfirmDialogResolvers.set(dialogId, finish);

    dialogWindow.on("closed", () => {
      void fs.rm(dialogHtmlPath, { force: true }).catch(() => {});
      screenVisionConfirmDialogWindows.delete(dialogId);
      if (settled) {
        return;
      }

      settled = true;
      screenVisionConfirmDialogResolvers.delete(dialogId);
      resolve({
        confirmed: false,
        rememberChoice: false,
        skipped: false
      });
    });

    dialogWindow.once("ready-to-show", () => {
      dialogWindow.show();
      dialogWindow.focus();
    });

    await dialogWindow.loadFile(dialogHtmlPath);
  });
}

async function showScreenVisionPromptDialog(ownerWindow, options = {}) {
  const dialogId = crypto.randomUUID();
  const parentWindow = ownerWindow && !ownerWindow.isDestroyed() ? ownerWindow : mainWindow;
  const hasMedia = typeof options.mediaPath === "string" && options.mediaPath.trim();
  const hasCheckbox = typeof options.checkboxLabel === "string" && options.checkboxLabel.trim();
  const requestedWidth = hasMedia ? 500 : 440;
  // The OBS guide uses a larger GIF. Leave breathing room for its natural
  // height, localized copy, checkbox, and the image-only action buttons.
  const requestedHeight = hasMedia ? (hasCheckbox ? 600 : 540) : (hasCheckbox ? 318 : 258);
  const parentBounds = parentWindow && !parentWindow.isDestroyed() ? parentWindow.getBounds() : null;
  const parentDisplay = parentBounds ? screen.getDisplayMatching(parentBounds) : screen.getPrimaryDisplay();
  const width = Math.min(requestedWidth, Math.max(320, parentDisplay.workArea.width - 24));
  const height = Math.min(requestedHeight, Math.max(240, parentDisplay.workArea.height - 24));
  const external = options.external === true;
  const initialBounds = getConfirmDialogBounds({
    parentBounds,
    workArea: parentDisplay.workArea,
    width,
    height,
    external,
    centerOnDisplay: false
  });
  const dialogWindow = new BrowserWindow({
    ...initialBounds,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    movable: true,
    frame: false,
    transparent: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    parent: parentWindow && !parentWindow.isDestroyed() ? parentWindow : undefined,
    modal: Boolean(parentWindow && !parentWindow.isDestroyed()),
    webPreferences: {
      preload: path.join(projectRoot, "desktop", "screen-vision", "confirm-dialog-preload.cjs"),
      contextIsolation: true,
      sandbox: false,
      additionalArguments: [`--screenvision-confirm-dialog-id=${dialogId}`]
    }
  });

  dialogWindow.removeMenu();
  dialogWindow.setMenuBarVisibility(false);
  dialogWindow.setAlwaysOnTop(true, "screen-saver");
  screenVisionConfirmDialogWindows.set(dialogId, {
    window: dialogWindow,
    parentBounds,
    external,
    centerOnDisplay: false,
    role: "prompt"
  });

  const html = buildScreenVisionPromptDialogHtml(options);
  const dialogHtmlPath = path.join(app.getPath("temp"), `poioso-screenvision-prompt-${dialogId}.html`);
  await fs.writeFile(dialogHtmlPath, html, "utf8");

  return await new Promise(async (resolve) => {
    let settled = false;

    const finish = (payload) => {
      if (settled) {
        return;
      }

      settled = true;
      screenVisionConfirmDialogResolvers.delete(dialogId);
      screenVisionConfirmDialogWindows.delete(dialogId);
      const confirmed = (payload?.action || "cancel") === "confirm";
      resolve(confirmed
        ? (options.returnPayload
          ? { value: String(payload?.value || ""), checked: Boolean(payload?.checked) }
          : String(payload?.value || ""))
        : null);

      if (!dialogWindow.isDestroyed()) {
        dialogWindow.close();
      }
    };

    screenVisionConfirmDialogResolvers.set(dialogId, finish);

    dialogWindow.on("closed", () => {
      void fs.rm(dialogHtmlPath, { force: true }).catch(() => {});
      screenVisionConfirmDialogWindows.delete(dialogId);
      if (settled) {
        return;
      }

      settled = true;
      screenVisionConfirmDialogResolvers.delete(dialogId);
      resolve(null);
    });

    dialogWindow.once("ready-to-show", () => {
      dialogWindow.show();
      dialogWindow.focus();
    });

    await dialogWindow.loadFile(dialogHtmlPath);
  });
}

async function showTimerVisualAlertWindow(payload = {}) {
  const normalized = normalizeAlertVisualPayload(payload);
  await hideTimerVisualAlertWindow({ timerId: normalized.timerId }).catch(() => {});
  const display = resolveAlertDisplay(normalized.centerX, normalized.centerY);
  const bounds = computeAlertWindowBounds(normalized, {
    includeInstruction: false,
    display
  });
  const alertWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  alertWindow.setAlwaysOnTop(true, "screen-saver");
  alertWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  alertWindow.setIgnoreMouseEvents(true);
  alertWindow.on("closed", () => {
    if (normalized.timerId && activeTimerVisualAlertWindows.get(normalized.timerId) === alertWindow) {
      activeTimerVisualAlertWindows.delete(normalized.timerId);
    }
  });
  const html = buildAlertWindowHtml(normalized, {
    includeInstruction: false,
    editorMode: false
  });
  await alertWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  alertWindow.showInactive();
  alertWindow.moveTop();
  if (normalized.timerId) {
    activeTimerVisualAlertWindows.set(normalized.timerId, alertWindow);
  }
  setTimeout(() => {
    if (!alertWindow.isDestroyed()) {
      alertWindow.close();
    }
  }, normalized.durationMs);
}

async function hideTimerVisualAlertWindow(payload = {}) {
  const timerId = String(payload?.timerId || "").trim();
  if (!timerId) {
    return false;
  }

  const alertWindow = activeTimerVisualAlertWindows.get(timerId);
  if (!alertWindow || alertWindow.isDestroyed()) {
    activeTimerVisualAlertWindows.delete(timerId);
    return false;
  }

  activeTimerVisualAlertWindows.delete(timerId);
  alertWindow.close();
  return true;
}

async function clearAllTimerVisualAlertWindows() {
  const windows = [...activeTimerVisualAlertWindows.values()];
  activeTimerVisualAlertWindows.clear();

  for (const alertWindow of windows) {
    if (!alertWindow || alertWindow.isDestroyed()) {
      continue;
    }

    try {
      alertWindow.close();
    } catch (_error) {
    }
  }
}

function restoreActiveTimerVisualAlertsTopmost() {
  for (const alertWindow of activeTimerVisualAlertWindows.values()) {
    if (!alertWindow || alertWindow.isDestroyed()) {
      continue;
    }

    try {
      alertWindow.setAlwaysOnTop(true, "screen-saver");
      alertWindow.moveTop();
    } catch (_error) {
    }
  }

  for (const previewWindow of alertPositionEditorWindows.values()) {
    if (!previewWindow || previewWindow.isDestroyed()) {
      continue;
    }

    try {
      previewWindow.setAlwaysOnTop(true, "screen-saver");
      previewWindow.moveTop();
    } catch (_error) {
    }
  }
}

async function openAlertPositionEditorWindow(payload = {}) {
  const timerId = String(payload.timerId || "").trim();

  if (!timerId) {
    return null;
  }

  const normalized = normalizeAlertVisualPayload(payload);
  const existingWindow = alertPositionEditorWindows.get(timerId);

  if (existingWindow && !existingWindow.isDestroyed()) {
    await updateAlertPositionEditorWindow(payload);
    return getAlertEditorCenter(existingWindow);
  }

  const display = resolveAlertDisplay(normalized.centerX, normalized.centerY);
  const bounds = computeAlertWindowBounds(normalized, {
    includeInstruction: true,
    display
  });
  const previewWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  previewWindow.setAlwaysOnTop(true, "screen-saver");
  previewWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  previewWindow.on("closed", () => {
    if (alertPositionEditorWindows.get(timerId) === previewWindow) {
      alertPositionEditorWindows.delete(timerId);
    }
  });

  alertPositionEditorWindows.set(timerId, previewWindow);
  const html = buildAlertWindowHtml(normalized, {
    includeInstruction: true,
    editorMode: true
  });
  await previewWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  previewWindow.showInactive();
  previewWindow.moveTop();
  return getAlertEditorCenter(previewWindow);
}

async function updateAlertPositionEditorWindow(payload = {}) {
  const timerId = String(payload.timerId || "").trim();
  const previewWindow = alertPositionEditorWindows.get(timerId);

  if (!timerId || !previewWindow || previewWindow.isDestroyed()) {
    return null;
  }

  const normalized = normalizeAlertVisualPayload(payload);
  const currentCenter = getAlertEditorCenter(previewWindow);
  const display = resolveAlertDisplay(currentCenter?.x ?? normalized.centerX, currentCenter?.y ?? normalized.centerY);
  const bounds = computeAlertWindowBounds({
    ...normalized,
    centerX: currentCenter?.x ?? normalized.centerX,
    centerY: currentCenter?.y ?? normalized.centerY
  }, {
    includeInstruction: true,
    display
  });
  const html = buildAlertWindowHtml(normalized, {
    includeInstruction: true,
    editorMode: true
  });

  await previewWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  previewWindow.setBounds(bounds, false);
  return getAlertEditorCenter(previewWindow);
}

async function closeAlertPositionEditorWindow(payload = {}) {
  const timerId = String(payload.timerId || "").trim();
  const previewWindow = alertPositionEditorWindows.get(timerId);

  if (!timerId || !previewWindow || previewWindow.isDestroyed()) {
    return null;
  }

  const center = getAlertEditorCenter(previewWindow);
  alertPositionEditorWindows.delete(timerId);
  previewWindow.close();
  return center;
}

async function clearAlertPositionEditorWindows() {
  for (const previewWindow of alertPositionEditorWindows.values()) {
    if (!previewWindow || previewWindow.isDestroyed()) {
      continue;
    }

    try {
      previewWindow.close();
    } catch (_error) {
    }
  }

  alertPositionEditorWindows.clear();
}

function getAlertEditorCenter(window) {
  if (!window || window.isDestroyed()) {
    return null;
  }

  const bounds = window.getBounds();
  return {
    x: Math.round(bounds.x + (bounds.width / 2)),
    y: Math.round(bounds.y + (bounds.height / 2))
  };
}

function normalizeAlertVisualPayload(payload = {}) {
  const message = String(payload.message || payload.name || "Timer pronto").trim().slice(0, 64) || "Timer pronto";
  const color = /^#[0-9a-f]{6,8}$/i.test(String(payload.color || "").trim())
    ? String(payload.color).trim()
    : "#FFFFFF";
  let centerX = normalizeOptionalNumber(payload.x);
  let centerY = normalizeOptionalNumber(payload.y);

  if (Number.isFinite(centerX) && Number.isFinite(centerY) && centerX <= 24 && centerY <= 24) {
    centerX = null;
    centerY = null;
  }

  return {
    timerId: String(payload.timerId || "").trim(),
    message,
    color,
    fontSize: clampInteger(payload.fontSize, 18, 72, 34),
    fontFamily: normalizeAlertFontFamilyKey(payload.fontFamily),
    fontWeight: normalizeAlertFontWeight(payload.fontWeight),
    shadowEnabled: payload.shadowEnabled !== false,
    durationMs: clampInteger(
      Math.round(Number.parseFloat(String(payload.durationSeconds ?? 1.6)) * 1000),
      500,
      15000,
      1600
    ),
    centerX,
    centerY
  };
}

function computeAlertWindowBounds(payload, options = {}) {
  const includeInstruction = options.includeInstruction === true;
  const display = options.display || resolveAlertDisplay(payload.centerX, payload.centerY);
  const { workArea } = display;
  const textLength = Math.max(4, Math.min(payload.message.length, 32));
  const familyWidthFactor = (() => {
    switch (payload.fontFamily) {
      case "rajdhani":
        return 0.72;
      case "orbitron":
        return 0.8;
      case "montserrat":
      case "poppins":
      case "sora":
        return 0.76;
      case "merriweather":
      case "playfair":
        return 0.82;
      default:
        return 0.78;
    }
  })();
  const shadowPaddingX = payload.shadowEnabled
    ? Math.max(20, Math.round(payload.fontSize * 0.7))
    : 0;
  const shadowPaddingY = payload.shadowEnabled
    ? Math.max(16, Math.round(payload.fontSize * 0.5))
    : 0;
  const horizontalPadding = (includeInstruction ? 120 : 96) + (shadowPaddingX * 2);
  const width = Math.max(
    260,
    Math.round((payload.fontSize * textLength * familyWidthFactor) + horizontalPadding)
  );
  const height = Math.max(
    (includeInstruction ? 124 : 84) + shadowPaddingY,
    Math.round((payload.fontSize * (includeInstruction ? 2.5 : 1.9)) + (includeInstruction ? 32 : 24) + shadowPaddingY)
  );
  const rawX = Number.isFinite(payload.centerX)
    ? Math.round(payload.centerX - (width / 2))
    : Math.round(workArea.x + ((workArea.width - width) / 2));
  const rawY = Number.isFinite(payload.centerY)
    ? Math.round(payload.centerY - (height / 2))
    : Math.round(workArea.y + ((workArea.height - height) / 2));
  const margin = 16;
  const minX = workArea.x + margin;
  const minY = workArea.y + margin;
  const maxX = Math.max(minX, (workArea.x + workArea.width) - width - margin);
  const maxY = Math.max(minY, (workArea.y + workArea.height) - height - margin);
  const x = Math.min(Math.max(rawX, minX), maxX);
  const y = Math.min(Math.max(rawY, minY), maxY);

  return { x, y, width, height };
}

function resolveAlertDisplay(centerX, centerY) {
  if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
    return screen.getDisplayNearestPoint({
      x: Math.round(centerX),
      y: Math.round(centerY)
    });
  }

  return screen.getPrimaryDisplay();
}

function buildAlertWindowHtml(payload, options = {}) {
  const includeInstruction = options.includeInstruction === true;
  const editorMode = options.editorMode === true;
  const textShadow = payload.shadowEnabled
    ? `0 0 10px ${escapeHtmlAttribute(withAlpha(payload.color, 0.95))}, 0 0 22px ${escapeHtmlAttribute(withAlpha(payload.color, 0.55))}, 0 0 34px ${escapeHtmlAttribute(withAlpha(payload.color, 0.28))}`
    : "none";

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:transparent;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;">
          <div style="
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            min-width:100%;
            min-height:100%;
            padding:${includeInstruction ? "18px 40px" : "14px 20px 12px"};
            border:0;
            border-radius:0;
            background:transparent;
            -webkit-app-region:${editorMode ? "drag" : "no-drag"};
            user-select:none;
            text-align:center;
            box-sizing:border-box;
          ">
            <div style="
              display:inline-flex;
              align-items:center;
              justify-content:center;
              max-width:100%;
              padding:${editorMode ? "6px 10px" : "0 4px"};
              border:${editorMode ? "1px solid rgba(255,255,255,0.9)" : "0"};
              border-radius:${editorMode ? "4px" : "0"};
              background:${editorMode ? "rgba(10,12,18,0.18)" : "transparent"};
              box-sizing:border-box;
            ">
              <div style="
                color:${escapeHtmlAttribute(payload.color)};
                font-size:${payload.fontSize}px;
                font-weight:${payload.fontWeight};
                font-family:${escapeHtmlAttribute(resolveAlertFontFamilyCss(payload.fontFamily))};
                line-height:1.08;
                text-shadow:${textShadow};
                white-space:nowrap;
                max-width:100%;
              ">${escapeHtml(payload.message)}</div>
            </div>
            ${includeInstruction ? `
              <div style="
                margin-top:6px;
                color:rgba(255,255,255,0.55);
                font-size:11px;
                line-height:1.35;
                font-weight:600;
                font-family:${escapeHtmlAttribute(resolveAlertFontFamilyCss("nunito"))};
                text-shadow:0 1px 4px rgba(0,0,0,0.45);
                white-space:normal;
                max-width:min(100%, 420px);
              ">Trave para ativar o alerta visual.</div>
            ` : ""}
          </div>
        </div>
      </body>
    </html>
  `;
}

function normalizeAlertFontFamilyKey(value) {
  const key = String(value || "").trim().toLowerCase();
  const allowed = new Set(["nunito", "toolkit", "montserrat", "poppins", "sora", "merriweather", "playfair", "rajdhani", "orbitron"]);
  return allowed.has(key) ? key : "nunito";
}

function normalizeAlertFontWeight(value) {
  const normalized = clampInteger(value, 400, 900, 700);
  return [400, 500, 600, 700, 800, 900].includes(normalized) ? normalized : 700;
}

function fontSizeKeyToValue(key) {
  switch (String(key || "").trim().toLowerCase()) {
    case "small":
      return 18;
    case "medium":
      return 26;
    case "x-large":
      return 44;
    case "huge":
      return 56;
    default:
      return 34;
  }
}

function resolveAlertFontFamilyCss(key) {
  switch (normalizeAlertFontFamilyKey(key)) {
    case "toolkit":
      return `"Segoe UI", Tahoma, Geneva, Verdana, sans-serif`;
    case "montserrat":
      return `"Montserrat", "Segoe UI", Arial, sans-serif`;
    case "poppins":
      return `"Poppins", "Segoe UI", Arial, sans-serif`;
    case "sora":
      return `"Sora", "Segoe UI", Arial, sans-serif`;
    case "merriweather":
      return `"Merriweather", Georgia, serif`;
    case "playfair":
      return `"Playfair Display", Georgia, serif`;
    case "rajdhani":
      return `"Rajdhani", "Segoe UI", sans-serif`;
    case "orbitron":
      return `"Orbitron", "Segoe UI", sans-serif`;
    default:
      return `"Nunito", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`;
  }
}

function withAlpha(color, opacity) {
  const text = String(color || "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(text)) {
    return "rgba(255,255,255,0.6)";
  }

  const red = Number.parseInt(text.slice(1, 3), 16);
  const green = Number.parseInt(text.slice(3, 5), 16);
  const blue = Number.parseInt(text.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(Math.max(Number(opacity) || 0, 0), 1)})`;
}

function normalizeBoundsForPersistence(bounds, fallback) {
  const source = bounds && typeof bounds === "object" ? bounds : {};

  return {
    x: clampInteger(source.X ?? source.x, -20000, 20000, fallback?.x ?? 0),
    y: clampInteger(source.Y ?? source.y, -20000, 20000, fallback?.y ?? 0),
    width: clampInteger(source.Width ?? source.width, 24, 20000, fallback?.width ?? 24),
    height: clampInteger(source.Height ?? source.height, 24, 20000, fallback?.height ?? 24)
  };
}

function areBoundsEqual(left, right) {
  return Boolean(
    left
    && right
    && left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height
  );
}

function stopNativeHostProcess() {
  if (!nativeHostProcess || nativeHostProcess.killed || nativeHostProcess.exitCode !== null) {
    nativeHostProcess = null;
    return;
  }

  try {
    nativeHostProcess.kill();
  } catch (_error) {
  }

  nativeHostProcess = null;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function listDesktopSources(type) {
  const normalizedType = type === "window" ? "window" : "screen";
  const sources = await desktopCapturer.getSources({
    types: [normalizedType],
    thumbnailSize: {
      width: 0,
      height: 0
    },
    fetchWindowIcons: false
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    displayId: source.display_id || ""
  }));
}

async function shouldShowScreenVisionOverlays(tibiaState) {
  const canUseTibiaWindow = canUseTibiaWindowForScreenVision(tibiaState);

  if (!canUseTibiaWindow) {
    return false;
  }

  if (tibiaState.isForeground) {
    return true;
  }

  const controllerFocused = controllerWindowFocusState || await isAnyControllerWindowFocused();

  if (!controllerFocused) {
    return false;
  }

  return await isTibiaDirectlyBehindControllerWindows().catch(async (error) => {
    await writeDebugLog(`screen-vision-tibia-behind-controller-error ${error?.message || String(error)}`);
    return false;
  });
}

function canUseTibiaWindowForScreenVision(tibiaState) {
  return Boolean(
    tibiaState
    && tibiaState.title
    && tibiaState.isVisible
    && !tibiaState.isMinimized
  );
}

function buildGridOverlayTibiaSignature(tibiaState) {
  const clientBounds = tibiaState?.clientBounds || {};
  const bounds = tibiaState?.bounds || {};

  return JSON.stringify({
    hwnd: Number(tibiaState?.hwnd || 0),
    title: String(tibiaState?.title || ""),
    isVisible: Boolean(tibiaState?.isVisible),
    isMaximized: Boolean(tibiaState?.isMaximized),
    isFullscreenLike: Boolean(tibiaState?.isFullscreenLike),
    isMinimized: Boolean(tibiaState?.isMinimized),
    clientX: Number(clientBounds.x ?? 0),
    clientY: Number(clientBounds.y ?? 0),
    clientWidth: Number(clientBounds.width ?? 0),
    clientHeight: Number(clientBounds.height ?? 0),
    boundsX: Number(bounds.x ?? 0),
    boundsY: Number(bounds.y ?? 0),
    boundsWidth: Number(bounds.width ?? 0),
    boundsHeight: Number(bounds.height ?? 0)
  });
}

async function isAnyControllerWindowFocused() {
  const controllerHwnds = getControllerWindowHandleStrings();

  if (controllerHwnds.length) {
    try {
      await ensureNativeHostStarted();
      const response = await callNativeHost({
        command: "isAnyControllerFocused",
        controllerHwnds
      });

      if (response?.ok) {
        return Boolean(response?.data?.focused);
      }
    } catch (error) {
      await writeDebugLog(`screen-vision-controller-focus-error ${error?.message || String(error)}`);
    }
  }

  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
    return true;
  }

  if (tutorialPopoverWindow && !tutorialPopoverWindow.isDestroyed() && tutorialPopoverWindow.isFocused()) {
    return true;
  }

  for (const window of screenVisionWindows.values()) {
    if (window && !window.isDestroyed() && window.isFocused()) {
      return true;
    }
  }

  return false;
}

async function refreshControllerWindowFocusState() {
  const focused = await isAnyControllerWindowFocused();
  controllerWindowFocusState = focused;
  await writeDebugLog(`screen-vision-controller-focus-state ${focused ? "focused" : "blurred"}`);
  return focused;
}

function getControllerWindowHandleStrings() {
  const handles = [];

  const collect = (window) => {
    if (!window || window.isDestroyed()) {
      return;
    }

    try {
      const handleBuffer = window.getNativeWindowHandle();

      if (!Buffer.isBuffer(handleBuffer) || handleBuffer.length < 4) {
        return;
      }

      const handle = handleBuffer.length >= 8
        ? handleBuffer.readBigUInt64LE(0).toString()
        : BigInt(handleBuffer.readUInt32LE(0)).toString();

      if (handle !== "0") {
        handles.push(handle);
      }
    } catch (_error) {
    }
  };

  collect(mainWindow);
  // During a guided tour the floating instructions are part of our app, not
  // an external foreground window. Including its HWND prevents a false Tibia
  // focus-loss reset while the user clicks Continue.
  collect(tutorialPopoverWindow);

  for (const window of screenVisionWindows.values()) {
    collect(window);
  }

  return [...new Set(handles)];
}

function getScreenVisionAllowedProcessIds() {
  const processIds = [];

  if (Number.isInteger(nativeHostProcess?.pid) && nativeHostProcess.pid > 0) {
    processIds.push(nativeHostProcess.pid);
  }

  return [...new Set(processIds)];
}

async function isTibiaDirectlyBehindControllerWindows() {
  const controllerHwnds = getControllerWindowHandleStrings();
  const allowedProcessIds = getScreenVisionAllowedProcessIds();

  if (!controllerHwnds.length) {
    return false;
  }

  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "isTibiaBehindControllers",
    controllerHwnds,
    allowedProcessIds
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-controller-visibility-failed");
  }

  return Boolean(response?.data?.visible);
}

function intersectBounds(a, b, minSize = 24) {
  if (!a || !b) {
    return null;
  }

  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = right - left;
  const height = bottom - top;

  if (width < minSize || height < minSize) {
    return null;
  }

  return {
    x: left,
    y: top,
    width,
    height
  };
}

function toRelativeBounds(bounds, sourceBounds) {
  return {
    x: bounds.x - sourceBounds.x,
    y: bounds.y - sourceBounds.y,
    width: bounds.width,
    height: bounds.height
  };
}

function toInitialMirrorBounds(captureBounds, displayBounds = null) {
  const padding = 12;
  const rawBounds = {
    x: captureBounds.x - padding,
    y: captureBounds.y - padding,
    width: captureBounds.width + (padding * 2),
    height: captureBounds.height + (padding * 2)
  };

  if (!displayBounds || typeof displayBounds !== "object") {
    return rawBounds;
  }

  const width = Math.min(rawBounds.width, displayBounds.width);
  const height = Math.min(rawBounds.height, displayBounds.height);
  const minX = displayBounds.x;
  const minY = displayBounds.y;
  const maxX = displayBounds.x + displayBounds.width - width;
  const maxY = displayBounds.y + displayBounds.height - height;

  return {
    x: Math.round(clamp(rawBounds.x, minX, Math.max(minX, maxX))),
    y: Math.round(clamp(rawBounds.y, minY, Math.max(minY, maxY))),
    width: Math.round(width),
    height: Math.round(height)
  };
}

async function injectMapWatermark() {
  if (!mapWindow || mapWindow.isDestroyed()) {
    return;
  }

  const watermark = await getMapWatermarkDataUrl();

  if (!watermark) {
    return;
  }

  await mapWindow.webContents.executeJavaScript(`
    (() => {
      const id = "poioso-map-watermark";
      let img = document.getElementById(id);
      if (!img) {
        img = document.createElement("img");
        img.id = id;
        img.alt = "";
        document.body.appendChild(img);
      }
      img.src = ${JSON.stringify(watermark)};
      Object.assign(img.style, {
        position: "fixed",
        right: "12px",
        bottom: "12px",
        width: "58px",
        height: "58px",
        objectFit: "contain",
        opacity: "0.76",
        pointerEvents: "none",
        zIndex: "2147483647",
        filter: "drop-shadow(0 4px 9px rgba(0,0,0,0.55))"
      });
      document.title = " ";
    })();
  `).catch(() => {});
}

async function injectMapChromeStyle() {
  if (!mapWindow || mapWindow.isDestroyed()) {
    return;
  }

  await mapWindow.webContents.executeJavaScript(`
    (() => {
      const id = "poioso-map-control-style";
      let style = document.getElementById(id);
      if (!style) {
        style = document.createElement("style");
        style.id = id;
        document.head.appendChild(style);
      }
      style.textContent = \`
        .leaflet-control-fullscreen,
        .leaflet-control-fullscreen-button {
          display: none !important;
        }

        .leaflet-control-zoom,
        .leaflet-control-layers,
        .leaflet-control-coordinates,
        .leaflet-control-level-buttons-panel,
        .leaflet-control-exiva-button-panel,
        .leaflet-control-markers-button-panel,
        .leaflet-bar,
        .leaflet-control .uiElement {
          border-color: rgba(226, 232, 240, 0.72) !important;
          background: rgba(31, 37, 47, 0.9) !important;
          color: #fff !important;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.24) !important;
        }

        .leaflet-control-zoom a,
        .leaflet-bar a,
        .leaflet-control-level-buttons-a,
        .leaflet-control-level-buttons-span,
        #floor_button,
        .leaflet-control-exiva-button,
        .leaflet-control-markers-button,
        .leaflet-control-layers-toggle,
        .leaflet-control button,
        .leaflet-control-coordinates,
        .leaflet-control-coordinates *,
        .leaflet-control .uiElement,
        .leaflet-control .uiElement * {
          border-color: rgba(226, 232, 240, 0.72) !important;
          background-color: rgba(31, 37, 47, 0.9) !important;
          color: #fff !important;
          text-shadow: none !important;
          opacity: 1 !important;
        }

        .leaflet-control-zoom a:hover,
        .leaflet-bar a:hover,
        .leaflet-control-level-buttons-a:hover,
        .leaflet-control-exiva-button:hover,
        .leaflet-control-markers-button:hover,
        .leaflet-control button:hover,
        .leaflet-control-layers-toggle:hover {
          background-color: rgba(45, 53, 67, 0.94) !important;
          color: #fff !important;
        }

        .leaflet-control-level-buttons-panel {
          overflow: hidden !important;
          border-radius: 4px !important;
        }

        .leaflet-control-level-buttons-a,
        .leaflet-control-level-buttons-span,
        #floor_button {
          display: grid !important;
          place-items: center !important;
          width: 30px !important;
          height: 30px !important;
          min-width: 30px !important;
          min-height: 30px !important;
          padding: 0 !important;
          line-height: 30px !important;
          font-weight: 800 !important;
          text-decoration: none !important;
        }

        .leaflet-control-layers-expanded {
          background: rgba(31, 37, 47, 0.9) !important;
          color: #fff !important;
        }

        .leaflet-control-layers-expanded label,
        .leaflet-control-layers-expanded span {
          color: #fff !important;
        }
      \`;
    })();
  `).catch(() => {});
}

async function injectMapWheelZoom() {
  if (!mapWindow || mapWindow.isDestroyed()) {
    return;
  }

  await mapWindow.webContents.executeJavaScript(`
    (() => {
      if (window.__poiosoWheelZoomInstalled) {
        return;
      }
      window.__poiosoWheelZoomInstalled = true;
      let lastZoomAt = 0;
      document.addEventListener("wheel", (event) => {
        const target = event.target;
        if (target && target.closest && target.closest("input, textarea, select")) {
          return;
        }
        const now = Date.now();
        if (now - lastZoomAt < 80) {
          event.preventDefault();
          return;
        }
        lastZoomAt = now;
        const selector = event.deltaY < 0 ? ".leaflet-control-zoom-in" : ".leaflet-control-zoom-out";
        const button = document.querySelector(selector);
        if (button) {
          event.preventDefault();
          button.click();
        }
      }, { passive: false, capture: true });
    })();
  `).catch(() => {});
}

async function getMapWatermarkDataUrl() {
  if (!mapWatermarkDataUrlPromise) {
    mapWatermarkDataUrlPromise = fs
      .readFile(appIconPath)
      .then((buffer) => `data:image/png;base64,${buffer.toString("base64")}`)
      .catch(() => "");
  }

  return mapWatermarkDataUrlPromise;
}

async function getOverlayPrefs() {
  const stored = await readStorageValue("overlayPrefs");
  return stored.overlayPrefs || {};
}

function getRestoredOverlayBounds(storedBounds, defaults) {
  if (!storedBounds || typeof storedBounds !== "object") {
    return null;
  }

  const bounds = {
    x: Math.round(Number(storedBounds.x)),
    y: Math.round(Number(storedBounds.y)),
    width: clamp(Math.round(Number(storedBounds.width)), defaults.minWidth, defaults.maxWidth),
    height: clamp(Math.round(Number(storedBounds.height)), defaults.minHeight, defaults.maxHeight)
  };

  if (
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height)
  ) {
    return null;
  }

  return isOverlayBoundsVisible(bounds) ? bounds : null;
}

function isOverlayBoundsVisible(bounds) {
  return screen.getAllDisplays().some((display) => {
    const { workArea } = display;
    const visibleWidth = Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x);
    const visibleHeight = Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y);

    return visibleWidth >= 120 && visibleHeight >= 120;
  });
}

function scheduleOverlayBoundsSave(window) {
  if (!window || window.isDestroyed() || window.isMinimized()) {
    return;
  }

  if (overlayBoundsSaveTimer) {
    clearTimeout(overlayBoundsSaveTimer);
  }

  overlayBoundsSaveTimer = setTimeout(() => {
    overlayBoundsSaveTimer = null;
    void saveOverlayBounds(window);
  }, overlayBoundsSaveDelayMs);
}

async function saveOverlayBounds(window) {
  if (!window || window.isDestroyed() || window.isMinimized()) {
    return;
  }

  let bounds = window.getBounds();

  if (dockedToolPanelIsOpen && dockedToolPanelKey) {
    const definition = getDockedToolPanelDefinition(dockedToolPanelKey);

    if (definition) {
      bounds = deriveDockedToolPanelBaseBounds(bounds, definition.width, dockedToolPanelSide) || bounds;
    }
  }

  await writeStorageValue({
    overlayPrefs: {
      ...(await getOverlayPrefs()),
      bounds
    }
  });
}

async function readStorageValue(key) {
  if (key === null || typeof key === "undefined") {
    const [store, cacheStore, overlayToolsStore] = await Promise.all([
      readStore(),
      readRuntimeCacheStore(),
      readOverlayToolsStore()
    ]);
    const mergedStore = {
      ...store,
      ...cacheStore
    };

    if (Object.prototype.hasOwnProperty.call(overlayToolsStore, OVERLAY_TOOLS_STORAGE_KEY)) {
      mergedStore[OVERLAY_TOOLS_STORAGE_KEY] = overlayToolsStore[OVERLAY_TOOLS_STORAGE_KEY];
    }

    return mergedStore;
  }

  if (Array.isArray(key)) {
    const needsOverlayTools = key.includes(OVERLAY_TOOLS_STORAGE_KEY);
    const [store, cacheStore, overlayToolsStore] = await Promise.all([
      readStore(),
      readRuntimeCacheStore(),
      needsOverlayTools ? readOverlayToolsStore() : Promise.resolve({})
    ]);

    return Object.fromEntries(key.map((entry) => [
      entry,
      entry === OVERLAY_TOOLS_STORAGE_KEY
        ? overlayToolsStore[OVERLAY_TOOLS_STORAGE_KEY]
        : store[entry] ?? cacheStore[entry]
    ]));
  }

  if (typeof key === "string") {
    if (key === OVERLAY_TOOLS_STORAGE_KEY) {
      const overlayToolsStore = await readOverlayToolsStore();
      return {
        [key]: overlayToolsStore[OVERLAY_TOOLS_STORAGE_KEY]
      };
    }

    const [store, cacheStore] = await Promise.all([
      readStore(),
      readRuntimeCacheStore()
    ]);
    return {
      [key]: store[key] ?? cacheStore[key]
    };
  }

  if (typeof key === "object") {
    const entries = Object.entries(key);
    const needsOverlayTools = entries.some(([entryKey]) => entryKey === OVERLAY_TOOLS_STORAGE_KEY);
    const [store, cacheStore, overlayToolsStore] = await Promise.all([
      readStore(),
      readRuntimeCacheStore(),
      needsOverlayTools ? readOverlayToolsStore() : Promise.resolve({})
    ]);

    return Object.fromEntries(
      entries.map(([entryKey, fallback]) => [
        entryKey,
        entryKey === OVERLAY_TOOLS_STORAGE_KEY
          ? overlayToolsStore[OVERLAY_TOOLS_STORAGE_KEY] ?? fallback
          : store[entryKey] ?? cacheStore[entryKey] ?? fallback
      ])
    );
  }

  return {};
}

async function readSavedObsWebSocketPassword() {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return "";
    }

    const stored = await readStorageValue(obsWebSocketPasswordStorageKey);
    const encryptedValue = String(stored?.[obsWebSocketPasswordStorageKey] || "").trim();
    if (!encryptedValue) {
      return "";
    }

    return safeStorage.decryptString(Buffer.from(encryptedValue, "base64"));
  } catch (error) {
    await writeDebugLog(`obs-websocket-password-read-failed ${error?.message || String(error)}`);
    return "";
  }
}

async function saveObsWebSocketPassword(password) {
  const normalizedPassword = String(password || "");
  if (!normalizedPassword || !safeStorage.isEncryptionAvailable()) {
    return;
  }

  const encryptedValue = safeStorage.encryptString(normalizedPassword).toString("base64");
  await writeStorageValue({ [obsWebSocketPasswordStorageKey]: encryptedValue });
}

async function clearSavedObsWebSocketPassword() {
  await removeStorageValue(obsWebSocketPasswordStorageKey);
}

async function writeStorageValue(value) {
  const nextValue = value && typeof value === "object" ? { ...value } : {};
  const hasOverlayToolsState = Object.prototype.hasOwnProperty.call(nextValue, OVERLAY_TOOLS_STORAGE_KEY);

  if (hasOverlayToolsState) {
    const incomingState = normalizeOverlayToolsState(nextValue[OVERLAY_TOOLS_STORAGE_KEY]);

    // Alert/authenticator renderers persist a full overlay snapshot. While a
    // native selector has focus that snapshot can be older than a mirror just
    // created or moved, so it must never replace the canonical mirror list.
    await enqueueOverlayToolsMutation(async () => {
      const currentState = await readOverlayToolsState();
      incomingState.mirrors = currentState.mirrors;
      await writeOverlayToolsState(incomingState, {
        reason: "renderer-overlay-state-updated"
      });
    });
    delete nextValue[OVERLAY_TOOLS_STORAGE_KEY];
  }

  if (!Object.keys(nextValue).length) {
    return;
  }

  const cacheEntries = {};
  const primaryEntries = {};

  Object.entries(nextValue).forEach(([entryKey, entryValue]) => {
    if (isRuntimeCacheStorageEntry(entryValue)) {
      cacheEntries[entryKey] = entryValue;
      return;
    }

    primaryEntries[entryKey] = entryValue;
  });

  await Promise.all([
    Object.keys(primaryEntries).length
      ? readStore().then((store) => writeStore({
        ...store,
        ...primaryEntries
      }))
      : Promise.resolve(),
    Object.keys(cacheEntries).length
      ? readRuntimeCacheStore().then((store) => writeRuntimeCacheStore({
        ...store,
        ...cacheEntries
      }))
      : Promise.resolve()
  ]);
}

async function removeStorageValue(key) {
  const keys = Array.isArray(key) ? key : [key];
  const primaryKeys = keys.filter((entry) => entry !== OVERLAY_TOOLS_STORAGE_KEY);

  if (keys.includes(OVERLAY_TOOLS_STORAGE_KEY)) {
    const overlayToolsStore = await readOverlayToolsStore();
    delete overlayToolsStore[OVERLAY_TOOLS_STORAGE_KEY];
    await writeOverlayToolsStore(overlayToolsStore);
  }

  if (!primaryKeys.length) {
    return;
  }

  const [store, cacheStore] = await Promise.all([
    readStore(),
    readRuntimeCacheStore()
  ]);

  primaryKeys.forEach((entry) => {
    delete store[entry];
    delete cacheStore[entry];
  });

  await Promise.all([
    writeStore(store),
    writeRuntimeCacheStore(cacheStore)
  ]);
}

async function migrateLegacyRuntimeCacheStore() {
  const store = await readStore();
  const cacheStore = await readRuntimeCacheStore();
  const legacyCacheEntries = Object.fromEntries(
    Object.entries(store).filter(([, entryValue]) => isRuntimeCacheStorageEntry(entryValue))
  );

  if (!Object.keys(legacyCacheEntries).length) {
    return;
  }

  const nextCacheStore = {
    ...legacyCacheEntries,
    ...cacheStore
  };
  const nextPrimaryStore = Object.fromEntries(
    Object.entries(store).filter(([, entryValue]) => !isRuntimeCacheStorageEntry(entryValue))
  );

  await Promise.all([
    writeRuntimeCacheStore(nextCacheStore),
    writeStore(nextPrimaryStore)
  ]);
}

async function readStore() {
  try {
    const raw = await fs.readFile(overlayStorePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }

    await backupCorruptedStore(error);
    return {};
  }
}

async function writeStore(value) {
  storeWriteQueue = storeWriteQueue
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(overlayStorePath), { recursive: true });
      const tempPath = `${overlayStorePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
      await fs.rm(overlayStorePath, { force: true }).catch(() => {});
      await fs.rename(tempPath, overlayStorePath);
    });

  return storeWriteQueue;
}

async function readRuntimeCacheStore() {
  try {
    const raw = await fs.readFile(runtimeCacheStorePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }

    await backupCorruptedStoreFile(runtimeCacheStorePath, error);
    return {};
  }
}

async function ensureRuntimeCacheStoreReady() {
  await fs.mkdir(path.dirname(runtimeCacheStorePath), { recursive: true });

  try {
    await fs.access(runtimeCacheStorePath);
  } catch (_error) {
    await fs.writeFile(runtimeCacheStorePath, "{}", "utf8");
  }
}

async function writeRuntimeCacheStore(value) {
  cacheStoreWriteQueue = cacheStoreWriteQueue
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(runtimeCacheStorePath), { recursive: true });
      const tempPath = `${runtimeCacheStorePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
      await fs.rm(runtimeCacheStorePath, { force: true }).catch(() => {});
      await fs.rename(tempPath, runtimeCacheStorePath);
    });

  return cacheStoreWriteQueue;
}

function isRuntimeCacheStorageEntry(entryValue) {
  return Boolean(
    entryValue &&
    typeof entryValue === "object" &&
    Object.prototype.hasOwnProperty.call(entryValue, "timestamp") &&
    Object.prototype.hasOwnProperty.call(entryValue, "value")
  );
}

async function readOverlayToolsStore() {
  // The Windows atomic replace briefly removes the destination before rename.
  // Never let a concurrent mirror action interpret that interval as an empty
  // profile and overwrite the existing mirror collection.
  await overlayToolsStoreWriteQueue.catch(() => {});

  try {
    const raw = await fs.readFile(overlayToolsStorePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }

    await backupCorruptedStoreFile(overlayToolsStorePath, error);
    return {};
  }
}

async function writeOverlayToolsStore(value) {
  overlayToolsStoreWriteQueue = overlayToolsStoreWriteQueue
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(overlayToolsStorePath), { recursive: true });
      const tempPath = `${overlayToolsStorePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
      await fs.rm(overlayToolsStorePath, { force: true }).catch(() => {});
      await fs.rename(tempPath, overlayToolsStorePath);
    });

  return overlayToolsStoreWriteQueue;
}

async function backupCorruptedStore(error) {
  await backupCorruptedStoreFile(overlayStorePath, error);
}

async function backupCorruptedStoreFile(filePath, error) {
  const backupPath = `${filePath}.corrupt-${Date.now()}`;

  await fs.rename(filePath, backupPath).catch(() => {});
  await writeDebugLog(
    `storage-corrupt backup=${backupPath} error=${error instanceof Error ? error.message : String(error)}`
  );
}

async function writeDebugLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  await fs.appendFile(debugLogPath, line, "utf8").catch(() => {});
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value);
}

function clampNumber(value, min, max, fallback) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return clamp(numericValue, min, max);
}

function normalizeOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHexColor(value, fallback = "#58C470") {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) || /^#[0-9a-f]{8}$/i.test(text) ? text : fallback;
}

function normalizeMirrorGlowSavedColors(value) {
  const source = Array.isArray(value) ? value : [];
  const colors = [];

  for (const item of source) {
    const color = normalizeHexColor(item, "").toUpperCase();

    if (color && !colors.includes(color)) {
      colors.push(color);
    }

    if (colors.length >= 10) {
      break;
    }
  }

  if (!colors.includes("#FFFFFF")) {
    colors.unshift("#FFFFFF");
  }

  return colors.slice(0, 10);
}

function clampInteger(value, min, max, fallback) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.round(clamp(numericValue, min, max));
}

function normalizeCountdownSide(value) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (text === "above" || text === "cima" || text === "top") {
    return "Above";
  }

  if (text === "below" || text === "baixo" || text === "bot" || text === "bottom") {
    return "Below";
  }

  if (text === "left" || text === "esquerda") {
    return "Left";
  }

  if (text === "right" || text === "direita") {
    return "Right";
  }

  return "Above";
}

function getCountdownDefaultsForSide(side) {
  const normalizedSide = normalizeCountdownSide(side);

  if (normalizedSide === "Left" || normalizedSide === "Right") {
    return {
      barThickness: 6,
      barLength: 32,
      direction: "TopToBottom"
    };
  }

  return {
    barThickness: 6,
    barLength: 32,
    direction: "RightToLeft"
  };
}

function normalizeCountdownDirectionValue(value) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (text === "toptobottom" || text === "top-to-bottom") {
    return "TopToBottom";
  }

  if (text === "bottomtotop" || text === "bottom-to-top") {
    return "BottomToTop";
  }

  if (text === "righttoleft" || text === "right-to-left") {
    return "RightToLeft";
  }

  return "LeftToRight";
}

function normalizeCountdownColorValue(value) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return "gradient";
  }

  if (text.toLowerCase() === "gradient") {
    return "gradient";
  }

  if (/^#[0-9a-f]{6}$/i.test(text) || /^#[0-9a-f]{8}$/i.test(text)) {
    return text;
  }

  return "gradient";
}

function toElectronAccelerator(hotkey) {
  const text = typeof hotkey === "string" ? hotkey.trim() : "";

  if (!text) {
    return "";
  }

  const parts = text
    .split("+")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!parts.length) {
    return "";
  }

  const normalizedParts = [];
  const mainKey = parts.at(-1)?.toUpperCase() || "";

  for (const part of parts.slice(0, -1)) {
    const modifier = part.toUpperCase();

    if (modifier === "CTRL" || modifier === "CONTROL") {
      normalizedParts.push("CommandOrControl");
      continue;
    }

    if (modifier === "ALT") {
      normalizedParts.push("Alt");
      continue;
    }

    if (modifier === "SHIFT") {
      normalizedParts.push("Shift");
      continue;
    }
  }

  if (/^[A-Z0-9]$/.test(mainKey) || /^F([1-9]|1[0-9]|2[0-4])$/.test(mainKey)) {
    normalizedParts.push(mainKey);
    return normalizedParts.join("+");
  }

  return "";
}
