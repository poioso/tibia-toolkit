import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  configureDataService,
  handleDataServiceMessage,
} from "../../lib/data/data-service.js";

const profiles = {
  Poioso: { name: "Poioso", level: 382, vocation: "Elite Knight", sex: "male", world: "Honbra" },
  "Poioso Curandeiro": { name: "Poioso Curandeiro", level: 104, vocation: "Elder Druid", sex: "male", world: "Honbra" },
  "Poioso Atirador": { name: "Poioso Atirador", level: 56, vocation: "Royal Paladin", sex: "male", world: "Honbra" },
};

test("character lookups replace poisoned legacy misses, retry bursts and persist only valid profiles", async () => {
  const storage = {
    "character-profile:poioso": {
      timestamp: Date.now(),
      value: { profile: null },
    },
  };
  const attempts = new Map();
  let activeRequests = 0;
  let maximumActiveRequests = 0;
  const originalFetch = globalThis.fetch;

  configureDataService({
    async storageGet(key) {
      return key === null ? { ...storage } : { [key]: storage[key] };
    },
    async storageSet(values) {
      Object.assign(storage, values);
    },
    async storageRemove(key) {
      delete storage[key];
    },
  });

  globalThis.fetch = async (url) => {
    const name = decodeURIComponent(String(url).split("/").pop());
    const attempt = (attempts.get(name) || 0) + 1;
    attempts.set(name, attempt);
    activeRequests += 1;
    maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
    await new Promise((resolve) => setTimeout(resolve, 8));
    activeRequests -= 1;

    if (name !== "Poioso Atirador" && attempt === 1) {
      return new Response("temporarily unavailable", { status: 503 });
    }

    const profile = profiles[name];
    return Response.json({
      character: {
        character: {
          ...profile,
          guild: { name: name === "Poioso" ? "Honbra Alliance" : "" },
        },
      },
    });
  };

  try {
    const result = await handleDataServiceMessage({
      type: "fetch-character-profiles",
      payload: { names: Object.keys(profiles) },
    });

    assert.equal(result.Poioso.vocation, "Elite Knight");
    assert.equal(result["Poioso Curandeiro"].vocation, "Elder Druid");
    assert.equal(result["Poioso Atirador"].vocation, "Royal Paladin");
    assert.ok(maximumActiveRequests <= 2, `expected at most 2 simultaneous requests, received ${maximumActiveRequests}`);
    assert.equal(attempts.get("Poioso"), 2);
    assert.equal(attempts.get("Poioso Curandeiro"), 2);
    assert.equal(attempts.get("Poioso Atirador"), 1);
    assert.ok(storage["character-profile:v2:poioso"]?.value?.profile);
    assert.ok(storage["character-profile:v2:poioso curandeiro"]?.value?.profile);
    assert.ok(storage["character-profile:v2:poioso atirador"]?.value?.profile);
    assert.equal(storage["character-profile:poioso"].value.profile, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("all app and site character consumers use the shared hardened lookup", async () => {
  const [appSource, desktopMainSource, mirrorSource, findPartySource, lootAnalyzerSource, supporterRouteSource] = await Promise.all([
    readFile(new URL("../../app.js", import.meta.url), "utf8"),
    readFile(new URL("../../desktop/main.js", import.meta.url), "utf8"),
    readFile(new URL("../../desktop/screen-vision/screen-vision.js", import.meta.url), "utf8"),
    readFile(new URL("../../site/app/FindParty.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../site/app/LootAnalyzer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../site/app/api/supporters/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(appSource, /async function hydrateSupporterProfiles\(\)[\s\S]*?fetchCharacterProfiles/);
  assert.match(appSource, /async function enrichLootPlayerProfiles\(parsed\)[\s\S]*?fetchCharacterProfiles/);
  assert.match(appSource, /async function enrichSoloLootProfile\(parsed\)[\s\S]*?fetchCharacterProfiles/);
  assert.match(desktopMainSource, /resolveScreenVisionProfileCharacterSummaries[\s\S]*?type: "fetch-character-profiles"/);
  assert.match(mirrorSource, /profiles\.resolveCharacters\(characterNames\)/);
  assert.match(mirrorSource, /profiles\.resolveCharacters\(supporterNames\)/);
  assert.match(findPartySource, /\/api\/find-party\?character=/);
  assert.match(lootAnalyzerSource, /\/api\/find-party\?character=/);
  assert.match(supporterRouteSource, /fetchTibiaDataCharacterProfiles/);
});

test("character lookup falls back to the official Tibia page when TibiaData is unavailable", async () => {
  const storage = {};
  const originalFetch = globalThis.fetch;
  let tibiaDataAttempts = 0;
  let officialAttempts = 0;

  configureDataService({
    async storageGet(key) {
      return key === null ? { ...storage } : { [key]: storage[key] };
    },
    async storageSet(values) {
      Object.assign(storage, values);
    },
    async storageRemove(key) {
      delete storage[key];
    },
  });

  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://api.tibiadata.com/")) {
      tibiaDataAttempts += 1;
      return new Response("temporarily unavailable", { status: 503 });
    }

    officialAttempts += 1;
    return new Response(`
      <table>
        <tr><td class="LabelV175">Name:</td><td>Fallback Druid</td></tr>
        <tr><td class="LabelV175">Sex:</td><td>female</td></tr>
        <tr><td class="LabelV175">Vocation:</td><td>Elder Druid</td></tr>
        <tr><td class="LabelV175">Level:</td><td>321</td></tr>
        <tr><td class="LabelV175">World:</td><td>Honbra</td></tr>
      </table>
    `, { status: 200, headers: { "content-type": "text/html" } });
  };

  try {
    const result = await handleDataServiceMessage({
      type: "fetch-character-profiles",
      payload: { names: ["Fallback Druid"] },
    });

    assert.equal(tibiaDataAttempts, 3);
    assert.equal(officialAttempts, 1);
    assert.deepEqual(result["Fallback Druid"], {
      name: "Fallback Druid",
      sex: "female",
      vocation: "Elder Druid",
      level: 321,
      world: "Honbra",
      guild: "",
    });
    assert.ok(storage["character-profile:v2:fallback druid"]?.value?.profile);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
