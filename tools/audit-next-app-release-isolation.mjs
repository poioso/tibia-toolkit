#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.resolve(
  process.env.TIBIA_TOOLKIT_PUBLIC_ROOT || "C:\\Users\\monte\\Documents\\Tibia Toolkit Open Source"
);
const outputPath = path.join(root, "audit-reports", "next-app-release-isolation.json");

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replaceAll("\\", "/"));
}

function changedPaths(cwd) {
  const tracked = git(cwd, ["diff", "--name-only", "-z"]);
  const untracked = git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]);
  return { tracked, untracked, all: [...new Set([...tracked, ...untracked])].sort() };
}

function isSecretOrPrivate(file) {
  const normalized = file.toLowerCase();
  return normalized.includes("acessos_privados")
    || normalized.endsWith(".env")
    || normalized.includes("/.env.") && !normalized.endsWith(".env.example")
    || normalized.includes("pglite")
    || normalized.includes("/.local-")
    || normalized.includes("support-proofs/")
    || normalized.includes("messages.jsonl")
    || normalized.includes("post-studio-schedules.json")
    || normalized.includes("community-bot-state.json")
    || normalized.includes("supporters.json");
}

function classify(file) {
  if (isSecretOrPrivate(file)) return "forbidden-private";
  if (/^(?:\.playwright-cli\/|tmp(?:-|\/)|dist\/|release\/|audit-reports\/)/i.test(file)
      || /^tmp-.*\.(?:png|json|txt)$/i.test(file)
      || /(?:^|\/)main\.corrupted-[^/]+\.js$/i.test(file)) return "forbidden-generated";
  if (file.startsWith("site/")) return "separate-website";
  if (file.startsWith("prototypes/auth-foundation/")) return "separate-auth-service";
  if (file.startsWith("tools/discord-server-bootstrap/")) return "separate-discord-service";
  if (file.startsWith("prototypes/")) return "excluded-prototype";
  if (file.startsWith("assets/")) return "content-pack";
  if (file.startsWith("desktop/") || file.startsWith("lib/")
      || ["app.js", "index.html", "styles.css"].includes(file)) return "app-runtime";
  if (file.startsWith("services/")) return "separate-server-runtime";
  if (file.startsWith("tools/") || file.startsWith("tests/") || file.startsWith("docs/")
      || file.startsWith("scripts/")) return "release-tooling-and-evidence";
  if (["package.json", "package-lock.json", "README.md", ".gitignore",
    "RELEASE_NOTES.md", "RELEASE_NOTES.i18n.json"].includes(file)) return "app-release-metadata";
  return "manual-review";
}

function summarize(paths) {
  const groups = {};
  for (const file of paths) {
    const group = classify(file);
    const entry = groups[group] ||= { count: 0, samples: [] };
    entry.count += 1;
    if (entry.samples.length < 20) entry.samples.push(file);
  }
  return groups;
}

const development = changedPaths(root);
const publicTree = changedPaths(publicRoot);
const report = {
  generatedAt: new Date().toISOString(),
  developmentRoot: root,
  publicRoot,
  policy: {
    sourceOfTruth: root,
    copyWholeWorkspace: false,
    publishFromDevelopmentCheckout: false,
    contentPackBeforeInstaller: true,
    forbiddenGroups: ["forbidden-private", "forbidden-generated", "excluded-prototype", "excluded-source-extraction"],
    separateGroups: ["separate-website", "separate-auth-service", "separate-discord-service", "separate-server-runtime"]
  },
  development: {
    trackedChanges: development.tracked.length,
    untrackedChanges: development.untracked.length,
    totalChanges: development.all.length,
    groups: summarize(development.all)
  },
  publicTree: {
    clean: publicTree.all.length === 0,
    trackedChanges: publicTree.tracked,
    untrackedChanges: publicTree.untracked
  },
  readyToSynchronize: publicTree.all.length === 0,
  blockingReasons: publicTree.all.length === 0
    ? []
    : ["The public release tree contains pre-existing local changes and must be isolated before synchronization."]
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));

if (process.argv.includes("--require-clean-public") && !report.readyToSynchronize) {
  process.exitCode = 2;
}
