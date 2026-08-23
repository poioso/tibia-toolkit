#!/usr/bin/env node
// Verifies the two heaviest tutorial paths against the live canonical app.
// Start Electron with --remote-debugging-port=9222 before running this file.
import assert from "node:assert/strict";
import http from "node:http";
import WebSocket from "ws";

function readTargets() {
  return new Promise((resolve, reject) => {
    const request = http.get("http://127.0.0.1:9222/json", (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.once("error", reject);
  });
}

function createClient(socket) {
  let nextId = 1;
  const pending = new Map();
  socket.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

const targets = await readTargets();
const app = targets.find((target) => target.type === "page" && String(target.url).startsWith("tibiatoolkit://"));
const popover = targets.find((target) => target.type === "page" && String(target.url).endsWith("/desktop/tutorial-popover.html"));
assert.ok(app?.webSocketDebuggerUrl, "Electron app target was not found on port 9222.");
assert.ok(popover, "Tutorial popover was not preloaded before the first tutorial step.");

const socket = new WebSocket(app.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.once("open", resolve);
  socket.once("error", reject);
});
const send = createClient(socket);

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (response?.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Renderer evaluation failed.");
  }
  return response?.result?.value;
}

try {
  await send("Emulation.setCPUThrottlingRate", { rate: 4 });
  assert.equal(await evaluate("Boolean(window.TibiaToolsTutorialApi && window.TibiaToolsTutorial)"), true);

  const item = await evaluate(`(async () => {
    const started = performance.now();
    await window.TibiaToolsTutorialApi.typeItemSearch("Plate armor");
    const suggestionsMs = performance.now() - started;
    await window.TibiaToolsTutorialApi.selectItemByName("Plate Armor");
    return {
      suggestionsMs: Math.round(suggestionsMs),
      totalMs: Math.round(performance.now() - started),
      itemName: document.querySelector("#item-name")?.textContent?.trim() || "",
      summaryVisible: !document.querySelector("#item-summary-content")?.classList.contains("hidden")
    };
  })()`);

  const npc = await evaluate(`(async () => {
    const started = performance.now();
    await window.TibiaToolsTutorialApi.configureNpcCatalogTour({ openYaman: true });
    return {
      totalMs: Math.round(performance.now() - started),
      npcCards: document.querySelectorAll("#npc-list-panel [data-npc-name]").length,
      detailText: document.querySelector("#entity-detail-content")?.textContent || "",
      globalLoadingVisible: !document.querySelector("#global-loading-overlay")?.classList.contains("hidden")
    };
  })()`);

  assert.equal(item.itemName, "Plate Armor");
  assert.equal(item.summaryVisible, true);
  assert.ok(item.suggestionsMs <= 500, `Preloaded item suggestions took ${item.suggestionsMs}ms with 4x CPU throttling.`);
  assert.ok(item.totalMs <= 2500, `Preloaded Plate Armor tutorial step took ${item.totalMs}ms with 4x CPU throttling.`);
  assert.ok(npc.npcCards > 0, "NPC tutorial did not render the preloaded catalogue.");
  assert.match(npc.detailText, /Yaman/i, "NPC tutorial did not render the preloaded Yaman detail.");
  assert.equal(npc.globalLoadingVisible, false);
  assert.ok(npc.totalMs <= 1500, `Preloaded NPC tutorial step took ${npc.totalMs}ms with 4x CPU throttling.`);

  await evaluate("window.desktopApi.app.tutorial.closeStep()");
  const targetsAfterClose = await readTargets();
  const popoverAfterClose = targetsAfterClose.find((target) => target.id === popover.id);
  assert.ok(popoverAfterClose, "Closing a tutorial step destroyed the preloaded popover window.");

  assert.equal(await evaluate("window.desktopApi.app.tutorial.preload()"), true);
  const targetsAfterPreload = await readTargets();
  const popoverAfterPreload = targetsAfterPreload.find((target) => target.id === popover.id);
  assert.ok(popoverAfterPreload, "Preloading recreated the tutorial popover instead of reusing it.");

  console.log(JSON.stringify({
    passed: true,
    cpuThrottle: 4,
    popoverPreloaded: true,
    popoverReused: true,
    item,
    npc: { ...npc, detailText: undefined }
  }, null, 2));
} finally {
  await send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
  socket.close();
}
