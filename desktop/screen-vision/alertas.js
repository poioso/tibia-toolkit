import {
  cloneOverlayToolsStateForSave,
  createDefaultOverlayToolsState,
  OVERLAY_TOOLS_STORAGE_KEY,
  normalizeOverlayToolsState
} from "../../lib/overlay-tools-state.js";
import {
  createOverlayTimerEntryFromDraft,
  formatOverlayTimerDuration,
  normalizeOverlayTimerEntry
} from "../../lib/overlay-timers.js";
import { bootstrapRendererLocale } from "../../lib/renderer-locale.js";
import { getAppLocale, t } from "../../lib/app-i18n.js";
import { translateObjectTextFields } from "../../lib/phrase-translations.js";

const COLOR_OPTIONS = ["#ff8a00", "#ffffff", "#ffe24a", "#69df72", "#ff4444", "#0088ff"];
const FONT_SIZE_OPTIONS = [
  { value: "small", label: "Pequena" },
  { value: "medium", label: "Media" },
  { value: "large", label: "Grande" },
  { value: "x-large", label: "Extra grande" },
  { value: "huge", label: "Gigante" }
];
const FONT_FAMILY_OPTIONS = [
  { value: "nunito", label: "Nunito" },
  { value: "toolkit", label: "Toolkit UI" },
  { value: "montserrat", label: "Montserrat" },
  { value: "poppins", label: "Poppins" },
  { value: "sora", label: "Sora" },
  { value: "merriweather", label: "Merriweather" },
  { value: "playfair", label: "Playfair" },
  { value: "rajdhani", label: "Rajdhani" },
  { value: "orbitron", label: "Orbitron" }
];
const FONT_WEIGHT_OPTIONS = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Media" },
  { value: 600, label: "Semi negrito" },
  { value: 700, label: "Negrito" },
  { value: 800, label: "Extra negrito" },
  { value: 900, label: "Preta" }
];
const SOUND_OPTIONS = [
  {
    value: "utura-gran",
    label: "utura gran",
    file: new URL("../../assets/screen-vision/reference/sounds/utura gran.ogg", import.meta.url).href
  },
  {
    value: "exura-gran-ico",
    label: "exura gran ico",
    file: new URL("../../assets/screen-vision/reference/sounds/exura gran ico.ogg", import.meta.url).href
  },
  {
    value: "utito-tempo",
    label: "utito tempo",
    file: new URL("../../assets/screen-vision/reference/sounds/utito tempo.ogg", import.meta.url).href
  }
];
const MAX_TIMERS = 10;

const els = {
  profileLabel: document.querySelector("#profile-label"),
  windowCloseButton: document.querySelector("#window-close-button"),
  globalVolumeRange: document.querySelector("#global-volume-range"),
  globalVolumeValue: document.querySelector("#global-volume-value"),
  addTimerButton: document.querySelector("#add-timer-button"),
  timerCount: document.querySelector("#timer-count"),
  audioFeedback: document.querySelector("#audio-feedback"),
  timerEmptyState: document.querySelector("#timer-empty-state"),
  timerCards: document.querySelector("#timer-cards"),
  runningIndicator: document.querySelector("#running-indicator"),
  listenToggleButton: document.querySelector("#listen-toggle-button"),
  startupListeningCheckbox: document.querySelector("#startup-listening-checkbox"),
  floatingTooltip: document.querySelector("#floating-tooltip")
};

const state = {
  overlayTools: createDefaultOverlayToolsState(),
  activeById: {},
  profileLabel: "tibia eye",
  openAlertEditorIds: new Set()
};

boot();

async function boot() {
  await bootstrapRendererLocale({ root: document.body });
  bindEvents();
  bindExternalEvents();
  await loadOverlayToolsState();
  await loadTimerRuntimeState();
  await refreshProfileLabel();
  render();
  await syncAlertPositionEditors();
  bindDynamicTooltips(document);
}

function bindEvents() {
  els.windowCloseButton?.addEventListener("click", async () => {
    await closeAllAlertEditors();
    await window.screenVisionApi.window.close();
  });

  els.globalVolumeRange?.addEventListener("input", () => {
    state.overlayTools.timers.globalVolumePercent = normalizeNumber(
      els.globalVolumeRange.value,
      70,
      0,
      100
    );
    void persistOverlayToolsState();
    renderToolbar();
  });

  els.addTimerButton?.addEventListener("click", () => {
    addTimerCard();
  });

  els.listenToggleButton?.addEventListener("click", () => {
    toggleListening();
  });

  els.startupListeningCheckbox?.addEventListener("change", () => {
    state.overlayTools.timers.startListeningOnStartup = Boolean(els.startupListeningCheckbox.checked);
    void persistOverlayToolsState();
    renderFooter();
  });

  els.timerCards?.addEventListener("click", (event) => {
    const swatch = event.target.closest("[data-color]");
    const actionButton = event.target.closest("[data-action]");

    if (state.overlayTools.timers.isListening && event.target.closest(".timer-card")) {
      if (actionButton?.dataset.action === "edit-name" || actionButton?.dataset.action === "delete") {
        setFeedback(t("screenVision.alerts.stopListeningRenameDelete"), true);
      } else {
        setFeedback(t("screenVision.alerts.stopListeningEdit"), true);
      }
      return;
    }

    if (swatch) {
      const timerId = swatch.dataset.timerId || "";
      updateTimer(timerId, { alertColor: swatch.dataset.color || "" });
      void syncAlertEditorForTimer(findTimer(timerId));
      return;
    }

    if (!actionButton) {
      return;
    }

    const timerId = actionButton.dataset.timerId || "";
    const action = actionButton.dataset.action || "";

    if (!timerId || !action) {
      return;
    }

    if (action === "delete") {
      void deleteTimer(timerId);
      return;
    }

    if (action === "preview") {
      void previewTimer(timerId);
      return;
    }

    if (action === "toggle-lock") {
      void toggleAlertLock(timerId);
      return;
    }

    if (action === "edit-name") {
      void promptRenameTimer(timerId);
    }
  });

  els.timerCards?.addEventListener("change", (event) => {
    const target = event.target;
    const timerId = target.dataset.timerId || "";
    const field = target.dataset.field || "";

    if (!timerId || !field) {
      return;
    }

    const patch = { [field]: readTimerFieldValue(target, field) };
    updateTimer(timerId, patch);
    void syncAlertEditorFromField(timerId, field, patch[field]);
  });

  els.timerCards?.addEventListener("input", (event) => {
    if (state.overlayTools.timers.isListening) {
      setFeedback(t("screenVision.alerts.stopListeningEdit"), true);
      return;
    }

    const target = event.target;
    const timerId = target.dataset.timerId || "";
    const field = target.dataset.field || "";

    if (!timerId || !field) {
      return;
    }

    const patch = { [field]: readTimerFieldValue(target, field) };
    updateTimer(timerId, patch, { renderOnly: true });
    syncLiveTimerCardState(target, timerId);
  });

  els.timerCards?.addEventListener("keydown", (event) => {
    const target = event.target.closest("[data-hotkey-capture]");

    if (!target) {
      return;
    }

    if (event.key === "Tab") {
      return;
    }

    event.preventDefault();
    const timerId = target.dataset.timerId || "";

    if (event.key === "Escape") {
      target.blur();
      return;
    }

    const binding = toHotkeyBinding(event);

    if (!binding) {
      return;
    }

    target.value = binding.label || t("screenVision.alerts.notDefined");
    updateTimer(timerId, {
      hotkey: {
        code: binding.label,
        modifiers: []
      },
      hotkeyKeyCode: binding.keyCode,
      hotkeyModifiers: binding.modifiers
    });
  });
}

function bindExternalEvents() {
  window.screenVisionApi.events?.onOverlayStateChanged?.(() => {
    void reloadOverlayToolsState();
  });

  window.screenVisionApi.events?.onProfilesChanged?.(() => {
    void refreshProfileLabel();
  });

  window.screenVisionApi.events?.onTimerRuntimeChanged?.((payload) => {
    applyTimerRuntimePayload(payload);
  });

  window.addEventListener("beforeunload", () => {
    void closeAllAlertEditors();
  });
}

async function loadOverlayToolsState() {
  const stored = await window.screenVisionApi.storage.get(OVERLAY_TOOLS_STORAGE_KEY).catch(() => ({}));
  state.overlayTools = normalizeOverlayToolsState(stored?.[OVERLAY_TOOLS_STORAGE_KEY] || null);
}

async function reloadOverlayToolsState() {
  await closeAllAlertEditors();
  await loadOverlayToolsState();
  await loadTimerRuntimeState();
  await refreshProfileLabel();

  render();
  await syncAlertPositionEditors();
}

async function loadTimerRuntimeState() {
  const runtime = await window.screenVisionApi.timers.getRuntime().catch(() => ({ activeById: {} }));
  state.activeById = runtime?.activeById && typeof runtime.activeById === "object"
    ? runtime.activeById
    : {};
}

function applyTimerRuntimePayload(payload) {
  state.activeById = payload?.snapshot?.activeById && typeof payload.snapshot.activeById === "object"
    ? payload.snapshot.activeById
    : {};

  if (typeof payload?.message === "string" && payload.message.trim()) {
    setFeedback(payload.message, payload?.tone === "danger");
  }

  render();
}

async function persistOverlayToolsState() {
  state.overlayTools = cloneOverlayToolsStateForSave(state.overlayTools);
  await window.screenVisionApi.storage.set({
    [OVERLAY_TOOLS_STORAGE_KEY]: state.overlayTools
  }).catch(() => {});
}

async function refreshProfileLabel() {
  const profiles = await window.screenVisionApi.profiles.list().catch(() => []);
  const activeProfile = profiles.find((entry) => entry?.isActive) || null;
  state.profileLabel = activeProfile?.name || "tibia eye";
  renderProfileLabel();
}

function render() {
  renderProfileLabel();
  renderToolbar();
  renderTimerCards();
  renderFooter();
  bindDynamicTooltips(document);
}

function renderProfileLabel() {
  if (els.profileLabel) {
    els.profileLabel.textContent = state.profileLabel || "tibia eye";
  }
}

function renderToolbar() {
  const count = state.overlayTools.timers.items.length;

  if (els.globalVolumeRange) {
    els.globalVolumeRange.value = String(state.overlayTools.timers.globalVolumePercent ?? 70);
  }

  if (els.globalVolumeValue) {
    els.globalVolumeValue.textContent = `${state.overlayTools.timers.globalVolumePercent ?? 70}%`;
  }

  if (els.timerCount) {
    els.timerCount.textContent = `${count}/${MAX_TIMERS}`;
  }

  if (els.addTimerButton) {
    els.addTimerButton.disabled = Boolean(state.overlayTools.timers.isListening);
  }
}

function renderTimerCards() {
  const timers = state.overlayTools.timers.items || [];

  if (els.timerEmptyState) {
    els.timerEmptyState.classList.toggle("hidden", timers.length > 0);
  }

  if (!timers.length) {
    els.timerCards.innerHTML = "";
    return;
  }

  els.timerCards.innerHTML = timers.map((timer, index) => renderTimerCard(timer, index)).join("");
}

function renderTimerCard(rawTimer, index) {
  const timer = normalizeOverlayTimerEntry(rawTimer);
  const runtime = state.activeById[timer.id] || null;
  const isRunning = Boolean(runtime);
  const editDisabledAttr = state.overlayTools.timers.isListening ? " disabled" : "";
  const hotkeyLabel = timer.hotkey?.code || t("screenVision.alerts.notDefined");
  const showAlertOptions = Boolean(timer.showVisualAlert);
  const isUnlocked = showAlertOptions && !timer.locked;

  return `
    <article class="timer-card">
      <div class="timer-card-top">
        <div class="timer-name-title">${escapeHtml(timer.name || `Timer ${index + 1}`)}</div>
        <button type="button" class="timer-icon-button" data-action="edit-name" data-timer-id="${escapeHtml(timer.id)}" aria-label="${escapeHtml(t("common.edit"))}" data-tooltip="${escapeHtml(t("screenVision.alerts.renameTimer"))}">${renderIcon("edit")}</button>
        <button type="button" class="timer-icon-button delete" data-action="delete" data-timer-id="${escapeHtml(timer.id)}" aria-label="${escapeHtml(t("common.delete"))}" data-tooltip="${escapeHtml(t("screenVision.alerts.deleteTimer"))}">${renderIcon("trash")}</button>
        <select class="timer-select sound-select" data-field="soundKey" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.chooseTimerSound"))}"${editDisabledAttr}>
          ${SOUND_OPTIONS.map((option) => `
            <option value="${escapeHtml(option.value)}"${option.value === timer.soundKey ? " selected" : ""}>${escapeHtml(option.label)}</option>
          `).join("")}
        </select>
        <button type="button" class="timer-icon-button" data-action="preview" data-timer-id="${escapeHtml(timer.id)}" aria-label="${escapeHtml(t("screenVision.alerts.testSoundAria"))}" data-tooltip="${escapeHtml(t("screenVision.alerts.testSound"))}">${renderIcon("sound")}</button>
        <label class="timer-check" data-tooltip="${escapeHtml(t("screenVision.alerts.showVisualWhenDone"))}">
          <input type="checkbox" data-field="showVisualAlert" data-timer-id="${escapeHtml(timer.id)}"${timer.showVisualAlert ? " checked" : ""}${editDisabledAttr}>
          <span>${escapeHtml(t("screenVision.alerts.visualAlertLabel"))}</span>
        </label>
        <label class="timer-check" data-tooltip="${escapeHtml(t("screenVision.alerts.retriggerActiveTooltip"))}">
          <input type="checkbox" data-field="retriggerEnabled" data-timer-id="${escapeHtml(timer.id)}"${timer.retriggerEnabled ? " checked" : ""}${editDisabledAttr}>
          <span>${escapeHtml(t("screenVision.alerts.retriggerLabel"))}</span>
        </label>
        <label class="timer-check" data-tooltip="${escapeHtml(t("screenVision.alerts.reminderActiveTooltip"))}">
          <input type="checkbox" data-field="reminderEnabled" data-timer-id="${escapeHtml(timer.id)}"${timer.reminderEnabled ? " checked" : ""}${editDisabledAttr}>
          <span>${escapeHtml(t("screenVision.alerts.reminderLabel"))}</span>
        </label>
      </div>

      <div class="timer-card-row timer-card-row-main">
        <div class="timer-main-inline">
          <span class="timer-label">${escapeHtml(t("screenVision.alerts.hotkeyLabel"))}</span>
          <input
            class="timer-hotkey-input"
            data-hotkey-capture
            data-timer-id="${escapeHtml(timer.id)}"
            value="${escapeHtml(hotkeyLabel)}"
            placeholder="${escapeHtml(t("screenVision.alerts.notDefined"))}"
            data-tooltip="${escapeHtml(t("screenVision.alerts.hotkeyPrompt"))}"
            readonly${editDisabledAttr}
          >
          <span class="timer-label">${escapeHtml(t("screenVision.alerts.durationLabel"))}</span>
          <input
            class="timer-number-input timer-seconds-input"
            data-field="durationSeconds"
            data-timer-id="${escapeHtml(timer.id)}"
            type="number"
            min="1"
            max="43200"
            step="1"
            value="${escapeHtml(String(timer.durationSeconds))}" data-tooltip="${escapeHtml(t("screenVision.alerts.durationTooltip"))}"${editDisabledAttr}
          >
          ${isRunning && runtime ? `
            <div class="timer-running-chip">${escapeHtml(formatOverlayTimerDuration(runtime.remainingSeconds))}</div>
          ` : ""}
        </div>
        <div class="timer-volume-row">
          <input data-field="volumePercent" data-timer-id="${escapeHtml(timer.id)}" type="range" min="0" max="100" step="1" value="${escapeHtml(String(timer.volumePercent))}" data-tooltip="${escapeHtml(t("screenVision.alerts.timerVolume"))}"${editDisabledAttr}>
          <strong data-volume-value>${escapeHtml(String(timer.volumePercent))}%</strong>
        </div>
      </div>

      ${timer.reminderEnabled ? `
        <div class="timer-card-row timer-reminder-row">
          <span class="timer-label">${escapeHtml(t("screenVision.alerts.reminderDelayLabel"))}</span>
          <input
            class="timer-number-input timer-reminder-delay-input"
            data-field="reminderDelaySeconds"
            data-timer-id="${escapeHtml(timer.id)}"
            type="number"
            min="1"
            max="3600"
            step="1"
            value="${escapeHtml(String(timer.reminderDelaySeconds))}"
            data-tooltip="${escapeHtml(t("screenVision.alerts.reminderDelayTooltip"))}"${editDisabledAttr}
          >
          <span class="timer-label">${escapeHtml(t("screenVision.alerts.reminderCountShort"))}</span>
          <input
            class="timer-number-input timer-reminder-count-input"
            data-field="reminderRepeatCount"
            data-timer-id="${escapeHtml(timer.id)}"
            type="number"
            min="1"
            max="10"
            step="1"
            value="${escapeHtml(String(timer.reminderRepeatCount))}"
            data-tooltip="${escapeHtml(t("screenVision.alerts.reminderCountTooltip"))}"${editDisabledAttr}
          >
          <span class="timer-reminder-helper">${escapeHtml(t("screenVision.alerts.reminderHelper"))}</span>
        </div>
      ` : ""}

      ${showAlertOptions ? `
        <div class="timer-alert-panel">
          <div class="timer-card-row timer-alert-row-message">
            <span class="timer-label">${escapeHtml(t("screenVision.alerts.messageLabel"))}</span>
            <input
              class="timer-message-input"
              data-field="message"
              data-timer-id="${escapeHtml(timer.id)}"
              maxlength="25"
              value="${escapeHtml(timer.message || "")}"
              placeholder="${escapeHtml(t("screenVision.alerts.messagePlaceholder"))}" data-tooltip="${escapeHtml(t("screenVision.alerts.messageTooltip"))}"${editDisabledAttr}
            >
            <span class="timer-label">${escapeHtml(t("screenVision.alerts.screenSecondsLabel"))}</span>
            <input
              class="timer-number-input timer-alert-duration-input"
              data-field="alertDurationSeconds"
              data-timer-id="${escapeHtml(timer.id)}"
              type="number"
              min="0.5"
              max="15"
              step="0.1"
              value="${escapeHtml(formatAlertDurationInputValue(timer.alertDurationSeconds))}"
              placeholder="${escapeHtml(formatAlertDurationInputValue(timer.alertDurationSeconds))}" data-tooltip="${escapeHtml(t("screenVision.alerts.screenDurationTooltip"))}"${editDisabledAttr}
            >
          </div>

          <div class="timer-card-row timer-alert-row-visual">
            <span class="timer-label">${escapeHtml(t("screenVision.alerts.colorLabel"))}</span>
            <div class="color-swatches">
              ${COLOR_OPTIONS.map((color) => `
                <button type="button" class="color-swatch${color.toLowerCase() === String(timer.alertColor || "").toLowerCase() ? " active" : ""}" style="background:${color}" data-color="${color}" data-timer-id="${escapeHtml(timer.id)}" aria-label="${color}" data-tooltip="${escapeHtml(t("screenVision.alerts.useColor"))}"${editDisabledAttr}></button>
              `).join("")}
            </div>
            <select class="timer-select compact-select" data-field="fontSizeKey" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.chooseTextSize"))}"${editDisabledAttr}>
              ${FONT_SIZE_OPTIONS.map((option) => `
                <option value="${escapeHtml(option.value)}"${option.value === timer.fontSizeKey ? " selected" : ""}>${escapeHtml(option.label)}</option>
              `).join("")}
            </select>
            <button type="button" class="timer-lock-button${timer.locked ? " active" : ""}" data-action="toggle-lock" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(timer.locked ? t("screenVision.alerts.unlockPreviewText") : t("screenVision.alerts.lockPreviewText"))}"${editDisabledAttr}>
              ${escapeHtml(timer.locked ? t("screenVision.alerts.locked") : t("screenVision.alerts.unlocked"))}
            </button>
          </div>

          <div class="timer-card-row timer-alert-row-fonts">
            <span class="timer-label">${escapeHtml(t("screenVision.alerts.fontLabel"))}</span>
            <select class="timer-select font-family-select" data-field="alertFontFamily" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.chooseTextFont"))}"${editDisabledAttr}>
              ${FONT_FAMILY_OPTIONS.map((option) => `
                <option value="${escapeHtml(option.value)}"${option.value === timer.alertFontFamily ? " selected" : ""}>${escapeHtml(option.label)}</option>
              `).join("")}
            </select>
            <span class="timer-label">${escapeHtml(t("screenVision.alerts.weightLabel"))}</span>
            <select class="timer-select compact-select" data-field="alertFontWeight" data-timer-id="${escapeHtml(timer.id)}" data-tooltip="${escapeHtml(t("screenVision.alerts.chooseTextWeight"))}"${editDisabledAttr}>
              ${FONT_WEIGHT_OPTIONS.map((option) => `
                <option value="${option.value}"${Number(timer.alertFontWeight) === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>
              `).join("")}
            </select>
            <label class="timer-check shadow-check" data-tooltip="${escapeHtml(t("screenVision.alerts.shadowTooltip"))}">
              <input type="checkbox" data-field="alertShadowEnabled" data-timer-id="${escapeHtml(timer.id)}"${timer.alertShadowEnabled ? " checked" : ""}${editDisabledAttr}>
              <span>${escapeHtml(t("screenVision.alerts.shadowLabel"))}</span>
            </label>
          </div>

          ${isUnlocked ? `
            <div class="timer-alert-helper">${escapeHtml(t("screenVision.alerts.unlockHelper"))}</div>
          ` : ""}
        </div>
      ` : ""}

      <div class="timer-substatus">${escapeHtml(getTimerSubstatusText(timer, isRunning, runtime))}</div>
    </article>
  `;
}

function renderFooter() {
  const isListening = Boolean(state.overlayTools.timers.isListening);
  els.runningIndicator?.classList.toggle("active", isListening);

  if (els.listenToggleButton) {
    els.listenToggleButton.textContent = isListening ? t("screenVision.alerts.stop") : t("screenVision.alerts.start");
    els.listenToggleButton.classList.toggle("active", isListening);
  }

  if (els.startupListeningCheckbox) {
    els.startupListeningCheckbox.checked = Boolean(state.overlayTools.timers.startListeningOnStartup);
  }
}

function addTimerCard() {
  if (state.overlayTools.timers.isListening) {
    setFeedback(t("screenVision.alerts.stopListeningEditAdd"), true);
    return;
  }

  if (state.overlayTools.timers.items.length >= MAX_TIMERS) {
    setFeedback(t("screenVision.alerts.limitReached", { count: MAX_TIMERS }), true);
    return;
  }

  const nextIndex = state.overlayTools.timers.items.length + 1;
  const timer = createOverlayTimerEntryFromDraft({
    name: `Timer ${nextIndex}`,
    durationSeconds: 60,
    volumePercent: 100,
    soundKey: SOUND_OPTIONS[0].value,
    message: "",
    alertColor: "#ff4444",
    fontSizeKey: "large",
    alertFontFamily: "nunito",
    alertFontWeight: 700,
    alertShadowEnabled: true,
    alertDurationSeconds: 1.6,
    reminderEnabled: false,
    reminderDelaySeconds: 10,
    reminderRepeatCount: 2,
    showVisualAlert: false,
    retriggerEnabled: true,
    locked: false
  });

  state.overlayTools.timers.items.push(timer);
  void persistOverlayToolsState();
  render();
  setFeedback(t("screenVision.alerts.timerCreated"), false);
}

function updateTimer(timerId, partial, options = {}) {
  const timerIndex = state.overlayTools.timers.items.findIndex((entry) => entry.id === timerId);

  if (timerIndex < 0) {
    return;
  }

  const current = normalizeOverlayTimerEntry(state.overlayTools.timers.items[timerIndex]);
  const next = normalizeOverlayTimerEntry({
    ...current,
    ...partial
  });

  state.overlayTools.timers.items[timerIndex] = next;

  if (options.skipPersist !== true) {
    void persistOverlayToolsState();
  }

  if (!options.renderOnly) {
    render();
  }
}

async function confirmExternalModal(options = {}) {
  const localizedOptions = await translateObjectTextFields(
    getAppLocale(),
    options,
    ["title", "message", "confirmLabel", "cancelLabel", "checkboxLabel", "placeholder"]
  );
  const result = await window.screenVisionApi.dialogs.confirm(localizedOptions).catch(() => null);

  if (result && typeof result === "object") {
    return {
      confirmed: Boolean(result.confirmed),
      rememberChoice: Boolean(result.rememberChoice),
      skipped: Boolean(result.skipped)
    };
  }

  return {
    confirmed: Boolean(result),
    rememberChoice: false,
    skipped: false
  };
}

async function promptExternalModal(options = {}) {
  const localizedOptions = await translateObjectTextFields(
    getAppLocale(),
    options,
    ["title", "message", "confirmLabel", "cancelLabel", "placeholder"]
  );
  return await window.screenVisionApi.dialogs.prompt(localizedOptions).catch(() => null);
}

async function deleteTimer(timerId) {
  if (state.overlayTools.timers.isListening) {
    setFeedback(t("screenVision.alerts.stopListeningDelete"), true);
    return;
  }

  const timer = findTimer(timerId);

  if (!timer) {
    return;
  }

  const dialogResult = await confirmExternalModal({
    title: "Confirmar Exclusao",
    message: `Deletar alerta "${timer.name || "Alerta"}"?`,
    confirmLabel: "Sim",
    cancelLabel: "Cancelar",
    checkboxLabel: "Nao perguntar novamente nesta sessao",
    sessionKey: "delete-timer-v2"
  });

  if (!dialogResult.confirmed) {
    return;
  }

  await window.screenVisionApi.timers.stop({ timerId }).catch(() => {});
  void closeAlertEditor(timerId);
  state.overlayTools.timers.items = state.overlayTools.timers.items.filter((entry) => entry.id !== timerId);
  void persistOverlayToolsState();
  render();
  setFeedback(t("screenVision.alerts.timerRemoved"), false);
}

function toggleListening() {
  if (!state.overlayTools.timers.isListening && state.overlayTools.timers.items.length === 0) {
    setFeedback(t("screenVision.alerts.addTimerBeforeListening"), true);
    return;
  }

  state.overlayTools.timers.isListening = !state.overlayTools.timers.isListening;

  if (!state.overlayTools.timers.isListening) {
    state.activeById = {};
  }

  void persistOverlayToolsState();
  render();
  if (state.overlayTools.timers.isListening) {
    void closeAllAlertEditors();
  } else {
    void syncAlertPositionEditors();
  }
  setFeedback(
    state.overlayTools.timers.isListening
      ? "Escutando hotkeys. A edicao ficou bloqueada."
      : "Escuta parada. Edicao liberada.",
    false
  );
}

async function startTimer(timerId, options = {}) {
  const result = await window.screenVisionApi.timers.start({
    timerId,
    restart: Boolean(options.restart)
  }).catch(() => null);

  if (result?.snapshot?.activeById && typeof result.snapshot.activeById === "object") {
    state.activeById = result.snapshot.activeById;
    render();
  }
}

async function stopTimer(timerId) {
  const result = await window.screenVisionApi.timers.stop({ timerId }).catch(() => null);

  if (result?.snapshot?.activeById && typeof result.snapshot.activeById === "object") {
    state.activeById = result.snapshot.activeById;
    render();
  }
}

async function previewTimer(timerId) {
  const timer = findTimer(timerId);

  if (!timer) {
    return;
  }

  await playSelectedSound(timer);
  setFeedback(t("screenVision.alerts.soundPlayed", { name: timer.name || t("screenVision.alerts.unnamed") }), false);
}

async function playSelectedSound(timer) {
  const audio = buildAudioForTimer(timer);

  if (!audio) {
    setFeedback(t("screenVision.alerts.noSoundAvailable"), true);
    return;
  }

  try {
    await audio.play();
  } catch (_error) {
  }
}

function buildAudioForTimer(timer) {
  let file = SOUND_OPTIONS.find((entry) => entry.value === timer.soundKey)?.file || "";

  if (!file && timer.customSoundPath) {
    file = new URL(`file:///${timer.customSoundPath.replace(/\\/g, "/")}`).href;
  }

  if (!file) {
    return null;
  }

  const audio = new Audio(file);
  const effectiveVolume =
    ((state.overlayTools.timers.globalVolumePercent ?? 70) / 100)
    * ((timer.volumePercent ?? 100) / 100);
  audio.volume = Math.min(Math.max(effectiveVolume, 0), 1);
  return audio;
}

async function showVisualAlert(timer) {
  const message = (timer.message || timer.name || t("screenVision.alerts.timerReady")).trim();
  await window.screenVisionApi.timers.showVisualAlert({
    timerId: timer.id,
    name: timer.name || t("timers.newTitle"),
    message,
    color: timer.alertColor || "#FFFFFF",
    fontSize: fontSizeKeyToValue(timer.fontSizeKey),
    fontFamily: timer.alertFontFamily || "nunito",
    fontWeight: timer.alertFontWeight || 700,
    shadowEnabled: timer.alertShadowEnabled !== false,
    durationSeconds: timer.alertDurationSeconds ?? 1.6,
    x: timer.alertPositionX,
    y: timer.alertPositionY
  }).catch(() => {});
}

async function toggleAlertLock(timerId) {
  const timer = findTimer(timerId);

  if (!timer || !timer.showVisualAlert) {
    return;
  }

  if (timer.locked) {
    updateTimer(timerId, { locked: false });
    await ensureAlertEditor(findTimer(timerId));
    setFeedback(t("screenVision.alerts.positionUnlocked", { name: timer.name }), false);
    return;
  }

  if (!state.openAlertEditorIds.has(timerId)) {
    await ensureAlertEditor(timer);
    setFeedback(t("screenVision.alerts.previewOpened", { name: timer.name }), false);
    return;
  }

  const center = await closeAlertEditor(timerId);
  updateTimer(timerId, {
    locked: true,
    alertPositionX: center?.x ?? timer.alertPositionX ?? null,
    alertPositionY: center?.y ?? timer.alertPositionY ?? null
  });
  setFeedback(t("screenVision.alerts.positionSaved", { name: timer.name }), false);
}

async function promptRenameTimer(timerId) {
  const timer = findTimer(timerId);

  if (!timer || state.overlayTools.timers.isListening) {
    return;
  }

  const nextName = String(await promptExternalModal({
    title: t("timers.editTitle"),
    message: t("screenVision.alerts.renamePrompt", { name: timer.name || t("timers.newTitle") }),
    inputValue: timer.name || t("timers.newTitle"),
    placeholder: t("screenVision.alerts.timerNamePlaceholder"),
    confirmLabel: t("common.save"),
    cancelLabel: t("common.cancel"),
    maxLength: 80
  }) || "").trim();

  if (!nextName) {
    return;
  }

  updateTimer(timerId, { name: nextName });
  const refreshed = findTimer(timerId);
  await syncAlertEditorForTimer(refreshed);
}

async function syncAlertEditorFromField(timerId, field, value) {
  if (field === "showVisualAlert") {
    const timer = findTimer(timerId);

    if (!timer?.showVisualAlert) {
      await closeAlertEditor(timerId);
      render();
      return;
    }

    if (!timer.locked) {
      await ensureAlertEditor(timer);
    }
    render();
    return;
  }

  if (field === "locked") {
    return;
  }

  if (field === "message" && typeof value === "string" && value.length > 25) {
    updateTimer(timerId, { message: value.slice(0, 25) }, { renderOnly: true });
  }

  const timer = findTimer(timerId);
  await syncAlertEditorForTimer(timer);
}

async function syncAlertEditorForTimer(timer) {
  if (!timer?.id) {
    return;
  }

  if (state.overlayTools.timers.isListening || !timer.showVisualAlert || timer.locked) {
    await closeAlertEditor(timer.id);
    return;
  }

  await ensureAlertEditor(timer);
}

async function ensureAlertEditor(timer) {
  if (!timer || !timer.showVisualAlert || timer.locked) {
    if (timer?.id) {
      await closeAlertEditor(timer.id);
    }
    return null;
  }

  const payload = buildAlertEditorPayload(timer);
  const center = state.openAlertEditorIds.has(timer.id)
    ? await window.screenVisionApi.timers.updatePositionEditor(payload).catch(() => null)
    : await window.screenVisionApi.timers.openPositionEditor(payload).catch(() => null);

  state.openAlertEditorIds.add(timer.id);

  if (
    center
    && (timer.alertPositionX !== center.x || timer.alertPositionY !== center.y)
  ) {
    updateTimer(timer.id, {
      alertPositionX: center.x,
      alertPositionY: center.y
    }, {
      renderOnly: true
    });
  }

  return center;
}

async function closeAlertEditor(timerId) {
  if (!timerId) {
    return null;
  }

  const center = await window.screenVisionApi.timers.closePositionEditor({ timerId }).catch(() => null);
  state.openAlertEditorIds.delete(timerId);
  return center;
}

async function closeAllAlertEditors() {
  const timerIds = [...state.openAlertEditorIds];

  for (const timerId of timerIds) {
    await closeAlertEditor(timerId);
  }
}

async function syncAlertPositionEditors() {
  if (state.overlayTools.timers.isListening) {
    await closeAllAlertEditors();
    return;
  }

  const unlockedIds = new Set();

  for (const rawTimer of state.overlayTools.timers.items) {
    const timer = normalizeOverlayTimerEntry(rawTimer);

    if (!timer || !timer.showVisualAlert || timer.locked) {
      continue;
    }

    unlockedIds.add(timer.id);
    await ensureAlertEditor(timer);
  }

  for (const timerId of [...state.openAlertEditorIds]) {
    if (!unlockedIds.has(timerId)) {
      await closeAlertEditor(timerId);
    }
  }
}

function buildAlertEditorPayload(timer) {
  return {
    timerId: timer.id,
    name: timer.name || t("timers.newTitle"),
    message: (timer.message || timer.name || t("screenVision.alerts.timerReady")).trim(),
    color: timer.alertColor || "#FFFFFF",
    fontSize: fontSizeKeyToValue(timer.fontSizeKey),
    fontFamily: timer.alertFontFamily || "nunito",
    fontWeight: timer.alertFontWeight || 700,
    shadowEnabled: timer.alertShadowEnabled !== false,
    durationSeconds: timer.alertDurationSeconds ?? 1.6,
    x: timer.alertPositionX,
    y: timer.alertPositionY
  };
}

function findTimer(timerId) {
  return normalizeOverlayTimerEntry(
    state.overlayTools.timers.items.find((entry) => entry.id === timerId)
  );
}

function getTimerSubstatusText(timer, isRunning, runtime) {
  if (isRunning && runtime) {
    if (runtime.phase === "waiting-reminder") {
      const nextReminderIndex = Math.min(
        Number(runtime.remindersSent || 0) + 1,
        Number(runtime.reminderRepeatCount || 0)
      );
      return `${t("screenVision.alerts.reminderPrefix")} ${nextReminderIndex}/${runtime.reminderRepeatCount} ${t("screenVision.alerts.in")} ${formatOverlayTimerDuration(runtime.remainingSeconds)} | ${timer.message || t("screenVision.alerts.noMessage")}`;
    }

    return `${formatOverlayTimerDuration(runtime.remainingSeconds)} | ${timer.message || t("screenVision.alerts.noMessage")}`;
  }

  return `${formatOverlayTimerDuration(timer.durationSeconds)} | ${timer.message || t("screenVision.alerts.noMessage")}`;
}

function syncLiveTimerCardState(target, timerId) {
  const card = target.closest(".timer-card");
  const timer = findTimer(timerId);

  if (!card || !timer) {
    return;
  }

  if (target.dataset.field === "volumePercent") {
    const volumeValue = card.querySelector("[data-volume-value]");
    if (volumeValue) {
      volumeValue.textContent = `${timer.volumePercent}%`;
    }
  }

  const substatus = card.querySelector(".timer-substatus");
  if (substatus) {
    substatus.textContent = getTimerSubstatusText(timer, false, null);
  }
}

function readTimerFieldValue(target, field) {
  if (target instanceof HTMLInputElement && target.type === "checkbox") {
    return Boolean(target.checked);
  }

  if (field === "durationSeconds") {
    return normalizeNumber(target.value, 60, 1, 43200);
  }

  if (field === "alertDurationSeconds") {
    return normalizeDecimal(target.value, 1.6, 0.5, 15, 1);
  }

  if (field === "reminderDelaySeconds") {
    return normalizeNumber(target.value, 10, 1, 3600);
  }

  if (field === "reminderRepeatCount") {
    return normalizeNumber(target.value, 2, 1, 10);
  }

  if (field === "volumePercent") {
    return normalizeNumber(target.value, 100, 0, 100);
  }

  if (field === "alertFontWeight") {
    return normalizeNumber(target.value, 700, 400, 900);
  }

  return target.value;
}

function formatAlertDurationInputValue(value) {
  const normalized = normalizeDecimal(value, 1.6, 0.5, 15, 1);
  return normalized.toFixed(1).replace(/\.0$/, "");
}

function renderIcon(kind) {
  if (kind === "edit") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5zM13.5 7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  if (kind === "sound") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14h3l5 4V6l-5 4H5zM17 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V5h6v2M8 7v12h8V7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
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

  switch (key) {
    case " ":
      return "Space";
    case "Enter":
      return "Enter";
    case "Escape":
      return "Esc";
    case "Tab":
      return "Tab";
    default:
      return "";
  }
}

function toWindowsVirtualKeyCode(event) {
  const code = String(event.code || "");
  const key = String(event.key || "");

  if (/^Key[A-Z]$/.test(code)) {
    return code.charCodeAt(3);
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.charCodeAt(5);
  }
  if (/^Numpad[0-9]$/.test(code)) {
    return 96 + Number.parseInt(code.slice(6), 10);
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return 111 + Number.parseInt(code.slice(1), 10);
  }

  switch (code) {
    case "Backquote":
      return 192;
    case "NumpadAdd":
      return 107;
    case "Minus":
      return 189;
    case "Equal":
      return 187;
    default:
      break;
  }

  switch (key) {
    case " ":
      return 32;
    case "Enter":
      return 13;
    case "Tab":
      return 9;
    case "Escape":
      return 27;
    default:
      return 0;
  }
}

function fontSizeKeyToValue(key) {
  switch (String(key || "").trim().toLowerCase()) {
    case "small":
      return 18;
    case "medium":
      return 26;
    case "x-large":
      return 44;
    case "huge":
      return 56;
    default:
      return 34;
  }
}

function setFeedback(message, isError) {
  if (!els.audioFeedback) {
    return;
  }

  if (!message) {
    els.audioFeedback.textContent = "";
    els.audioFeedback.classList.add("hidden");
    els.audioFeedback.classList.remove("error");
    return;
  }

  els.audioFeedback.textContent = message;
  els.audioFeedback.classList.remove("hidden");
  els.audioFeedback.classList.toggle("error", Boolean(isError));
}

function normalizeNumber(value, fallback, min, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(parsed), min), max);
}

function normalizeDecimal(value, fallback, min, max, decimals = 1) {
  const parsed = Number.parseFloat(String(value ?? "").trim());

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const clamped = Math.min(Math.max(parsed, min), max);
  const factor = 10 ** decimals;
  return Math.round(clamped * factor) / factor;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
