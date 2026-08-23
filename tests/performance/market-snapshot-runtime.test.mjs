import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverPath = path.join(workspaceRoot, "services", "market-cache", "server.mjs");

test("market snapshot runtime serves checksum metadata, gzip and 304", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tibia-toolkit-market-snapshot-"));
  const statePath = path.join(tempRoot, "state.json");
  const worldDir = path.join(tempRoot, "worlds");
  const port = await reservePort();
  const worldLastUpdate = "2026-08-20T12:00:00.000Z";

  await fs.mkdir(worldDir, { recursive: true });
  await fs.writeFile(
    statePath,
    JSON.stringify({
      schemaVersion: 5,
      createdAt: worldLastUpdate,
      updatedAt: worldLastUpdate,
      worldOrder: ["antica"],
      worlds: {
        antica: {
          name: "Antica",
          slug: "antica",
          last_update: worldLastUpdate,
          last_checked_at: worldLastUpdate,
          fullySyncedUpdate: worldLastUpdate,
          storedItems: 1
        }
      },
      replicaWorldOrder: [],
      replicaWorlds: {},
      intibiaWorldOrder: [],
      intibiaWorlds: {},
      intibiaReplicaWorldOrder: [],
      intibiaReplicaWorlds: {}
    }),
    "utf8",
  );
  await fs.writeFile(
    path.join(worldDir, "antica.json"),
    JSON.stringify({
      worldSlug: "antica",
      worldName: "Antica",
      worldLastUpdate,
      updatedAt: worldLastUpdate,
      items: {
        "100": {
          id: 100,
          buy_offer: 10,
          sell_offer: 20,
          time: worldLastUpdate
        }
      }
    }),
    "utf8",
  );

  const child = spawn(process.execPath, [serverPath], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      MARKET_CACHE_HOST: "127.0.0.1",
      PORT: String(port),
      MARKET_CACHE_STATE_PATH: statePath,
      MARKET_CACHE_CRAWL_ALL_WORLDS: "false",
      MARKET_CACHE_ON_DEMAND_FETCH: "false",
      MARKET_CACHE_WORLD_REFRESH_MS: "86400000",
      MARKET_CACHE_INTIBIA_ENABLED: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  const collect = (chunk) => {
    output += String(chunk);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  try {
    await waitForServer(child, () => output.includes(`listening on http://127.0.0.1:${port}`));

    const first = await requestRaw(port, "/market_snapshot?server=Antica", {
      "Accept-Encoding": "gzip"
    });
    assert.equal(first.statusCode, 200, output);
    assert.equal(first.headers["content-encoding"], "gzip");

    const payload = JSON.parse(gunzipSync(first.body).toString("utf8"));
    const serializedValues = JSON.stringify(payload.values);
    const checksum = createHash("sha256").update(serializedValues, "utf8").digest("hex");
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.checksum, `sha256:${checksum}`);
    assert.equal(payload.sizeBytes, Buffer.byteLength(serializedValues, "utf8"));
    assert.equal(first.headers.etag, payload.etag);

    const changedWorld = JSON.parse(await fs.readFile(path.join(worldDir, "antica.json"), "utf8"));
    changedWorld.updatedAt = "2026-08-20T13:00:00.000Z";
    changedWorld.items["100"].sell_offer = 25;
    await fs.writeFile(path.join(worldDir, "antica.json"), JSON.stringify(changedWorld), "utf8");

    const deltaResponse = await requestRaw(
      port,
      `/market_snapshot_delta?server=Antica&since=${encodeURIComponent(payload.snapshotVersion)}`
    );
    assert.equal(deltaResponse.statusCode, 200, output);
    const deltaPayload = JSON.parse(deltaResponse.body.toString("utf8"));
    const serializedDelta = JSON.stringify({
      changed: deltaPayload.changed,
      removed: deltaPayload.removed
    });
    assert.equal(deltaPayload.schemaVersion, 1);
    assert.equal(deltaPayload.fromVersion, payload.snapshotVersion);
    assert.notEqual(deltaPayload.toVersion, payload.snapshotVersion);
    assert.equal(deltaPayload.changed.find((entry) => entry.id === 100)?.sell_offer, 25);
    assert.equal(deltaPayload.checksum, `sha256:${createHash("sha256").update(serializedDelta, "utf8").digest("hex")}`);
    assert.equal(deltaPayload.sizeBytes, Buffer.byteLength(serializedDelta, "utf8"));

    const refreshed = await requestRaw(port, "/market_snapshot?server=Antica");
    assert.equal(refreshed.statusCode, 200, output);
    const second = await requestRaw(port, "/market_snapshot?server=Antica", {
      "If-None-Match": refreshed.headers.etag
    });
    assert.equal(second.statusCode, 304, output);
    assert.equal(second.headers.etag, refreshed.headers.etag);
    assert.equal(second.body.byteLength, 0);

    const deltaNotModified = await requestRaw(
      port,
      `/market_snapshot_delta?server=Antica&since=${encodeURIComponent(deltaPayload.toVersion)}`
    );
    assert.equal(deltaNotModified.statusCode, 304, output);

    const unavailableDelta = await requestRaw(port, "/market_snapshot_delta?server=Antica&since=stale-version");
    assert.equal(unavailableDelta.statusCode, 409, output);
    const unavailablePayload = JSON.parse(unavailableDelta.body.toString("utf8"));
    assert.equal(unavailablePayload.fallback, "/market_snapshot");
    assert.equal(unavailablePayload.currentVersion, deltaPayload.toVersion);

    const invalidSnapshot = await requestRaw(port, "/market_snapshot?server=Antica&unexpected=1");
    assert.equal(invalidSnapshot.statusCode, 400);
    const invalidItem = await requestRaw(port, "/market_values?server=Antica&item_ids=not-an-id");
    assert.equal(invalidItem.statusCode, 400);
    const missingDeltaVersion = await requestRaw(port, "/market_snapshot_delta?server=Antica");
    assert.equal(missingDeltaVersion.statusCode, 422);
  } finally {
    child.kill();
    await onceExit(child);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

async function reservePort() {
  const probe = http.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function requestRaw(port, requestPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: requestPath,
        method: "GET",
        headers
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks)
        }));
      },
    );
    request.once("error", reject);
    request.end();
  });
}

async function waitForServer(child, predicate) {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (child.exitCode !== null) {
      throw new Error(`market-cache exited before ready: ${child.exitCode}`);
    }
    if (Date.now() >= deadline) {
      throw new Error("market-cache did not become ready in time");
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function onceExit(child) {
  if (child.exitCode !== null) {
    return;
  }
  await new Promise((resolve) => child.once("exit", resolve));
}
