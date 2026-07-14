export const TIMER_DURATION_MIN_SECONDS = 1;
export const TIMER_DURATION_MAX_SECONDS = 60 * 60 * 12;
export const TIMER_VOLUME_MIN = 0;
export const TIMER_VOLUME_MAX = 100;
export const OVERLAY_TIMER_SOUND_DEFAULT = "default";
export const ALERT_DISPLAY_DURATION_MIN_SECONDS = 0.5;
export const ALERT_DISPLAY_DURATION_MAX_SECONDS = 15;
export const ALERT_DISPLAY_DURATION_DEFAULT_SECONDS = 1.6;
export const ALERT_REMINDER_DELAY_MIN_SECONDS = 1;
export const ALERT_REMINDER_DELAY_MAX_SECONDS = 3600;
export const ALERT_REMINDER_DELAY_DEFAULT_SECONDS = 10;
export const ALERT_REMINDER_REPEAT_MIN = 1;
export const ALERT_REMINDER_REPEAT_MAX = 10;
export const ALERT_REMINDER_REPEAT_DEFAULT = 2;

export function createDefaultOverlayTimerDraft() {
  return {
    name: "",
    durationSeconds: 60,
    soundKey: OVERLAY_TIMER_SOUND_DEFAULT,
    customSoundPath: "",
    message: "",
    alertColor: "#ff5d5d",
    savedAlertColors: ["#ffffff", "#ff4444", "#0088ff", "#69df72"],
    fontSizeKey: "large",
    alertFontFamily: "nunito",
    alertFontWeight: 700,
    alertShadowEnabled: true,
    alertDurationSeconds: ALERT_DISPLAY_DURATION_DEFAULT_SECONDS,
    reminderEnabled: false,
    reminderDelaySeconds: ALERT_REMINDER_DELAY_DEFAULT_SECONDS,
    reminderRepeatCount: ALERT_REMINDER_REPEAT_DEFAULT,
    volumePercent: 100,
    volumeMuted: false,
    showVisualAlert: false,
    retriggerEnabled: true,
    locked: false,
    alertPositionX: null,
    alertPositionY: null,
    hotkeyLabel: "",
    hotkeyKeyCode: 0,
    hotkeyModifiers: 0,
    hotkey: {
      code: "",
      modifiers: []
    }
  };
}

export function normalizeOverlayTimerDraft(rawDraft) {
  const source = rawDraft && typeof rawDraft === "object" ? rawDraft : {};
  const volumePercent = clampInteger(source.volumePercent, TIMER_VOLUME_MIN, TIMER_VOLUME_MAX, 100);
  const volumeMuted = Boolean(source.volumeMuted) || volumePercent <= 0;

  return {
    name: normalizeTimerName(source.name),
    durationSeconds: clampInteger(source.durationSeconds, TIMER_DURATION_MIN_SECONDS, TIMER_DURATION_MAX_SECONDS, 60),
    soundKey: normalizeTimerSoundKey(source.soundKey),
    customSoundPath: typeof source.customSoundPath === "string" ? source.customSoundPath.trim() : "",
    message: normalizeTimerMessage(source.message),
    alertColor: normalizeTimerColor(source.alertColor),
    savedAlertColors: normalizeSavedAlertColors(source.savedAlertColors),
    fontSizeKey: normalizeTimerFontSizeKey(source.fontSizeKey),
    alertFontFamily: normalizeTimerFontFamily(source.alertFontFamily),
    alertFontWeight: normalizeTimerFontWeight(source.alertFontWeight),
    alertShadowEnabled: source.alertShadowEnabled !== false,
    alertDurationSeconds: normalizeAlertDisplayDurationSeconds(source.alertDurationSeconds),
    reminderEnabled: Boolean(source.reminderEnabled),
    reminderDelaySeconds: normalizeAlertReminderDelaySeconds(source.reminderDelaySeconds),
    reminderRepeatCount: normalizeAlertReminderRepeatCount(source.reminderRepeatCount),
    volumePercent,
    volumeMuted,
    showVisualAlert: source.showVisualAlert !== false,
    retriggerEnabled: source.retriggerEnabled !== undefined
      ? Boolean(source.retriggerEnabled)
      : Boolean(source.repeatEnabled),
    locked: Boolean(source.locked),
    alertPositionX: normalizeOptionalNumber(source.alertPositionX),
    alertPositionY: normalizeOptionalNumber(source.alertPositionY),
    hotkeyLabel: normalizeTimerHotkeyLabel(source.hotkeyLabel),
    hotkeyKeyCode: clampInteger(source.hotkeyKeyCode, 0, 255, 0),
    hotkeyModifiers: clampInteger(source.hotkeyModifiers, 0, 15, 0),
    hotkey: normalizeTimerHotkey(source.hotkey)
  };
}

export function normalizeOverlayTimerEntry(rawTimer) {
  if (!rawTimer || typeof rawTimer !== "object") {
    return null;
  }

  const volumePercent = clampInteger(rawTimer.volumePercent, TIMER_VOLUME_MIN, TIMER_VOLUME_MAX, 100);
  const volumeMuted = Boolean(rawTimer.volumeMuted) || volumePercent <= 0;
  // Compatibility repair:
  // older alert-state writes could persist enabled=false while keeping a live
  // volume value and unmuted flag. In practice that breaks hotkey dispatch
  // after reload even though the card still looks configured. We canonicalize
  // audio-enabled timers from the audible state itself.
  const enabled = !volumeMuted && volumePercent > 0;

  return {
    id: typeof rawTimer.id === "string" && rawTimer.id.trim() ? rawTimer.id.trim() : null,
    name: normalizeTimerName(rawTimer.name),
    durationSeconds: clampInteger(rawTimer.durationSeconds, TIMER_DURATION_MIN_SECONDS, TIMER_DURATION_MAX_SECONDS, 60),
    soundKey: normalizeTimerSoundKey(rawTimer.soundKey),
    customSoundPath: typeof rawTimer.customSoundPath === "string" ? rawTimer.customSoundPath.trim() : "",
    message: normalizeTimerMessage(rawTimer.message),
    alertColor: normalizeTimerColor(rawTimer.alertColor),
    savedAlertColors: normalizeSavedAlertColors(rawTimer.savedAlertColors),
    fontSizeKey: normalizeTimerFontSizeKey(rawTimer.fontSizeKey),
    alertFontFamily: normalizeTimerFontFamily(rawTimer.alertFontFamily),
    alertFontWeight: normalizeTimerFontWeight(rawTimer.alertFontWeight),
    alertShadowEnabled: rawTimer.alertShadowEnabled !== false,
    alertDurationSeconds: normalizeAlertDisplayDurationSeconds(rawTimer.alertDurationSeconds),
    reminderEnabled: Boolean(rawTimer.reminderEnabled),
    reminderDelaySeconds: normalizeAlertReminderDelaySeconds(rawTimer.reminderDelaySeconds),
    reminderRepeatCount: normalizeAlertReminderRepeatCount(rawTimer.reminderRepeatCount),
    volumePercent,
    volumeMuted,
    showVisualAlert: rawTimer.showVisualAlert !== false,
    retriggerEnabled: rawTimer.retriggerEnabled !== undefined
      ? Boolean(rawTimer.retriggerEnabled)
      : Boolean(rawTimer.repeatEnabled),
    enabled,
    locked: Boolean(rawTimer.locked),
    alertPositionX: normalizeOptionalNumber(rawTimer.alertPositionX),
    alertPositionY: normalizeOptionalNumber(rawTimer.alertPositionY),
    hotkeyLabel: normalizeTimerHotkeyLabel(rawTimer.hotkeyLabel),
    hotkeyKeyCode: clampInteger(rawTimer.hotkeyKeyCode, 0, 255, 0),
    hotkeyModifiers: clampInteger(rawTimer.hotkeyModifiers, 0, 15, 0),
    hotkey: normalizeTimerHotkey(rawTimer.hotkey),
    createdAt: typeof rawTimer.createdAt === "string" ? rawTimer.createdAt : null,
    updatedAt: typeof rawTimer.updatedAt === "string" ? rawTimer.updatedAt : null
  };
}

export function createOverlayTimerEntryFromDraft(rawDraft, options = {}) {
  const draft = normalizeOverlayTimerDraft(rawDraft);
  const nowIso = typeof options.nowIso === "string" ? options.nowIso : createNowIso();
  const createdAt = typeof options.createdAt === "string" ? options.createdAt : nowIso;

  return normalizeOverlayTimerEntry({
    id: typeof options.id === "string" && options.id.trim() ? options.id.trim() : createOverlayTimerId(),
    ...draft,
    enabled: options.enabled === true,
    createdAt,
    updatedAt: nowIso
  });
}

export function isOverlayTimerDraftMeaningful(rawDraft) {
  const draft = normalizeOverlayTimerDraft(rawDraft);
  return Boolean(draft.name) || draft.durationSeconds !== 60 || Boolean(draft.hotkey.code) || Boolean(draft.message);
}

export function getOverlayTimerSummary(rawTimer) {
  const timer = normalizeOverlayTimerEntry(rawTimer);

  if (!timer) {
    return {
      label: "",
      subtitle: ""
    };
  }

  return {
    label: timer.name || "Sem nome",
    subtitle: `${formatOverlayTimerDuration(timer.durationSeconds)} - ${timer.showVisualAlert ? "alerta visual" : "sem alerta visual"}`
  };
}

export function formatOverlayTimerDuration(totalSeconds) {
  const safeSeconds = clampInteger(totalSeconds, TIMER_DURATION_MIN_SECONDS, TIMER_DURATION_MAX_SECONDS, 60);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${seconds}s`;
}

export function createOverlayTimerId() {
  return `timer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTimerHotkey(rawHotkey) {
  const source = rawHotkey && typeof rawHotkey === "object" ? rawHotkey : {};
  const modifiers = Array.isArray(source.modifiers)
    ? source.modifiers
      .map((entry) => String(entry || "").trim().toLowerCase())
      .filter((entry, index, list) => entry && list.indexOf(entry) === index)
    : [];

  return {
    code: typeof source.code === "string" ? source.code.trim() : "",
    modifiers
  };
}

function normalizeTimerHotkeyLabel(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 80);
}

function normalizeTimerName(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 80);
}

function normalizeTimerMessage(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 120);
}

function normalizeTimerSoundKey(value) {
  const key = typeof value === "string" ? value.trim() : "";
  return key || OVERLAY_TIMER_SOUND_DEFAULT;
}

function normalizeTimerColor(value) {
  const color = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#ff5d5d";
}

function normalizeSavedAlertColors(value) {
  const defaults = ["#ffffff", "#ff4444", "#0088ff", "#69df72"];
  const items = Array.isArray(value) ? value : [];
  const normalized = items
    .map((entry) => normalizeTimerColor(entry))
    .filter((entry, index, list) => entry && list.indexOf(entry) === index)
    .slice(0, 12);

  if (normalized.length > 0) {
    return normalized;
  }

  return defaults;
}

function normalizeTimerFontSizeKey(value) {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["small", "medium", "large", "x-large", "huge"].includes(key) ? key : "large";
}

function normalizeTimerFontFamily(value) {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
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

function normalizeTimerFontWeight(value) {
  const parsed = clampInteger(value, 400, 900, 700);
  const allowed = new Set([400, 500, 600, 700, 800, 900]);
  return allowed.has(parsed) ? parsed : 700;
}

function normalizeAlertDisplayDurationSeconds(value) {
  const parsed = Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(parsed)) {
    return ALERT_DISPLAY_DURATION_DEFAULT_SECONDS;
  }

  const clamped = Math.min(Math.max(parsed, ALERT_DISPLAY_DURATION_MIN_SECONDS), ALERT_DISPLAY_DURATION_MAX_SECONDS);
  return Math.round(clamped * 10) / 10;
}

function normalizeAlertReminderDelaySeconds(value) {
  return clampInteger(
    value,
    ALERT_REMINDER_DELAY_MIN_SECONDS,
    ALERT_REMINDER_DELAY_MAX_SECONDS,
    ALERT_REMINDER_DELAY_DEFAULT_SECONDS
  );
}

function normalizeAlertReminderRepeatCount(value) {
  return clampInteger(
    value,
    ALERT_REMINDER_REPEAT_MIN,
    ALERT_REMINDER_REPEAT_MAX,
    ALERT_REMINDER_REPEAT_DEFAULT
  );
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function normalizeOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createNowIso() {
  return new Date().toISOString();
}
