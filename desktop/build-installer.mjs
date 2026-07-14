import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
const dotnetPath = process.env.DOTNET_HOST_PATH || "dotnet";
const nativeHostProjectPath = path.join(projectRoot, "desktop", "screen-vision-native", "ScreenVision.NativeHost", "ScreenVision.NativeHost.csproj");
const nativeHostPublishDir = path.join(projectRoot, "desktop", "screen-vision-native", "publish", "win-x64");
const builderCliPath = path.join(projectRoot, "node_modules", "electron-builder", "cli.js");
const builderConfigPath = path.join(projectRoot, "desktop", "electron-builder.json");
const version = String(packageJson.version || "").trim();
const windowsVersion = /^\d+\.\d+\.\d+$/.test(version) ? `${version}.0` : "0.0.0.0";

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`A versao em package.json nao e SemVer valida: ${version || "(vazia)"}.`);
}

await runCommand(dotnetPath, [
  "publish",
  nativeHostProjectPath,
  "-c",
  "Release",
  "-r",
  "win-x64",
  "--self-contained",
  "true",
  "-o",
  nativeHostPublishDir,
  `-p:Version=${version}`,
  `-p:FileVersion=${windowsVersion}`,
  `-p:AssemblyVersion=${windowsVersion}`,
  `-p:InformationalVersion=${version}`,
  "--nologo"
]);

await runCommand(process.execPath, [
  builderCliPath,
  "--config",
  builderConfigPath,
  "--win",
  "nsis"
]);

await runCommand(process.execPath, [
  path.join(projectRoot, "tools", "finalize-update-manifest.mjs")
]);

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      windowsHide: false
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Falha ao executar ${command} ${args.join(" ")}.`));
    });
  });
}
