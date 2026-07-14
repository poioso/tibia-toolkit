import { normalizeTokenDraft, normalizeOtpType } from "./totp-core.js";

export const AUTHENTICATOR_LABEL_MAX_LENGTH = 80;
export const AUTHENTICATOR_SECRET_MAX_LENGTH = 128;

export function createDefaultOverlayAuthenticatorState() {
  return {
    items: []
  };
}

export function createDefaultOverlayAuthenticatorDraft() {
  return {
    label: "",
    secret: "",
    otpType: ""
  };
}

export function normalizeOverlayAuthenticatorState(rawState, nowIso = createNowIso()) {
  const source = rawState && typeof rawState === "object" ? rawState : {};

  return {
    items: Array.isArray(source.items)
      ? source.items.map((entry) => normalizeOverlayAuthenticatorEntry(entry, nowIso)).filter(Boolean)
      : []
  };
}

export function normalizeOverlayAuthenticatorEntry(entry, nowIso = createNowIso()) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const id = typeof entry.id === "string" ? entry.id.trim().slice(0, 80) : "";

  if (!id) {
    return null;
  }

  const draft = {
    label: String(entry.label || "").slice(0, AUTHENTICATOR_LABEL_MAX_LENGTH),
    secret: String(entry.secret || "").slice(0, AUTHENTICATOR_SECRET_MAX_LENGTH),
    otpType: normalizeOtpType(entry.otpType),
    counter: clampInteger(entry.counter, 0, Number.MAX_SAFE_INTEGER, 0),
    digits: 6,
    period: 30,
    algorithm: "SHA-1"
  };

  try {
    const normalized = normalizeTokenDraft(draft);
    return {
      id,
      label: normalized.label.slice(0, AUTHENTICATOR_LABEL_MAX_LENGTH),
      secret: normalized.secret.slice(0, AUTHENTICATOR_SECRET_MAX_LENGTH),
      otpType: normalized.otpType,
      counter: normalized.counter,
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : nowIso
    };
  } catch (_error) {
    return null;
  }
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function createNowIso() {
  return new Date().toISOString();
}
