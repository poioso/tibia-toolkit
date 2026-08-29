import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  configureDataService,
  handleDataServiceMessage,
  resetLibraryContentCaches,
} from "../../lib/data/data-service.js";
import { ALL_IMBUEMENT_INGREDIENT_NAMES } from "../../lib/data/imbuements-data.js";

test("all Imbuement images resolve from one bounded local index build", async () => {
  const assetReads = [];
  resetLibraryContentCaches();
  configureDataService({
    async readJsonAsset(relativePath) {
      assetReads.push(relativePath);
      const fileUrl = new URL(`../../${relativePath}`, import.meta.url);
      return JSON.parse(await readFile(fileUrl, "utf8"));
    },
  });

  const metadata = await handleDataServiceMessage({
    type: "fetch-ingredient-metadata",
    payload: { names: ALL_IMBUEMENT_INGREDIENT_NAMES },
  });

  assert.equal(Object.keys(metadata).length, new Set(ALL_IMBUEMENT_INGREDIENT_NAMES).size);
  assert.ok(assetReads.length < 20, `unexpected per-item asset reads: ${assetReads.length}`);
  assert.equal(assetReads.filter((entry) => entry === "assets/library/catalogs/item-metadata.json").length, 1);
  assert.equal(assetReads.filter((entry) => entry === "assets/library/catalogs/item-details.json").length, 1);
  assert.deepEqual(
    Object.entries(metadata).filter(([, entry]) => !entry?.slug || !entry?.imageSrc),
    [],
  );
});
