import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("free desktop mode restores a saved account at startup and fails closed when unavailable", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(source, /desktopAccountConnected:\s*false/);
  assert.match(source, /desktopAccountEntitlements:\s*\[\]/);
  // The app may await the restoration so an already-authorized user does not
  // briefly see the Login state.  `refreshDesktopAccountState` itself is
  // fail-closed, therefore a missing account bridge or failed request still
  // leaves the desktop usable in free mode.
  assert.match(source, /if \(isDesktopOverlayApp\(\)\) \{\s*(?:\/\/[^\n]*\n\s*)*await refreshDesktopAccountState\(\);/);
  assert.match(source, /if \(!window\.desktopApi\?\.account\?\.getState\) \{\s*state\.desktopAccountConnected = false;/);
  assert.match(source, /const getAccountState = options\.refreshAds[\s\S]*window\.desktopApi\.account\.getState/);
  assert.match(source, /const account = await getAccountState\?\.\(\)/);
  assert.match(source, /\} catch \{\s*state\.desktopAccountConnected = false;[\s\S]*state\.desktopAccountEntitlements = \[\]/);
});
