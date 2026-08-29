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
  const events = [];
  socket.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (!message.id) {
      events.push(message);
      return;
    }
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });
  return {
    events,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
  };
}

async function inspectTarget(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  const client = createClient(socket);
  const evaluate = async (expression) => {
    const response = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response?.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response?.result?.value;
  };

  try {
    await client.send("Runtime.enable");
    await client.send("Network.enable");
    const result = await evaluate(`(() => {
      const documents = [];
      const visitDocument = (currentDocument, framePath = 'main') => {
        documents.push({ document: currentDocument, framePath });
        [...currentDocument.querySelectorAll('iframe, frame')].forEach((frame, index) => {
          try {
            if (frame.contentDocument) visitDocument(frame.contentDocument, framePath + '/frame[' + index + ']');
          } catch {}
        });
      };
      visitDocument(document);
      const images = documents.flatMap(({ document: currentDocument, framePath }) =>
        [...currentDocument.images].map((image) => ({
          framePath,
          src: image.currentSrc || image.src || '',
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          visible: Boolean(image.getClientRects().length)
        }))
      );
      const cssUrls = new Set();
      for (const { document: currentDocument } of documents) {
        for (const element of currentDocument.querySelectorAll('*')) {
          const style = currentDocument.defaultView.getComputedStyle(element);
          for (const property of ['backgroundImage', 'borderImageSource', 'maskImage', 'webkitMaskImage', 'listStyleImage', 'cursor']) {
            const value = style[property] || '';
            for (const match of value.matchAll(/url\\(["']?([^"')]+)["']?\\)/g)) cssUrls.add(new URL(match[1], currentDocument.location.href).href);
          }
        }
      }
      const resources = performance.getEntriesByType('resource').map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize,
        decodedBodySize: entry.decodedBodySize,
        duration: Math.round(entry.duration)
      }));
      return {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        documentCount: documents.length,
        images,
        cssUrls: [...cssUrls],
        resources
      };
    })()`);
    return result;
  } finally {
    socket.close();
  }
}

const targets = (await readTargets()).filter((target) => target.type === "page" && target.webSocketDebuggerUrl);
assert.ok(targets.length, "No Electron page targets were found on port 9222.");
const inspected = [];
for (const target of targets) inspected.push(await inspectTarget(target));

const brokenImages = inspected.flatMap((target) => target.images
  .filter((image) => image.src && image.complete && image.naturalWidth === 0)
  .map((image) => ({ target: target.url, ...image })));
const assetUrls = new Set(inspected.flatMap((target) => [
  ...target.images.map((image) => image.src),
  ...target.cssUrls,
  ...target.resources.map((resource) => resource.name)
]).filter((url) => /(?:tibiatoolkit:\/\/app\/)?assets\//i.test(url)));

console.log(JSON.stringify({
  targets: inspected.map((target) => ({
    url: target.url,
    title: target.title,
    readyState: target.readyState,
    documentCount: target.documentCount,
    imageCount: target.images.length,
    resourceCount: target.resources.length
  })),
  assetUrlCount: assetUrls.size,
  brokenImageCount: brokenImages.length,
  brokenImages,
  assetUrls: [...assetUrls].sort()
}, null, 2));

if (brokenImages.length) process.exitCode = 1;
