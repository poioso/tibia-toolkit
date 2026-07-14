import { bootstrapRendererLocale } from "../../lib/renderer-locale.js";

const params = new URLSearchParams(window.location.search);
const displayX = parseInteger(params.get("displayX"), 0);
const displayY = parseInteger(params.get("displayY"), 0);
const displayWidth = parseInteger(params.get("displayWidth"), window.innerWidth);
const displayHeight = parseInteger(params.get("displayHeight"), window.innerHeight);
const displayId = String(params.get("displayId") || "");
const displayLabel = String(params.get("displayLabel") || "");
const minSelectionSize = 24;
const previewSelectionSize = 6;

const els = {
  interactionLayer: document.querySelector("#interaction-layer"),
  selectionBox: document.querySelector("#selection-box"),
  selectionSize: document.querySelector("#selection-size"),
  selectionConfirm: document.querySelector("#selection-confirm"),
  floatingTooltip: document.querySelector("#floating-tooltip")
};

const state = {
  mode: "idle",
  activePointerId: null,
  trackingIntervalId: 0,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  selection: null,
  activeHandle: ""
};

void initializeRegionSelector();

async function initializeRegionSelector() {
  await bootstrapRendererLocale({ root: document.body });
  bindEvents();
  console.log("selector:init");
}

function bindEvents() {
  els.interactionLayer?.addEventListener("pointerdown", handleDrawStart);
  document.addEventListener("pointermove", handlePointerMove);
  document.addEventListener("pointerup", handlePointerUp);
  document.addEventListener("pointercancel", handlePointerCancel);
  document.addEventListener("keydown", handleKeyDown);
  els.selectionConfirm?.addEventListener("click", handleConfirmSelection);
  els.selectionBox?.addEventListener("pointerdown", handleResizeStart);
  bindDynamicTooltips(document);
}

function handleDrawStart(event) {
  if (event.button !== 0) {
    return;
  }

  if (state.mode === "drawing" || state.mode === "resizing") {
    event.preventDefault();
    return;
  }

  if (
    !(event.target instanceof Element) ||
    event.target.closest("#selection-box") ||
    event.target.closest("#selection-confirm") ||
    event.target.closest(".selector-hud")
  ) {
    return;
  }

  state.mode = "drawing";
  state.activePointerId = event.pointerId;
  state.activeHandle = "";
  state.selection = null;
  state.startX = clamp(event.clientX, 0, displayWidth);
  state.startY = clamp(event.clientY, 0, displayHeight);
  state.currentX = state.startX;
  state.currentY = state.startY;
  els.interactionLayer?.setPointerCapture?.(event.pointerId);
  startCursorTracking();
  console.log(`selector:draw-start x=${state.startX} y=${state.startY}`);
  event.preventDefault();
}

function handleResizeStart(event) {
  if (event.button !== 0 || !state.selection) {
    return;
  }

  const handle = event.target instanceof Element
    ? event.target.closest("[data-handle]")?.getAttribute("data-handle") || ""
    : "";

  if (!handle) {
    return;
  }

  state.mode = "resizing";
  state.activePointerId = event.pointerId;
  state.activeHandle = handle;
  els.selectionBox?.setPointerCapture?.(event.pointerId);
  startCursorTracking();
  console.log(`selector:resize-start handle=${handle}`);
  event.preventDefault();
  event.stopPropagation();
}

function handlePointerMove(event) {
  if (state.activePointerId !== null && event.pointerId !== state.activePointerId) {
    return;
  }

  const pointerX = clamp(event.clientX, 0, displayWidth);
  const pointerY = clamp(event.clientY, 0, displayHeight);

  if (state.mode === "drawing") {
    state.currentX = pointerX;
    state.currentY = pointerY;
    renderSelection(getDraftSelection(), { preview: true });
    return;
  }

  if (state.mode !== "resizing" || !state.selection) {
    return;
  }

  const nextSelection = resizeSelection(state.selection, state.activeHandle, pointerX, pointerY);

  if (!nextSelection) {
    return;
  }

  state.selection = nextSelection;
  renderSelection(state.selection);
}

async function handlePointerUp(event) {
  if (state.activePointerId !== null && event.pointerId !== state.activePointerId) {
    return;
  }

  await syncPointerFromCursor();

  if (state.mode === "drawing") {
    const selection = getDraftSelection();

    if (!selection || selection.width < minSelectionSize || selection.height < minSelectionSize) {
      releasePointerCapture(event.pointerId);
      console.log("selector:draw-cancelled");
      resetSelection();
      return;
    }

    state.selection = selection;
    state.mode = "selected";
    releasePointerCapture(event.pointerId);
    console.log(`selector:selected x=${selection.x} y=${selection.y} w=${selection.width} h=${selection.height}`);
    renderSelection(selection);
    return;
  }

  if (state.mode === "resizing") {
    state.mode = "selected";
    releasePointerCapture(event.pointerId);
    console.log("selector:resize-end");
    state.activeHandle = "";
  }
}

function handlePointerCancel(event) {
  if (state.activePointerId !== null && event.pointerId !== state.activePointerId) {
    return;
  }

  releasePointerCapture(event.pointerId);

  if (state.mode === "drawing") {
    console.log("selector:draw-cancelled");
    resetSelection();
    return;
  }

  if (state.mode === "resizing") {
    state.mode = "selected";
    state.activeHandle = "";
  }
}

function handleKeyDown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    console.log("selector:cancel");
    void window.screenVisionApi.selection.cancel();
  }
}

function handleConfirmSelection() {
  if (!state.selection || state.selection.width < minSelectionSize || state.selection.height < minSelectionSize) {
    return;
  }

  console.log(
    `selector:confirm x=${state.selection.x} y=${state.selection.y} w=${state.selection.width} h=${state.selection.height}`
  );

  void window.screenVisionApi.selection.complete({
    displayId,
    displayLabel,
    displayBounds: {
      x: displayX,
      y: displayY,
      width: displayWidth,
      height: displayHeight
    },
    captureBounds: {
      x: displayX + state.selection.x,
      y: displayY + state.selection.y,
      width: state.selection.width,
      height: state.selection.height
    }
  });
}

function getDraftSelection() {
  const left = Math.min(state.startX, state.currentX);
  const top = Math.min(state.startY, state.currentY);
  const width = Math.abs(state.currentX - state.startX);
  const height = Math.abs(state.currentY - state.startY);

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { x: left, y: top, width, height };
}

function resizeSelection(selection, handle, pointerX, pointerY) {
  const next = { ...selection };
  const right = selection.x + selection.width;
  const bottom = selection.y + selection.height;

  if (handle === "north") {
    const nextTop = Math.min(pointerY, bottom - minSelectionSize);
    next.height = bottom - nextTop;
    next.y = nextTop;
  }

  if (handle === "south") {
    next.height = Math.max(minSelectionSize, pointerY - selection.y);
  }

  if (handle === "east") {
    next.width = Math.max(minSelectionSize, pointerX - selection.x);
  }

  if (handle === "west") {
    const nextLeft = Math.min(pointerX, right - minSelectionSize);
    next.width = right - nextLeft;
    next.x = nextLeft;
  }

  next.x = clamp(next.x, 0, displayWidth - next.width);
  next.y = clamp(next.y, 0, displayHeight - next.height);
  next.width = Math.min(next.width, displayWidth - next.x);
  next.height = Math.min(next.height, displayHeight - next.y);

  return next.width >= minSelectionSize && next.height >= minSelectionSize ? next : null;
}

function renderSelection(selection, options = {}) {
  if (!selection) {
    resetSelection();
    return;
  }

  const preview = options.preview === true;

  if (preview && selection.width < previewSelectionSize && selection.height < previewSelectionSize) {
    els.selectionBox?.classList.add("hidden");
    els.selectionSize?.classList.add("hidden");
    els.selectionConfirm?.classList.add("hidden");
    return;
  }

  els.selectionBox?.classList.remove("hidden");
  els.selectionSize?.classList.remove("hidden");
  const canConfirm = state.mode !== "drawing"
    && selection.width >= minSelectionSize
    && selection.height >= minSelectionSize;

  els.selectionConfirm?.classList.toggle("hidden", !canConfirm);

  if (els.selectionBox) {
    els.selectionBox.style.left = `${selection.x}px`;
    els.selectionBox.style.top = `${selection.y}px`;
    els.selectionBox.style.width = `${selection.width}px`;
    els.selectionBox.style.height = `${selection.height}px`;
  }

  if (els.selectionSize) {
    els.selectionSize.textContent = `${selection.width} x ${selection.height}`;
    els.selectionSize.style.left = `${selection.x + 8}px`;
    els.selectionSize.style.top = `${Math.max(selection.y - 34, 8)}px`;
  }

  if (els.selectionConfirm) {
    const confirmLeft = selection.x + (selection.width / 2) - 15;
    const aboveTop = selection.y - 44;
    const fallbackTop = selection.y + selection.height + 14;
    els.selectionConfirm.style.left = `${Math.round(confirmLeft)}px`;
    els.selectionConfirm.style.top = `${Math.round(aboveTop >= 8 ? aboveTop : fallbackTop)}px`;
  }
}

function resetSelection() {
  state.mode = "idle";
  state.activePointerId = null;
  stopCursorTracking();
  state.selection = null;
  state.activeHandle = "";
  els.selectionBox?.classList.add("hidden");
  els.selectionSize?.classList.add("hidden");
  els.selectionConfirm?.classList.add("hidden");
}

function releasePointerCapture(pointerId) {
  if (pointerId !== null && pointerId !== undefined) {
    els.interactionLayer?.releasePointerCapture?.(pointerId);
    els.selectionBox?.releasePointerCapture?.(pointerId);
  }

  stopCursorTracking();
  state.activePointerId = null;
}

function startCursorTracking() {
  stopCursorTracking();

  state.trackingIntervalId = window.setInterval(() => {
    void syncPointerFromCursor();
  }, 8);
}

function stopCursorTracking() {
  if (state.trackingIntervalId) {
    window.clearInterval(state.trackingIntervalId);
    state.trackingIntervalId = 0;
  }
}

async function syncPointerFromCursor() {
  if (state.mode !== "drawing" && state.mode !== "resizing") {
    return;
  }

  const cursorPoint = await window.screenVisionApi.selection.getCursorPoint().catch(() => null);

  if (!cursorPoint) {
    return;
  }

  const pointerX = clamp(Number(cursorPoint.x) - displayX, 0, displayWidth);
  const pointerY = clamp(Number(cursorPoint.y) - displayY, 0, displayHeight);

  if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
    return;
  }

  if (state.mode === "drawing") {
    if (pointerX === state.currentX && pointerY === state.currentY) {
      return;
    }

    state.currentX = pointerX;
    state.currentY = pointerY;
    renderSelection(getDraftSelection());
    return;
  }

  if (state.mode === "resizing" && state.selection) {
    const nextSelection = resizeSelection(state.selection, state.activeHandle, pointerX, pointerY);

    if (!nextSelection) {
      return;
    }

    state.selection = nextSelection;
    renderSelection(state.selection);
  }
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function bindDynamicTooltips(root = document) {
  root.querySelectorAll("[data-tooltip], [title], [aria-label]").forEach((trigger) => {
    if (trigger.dataset.tooltipBound === "true") {
      return;
    }

    if (!trigger.dataset.tooltip) {
      const fallbackText = trigger.getAttribute("title") || trigger.getAttribute("aria-label") || "";

      if (fallbackText) {
        trigger.dataset.tooltip = fallbackText;
      }
    }

    if (!trigger.dataset.tooltip) {
      return;
    }

    trigger.dataset.tooltipBound = "true";
    trigger.addEventListener("mouseenter", () => showFloatingTooltip(trigger));
    trigger.addEventListener("focus", () => showFloatingTooltip(trigger));
    trigger.addEventListener("mouseleave", hideFloatingTooltip);
    trigger.addEventListener("blur", hideFloatingTooltip);
  });
}

function showFloatingTooltip(trigger) {
  const tooltip = els.floatingTooltip;
  const text = trigger?.dataset?.tooltip || "";

  if (!tooltip || !text) {
    return;
  }

  tooltip.textContent = text;
  tooltip.classList.add("visible");
  tooltip.setAttribute("aria-hidden", "false");
  positionFloatingTooltip(trigger);
}

function hideFloatingTooltip() {
  const tooltip = els.floatingTooltip;

  if (!tooltip) {
    return;
  }

  tooltip.classList.remove("visible");
  tooltip.setAttribute("aria-hidden", "true");
}

function positionFloatingTooltip(trigger) {
  const tooltip = els.floatingTooltip;

  if (!tooltip || !trigger) {
    return;
  }

  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const top = Math.max(8, triggerRect.top - tooltipRect.height - 8);
  const centeredLeft = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
  const left = clamp(centeredLeft, 8, window.innerWidth - tooltipRect.width - 8);

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}
