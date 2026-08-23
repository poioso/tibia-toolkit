import {
  createDefaultOverlayTimerDraft,
  normalizeOverlayTimerDraft,
  normalizeOverlayTimerEntry
} from "./overlay-timers.js";
import {
  createDefaultOverlayAuthenticatorState,
  normalizeOverlayAuthenticatorState
} from "./overlay-authenticator.js";
import { normalizeOverlayMirrorEntry } from "./overlay-mirrors.js";

export const OVERLAY_TOOLS_STORAGE_KEY = "overlayToolsState";
export const OVERLAY_TOOLS_STATE_VERSION = 1;

export function createDefaultOverlayToolsState(nowIso = createNowIso()) {
  return {
    version: OVERLAY_TOOLS_STATE_VERSION,
    createdAt: nowIso,
    updatedAt: nowIso,
    settings: {
      desktop: {
        miniMode: false,
        clickThroughEnabled: false,
        reduceOverlayNoise: false
      },
      screenVision: {
        gridEnabled: false,
        gridSize: 32,
        profileCharacterName: "",
        visualCustomization: {
          windowLeft: null,
          windowTop: null,
          charLocEnabled: false,
          charLocX: 0,
          charLocY: 0,
          charLocSize: 40,
          charLocShape: "Circle",
          charLocColor: "#58C470",
          charLocIntensity: 10,
          charLocPulse: false,
          charLocLocked: false,
          charLocSavedColors: ["#58C470", "#FFFFFF", "#FF4444", "#0088FF"],
          cursorGlowEnabled: false,
          cursorGlowSize: 40,
          cursorGlowColor: "#58C470",
          cursorGlowSavedColors: ["#58C470", "#FFFFFF", "#FF4444", "#0088FF"]
        }
      }
    },
    timers: {
      items: [],
      draft: createDefaultOverlayTimerDraft(),
      globalVolumePercent: 70,
      lastTriggeredTimerId: null,
      isListening: false,
      visualsEnabled: false,
      startListeningOnStartup: false
    },
    notes: {
      items: []
    },
    authenticator: createDefaultOverlayAuthenticatorState(),
    profiles: {
      items: [],
      activeProfileId: null
    },
    mirrors: {
      items: []
    }
  };
}

export function normalizeOverlayToolsState(rawState, nowIso = createNowIso()) {
  const fallback = createDefaultOverlayToolsState(nowIso);
  const source = rawState && typeof rawState === "object" ? rawState : {};
  const normalizedDraft = normalizeOverlayTimerDraft(source?.timers?.draft);
  const normalizedTimers = Array.isArray(source?.timers?.items)
    ? source.timers.items.map((entry) => normalizeOverlayTimerEntry(entry)).filter(Boolean)
    : [];

  return {
    version: OVERLAY_TOOLS_STATE_VERSION,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : fallback.createdAt,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : fallback.updatedAt,
    settings: {
      desktop: {
        miniMode: Boolean(source?.settings?.desktop?.miniMode),
        clickThroughEnabled: Boolean(source?.settings?.desktop?.clickThroughEnabled),
        reduceOverlayNoise: Boolean(source?.settings?.desktop?.reduceOverlayNoise)
      },
      screenVision: normalizeScreenVisionSettings(source?.settings?.screenVision, fallback.settings.screenVision)
    },
    timers: {
      items: normalizedTimers,
      draft: normalizedDraft,
      globalVolumePercent: Number.isFinite(Number(source?.timers?.globalVolumePercent))
        ? Math.min(Math.max(Math.round(Number(source.timers.globalVolumePercent)), 0), 100)
        : 70,
      lastTriggeredTimerId: typeof source?.timers?.lastTriggeredTimerId === "string"
        ? source.timers.lastTriggeredTimerId
        : null,
      isListening: Boolean(source?.timers?.isListening),
      visualsEnabled: Boolean(source?.timers?.visualsEnabled),
      startListeningOnStartup: Boolean(source?.timers?.startListeningOnStartup)
    },
    notes: {
      items: Array.isArray(source?.notes?.items) ? source.notes.items : []
    },
    authenticator: normalizeOverlayAuthenticatorState(source?.authenticator, nowIso),
    profiles: {
      items: Array.isArray(source?.profiles?.items) ? source.profiles.items : [],
      activeProfileId: typeof source?.profiles?.activeProfileId === "string"
        ? source.profiles.activeProfileId
        : null
    },
    mirrors: {
      items: Array.isArray(source?.mirrors?.items)
        ? source.mirrors.items.map((entry) => normalizeOverlayMirrorEntry(entry)).filter(Boolean)
        : []
    }
  };
}

export function cloneOverlayToolsStateForSave(currentState, nowIso = createNowIso()) {
  const normalized = normalizeOverlayToolsState(currentState, nowIso);
  return {
    ...normalized,
    updatedAt: nowIso
  };
}

function normalizeScreenVisionSettings(rawSettings, fallback) {
  const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  const defaults = fallback && typeof fallback === "object" ? fallback : createDefaultOverlayToolsState().settings.screenVision;
  const visualSource = source.visualCustomization && typeof source.visualCustomization === "object"
    ? source.visualCustomization
    : {};

  return {
    gridEnabled: Boolean(source.gridEnabled),
    gridSize: clampInteger(source.gridSize, 8, 256, defaults.gridSize),
    profileCharacterName: typeof source.profileCharacterName === "string"
      ? source.profileCharacterName.trim().slice(0, 64)
      : "",
    visualCustomization: {
      windowLeft: normalizeOptionalNumber(visualSource.windowLeft),
      windowTop: normalizeOptionalNumber(visualSource.windowTop),
      charLocEnabled: Boolean(visualSource.charLocEnabled),
      charLocX: clampNumber(visualSource.charLocX, -50000, 50000, defaults.visualCustomization.charLocX),
      charLocY: clampNumber(visualSource.charLocY, -50000, 50000, defaults.visualCustomization.charLocY),
      charLocSize: clampNumber(visualSource.charLocSize, 20, 160, defaults.visualCustomization.charLocSize),
      charLocShape: normalizeCharLocShape(visualSource.charLocShape),
      charLocColor: normalizeVisualAccentColor(visualSource.charLocColor, defaults.visualCustomization.charLocColor),
      charLocIntensity: clampNumber(visualSource.charLocIntensity, 1, 30, defaults.visualCustomization.charLocIntensity),
      charLocPulse: Boolean(visualSource.charLocPulse),
      charLocLocked: Boolean(visualSource.charLocLocked),
      charLocSavedColors: normalizeVisualSavedColors(visualSource.charLocSavedColors, defaults.visualCustomization.charLocSavedColors),
      cursorGlowEnabled: Boolean(visualSource.cursorGlowEnabled),
      cursorGlowSize: clampNumber(visualSource.cursorGlowSize, 20, 160, defaults.visualCustomization.cursorGlowSize),
      cursorGlowColor: normalizeVisualAccentColor(visualSource.cursorGlowColor, defaults.visualCustomization.cursorGlowColor),
      cursorGlowSavedColors: normalizeVisualSavedColors(visualSource.cursorGlowSavedColors, defaults.visualCustomization.cursorGlowSavedColors)
    }
  };
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
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (text === "arrow") {
    return "Arrow";
  }
  if (text === "square") {
    return "Square";
  }
  return "Circle";
}

function normalizeHexColor(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(text) || /^#[0-9a-f]{8}$/i.test(text) ? text : fallback;
}

function normalizeOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function createNowIso() {
  return new Date().toISOString();
}
