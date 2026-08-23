export const FREE_MIRROR_LIMIT = 10;
export const MIRROR_VIP_ENTITLEMENT = "ads.remove";
export const VIP_MIRROR_WARNING_THRESHOLD = 10;
export const VIP_MIRROR_DANGER_THRESHOLD = 20;
export const MIRROR_SCOPES = ["tibia", "rubinot", "medivia", "obs"];

export function normalizeMirrorScope(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return MIRROR_SCOPES.includes(normalized) ? normalized : "tibia";
}

export function getMirrorScope(entry) {
  return entry?.sourceType === "obs-window"
    ? "obs"
    : normalizeMirrorScope(entry?.sourceGame);
}

export function countMirrorRegionsByScope(items) {
  const counts = Object.fromEntries(MIRROR_SCOPES.map((scope) => [scope, 0]));
  for (const entry of Array.isArray(items) ? items : []) {
    const scope = getMirrorScope(entry);
    counts[scope] += 1;
  }
  return counts;
}

// A VIP account may have more saved mirrors than the Free limit.  Those
// records are deliberately preserved when the entitlement ends, but only the
// first available ten regular-game mirrors per scope may remain visible. OBS
// is a separate technical output and is not part of the per-game allowance.
export function getEffectivelyVisibleMirrorItems(items, accountState) {
  const source = Array.isArray(items) ? items : [];
  if (hasUnlimitedMirrorAccess(accountState)) {
    return source;
  }

  const visibleByScope = Object.fromEntries(
    MIRROR_SCOPES.filter((scope) => scope !== "obs").map((scope) => [scope, 0])
  );

  return source.map((entry) => {
    const scope = getMirrorScope(entry);
    if (scope === "obs" || entry?.isVisible === false) {
      return entry;
    }

    if (visibleByScope[scope] >= FREE_MIRROR_LIMIT) {
      return {
        ...entry,
        isVisible: false
      };
    }

    visibleByScope[scope] += 1;
    return entry;
  });
}

export function countEffectivelyVisibleMirrorRegionsByScope(items, accountState) {
  const counts = Object.fromEntries(MIRROR_SCOPES.map((scope) => [scope, 0]));
  for (const entry of getEffectivelyVisibleMirrorItems(items, accountState)) {
    if (entry?.isVisible === false) {
      continue;
    }
    counts[getMirrorScope(entry)] += 1;
  }
  return counts;
}

function normalizeMirrorCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
}

export function hasUnlimitedMirrorAccess(accountState) {
  return accountState?.connected === true
    && Array.isArray(accountState.entitlements)
    && accountState.entitlements.includes(MIRROR_VIP_ENTITLEMENT);
}

export function getMirrorRegionLimit(accountState) {
  return hasUnlimitedMirrorAccess(accountState) ? Infinity : FREE_MIRROR_LIMIT;
}

export function canCreateMirrorRegion(currentCount, accountState) {
  return normalizeMirrorCount(currentCount) < getMirrorRegionLimit(accountState);
}

export function getVipMirrorLoadTone(currentCount, accountState) {
  if (!hasUnlimitedMirrorAccess(accountState)) {
    return "";
  }

  const count = normalizeMirrorCount(currentCount);
  if (count >= VIP_MIRROR_DANGER_THRESHOLD) {
    return "danger";
  }
  if (count >= VIP_MIRROR_WARNING_THRESHOLD) {
    return "warning";
  }
  return "";
}

export function formatMirrorRegionCount(currentCount, accountState) {
  const count = normalizeMirrorCount(currentCount);
  const limit = getMirrorRegionLimit(accountState);
  return `${count}/${limit === Infinity ? "∞" : limit}`;
}
