import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSource = await readFile(new URL("../desktop/main.js", import.meta.url), "utf8");

test("development launches only the self-contained Native Host apphost", () => {
  assert.match(mainSource, /command: nativeHostDevelopmentExePath,[\s\S]*?source: "development-apphost"/);
  assert.match(mainSource, /fs\.stat\(nativeHostDevelopmentExePath\)/);
  assert.match(mainSource, /Building WPF while the user interacts blocks the application/);
  assert.doesNotMatch(mainSource, /nativeHostDevelopmentDllPath/);
  assert.doesNotMatch(mainSource, /source: "development-dotnet"/);
});
