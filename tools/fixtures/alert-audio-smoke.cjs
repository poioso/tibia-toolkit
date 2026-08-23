const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

app.whenReady().then(async () => {
  const audioPath = path.resolve(__dirname, "..", "..", "assets", "screen-vision", "reference", "sounds", "spells", "utura gran.ogg");
  const window = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  await window.loadFile(path.resolve(__dirname, "..", "..", "desktop", "alert-audio-runtime.html"));
  const result = await window.webContents.executeJavaScript(
    `window.__alertAudioRuntime.enqueue(${JSON.stringify({
      file: pathToFileURL(audioPath).href,
      volume: 0.08,
      maxDurationMs: 4000
    })})`,
    true
  );
  process.stdout.write(`${JSON.stringify({ ...result, audioPath })}\n`);
  const holdArgument = process.argv.find((value) => String(value).startsWith("--hold-ms="));
  const holdMs = Math.max(0, Math.min(15000, Number(String(holdArgument || "").split("=")[1]) || Number(process.env.TIBIA_TOOLKIT_AUDIO_SMOKE_HOLD_MS) || 0));
  if (holdMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, holdMs));
  }
  app.exit(result?.ok ? 0 : 1);
}).catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  app.exit(1);
});
