#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const ROOT = process.cwd();
const AUDIO_ROOT = path.join(ROOT, "assets");
const EXCLUDED_SEGMENTS = new Set(["organized"]);

async function* walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_SEGMENTS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".ogg") yield fullPath;
  }
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next installed Chromium browser.
    }
  }
  throw new Error("No installed Chromium browser was found for the audio decode audit.");
}

const browserExecutable = await findBrowserExecutable();
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable,
  args: ["--autoplay-policy=no-user-gesture-required"]
});
const page = await browser.newPage();

try {
  await page.setContent("<meta charset=utf-8><title>Audio decode audit</title>");
  const files = [];
  for await (const filePath of walk(AUDIO_ROOT)) files.push(filePath);
  files.sort((left, right) => left.localeCompare(right));

  const payload = await Promise.all(files.map(async (filePath) => ({
    file: path.relative(ROOT, filePath).replaceAll(path.sep, "/"),
    base64: (await fs.readFile(filePath)).toString("base64")
  })));
  const decoded = await page.evaluate(async (audioPayload) => {
    const context = new AudioContext();
    const results = [];
    for (const entry of audioPayload) {
      try {
        const bytes = Uint8Array.from(atob(entry.base64), character => character.charCodeAt(0));
        const decodedAudio = await Promise.race([
          context.decodeAudioData(bytes.buffer),
          new Promise((_, reject) => setTimeout(() => reject(new Error("decode timeout")), 5000))
        ]);
        results.push({ file: entry.file, ok: decodedAudio.duration > 0, duration: decodedAudio.duration });
      } catch (error) {
        results.push({ file: entry.file, ok: false, error: String(error && (error.stack || error.message) || error) });
      }
    }
    await context.close();
    return results;
  }, payload);

  const failures = decoded
    .filter((entry) => !entry.ok)
    .map(({ file, error }) => ({ file, error: error || "Decoded audio has no duration." }));
  const decodedSeconds = decoded.reduce((sum, entry) => sum + (entry.ok ? Number(entry.duration) || 0 : 0), 0);

  const report = {
    passed: files.length > 0 && failures.length === 0,
    decoder: `Playwright Chromium ${browser.version()}`,
    browserExecutable,
    decodedFiles: files.length - failures.length,
    totalFiles: files.length,
    decodedSeconds: Number(decodedSeconds.toFixed(3)),
    failures
  };

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.passed ? 0 : 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
