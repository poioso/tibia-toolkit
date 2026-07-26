import path from "node:path";
import { access } from "node:fs/promises";
import { rcedit } from "rcedit";

export default async function patchWindowsExecutableIcon(context) {
  if (context.electronPlatformName !== "win32") return;

  // Keep the public Hub runtime imports inside every desktop package. The
  // private mini world changes collector intentionally stays on the VPS.
  for (const relativeModulePath of [
    "services/game-data-hub/api-security.mjs"
  ]) {
    try {
      await access(path.join(context.appOutDir, "resources", "app", relativeModulePath));
    } catch {
      throw new Error(`Required runtime module is missing from the packaged app: ${relativeModulePath}`);
    }
  }

  const executableName = `${context.packager.appInfo.productFilename}.exe`;
  const executablePath = path.join(context.appOutDir, executableName);
  const iconPath = path.join(context.packager.projectDir, "desktop", "build", "icon.ico");
  const version = String(context.packager.appInfo.version || "0.0.0");
  const windowsVersion = /^\d+\.\d+\.\d+$/.test(version) ? `${version}.0` : "0.0.0.0";

  await rcedit(executablePath, {
    icon: iconPath,
    "file-version": windowsVersion,
    "product-version": windowsVersion,
    "version-string": {
      CompanyName: "Tibia Toolkit Project",
      FileDescription: "Tibia Toolkit",
      FileVersion: version,
      InternalName: "Tibia Toolkit",
      OriginalFilename: executableName,
      ProductName: "Tibia Toolkit",
      ProductVersion: version,
      LegalCopyright: "Copyright (C) Tibia Toolkit Project",
      Comments: "Unofficial community project. Not affiliated with or endorsed by CipSoft GmbH."
    }
  });
}
