#!/usr/bin/env node
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
    if (!message.id || !pending.has(message.id)) return;
    const entry = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result?.result?.value);
  });
  return (expression, awaitPromise = true) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({
      id,
      method: "Runtime.evaluate",
      params: { expression, returnByValue: true, awaitPromise }
    }));
  });
}

const targets = await readTargets();
const target = targets.find((entry) => entry.type === "page" && String(entry.url).startsWith("tibiatoolkit://app/"));
assert.ok(target?.webSocketDebuggerUrl, "O aplicativo de desenvolvimento não está disponível na porta CDP 9222.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.once("open", resolve);
  socket.once("error", reject);
});

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const evaluate = createClient(socket);
let originalStorage = null;

try {
  await wait(1_200);
  originalStorage = await evaluate("window.desktopApi.screenVisionApi.storage.get('overlayToolsState')");
  const opened = await evaluate("window.desktopApi.screenVisionApi.tools.open('alertas-panel').then(() => true)");
  assert.equal(opened, true);
  await wait(750);

  const toolbar = await evaluate(`(() => ({
    phase: document.body.dataset.dockedPanelPhase || '',
    panelKey: document.body.dataset.dockedPanelKey || '',
    spells: Boolean(document.querySelector('[data-alerts-view="magias"]')),
    potions: Boolean(document.querySelector('[data-alerts-view="pocoes"]')),
    foods: Boolean(document.querySelector('[data-alerts-view="comidas"]'))
  }))()`);
  assert.deepEqual(toolbar, {
    phase: "open",
    panelKey: "alertas-panel",
    spells: true,
    potions: true,
    foods: true
  });

  const potionCount = await evaluate(`(() => {
    document.querySelector('[data-alerts-view="pocoes"]')?.click();
    return document.querySelectorAll('[data-docked-action="create-alert-from-potion-preset"]').length;
  })()`);
  assert.equal(potionCount, 4);

  const foodPanel = await evaluate(`(() => {
    document.querySelector('[data-alerts-view="comidas"]')?.click();
    return {
      count: document.querySelectorAll('[data-docked-action="create-alert-from-food-preset"]').length,
      reset: Boolean(document.querySelector('[data-docked-action="reset-food-cooldowns"]')),
      coconut: Boolean(document.querySelector('[data-consumable-preset-id="coconut-shrimp-bake"]')),
      zaoan: Boolean(document.querySelector('[data-consumable-preset-id="zaoan-sauce"]'))
    };
  })()`);
  assert.deepEqual(foodPanel, { count: 28, reset: true, coconut: true, zaoan: true });

  const clicked = await evaluate(`(() => {
    const button = document.querySelector('[data-consumable-preset-id="coconut-shrimp-bake"]');
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true);
  await wait(350);

  const created = await evaluate(`window.desktopApi.screenVisionApi.storage.get('overlayToolsState').then((stored) => {
    const timers = stored?.overlayToolsState?.timers?.items || [];
    const timer = [...timers].reverse().find((entry) => entry?.presetId === 'coconut-shrimp-bake');
    return timer ? {
      name: timer.name,
      durationSeconds: timer.durationSeconds,
      timerKind: timer.timerKind,
      clockMode: timer.clockMode,
      soundKey: timer.soundKey,
      volumeMuted: timer.volumeMuted,
      volumePercent: timer.volumePercent,
      showVisualAlert: timer.showVisualAlert,
      enabled: timer.enabled
    } : null;
  })`);
  assert.deepEqual(created, {
    name: "Coconut Shrimp Bake",
    durationSeconds: 86400,
    timerKind: "food",
    clockMode: "wall-clock",
    soundKey: "none",
    volumeMuted: true,
    volumePercent: 0,
    showVisualAlert: false,
    enabled: false
  });

  console.log(JSON.stringify({
    passed: true,
    toolbar,
    potionCount,
    foodPanel,
    created,
    foodsSilentByDefault: true
  }, null, 2));
} finally {
  if (originalStorage) {
    await evaluate(`window.desktopApi.screenVisionApi.storage.set(${JSON.stringify(originalStorage)})`).catch(() => null);
    await evaluate("location.reload()", false).catch(() => null);
    await wait(250);
  }
  socket.close();
}
