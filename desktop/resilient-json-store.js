import fs from "node:fs/promises";
import path from "node:path";

const TRANSIENT_REPLACE_ERROR_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);
let temporaryFileSequence = 0;

function getErrorCode(error) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code || "")
    : "";
}

function waitFor(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function writeJsonFileResilient(filePath, value, options = {}) {
  const fileSystem = options.fileSystem || fs;
  const retryDelays = Array.isArray(options.retryDelays) ? options.retryDelays : [20, 80, 200];
  const wait = typeof options.wait === "function" ? options.wait : waitFor;
  const onDirectWriteFallback = typeof options.onDirectWriteFallback === "function"
    ? options.onDirectWriteFallback
    : null;
  const serialized = JSON.stringify(value, null, 2);
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.${temporaryFileSequence += 1}.tmp`;

  await fileSystem.mkdir(path.dirname(filePath), { recursive: true });
  await fileSystem.writeFile(temporaryPath, serialized, "utf8");

  try {
    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      try {
        await fileSystem.rm(filePath, { force: true });
        await fileSystem.rename(temporaryPath, filePath);
        return { mode: "rename", attempts: attempt + 1 };
      } catch (error) {
        const code = getErrorCode(error);
        const isTransient = TRANSIENT_REPLACE_ERROR_CODES.has(code);
        if (!isTransient) throw error;

        if (attempt < retryDelays.length) {
          await wait(retryDelays[attempt]);
          continue;
        }

        // Antivirus/indexer locks can outlive the short retry window on Windows.
        // A complete direct write is safer than rejecting the user's setting.
        await fileSystem.writeFile(filePath, serialized, "utf8");
        await onDirectWriteFallback?.(error);
        return { mode: "direct-write", attempts: attempt + 1 };
      }
    }
  } finally {
    await fileSystem.rm(temporaryPath, { force: true }).catch(() => {});
  }

  throw new Error("Nao foi possivel persistir o arquivo JSON.");
}
