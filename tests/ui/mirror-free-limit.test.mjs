import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FREE_MIRROR_LIMIT,
  MIRROR_VIP_ENTITLEMENT,
  canCreateMirrorRegion,
  countEffectivelyVisibleMirrorRegionsByScope,
  countMirrorRegionsByScope,
  formatMirrorRegionCount,
  getEffectivelyVisibleMirrorItems,
  getVipMirrorLoadTone,
  hasUnlimitedMirrorAccess
} from "../../lib/overlay/mirror-limits.js";

const rendererSource = await readFile(
  new URL("../../desktop/screen-vision/screen-vision.js", import.meta.url),
  "utf8"
);
const mainSource = await readFile(new URL("../../desktop/main.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");

test("Free accounts have ten mirrors and VIP accounts remain unlimited", () => {
  const free = { connected: false, entitlements: [] };
  const vip = { connected: true, entitlements: [MIRROR_VIP_ENTITLEMENT] };

  assert.equal(FREE_MIRROR_LIMIT, 10);
  assert.equal(hasUnlimitedMirrorAccess(free), false);
  assert.equal(hasUnlimitedMirrorAccess(vip), true);
  assert.equal(canCreateMirrorRegion(9, free), true);
  assert.equal(canCreateMirrorRegion(10, free), false);
  assert.equal(canCreateMirrorRegion(100, vip), true);
  assert.equal(formatMirrorRegionCount(0, free), "0/10");
  assert.equal(formatMirrorRegionCount(10, free), "10/10");
  assert.equal(formatMirrorRegionCount(17, free), "17/10");
  assert.equal(formatMirrorRegionCount(17, vip), "17/∞");
  assert.equal(getVipMirrorLoadTone(9, free), "");
  assert.equal(getVipMirrorLoadTone(10, free), "");
  assert.equal(getVipMirrorLoadTone(10, vip), "warning");
  assert.equal(getVipMirrorLoadTone(19, vip), "warning");
  assert.equal(getVipMirrorLoadTone(20, vip), "danger");

  const counts = countMirrorRegionsByScope([
    { sourceGame: "tibia" },
    { sourceGame: "tibia" },
    { sourceGame: "rubinot" },
    { sourceGame: "medivia" },
    { sourceType: "obs-window" }
  ]);
  assert.deepEqual(counts, { tibia: 2, rubinot: 1, medivia: 1, obs: 1 });
  assert.equal(canCreateMirrorRegion(counts.tibia, free), true);
  assert.equal(canCreateMirrorRegion(10, free), false);
});

test("Free keeps VIP-created mirrors saved but limits effective visibility per game", () => {
  const free = { connected: false, entitlements: [] };
  const vip = { connected: true, entitlements: [MIRROR_VIP_ENTITLEMENT] };
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: `tibia-${index + 1}`,
    sourceGame: "tibia",
    isVisible: true
  })).concat({ id: "rubinot-1", sourceGame: "rubinot", isVisible: true });

  const limited = getEffectivelyVisibleMirrorItems(items, free);
  assert.equal(limited.length, items.length);
  assert.equal(limited.filter((entry) => entry.sourceGame === "tibia" && entry.isVisible).length, 10);
  assert.equal(limited[10].isVisible, false);
  assert.equal(limited[12].isVisible, true);
  assert.deepEqual(countEffectivelyVisibleMirrorRegionsByScope(items, free), {
    tibia: 10,
    rubinot: 1,
    medivia: 0,
    obs: 0
  });
  assert.equal(getEffectivelyVisibleMirrorItems(items, vip).filter((entry) => entry.isVisible).length, items.length);

  const withOneDisabled = items.map((entry, index) => index === 4 ? { ...entry, isVisible: false } : entry);
  const promoted = getEffectivelyVisibleMirrorItems(withOneDisabled, free);
  assert.equal(promoted.filter((entry) => entry.sourceGame === "tibia" && entry.isVisible).length, 10);
  assert.equal(promoted[10].isVisible, true);
});

test("the limit is linked to the account entitlement and enforced at both UI and storage boundaries", () => {
  assert.match(rendererSource, /formatMirrorRegionCount\(count, mirrorAccountState\)/);
  assert.match(rendererSource, /blockMirrorCreationAtLimit\(els\.addRegionButton\)/);
  assert.match(rendererSource, /blockMirrorCreationAtLimit\(els\.cropToolButton\)/);
  assert.match(rendererSource, /blockMirrorCreationAtLimit\(els\.obsWindowMirrorButton, "obs"\)/);
  assert.match(rendererSource, /screenVision\.mirrorLimitReached/);
  assert.match(rendererSource, /getVipMirrorLoadTone\(count, mirrorAccountState\)/);
  assert.match(rendererSource, /screenVision\.mirrorFreeSpacesTooltip/);
  assert.match(rendererSource, /openFreeMirrorSupportPanel\(\)/);
  assert.match(rendererSource, /buy-me-a-coffee-panel/);
  assert.match(rendererSource, /screenVision\.mirrorVipLoadWarning/);
  assert.match(rendererSource, /screenVision\.mirrorVipLoadDanger/);
  assert.match(mainSource, /canCreateMirrorRegion\(scopeCount, accountState\)/);
  assert.match(mainSource, /syncMirrorVisibilityForAccountState\(disconnectedAccount, "account-disconnected"\)/);
  assert.match(mainSource, /countEffectivelyVisibleMirrorRegionsByScope/);
  assert.match(mainSource, /getEffectivelyVisibleMirrorItems/);
  assert.match(mainSource, /countMirrorRegionsByScope\(overlayToolsState\.mirrors\.items\)/);
  assert.match(rendererSource, /getMirrorRegionCountForScope\(getActiveMirrorSourceGame\(\)\)/);
  assert.match(mainSource, /reason: "mirror-limit-reached"/);
  assert.match(mainSource, /totalCount: currentItems\.length/);
  assert.match(rendererSource, /tibia-toolkit:account-state-changed/);
  assert.match(rendererSource, /visibleRegionCountsByScope/);
  assert.match(rendererSource, /getVisibleMirrorRegionCountForScope/);
  assert.match(appSource, /scheduleDesktopAccountEntitlementRefresh/);
});
