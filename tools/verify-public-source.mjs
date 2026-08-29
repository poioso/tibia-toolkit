import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["app.js", "desktop", "lib", "services/game-data-hub", "tools"];
const forbiddenPaths = [
  "desktop/vps-checker",
  "services/market-cache",
  "tools/discord-server-bootstrap",
  "tools/supporters-admin",
  "prototypes",
  "site"
];
const requiredBaseAssets = new Set([
  "assets/ui/Tick.png",
  "assets/ui/Cross.png",
  "assets/ui/tutorial/update.gif",
  "assets/screen-vision/reference/sounds/spells/utura gran.ogg",
  "assets/screen-vision/reference/sounds/spells/exura gran ico.ogg",
  "assets/screen-vision/reference/sounds/spells/utito tempo.ogg",
  "assets/common/actions/Tick.png",
  "assets/common/actions/Cross.png",
  "assets/common/branding/loading-emblem.png",
  "assets/navigation/desktop-controls/desktop-close-active.png",
  "assets/navigation/desktop-controls/desktop-close-idle.png",
  "assets/navigation/desktop-controls/desktop-minimize-active.png",
  "assets/navigation/desktop-controls/desktop-minimize-idle.png",
  "assets/navigation/desktop-controls/desktop-settings-icon.png",
  "assets/window-controls/move-window-grab.png",
  "assets/window-controls/move-window-static.png",
  "assets/window-controls/resize-window.png",
  "assets/tutorial/update.gif",
  "assets/tutorial/websocketobs.gif",
  "assets/tools/tibia-mirror/reference/sounds/spells/utura gran.ogg",
  "assets/tools/tibia-mirror/reference/sounds/spells/exura gran ico.ogg",
  "assets/tools/tibia-mirror/reference/sounds/spells/utito tempo.ogg",
  "assets/tools/tibia-mirror/states/atencao.gif",
  "assets/tools/tibia-mirror/states/cuidado.gif"
]);
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

const assetFiles = [];
await collectFiles(path.join(projectRoot, "assets"), assetFiles).catch((error) => {
  if (error?.code !== "ENOENT") throw error;
});
for (const assetFile of assetFiles) {
  const relativePath = path.relative(projectRoot, assetFile).replaceAll("\\", "/");
  if (!requiredBaseAssets.has(relativePath)) {
    throw new Error(`Asset nao permitido no repositorio publico: ${relativePath}`);
  }
}
for (const relativePath of requiredBaseAssets) {
  await fs.access(path.join(projectRoot, relativePath));
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

async function collectFiles(targetPath, output) {
  const stat = await fs.stat(targetPath);
  if (stat.isFile()) {
    output.push(targetPath);
    return;
  }
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    await collectFiles(path.join(targetPath, entry.name), output);
  }
}
