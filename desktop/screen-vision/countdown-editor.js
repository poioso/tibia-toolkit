import { t } from "../../lib/app-i18n.js";
import { bootstrapRendererLocale } from "../../lib/renderer-locale.js";

const COUNTDOWN_COLOR_OPTIONS = [
  { value: "gradient", label: "Gradiente", swatch: "linear-gradient(90deg, #4ade80 0%, #ffd84d 48%, #ff5353 100%)" },
  { value: "#ff7f00", label: "Laranja", swatch: "#ff7f00" },
  { value: "#ff4444", label: "Vermelho", swatch: "#ff4444" },
  { value: "#ffd700", label: "Amarelo", swatch: "#ffd700" },
  { value: "#4ade80", label: "Verde", swatch: "#4ade80" },
  { value: "#0088ff", label: "Azul", swatch: "#0088ff" },
  { value: "#8800ff", label: "Roxo", swatch: "#8800ff" },
  { value: "#ffffff", label: "Branco", swatch: "#ffffff" }
];

const COUNTDOWN_BORDER_COLOR_OPTIONS = [
  { value: "#ffffff", label: "Branco", swatch: "#ffffff" },
  { value: "#ff7f00", label: "Laranja", swatch: "#ff7f00" },
  { value: "#ff4444", label: "Vermelho", swatch: "#ff4444" },
  { value: "#ffd700", label: "Amarelo", swatch: "#ffd700" },
  { value: "#4ade80", label: "Verde", swatch: "#4ade80" },
  { value: "#0088ff", label: "Azul", swatch: "#0088ff" },
  { value: "#8800ff", label: "Roxo", swatch: "#8800ff" }
];

const params = new URLSearchParams(window.location.search);

const els = {
  card: document.querySelector("#editor-card"),
  subtitle: document.querySelector("#editor-subtitle"),
  closeButton: document.querySelector("#editor-close-button"),
  content: document.querySelector("#editor-content"),
  floatingTooltip: document.querySelector("#floating-tooltip")
};

const state = {
  regionId: String(params.get("regionId") || "").trim(),
  region: null,
  pendingPatch: {},
  patchTimer: 0,
  activeTooltipTrigger: null,
  resizeFrame: 0,
  overlayRefreshTimer: 0,
  unsubscribeOverlay: null
};

if (typeof window !== "undefined" && !window.screenVisionApi && window.desktopApi?.screenVisionApi) {
  window.screenVisionApi = window.desktopApi.screenVisionApi;
}

if (window.screenVisionApi && state.regionId) {
  boot();
}

async function boot() {
  await bootstrapRendererLocale({ root: document.body });
  bindEvents();
  bindExternalEvents();
  await refreshRegion({ forceRender: true });
}

function bindEvents() {
  els.closeButton?.addEventListener("click", () => {
    void window.screenVisionApi.window.close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void window.screenVisionApi.window.close();
      return;
    }

    const hotkeyInput = event.target.closest("[data-countdown-hotkey]");

    if (!hotkeyInput) {
      return;
    }

    if (event.key === "Tab") {
      return;
    }

    event.preventDefault();
    const binding = toHotkeyBinding(event);

    if (!binding) {
      return;
    }

    hotkeyInput.value = binding.label;
    applyLocalCountdownPatch({
      hotkey: binding.label,
      hotkeyKeyCode: binding.keyCode,
      hotkeyModifiers: binding.modifiers
    });
    scheduleCountdownPatch({
      hotkey: binding.label,
      hotkeyKeyCode: binding.keyCode,
      hotkeyModifiers: binding.modifiers
    }, { immediate: true });
  });

  els.content?.addEventListener("click", (event) => {
    const colorButton = event.target.closest("[data-countdown-color]");

    if (colorButton) {
      const field = colorButton.dataset.countdownColorField || "color";
      const value = colorButton.dataset.countdownColor || "gradient";
      applyLocalCountdownPatch({ [field]: value });
      scheduleCountdownPatch({ [field]: value }, { immediate: true });
      render();
      return;
    }

    const actionButton = event.target.closest("[data-action]");

    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.action || "";

    if (action === "toggle-countdown-run") {
      if (state.region?.countdownIsRunning) {
        void stopCountdown();
      } else {
        void startCountdown();
      }
      return;
    }

    if (action === "close-editor") {
      void window.screenVisionApi.window.close();
    }
  });

  const handleFieldMutation = (event, immediate = false) => {
    const input = event.target.closest("[data-countdown-field]");

    if (!input || !state.region) {
      return;
    }

    const field = input.dataset.countdownField || "";

    if (!field || field === "hotkey") {
      return;
    }

    const value = readCountdownFieldValue(input, field);
    applyLocalCountdownPatch({ [field]: value });
    updateCountdownInlineUi(field, value);

    if (field === "side" || field === "direction" || field === "enabled" || field === "flashEnabled" || field === "retriggerEnabled") {
      render();
    }

    scheduleCountdownPatch({ [field]: value }, { immediate });
  };

  els.content?.addEventListener("input", (event) => {
    handleFieldMutation(event, false);
  });

  els.content?.addEventListener("change", (event) => {
    handleFieldMutation(event, true);
  });
}

function bindExternalEvents() {
  state.unsubscribeOverlay = window.screenVisionApi.events.onOverlayStateChanged(() => {
    if (state.overlayRefreshTimer) {
      window.clearTimeout(state.overlayRefreshTimer);
    }

    state.overlayRefreshTimer = window.setTimeout(() => {
      state.overlayRefreshTimer = 0;
      void refreshRegion({ forceRender: !shouldPreserveInteractiveSurface() });
    }, 80);
  });

  window.addEventListener("beforeunload", () => {
    if (state.patchTimer) {
      window.clearTimeout(state.patchTimer);
      state.patchTimer = 0;
    }

    if (state.overlayRefreshTimer) {
      window.clearTimeout(state.overlayRefreshTimer);
      state.overlayRefreshTimer = 0;
    }

    hideFloatingTooltip();

    if (typeof state.unsubscribeOverlay === "function") {
      state.unsubscribeOverlay();
      state.unsubscribeOverlay = null;
    }
  });
}

async function refreshRegion({ forceRender = false } = {}) {
  const region = await window.screenVisionApi.regions.get(state.regionId).catch(() => null);
  state.region = region;

  if (forceRender || !shouldPreserveInteractiveSurface()) {
    render();
  } else {
    updateChrome();
  }
}

async function startCountdown() {
  const result = await window.screenVisionApi.regions.startCountdown(state.regionId).catch(() => null);
  applyRegionResponse(result);
}

async function stopCountdown() {
  const result = await window.screenVisionApi.regions.stopCountdown(state.regionId).catch(() => null);
  applyRegionResponse(result);
}

function applyRegionResponse(result) {
  if (Array.isArray(result?.items)) {
    const nextRegion = result.items.find((entry) => entry?.id === state.regionId) || null;
    state.region = nextRegion;
    render();
    return;
  }

  void refreshRegion({ forceRender: true });
}

function scheduleCountdownPatch(patch, options = {}) {
  state.pendingPatch = {
    ...state.pendingPatch,
    ...patch
  };

  if (options.immediate) {
    void flushCountdownPatch();
    return;
  }

  if (state.patchTimer) {
    return;
  }

  state.patchTimer = window.setTimeout(() => {
    state.patchTimer = 0;
    void flushCountdownPatch();
  }, 90);
}

async function flushCountdownPatch() {
  if (state.patchTimer) {
    window.clearTimeout(state.patchTimer);
    state.patchTimer = 0;
  }

  const patch = state.pendingPatch;
  state.pendingPatch = {};

  if (!patch || !Object.keys(patch).length) {
    return;
  }

  const result = await window.screenVisionApi.regions.update(state.regionId, { countdown: patch }).catch(() => null);
  applyRegionResponse(result);
}

function applyLocalCountdownPatch(patch) {
  if (!state.region) {
    return;
  }

  state.region.countdown = {
    ...(state.region.countdown || {}),
    ...patch
  };
}

function render() {
  const region = state.region;

  updateChrome();

  if (!region) {
    els.content.innerHTML = `
      <section class="countdown-editor-empty">
        <strong>${escapeHtml(t("screenVision.countdown.regionUnavailable"))}</strong>
        <p>${escapeHtml(t("screenVision.countdown.regionMissing"))}</p>
        <div class="countdown-editor-actions">
          <button type="button" class="countdown-editor-button" data-action="close-editor">${escapeHtml(t("common.close"))}</button>
        </div>
      </section>
    `;
    bindDynamicTooltips(els.content);
    scheduleResizeToContent();
    return;
  }

  const countdown = normalizeCountdown(region.countdown);
  const countdownButtonLabel = region.countdownIsRunning ? t("common.cancel") : t("screenVision.countdown.test");
  const countdownButtonTooltip = region.countdownIsRunning
    ? t("screenVision.countdown.cancelRun")
    : t("screenVision.countdown.testNow");

  els.content.innerHTML = `
    ${renderCountdownPanel(region, countdown, countdownButtonLabel)}
    <div class="countdown-editor-actions">
      <button type="button" class="countdown-editor-button" data-action="close-editor" data-tooltip="${escapeHtml(t("screenVision.modal.closeWindow"))}">${escapeHtml(t("common.close"))}</button>
      <button
        type="button"
        class="countdown-editor-button primary"
        data-action="toggle-countdown-run"
        data-tooltip="${escapeHtml(countdownButtonTooltip)}"
      >${countdownButtonLabel}</button>
    </div>
  `;

  bindDynamicTooltips(els.content);
  scheduleResizeToContent();
}

function updateChrome() {
  const regionName = state.region?.name || t("screenVision.region.defaultName");
  els.subtitle.textContent = state.region
    ? t("screenVision.countdown.configureForMirror", { name: regionName })
    : t("screenVision.countdown.windowFollowsRegion");
}

function renderCountdownPanel(region, countdown, countdownButtonLabel) {
  const locked = Boolean(region?.isLocked);
  const sideValue = String(countdown.side || "Above");
  const directionValue = String(countdown.direction || "LeftToRight");

  return `
    <section class="countdown-panel countdown-panel-modal">
      <div class="countdown-header">
        <label class="countdown-enable" data-tooltip="${escapeHtml(t("screenVision.countdown.toggleForRegion"))}">
          <input
            type="checkbox"
            data-countdown-field="enabled"
            ${countdown.enabled ? "checked" : ""}
            ${locked ? "" : "disabled"}
          >
          ${escapeHtml(t("screenVision.countdown.enableBarLabel"))}
        </label>
        <div class="countdown-warning">
          <span class="warning-icon" data-tooltip="${escapeHtml(t("screenVision.countdown.lockMirrorHint"))}">!</span>
        </div>
      </div>

      <div class="countdown-body${locked ? "" : " disabled"}">
        ${locked ? "" : `<div class="countdown-warning">${escapeHtml(t("screenVision.countdown.lockMirrorWarning"))}</div>`}
        <div class="countdown-field-grid">
          <div class="countdown-row countdown-row-two">
            <div class="countdown-field">
              <label>${escapeHtml(t("screenVision.countdown.durationSecondsLabel"))}</label>
              <div class="countdown-slider-stack">
                <input type="range" min="1" max="600" step="1" value="${escapeHtml(String(countdown.durationSeconds))}" data-countdown-field="durationSeconds" data-tooltip="${escapeHtml(t("screenVision.countdown.durationTooltip"))}">
                <input type="number" min="1" max="43200" step="1" value="${escapeHtml(String(countdown.durationSeconds))}" data-countdown-field="durationSeconds" data-tooltip="${escapeHtml(t("screenVision.countdown.durationTooltip"))}">
              </div>
            </div>

            <div class="countdown-field">
              <label>${escapeHtml(t("screenVision.countdown.hotkeyLabel"))}</label>
              <input class="countdown-hotkey-input" type="text" value="${escapeHtml(countdown.hotkey || "")}" placeholder="${escapeHtml(t("screenVision.countdown.hotkeyPlaceholder"))}" data-countdown-field="hotkey" data-countdown-hotkey="true" data-tooltip="${escapeHtml(t("screenVision.countdown.hotkeySet"))}">
            </div>
          </div>

          <div class="countdown-field">
            <label>${escapeHtml(t("screenVision.countdown.positionLabel"))}</label>
            <div class="countdown-side-grid">
              ${renderCountdownSideRadio("Above", t("screenVision.countdown.sideAbove"), sideValue)}
              ${renderCountdownSideRadio("Below", t("screenVision.countdown.sideBelow"), sideValue)}
              ${renderCountdownSideRadio("Left", t("screenVision.countdown.sideLeft"), sideValue)}
              ${renderCountdownSideRadio("Right", t("screenVision.countdown.sideRight"), sideValue)}
            </div>
          </div>

          <div class="countdown-field">
            <label>${escapeHtml(t("screenVision.countdown.directionLabel"))}</label>
            <div class="countdown-side-grid">
              ${renderCountdownDirectionRadio("TopToBottom", t("screenVision.countdown.flowTopToBottom"), directionValue)}
              ${renderCountdownDirectionRadio("BottomToTop", t("screenVision.countdown.flowBottomToTop"), directionValue)}
              ${renderCountdownDirectionRadio("LeftToRight", t("screenVision.countdown.flowLeftToRight"), directionValue)}
              ${renderCountdownDirectionRadio("RightToLeft", t("screenVision.countdown.flowRightToLeft"), directionValue)}
            </div>
          </div>

          <div class="countdown-row countdown-row-two">
            <div class="countdown-field">
              <label>${escapeHtml(t("screenVision.countdown.barSizeTitle"))}</label>
              <div class="countdown-field-pair">
                <div class="countdown-number-stack">
                  <span>W</span>
                  <input type="range" min="1" max="240" step="1" value="${escapeHtml(String(countdown.barThickness))}" data-countdown-field="barThickness" data-tooltip="${escapeHtml(t("screenVision.countdown.heightTooltip"))}">
                  <input type="number" min="1" max="2000" step="1" value="${escapeHtml(String(countdown.barThickness))}" data-countdown-field="barThickness" data-tooltip="${escapeHtml(t("screenVision.countdown.heightTooltip"))}">
                </div>
              </div>
            </div>

            <div class="countdown-field">
              <label>&nbsp;</label>
              <div class="countdown-number-stack">
                <span>L</span>
                <input type="range" min="1" max="600" step="1" value="${escapeHtml(String(countdown.barLength))}" data-countdown-field="barLength" data-tooltip="${escapeHtml(t("screenVision.countdown.widthTooltip"))}">
                <input type="number" min="1" max="4000" step="1" value="${escapeHtml(String(countdown.barLength))}" data-countdown-field="barLength" data-tooltip="${escapeHtml(t("screenVision.countdown.widthTooltip"))}">
              </div>
            </div>
          </div>

          <div class="countdown-field">
            <label class="countdown-color-label">${escapeHtml(t("screenVision.countdown.barColorLabel"))}</label>
            ${renderCountdownColorPalette("color", countdown.color, COUNTDOWN_COLOR_OPTIONS)}
          </div>

          <div class="countdown-row countdown-row-two">
            <div class="countdown-field">
              <label>${escapeHtml(t("screenVision.countdown.borderWidthLabel"))}</label>
              <div class="countdown-slider-stack">
                <input type="range" min="0" max="24" step="1" value="${escapeHtml(String(countdown.borderWidth))}" data-countdown-field="borderWidth" data-tooltip="${escapeHtml(t("screenVision.countdown.borderWidthTooltip"))}">
                <input type="number" min="0" max="64" step="1" value="${escapeHtml(String(countdown.borderWidth))}" data-countdown-field="borderWidth" data-tooltip="${escapeHtml(t("screenVision.countdown.borderWidthTooltip"))}">
              </div>
            </div>

            <div class="countdown-field">
              <label>${escapeHtml(t("screenVision.countdown.roundingLabel"))}</label>
              <div class="countdown-slider-stack">
                <input type="range" min="0" max="60" step="1" value="${escapeHtml(String(countdown.borderRadius))}" data-countdown-field="borderRadius" data-tooltip="${escapeHtml(t("screenVision.countdown.roundingTooltip"))}">
                <input type="number" min="0" max="200" step="1" value="${escapeHtml(String(countdown.borderRadius))}" data-countdown-field="borderRadius" data-tooltip="${escapeHtml(t("screenVision.countdown.roundingTooltip"))}">
              </div>
            </div>
          </div>

          <div class="countdown-field">
            <label class="countdown-color-label">${escapeHtml(t("screenVision.countdown.borderColorLabel"))}</label>
            ${renderCountdownColorPalette("borderColor", countdown.borderColor, COUNTDOWN_BORDER_COLOR_OPTIONS)}
          </div>

          <div class="countdown-check-row">
            <label data-tooltip="${escapeHtml(t("screenVision.countdown.flashTooltip"))}">
              <input type="checkbox" data-countdown-field="flashEnabled" ${countdown.flashEnabled ? "checked" : ""}>
              ${escapeHtml(t("screenVision.countdown.flashAria"))}
            </label>
            <label data-tooltip="${escapeHtml(t("screenVision.countdown.blockRestart"))}">
              <input type="checkbox" data-countdown-field="retriggerEnabled" ${countdown.retriggerEnabled ? "checked" : ""}>
              ${escapeHtml(t("screenVision.countdown.restartLockAria"))}
            </label>
            <button type="button" class="countdown-test-button" data-action="toggle-countdown-run" data-tooltip="${escapeHtml(region.countdownIsRunning ? t("screenVision.countdown.cancelRun") : t("screenVision.countdown.testNow"))}">${escapeHtml(countdownButtonLabel)}</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderCountdownSideRadio(value, label, selectedValue) {
  const tooltip = {
    Above: t("screenVision.countdown.positionAbove"),
    Below: t("screenVision.countdown.positionBelow"),
    Left: t("screenVision.countdown.positionLeft"),
    Right: t("screenVision.countdown.positionRight")
  }[value] || t("screenVision.countdown.choosePosition");

  return `
    <label data-tooltip="${escapeHtml(tooltip)}">
      <input
        type="radio"
        name="countdown-side"
        value="${escapeHtml(value)}"
        data-countdown-field="side"
        ${value === selectedValue ? "checked" : ""}
      >
      ${escapeHtml(label)}
    </label>
  `;
}

function renderCountdownDirectionRadio(value, label, selectedValue) {
  const tooltip = {
    TopToBottom: t("screenVision.countdown.directionTopToBottom"),
    BottomToTop: t("screenVision.countdown.directionBottomToTop"),
    LeftToRight: t("screenVision.countdown.directionLeftToRight"),
    RightToLeft: t("screenVision.countdown.directionRightToLeft")
  }[value] || t("screenVision.countdown.chooseDirection");

  return `
    <label data-tooltip="${escapeHtml(tooltip)}">
      <input
        type="radio"
        name="countdown-direction"
        value="${escapeHtml(value)}"
        data-countdown-field="direction"
        ${value === selectedValue ? "checked" : ""}
      >
      ${escapeHtml(label)}
    </label>
  `;
}

function renderCountdownColorPalette(field, selectedValue, options) {
  return `
    <div class="countdown-colors">
      ${options.map((option) => `
        <button
          type="button"
          class="countdown-color-chip${option.value === selectedValue ? " selected" : ""}"
          style="background: ${option.swatch};"
          data-countdown-color-field="${escapeHtml(field)}"
          data-countdown-color="${escapeHtml(option.value)}"
          data-tooltip="${escapeHtml(option.label)}"
          aria-label="${escapeHtml(option.label)}"
        ></button>
      `).join("")}
    </div>
  `;
}

function normalizeCountdown(countdown) {
  const source = countdown && typeof countdown === "object" ? countdown : {};

  return {
    enabled: Boolean(source.enabled),
    durationSeconds: clampInteger(source.durationSeconds, 1, 43200, 60),
    hotkey: typeof source.hotkey === "string" ? source.hotkey.trim().toUpperCase() : "",
    side: normalizeCountdownSide(source.side),
    direction: normalizeCountdownDirection(source.direction),
    barThickness: clampInteger(source.barThickness, 1, 2000, 22),
    barLength: clampInteger(source.barLength, 1, 4000, 200),
    color: normalizeCountdownColor(source.color),
    borderWidth: clampInteger(source.borderWidth, 0, 64, 1),
    borderRadius: clampInteger(source.borderRadius, 0, 200, 3),
    borderColor: normalizeCountdownColor(source.borderColor || "#ffffff"),
    flashEnabled: source.flashEnabled !== false,
    retriggerEnabled: Boolean(source.retriggerEnabled)
  };
}

function normalizeCountdownSide(value) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (text === "left") {
    return "Left";
  }

  if (text === "right") {
    return "Right";
  }

  if (text === "below") {
    return "Below";
  }

  return "Above";
}

function normalizeCountdownDirection(value) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (text === "toptobottom" || text === "top-to-bottom") {
    return "TopToBottom";
  }

  if (text === "bottomtotop" || text === "bottom-to-top") {
    return "BottomToTop";
  }

  if (text === "righttoleft" || text === "right-to-left") {
    return "RightToLeft";
  }

  return "LeftToRight";
}

function normalizeCountdownColor(value) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return "gradient";
  }

  if (text.toLowerCase() === "gradient") {
    return "gradient";
  }

  return /^#[0-9a-f]{6,8}$/i.test(text) ? text : "gradient";
}

function readCountdownFieldValue(input, field) {
  if (field === "enabled" || field === "flashEnabled" || field === "retriggerEnabled") {
    return Boolean(input.checked);
  }

  if (field === "durationSeconds" || field === "barThickness" || field === "barLength" || field === "borderWidth" || field === "borderRadius") {
    if (field === "durationSeconds") {
      return clampInteger(input.value, 1, 43200, 1);
    }

    if (field === "barThickness") {
      return clampInteger(input.value, 1, 2000, 1);
    }

    if (field === "borderWidth") {
      return clampInteger(input.value, 0, 64, 1);
    }

    if (field === "borderRadius") {
      return clampInteger(input.value, 0, 200, 3);
    }

    return clampInteger(input.value, 1, 4000, 1);
  }

  if (field === "side") {
    return normalizeCountdownSide(input.value);
  }

  if (field === "direction") {
    return normalizeCountdownDirection(input.value);
  }

  return input.value;
}

function updateCountdownInlineUi(field, value) {
  document.querySelectorAll(`[data-countdown-field="${cssEscape(field)}"]`).forEach((element) => {
    if (element.type === "checkbox") {
      element.checked = Boolean(value);
      return;
    }

    if (element.type === "radio") {
      element.checked = String(element.value) === String(value);
      return;
    }

    element.value = String(value);
  });
}

function bindDynamicTooltips(root = document) {
  root.querySelectorAll("[data-tooltip], [title], [aria-label]").forEach((trigger) => {
    if (trigger.dataset.countdownEditorTooltipBound === "true") {
      return;
    }

    if (!trigger.dataset.tooltip) {
      const fallbackText = trigger.getAttribute("title") || trigger.getAttribute("aria-label") || "";

      if (fallbackText) {
        trigger.dataset.tooltip = fallbackText;
      }
    }

    if (trigger.hasAttribute("title")) {
      trigger.removeAttribute("title");
    }

    if (!trigger.dataset.tooltip) {
      return;
    }

    trigger.dataset.countdownEditorTooltipBound = "true";
    trigger.addEventListener("mouseenter", () => showFloatingTooltip(trigger));
    trigger.addEventListener("focus", () => showFloatingTooltip(trigger));
    trigger.addEventListener("mouseleave", hideFloatingTooltip);
    trigger.addEventListener("blur", hideFloatingTooltip);
  });
}

function showFloatingTooltip(trigger) {
  const text = trigger?.dataset?.tooltip || "";

  if (!els.floatingTooltip || !text) {
    return;
  }

  state.activeTooltipTrigger = trigger;
  els.floatingTooltip.textContent = text;
  els.floatingTooltip.classList.add("visible");
  els.floatingTooltip.setAttribute("aria-hidden", "false");
  positionFloatingTooltip(trigger);
}

function hideFloatingTooltip() {
  if (!els.floatingTooltip) {
    return;
  }

  state.activeTooltipTrigger = null;
  els.floatingTooltip.classList.remove("visible");
  els.floatingTooltip.setAttribute("aria-hidden", "true");
}

function positionFloatingTooltip(trigger) {
  if (!els.floatingTooltip || !trigger) {
    return;
  }

  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = els.floatingTooltip.getBoundingClientRect();
  const top = Math.max(8, triggerRect.top - tooltipRect.height - 8);
  const centeredLeft = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
  const left = Math.min(window.innerWidth - tooltipRect.width - 8, Math.max(8, centeredLeft));

  els.floatingTooltip.style.top = `${top}px`;
  els.floatingTooltip.style.left = `${left}px`;
}

function scheduleResizeToContent() {
  if (state.resizeFrame) {
    window.cancelAnimationFrame(state.resizeFrame);
  }

  state.resizeFrame = window.requestAnimationFrame(() => {
    state.resizeFrame = 0;

    if (!els.card) {
      return;
    }

    const rect = els.card.getBoundingClientRect();
    const width = Math.ceil(rect.width + 28);
    const height = Math.ceil(Math.min(rect.height + 28, window.screen.availHeight - 24));
    void window.screenVisionApi.window.resizeToContent(width, height);
  });
}

function shouldPreserveInteractiveSurface() {
  const activeElement = document.activeElement;

  if (!activeElement || !els.content?.contains(activeElement)) {
    return false;
  }

  if (activeElement.matches("input, select, textarea")) {
    return true;
  }

  return Boolean(activeElement.closest("[data-countdown-hotkey]"));
}

function toHotkeyBinding(event) {
  if (event.key === "Backspace" || event.key === "Delete") {
    return {
      label: "",
      keyCode: 0,
      modifiers: 0
    };
  }

  const keyCode = toWindowsVirtualKeyCode(event);
  const baseKey = normalizeHotkeyDisplayKey(event);

  if (!keyCode || !baseKey) {
    return null;
  }

  const modifiers = (
    (event.ctrlKey ? 2 : 0)
    | (event.altKey ? 1 : 0)
    | (event.shiftKey ? 4 : 0)
    | (event.metaKey ? 8 : 0)
  );
  const parts = [];

  if (event.ctrlKey) {
    parts.push("Ctrl");
  }

  if (event.altKey) {
    parts.push("Alt");
  }

  if (event.shiftKey) {
    parts.push("Shift");
  }

  if (event.metaKey) {
    parts.push("Win");
  }

  parts.push(baseKey);

  return {
    label: parts.join("+"),
    keyCode,
    modifiers
  };
}

function normalizeHotkeyDisplayKey(event) {
  const code = String(event.code || "");
  const key = String(event.key || "");

  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }

  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }

  if (/^Numpad[0-9]$/.test(code)) {
    return code.slice(6);
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return code.toUpperCase();
  }

  if (code === "Backquote" || key === "`") {
    return "`";
  }

  if (code === "NumpadAdd" || key === "+") {
    return "+";
  }

  if (/^[a-z0-9]$/i.test(key)) {
    return key.toUpperCase();
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(key)) {
    return key.toUpperCase();
  }

  return "";
}

function toWindowsVirtualKeyCode(event) {
  const code = String(event.code || "");
  const key = String(event.key || "");

  if (/^Key[A-Z]$/.test(code)) {
    return code.charCodeAt(3);
  }

  if (/^Digit[0-9]$/.test(code)) {
    return 48 + Number.parseInt(code.slice(5), 10);
  }

  if (/^Numpad[0-9]$/.test(code)) {
    return 96 + Number.parseInt(code.slice(6), 10);
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return 111 + Number.parseInt(code.slice(1), 10);
  }

  if (code === "Backquote" || key === "`") {
    return 192;
  }

  if (code === "NumpadAdd" || key === "+") {
    return 107;
  }

  if (/^[a-z]$/i.test(key)) {
    return key.toUpperCase().charCodeAt(0);
  }

  if (/^[0-9]$/.test(key)) {
    return 48 + Number.parseInt(key, 10);
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(key)) {
    return 111 + Number.parseInt(key.slice(1), 10);
  }

  return 0;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
