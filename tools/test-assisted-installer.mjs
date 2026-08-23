import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "desktop", "electron-builder.json");
const includePath = path.join(root, "desktop", "build", "installer.nsh");

const config = JSON.parse(await fs.readFile(configPath, "utf8"));
const nsis = await fs.readFile(includePath, "utf8");

assert.equal(config.nsis.oneClick, false, "O instalador precisa usar o fluxo assistido.");
assert.equal(
  config.nsis.allowToChangeInstallationDirectory,
  false,
  "A pasta deve ser controlada pela pagina personalizada, nao pela pagina generica."
);
assert.equal(config.nsis.createDesktopShortcut, true);
assert.equal(config.nsis.createStartMenuShortcut, true);

for (const fragment of [
  "Instalacao padrao (recomendada)",
  "Instalacao personalizada",
  "CustomInstallOptionsPageCreate",
  "NSD_CreateDirRequest",
  "Criar atalho na Area de Trabalho",
  "Criar atalho no menu Iniciar",
  "HadExistingInstallation",
  "KeepShortcuts"
]) {
  assert.ok(nsis.includes(fragment), `Contrato ausente no NSIS: ${fragment}`);
}

assert.match(
  nsis,
  /\$HadExistingInstallation == "1"[\s\S]{0,80}Abort/,
  "Instalacoes existentes devem pular as paginas de escolha."
);
assert.match(
  nsis,
  /\$HadExistingInstallation == "0"[\s\S]{0,500}Delete "\$newDesktopLink"/,
  "Atalhos personalizados so podem ser removidos em instalacao limpa."
);

const customInit = nsis.match(/!macro customInit([\s\S]*?)!macroend/)?.[1] || "";
assert.ok(customInit.includes("$LocalAppData\\Programs\\Tibia Toolkit"));
assert.ok(
  customInit.indexOf("HadExistingInstallation") < customInit.indexOf("StrCpy $INSTDIR"),
  "A pasta padrao so pode ser escolhida depois de verificar uma instalacao anterior."
);

console.log("OK assisted installer contract");
console.log("- clean install: standard or custom");
console.log("- custom install: directory and shortcut choices");
console.log("- update/reinstall: registered directory reused without prompting");
console.log("- user data, cache and protected login remain outside the program folder");
