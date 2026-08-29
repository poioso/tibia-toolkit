import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
const dotnetPath = process.env.DOTNET_HOST_PATH || "dotnet";
const nativeHostProjectPath = path.join(projectRoot, "desktop", "screen-vision-native", "ScreenVision.NativeHost", "ScreenVision.NativeHost.csproj");
const nativeHostPublishDir = path.join(projectRoot, "desktop", "screen-vision-native", "publish", "win-x64");
const builderCliPath = path.join(projectRoot, "node_modules", "electron-builder", "cli.js");
const builderConfigPath = path.join(projectRoot, "desktop", "electron-builder.json");

await runNode("tools/audit-runtime-dependencies.mjs");
if (process.env.TIBIA_TOOLKIT_ASSET_SOURCE) await runNode("tools/audit-app-runtime-assets.mjs");
await runCommand(dotnetPath, [
  "publish", nativeHostProjectPath, "-c", "Release", "-r", "win-x64", "--self-contained", "true",
  "-o", nativeHostPublishDir, `-p:Version=${packageJson.version}`, "--nologo"
]);
await runCommand(process.execPath, [builderCliPath, "--config", builderConfigPath, "--win", "nsis"]);
await runNode("tools/finalize-update-manifest.mjs");

function runNode(relativePath) { return runCommand(process.execPath, [path.join(projectRoot, relativePath)]); }
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: "inherit", windowsHide: false });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Falha ao executar ${command} ${args.join(" ")}.`)));
  });
}
