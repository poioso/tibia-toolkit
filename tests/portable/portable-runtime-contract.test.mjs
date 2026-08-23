import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const mainSource = await fs.readFile(path.join(projectRoot, "desktop", "main.js"), "utf8");
const builderConfig = JSON.parse(await fs.readFile(path.join(projectRoot, "desktop", "electron-builder-portable.json"), "utf8"));

test("portable runtime is marker-gated and isolated", () => {
  assert.match(mainSource, /portable-test\.json/);
  assert.match(mainSource, /poioso-screen-vision-portable-test/);
  assert.match(mainSource, /com\.poioso\.tibia-toolkit\.portable-test/);
  assert.match(mainSource, /allowsRemoteContentPack = !isPortableTestRuntime/);
  assert.match(mainSource, /allowsRemoteLibrarySync = !isPortableTestRuntime/);
  assert.match(mainSource, /usesProductionAuthentication = isProductionRuntime \|\| isPortableTestRuntime/);
  assert.match(mainSource, /content-pack-ready source=portable/);
  assert.match(
    mainSource,
    /if \(isPortableTestRuntime\) return "https:\/\/tibiatoolkit\.com";/,
    "Portable public website data must not depend on local homologation."
  );
  assert.match(mainSource, /desktop-ads-fallback source=portable-public/);
});

test("portable storage separates machine-protected values", () => {
  assert.match(mainSource, /portableProtectedStorageKeys/);
  assert.match(mainSource, /secure-storage\.json/);
  assert.match(mainSource, /path\.join\(portableDataRoot, "AppData"\)/);
  assert.match(mainSource, /path\.join\(portableDataRoot, "Documents"\)/);
});

test("portable builder excludes local and private material", () => {
  const filters = builderConfig.files.join("\n");
  assert.match(filters, /auth-homologation\.local\.json/);
  assert.match(filters, /main\.corrupted-/);
  assert.match(filters, /\.env/);
  assert.match(filters, /ACESSOS/);
  assert.equal(builderConfig.appId, "com.poioso.tibia-toolkit.portable-test");
  assert.equal(builderConfig.win.executableName, "Tibia Toolkit Portable");
});
