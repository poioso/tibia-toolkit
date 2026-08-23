import path from "node:path";
import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import crypto from "node:crypto";
import net from "node:net";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, Menu, nativeImage, net as electronNet, protocol, safeStorage, screen, shell, Tray } from "electron";
import {
  createDefaultOverlayToolsState,
  cloneOverlayToolsStateForSave,
  OVERLAY_TOOLS_STORAGE_KEY,
  normalizeOverlayToolsState
} from "../lib/overlay/overlay-tools-state.js";
import {
  createOverlayMirrorEntry,
  normalizeMirrorSourceGame,
  normalizeOverlayMirrorEntry
} from "../lib/overlay/overlay-mirrors.js";
import {
  canCreateMirrorRegion,
  countEffectivelyVisibleMirrorRegionsByScope,
  countMirrorRegionsByScope,
  getEffectivelyVisibleMirrorItems,
  getMirrorScope
} from "../lib/overlay/mirror-limits.js";
import { formatOverlayTimerDuration, normalizeOverlayTimerEntry } from "../lib/overlay/overlay-timers.js";
import {
  createEmptyMirrorAudioProfile,
  createEmptyMirrorProfile,
  overlayStateToMirrorAudioProfile,
  overlayStateToMirrorProfile,
  mirrorProfileToOverlayState
} from "../lib/overlay/screen-vision-profile-format.js";
import {
  APP_LOCALE_STORAGE_KEY,
  getActiveLocale,
  INITIAL_APP_LOCALE,
  normalizeLocale,
  setActiveLocale
} from "../lib/i18n/locale-state.js";
import { translateUiString } from "../lib/i18n/ui-translations.js";
import { normalizeTibiaDisplayState } from "./screen-vision/tibia-window-state.js";
import { SCREEN_VISION_SPELL_PRESETS } from "./screen-vision/spell-presets.js";
import { SCREEN_VISION_POTION_PRESETS } from "./screen-vision/consumable-presets.js";
import { ObsMirrorSync } from "./obs-integration/obs-mirror-sync.js";
import { ensureContentPack, inspectContentPackUpdate, prepareContentPackChunkUpdate } from "./content-pack.js";
import { startAppUpdater } from "./app-updater.js";
import {
  applyLibraryCatalogOverlay,
  createEmptyLibraryCatalogOverlay,
  mergeLibraryCatalogOverlay,
  normalizeLibraryCatalogSyncPage
} from "../lib/catalog-sync/library-catalog-overlay.js";
import {
  collectLibraryMediaPaths,
  collectRetainedLibraryMediaHashes,
  planLibraryMediaCacheCleanup,
  pruneLibraryMediaIndex
} from "../lib/catalog-sync/media-cache.js";
import { resolveLibraryContentSource } from "./config/library-content-source.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const execFileAsync = promisify(execFile);
const windowsPowerShellCommand = process.platform === "win32"
  ? (() => {
    const candidate = path.join(
      process.env.WINDIR || process.env.SystemRoot || "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe"
    );
    return fsSync.existsSync(candidate) ? candidate : "powershell.exe";
  })()
  : "powershell.exe";
const mainProcessStartedAt = performance.now();
const portableMarkerPath = app.isPackaged
  ? path.join(process.resourcesPath, "portable-test.json")
  : "";
const portableMarker = readPortableTestMarker(portableMarkerPath);
const runtimeChannel = resolveRuntimeChannel();
const isProductionRuntime = runtimeChannel === "production";
const isPortableTestRuntime = runtimeChannel === "portable-test";
const usesProductionDataServices = isProductionRuntime || isPortableTestRuntime;
const usesProductionAuthentication = isProductionRuntime || isPortableTestRuntime;
const allowsRemoteContentPack = !isPortableTestRuntime;
const allowsRemoteLibrarySync = !isPortableTestRuntime;
// Emergency rollback for the isolated lazy auxiliary-tooltip optimization.
// Default: create the transparent tooltip renderer only on first hover.
const eagerAuxiliaryTooltips = process.env.TIBIA_TOOLKIT_EAGER_AUXILIARY_TOOLTIPS === "1";

// A terminal can disappear while Electron is still flushing diagnostics. Never
// let that harmless condition become a main-process exception.
for (const stream of [process.stdout, process.stderr]) {
  stream?.on?.("error", (error) => {
    if (error?.code !== "EPIPE") {
      void writeDebugLog(`process-stream-error ${error?.code || "unknown"} ${error?.message || ""}`);
    }
  });
}
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
  },
  "portable-test": {
    displayName: "Tibia Toolkit Teste Portátil",
    userDataDirectoryName: "Poioso Tibia Toolkit Portable",
    documentsDirectoryName: "Tibia Toolkit Portable",
    nativeHostPipeId: "poioso-screen-vision-portable-test"
  }
}[runtimeChannel];
const runtimeAppUserModelId = isProductionRuntime
  ? "com.poioso.tibia-toolkit"
  : (isPortableTestRuntime
    ? "com.poioso.tibia-toolkit.portable-test"
    : "com.poioso.tibia-toolkit.dev");

function readPortableTestMarker(markerPath) {
  if (!markerPath) return null;
  try {
    const parsed = JSON.parse(fsSync.readFileSync(markerPath, "utf8"));
    const portableId = String(parsed?.portableId || "").trim();
    if (parsed?.mode !== "portable-test" || !/^[a-f0-9-]{16,80}$/i.test(portableId)) return null;
    return { ...parsed, portableId };
  } catch {
    return null;
  }
}

function normalizeRuntimeChannel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["production", "development", "portable-test"].includes(normalized) ? normalized : null;
}

function resolveRuntimeChannel() {
  const forcedChannel = normalizeRuntimeChannel(process.env.TIBIA_TOOLKIT_RUNTIME_CHANNEL);
  if (forcedChannel && (forcedChannel !== "portable-test" || portableMarker)) {
    return forcedChannel;
  }

  if (!app.isPackaged) {
    return "development";
  }

  if (portableMarker) {
    return "portable-test";
  }

  try {
    const packageMetadataPath = path.join(app.getAppPath(), "package.json");
    const packageMetadata = JSON.parse(fsSync.readFileSync(packageMetadataPath, "utf8"));
    return normalizeRuntimeChannel(packageMetadata?.tibiaToolkitChannel) || "production";
  } catch {
    return "production";
  }
}

function resolveAccountAuthBaseUrl() {
  // A release never points to localhost. The unpackaged workspace runtime can
  // use the isolated local account foundation for the complete device flow.
  const configured = String(process.env.TIBIA_TOOLKIT_AUTH_BASE_URL || "").trim();
  const localHomologation = readLocalHomologationAccountConfig();
  const fallback = usesProductionAuthentication
    ? "https://auth.tibiatoolkit.com"
    // Electron's main-process resolver does not consistently resolve the
    // custom .localhost alias on Windows.  Use loopback for its private API
    // calls; the browser hand-off below still uses the explicit homologation
    // hostname, keeping those cookies isolated from production.
      : "http://127.0.0.1:3100";

  try {
    const url = new URL(configured || localHomologation.authBaseUrl || fallback);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Unsupported account origin protocol");
    }
    return url.origin;
  } catch {
    return fallback;
  }
}

function resolveAccountSiteBaseUrl() {
  // Browser-facing account pages live on the website, not on the isolated
  // auth API origin. Keep the local homologation route explicit so the app
  // never sends a development user to the production account page.
  const configured = String(process.env.TIBIA_TOOLKIT_SITE_BASE_URL || "").trim();
  const localHomologation = readLocalHomologationAccountConfig();
  const fallback = usesProductionAuthentication
    ? "https://tibiatoolkit.com"
    // The auth service emits this browser-facing, cookie-isolated URL in the
    // local homologation lane. Electron only validates its origin before it
    // opens the default browser, so it must match the exact public hand-off
    // origin rather than the loopback API host used by the main process.
    : "http://homologacao-navegador.localhost:3042";

  try {
    const url = new URL(configured || localHomologation.siteBaseUrl || fallback);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error("Unsupported account site origin protocol");
    }
    return url.origin;
  } catch {
    return fallback;
  }
}

function resolveAccountSiteFetchBaseUrl(siteBaseUrl) {
  if (isProductionRuntime) return siteBaseUrl;
  // The portable test runtime uses the production website for public data and
  // for the real account flow, because local homologation does not exist on a
  // second computer. Its userData and secure storage remain isolated locally.
  if (isPortableTestRuntime) return "https://tibiatoolkit.com";
  try {
    const url = new URL(siteBaseUrl);
    // Windows/Electron can fail to resolve the custom .localhost alias even
    // while the browser resolves it. Keep the alias for browser navigation,
    // but use the loopback listener for private main-process fetches.
    if (url.hostname.endsWith(".localhost")) {
      return `http://127.0.0.1:${url.port}`;
    }
  } catch {
    // Keep the validated site origin as the fallback.
  }
  return siteBaseUrl;
}

function readLocalHomologationAccountConfig() {
  if (usesProductionAuthentication) return {};
  try {
    const configPath = path.join(projectRoot, "desktop", "auth-homologation.local.json");
    const raw = JSON.parse(fsSync.readFileSync(configPath, "utf8"));
    const authBaseUrl = String(raw?.authBaseUrl || "").trim();
    const siteBaseUrl = String(raw?.siteBaseUrl || "").trim();
    return {
      authBaseUrl: /^https?:\/\/127\.0\.0\.1:\d+$/.test(authBaseUrl) ? authBaseUrl : "",
      siteBaseUrl: /^https?:\/\/[a-z0-9-]+\.localhost:\d+$/.test(siteBaseUrl) ? siteBaseUrl : ""
    };
  } catch {
    return {};
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
// Alert timers may finish while the app is unfocused or hidden.  Allow the
// dedicated, sandboxed audio runtime to start playback without a fresh user
// gesture so Windows receives a real Tibia Toolkit audio session.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
const machineAppDataRoot = app.getPath("appData");
const portableRoot = isPortableTestRuntime ? path.dirname(process.execPath) : "";
const portableDataRoot = isPortableTestRuntime ? path.join(portableRoot, "Data") : "";
if (isPortableTestRuntime) {
  fsSync.mkdirSync(path.join(portableDataRoot, "AppData"), { recursive: true });
  fsSync.mkdirSync(path.join(portableDataRoot, "Documents"), { recursive: true });
  app.setPath("documents", path.join(portableDataRoot, "Documents"));
}
const runtimeUserDataPath = isPortableTestRuntime
  ? path.join(portableDataRoot, "AppData")
  : path.join(machineAppDataRoot, runtimeIdentity.userDataDirectoryName);
app.setPath("userData", runtimeUserDataPath);
app.setAppUserModelId(runtimeAppUserModelId);
if (!app.isPackaged) {
  app.commandLine.appendSwitch("disable-http-cache");
}
const overlayStorePath = path.join(app.getPath("userData"), "overlay-storage.json");
const overlayToolsStorePath = path.join(app.getPath("userData"), "overlay-tools-storage.json");
const desktopScreenshotSettingsPath = path.join(app.getPath("userData"), "screenshot-settings.json");
const obsWebSocketPasswordStorageKey = "obsWebSocketPasswordEncrypted";
const accountAccessTokenStorageKey = "accountAccessTokenEncrypted";
const accountStateSnapshotStorageKey = "accountStateSnapshotEncrypted";
const accountInstallationIdStorageKey = "accountInstallationId";
const portableProtectedStorageKeys = new Set([
  obsWebSocketPasswordStorageKey,
  accountAccessTokenStorageKey,
  accountStateSnapshotStorageKey,
  accountInstallationIdStorageKey
]);
const portableSecureStorePath = isPortableTestRuntime
  ? path.join(
      machineAppDataRoot,
      runtimeIdentity.userDataDirectoryName,
      portableMarker.portableId,
      "secure-storage.json"
    )
  : "";
let accountSessionRevision = 0;
let mirrorAccountStateSnapshot = {
  connected: false,
  entitlements: []
};

function setMirrorAccountStateSnapshot(accountState = {}) {
  mirrorAccountStateSnapshot = {
    connected: accountState?.connected === true,
    entitlements: Array.isArray(accountState?.entitlements)
      ? accountState.entitlements.map((entry) => String(entry || "").trim()).filter(Boolean)
      : []
  };
  return mirrorAccountStateSnapshot;
}

function getMirrorAccountStateSnapshot() {
  return mirrorAccountStateSnapshot;
}

const accountAuthBaseUrl = resolveAccountAuthBaseUrl();
const accountSiteBaseUrl = resolveAccountSiteBaseUrl();
const accountSiteFetchBaseUrl = resolveAccountSiteFetchBaseUrl(accountSiteBaseUrl);
const libraryContentSource = resolveLibraryContentSource({
  isProductionRuntime: usesProductionDataServices,
  accountSiteBaseUrl: accountSiteFetchBaseUrl,
  accountAuthBaseUrl
});
const libraryCatalogSiteBaseUrl = libraryContentSource.siteBaseUrl;
const libraryCatalogApiBaseUrl = libraryContentSource.apiBaseUrl;
const libraryCatalogOverlayActivePath = path.join(app.getPath("userData"), "library-catalog", "active.json");
const libraryCatalogOverlayPendingPath = path.join(app.getPath("userData"), "library-catalog", "pending.json");
const libraryCatalogMediaActivePath = path.join(app.getPath("userData"), "library-catalog", "media-active.json");
const libraryCatalogMediaPendingPath = path.join(app.getPath("userData"), "library-catalog", "media-pending.json");
const libraryCatalogMediaBlobsRoot = path.join(app.getPath("userData"), "library-catalog", "media-blobs");
const libraryCatalogBaseActivePath = path.join(app.getPath("userData"), "library-catalog", "base-active.json");
const libraryCatalogBasePendingPath = path.join(app.getPath("userData"), "library-catalog", "base-pending.json");
const libraryCatalogBaseStatePath = path.join(app.getPath("userData"), "library-catalog", "base-state.json");
const libraryCatalogCheckMinimumIntervalMs = 60_000;
const libraryCatalogSignalIntervalMs = 30_000;
const libraryCatalogMediaGcGraceMs = 7 * 24 * 60 * 60 * 1000;
let libraryCatalogOverlayActive = createEmptyLibraryCatalogOverlay();
let libraryCatalogOverlayPending = null;
let libraryCatalogMediaActive = {};
let libraryCatalogMediaPending = null;
let libraryCatalogBaseActiveHash = "";
let libraryCatalogBasePendingHash = "";
let libraryContentSyncState = {
  phase: "idle",
  pendingChanges: 0,
  cursor: null,
  lastCheckedAt: null,
  error: null,
  sourceMode: libraryContentSource.mode
};
let libraryContentSyncPromise = null;
let libraryContentNextCheckAt = 0;
let libraryCatalogSignalTimer = null;
let libraryCatalogSignalEtag = "";
const accountDesktopClientId = usesProductionAuthentication
  ? "tibia-toolkit-desktop"
  : String(process.env.TIBIA_TOOLKIT_AUTH_CLIENT_ID || "tibia-toolkit-desktop-local").trim();
const legacyTibiaToolsDocumentsDir = path.join(app.getPath("documents"), "TibiaTools");
const tibiaToolsDocumentsDir = path.join(app.getPath("documents"), runtimeIdentity.documentsDirectoryName);
const appDocumentsDataDir = path.join(tibiaToolsDocumentsDir, "Dados");
const screenVisionCustomAudioDir = path.join(tibiaToolsDocumentsDir, "audios");
const runtimeCacheStorePath = path.join(appDocumentsDataDir, "cache-storage.json");
const screenVisionSpellSoundMap = new Map(
  [...SCREEN_VISION_SPELL_PRESETS, ...SCREEN_VISION_POTION_PRESETS]
    .filter((preset) => preset?.soundKey && preset.soundKey !== "default" && preset.soundPath)
    .map((preset) => [
      preset.soundKey,
      String(preset.soundPath).replaceAll("\\", "/")
    ])
);
const screenVisionProfilesDir = path.join(app.getPath("userData"), "ScreenVision", "Profiles");
const screenVisionWindowProofPath = path.join(app.getPath("userData"), "ScreenVision", "window-proofs.json");
const screenVisionActiveSourceGamePath = path.join(app.getPath("userData"), "ScreenVision", "active-source-game.json");
const screenVisionProfileExportDirectoryStorageKey = "screenVisionProfileExportDirectory";
const screenVisionLastProfilePath = path.join(app.getPath("userData"), "ScreenVision", "last-profile.txt");
const assetCacheRoot = path.join(app.getPath("userData"), "assets-cache");
const debugLogPath = path.join(app.getPath("userData"), "desktop-debug.log");
const performanceMetricsPath = path.join(app.getPath("userData"), "performance-metrics.jsonl");
const diagnosticsQueuePath = path.join(app.getPath("userData"), "diagnostics-pending.jsonl");
const diagnosticsConsentStorageKey = "diagnosticsConsent";
const diagnosticsRemindAtStorageKey = "diagnosticsRemindAt";
let diagnosticsConsentPromptScheduled = false;
const defaultOverlayOpacity = 1;
const overlayBoundsSaveDelayMs = 250;
const bootstrapAssetsRoot = path.join(projectRoot, "desktop", "build", "bootstrap");
const appIconPath = path.join(bootstrapAssetsRoot, "loading-emblem.png");
const splashIconPath = path.join(bootstrapAssetsRoot, "loading-emblem.png");
const runtimeConfigPath = path.join(projectRoot, "desktop", "app-config.json");
const supportersRankingRatesCacheMs = 30 * 60 * 1000;
const defaultSupportersUsdToBrl = 5;
const defaultSupportersTibiaCoinBrl = 0.21;
const closePreferenceStorageKey = "appClosePreference";
const tibiaWindowProbeScriptPath = path.join(projectRoot, "desktop", "screen-vision", "tibia-window-probe.ps1");
const windowBoundsProbeScriptPath = path.join(projectRoot, "desktop", "screen-vision", "window-bounds-probe.ps1");
const nativeHostProjectPath = path.join(projectRoot, "desktop", "screen-vision-native", "ScreenVision.NativeHost", "ScreenVision.NativeHost.csproj");
const nativeHostPublishedExePath = isPortableTestRuntime
  ? path.join(process.resourcesPath, "native-host", "ScreenVision.NativeHost.exe")
  : path.join(projectRoot, "desktop", "screen-vision-native", "publish", "win-x64", "ScreenVision.NativeHost.exe");
const nativeHostDevelopmentOutputPath = path.join(projectRoot, ".local", "build", "screen-vision-native", "win-x64");
const nativeHostDevelopmentExePath = path.join(nativeHostDevelopmentOutputPath, "ScreenVision.NativeHost.exe");
let supportersRankingRatesCache = null;

function parseSupporterRankingDecimal(value) {
  const compact = String(value ?? "").trim().replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
  if (!compact || !/\d/.test(compact)) return 0;

  const decimalIndex = Math.max(compact.lastIndexOf(","), compact.lastIndexOf("."));
  const hasDecimals = decimalIndex >= 0 && /^\d{1,2}$/.test(compact.slice(decimalIndex + 1).replace(/[^\d]/g, ""));
  const whole = (hasDecimals ? compact.slice(0, decimalIndex) : compact).replace(/[^\d]/g, "");
  const fraction = hasDecimals ? compact.slice(decimalIndex + 1).replace(/[^\d]/g, "") : "";
  return Number(`${whole || "0"}.${(fraction || "0").slice(0, 2)}`) || 0;
}

async function fetchSupportersRankingText(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await electronNet.fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getSupportersUsdToBrl() {
  for (let daysAgo = 0; daysAgo < 8; daysAgo += 1) {
    const date = new Date(Date.now() - daysAgo * 86_400_000);
    const dateText = `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}-${date.getUTCFullYear()}`;
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?%40dataCotacao='${dateText}'&%24top=1&%24format=json&%24select=cotacaoVenda`;
    try {
      const payload = JSON.parse(await fetchSupportersRankingText(url, 3_000));
      const rate = Number(payload?.value?.[0]?.cotacaoVenda);
      if (Number.isFinite(rate) && rate > 0) return rate;
    } catch {
      // PTAX is absent on holidays and weekends, so the previous business day is tried.
    }
  }
  return defaultSupportersUsdToBrl;
}

async function getSupportersTibiaCoinBrl() {
  try {
    const html = await fetchSupportersRankingText("https://www.gamerbank.com.br/tibia-coins/venda-250-tibia-coins", 4_000);
    const match = html.match(/class=["']product-price["'][^>]*>\s*R\$\s*([\d.,]+)/i);
    const packagePrice = parseSupporterRankingDecimal(match?.[1]);
    if (packagePrice > 0) return packagePrice / 250;
  } catch {
    // The locally documented fallback preserves ranking availability if the reseller page is unavailable.
  }
  return defaultSupportersTibiaCoinBrl;
}

async function getSupportersRankingRates() {
  if (supportersRankingRatesCache?.expiresAt > Date.now()) {
    return supportersRankingRatesCache;
  }

  const [usdToBrl, tibiaCoinBrl] = await Promise.all([
    getSupportersUsdToBrl(),
    getSupportersTibiaCoinBrl()
  ]);

  supportersRankingRatesCache = {
    usdToBrl,
    tibiaCoinBrl,
    expiresAt: Date.now() + supportersRankingRatesCacheMs
  };
  return supportersRankingRatesCache;
}

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
const nativeHostDotnetPath = path.join(projectRoot, "third_party", "dotnet", "sdk", "dotnet.exe");
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
let tutorialPopoverWindow = null;
let tutorialPopoverResizePlacement = "right";
let tutorialPriorityOwner = null;
let desktopScreenshotFolderCreationHelpActive = false;
let desktopScreenshotFolderCreationHelpResolver = null;
let desktopScreenshotAssistantHelpStep = 0;
let windowMoveHandleWindow = null;
let windowMoveHandleTooltipWindow = null;
let windowMoveHandleTooltipPromise = null;
let windowMoveHandleTooltipRequestToken = 0;
let windowMoveHandleSide = "left";
let windowMoveHandleDragState = null;
let mirrorGameSelectorWindow = null;
let mirrorGameSelectorRequestedVisible = false;
let mirrorGameSelectorTutorialFocus = false;
let activeMirrorSourceGame = "tibia";
let mirrorSourceSelectionPromise = null;
let mirrorGameAvailability = { tibia: false, rubinot: false, medivia: false };
let mirrorGameAvailabilityCheckedAt = 0;
let mirrorGameAvailabilityRefreshPromise = null;
let mirrorGameAvailabilityTimer = null;
// Session-only evidence for protected clients. It is never written to a
// profile and only restores a HWND after the Native Host independently checks
// the same PID, visibility and non-minimized state.
const mirrorSourceWindowProofs = new Map();
// Emergency rollback: setting this environment flag restores the previous
// Tibia-only runtime without touching existing profile data.
const multiClientMirrorEnabled = process.env.TIBIA_TOOLKIT_MULTI_CLIENT_MIRROR !== "0";
let supportersShowcaseWindow = null;
let supportersShowcasePayload = { supporters: [] };
let supportersShowcaseTutorialFocus = "";
let desktopAdsShowcaseWindow = null;
let desktopAdsShowcasePayload = null;
let desktopAdsShowcaseReady = false;
let wheelInformationWindow = null;
let wheelInformationAnchor = null;
let tutorialExpandedWindowBounds = null;
const screenVisionWindows = new Map();
const countdownEditorWindows = new Map();
const alertPositionEditorWindows = new Map();
let dockedToolPanelKey = "";
let dockedToolPanelSide = "right";
let dockedToolPanelAnimationTimer = null;
let dockedToolPanelBoundsAnimationInFlight = false;
let desktopScreenshotSelector = null;
let desktopScreenshotDirectoryWatcher = null;
let desktopScreenshotDirectoryWatcherPath = "";
let desktopScreenshotWatcherRetryTimer = null;
let desktopScreenshotWatcherStartedAt = 0;
const desktopScreenshotSeenFiles = new Map();
let desktopScreenshotAssistantWindow = null;
let desktopScreenshotAssistantDismissed = false;
let desktopScreenshotAssistantNewCount = 0;
let desktopScreenshotAssistantOpenedAt = 0;
let desktopScreenshotAssistantHelpActive = false;
let desktopScreenshotDiscoveryPromise = null;
let desktopScreenshotDiscoveryPromiseKey = "";
let desktopScreenshotDiscoveryCache = null;
let desktopScreenshotDiscoveryRequestId = 0;
let desktopScreenshotWatcherRequestId = 0;
let desktopScreenshotDirectoryOpenPromise = null;
let desktopGlobalWorldPickerWindow = null;
let desktopGlobalWorldPickerOwner = null;
let dockedToolPanelBaseBounds = null;
let dockedToolPanelIsOpen = false;
let dockedToolPanelPhase = "closed";
let lastDockedToolPanelRendererContextSignature = "";
const dockedToolPanelOpenDurationMs = 220;
const dockedToolPanelCloseDurationMs = 180;
const screenVisionSessionConfirmSkips = new Map();
const screenVisionConfirmDialogWindows = new Map();
let splashWindow = null;
let splashProgress = 0;
let splashStatus = "Preparando interface";

const TUTORIAL_PRELOAD_ASSETS = [
  "assets/ui/tutorial/continuar.png",
  "assets/ui/Tick.png",
  "assets/ui/tutorial/openscreenshotfolder.png",
  "assets/ui/Cross.png"
];

const WINDOW_MOVE_HANDLE_SIZE = 46;
const WINDOW_MOVE_HANDLE_GAP = 6;
const WINDOW_MOVE_HANDLE_HEADER_OFFSET = 8;
const WINDOW_MOVE_HANDLE_TOOLTIP_WIDTH = 286;
const WINDOW_MOVE_HANDLE_TOOLTIP_HEIGHT = 42;
const MIRROR_GAME_SELECTOR_BUTTON_SIZE = 32;
const MIRROR_GAME_SELECTOR_GAP = 4;
const MIRROR_GAME_SELECTOR_GAP_FROM_APP = WINDOW_MOVE_HANDLE_GAP;
const MIRROR_GAME_SELECTOR_GAP_FROM_HANDLE = 4;
const MIRROR_GAME_SELECTOR_PADDING = 4;
const MIRROR_GAME_SELECTOR_WIDTH = MIRROR_GAME_SELECTOR_BUTTON_SIZE + (MIRROR_GAME_SELECTOR_PADDING * 2);
const MIRROR_GAME_SELECTOR_HEIGHT = (MIRROR_GAME_SELECTOR_BUTTON_SIZE * 3) + (MIRROR_GAME_SELECTOR_GAP * 2) + (MIRROR_GAME_SELECTOR_PADDING * 2);
const SUPPORTERS_SHOWCASE_WIDTH = 260;
const SUPPORTERS_SHOWCASE_HEIGHT = 86;
const SUPPORTERS_SHOWCASE_GAP = 6;
const SUPPORTERS_SHOWCASE_CONTENT_TOP = 40;
const SUPPORTERS_COFFEE_SIZE = 46;
const SUPPORTERS_COFFEE_GAP = 6;
const DESKTOP_ADS_SHOWCASE_HEIGHT = 160;
const DESKTOP_ADS_SHOWCASE_GAP = 6;
// Three 16:9 cards at the existing maximum showcase height, including
// padding and gaps. Narrower app widths shrink the cards proportionally.
const DESKTOP_ADS_SHOWCASE_MAX_WIDTH = 848;

function getDesktopAdsShowcaseHeight(width) {
  const contentWidth = Math.max(0, width - 4);
  const cardWidth = Math.max(0, (contentWidth - 12) / 3);
  const cardHeight = cardWidth * 9 / 16;
  return Math.min(DESKTOP_ADS_SHOWCASE_HEIGHT, Math.max(4, Math.ceil(cardHeight) + 4));
}

function getSupportersShowcaseCarouselWidth(mainBounds) {
  return clamp(Math.round(Number(mainBounds?.width || SUPPORTERS_SHOWCASE_WIDTH) * 0.8), 220, 420);
}

function getSupportersShowcaseWidth(mainBounds) {
  return getSupportersShowcaseCarouselWidth(mainBounds) + SUPPORTERS_COFFEE_SIZE + SUPPORTERS_COFFEE_GAP;
}

function getWindowMoveHandleVirtualWorkArea() {
  const displays = screen.getAllDisplays();
  if (!displays.length) {
    return { x: 0, y: 0, width: 0, height: 0, right: 0, bottom: 0 };
  }

  const left = Math.min(...displays.map((display) => display.workArea.x));
  const top = Math.min(...displays.map((display) => display.workArea.y));
  const right = Math.max(...displays.map((display) => display.workArea.x + display.workArea.width));
  const bottom = Math.max(...displays.map((display) => display.workArea.y + display.workArea.height));
  return { x: left, y: top, width: right - left, height: bottom - top, right, bottom };
}

function getWindowMoveHandleTooltipText() {
  const locale = normalizeLocale(getActiveLocale());
  if (locale === "en") return "Drag to move the application window";
  if (locale === "de") return "Ziehen, um das Anwendungsfenster zu verschieben";
  return "Arraste para mover a janela do aplicativo";
}

function getMirrorGameSelectorLabels() {
  const locale = normalizeLocale(getActiveLocale());
  if (locale === "en") {
    return {
      tibia: "Connect Tibia Mirror to Tibia",
      rubinot: "Connect Tibia Mirror to RubinOT",
      medivia: "Connect Tibia Mirror to Medivia"
    };
  }
  if (locale === "de") {
    return {
      tibia: "Tibia Mirror mit Tibia verbinden",
      rubinot: "Tibia Mirror mit RubinOT verbinden",
      medivia: "Tibia Mirror mit Medivia verbinden"
    };
  }
  return {
    tibia: "Conectar Tibia Mirror ao Tibia",
    rubinot: "Conectar Tibia Mirror ao RubinOT",
    medivia: "Conectar Tibia Mirror ao Medivia"
  };
}

function getMirrorGameUnavailableLabels() {
  const locale = normalizeLocale(getActiveLocale());
  if (locale === "en") {
    return {
      tibia: "Open Tibia first",
      rubinot: "Open the RubinOT window first",
      medivia: "Log in to Medivia first"
    };
  }
  if (locale === "de") {
    return {
      tibia: "Öffne zuerst Tibia",
      rubinot: "Öffne zuerst das RubinOT-Fenster",
      medivia: "Melde dich zuerst bei Medivia an"
    };
  }
  return {
    tibia: "Abra o Tibia primeiro",
    rubinot: "Abra a janela do RubinOT primeiro",
    medivia: "Logue no Medivia primeiro"
  };
}

function getMirrorGameSelectorBounds(mainBounds) {
  const area = getWindowMoveHandleVirtualWorkArea();
  const displayArea = screen.getDisplayMatching(mainBounds).workArea;
  windowMoveHandleSide = resolveWindowMoveHandleSide(mainBounds, windowMoveHandleSide);
  const handleBounds = getWindowMoveHandleBounds(mainBounds, windowMoveHandleSide);
  const preferredX = windowMoveHandleSide === "left"
    ? mainBounds.x - MIRROR_GAME_SELECTOR_GAP_FROM_APP - MIRROR_GAME_SELECTOR_WIDTH
    : mainBounds.x + mainBounds.width + MIRROR_GAME_SELECTOR_GAP_FROM_APP;
  return {
    x: clamp(Math.round(preferredX), area.x, area.right - MIRROR_GAME_SELECTOR_WIDTH),
    y: Math.max(displayArea.y, Math.min(
      Math.round(handleBounds.y + handleBounds.height + MIRROR_GAME_SELECTOR_GAP_FROM_HANDLE),
      displayArea.y + displayArea.height - MIRROR_GAME_SELECTOR_HEIGHT
    )),
    width: MIRROR_GAME_SELECTOR_WIDTH,
    height: MIRROR_GAME_SELECTOR_HEIGHT
  };
}

function shouldShowMirrorGameSelector() {
  return Boolean(
    multiClientMirrorEnabled
    && (mirrorGameSelectorRequestedVisible || mirrorGameSelectorTutorialFocus)
    && (!isTutorialPriorityActive() || mirrorGameSelectorTutorialFocus)
    && mainWindow
    && !mainWindow.isDestroyed()
    && mainWindow.isVisible()
    && !mainWindow.isMinimized()
  );
}

function getMirrorGameSelectorIcons() {
  const candidates = {
    tibia: "assets/ui/tools/tibia-eye/client-sources/tibia.png",
    rubinot: "assets/ui/tools/tibia-eye/client-sources/rubinot.png",
    medivia: "assets/ui/tools/tibia-eye/client-sources/medivia.png"
  };
  const fallback = getRuntimeContentUrl("assets/ui/tools/tibia-eye/tibia-mirror-tab.gif");
  return Object.fromEntries(Object.entries(candidates).map(([game, assetPath]) => {
    try {
      const icon = nativeImage.createFromPath(resolveRuntimeFilePath(assetPath));
      return [game, icon.isEmpty() ? fallback : icon.resize({ width: 20, height: 20 }).toDataURL()];
    } catch {
      return [game, fallback];
    }
  }));
}

function emitMirrorGameSelectorRender(extra = {}) {
  if (!mirrorGameSelectorWindow || mirrorGameSelectorWindow.isDestroyed()) return;
  mirrorGameSelectorWindow.webContents.send("mirror-game-selector:render", {
    activeGame: activeMirrorSourceGame,
    labels: getMirrorGameSelectorLabels(),
    unavailableLabels: getMirrorGameUnavailableLabels(),
    availability: { ...mirrorGameAvailability },
    icons: getMirrorGameSelectorIcons(),
    tutorialFocus: mirrorGameSelectorTutorialFocus,
    ...extra
  });
}

async function refreshMirrorGameSelectorAvailability({ force = false } = {}) {
  if (!mirrorGameSelectorWindow || mirrorGameSelectorWindow.isDestroyed()) return mirrorGameAvailability;
  if (mirrorGameAvailabilityRefreshPromise) return mirrorGameAvailabilityRefreshPromise;
  if (!force && Date.now() - mirrorGameAvailabilityCheckedAt < 1500) return mirrorGameAvailability;

  mirrorGameAvailabilityRefreshPromise = (async () => {
    const [tibiaState, rubinotState, mediviaState] = await Promise.all([
      getMirrorSourceGameState("tibia", { forceFresh: force }).catch(() => null),
      getMirrorSourceGameState("rubinot", { forceFresh: force }).catch(() => null),
      getMirrorSourceGameState("medivia", { forceFresh: force }).catch(() => null)
    ]);
    mirrorGameAvailability = {
      tibia: canUseTibiaWindowForScreenVision(tibiaState),
      rubinot: canUseTibiaWindowForScreenVision(rubinotState),
      medivia: canUseTibiaWindowForScreenVision(mediviaState)
    };
    mirrorGameAvailabilityCheckedAt = Date.now();
    emitMirrorGameSelectorRender();
    return mirrorGameAvailability;
  })();

  try {
    return await mirrorGameAvailabilityRefreshPromise;
  } finally {
    mirrorGameAvailabilityRefreshPromise = null;
  }
}

function syncMirrorGameSelector(options = {}) {
  if (!mirrorGameSelectorWindow || mirrorGameSelectorWindow.isDestroyed()) return;
  if (!shouldShowMirrorGameSelector()) {
    mirrorGameSelectorWindow.hide();
    return;
  }
  mirrorGameSelectorWindow.setBounds(getMirrorGameSelectorBounds(mainWindow.getBounds()), false);
  mirrorGameSelectorWindow.setAlwaysOnTop(true, "floating");
  mirrorGameSelectorWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (options.forceShow || !mirrorGameSelectorWindow.isVisible()) mirrorGameSelectorWindow.showInactive();
  emitMirrorGameSelectorRender();
  void refreshMirrorGameSelectorAvailability();
}

function closeMirrorGameSelector() {
  if (mirrorGameAvailabilityTimer) clearInterval(mirrorGameAvailabilityTimer);
  mirrorGameAvailabilityTimer = null;
  if (mirrorGameSelectorWindow && !mirrorGameSelectorWindow.isDestroyed()) mirrorGameSelectorWindow.destroy();
  mirrorGameSelectorWindow = null;
}

async function ensureMirrorGameSelector(owner = mainWindow) {
  if (!multiClientMirrorEnabled || !owner || owner.isDestroyed()) return null;
  if (mirrorGameSelectorWindow && !mirrorGameSelectorWindow.isDestroyed()) return mirrorGameSelectorWindow;
  const selector = new BrowserWindow({
    width: MIRROR_GAME_SELECTOR_WIDTH,
    height: MIRROR_GAME_SELECTOR_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    parent: owner,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "mirror-game-selector-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mirrorGameSelectorWindow = selector;
  selector.on("closed", () => {
    if (mirrorGameAvailabilityTimer) clearInterval(mirrorGameAvailabilityTimer);
    mirrorGameAvailabilityTimer = null;
    if (mirrorGameSelectorWindow === selector) mirrorGameSelectorWindow = null;
  });
  await selector.loadFile(path.join(__dirname, "mirror-game-selector.html"));
  mirrorGameAvailabilityTimer = setInterval(() => {
    if (shouldShowMirrorGameSelector()) void refreshMirrorGameSelectorAvailability();
  }, 2000);
  if (!selector.isDestroyed()) syncMirrorGameSelector({ forceShow: true });
  return selector;
}

function resolveWindowMoveHandleSide(mainBounds, currentSide = "left") {
  const area = getWindowMoveHandleVirtualWorkArea();
  const leftFits = mainBounds.x - WINDOW_MOVE_HANDLE_GAP - WINDOW_MOVE_HANDLE_SIZE >= area.x;
  const rightFits = mainBounds.x + mainBounds.width + WINDOW_MOVE_HANDLE_GAP + WINDOW_MOVE_HANDLE_SIZE <= area.right;

  if (currentSide === "left" && leftFits) return "left";
  if (currentSide === "right" && rightFits) return "right";
  if (currentSide === "left" && rightFits) return "right";
  if (currentSide === "right" && leftFits) return "left";
  return (mainBounds.x - area.x) >= (area.x + area.width - (mainBounds.x + mainBounds.width)) ? "left" : "right";
}

function getWindowMoveHandleBounds(mainBounds, side) {
  const area = getWindowMoveHandleVirtualWorkArea();
  const verticalArea = screen.getDisplayMatching(mainBounds).workArea;
  const preferredX = side === "left"
    ? mainBounds.x - WINDOW_MOVE_HANDLE_GAP - WINDOW_MOVE_HANDLE_SIZE
    : mainBounds.x + mainBounds.width + WINDOW_MOVE_HANDLE_GAP;
  return {
    x: clamp(Math.round(preferredX), area.x, area.right - WINDOW_MOVE_HANDLE_SIZE),
    y: clamp(
      Math.round(mainBounds.y + WINDOW_MOVE_HANDLE_HEADER_OFFSET),
      verticalArea.y,
      verticalArea.y + verticalArea.height - WINDOW_MOVE_HANDLE_SIZE
    ),
    width: WINDOW_MOVE_HANDLE_SIZE,
    height: WINDOW_MOVE_HANDLE_SIZE
  };
}

function getWindowMoveHandleTooltipBounds(handleBounds, mainBounds, side) {
  const area = getWindowMoveHandleVirtualWorkArea();
  const verticalArea = screen.getDisplayMatching(mainBounds).workArea;
  const preferredX = side === "left"
    ? handleBounds.x
    : handleBounds.x + handleBounds.width - WINDOW_MOVE_HANDLE_TOOLTIP_WIDTH;
  return {
    x: clamp(preferredX, area.x + 4, area.right - WINDOW_MOVE_HANDLE_TOOLTIP_WIDTH - 4),
    y: clamp(
      handleBounds.y + handleBounds.height + 4,
      verticalArea.y + 4,
      verticalArea.y + verticalArea.height - WINDOW_MOVE_HANDLE_TOOLTIP_HEIGHT - 4
    ),
    width: WINDOW_MOVE_HANDLE_TOOLTIP_WIDTH,
    height: WINDOW_MOVE_HANDLE_TOOLTIP_HEIGHT
  };
}

function getSupportersShowcaseBounds(mainBounds) {
  const area = getWindowMoveHandleVirtualWorkArea();
  const verticalArea = screen.getDisplayMatching(mainBounds).workArea;
  const width = getSupportersShowcaseWidth(mainBounds);
  const centeredX = mainBounds.x + Math.round((mainBounds.width - width) / 2);
  const preferredY = mainBounds.y - SUPPORTERS_SHOWCASE_GAP - SUPPORTERS_SHOWCASE_HEIGHT;

  return {
    x: clamp(centeredX, area.x, area.right - width),
    y: clamp(preferredY, verticalArea.y, verticalArea.y + verticalArea.height - SUPPORTERS_SHOWCASE_HEIGHT),
    width,
    height: SUPPORTERS_SHOWCASE_HEIGHT
  };
}

function syncSupportersShowcase(options = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !supportersShowcaseWindow || supportersShowcaseWindow.isDestroyed()) {
    return;
  }

  if (!mainWindow.isVisible() || mainWindow.isMinimized() || supportersShowcasePayload.supporters.length <= 0) {
    supportersShowcaseWindow.hide();
    return;
  }

  supportersShowcaseWindow.setBounds(getSupportersShowcaseBounds(mainWindow.getBounds()), false);
  supportersShowcaseWindow.setAlwaysOnTop(true, "floating");
  supportersShowcaseWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (options.forceShow || !supportersShowcaseWindow.isVisible()) {
    supportersShowcaseWindow.showInactive();
  }
  if (tutorialPopoverWindow && !tutorialPopoverWindow.isDestroyed() && tutorialPopoverWindow.isVisible()) {
    tutorialPopoverWindow.setAlwaysOnTop(true, "screen-saver");
    tutorialPopoverWindow.moveTop();
  }
}

function getDesktopAdsShowcaseBounds(mainBounds) {
  const area = getWindowMoveHandleVirtualWorkArea();
  const displayArea = screen.getDisplayMatching(mainBounds).workArea;
  // TibiaVision divides the owner's usable width equally among its ad cards.
  // Keep the same rule here so three cards fit at maximum size and shrink
  // together with the app instead of introducing a second arbitrary width.
  const width = clamp(
    Math.round(Number(mainBounds?.width || 560)),
    420,
    Math.min(displayArea.width, area.width, DESKTOP_ADS_SHOWCASE_MAX_WIDTH)
  );
  const height = getDesktopAdsShowcaseHeight(width);
  const belowY = mainBounds.y + mainBounds.height + DESKTOP_ADS_SHOWCASE_GAP;
  const supportersTop = mainBounds.y - SUPPORTERS_SHOWCASE_GAP - SUPPORTERS_SHOWCASE_HEIGHT + SUPPORTERS_SHOWCASE_CONTENT_TOP;
  const aboveAnchorY = supportersShowcasePayload.supporters.length > 0 ? supportersTop : mainBounds.y;
  const aboveY = aboveAnchorY - DESKTOP_ADS_SHOWCASE_GAP - height;
  const fitsBelow = belowY + height <= displayArea.y + displayArea.height;
  const centeredX = mainBounds.x + Math.round((mainBounds.width - width) / 2);
  return {
    x: clamp(centeredX, area.x, area.right - width),
    y: clamp(fitsBelow ? belowY : aboveY, displayArea.y, displayArea.y + displayArea.height - height),
    width,
    height
  };
}

function syncDesktopAdsShowcase(options = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !desktopAdsShowcaseWindow || desktopAdsShowcaseWindow.isDestroyed()) return;
  if (!desktopAdsShowcaseReady || !desktopAdsShowcasePayload || !mainWindow.isVisible() || mainWindow.isMinimized()) {
    desktopAdsShowcaseWindow.hide();
    return;
  }
  desktopAdsShowcaseWindow.setBounds(getDesktopAdsShowcaseBounds(mainWindow.getBounds()), false);
  // Os anuncios precisam ficar sobre a janela principal, mas abaixo de
  // instrucoes interativas como o tutorial. O nivel screen-saver empata com o
  // tutorial e pode cobrir o botao Continuar apos uma sincronizacao do anuncio.
  desktopAdsShowcaseWindow.setAlwaysOnTop(true, "floating");
  desktopAdsShowcaseWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const shouldShow = options.forceShow || !desktopAdsShowcaseWindow.isVisible();
  if (shouldShow) {
    desktopAdsShowcaseWindow.showInactive();
    desktopAdsShowcaseWindow.webContents.send("desktop-ads:resume");
  }
}

function notifyDesktopAdsShowcaseResume() {
  if (desktopAdsShowcaseWindow && !desktopAdsShowcaseWindow.isDestroyed() && desktopAdsShowcaseWindow.isVisible()) {
    desktopAdsShowcaseWindow.webContents.send("desktop-ads:resume");
  }
}

function closeDesktopAdsShowcase() {
  if (desktopAdsShowcaseWindow && !desktopAdsShowcaseWindow.isDestroyed()) desktopAdsShowcaseWindow.destroy();
  desktopAdsShowcaseWindow = null;
  desktopAdsShowcasePayload = null;
  desktopAdsShowcaseReady = false;
}

function resolveDesktopAdUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, accountSiteBaseUrl);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeDesktopAdsPayload(payload = {}) {
  const slots = Array.isArray(payload?.slots) ? payload.slots : [];
  const daniel = slots.find((slot) => slot?.id === "daniel-hatano" && slot?.kind === "image");
  const secondary = slots.find((slot) => slot?.id === "secondary-sponsor" && slot?.kind === "video-sequence");
  const items = Array.isArray(secondary?.items) ? secondary.items.map((item) => ({
    id: String(item?.id || "").trim(),
    mediaUrl: resolveDesktopAdUrl(item?.mediaUrl),
    posterUrl: resolveDesktopAdUrl(item?.posterUrl),
    href: resolveDesktopAdUrl(item?.href),
    label: String(item?.label || "Anúncio").trim().slice(0, 120)
  })).filter((item) => item.id && item.mediaUrl) : [];
  const orderedItems = [
    items.find((item) => item.id === "spytools"),
    items.find((item) => item.id === "new-campaign")
  ].filter(Boolean);
  if (!daniel?.mediaUrl || orderedItems.length < 2) return null;
  return {
    schemaVersion: 1,
    contactUrl: resolveDesktopAdUrl(payload?.contactUrl) || "mailto:parcerias@tibiatoolkit.com",
    daniel: {
      mediaUrl: resolveDesktopAdUrl(daniel.mediaUrl),
      href: resolveDesktopAdUrl(daniel.href),
      label: String(daniel.label || "Daniel Hatano").trim(),
      tooltip: normalizeLocale(getActiveLocale()) === "en"
        ? "Buy Tibia Coins from an Official CipSoft Reseller"
        : normalizeLocale(getActiveLocale()) === "de"
          ? "Tibia Coins bei einem offiziellen CipSoft-Reseller kaufen"
          : "Comprar Tibia Coins com Revendedor Oficial CipSoft"
    },
    secondary: orderedItems
  };
}

function createPortableDesktopAdsFallbackPayload() {
  if (!isPortableTestRuntime) return null;
  return normalizeDesktopAdsPayload({
    schemaVersion: 1,
    enabled: true,
    contactUrl: "https://wa.me/551148633602?text=Ol%C3%A1%2C%20quero%20anunciar%20no%20Tibia%20Toolkit",
    slots: [
      {
        id: "daniel-hatano",
        kind: "image",
        mediaUrl: "https://tibiatoolkit.com/ads/daniel-hatano.gif",
        href: "https://www.danielhatano.com.br/tibia/?tracking=tibiatoolkit",
        label: "Daniel Hatano",
        required: true
      },
      {
        id: "secondary-sponsor",
        kind: "video-sequence",
        items: [
          {
            id: "spytools",
            mediaUrl: "https://cdn.converteai.net/552dce04-930e-4636-af10-5a3aef1c9a33/67e6d13d7aa7ceecf020a32c/main.m3u8",
            posterUrl: "https://tibiatoolkit.com/ads/spytools-thumb.png",
            href: "https://lp.spytoolss.com/poioso?utm_source=tibiatoolkit&utm_medium=website&utm_campaign=anuncio",
            label: "SpyTools"
          },
          {
            id: "new-campaign",
            mediaUrl: "https://cms.tibiatoolkit.com/wp-content/uploads/2026/08/Anuncie-aqui1-360p.mp4",
            href: "https://wa.me/551148633602?text=Ol%C3%A1%2C%20quero%20anunciar%20no%20Tibia%20Toolkit",
            label: "Anuncie aqui"
          }
        ]
      }
    ]
  });
}

async function ensureDesktopAdsShowcase(owner = mainWindow) {
  if (!owner || owner.isDestroyed()) return null;
  if (desktopAdsShowcaseWindow && !desktopAdsShowcaseWindow.isDestroyed()) {
    desktopAdsShowcaseWindow.setParentWindow(owner);
    syncDesktopAdsShowcase({ forceShow: true });
    return desktopAdsShowcaseWindow;
  }
  desktopAdsShowcaseWindow = new BrowserWindow({
    width: 560,
    height: DESKTOP_ADS_SHOWCASE_HEIGHT,
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
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "ads-showcase-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const showcase = desktopAdsShowcaseWindow;
  showcase.on("closed", () => {
    if (desktopAdsShowcaseWindow === showcase) desktopAdsShowcaseWindow = null;
  });
  await showcase.loadFile(path.join(__dirname, "ads-showcase.html"));
  if (showcase.isDestroyed()) return null;
  showcase.webContents.send("desktop-ads:render", desktopAdsShowcasePayload);
  syncDesktopAdsShowcase();
  return showcase;
}

async function refreshDesktopAdsShowcase(accountStateOverride = null) {
  // Keep the last committed visual state while the entitlement check and ad
  // manifest request are in flight. Settings is allowed to revalidate the
  // account, but an unknown state must not make an existing ad flash away (or
  // make a hidden VIP ad appear) before the server has answered.
  const hasExistingShowcase = Boolean(
    desktopAdsShowcaseWindow
      && !desktopAdsShowcaseWindow.isDestroyed()
      && desktopAdsShowcasePayload
  );
  if (!hasExistingShowcase) {
    desktopAdsShowcaseReady = false;
  }
  const accountState = accountStateOverride || await getAccountState();
  const hasAdsRemoval = accountState?.connected === true
    && Array.isArray(accountState.entitlements)
    && accountState.entitlements.includes("ads.remove");

  // Commit the new visibility only after the account response is available.
  // A cached/offline response keeps the previously committed state instead of
  // turning a transient lookup failure into an ad disappearance.
  if (hasAdsRemoval) {
    closeDesktopAdsShowcase();
    return;
  }

  try {
    const response = await electronNet.fetch(`${accountSiteFetchBaseUrl}/api/desktop-ads`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = normalizeDesktopAdsPayload(await response.json());
    if (!payload) throw new Error("desktop ads manifest is incomplete");
    desktopAdsShowcasePayload = payload;
    const showcase = await ensureDesktopAdsShowcase(mainWindow);
    if (!showcase || showcase.isDestroyed()) return;
    showcase.webContents.send("desktop-ads:render", payload);
    syncDesktopAdsShowcase();
  } catch (error) {
    const portableFallback = createPortableDesktopAdsFallbackPayload();
    if (!desktopAdsShowcasePayload && portableFallback) {
      desktopAdsShowcasePayload = portableFallback;
      const showcase = await ensureDesktopAdsShowcase(mainWindow);
      if (showcase && !showcase.isDestroyed()) {
        showcase.webContents.send("desktop-ads:render", portableFallback);
        syncDesktopAdsShowcase();
      }
      void writeDebugLog(`desktop-ads-fallback source=portable-public reason=${error?.message || String(error)}`);
      return;
    }

    // If an ad was already visible, keep that valid visual state when only
    // the replacement manifest failed. An initial failure still leaves the
    // showcase hidden because there is no committed payload to display.
    const canKeepExistingShowcase = Boolean(
      desktopAdsShowcaseWindow
        && !desktopAdsShowcaseWindow.isDestroyed()
        && desktopAdsShowcasePayload
    );
    if (!canKeepExistingShowcase) {
      desktopAdsShowcasePayload = null;
      desktopAdsShowcaseReady = false;
      syncDesktopAdsShowcase();
    }
    void writeDebugLog(`desktop-ads-unavailable ${error?.message || String(error)}`);
  }
}

function closeSupportersShowcase() {
  if (supportersShowcaseWindow && !supportersShowcaseWindow.isDestroyed()) {
    supportersShowcaseWindow.destroy();
  }
  supportersShowcaseWindow = null;
  supportersShowcasePayload = { supporters: [] };
  supportersShowcaseTutorialFocus = "";
}

function normalizeSupportersShowcaseTutorialFocus(value) {
  const target = String(value || "").trim().toLowerCase();
  return target === "coffee" || target === "supporters" ? target : "";
}

async function getSupportersShowcaseTutorialFocusBounds(showcase, target) {
  if (!showcase || showcase.isDestroyed() || !target) return null;
  try {
    const selector = target === "coffee" ? "#coffee-button" : "#supporters-showcase";
    const rect = await showcase.webContents.executeJavaScript(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    })()`);
    if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y)) return null;
    const windowBounds = showcase.getBounds();
    return {
      x: windowBounds.x + Math.round(rect.x),
      y: windowBounds.y + Math.round(rect.y),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height))
    };
  } catch {
    return null;
  }
}

function normalizeSupportersShowcasePayload(payload = {}) {
  const supporters = Array.isArray(payload?.supporters) ? payload.supporters : [];
  return {
    supporters: supporters
      .slice(0, 5)
      .map((supporter) => ({
        name: String(supporter?.name || "").trim().slice(0, 80),
        tier: String(supporter?.tier || "default").trim().toLowerCase(),
        medalPath: String(supporter?.medalPath || "").trim(),
        backgroundPath: String(supporter?.backgroundPath || "").trim()
      }))
      .filter((supporter) => supporter.name && supporter.medalPath)
  };
}

async function ensureSupportersShowcase(owner = mainWindow) {
  if (!owner || owner.isDestroyed()) return null;
  if (supportersShowcaseWindow && !supportersShowcaseWindow.isDestroyed()) {
    supportersShowcaseWindow.setParentWindow(owner);
    syncSupportersShowcase({ forceShow: true });
    return supportersShowcaseWindow;
  }

  supportersShowcaseWindow = new BrowserWindow({
    width: getSupportersShowcaseWidth(owner.getBounds()),
    height: SUPPORTERS_SHOWCASE_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    parent: owner,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "supporters-showcase-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  try {
    supportersShowcaseWindow.setHasShadow(false);
  } catch {
  }

  const showcase = supportersShowcaseWindow;
  showcase.on("closed", () => {
    if (supportersShowcaseWindow === showcase) supportersShowcaseWindow = null;
  });
  await showcase.loadFile(path.join(__dirname, "supporters-showcase.html"));
  if (showcase.isDestroyed()) return null;
  showcase.webContents.send("supporters-showcase:render", supportersShowcasePayload);
  showcase.webContents.send("supporters-showcase:tutorial-focus", supportersShowcaseTutorialFocus);
  syncSupportersShowcase({ forceShow: true });
  return showcase;
}

async function updateSupportersShowcase(payload = {}) {
  supportersShowcasePayload = normalizeSupportersShowcasePayload(payload);
  if (supportersShowcasePayload.supporters.length <= 0) {
    syncSupportersShowcase();
    return;
  }

  const showcase = await ensureSupportersShowcase(mainWindow);
  if (!showcase || showcase.isDestroyed()) return;
  showcase.webContents.send("supporters-showcase:render", supportersShowcasePayload);
  syncSupportersShowcase({ forceShow: true });
}

async function ensureWindowMoveHandleTooltip(owner = mainWindow) {
  if (!owner || owner.isDestroyed()) return null;
  if (windowMoveHandleTooltipWindow && !windowMoveHandleTooltipWindow.isDestroyed()) {
    return windowMoveHandleTooltipWindow;
  }
  if (windowMoveHandleTooltipPromise) return windowMoveHandleTooltipPromise;

  windowMoveHandleTooltipPromise = (async () => {
    const tooltip = new BrowserWindow({
      width: WINDOW_MOVE_HANDLE_TOOLTIP_WIDTH,
      height: WINDOW_MOVE_HANDLE_TOOLTIP_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      focusable: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      parent: owner,
      hasShadow: false,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "window-move-handle-tooltip-preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    windowMoveHandleTooltipWindow = tooltip;
    tooltip.setIgnoreMouseEvents(true);
    tooltip.on("closed", () => {
      if (windowMoveHandleTooltipWindow === tooltip) windowMoveHandleTooltipWindow = null;
    });
    await tooltip.loadFile(path.join(__dirname, "window-move-handle-tooltip.html"));
    if (tooltip.isDestroyed()) return null;
    await writeDebugLog(`auxiliary-tooltip-created mode=${eagerAuxiliaryTooltips ? "eager" : "lazy"}`);
    return tooltip;
  })().catch(async (error) => {
    const tooltip = windowMoveHandleTooltipWindow;
    windowMoveHandleTooltipWindow = null;
    if (tooltip && !tooltip.isDestroyed()) tooltip.destroy();
    await writeDebugLog(`auxiliary-tooltip-create-failed error=${error?.message || error}`);
    return null;
  }).finally(() => {
    windowMoveHandleTooltipPromise = null;
  });
  return windowMoveHandleTooltipPromise;
}

function hideWindowMoveHandleTooltip() {
  windowMoveHandleTooltipRequestToken += 1;
  if (windowMoveHandleTooltipWindow && !windowMoveHandleTooltipWindow.isDestroyed()) {
    windowMoveHandleTooltipWindow.hide();
  }
}

async function showDesktopAdsTooltip(text, rect = {}, options = {}) {
  if (!desktopAdsShowcaseWindow || desktopAdsShowcaseWindow.isDestroyed()) return;
  const requestToken = ++windowMoveHandleTooltipRequestToken;
  const tooltip = await ensureWindowMoveHandleTooltip(mainWindow);
  if (!tooltip || tooltip.isDestroyed() || requestToken !== windowMoveHandleTooltipRequestToken) return;
  if (!desktopAdsShowcaseWindow || desktopAdsShowcaseWindow.isDestroyed()) return;
  const textLength = String(text || "").length;
  // The Daniel tooltip wraps to two lines but is shorter than the old 58-char
  // threshold. Give that middle-length copy the same room as the other
  // two-line ad tooltips so the last line is never clipped.
  const tooltipWidth = textLength > 120 ? 420 : textLength > 42 ? 360 : WINDOW_MOVE_HANDLE_TOOLTIP_WIDTH;
  const tooltipHeight = textLength > 120 ? 78 : textLength > 42 ? 64 : WINDOW_MOVE_HANDLE_TOOLTIP_HEIGHT;
  const adsBounds = desktopAdsShowcaseWindow.getBounds();
  const screenLeft = Number(rect.screenLeft);
  const screenTop = Number(rect.screenTop);
  const cardLeft = Number.isFinite(screenLeft)
    ? screenLeft
    : adsBounds.x + Number(rect.left || 0);
  const cardTop = Number.isFinite(screenTop)
    ? screenTop
    : adsBounds.y + Number(rect.top || 0);
  const cardWidth = Math.max(1, Number(rect.width) || 0);
  const cardHeight = Math.max(1, Number(rect.height) || 0);
  const centerX = cardLeft + cardWidth / 2;
  const area = getWindowMoveHandleVirtualWorkArea();
  const gap = 7;
  const preferredTop = cardTop - tooltipHeight - gap;
  const fallbackTop = cardTop + cardHeight + gap;
  const hasRoomAbove = preferredTop >= area.y + 4;
  const top = hasRoomAbove ? preferredTop : fallbackTop;
  tooltip.setBounds({
    x: clamp(Math.round(centerX - tooltipWidth / 2), area.x + 4, area.right - tooltipWidth - 4),
    y: clamp(Math.round(top), area.y + 4, area.bottom - tooltipHeight - 4),
    width: tooltipWidth,
    height: tooltipHeight
  }, false);
  tooltip.webContents.send("window-move-handle:tooltip", {
    text: String(text || ""),
    tone: options.tone === "error" ? "error" : "default"
  });
  tooltip.setAlwaysOnTop(true, "floating");
  tooltip.showInactive();
}

async function showMirrorGameSelectorTooltip(text, tone = "default") {
  if (!mainWindow || mainWindow.isDestroyed() || !mirrorGameSelectorWindow || mirrorGameSelectorWindow.isDestroyed()) return;
  const requestToken = ++windowMoveHandleTooltipRequestToken;
  const tooltip = await ensureWindowMoveHandleTooltip(mainWindow);
  if (!tooltip || tooltip.isDestroyed() || requestToken !== windowMoveHandleTooltipRequestToken) return;
  const mainBounds = mainWindow.getBounds();
  const selectorBounds = mirrorGameSelectorWindow.getBounds();
  const area = getWindowMoveHandleVirtualWorkArea();
  const verticalArea = screen.getDisplayMatching(mainBounds).workArea;
  const centerX = selectorBounds.x + selectorBounds.width / 2;
  const preferredTop = selectorBounds.y - WINDOW_MOVE_HANDLE_TOOLTIP_HEIGHT - 7;
  const fallbackTop = selectorBounds.y + selectorBounds.height + 7;
  const top = preferredTop >= verticalArea.y + 4 ? preferredTop : fallbackTop;
  tooltip.setBounds({
    x: clamp(Math.round(centerX - WINDOW_MOVE_HANDLE_TOOLTIP_WIDTH / 2), area.x + 4, area.right - WINDOW_MOVE_HANDLE_TOOLTIP_WIDTH - 4),
    y: clamp(top, verticalArea.y + 4, verticalArea.y + verticalArea.height - WINDOW_MOVE_HANDLE_TOOLTIP_HEIGHT - 4),
    width: WINDOW_MOVE_HANDLE_TOOLTIP_WIDTH,
    height: WINDOW_MOVE_HANDLE_TOOLTIP_HEIGHT
  }, false);
  tooltip.webContents.send("window-move-handle:tooltip", {
    text: String(text || ""),
    tone: tone === "error" ? "error" : "default"
  });
  // Preserve the original position and raise only the native window order so
  // the drag handle can never paint over this tooltip.
  tooltip.setAlwaysOnTop(true, "screen-saver");
  tooltip.showInactive();
  tooltip.moveTop();
}

function syncWindowMoveHandle(options = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !windowMoveHandleWindow || windowMoveHandleWindow.isDestroyed()) {
    return;
  }
  if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
    windowMoveHandleWindow.hide();
    hideWindowMoveHandleTooltip();
    return;
  }

  const mainBounds = mainWindow.getBounds();
  windowMoveHandleSide = resolveWindowMoveHandleSide(mainBounds, windowMoveHandleSide);
  const handleBounds = getWindowMoveHandleBounds(mainBounds, windowMoveHandleSide);
  windowMoveHandleWindow.setBounds(handleBounds, false);
  windowMoveHandleWindow.setAlwaysOnTop(true, "floating");
  windowMoveHandleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (options.forceShow || !windowMoveHandleWindow.isVisible()) {
    windowMoveHandleWindow.showInactive();
  }

  if (windowMoveHandleTooltipWindow?.isVisible()) {
    windowMoveHandleTooltipWindow.setBounds(
      getWindowMoveHandleTooltipBounds(handleBounds, mainBounds, windowMoveHandleSide),
      false
    );
  }
}

async function showWindowMoveHandleTooltip() {
  if (
    !mainWindow || mainWindow.isDestroyed()
    || !windowMoveHandleWindow || windowMoveHandleWindow.isDestroyed()
    || windowMoveHandleDragState
  ) {
    return;
  }

  const requestToken = ++windowMoveHandleTooltipRequestToken;
  const tooltip = await ensureWindowMoveHandleTooltip(mainWindow);
  if (!tooltip || tooltip.isDestroyed() || requestToken !== windowMoveHandleTooltipRequestToken || windowMoveHandleDragState) return;
  if (!mainWindow || mainWindow.isDestroyed() || !windowMoveHandleWindow || windowMoveHandleWindow.isDestroyed()) return;
  const mainBounds = mainWindow.getBounds();
  const handleBounds = windowMoveHandleWindow.getBounds();
  tooltip.setBounds(
    getWindowMoveHandleTooltipBounds(handleBounds, mainBounds, windowMoveHandleSide),
    false
  );
  tooltip.webContents.send("window-move-handle:tooltip", getWindowMoveHandleTooltipText());
  tooltip.setAlwaysOnTop(true, "floating");
  tooltip.showInactive();
  windowMoveHandleWindow.moveTop();
}

function closeWindowMoveHandle() {
  windowMoveHandleDragState = null;
  windowMoveHandleTooltipRequestToken += 1;
  for (const auxiliaryWindow of [windowMoveHandleTooltipWindow, windowMoveHandleWindow]) {
    if (auxiliaryWindow && !auxiliaryWindow.isDestroyed()) {
      auxiliaryWindow.destroy();
    }
  }
  windowMoveHandleTooltipWindow = null;
  windowMoveHandleWindow = null;
}

async function ensureWindowMoveHandle(owner = mainWindow) {
  if (!owner || owner.isDestroyed()) return null;
  if (windowMoveHandleWindow && !windowMoveHandleWindow.isDestroyed()) {
    syncWindowMoveHandle({ forceShow: true });
    return windowMoveHandleWindow;
  }

  const handle = new BrowserWindow({
    width: WINDOW_MOVE_HANDLE_SIZE,
    height: WINDOW_MOVE_HANDLE_SIZE,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    parent: owner,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "window-move-handle-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  windowMoveHandleWindow = handle;
  try {
    handle.setHasShadow(false);
  } catch {
  }

  handle.on("closed", () => {
    if (windowMoveHandleWindow === handle) windowMoveHandleWindow = null;
    hideWindowMoveHandleTooltip();
  });
  await handle.loadFile(path.join(__dirname, "window-move-handle.html"));
  if (eagerAuxiliaryTooltips) {
    await ensureWindowMoveHandleTooltip(owner);
  }
  if (handle.isDestroyed()) return null;
  syncWindowMoveHandle({ forceShow: owner.isVisible() });
  return handle;
}

async function ensureTutorialPopoverWindow(owner, bounds = {}) {
  if (!owner || owner.isDestroyed()) {
    return null;
  }

  const width = Math.max(260, Math.round(Number(bounds.width) || 390));
  const height = Math.max(260, Math.round(Number(bounds.height) || 330));
  const ownerBounds = owner.getBounds();
  const x = Math.round(Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : ownerBounds.x);
  const y = Math.round(Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : ownerBounds.y);

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
    tutorialPopoverWindow.setAlwaysOnTop(true, "screen-saver");
    tutorialPopoverWindow.on("closed", () => {
      tutorialPopoverWindow = null;
    });
    await tutorialPopoverWindow.loadFile(path.join(__dirname, "tutorial-popover.html"));
    tutorialPopoverWindow.webContents.send(
      "tutorial-popover:preload-assets",
      TUTORIAL_PRELOAD_ASSETS.map((assetPath) => getRuntimeContentUrl(assetPath))
    );
  } else {
    tutorialPopoverWindow.setParentWindow(owner);
    tutorialPopoverWindow.setBounds({ x, y, width, height }, false);
  }

  return tutorialPopoverWindow;
}

function enforceTutorialPriority() {
  const owner = tutorialPriorityOwner;
  if (!owner || owner.isDestroyed()) {
    return;
  }

  // CSS cannot raise an in-app tutorial modal above a separate BrowserWindow.
  // Keep every auxiliary Toolkit window below the active tutorial, without
  // changing its content, bounds or visibility.
  for (const auxiliaryWindow of BrowserWindow.getAllWindows()) {
    if (
      auxiliaryWindow === owner
      || auxiliaryWindow === tutorialPopoverWindow
      || auxiliaryWindow.isDestroyed()
      || !auxiliaryWindow.isVisible()
    ) {
      continue;
    }
    auxiliaryWindow.setAlwaysOnTop(true, "floating");
  }

  owner.setAlwaysOnTop(true, "screen-saver");
  if (tutorialPopoverWindow && !tutorialPopoverWindow.isDestroyed() && tutorialPopoverWindow.isVisible()) {
    tutorialPopoverWindow.setAlwaysOnTop(true, "screen-saver");
  }
}

function setTutorialPriority(owner, active) {
  if (!active) {
    tutorialPriorityOwner = null;
    return;
  }

  tutorialPriorityOwner = owner;
  // Native z-order only needs to be asserted when a tutorial becomes active
  // (or a related window is created). Reapplying it on a timer makes Windows
  // continuously recompose the owner surface, which is visible as a flicker
  // only where the tutorial overlay covers the main app.
  enforceTutorialPriority();
}

function isTutorialPriorityActive() {
  return Boolean(tutorialPriorityOwner && !tutorialPriorityOwner.isDestroyed());
}
let runtimeAssetsRoot = path.join(projectRoot, "assets");
const runtimeImageContentTypeCache = new Map();
let runtimeSupportersDataUrls = [];
let appUpdaterController = null;
let appUpdateState = { phase: "idle", info: null };
let appUpdateDownloadPromptPromise = null;
let configureDataService = null;
let handleDataServiceMessage = null;
const APP_UPDATE_DOWNLOAD_DIALOG_ROLE = "app-update-download";
let startupUpdateInstallRequested = false;
const STABLE_INSTALLER_URL = "https://github.com/poioso/tibia-toolkit/releases/latest/download/Tibia-Toolkit-Setup.exe";
let storeWriteQueue = Promise.resolve();
let cacheStoreWriteQueue = Promise.resolve();
let portableSecureStoreWriteQueue = Promise.resolve();
let runtimeCacheStoreSnapshot = null;
let overlayToolsStoreWriteQueue = Promise.resolve();
let overlayToolsMutationQueue = Promise.resolve();
// Native mirror commands are serialized separately from the file mutation
// queue.  A stale account/profile read must never race a create/delete command
// and remove windows that a newer command has just created.
let nativeMirrorSyncQueue = Promise.resolve();
let nativeMirrorSyncSequence = 0;
let nativeMirrorLatestNonEmptySequence = 0;
let mapWatermarkDataUrlPromise = null;
let overlayBoundsSaveTimer = null;
let tibiaWindowMonitorTimer = null;
let nativeHostEventPollTimer = null;
let tibiaWindowStateRequest = null;
let lastTibiaWindowState = null;
let lastGridOverlayTibiaSignature = "";
let lastNativeMirrorsVisible = null;
let lastNativeObsMirrorsVisible = null;
let lastNativeVisualOverlayVisible = null;
let lastNativeVisualOverlayPriority = null;
let lastObsFocusLogSignature = "";
let lastTibiaStateLogSignature = "";
let screenVisionNativeHostUnavailable = false;
let selectionInProgress = false;
let manualSelectionCrossWindow = null;
let manualSelectionCrossTimer = null;
let nativeHostProcess = null;
let nativeHostStartPromise = null;
let portableNativeHostLaunchError = null;
let nativeHostRetryAfterMs = 0;
let nativeHostLastLaunchError = null;
let nativeRuntimeActivatedForSession = false;
let deferredNativeRuntimeStartupPromise = null;
let nativeHostIdleShutdownTimer = null;
let nativeMirrorRegionCount = 0;
let nativeGridOverlayEnabled = false;
let nativeVisualCustomizationActive = false;
// The cursor magnifier lives entirely inside the Native Host. Keep a main-
// process lease so idle shutdown cannot terminate it while it is active.
let nativeCursorMagnifierEnabled = false;
let nativeMirrorEmptySyncTimer = null;
let nativeMirrorEmptySyncGeneration = 0;
let nativeMirrorsAlwaysOnTop = true;
let nativeObsMirrorsAlwaysOnTop = null;
let nativeObsMirrorCommandSupported = null;
let nativeObsTopmostCommandSupported = null;
let nativeObsVisibilityCommandSupported = null;
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
  "account-panel": {
    titleKey: "account.title",
    description: "",
    width: 418
  },
  "report-panel": {
    titleKey: "account.report.title",
    description: "",
    width: 418
  },
  "wheel-perks-panel": {
    titleKey: "wheel.summary.title",
    description: "",
    width: 390
  },
  "buy-me-a-coffee-panel": {
    titleKey: "screenVision.coffee.title",
    description: "",
    width: 418
  }
};

function tr(key, variables = {}) {
  return translateUiString(getActiveLocale(), key, variables);
}

async function loadDataServiceRuntime() {
  if (configureDataService && handleDataServiceMessage) {
    return;
  }

  const dataService = await import("../lib/data/data-service.js");
  configureDataService = dataService.configureDataService;
  handleDataServiceMessage = dataService.handleDataServiceMessage;
}

function broadcastLibraryContentState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("library-content:state", libraryContentSyncState);
}

function setLibraryContentSyncState(nextState) {
  libraryContentSyncState = {
    ...libraryContentSyncState,
    ...nextState
  };
  broadcastLibraryContentState();
}

function countLibraryCatalogOverlayDifferences(active, candidate) {
  return Object.entries(candidate?.records || {}).filter(([key, value]) => {
    const current = active?.records?.[key];
    return !current || current.id !== value.id || current.version !== value.version || current.publishedAt !== value.publishedAt;
  }).length;
}

async function initializeLibraryCatalogOverlayState() {
  // writeJsonFileAtomic keeps a last-good .bak alongside the snapshot. A
  // power loss during Windows' replace step therefore falls back to the last
  // verified overlay instead of silently dropping manual site edits.
  const active = await readJsonFile(
    libraryCatalogOverlayActivePath,
    await readJsonFile(`${libraryCatalogOverlayActivePath}.bak`, createEmptyLibraryCatalogOverlay())
  );
  libraryCatalogOverlayActive = active?.schemaVersion === 1 && active.records && typeof active.records === "object"
    ? active
    : createEmptyLibraryCatalogOverlay();
  const pending = await readJsonFile(
    libraryCatalogOverlayPendingPath,
    await readJsonFile(`${libraryCatalogOverlayPendingPath}.bak`, null)
  );
  libraryCatalogOverlayPending = pending?.schemaVersion === 1 && pending.records && typeof pending.records === "object"
    ? pending
    : null;
  libraryCatalogMediaActive = await readJsonFile(libraryCatalogMediaActivePath, {});
  if (!libraryCatalogMediaActive || typeof libraryCatalogMediaActive !== "object" || Array.isArray(libraryCatalogMediaActive)) libraryCatalogMediaActive = {};
  libraryCatalogMediaPending = await readJsonFile(libraryCatalogMediaPendingPath, null);
  if (!libraryCatalogMediaPending || typeof libraryCatalogMediaPending !== "object" || Array.isArray(libraryCatalogMediaPending)) libraryCatalogMediaPending = null;
  const baseState = await readJsonFile(libraryCatalogBaseStatePath, {});
  libraryCatalogBaseActiveHash = typeof baseState?.activeHash === "string" ? baseState.activeHash : "";
  libraryCatalogBasePendingHash = typeof baseState?.pendingHash === "string" ? baseState.pendingHash : "";
  const pendingChanges = countLibraryCatalogOverlayDifferences(libraryCatalogOverlayActive, libraryCatalogOverlayPending)
    + (libraryCatalogBasePendingHash && libraryCatalogBasePendingHash !== libraryCatalogBaseActiveHash ? 1 : 0);
  setLibraryContentSyncState({
    phase: pendingChanges ? "ready" : "idle",
    pendingChanges,
    cursor: libraryCatalogOverlayActive.cursor || null,
    error: null
  });
}

async function prepareLibraryCatalogBaseUpdate() {
  const response = await electronNet.fetch(new URL("/library-catalog-manifest.json", libraryCatalogSiteBaseUrl).href, { cache: "no-store" });
  if (!response.ok) throw new Error(`library-catalog-manifest-http-${response.status}`);
  const manifest = await response.json();
  const hash = String(manifest?.sha256 || "").toLowerCase();
  const bytes = Number(manifest?.bytes || 0);
  const catalogPath = String(manifest?.catalog || "");
  if (Number(manifest?.schemaVersion) !== 1 || !/^[a-f0-9]{64}$/.test(hash) || !Number.isInteger(bytes) || bytes < 2 || catalogPath !== "/library-catalog.json") throw new Error("invalid-library-catalog-manifest");
  if (!libraryCatalogBaseActiveHash) {
    const bundledPath = resolveRuntimeFilePath("assets/data/site-library-canonical.json");
    const bundled = bundledPath ? await fs.readFile(bundledPath).catch(() => null) : null;
    const bundledHash = bundled ? crypto.createHash("sha256").update(bundled).digest("hex") : "";
    if (bundledHash === hash) {
      libraryCatalogBaseActiveHash = hash;
      await writeJsonFileAtomic(libraryCatalogBaseStatePath, { activeHash: hash, pendingHash: "" });
      return false;
    }
  }
  if (hash === libraryCatalogBaseActiveHash || hash === libraryCatalogBasePendingHash) return false;
  const catalogResponse = await electronNet.fetch(new URL(catalogPath, libraryCatalogSiteBaseUrl).href, { cache: "no-store" });
  if (!catalogResponse.ok) throw new Error(`library-catalog-base-http-${catalogResponse.status}`);
  const contents = Buffer.from(await catalogResponse.arrayBuffer());
  if (contents.byteLength !== bytes || crypto.createHash("sha256").update(contents).digest("hex") !== hash) throw new Error("library-catalog-base-integrity");
  const payload = JSON.parse(contents.toString("utf8"));
  if (Number(payload?.schemaVersion) !== 2 || !payload?.records || typeof payload.records !== "object") throw new Error("invalid-library-catalog-base");
  await writeJsonFileAtomic(libraryCatalogBasePendingPath, payload);
  libraryCatalogBasePendingHash = hash;
  await writeJsonFileAtomic(libraryCatalogBaseStatePath, { activeHash: libraryCatalogBaseActiveHash, pendingHash: hash });
  return true;
}

async function readLibraryCatalogBaseSnapshot() {
  const active = await readJsonFile(libraryCatalogBaseActivePath, null);
  if (active?.records && typeof active.records === "object") return active;
  const bundledPath = resolveRuntimeFilePath("assets/data/site-library-canonical.json");
  const bundled = bundledPath ? await readJsonFile(bundledPath, null) : null;
  return bundled?.records && typeof bundled.records === "object" ? bundled : null;
}

function libraryCatalogRecordKey(record, index) {
  return String(record?.slug || record?.id || index || "").trim();
}

function collectChangedBaseMediaPaths(previous, next) {
  const paths = new Set();
  for (const kind of ["items", "npcs", "creatures", "bosses", "books"]) {
    const oldByKey = new Map((Array.isArray(previous?.records?.[kind]) ? previous.records[kind] : [])
      .map((record, index) => [libraryCatalogRecordKey(record, index), record]));
    for (const [index, record] of (Array.isArray(next?.records?.[kind]) ? next.records[kind] : []).entries()) {
      const key = libraryCatalogRecordKey(record, index);
      if (JSON.stringify(oldByKey.get(key)) !== JSON.stringify(record)) collectLibraryMediaPaths(record, paths);
    }
  }
  return paths;
}

async function getPendingBaseMediaPaths() {
  if (!libraryCatalogBasePendingHash || libraryCatalogBasePendingHash === libraryCatalogBaseActiveHash) return new Set();
  const [previous, next] = await Promise.all([
    readLibraryCatalogBaseSnapshot(),
    readJsonFile(libraryCatalogBasePendingPath, null)
  ]);
  if (!next?.records || typeof next.records !== "object") throw new Error("invalid-pending-library-catalog-base");
  return collectChangedBaseMediaPaths(previous, next);
}

function collectChangedOverlayMediaPaths(previous, next) {
  const paths = new Set();
  const previousRecords = previous?.records || {};
  for (const [key, record] of Object.entries(next?.records || {})) {
    if (JSON.stringify(previousRecords[key]) !== JSON.stringify(record)) collectLibraryMediaPaths(record?.fields, paths);
  }
  return paths;
}

async function prepareLibraryCatalogMedia(requiredPaths = new Set()) {
  const required = [...new Set(requiredPaths || [])];
  if (!required.length) return { ...(libraryCatalogMediaActive || {}) };
  const manifestUrl = new URL("/library-media-manifest.json", libraryCatalogSiteBaseUrl);
  const manifestResponse = await electronNet.fetch(manifestUrl.href, { cache: "no-store" });
  if (!manifestResponse.ok) throw new Error(`library-media-manifest-http-${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  if (Number(manifest?.schemaVersion) !== 2 || !manifest?.media || typeof manifest.media !== "object") throw new Error("invalid-library-media-manifest");
  const next = { ...(libraryCatalogMediaActive || {}) };
  for (const mediaPath of required) {
    const entry = manifest.media[mediaPath];
    if (!entry || !/^[a-f0-9]{64}$/i.test(String(entry.sha256 || "")) || !Number.isInteger(entry.bytes) || entry.bytes < 1) {
      throw new Error(`library-media-not-verified:${mediaPath}`);
    }
    const hash = String(entry.sha256).toLowerCase();
    const blobPath = path.join(libraryCatalogMediaBlobsRoot, hash);
    const exists = await fs.stat(blobPath).then((stat) => stat.size === entry.bytes).catch(() => false);
    if (!exists) {
      const response = await electronNet.fetch(new URL(mediaPath, libraryCatalogSiteBaseUrl).href, { cache: "no-store" });
      if (!response.ok) throw new Error(`library-media-http-${response.status}:${mediaPath}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
      if (bytes.byteLength !== entry.bytes || actualHash !== hash) throw new Error(`library-media-integrity:${mediaPath}`);
      await fs.mkdir(libraryCatalogMediaBlobsRoot, { recursive: true });
      await fs.writeFile(blobPath, bytes);
    }
    next[mediaPath] = { sha256: hash, bytes: entry.bytes, mime: String(entry.mime || "") };
  }
  return next;
}

async function cleanupLibraryCatalogMediaCache() {
  const [
    activeBase,
    pendingBase,
    backupBase,
    backupOverlay,
    backupPendingOverlay,
    backupMedia,
    backupPendingMedia
  ] = await Promise.all([
    readJsonFile(libraryCatalogBaseActivePath, null),
    readJsonFile(libraryCatalogBasePendingPath, null),
    readJsonFile(`${libraryCatalogBaseActivePath}.bak`, null),
    readJsonFile(`${libraryCatalogOverlayActivePath}.bak`, null),
    readJsonFile(`${libraryCatalogOverlayPendingPath}.bak`, null),
    readJsonFile(`${libraryCatalogMediaActivePath}.bak`, null),
    readJsonFile(`${libraryCatalogMediaPendingPath}.bak`, null)
  ]);
  const { referencedPaths, hashes } = collectRetainedLibraryMediaHashes({
    snapshots: [
      activeBase,
      pendingBase,
      backupBase,
      libraryCatalogOverlayActive,
      libraryCatalogOverlayPending,
      backupOverlay,
      backupPendingOverlay
    ],
    indexes: [
      libraryCatalogMediaActive,
      libraryCatalogMediaPending,
      backupMedia,
      backupPendingMedia
    ]
  });

  const nextActiveIndex = pruneLibraryMediaIndex(libraryCatalogMediaActive, referencedPaths);
  const nextPendingIndex = pruneLibraryMediaIndex(libraryCatalogMediaPending || {}, referencedPaths);
  if (JSON.stringify(nextActiveIndex) !== JSON.stringify(libraryCatalogMediaActive)) {
    libraryCatalogMediaActive = nextActiveIndex;
    await writeJsonFileAtomic(libraryCatalogMediaActivePath, nextActiveIndex);
  }
  if (libraryCatalogMediaPending && JSON.stringify(nextPendingIndex) !== JSON.stringify(libraryCatalogMediaPending)) {
    libraryCatalogMediaPending = nextPendingIndex;
    await writeJsonFileAtomic(libraryCatalogMediaPendingPath, nextPendingIndex);
  }

  const directoryEntries = await fs.readdir(libraryCatalogMediaBlobsRoot, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(directoryEntries.filter((entry) => entry.isFile()).map(async (entry) => ({
    name: entry.name,
    mtimeMs: await fs.stat(path.join(libraryCatalogMediaBlobsRoot, entry.name)).then((stat) => stat.mtimeMs).catch(() => Date.now())
  })));
  const removable = planLibraryMediaCacheCleanup({
    files,
    retainedHashes: hashes,
    graceMs: libraryCatalogMediaGcGraceMs
  });
  for (const hash of removable) {
    // The planner only returns a verified SHA-256 filename. Keep deletion
    // strictly inside the dedicated blob directory.
    await fs.rm(path.join(libraryCatalogMediaBlobsRoot, hash), { force: true });
  }
  await writeDebugLog(`library-media-gc referenced=${hashes.size} removed=${removable.length}`);
  return { retained: hashes.size, removed: removable.length };
}

async function checkLibraryCatalogSignal() {
  if (libraryContentSyncPromise) return;
  const headers = libraryCatalogSignalEtag ? { "if-none-match": libraryCatalogSignalEtag } : {};
  try {
    const response = await electronNet.fetch(new URL("/api/product/catalog-signal", libraryCatalogApiBaseUrl).href, {
      cache: "no-store",
      headers
    });
    if (response.status === 304) return;
    if (!response.ok) throw new Error(`library-catalog-signal-http-${response.status}`);
    libraryCatalogSignalEtag = String(response.headers.get("etag") || "");
    const signal = await response.json();
    if (Number(signal?.schemaVersion) !== 1) throw new Error("invalid-library-catalog-signal");
    const token = String(signal?.token || "");
    const knownCursor = String(libraryCatalogOverlayPending?.cursor || libraryCatalogOverlayActive.cursor || "");
    if (token && token !== knownCursor) await checkLibraryCatalogUpdates({ force: true });
  } catch (error) {
    await writeDebugLog(`library-catalog-signal-failed ${error?.message || String(error)}`);
  }
}

function startLibraryCatalogSignalMonitor() {
  if (!allowsRemoteLibrarySync) return;
  if (libraryCatalogSignalTimer) return;
  libraryCatalogSignalTimer = setInterval(() => {
    void checkLibraryCatalogSignal();
  }, libraryCatalogSignalIntervalMs);
  libraryCatalogSignalTimer.unref?.();
}

async function checkLibraryCatalogUpdates({ force = false } = {}) {
  if (!allowsRemoteLibrarySync) return libraryContentSyncState;
  if (libraryContentSyncPromise) return libraryContentSyncPromise;
  if (!force && Date.now() < libraryContentNextCheckAt) return libraryContentSyncState;
  libraryContentNextCheckAt = Date.now() + libraryCatalogCheckMinimumIntervalMs;
  libraryContentSyncPromise = (async () => {
    setLibraryContentSyncState({ phase: "checking", error: null });
    try {
      const basePending = await prepareLibraryCatalogBaseUpdate();
      // Also recover a base snapshot prepared before an interrupted media download.
      const baseMediaPaths = await getPendingBaseMediaPaths();
      let working = libraryCatalogOverlayPending || libraryCatalogOverlayActive;
      let cursor = working.cursor || null;
      let total = 0;
      for (let pageNumber = 0; pageNumber < 500; pageNumber += 1) {
        const url = new URL("/api/product/catalog-sync", libraryCatalogApiBaseUrl);
        url.searchParams.set("limit", "50");
        if (cursor) url.searchParams.set("cursor", cursor);
        const response = await electronNet.fetch(url.href, { cache: "no-store" });
        if (!response.ok) throw new Error(`library-catalog-sync-http-${response.status}`);
        const page = normalizeLibraryCatalogSyncPage(await response.json());
        working = mergeLibraryCatalogOverlay(working, page);
        total += page.changes.length;
        cursor = page.cursor || cursor;
        if (!page.hasMore || !page.changes.length) break;
      }
      const pendingChanges = countLibraryCatalogOverlayDifferences(libraryCatalogOverlayActive, working)
        + (basePending || (libraryCatalogBasePendingHash && libraryCatalogBasePendingHash !== libraryCatalogBaseActiveHash) ? 1 : 0);
      if (pendingChanges) {
        const requiredMediaPaths = collectChangedOverlayMediaPaths(libraryCatalogOverlayActive, working);
        for (const mediaPath of baseMediaPaths) requiredMediaPaths.add(mediaPath);
        const media = await prepareLibraryCatalogMedia(requiredMediaPaths);
        await writeJsonFileAtomic(libraryCatalogOverlayPendingPath, working);
        await writeJsonFileAtomic(libraryCatalogMediaPendingPath, media);
        libraryCatalogOverlayPending = working;
        libraryCatalogMediaPending = media;
      } else {
        libraryCatalogOverlayPending = null;
        await fs.rm(libraryCatalogOverlayPendingPath, { force: true }).catch(() => {});
      }
      setLibraryContentSyncState({
        phase: pendingChanges ? "ready" : "idle",
        pendingChanges,
        cursor: working.cursor || libraryCatalogOverlayActive.cursor || null,
        lastCheckedAt: new Date().toISOString(),
        error: null
      });
      await writeDebugLog(`library-catalog-sync checked=${total} pending=${pendingChanges}`);
      return libraryContentSyncState;
    } catch (error) {
      setLibraryContentSyncState({
        phase: "error",
        lastCheckedAt: new Date().toISOString(),
        error: error?.message || String(error)
      });
      await writeDebugLog(`library-catalog-sync-failed ${error?.message || String(error)}`);
      return libraryContentSyncState;
    } finally {
      libraryContentSyncPromise = null;
    }
  })();
  return libraryContentSyncPromise;
}

async function activatePendingLibraryCatalogUpdate() {
  const pendingChanges = countLibraryCatalogOverlayDifferences(libraryCatalogOverlayActive, libraryCatalogOverlayPending) + (libraryCatalogBasePendingHash && libraryCatalogBasePendingHash !== libraryCatalogBaseActiveHash ? 1 : 0);
  if (!pendingChanges) return libraryContentSyncState;
  setLibraryContentSyncState({ phase: "activating", error: null });
  if (libraryCatalogOverlayPending) {
    await writeJsonFileAtomic(libraryCatalogOverlayActivePath, libraryCatalogOverlayPending);
  }
  if (libraryCatalogBasePendingHash && libraryCatalogBasePendingHash !== libraryCatalogBaseActiveHash) {
    const basePayload = await readJsonFile(libraryCatalogBasePendingPath, null);
    if (!basePayload?.records) throw new Error("library-catalog-base-pending-missing");
    await writeJsonFileAtomic(libraryCatalogBaseActivePath, basePayload);
    libraryCatalogBaseActiveHash = libraryCatalogBasePendingHash;
    libraryCatalogBasePendingHash = "";
    await fs.rm(libraryCatalogBasePendingPath, { force: true }).catch(() => {});
    await writeJsonFileAtomic(libraryCatalogBaseStatePath, { activeHash: libraryCatalogBaseActiveHash, pendingHash: "" });
  }
  await writeJsonFileAtomic(libraryCatalogMediaActivePath, libraryCatalogMediaPending || libraryCatalogMediaActive);
  libraryCatalogOverlayActive = libraryCatalogOverlayPending || libraryCatalogOverlayActive;
  libraryCatalogMediaActive = libraryCatalogMediaPending || libraryCatalogMediaActive;
  libraryCatalogOverlayPending = null;
  libraryCatalogMediaPending = null;
  await fs.rm(libraryCatalogOverlayPendingPath, { force: true }).catch(() => {});
  await fs.rm(libraryCatalogMediaPendingPath, { force: true }).catch(() => {});
  await handleDataServiceMessage({ type: "activate-library-content" });
  await cleanupLibraryCatalogMediaCache().catch((error) => writeDebugLog(`library-media-gc-failed ${error?.message || String(error)}`));
  setLibraryContentSyncState({
    phase: "idle",
    pendingChanges: 0,
    cursor: libraryCatalogOverlayActive.cursor || null,
    lastCheckedAt: new Date().toISOString(),
    error: null
  });
  await writeDebugLog("library-catalog-sync-activated");
  return libraryContentSyncState;
}

async function promptStartupUpdate(info = {}) {
  const normalizedInfo = normalizeAppUpdateInfo(info);
  const message = tr("updater.availableMessage", {
    version: normalizedInfo.version || tr("updater.newVersion")
  });
  const response = await showScreenVisionConfirmDialog(null, {
    title: tr("updater.availableTitle"),
    message,
    confirmLabel: tr("updater.downloadNow"),
    cancelLabel: tr("updater.downloadLater"),
    confirmTooltip: tr("updater.downloadNow"),
    cancelTooltip: tr("updater.downloadLater"),
    tone: "success",
    flat: true,
    mediaPath: path.join("assets", "ui", "tutorial", "update.gif"),
    mediaWidth: 240,
    width: 456,
    height: 430,
    external: true,
    centerOnDisplay: true
  });

  return response.confirmed;
}

async function waitForInitialUpdateCheck(controller, timeoutMs = 8_000) {
  if (!controller?.initialCheck) {
    return null;
  }

  return Promise.race([
    controller.initialCheck,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
  ]);
}

async function openInstallerRecovery(error) {
  await writeDebugLog(`runtime-module-load-failed ${error?.message || String(error)}`);
  await dialog.showMessageBox({
    type: "error",
    title: "Tibia Toolkit",
    message: tr("updater.recoveryTitle"),
    detail: tr("updater.recoveryMessage")
  });
  await shell.openExternal(STABLE_INSTALLER_URL);
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
    const runtimeConfig = await loadRuntimeConfig();
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
          if (startupUpdateInstallRequested) {
            return;
          }
          if (mainWindow && !mainWindow.isDestroyed()) {
            void showAppUpdateDownloadedDialog(info);
          }
        }
      });

      const initialUpdate = await waitForInitialUpdateCheck(appUpdaterController);
      if (initialUpdate?.available && await promptStartupUpdate(initialUpdate.info)) {
        startupUpdateInstallRequested = true;
        showAppUpdateDownloadProgressDialog(initialUpdate.info);
        try {
          await appUpdaterController.download();
          if (appUpdaterController.install()) {
            appIsQuitting = true;
            return;
          }
          startupUpdateInstallRequested = false;
        } catch (error) {
          closeScreenVisionConfirmDialogsByRole(APP_UPDATE_DOWNLOAD_DIALOG_ROLE);
          startupUpdateInstallRequested = false;
          await writeDebugLog(`startup-update-download-failed ${error?.message || String(error)}`);
        }
      }
    } else {
      await writeDebugLog(`app-updater-skipped channel=${runtimeChannel}`);
    }
    splashStatus = tr("splash.preparing");
    await createSplashWindow();
    runtimeSupportersDataUrls = normalizeRuntimeBaseList(
      runtimeConfig.supportersDataUrls || [],
      runtimeConfig.supportersDataUrl || ""
    );
    if (!isPortableTestRuntime) {
      registerRuntimeContentProtocol();
    }
    try {
      await bootstrapRuntimeContentWithRetry(runtimeConfig);
    } catch (error) {
      await writeDebugLog(`content-pack-bootstrap-failed ${error?.message || String(error)}`);
      closeSplashWindow();
      app.quit();
      return;
    }
    await prepareClosePreferenceForCurrentSession();

    try {
      await loadDataServiceRuntime();
      await initializeLibraryCatalogOverlayState();
    } catch (error) {
      await openInstallerRecovery(error);
      app.quit();
      return;
    }

    configureDataService({
      marketApiBase: runtimeConfig.marketApiBase || null,
      marketApiBases: runtimeConfig.marketApiBases || [],
      gameDataHubBase: runtimeConfig.gameDataHubBase || null,
      gameDataHubBases: runtimeConfig.gameDataHubBases || [],
      supportersDataUrl: runtimeSupportersDataUrls[0] || null,
      supportersDataUrls: runtimeSupportersDataUrls,
      getAssetUrl(relativePath) {
        return getRuntimeContentUrl(relativePath);
      },
      getLibraryMediaUrl(sitePath) {
        const normalized = `/${String(sitePath || "").replace(/^\/+/, "")}`;
        return libraryCatalogMediaActive?.[normalized]
          ? getRuntimeContentUrl(`assets/library-media/${normalized.slice(1)}`)
          : "";
      },
      requestManualStashMarketRefresh,
      getCachedImageUrl(category, key, sourceUrl) {
        return getCachedImageProtocolUrl(category, key, sourceUrl);
      },
      getLibraryCatalogState() {
        return {
          activeHash: libraryCatalogBaseActiveHash,
          hasActiveBase: fsSync.existsSync(libraryCatalogBaseActivePath),
          overlayChanges: Object.keys(libraryCatalogOverlayActive?.records || {}).length
        };
      },
      async readJsonAsset(relativePath) {
        const assetPath = relativePath === "assets/data/site-library-canonical.json" && fsSync.existsSync(libraryCatalogBaseActivePath)
          ? libraryCatalogBaseActivePath
          : resolveRuntimeFilePath(relativePath);
        if (!assetPath) {
          throw new Error(`Caminho de asset invalido: ${relativePath}`);
        }
        const contents = await fs.readFile(assetPath, "utf8");
        const bundle = JSON.parse(contents);
        return relativePath === "assets/data/site-library-canonical.json"
          ? applyLibraryCatalogOverlay(bundle, libraryCatalogOverlayActive)
          : bundle;
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
    registerIpcHandlers();
    await resetDesktopScreenshotStateForLaunch();
    await writeDebugLog("create-overlay-window:start");
    mainWindow = await createOverlayWindow();
    await writeDebugLog("create-overlay-window:finish");
    if (allowsRemoteLibrarySync) {
      setTimeout(() => {
        void checkLibraryCatalogUpdates()
          .catch((error) => writeDebugLog(`library-catalog-sync-init-failed ${error?.message || String(error)}`));
        startLibraryCatalogSignalMonitor();
      }, 3_000);
    }
    setTimeout(() => {
      void refreshDesktopAdsShowcase();
    }, 3_000);
    // Drive discovery and the Tibia process lookup can take around one second
    // on Windows. Screenshot discovery remains deferred, so its watcher starts after
    // the visible shell instead of blocking the first window.
    setTimeout(() => {
      void syncDesktopScreenshotWatcher().catch((error) => writeDebugLog(`desktop-screenshot-watcher-init-failed ${error?.message || String(error)}`));
    }, 1200);
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
  stopDesktopScreenshotWatcher();
  closeDesktopScreenshotAssistant();
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
  const minWidth = 535;
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
    // Keep Windows 11's native frame treatment enabled for the borderless shell.
    // The native host reinforces this after the window is visible.
    roundedCorners: true,
    show: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: "Tibia Toolkit",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [
        `--tibia-toolkit-runtime-channel=${runtimeChannel}`
      ]
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
    if (!isTutorialPriorityActive()) {
      restoreMainWindowTopmost(window);
      // The screenshot helper is an owned utility window. Reassert its stacking
      // after the main shell receives focus so the shell can never cover it.
      setTimeout(() => {
        prioritizeDesktopScreenshotAssistant(desktopScreenshotAssistantWindow, window);
      }, 0);
    }
    void writeDebugLog("window-focus");
    if (!isTutorialPriorityActive()) {
      void syncDockedToolPanelWindow({ forceShow: true, animateSideChange: false });
      notifyDesktopAdsShowcaseResume();
    }
    window.webContents.send("app:activity-state", { active: true });
  });
  window.on("blur", () => {
    // Clicking a native tutorial popover naturally blurs its owner. Do not run
    // the normal owner-restacking path then: it can bring the main app forward
    // between tutorial steps and make the whole surface flicker.
    if (!isTutorialPriorityActive()) {
      restoreMainWindowTopmost(window);
    }
    void writeDebugLog("window-blur");
    void refreshControllerWindowFocusState();
    window.webContents.send("app:activity-state", { active: false });
  });
  window.on("ready-to-show", () => {
    void writeDebugLog("window-ready-to-show");
    // The installed Windows build is borderless. Ask DWM for native rounded
    // corners after the window is visible, avoiding a transparent CSS crop.
    if (app.isPackaged && !isPortableTestRuntime && process.platform === "win32") {
      setTimeout(() => {
        void applyNativeWindowCornerPreference(window);
      }, 450);
    }
  });
  window.on("move", () => {
    closeDesktopGlobalWorldPicker();
    scheduleOverlayBoundsSave(window);
    void syncDockedToolPanelWindow();
    syncWindowMoveHandle();
    syncMirrorGameSelector();
    syncSupportersShowcase();
    syncDesktopAdsShowcase();
  });
  window.on("resize", () => {
    closeDesktopGlobalWorldPicker();
    scheduleOverlayBoundsSave(window);
    void syncDockedToolPanelWindow();
    syncWindowMoveHandle();
    syncMirrorGameSelector();
    syncSupportersShowcase();
    syncDesktopAdsShowcase();
  });
  window.on("minimize", () => {
    syncWindowMoveHandle();
    syncMirrorGameSelector();
    syncSupportersShowcase();
    syncDesktopAdsShowcase();
  });
  window.on("hide", () => {
    syncWindowMoveHandle();
    syncMirrorGameSelector();
    syncSupportersShowcase();
    syncDesktopAdsShowcase();
  });
  window.on("restore", () => {
    if (dockedToolPanelIsOpen) {
      void syncDockedToolPanelWindow({ forceShow: true });
    }
    syncWindowMoveHandle({ forceShow: true });
    syncMirrorGameSelector({ forceShow: true });
    syncSupportersShowcase({ forceShow: true });
    syncDesktopAdsShowcase({ forceShow: true });
    notifyDesktopAdsShowcaseResume();
  });
  window.on("show", () => {
    if (dockedToolPanelIsOpen) {
      void syncDockedToolPanelWindow({ forceShow: true });
    }
    syncWindowMoveHandle({ forceShow: true });
    syncMirrorGameSelector({ forceShow: true });
    syncSupportersShowcase({ forceShow: true });
    syncDesktopAdsShowcase({ forceShow: true });
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
    closeWindowMoveHandle();
    closeMirrorGameSelector();
    closeSupportersShowcase();
    closeDesktopAdsShowcase();
  });
  window.on("close", () => {
    void saveOverlayBounds(window);
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    void writeDebugLog(`did-fail-load ${errorCode} ${errorDescription}`);
    void queueDiagnosticEvent("did-fail-load", { errorCode });
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
    void queueDiagnosticEvent("render-process-gone", { reason: details?.reason || "unknown", exitCode: details?.exitCode ?? null });
  });
  window.webContents.on("unresponsive", () => {
    void writeDebugLog("renderer-unresponsive");
    void queueDiagnosticEvent("renderer-unresponsive");
  });
  window.webContents.on("responsive", () => {
    void writeDebugLog("renderer-responsive");
  });
  if (!app.isPackaged) {
    await window.webContents.session.clearCache();
  }
  await window.loadURL(`${getRuntimeContentUrl("index.html")}?mode=desktop`);
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
    if (windowMoveHandleWindow && !windowMoveHandleWindow.isDestroyed() && windowMoveHandleWindow.isVisible()) {
      windowMoveHandleWindow.setAlwaysOnTop(true, "floating");
      windowMoveHandleWindow.moveTop();
    }
    if (supportersShowcaseWindow && !supportersShowcaseWindow.isDestroyed() && supportersShowcaseWindow.isVisible()) {
      supportersShowcaseWindow.setAlwaysOnTop(true, "floating");
      supportersShowcaseWindow.moveTop();
    }
    if (desktopAdsShowcaseWindow && !desktopAdsShowcaseWindow.isDestroyed() && desktopAdsShowcaseWindow.isVisible()) {
      desktopAdsShowcaseWindow.setAlwaysOnTop(true, "floating");
      desktopAdsShowcaseWindow.moveTop();
    }
    // The screenshot support assistant is an independent support window, not
    // a child of the Toolkit. Reassert it last so restoring/focusing the main
    // shell cannot place the assistant behind the app again.
    if (desktopScreenshotAssistantWindow && !desktopScreenshotAssistantWindow.isDestroyed() && desktopScreenshotAssistantWindow.isVisible()) {
      prioritizeDesktopScreenshotAssistant(desktopScreenshotAssistantWindow, window);
    }
  } catch (_error) {
  }
}

function preserveMainWindowTopmostDuringHandleDrag({ reassert = false } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || isTutorialPriorityActive()) {
    return;
  }

  try {
    // Moving a borderless BrowserWindow through an auxiliary handle can leave
    // its HWND behind other windows even while Electron still reports the
    // always-on-top flag. Reassert the flag at the drag boundaries and keep
    // the window at the front of its existing topmost band while it moves.
    if (reassert || !mainWindow.isAlwaysOnTop()) {
      mainWindow.setAlwaysOnTop(true, "screen-saver");
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    mainWindow.moveTop();
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

async function focusExistingExplorerDirectory(directory) {
  if (process.platform !== "win32" || !directory) {
    return false;
  }

  // shell.openPath delegates to Explorer and opens another window every time
  // on some Windows configurations. Reuse an existing Explorer window for
  // this exact directory instead, restoring it only when minimized and
  // bringing it to the foreground without changing its current size.
  const script = `
$ErrorActionPreference = "Stop"
$target = [IO.Path]::GetFullPath($env:TT_SCREENSHOT_DIRECTORY)
$trimmedTarget = $target.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
$targetLeaf = [IO.Path]::GetFileName($trimmedTarget)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class TibiaToolkitExplorerWindow {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

# On slower machines the Shell.Application COM collection can take several
# seconds to enumerate. The normal Explorer title is enough to reuse the
# target window quickly in the common single-folder case.
if ($targetLeaf) {
  foreach ($process in @(Get-Process -Name explorer -ErrorAction SilentlyContinue)) {
    try {
      $windowHandle = [int64]$process.MainWindowHandle
      $title = [string]$process.MainWindowTitle
      $titleMatches = [string]::Equals($title, $targetLeaf, [StringComparison]::OrdinalIgnoreCase)
        -or $title.StartsWith("$targetLeaf -", [StringComparison]::OrdinalIgnoreCase)
      if ($windowHandle -gt 0 -and $titleMatches) {
        [TibiaToolkitExplorerWindow]::ShowWindowAsync([IntPtr]$windowHandle, 9) | Out-Null
        [TibiaToolkitExplorerWindow]::SetForegroundWindow([IntPtr]$windowHandle) | Out-Null
        exit 0
      }
    } catch {
    }
  }
}

$shell = New-Object -ComObject Shell.Application
$windowHandle = 0
foreach ($window in $shell.Windows()) {
  try {
    $path = [IO.Path]::GetFullPath([string]$window.Document.Folder.Self.Path)
    if ([string]::Equals($path, $target, [StringComparison]::OrdinalIgnoreCase)) {
      $windowHandle = [int64]$window.HWND
      break
    }
  } catch {
  }
}
if ($windowHandle -le 0) { exit 1 }
[TibiaToolkitExplorerWindow]::ShowWindowAsync([IntPtr]$windowHandle, 9) | Out-Null
[TibiaToolkitExplorerWindow]::SetForegroundWindow([IntPtr]$windowHandle) | Out-Null
exit 0
`;

  try {
    await execFileAsync(windowsPowerShellCommand, [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script
    ], {
      windowsHide: true,
      timeout: 3000,
      maxBuffer: 64 * 1024,
      env: {
        ...process.env,
        TT_SCREENSHOT_DIRECTORY: path.resolve(directory)
      }
    });
    return true;
  } catch {
    return false;
  }
}

function notifyDesktopGlobalWorldPickerClosed(owner = desktopGlobalWorldPickerOwner) {
  if (!owner || owner.isDestroyed()) return;
  owner.webContents.send("desktop:global-world-picker:closed");
}

function closeDesktopGlobalWorldPicker() {
  const window = desktopGlobalWorldPickerWindow;
  const owner = desktopGlobalWorldPickerOwner;
  desktopGlobalWorldPickerWindow = null;
  desktopGlobalWorldPickerOwner = null;
  if (window && !window.isDestroyed()) {
    try {
      window.close();
    } catch {
    }
  }
  notifyDesktopGlobalWorldPickerClosed(owner);
}

function getDesktopGlobalWorldPickerBounds(owner, anchor = {}, requestedHeight = 344) {
  const ownerBounds = owner.getBounds();
  const display = screen.getDisplayMatching(ownerBounds);
  const area = display.workArea;
  const width = 352;
  const height = Math.max(176, Math.min(424, Math.round(Number(requestedHeight) || 344)));
  const anchorLeft = Math.round(Number(anchor.left) || 0);
  const anchorTop = Math.round(Number(anchor.top) || 0);
  const anchorBottom = Math.round(Number(anchor.bottom) || 0);
  const x = Math.max(area.x + 8, Math.min(ownerBounds.x + anchorLeft, area.x + area.width - width - 8));
  const below = ownerBounds.y + anchorBottom + 6;
  const y = below + height <= area.y + area.height - 8
    ? below
    : Math.max(area.y + 8, ownerBounds.y + anchorTop - height - 6);
  return { x, y, width, height };
}

async function openDesktopGlobalWorldPicker(owner, payload = {}) {
  if (!owner || owner.isDestroyed()) return { opened: false, error: "Janela principal indisponível." };

  const previous = desktopGlobalWorldPickerWindow;
  if (previous && !previous.isDestroyed() && desktopGlobalWorldPickerOwner === owner && previous.isVisible()) {
    closeDesktopGlobalWorldPicker();
    return { opened: false, toggled: true };
  }

  closeDesktopGlobalWorldPicker();
  const bounds = getDesktopGlobalWorldPickerBounds(owner, payload.anchor, payload.height);
  const window = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    parent: owner,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "world-picker-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  desktopGlobalWorldPickerWindow = window;
  desktopGlobalWorldPickerOwner = owner;
  window.setAlwaysOnTop(true, "pop-up-menu");
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.on("blur", () => {
    setTimeout(() => {
      if (desktopGlobalWorldPickerWindow === window && !window.isDestroyed() && !window.isFocused()) {
        closeDesktopGlobalWorldPicker();
      }
    }, 80);
  });
  window.on("closed", () => {
    if (desktopGlobalWorldPickerWindow === window) {
      desktopGlobalWorldPickerWindow = null;
      desktopGlobalWorldPickerOwner = null;
      notifyDesktopGlobalWorldPickerClosed(owner);
    }
  });

  await window.loadFile(path.join(__dirname, "world-picker.html"));
  if (window.isDestroyed()) return { opened: false, error: "Seletor fechado antes de abrir." };
  window.webContents.send("desktop:global-world-picker:render", {
    worlds: Array.isArray(payload.worlds) ? payload.worlds.slice(0, 500) : [],
    selectedSlug: String(payload.selectedSlug || ""),
    placeholder: String(payload.placeholder || "Digite o mundo")
  });
  window.show();
  window.focus();
  return { opened: true, bounds };
}

function registerIpcHandlers() {
  ipcMain.on("supporters-showcase:update", (event, payload = {}) => {
    if (event.sender !== mainWindow?.webContents) return;
    void updateSupportersShowcase(payload);
  });

  ipcMain.on("supporters-showcase:open-panel", (event) => {
    if (event.sender !== supportersShowcaseWindow?.webContents || !mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("supporters-showcase:open-panel");
  });

  ipcMain.on("supporters-showcase:open-coffee-panel", (event) => {
    if (event.sender !== supportersShowcaseWindow?.webContents || !mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("supporters-showcase:open-coffee-panel");
  });

  ipcMain.on("desktop-ads:ready", (event) => {
    if (event.sender !== desktopAdsShowcaseWindow?.webContents) return;
    desktopAdsShowcaseReady = true;
    syncDesktopAdsShowcase({ forceShow: true });
  });

  ipcMain.on("desktop-ads:open", (event, value) => {
    if (event.sender !== desktopAdsShowcaseWindow?.webContents) return;
    const target = resolveDesktopAdUrl(value) || desktopAdsShowcasePayload?.contactUrl;
    if (!target) return;
    void shell.openExternal(target).catch(() => undefined);
  });

  ipcMain.on("desktop-ads:hover", (event, payload = {}) => {
    if (event.sender !== desktopAdsShowcaseWindow?.webContents) return;
    void showDesktopAdsTooltip(payload.text, payload.rect);
  });

  ipcMain.on("desktop-ads:leave", (event) => {
    if (event.sender !== desktopAdsShowcaseWindow?.webContents) return;
    hideWindowMoveHandleTooltip();
  });

  ipcMain.on("window-move-handle:hover", (event, hovering) => {
    if (event.sender !== windowMoveHandleWindow?.webContents) return;
    if (hovering) void showWindowMoveHandleTooltip();
    else hideWindowMoveHandleTooltip();
  });

  ipcMain.handle("screen-vision:mirror-source:set-selector-visible", async (event, visible) => {
    if (event.sender !== mainWindow?.webContents) return false;
    if (visible) nativeRuntimeActivatedForSession = true;
    mirrorGameSelectorRequestedVisible = multiClientMirrorEnabled && Boolean(visible);
    if (mirrorGameSelectorRequestedVisible) {
      await ensureMirrorGameSelector(mainWindow);
      syncMirrorGameSelector({ forceShow: true });
      void activateNativeRuntimeForMirror().catch(async (error) => {
        await writeDebugLog(`mirror-native-activation-failed ${error?.message || String(error)}`);
      });
    } else {
      syncMirrorGameSelector();
    }
    return true;
  });

  ipcMain.on("mirror-game-selector:hover", (event, sourceGame) => {
    if (event.sender !== mirrorGameSelectorWindow?.webContents) return;
    const game = normalizeMirrorSourceGame(sourceGame);
    void (async () => {
      await refreshMirrorGameSelectorAvailability({ force: true });
      if (!mirrorGameSelectorWindow || mirrorGameSelectorWindow.isDestroyed()) return;
      const unavailable = mirrorGameAvailability[game] !== true;
      const labels = unavailable ? getMirrorGameUnavailableLabels() : getMirrorGameSelectorLabels();
      await showMirrorGameSelectorTooltip(labels[game], unavailable ? "error" : "default");
    })();
  });

  ipcMain.on("mirror-game-selector:leave", (event) => {
    if (event.sender === mirrorGameSelectorWindow?.webContents) hideWindowMoveHandleTooltip();
  });

  ipcMain.handle("mirror-game-selector:choose", async (event, sourceGame) => {
    if (event.sender !== mirrorGameSelectorWindow?.webContents) return { activeGame: activeMirrorSourceGame };
    const game = normalizeMirrorSourceGame(sourceGame);
    await refreshMirrorGameSelectorAvailability({ force: true });
    if (mirrorGameAvailability[game] !== true) {
      return {
        activeGame: activeMirrorSourceGame,
        availability: { ...mirrorGameAvailability },
        unavailableLabels: getMirrorGameUnavailableLabels(),
        error: getMirrorSourceGameUnavailableMessage(game)
      };
    }
    return selectMirrorSourceGame(sourceGame);
  });

  ipcMain.on("window-move-handle:drag-start", (event, point = {}) => {
    if (event.sender !== windowMoveHandleWindow?.webContents || !mainWindow || mainWindow.isDestroyed()) return;
    const screenX = Number(point.screenX);
    const screenY = Number(point.screenY);
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
    hideWindowMoveHandleTooltip();
    preserveMainWindowTopmostDuringHandleDrag({ reassert: true });
    windowMoveHandleDragState = { screenX, screenY, bounds: mainWindow.getBounds() };
  });

  ipcMain.on("window-move-handle:drag-move", (event, point = {}) => {
    if (event.sender !== windowMoveHandleWindow?.webContents || !windowMoveHandleDragState || !mainWindow || mainWindow.isDestroyed()) return;
    const screenX = Number(point.screenX);
    const screenY = Number(point.screenY);
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;

    // Use the whole virtual desktop, not the work area of whichever monitor
    // the pointer currently crossed. This keeps the drag continuous over a
    // monitor seam instead of snapping or getting stuck at that monitor's edge.
    const area = getWindowMoveHandleVirtualWorkArea();
    const start = windowMoveHandleDragState;
    const nextX = clamp(
      Math.round(start.bounds.x + screenX - start.screenX),
      area.x,
      Math.max(area.x, area.x + area.width - start.bounds.width)
    );
    const nextY = clamp(
      Math.round(start.bounds.y + screenY - start.screenY),
      area.y,
      Math.max(area.y, area.bottom - start.bounds.height)
    );
    mainWindow.setPosition(nextX, nextY, false);
    preserveMainWindowTopmostDuringHandleDrag();
    syncWindowMoveHandle();
  });

  ipcMain.on("window-move-handle:drag-end", (event) => {
    if (event.sender !== windowMoveHandleWindow?.webContents) return;
    windowMoveHandleDragState = null;
    preserveMainWindowTopmostDuringHandleDrag({ reassert: true });
    syncWindowMoveHandle();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
  });

  ipcMain.handle("desktop:global-world-picker:open", async (event, payload = {}) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    return openDesktopGlobalWorldPicker(owner, payload);
  });

  ipcMain.on("desktop:global-world-picker:select", (event, slug) => {
    const picker = BrowserWindow.fromWebContents(event.sender);
    if (!picker || picker !== desktopGlobalWorldPickerWindow) return;
    const owner = desktopGlobalWorldPickerOwner;
    const normalizedSlug = String(slug || "").trim();
    if (owner && !owner.isDestroyed() && normalizedSlug) {
      owner.webContents.send("desktop:global-world-picker:selected", normalizedSlug);
    }
    closeDesktopGlobalWorldPicker();
  });

  ipcMain.on("desktop:global-world-picker:close", (event) => {
    const picker = BrowserWindow.fromWebContents(event.sender);
    if (picker && picker === desktopGlobalWorldPickerWindow) {
      closeDesktopGlobalWorldPicker();
    }
  });

  ipcMain.handle("desktop:screenshot:get-settings", async () => readDesktopScreenshotSettings());
  ipcMain.handle("desktop:screenshot:set-upscale", async (_event, value) => {
    const settings = await readDesktopScreenshotSettings();
    settings.upscaleFactor = Math.min(20, Math.max(1, Math.round(Number(value) || 1)));
    return { settings: await writeDesktopScreenshotSettings(settings) };
  });
  ipcMain.handle("desktop:screenshot:set-delete-original", async (_event, value) => {
    const settings = await readDesktopScreenshotSettings();
    settings.deleteOriginal = Boolean(value);
    return { settings: await writeDesktopScreenshotSettings(settings) };
  });
  ipcMain.handle("desktop:screenshot:get-availability", async () => {
    const settings = await readDesktopScreenshotSettings();
    const screenshotDirectory = await findDesktopTibiaScreenshotDirectory(settings);
    return {
      tibiaOpen: Boolean(await getTibiaClientBounds()),
      screenshotDirectory,
      discoveryState: screenshotDirectory ? "found" : "not-found"
    };
  });

  ipcMain.handle("desktop:screenshot:choose-directory", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const settings = await readDesktopScreenshotSettings();
    const picked = await dialog.showOpenDialog(owner, {
      title: "Escolher diretório de screenshots",
      defaultPath: settings.outputDirectory,
      properties: ["openDirectory", "createDirectory"]
    });
    if (picked.canceled || !picked.filePaths?.[0]) return { settings };
    settings.outputDirectory = picked.filePaths[0];
    return { settings: await writeDesktopScreenshotSettings(settings) };
  });

  ipcMain.handle("desktop:screenshot:choose-source-directory", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    return chooseDesktopTibiaScreenshotDirectoryFromMain(owner);
  });

  ipcMain.handle("desktop:screenshot:open-directory", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    return openDesktopScreenshotOutputDirectory(owner);
  });

  ipcMain.handle("desktop:screenshot-assistant:open-directory", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    return openDesktopScreenshotOutputDirectory(owner);
  });

  ipcMain.handle("desktop:screenshot-assistant:show", async (_event, options = {}) => {
    const settings = await readDesktopScreenshotSettings();
    const tutorial = Boolean(options?.tutorial);
    const launcher = Boolean(options?.launcher);
    if (!settings.enabled && !tutorial && !launcher) return { opened: false, enabled: false };
    desktopScreenshotAssistantDismissed = false;
    const window = await ensureDesktopScreenshotAssistant(settings, { allowDisabled: tutorial || launcher });
    if (!window || window.isDestroyed()) return { opened: false, enabled: Boolean(settings.enabled) };
    if (tutorial) {
      const owner = BrowserWindow.fromWebContents(_event.sender) || mainWindow;
      const ownerBounds = owner && !owner.isDestroyed() ? owner.getBounds() : window.getBounds();
      const currentBounds = window.getBounds();
      const display = screen.getDisplayMatching(ownerBounds);
      const area = display.workArea;
      const x = Math.max(area.x + 16, Math.min(
        ownerBounds.x + ownerBounds.width - currentBounds.width - 18,
        area.x + area.width - currentBounds.width - 16
      ));
      const y = Math.max(area.y + 16, Math.min(
        ownerBounds.y + 72,
        area.y + area.height - currentBounds.height - 16
      ));
      window.setBounds({ x, y, width: currentBounds.width, height: currentBounds.height }, false);
    }
    window.showInactive();
    prioritizeDesktopScreenshotAssistant(window, BrowserWindow.fromWebContents(_event.sender) || mainWindow);
    if (tutorial) window.webContents.send("desktop:screenshot:assistant-tutorial-focus", true);
    return { opened: true, enabled: Boolean(settings.enabled), bounds: window.getBounds() };
  });

  ipcMain.handle("desktop:screenshot-assistant:show-help", async () => {
    return showDesktopScreenshotAssistantHelp();
  });

  ipcMain.handle("desktop:screenshot-assistant:set-tutorial-focus", async (_event, active) => {
    const window = desktopScreenshotAssistantWindow;
    if (!window || window.isDestroyed()) return false;
    window.webContents.send("desktop:screenshot:assistant-tutorial-focus", Boolean(active));
    if (!active) {
      const settings = await readDesktopScreenshotSettings();
      if (!settings.enabled) {
        closeDesktopScreenshotAssistant();
      }
    }
    return true;
  });

  ipcMain.handle("desktop:screenshot-assistant:get-state", async () => {
    const settings = await readDesktopScreenshotSettings();
    return {
      enabled: Boolean(settings.enabled),
      hasSelection: Boolean(settings.selection),
      deleteOriginal: Boolean(settings.deleteOriginal),
      newScreenshotCount: desktopScreenshotAssistantNewCount
    };
  });

  ipcMain.handle("desktop:screenshot-assistant:set-enabled", async (_event, value) => {
    const settings = await readDesktopScreenshotSettings();
    const requested = Boolean(value);
    if (requested && !await getTibiaClientBounds()) {
      notifyDesktopScreenshotAssistantState(settings, { needsTibia: true });
      return { settings, tibiaOpen: false, needsTibia: true };
    }
    if (requested && !settings.selection) {
      notifyDesktopScreenshotAssistantState(settings, { needsSelection: true });
      return { settings, missingSelection: true };
    }
    if (requested && !await findDesktopTibiaScreenshotDirectory(settings)) {
      return {
        settings,
        sourceDirectoryRequired: true,
        error: "Selecione a pasta de screenshots do Tibia antes de ativar."
      };
    }

    settings.enabled = requested;
    const savedSettings = await writeDesktopScreenshotSettings(settings);
    await syncDesktopScreenshotWatcher(savedSettings);
    return { settings: savedSettings };
  });

  ipcMain.handle("desktop:screenshot-assistant:toggle-delete-original", async () => {
    const settings = await readDesktopScreenshotSettings();
    settings.deleteOriginal = !settings.deleteOriginal;
    return { settings: await writeDesktopScreenshotSettings(settings) };
  });

  ipcMain.handle("desktop:screenshot-assistant:reselect", async () => {
    try {
      return await reselectDesktopScreenshotArea();
    } catch (error) {
      await writeDebugLog(`desktop-screenshot-reselect-failed ${error?.message || String(error)}`);
      return { error: "Não foi possível selecionar uma nova área da screenshot." };
    }
  });

  ipcMain.handle("desktop:screenshot-assistant:close", async () => {
    desktopScreenshotAssistantDismissed = true;
    closeDesktopScreenshotAssistant("renderer-click");
    return true;
  });

  ipcMain.handle("desktop:screenshot:capture", async () => {
    try {
      return await captureDesktopScreenshot();
    } catch (error) {
      await writeDebugLog(`desktop-screenshot-selection-failed ${error?.message || String(error)}`);
      return { error: "Não foi possível definir a área da screenshot." };
    }
  });

  ipcMain.handle("desktop:screenshot-selector:complete", async (event, payload = {}) => {
    const selector = desktopScreenshotSelector;
    if (!selector || event.sender !== selector.window?.webContents) return false;
    const relativeBounds = normalizeSelectionBounds(payload.captureBounds, 16);
    const bounds = relativeBounds ? {
      x: selector.display.bounds.x + relativeBounds.x,
      y: selector.display.bounds.y + relativeBounds.y,
      width: relativeBounds.width,
      height: relativeBounds.height
    } : null;
    if (!bounds || !screenshotBoundsFitDisplay(bounds, selector.display)) return false;
    const { resolve, window } = selector;
    desktopScreenshotSelector = null;
    resolve(bounds);
    window.close();
    return true;
  });

  ipcMain.handle("desktop:screenshot-selector:get-preview", async (event) => {
    const selector = desktopScreenshotSelector;
    if (!selector || event.sender !== selector.window?.webContents) return null;
    return selector.preview || null;
  });

  ipcMain.handle("desktop:screenshot-selector:cancel", async (event) => {
    const selector = desktopScreenshotSelector;
    if (!selector || event.sender !== selector.window?.webContents) return false;
    const { resolve, window } = selector;
    desktopScreenshotSelector = null;
    resolve(null);
    window.close();
    return true;
  });

  const getWheelInformationBounds = (owner, rect, width, height) => {
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
  };

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

  ipcMain.handle("tutorial:preload", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const popover = await ensureTutorialPopoverWindow(owner);
    return Boolean(popover && !popover.isDestroyed());
  });

  ipcMain.handle("tutorial:show-step", async (event, payload = {}) => {
    const startedAt = performance.now();
    void writePerformanceMetric("tutorial-popover-show-step-received");
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!owner || owner.isDestroyed()) {
      return false;
    }

    const width = 390;
    // Start every auto-sized tutorial at the same safe baseline. The popover
    // renderer immediately adapts this to the media and localized copy.
    const requestedHeight = payload.autoHeight === true
      ? 360
      : Number(payload.height);
    const height = Math.max(220, Math.min(900, Math.round(requestedHeight || 330)));
    const ownerBounds = owner.getBounds();
    const rect = payload.rect || {};
    const screenRect = payload.screenRect && typeof payload.screenRect === "object"
      ? payload.screenRect
      : null;
    const target = screenRect ? {
      x: Math.round(Number(screenRect.x) || ownerBounds.x),
      y: Math.round(Number(screenRect.y) || ownerBounds.y),
      width: Math.max(1, Math.round(Number(screenRect.width) || 1)),
      height: Math.max(1, Math.round(Number(screenRect.height) || 1))
    } : {
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
    const candidates = orderedPlacements.map((placement) => ({
      ...buildCandidate(placement),
      placement
    }));
    const fits = ({ x, y }) => x >= area.x && y >= area.y
      && x + width <= area.x + area.width
      && y + height <= area.y + area.height;
    const chosen = candidates.find(fits) || candidates[0];
    const x = Math.max(area.x, Math.min(chosen.x, area.x + area.width - width));
    const y = Math.max(area.y, Math.min(chosen.y, area.y + area.height - height));
    tutorialPopoverResizePlacement = chosen.placement;

    await ensureTutorialPopoverWindow(owner, { x, y, width, height });
    if (!tutorialPopoverWindow || tutorialPopoverWindow.isDestroyed()) {
      return false;
    }

    tutorialPopoverWindow.setAlwaysOnTop(true, "screen-saver");
    tutorialPopoverWindow.moveTop();
    // A reutilizacao preserva o DOM anterior. Prepare o novo passo enquanto a
    // janela continua oculta; exibi-la antes da renderizacao fazia o conteudo
    // do passo anterior aparecer por alguns frames em transicoes lentas.
    const serializedPayload = JSON.stringify(payload).replace(/</g, "\\u003c");
    await tutorialPopoverWindow.webContents.executeJavaScript(
      `window.renderTutorialPopover?.(${serializedPayload});`
    ).catch(() => {});
    tutorialPopoverWindow.showInactive();
    void writePerformanceMetric("tutorial-popover-show-step-dispatched", {
      elapsedMs: Math.round(performance.now() - startedAt)
    });
    return true;
  });

  ipcMain.handle("tutorial:close-step", async () => {
    if (tutorialPopoverWindow && !tutorialPopoverWindow.isDestroyed()) {
      // Keep the already-loaded renderer and decoded tutorial media alive.
      // Recreating this transparent BrowserWindow for every step was the main
      // source of long transitions on weaker PCs.
      if (tutorialPopoverWindow.isVisible()) {
        // Compose one empty frame while visible before hiding. This prevents
        // the Windows compositor from showing the prior step's cached surface
        // when this transparent BrowserWindow is reused.
        await tutorialPopoverWindow.webContents.executeJavaScript(
          "window.clearTutorialPopover?.(); new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
        ).catch(() => {});
      }
      tutorialPopoverWindow.hide();
    }
    return true;
  });

  ipcMain.handle("tutorial-popover:resize-to-content", async (event, requestedHeight) => {
    if (!tutorialPopoverWindow || tutorialPopoverWindow.isDestroyed()
      || event.sender !== tutorialPopoverWindow.webContents) {
      return { height: 0, constrained: false };
    }

    const bounds = tutorialPopoverWindow.getBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    const desiredHeight = Math.max(220, Math.round(Number(requestedHeight) || bounds.height));
    const maximumHeight = Math.max(220, area.height - 16);
    const height = Math.min(maximumHeight, desiredHeight);
    if (height !== bounds.height) {
      const heightDelta = height - bounds.height;
      const requestedY = tutorialPopoverResizePlacement === "bottom"
        ? bounds.y
        : tutorialPopoverResizePlacement.startsWith("top")
          ? bounds.y - heightDelta
          : bounds.y - Math.round(heightDelta / 2);
      const y = Math.max(area.y, Math.min(
        requestedY,
        area.y + area.height - height
      ));
      tutorialPopoverWindow.setBounds({ x: bounds.x, y, width: bounds.width, height }, false);
    }
    return { height, constrained: desiredHeight > maximumHeight };
  });

  ipcMain.handle("tutorial:set-window-locked", async (event, locked) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!owner || owner.isDestroyed()) {
      return false;
    }

    owner.setResizable(!locked);
    return true;
  });

  ipcMain.handle("tutorial:set-priority", async (event, active) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!owner || owner.isDestroyed()) {
      return false;
    }
    setTutorialPriority(owner, active === true);
    syncMirrorGameSelector({ forceShow: active !== true });
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

  ipcMain.handle("tutorial:focus-supporters-showcase", async (event, target) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!owner || owner.isDestroyed() || owner !== mainWindow) {
      return { active: false, bounds: null };
    }

    supportersShowcaseTutorialFocus = normalizeSupportersShowcaseTutorialFocus(target);
    const showcase = supportersShowcaseWindow && !supportersShowcaseWindow.isDestroyed()
      ? supportersShowcaseWindow
      : supportersShowcaseTutorialFocus
        ? await ensureSupportersShowcase(owner)
        : null;
    if (!showcase || showcase.isDestroyed()) {
      return { active: false, bounds: null };
    }

    showcase.webContents.send("supporters-showcase:tutorial-focus", supportersShowcaseTutorialFocus);
    syncSupportersShowcase({ forceShow: Boolean(supportersShowcaseTutorialFocus) });
    return {
      active: Boolean(supportersShowcaseTutorialFocus),
      bounds: await getSupportersShowcaseTutorialFocusBounds(showcase, supportersShowcaseTutorialFocus)
    };
  });

  ipcMain.handle("tutorial:focus-mirror-game-selector", async (event, active) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!owner || owner.isDestroyed() || owner !== mainWindow || !multiClientMirrorEnabled) {
      return { active: false, bounds: null };
    }

    mirrorGameSelectorTutorialFocus = Boolean(active);
    const selector = mirrorGameSelectorWindow && !mirrorGameSelectorWindow.isDestroyed()
      ? mirrorGameSelectorWindow
      : mirrorGameSelectorTutorialFocus
        ? await ensureMirrorGameSelector(owner)
        : null;
    if (!selector || selector.isDestroyed()) {
      mirrorGameSelectorTutorialFocus = false;
      return { active: false, bounds: null };
    }

    syncMirrorGameSelector({ forceShow: mirrorGameSelectorTutorialFocus });
    emitMirrorGameSelectorRender();
    return {
      active: mirrorGameSelectorTutorialFocus,
      bounds: mirrorGameSelectorTutorialFocus ? selector.getBounds() : null
    };
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
    const baseWidth = Math.max(535, Math.round(owner.__dockedToolPanelBaseMinWidth || 535));

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
    if (desktopScreenshotFolderCreationHelpActive) {
      void closeDesktopScreenshotFolderCreationHelp(true);
      return;
    }
    if (desktopScreenshotAssistantHelpActive) {
      if (desktopScreenshotAssistantHelpStep < 1) {
        desktopScreenshotAssistantHelpStep += 1;
        void renderDesktopScreenshotAssistantHelpStep().catch(async (error) => {
          await writeDebugLog(`desktop-screenshot-assistant-help-step-failed ${error?.message || String(error)}`);
          await closeDesktopScreenshotAssistantHelp();
        });
      } else {
        void closeDesktopScreenshotAssistantHelp();
      }
      return;
    }
    void writePerformanceMetric("tutorial-popover-next-received");
    if (mainWindow && !mainWindow.isDestroyed()) {
      // The IPC channel works without focusing the owner. Focusing it here
      // steals focus from the native tutorial window before the next payload
      // is prepared, producing a visible app/popover z-order oscillation.
      mainWindow.webContents.send("tutorial:next");
    }
  });

  ipcMain.on("tutorial-popover:cancel", () => {
    if (desktopScreenshotFolderCreationHelpActive) {
      void closeDesktopScreenshotFolderCreationHelp(false);
      return;
    }
    if (desktopScreenshotAssistantHelpActive) {
      void closeDesktopScreenshotAssistantHelp();
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
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

  ipcMain.handle("app:performance-metric", async (_event, name, details = {}) => {
    await writePerformanceMetric(name, details);
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
      await ensureWindowMoveHandle(window);
      syncWindowMoveHandle({ forceShow: true });
      await writeDebugLog(`renderer-ready-show visible=${window.isVisible()} minimized=${window.isMinimized()}`);
      scheduleDeferredNativeRuntimeStartup();
      if (app.isPackaged && !isPortableTestRuntime) {
        scheduleDiagnosticsConsentPrompt();
      }
    }

    return true;
  });

  ipcMain.handle("data:send-message", async (_event, message) => {
    return handleDataServiceMessage(message);
  });

  ipcMain.handle("library-content:get-state", () => libraryContentSyncState);
  // Navigation can request this repeatedly while the user tours the app. Keep
  // the normal minimum interval here; the server signal remains authorized to
  // force an immediate sync when its token actually changes.
  ipcMain.handle("library-content:check", async () => checkLibraryCatalogUpdates());
  ipcMain.handle("library-content:activate", async () => activatePendingLibraryCatalogUpdate());

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

    const bundle = JSON.parse(await fs.readFile(assetPath, "utf8"));
    return normalizedPath === "assets/data/site-library-canonical.json"
      ? applyLibraryCatalogOverlay(bundle, libraryCatalogOverlayActive)
      : bundle;
  });

  ipcMain.handle("app:get-version", () => app.getVersion());

  ipcMain.handle("app-updater:get-state", () => appUpdateState);

  ipcMain.handle("app-updater:request-download", async () => {
    if (appUpdateDownloadPromptPromise) {
      return appUpdateDownloadPromptPromise;
    }

    if (appUpdateState.phase !== "available" || !appUpdaterController) {
      return appUpdateState;
    }

    const updateInfo = appUpdateState.info || appUpdaterController.getInfo();
    appUpdateState = { phase: "prompting", info: normalizeAppUpdateInfo(updateInfo) };
    broadcastAppUpdateState();

    appUpdateDownloadPromptPromise = (async () => {
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
        mediaWidth: 240,
        width: 456,
        height: 430,
        external: true,
        centerOnDisplay: true
      });

      if (!confirmed.confirmed) {
        appUpdateState = { phase: "available", info: normalizeAppUpdateInfo(updateInfo) };
        broadcastAppUpdateState();
        return appUpdateState;
      }

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
      return appUpdateState;
    })()
      .catch((error) => {
        if (appUpdateState.phase === "prompting") {
          appUpdateState = { phase: "available", info: normalizeAppUpdateInfo(updateInfo) };
          broadcastAppUpdateState();
        }
        throw error;
      })
      .finally(() => {
        appUpdateDownloadPromptPromise = null;
      });

    return appUpdateDownloadPromptPromise;
  });

  function normalizeSupporterAvatarUrlForDesktop(value, avatarAssetId = "") {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
    const rawValue = String(value || "").trim();
    const rawAssetId = String(avatarAssetId || "").trim();
    let avatarId = uuidPattern.test(rawAssetId) ? rawAssetId : "";

    try {
      const parsed = rawValue ? new URL(rawValue, accountSiteFetchBaseUrl) : null;
      const isSupportedPath = parsed
        && ["/account-api/product/avatar/public", "/api/product/avatar/public"].includes(parsed.pathname.replace(/\/$/, ""));

      if (parsed && isSupportedPath) {
        const candidateId = String(parsed.searchParams.get("id") || "").trim();
        if (uuidPattern.test(candidateId)) {
          avatarId = candidateId;
        }
      }
    } catch {
      return "";
    }

    if (!avatarId) {
      return "";
    }

    return new URL(`/account-api/product/avatar/public?id=${encodeURIComponent(avatarId)}`, accountSiteFetchBaseUrl).href;
  }

  function normalizeSupportersDocumentForDesktop(document) {
    const supporters = Array.isArray(document)
      ? document
      : document && typeof document === "object" && Array.isArray(document.supporters)
        ? document.supporters
        : null;

    if (!supporters) {
      return document;
    }

    const normalizedSupporters = supporters.map((entry) => {
      if (!entry || typeof entry !== "object") {
        return entry;
      }

      return {
        ...entry,
        avatarUrl: normalizeSupporterAvatarUrlForDesktop(entry.avatarUrl, entry.avatarAssetId)
      };
    });

    return Array.isArray(document)
      ? normalizedSupporters
      : { ...document, supporters: normalizedSupporters };
  }

  ipcMain.handle("supporters:fetch-document", async () => {
    let lastError = null;

    for (const url of runtimeSupportersDataUrls) {
      try {
        const response = await electronNet.fetch(url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return normalizeSupportersDocumentForDesktop(await response.json());
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Nenhuma fonte de apoiadores esta disponivel.");
  });

  ipcMain.handle("supporters:fetch-ranking-rates", async () => {
    return getSupportersRankingRates();
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

  ipcMain.handle("account:get-state", async () => {
    const account = await getAccountState();
    setMirrorAccountStateSnapshot(account);
    return account;
  });

  ipcMain.handle("account:refresh", async () => {
    const requestedRevision = accountSessionRevision;
    const account = await getAccountState();
    if (requestedRevision !== accountSessionRevision) {
      const disconnectedAccount = { connected: false, entitlements: [], benefits: [] };
      await syncMirrorVisibilityForAccountState(disconnectedAccount, "account-state-stale");
      return disconnectedAccount;
    }
    setMirrorAccountStateSnapshot(account);
    await syncMirrorVisibilityForAccountState(account, "account-state-refreshed");
    // Re-evaluate the entitlement and rebuild the showcase while the app is
    // already open. This is intentionally explicit: no background polling or
    // repeated ad downloads are introduced.
    await refreshDesktopAdsShowcase(account);
    return account;
  });

  ipcMain.handle("account:get-campaigns", async () => getAccountCampaignCatalog());

  ipcMain.handle("account:submit-feedback", async (_event, payload = {}) => submitAccountFeedback(payload));

  ipcMain.handle("account:open-page", async (_event, page = "account") => {
    const pages = {
      account: "/conta",
      profile: "/conta?tab=perfil",
      reports: "/conta?tab=tickets",
      proof: "/conta/enviar-comprovante"
    };
    const target = pages[String(page || "")] || pages.account;
    await shell.openExternal(new URL(target, accountSiteBaseUrl).href);
    return true;
  });

  ipcMain.handle("account:connect", async () => {
    const account = await connectAccountWithDeviceAuthorization();
    setMirrorAccountStateSnapshot(account);
    await syncMirrorVisibilityForAccountState(account, "account-connected");
    await refreshDesktopAdsShowcase(account);
    return account;
  });

  ipcMain.handle("account:disconnect", async () => {
    const disconnectedAccount = { connected: false, entitlements: [], benefits: [] };
    accountSessionRevision += 1;
    const { remoteRevocation } = await disconnectAccount();
    setMirrorAccountStateSnapshot(disconnectedAccount);
    // Reapply the Free visibility cap before waiting for the remote revoke.
    // The local UI and Mirror therefore change immediately on logout.
    await syncMirrorVisibilityForAccountState(disconnectedAccount, "account-disconnected");
    await Promise.all([
      refreshDesktopAdsShowcase(disconnectedAccount),
      remoteRevocation
    ]);
    return disconnectedAccount;
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

  ipcMain.handle("screen-vision:close-docked-panel", async (_event, payload = {}) => {
    const expectedPanelKey = typeof payload.panelKey === "string" ? payload.panelKey : "";

    if (expectedPanelKey && dockedToolPanelKey !== expectedPanelKey) {
      return false;
    }

    await closeDockedToolPanel();
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

  ipcMain.handle("screen-vision:obs-window:is-available", async () => {
    try {
      const { stdout } = await execFileAsync("tasklist.exe", [
        "/FI", "IMAGENAME eq obs64.exe",
        "/FO", "CSV",
        "/NH"
      ], { windowsHide: true, timeout: 1500 });
      if (/"obs64\.exe"/i.test(String(stdout || ""))) {
        return true;
      }

      const fallback = await execFileAsync("tasklist.exe", [
        "/FI", "IMAGENAME eq obs.exe",
        "/FO", "CSV",
        "/NH"
      ], { windowsHide: true, timeout: 1500 });
      return /"obs\.exe"/i.test(String(fallback.stdout || ""));
    } catch {
      return false;
    }
  });

  ipcMain.handle("screen-vision:obs:toggle", async (event) => {
    if (obsMirrorSync.getStatus().enabled) {
      return obsMirrorSync.disable();
    }

    const overlayToolsState = await readOverlayToolsState();
    const tibiaState = await getTibiaWindowState({ forceFresh: true });
    const ownerWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const payload = {
      // "Ativar espelhos no OBS" publishes Tibia crops into OBS. An OBS
      // Mirror is an OBS input and must never be fed back into that pipeline.
      regions: overlayToolsState.mirrors.items.filter((entry) => (
        entry.isVisible !== false
        && entry.sourceType !== "obs-window"
        && normalizeMirrorSourceGame(entry.sourceGame) === "tibia"
      )),
      tibiaState
    };
    const savedPassword = await readSavedObsWebSocketPassword();

    try {
      return await obsMirrorSync.enable({ ...payload, password: savedPassword });
    } catch (firstError) {
      const firstMessage = String(firstError?.message || firstError || "");
      if (!/auth|password|identify/i.test(firstMessage)) {
        await writeDebugLog(`obs-mirror-enable-failed ${firstMessage}`);
        const isMissingCapture = firstError?.code === "OBS_TIBIA_CAPTURE_MISSING";
        const isMissingScene = firstError?.code === "OBS_SCENE_UNAVAILABLE";
        const isConnectionFailure = /ECONNREFUSED|ECONNRESET|WebSocket|socket|connect|closed/i.test(firstMessage);
        return {
          ...obsMirrorSync.getStatus(),
          error: isMissingCapture
            ? tr("screenVision.obs.gameCaptureRequired")
            : isMissingScene
              ? tr("screenVision.obs.sceneRequired")
              : isConnectionFailure
                ? tr("screenVision.obs.setupRequired")
                : firstMessage,
          errorKind: isConnectionFailure ? "websocket" : "obs-scene"
        };
      }

      if (savedPassword) {
        await clearSavedObsWebSocketPassword();
      }
      const promptResult = await showScreenVisionPromptDialog(ownerWindow, {
        title: "OBS Studio",
        message: tr("screenVision.obs.passwordPrompt"),
        confirmLabel: tr("screenVision.obs.connect"),
        cancelLabel: tr("dialog.cancel"),
        inputType: "password",
        inputValue: "",
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

      const password = String(promptResult?.value || "").trim();

      try {
        const status = await obsMirrorSync.enable({ ...payload, password });
        if (promptResult?.checked) {
          await saveObsWebSocketPassword(password);
        } else {
          await clearSavedObsWebSocketPassword();
        }
        return status;
      } catch (retryError) {
        const retryMessage = String(retryError?.message || retryError || "");
        const isMissingCapture = retryError?.code === "OBS_TIBIA_CAPTURE_MISSING";
        const isMissingScene = retryError?.code === "OBS_SCENE_UNAVAILABLE";
        const isConnectionFailure = /ECONNREFUSED|ECONNRESET|WebSocket|socket|connect|closed/i.test(retryMessage);
        await writeDebugLog(`obs-mirror-auth-failed ${retryMessage}`);
        return {
          ...obsMirrorSync.getStatus(),
          error: isMissingCapture
            ? tr("screenVision.obs.gameCaptureRequired")
            : isMissingScene
              ? tr("screenVision.obs.sceneRequired")
              : isConnectionFailure
                ? tr("screenVision.obs.setupRequired")
                : tr("screenVision.obs.connectionFailed"),
          errorKind: isMissingCapture || isMissingScene ? "obs-scene" : "websocket"
        };
      }
    }
  });

  ipcMain.handle("screen-vision:dialogs:pick-audio-file", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const defaultAudioDir = await ensureScreenVisionCustomAudioDir();
    const restoreAlwaysOnTop = Boolean(ownerWindow && !ownerWindow.isDestroyed() && ownerWindow.isAlwaysOnTop());

    await writeDebugLog(`screen-vision-audio-picker-open owner=${ownerWindow?.screenVisionTool || "main"} topmost=${restoreAlwaysOnTop}`);

    try {
      // The Toolkit controller intentionally lives at Windows' screen-saver
      // topmost level.  A native file dialog can otherwise be created behind
      // that controller on some Windows 10/11 configurations and look as if it
      // never opened.  Lower only the owning controller while the modal dialog
      // is active, then restore the exact Toolkit behavior afterwards.
      if (restoreAlwaysOnTop) {
        ownerWindow.setAlwaysOnTop(false);
      }
      if (ownerWindow && !ownerWindow.isDestroyed()) {
        ownerWindow.show();
        ownerWindow.focus();
      }

      const dialogOptions = {
        title: tr("screenVision.alerts.selectAudio"),
        defaultPath: defaultAudioDir,
        properties: ["openFile"],
        filters: [
          {
            name: tr("screenVision.alerts.audioFiles"),
            extensions: ["ogg", "mp3", "wav", "flac", "m4a", "aac", "opus"]
          }
        ]
      };
      const result = ownerWindow && !ownerWindow.isDestroyed()
        ? await dialog.showOpenDialog(ownerWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
        await writeDebugLog("screen-vision-audio-picker-cancelled");
        return "";
      }

      const importedPath = await importScreenVisionCustomAudioFile(result.filePaths[0]);
      await writeDebugLog(`screen-vision-audio-picker-selected file=${path.basename(importedPath)}`);
      return importedPath;
    } catch (error) {
      await writeDebugLog(`screen-vision-audio-picker-error ${error?.message || String(error)}`);
      throw error;
    } finally {
      if (restoreAlwaysOnTop && ownerWindow && !ownerWindow.isDestroyed()) {
        ownerWindow.setAlwaysOnTop(true, "screen-saver");
        ownerWindow.moveTop();
      }
    }
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

  ipcMain.handle("screen-vision:timers:preview-sound", async (_event, payload = {}) => {
    const timer = normalizeOverlayTimerEntry({
      ...(payload?.timer && typeof payload.timer === "object" ? payload.timer : {}),
      id: "sound-preview"
    });

    if (!timer) {
      return { ok: false, error: "invalid-timer" };
    }

    const overlayToolsState = await readOverlayToolsState();
    const played = await playAlertTimerSound(timer, overlayToolsState, { force: true });
    return { ok: played };
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
    const visibleItems = getEffectivelyVisibleMirrorItems(
      overlayToolsState.mirrors.items,
      getMirrorAccountStateSnapshot()
    );
    return decorateScreenVisionRegions(filterMirrorRegionsForActiveSource(visibleItems));
  });

  ipcMain.handle("screen-vision:regions:count", async () => {
    const overlayToolsState = await readOverlayToolsState();
    return {
      counts: countMirrorRegionsByScope(overlayToolsState.mirrors.items),
      visibleCounts: countEffectivelyVisibleMirrorRegionsByScope(
        overlayToolsState.mirrors.items,
        getMirrorAccountStateSnapshot()
      ),
      totalCount: overlayToolsState.mirrors.items.length
    };
  });

  ipcMain.handle("screen-vision:regions:get", async (_event, payload = {}) => {
    const regionId = typeof payload.regionId === "string" ? payload.regionId : "";
    const overlayToolsState = await readOverlayToolsState();
    const items = decorateScreenVisionRegions(getEffectivelyVisibleMirrorItems(
      overlayToolsState.mirrors.items,
      getMirrorAccountStateSnapshot()
    ));
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
    const sourceGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";
    const tibiaState = await getMirrorSourceGameState(sourceGame);
    const initialOverlayToolsState = await readOverlayToolsState();

    if (!canUseTibiaWindowForScreenVision(tibiaState)) {
      return {
        cancelled: true,
        reason: "tibia-unavailable",
        items: initialOverlayToolsState.mirrors.items
      };
    }

    let selection = null;
    try {
      selection = await withGridVisibleDuringSelection(() => openNativeRegionSelectionWindow({
        preferredDisplayId: tibiaState.displayId || null,
        sourceGame
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

    const appendResult = await appendOverlayMirrorEntry((currentItems) => ({
      name: createNextRegionName(currentItems),
      displayId: selection.displayId,
      displayLabel: selection.displayLabel,
      displayBounds: selection.displayBounds,
      sourceBounds,
      sourceGame,
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
    }), {
      afterStore: async (storedState) => {
        await syncRegionMirrorWindows(storedState);
      }
    });

    if (appendResult?.blocked) {
      return {
        cancelled: true,
        reason: appendResult.reason,
        items: decorateScreenVisionRegions(appendResult.items),
        counts: appendResult.counts,
        visibleCounts: appendResult.visibleCounts,
        totalCount: appendResult.totalCount
      };
    }

    const { region, savedState } = appendResult;

    await writeDebugLog(`screen-vision-region-create region=${JSON.stringify(region)}`);
    await writeDebugLog(`screen-vision-region-saved count=${savedState.mirrors.items.length} regionId=${region.id}`);
    return {
      cancelled: false,
      region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === region.id) || region),
      items: decorateScreenVisionRegions(savedState.mirrors.items),
      counts: appendResult.counts,
      visibleCounts: appendResult.visibleCounts,
      totalCount: savedState.mirrors.items.length
    };
  });

  ipcMain.handle("screen-vision:regions:add-obs", async () => {
    const initialOverlayToolsState = await readOverlayToolsState();
    let selection = null;

    try {
      const supported = await nativeHostSupportsObsMirror();
      if (!supported) {
        await writeDebugLog("screen-vision-obs-region-selection-error reason=native-host-outdated");
        return {
          cancelled: true,
          reason: "native-host-outdated",
          items: initialOverlayToolsState.mirrors.items
        };
      }

      // OBS and Tibia mirrors use the same proven native selector/window
      // implementation. Source-specific visibility remains isolated below.
      selection = await withGridVisibleDuringSelection(() => openNativeRegionSelectionWindow({
        sourceType: "obs-window"
      }));
    } catch (error) {
      const errorMessage = error?.message || String(error);
      const reason = "selection-failed";
      await writeDebugLog(`screen-vision-obs-region-selection-error reason=${reason} error=${errorMessage}`);
      return {
        cancelled: true,
        reason,
        items: initialOverlayToolsState.mirrors.items
      };
    }

    const overlayToolsState = await readOverlayToolsState();
    if (!selection?.sourceHwnd || !selection.sourceBounds || !selection.captureBounds) {
      await writeDebugLog("screen-vision-obs-region-selection-cancelled");
      return {
        cancelled: true,
        items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
      };
    }

    const constrainedCaptureBounds = intersectBounds(selection.captureBounds, selection.sourceBounds, 1);
    if (!constrainedCaptureBounds) {
      await writeDebugLog(`screen-vision-obs-region-selection-outside-source selection=${JSON.stringify(selection.captureBounds)} source=${JSON.stringify(selection.sourceBounds)}`);
      return {
        cancelled: true,
        reason: "outside-obs-window",
        items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
      };
    }

    const mirrorRevealStartedAt = performance.now();
    const appendResult = await appendOverlayMirrorEntry((currentItems) => ({
      name: createNextRegionName(currentItems),
      displayId: selection.displayId,
      displayLabel: selection.displayLabel,
      displayBounds: selection.displayBounds,
      sourceType: "obs-window",
      sourceHwnd: selection.sourceHwnd,
      sourceCaptureId: selection.sourceCaptureId || "",
      sourceBounds: selection.sourceBounds,
      sourceWindowTitle: selection.sourceWindowTitle,
      sourceProcessName: selection.sourceProcessName,
      captureBounds: constrainedCaptureBounds,
      relativeBounds: toRelativeBounds(constrainedCaptureBounds, selection.sourceBounds),
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
    }), {
      afterStore: async (storedState) => {
        await syncRegionMirrorWindows(storedState);
        await writeDebugLog(`screen-vision-obs-region-revealed elapsedMs=${Math.round(performance.now() - mirrorRevealStartedAt)}`);
      }
    });

    if (appendResult?.blocked) {
      return {
        cancelled: true,
        reason: appendResult.reason,
        items: decorateScreenVisionRegions(appendResult.items),
        counts: appendResult.counts,
        visibleCounts: appendResult.visibleCounts,
        totalCount: appendResult.totalCount
      };
    }

    const { region, savedState } = appendResult;

    await writeDebugLog(`screen-vision-obs-region-create region=${JSON.stringify(region)}`);

    return {
      cancelled: false,
      region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === region.id) || region),
      items: decorateScreenVisionRegions(savedState.mirrors.items),
      counts: appendResult.counts,
      visibleCounts: appendResult.visibleCounts,
      totalCount: savedState.mirrors.items.length
    };
  });

  ipcMain.handle("screen-vision:regions:add-fixed", async () => {
    const sourceGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";
    const tibiaState = await getMirrorSourceGameState(sourceGame);
    const initialOverlayToolsState = await readOverlayToolsState();

    if (!canUseTibiaWindowForScreenVision(tibiaState)) {
      return {
        cancelled: true,
        reason: "tibia-unavailable",
        items: initialOverlayToolsState.mirrors.items
      };
    }

    let selection = null;
    try {
      selection = await withGridVisibleDuringSelection(() => openNativeRegionSelectionWindow({
        preferredDisplayId: tibiaState.displayId || null,
        mode: "fixed-icon-crop",
        fixedSize: 32,
        sourceGame
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

    const appendResult = await appendOverlayMirrorEntry((currentItems) => ({
      name: createNextRegionName(currentItems),
      displayId: selection.displayId,
      displayLabel: selection.displayLabel,
      displayBounds: selection.displayBounds,
      sourceBounds,
      sourceGame,
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
    }), {
      afterStore: async (storedState) => {
        await syncRegionMirrorWindows(storedState);
      }
    });

    if (appendResult?.blocked) {
      return {
        cancelled: true,
        reason: appendResult.reason,
        items: decorateScreenVisionRegions(appendResult.items),
        counts: appendResult.counts,
        visibleCounts: appendResult.visibleCounts,
        totalCount: appendResult.totalCount
      };
    }

    const { region, savedState } = appendResult;

    await writeDebugLog(`screen-vision-fixed-region-create region=${JSON.stringify(region)}`);
    await writeDebugLog(`screen-vision-fixed-region-saved count=${savedState.mirrors.items.length} regionId=${region.id}`);
    return {
      cancelled: false,
      region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === region.id) || region),
      items: decorateScreenVisionRegions(savedState.mirrors.items),
      counts: appendResult.counts,
      visibleCounts: appendResult.visibleCounts,
      totalCount: savedState.mirrors.items.length
    };
  });

  ipcMain.handle("screen-vision:magnifier:get", async () => {
    if (!nativeHostProcess || nativeHostProcess.exitCode !== null || nativeHostProcess.killed === true) {
      nativeCursorMagnifierEnabled = false;
      return { enabled: false };
    }
    await ensureNativeHostStarted();
    const response = await callNativeHost({ command: "getCursorMagnifier" });
    nativeCursorMagnifierEnabled = Boolean(response?.ok && response?.data?.enabled);
    return {
      enabled: nativeCursorMagnifierEnabled
    };
  });

  ipcMain.handle("screen-vision:magnifier:toggle", async () => {
    const sourceGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";
    const tibiaState = await getMirrorSourceGameState(sourceGame, { forceFresh: true });

    if (!canUseTibiaWindowForScreenVision(tibiaState)) {
      return {
        enabled: false,
        reason: "tibia-unavailable",
        sourceGame
      };
    }

    await ensureNativeHostStarted();
    const current = await callNativeHost({ command: "getCursorMagnifier" });
    const enabled = !Boolean(current?.ok && current?.data?.enabled);
    const response = await callNativeHost({
      command: "setCursorMagnifier",
      enabled,
      sourceGame,
      knownHwnd: Number(tibiaState?.hwnd || 0),
      knownProcessId: Number(tibiaState?.processId || 0),
      knownTitle: String(tibiaState?.title || "")
    });
    const applied = Boolean(response?.ok && response?.data?.enabled);
    nativeCursorMagnifierEnabled = applied;
    await writeDebugLog(`screen-vision-cursor-magnifier enabled=${applied} sourceGame=${sourceGame}`);
    return {
      enabled: applied,
      sourceGame
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
    const effectiveSavedItems = getEffectivelyVisibleMirrorItems(
      savedState.mirrors.items,
      getMirrorAccountStateSnapshot()
    );
    await syncRegionMirrorWindows(savedState, {
      allowEmpty: !effectiveSavedItems.some((entry) => entry.isVisible)
    });
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

  function isMirrorInSelectedBulkScope(entry, activeGame) {
    return entry?.sourceType === "obs-window"
      || normalizeMirrorSourceGame(entry?.sourceGame) === activeGame;
  }

  ipcMain.handle("screen-vision:regions:toggle-all-visibility", async () => {
    const savedState = await enqueueOverlayToolsMutation(async () => {
      const overlayToolsState = await readOverlayToolsState();
      const activeGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";
      const effectiveItems = getEffectivelyVisibleMirrorItems(
        overlayToolsState.mirrors.items,
        getMirrorAccountStateSnapshot()
      );
      const activeRegions = effectiveItems.filter((entry) => (
        isMirrorInSelectedBulkScope(entry, activeGame)
      ));
      const shouldShowAll = activeRegions.some((entry) => entry.isVisible === false);
      overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.map((entry) => ({
        ...entry,
        isVisible: isMirrorInSelectedBulkScope(entry, activeGame)
          ? shouldShowAll
          : entry.isVisible
      }));
      return writeOverlayToolsState(overlayToolsState);
    });
    const effectiveSavedItems = getEffectivelyVisibleMirrorItems(
      savedState.mirrors.items,
      getMirrorAccountStateSnapshot()
    );
    await syncRegionMirrorWindows(savedState, {
      allowEmpty: !effectiveSavedItems.some((entry) => entry.isVisible)
    });
    return {
      items: decorateScreenVisionRegions(savedState.mirrors.items)
    };
  });

  ipcMain.handle("screen-vision:regions:toggle-all-lock", async () => {
    const mutationResult = await enqueueOverlayToolsMutation(async () => {
      const overlayToolsState = await readOverlayToolsState();
      const activeGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";
      const activeRegions = overlayToolsState.mirrors.items.filter((entry) => (
        isMirrorInSelectedBulkScope(entry, activeGame)
      ));
      const shouldLockAll = activeRegions.some((entry) => !entry.isLocked);
      overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.map((entry) => ({
        ...entry,
        isLocked: isMirrorInSelectedBulkScope(entry, activeGame)
          ? shouldLockAll
          : entry.isLocked
      }));
      const savedState = await writeOverlayToolsState(overlayToolsState);
      return { activeRegions, savedState, shouldLockAll };
    });
    const { activeRegions, savedState, shouldLockAll } = mutationResult;

    if (!shouldLockAll) {
      for (const region of activeRegions) {
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
    const savedState = await enqueueOverlayToolsMutation(async () => {
      const overlayToolsState = await readOverlayToolsState();
      overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.filter((entry) => entry.id !== regionId);
      return writeOverlayToolsState(overlayToolsState);
    });
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
    const sourceGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";
    const tibiaState = await getMirrorSourceGameState(sourceGame);
    const shouldShowOverlays = await shouldShowScreenVisionOverlays(tibiaState).catch(() => false);
    const needsNativeForegroundContext = Boolean(
      nativeHostProcess && nativeHostProcess.exitCode === null && nativeHostProcess.killed !== true
    );
    // OBS is an allowed companion surface for the Mirror UI. Keep this separate
    // from the actual overlay visibility rule, which must still stay below OBS.
    const foregroundContext = !shouldShowOverlays && needsNativeForegroundContext
      ? await getNativeForegroundContext()
      : null;
    const obsStudioFocused = Boolean(foregroundContext?.obsStudioFocused);
    const mirrorInteractionActive = Boolean(foregroundContext?.mirrorInteractionActive);
    const toolkitFocused = Boolean(foregroundContext?.toolkitFocused);
    const controllerFocused = !shouldShowOverlays
      ? await isAnyControllerWindowFocused().catch(() => false)
      : false;
    const shouldShowMirrorUi = Boolean(
      shouldShowOverlays
      || (
        (obsStudioFocused || mirrorInteractionActive || toolkitFocused || controllerFocused)
        && canUseTibiaWindowForScreenVision(tibiaState)
      )
    );
    const payload = tibiaState
      ? {
          ...tibiaState,
          sourceGame,
          shouldShowOverlays,
          shouldShowMirrorUi
        }
      : {
          sourceGame,
          shouldShowOverlays: false,
          shouldShowMirrorUi: false
        };
    const payloadSignature = JSON.stringify(payload);
    if (payloadSignature !== lastTibiaStateLogSignature) {
      lastTibiaStateLogSignature = payloadSignature;
      await writeDebugLog(`screen-vision-tibia-state ${payloadSignature}`);
    }
    return payload;
  });

  ipcMain.handle("screen-vision:capture:get-screen-sources", async () => {
    return listDesktopSources("screen");
  });

  ipcMain.handle("screen-vision:capture:get-window-sources", async () => {
    return listDesktopSources("window");
  });
}

function scheduleDeferredNativeRuntimeStartup() {
  if (deferredNativeRuntimeStartupPromise || nativeHostShutdownRequested || appIsQuitting) {
    return deferredNativeRuntimeStartupPromise;
  }

  deferredNativeRuntimeStartupPromise = new Promise((resolve) => {
    setTimeout(resolve, 1000);
  })
    .then(async () => {
      if (nativeHostShutdownRequested || appIsQuitting) {
        return;
      }

      await writeDebugLog("deferred-screen-vision-bootstrap:start");
      await writeDebugLog("bootstrap-screen-vision-profiles:start");
      await bootstrapScreenVisionProfiles();
      await writeDebugLog("bootstrap-screen-vision-profiles:finish");
      await writeDebugLog("deferred-screen-vision-bootstrap:profiles-ready-native-lazy");
    })
    .catch(async (error) => {
      await writeDebugLog(`deferred-native-runtime-failed ${error?.message || String(error)}`);
    });

  return deferredNativeRuntimeStartupPromise;
}

async function activateNativeRuntimeForMirror() {
  await scheduleDeferredNativeRuntimeStartup();
  if (nativeHostShutdownRequested || appIsQuitting) return;
  const state = await readOverlayToolsState();
  const sourceGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";
  const sourceState = await getMirrorSourceGameState(sourceGame, { forceFresh: false }).catch(() => null);

  // Opening the Mirror tab must not create native windows with HWND=0. Besides
  // being visually meaningless, starting and immediately destroying several
  // DWM windows is enough to freeze the main UI on startup-like navigation.
  // Region creation already validates the source; this protects persisted
  // visible regions until their source is actually available again.
  if (!canUseTibiaWindowForScreenVision(sourceState)) {
    await writeDebugLog(`mirror-native-activation-skipped sourceGame=${sourceGame} reason=window-unavailable`);
    return;
  }

  // Timer hotkeys use the Native Host too. Keep them behind the same source
  // gate so merely opening the app or the Mirror UI without a playable client
  // cannot wake the full native runtime.
  await syncAlertTimerHotkeys(state);
  await syncRegionMirrorWindows(state, { sourceState });
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
    mediaWidth: 240,
    width: 800,
    height: 540,
    updateLayout: true,
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

async function restoreActiveMirrorSourceGame() {
  if (!multiClientMirrorEnabled) {
    activeMirrorSourceGame = "tibia";
    return { sourceGame: "tibia", restored: false, reason: "multi-client-disabled" };
  }

  const stored = await readJsonFile(screenVisionActiveSourceGamePath, null);
  const requestedGame = normalizeMirrorSourceGame(stored?.sourceGame || "tibia");

  if (requestedGame === "tibia") {
    activeMirrorSourceGame = "tibia";
    return { sourceGame: "tibia", restored: false, reason: "default" };
  }

  const sourceState = await getMirrorSourceGameState(requestedGame, { forceFresh: false }).catch(() => null);
  if (!canUseTibiaWindowForScreenVision(sourceState)) {
    // Keep the requested game on disk. If the user opens it before the next
    // launch, its own profiles and selection will resume automatically.
    activeMirrorSourceGame = "tibia";
    await writeDebugLog(`mirror-source-restore fallback=tibia requested=${requestedGame} reason=window-unavailable`);
    return { sourceGame: "tibia", restored: false, reason: "window-unavailable" };
  }

  activeMirrorSourceGame = requestedGame;
  mirrorGameAvailability = {
    ...mirrorGameAvailability,
    [requestedGame]: true
  };
  await writeDebugLog(`mirror-source-restore applied sourceGame=${requestedGame} hwnd=${sourceState.hwnd}`);
  return { sourceGame: requestedGame, restored: true, sourceState };
}

async function persistActiveMirrorSourceGame(sourceGame = activeMirrorSourceGame) {
  if (!multiClientMirrorEnabled) return;
  const game = normalizeMirrorSourceGame(sourceGame);
  await writeJsonFileAtomic(screenVisionActiveSourceGamePath, { sourceGame: game });
  await writeDebugLog(`mirror-source-persisted sourceGame=${game}`);
}

async function bootstrapScreenVisionProfiles() {
  await restoreActiveMirrorSourceGame();
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

  // Mirror visibility is a runtime-only convenience, never a startup
  // preference. Preserve every saved region/profile, but require the user to
  // explicitly turn mirrors back on after each application launch.
  const visibleMirrorCount = overlayToolsState?.mirrors?.items?.filter((entry) => entry.isVisible).length || 0;
  if (visibleMirrorCount > 0) {
    overlayToolsState.mirrors.items = overlayToolsState.mirrors.items.map((entry) => ({
      ...entry,
      isVisible: false
    }));
  }
  await writeDebugLog(`bootstrap-screen-vision-profiles:startup-mirrors-hidden count=${visibleMirrorCount}`);

  await writeDebugLog("bootstrap-screen-vision-profiles:write-state:start");
  await writeOverlayToolsState(overlayToolsState, {
    reason: "bootstrap-profile",
    skipPersistProfile: true,
    skipSyncHotkeys: true,
    skipSyncNativeAuxiliary: true,
    skipEmit: true
  });
  await writeDebugLog("bootstrap-screen-vision-profiles:write-state:finish");
}

async function activateScreenVisionProfileForSourceGame(sourceGame, options = {}) {
  const game = normalizeMirrorSourceGame(sourceGame);
  const profilesDir = await ensureScreenVisionProfilesDirForGame(game);
  let profilePath = await readLastScreenVisionProfilePath(game);
  const isPathForGame = Boolean(
    profilePath
    && pathsEqual(path.dirname(profilePath), profilesDir)
    && await fileExists(profilePath)
  );

  if (!isPathForGame) {
    const profiles = await listScreenVisionProfiles(game);
    profilePath = profiles[0]?.path || null;
  }

  await clearAllTimerVisualAlertWindows();
  await clearAlertPositionEditorWindows();

  let overlayToolsState;
  if (profilePath) {
    activeScreenVisionProfilePath = profilePath;
    await saveLastScreenVisionProfilePath(profilePath, game);
    overlayToolsState = await loadOverlayToolsStateFromProfile(profilePath, {
      sourceGame: game,
      sourceState: options.sourceState || null,
      useLiveTibiaState: true
    });
  } else {
    activeScreenVisionProfilePath = null;
    await saveLastScreenVisionProfilePath("", game);
    overlayToolsState = createEmptyProfileOverlayState();
  }

  const carriedWallClockTimers = Array.isArray(options.wallClockTimers)
    ? options.wallClockTimers.map((entry) => normalizeOverlayTimerEntry(entry)).filter(Boolean)
    : [];
  if (carriedWallClockTimers.length > 0) {
    const timersById = new Map(
      (Array.isArray(overlayToolsState.timers?.items) ? overlayToolsState.timers.items : [])
        .map((entry) => normalizeOverlayTimerEntry(entry))
        .filter(Boolean)
        .map((entry) => [entry.id, entry])
    );
    for (const timer of carriedWallClockTimers) {
      timersById.set(timer.id, timer);
    }
    overlayToolsState.timers.items = [...timersById.values()];
  }

  // Switching clients is an explicit runtime boundary. Keep each profile's
  // definitions and settings, but never reactivate runtime features merely
  // because that client was selected again.
  overlayToolsState = disableMirrorRuntimeFeatures(overlayToolsState);

  await writeOverlayToolsState(overlayToolsState, {
    reason: `profile-source-${game}`,
    skipPersistProfile: true
  });
  await syncRegionMirrorWindows(overlayToolsState, {
    allowEmpty: true,
    sourceState: options.sourceState || null
  });
  await restoreAlertasWindowAnchor();
  await emitScreenVisionProfilesChanged();
  await writeDebugLog(`screen-vision-profile-source activeGame=${game} profile=${profilePath || "<empty>"}`);
  return overlayToolsState;
}

async function ensureScreenVisionProfilesDir() {
  await fs.mkdir(getScreenVisionProfilesDir(), { recursive: true });
}

function getScreenVisionProfilesDir(sourceGame = activeMirrorSourceGame) {
  const game = normalizeMirrorSourceGame(sourceGame);
  // Preserve the canonical Tibia directory exactly as it is. The two OT
  // clients use isolated subdirectories so they cannot change or hide Tibia
  // profiles on disk.
  if (game === "tibia") {
    return screenVisionProfilesDir;
  }
  return path.join(screenVisionProfilesDir, game === "rubinot" ? "RubinOT" : "Medivia");
}

function getScreenVisionLastProfilePath(sourceGame = activeMirrorSourceGame) {
  const game = normalizeMirrorSourceGame(sourceGame);
  if (game === "tibia") {
    return screenVisionLastProfilePath;
  }
  return path.join(path.dirname(screenVisionLastProfilePath), `last-profile.${game}.txt`);
}

async function ensureScreenVisionProfilesDirForGame(sourceGame = activeMirrorSourceGame) {
  const profilesDir = getScreenVisionProfilesDir(sourceGame);
  await fs.mkdir(profilesDir, { recursive: true });
  return profilesDir;
}

async function listScreenVisionProfiles(sourceGame = activeMirrorSourceGame) {
  const profilesDir = await ensureScreenVisionProfilesDirForGame(sourceGame);
  const entries = await fs.readdir(profilesDir, { withFileTypes: true }).catch(() => []);
  const items = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json") || entry.name.toLowerCase().endsWith(".audio.json")) {
      continue;
    }

    const profilePath = path.join(profilesDir, entry.name);
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

async function readLastScreenVisionProfilePath(sourceGame = activeMirrorSourceGame) {
  const lastProfilePath = getScreenVisionLastProfilePath(sourceGame);
  try {
    const value = (await fs.readFile(lastProfilePath, "utf8")).trim();
    return value || null;
  } catch (_error) {
    return null;
  }
}

async function saveLastScreenVisionProfilePath(profilePath, sourceGame = activeMirrorSourceGame) {
  const lastProfilePath = getScreenVisionLastProfilePath(sourceGame);
  await fs.mkdir(path.dirname(lastProfilePath), { recursive: true });
  await fs.writeFile(lastProfilePath, String(profilePath || ""), "utf8");
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
  const profilesDir = getScreenVisionProfilesDir();
  const profileName = await allocateUniqueProfileName(requestedName || "Profile", profilesDir);
  const characterName = sanitizeProfileCharacterName(requestedCharacterName);
  await writeDebugLog(`create-screen-vision-profile-file:allocated-name ${profileName}`);
  const profilePath = path.join(profilesDir, `${profileName}.json`);
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
  const profilesDir = path.dirname(profilePath);
  const nextName = await allocateUniqueProfileName(`${baseName} copy`, profilesDir);
  const nextPath = path.join(profilesDir, `${nextName}.json`);
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

  const nextPath = path.join(path.dirname(profilePath), `${sanitized}.json`);
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
    await syncRegionMirrorWindows(overlayToolsState, { allowEmpty: true });
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
    const normalizedName = normalizeCharacterLookupName(name);
    const profile = response?.[name]
      || Object.entries(response || {}).find(([responseName]) => normalizeCharacterLookupName(responseName) === normalizedName)?.[1]
      || null;
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

function normalizeCharacterLookupName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
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
  const effectiveProfileItems = getEffectivelyVisibleMirrorItems(
    overlayToolsState.mirrors.items,
    getMirrorAccountStateSnapshot()
  );
  await syncRegionMirrorWindows(overlayToolsState, {
    allowEmpty: !effectiveProfileItems.some((entry) => entry.isVisible)
  });
  await restoreAlertasWindowAnchor();
  await emitScreenVisionProfilesChanged();
}

async function loadOverlayToolsStateFromProfile(profilePath, options = {}) {
  const tibiaProfile = await readJsonFile(profilePath, createEmptyMirrorProfile(path.basename(profilePath, ".json")));
  const audioProfile = await readJsonFile(getScreenVisionAudioProfilePath(profilePath), createEmptyMirrorAudioProfile());
  const shouldUseLiveTibiaState = options.useLiveTibiaState === true;
  const sourceGame = normalizeMirrorSourceGame(options.sourceGame || activeMirrorSourceGame);
  const tibiaState = options.sourceState || (shouldUseLiveTibiaState
    ? await getMirrorSourceGameState(sourceGame, { forceFresh: true }).catch(() => null)
    : null);
  const converted = mirrorProfileToOverlayState(tibiaProfile, audioProfile, {
    tibiaState,
    sourceGame,
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
  const profilesDir = await ensureScreenVisionProfilesDirForGame();
  const result = await dialog.showOpenDialog({
    title: tr("screenVision.profiles.importButton"),
    defaultPath: profilesDir,
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
  const profileName = await allocateUniqueProfileName(path.basename(sourcePath, ext), profilesDir);
  const targetProfilePath = path.join(profilesDir, `${profileName}.json`);

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

  const storedDirectory = (await readStorageValue(screenVisionProfileExportDirectoryStorageKey))?.[screenVisionProfileExportDirectoryStorageKey];
  let defaultDirectory = getScreenVisionProfilesDir();

  if (typeof storedDirectory === "string" && storedDirectory.trim()) {
    const storedDirectoryInfo = await fs.stat(storedDirectory).catch(() => null);
    if (storedDirectoryInfo?.isDirectory()) {
      defaultDirectory = storedDirectory;
    }
  }

  await fs.mkdir(defaultDirectory, { recursive: true });
  const defaultFileName = `${path.basename(exportProfilePath, ".json")}.tvprofile`;
  const result = await dialog.showSaveDialog({
    title: tr("screenVision.profiles.exportButton"),
    defaultPath: path.join(defaultDirectory, defaultFileName),
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

  await writeStorageValue({
    [screenVisionProfileExportDirectoryStorageKey]: path.dirname(result.filePath)
  });

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
  await execFileAsync(windowsPowerShellCommand, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; if(Test-Path -LiteralPath '${escapePowerShellLiteral(destinationDir)}'){Remove-Item -LiteralPath '${escapePowerShellLiteral(destinationDir)}' -Recurse -Force}; [System.IO.Compression.ZipFile]::ExtractToDirectory('${escapePowerShellLiteral(zipPath)}','${escapePowerShellLiteral(destinationDir)}')`
  ]);
}

async function createZipWithPowerShell(sourceDir, destinationZipPath) {
  await execFileAsync(windowsPowerShellCommand, [
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

async function allocateUniqueProfileName(requestedName, profilesDir = getScreenVisionProfilesDir()) {
  const base = sanitizeProfileFileStem(requestedName);
  let candidate = base || "Profile";
  let index = 2;

  while (await fileExists(path.join(profilesDir, `${candidate}.json`))) {
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

function disableMirrorRuntimeFeatures(overlayToolsState) {
  const state = normalizeOverlayToolsState(overlayToolsState);
  state.mirrors.items = state.mirrors.items.map((entry) => ({
    ...entry,
    isVisible: false
  }));
  state.settings = state.settings || {};
  state.settings.screenVision = state.settings.screenVision || {};
  state.settings.screenVision.gridEnabled = false;
  state.settings.screenVision.visualCustomization = {
    ...getScreenVisionVisualSettings(state),
    charLocEnabled: false,
    cursorGlowEnabled: false
  };
  state.timers = state.timers || {};
  state.timers.isListening = false;
  state.timers.visualsEnabled = false;
  state.timers.startListeningOnStartup = false;
  return state;
}

function getRunningWallClockTimers(overlayToolsState) {
  const now = Date.now();
  return (Array.isArray(overlayToolsState?.timers?.items) ? overlayToolsState.timers.items : [])
    .map((entry) => normalizeOverlayTimerEntry(entry))
    .filter((timer) => (
      timer
      && isWallClockFoodTimer(timer)
      && Number(timer.persistentEndsAtMs) > now
    ));
}

function stopNonWallClockAlertTimerRuntimes(overlayToolsState) {
  const timersById = new Map(
    (Array.isArray(overlayToolsState?.timers?.items) ? overlayToolsState.timers.items : [])
      .map((entry) => normalizeOverlayTimerEntry(entry))
      .filter(Boolean)
      .map((entry) => [entry.id, entry])
  );
  for (const timerId of [...alertTimerRuntimeById.keys()]) {
    if (!isWallClockFoodTimer(timersById.get(timerId))) {
      stopAlertTimerRuntimeInternal(timerId);
    }
  }
  cleanupAlertTimerSnapshotTicker();
}

async function writeOverlayToolsState(overlayToolsState, options = {}) {
  const snapshot = cloneOverlayToolsStateForSave(overlayToolsState);
  if (options.reason === "bootstrap-profile") {
    await writeDebugLog("write-overlay-tools-state:bootstrap:store:start");
  }
  await writeOverlayToolsStore({
    [OVERLAY_TOOLS_STORAGE_KEY]: snapshot
  });
  if (typeof options.afterStore === "function") {
    await options.afterStore(snapshot);
  }
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

async function appendOverlayMirrorEntry(createEntryOptions, writeOptions = {}) {
  return enqueueOverlayToolsMutation(async () => {
    const overlayToolsState = await readOverlayToolsState();
    const currentItems = Array.isArray(overlayToolsState.mirrors?.items)
      ? overlayToolsState.mirrors.items
      : [];

    const region = createOverlayMirrorEntry(createEntryOptions(currentItems));
    const scope = getMirrorScope(region);
    const accountState = await getAccountState();
    setMirrorAccountStateSnapshot(accountState);
    const counts = countMirrorRegionsByScope(currentItems);
    const visibleCounts = countEffectivelyVisibleMirrorRegionsByScope(currentItems, accountState);
    const scopeCount = visibleCounts[scope];
    if (!canCreateMirrorRegion(scopeCount, accountState)) {
      await writeDebugLog(`screen-vision-region-create-blocked scope=${scope} count=${scopeCount} limit=10`);
      return {
        blocked: true,
        cancelled: true,
        reason: "mirror-limit-reached",
        items: currentItems,
        scope,
        scopeCount,
        counts,
        visibleCounts,
        totalCount: currentItems.length
      };
    }

    overlayToolsState.mirrors.items = [...currentItems, region];
    const savedState = await writeOverlayToolsState(overlayToolsState, writeOptions);
    return {
      region,
      savedState,
      counts: countMirrorRegionsByScope(savedState.mirrors.items),
      visibleCounts: countEffectivelyVisibleMirrorRegionsByScope(savedState.mirrors.items, accountState),
      totalCount: savedState.mirrors.items.length
    };
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
  const effectiveItems = getEffectivelyVisibleMirrorItems(items, getMirrorAccountStateSnapshot());
  const normalizedItems = (Array.isArray(effectiveItems) ? effectiveItems : [])
    .map((entry) => normalizeOverlayMirrorEntry(entry))
    .filter(Boolean);
  const snapGroupIds = computeSnapGroupRegionIds(normalizedItems);
  return normalizedItems.map((entry) => decorateScreenVisionRegion(entry, snapGroupIds)).filter(Boolean);
}

function filterMirrorRegionsForActiveSource(items) {
  const activeGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";
  return (Array.isArray(items) ? items : []).filter((entry) => (
    entry?.sourceType === "obs-window"
    || normalizeMirrorSourceGame(entry?.sourceGame) === activeGame
  ));
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

        if (
          candidate.sourceType !== current.sourceType
          || normalizeMirrorSourceGame(candidate.sourceGame) !== normalizeMirrorSourceGame(current.sourceGame)
        ) {
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

  if (currentRegion.sourceType === "obs-window") {
    return reselectObsRegionById(currentRegion, overlayToolsState, {
      initialCaptureBounds: currentRegion.captureBounds
    });
  }

  const sourceGame = normalizeMirrorSourceGame(currentRegion.sourceGame);
  const tibiaState = await getMirrorSourceGameState(sourceGame, { forceFresh: true });

  if (!canUseTibiaWindowForScreenVision(tibiaState)) {
    return {
      cancelled: true,
      reason: "tibia-unavailable",
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  const selection = await withGridVisibleDuringSelection(() => openNativeRegionSelectionWindow({
    preferredDisplayId: tibiaState.displayId || currentRegion.displayId || null,
    initialCaptureBounds: currentRegion.captureBounds,
    sourceGame
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
      sourceGame,
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

async function reselectObsRegionById(currentRegion, overlayToolsState, options = {}) {
  const supported = await nativeHostSupportsObsMirror().catch(() => false);
  if (!supported) {
    return {
      cancelled: true,
      reason: "native-host-outdated",
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  const selection = await withGridVisibleDuringSelection(() => openNativeRegionSelectionWindow({
    preferredDisplayId: currentRegion.displayId || null,
    initialCaptureBounds: options.initialCaptureBounds || null,
    sourceType: "obs-window"
  }));

  if (!selection?.sourceHwnd || !selection.sourceBounds || !selection.captureBounds) {
    return {
      cancelled: true,
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  const constrainedCaptureBounds = intersectBounds(selection.captureBounds, selection.sourceBounds, 1);
  if (!constrainedCaptureBounds) {
    return {
      cancelled: true,
      reason: "outside-obs-window",
      items: decorateScreenVisionRegions(overlayToolsState.mirrors.items)
    };
  }

  const savedState = await mutateRegion(currentRegion.id, (region) => ({
    ...region,
    sourceType: "obs-window",
    displayId: selection.displayId || region.displayId || "",
    displayLabel: selection.displayLabel || region.displayLabel || "",
    displayBounds: selection.displayBounds || region.displayBounds,
    sourceHwnd: selection.sourceHwnd,
    sourceCaptureId: selection.sourceCaptureId || "",
    sourceBounds: selection.sourceBounds,
    sourceWindowTitle: selection.sourceWindowTitle,
    sourceProcessName: selection.sourceProcessName,
    captureBounds: constrainedCaptureBounds,
    relativeBounds: toRelativeBounds(constrainedCaptureBounds, selection.sourceBounds),
    mirrorBounds: toInitialMirrorBounds(constrainedCaptureBounds, selection.displayBounds),
    scale: 1
  }));

  await syncRegionMirrorWindows(savedState);
  return {
    cancelled: false,
    region: decorateScreenVisionRegion(savedState.mirrors.items.find((entry) => entry.id === currentRegion.id) || null),
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

  if (currentRegion.sourceType === "obs-window") {
    return reselectObsRegionById(currentRegion, overlayToolsState);
  }

  const sourceGame = normalizeMirrorSourceGame(currentRegion.sourceGame);
  const tibiaState = await getMirrorSourceGameState(sourceGame, { forceFresh: true });

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

  const selection = await withGridVisibleDuringSelection(() => openNativeRegionSelectionWindow({
    preferredDisplayId: tibiaState.displayId || currentRegion.displayId || null,
    mode: currentRegion.isFixedCrop ? "fixed-icon-crop" : "standard",
    fixedSize,
    sourceGame
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
    sourceGame,
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

function createDefaultDesktopScreenshotSettings() {
  return {
    outputDirectory: path.join(app.getPath("userData"), "Screenshots"),
    sourceDirectory: "",
    upscaleFactor: 1,
    deleteOriginal: false,
    hotkey: { keyCode: 0, modifiers: 0, label: "" },
    selection: null,
    enabled: false
  };
}

function normalizeDesktopScreenshotSettings(raw) {
  const fallback = createDefaultDesktopScreenshotSettings();
  const source = raw && typeof raw === "object" ? raw : {};
  const hotkey = source.hotkey && typeof source.hotkey === "object" ? source.hotkey : {};
  const outputDirectory = String(source.outputDirectory || fallback.outputDirectory).trim();
  const sourceDirectory = String(source.sourceDirectory || "").trim();
  const upscaleFactor = Math.min(20, Math.max(1, Math.round(Number(source.upscaleFactor) || 1)));
  const deleteOriginal = Boolean(source.deleteOriginal);
  const selection = normalizeSelectionBounds(source.selection, 16);
  const referenceBounds = normalizeSelectionBounds(source.selection?.referenceBounds, 16);
  const displayBounds = normalizeSelectionBounds(source.selection?.displayBounds, 16);
  const tibiaBounds = normalizeSelectionBounds(source.selection?.tibiaBounds, 16);
  return {
    outputDirectory: outputDirectory || fallback.outputDirectory,
    sourceDirectory,
    upscaleFactor,
    deleteOriginal,
    hotkey: {
      keyCode: Math.max(0, Math.round(Number(hotkey.keyCode) || 0)),
      modifiers: Math.max(0, Math.round(Number(hotkey.modifiers) || 0)),
      label: String(hotkey.label || "").trim().slice(0, 80)
    },
    selection: selection ? { ...selection, referenceBounds, displayBounds, tibiaBounds } : null,
    enabled: Boolean(source.enabled) && Boolean(selection)
  };
}

function screenshotBoundsContain(outer, inner) {
  return Boolean(outer && inner
    && inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height);
}

function screenshotReferenceCandidates(selection) {
  const candidates = [
    { kind: "display", bounds: selection?.displayBounds },
    { kind: "tibia-client", bounds: selection?.tibiaBounds },
    { kind: "saved", bounds: selection?.referenceBounds }
  ];
  const currentDisplay = selection ? screen.getDisplayMatching(selection)?.bounds : null;
  if (currentDisplay) candidates.push({ kind: "current-display", bounds: currentDisplay });

  const seen = new Set();
  return candidates.filter((candidate) => {
    const bounds = normalizeSelectionBounds(candidate.bounds, 16);
    if (!bounds) return false;
    const key = `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`;
    if (seen.has(key)) return false;
    seen.add(key);
    candidate.bounds = bounds;
    return true;
  });
}

function resolveDesktopScreenshotReference(selection, imageSize) {
  const imageWidth = Math.round(Number(imageSize?.width) || 0);
  const imageHeight = Math.round(Number(imageSize?.height) || 0);
  if (!selection || imageWidth < 1 || imageHeight < 1) return null;
  const imageRatio = imageWidth / imageHeight;
  const candidates = screenshotReferenceCandidates(selection)
    .filter((candidate) => screenshotBoundsContain(candidate.bounds, selection));
  if (!candidates.length) return null;

  return candidates
    .map((candidate) => ({
      ...candidate,
      score: Math.abs(Math.log(imageRatio / (candidate.bounds.width / candidate.bounds.height)))
    }))
    .sort((left, right) => left.score - right.score)[0].bounds;
}

function calculateDesktopScreenshotCrop(selection, imageSize) {
  const reference = resolveDesktopScreenshotReference(selection, imageSize);
  const imageWidth = Math.round(Number(imageSize?.width) || 0);
  const imageHeight = Math.round(Number(imageSize?.height) || 0);
  if (!reference || imageWidth < 1 || imageHeight < 1) return null;

  const scaleX = imageWidth / reference.width;
  const scaleY = imageHeight / reference.height;
  const crop = {
    x: Math.max(0, Math.round((selection.x - reference.x) * scaleX)),
    y: Math.max(0, Math.round((selection.y - reference.y) * scaleY)),
    width: Math.round(selection.width * scaleX),
    height: Math.round(selection.height * scaleY)
  };
  crop.width = Math.min(crop.width, imageWidth - crop.x);
  crop.height = Math.min(crop.height, imageHeight - crop.y);
  return crop;
}

async function readDesktopScreenshotSettings() {
  return normalizeDesktopScreenshotSettings(await readJsonFile(desktopScreenshotSettingsPath, createDefaultDesktopScreenshotSettings()));
}

async function writeDesktopScreenshotSettings(settings) {
  const normalized = normalizeDesktopScreenshotSettings(settings);
  await writeJsonFileAtomic(desktopScreenshotSettingsPath, normalized);
  return normalized;
}

function closeDesktopScreenshotAssistant(reason = "unknown") {
  const window = desktopScreenshotAssistantWindow;
  desktopScreenshotAssistantWindow = null;
  const wasHelpActive = desktopScreenshotAssistantHelpActive;
  desktopScreenshotAssistantHelpActive = false;
  desktopScreenshotAssistantHelpStep = 0;
  if (wasHelpActive && tutorialPopoverWindow && !tutorialPopoverWindow.isDestroyed()) {
    tutorialPopoverWindow.hide();
    void tutorialPopoverWindow.webContents.executeJavaScript("window.clearTutorialPopover?.();").catch(() => {});
    if (mainWindow && !mainWindow.isDestroyed()) setTutorialPriority(mainWindow, false);
  }
  if (!window || window.isDestroyed()) return;
  try {
    const elapsedMs = desktopScreenshotAssistantOpenedAt
      ? Math.max(0, Math.round(performance.now() - desktopScreenshotAssistantOpenedAt))
      : 0;
    void writeDebugLog(`desktop-screenshot-assistant-close-request reason=${reason} elapsedMs=${elapsedMs}`);
    window.hide();
    window.close();
  } catch {
  }
}

function prioritizeDesktopScreenshotAssistant(window = desktopScreenshotAssistantWindow, _owner = mainWindow) {
  if (!window || window.isDestroyed() || !window.isVisible()) return false;

  // This helper is persistent support UI. It must remain visible when the
  // Toolkit is minimized, so it cannot be a child window of mainWindow.
  // Keep it topmost and independent; the owner is still accepted by callers
  // for compatibility with the existing focus/placement flow.
  try {
    if (window.getParentWindow()) {
      window.setParentWindow(null);
    }
  } catch {
  }

  try {
    window.setAlwaysOnTop(true, "screen-saver");
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.moveTop();
  } catch {
    return false;
  }
  return true;
}

async function ensureDesktopScreenshotAssistant(settings = null, { allowDisabled = false } = {}) {
  const resolved = settings || await readDesktopScreenshotSettings();
  if (!resolved.enabled && !allowDisabled) {
    desktopScreenshotAssistantDismissed = false;
    closeDesktopScreenshotAssistant();
    return null;
  }
  if (desktopScreenshotAssistantDismissed) return null;

  if (desktopScreenshotAssistantWindow && !desktopScreenshotAssistantWindow.isDestroyed()) {
    desktopScreenshotAssistantWindow.showInactive();
    prioritizeDesktopScreenshotAssistant(desktopScreenshotAssistantWindow);
    notifyDesktopScreenshotAssistantNewCount();
    return desktopScreenshotAssistantWindow;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { workArea } = display;
  const width = 276;
  const height = 154;
  const x = Math.max(workArea.x + 16, Math.min(cursorPoint.x + 20, workArea.x + workArea.width - width - 16));
  const y = Math.max(workArea.y + 16, Math.min(cursorPoint.y + 20, workArea.y + workArea.height - height - 16));
  const window = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "screenshot-assistant-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  desktopScreenshotAssistantWindow = window;
  window.on("closed", () => {
    const elapsedMs = desktopScreenshotAssistantOpenedAt
      ? Math.max(0, Math.round(performance.now() - desktopScreenshotAssistantOpenedAt))
      : 0;
    void writeDebugLog(`desktop-screenshot-assistant-closed elapsedMs=${elapsedMs}`);
    if (desktopScreenshotAssistantWindow === window) {
      desktopScreenshotAssistantWindow = null;
    }
  });
  await window.loadFile(path.join(__dirname, "screenshot-assistant.html"));
  if (!window.isDestroyed()) {
    desktopScreenshotAssistantOpenedAt = performance.now();
    window.showInactive();
    prioritizeDesktopScreenshotAssistant(window);
    notifyDesktopScreenshotAssistantNewCount();
    void writeDebugLog(`desktop-screenshot-assistant-open width=${width} height=${height}`);
  }
  return window;
}

async function closeDesktopScreenshotAssistantHelp() {
  if (!desktopScreenshotAssistantHelpActive) return false;
  desktopScreenshotAssistantHelpActive = false;
  desktopScreenshotAssistantHelpStep = 0;
  if (tutorialPopoverWindow && !tutorialPopoverWindow.isDestroyed()) {
    await tutorialPopoverWindow.webContents.executeJavaScript(
      "window.clearTutorialPopover?.(); new Promise((resolve) => requestAnimationFrame(resolve))"
    ).catch(() => {});
    tutorialPopoverWindow.hide();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    setTutorialPriority(mainWindow, false);
  }
  return true;
}

async function renderDesktopScreenshotAssistantHelpStep() {
  if (!desktopScreenshotAssistantHelpActive || !tutorialPopoverWindow || tutorialPopoverWindow.isDestroyed()) {
    return false;
  }

  const isFolderStep = desktopScreenshotAssistantHelpStep === 1;
  const payload = {
    gif: getRuntimeContentUrl(isFolderStep ? "assets/ui/tutorial/openscreenshotfolder.png" : "assets/ui/tutorial/uncheck.png"),
    gifNatural: true,
    hideGif: false,
    text: isFolderStep
      ? "Se você ainda não abriu a pasta de screenshots do Tibia, abra-a uma vez para criá-la. No Tibia, vá em Options > Misc. > Screenshots e clique em Open Screenshot Folder. Para a busca automática reconhecer a pasta, reinicie o TibiaToolkit após criá-la."
      : "Vá em Options > Misc. > Screenshots e desmarque ‘Only Capture Game Window’, ou a imagem não ficará alinhada corretamente.",
    html: isFolderStep
      ? "Se você ainda não abriu a pasta de screenshots do Tibia, abra-a uma vez para criá-la.<br>No Tibia, vá em <strong>Options &gt; Misc. &gt; Screenshots</strong> e clique em <strong>Open Screenshot Folder</strong>.<br><strong class=\"restart-note\">Para a busca automática reconhecer a pasta, reinicie o TibiaToolkit após criá-la.</strong>"
      : "Vá em <strong>Options &gt; Misc. &gt; Screenshots</strong> e <strong>desmarque</strong> <strong>‘Only Capture Game Window’</strong>, ou a imagem não ficará alinhada corretamente.",
    placement: tutorialPopoverResizePlacement,
    autoHeight: true,
    progress: `Ajuda ${desktopScreenshotAssistantHelpStep + 1}/2`,
    buttonIcon: getRuntimeContentUrl(isFolderStep ? "assets/ui/Tick.png" : "assets/ui/tutorial/continuar.png"),
    buttonLabel: isFolderStep ? "Fechar" : "Continuar",
    cancelIcon: getRuntimeContentUrl("assets/ui/Cross.png"),
    cancelLabel: "Fechar"
  };

  await tutorialPopoverWindow.webContents.executeJavaScript(
    `window.renderTutorialPopover?.(${JSON.stringify(payload).replace(/</g, "\\u003c")});`
  );
  return true;
}

async function closeDesktopScreenshotFolderCreationHelp(continueToPicker = false) {
  if (!desktopScreenshotFolderCreationHelpActive) return false;
  const resolveHelp = desktopScreenshotFolderCreationHelpResolver;
  desktopScreenshotFolderCreationHelpResolver = null;
  desktopScreenshotFolderCreationHelpActive = false;
  if (tutorialPopoverWindow && !tutorialPopoverWindow.isDestroyed()) {
    await tutorialPopoverWindow.webContents.executeJavaScript(
      "window.clearTutorialPopover?.(); new Promise((resolve) => requestAnimationFrame(resolve))"
    ).catch(() => {});
    tutorialPopoverWindow.hide();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    setTutorialPriority(mainWindow, false);
  }
  resolveHelp?.({ opened: true, continueToPicker: Boolean(continueToPicker) });
  return true;
}

async function showDesktopScreenshotFolderCreationHelp(owner = mainWindow) {
  if (desktopScreenshotFolderCreationHelpActive) {
    return { opened: false, reason: "already-open" };
  }
  const ownerWindow = owner && !owner.isDestroyed() ? owner : mainWindow;
  if (!ownerWindow || ownerWindow.isDestroyed()) {
    return { opened: false };
  }
  if (isTutorialPriorityActive()) {
    return { opened: false, reason: "tutorial-active" };
  }

  const ownerBounds = ownerWindow.getBounds();
  const display = screen.getDisplayMatching(ownerBounds);
  const area = display.workArea;
  const width = 390;
  const height = 360;
  const gap = 12;
  const candidates = [
    { placement: "right", x: ownerBounds.x + ownerBounds.width + gap, y: ownerBounds.y + Math.round((ownerBounds.height - height) / 2) },
    { placement: "left", x: ownerBounds.x - width - gap, y: ownerBounds.y + Math.round((ownerBounds.height - height) / 2) },
    { placement: "bottom", x: ownerBounds.x + Math.round((ownerBounds.width - width) / 2), y: ownerBounds.y + ownerBounds.height + gap },
    { placement: "top", x: ownerBounds.x + Math.round((ownerBounds.width - width) / 2), y: ownerBounds.y - height - gap }
  ];
  const fits = (candidate) => candidate.x >= area.x && candidate.y >= area.y
    && candidate.x + width <= area.x + area.width
    && candidate.y + height <= area.y + area.height;
  const chosen = candidates.find(fits) || candidates[0];
  const x = Math.max(area.x, Math.min(chosen.x, area.x + area.width - width));
  const y = Math.max(area.y, Math.min(chosen.y, area.y + area.height - height));
  const popover = await ensureTutorialPopoverWindow(ownerWindow, { x, y, width, height });
  if (!popover || popover.isDestroyed()) return { opened: false };

  desktopScreenshotFolderCreationHelpActive = true;
  tutorialPopoverResizePlacement = chosen.placement;
  setTutorialPriority(ownerWindow, true);
  let resolveHelp;
  const resultPromise = new Promise((resolve) => {
    resolveHelp = resolve;
  });
  desktopScreenshotFolderCreationHelpResolver = resolveHelp;
  const payload = {
    gif: getRuntimeContentUrl("assets/ui/tutorial/openscreenshotfolder.png"),
    gifNatural: true,
    hideGif: false,
    text: "Se você ainda não abriu a pasta de screenshots do Tibia, abra-a uma vez para criá-la. No Tibia, vá em Options > Misc. > Screenshots e clique em Open Screenshot Folder. Para a busca automática reconhecer a pasta, reinicie o TibiaToolkit após criá-la.",
    html: "Se você ainda não abriu a pasta de screenshots do Tibia, abra-a uma vez para criá-la.<br>No Tibia, vá em <strong>Options &gt; Misc. &gt; Screenshots</strong> e clique em <strong>Open Screenshot Folder</strong>.<br><strong class=\"restart-note\">Para a busca automática reconhecer a pasta, reinicie o TibiaToolkit após criá-la.</strong>",
    placement: chosen.placement,
    autoHeight: true,
    progress: "ScreenshotToolkit",
    buttonIcon: getRuntimeContentUrl("assets/ui/Tick.png"),
    buttonLabel: "Continuar para selecionar a pasta",
    cancelIcon: getRuntimeContentUrl("assets/ui/Cross.png"),
    cancelLabel: "Fechar"
  };
  await popover.webContents.executeJavaScript(
    `window.renderTutorialPopover?.(${JSON.stringify(payload).replace(/</g, "\\u003c")});`
  ).catch(async (error) => {
    await writeDebugLog(`desktop-screenshot-folder-help-render-failed ${error?.message || String(error)}`);
    await closeDesktopScreenshotFolderCreationHelp(false);
  });
  if (!desktopScreenshotFolderCreationHelpActive) {
    return resultPromise;
  }
  popover.setAlwaysOnTop(true, "screen-saver");
  popover.setBounds({ x, y, width, height }, false);
  popover.showInactive();
  popover.moveTop();
  void writeDebugLog("desktop-screenshot-folder-help-open");
  return resultPromise;
}

async function chooseDesktopTibiaScreenshotDirectoryFromMain(owner, { showCreationHelp = true } = {}) {
  const settings = await readDesktopScreenshotSettings();
  const detectedDirectory = await findDesktopTibiaScreenshotDirectory(settings);
  if (!detectedDirectory && showCreationHelp) {
    const guidance = await showDesktopScreenshotFolderCreationHelp(owner);
    if (!guidance.continueToPicker) {
      return { settings, cancelled: true, sourceDirectoryRequired: true };
    }
  }
  const picked = await dialog.showOpenDialog(owner, {
    title: "Selecionar pasta de screenshots do Tibia",
    defaultPath: settings.sourceDirectory || detectedDirectory || undefined,
    properties: ["openDirectory"]
  });
  if (picked.canceled || !picked.filePaths?.[0]) return { settings, cancelled: true };
  settings.sourceDirectory = picked.filePaths[0];
  const savedSettings = await writeDesktopScreenshotSettings(settings);
  invalidateDesktopScreenshotDiscovery();
  await syncDesktopScreenshotWatcher(savedSettings);
  return { settings: savedSettings };
}

async function openDesktopScreenshotOutputDirectory(_owner) {
  if (desktopScreenshotDirectoryOpenPromise) {
    void writeDebugLog("desktop-screenshot-directory-open-coalesced");
    return desktopScreenshotDirectoryOpenPromise;
  }

  const openPromise = (async () => {
    const settings = await readDesktopScreenshotSettings();
    const directory = path.resolve(settings.outputDirectory);
    void writeDebugLog(`desktop-screenshot-directory-open-start directory=${directory}`);
    await fs.mkdir(directory, { recursive: true });

    const reused = await focusExistingExplorerDirectory(directory);
    void writeDebugLog(`desktop-screenshot-directory-reuse reused=${reused}`);
    if (reused) {
      desktopScreenshotAssistantNewCount = 0;
      notifyDesktopScreenshotAssistantNewCount();
      return { error: "", reused: true };
    }

    const error = await shell.openPath(directory);
    void writeDebugLog(`desktop-screenshot-directory-shell-open result=${error || "ok"}`);
    if (!error) {
      desktopScreenshotAssistantNewCount = 0;
      notifyDesktopScreenshotAssistantNewCount();
    }
    return { error: error || "" };
  })();

  desktopScreenshotDirectoryOpenPromise = openPromise;
  try {
    return await openPromise;
  } finally {
    if (desktopScreenshotDirectoryOpenPromise === openPromise) {
      desktopScreenshotDirectoryOpenPromise = null;
    }
  }
}

async function showDesktopScreenshotAssistantHelp() {
  const assistant = desktopScreenshotAssistantWindow;
  if (!assistant || assistant.isDestroyed() || !assistant.isVisible()) {
    return { opened: false };
  }
  if (isTutorialPriorityActive() && !desktopScreenshotAssistantHelpActive) {
    return { opened: false, reason: "tutorial-active" };
  }

  const assistantBounds = assistant.getBounds();
  const display = screen.getDisplayMatching(assistantBounds);
  const area = display.workArea;
  const width = 390;
  const height = 360;
  const gap = 12;
  const candidates = [
    { placement: "left", x: assistantBounds.x - width - gap, y: assistantBounds.y + Math.round((assistantBounds.height - height) / 2) },
    { placement: "right", x: assistantBounds.x + assistantBounds.width + gap, y: assistantBounds.y + Math.round((assistantBounds.height - height) / 2) },
    { placement: "bottom", x: assistantBounds.x + Math.round((assistantBounds.width - width) / 2), y: assistantBounds.y + assistantBounds.height + gap },
    { placement: "top", x: assistantBounds.x + Math.round((assistantBounds.width - width) / 2), y: assistantBounds.y - height - gap }
  ];
  const fits = (candidate) => candidate.x >= area.x && candidate.y >= area.y
    && candidate.x + width <= area.x + area.width
    && candidate.y + height <= area.y + area.height;
  const chosen = candidates.find(fits) || candidates[0];
  const x = Math.max(area.x, Math.min(chosen.x, area.x + area.width - width));
  const y = Math.max(area.y, Math.min(chosen.y, area.y + area.height - height));
  const popover = await ensureTutorialPopoverWindow(mainWindow, { x, y, width, height });
  if (!popover || popover.isDestroyed()) return { opened: false };

  desktopScreenshotAssistantHelpActive = true;
  tutorialPopoverResizePlacement = chosen.placement;
  setTutorialPriority(mainWindow, true);
  desktopScreenshotAssistantHelpStep = 0;
  await renderDesktopScreenshotAssistantHelpStep().catch(async (error) => {
    await writeDebugLog(`desktop-screenshot-assistant-help-render-failed ${error?.message || String(error)}`);
    desktopScreenshotAssistantHelpActive = false;
  });
  if (!desktopScreenshotAssistantHelpActive) return { opened: false };
  popover.setAlwaysOnTop(true, "screen-saver");
  popover.setBounds({ x, y, width, height }, false);
  popover.showInactive();
  popover.moveTop();
  void writeDebugLog("desktop-screenshot-assistant-help-open");
  return { opened: true };
}

async function syncDesktopScreenshotWatcher(settings = null) {
  const resolved = settings || await readDesktopScreenshotSettings();
  // Never register the game's shortcut globally. The Tibia client must receive
  // it itself; Toolkit only observes the resulting official PNG on disk.
  if (resolved.enabled) {
    await restartDesktopScreenshotWatcher();
  } else {
    stopDesktopScreenshotWatcher();
    desktopScreenshotAssistantNewCount = 0;
  }
  notifyDesktopScreenshotAssistantState(resolved);
  return { settings: resolved, error: "" };
}

async function resetDesktopScreenshotStateForLaunch() {
  const settings = await readDesktopScreenshotSettings();
  if (!settings.enabled) return settings;
  settings.enabled = false;
  const savedSettings = await writeDesktopScreenshotSettings(settings);
  desktopScreenshotAssistantDismissed = false;
  closeDesktopScreenshotAssistant("app-launch-reset");
  void writeDebugLog("desktop-screenshot-disabled-at-launch");
  return savedSettings;
}

const DESKTOP_SCREENSHOT_DISCOVERY_TIMEOUT_MS = 1200;
const DESKTOP_SCREENSHOT_DISCOVERY_RETRY_MS = 10000;

function withDesktopScreenshotTimeout(promise, timeoutMs = DESKTOP_SCREENSHOT_DISCOVERY_TIMEOUT_MS, fallback = null) {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function desktopTibiaLocalDriveRoots() {
  // Keep discovery independent from a shell process. Only roots that answer a
  // bounded filesystem probe are considered, and disconnected/network roots
  // simply time out or fail without blocking the renderer.
  const fallbackRoots = await Promise.all(
    [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(async (letter) => {
      const root = `${letter}:\\`;
      const stats = await withDesktopScreenshotTimeout(fs.stat(root).catch(() => null), 450);
      return stats?.isDirectory() ? root : "";
    })
  );
  const roots = fallbackRoots.filter(Boolean);
  void writeDebugLog(`desktop-screenshot-discovery-drive-list roots=${roots.join(",") || "<none>"}`);
  return [...new Set(roots)];
}

function desktopTibiaPriorityBaseDirectories() {
  const candidates = [
    "C:\\Tibia\\packages\\Tibia",
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Tibia", "packages", "Tibia") : "",
    process.env.APPDATA ? path.join(process.env.APPDATA, "Tibia", "packages", "Tibia") : ""
  ];
  return [...new Set(candidates.filter(Boolean).map((candidate) => path.resolve(candidate)))];
}

async function desktopTibiaOtherDriveBaseDirectories() {
  const systemDrive = String(process.env.SystemDrive || "C:").toUpperCase().replace(/:$/, "");
  const roots = await desktopTibiaLocalDriveRoots();
  return roots
    .filter((root) => !root.toUpperCase().startsWith(`${systemDrive}:`))
    .map((root) => path.join(root, "Tibia", "packages", "Tibia"));
}

async function findDesktopTibiaScreenshotFromBase(baseDirectory, requestId) {
  const base = path.resolve(baseDirectory);
  const baseStats = await withDesktopScreenshotTimeout(fs.stat(base).catch(() => null));
  if (!baseStats?.isDirectory() || requestId !== desktopScreenshotDiscoveryRequestId) return "";

  const screenshotsDirectory = path.join(base, "screenshots");
  const screenshotStats = await withDesktopScreenshotTimeout(fs.stat(screenshotsDirectory).catch(() => null));
  if (screenshotStats?.isDirectory()) return screenshotsDirectory;
  return "";
}

async function desktopTibiaClientScreenshotDirectories() {
  try {
    const { stdout } = await execFileAsync(windowsPowerShellCommand, [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
      "$p=Get-Process client -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1 -ExpandProperty Path; if($p){[Console]::Write($p)}"
    ], { windowsHide: true, timeout: 4000 });
    const executable = String(stdout || "").trim();
    if (!executable) return [];
    const executableDirectory = path.dirname(executable);
    return [
      path.join(executableDirectory, "screenshots"),
      path.join(executableDirectory, "Screenshots"),
      path.join(executableDirectory, "..", "screenshots"),
      path.join(executableDirectory, "..", "Screenshots")
    ].map((candidate) => path.resolve(candidate));
  } catch {
    return [];
  }
}

function emitDesktopScreenshotDiscoveryState(state, details = {}) {
  const payload = { state: String(state || "not-found"), ...details };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("desktop:screenshot:discovery-state", payload);
  }
  if (desktopScreenshotAssistantWindow && !desktopScreenshotAssistantWindow.isDestroyed()) {
    desktopScreenshotAssistantWindow.webContents.send("desktop:screenshot:discovery-state", payload);
  }
}

function emitDesktopScreenshotStatus(message) {
  const normalized = String(message || "");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("desktop:screenshot:status", normalized);
  }
  if (desktopScreenshotAssistantWindow && !desktopScreenshotAssistantWindow.isDestroyed()) {
    desktopScreenshotAssistantWindow.webContents.send(
      "desktop:screenshot:assistant-status",
      normalized === "Screenshot do Tibia recortada e salva." ? "Screenshot gerada" : normalized
    );
  }
}

function notifyDesktopScreenshotAssistantState(settings = null, details = {}) {
  const resolved = settings || {};
  const payload = {
    enabled: Boolean(resolved.enabled),
    hasSelection: Boolean(resolved.selection),
    deleteOriginal: Boolean(resolved.deleteOriginal),
    needsSelection: Boolean(details.needsSelection),
    needsTibia: Boolean(details.needsTibia)
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("desktop:screenshot:assistant-state", payload);
  }
  if (desktopScreenshotAssistantWindow && !desktopScreenshotAssistantWindow.isDestroyed()) {
    desktopScreenshotAssistantWindow.webContents.send("desktop:screenshot:assistant-state", payload);
  }
}

function notifyDesktopScreenshotAssistantNewCount() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "desktop:screenshot:assistant-new-count",
      desktopScreenshotAssistantNewCount
    );
  }
  if (desktopScreenshotAssistantWindow && !desktopScreenshotAssistantWindow.isDestroyed()) {
    desktopScreenshotAssistantWindow.webContents.send(
      "desktop:screenshot:assistant-new-count",
      desktopScreenshotAssistantNewCount
    );
  }
}

function invalidateDesktopScreenshotDiscovery() {
  desktopScreenshotDiscoveryRequestId += 1;
  desktopScreenshotDiscoveryCache = null;
  desktopScreenshotDiscoveryPromise = null;
  desktopScreenshotDiscoveryPromiseKey = "";
}

async function findDesktopTibiaScreenshotDirectory(settings = null, { forceRefresh = false } = {}) {
  const resolvedSettings = settings || await readDesktopScreenshotSettings();
  const manualSourceDirectory = String(resolvedSettings.sourceDirectory || "").trim();
  const cacheKey = path.resolve(manualSourceDirectory || "<automatic>");
  if (!forceRefresh && desktopScreenshotDiscoveryCache?.key === cacheKey) {
    return desktopScreenshotDiscoveryCache.directory;
  }
  if (!forceRefresh && desktopScreenshotDiscoveryPromise && desktopScreenshotDiscoveryPromiseKey === cacheKey) {
    return desktopScreenshotDiscoveryPromise;
  }

  const requestId = ++desktopScreenshotDiscoveryRequestId;
  const startedAt = performance.now();
  emitDesktopScreenshotDiscoveryState("searching", { requestId });
  void writeDebugLog(`desktop-screenshot-discovery-start request=${requestId} manual=${manualSourceDirectory || "<none>"}`);

  const promise = (async () => {
    if (manualSourceDirectory) {
      const manual = path.resolve(manualSourceDirectory);
      const stats = await withDesktopScreenshotTimeout(fs.stat(manual).catch(() => null));
      if (requestId === desktopScreenshotDiscoveryRequestId && stats?.isDirectory()) {
        desktopScreenshotDiscoveryCache = { key: cacheKey, directory: manual };
        emitDesktopScreenshotDiscoveryState("found", { requestId, directory: manual, source: "manual" });
        void writeDebugLog(`desktop-screenshot-discovery-found request=${requestId} source=manual directory=${manual} elapsedMs=${Math.round(performance.now() - startedAt)}`);
        return manual;
      }
    }

    const priorityBases = desktopTibiaPriorityBaseDirectories();
    const otherDriveBases = await desktopTibiaOtherDriveBaseDirectories();
    const bases = [...new Set([...priorityBases, ...otherDriveBases].map((candidate) => path.resolve(candidate)))];
    for (const base of bases) {
      if (requestId !== desktopScreenshotDiscoveryRequestId) return "";
      const directory = await findDesktopTibiaScreenshotFromBase(base, requestId);
      void writeDebugLog(`desktop-screenshot-discovery-tested request=${requestId} base=${base} result=${directory || "miss"}`);
      if (directory) {
        desktopScreenshotDiscoveryCache = { key: cacheKey, directory };
        emitDesktopScreenshotDiscoveryState("found", { requestId, directory, source: "automatic" });
        void writeDebugLog(`desktop-screenshot-discovery-found request=${requestId} source=automatic directory=${directory} elapsedMs=${Math.round(performance.now() - startedAt)}`);
        return directory;
      }
    }

    desktopScreenshotDiscoveryCache = { key: cacheKey, directory: "" };
    emitDesktopScreenshotDiscoveryState("not-found", { requestId });
    void writeDebugLog(`desktop-screenshot-discovery-not-found request=${requestId} elapsedMs=${Math.round(performance.now() - startedAt)}`);
    return "";
  })().catch(async (error) => {
    await writeDebugLog(`desktop-screenshot-discovery-failed request=${requestId} ${error?.message || String(error)}`);
    desktopScreenshotDiscoveryCache = { key: cacheKey, directory: "" };
    emitDesktopScreenshotDiscoveryState("not-found", { requestId, error: true });
    return "";
  }).finally(() => {
    if (desktopScreenshotDiscoveryPromise === promise) {
      desktopScreenshotDiscoveryPromise = null;
      desktopScreenshotDiscoveryPromiseKey = "";
    }
  });
  desktopScreenshotDiscoveryPromise = promise;
  desktopScreenshotDiscoveryPromiseKey = cacheKey;
  return promise;
}

function stopDesktopScreenshotWatcher(cancelPending = true) {
  if (cancelPending) desktopScreenshotWatcherRequestId += 1;
  if (desktopScreenshotWatcherRetryTimer) clearTimeout(desktopScreenshotWatcherRetryTimer);
  desktopScreenshotWatcherRetryTimer = null;
  try {
    desktopScreenshotDirectoryWatcher?.close();
  } catch {
  }
  desktopScreenshotDirectoryWatcher = null;
  desktopScreenshotDirectoryWatcherPath = "";
  desktopScreenshotSeenFiles.clear();
}

async function restartDesktopScreenshotWatcher() {
  const watcherRequestId = ++desktopScreenshotWatcherRequestId;
  const settings = await readDesktopScreenshotSettings();
  const sourceDirectory = await findDesktopTibiaScreenshotDirectory(settings);
  if (watcherRequestId !== desktopScreenshotWatcherRequestId) return;
  if (!sourceDirectory) {
    stopDesktopScreenshotWatcher(false);
    desktopScreenshotWatcherRetryTimer = setTimeout(() => {
      desktopScreenshotWatcherRetryTimer = null;
      void restartDesktopScreenshotWatcher();
    }, DESKTOP_SCREENSHOT_DISCOVERY_RETRY_MS);
    emitDesktopScreenshotStatus("Aguardando a pasta de screenshots oficial do Tibia.");
    return;
  }
  if (desktopScreenshotDirectoryWatcher && desktopScreenshotDirectoryWatcherPath === sourceDirectory) return;
  stopDesktopScreenshotWatcher(false);
  desktopScreenshotDirectoryWatcherPath = sourceDirectory;
  desktopScreenshotWatcherStartedAt = Date.now();
  for (const entry of await fs.readdir(sourceDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.png$/i.test(entry.name)) continue;
    try {
      const stat = await fs.stat(path.join(sourceDirectory, entry.name));
      desktopScreenshotSeenFiles.set(entry.name, stat.mtimeMs);
    } catch {
    }
  }
  desktopScreenshotDirectoryWatcher = fsSync.watch(sourceDirectory, (_eventType, filename) => {
    if (!filename || !/\.png$/i.test(String(filename))) return;
    const filePath = path.join(sourceDirectory, String(filename));
    setTimeout(() => { void processOfficialTibiaScreenshot(filePath); }, 350);
  });
  desktopScreenshotDirectoryWatcher.on("error", (error) => {
    void writeDebugLog(`tibia-screenshot-watcher-failed ${error?.message || String(error)}`);
    invalidateDesktopScreenshotDiscovery();
    stopDesktopScreenshotWatcher(false);
    void restartDesktopScreenshotWatcher();
  });
}

async function getTibiaClientBounds() {
  // Reuse the app's read-only Tibia window probe first. It is already the
  // authoritative source for the Mirror layout, but this path only consumes
  // its bounds; it neither changes the Mirror nor communicates with the game.
  const currentState = lastTibiaWindowState || await getTibiaWindowState({ forceFresh: true }).catch(() => null);
  const knownBounds = normalizeSelectionBounds(currentState?.clientBounds || currentState?.bounds, 16);
  if (knownBounds) return knownBounds;

  // Keep an isolated Win32 fallback for startup, before the normal monitor has
  // produced its first window-state event.
  const script = [
    'Add-Type @"',
    'using System; using System.Runtime.InteropServices;',
    'public static class TTWindow { [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }',
    '[DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd,out RECT r);',
    '[DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd,ref POINT p);',
    '[StructLayout(LayoutKind.Sequential)] public struct POINT { public int X,Y; } }',
    '"@; $p=Get-Process client -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1;',
    'if($null -eq $p){ exit 2 }; $r=New-Object TTWindow+RECT; [TTWindow]::GetClientRect($p.MainWindowHandle,[ref]$r)|Out-Null;',
    '$pt=New-Object TTWindow+POINT; [TTWindow]::ClientToScreen($p.MainWindowHandle,[ref]$pt)|Out-Null;',
    '[Console]::Write((@{x=$pt.X;y=$pt.Y;width=($r.Right-$r.Left);height=($r.Bottom-$r.Top)}|ConvertTo-Json -Compress))'
  ].join(" ");
  try {
    const { stdout } = await execFileAsync(windowsPowerShellCommand, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true, timeout: 5000 });
    return normalizeSelectionBounds(JSON.parse(String(stdout || "{}")), 16);
  } catch {
    return null;
  }
}

async function openDesktopCaptureSelectionWindow({ allowedBounds = null } = {}) {
  // Screenshot selection must use the same native Tibia-source selector as
  // Tibia Mirror. The previous Electron-only surface previewed the whole
  // desktop (`desktopCapturer` with `types: ["screen"]`), so its magnifier
  // showed other applications instead of the Tibia client. This path is kept
  // isolated from mirror persistence and OBS: it only returns the selected
  // screen-space bounds to the screenshot workflow.
  const display = allowedBounds
    ? screen.getDisplayMatching(allowedBounds)
    : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const selection = await withGridVisibleDuringSelection(() => openNativeRegionSelectionWindow({
    preferredDisplayId: display?.id ? String(display.id) : null,
    sourceType: "tibia"
  }));
  const captureBounds = normalizeSelectionBounds(selection?.captureBounds, 24);

  if (!captureBounds) {
    return null;
  }

  if (allowedBounds && !screenshotBoundsContain(allowedBounds, captureBounds)) {
    await writeDebugLog(
      `desktop-screenshot-native-selection-outside-tibia selection=${JSON.stringify(captureBounds)} allowed=${JSON.stringify(allowedBounds)}`
    );
    return null;
  }

  return captureBounds;
}

async function captureDesktopScreenshotMagnifierPreview(display) {
  const bounds = display?.bounds;
  const displayWidth = Math.round(Number(bounds?.width) || 0);
  const displayHeight = Math.round(Number(bounds?.height) || 0);
  if (!display?.id || displayWidth < 1 || displayHeight < 1) return null;
  try {
    const previewWidth = Math.min(1600, displayWidth);
    const previewHeight = Math.max(1, Math.round(previewWidth * displayHeight / displayWidth));
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: previewWidth, height: previewHeight },
      fetchWindowIcons: false
    });
    const displayId = String(display.id);
    const source = sources.find((candidate) => String(candidate.display_id || "") === displayId)
      || (sources.length === 1 ? sources[0] : null);
    const thumbnail = source?.thumbnail;
    const imageSize = thumbnail?.getSize?.();
    if (!thumbnail || !imageSize?.width || !imageSize?.height) return null;
    const cursor = screen.getCursorScreenPoint();
    return {
      dataUrl: thumbnail.toDataURL(),
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      displayWidth,
      displayHeight,
      initialCursor: {
        x: Math.max(0, Math.min(displayWidth, Math.round(cursor.x - bounds.x))),
        y: Math.max(0, Math.min(displayHeight, Math.round(cursor.y - bounds.y)))
      }
    };
  } catch (error) {
    await writeDebugLog(`desktop-screenshot-magnifier-preview-failed ${error?.message || String(error)}`);
    return null;
  }
}

function screenshotBoundsFitDisplay(bounds, display) {
  const area = display?.bounds;
  return Boolean(area && bounds.x >= area.x && bounds.y >= area.y
    && bounds.x + bounds.width <= area.x + area.width && bounds.y + bounds.height <= area.y + area.height);
}

async function captureDesktopScreenshot() {
  const current = await readDesktopScreenshotSettings();
  if (!await findDesktopTibiaScreenshotDirectory(current)) {
    return { sourceDirectoryRequired: true };
  }
  if (current.enabled) {
    current.enabled = false;
    const settings = await writeDesktopScreenshotSettings(current);
    await syncDesktopScreenshotWatcher(settings);
    return { disabled: true, settings };
  }
  const tibiaBounds = await getTibiaClientBounds();
  if (!tibiaBounds) return { error: "Abra o Tibia antes de definir a área da screenshot." };
  // Selection is the only point where Toolkit should get out of the way. This
  // affects just its own Electron window (including the docked Settings pane),
  // never the Tibia client, Tibia Mirror or any external process.
  const shouldRestoreToolkit = Boolean(mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized());
  if (shouldRestoreToolkit) {
    mainWindow.minimize();
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  let selection = null;
  try {
    selection = await openDesktopCaptureSelectionWindow({ allowedBounds: tibiaBounds });
  } finally {
    if (shouldRestoreToolkit && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  }
  if (!selection) return { cancelled: true };
  const display = screen.getDisplayMatching(selection);
  if (!screenshotBoundsFitDisplay(selection, display)) return { error: "Selecione uma área dentro de apenas um monitor." };
  if (!screenshotBoundsContain(tibiaBounds, selection)) return { error: "Selecione uma área dentro da janela do Tibia." };
  const settings = current;
  settings.selection = {
    ...selection,
    displayBounds: display.bounds,
    tibiaBounds,
    referenceBounds: display.bounds
  };
  settings.enabled = true;
  const savedSettings = await writeDesktopScreenshotSettings(settings);
  await syncDesktopScreenshotWatcher(savedSettings);
  return { selection: savedSettings.selection, settings: savedSettings };
}

async function reselectDesktopScreenshotArea() {
  const settings = await readDesktopScreenshotSettings();
  if (!await findDesktopTibiaScreenshotDirectory(settings)) {
    return { error: "Selecione a pasta de screenshots do Tibia antes de continuar." };
  }
  const tibiaBounds = await getTibiaClientBounds();
  if (!tibiaBounds) {
    return {
      settings,
      tibiaOpen: false,
      needsTibia: true,
      error: "Abra o Tibia antes de selecionar uma nova área da screenshot."
    };
  }

  // This helper is intentionally independent from the activation flow above:
  // it keeps the crop active and never minimizes the Toolkit or the assistant.
  const selection = await openDesktopCaptureSelectionWindow({ allowedBounds: tibiaBounds });
  if (!selection) return { cancelled: true, settings };
  const display = screen.getDisplayMatching(selection);
  if (!screenshotBoundsFitDisplay(selection, display)) {
    return { error: "Selecione uma área dentro de apenas um monitor." };
  }
  if (!screenshotBoundsContain(tibiaBounds, selection)) {
    return { error: "Selecione uma área dentro da janela do Tibia." };
  }
  settings.selection = {
    ...selection,
    displayBounds: display.bounds,
    tibiaBounds,
    referenceBounds: display.bounds
  };
  const savedSettings = await writeDesktopScreenshotSettings(settings);
  if (savedSettings.enabled) await restartDesktopScreenshotWatcher();
  notifyDesktopScreenshotAssistantState(savedSettings);
  return { selection: savedSettings.selection, settings: savedSettings };
}

function upscaleDesktopScreenshotPixelPerfect(image, scale) {
  const sourceSize = image.getSize();
  const sourceBitmap = image.toBitmap();
  const width = Math.max(1, Math.round(sourceSize.width));
  const height = Math.max(1, Math.round(sourceSize.height));
  const factor = Math.max(1, Math.round(Number(scale) || 1));
  const targetWidth = width * factor;
  const targetHeight = height * factor;
  const targetBitmap = Buffer.alloc(targetWidth * targetHeight * 4);

  // NativeImage bitmaps are BGRA on Windows. Copy each source pixel into an
  // integer-sized block instead of using interpolation, so the result is the
  // same crisp pixel zoom the user sees when enlarging the original manually.
  for (let sourceY = 0; sourceY < height; sourceY += 1) {
    for (let sourceX = 0; sourceX < width; sourceX += 1) {
      const sourceOffset = (sourceY * width + sourceX) * 4;
      for (let offsetY = 0; offsetY < factor; offsetY += 1) {
        const targetRowOffset = ((sourceY * factor + offsetY) * targetWidth + sourceX * factor) * 4;
        for (let offsetX = 0; offsetX < factor; offsetX += 1) {
          sourceBitmap.copy(targetBitmap, targetRowOffset + offsetX * 4, sourceOffset, sourceOffset + 4);
        }
      }
    }
  }

  return nativeImage.createFromBitmap(targetBitmap, {
    width: targetWidth,
    height: targetHeight,
    scaleFactor: 1
  });
}

async function processOfficialTibiaScreenshot(sourcePath) {
  try {
    const settings = await readDesktopScreenshotSettings();
    if (!settings.enabled || !settings.selection) return;
    let stat;
    try {
      stat = await fs.stat(sourcePath);
    } catch (error) {
      // Deleting an original after a successful crop also emits a watcher
      // event on Windows. That follow-up event is expected and must not
      // replace the success status with a processing error.
      if (error?.code === "ENOENT") return;
      throw error;
    }
    const sourceName = path.basename(sourcePath);
    const previousMtime = desktopScreenshotSeenFiles.get(sourceName) || 0;
    if (stat.mtimeMs <= previousMtime || stat.mtimeMs < desktopScreenshotWatcherStartedAt - 1000) return;
    desktopScreenshotSeenFiles.set(sourceName, stat.mtimeMs);
    const source = nativeImage.createFromPath(sourcePath);
    if (source.isEmpty()) return;
    const imageSize = source.getSize();
    const crop = calculateDesktopScreenshotCrop(settings.selection, imageSize);
    if (!crop) {
      emitDesktopScreenshotStatus("A área selecionada não corresponde à screenshot do Tibia.");
      return;
    }
    if (crop.width < 2 || crop.height < 2) {
      emitDesktopScreenshotStatus("A área selecionada não corresponde à screenshot do Tibia.");
      return;
    }
    await fs.mkdir(settings.outputDirectory, { recursive: true });
    const outputPath = path.join(settings.outputDirectory, `TibiaToolkit-${new Date().toISOString().replace(/[:.]/g, "-")}.png`);
    // Keep the official Tibia PNG untouched and upscale only our copy. The
    // The selected 1x-20x factor is pixel-perfect and preserves every source pixel.
    const cropped = source.crop(crop);
    const scale = Math.min(20, Math.max(1, Number(settings.upscaleFactor) || 1));
    const upscaled = scale > 1
      ? upscaleDesktopScreenshotPixelPerfect(cropped, scale)
      : cropped;
    await fs.writeFile(outputPath, upscaled.toPNG());
    if (settings.deleteOriginal) {
      await fs.unlink(sourcePath).catch(() => {});
    }
    desktopScreenshotAssistantNewCount += 1;
    notifyDesktopScreenshotAssistantNewCount();
    emitDesktopScreenshotStatus("Screenshot do Tibia recortada e salva.");
  } catch (error) {
    await writeDebugLog(`tibia-screenshot-process-failed ${error?.message || String(error)}`);
    emitDesktopScreenshotStatus("Não foi possível processar a screenshot do Tibia.");
  }
}

function closeManualSelectionCrossWindow() {
  if (manualSelectionCrossTimer) {
    clearInterval(manualSelectionCrossTimer);
    manualSelectionCrossTimer = null;
  }

  if (manualSelectionCrossWindow && !manualSelectionCrossWindow.isDestroyed()) {
    manualSelectionCrossWindow.close();
  }

  manualSelectionCrossWindow = null;
}

function isPointInsideBounds(point, bounds) {
  return Boolean(
    point
    && bounds
    && point.x >= bounds.x
    && point.y >= bounds.y
    && point.x < bounds.x + bounds.width
    && point.y < bounds.y + bounds.height
  );
}

function updateManualSelectionCrossPosition() {
  const window = manualSelectionCrossWindow;

  if (!window || window.isDestroyed()) {
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const tibiaBounds = lastTibiaWindowState?.clientBounds || lastTibiaWindowState?.bounds;

  if (!isPointInsideBounds(cursor, tibiaBounds)) {
    if (window.isVisible()) window.hide();
    return;
  }

  const display = screen.getDisplayNearestPoint(cursor);
  const displayBounds = display?.bounds || screen.getPrimaryDisplay().bounds;
  const previewSize = 200;
  const cursorGap = 28;
  const crossSize = 19;
  let previewLeft = cursor.x + cursorGap;
  let previewTop = cursor.y + cursorGap;

  if (previewLeft + previewSize > displayBounds.x + displayBounds.width) {
    previewLeft = cursor.x - cursorGap - previewSize;
  }
  if (previewTop + previewSize > displayBounds.y + displayBounds.height) {
    previewTop = cursor.y - cursorGap - previewSize;
  }

  previewLeft = Math.max(displayBounds.x, Math.min(previewLeft, displayBounds.x + displayBounds.width - previewSize));
  previewTop = Math.max(displayBounds.y, Math.min(previewTop, displayBounds.y + displayBounds.height - previewSize));

  window.setBounds({
    x: Math.round(previewLeft + ((previewSize - crossSize) / 2)),
    y: Math.round(previewTop + ((previewSize - crossSize) / 2)),
    width: crossSize,
    height: crossSize
  }, false);

  if (!window.isVisible()) window.showInactive();
}

async function startManualSelectionCrossWindow() {
  closeManualSelectionCrossWindow();

  const window = new BrowserWindow({
    width: 19,
    height: 19,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  manualSelectionCrossWindow = window;
  window.setIgnoreMouseEvents(true);
  window.setAlwaysOnTop(true, "screen-saver");
  window.on("closed", () => {
    if (manualSelectionCrossWindow === window) manualSelectionCrossWindow = null;
  });

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{width:100%;height:100%;margin:0;background:transparent;overflow:hidden}
    .h,.v{position:absolute;left:50%;top:50%;background:#fff;box-shadow:0 0 0 1px #000;transform:translate(-50%,-50%)}
    .h{width:15px;height:3px}.v{width:3px;height:15px}
  </style></head><body><span class="h"></span><span class="v"></span></body></html>`;
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  updateManualSelectionCrossPosition();
  manualSelectionCrossTimer = setInterval(updateManualSelectionCrossPosition, 32);
}

async function openNativeRegionSelectionWindow({ preferredDisplayId = null, initialCaptureBounds = null, mode = "standard", fixedSize = null, sourceType = "tibia", sourceGame = activeMirrorSourceGame } = {}) {
  await ensureNativeHostStarted();

  await writeDebugLog(
    `screen-vision-native-select request=${JSON.stringify({
      preferredDisplayId,
      initialCaptureBounds,
      mode,
      fixedSize,
      sourceType,
      sourceGame
    })}`
  );

  selectionInProgress = true;

  try {
    const selectionPromise = callNativeHost({
      command: sourceType === "obs-window" ? "selectObsRegion" : "selectRegion",
      preferredDisplayId,
      initialCaptureBounds,
      mode,
      fixedSize,
      sourceType,
      sourceGame
    }, {
      timeoutMs: nativeHostSelectionPipeTimeoutMs
    });

    const response = await selectionPromise;

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
        captureBounds,
        sourceType: response?.data?.sourceType || "tibia",
        sourceGame: normalizeMirrorSourceGame(response?.data?.sourceGame || sourceGame),
        sourceHwnd: response?.data?.sourceHwnd || 0
      })}`
    );

    if (response?.data?.cancelled || !captureBounds) {
      return null;
    }

    const runtimeSourceState = sourceType === "obs-window"
      ? null
      : await getMirrorSourceGameState(sourceGame, { forceFresh: false }).catch(() => null);
    const matchedDisplay = screen.getDisplayMatching(captureBounds);
    const displayBounds = normalizeSelectionBounds(matchedDisplay?.bounds, 1);
    const sourceBounds = normalizeSelectionBounds(
      response?.data?.sourceBounds || runtimeSourceState?.clientBounds || runtimeSourceState?.bounds,
      1
    );

    if (!displayBounds || (response?.data?.sourceType === "obs-window" && !sourceBounds)) {
      return null;
    }

    return {
      displayId: String(matchedDisplay.id),
      displayLabel: matchedDisplay.label || `Display ${matchedDisplay.id}`,
      displayBounds,
      captureBounds,
      sourceType: response?.data?.sourceType || "tibia",
      sourceGame: normalizeMirrorSourceGame(response?.data?.sourceGame || sourceGame),
      sourceHwnd: Number(response?.data?.sourceHwnd || runtimeSourceState?.hwnd) || 0,
      sourceWindowTitle: typeof response?.data?.sourceWindowTitle === "string" && response.data.sourceWindowTitle
        ? response.data.sourceWindowTitle
        : String(runtimeSourceState?.title || ""),
      sourceProcessName: typeof response?.data?.sourceProcessName === "string" && response.data.sourceProcessName
        ? response.data.sourceProcessName
        : String(runtimeSourceState?.processName || ""),
      sourceBounds
    };
  } finally {
    selectionInProgress = false;
    restoreMainWindowTopmost();
    requestTibiaMirrorVisibilitySync(true);
  }
}

async function withGridVisibleDuringSelection(action) {
  const overlayToolsState = await readOverlayToolsState();
  const gridSettings = getScreenVisionGridSettings(overlayToolsState);
  if (gridSettings.enabled) {
    // A grade e a referencia visual do seletor. Durante a selecao ela deve
    // permanecer acima do Tibia, e o monitor normal restaura a visibilidade
    // contextual assim que o seletor fecha.
    await syncNativeGridOverlay(overlayToolsState, { visible: true }).catch(async (error) => {
      await writeDebugLog(`screen-vision-grid-selection-sync-error ${error?.message || String(error)}`);
    });
  }

  return action();
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

function cancelDeferredNativeMirrorEmptySync() {
  nativeMirrorEmptySyncGeneration += 1;
  if (nativeMirrorEmptySyncTimer) {
    clearTimeout(nativeMirrorEmptySyncTimer);
    nativeMirrorEmptySyncTimer = null;
  }
}

function deferNativeMirrorEmptySync() {
  cancelDeferredNativeMirrorEmptySync();
  const generation = nativeMirrorEmptySyncGeneration;

  nativeMirrorEmptySyncTimer = setTimeout(() => {
    nativeMirrorEmptySyncTimer = null;
    if (generation !== nativeMirrorEmptySyncGeneration || appIsQuitting) {
      return;
    }

    void (async () => {
      const latestState = await readOverlayToolsState();
      const latestEffectiveItems = getEffectivelyVisibleMirrorItems(
        latestState?.mirrors?.items,
        getMirrorAccountStateSnapshot()
      );
      const latestVisibleRegions = Array.isArray(latestEffectiveItems)
        ? latestEffectiveItems.filter((entry) => entry.isVisible)
        : [];

      if (latestVisibleRegions.length) {
        await syncRegionMirrorWindows(latestState);
        return;
      }

      // A stable empty read is still not enough to prove that the user asked
      // to clear native mirrors. Explicit hide/delete paths opt into
      // `allowEmpty`; an automatic retry must never remove live windows from
      // a stale renderer/profile snapshot.
      await writeDebugLog(`mirror-sync ignored-stable-empty existing=${nativeMirrorRegionCount}`);
    })().catch(async (error) => {
      await writeDebugLog(`mirror-sync deferred-empty-failed ${error?.message || String(error)}`);
    });
  }, 400);
}

async function syncMirrorVisibilityForAccountState(accountState, reason) {
  setMirrorAccountStateSnapshot(accountState);
  const overlayToolsState = await readOverlayToolsState().catch(() => null);
  if (overlayToolsState) {
    // Account refresh is not an explicit user request to clear native
    // windows.  During logout/login, the store can be observed between its
    // atomic replacement steps; keep live mirrors until a stable state proves
    // that the user actually hid or deleted them.
    await syncRegionMirrorWindows(overlayToolsState, { allowEmpty: false }).catch(async (error) => {
      await writeDebugLog(`mirror-account-visibility-sync-failed reason=${reason} error=${error?.message || String(error)}`);
    });
  }
  await emitOverlayToolsStateChanged(reason);
}

async function syncRegionMirrorWindows(overlayToolsState = null, options = {}) {
  const stateWasReadImplicitly = overlayToolsState === null;
  const allowEmpty = options.allowEmpty === true;
  const state = overlayToolsState || await readOverlayToolsState();
  const mirrorItems = Array.isArray(state?.mirrors?.items) ? state.mirrors.items : [];
  const effectiveMirrorItems = getEffectivelyVisibleMirrorItems(
    mirrorItems,
    getMirrorAccountStateSnapshot()
  );
  const runtimeState = {
    ...state,
    mirrors: {
      ...(state.mirrors || {}),
      items: effectiveMirrorItems
    }
  };
  const activeGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";

  // During the Windows temp-file replacement, an implicit or stale explicit
  // read can briefly report no visible mirrors. Never turn that transient
  // snapshot into a native clear while mirrors are already alive.
  const visibleRegions = effectiveMirrorItems.filter((entry) => entry.isVisible && (
    entry.sourceType === "obs-window"
    || normalizeMirrorSourceGame(entry.sourceGame) === activeGame
  ));
  if (!visibleRegions.length && nativeMirrorRegionCount > 0 && !allowEmpty) {
    await writeDebugLog(`mirror-sync deferred-transient-empty existing=${nativeMirrorRegionCount} implicit=${stateWasReadImplicitly}`);
    deferNativeMirrorEmptySync();
    ensureTibiaWindowMonitor();
    return;
  }

  if (visibleRegions.length) {
    cancelDeferredNativeMirrorEmptySync();
  }

  const regularRegions = visibleRegions.filter((entry) => entry.sourceType !== "obs-window");
  let activeSourceState = options.sourceState || null;
  if (regularRegions.length) {
    const sourceGame = activeGame;
    activeSourceState = activeSourceState
      ?? await getMirrorSourceGameState(sourceGame, { forceFresh: false }).catch(() => null);

    if (!canUseTibiaWindowForScreenVision(activeSourceState)) {
      await writeDebugLog(`mirror-sync skipped sourceGame=${sourceGame} reason=window-unavailable regions=${regularRegions.length}`);
      ensureTibiaWindowMonitor();
      return;
    }
  }

  // OBS Mirror remains an official-Tibia output. Selecting another client for
  // the on-screen Mirror must not repoint OBS crops or alter its source.
  const obsEligibleRegions = regularRegions.filter((entry) => normalizeMirrorSourceGame(entry.sourceGame) === "tibia");
  nativeMirrorRegionCount = visibleRegions.length;
  await syncCountdownHotkeys(state);
  // A mirror ID has exactly one runtime owner. OBS and Tibia mirrors are both
  // synchronized only through the native host below.

  if (!hasActiveNativeRuntimeWork(runtimeState)) {
    // Do not wake the .NET host just to confirm that no native surface is
    // needed. If it is already running, clear stale windows before idling it.
    if (nativeHostProcess && nativeHostProcess.exitCode === null && nativeHostProcess.killed !== true) {
      await syncNativeMirrorWindows([], { allowEmpty: true }).catch(async (error) => {
        await writeDebugLog(`native-clear-idle-mirrors-error ${error?.message || String(error)}`);
      });
    }
    ensureTibiaWindowMonitor();
    scheduleNativeHostIdleShutdown();
    return;
  }

  const runtimeRegions = visibleRegions.map((entry) => {
    if (entry.sourceType === "obs-window" || normalizeMirrorSourceGame(entry.sourceGame) !== activeGame || !activeSourceState) {
      return entry;
    }

    return {
      ...entry,
      sourceHwnd: Number(activeSourceState.hwnd) || Number(entry.sourceHwnd) || 0,
      sourceWindowTitle: String(activeSourceState.title || entry.sourceWindowTitle || ""),
      sourceProcessName: String(activeSourceState.processName || entry.sourceProcessName || "")
    };
  });
  await syncNativeMirrorWindows(runtimeRegions, { allowEmpty });

  ensureTibiaWindowMonitor();
  await syncTibiaMirrorVisibility(true);

  // OBS is strictly downstream from the native mirrors. A failure here must
  // never block region creation, editing, visibility, or Tibia focus rules.
  obsMirrorSync.scheduleSync({
    regions: obsEligibleRegions,
    tibiaState: lastTibiaWindowState
  });
}

function hasActiveNativeRuntimeWork(overlayToolsState = null) {
  const rawState = overlayToolsState || {};
  const state = {
    ...rawState,
    mirrors: {
      ...(rawState.mirrors || {}),
      items: getEffectivelyVisibleMirrorItems(rawState.mirrors?.items, getMirrorAccountStateSnapshot())
    }
  };
  // RubinOT can deliberately disappear from top-level window enumeration as
  // soon as another window receives focus. Its Native Host session therefore
  // owns the verified HWND proof. Do not tear that session down while an
  // alternate client remains selected, or the Toolkit immediately loses the
  // source it just accepted. Medivia follows the same stable session rule so
  // switching clients never has asymmetric lifetime behavior.
  const alternateMirrorSourceSelected = Boolean(
    multiClientMirrorEnabled && activeMirrorSourceGame !== "tibia"
  );
  const mirrorsVisible = Array.isArray(state?.mirrors?.items)
    && state.mirrors.items.some((entry) => entry?.isVisible);
  const grid = getScreenVisionGridSettings(state);
  const visual = getScreenVisionVisualSettings(state);
  const visualActive = Boolean(visual.charLocEnabled || visual.cursorGlowEnabled);
  const alertsActive = Boolean(
    (state?.timers?.isListening || state?.timers?.visualsEnabled)
    && Array.isArray(state?.timers?.items)
    && state.timers.items.length > 0
  );

  return mirrorsVisible
    || grid.enabled
    || visualActive
    || alertsActive
    || nativeCursorMagnifierEnabled
    || alternateMirrorSourceSelected
    || selectionInProgress
    || screenVisionWindows.size > 0;
}

function scheduleNativeHostIdleShutdown() {
  if (nativeHostIdleShutdownTimer || appIsQuitting) {
    return;
  }

  nativeHostIdleShutdownTimer = setTimeout(() => {
    nativeHostIdleShutdownTimer = null;
    void stopNativeHostIfIdle();
  }, 1_500);
}

async function stopNativeHostIfIdle() {
  if (appIsQuitting || nativeHostStartPromise || !nativeHostProcess || nativeHostProcess.exitCode !== null || nativeHostProcess.killed) {
    return;
  }

  const state = await readOverlayToolsState().catch(() => null);
  if (hasActiveNativeRuntimeWork(state)) {
    return;
  }

  if (nativeHostEventPollTimer) {
    clearInterval(nativeHostEventPollTimer);
    nativeHostEventPollTimer = null;
  }
  if (tibiaWindowMonitorTimer) {
    clearInterval(tibiaWindowMonitorTimer);
    tibiaWindowMonitorTimer = null;
  }

  await writeDebugLog("native-host-idle-shutdown");
  await writePerformanceMetric("native-host-idle-shutdown", {
    uptimeMs: Math.round(performance.now() - mainProcessStartedAt)
  });
  nativeHostProcess.kill();
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
  const effectiveRegion = getEffectivelyVisibleMirrorItems([region], getMirrorAccountStateSnapshot())[0];
  await syncNativeMirrorWindows(effectiveRegion?.isVisible ? [effectiveRegion] : []);
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
  const effectiveItems = getEffectivelyVisibleMirrorItems(
    overlayToolsState.mirrors.items,
    getMirrorAccountStateSnapshot()
  );
  nativeMirrorRegionCount = effectiveItems.filter((entry) => entry.isVisible).length;
  await syncNativeMirrorWindows(effectiveItems.filter((entry) => entry.isVisible), { allowEmpty: true });
  await syncCountdownHotkeys(overlayToolsState);
  ensureTibiaWindowMonitor();
  return null;
}

function registerAssetCacheProtocol() {
  protocol.handle("poioso-cache", async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const category = sanitizeAssetCacheSegment(requestUrl.hostname || "misc");
      const key = sanitizeAssetCacheSegment(decodeURIComponent(requestUrl.pathname.replace(/^\/+/, "")) || "asset");
      const sourceUrl = requestUrl.searchParams.get("url") || "";
      const payload = await resolveAssetCachePayload(category, key, sourceUrl);
      return new Response(payload.body, {
        status: payload.status,
        headers: {
          "content-type": payload.contentType,
          "cache-control": payload.cacheControl
        }
      });
    } catch (error) {
      await writeDebugLog(`asset-cache-error ${error instanceof Error ? error.message : String(error)}`);
      return new Response("Asset cache error.", { status: 500 });
    }
  });
}

async function resolveAssetCachePayload(category, key, sourceUrl) {
  if (!/^(https?|file):\/\//i.test(sourceUrl)) {
    return {
      status: 422,
      body: Buffer.from("Invalid asset source."),
      contentType: "text/plain; charset=utf-8",
      cacheControl: "no-store"
    };
  }

  if (/^file:\/\//i.test(sourceUrl)) {
    const localPath = fileURLToPath(sourceUrl);
    const localBytes = await fs.readFile(localPath).catch(() => null);
    if (!localBytes) {
      return {
        status: 404,
        body: Buffer.from("Local asset not found."),
        contentType: "text/plain; charset=utf-8",
        cacheControl: "no-store"
      };
    }
    return {
      status: 200,
      body: localBytes,
      contentType: getImageContentType(localPath, localBytes),
      cacheControl: "public, max-age=31536000, immutable"
    };
  }

  const cachedPath = getAssetCachePath(category, key, sourceUrl);
  const cached = await fs.readFile(cachedPath).catch(() => null);
  if (cached) {
    return {
      status: 200,
      body: cached,
      contentType: getImageContentType(cachedPath, cached),
      cacheControl: "public, max-age=31536000, immutable"
    };
  }

  const downloaded = await fetch(sourceUrl, {
    redirect: "follow",
    headers: { "user-agent": "Tibia Toolkit asset cache" }
  });
  if (!downloaded.ok) {
    return {
      status: downloaded.status || 404,
      body: Buffer.from("Asset not found."),
      contentType: "text/plain; charset=utf-8",
      cacheControl: "no-store"
    };
  }

  const bytes = Buffer.from(await downloaded.arrayBuffer());
  await fs.mkdir(path.dirname(cachedPath), { recursive: true });
  await fs.writeFile(cachedPath, bytes);
  return {
    status: 200,
    body: bytes,
    contentType: downloaded.headers.get("content-type") || getImageContentType(cachedPath, bytes),
    cacheControl: "public, max-age=31536000, immutable"
  };
}

function getCachedImageProtocolUrl(category, key, sourceUrl) {
  const normalizedSource = String(sourceUrl || "").trim();

  if (!/^(https?|file):\/\//i.test(normalizedSource)) {
    return normalizedSource;
  }

  if (isPortableTestRuntime) {
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
  const mediaPrefix = "assets/library-media/library/";
  if (normalized.startsWith(mediaPrefix)) {
    const sitePath = `/${normalized.slice("assets/library-media/".length)}`;
    const descriptor = libraryCatalogMediaActive?.[sitePath];
    const hash = String(descriptor?.sha256 || "").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash)) return null;
    return path.join(libraryCatalogMediaBlobsRoot, hash);
  }
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

function getRuntimeContentUrl(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
  if (isPortableTestRuntime) {
    const filePath = resolveRuntimeFilePath(normalized);
    return filePath ? pathToFileURL(filePath).href : "";
  }
  return `tibiatoolkit://app/${normalized}`;
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
      const fileResponse = await electronNet.fetch(pathToFileURL(filePath).href);
      const headers = new Headers(fileResponse.headers);
      // TibiaData's extensionless asset endpoint historically populated this
      // compatibility folder with WebP bytes under stable numeric .png paths.
      // Preserve those public/cache paths, but advertise the real format so
      // installed Chromium runtimes never depend on MIME sniffing.
      if (/^\/assets\/data\/items\/sprites\/\d+\.png$/i.test(url.pathname)) {
        const contentType = await detectRuntimeImageContentType(filePath);
        if (contentType) headers.set("Content-Type", contentType);
      }
      if (!app.isPackaged) {
        headers.set("Cache-Control", "no-store");
      }

      return new Response(fileResponse.body, {
        headers,
        status: fileResponse.status,
        statusText: fileResponse.statusText
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

async function detectRuntimeImageContentType(filePath) {
  const cached = runtimeImageContentTypeCache.get(filePath);
  if (cached) return cached;
  const handle = await fs.open(filePath, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    const contentType = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
      ? "image/webp"
      : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : "";
    if (contentType) runtimeImageContentTypeCache.set(filePath, contentType);
    return contentType;
  } finally {
    await handle.close();
  }
}

async function bootstrapRuntimeContent(runtimeConfig) {
  if (isPortableTestRuntime) {
    const portableContentRoot = path.join(process.resourcesPath, "portable-content");
    const manifestPath = path.join(portableContentRoot, "content-manifest.json");
    const assetsRoot = path.join(projectRoot, "assets");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (
      manifest?.mode !== "portable-test"
      || String(manifest?.version || "") !== String(app.getVersion())
      || !Number.isInteger(manifest?.fileCount)
      || manifest.fileCount < 1
      || !/^[a-f0-9]{64}$/i.test(String(manifest?.aggregateSha256 || ""))
    ) {
      throw new Error("O manifesto do pacote portátil é inválido ou pertence a outra versão.");
    }

    for (const entry of Array.isArray(manifest.essentialFiles) ? manifest.essentialFiles : []) {
      const relativePath = String(entry?.path || "").replaceAll("\\", "/").replace(/^\/+/, "");
      if (!relativePath || relativePath.includes("..") || path.isAbsolute(relativePath)) {
        throw new Error("O manifesto do pacote portátil contém um caminho inválido.");
      }
      const details = await fs.stat(path.join(assetsRoot, ...relativePath.split("/"))).catch(() => null);
      if (!details?.isFile() || details.size !== Number(entry?.bytes || 0)) {
        throw new Error(`O pacote portátil está incompleto: ${relativePath}. Copie a pasta novamente.`);
      }
    }

    runtimeAssetsRoot = assetsRoot;
    await writeDebugLog(`content-pack-ready source=portable version=${manifest.version} root=${runtimeAssetsRoot}`);
    await writePerformanceMetric("content-pack-ready", { source: "portable", version: manifest.version });
    return;
  }

  if (!allowsRemoteContentPack) {
    throw new Error("O download remoto de conteúdo está desativado neste canal.");
  }

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
    },
    onDiagnostic({ phase, code, sourceUrl, archiveUrl, attempt, error } = {}) {
      const detail = error instanceof Error ? `${error.message}\n${error.stack || ""}` : String(error || "");
      void writeDebugLog(
        `content-pack-diagnostic phase=${phase || "unknown"} code=${code || "unknown"} attempt=${attempt || 0} source=${sourceUrl || ""} archive=${archiveUrl || ""} error=${detail}`
      );
    }
  });
  runtimeAssetsRoot = result.assetsRoot;
  await writeDebugLog(`content-pack-ready source=${result.source} version=${result.version} root=${runtimeAssetsRoot}`);
  await writePerformanceMetric("content-pack-ready", { source: result.source, version: result.version });

  if (app.isPackaged && result.source === "cache") {
    // The content pack has already been validated locally. Check the CDN only
    // after startup and never replace files beneath a running renderer.
    setTimeout(() => {
      void (async () => {
        const manifestPath = path.join(runtimeAssetsRoot, "..", "content-manifest.json");
        const installedManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
        const inspection = await inspectContentPackUpdate({
          manifestUrls,
          installedManifest,
          onDiagnostic({ phase, url, error } = {}) {
            void writeDebugLog(`content-pack-background-check phase=${phase || "unknown"} url=${url || ""} error=${error?.message || String(error || "")}`);
          }
        });
        await writeDebugLog(`content-pack-background-check upToDate=${inspection.upToDate}`);
        await writePerformanceMetric("content-pack-background-check", { upToDate: inspection.upToDate });
        if (!inspection.upToDate) {
          const prepared = await prepareContentPackChunkUpdate({
            manifestUrls,
            userDataPath: app.getPath("userData"),
            installedManifest,
            onDiagnostic({ phase, url, error } = {}) {
              void writeDebugLog(`content-pack-background-prepare phase=${phase || "unknown"} url=${url || ""} error=${error?.message || String(error || "")}`);
            },
            onProgress({ chunk, received, total } = {}) {
              void writeDebugLog(`content-pack-background-prepare-progress chunk=${chunk || ""} received=${received || 0} total=${total || 0}`);
            }
          });
          await writeDebugLog(`content-pack-background-prepare prepared=${prepared.prepared} reason=${prepared.reason} chunks=${prepared.chunks.length}`);
          await writePerformanceMetric("content-pack-background-prepare", {
            prepared: prepared.prepared,
            reason: prepared.reason,
            chunks: prepared.chunks.map((chunk) => chunk.id),
            bytes: prepared.chunks.reduce((sum, chunk) => sum + Number(chunk.bytes || 0), 0)
          });
        }
      })().catch((error) => {
        void writeDebugLog(`content-pack-background-check-failed ${error?.message || String(error)}`);
      });
    }, 2_000);
  }
}

async function bootstrapRuntimeContentWithRetry(runtimeConfig) {
  while (true) {
    try {
      await bootstrapRuntimeContent(runtimeConfig);
      return;
    } catch (error) {
      await writeDebugLog(
        `content-pack-attempt-failed phase=${error?.phase || "unknown"} code=${error?.code || "unknown"} error=${error?.stack || error?.message || String(error)}`
      );
      const choice = await dialog.showMessageBox(splashWindow || undefined, {
        type: "error",
        title: "Tibia Toolkit",
        message: tr("contentPack.failedTitle"),
        detail: getContentPackFailureDetail(error),
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

function getContentPackFailureDetail(error) {
  if (error?.code === "CONTENT_DISK_SPACE") {
    return tr("contentPack.failedDiskSpace");
  }
  if (error?.code === "CONTENT_CHECKSUM" || error?.code === "CONTENT_SIZE") {
    return tr("contentPack.failedIntegrity");
  }
  if (error?.phase === "extract" || error?.phase === "activate") {
    return tr("contentPack.failedPrepare");
  }
  return tr("contentPack.failedDetail");
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
    const configuredMarketBases = normalizeRuntimeBaseList(parsed?.marketApiBases || [], fileBase);
    const fileBases = usesProductionDataServices
      ? configuredMarketBases
      : normalizeRuntimeBaseList(
          ["http://127.0.0.1:3042/api/app-market", ...configuredMarketBases],
        );
    const fileGameDataHubBase = String(parsed?.gameDataHubBase || "").trim();
    const fileGameDataHubBases = normalizeRuntimeBaseList(parsed?.gameDataHubBases || [], fileGameDataHubBase);
    const fileSupportersDataUrl = String(parsed?.supportersDataUrl || "").trim();
    const configuredSupportersDataUrls = normalizeRuntimeBaseList(parsed?.supportersDataUrls || [], fileSupportersDataUrl);
    const fileSupportersDataUrls = usesProductionDataServices
      ? configuredSupportersDataUrls
      : normalizeRuntimeBaseList(["http://127.0.0.1:3042/api/supporters", ...configuredSupportersDataUrls]);
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

  const nextState = {
    open: Boolean(payload.open),
    panelKey: payload.panelKey || "",
    side: payload.side === "left" ? "left" : "right",
    phase: payload.phase || "closed",
    width: Number(payload.width) || 0
  };
  const signature = JSON.stringify(nextState);

  // Moving or resizing the native window can trigger this sync dozens of
  // times per second. The renderer only needs a notification when the panel
  // state actually changes; otherwise its buttons are recreated and flicker.
  if (signature === lastDockedToolPanelRendererContextSignature) {
    return;
  }

  lastDockedToolPanelRendererContextSignature = signature;
  mainWindow.webContents.send("docked-tool-panel:state", nextState);
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

  const minWidth = Math.max(320, Math.round((mainWindow.__dockedToolPanelBaseMinWidth || 535) + panelWidth));
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
    Math.round(mainWindow.__dockedToolPanelBaseMinWidth || 535),
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
  if (tool === "alertas-panel" && multiClientMirrorEnabled && activeMirrorSourceGame === "rubinot") {
    await writeDebugLog("screen-vision-alertas-panel-blocked source=rubinot");
    return null;
  }
  if (tool === "alertas-panel" || tool === "authenticator-panel" || tool === "profiles-panel" || tool === "sqm-finder-panel" || tool === "tibia-coins-panel" || tool === "supporters-panel" || tool === "buy-me-a-coffee-panel" || tool === "settings-panel" || tool === "account-panel" || tool === "report-panel" || tool === "wheel-perks-panel") {
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
  const shouldMonitor = screenVisionWindows.size > 0
    || nativeMirrorRegionCount > 0
    || alertTimerListeningActive
    || nativeGridOverlayEnabled
    || nativeVisualCustomizationActive
    || nativeCursorMagnifierEnabled;

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
  const shouldMonitor = screenVisionWindows.size > 0
    || nativeMirrorRegionCount > 0
    || alertTimerListeningActive
    || nativeGridOverlayEnabled
    || nativeVisualCustomizationActive
    || nativeCursorMagnifierEnabled;

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
    requestTibiaMirrorVisibilitySync(true);
  }, tibiaWindowPollIntervalMs);

  requestTibiaMirrorVisibilitySync(true);
}

function requestTibiaMirrorVisibilitySync(forceFresh = false) {
  if (appIsQuitting || nativeHostShutdownRequested) {
    return;
  }

  void syncTibiaMirrorVisibility(forceFresh).catch(async (error) => {
    const message = error?.message || String(error);
    if (appIsQuitting || nativeHostShutdownRequested || message === "native-host-shutdown-in-progress") {
      return;
    }
    await writeDebugLog(`tibia-mirror-visibility-sync-error ${message}`).catch(() => {});
  });
}

async function syncTibiaMirrorVisibility(forceFresh = false) {
  // The native selector owns focus while the user creates or crops a mirror.
  // Do not let its normal blur (or a Windows toast during it) be interpreted
  // as an external app and hide the mirrors mid-selection.
  if (selectionInProgress) {
    return;
  }

  const tibiaState = await getTibiaWindowState({ forceFresh });
  const sourceGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";
  const mirrorSourceState = sourceGame === "tibia"
    ? tibiaState
    : await getMirrorSourceGameState(sourceGame);
  const shouldShowOverlays = await shouldShowScreenVisionOverlays(mirrorSourceState, { sourceGame });
  const overlayToolsState = nativeMirrorRegionCount > 0
    ? await readOverlayToolsState().catch(() => null)
    : null;
  const hasObsSourceMirror = Boolean(
    overlayToolsState?.mirrors?.items?.some((entry) => entry?.isVisible && entry?.sourceType === "obs-window")
  );
  const shouldProbeForegroundContext = !shouldShowOverlays && Boolean(
    nativeMirrorRegionCount > 0
    || screenVisionWindows.size > 0
    || alertTimerListeningActive
    || nativeGridOverlayEnabled
    || nativeVisualCustomizationActive
    || nativeCursorMagnifierEnabled
  );
  const foregroundContext = shouldProbeForegroundContext
    ? await getNativeForegroundContext()
    : null;
  const obsCaptureFocused = Boolean(foregroundContext?.obsStudioFocused);
  const mirrorInteractionActive = Boolean(foregroundContext?.mirrorInteractionActive);
  const toolkitFocused = Boolean(foregroundContext?.toolkitFocused);
  // RubinOT may withhold enough top-level window metadata that its own probe
  // briefly reports it as not foreground. The Native Host foreground process
  // is still an OS-provided fact. Use it only for the already-selected,
  // verified RubinOT client, never as a process-name discovery shortcut.
  const selectedRubinotForeground = sourceGame === "rubinot"
    && isForegroundProcessForMirrorSourceGame(foregroundContext?.processName, sourceGame);
  const controllerFocused = !shouldShowOverlays
    ? controllerWindowFocusState || await isAnyControllerWindowFocused().catch(() => false)
    : false;
  // Keep the existing Tibia Mirror focus rule while allowing the
  // Toolkit/controller to own focus. The OBS mirror visibility rule below
  // stays independent.
  const shouldShowRegularMirrorOverlays = Boolean(
    shouldShowOverlays
    || selectedRubinotForeground
    || (
      (mirrorInteractionActive || toolkitFocused || controllerFocused)
        && canUseTibiaWindowForScreenVision(mirrorSourceState)
    )
  );
  const shouldShowObsMirrorOverlays = hasObsSourceMirror;
  // If the Toolkit owns focus, the native mirrors must remain above it;
  // otherwise they are technically visible but end up behind the app window.
  const mirrorsShouldBeTopmost = shouldShowRegularMirrorOverlays;
  // SQM/cursor customization and visual alerts belong to the selected Mirror
  // client. Keep them alive while the user configures that client inside the
  // Toolkit, just like the regular mirrors and grid. Unrelated foreground
  // applications still fail this gate and preserve the existing exclusions.
  // Alertas are global once the selected game is still open. Focus controls
  // only the visual Mirror surfaces below; it must never pause a timer or
  // suppress its configured hotkey while the player uses another window.
  await syncAlertTimerTibiaVisibilityGate(null, {
    sourceGame,
    sourceState: mirrorSourceState
  });
  await setNativeMirrorsTopmost(mirrorsShouldBeTopmost);
  await setNativeObsMirrorsTopmost(hasObsSourceMirror);
  await setNativeMirrorsVisible(shouldShowRegularMirrorOverlays);
  await setNativeObsMirrorsVisible(shouldShowObsMirrorOverlays);

  const shouldShowVisualOverlays = Boolean(
    shouldShowRegularMirrorOverlays || (obsCaptureFocused && hasObsSourceMirror)
  );
  const shouldPrioritizeVisualOverlays = Boolean(
    shouldShowVisualOverlays
    && (mirrorInteractionActive || toolkitFocused || controllerFocused)
  );
  if (
    lastNativeVisualOverlayVisible !== shouldShowVisualOverlays
    || lastNativeVisualOverlayPriority !== shouldPrioritizeVisualOverlays
  ) {
    lastNativeVisualOverlayVisible = shouldShowVisualOverlays;
    lastNativeVisualOverlayPriority = shouldPrioritizeVisualOverlays;
    await syncNativeVisualCustomization(null, {
      tibiaState: mirrorSourceState,
      sourceGame,
      visible: shouldShowVisualOverlays
    }).catch(async (error) => {
      lastNativeVisualOverlayVisible = null;
      lastNativeVisualOverlayPriority = null;
      await writeDebugLog(`native-visual-visibility-sync-error ${error?.message || String(error)}`);
    });
  }

  // The grid belongs to the Tibia Mirror surface. Keep it visible while the
  // user interacts with that surface, exactly like the regular mirrors; the
  // generic overlay rule is intentionally stricter for other windows.
  const nextGridSignature = buildGridOverlayTibiaSignature(mirrorSourceState, shouldShowRegularMirrorOverlays, sourceGame);

  if (nextGridSignature !== lastGridOverlayTibiaSignature) {
    lastGridOverlayTibiaSignature = nextGridSignature;
    await syncNativeGridOverlay(null, { tibiaState: mirrorSourceState, sourceGame, visible: shouldShowRegularMirrorOverlays }).catch(async (error) => {
      await writeDebugLog(`native-grid-monitor-sync-error ${error?.message || String(error)}`);
    });
  }
}

async function isObsStudioFocused() {
  const context = await getNativeForegroundContext();
  return context.obsStudioFocused;
}

async function getNativeForegroundContext() {
  try {
    await ensureNativeHostStarted();
    const response = await callNativeHost({ command: "getForegroundProcess" });
    const processName = String(response?.data?.processName || "").trim().toLowerCase();
    const obsStudioFocused = processName === "obs64" || processName === "obs" || processName === "obs64.exe" || processName === "obs.exe";
    const mirrorInteractionActive = Boolean(response?.data?.mirrorInteractionActive);
    const toolkitFocused = processName === "tibia toolkit" || processName === "tibia toolkit.exe" || processName === "electron" || processName === "electron.exe";
    const logSignature = `${processName || "none"}:${obsStudioFocused}:${mirrorInteractionActive}:${toolkitFocused}`;
    if (logSignature !== lastObsFocusLogSignature) {
      lastObsFocusLogSignature = logSignature;
      await writeDebugLog(`native-focus-probe process=${processName || "none"} obs=${obsStudioFocused} mirrorInteraction=${mirrorInteractionActive}`);
    }
    return { processName, obsStudioFocused, mirrorInteractionActive, toolkitFocused };
  } catch (error) {
    await writeDebugLog(`obs-mirror-focus-probe-failed ${error?.message || String(error)}`);
    return { processName: "", obsStudioFocused: false, mirrorInteractionActive: false, toolkitFocused: false };
  }
}

async function getTibiaWindowState({ forceFresh = false } = {}) {
  // "Fresh" means do not reuse an old completed snapshot. It must still
  // share an in-flight probe: otherwise independent UI polls can start many
  // PowerShell processes at once and stall the Electron main process.
  if (tibiaWindowStateRequest) {
    return tibiaWindowStateRequest;
  }

  tibiaWindowStateRequest = (async () => {
    const overlayState = await readOverlayToolsState().catch(() => null);
    // Window identification must remain available even if the optional native
    // Mirror host is unavailable. It is deliberately not started merely to
    // discover Tibia; the PowerShell probe is isolated and reliable here.
    const shouldUseNativeProbe = Boolean(
      !nativeHostStartPromise
      && nativeHostProcess
      && nativeHostProcess.exitCode === null
      && nativeHostProcess.killed !== true
    );

    try {
      const normalized = shouldUseNativeProbe
        ? await getTibiaWindowStateViaNativeHost()
        : await getTibiaWindowStateViaPowerShell();
      lastTibiaWindowState = normalized;
      return normalized;
    } catch (error) {
      await writeDebugLog(`tibia-window-${shouldUseNativeProbe ? "native" : "powershell"}-error ${error?.message || String(error)}`);

      try {
        const fallbackState = shouldUseNativeProbe
          ? await getTibiaWindowStateViaPowerShell()
          : await getTibiaWindowStateViaNativeHost();
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

async function getMirrorSourceGameState(sourceGame = activeMirrorSourceGame, { forceFresh = true } = {}) {
  const game = normalizeMirrorSourceGame(sourceGame);
  if (!multiClientMirrorEnabled || game === "tibia") {
    const tibiaState = await getTibiaWindowState({ forceFresh });
    return tibiaState ? { ...tibiaState, sourceGame: "tibia" } : null;
  }

  await ensureNativeHostStarted();
  let knownWindow = mirrorSourceWindowProofs.get(game);
  if (!knownWindow && game === "rubinot") {
    knownWindow = await loadPersistedMirrorSourceWindowProof(game);
    if (knownWindow) mirrorSourceWindowProofs.set(game, knownWindow);
  }
  let response = await callNativeHost({
    command: "getGameWindow",
    sourceGame: game,
    knownHwnd: Number(knownWindow?.hwnd || 0),
    knownProcessId: Number(knownWindow?.processId || 0),
    knownTitle: String(knownWindow?.title || "")
  });
  if ((!response?.ok || !response.data) && game === "rubinot") {
    const recoveredWindow = knownWindow?.hwnd && knownWindow?.processId
      ? {
          hwnd: Number(knownWindow.hwnd),
          processId: Number(knownWindow.processId),
          title: /^RubinOT Client - /i.test(String(knownWindow.title || ""))
            ? String(knownWindow.title)
            : "RubinOT Client - verified"
        }
      : await recoverRubinotWindowProofFromDebugLog();
    if (recoveredWindow) {
      mirrorSourceWindowProofs.set(game, recoveredWindow);
      await persistMirrorSourceWindowProof(game, recoveredWindow);
      response = await callNativeHost({
        command: "getGameWindow",
        sourceGame: game,
        knownHwnd: recoveredWindow.hwnd,
        knownProcessId: recoveredWindow.processId,
        knownTitle: recoveredWindow.title
      });
      if (response?.ok && response.data) {
        await writeDebugLog(`mirror-source-proof-recovered sourceGame=rubinot hwnd=${recoveredWindow.hwnd} pid=${recoveredWindow.processId}`);
      } else {
        mirrorSourceWindowProofs.delete(game);
      }
    }
  }
  if (!response?.ok || !response.data) return null;
  const normalized = normalizeTibiaDisplayState(response.data);
  if (!normalized?.bounds) return null;
  if (game === "rubinot" && response.data?.hwnd && response.data?.processId && response.data?.title) {
    const responseTitle = String(response.data.title);
    const durableTitle = /^RubinOT Client - /i.test(responseTitle)
      ? responseTitle
      : (/^RubinOT Client - /i.test(String(knownWindow?.title || ""))
          ? String(knownWindow.title)
          : "RubinOT Client - verified");
    mirrorSourceWindowProofs.set(game, {
      hwnd: Number(response.data.hwnd),
      processId: Number(response.data.processId),
      title: durableTitle
    });
    await persistMirrorSourceWindowProof(game, mirrorSourceWindowProofs.get(game));
  }
  return {
    ...normalizeTibiaDisplayState(response.data, screen.getDisplayMatching(normalized.bounds)),
    sourceGame: game
  };
}

async function loadPersistedMirrorSourceWindowProof(sourceGame) {
  try {
    const parsed = JSON.parse(await fs.readFile(screenVisionWindowProofPath, "utf8"));
    const proof = parsed?.[normalizeMirrorSourceGame(sourceGame)];
    const hwnd = Number(proof?.hwnd || 0);
    const processId = Number(proof?.processId || 0);
    const title = String(proof?.title || "");
    return hwnd > 0 && processId > 0 && /^RubinOT Client(?: - .+)?$/i.test(title)
      ? { hwnd, processId, title }
      : null;
  } catch {
    return null;
  }
}

async function persistMirrorSourceWindowProof(sourceGame, proof) {
  if (!proof?.hwnd || !proof?.processId) return;
  const game = normalizeMirrorSourceGame(sourceGame);
  let current = {};
  try {
    current = JSON.parse(await fs.readFile(screenVisionWindowProofPath, "utf8"));
  } catch {
    current = {};
  }
  await fs.mkdir(path.dirname(screenVisionWindowProofPath), { recursive: true });
  await fs.writeFile(screenVisionWindowProofPath, JSON.stringify({
    ...current,
    [game]: {
      hwnd: Number(proof.hwnd),
      processId: Number(proof.processId),
      title: String(proof.title || "")
    }
  }), "utf8");
}

let rubinotWindowProofRecoveryPromise = null;

async function recoverRubinotWindowProofFromDebugLog() {
  if (rubinotWindowProofRecoveryPromise) return rubinotWindowProofRecoveryPromise;

  rubinotWindowProofRecoveryPromise = (async () => {
    let handle = null;
    try {
      const stat = await fs.stat(debugLogPath);
      const tailLength = Math.min(stat.size, 2 * 1024 * 1024);
      handle = await fs.open(debugLogPath, "r");
      const buffer = Buffer.alloc(tailLength);
      await handle.read(buffer, 0, tailLength, stat.size - tailLength);
      const candidates = [];
      for (const line of buffer.toString("utf8").split(/\r?\n/)) {
        const marker = "screen-vision-tibia-state ";
        const markerIndex = line.indexOf(marker);
        if (markerIndex < 0) continue;
        try {
          const state = JSON.parse(line.slice(markerIndex + marker.length));
          const hwnd = Number(state?.hwnd || 0);
          const title = String(state?.title || "");
          if (state?.sourceGame === "rubinot" && hwnd > 0 && /^RubinOT Client - /i.test(title)) {
            candidates.push({ hwnd, title });
          }
        } catch {
          // A partially written diagnostic line is not a usable proof.
        }
      }

      const seen = new Set();
      for (const candidate of candidates.reverse()) {
        if (seen.has(candidate.hwnd)) continue;
        seen.add(candidate.hwnd);
        const script = [
          'Add-Type @"',
          'using System; using System.Runtime.InteropServices;',
          'public static class TTWindowProof {',
          '[DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);',
          '[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);',
          '[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);',
          '[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);',
          '}',
          '"@;',
          `$h=[IntPtr]${candidate.hwnd};`,
          'if(-not [TTWindowProof]::IsWindow($h) -or -not [TTWindowProof]::IsWindowVisible($h) -or [TTWindowProof]::IsIconic($h)){ exit 2 };',
          '$targetPid=0; [void][TTWindowProof]::GetWindowThreadProcessId($h,[ref]$targetPid);',
          '$process=Get-Process -Id $targetPid -ErrorAction SilentlyContinue;',
          'if($null -eq $process -or ($process.ProcessName -ine "rubinot_dx" -and $process.ProcessName -ine "RubinOT")){ exit 3 };',
          '[Console]::Write((@{processId=[int]$targetPid;processName=$process.ProcessName}|ConvertTo-Json -Compress))'
        ].join(" ");
        try {
          const { stdout } = await execFileAsync(windowsPowerShellCommand, [
            "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script
          ], { windowsHide: true, timeout: 2500 });
          const proof = JSON.parse(String(stdout || "{}"));
          const processId = Number(proof?.processId || 0);
          if (processId > 0 && /^(rubinot_dx|RubinOT)$/i.test(String(proof?.processName || ""))) {
            return { hwnd: candidate.hwnd, processId, title: candidate.title };
          }
        } catch {
          // Continue with an older previously verified HWND, if one exists.
        }
      }
    } catch {
      return null;
    } finally {
      await handle?.close().catch(() => {});
    }
    return null;
  })();

  try {
    return await rubinotWindowProofRecoveryPromise;
  } finally {
    rubinotWindowProofRecoveryPromise = null;
  }
}

function getMirrorSourceGameUnavailableMessage(sourceGame) {
  const game = normalizeMirrorSourceGame(sourceGame);
  const locale = normalizeLocale(getActiveLocale());
  const name = getMirrorSourceGameDisplayName(game);
  if (locale === "en") return `Open ${name} first.`;
  if (locale === "de") return `Öffne zuerst ${name}.`;
  return `Abra o ${name} primeiro.`;
}

function getMirrorSourceGameDisplayName(sourceGame = activeMirrorSourceGame) {
  const game = normalizeMirrorSourceGame(sourceGame);
  return { tibia: "Tibia", rubinot: "RubinOT", medivia: "Medivia" }[game];
}

async function selectMirrorSourceGame(sourceGame) {
  const game = normalizeMirrorSourceGame(sourceGame);
  if (!multiClientMirrorEnabled || game === activeMirrorSourceGame) {
    const payload = { activeGame: activeMirrorSourceGame };
    emitMirrorGameSelectorRender(payload);
    return payload;
  }

  if (mirrorSourceSelectionPromise) {
    return mirrorSourceSelectionPromise;
  }

  mirrorSourceSelectionPromise = (async () => {
    try {
      const sourceState = await getMirrorSourceGameState(game);
      if (!canUseTibiaWindowForScreenVision(sourceState)) {
        const error = getMirrorSourceGameUnavailableMessage(game);
        await writeDebugLog(`mirror-source-select rejected sourceGame=${game} reason=window-unavailable`);
        const payload = { activeGame: activeMirrorSourceGame, error };
        emitMirrorGameSelectorRender(payload);
        return payload;
      }

      // Save the current game's profile before changing the active namespace.
      // Runtime features are persisted as disabled, while their definitions,
      // positions, colors, hotkeys and regions remain intact.
      const previousGame = activeMirrorSourceGame;
      const previousState = disableMirrorRuntimeFeatures(await readOverlayToolsState());
      const wallClockTimers = getRunningWallClockTimers(previousState);
      stopNonWallClockAlertTimerRuntimes(previousState);
      if (nativeHostProcess && nativeHostProcess.exitCode === null && nativeHostProcess.killed !== true) {
        await callNativeHost({
          command: "setCursorMagnifier",
          enabled: false,
          sourceGame: previousGame
        }).catch(() => null);
      }
      if (obsMirrorSync.getStatus().enabled) {
        await obsMirrorSync.disable().catch(() => null);
      }
      await persistActiveScreenVisionProfileSnapshot(previousState);
      activeMirrorSourceGame = game;
      // A protected DirectX client may reassert its own z-order after the
      // source changes. Re-send the OBS topmost command for the new client
      // instead of trusting the previous client's cached acknowledgement.
      nativeObsMirrorsAlwaysOnTop = null;
      await activateScreenVisionProfileForSourceGame(game, { sourceState, wallClockTimers });
      await syncCursorMagnifierSourceGame(game);
      await syncTibiaMirrorVisibility(true);
      await persistActiveMirrorSourceGame(game);
      const payload = { activeGame: activeMirrorSourceGame };
      emitMirrorGameSelectorRender(payload);
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("screen-vision:mirror-source-changed", payload);
      await writeDebugLog(`mirror-source-select applied sourceGame=${game} hwnd=${sourceState.hwnd}`);
      return payload;
    } catch (error) {
      const message = getMirrorSourceGameUnavailableMessage(game);
      await writeDebugLog(`mirror-source-select rejected sourceGame=${game} error=${error?.message || String(error)}`);
      const payload = { activeGame: activeMirrorSourceGame, error: message };
      emitMirrorGameSelectorRender(payload);
      return payload;
    }
  })();

  try {
    return await mirrorSourceSelectionPromise;
  } finally {
    mirrorSourceSelectionPromise = null;
  }
}

async function syncCursorMagnifierSourceGame(sourceGame = activeMirrorSourceGame) {
  if (!nativeHostProcess || nativeHostProcess.exitCode !== null || nativeHostProcess.killed === true) {
    nativeCursorMagnifierEnabled = false;
    return { enabled: false, skipped: true };
  }

  const game = normalizeMirrorSourceGame(sourceGame);
  const sourceState = await getMirrorSourceGameState(game, { forceFresh: true }).catch(() => null);
  const current = await callNativeHost({ command: "getCursorMagnifier" });
  const enabled = Boolean(current?.ok && current?.data?.enabled);
  const response = await callNativeHost({
    command: "setCursorMagnifier",
    enabled,
    sourceGame: game,
    knownHwnd: Number(sourceState?.hwnd || 0),
    knownProcessId: Number(sourceState?.processId || 0),
    knownTitle: String(sourceState?.title || "")
  });
  nativeCursorMagnifierEnabled = Boolean(response?.ok && response?.data?.enabled);
  await writeDebugLog(`screen-vision-cursor-magnifier-source sourceGame=${game} enabled=${enabled}`);
  return response;
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
  const { stdout } = await execFileAsync(windowsPowerShellCommand, [
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

  if (isPortableTestRuntime && portableNativeHostLaunchError) {
    throw portableNativeHostLaunchError;
  }

  if (nativeHostRetryAfterMs > Date.now()) {
    throw nativeHostLastLaunchError || new Error("native-host-retry-pending");
  }

  if (nativeHostStartPromise) {
    return nativeHostStartPromise;
  }

  nativeHostStartPromise = (async () => {
    const startedAt = performance.now();
    await cleanupNativeHostProcesses();
    await buildNativeHostIfNeeded();

    const launchPlans = [];

    if (app.isPackaged) {
      launchPlans.push({
        command: nativeHostPublishedExePath,
        source: "packaged"
      });
    } else {
      launchPlans.push({
        command: nativeHostDevelopmentExePath,
        source: "development-apphost"
      });
    }

    let lastLaunchError = null;

    for (const plan of launchPlans) {
      const child = spawn(plan.command, plan.args || ["--pipe", nativeHostPipeId], {
        cwd: projectRoot,
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"]
      });

      const spawnErrorPromise = new Promise((_resolve, reject) => {
        child.once("error", reject);
      });

      nativeHostProcess = child;
      lastNativeMirrorsVisible = null;
      lastNativeObsMirrorsVisible = null;
      lastNativeVisualOverlayVisible = null;
      lastNativeVisualOverlayPriority = null;
      nativeMirrorsAlwaysOnTop = null;
      nativeObsMirrorsAlwaysOnTop = null;
      nativeObsMirrorCommandSupported = null;
      nativeObsTopmostCommandSupported = null;
      nativeObsVisibilityCommandSupported = null;

      child.on("exit", (code, signal) => {
        void writeDebugLog(`native-host-exit source=${plan.source} code=${code ?? "null"} signal=${signal ?? "null"}`);
        if (nativeHostProcess === child) {
          nativeHostProcess = null;
          nativeCursorMagnifierEnabled = false;
          lastNativeMirrorsVisible = null;
          lastNativeObsMirrorsVisible = null;
          lastNativeVisualOverlayVisible = null;
          lastNativeVisualOverlayPriority = null;
          nativeMirrorsAlwaysOnTop = null;
          nativeObsMirrorsAlwaysOnTop = null;
          nativeObsMirrorCommandSupported = null;
          nativeObsTopmostCommandSupported = null;
          nativeObsVisibilityCommandSupported = null;
        }
      });

      child.stderr?.on("data", (chunk) => {
        const text = String(chunk || "").trim();
        if (text) void writeDebugLog(`native-host-stderr source=${plan.source} ${text}`);
      });

      let rejectOnEarlyExit = null;
      const earlyExitPromise = new Promise((_resolve, reject) => {
        rejectOnEarlyExit = (code, signal) => {
          reject(new Error(`native-host-exited source=${plan.source} code=${code ?? "null"} signal=${signal ?? "null"}`));
        };
        child.once("exit", rejectOnEarlyExit);
      });

      try {
        await Promise.race([
          waitForNativeHostReady(),
          earlyExitPromise,
          spawnErrorPromise
        ]);
        await writeDebugLog(`native-host-ready source=${plan.source}`);
        lastLaunchError = null;
        nativeHostLastLaunchError = null;
        nativeHostRetryAfterMs = 0;
        break;
      } catch (error) {
        lastLaunchError = error;
        if (isPortableTestRuntime) portableNativeHostLaunchError = error;
        await writeDebugLog(`native-host-start-failed source=${plan.source} error=${error?.message || String(error)}`);
        if (nativeHostProcess === child) nativeHostProcess = null;
        if (!child.killed && child.exitCode === null) child.kill();
      } finally {
        if (rejectOnEarlyExit) {
          child.off("exit", rejectOnEarlyExit);
        }
      }
    }

    if (lastLaunchError) {
      nativeHostLastLaunchError = lastLaunchError;
      nativeHostRetryAfterMs = Date.now() + 5000;
      throw lastLaunchError;
    }

    await writePerformanceMetric("native-host-ready", {
      elapsedMs: Math.round(performance.now() - startedAt)
    });
    return true;
  })();

  try {
    return await nativeHostStartPromise;
  } finally {
    nativeHostStartPromise = null;
  }
}

async function applyNativeWindowCornerPreference(window) {
  if (!window || window.isDestroyed() || process.platform !== "win32") {
    return;
  }

  try {
    const handle = window.getNativeWindowHandle();

    if (!Buffer.isBuffer(handle) || handle.length < 4) {
      return;
    }

    const hwnd = handle.length >= 8
      ? handle.readBigInt64LE(0).toString()
      : String(handle.readInt32LE(0));

    await ensureNativeHostStarted();
    const response = await callNativeHost({
      command: "setWindowRoundedCorners",
      hwnd
    }, { timeoutMs: 2500 });

    await writeDebugLog(`window-rounded-corners applied=${Boolean(response?.ok)}`);
  } catch (error) {
    // A cosmetic DWM preference must never prevent the toolkit from opening.
    await writeDebugLog(`window-rounded-corners-error ${error?.message || String(error)}`);
  } finally {
    // Rounded corners are a one-shot DWM preference, not a reason to retain
    // the full Screen Vision runtime in memory.
    scheduleNativeHostIdleShutdown();
  }
}

async function buildNativeHostIfNeeded() {
  if (app.isPackaged) {
    await fs.access(nativeHostPublishedExePath);
    return;
  }

  // Building WPF while the user interacts blocks the application and can
  // overlap mirror reconstruction. Development artifacts are built explicitly
  // before launch; runtime startup only validates them.
  const executable = await fs.stat(nativeHostDevelopmentExePath);
  if (!executable.isFile() || executable.size <= 0) {
    throw new Error("native-host-development-apphost-invalid");
  }
}

async function cleanupNativeHostProcesses() {
  try {
    const nativeHostProcessFilter = "(($_.Name -eq 'dotnet.exe' -and $_.CommandLine -like '*ScreenVision.NativeHost.dll*') -or ($_.Name -eq 'ScreenVision.NativeHost.exe')) -and $_.CommandLine -like '*--pipe " + nativeHostPipeId + "*'";

    await execFileAsync(windowsPowerShellCommand, [
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

async function syncNativeMirrorWindows(regions, options = {}) {
  const mirrors = (Array.isArray(regions) ? regions : [])
    .map((entry) => normalizeOverlayMirrorEntry(entry))
    .filter(Boolean)
    .map((region) => ({
      id: region.id,
      name: region.name,
      captureBounds: region.captureBounds,
      mirrorBounds: region.mirrorBounds,
      relativeBounds: region.relativeBounds,
      sourceType: region.sourceType,
      sourceGame: region.sourceGame,
      sourceHwnd: region.sourceHwnd,
      sourceWindowTitle: region.sourceWindowTitle,
      sourceProcessName: region.sourceProcessName,
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

  const sequence = ++nativeMirrorSyncSequence;
  const allowEmpty = options.allowEmpty === true;
  if (mirrors.length > 0) {
    nativeMirrorLatestNonEmptySequence = sequence;
  }

  const run = async () => {
    if (!mirrors.length && !allowEmpty && sequence < nativeMirrorLatestNonEmptySequence) {
      await writeDebugLog(`native-mirror-sync-empty-superseded sequence=${sequence} latestNonEmpty=${nativeMirrorLatestNonEmptySequence}`);
      return { ok: true, skipped: "superseded-empty" };
    }

    await ensureNativeHostStarted();
    const response = await callNativeHost({
      command: "syncMirrors",
      mirrors
    });

    if (!response?.ok) {
      throw new Error(response?.error || "native-sync-mirrors-failed");
    }

    return response;
  };

  const pending = nativeMirrorSyncQueue.then(run, run);
  nativeMirrorSyncQueue = pending.then(() => undefined, () => undefined);
  return pending;
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
  const next = Boolean(visible);

  if (lastNativeMirrorsVisible === next) {
    return { ok: true, skipped: true, visible: next };
  }

  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "setMirrorsVisible",
    visible: next
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-set-mirrors-visible-failed");
  }

  lastNativeMirrorsVisible = next;
  return response;
}

async function nativeHostSupportsObsMirror() {
  if (nativeObsMirrorCommandSupported !== null) {
    return nativeObsMirrorCommandSupported;
  }

  await ensureNativeHostStarted();
  const response = await callNativeHost({ command: "getCapabilities" }).catch(() => null);
  nativeObsMirrorCommandSupported = Boolean(response?.ok && response?.data?.obsMirror === true);
  await writeDebugLog(`native-obs-mirror-capability supported=${nativeObsMirrorCommandSupported}`);
  return nativeObsMirrorCommandSupported;
}

async function setNativeObsMirrorsVisible(visible) {
  const next = Boolean(visible);

  if (nativeObsVisibilityCommandSupported === false) {
    return { ok: true, skipped: true, unsupported: true, visible: next };
  }

  if (lastNativeObsMirrorsVisible === next) {
    return { ok: true, skipped: true, visible: next };
  }

  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "setObsMirrorsVisible",
    visible: next
  });

  if (!response?.ok) {
    if (response?.error === "unknown-command") {
      nativeObsVisibilityCommandSupported = false;
      await writeDebugLog("native-obs-mirrors-visibility-unsupported");
      return { ok: true, skipped: true, unsupported: true, visible: next };
    }
    throw new Error(response?.error || "native-set-obs-mirrors-visible-failed");
  }

  nativeObsVisibilityCommandSupported = true;
  lastNativeObsMirrorsVisible = next;
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

async function setNativeObsMirrorsTopmost(enabled) {
  const next = Boolean(enabled);

  if (nativeObsTopmostCommandSupported === false) {
    return { ok: true, skipped: true, unsupported: true, enabled: next };
  }

  if (nativeObsMirrorsAlwaysOnTop === next) {
    return { ok: true, skipped: true, enabled: next };
  }

  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "setObsMirrorsTopmost",
    enabled: next
  });

  if (!response?.ok) {
    if (response?.error === "unknown-command") {
      nativeObsTopmostCommandSupported = false;
      await writeDebugLog("native-obs-mirrors-topmost-unsupported");
      return { ok: true, skipped: true, unsupported: true, enabled: next };
    }
    throw new Error(response?.error || "native-set-obs-mirrors-topmost-failed");
  }

  nativeObsTopmostCommandSupported = true;
  nativeObsMirrorsAlwaysOnTop = next;
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
  const nativeHostRunning = Boolean(
    nativeHostProcess && nativeHostProcess.exitCode === null && nativeHostProcess.killed !== true
  );
  if (!nativeHostRunning && !nativeRuntimeActivatedForSession) {
    return;
  }
  if (!nativeHostRunning && !hasActiveNativeRuntimeWork(state)) {
    return;
  }
  const sourceGame = options.sourceGame ?? (multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia");
  const tibiaState = options.tibiaState ?? await getMirrorSourceGameState(sourceGame).catch(() => null);
  const visible = options.visible ?? await shouldShowTibiaMirrorSurface(tibiaState, { sourceGame });
  const visualVisible = options.visualVisible ?? (
    typeof lastNativeVisualOverlayVisible === "boolean"
      ? lastNativeVisualOverlayVisible
      : visible
  );
  await Promise.allSettled([
    syncNativeGridOverlay(state, { tibiaState, sourceGame, visible }),
    syncNativeVisualCustomization(state, { tibiaState, sourceGame, visible: visualVisible })
  ]);
}

async function syncNativeGridOverlay(overlayToolsState = null, options = {}) {
  const state = overlayToolsState || await readOverlayToolsState();
  const grid = getScreenVisionGridSettings(state);
  nativeGridOverlayEnabled = Boolean(grid.enabled);
  const nativeHostRunning = Boolean(
    nativeHostProcess && nativeHostProcess.exitCode === null && nativeHostProcess.killed !== true
  );
  if (!nativeHostRunning && !nativeRuntimeActivatedForSession && !nativeGridOverlayEnabled) {
    return { ok: true, skipped: "native-runtime-not-activated" };
  }
  const sourceGame = normalizeMirrorSourceGame(options.sourceGame ?? (multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia"));
  const tibiaState = options.tibiaState ?? await getMirrorSourceGameState(sourceGame).catch(() => null);
  const visible = options.visible ?? await shouldShowTibiaMirrorSurface(tibiaState, { sourceGame });
  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "setGridOverlay",
    enabled: grid.enabled,
    gridSize: grid.gridSize,
    sourceGame,
    visible
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-grid-overlay-failed");
  }

  ensureTibiaWindowMonitor();
  return response;
}

async function syncNativeVisualCustomization(overlayToolsState = null, options = {}) {
  const state = overlayToolsState || await readOverlayToolsState();
  const visual = getScreenVisionVisualSettings(state);
  nativeVisualCustomizationActive = Boolean(visual.charLocEnabled || visual.cursorGlowEnabled);
  const nativeHostRunning = Boolean(
    nativeHostProcess && nativeHostProcess.exitCode === null && nativeHostProcess.killed !== true
  );
  if (!nativeHostRunning && !nativeRuntimeActivatedForSession && !nativeVisualCustomizationActive) {
    return { ok: true, skipped: "native-runtime-not-activated" };
  }
  const sourceGame = normalizeMirrorSourceGame(options.sourceGame ?? (multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia"));
  const tibiaState = options.tibiaState ?? await getMirrorSourceGameState(sourceGame).catch(() => null);
  // Preview/update calls originate while the Toolkit owns focus. They must
  // preserve the visibility already resolved by the focus monitor instead of
  // applying the stricter Tibia-only gate and hiding SQM/cursor overlays while
  // the monitor cache still says they are visible.
  const visible = typeof options.visible === "boolean"
    ? options.visible
    : await shouldShowTibiaMirrorSurface(tibiaState, { sourceGame });
  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "syncVisualCustomization",
    visualCustomization: visual,
    visible
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-visual-customization-failed");
  }

  await writeDebugLog(
    `native-visual-synced sourceGame=${sourceGame} charLoc=${visual.charLocEnabled === true} cursor=${visual.cursorGlowEnabled === true} visible=${visible}`
  );
  ensureTibiaWindowMonitor();
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
    const sourceGate = await resolveAlertTimerHotkeySourceGate();
    const allowed = sourceGate.allowed && shouldEmitAlertTimerHotkey(intValue, modifiers, overlayToolsState, {
      allowRubinotConnection: sourceGate.allowRubinotConnection
    });
    await writeDebugLog(
      `native-alert-hotkey-received keyCode=${intValue} modifiers=${modifiers} allowed=${allowed} sourceGate=${sourceGate.reason}`
    );

    if (allowed) {
      const result = await handleAlertTimerHotkey(intValue, modifiers, overlayToolsState, {
        allowRubinotConnection: sourceGate.allowRubinotConnection
      });
      await writeDebugLog(
        `native-alert-hotkey-dispatched keyCode=${intValue} modifiers=${modifiers} matched=${result.matched} started=${result.started}`
      );
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
      regions: savedState.mirrors.items.filter((entry) => (
        entry.isVisible && entry.sourceType !== "obs-window"
      )),
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
    await syncRegionMirrorWindows(savedState, { allowEmpty: true });
    return;
  }

  if (type === "mirror-toggle-visibility" || type === "mirror-closed") {
    await writeDebugLog(`native-event type=${type} region=${regionId}`);
    countdownRunningRegionIds.delete(regionId);
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      isVisible: type === "mirror-closed" ? false : !region.isVisible
    }));
    const effectiveSavedItems = getEffectivelyVisibleMirrorItems(
      savedState.mirrors.items,
      getMirrorAccountStateSnapshot()
    );
    await syncRegionMirrorWindows(savedState, {
      allowEmpty: !effectiveSavedItems.some((entry) => entry.isVisible)
    });
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
    await syncRegionMirrorWindows(savedState, { allowEmpty: true });
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
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      glowColor: normalizeHexColor(stringValue, region.glowColor || "#FFFFFF")
    }));
    await syncRegionMirrorWindows(savedState);
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
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      glowSavedColors: normalizeMirrorGlowSavedColors(colors)
    }));
    await syncRegionMirrorWindows(savedState);
    return;
  }

  if (type === "mirror-set-glow-intensity" && typeof stringValue === "string" && stringValue.trim()) {
    const parsedIntensity = Number(stringValue);

    if (!Number.isFinite(parsedIntensity)) {
      return;
    }

    await writeDebugLog(`native-event type=${type} region=${regionId} value=${parsedIntensity}`);
    const savedState = await mutateRegion(regionId, (region) => ({
      ...region,
      glowIntensity: clampNumber(parsedIntensity, 1, 30, region.glowIntensity || 10)
    }));
    await syncRegionMirrorWindows(savedState);
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
  await syncNativeAlertTimerHotkeys(resolvedState);
  ensureNativeHostEventMonitor();
  if (alertTimerListeningActive) {
    const sourceGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";
    const sourceState = await getMirrorSourceGameState(sourceGame, { forceFresh: true }).catch(() => null);
    await syncAlertTimerTibiaVisibilityGate(null, { sourceGame, sourceState });
  } else {
    alertTimerSignalsAllowedByTibia = true;
  }
  ensureTibiaWindowMonitor();
  await syncAlertTimerRuntimeState(resolvedState).catch(() => {});

  return resolvedState;
}

async function syncNativeAlertTimerHotkeys(overlayToolsState) {
  const uniqueBindings = new Map();

  if (alertTimerListeningActive && Array.isArray(overlayToolsState?.timers?.items)) {
    for (const timer of overlayToolsState.timers.items) {
      const keyCode = clampInteger(timer?.hotkeyKeyCode, 0, 255, 0);
      const modifiers = clampInteger(timer?.hotkeyModifiers, 0, 15, 0);
      if (keyCode <= 0 || !isAlertTimerSignalEnabled(timer, overlayToolsState)) {
        continue;
      }
      uniqueBindings.set(`${keyCode}:${modifiers}`, { keyCode, modifiers });
    }
  }

  const bindings = [...uniqueBindings.values()];
  const nativeHostRunning = Boolean(
    nativeHostProcess && nativeHostProcess.exitCode === null && nativeHostProcess.killed !== true
  );
  if (bindings.length === 0 && !nativeHostRunning) {
    return;
  }

  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "setAlertHotkeys",
    bindings
  });
  if (!response?.ok) {
    throw new Error(response?.error || "native-alert-hotkeys-failed");
  }
  await writeDebugLog(`native-alert-hotkeys-synced count=${bindings.length}`);
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

async function resolveAlertTimerHotkeySourceGate() {
  const sourceGame = multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia";
  // The native host has already registered a global shortcut.  Do not make a
  // foreground probe from its callback: a hotkey must work while Tibia,
  // RubinOT or Medivia is open but not focused. `alertTimerSignalsAllowedByTibia`
  // now represents only the selected game's live/valid window state.
  if (alertTimerSignalsAllowedByTibia) {
    return { allowed: true, allowRubinotConnection: sourceGame === "rubinot", reason: "source-game-connected" };
  }

  return { allowed: false, allowRubinotConnection: false, reason: "source-game-not-connected" };
}

function isForegroundProcessForMirrorSourceGame(processName, sourceGame) {
  const normalizedProcessName = String(processName || "").trim().toLowerCase();
  const game = normalizeMirrorSourceGame(sourceGame);

  if (game === "rubinot") {
    return normalizedProcessName === "rubinot_dx"
      || normalizedProcessName === "rubinot_dx.exe"
      || normalizedProcessName === "rubinot"
      || normalizedProcessName === "rubinot.exe";
  }

  return false;
}

function shouldEmitAlertTimerHotkey(keyCode, modifiers, overlayToolsState, options = {}) {
  if (!alertTimerSignalsAllowedByTibia && options.allowRubinotConnection !== true) {
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

function isWallClockFoodTimer(timer) {
  return timer?.timerKind === "food" && timer?.clockMode === "wall-clock";
}

async function persistAlertTimerDeadline(timerId, endsAtMs) {
  const normalizedTimerId = String(timerId || "").trim();
  if (!normalizedTimerId) {
    return null;
  }

  return enqueueOverlayToolsMutation(async () => {
    const overlayToolsState = await readOverlayToolsState();
    let found = false;
    overlayToolsState.timers.items = overlayToolsState.timers.items.map((entry) => {
      if (entry?.id !== normalizedTimerId) {
        return entry;
      }
      found = true;
      return normalizeOverlayTimerEntry({
        ...entry,
        persistentEndsAtMs: Number.isFinite(Number(endsAtMs)) && Number(endsAtMs) > 0
          ? Math.round(Number(endsAtMs))
          : null
      });
    }).filter(Boolean);
    if (!found) {
      return overlayToolsState;
    }
    return writeOverlayToolsState(overlayToolsState, {
      reason: "food-timer-deadline-updated",
      skipSyncHotkeys: true
    });
  });
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

async function syncAlertTimerTibiaVisibilityGate(_overlayVisible, options = {}) {
  const sourceGame = normalizeMirrorSourceGame(options.sourceGame || (multiClientMirrorEnabled ? activeMirrorSourceGame : "tibia"));
  const sourceState = options.sourceState || await getMirrorSourceGameState(sourceGame, { forceFresh: false }).catch(() => null);
  // Alert timers and global hotkeys are allowed for every selected client as
  // long as its game window is open, visible and not minimized.  They are not
  // tied to foreground focus: focus is solely a presentation rule for native
  // overlays, mirrors and the grid.
  //
  // RubinOT's protected window can occasionally omit metadata on a fresh
  // probe. Its previously verified live Mirror connection is the safe
  // equivalent of a valid window here; it never authorizes an unselected or
  // unknown process.
  const nextAllowed = sourceGame === "rubinot"
    ? mirrorGameAvailability.rubinot === true || canUseTibiaWindowForScreenVision(sourceState)
    : canUseTibiaWindowForScreenVision(sourceState);

  if (alertTimerSignalsAllowedByTibia === nextAllowed) {
    return;
  }

  alertTimerSignalsAllowedByTibia = nextAllowed;

  if (!nextAllowed) {
    const overlayToolsState = await readOverlayToolsState();
    for (const [timerId] of alertTimerRuntimeById.entries()) {
      const timer = Array.isArray(overlayToolsState?.timers?.items)
        ? overlayToolsState.timers.items.find((entry) => entry?.id === timerId) || null
        : null;

      // Food timers use a wall-clock deadline and must keep counting in the
      // background. Other alert runtimes are paused without changing or
      // persisting the user's Alertas settings.
      if (!isWallClockFoodTimer(timer)) {
        pauseAlertTimerRuntimeInternal(timerId);
      }
      await hideTimerVisualAlertWindow({ timerId }).catch(() => false);
    }
  } else {
    for (const [timerId] of alertTimerRuntimeById.entries()) {
      resumeAlertTimerRuntimeInternal(timerId);
    }
  }

  await emitAlertTimerRuntimeChanged("tibia-visibility-gate-changed");
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

  if (options.preservePersistentDeadline !== true) {
    await persistAlertTimerDeadline(normalizedTimerId, null).catch(() => null);
  }

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
  const resolveSoundAsset = (relativePath) => {
    const normalized = String(relativePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
    const contentPackPath = resolveRuntimeFilePath(normalized);
    if (contentPackPath && fsSync.existsSync(contentPackPath)) {
      return contentPackPath;
    }

    // The three essential alerts are also shipped inside the installer. This
    // path is deliberately independent of Content Pack download/cache state.
    const bundledPath = path.resolve(projectRoot, normalized);
    const bundledRoot = path.resolve(projectRoot, "assets");
    if (
      bundledPath.startsWith(`${bundledRoot}${path.sep}`)
      && fsSync.existsSync(bundledPath)
    ) {
      return bundledPath;
    }
    return "";
  };
  const bundled = {
    "default": resolveSoundAsset("assets/screen-vision/reference/sounds/spells/utura gran.ogg"),
    "utura-gran": resolveSoundAsset("assets/screen-vision/reference/sounds/spells/utura gran.ogg"),
    "exura-gran-ico": resolveSoundAsset("assets/screen-vision/reference/sounds/spells/exura gran ico.ogg"),
    "utito-tempo": resolveSoundAsset("assets/screen-vision/reference/sounds/spells/utito tempo.ogg")
  };

  if (typeof timer?.customSoundPath === "string" && timer.customSoundPath.trim()) {
    try {
      const customSoundPath = path.resolve(timer.customSoundPath.trim());
      if (fsSync.existsSync(customSoundPath)) {
        return customSoundPath;
      }
    } catch {
    }
  }

  if (soundKey === "none") {
    return "";
  }

  if (screenVisionSpellSoundMap.has(soundKey)) {
    const mappedSoundPath = resolveSoundAsset(screenVisionSpellSoundMap.get(soundKey) || "");
    if (mappedSoundPath) {
      return mappedSoundPath;
    }
  }

  if (bundled[soundKey] && fsSync.existsSync(bundled[soundKey])) {
    return bundled[soundKey];
  }

  // A damaged/old Content Pack or a removed custom file must never turn a
  // finished timer into a silent timer.  The installer carries this small
  // fallback independently from the complete downloadable sound library.
  if (bundled.default && fsSync.existsSync(bundled.default)) {
    return bundled.default;
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

  await window.loadFile(path.join(__dirname, "alert-audio-runtime.html"));
  window.webContents.setAudioMuted(false);
  alertAudioRuntimeWindow = window;
  return window;
}

async function playAlertTimerSoundInElectron(file, volume) {
  const window = await ensureAlertAudioRuntimeWindow();
  const entry = {
    file: pathToFileURL(file).href,
    volume,
    maxDurationMs: 8_000
  };
  return window.webContents.executeJavaScript(
    `window.__alertAudioRuntime.enqueue(${JSON.stringify(entry)})`,
    true
  );
}

async function playAlertTimerSoundInNativeHost(file, volume) {
  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "playAlertSound",
    filePath: file,
    volume
  });

  if (!response?.ok) {
    throw new Error(response?.error || "native-alert-audio-failed");
  }

  return response;
}

function isOggOpusAudioFile(file) {
  let descriptor = null;
  try {
    descriptor = fsSync.openSync(file, "r");
    const header = Buffer.alloc(64);
    const bytesRead = fsSync.readSync(descriptor, header, 0, header.length, 0);
    return header.subarray(0, bytesRead).includes(Buffer.from("OpusHead", "ascii"));
  } catch {
    return false;
  } finally {
    if (descriptor !== null) {
      try {
        fsSync.closeSync(descriptor);
      } catch {
      }
    }
  }
}

async function playAlertTimerSound(timer, overlayToolsState = null, options = {}) {
  const state = overlayToolsState || await readOverlayToolsState();

  if (options.force !== true && (!state?.timers?.isListening || timer?.enabled === false)) {
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
  const timerId = timer?.id || "unknown";

  // The bundled spell sounds are Opus streams inside an OGG container.
  // NAudio.Vorbis cannot decode those streams and Windows Media Foundation
  // support varies by machine. Chromium ships its own Opus decoder, making
  // this path self-contained on every supported Windows installation.
  if (isOggOpusAudioFile(file)) {
    const electronOpusPlayback = await playAlertTimerSoundInElectron(file, volume).catch(async (error) => {
      await writeDebugLog(`alert-timer-audio-electron-opus-error timer=${timerId} message=${error?.message || String(error)}`);
      return null;
    });

    if (electronOpusPlayback?.ok) {
      await writeDebugLog(`alert-timer-audio-started timer=${timerId} file=${file} volume=${volume.toFixed(3)} mode=electron-opus`);
      return true;
    }
  }

  const nativePlayback = await playAlertTimerSoundInNativeHost(file, volume).catch(async (error) => {
    await writeDebugLog(`alert-timer-audio-native-error timer=${timerId} message=${error?.message || String(error)}`);
    return null;
  });

  if (nativePlayback?.ok) {
    await writeDebugLog(`alert-timer-audio-started timer=${timerId} file=${file} volume=${volume.toFixed(3)} mode=native-toolkit`);
    return true;
  }

  const electronPlayback = await playAlertTimerSoundInElectron(file, volume).catch(async (error) => {
    await writeDebugLog(`alert-timer-audio-electron-error timer=${timerId} message=${error?.message || String(error)}`);
    return null;
  });

  if (electronPlayback?.ok) {
    await writeDebugLog(`alert-timer-audio-started timer=${timerId} file=${file} volume=${volume.toFixed(3)} mode=electron-fallback`);
    return true;
  }

  await writeDebugLog(`alert-timer-audio-failed timer=${timerId} file=${file}`);
  return false;
}

async function dispatchAlertTimerSignal(timer, overlayToolsState, options = {}) {
  if (!alertTimerSignalsAllowedByTibia && !isWallClockFoodTimer(timer)) {
    return {
      played: false,
      message: `Timer "${timer?.name || "Sem nome"}" pausado porque o ${getMirrorSourceGameDisplayName()} nao esta visivel.`,
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
    }).then(async () => {
      await writeDebugLog(
        `alert-timer-visual-started timer=${timer.id} messageLength=${String(timer.message || timer.name || "Timer pronto").trim().length}`
      ).catch(() => {});
    }).catch(async (error) => {
      await writeDebugLog(
        `alert-timer-visual-error timer=${timer.id} error=${error?.message || String(error)}`
      ).catch(() => {});
    });
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
    if (!alertTimerSignalsAllowedByTibia && !isWallClockFoodTimer(timer)) {
      stopAlertTimerRuntimeInternal(normalizedTimerId);
      await emitAlertTimerRuntimeChanged("timer-expired-while-tibia-hidden", {
        timerId: normalizedTimerId,
        message: `Timer "${timer.name || "Sem nome"}" expirou fora do ${getMirrorSourceGameDisplayName()} e foi descartado.`,
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
      if (isWallClockFoodTimer(timer)) {
        await persistAlertTimerDeadline(normalizedTimerId, null).catch(() => null);
      }
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
      message: `Lembrete de "${timer.name || "Sem nome"}" venceu fora do ${getMirrorSourceGameDisplayName()} e foi descartado.`,
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
  const restoredEndsAtMs = Number(options.restoreEndsAtMs);
  const endsAt = Number.isFinite(restoredEndsAtMs) && restoredEndsAtMs > now
    ? Math.round(restoredEndsAtMs)
    : now + Math.max(1000, clampInteger(timer.durationSeconds, 1, 86400, 60) * 1000);
  const durationMs = Math.max(1, endsAt - now);
  const runtime = {
    timerId: timer.id,
    phase: "running",
    startedAt: now,
    endsAt,
    clockMode: isWallClockFoodTimer(timer) ? "wall-clock" : "runtime",
    reminderDelayMs: resolveAlertReminderDelayMs(timer),
    reminderRepeatCount: resolveAlertReminderRepeatCount(timer),
    remindersSent: 0,
    timeout: setTimeout(() => {
      void completeAlertTimerRuntime(timer.id);
    }, durationMs)
  };

  alertTimerRuntimeById.set(timer.id, runtime);
  ensureAlertTimerSnapshotTicker();

  if (isWallClockFoodTimer(timer) && options.skipPersistDeadline !== true) {
    await persistAlertTimerDeadline(timer.id, endsAt).catch(() => null);
  }

  if (options.skipEmit !== true) {
    await emitAlertTimerRuntimeChanged("timer-started", {
      timerId: timer.id,
    message: options.source === "hotkey"
      ? `Hotkey detectada: "${timer.name || "Sem nome"}" iniciada.`
      : `Timer "${timer.name || "Sem nome"}" iniciado.`,
      tone: "info"
    });
  }

  return {
    ok: true,
    started: true,
    snapshot: buildAlertTimerRuntimeSnapshot()
  };
}

async function startAlertTimerById(timerId, options = {}) {
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

  if (!alertTimerSignalsAllowedByTibia && !isWallClockFoodTimer(timer)) {
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

async function handleAlertTimerHotkey(keyCode, modifiers, overlayToolsState = null, options = {}) {
  if (!alertTimerSignalsAllowedByTibia && options.allowRubinotConnection !== true) {
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

  const now = Date.now();
  let clearedExpiredDeadline = false;
  state.timers.items = state.timers.items.map((timer) => {
    if (!isWallClockFoodTimer(timer) || !timer.persistentEndsAtMs) {
      return timer;
    }
    if (timer.persistentEndsAtMs <= now) {
      clearedExpiredDeadline = true;
      return normalizeOverlayTimerEntry({ ...timer, persistentEndsAtMs: null });
    }
    if (!alertTimerRuntimeById.has(timer.id)) {
      void startAlertTimerRuntime(timer, state, {
        source: "restore",
        restoreEndsAtMs: timer.persistentEndsAtMs,
        skipPersistDeadline: true,
        skipEmit: true
      });
      changed = true;
    }
    return timer;
  });

  if (!listening && !visualsEnabled) {
    for (const [timerId] of [...alertTimerRuntimeById.entries()]) {
      const timer = state.timers.items.find((entry) => entry?.id === timerId) || null;
      if (!isWallClockFoodTimer(timer)) {
        stopAlertTimerRuntimeInternal(timerId);
        changed = true;
      }
    }
  } else {
    for (const timerId of [...alertTimerRuntimeById.keys()]) {
      const timer = Array.isArray(state?.timers?.items)
        ? state.timers.items.find((entry) => String(entry?.id || "").trim() === timerId) || null
        : null;
      if (!validIds.has(timerId) || (!isWallClockFoodTimer(timer) && !isAlertTimerSignalEnabled(timer, state))) {
        stopAlertTimerRuntimeInternal(timerId);
        changed = true;
      }
    }
  }

  if (clearedExpiredDeadline) {
    await writeOverlayToolsState(state, {
      reason: "expired-food-deadlines-cleared",
      skipSyncHotkeys: true
    });
  }

  if (changed) {
    await emitAlertTimerRuntimeChanged("runtime-synced");
  }
}

function isAlertTimerSignalEnabled(timer, overlayToolsState) {
  if (!timer) {
    return false;
  }

  if (isWallClockFoodTimer(timer)) {
    return true;
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
  const minimizeIdleUrl = readDialogAssetDataUrl(path.join("assets", "ui", "desktop-controls", "desktop-minimize-idle.png"));
  const minimizeActiveUrl = readDialogAssetDataUrl(path.join("assets", "ui", "desktop-controls", "desktop-minimize-active.png"));
  const closeIdleUrl = readDialogAssetDataUrl(path.join("assets", "ui", "desktop-controls", "desktop-close-idle.png"));
  const closeActiveUrl = readDialogAssetDataUrl(path.join("assets", "ui", "desktop-controls", "desktop-close-active.png"));
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
    const runtimeAssetPath = resolveRuntimeFilePath(relativePath);
    // The UI chrome is bundled with the app. Fall back to it if a downloaded
    // content pack does not include these confirmation-dialog assets yet.
    const packagedAssetPath = path.resolve(projectRoot, String(relativePath || ""));
    const assetPath = [runtimeAssetPath, packagedAssetPath]
      .find((candidate) => candidate && fsSync.existsSync(candidate));
    if (!assetPath) {
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
  const updateLayout = options.updateLayout === true;
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
            overflow: ${updateLayout ? "hidden" : "visible"};
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          }
          body {
            display: grid;
            place-items: center;
            padding: 28px;
            -webkit-app-region: drag;
          }
          body.update-layout {
            padding: 12px 16px;
            overflow: hidden;
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
          .dialog-card.update-dialog {
            max-width: none;
            height: 100%;
            max-height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            padding: 16px 28px 14px;
          }
          .dialog-card.update-dialog .dialog-warning-media {
            flex: 0 0 auto;
            margin-bottom: 8px;
          }
          .dialog-card.update-dialog .dialog-message {
            flex: 1 1 auto;
            min-height: 0;
            margin-bottom: 12px;
            overflow-y: auto;
            overscroll-behavior: contain;
            padding: 2px 12px 2px 2px;
            scrollbar-gutter: stable;
            -webkit-app-region: no-drag;
            pointer-events: auto;
            touch-action: pan-y;
            cursor: auto;
          }
          .dialog-card.update-dialog .dialog-message::-webkit-scrollbar {
            width: 10px;
          }
          .dialog-card.update-dialog .dialog-message::-webkit-scrollbar-track {
            background: rgba(10, 14, 20, 0.56);
            border-radius: 6px;
          }
          .dialog-card.update-dialog .dialog-message::-webkit-scrollbar-thumb {
            background: rgba(196, 205, 218, 0.68);
            border: 2px solid rgba(10, 14, 20, 0.48);
            border-radius: 6px;
          }
          .dialog-card.update-dialog .dialog-actions {
            flex: 0 0 auto;
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
      <body${updateLayout ? ' class="update-layout"' : ""}>
        <div class="dialog-card${updateLayout ? " update-dialog" : ""}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
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
    nativeCursorMagnifierEnabled = false;
    lastNativeMirrorsVisible = null;
    lastNativeObsMirrorsVisible = null;
    lastNativeVisualOverlayVisible = null;
    lastNativeVisualOverlayPriority = null;
    nativeMirrorsAlwaysOnTop = null;
    nativeObsMirrorsAlwaysOnTop = null;
    nativeObsMirrorCommandSupported = null;
    nativeObsTopmostCommandSupported = null;
    nativeObsVisibilityCommandSupported = null;
    return;
  }

  try {
    nativeHostProcess.kill();
  } catch (_error) {
  }

  nativeHostProcess = null;
  nativeCursorMagnifierEnabled = false;
  lastNativeMirrorsVisible = null;
  lastNativeObsMirrorsVisible = null;
  lastNativeVisualOverlayVisible = null;
  lastNativeVisualOverlayPriority = null;
  nativeMirrorsAlwaysOnTop = null;
  nativeObsMirrorsAlwaysOnTop = null;
  nativeObsMirrorCommandSupported = null;
  nativeObsTopmostCommandSupported = null;
  nativeObsVisibilityCommandSupported = null;
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

async function shouldShowScreenVisionOverlays(tibiaState, options = {}) {
  if (screenVisionNativeHostUnavailable) {
    return false;
  }
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

  const sourceGame = normalizeMirrorSourceGame(options.sourceGame || tibiaState?.sourceGame || "tibia");
  return await isTibiaDirectlyBehindControllerWindows(sourceGame).catch(async (error) => {
    screenVisionNativeHostUnavailable = true;
    await writeDebugLog(`screen-vision-tibia-behind-controller-error ${error?.message || String(error)} retry=next-session`);
    return false;
  });
}

async function shouldShowTibiaMirrorSurface(tibiaState, options = {}) {
  if (await shouldShowScreenVisionOverlays(tibiaState, options)) {
    return true;
  }

  if (!canUseTibiaWindowForScreenVision(tibiaState)) {
    return false;
  }

  const foregroundContext = await getNativeForegroundContext();
  const mirrorInteractionActive = Boolean(foregroundContext?.mirrorInteractionActive);
  const toolkitFocused = Boolean(foregroundContext?.toolkitFocused);
  const controllerFocused = controllerWindowFocusState || await isAnyControllerWindowFocused().catch(() => false);

  return mirrorInteractionActive || toolkitFocused || controllerFocused;
}

function canUseTibiaWindowForScreenVision(tibiaState) {
  return Boolean(
    tibiaState
    && tibiaState.title
    && tibiaState.isVisible
    && !tibiaState.isMinimized
  );
}

function buildGridOverlayTibiaSignature(tibiaState, visible = false, sourceGame = "tibia") {
  const clientBounds = tibiaState?.clientBounds || {};
  const bounds = tibiaState?.bounds || {};

  return JSON.stringify({
    sourceGame: normalizeMirrorSourceGame(sourceGame),
    hwnd: Number(tibiaState?.hwnd || 0),
    visible: Boolean(visible),
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

  const needsNativeFocusProbe = Boolean(
    nativeHostProcess && nativeHostProcess.exitCode === null && nativeHostProcess.killed !== true
  );

  if (controllerHwnds.length && needsNativeFocusProbe) {
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

  if (desktopScreenshotAssistantWindow && !desktopScreenshotAssistantWindow.isDestroyed() && desktopScreenshotAssistantWindow.isFocused()) {
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
  collect(desktopScreenshotAssistantWindow);

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

async function isTibiaDirectlyBehindControllerWindows(sourceGame = "tibia") {
  // A portable build can be blocked by Windows Application Control before the
  // optional Native Host is allowed to start. Do not rethrow the same spawn
  // error on every 5-second window poll; the screenshot workflow remains
  // independent and the native features can retry after a new app session.
  if (isPortableTestRuntime && portableNativeHostLaunchError) {
    return false;
  }
  const controllerHwnds = getControllerWindowHandleStrings();
  const allowedProcessIds = getScreenVisionAllowedProcessIds();

  if (!controllerHwnds.length) {
    return false;
  }

  await ensureNativeHostStarted();
  const response = await callNativeHost({
    command: "isTibiaBehindControllers",
    sourceGame: normalizeMirrorSourceGame(sourceGame),
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
  const secureStore = isPortableTestRuntime ? await readPortableSecureStore() : {};
  if (key === null || typeof key === "undefined") {
    const [store, cacheStore, overlayToolsStore] = await Promise.all([
      readStore(),
      readRuntimeCacheStore(),
      readOverlayToolsStore()
    ]);
    const mergedStore = {
      ...store,
      ...cacheStore,
      ...secureStore
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
      isPortableTestRuntime && portableProtectedStorageKeys.has(entry)
        ? secureStore[entry]
        : entry === OVERLAY_TOOLS_STORAGE_KEY
          ? overlayToolsStore[OVERLAY_TOOLS_STORAGE_KEY]
          : store[entry] ?? cacheStore[entry]
    ]));
  }

  if (typeof key === "string") {
    if (isPortableTestRuntime && portableProtectedStorageKeys.has(key)) {
      return { [key]: secureStore[key] };
    }
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
        isPortableTestRuntime && portableProtectedStorageKeys.has(entryKey)
          ? secureStore[entryKey] ?? fallback
          : entryKey === OVERLAY_TOOLS_STORAGE_KEY
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

async function readSavedAccountAccessToken() {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return "";
    }

    const stored = await readStorageValue(accountAccessTokenStorageKey);
    const encryptedValue = String(stored?.[accountAccessTokenStorageKey] || "").trim();
    return encryptedValue ? safeStorage.decryptString(Buffer.from(encryptedValue, "base64")) : "";
  } catch (error) {
    await writeDebugLog(`account-token-read-failed ${error?.message || String(error)}`);
    return "";
  }
}

async function saveAccountAccessToken(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken || !safeStorage.isEncryptionAvailable()) {
    throw new Error("O armazenamento seguro do sistema não está disponível.");
  }

  const encryptedValue = safeStorage.encryptString(normalizedToken).toString("base64");
  await writeStorageValue({ [accountAccessTokenStorageKey]: encryptedValue });
}

async function clearSavedAccountAccessToken() {
  await removeStorageValue([accountAccessTokenStorageKey, accountStateSnapshotStorageKey]);
}

function normalizeCachedAccountState(value) {
  if (!value || typeof value !== "object" || value.connected !== true) return null;
  const benefits = Array.isArray(value.benefits)
    ? value.benefits
      .filter((benefit) => benefit && typeof benefit === "object" && typeof benefit.key === "string")
      .map((benefit) => ({ key: String(benefit.key), startsAt: benefit.startsAt || null, endsAt: benefit.endsAt || null }))
    : [];
  const activeBenefitKeys = new Set(benefits.filter((benefit) => {
    if (!benefit.endsAt) return true;
    const endsAt = new Date(benefit.endsAt).getTime();
    return Number.isFinite(endsAt) && endsAt > Date.now();
  }).map((benefit) => benefit.key));
  const entitlements = (Array.isArray(value.entitlements) ? value.entitlements : [])
    .map((entry) => String(entry || "").trim())
    .filter((entry) => entry && (entry !== "ads.remove" || activeBenefitKeys.has("ads.remove")));
  return {
    connected: true,
    entitlements,
    benefits,
    user: value.user && typeof value.user === "object" ? {
      name: String(value.user.name || ""),
      email: String(value.user.email || ""),
      emailVerified: Boolean(value.user.emailVerified)
    } : null,
    profile: value.profile && typeof value.profile === "object" ? {
      displayName: String(value.profile.displayName || ""),
      characterName: String(value.profile.characterName || "")
    } : null,
    summary: value.summary && typeof value.summary === "object" ? {
      openReports: Number(value.summary.openReports) || 0,
      unreadMessages: Number(value.summary.unreadMessages) || 0
    } : { openReports: 0, unreadMessages: 0 }
  };
}

async function readSavedAccountStateSnapshot() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const stored = await readStorageValue(accountStateSnapshotStorageKey);
    const encryptedValue = String(stored?.[accountStateSnapshotStorageKey] || "").trim();
    if (!encryptedValue) return null;
    return normalizeCachedAccountState(JSON.parse(safeStorage.decryptString(Buffer.from(encryptedValue, "base64"))));
  } catch (error) {
    await writeDebugLog(`account-state-snapshot-read-failed ${error?.message || String(error)}`);
    return null;
  }
}

async function saveAccountStateSnapshot(value) {
  const normalized = normalizeCachedAccountState(value);
  if (!normalized || !safeStorage.isEncryptionAvailable()) return;
  const encryptedValue = safeStorage.encryptString(JSON.stringify(normalized)).toString("base64");
  await writeStorageValue({ [accountStateSnapshotStorageKey]: encryptedValue });
}

async function getAccountInstallationId() {
  const stored = await readStorageValue(accountInstallationIdStorageKey);
  const existing = String(stored?.[accountInstallationIdStorageKey] || "").trim();
  if (existing) return existing;
  const installationId = crypto.randomUUID();
  await writeStorageValue({ [accountInstallationIdStorageKey]: installationId });
  return installationId;
}

async function requestManualStashMarketRefresh({ consume = false } = {}) {
  const installationId = await getAccountInstallationId();
  let token = await readSavedAccountAccessToken();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const query = consume ? "" : `?installationId=${encodeURIComponent(installationId)}`;
    const response = await electronNet.fetch(
      `${accountAuthBaseUrl}/api/product/market/manual-refresh${query}`,
      {
        method: consume ? "POST" : "GET",
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(consume ? { "content-type": "application/json" } : {})
        },
        ...(consume ? { body: JSON.stringify({ installationId }) } : {}),
        cache: "no-store"
      }
    );
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401 && token && attempt === 0) {
      await clearSavedAccountAccessToken();
      token = "";
      continue;
    }

    if (response.status === 429) {
      return payload;
    }

    if (!response.ok) {
      const error = new Error(String(payload?.error || "Não foi possível confirmar o limite manual do market."));
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  throw new Error("Não foi possível confirmar o limite manual do market.");
}

async function registerAccountInstallation(token) {
  const installationId = await getAccountInstallationId();
  const response = await electronNet.fetch(`${accountAuthBaseUrl}/api/product/account/devices`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      installationId,
      clientId: accountDesktopClientId,
      label: `${app.getName()} neste computador`,
      platform: process.platform,
      appVersion: app.getVersion()
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`device-registration-${response.status}`);
}

async function disconnectAccount() {
  const token = await readSavedAccountAccessToken();
  // Commit the local logout before waiting for the remote device revocation.
  // This lets the free-account ad state update immediately and also prevents a
  // slow auth request from leaving a usable local session behind.
  await clearSavedAccountAccessToken();
  const remoteRevocation = (async () => {
    if (!token) return;
    try {
      const installationId = await getAccountInstallationId();
      await electronNet.fetch(`${accountAuthBaseUrl}/api/product/account/devices`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ installationId }),
        cache: "no-store"
      });
    } catch (error) {
      await writeDebugLog(`account-disconnect:remote-revoke-failed ${error?.message || String(error)}`);
    }
  })();
  return { remoteRevocation };
}

async function getAccountState() {
  const token = await readSavedAccountAccessToken();
  if (!token) {
    return { connected: false, entitlements: [] };
  }

  const cachedState = await readSavedAccountStateSnapshot();

  try {
    const response = await electronNet.fetch(`${accountAuthBaseUrl}/api/product/me`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (!response.ok) {
      // A restart during an auth-service outage must not silently log the
      // person out forever. Only an explicit authentication failure revokes
      // the encrypted local device token; 5xx and transient transport
      // failures can be retried on the next refresh.
      if (response.status === 401 || response.status === 403) {
        await clearSavedAccountAccessToken();
        return { connected: false, entitlements: [] };
      }
      return cachedState ? { ...cachedState, offline: true } : { connected: false, entitlements: [], offline: true };
    }
    const payload = await response.json();
    if (payload?.authenticated !== true) {
      await clearSavedAccountAccessToken();
      return { connected: false, entitlements: [] };
    }
    const avatarAssetId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(payload?.profile?.avatarAssetId || ""))
      ? String(payload.profile.avatarAssetId)
      : "";
    const avatarPublicUrl = avatarAssetId
      ? new URL(`/api/product/avatar/public?id=${encodeURIComponent(avatarAssetId)}`, accountAuthBaseUrl).href
      : "";
    let avatarUrl = avatarPublicUrl;
    if (avatarPublicUrl) {
      try {
        const avatarResponse = await electronNet.fetch(avatarPublicUrl, { cache: "no-store" });
        const contentType = String(avatarResponse.headers.get("content-type") || "").toLowerCase();
        const bytes = avatarResponse.ok && contentType.startsWith("image/") ? Buffer.from(await avatarResponse.arrayBuffer()) : null;
        // Keep this small and local: the renderer can then measure alpha pixels
        // without a cross-origin canvas restriction.
        if (bytes && bytes.length > 0 && bytes.length <= 2 * 1024 * 1024) avatarUrl = `data:${contentType.split(";")[0]};base64,${bytes.toString("base64")}`;
      } catch {
        // The public URL remains a safe fallback while the account service is offline.
      }
    }
    const accountState = {
      connected: true,
      entitlements: Array.isArray(payload?.entitlements) ? payload.entitlements : [],
      benefits: Array.isArray(payload?.benefits) ? payload.benefits
        .filter((benefit) => benefit && typeof benefit === "object" && typeof benefit.key === "string")
        .map((benefit) => ({ key: String(benefit.key), startsAt: benefit.startsAt || null, endsAt: benefit.endsAt || null })) : [],
      user: payload?.user && typeof payload.user === "object" ? {
        name: String(payload.user.name || ""),
        email: String(payload.user.email || ""),
        emailVerified: Boolean(payload.user.emailVerified)
      } : null,
      profile: payload?.profile && typeof payload.profile === "object" ? {
        displayName: String(payload.profile.displayName || ""),
        characterName: String(payload.profile.characterName || ""),
        avatarMode: payload.profile.avatarMode === "sprite" ? "sprite" : "default",
        avatarAssetId,
        // The account service owns the avatar render. Returning its public
        // image URL keeps the desktop view faithful to the outfit, addons and
        // colours selected on the site without bundling a second renderer.
        avatarUrl
      } : null,
      summary: payload?.summary && typeof payload.summary === "object" ? {
        openReports: Number(payload.summary.openReports) || 0,
        unreadMessages: Number(payload.summary.unreadMessages) || 0
      } : { openReports: 0, unreadMessages: 0 }
    };
    await saveAccountStateSnapshot(accountState);
    return accountState;
  } catch {
    return cachedState ? { ...cachedState, offline: true } : { connected: false, entitlements: [], offline: true };
  }
}

async function submitAccountFeedback(payload = {}) {
  const token = await readSavedAccountAccessToken();
  if (!token) {
    throw new Error("Entre na sua conta antes de enviar um report.");
  }
  const kind = ["suggestion", "bug", "correction"].includes(payload?.kind) ? payload.kind : "suggestion";
  const title = String(payload?.title || "").trim();
  const body = String(payload?.body || "").trim();
  if (title.length < 4 || title.length > 160 || body.length < 10 || body.length > 10_000) {
    throw new Error("Informe um título e detalhes suficientes para o report.");
  }
  const response = await electronNet.fetch(`${accountAuthBaseUrl}/api/product/feedback`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      kind,
      title,
      body,
      surface: "app",
      locale: String(payload?.locale || "pt-BR"),
      clientVersion: app.getVersion(),
      pageLabel: String(payload?.pageLabel || "Tibia Toolkit app").slice(0, 160)
    }),
    cache: "no-store"
  });
  if (!response.ok) {
    if (response.status === 401) await clearSavedAccountAccessToken();
    throw new Error("Não foi possível enviar o report agora.");
  }
  return response.json();
}

async function getAccountCampaignCatalog() {
  const socialDefaults = {
    discord: "https://discord.gg/2AFRsc2jmp",
    youtube: "https://www.youtube.com/@poioso?sub_confirmation=1"
  };
  try {
    const response = await electronNet.fetch(`${accountAuthBaseUrl}/api/product/catalog`, { cache: "no-store" });
    if (!response.ok) return { ads: [], support: [], socialLinks: socialDefaults };
    const payload = await response.json();
    const validSocialUrl = (value, fallback, allowedHosts) => {
      try {
        const parsed = new URL(String(value || ""));
        return parsed.protocol === "https:" && allowedHosts.includes(parsed.hostname.toLowerCase())
          ? parsed.toString()
          : fallback;
      } catch {
        return fallback;
      }
    };
    return {
      ads: Array.isArray(payload?.ads) ? payload.ads : [],
      support: Array.isArray(payload?.support) ? payload.support : [],
      socialLinks: {
        discord: validSocialUrl(payload?.socialLinks?.discord, socialDefaults.discord, ["discord.gg", "discord.com"]),
        youtube: validSocialUrl(payload?.socialLinks?.youtube, socialDefaults.youtube, ["youtube.com", "www.youtube.com", "youtu.be"])
      }
    };
  } catch {
    return { ads: [], support: [], socialLinks: socialDefaults };
  }
}

function waitFor(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function connectAccountWithDeviceAuthorization() {
  await writeDebugLog("account-connect:start");
  const codeResponse = await electronNet.fetch(`${accountAuthBaseUrl}/api/auth/device/code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: accountDesktopClientId }),
    cache: "no-store"
  });
  if (!codeResponse.ok) {
    await writeDebugLog(`account-connect:device-code-failed status=${codeResponse.status}`);
    throw new Error("Não foi possível iniciar a conexão da conta.");
  }

  const device = await codeResponse.json();
  const verificationUrl = String(device?.verification_uri_complete || "");
  const deviceCode = String(device?.device_code || "");
  const intervalMs = Math.max(2000, Number(device?.interval || 5) * 1000);
  const expiresAt = Date.now() + Math.max(60, Number(device?.expires_in || 600)) * 1000;
  if (!isValidDeviceVerificationUrl(verificationUrl) || !deviceCode) {
    await writeDebugLog("account-connect:device-code-invalid");
    throw new Error("A resposta de autorização recebida não é válida.");
  }

  await shell.openExternal(verificationUrl);
  await writeDebugLog("account-connect:browser-opened");
  while (Date.now() < expiresAt) {
    await waitFor(intervalMs);
    const tokenResponse = await electronNet.fetch(`${accountAuthBaseUrl}/api/auth/device/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        client_id: accountDesktopClientId
      }),
      cache: "no-store"
    });
    const payload = await tokenResponse.json().catch(() => ({}));
    if (tokenResponse.ok && payload?.access_token) {
      await writeDebugLog("account-connect:token-received");
      await saveAccountAccessToken(payload.access_token);
      await writeDebugLog("account-connect:token-stored");
      await registerAccountInstallation(payload.access_token);
      await writeDebugLog("account-connect:device-registered");
      return getAccountState();
    }
    if (payload?.error === "authorization_pending" || payload?.error === "slow_down") {
      continue;
    }
    if (payload?.error === "access_denied") {
      await writeDebugLog("account-connect:access-denied");
      throw new Error("A autorização foi recusada no navegador.");
    }
    if (payload?.error === "expired_token") {
      await writeDebugLog("account-connect:expired-token");
      throw new Error("A autorização expirou. Tente novamente.");
    }
    throw new Error(`Não foi possível concluir a conexão da conta (${String(payload?.error || `HTTP ${tokenResponse.status}`)}).`);
  }

  throw new Error("A autorização expirou. Tente novamente.");
}

function isValidDeviceVerificationUrl(value) {
  try {
    const received = new URL(String(value || ""));
    const accountSite = new URL(accountSiteBaseUrl);
    const siteRoute = received.origin === accountSite.origin
      && received.pathname === "/conta/dispositivo";

    // The browser authorization screen belongs to the account website.  The
    // auth service only exposes its private API, so accepting `/device` from
    // that origin would send a user to a JSON 404 in local development and
    // bypass the account UX in production.
    return siteRoute && Boolean(received.searchParams.get("user_code"));
  } catch {
    return false;
  }
}

async function writeStorageValue(value) {
  const nextValue = value && typeof value === "object" ? { ...value } : {};
  const secureEntries = {};
  if (isPortableTestRuntime) {
    for (const entryKey of portableProtectedStorageKeys) {
      if (Object.prototype.hasOwnProperty.call(nextValue, entryKey)) {
        secureEntries[entryKey] = nextValue[entryKey];
        delete nextValue[entryKey];
      }
    }
  }
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

  if (Object.keys(secureEntries).length) {
    await mergePortableSecureStoreEntries(secureEntries);
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
      ? mergeStoreEntries(primaryEntries)
      : Promise.resolve(),
    Object.keys(cacheEntries).length
      ? mergeRuntimeCacheEntries(cacheEntries)
      : Promise.resolve()
  ]);
}

async function removeStorageValue(key) {
  const keys = Array.isArray(key) ? key : [key];
  const secureKeys = isPortableTestRuntime
    ? keys.filter((entry) => portableProtectedStorageKeys.has(entry))
    : [];
  const primaryKeys = keys.filter((entry) => (
    entry !== OVERLAY_TOOLS_STORAGE_KEY
    && !secureKeys.includes(entry)
  ));

  if (secureKeys.length) {
    await removePortableSecureStoreKeys(secureKeys);
  }

  if (keys.includes(OVERLAY_TOOLS_STORAGE_KEY)) {
    const overlayToolsStore = await readOverlayToolsStore();
    delete overlayToolsStore[OVERLAY_TOOLS_STORAGE_KEY];
    await writeOverlayToolsStore(overlayToolsStore);
  }

  if (!primaryKeys.length) {
    return;
  }

  const store = await readStore();

  primaryKeys.forEach((entry) => {
    delete store[entry];
  });

  await Promise.all([
    writeStore(store),
    mutateRuntimeCacheStore((cacheStore) => {
      primaryKeys.forEach((entry) => delete cacheStore[entry]);
      return cacheStore;
    })
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

  const nextPrimaryStore = Object.fromEntries(
    Object.entries(store).filter(([, entryValue]) => !isRuntimeCacheStorageEntry(entryValue))
  );

  await Promise.all([
    mutateRuntimeCacheStore((currentCacheStore) => ({
      ...legacyCacheEntries,
      ...currentCacheStore
    })),
    writeStore(nextPrimaryStore)
  ]);
}

async function readPortableSecureStore() {
  if (!isPortableTestRuntime || !portableSecureStorePath) return {};
  await portableSecureStoreWriteQueue.catch(() => {});
  try {
    const parsed = JSON.parse(await fs.readFile(portableSecureStorePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error?.code !== "ENOENT") {
      await writeDebugLog(`portable-secure-store-read-failed ${error?.message || String(error)}`);
    }
    return {};
  }
}

function mergePortableSecureStoreEntries(entries) {
  if (!isPortableTestRuntime || !portableSecureStorePath) return Promise.resolve();
  portableSecureStoreWriteQueue = portableSecureStoreWriteQueue
    .catch(() => {})
    .then(async () => {
      const current = await readPortableSecureStoreFile();
      await writePortableSecureStoreFile({ ...current, ...entries });
    });
  return portableSecureStoreWriteQueue;
}

function removePortableSecureStoreKeys(keys) {
  if (!isPortableTestRuntime || !portableSecureStorePath) return Promise.resolve();
  portableSecureStoreWriteQueue = portableSecureStoreWriteQueue
    .catch(() => {})
    .then(async () => {
      const current = await readPortableSecureStoreFile();
      for (const key of keys) delete current[key];
      await writePortableSecureStoreFile(current);
    });
  return portableSecureStoreWriteQueue;
}

async function readPortableSecureStoreFile() {
  try {
    const parsed = JSON.parse(await fs.readFile(portableSecureStorePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

async function writePortableSecureStoreFile(value) {
  await fs.mkdir(path.dirname(portableSecureStorePath), { recursive: true });
  const tempPath = `${portableSecureStorePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rm(portableSecureStorePath, { force: true }).catch(() => {});
  await fs.rename(tempPath, portableSecureStorePath);
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
    .then(() => writeStoreFile(value));

  return storeWriteQueue;
}

function mergeStoreEntries(entries) {
  // Reads must happen inside the same queue as writes. Account connection
  // stores its encrypted token and then its account snapshot immediately;
  // reading before the preceding write completed could previously make the
  // snapshot overwrite the token and force an unnecessary new authorization.
  storeWriteQueue = storeWriteQueue
    .catch(() => {})
    .then(async () => writeStoreFile({
      ...(await readStore()),
      ...entries
    }));

  return storeWriteQueue;
}

async function writeStoreFile(value) {
  await fs.mkdir(path.dirname(overlayStorePath), { recursive: true });
  const tempPath = `${overlayStorePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rm(overlayStorePath, { force: true }).catch(() => {});
  await fs.rename(tempPath, overlayStorePath);
}

async function readRuntimeCacheStore() {
  // A Windows replacement removes the destination for a very short interval.
  // Every reader waits for our own queued writer before touching the file, so
  // that interval cannot be mistaken for an empty/corrupt cache.
  await cacheStoreWriteQueue.catch(() => {});
  return readRuntimeCacheStoreFile();
}

function cloneRuntimeCacheStore(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
}

function getStorageErrorCode(error) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code || "")
    : "";
}

function isTransientRuntimeCacheReadError(error) {
  return ["EACCES", "EBUSY", "EPERM"].includes(getStorageErrorCode(error));
}

async function readRuntimeCacheStoreFile() {
  const retryDelays = [20, 80];

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const raw = await fs.readFile(runtimeCacheStorePath, "utf8");
      const parsed = JSON.parse(raw);
      runtimeCacheStoreSnapshot = cloneRuntimeCacheStore(parsed);
      return cloneRuntimeCacheStore(parsed);
    } catch (error) {
      const code = getStorageErrorCode(error);

      if (code === "ENOENT") {
        // A missing file at first use is expected. If an external process
        // briefly replaced it, retain the last valid in-memory snapshot.
        return cloneRuntimeCacheStore(runtimeCacheStoreSnapshot);
      }

      if (isTransientRuntimeCacheReadError(error) && attempt < retryDelays.length) {
        await waitFor(retryDelays[attempt]);
        continue;
      }

      if (isTransientRuntimeCacheReadError(error)) {
        await writeDebugLog(`runtime-cache-transient-read code=${code || "unknown"}`);
        return cloneRuntimeCacheStore(runtimeCacheStoreSnapshot);
      }

      await backupCorruptedStoreFile(runtimeCacheStorePath, error);
      return cloneRuntimeCacheStore(runtimeCacheStoreSnapshot);
    }
  }

  return cloneRuntimeCacheStore(runtimeCacheStoreSnapshot);
}

function mutateRuntimeCacheStore(mutator) {
  cacheStoreWriteQueue = cacheStoreWriteQueue
    .catch(() => {})
    .then(async () => {
      const currentStore = await readRuntimeCacheStoreFile();
      const nextStore = cloneRuntimeCacheStore(await mutator(cloneRuntimeCacheStore(currentStore)));
      await writeRuntimeCacheStoreFile(nextStore);
      runtimeCacheStoreSnapshot = cloneRuntimeCacheStore(nextStore);
    });

  return cacheStoreWriteQueue;
}

function mergeRuntimeCacheEntries(entries) {
  const safeEntries = cloneRuntimeCacheStore(entries);
  return mutateRuntimeCacheStore((currentStore) => ({
    ...currentStore,
    ...safeEntries
  }));
}

async function writeRuntimeCacheStoreFile(value) {
  await fs.mkdir(path.dirname(runtimeCacheStorePath), { recursive: true });
  const tempPath = `${runtimeCacheStorePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rm(runtimeCacheStorePath, { force: true }).catch(() => {});
  await fs.rename(tempPath, runtimeCacheStorePath);
}

async function writeRuntimeCacheStore(value) {
  return mutateRuntimeCacheStore(() => value);
}

async function ensureRuntimeCacheStoreReady() {
  await fs.mkdir(path.dirname(runtimeCacheStorePath), { recursive: true });

  try {
    await fs.access(runtimeCacheStorePath);
  } catch (_error) {
    await fs.writeFile(runtimeCacheStorePath, "{}", "utf8");
  }
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

async function writePerformanceMetric(name, details = {}) {
  const payload = {
    at: new Date().toISOString(),
    name: String(name || "unknown"),
    channel: runtimeChannel,
    packaged: app.isPackaged,
    details: details && typeof details === "object" ? details : {}
  };
  await appendBoundedJsonl(performanceMetricsPath, payload, 2_000_000).catch(() => {});
}

async function appendBoundedJsonl(filePath, payload, maxBytes = 1_000_000) {
  const line = `${JSON.stringify(payload)}\n`;
  const currentSize = await fs.stat(filePath).then((entry) => entry.size).catch(() => 0);
  if (currentSize + Buffer.byteLength(line) > maxBytes) {
    await fs.writeFile(filePath, line, "utf8");
    return;
  }
  await fs.appendFile(filePath, line, "utf8");
}

function sanitizeDiagnosticValue(value, maxLength = 120) {
  return String(value ?? "")
    .replace(/[A-Za-z]:\\[^\s]+/g, "<path>")
    .replace(/https?:\/\/[^\s]+/g, "<url>")
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

async function queueDiagnosticEvent(type, details = {}) {
  const stored = await readStorageValue(diagnosticsConsentStorageKey).catch(() => ({}));
  if (stored?.[diagnosticsConsentStorageKey] !== true) return;

  const safeDetails = Object.fromEntries(
    Object.entries(details || {}).map(([key, value]) => [key, typeof value === "string" ? sanitizeDiagnosticValue(value) : value])
  );
  const event = {
    at: new Date().toISOString(),
    type: sanitizeDiagnosticValue(type, 64),
    appVersion: app.getVersion(),
    channel: runtimeChannel,
    platform: process.platform,
    arch: process.arch,
    details: safeDetails
  };
  await appendBoundedJsonl(diagnosticsQueuePath, event).catch(() => {});
}

function scheduleDiagnosticsConsentPrompt() {
  if (diagnosticsConsentPromptScheduled || appIsQuitting) {
    return;
  }
  diagnosticsConsentPromptScheduled = true;

  setTimeout(() => {
    void (async () => {
      const stored = await readStorageValue([diagnosticsConsentStorageKey, diagnosticsRemindAtStorageKey]).catch(() => ({}));
      if (stored?.[diagnosticsConsentStorageKey] === true || Number(stored?.[diagnosticsRemindAtStorageKey] || 0) > Date.now()) return;

      const result = await showScreenVisionConfirmDialog(mainWindow, {
        title: tr("diagnostics.title"),
        message: tr("diagnostics.message"),
        confirmLabel: tr("diagnostics.allow"),
        confirmTooltip: tr("diagnostics.allow"),
        cancelLabel: tr("diagnostics.remindLater"),
        cancelTooltip: tr("diagnostics.remindLater"),
        tone: "success",
        flat: true,
        width: 440,
        height: 300,
        autoHeight: true,
        external: true,
        centerOnDisplay: true
      });

      await writeStorageValue(result?.confirmed
        ? { [diagnosticsConsentStorageKey]: true, [diagnosticsRemindAtStorageKey]: 0 }
        : { [diagnosticsConsentStorageKey]: false, [diagnosticsRemindAtStorageKey]: Date.now() + 15 * 24 * 60 * 60 * 1000 });
    })().catch((error) => {
      diagnosticsConsentPromptScheduled = false;
      void writeDebugLog(`diagnostics-consent-prompt-error ${error?.message || String(error)}`);
    });
  }, 3_000);
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
