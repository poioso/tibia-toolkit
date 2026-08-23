import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isLocalHomologationRuntime, isProtectedLocalTestEmail } from "../prototypes/auth-foundation/lib/product-auth.js";

test("unpackaged Electron can consume only an ignored loopback homologation lane", async () => {
  const [main, launcher, ignore] = await Promise.all([
    readFile(new URL("../desktop/main.js", import.meta.url), "utf8"),
    readFile(new URL("../prototypes/auth-foundation/scripts/start-local-homologation.ps1", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
  ]);

  assert.match(main, /readLocalHomologationAccountConfig/);
  assert.match(main, /auth-homologation\.local\.json/);
  assert.match(main, /localHomologation\.authBaseUrl/);
  assert.match(main, /localHomologation\.siteBaseUrl/);
  assert.match(main, /usesProductionAuthentication\) return \{\}/);
  assert.match(main, /\^https\?:\\\/\\\/127\\\.0\\\.0\\\.1:\\d\+\$/);
  assert.match(main, /\^https\?:\\\/\\\/\[a-z0-9-\]\+\\\.localhost:\\d\+\$/);
  assert.match(launcher, /desktop\\auth-homologation\.local\.json/);
  assert.match(launcher, /authBaseUrl = "http:\/\/127\.0\.0\.1:\$AuthPort"/);
  assert.match(launcher, /siteBaseUrl = "http:\/\/\$TestHost`:\$DeviceVerificationPort"/);
  assert.match(ignore, /desktop\/auth-homologation\.local\.json/);
});

test("local homologation protects the test account and never reuses an unverified auth lane", async () => {
  const [productAuth, accountClosure, adminClosures, launcher, localServer] = await Promise.all([
    readFile(new URL("../prototypes/auth-foundation/lib/product-auth.js", import.meta.url), "utf8"),
    readFile(new URL("../prototypes/auth-foundation/app/api/product/account/closure/route.js", import.meta.url), "utf8"),
    readFile(new URL("../prototypes/auth-foundation/app/api/product/admin/closures/route.js", import.meta.url), "utf8"),
    readFile(new URL("../prototypes/auth-foundation/scripts/start-local-homologation.ps1", import.meta.url), "utf8"),
    readFile(new URL("../prototypes/auth-foundation/scripts/local-auth-server.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(productAuth, /LOCAL_PROTECTED_TEST_EMAILS/);
  assert.match(productAuth, /LOCAL_PGLITE_PATH/);
  assert.match(accountClosure, /protected_local_test_user/);
  assert.match(adminClosures, /protected_local_test_user/);
  assert.match(launcher, /LOCAL_AUTH_HOMOLOGATION = "true"/);
  assert.match(launcher, /LOCAL_PROTECTED_TEST_EMAILS = "montenegr0\.luan@gmail\.com"/);
  assert.match(launcher, /Refusing to reuse auth PID/);
  assert.match(launcher, /pglitePathName -ne \$expectedPglitePathName/);
  assert.match(localServer, /homologationLane:/);
  assert.match(localServer, /protectedLocalTestAccount/);
});

test("the protected account rule is local-only", () => {
  const previousPath = process.env.LOCAL_PGLITE_PATH;
  const previousRemote = process.env.LOCAL_AUTH_REMOTE_POSTGRES;
  const previousEmails = process.env.LOCAL_PROTECTED_TEST_EMAILS;
  try {
    process.env.LOCAL_PGLITE_PATH = "C:/local-homologation";
    delete process.env.LOCAL_AUTH_REMOTE_POSTGRES;
    process.env.LOCAL_PROTECTED_TEST_EMAILS = "montenegr0.luan@gmail.com";
    assert.equal(isLocalHomologationRuntime(), true);
    assert.equal(isProtectedLocalTestEmail("MONTENEGR0.LUAN@GMAIL.COM"), true);

    delete process.env.LOCAL_PGLITE_PATH;
    delete process.env.LOCAL_AUTH_REMOTE_POSTGRES;
    assert.equal(isLocalHomologationRuntime(), false);
    assert.equal(isProtectedLocalTestEmail("montenegr0.luan@gmail.com"), false);
  } finally {
    if (previousPath === undefined) delete process.env.LOCAL_PGLITE_PATH;
    else process.env.LOCAL_PGLITE_PATH = previousPath;
    if (previousRemote === undefined) delete process.env.LOCAL_AUTH_REMOTE_POSTGRES;
    else process.env.LOCAL_AUTH_REMOTE_POSTGRES = previousRemote;
    if (previousEmails === undefined) delete process.env.LOCAL_PROTECTED_TEST_EMAILS;
    else process.env.LOCAL_PROTECTED_TEST_EMAILS = previousEmails;
  }
});

test("desktop device authorization always targets the account page, never the auth API route", async () => {
  const main = await readFile(new URL("../desktop/main.js", import.meta.url), "utf8");

  assert.match(main, /received\.pathname === "\/conta\/dispositivo"/);
  assert.match(main, /accepting `\/device`[\s\S]{0,220}JSON 404/);
  assert.doesNotMatch(main, /received\.pathname === "\/device"/);
});

test("account and report panels retain ownership of the shared dock while it transitions", async () => {
  const [app, screenVision] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../desktop/screen-vision/screen-vision.js", import.meta.url), "utf8"),
  ]);

  assert.match(app, /async function openDesktopReportPanel\(\)/);
  assert.match(app, /renderDesktopReportPanelIntoDockedShell\(\)/);
  assert.match(app, /tibia-toolkit:docked-panel-rendered/);
  assert.match(screenVision, /const ownsSharedHost = \[appOwnedPanelKey, panelState\.panelKey, previouslyOwnedPanelKey\]/);
  assert.match(screenVision, /\["account-panel", "report-panel"\]\.includes\(panelKey\)/);
  assert.match(screenVision, /if \(ownsSharedHost\) \{[\s\S]{0,300}return;/);
});

test("docked panel back navigation only returns from My Account and otherwise closes", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(app, /state\.desktopDockedPanelReturnKey = normalizedPanelKey === "account-panel"\s+\? "settings-panel"\s+: ""/);
  assert.match(app, /function handleDesktopDockedPanelClose\(\)/);
  assert.match(app, /if \(currentPanelKey === "account-panel"\) \{[\s\S]{0,220}requestDesktopDockedPanel\("settings-panel"\)/);
  assert.match(app, /const closePanel = window\.desktopApi\?\.screenVisionApi\?\.tools\?\.close/);
  assert.match(app, /closePanel\(currentPanelKey\)/);
});
