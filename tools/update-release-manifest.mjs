import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const releaseDirectory = path.resolve(process.argv[2] || "dist/tibia-toolkit-release");
const manifestPath = path.join(releaseDirectory, "latest.yml");
let manifest = await fs.readFile(manifestPath, "utf8");

const pathMatch = manifest.match(/^path:\s*(.+)$/m);
if (!pathMatch) {
  throw new Error(`O manifesto nao possui o caminho do instalador: ${manifestPath}`);
}

const installerName = pathMatch[1].trim();
if (!installerName || installerName.includes("/") || installerName.includes("\\")) {
  throw new Error(`Nome de instalador invalido no manifesto: ${installerName}`);
}

const installerPath = path.join(releaseDirectory, installerName);
const installer = await fs.readFile(installerPath);
const sha512 = crypto.createHash("sha512").update(installer).digest("base64");
const size = installer.byteLength;

manifest = replaceRequired(manifest, /(^\s+- url:\s+[^\r\n]+\r?\n\s+sha512:\s+)[^\r\n]+/m, `$1${sha512}`);
manifest = replaceRequired(manifest, /(^\s+- url:\s+[^\r\n]+\r?\n\s+sha512:\s+[^\r\n]+\r?\n\s+size:\s+)\d+/m, `$1${size}`);
manifest = replaceRequired(manifest, /(^sha512:\s+)[^\r\n]+/m, `$1${sha512}`);

await fs.writeFile(manifestPath, manifest, "utf8");
console.log(`Manifesto de atualizacao sincronizado com ${installerName}.`);

function replaceRequired(source, pattern, value) {
  if (!pattern.test(source)) {
    throw new Error(`Estrutura inesperada no manifesto: ${manifestPath}`);
  }
  return source.replace(pattern, value);
}
