export const OVERLAY_MIRROR_MIN_SIZE = 24;

export function createOverlayMirrorEntry(rawEntry, options = {}) {
  const nowIso = typeof options.nowIso === "string" ? options.nowIso : createNowIso();
  const createdAt = typeof options.createdAt === "string" ? options.createdAt : nowIso;

  return normalizeOverlayMirrorEntry({
    id: typeof options.id === "string" && options.id.trim() ? options.id.trim() : createOverlayMirrorId(),
    ...rawEntry,
    createdAt,
    updatedAt: nowIso
  });
}

export function normalizeOverlayMirrorEntry(rawEntry) {
  if (!rawEntry || typeof rawEntry !== "object") {
    return null;
  }

  const captureBounds = normalizeBounds(rawEntry.captureBounds, null, 1);
  const mirrorBounds = normalizeBounds(rawEntry.mirrorBounds || rawEntry.captureBounds);
  const displayBounds = normalizeDisplayBounds(rawEntry.displayBounds);
  const sourceBounds = normalizeBounds(rawEntry.sourceBounds || rawEntry.displayBounds, displayBounds, 1);
  const relativeBounds = normalizeRelativeBounds(rawEntry.relativeBounds, captureBounds, sourceBounds);

  return {
    id: typeof rawEntry.id === "string" && rawEntry.id.trim() ? rawEntry.id.trim() : null,
    name: normalizeName(rawEntry.name),
    displayId: typeof rawEntry.displayId === "string" ? rawEntry.displayId.trim() : String(rawEntry.displayId || ""),
    displayLabel: typeof rawEntry.displayLabel === "string" ? rawEntry.displayLabel.trim() : "",
    displayBounds,
    sourceBounds,
    sourceWindowTitle: typeof rawEntry.sourceWindowTitle === "string" ? rawEntry.sourceWindowTitle.trim() : "",
    sourceProcessName: typeof rawEntry.sourceProcessName === "string" ? rawEntry.sourceProcessName.trim() : "",
    relativeBounds,
    captureBounds,
    mirrorBounds,
    opacity: clampInteger(rawEntry.opacity, 15, 100, 100),
    isVisible: rawEntry.isVisible !== false,
    isLocked: Boolean(rawEntry.isLocked),
    isFixedCrop: Boolean(rawEntry.isFixedCrop),
    allowSnapping: rawEntry.allowSnapping !== false,
    scale: normalizeScale(rawEntry.scale, mirrorBounds, captureBounds),
    glowEnabled: Boolean(rawEntry.glowEnabled),
    glowColor: normalizeHexColor(rawEntry.glowColor, "#FFFFFF"),
    glowSavedColors: normalizeGlowSavedColors(rawEntry.glowSavedColors),
    glowIntensity: clampNumber(rawEntry.glowIntensity, 1, 30, 10),
    countdown: normalizeCountdown(rawEntry.countdown),
    createdAt: typeof rawEntry.createdAt === "string" ? rawEntry.createdAt : null,
    updatedAt: typeof rawEntry.updatedAt === "string" ? rawEntry.updatedAt : null
  };
}

export function createOverlayMirrorId() {
  return `mirror-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeName(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 80);
}

function normalizeDisplayBounds(value) {
  return normalizeBounds(value, {
    x: 0,
    y: 0,
    width: 1,
    height: 1
  }, 1);
}

function normalizeRelativeBounds(value, captureBounds, sourceBounds) {
  if (value && typeof value === "object") {
    return normalizeBounds(value, {
      x: 0,
      y: 0,
      width: captureBounds.width,
      height: captureBounds.height
    }, 1);
  }

  return normalizeBounds({
    x: captureBounds.x - sourceBounds.x,
    y: captureBounds.y - sourceBounds.y,
    width: captureBounds.width,
    height: captureBounds.height
  }, {
    x: 0,
    y: 0,
    width: captureBounds.width,
    height: captureBounds.height
  }, 1);
}

function normalizeBounds(value, fallback = null, minSize = OVERLAY_MIRROR_MIN_SIZE) {
  const source = value && typeof value === "object" ? value : {};
  const width = clampInteger(source.width, minSize, 20000, fallback?.width ?? minSize);
  const height = clampInteger(source.height, minSize, 20000, fallback?.height ?? minSize);

  return {
    x: clampInteger(source.x, -20000, 20000, fallback?.x ?? 0),
    y: clampInteger(source.y, -20000, 20000, fallback?.y ?? 0),
    width,
    height
  };
}

function normalizeCountdown(value) {
  const source = value && typeof value === "object" ? value : {};
  const side = normalizeCountdownSide(source.side);
  const defaults = getCountdownDefaultsForSide(side);
  const color = normalizeCountdownColor(source.color);

  return {
    enabled: Boolean(source.enabled),
    durationSeconds: clampInteger(source.durationSeconds, 1, 43200, 60),
    hotkey: normalizeCountdownHotkey(source.hotkey),
    hotkeyKeyCode: clampInteger(source.hotkeyKeyCode, 0, 255, 0),
    hotkeyModifiers: clampInteger(source.hotkeyModifiers, 0, 15, 0),
    side,
    direction: normalizeCountdownDirection(source.direction, defaults.direction),
    barThickness: clampInteger(source.barThickness, 1, 2000, defaults.barThickness),
    barLength: clampInteger(source.barLength, 1, 4000, defaults.barLength),
    color,
    borderWidth: clampInteger(source.borderWidth, 0, 64, 1),
    borderRadius: clampInteger(source.borderRadius, 0, 200, 3),
    borderColor: normalizeCountdownColor(source.borderColor || "#ffffff"),
    flashEnabled: source.flashEnabled !== false,
    retriggerEnabled: Boolean(source.retriggerEnabled)
  };
}

function normalizeCountdownHotkey(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 64).toUpperCase();
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

function normalizeCountdownColor(value) {
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

function normalizeCountdownDirection(value, fallback = "RightToLeft") {
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

  if (text === "lefttoright" || text === "left-to-right") {
    return "LeftToRight";
  }

  return fallback;
}

function normalizeScale(value, mirrorBounds, captureBounds) {
  const parsed = Number(value);

  if (Number.isFinite(parsed) && parsed > 0) {
    return clampNumber(parsed, 0.5, 4, 1);
  }

  const captureWidth = Number(captureBounds?.width) || 0;
  const captureHeight = Number(captureBounds?.height) || 0;
  const mirrorWidth = Math.max(0, (Number(mirrorBounds?.width) || 0) - 24);
  const mirrorHeight = Math.max(0, (Number(mirrorBounds?.height) || 0) - 24);

  if (captureWidth > 0 && captureHeight > 0 && mirrorWidth > 0 && mirrorHeight > 0) {
    const derived = Math.min(mirrorWidth / captureWidth, mirrorHeight / captureHeight);
    return clampNumber(derived, 0.5, 4, 1);
  }

  return 1;
}

function normalizeHexColor(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(text) || /^#[0-9a-f]{8}$/i.test(text) ? text : fallback;
}

function normalizeGlowSavedColors(value) {
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
