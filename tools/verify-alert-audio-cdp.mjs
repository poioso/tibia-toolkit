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

function createCdpClient(socket) {
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
assert.ok(target?.webSocketDebuggerUrl, "The development app is not available on CDP port 9222.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.once("open", resolve);
  socket.once("error", reject);
});

try {
  const evaluate = createCdpClient(socket);
  const bridge = await evaluate(`(() => ({
    picker: typeof window.desktopApi?.screenVisionApi?.dialogs?.pickAudioFile === 'function',
    timers: typeof window.desktopApi?.screenVisionApi?.timers?.start === 'function',
    storage: typeof window.desktopApi?.screenVisionApi?.storage?.set === 'function'
  }))()`);
  assert.deepEqual(bridge, { picker: true, timers: true, storage: true });

  if (process.argv.includes("--open-picker")) {
    const started = await evaluate(`(() => {
      const picker = window.desktopApi?.screenVisionApi?.dialogs?.pickAudioFile;
      if (typeof picker !== 'function') return false;
      Promise.resolve(picker()).catch(() => '');
      return true;
    })()`, false);
    assert.equal(started, true, "The custom audio picker did not start.");
  }

  console.log(JSON.stringify({
    passed: true,
    bridge,
    pickerRequested: process.argv.includes("--open-picker")
  }, null, 2));
} finally {
  socket.close();
}
