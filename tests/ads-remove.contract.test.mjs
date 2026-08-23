import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ads.remove gates website inventory before third-party media is created", async () => {
  const [slots, layout, legal] = await Promise.all([
    readFile(new URL("../site/app/AdSlots.tsx", import.meta.url), "utf8"),
    readFile(new URL("../site/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../site/app/LegalConsent.tsx", import.meta.url), "utf8"),
  ]);
  const genericSlot = slots.slice(slots.indexOf("export function GenericAdSlot"));
  assert.match(genericSlot, /if \(adsVisible !== true\) return null;[\s\S]*return <LiveAdSlot/);
  assert.match(slots, /function LiveAdSlot[\s\S]*ensureAdsenseScript\(\)/);
  assert.match(slots, /const refresh = \(\) => setAccepted\(Boolean\(getCurrentLegalAcceptance\(\)\)\);/);
  assert.match(slots, /return accepted === true && adsRemoved === false;/);
  assert.match(slots, /window\.addEventListener\(LEGAL_ACCEPTANCE_EVENT, refresh\)/);
  assert.match(legal, /window\.dispatchEvent\(new Event\(LEGAL_ACCEPTANCE_EVENT\)\)/);
  assert.match(slots, /if \(adsVisible !== true \|\| pair === null\) return null/);
  assert.doesNotMatch(layout, /pagead2\.googlesyndication/);
});

test("ads.remove removes desktop campaign UI without embedding third-party ad inventory", async () => {
  const [source, main] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.js", import.meta.url), "utf8"),
  ]);
  assert.match(source, /VIP removes advertising, not access to the Tibia Coins purchase panel/);
  assert.match(source, /button\.hidden = false;[\s\S]*button\.disabled = false/);
  assert.doesNotMatch(source, /adsbygoogle|pagead2\.googlesyndication/);
  assert.match(main, /if \(payload\?\.authenticated !== true\) \{\s*await clearSavedAccountAccessToken\(\)/);
  assert.match(main, /const hasExistingShowcase = Boolean\([\s\S]*desktopAdsShowcasePayload/);
  assert.match(main, /if \(!hasExistingShowcase\) \{\s*desktopAdsShowcaseReady = false;/);
  assert.match(main, /accountState\.entitlements\.includes\("ads\.remove"\)/);
  assert.match(main, /if \(hasAdsRemoval\) \{\s*closeDesktopAdsShowcase\(\)/);
  assert.match(main, /const canKeepExistingShowcase = Boolean\([\s\S]*desktopAdsShowcasePayload/);
  assert.match(main, /if \(!canKeepExistingShowcase\) \{\s*desktopAdsShowcasePayload = null/);
  assert.match(main, /ipcMain\.handle\("account:connect", async \(\) => \{[\s\S]*?refreshDesktopAdsShowcase\(account\)/);
});

test("desktop logout commits free ads before remote device revocation finishes", async () => {
  const main = await readFile(new URL("../desktop/main.js", import.meta.url), "utf8");
  const handlerStart = main.indexOf('ipcMain.handle("account:disconnect"');
  const handlerEnd = main.indexOf('ipcMain.handle("maps:open"', handlerStart);
  const disconnectStart = main.indexOf("async function disconnectAccount()");
  const disconnectEnd = main.indexOf("async function getAccountState()", disconnectStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  assert.ok(disconnectStart >= 0 && disconnectEnd > disconnectStart);

  const handler = main.slice(handlerStart, handlerEnd);
  const disconnect = main.slice(disconnectStart, disconnectEnd);
  assert.match(handler, /const disconnectedAccount = \{ connected: false, entitlements: \[\], benefits: \[\] \}/);
  assert.match(handler, /accountSessionRevision \+= 1/);
  assert.match(handler, /refreshDesktopAdsShowcase\(disconnectedAccount\)/);
  assert.match(handler, /Promise\.all\(\[[\s\S]*refreshDesktopAdsShowcase\(disconnectedAccount\)[\s\S]*remoteRevocation/);
  assert.ok(
    disconnect.indexOf("await clearSavedAccountAccessToken()") < disconnect.indexOf("electronNet.fetch"),
    "local account state must be cleared before remote revocation",
  );
  assert.match(disconnect, /return \{ remoteRevocation \}/);

  const refreshStart = main.indexOf('ipcMain.handle("account:refresh"');
  const refreshEnd = main.indexOf('ipcMain.handle("account:get-campaigns"', refreshStart);
  const refresh = main.slice(refreshStart, refreshEnd);
  assert.match(refresh, /const requestedRevision = accountSessionRevision/);
  assert.match(refresh, /if \(requestedRevision !== accountSessionRevision\) \{\s*const disconnectedAccount = \{ connected: false, entitlements: \[\], benefits: \[\] \};[\s\S]*return disconnectedAccount;/);
});
