import assert from "node:assert/strict";
import test from "node:test";
import {
  collectMiniWorldChanges,
  getDueMiniWorldChangeSlots,
  getZonedDateTimeParts,
  normalizeMiniWorldChangesConfig
} from "./mini-world-changes.mjs";
import {
  MINI_WORLD_CHANGE_VISUALS,
  enrichMiniWorldChange
} from "./mini-world-change-visuals.mjs";
import { shouldPreservePreviousMiniWorldChanges } from "./server.mjs";

test("collector normalizes all worlds with only two upstream HTTP requests", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);

    if (url.includes("world.list,miniWorldChange.list")) {
      return jsonResponse([
        {
          result: {
            data: {
              worlds: [
                { id: 31, name: "Honbra", battleye_color: "green", pvp_type: "Open PvP" },
                { id: 3, name: "Antica", battleye_color: "yellow", pvp_type: "Open PvP" }
              ]
            }
          }
        },
        {
          result: {
            data: {
              mini_world_changes: [
                { id: 2, name: "Stampede" },
                { id: 4, name: "Nightmare Isles" }
              ]
            }
          }
        }
      ]);
    }

    return jsonResponse([
      {
        result: {
          data: {
            active_worlds: [
              { id: 1001, world_id: 31, world_name: "Honbra", worlld_battleye_color: "green" }
            ]
          }
        }
      },
      {
        result: {
          data: {
            active_worlds: [
              { id: 1002, world_id: 31, world_name: "Honbra", worlld_battleye_color: "green" }
            ]
          }
        }
      }
    ]);
  };

  const result = await collectMiniWorldChanges({
    fetchImpl,
    collectedAt: "2026-07-19T08:10:00.000Z",
    schedule: {
      timeZone: "Europe/Berlin",
      serverSaveTime: "10:00",
      collectionTimes: ["10:10", "10:30"]
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(result.stats.upstreamRequestCount, 2);
  assert.equal(result.stats.worldCount, 2);
  assert.equal(result.stats.catalogCount, 2);
  assert.equal(result.stats.activeAssignmentCount, 2);
  assert.deepEqual(result.worlds.map((world) => world.name), ["Antica", "Honbra"]);
  assert.deepEqual(result.worlds[0].activeMiniWorldChanges, []);
  assert.deepEqual(
    result.worlds[1].activeMiniWorldChanges.map((change) => change.name),
    ["Nightmare Isles", "Stampede"]
  );
  assert.match(calls[1], /mini_world_change_id/);
});

test("Europe/Berlin schedule follows European summer time", () => {
  const now = new Date("2026-07-19T08:10:00.000Z");
  assert.deepEqual(getZonedDateTimeParts(now, "Europe/Berlin"), {
    date: "2026-07-19",
    hour: 10,
    minute: 10
  });
  assert.deepEqual(
    getDueMiniWorldChangeSlots({ now, timeZone: "Europe/Berlin", collectionTimes: ["10:10", "10:30"] }),
    ["2026-07-19T10:10@Europe/Berlin"]
  );
});

test("Europe/Berlin schedule follows European winter time", () => {
  const now = new Date("2026-01-19T09:30:00.000Z");
  assert.deepEqual(getZonedDateTimeParts(now, "Europe/Berlin"), {
    date: "2026-01-19",
    hour: 10,
    minute: 30
  });
  assert.deepEqual(
    getDueMiniWorldChangeSlots({
      now,
      timeZone: "Europe/Berlin",
      collectionTimes: ["10:10", "10:30"],
      completedSlots: ["2026-01-19T10:10@Europe/Berlin"]
    }),
    ["2026-01-19T10:30@Europe/Berlin"]
  );
});

test("default schedule collects at :00 and :10 throughout the server day", () => {
  const config = normalizeMiniWorldChangesConfig();

  assert.equal(config.collectionTimes.length, 48);
  assert.deepEqual(config.collectionTimes.slice(0, 4), ["00:00", "00:10", "01:00", "01:10"]);
  assert.deepEqual(config.collectionTimes.slice(-4), ["22:00", "22:10", "23:00", "23:10"]);
});

test("completed slots are not returned again", () => {
  const now = new Date("2026-07-19T08:45:00.000Z");
  assert.deepEqual(
    getDueMiniWorldChangeSlots({
      now,
      timeZone: "Europe/Berlin",
      collectionTimes: ["10:10", "10:30"],
      completedSlots: [
        "2026-07-19T10:10@Europe/Berlin",
        "2026-07-19T10:30@Europe/Berlin"
      ]
    }),
    []
  );
});

test("invalid schedule values fall back to the safe defaults", () => {
  const config = normalizeMiniWorldChangesConfig({ collectionTimes: ["bad"], enabled: "false" });

  assert.deepEqual({
    enabled: config.enabled,
    sourceBase: config.sourceBase,
    timeZone: config.timeZone,
    serverSaveTime: config.serverSaveTime,
    bootstrapWhenEmpty: config.bootstrapWhenEmpty,
    emptyResultRetryMs: config.emptyResultRetryMs
  }, {
    enabled: false,
    sourceBase: "https://tibiatrade.gg/trpc",
    timeZone: "Europe/Berlin",
    serverSaveTime: "10:00",
    bootstrapWhenEmpty: true,
    emptyResultRetryMs: 0
  });
  assert.equal(config.collectionTimes.length, 48);
  assert.equal(config.collectionTimes[0], "00:00");
  assert.equal(config.collectionTimes.at(-1), "23:10");
});

test("an empty result after server save replaces a pre-save snapshot", () => {
  const schedule = { timeZone: "Europe/Berlin", serverSaveTime: "10:00" };
  const getLocal = (date) => getZonedDateTimeParts(date, schedule.timeZone);
  const previousSnapshot = {
    source: { collectedAt: "2026-07-27T02:30:00.000Z" }, // 04:30 Berlin
    stats: { activeAssignmentCount: 10 }
  };

  assert.equal(shouldPreservePreviousMiniWorldChanges({
    previousSnapshot,
    activeAssignmentCount: 0,
    now: new Date("2026-07-27T10:13:00.000Z"), // 12:13 Berlin
    schedule,
    getZonedDateTimeParts: getLocal
  }), false);
});

test("an empty result before server save retains the prior server-day snapshot", () => {
  const schedule = { timeZone: "Europe/Berlin", serverSaveTime: "10:00" };
  const getLocal = (date) => getZonedDateTimeParts(date, schedule.timeZone);
  const previousSnapshot = {
    source: { collectedAt: "2026-07-26T10:10:00.000Z" }, // 12:10 Berlin, prior cycle
    stats: { activeAssignmentCount: 10 }
  };

  assert.equal(shouldPreservePreviousMiniWorldChanges({
    previousSnapshot,
    activeAssignmentCount: 0,
    now: new Date("2026-07-27T07:30:00.000Z"), // 09:30 Berlin
    schedule,
    getZonedDateTimeParts: getLocal
  }), true);
});

test("empty result retries can be enabled temporarily without changing the daily schedule", () => {
  const config = normalizeMiniWorldChangesConfig({
    collectionTimes: ["10:10", "10:30"],
    emptyResultRetryMs: 10 * 60_000
  });

  assert.equal(config.emptyResultRetryMs, 10 * 60_000);
  assert.deepEqual(config.collectionTimes, ["10:10", "10:30"]);
});

test("collector rejects malformed upstream batches", async () => {
  await assert.rejects(
    collectMiniWorldChanges({ fetchImpl: async () => jsonResponse({ invalid: true }) }),
    /unexpected batch size/
  );
});

test("visual catalog maps every supported TibiaTrade entry without adding unsupported changes", () => {
  assert.equal(Object.keys(MINI_WORLD_CHANGE_VISUALS).length, 24);
  assert.equal(MINI_WORLD_CHANGE_VISUALS["Bank Robbery"].displayName, "Bank Robbery");
  assert.equal(MINI_WORLD_CHANGE_VISUALS.Chyllfroest.displayName, "Chyllfroest");
  assert.equal(MINI_WORLD_CHANGE_VISUALS["Poacher Caves"].displayName, "Orc Land");
  assert.equal(MINI_WORLD_CHANGE_VISUALS.Warpath.displayName, "Bibby Bloodbath");
  assert.equal(MINI_WORLD_CHANGE_VISUALS["Down the Drain"].displayName, "River Flood");
  assert.equal(MINI_WORLD_CHANGE_VISUALS["Spirit Grounds"].displayName, "Spirit Gate");
  assert.equal(MINI_WORLD_CHANGE_VISUALS["Jungle Camp"].variants.length, 2);
  assert.deepEqual(
    MINI_WORLD_CHANGE_VISUALS["Jungle Camp"].variants.map((variant) => variant.displayName),
    ["Dworc Camp", "Hunter Camp"]
  );

  for (const unsupported of [
    "Beaver Breakout",
    "Forsaken",
    "Orc Land",
    "Shipwrecked"
  ]) {
    assert.equal(MINI_WORLD_CHANGE_VISUALS[unsupported], undefined);
  }
});

test("visual enrichment keeps source identity and adds stable image references", () => {
  const mapped = enrichMiniWorldChange({ id: 9, name: "Warpath", sourceRecordId: 1001 });

  assert.equal(mapped.id, 9);
  assert.equal(mapped.name, "Warpath");
  assert.equal(mapped.displayName, "Bibby Bloodbath");
  assert.equal(mapped.images[0].slug, "bibby-bloodbath");
  assert.equal(mapped.sourceRecordId, 1001);
});

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}
