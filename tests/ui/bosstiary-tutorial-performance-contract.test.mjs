import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../../app.js", import.meta.url), "utf8");
const overrides = JSON.parse(await readFile(new URL("../../assets/data/creature-status-overrides.json", import.meta.url), "utf8"));

test("Bosstiary aquece uma unica consulta de Yaga sem bloquear cada passo", () => {
  const start = appSource.indexOf("async configureBossiaryTour(options = {}) {");
  const end = appSource.indexOf("\n    closeBossiaryTourMap()", start);
  const body = appSource.slice(start, end);

  assert.match(appSource, /const BOSSTIARY_TUTORIAL_REUSE_OPEN_DETAIL_ENABLED = true;/);
  assert.match(body, /void warmBossiaryTourBossTracker\(\);/);
  assert.match(body, /isRequestedBossAlreadyOpen/);
  assert.match(body, /if \(!isRequestedBossAlreadyOpen\) \{/);
});

test("Boss Tracker compartilha chamadas simultaneas do mesmo mundo e boss", () => {
  const start = appSource.indexOf("function requestBossTracker(detail = {}) {");
  const end = appSource.indexOf("\nfunction warmBossiaryTourBossTracker()", start);
  const body = appSource.slice(start, end);

  assert.match(body, /bossTrackerInFlightRequests\.get\(key\)/);
  assert.match(body, /bossTrackerInFlightRequests\.set\(key, request\)/);
  assert.match(body, /bossTrackerInFlightRequests\.delete\(key\)/);
});

test("Yaga conserva mapa local enquanto o Tracker termina", () => {
  assert.equal(
    overrides?.overrides?.["yaga-the-crone"]?.map?.url,
    "https://tibiamaps.io/map#32712,32011,11:1"
  );
});
