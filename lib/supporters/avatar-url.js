const SUPPORTER_AVATAR_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

function originOf(value) {
  try {
    return new URL(String(value || "")).origin;
  } catch {
    return "";
  }
}

/**
 * Resolves the public account-avatar origin from the supporter source that
 * actually answered. This matters in development: a local API may be down,
 * while the public supporters API still returns a valid relative avatar URL.
 */
export function resolveSupporterAvatarBaseUrl(sourceUrl, fallbackBaseUrl) {
  try {
    const source = new URL(String(sourceUrl || ""));
    if (/\/api\/supporters\/?$/i.test(source.pathname)) {
      return source.origin;
    }
  } catch {
    // Use the configured account/site origin below.
  }
  return originOf(fallbackBaseUrl);
}

export function normalizeSupporterAvatarUrl({ value = "", avatarAssetId = "", sourceUrl = "", fallbackBaseUrl = "" } = {}) {
  const avatarBaseUrl = resolveSupporterAvatarBaseUrl(sourceUrl, fallbackBaseUrl);
  if (!avatarBaseUrl) return "";

  let avatarId = SUPPORTER_AVATAR_UUID_PATTERN.test(String(avatarAssetId || "").trim())
    ? String(avatarAssetId).trim()
    : "";

  try {
    const parsed = String(value || "").trim()
      ? new URL(String(value).trim(), avatarBaseUrl)
      : null;
    const isSupportedPath = parsed
      && ["/account-api/product/avatar/public", "/api/product/avatar/public"].includes(parsed.pathname.replace(/\/$/, ""));

    if (parsed && isSupportedPath) {
      const candidateId = String(parsed.searchParams.get("id") || "").trim();
      if (SUPPORTER_AVATAR_UUID_PATTERN.test(candidateId)) {
        avatarId = candidateId;
      }
    }
  } catch {
    return "";
  }

  return avatarId
    ? new URL(`/account-api/product/avatar/public?id=${encodeURIComponent(avatarId)}`, avatarBaseUrl).href
    : "";
}
