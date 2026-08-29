#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = process.env.TIBIA_TOOLKIT_SOURCE_ROOT
  || "C:\\Users\\monte\\Desktop\\Backup Desenvolvimento do App Tibia Toolkit\\Tibiatoolkit App Producao";
const siteRoot = process.env.TIBIA_TOOLKIT_SITE_ROOT || "C:\\Users\\monte\\Documents\\Tibiatoolkit Site Produção";
const botRoot = process.env.TIBIA_TOOLKIT_BOT_ROOT || "C:\\Users\\monte\\Documents\\Tibia Toolkit Bot Produção";
const reportPath = path.join(appRoot, ".local", "audits", "documentation-coverage.json");
const excludedSegments = new Set([
  "node_modules", ".git", ".next", ".local", ".codex", ".obsidian", "backup",
  "dist", "output", "tmp", "reports", "release", "audit-reports", ".secrets-temp",
  ".vps-checker-test", ".playwright-cli"
]);
const privateNames = [
  "ACESSOS_PRIVADOS_EMAIL_TIBIA_TOOLKIT.md",
  "ACESSOS_PRIVADOS_SITE.md",
  "ACESSOS_PRIVADOS_SITE_HOSPEDAINFO.md"
];
const sourceProtectionPath = path.join(appRoot, ".local", "migration", "source-protection.json");

async function walk(root) {
  const result = [];
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excludedSegments.has(entry.name.toLowerCase())) await visit(absolute);
      } else if (entry.isFile()) {
        result.push(absolute);
      }
    }
  }
  await visit(root);
  return result;
}

function relative(root, absolute) {
  return path.relative(root, absolute).replaceAll(path.sep, "/");
}

function isMarkdown(absolute) {
  return path.extname(absolute).toLowerCase() === ".md";
}

async function sha256(file) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

const sourceFiles = await walk(sourceRoot);
const destinationFiles = [
  ...(await walk(appRoot)),
  ...(await walk(siteRoot)),
  ...(await walk(botRoot))
];
const sourceMarkdown = sourceFiles.filter(isMarkdown);
const destinationMarkdown = destinationFiles.filter(isMarkdown);
const privateChecks = [];
const privateSource = path.join(sourceRoot, ".secrets-temp", "ACESSOS_PRIVADOS_SITE_HOSPEDAINFO.md");
for (const name of privateNames) {
  const source = name === "ACESSOS_PRIVADOS_SITE_HOSPEDAINFO.md" ? privateSource : path.join(sourceRoot, name);
  const destinations = [appRoot, siteRoot, botRoot].map((root) => path.join(root, name));
  privateChecks.push({
    name,
    sourceExists: await fs.stat(source).then(() => true).catch(() => false),
    destinationExists: await Promise.all(destinations.map((file) => fs.stat(file).then(() => true).catch(() => false))),
    sourceSha256: await sha256(source).catch(() => null),
    destinationSha256: await Promise.all(destinations.map((file) => sha256(file).catch(() => null)))
  });
}

const sourceProtection = await fs.readFile(sourceProtectionPath, "utf8")
  .then((value) => JSON.parse(value))
  .catch(() => null);
const migrationCutoff = sourceProtection?.DestinationCreationTime
  ? Date.parse(sourceProtection.DestinationCreationTime)
  : Date.parse("2026-08-26T16:31:01.673Z");
const appRuntimeRoots = ["app.js", "index.html", "styles.css", "desktop", "lib", "assets", "tests", "tools", "README.md", "RELEASE_NOTES.md", "package.json", "package-lock.json", "pnpm-lock.yaml"];
const sourceNewerOrMissing = [];
for (const root of appRuntimeRoots) {
  const absolute = path.join(sourceRoot, root);
  const candidates = await fs.stat(absolute).then((stat) => stat.isFile() ? [absolute] : walk(absolute)).catch(() => []);
  for (const file of await candidates) {
    const rel = relative(sourceRoot, file);
    const normalized = rel.toLowerCase();
    if (normalized.split("/").some((segment) => excludedSegments.has(segment))) continue;
    const sourceStat = await fs.stat(file);
    if (sourceStat.mtimeMs < migrationCutoff) continue;
    const destination = path.join(appRoot, rel);
    const destinationStat = await fs.stat(destination).catch(() => null);
    if (!destinationStat || sourceStat.mtimeMs > destinationStat.mtimeMs + 1000) {
      sourceNewerOrMissing.push({ path: rel, destinationExists: Boolean(destinationStat) });
    }
  }
}

// The original workspace also carried the Discord/Post Studio service before
// it was split into the Bot project. Keep an explicit path map here so a later
// Desktop update cannot silently disappear between the three workspaces.
const botServiceSourceRoot = path.join(sourceRoot, "services", "discord-social-relays");
const botServiceDestinationRoot = path.join(botRoot, "discord", "community");
const botAssetPathMap = new Map([
  ["assets/boas-vindas.gif", "assets/onboarding/boas-vindas.gif"],
  ["assets/daniel-hatano-partner.png", "assets/partners/daniel-hatano-partner.png"],
  ["assets/instagram.gif", "assets/social/instagram.gif"],
  ["assets/post-studio.ico", "assets/studio/post-studio.ico"],
  ["assets/regras-ban.gif", "assets/moderation/regras-ban.gif"],
  ["assets/spytools-partner.png", "assets/partners/spytools-partner.png"],
  ["assets/subscribe.gif", "assets/social/subscribe.gif"],
  ["assets/tibia-news-profile.png", "assets/branding/tibia-news-profile.png"],
  ["assets/twitch.gif", "assets/social/twitch.gif"]
]);
function mapBotServicePath(relativePath) {
  if (relativePath.startsWith("assets/welcome-cards/")) {
    return `assets/onboarding/${relativePath.slice("assets/".length)}`;
  }
  return botAssetPathMap.get(relativePath) || relativePath;
}
const botServiceCoverage = [];
const legacyMatches = [];
const botServiceFiles = await walk(botServiceSourceRoot).catch(() => []);
for (const file of botServiceFiles) {
  const serviceRelative = relative(botServiceSourceRoot, file);
  const destinationRelative = mapBotServicePath(serviceRelative);
  const destination = path.join(botServiceDestinationRoot, destinationRelative);
  const sourceHash = await sha256(file);
  const destinationHash = await sha256(destination).catch(() => null);
  const destinationExists = destinationHash !== null;
  const isBinaryAsset = serviceRelative.startsWith("assets/");
  botServiceCoverage.push({
    source: relative(sourceRoot, file),
    destination: relative(botRoot, destination),
    destinationExists,
    sameHash: destinationExists && destinationHash === sourceHash,
    requiredExactHash: isBinaryAsset
  });
  if (!destinationExists || (isBinaryAsset && destinationHash !== sourceHash)) {
    legacyMatches.push({
      file: relative(sourceRoot, file),
      pattern: `Bot mapping missing or changed: ${relative(botRoot, destination)}`
    });
  }
}

const postMigrationSourceFiles = [];
const unmappedPostMigrationFiles = [];
for (const file of sourceFiles) {
  const stat = await fs.stat(file);
  if (stat.mtimeMs <= migrationCutoff) continue;
  const sourceRelative = relative(sourceRoot, file);
  const normalized = sourceRelative.toLowerCase();
  if (normalized.split("/").some((segment) => excludedSegments.has(segment))) continue;
  let destination = null;
  if (normalized === "docs/discord_instagram_bot_vps_operations.md") {
    destination = path.join(botRoot, "docs", "mandatory", "operations", "DISCORD_INSTAGRAM_BOT_VPS_OPERATIONS.md");
  } else if (normalized.startsWith("services/discord-social-relays/")) {
    destination = path.join(botServiceDestinationRoot, mapBotServicePath(sourceRelative.slice("services/discord-social-relays/".length)));
  }
  const destinationExists = Boolean(destination) && await fs.stat(destination).then(() => true).catch(() => false);
  const record = { source: sourceRelative, destination: destination ? relative(destination.startsWith(botRoot) ? botRoot : appRoot, destination) : null, destinationExists };
  postMigrationSourceFiles.push(record);
  if (!destinationExists) unmappedPostMigrationFiles.push(record);
}

const legacyPatterns = ["Tibia Bot Produção", "G:\\\\Tibia", "C:\\\\Users\\\\monte\\\\Documents\\\\Tibia\\\\"];
for (const file of destinationMarkdown) {
  const text = await fs.readFile(file, "utf8");
  for (const pattern of legacyPatterns) {
    if (text.includes(pattern)) legacyMatches.push({ file: file, pattern });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceRoot,
  destinations: { appRoot, siteRoot, botRoot },
  sourceProjectMarkdownCount: sourceMarkdown.length,
  destinationMarkdownCount: destinationMarkdown.length,
  privateChecks,
  sourceNewerOrMissing,
  botServiceCoverage,
  postMigrationSourceFiles,
  unmappedPostMigrationFiles,
  legacyMatches,
  policy: {
    sourceUntouchedByThisAudit: true,
    sourcePostMigrationFilesDetected: postMigrationSourceFiles.length,
    sourcePostMigrationFilesMapped: postMigrationSourceFiles.length - unmappedPostMigrationFiles.length,
    generatedAndDependencyDirectoriesExcluded: [...excludedSegments],
    privateFilesNeverPackaged: privateNames
  },
  passed: privateChecks.every((check) => check.sourceExists
    && check.destinationExists.every(Boolean)
    && check.destinationSha256.every((hash) => hash === check.sourceSha256))
    && sourceNewerOrMissing.length === 0
    && botServiceCoverage.every((entry) => entry.destinationExists && (!entry.requiredExactHash || entry.sameHash))
    && unmappedPostMigrationFiles.length === 0
    && legacyMatches.length === 0
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 2;
