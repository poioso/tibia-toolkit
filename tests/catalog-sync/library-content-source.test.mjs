import assert from "node:assert/strict";
import test from "node:test";
import { resolveLibraryContentSource } from "../../desktop/config/library-content-source.js";

test("development defaults to homologation and can explicitly read production", () => {
  const homologation = resolveLibraryContentSource({
    isProductionRuntime: false,
    accountSiteBaseUrl: "http://homologacao.localhost:3042",
    accountAuthBaseUrl: "http://127.0.0.1:3142",
    environment: {}
  });
  assert.equal(homologation.mode, "homologation");
  assert.equal(homologation.siteBaseUrl, "http://homologacao.localhost:3042");
  const live = resolveLibraryContentSource({
    isProductionRuntime: false,
    accountSiteBaseUrl: "http://homologacao.localhost:3042",
    accountAuthBaseUrl: "http://127.0.0.1:3142",
    environment: { TIBIA_TOOLKIT_LIBRARY_SOURCE_MODE: "production-readonly" }
  });
  assert.deepEqual(live, {
    mode: "production-readonly",
    readOnly: true,
    siteBaseUrl: "https://tibiatoolkit.com",
    apiBaseUrl: "https://auth.tibiatoolkit.com"
  });
});
