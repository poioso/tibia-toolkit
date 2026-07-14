import { bootstrapRendererLocale } from "../../lib/renderer-locale.js";
import { t } from "../../lib/app-i18n.js";

const params = new URLSearchParams(window.location.search);

const panelKey = params.get("panel") || "";

const title = document.querySelector("#side-panel-title");
const description = document.querySelector("#side-panel-description");
const emptyTitle = document.querySelector("#side-panel-empty-title");
const emptyCopy = document.querySelector("#side-panel-empty-copy");
const closeButton = document.querySelector("#side-panel-close");
const shell = document.querySelector(".side-panel-shell");
const initialSide = params.get("side") || "right";
let currentAnimationToken = 0;

function getPanelCopy() {
  const panelCopy = {
    "alertas-panel": {
      title: t("screenVision.alerts"),
      description: t("sidePanel.description"),
      emptyTitle: t("sidePanel.alerts.pendingTitle"),
      emptyCopy: t("sidePanel.pendingCopy")
    },
    "profiles-panel": {
      title: t("sidePanel.profiles.title"),
      description: t("sidePanel.description"),
      emptyTitle: t("sidePanel.profiles.pendingTitle"),
      emptyCopy: t("sidePanel.pendingCopy")
    }
  };

  return panelCopy[panelKey] || {
    title: params.get("title") || t("sidePanel.title"),
    description: params.get("description") || t("sidePanel.description"),
    emptyTitle: t("sidePanel.readyTitle"),
    emptyCopy: t("sidePanel.readyCopy")
  };
}

function applyCopy() {
  const copy = getPanelCopy();

  if (title) {
    title.textContent = copy.title;
  }

  if (description) {
    description.textContent = copy.description;
  }

  if (emptyTitle) {
    emptyTitle.textContent = copy.emptyTitle;
  }

  if (emptyCopy) {
    emptyCopy.textContent = copy.emptyCopy;
  }

  if (closeButton) {
    closeButton.setAttribute("aria-label", t("common.close"));
  }
}

function applyPanelSide(side) {
  document.body.dataset.dockedSide = side === "left" ? "left" : "right";
}

function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function waitForTransition(durationMs) {
  return new Promise((resolve) => {
    if (!shell) {
      resolve();
      return;
    }

    let done = false;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      shell.removeEventListener("transitionend", handleTransitionEnd);
      resolve();
    };

    const handleTransitionEnd = (event) => {
      if (event.target === shell) {
        finish();
      }
    };

    shell.addEventListener("transitionend", handleTransitionEnd);
    window.setTimeout(finish, Math.max(120, durationMs + 80));
  });
}

window.__dockedToolPanelAnimate = async (phase = "enter", side = initialSide, durationMs = 220) => {
  const token = ++currentAnimationToken;
  applyPanelSide(side);

  if (!shell) {
    document.body.dataset.panelPhase = "idle";
    return;
  }

  shell.style.transition = `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${Math.max(120, Math.round(durationMs * 0.82))}ms ease`;

  if (phase === "exit") {
    document.body.dataset.panelPhase = "idle";
    await waitForNextFrame();
    if (token !== currentAnimationToken) {
      return;
    }
    document.body.dataset.panelPhase = "exiting";
    await waitForTransition(durationMs);
    return;
  }

  document.body.dataset.panelPhase = "pre-enter";
  await waitForNextFrame();
  await waitForNextFrame();
  if (token !== currentAnimationToken) {
    return;
  }
  document.body.dataset.panelPhase = "entering";
  await waitForTransition(durationMs);
  if (token !== currentAnimationToken) {
    return;
  }
  document.body.dataset.panelPhase = "idle";
};

void bootstrapRendererLocale({ root: document.body }).then(() => {
  applyCopy();
});

applyPanelSide(initialSide);
document.body.dataset.panelPhase = "idle";

closeButton?.addEventListener("click", () => {
  window.close();
});

window.addEventListener("docked-tool-panel:context", (event) => {
  const nextSide = event?.detail?.side;
  applyPanelSide(nextSide);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    window.close();
  }
});
