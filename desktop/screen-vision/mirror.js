import { t } from "../../lib/app-i18n.js";
import { bootstrapRendererLocale } from "../../lib/renderer-locale.js";

const regionId = new URLSearchParams(window.location.search).get("regionId") || "";

const els = {
  video: document.querySelector("#capture-video"),
  canvas: document.querySelector("#mirror-canvas"),
  status: document.querySelector("#mirror-status")
};

const state = {
  region: null,
  stream: null,
  animationFrame: 0,
  retryTimer: 0,
  windowSourceId: "",
  windowSourceTitle: ""
};

void boot();

async function boot() {
  await bootstrapRendererLocale({ root: document.body });
  state.region = await window.screenVisionApi.regions.get(regionId).catch(() => null);

  if (!state.region) {
    setStatus(t("screenVision.region.notFound"));
    return;
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("focus", () => {
    void ensureCapture();
  });
  renderLoop();
  await ensureCapture();
}

async function ensureCapture() {
  if (state.stream) {
    return;
  }

  try {
    await startCapture();
    clearRetry();
  } catch (error) {
    console.error(error);
    setStatus(getErrorMessage(error));
    scheduleRetry();
  }
}

async function startCapture() {
  const tibiaState = await window.screenVisionApi.tibia.getState();

  if (!tibiaState?.title) {
    throw new Error(t("screenVision.mirror.openTibiaToStart"));
  }

  // A focused Tibia window can be intentionally positioned or resized. It is
  // still a valid capture source as long as Windows reports it visible.
  if (!tibiaState.isVisible || tibiaState.isMinimized) {
    throw new Error(t("screenVision.mirror.maximizeTibia"));
  }

  const sources = await window.screenVisionApi.capture.getWindowSources();
  const source = sources.find((entry) => entry.name === tibiaState.title)
    || sources.find((entry) => entry.name === state.region.sourceWindowTitle)
    || sources.find((entry) => typeof entry.name === "string" && entry.name.startsWith("Tibia"))
    || sources[0];

  if (!source) {
    throw new Error(t("screenVision.mirror.captureWindowMissing"));
  }

  state.windowSourceId = source.id;
  state.windowSourceTitle = source.name || "";

  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: source.id,
        minWidth: Number(tibiaState.bounds?.width) || 1,
        minHeight: Number(tibiaState.bounds?.height) || 1,
        maxFrameRate: 30
      }
    }
  });

  state.stream.getVideoTracks().forEach((track) => {
    track.addEventListener("ended", () => {
      cleanupStream();
      scheduleRetry();
    }, { once: true });
  });

  els.video.srcObject = state.stream;
  await els.video.play();
  console.info(`mirror-capture-ok source=${state.windowSourceTitle || state.windowSourceId}`);
  setStatus(state.region.name || t("screenVision.mirror.active"));
}

function renderLoop() {
  const context = els.canvas.getContext("2d");

  if (!context || !state.region) {
    return;
  }

  const draw = () => {
    if (els.video.readyState >= 2 && state.region) {
      const sourceBounds = state.region.sourceBounds || state.region.displayBounds || {};
      const relativeBounds = state.region.relativeBounds || state.region.captureBounds || {};
      const sourceWidth = els.video.videoWidth || sourceBounds.width || 1;
      const sourceHeight = els.video.videoHeight || sourceBounds.height || 1;
      const scaleX = sourceWidth / Math.max(sourceBounds.width || sourceWidth || 1, 1);
      const scaleY = sourceHeight / Math.max(sourceBounds.height || sourceHeight || 1, 1);
      const sx = Math.max(0, relativeBounds.x * scaleX);
      const sy = Math.max(0, relativeBounds.y * scaleY);
      const sw = Math.max(1, relativeBounds.width * scaleX);
      const sh = Math.max(1, relativeBounds.height * scaleY);

      context.clearRect(0, 0, els.canvas.width, els.canvas.height);
      context.drawImage(
        els.video,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        els.canvas.width,
        els.canvas.height
      );
    }

    state.animationFrame = window.requestAnimationFrame(draw);
  };

  draw();
}

function resizeCanvas() {
  els.canvas.width = window.innerWidth;
  els.canvas.height = window.innerHeight;
}

function setStatus(text) {
  if (els.status) {
    els.status.textContent = text;
  }
}

function getErrorMessage(error) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  return message || t("screenVision.mirror.startFailed");
}

function scheduleRetry() {
  if (state.retryTimer) {
    return;
  }

  state.retryTimer = window.setTimeout(() => {
    state.retryTimer = 0;
    void ensureCapture();
  }, 1000);
}

function clearRetry() {
  if (state.retryTimer) {
    window.clearTimeout(state.retryTimer);
    state.retryTimer = 0;
  }
}

function cleanupStream() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }

  state.stream = null;
  if (els.video) {
    els.video.srcObject = null;
  }
}

window.addEventListener("beforeunload", () => {
  if (state.animationFrame) {
    window.cancelAnimationFrame(state.animationFrame);
  }

  clearRetry();
  cleanupStream();
});
