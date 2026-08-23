import path from "node:path";
import { rcedit } from "rcedit";

export default async function patchWindowsExecutableIcon(context) {
  if (context.electronPlatformName !== "win32") return;

  const executableName = `${context.packager.appInfo.productFilename}.exe`;
  const executablePath = path.join(context.appOutDir, executableName);
  const iconPath = path.join(context.packager.projectDir, "desktop", "build", "icon.ico");

  await rcedit(executablePath, {
    icon: iconPath,
    "version-string": {
      CompanyName: "Tibia Toolkit",
      FileDescription: "Tibia Toolkit",
      ProductName: "Tibia Toolkit"
    }
  });
}
