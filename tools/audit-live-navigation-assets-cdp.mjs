#!/usr/bin/env node
import assert from "node:assert/strict";
import http from "node:http";
import WebSocket from "ws";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function readTargets() {
  return new Promise((resolve, reject) => {
    http.get("http://127.0.0.1:9222/json", (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).once("error", reject);
  });
}

function createClient(socket) {
  let nextId = 1;
  const pending = new Map();
  socket.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (!message.id) return;
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
  };
}

const target = (await readTargets()).find((candidate) =>
  candidate.type === "page" && candidate.url.startsWith("tibiatoolkit://app/index.html"));
assert.ok(target?.webSocketDebuggerUrl, "A janela principal do Electron nao foi encontrada na porta 9222.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.once("open", resolve);
  socket.once("error", reject);
});
const client = createClient(socket);
await client.send("Runtime.enable");

async function evaluate(expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (response?.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  }
  return response?.result?.value;
}

const states = [
  ["library-list", '[data-section="item-prices"]', '[data-item-view="list"]'],
  ["library-stash", '[data-section="item-prices"]', '[data-item-view="stash"]'],
  ["library-books", '[data-section="item-prices"]', '[data-item-view="books"]'],
  ["library-spells", '[data-section="item-prices"]', '[data-item-view="spells"]'],
  ["tools-imbuements", '[data-section="tools"]', '[data-tool-tab="imbuement"][data-tool-subtab="true"]'],
  ["tools-skill-calculator", '[data-section="tools"]', '[data-tool-tab="skill-calculator"]'],
  ["tools-party-hunt", '[data-section="tools"]', '[data-tool-tab="loot-splitter"][data-loot-mode="party"]'],
  ["tools-solo-hunt", '[data-section="tools"]', '[data-tool-tab="loot-splitter"][data-loot-mode="solo"]'],
  ["tools-find-party", '[data-section="tools"]', '[data-tool-tab="find-party"]'],
  ["tools-wheel-of-destiny", '[data-section="tools"]', '[data-tool-tab="wheel-of-destiny"]'],
  ["tools-tibia-mirror", '[data-section="tools"]', '[data-tool-tab="screen-vision"]'],
  ["entities-npcs", '[data-section="npcs"]', '[data-entity-view="npcs"]'],
  ["entities-creatures", '[data-section="npcs"]', '[data-entity-view="monsters"]'],
  ["entities-bosses", '[data-section="npcs"]', '[data-entity-view="bosses"]'],
  ["mini-world-changes", '[data-section="mini-world-changes"]']
];

const results = [];
for (const [name, ...selectors] of states) {
  const clickResult = await evaluate(`(() => {
    const missing = [];
    for (const selector of ${JSON.stringify(selectors)}) {
      const element = document.querySelector(selector);
      if (!element) missing.push(selector);
      else element.click();
    }
    return { missing };
  })()`);
  await wait(name.includes("wheel") || name.includes("books") || name.includes("spells") ? 1200 : 500);
  const inspection = await evaluate(`(async () => {
    const documents = [];
    const visit = (currentDocument, framePath = 'main') => {
      documents.push({ currentDocument, framePath });
      [...currentDocument.querySelectorAll('iframe, frame')].forEach((frame, index) => {
        try {
          if (frame.contentDocument) visit(frame.contentDocument, framePath + '/frame[' + index + ']');
        } catch {}
      });
    };
    visit(document);
    const images = documents.flatMap(({ currentDocument, framePath }) =>
      [...currentDocument.images].map((image) => ({
        framePath,
        id: image.id || '',
        className: typeof image.className === 'string' ? image.className : '',
        src: image.currentSrc || image.src || '',
        sourceAttribute: image.getAttribute('src') || '',
        parentSnippet: image.parentElement?.outerHTML?.slice(0, 600) || '',
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        visible: Boolean(image.getClientRects().length)
      }))
    );
    const urls = new Set(images.map((image) => image.src).filter((url) => String(url).toLowerCase().includes('assets/')));
    for (const { currentDocument } of documents) {
      for (const element of currentDocument.querySelectorAll('*')) {
        const style = currentDocument.defaultView.getComputedStyle(element);
        for (const property of ['backgroundImage', 'borderImageSource', 'maskImage', 'webkitMaskImage', 'listStyleImage', 'cursor']) {
          for (const match of String(style[property] || '').matchAll(/url\\(["']?([^"')]+)["']?\\)/g)) {
            const url = new URL(match[1], currentDocument.location.href).href;
            if (String(url).toLowerCase().includes('assets/')) urls.add(url);
          }
        }
      }
    }
    return {
      documentCount: documents.length,
      imageCount: images.length,
      visibleImageCount: images.filter((image) => image.visible).length,
      assetUrlCount: urls.size,
      brokenImages: images.filter((image) => image.src && image.complete && image.naturalWidth === 0),
      legacyAssetImages: images.filter((image) => {
        const source = String(image.src || '').toLowerCase();
        return ['assets/ui/', 'assets/data/', 'assets/game-client/', 'assets/tibia-client/']
          .some((fragment) => source.includes(fragment));
      })
    };
  })()`);
  results.push({ name, ...clickResult, ...inspection });
}

if (process.argv.includes("--open-close-dialog")) {
  await evaluate(`document.querySelector('#desktop-close-button')?.click()`);
  await wait(600);
}

socket.close();
const failures = results.flatMap((state) => [
  ...state.missing.map((selector) => ({ state: state.name, kind: "missing-control", selector })),
  ...state.brokenImages.map((image) => ({ state: state.name, kind: "broken-image", ...image })),
  ...state.legacyAssetImages.map((image) => ({ state: state.name, kind: "legacy-asset-path", ...image }))
]);
console.log(JSON.stringify({ stateCount: results.length, failureCount: failures.length, failures, states: results }, null, 2));
if (failures.length) process.exitCode = 1;
