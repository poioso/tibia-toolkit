import fs from "node:fs";
import path from "node:path";

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function exists(filePath) {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function filesAreEqual(leftPath, rightPath) {
  try {
    const left = fs.readFileSync(leftPath);
    const right = fs.readFileSync(rightPath);
    return left.equals(right);
  } catch {
    return false;
  }
}

function moveEntry(sourcePath, targetPath) {
  try {
    fs.renameSync(sourcePath, targetPath);
    return;
  } catch (error) {
    if (error?.code !== "EXDEV") throw error;
  }

  if (isDirectory(sourcePath)) {
    fs.cpSync(sourcePath, targetPath, {
      recursive: true,
      force: false,
      errorOnExist: false
    });
  } else {
    fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
  }
  fs.rmSync(sourcePath, { recursive: true, force: true });
}

function moveConflictToBackup(sourcePath, sourceRoot, conflictBackupRoot, conflicts) {
  const relativePath = path.relative(sourceRoot, sourcePath);
  const backupPath = path.join(conflictBackupRoot, relativePath);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  moveEntry(sourcePath, backupPath);
  conflicts.push(relativePath);
}

function mergeDirectory(sourceDirectory, targetDirectory, sourceRoot, conflictBackupRoot, conflicts) {
  fs.mkdirSync(targetDirectory, { recursive: true });

  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    if (entry.isDirectory()) {
      if (!exists(targetPath)) {
        moveEntry(sourcePath, targetPath);
      } else if (isDirectory(targetPath)) {
        mergeDirectory(sourcePath, targetPath, sourceRoot, conflictBackupRoot, conflicts);
      } else {
        moveConflictToBackup(sourcePath, sourceRoot, conflictBackupRoot, conflicts);
      }
      continue;
    }

    if (!exists(targetPath)) {
      moveEntry(sourcePath, targetPath);
    } else if (filesAreEqual(sourcePath, targetPath)) {
      // The target already contains the same data; remove only this duplicate.
      fs.rmSync(sourcePath, { force: true });
    } else {
      // Never overwrite a file that may have been created by the new runtime.
      // Keep the legacy value in the target as a migration backup, then remove
      // the old root so the app never continues using it.
      moveConflictToBackup(sourcePath, sourceRoot, conflictBackupRoot, conflicts);
    }
  }

  if (fs.readdirSync(sourceDirectory).length === 0) {
    fs.rmSync(sourceDirectory, { recursive: true, force: true });
  }
}

/**
 * Moves the old Electron user-data root into the canonical product root.
 *
 * This intentionally handles only the root directory name. Feature folders
 * such as <userData>/ScreenVision are part of the current data format and
 * must remain unchanged.
 */
export function migrateLegacyUserDataDirectory({
  appDataRoot,
  targetDirectoryName,
  legacyDirectoryNames = ["ScreenVision"]
}) {
  const targetPath = path.join(appDataRoot, targetDirectoryName);

  for (const legacyDirectoryName of legacyDirectoryNames) {
    const legacyPath = path.join(appDataRoot, legacyDirectoryName);
    if (!exists(legacyPath) || path.resolve(legacyPath) === path.resolve(targetPath)) continue;

    try {
      if (!exists(targetPath)) {
        moveEntry(legacyPath, targetPath);
        return {
          status: "migrated",
          legacyPath,
          targetPath,
          conflicts: []
        };
      }

      const conflicts = [];
      mergeDirectory(
        legacyPath,
        targetPath,
        legacyPath,
        path.join(targetPath, ".legacy-user-data-conflicts"),
        conflicts
      );
      return {
        status: conflicts.length ? "migrated-with-conflicts" : "migrated",
        legacyPath,
        targetPath,
        conflicts
      };
    } catch (error) {
      return {
        status: "error",
        legacyPath,
        targetPath,
        conflicts: [],
        errorCode: error?.code || "unknown"
      };
    }
  }

  return {
    status: "not-needed",
    legacyPath: "",
    targetPath,
    conflicts: []
  };
}
