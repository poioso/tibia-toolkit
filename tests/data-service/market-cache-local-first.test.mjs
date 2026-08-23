import assert from "node:assert/strict";
import test from "node:test";

import {
  configureDataService,
  handleDataServiceMessage
} from "../../lib/data/data-service.js";

test("Stash rebuilds a local-first market snapshot from persisted batches", async () => {
  const now = Date.now();
  let store = {
    "market-values:antica:100,101": {
      timestamp: now,
      value: [
        {
          id: 100,
          sell_offer: 250,
          buy_offer: 200,
          sell_offers: 1,
          buy_offers: 1,
          time: "2026-08-20T19:00:00.000Z"
        },
        {
          id: 101,
          sell_offer: 9000,
          buy_offer: 8000,
          sell_offers: 1,
          buy_offers: 1,
          time: "2026-08-20T19:00:00.000Z"
        }
      ]
    }
  };

  configureDataService({
    marketApiBase: "https://tibiatoolkit.com/api/app-market",
    async storageGet(key) {
      if (key === null) return { ...store };
      if (Array.isArray(key)) return Object.fromEntries(key.map((entry) => [entry, store[entry]]));
      return { [key]: store[key] };
    },
    async storageSet(value) {
      store = { ...store, ...value };
    },
    async storageRemove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
    }
  });

  const values = await handleDataServiceMessage({
    type: "fetch-stash-market-values",
    payload: { worldSlug: "antica", loadAllCached: true, localOnly: true }
  });

  assert.equal(values["100"].current, 250);
  assert.equal(values["101"].current, 9000);
  assert.ok(store["market-world:antica"]);
  assert.equal(Object.keys(store["market-world:antica"].value.values).length, 2);
});
