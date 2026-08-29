#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const RUNTIME_ROOTS = ["desktop", "lib", path.join("site", "app"), path.join("site", "public"), "assets"];
const CODE_EXTENSIONS = new Set([".css", ".html", ".js", ".mjs", ".cjs", ".ts", ".tsx"]);
const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", ".local", ".git"]);
const IMAGE_URL = /https?:\/\/[^\s"'`)\\]+?\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:\?[^\s"'`)\\]*)?/gi;

function isFirstParty(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost"
    || host.endsWith(".localhost")
    || host === "tibiatoolkit.com"
    || host.endsWith(".tibiatoolkit.com");
}

async function* walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) yield fullPath;
  }
}

const violations = [];
let scannedFiles = 0;

for (const relativeRoot of RUNTIME_ROOTS) {
  const absoluteRoot = path.join(ROOT, relativeRoot);
  try {
    await fs.access(absoluteRoot);
  } catch {
    continue;
  }

  for await (const filePath of walk(absoluteRoot)) {
    scannedFiles += 1;
    const source = await fs.readFile(filePath, "utf8");
    for (const match of source.matchAll(IMAGE_URL)) {
      const rawUrl = match[0];
      let parsed;
      try {
        parsed = new URL(rawUrl);
      } catch {
        continue;
      }
      if (isFirstParty(parsed.hostname)) continue;
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      violations.push({
        file: path.relative(ROOT, filePath).replaceAll(path.sep, "/"),
        line,
        url: rawUrl
      });
    }
  }
}

const report = {
  passed: violations.length === 0,
  policy: "Runtime image URLs must be local or first-party Tibia Toolkit URLs.",
  scannedFiles,
  violations
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
