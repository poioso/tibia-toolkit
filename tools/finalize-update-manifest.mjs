import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const manifestPath = path.join(projectRoot, "dist", "tibia-toolkit-release", "latest.yml");
const notesPath = path.join(projectRoot, "RELEASE_NOTES.md");
const localizedNotesPath = path.join(projectRoot, "RELEASE_NOTES.i18n.json");

const manifest = await fs.readFile(manifestPath, "utf8");
const notes = String(process.env.TIBIA_TOOLKIT_RELEASE_NOTES || await fs.readFile(notesPath, "utf8"))
  .trim()
  .replace(/\r?\n/g, "\n");
let localizedNotes = {};

try {
  localizedNotes = JSON.parse(await fs.readFile(localizedNotesPath, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

if (!notes) {
  throw new Error("Adicione as notas em RELEASE_NOTES.md antes de gerar a atualizacao.");
}

const withoutPreviousNotes = manifest.replace(/\nreleaseNotes:\s*[\s\S]*$/m, "").trimEnd();
const yamlNotes = notes
  .split("\n")
  .map((line) => `  ${line}`)
  .join("\n");
const requiredLocales = ["pt-BR", "en", "de"];
const localizedEntries = requiredLocales.map((locale) => [
  locale,
  String(localizedNotes?.[locale] || "").trim().replace(/\r?\n/g, "\n")
]);
const missingLocales = localizedEntries
  .filter(([, value]) => !value)
  .map(([locale]) => locale);

if (missingLocales.length > 0) {
  throw new Error(`Adicione as notas localizadas antes de gerar a atualizacao: ${missingLocales.join(", ")}.`);
}

const yamlLocalizedNotes = `releaseNotesByLocale:\n${localizedEntries.map(([locale, value]) => [
  `  ${JSON.stringify(locale)}: |-`,
  ...value.split("\n").map((line) => `    ${line}`)
].join("\n")).join("\n")}\n`;

await fs.writeFile(
  manifestPath,
  `${withoutPreviousNotes}\nreleaseNotes: |-\n${yamlNotes}\n${yamlLocalizedNotes}`,
  "utf8"
);
console.log(`Notas adicionadas ao manifesto: ${manifestPath}`);
