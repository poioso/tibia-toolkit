import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["app.js", "desktop", "lib", "services/game-data-hub", "tools"];
const forbiddenPaths = [
  "assets",
  "desktop/vps-checker",
  "services/market-cache",
  "tools/discord-server-bootstrap",
  "tools/supporters-admin",
  "prototypes",
  "site"
];
const jsExtensions = new Set([".js", ".mjs", ".cjs"]);

const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(String(packageJson.version || ""))) {
  throw new Error("package.json precisa conter uma versao SemVer valida.");
}

for (const relativePath of forbiddenPaths) {
  try {
    await fs.access(path.join(projectRoot, relativePath));
    throw new Error(`O caminho privado ou grande nao pode existir no repositorio publico: ${relativePath}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const sourceFiles = [];
for (const relativePath of sourceRoots) {
  await collectJavaScript(path.join(projectRoot, relativePath), sourceFiles);
}

for (const sourceFile of sourceFiles) {
  const result = spawnSync(process.execPath, ["--check", sourceFile], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Falha de sintaxe em ${path.relative(projectRoot, sourceFile)}:\n${result.stderr || result.stdout}`);
  }
}

console.log(`Verificacao publica concluida: ${sourceFiles.length} arquivos JavaScript validos.`);

async function collectJavaScript(targetPath, output) {
  const stat = await fs.stat(targetPath);
  if (stat.isFile()) {
    if (jsExtensions.has(path.extname(targetPath))) output.push(targetPath);
    return;
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "publish" || entry.name === "bin" || entry.name === "obj") continue;
    await collectJavaScript(path.join(targetPath, entry.name), output);
  }
}
