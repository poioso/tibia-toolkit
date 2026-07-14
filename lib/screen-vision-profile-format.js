import { createDefaultOverlayToolsState } from "./overlay-tools-state.js";
import { createOverlayMirrorEntry } from "./overlay-mirrors.js";
import { createOverlayTimerEntryFromDraft } from "./overlay-timers.js";

const DEFAULT_PROFILE_NAME = "Profile 1";
const DEFAULT_ALERT_WINDOW_BOUNDS = {
  left: null,
  top: null
};

export function createEmptyMirrorProfile(profileName = DEFAULT_PROFILE_NAME) {
  return {
    ProfileName: normalizeProfileName(profileName),
    CharacterName: "",
    Regions: [],
    SourceType: "Tibia",
    SourceTitle: "",
    SourceProcessName: "",
    ShowHideHotkeyCode: 0,
    ShowHideHotkeyModifiers: 0,
    ProfileSwitchHotkeyCode: 0,
    ProfileSwitchHotkeyModifiers: 0,
    WindowWidth: 528,
    WindowHeight: 624,
    MainUiScale: 1,
    VisualCustomizationX: 0,
    VisualCustomizationY: 0,
    CursorGlowEnabled: false,
    CursorGlowColor: "#58C470",
    CursorGlowSavedColors: ["#58C470", "#FFFFFF", "#FF4444", "#0088FF"],
    CursorGlowSize: 24,
    CharLocEnabled: false,
    CharLocShape: "Circle",
    CharLocColor: "#58C470",
    CharLocSavedColors: ["#58C470", "#FFFFFF", "#FF4444", "#0088FF"],
    CharLocPulse: false,
    CharLocLocked: false,
    CharLocIntensity: 100,
    CharLocSize: 18,
    CharLocX: 0,
    CharLocY: 0
  };
}

export function createEmptyMirrorAudioProfile() {
  return {
    Timers: [],
    Volume: 70,
    IsListening: false,
    VisualsEnabled: false,
    StartListeningOnStartup: false,
    WindowLeft: null,
    WindowTop: null
  };
}

export function overlayStateToMirrorProfile(overlayToolsState, options = {}) {
  const source = overlayToolsState && typeof overlayToolsState === "object"
    ? overlayToolsState
    : createDefaultOverlayToolsState();
  const profileName = normalizeProfileName(options.profileName || DEFAULT_PROFILE_NAME);
  const firstRegion = Array.isArray(source.mirrors?.items) && source.mirrors.items.length
    ? source.mirrors.items[0]
    : null;
  const profile = createEmptyMirrorProfile(profileName);
  const visualSettings = source.settings?.screenVision?.visualCustomization || {};

  profile.SourceTitle = String(options.sourceTitle || firstRegion?.sourceWindowTitle || "").trim();
  profile.SourceProcessName = String(options.sourceProcessName || firstRegion?.sourceProcessName || "").trim();
  profile.CharacterName = String(source.settings?.screenVision?.profileCharacterName || "").trim().slice(0, 64);
  profile.VisualCustomizationX = normalizeOptionalNumber(visualSettings.windowLeft) ?? 0;
  profile.VisualCustomizationY = normalizeOptionalNumber(visualSettings.windowTop) ?? 0;
  profile.CursorGlowEnabled = Boolean(visualSettings.cursorGlowEnabled);
  profile.CursorGlowColor = normalizeVisualAccentColor(visualSettings.cursorGlowColor, profile.CursorGlowColor);
  profile.CursorGlowSavedColors = normalizeVisualSavedColors(visualSettings.cursorGlowSavedColors, profile.CursorGlowSavedColors);
  profile.CursorGlowSize = clampInteger(visualSettings.cursorGlowSize, 20, 160, profile.CursorGlowSize);
  profile.CharLocEnabled = Boolean(visualSettings.charLocEnabled);
  profile.CharLocShape = normalizeCharLocShape(visualSettings.charLocShape || profile.CharLocShape);
  profile.CharLocColor = normalizeVisualAccentColor(visualSettings.charLocColor, profile.CharLocColor);
  profile.CharLocSavedColors = normalizeVisualSavedColors(visualSettings.charLocSavedColors, profile.CharLocSavedColors);
  profile.CharLocPulse = Boolean(visualSettings.charLocPulse);
  profile.CharLocLocked = Boolean(visualSettings.charLocLocked);
  profile.CharLocIntensity = clampNumber(visualSettings.charLocIntensity, 1, 30, profile.CharLocIntensity);
  profile.CharLocSize = clampNumber(visualSettings.charLocSize, 20, 160, profile.CharLocSize);
  profile.CharLocX = clampNumber(visualSettings.charLocX, -50000, 50000, profile.CharLocX);
  profile.CharLocY = clampNumber(visualSettings.charLocY, -50000, 50000, profile.CharLocY);
  profile.Regions = (Array.isArray(source.mirrors?.items) ? source.mirrors.items : [])
    .map((region, index) => mapOverlayMirrorToProfileRegion(region, index))
    .filter(Boolean);

  return profile;
}

export function overlayStateToMirrorAudioProfile(overlayToolsState, options = {}) {
  const source = overlayToolsState && typeof overlayToolsState === "object"
    ? overlayToolsState
    : createDefaultOverlayToolsState();
  const timersState = source.timers || {};
  const bounds = options.alertWindowBounds || DEFAULT_ALERT_WINDOW_BOUNDS;

  return {
    Timers: (Array.isArray(timersState.items) ? timersState.items : [])
      .map((timer, index) => mapOverlayTimerToProfileTimer(timer, index))
      .filter(Boolean),
    Volume: clampInteger(timersState.globalVolumePercent, 0, 100, 70),
    IsListening: Boolean(timersState.isListening),
    VisualsEnabled: Boolean(timersState.visualsEnabled),
    StartListeningOnStartup: Boolean(timersState.startListeningOnStartup),
    WindowLeft: normalizeOptionalNumber(bounds.left),
    WindowTop: normalizeOptionalNumber(bounds.top)
  };
}

export function mirrorProfileToOverlayState(profileJson, audioJson, options = {}) {
  const state = createDefaultOverlayToolsState();
  const sourceProfile = profileJson && typeof profileJson === "object" ? profileJson : {};
  const sourceAudio = audioJson && typeof audioJson === "object" ? audioJson : createEmptyMirrorAudioProfile();
  const tibiaState = options.tibiaState && typeof options.tibiaState === "object" ? options.tibiaState : null;
  const sourceBounds = tibiaState?.clientBounds || tibiaState?.bounds || null;
  const sourceTitle = String(sourceProfile.SourceTitle || tibiaState?.title || "").trim();
  const sourceProcessName = String(sourceProfile.SourceProcessName || tibiaState?.processName || "").trim();

  state.mirrors.items = (Array.isArray(sourceProfile.Regions) ? sourceProfile.Regions : [])
    .map((region, index) => mapProfileRegionToOverlayMirror(region, index, {
      sourceBounds,
      sourceTitle,
      sourceProcessName
    }))
    .filter(Boolean);

  state.timers.items = (Array.isArray(sourceAudio.Timers) ? sourceAudio.Timers : [])
    .map((timer, index) => mapProfileTimerToOverlayTimer(timer, index))
    .filter(Boolean);
  state.timers.globalVolumePercent = clampInteger(sourceAudio.Volume, 0, 100, 70);
  state.timers.startListeningOnStartup = Boolean(sourceAudio.StartListeningOnStartup);
  state.timers.visualsEnabled = Boolean(sourceAudio.VisualsEnabled);
  state.timers.isListening = Boolean(sourceAudio.IsListening)
    || (state.timers.startListeningOnStartup && state.timers.items.length > 0);
  state.settings.screenVision.visualCustomization = {
    ...state.settings.screenVision.visualCustomization,
    windowLeft: normalizeOptionalNumber(sourceProfile.VisualCustomizationX),
    windowTop: normalizeOptionalNumber(sourceProfile.VisualCustomizationY),
    charLocEnabled: Boolean(sourceProfile.CharLocEnabled),
    charLocX: clampNumber(sourceProfile.CharLocX, -50000, 50000, 0),
    charLocY: clampNumber(sourceProfile.CharLocY, -50000, 50000, 0),
    charLocSize: clampNumber(sourceProfile.CharLocSize, 20, 160, 40),
    charLocShape: normalizeCharLocShape(sourceProfile.CharLocShape || "Circle"),
    charLocColor: normalizeVisualAccentColor(sourceProfile.CharLocColor, "#58C470"),
    charLocSavedColors: normalizeVisualSavedColors(sourceProfile.CharLocSavedColors, ["#58C470", "#FFFFFF", "#FF4444", "#0088FF"]),
    charLocIntensity: clampNumber(sourceProfile.CharLocIntensity, 1, 30, 10),
    charLocPulse: Boolean(sourceProfile.CharLocPulse),
    charLocLocked: Boolean(sourceProfile.CharLocLocked),
    cursorGlowEnabled: Boolean(sourceProfile.CursorGlowEnabled),
    cursorGlowSize: clampNumber(sourceProfile.CursorGlowSize, 20, 160, 40),
    cursorGlowColor: normalizeVisualAccentColor(sourceProfile.CursorGlowColor, "#58C470"),
    cursorGlowSavedColors: normalizeVisualSavedColors(sourceProfile.CursorGlowSavedColors, ["#58C470", "#FFFFFF", "#FF4444", "#0088FF"])
  };
  state.settings.screenVision.profileCharacterName = String(sourceProfile.CharacterName || "").trim().slice(0, 64);

  return {
    overlayToolsState: state,
    profileName: normalizeProfileName(sourceProfile.ProfileName || options.fallbackProfileName || DEFAULT_PROFILE_NAME),
    alertWindowBounds: {
      left: normalizeOptionalNumber(sourceAudio.WindowLeft),
      top: normalizeOptionalNumber(sourceAudio.WindowTop)
    }
  };
}

function mapOverlayMirrorToProfileRegion(region, index) {
  if (!region || typeof region !== "object") {
    return null;
  }

  const captureBounds = normalizeBounds(region.captureBounds);
  const mirrorBounds = normalizeBounds(region.mirrorBounds || region.captureBounds);
  const countdown = region.countdown && typeof region.countdown === "object" ? region.countdown : {};

  return {
    Id: typeof region.id === "string" && region.id.trim() ? region.id.trim() : `region-${index + 1}`,
    Name: String(region.name || `Area ${index + 1}`).trim(),
    CropX: captureBounds.x,
    CropY: captureBounds.y,
    CropWidth: captureBounds.width,
    CropHeight: captureBounds.height,
    MirrorX: mirrorBounds.x,
    MirrorY: mirrorBounds.y,
    MirrorWidth: mirrorBounds.width,
    MirrorHeight: mirrorBounds.height,
    IsLocked: Boolean(region.isLocked),
    Opacity: clampNumber((Number(region.opacity) || 100) / 100, 0.15, 1, 1),
    IsVisible: region.isVisible !== false,
    Zoom: 1,
    Scale: clampNumber(region.scale, 0.5, 4, 1),
    GlowEnabled: Boolean(region.glowEnabled),
    GlowColor: normalizeHexColor(region.glowColor, "#58C470"),
    GlowIntensity: clampNumber(region.glowIntensity, 1, 30, 10),
    CountdownEnabled: Boolean(countdown.enabled),
    CountdownDurationSeconds: clampInteger(countdown.durationSeconds, 1, 43200, 60),
    CountdownHotkeyCode: clampInteger(countdown.hotkeyKeyCode, 0, 255, 0),
    CountdownHotkeyModifiers: clampInteger(countdown.hotkeyModifiers, 0, 15, 0),
    CountdownSide: String(countdown.side || "Above"),
    CountdownBarColor: normalizeCountdownColor(countdown.color),
    CountdownBarThickness: clampInteger(countdown.barThickness, 1, 2000, 22),
    CountdownBarLength: clampInteger(countdown.barLength, 1, 4000, 200),
    CountdownFlashEnabled: countdown.flashEnabled !== false,
    CountdownLockWhileRunning: Boolean(countdown.retriggerEnabled),
    IsObsMirror: false,
    IsFixedCrop: Boolean(region.isFixedCrop),
    AllowSnapping: region.allowSnapping !== false,
    ObsWindowTitle: null,
    ObsProcessName: null,
    OriginalCropX: 0,
    OriginalCropY: 0,
    OriginalCropWidth: 0,
    OriginalCropHeight: 0
  };
}

function mapProfileRegionToOverlayMirror(region, index, options = {}) {
  if (!region || typeof region !== "object") {
    return null;
  }

  const captureBounds = normalizeBounds({
    x: region.CropX,
    y: region.CropY,
    width: region.CropWidth,
    height: region.CropHeight
  });
  const mirrorBounds = normalizeBounds({
    x: region.MirrorX,
    y: region.MirrorY,
    width: region.MirrorWidth,
    height: region.MirrorHeight
  });
  const sourceBounds = options.sourceBounds
    ? normalizeBounds(options.sourceBounds, { width: captureBounds.width, height: captureBounds.height })
    : {
        x: captureBounds.x,
        y: captureBounds.y,
        width: captureBounds.width,
        height: captureBounds.height
      };

  return createOverlayMirrorEntry({
    id: typeof region.Id === "string" && region.Id.trim() ? region.Id.trim() : undefined,
    name: String(region.Name || `Area ${index + 1}`).trim(),
    displayId: "",
    displayLabel: "",
    displayBounds: sourceBounds,
    sourceBounds,
    sourceWindowTitle: String(options.sourceTitle || "").trim(),
    sourceProcessName: String(options.sourceProcessName || "").trim(),
    relativeBounds: {
      x: captureBounds.x - sourceBounds.x,
      y: captureBounds.y - sourceBounds.y,
      width: captureBounds.width,
      height: captureBounds.height
    },
    captureBounds,
    mirrorBounds,
    opacity: clampInteger(Math.round(clampNumber(region.Opacity, 0.15, 1, 1) * 100), 15, 100, 100),
    isVisible: region.IsVisible !== false,
    isLocked: Boolean(region.IsLocked),
    isFixedCrop: Boolean(region.IsFixedCrop),
    allowSnapping: region.AllowSnapping !== false,
    scale: clampNumber(region.Scale, 0.5, 4, 1),
    glowEnabled: Boolean(region.GlowEnabled),
    glowColor: normalizeHexColor(region.GlowColor, "#58C470"),
    glowIntensity: clampNumber(region.GlowIntensity, 1, 30, 10),
    countdown: {
      enabled: Boolean(region.CountdownEnabled),
      durationSeconds: clampInteger(region.CountdownDurationSeconds, 1, 43200, 60),
      hotkey: formatHotkeyLabel(region.CountdownHotkeyCode, region.CountdownHotkeyModifiers),
      hotkeyKeyCode: clampInteger(region.CountdownHotkeyCode, 0, 255, 0),
      hotkeyModifiers: clampInteger(region.CountdownHotkeyModifiers, 0, 15, 0),
      side: region.CountdownSide || "Above",
      direction: "LeftToRight",
      barThickness: clampInteger(region.CountdownBarThickness, 1, 2000, 22),
      barLength: clampInteger(region.CountdownBarLength, 1, 4000, 200),
      color: normalizeCountdownColor(region.CountdownBarColor),
      borderWidth: 1,
      borderRadius: 3,
      borderColor: "#ffffff",
      flashEnabled: region.CountdownFlashEnabled !== false,
      retriggerEnabled: Boolean(region.CountdownLockWhileRunning)
    }
  });
}

function mapOverlayTimerToProfileTimer(timer, index) {
  if (!timer || typeof timer !== "object") {
    return null;
  }

  const timerVolume = clampInteger(timer.volumePercent, 0, 100, 100);
  const timerAudioEnabled = timer.enabled !== false && !timer.volumeMuted && timerVolume > 0;

  return {
    Name: String(timer.name || `Timer ${index + 1}`).trim(),
    HotkeyCode: clampInteger(timer.hotkeyKeyCode, 0, 255, 0),
    HotkeyModifiers: clampInteger(timer.hotkeyModifiers, 0, 15, 0),
    Duration: clampInteger(timer.durationSeconds, 1, 43200, 60),
    Volume: timerVolume,
    ShowVisualAlert: timer.showVisualAlert !== false,
    RetriggerEnabled: timer.retriggerEnabled !== false,
    AlertMessage: String(timer.message || "").trim(),
    AlertColor: normalizeAlertColor(timer.alertColor),
    AlertFontSize: fontSizeKeyToValue(timer.fontSizeKey),
    AlertFontFamily: normalizeAlertFontFamily(timer.alertFontFamily),
    AlertFontWeight: clampInteger(timer.alertFontWeight, 400, 900, 700),
    AlertShadowEnabled: timer.alertShadowEnabled !== false,
    AlertDisplayDurationSeconds: normalizeAlertDisplayDurationSeconds(timer.alertDurationSeconds),
    ReminderEnabled: Boolean(timer.reminderEnabled),
    ReminderDelaySeconds: clampInteger(timer.reminderDelaySeconds, 1, 3600, 10),
    ReminderRepeatCount: clampInteger(timer.reminderRepeatCount, 1, 10, 2),
    AlertIsLocked: Boolean(timer.locked),
    AlertPositionX: normalizeOptionalNumber(timer.alertPositionX),
    AlertPositionY: normalizeOptionalNumber(timer.alertPositionY),
    SavedAlertColors: Array.isArray(timer.savedAlertColors) ? timer.savedAlertColors : [],
    SoundKey: String(timer.soundKey || "").trim(),
    SoundName: timer.customSoundPath ? "Own sound" : mapSoundKeyToReferenceName(timer.soundKey),
    CustomSoundPath: timer.customSoundPath || "",
    IsActive: timerAudioEnabled,
    StartTime: null,
    EndTime: null
  };
}

function mapProfileTimerToOverlayTimer(timer, index) {
  if (!timer || typeof timer !== "object") {
    return null;
  }

  const customSoundPath = String(timer.CustomSoundPath || "").trim();
  const soundName = String(timer.SoundName || "").trim();
  const explicitSoundKey = String(timer.SoundKey || "").trim();
  const mappedSoundKey = explicitSoundKey || mapReferenceSoundToSoundKey(soundName, customSoundPath);
  const hotkeyKeyCode = clampInteger(timer.HotkeyCode, 0, 255, 0);
  const hotkeyModifiers = clampInteger(timer.HotkeyModifiers, 0, 15, 0);
  const volumePercent = clampInteger(timer.Volume, 0, 100, 100);
  const audioEnabled = Boolean(timer.IsActive) || volumePercent > 0;

  return createOverlayTimerEntryFromDraft({
    name: String(timer.Name || `Timer ${index + 1}`).trim(),
    durationSeconds: clampInteger(timer.Duration, 1, 43200, 60),
    soundKey: mappedSoundKey,
    customSoundPath,
    message: String(timer.AlertMessage || "").trim(),
    alertColor: normalizeAlertColor(timer.AlertColor),
    savedAlertColors: Array.isArray(timer.SavedAlertColors) ? timer.SavedAlertColors : undefined,
    fontSizeKey: fontSizeValueToKey(timer.AlertFontSize),
    alertFontFamily: normalizeAlertFontFamily(timer.AlertFontFamily),
    alertFontWeight: clampInteger(timer.AlertFontWeight, 400, 900, 700),
    alertShadowEnabled: timer.AlertShadowEnabled !== false,
    alertDurationSeconds: normalizeAlertDisplayDurationSeconds(timer.AlertDisplayDurationSeconds),
    reminderEnabled: Boolean(timer.ReminderEnabled),
    reminderDelaySeconds: clampInteger(timer.ReminderDelaySeconds, 1, 3600, 10),
    reminderRepeatCount: clampInteger(timer.ReminderRepeatCount, 1, 10, 2),
    volumePercent,
    volumeMuted: volumePercent <= 0,
    showVisualAlert: timer.ShowVisualAlert !== false,
    retriggerEnabled: timer.RetriggerEnabled !== false,
    locked: Boolean(timer.AlertIsLocked),
    alertPositionX: normalizeOptionalNumber(timer.AlertPositionX),
    alertPositionY: normalizeOptionalNumber(timer.AlertPositionY),
    hotkeyKeyCode,
    hotkeyModifiers,
    hotkey: {
      code: hotkeyKeyCode > 0 ? formatHotkeyLabel(hotkeyKeyCode, hotkeyModifiers) : "",
      modifiers: []
    }
  }, {
    enabled: audioEnabled
  });
}

function normalizeProfileName(value) {
  const text = String(value || "").trim();
  return text || DEFAULT_PROFILE_NAME;
}

function normalizeBounds(value, fallback = { x: 0, y: 0, width: 24, height: 24 }) {
  const source = value && typeof value === "object" ? value : {};
  return {
    x: clampInteger(source.X ?? source.x, -20000, 20000, fallback.x ?? 0),
    y: clampInteger(source.Y ?? source.y, -20000, 20000, fallback.y ?? 0),
    width: clampInteger(source.Width ?? source.width, 1, 20000, fallback.width ?? 24),
    height: clampInteger(source.Height ?? source.height, 1, 20000, fallback.height ?? 24)
  };
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function normalizeOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCountdownColor(value) {
  const text = String(value || "").trim();
  return text || "gradient";
}

function normalizeAlertColor(value) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) || /^#[0-9a-f]{8}$/i.test(text) ? text : "#FF4444";
}

function normalizeHexColor(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) || /^#[0-9a-f]{8}$/i.test(text) ? text : fallback;
}

function normalizeVisualSavedColors(value, fallback) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  return source
    .map((entry) => normalizeVisualAccentColor(entry, ""))
    .filter(Boolean)
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, 10);
}

function normalizeVisualAccentColor(value, fallback = "#58C470") {
  const normalized = normalizeHexColor(value, fallback);
  return String(normalized).toLowerCase() === "#ff7f00" ? "#58C470" : normalized;
}

function normalizeCharLocShape(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "arrow") {
    return "Arrow";
  }
  if (text === "square") {
    return "Square";
  }
  return "Circle";
}

function normalizeAlertFontFamily(value) {
  const key = String(value || "").trim().toLowerCase();
  const allowed = new Set([
    "nunito",
    "toolkit",
    "montserrat",
    "poppins",
    "sora",
    "merriweather",
    "playfair",
    "rajdhani",
    "orbitron"
  ]);
  return allowed.has(key) ? key : "nunito";
}

function normalizeAlertDisplayDurationSeconds(value) {
  const parsed = Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(parsed)) {
    return 1.6;
  }

  const clamped = Math.min(Math.max(parsed, 0.5), 15);
  return Math.round(clamped * 10) / 10;
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

function fontSizeValueToKey(value) {
  const parsed = clampInteger(value, 18, 56, 34);
  if (parsed <= 18) {
    return "small";
  }
  if (parsed <= 26) {
    return "medium";
  }
  if (parsed <= 34) {
    return "large";
  }
  if (parsed <= 44) {
    return "x-large";
  }
  return "huge";
}

function mapReferenceSoundToSoundKey(soundName, customSoundPath) {
  const raw = `${soundName} ${customSoundPath}`.toLowerCase();
  if (raw.includes("exura gran ico")) {
    return "exura-gran-ico";
  }
  if (raw.includes("utito tempo")) {
    return "utito-tempo";
  }
  if (raw.includes("utura gran")) {
    return "utura-gran";
  }
  return "utura-gran";
}

function mapSoundKeyToReferenceName(soundKey) {
  switch (String(soundKey || "").trim()) {
    case "exura-gran-ico":
      return "exura gran ico";
    case "utito-tempo":
      return "utito tempo";
    case "utura-gran":
    default:
      return "utura gran";
  }
}

function formatHotkeyLabel(keyCode, modifiers) {
  const safeKeyCode = clampInteger(keyCode, 0, 255, 0);
  if (!safeKeyCode) {
    return "";
  }

  const parts = [];
  if (modifiers & 2) {
    parts.push("Ctrl");
  }
  if (modifiers & 1) {
    parts.push("Alt");
  }
  if (modifiers & 4) {
    parts.push("Shift");
  }
  if (modifiers & 8) {
    parts.push("Win");
  }
  parts.push(keyCodeToLabel(safeKeyCode));
  return parts.join("+");
}

function keyCodeToLabel(keyCode) {
  if (keyCode >= 65 && keyCode <= 90) {
    return String.fromCharCode(keyCode);
  }
  if (keyCode >= 48 && keyCode <= 57) {
    return String.fromCharCode(keyCode);
  }
  if (keyCode >= 96 && keyCode <= 105) {
    return String(keyCode - 96);
  }
  if (keyCode >= 112 && keyCode <= 135) {
    return `F${keyCode - 111}`;
  }

  switch (keyCode) {
    case 32: return "Space";
    case 13: return "Enter";
    case 27: return "Esc";
    case 9: return "Tab";
    case 192: return "`";
    case 107: return "+";
    case 189: return "-";
    default: return String(keyCode);
  }
}
