import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getContentPackChunkGroup, isContentPackRuntimeAsset } from "../lib/content-pack/chunk-groups.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
const version = String(packageJson.version || "").trim();
const desktopRoot = path.join(os.homedir(), "Desktop");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const targetRoot = path.join(desktopRoot, "Tibia Toolkit Portable");
const stagingRoot = path.join(desktopRoot, `.Tibia Toolkit Portable.staging-${timestamp}`);
const builderOutputRoot = path.join(desktopRoot, `.Tibia Toolkit Portable.builder-${timestamp}`);
const localBuildRoot = path.join(projectRoot, ".local", "build", "portable-test");
const nativeHostOutput = path.join(localBuildRoot, "native-host");
const builderConfigPath = path.join(projectRoot, "desktop", "electron-builder-portable.json");
const builderCliPath = path.join(projectRoot, "node_modules", "electron-builder", "cli.js");
const dotnetPath = path.join(projectRoot, "third_party", "dotnet", "sdk", "dotnet.exe");
const nativeHostProject = path.join(projectRoot, "desktop", "screen-vision-native", "ScreenVision.NativeHost", "ScreenVision.NativeHost.csproj");
const assetsSourceRoot = path.join(projectRoot, "assets");
const essentialPaths = [
  "common/Tick.png",
  "common/Cross.png",
  "tutorial/update.gif",
  "library/catalogs/site-library-canonical.json",
  "library/catalogs/item-bundle-revisions.json",
  "tools/tibia-mirror/reference/sounds/spells/utura gran.ogg"
];

assert(version === "0.7.1", `A edição portátil de teste foi planejada para 0.7.1; versão atual: ${version || "ausente"}.`);
assertWithin(desktopRoot, stagingRoot);
assertWithin(desktopRoot, builderOutputRoot);
assertWithin(projectRoot, localBuildRoot);

await fs.rm(stagingRoot, { recursive: true, force: true });
await fs.rm(builderOutputRoot, { recursive: true, force: true });
await fs.rm(localBuildRoot, { recursive: true, force: true });
await fs.mkdir(nativeHostOutput, { recursive: true });

console.log("Auditando os assets e a Biblioteca local...");
await run(process.execPath, [path.join(projectRoot, "tools", "audit-app-runtime-assets.mjs")]);
await run(process.execPath, [path.join(projectRoot, "tools", "verify-app-library-local.mjs")]);

console.log("Publicando o Native Host x64 autocontido...");
await run(dotnetPath, [
  "publish",
  nativeHostProject,
  "-c", "Debug",
  "-r", "win-x64",
  "--self-contained", "true",
  "-p:PublishSingleFile=true",
  "-o", nativeHostOutput,
  "--nologo"
]);

console.log("Empacotando o Electron em modo diretório...");
await run(process.execPath, [
  builderCliPath,
  "--config", builderConfigPath,
  "--win",
  "--x64",
  "--dir",
  `--config.directories.output=${builderOutputRoot}`
]);

const unpackedRoot = path.join(builderOutputRoot, "win-unpacked");
assert((await fs.stat(unpackedRoot).catch(() => null))?.isDirectory(), "O Electron Builder não gerou win-unpacked.");
await fs.rename(unpackedRoot, stagingRoot);
await fs.rm(builderOutputRoot, { recursive: true, force: true });

const resourcesRoot = path.join(stagingRoot, "resources");
console.log("Materializando as dependências de produção do layout PNPM...");
await materializeProductionDependencies(path.join(resourcesRoot, "app", "node_modules"));
const portableContentRoot = path.join(resourcesRoot, "portable-content");
const assetsTargetRoot = path.join(resourcesRoot, "app", "assets");
const nativeHostTargetRoot = path.join(resourcesRoot, "native-host");
await fs.mkdir(assetsTargetRoot, { recursive: true });
await fs.mkdir(nativeHostTargetRoot, { recursive: true });

for (const entry of await fs.readdir(nativeHostOutput, { withFileTypes: true })) {
  if (!entry.isFile() || entry.name.toLowerCase().endsWith(".pdb")) continue;
  await fs.copyFile(path.join(nativeHostOutput, entry.name), path.join(nativeHostTargetRoot, entry.name));
}

const previousMarker = await readJson(path.join(targetRoot, "resources", "portable-test.json")).catch(() => null);
const portableId = /^[a-f0-9-]{16,80}$/i.test(String(previousMarker?.portableId || ""))
  ? previousMarker.portableId
  : crypto.randomUUID();
const builtAt = new Date().toISOString();
await writeJson(path.join(resourcesRoot, "portable-test.json"), {
  schemaVersion: 1,
  mode: "portable-test",
  version,
  portableId,
  builtAt,
  updates: "disabled",
  remoteContentPack: "disabled"
});

console.log("Copiando e auditando o content pack local...");
const sourceFiles = (await walkFiles(assetsSourceRoot))
  .map((absolutePath) => ({
    absolutePath,
    relativePath: path.relative(assetsSourceRoot, absolutePath).replaceAll("\\", "/")
  }))
  .filter(({ relativePath }) => isContentPackRuntimeAsset(relativePath))
  .sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));

const contentEntries = new Array(sourceFiles.length);
let copiedBytes = 0;
let nextIndex = 0;
const workerCount = Math.min(8, Math.max(2, os.cpus().length));
await Promise.all(Array.from({ length: workerCount }, async () => {
  while (true) {
    const index = nextIndex++;
    if (index >= sourceFiles.length) return;
    const source = sourceFiles[index];
    const contents = await fs.readFile(source.absolutePath);
    const target = path.join(assetsTargetRoot, ...source.relativePath.split("/"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
    const sha256 = hashBuffer(contents);
    const bytes = contents.byteLength;
    contentEntries[index] = { path: source.relativePath, bytes, sha256 };
    copiedBytes += bytes;
    if ((index + 1) % 2000 === 0) console.log(`Copiados ${index + 1}/${sourceFiles.length} assets.`);
  }
}));

const essentialFiles = essentialPaths.map((relativePath) => {
  const entry = contentEntries.find((candidate) => candidate.path === relativePath);
  assert(entry, `Asset essencial não entrou no pacote: ${relativePath}`);
  return { path: entry.path, bytes: entry.bytes, sha256: entry.sha256 };
});
const groups = buildGroupManifest(contentEntries);
const aggregateSha256 = hashText(contentEntries.map((entry) => `${entry.path}:${entry.sha256}:${entry.bytes}`).join("\n"));
await writeJson(path.join(portableContentRoot, "content-manifest.json"), {
  schemaVersion: 1,
  mode: "portable-test",
  version,
  builtAt,
  fileCount: contentEntries.length,
  totalBytes: copiedBytes,
  aggregateSha256,
  essentialFiles,
  groups,
  files: contentEntries
});

await fs.mkdir(path.join(stagingRoot, "Data", "AppData"), { recursive: true });
await fs.mkdir(path.join(stagingRoot, "Data", "Documents", "audios"), { recursive: true });
await fs.mkdir(path.join(stagingRoot, "Data", "Documents", "Screenshots"), { recursive: true });
await fs.writeFile(path.join(stagingRoot, "Data", ".portable-data"), "Dados portáteis do Tibia Toolkit.\n", "utf8");
await fs.writeFile(path.join(stagingRoot, "LEIA-ME.txt"), [
  "TIBIA TOOLKIT TESTE PORTÁTIL 0.7.1",
  "",
  "1. Copie a pasta inteira para um pendrive exFAT ou NTFS.",
  "2. Abra Tibia Toolkit Portable.exe.",
  "3. Feche o aplicativo antes de remover o pendrive.",
  "",
  "O programa e os assets funcionam sem instalação e sem download.",
  "TibiaData, Market, VPS e outros dados dinâmicos ainda exigem internet.",
  "Login de homologação não faz parte deste teste e nunca cai para a conta de produção.",
  "Esta cópia local não está assinada e pode exibir um aviso do Windows.",
  ""
].join("\r\n"), "utf8");

const portableExe = path.join(stagingRoot, "Tibia Toolkit Portable.exe");
const nativeHostExe = path.join(nativeHostTargetRoot, "ScreenVision.NativeHost.exe");
const filesBeforeDeliveryManifest = await walkFiles(stagingRoot);
const totalBytesBeforeManifest = await sumFileSizes(filesBeforeDeliveryManifest);
await writeJson(path.join(stagingRoot, "PORTABLE-MANIFEST.json"), {
  schemaVersion: 1,
  mode: "portable-test",
  version,
  architecture: "x64",
  builtAt,
  portableId,
  fileCountExcludingManifest: filesBeforeDeliveryManifest.length,
  totalBytesExcludingManifest: totalBytesBeforeManifest,
  executable: { path: "Tibia Toolkit Portable.exe", sha256: await hashFile(portableExe) },
  nativeHost: { path: "resources/native-host/ScreenVision.NativeHost.exe", sha256: await hashFile(nativeHostExe) },
  content: { fileCount: contentEntries.length, totalBytes: copiedBytes, aggregateSha256 },
  updates: "disabled",
  remoteContentPack: "disabled",
  publication: "none"
});

console.log("Executando auditoria completa da pasta portátil...");
await run(process.execPath, [path.join(projectRoot, "tools", "verify-portable-runtime.mjs"), stagingRoot]);

let backupRoot = null;
if ((await fs.stat(targetRoot).catch(() => null))?.isDirectory()) {
  backupRoot = path.join(desktopRoot, `Tibia Toolkit Portable.backup-${timestamp}`);
  assertWithin(desktopRoot, backupRoot);
  await fs.rename(targetRoot, backupRoot);
}

try {
  await fs.rename(stagingRoot, targetRoot);
} catch (error) {
  if (backupRoot) await fs.rename(backupRoot, targetRoot).catch(() => {});
  throw error;
}

console.log(JSON.stringify({
  ok: true,
  targetRoot,
  backupRoot,
  version,
  contentFiles: contentEntries.length,
  contentBytes: copiedBytes,
  estimatedTotalBytes: totalBytesBeforeManifest
}, null, 2));

function buildGroupManifest(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const id = getContentPackChunkGroup(entry.path);
    const group = groups.get(id) || { id, fileCount: 0, totalBytes: 0, lines: [] };
    group.fileCount += 1;
    group.totalBytes += entry.bytes;
    group.lines.push(`${entry.path}:${entry.sha256}:${entry.bytes}`);
    groups.set(id, group);
  }
  return [...groups.values()]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map(({ id, fileCount, totalBytes, lines }) => ({ id, fileCount, totalBytes, sha256: hashText(lines.join("\n")) }));
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

async function sumFileSizes(files) {
  let total = 0;
  for (const filePath of files) total += (await fs.stat(filePath)).size;
  return total;
}

async function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  const handle = await fs.open(filePath, "r");
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close().catch(() => {});
  }
  return hash.digest("hex");
}

function hashBuffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashText(value) {
  return hashBuffer(Buffer.from(value));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function materializeProductionDependencies(targetNodeModules) {
  const queue = Object.keys(packageJson.dependencies || {}).map((name) => ({ name, parentDir: projectRoot, optional: false }));
  const copied = new Set();
  while (queue.length) {
    const { name: packageName, parentDir, optional } = queue.shift();
    if (!packageName || copied.has(packageName)) continue;
    const sourceDir = await resolvePackageDirectory(packageName, parentDir);
    if (!sourceDir && optional) continue;
    assert(sourceDir, `Dependência de produção ausente: ${packageName}`);
    const metadata = await readJson(path.join(sourceDir, "package.json"));
    const targetDir = path.join(targetNodeModules, ...packageName.split("/"));
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(targetDir), { recursive: true });
    await fs.cp(sourceDir, targetDir, {
      recursive: true,
      force: true,
      filter(source) {
        const relative = path.relative(sourceDir, source);
        return !relative || (!relative.split(path.sep).includes("node_modules") && !relative.toLowerCase().endsWith(".pdb"));
      }
    });
    copied.add(packageName);
    for (const dependency of Object.keys(metadata.dependencies || {})) {
      if (!copied.has(dependency)) queue.push({ name: dependency, parentDir: sourceDir, optional: false });
    }
    for (const dependency of Object.keys(metadata.optionalDependencies || {})) {
      if (!copied.has(dependency)) queue.push({ name: dependency, parentDir: sourceDir, optional: true });
    }
  }
  console.log(`Dependências materializadas: ${copied.size}.`);
}

async function resolvePackageDirectory(packageName, parentDir) {
  const candidates = [
    path.join(parentDir, "node_modules", ...packageName.split("/")),
    path.join(path.dirname(parentDir), ...packageName.split("/")),
    path.join(projectRoot, "node_modules", ...packageName.split("/"))
  ];
  let resolved = "";
  for (const candidate of candidates) {
    resolved = await fs.realpath(candidate).catch(() => "");
    if (resolved) break;
  }
  return resolved;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `Caminho inseguro: ${candidate}`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve()
      : reject(new Error(`Falha ao executar ${command} ${args.join(" ")}.`)));
  });
}
