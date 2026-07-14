import { t } from "../../lib/app-i18n.js";
import { bootstrapRendererLocale } from "../../lib/renderer-locale.js";

const COLOR_OPTIONS = ["#58C470", "#FF0000", "#0088FF", "#00FF00", "#8800FF", "#FFFFFF", "#FFD700"];

const INTENSITY_OPTIONS = [
  { value: 5, labelKey: "screenVision.visual.intensity.low" },
  { value: 10, labelKey: "screenVision.visual.intensity.medium" },
  { value: 20, labelKey: "screenVision.visual.intensity.high" },
  { value: 30, labelKey: "screenVision.visual.intensity.max" }
];

const els = {
  content: document.querySelector("#visual-content"),
  closeButton: document.querySelector("#window-close-button"),
  floatingTooltip: document.querySelector("#floating-tooltip")
};

let state = null;
const fieldCommitTimers = new Map();

boot();

async function boot() {
  await bootstrapRendererLocale({ root: document.body });
  els.closeButton?.addEventListener("click", () => {
    void window.screenVisionApi.window.close();
  });

  window.screenVisionApi.events?.onOverlayStateChanged?.(() => {
    if (fieldCommitTimers.size > 0) {
      return;
    }

    void refresh();
  });

  await refresh();
  bindDynamicTooltips(document);
}

async function refresh() {
  state = await window.screenVisionApi.visual.get().catch(() => null);
  render();
}

function render() {
  if (!els.content || !state) {
    return;
  }

  els.content.innerHTML = `
    <section class="visual-card">
      <h2>${escapeHtml(t("screenVision.visual.characterTitle"))}</h2>
      <p>${escapeHtml(t("screenVision.visual.characterCopy"))}</p>
      <div class="visual-row inline">
        <span>${escapeHtml(state.charLocEnabled ? t("screenVision.visual.enabled") : t("screenVision.visual.disabled"))}</span>
        <input class="visual-switch" type="checkbox" data-field="charLocEnabled" data-tooltip="${escapeHtml(t("screenVision.visual.toggleCharacterMarker"))}" ${state.charLocEnabled ? "checked" : ""}>
      </div>
      ${state.charLocEnabled ? `
        <div class="visual-row inline">
          <span>${escapeHtml(t("screenVision.visual.lockMarker"))}</span>
          <button type="button" class="lock-button${state.charLocLocked ? " active" : ""}" data-toggle-lock="charloc" data-tooltip="${escapeHtml(state.charLocLocked ? t("screenVision.visual.unlockMarkerTooltip") : t("screenVision.visual.lockMarkerTooltip"))}">${escapeHtml(state.charLocLocked ? t("screenVision.visual.locked") : t("screenVision.visual.unlocked"))}</button>
        </div>
        <div class="visual-row">
          <label>${escapeHtml(t("screenVision.visual.shape"))}</label>
          <div class="visual-button-row">
            ${renderShapeButton("Circle", state.charLocShape)}
            ${renderShapeButton("Arrow", state.charLocShape)}
          </div>
        </div>
        ${renderSliderRow(t("screenVision.visual.size"), "charLocSize", state.charLocSize, 20, 160, 1)}
        <div class="visual-row">
          <label>${escapeHtml(t("screenVision.visual.intensity"))}</label>
          <div class="visual-button-row">
            ${INTENSITY_OPTIONS.map((option) => `
              <button type="button" class="visual-pill${Number(state.charLocIntensity) === option.value ? " active" : ""}" data-field="charLocIntensity" data-value="${option.value}" data-tooltip="${escapeHtml(t("screenVision.visual.intensityTooltip", { level: t(option.labelKey).toLowerCase() }))}">${escapeHtml(t(option.labelKey))}</button>
            `).join("")}
          </div>
        </div>
        <div class="visual-row inline">
          <span>${escapeHtml(t("screenVision.visual.pulse"))}</span>
          <input class="visual-switch" type="checkbox" data-field="charLocPulse" data-tooltip="${escapeHtml(t("screenVision.visual.pulseTooltip"))}" ${state.charLocPulse ? "checked" : ""}>
        </div>
        ${renderColorRow(t("screenVision.visual.color"), "charLocColor", state.charLocColor)}
      ` : ""}
    </section>

    <section class="visual-card">
      <h2>${escapeHtml(t("screenVision.visual.cursorTitle"))}</h2>
      <p>${escapeHtml(t("screenVision.visual.cursorCopy"))}</p>
      <div class="visual-row inline">
        <span>${escapeHtml(state.cursorGlowEnabled ? t("screenVision.visual.enabled") : t("screenVision.visual.disabled"))}</span>
        <input class="visual-switch" type="checkbox" data-field="cursorGlowEnabled" data-tooltip="${escapeHtml(t("screenVision.visual.toggleCursorGlow"))}" ${state.cursorGlowEnabled ? "checked" : ""}>
      </div>
      ${state.cursorGlowEnabled ? `
        ${renderSliderRow(t("screenVision.visual.size"), "cursorGlowSize", state.cursorGlowSize, 20, 160, 1)}
        ${renderColorRow(t("screenVision.visual.color"), "cursorGlowColor", state.cursorGlowColor)}
      ` : ""}
    </section>
  `;

  bindEvents();
  bindDynamicTooltips(els.content);
}

function bindEvents() {
  els.content.querySelectorAll("[data-field]").forEach((element) => {
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      element.addEventListener("change", () => {
        void updateField(element.dataset.field, element.checked);
      });
      return;
    }

    if (element instanceof HTMLInputElement && (element.type === "range" || element.type === "number")) {
      element.addEventListener("input", () => {
        const numeric = Number(element.value);
        const field = element.dataset.field || "";
        applyLocalField(field, numeric);
        syncPair(field, numeric, element);
        scheduleFieldCommit(field, numeric);
      });
      element.addEventListener("change", () => {
        const numeric = Number(element.value);
        const field = element.dataset.field || "";
        applyLocalField(field, numeric);
        syncPair(field, numeric, element);
        flushFieldCommit(field, numeric);
      });
      return;
    }

    if (element instanceof HTMLButtonElement) {
      element.addEventListener("click", () => {
        const value = element.dataset.value || "";
        void updateField(element.dataset.field, Number.isFinite(Number(value)) ? Number(value) : value);
      });
    }
  });

  els.content.querySelectorAll("[data-toggle-lock='charloc']").forEach((element) => {
    element.addEventListener("click", async () => {
      const nextLocked = !state.charLocLocked;
      await updateField("charLocLocked", nextLocked);
    });
  });
}

function syncPair(field, value, sourceElement = null) {
  els.content.querySelectorAll(`[data-field="${cssEscape(field)}"]`).forEach((element) => {
    if (element === sourceElement) {
      return;
    }

    if (element instanceof HTMLInputElement && String(value) !== element.value) {
      element.value = String(value);
    }
  });
}

async function updateField(field, value) {
  if (!field) {
    return;
  }

  applyLocalField(field, value);
  const nextState = await window.screenVisionApi.visual.update({
    [field]: value
  }).catch(() => null);

  if (!nextState) {
    return;
  }

  state = nextState;
  render();
}

function applyLocalField(field, value) {
  if (!state || !field) {
    return;
  }

  state = {
    ...state,
    [field]: value
  };
}

function scheduleFieldCommit(field, value) {
  if (!field) {
    return;
  }

  clearFieldCommit(field);
  const timer = window.setTimeout(() => {
    fieldCommitTimers.delete(field);
    void commitFieldSilently(field, value);
  }, 120);
  fieldCommitTimers.set(field, timer);
}

function flushFieldCommit(field, value) {
  if (!field) {
    return;
  }

  clearFieldCommit(field);
  void commitFieldSilently(field, value);
}

function clearFieldCommit(field) {
  const timer = fieldCommitTimers.get(field);

  if (!timer) {
    return;
  }

  window.clearTimeout(timer);
  fieldCommitTimers.delete(field);
}

async function commitFieldSilently(field, value) {
  if (!field) {
    return;
  }

  const nextState = await window.screenVisionApi.visual.update({
    [field]: value
  }).catch(() => null);

  if (nextState) {
    state = nextState;
  }
}

function renderShapeButton(value, selected) {
  const label = value === "Circle" ? t("screenVision.sqm.shape.circle") : t("screenVision.sqm.shape.arrow");
  return `<button type="button" class="visual-pill${selected === value ? " active" : ""}" data-field="charLocShape" data-value="${escapeHtml(value)}" data-tooltip="${escapeHtml(t("screenVision.visual.shapeTooltip", { shape: label.toLowerCase() }))}">${escapeHtml(label)}</button>`;
}

function renderSliderRow(label, field, value, min, max, step) {
  return `
    <div class="visual-row">
      <label>${escapeHtml(label)}</label>
      <div class="visual-slider-line">
        <input type="range" min="${min}" max="${max}" step="${step}" value="${escapeHtml(String(value))}" data-field="${escapeHtml(field)}" data-tooltip="${escapeHtml(t("screenVision.sqm.adjustField", { field: label.toLowerCase() }))}">
        <input type="number" min="${min}" max="${max}" step="${step}" value="${escapeHtml(String(value))}" data-field="${escapeHtml(field)}" data-tooltip="${escapeHtml(t("screenVision.sqm.adjustField", { field: label.toLowerCase() }))}">
      </div>
    </div>
  `;
}

function renderColorRow(label, field, selectedValue) {
  return `
    <div class="visual-row">
      <label>${escapeHtml(label)}</label>
      <div class="visual-color-row">
        ${COLOR_OPTIONS.map((color) => `
          <button
            type="button"
            class="visual-color${selectedValue === color ? " active" : ""}"
            style="background:${escapeHtml(color)}"
            data-field="${escapeHtml(field)}"
            data-value="${escapeHtml(color)}"
            aria-label="${escapeHtml(color)}"
            data-tooltip="${escapeHtml(t("screenVision.sqm.useColor", { color }))}"
          ></button>
        `).join("")}
      </div>
    </div>
  `;
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

    if (trigger.hasAttribute("title")) {
      trigger.removeAttribute("title");
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
  const left = clampRange(centeredLeft, 8, window.innerWidth - tooltipRect.width - 8);

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function clampRange(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value ?? ""));
  }

  return String(value ?? "").replace(/"/g, '\\"');
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
