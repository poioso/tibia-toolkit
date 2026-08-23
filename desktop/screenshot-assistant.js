const els = {
  root: document.querySelector(".screenshot-assistant"),
  state: document.querySelector("#assistant-state"),
  stateDot: document.querySelector("#assistant-state-dot"),
  stateLabel: document.querySelector("#assistant-state-label"),
  toggleEnabled: document.querySelector("#toggle-enabled"),
  toggleEnabledInput: document.querySelector("#toggle-enabled-input"),
  close: document.querySelector("#close"),
  openFolder: document.querySelector("#open-folder"),
  reselectArea: document.querySelector("#reselect-area"),
  toggleDeleteOriginal: document.querySelector("#toggle-delete-original"),
  showHelp: document.querySelector("#show-help"),
  openFolderCount: document.querySelector("#open-folder-count"),
  status: document.querySelector("#status"),
  tooltip: document.querySelector("#tooltip")
};

let reselecting = false;
let togglingDeleteOriginal = false;
let togglingEnabled = false;
let assistantEnabled = false;
let hasSelection = false;
let needsSelectionPrompt = false;
let needsTibiaPrompt = false;

function renderAssistantState() {
  const needsTibia = needsTibiaPrompt;
  const needsSelection = !needsTibia && needsSelectionPrompt && !assistantEnabled && !hasSelection;
  els.root.classList.toggle("is-enabled", assistantEnabled);
  els.root.classList.toggle("is-disabled", !assistantEnabled && !needsSelection && !needsTibia);
  els.root.classList.toggle("needs-selection", needsSelection);
  els.root.classList.toggle("needs-tibia", needsTibia);
  els.stateLabel.textContent = needsTibia
    ? "Abra o Tibia"
    : needsSelection
      ? "Inativo: Selecione a área"
    : assistantEnabled
      ? "Recorte automático ativo"
      : "Recorte automático inativo";
  els.toggleEnabledInput.checked = assistantEnabled;
  els.toggleEnabled.setAttribute("data-tooltip", assistantEnabled ? "Desativar ScreenshotToolkit" : "Ativar ScreenshotToolkit");
  els.toggleEnabled.setAttribute("aria-label", assistantEnabled ? "Desativar ScreenshotToolkit" : "Ativar ScreenshotToolkit");
  els.toggleEnabledInput.setAttribute("aria-label", assistantEnabled ? "Desativar ScreenshotToolkit" : "Ativar ScreenshotToolkit");
  els.reselectArea.classList.toggle("needs-selection", needsSelection);
  els.reselectArea.classList.toggle("needs-tibia", needsTibia);
  els.reselectArea.disabled = Boolean(reselecting);
  if (needsTibia) {
    els.reselectArea.setAttribute("aria-disabled", "true");
    els.reselectArea.tabIndex = -1;
  } else {
    els.reselectArea.removeAttribute("aria-disabled");
    els.reselectArea.removeAttribute("tabindex");
  }
  els.reselectArea.setAttribute("data-tooltip", needsTibia ? "Abra o Tibia" : "Selecionar nova área da screenshot");
  els.reselectArea.setAttribute("aria-label", needsTibia ? "Abra o Tibia" : "Selecionar nova área");
  if (needsTibia) els.reselectArea.setAttribute("data-tooltip-tone", "warning");
  else els.reselectArea.removeAttribute("data-tooltip-tone");
}

function setAssistantState(payload = {}, { needsSelection: attention = null, needsTibia: tibiaAttention = null } = {}) {
  const settings = payload?.settings && typeof payload.settings === "object" ? payload.settings : payload;
  assistantEnabled = Boolean(settings?.enabled);
  hasSelection = typeof payload?.hasSelection === "boolean"
    ? payload.hasSelection
    : Boolean(settings?.selection);
  if (typeof attention === "boolean") needsSelectionPrompt = attention;
  if (typeof tibiaAttention === "boolean") needsTibiaPrompt = tibiaAttention;
  if (hasSelection) needsSelectionPrompt = false;
  if (assistantEnabled && tibiaAttention !== true) {
    needsSelectionPrompt = false;
    needsTibiaPrompt = false;
  }
  renderAssistantState();
}

function setEnabledBusy(value) {
  togglingEnabled = Boolean(value);
  els.toggleEnabledInput.disabled = togglingEnabled;
  els.toggleEnabled.classList.toggle("busy", togglingEnabled);
  if (togglingEnabled) els.toggleEnabled.setAttribute("aria-busy", "true");
  else els.toggleEnabled.removeAttribute("aria-busy");
}

function setNewScreenshotCount(value) {
  const count = Math.max(0, Number(value) || 0);
    const icon = els.openFolder.querySelector("img");
    if (icon) {
      icon.src = count > 0
      ? "tibiatoolkit://app/assets/ui/tutorial/folder.gif"
      : "tibiatoolkit://app/assets/ui/tutorial/folder-inactive.png";
  }
  els.openFolder.classList.toggle("has-new-screenshots", count > 0);
  els.openFolderCount.hidden = count < 1;
  els.openFolderCount.setAttribute("aria-hidden", count < 1 ? "true" : "false");
  els.openFolderCount.textContent = count > 0 ? String(count) : "";
  els.openFolder.setAttribute(
    "aria-label",
    count > 0 ? `Abrir pasta de screenshots (${count} novas)` : "Abrir pasta de screenshots"
  );
}

function showStatus(message, error = false) {
  const text = String(message || "").trim();
  els.status.hidden = !text;
  els.status.textContent = text;
  els.status.classList.toggle("error", Boolean(error));
}

function setReselecting(value) {
  reselecting = Boolean(value);
  els.reselectArea.disabled = reselecting;
  els.reselectArea.classList.toggle("busy", reselecting);
  if (reselecting) els.reselectArea.setAttribute("aria-busy", "true");
  else els.reselectArea.removeAttribute("aria-busy");
}

function setDeleteOriginal(value) {
  const enabled = Boolean(value);
  els.toggleDeleteOriginal.classList.toggle("active", enabled);
  els.toggleDeleteOriginal.classList.toggle("delete-original-active", enabled);
  els.toggleDeleteOriginal.setAttribute("aria-pressed", enabled ? "true" : "false");
}

function setDeleteOriginalBusy(value) {
  togglingDeleteOriginal = Boolean(value);
  els.toggleDeleteOriginal.disabled = togglingDeleteOriginal;
  els.toggleDeleteOriginal.classList.toggle("busy", togglingDeleteOriginal);
  if (togglingDeleteOriginal) els.toggleDeleteOriginal.setAttribute("aria-busy", "true");
  else els.toggleDeleteOriginal.removeAttribute("aria-busy");
}

function showTooltip(trigger) {
  const text = String(trigger?.dataset?.tooltip || "").trim();
  if (!text) return;
  els.tooltip.textContent = text;
  els.tooltip.classList.toggle("warning", trigger?.dataset?.tooltipTone === "warning");
  els.tooltip.classList.add("visible");
  els.tooltip.setAttribute("aria-hidden", "false");
  const bounds = trigger.getBoundingClientRect();
  const tooltipBounds = els.tooltip.getBoundingClientRect();
  els.tooltip.style.left = `${Math.max(8, Math.min(bounds.left + bounds.width / 2 - tooltipBounds.width / 2, window.innerWidth - tooltipBounds.width - 8))}px`;
  els.tooltip.style.top = `${Math.min(bounds.bottom + 7, window.innerHeight - tooltipBounds.height - 8)}px`;
}

function hideTooltip() {
  els.tooltip.classList.remove("visible");
  els.tooltip.classList.remove("warning");
  els.tooltip.setAttribute("aria-hidden", "true");
}

document.querySelectorAll("[data-tooltip]").forEach((button) => {
  button.addEventListener("mouseenter", () => showTooltip(button));
  button.addEventListener("focus", () => showTooltip(button));
  button.addEventListener("mouseleave", hideTooltip);
  button.addEventListener("blur", hideTooltip);
});

els.close.addEventListener("click", () => { void window.screenshotAssistantApi.close(); });

els.toggleEnabledInput.addEventListener("change", async () => {
  if (togglingEnabled) return;
  const requested = Boolean(els.toggleEnabledInput.checked);
  const previousEnabled = assistantEnabled;
  setEnabledBusy(true);
  try {
    const result = await window.screenshotAssistantApi.setEnabled(requested);
    if (result?.needsTibia) {
      setAssistantState(result, { needsTibia: true });
      showStatus("");
      return;
    }
    if (result?.missingSelection) {
      setAssistantState(result, { needsSelection: true });
      showStatus("");
      return;
    }
    if (result?.sourceDirectoryRequired || result?.error) {
      setAssistantState(result);
      showStatus(result.error || "Selecione a pasta de screenshots do Tibia antes de ativar.", true);
      return;
    }
    setAssistantState(result, { needsSelection: false, needsTibia: false });
    showStatus(requested ? "ScreenshotToolkit ativado." : "ScreenshotToolkit desativado.");
  } catch {
    assistantEnabled = previousEnabled;
    renderAssistantState();
    showStatus("Não foi possível alterar o estado do ScreenshotToolkit.", true);
  } finally {
    setEnabledBusy(false);
  }
});

els.showHelp.addEventListener("click", async () => {
  if (els.showHelp.disabled) return;
  els.showHelp.disabled = true;
  els.showHelp.classList.add("busy");
  els.showHelp.setAttribute("aria-busy", "true");
  try {
    const result = await window.screenshotAssistantApi.showAssistantHelp();
    if (result?.opened === false && result.reason === "tutorial-active") {
      showStatus("Feche o tutorial atual para abrir esta ajuda.");
    }
  } catch {
    showStatus("Não foi possível abrir a ajuda das screenshots.", true);
  } finally {
    els.showHelp.disabled = false;
    els.showHelp.classList.remove("busy");
    els.showHelp.removeAttribute("aria-busy");
  }
});

els.openFolder.addEventListener("click", async () => {
  const result = await window.screenshotAssistantApi.openDirectory();
  showStatus(result?.error || "", Boolean(result?.error));
  if (!result?.error) setNewScreenshotCount(0);
});

els.toggleDeleteOriginal.addEventListener("click", async () => {
  if (togglingDeleteOriginal) return;
  setDeleteOriginalBusy(true);
  try {
    const result = await window.screenshotAssistantApi.toggleDeleteOriginal();
    const enabled = Boolean(result?.settings?.deleteOriginal);
    setDeleteOriginal(enabled);
    showStatus(enabled ? "A imagem original será apagada." : "A imagem original será mantida.");
  } catch {
    showStatus("Não foi possível alterar a exclusão da imagem original.", true);
  } finally {
    setDeleteOriginalBusy(false);
  }
});

els.reselectArea.addEventListener("click", async () => {
  if (reselecting || needsTibiaPrompt) return;
  setReselecting(true);
  showStatus("Selecionando nova área...");
  try {
    const result = await window.screenshotAssistantApi.reselect();
    if (result?.needsTibia) {
      setAssistantState(result, { needsTibia: true });
      showStatus("");
      return;
    }
    if (result?.settings) setAssistantState(result);
    showStatus(result?.error || (result?.cancelled ? "Seleção cancelada." : "Nova área definida."), Boolean(result?.error));
  } catch {
    showStatus("Não foi possível selecionar uma nova área.", true);
  } finally {
    setReselecting(false);
  }
});

void window.screenshotAssistantApi.getState().then((result) => {
  setAssistantState(result);
  setDeleteOriginal(Boolean(result?.deleteOriginal));
  setNewScreenshotCount(result?.newScreenshotCount);
}).catch(() => {});

window.screenshotAssistantApi.onStatus((message) => {
  const normalized = String(message || "").trim();
  if (!normalized) return;
  showStatus(normalized === "Screenshot do Tibia recortada e salva." ? "Screenshot gerada" : normalized);
});

window.screenshotAssistantApi.onNewScreenshotCount((count) => {
  setNewScreenshotCount(count);
});

window.screenshotAssistantApi.onState((payload) => {
  setAssistantState(payload, {
    needsSelection: payload?.needsSelection,
    needsTibia: payload?.needsTibia
  });
});

window.screenshotAssistantApi.onTutorialFocus((active) => {
  document.body.classList.toggle("tutorial-focus", Boolean(active));
});
