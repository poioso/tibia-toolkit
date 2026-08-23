import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createGameDataHubServer } from "./server.mjs";
import {
  createFixedWindowRateLimiter,
  getPublicJsonHeaders,
  isInternalApiRequest,
  sanitizeMiniWorldChangeWorld
} from "./api-security.mjs";

test("public Mini World Change responses expose only the UI contract", () => {
  const result = sanitizeMiniWorldChangeWorld({
    id: 31,
    name: "Honbra",
    pvpType: "Open PvP",
    battleyeColor: "green",
    privateMarker: "must-not-leak",
    activeMiniWorldChanges: [{
      id: 9,
      name: "Warpath",
      displayName: "Bibby Bloodbath",
      sourceRecordId: 1234,
      sourceUrl: "https://upstream.invalid/private"
    }]
  });

  assert.deepEqual(result, {
    name: "Honbra",
    activeMiniWorldChanges: [{ name: "Warpath", displayName: "Bibby Bloodbath" }]
  });
  assert.doesNotMatch(JSON.stringify(result), /source|upstream|secret/i);
});

test("private routes accept loopback or a constant-time bearer token", () => {
  assert.equal(isInternalApiRequest({ socket: { remoteAddress: "127.0.0.1" }, headers: {} }, ""), true);
  assert.equal(isInternalApiRequest({
    socket: { remoteAddress: "203.0.113.7" },
    headers: { authorization: "Bearer correct-token" }
  }, "correct-token"), true);
  assert.equal(isInternalApiRequest({
    socket: { remoteAddress: "203.0.113.7" },
    headers: { authorization: "Bearer wrong-token" }
  }, "correct-token"), false);
});

test("rate limiter blocks only after the configured public allowance", () => {
  const limiter = createFixedWindowRateLimiter({ windowMs: 1_000, maxRequests: 2 });
  assert.equal(limiter.consume("client", 0).allowed, true);
  assert.equal(limiter.consume("client", 1).allowed, true);
  assert.equal(limiter.consume("client", 2).allowed, false);
  assert.equal(limiter.consume("client", 1_001).allowed, true);
});

test("JSON responses include defensive browser headers", () => {
  const headers = getPublicJsonHeaders();
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Content-Security-Policy"], "default-src 'none'; frame-ancestors 'none'");
  assert.equal(headers["Cross-Origin-Resource-Policy"], "same-site");
  assert.equal(headers["Permissions-Policy"], "camera=(), microphone=(), geolocation=(), payment=()");
  assert.equal(headers["Access-Control-Allow-Origin"], undefined);
});

test("world endpoint remains app-compatible without leaking snapshot metadata", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "ttk-hub-security-"));
  const stateFilePath = path.join(dataDir, "state.json");
  const snapshotsDir = path.join(dataDir, "snapshots");
  await fs.mkdir(snapshotsDir, { recursive: true });
  await fs.writeFile(stateFilePath, JSON.stringify({
    version: 1,
    modules: {
      "mini-world-changes": {
        fetchedAt: "2026-07-20T08:30:00.000Z",
        sourceUrl: "https://upstream.invalid/private"
      }
    }
  }), "utf8");
  await fs.writeFile(path.join(snapshotsDir, "mini-world-changes.json"), JSON.stringify({
    storedAt: "2026-07-20T08:30:00.000Z",
    data: {
      source: { provider: "private-provider", baseUrl: "https://upstream.invalid" },
      catalog: [{ id: 9, name: "Warpath" }],
      worlds: [{
        id: 31,
        name: "Honbra",
        pvpType: "Open PvP",
        battleyeColor: "green",
        activeMiniWorldChanges: [{
          id: 9,
          name: "Warpath",
          displayName: "Bibby Bloodbath",
          sourceRecordId: 1234
        }]
      }]
    }
  }), "utf8");

  const app = await createGameDataHubServer({
    host: "127.0.0.1",
    port: 0,
    stateFilePath,
    miniWorldChangesEnabled: false,
    tickMs: 60_000
  });
  const address = await app.start({ initialRefresh: false });
  t.after(async () => {
    await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const response = await fetch(
    `http://${address.host}:${address.port}/api/game/mini-world-changes/worlds/Honbra`
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(body, {
    data: {
      world: {
        name: "Honbra",
        activeMiniWorldChanges: [{ name: "Warpath", displayName: "Bibby Bloodbath" }]
      }
    }
  });
  assert.doesNotMatch(JSON.stringify(body), /source|provider|upstream|record/i);
});
