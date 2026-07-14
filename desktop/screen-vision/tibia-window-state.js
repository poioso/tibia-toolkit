export const TIBIA_WINDOW_MIN_SIZE = 24;
const FULLSCREEN_BOUNDS_TOLERANCE = 10;

export function normalizeTibiaWindowState(rawState) {
  if (!rawState || typeof rawState !== "object") {
    return null;
  }

  const bounds = normalizeBounds(readValue(rawState, "bounds"));
  const clientBounds = normalizeBounds(readValue(rawState, "clientBounds") || readValue(rawState, "bounds"));

  return {
    hwnd: normalizeNumber(readValue(rawState, "hwnd"), 0),
    processName: normalizeString(readValue(rawState, "processName")),
    title: normalizeString(readValue(rawState, "title")),
    isVisible: Boolean(readValue(rawState, "isVisible")),
    isForeground: Boolean(readValue(rawState, "isForeground")),
    isMinimized: Boolean(readValue(rawState, "isMinimized")),
    isMaximized: Boolean(readValue(rawState, "isMaximized")),
    bounds,
    clientBounds
  };
}

export function normalizeTibiaDisplayState(rawState, display = null) {
  const state = normalizeTibiaWindowState(rawState);

  if (!state) {
    return null;
  }

  const displayBounds = display
    ? {
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height
      }
    : null;

  return {
    ...state,
    displayId: display ? String(display.id) : "",
    displayLabel: display?.label || "",
    displayBounds,
    isFullscreenLike: isFullscreenLikeWindow(state.bounds, displayBounds)
  };
}

function isFullscreenLikeWindow(bounds, displayBounds) {
  if (!bounds || !displayBounds) {
    return false;
  }

  return bounds.width >= displayBounds.width - FULLSCREEN_BOUNDS_TOLERANCE
    && bounds.height >= displayBounds.height - FULLSCREEN_BOUNDS_TOLERANCE;
}

function normalizeBounds(value) {
  const source = value && typeof value === "object" ? value : {};

  return {
    x: clampInteger(readValue(source, "x"), -20000, 20000, 0),
    y: clampInteger(readValue(source, "y"), -20000, 20000, 0),
    width: clampInteger(readValue(source, "width"), TIBIA_WINDOW_MIN_SIZE, 20000, TIBIA_WINDOW_MIN_SIZE),
    height: clampInteger(readValue(source, "height"), TIBIA_WINDOW_MIN_SIZE, 20000, TIBIA_WINDOW_MIN_SIZE)
  };
}

function readValue(source, key) {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  const direct = source[key];

  if (direct !== undefined) {
    return direct;
  }

  const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
  return source[pascalKey];
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}
