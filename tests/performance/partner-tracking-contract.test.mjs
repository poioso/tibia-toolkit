import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Daniel Hatano purchase and ad links use the Tibia Toolkit coupon", async () => {
  const [panel, app, ads, desktopAds, supporters, admin] = await Promise.all([
    source("desktop/screen-vision/screen-vision.js"),
    source("app.js"),
    source("site/app/AdSlots.tsx"),
    source("site/app/api/desktop-ads/route.ts"),
    source("site/app/api/supporters/route.ts"),
    source("site/app/conta/admin/conteudo/AdminContentPage.tsx"),
  ]);

  for (const value of [panel, app, ads, desktopAds, supporters, admin]) {
    assert.doesNotMatch(value, /tracking=TibiaTools/);
  }
  assert.match(panel, /const TIBIA_COINS_TRACKING = "tibiatoolkit"/);
  assert.match(app, /searchParams\.set\("tracking", "tibiatoolkit"\)/);
  assert.match(ads, /function partnerDestination/);
  assert.match(desktopAds, /tracking=tibiatoolkit/);
  assert.match(supporters, /searchParams\.set\("tracking", "tibiatoolkit"\)/);
  assert.match(admin, /tracking=tibiatoolkit/);
});
