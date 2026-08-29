import assert from "node:assert/strict";
import test from "node:test";
import { writeJsonFileResilient } from "../desktop/resilient-json-store.js";

function transientError(code = "EPERM") {
  return Object.assign(new Error(code), { code });
}

test("retries a transient Windows rename failure before succeeding", async () => {
  let renameAttempts = 0;
  const waits = [];
  const writes = [];
  const fileSystem = {
    mkdir: async () => {},
    writeFile: async (filePath, content) => writes.push({ filePath, content }),
    rm: async () => {},
    rename: async () => {
      renameAttempts += 1;
      if (renameAttempts < 3) throw transientError();
    }
  };

  const result = await writeJsonFileResilient("C:\\data\\overlay-storage.json", { world: "Antica" }, {
    fileSystem,
    retryDelays: [20, 80, 200],
    wait: async (delay) => waits.push(delay)
  });

  assert.equal(result.mode, "rename");
  assert.equal(renameAttempts, 3);
  assert.deepEqual(waits, [20, 80]);
  assert.equal(writes.length, 1);
  assert.match(writes[0].content, /"world": "Antica"/);
});

test("falls back to a complete direct write after persistent EPERM", async () => {
  const writes = [];
  let fallbackCode = "";
  const fileSystem = {
    mkdir: async () => {},
    writeFile: async (filePath, content) => writes.push({ filePath, content }),
    rm: async () => {},
    rename: async () => { throw transientError(); }
  };

  const targetPath = "C:\\data\\overlay-storage.json";
  const result = await writeJsonFileResilient(targetPath, { locale: "pt-BR" }, {
    fileSystem,
    retryDelays: [1, 2],
    wait: async () => {},
    onDirectWriteFallback: async (error) => { fallbackCode = error.code; }
  });

  assert.equal(result.mode, "direct-write");
  assert.equal(fallbackCode, "EPERM");
  assert.equal(writes.at(-1).filePath, targetPath);
  assert.match(writes.at(-1).content, /"locale": "pt-BR"/);
});

test("does not hide non-transient storage failures", async () => {
  const fileSystem = {
    mkdir: async () => {},
    writeFile: async () => {},
    rm: async () => {},
    rename: async () => { throw transientError("ENOSPC"); }
  };

  await assert.rejects(
    writeJsonFileResilient("C:\\data\\overlay-storage.json", {}, { fileSystem, retryDelays: [] }),
    { code: "ENOSPC" }
  );
});
