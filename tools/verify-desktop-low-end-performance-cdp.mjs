#!/usr/bin/env node
// Live performance proxy for a weaker computer. The canonical Electron app
// must be running with --remote-debugging-port=9222. CPU throttling is applied
// only to this renderer for the duration of the check and is always restored.
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
assert.ok(app?.webSocketDebuggerUrl, "Electron app target was not found on port 9222.");

const socket = new WebSocket(app.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.once("open", resolve);
  socket.once("error", reject);
});
const send = createClient(socket);

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (response?.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "Renderer evaluation failed.");
  }
  return response?.result?.value;
}

async function waitFor(expression, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    if (await evaluate(expression)) return Date.now() - started;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

try {
  await send("Emulation.setCPUThrottlingRate", { rate: 4 });
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-item-view="books"]'))`), true);
  await evaluate(`document.querySelector('[data-item-view="books"]').click(); true`);
  const booksMs = await waitFor(`(() => {
    const view = document.querySelector('#item-books-view');
    return Boolean(view && !view.classList.contains('hidden') && document.querySelector('#books-grid')?.children.length);
  })()`);

  await evaluate(`document.querySelector('[data-item-view="spells"]').click(); true`);
  const spellsMs = await waitFor(`(() => {
    const view = document.querySelector('#item-spells-view');
    return Boolean(view && !view.classList.contains('hidden') && document.querySelector('#spells-grid')?.children.length);
  })()`);

  await evaluate(`document.querySelector('[data-item-view="list"]').click(); true`);
  await waitFor(`!document.querySelector('#item-list-view')?.classList.contains('hidden')`);
  const result = await evaluate(`({
    booksRendered: document.querySelectorAll('#books-grid > *').length,
    spellsRendered: document.querySelectorAll('#spells-grid > *').length,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: innerWidth,
    readyState: document.readyState
  })`);
  Object.assign(result, { booksMs, spellsMs });
  assert.equal(result.readyState, "complete");
  assert.ok(result.booksMs <= 5000, `Books took ${result.booksMs}ms with 4x CPU throttling.`);
  assert.ok(result.spellsMs <= 5000, `Spells took ${result.spellsMs}ms with 4x CPU throttling.`);
  assert.ok(result.booksRendered > 0 && result.booksRendered <= 60, "Books lost progressive rendering.");
  assert.ok(result.spellsRendered > 0 && result.spellsRendered <= 160, "Spell catalogue rendered an invalid amount.");
  console.log(JSON.stringify({ passed: true, cpuThrottle: 4, ...result }, null, 2));
} finally {
  await send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
  socket.close();
}
