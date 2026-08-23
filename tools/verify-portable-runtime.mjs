import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const portableRoot = path.resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("Informe a pasta raiz do Tibia Toolkit portátil.");

const resourcesRoot = path.join(portableRoot, "resources");
const appRoot = path.join(resourcesRoot, "app");
const contentRoot = path.join(resourcesRoot, "portable-content");
const assetsRoot = path.join(appRoot, "assets");
const marker = await readJson(path.join(resourcesRoot, "portable-test.json"));
const contentManifest = await readJson(path.join(contentRoot, "content-manifest.json"));
const deliveryManifest = await readJson(path.join(portableRoot, "PORTABLE-MANIFEST.json"));

assert(marker?.mode === "portable-test", "Marcador portable-test ausente ou inválido.");
assert(/^[a-f0-9-]{16,80}$/i.test(String(marker?.portableId || "")), "portableId inválido.");
assert(contentManifest?.mode === "portable-test", "Manifesto de conteúdo inválido.");
assert(contentManifest?.version === marker?.version, "Versões do marcador e do conteúdo não coincidem.");
assert(deliveryManifest?.version === marker?.version, "Manifesto de entrega pertence a outra versão.");

const requiredFiles = [
  "Tibia Toolkit Portable.exe",
  "resources/app/package.json",
  "resources/app/desktop/main.js",
  "resources/app/desktop/preload.cjs",
  "resources/app/desktop/screenshot-assistant.html",
  "resources/app/desktop/screenshot-assistant.js",
  "resources/app/desktop/screenshot-assistant.css",
  "resources/app/desktop/screenshot-assistant-preload.cjs",
  "resources/app/desktop/screenshot-selector.html",
  "resources/app/desktop/screenshot-selector.js",
  "resources/app/desktop/screenshot-selector.css",
  "resources/app/desktop/app-config.json",
  "resources/native-host/ScreenVision.NativeHost.exe",
  "resources/portable-test.json",
  "resources/portable-content/content-manifest.json",
  "Data/.portable-data"
];
for (const relativePath of requiredFiles) {
  const details = await fs.stat(path.join(portableRoot, ...relativePath.split("/"))).catch(() => null);
  assert(details?.isFile() && details.size > 0, `Arquivo obrigatório ausente ou vazio: ${relativePath}`);
}
const executablePath = path.join(portableRoot, "Tibia Toolkit Portable.exe");
const nativeHostPath = path.join(resourcesRoot, "native-host", "ScreenVision.NativeHost.exe");
assert(await hashFile(executablePath) === deliveryManifest?.executable?.sha256, "Hash do executável divergente.");
assert(await hashFile(nativeHostPath) === deliveryManifest?.nativeHost?.sha256, "Hash do Native Host divergente.");
await import(pathToFileURL(path.join(appRoot, "node_modules", "obs-websocket-js", "dist", "msgpack.js")).href);

const contentEntries = Array.isArray(contentManifest.files) ? contentManifest.files : [];
assert(contentEntries.length === contentManifest.fileCount, "Contagem de arquivos do conteúdo divergente.");
const aggregateLines = [];
for (let index = 0; index < contentEntries.length; index += 1) {
  const entry = contentEntries[index];
  const relativePath = normalizeRelativePath(entry?.path);
  const absolutePath = path.join(assetsRoot, ...relativePath.split("/"));
  const details = await fs.stat(absolutePath).catch(() => null);
  assert(details?.isFile(), `Asset ausente: ${relativePath}`);
  assert(details.size === Number(entry?.bytes), `Tamanho divergente: ${relativePath}`);
  const sha256 = await hashFile(absolutePath);
  assert(sha256 === entry?.sha256, `Hash divergente: ${relativePath}`);
  aggregateLines.push(`${relativePath}:${sha256}:${details.size}`);
  if ((index + 1) % 2000 === 0) process.stdout.write(`Verificados ${index + 1}/${contentEntries.length} assets.\n`);
}
const aggregateSha256 = hashText(aggregateLines.join("\n"));
assert(aggregateSha256 === contentManifest.aggregateSha256, "Hash agregado do conteúdo divergente.");

const allFiles = await walkFiles(portableRoot);
const forbiddenNames = [
  /(^|[/\\])auth-homologation\.local\.json$/i,
  /(^|[/\\])ACESSOS_PRIVADOS_SITE\.md$/i,
  /(^|[/\\])\.env(?:\..+)?$/i,
  /\.corrupted-[^/\\]+$/i,
  /\.(?:pem|pfx|p12|sqlite|sqlite3)$/i,
  /(^|[/\\])desktop-debug\.log$/i,
  /(^|[/\\])performance-metrics\.jsonl$/i
];
const forbiddenFiles = allFiles
  .map((absolutePath) => path.relative(portableRoot, absolutePath))
  .filter((relativePath) => forbiddenNames.some((pattern) => pattern.test(relativePath)));
assert(forbiddenFiles.length === 0, `Arquivos proibidos encontrados: ${forbiddenFiles.join(", ")}`);

const appTextFiles = allFiles.filter((absolutePath) => (
  absolutePath.startsWith(`${appRoot}${path.sep}`)
  && [".js", ".cjs", ".mjs", ".json", ".html", ".css", ".txt", ".md", ".ps1"].includes(path.extname(absolutePath).toLowerCase())
));
for (const absolutePath of appTextFiles) {
  const contents = await fs.readFile(absolutePath, "utf8");
  assert(!/C:\\Users\\monte/i.test(contents), `Caminho pessoal encontrado em ${path.relative(portableRoot, absolutePath)}.`);
  assert(!/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i.test(contents), `Chave privada encontrada em ${path.relative(portableRoot, absolutePath)}.`);
  if (path.extname(absolutePath).toLowerCase() === ".html") {
    const stylesheetLinks = [...contents.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)];
    for (const match of stylesheetLinks) {
      const href = String(match[1] || "").trim();
      if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/") || href.startsWith("//")) continue;
      const stylesheetPath = path.resolve(path.dirname(absolutePath), href.split(/[?#]/, 1)[0]);
      assert(stylesheetPath.startsWith(`${appRoot}${path.sep}`), `CSS fora do app em ${path.relative(portableRoot, absolutePath)}: ${href}`);
      const stylesheetDetails = await fs.stat(stylesheetPath).catch(() => null);
      assert(stylesheetDetails?.isFile() && stylesheetDetails.size > 0, `CSS referenciado ausente em ${path.relative(portableRoot, absolutePath)}: ${href}`);
    }
  }
}

const dataFiles = (await walkFiles(path.join(portableRoot, "Data"))).filter((absolutePath) => path.basename(absolutePath) !== ".portable-data");
assert(dataFiles.length === 0, "A pasta Data deveria começar limpa.");

console.log(JSON.stringify({
  ok: true,
  portableRoot,
  version: marker.version,
  contentFiles: contentEntries.length,
  contentBytes: contentManifest.totalBytes,
  aggregateSha256,
  packagedFiles: allFiles.length
}, null, 2));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeRelativePath(value) {
  const normalized = String(value || "").replaceAll("\\", "/").replace(/^\/+/, "");
  assert(normalized && !normalized.includes("..") && !path.isAbsolute(normalized), `Caminho inválido no manifesto: ${value}`);
  return normalized;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  const file = await fs.open(filePath, "r");
  try {
    for await (const chunk of file.createReadStream()) hash.update(chunk);
  } finally {
    await file.close().catch(() => {});
  }
  return hash.digest("hex");
}

function hashText(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function walkFiles(root) {
  const result = [];
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(absolutePath);
      else if (entry.isFile()) result.push(absolutePath);
    }
  }
  return result;
}
