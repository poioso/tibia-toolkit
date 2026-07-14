import OBSWebSocket from "obs-websocket-js";

const OBS_ADDRESS = "ws://127.0.0.1:4455";
const LEGACY_SOURCE_PREFIX = "TibiaToolkit Mirror - ";
const MIRROR_FRAME_PADDING = 12;

/**
 * Mirrors are cropped scene items that reuse the user's existing Tibia Game
 * Capture. Reusing the actual game texture avoids a second hook and, unlike a
 * transparent WPF overlay, gives OBS real pixels to render.
 */
export class ObsMirrorSync {
  #obs = null;
  #enabled = false;
  #connected = false;
  #sceneName = "";
  #latestPayload = null;
  #syncTimer = null;
  #syncInFlight = Promise.resolve();
  #lastError = "";
  #managedItems = new Map();
  #onError;
  #onLog;

  constructor({ onError, onLog } = {}) {
    this.#onError = typeof onError === "function" ? onError : null;
    this.#onLog = typeof onLog === "function" ? onLog : null;
  }

  getStatus() {
    return {
      enabled: this.#enabled,
      connected: this.#connected,
      sceneName: this.#sceneName,
      error: this.#lastError
    };
  }

  async enable({ regions, tibiaState, password = "" } = {}) {
    if (!this.#obs) {
      this.#createClient();
    }

    if (!this.#connected) {
      try {
        await this.#obs.connect(OBS_ADDRESS, password || undefined);
        this.#connected = true;
      } catch (error) {
        try {
          await this.#obs.disconnect();
        } catch {
          // The rejected connection is already closed.
        }
        this.#obs = null;
        this.#connected = false;
        throw error;
      }
    }

    const scene = await this.#obs.call("GetCurrentProgramScene");
    this.#sceneName = String(scene?.currentProgramSceneName || "").trim();
    if (!this.#sceneName) {
      throw new Error("OBS nao informou uma cena ativa para receber os espelhos.");
    }

    this.#enabled = true;
    this.#lastError = "";
    await this.#removeLegacyWindowSources();
    await this.#enqueueSync({ regions, tibiaState });
    return this.getStatus();
  }

  async disable() {
    this.#enabled = false;
    this.#latestPayload = null;
    if (this.#syncTimer) {
      clearTimeout(this.#syncTimer);
      this.#syncTimer = null;
    }

    try {
      await this.#syncInFlight.catch((error) => this.#reportError(error));
      await this.#removeManagedItems();
      await this.#removeLegacyWindowSources();
    } catch (error) {
      this.#reportError(error);
    } finally {
      this.#connected = false;
      this.#sceneName = "";
      try {
        await this.#obs?.disconnect();
      } catch {
        // OBS may already have closed the socket.
      }
    }

    return this.getStatus();
  }

  scheduleSync({ regions, tibiaState } = {}) {
    if (!this.#enabled || !this.#connected) {
      return;
    }

    this.#latestPayload = { regions, tibiaState };
    if (this.#syncTimer) {
      return;
    }

    // Native emits mirror-bounds-changed when the user releases a move/resize.
    // This coalesces only a short burst from that same interaction, not polling.
    this.#syncTimer = setTimeout(() => {
      this.#syncTimer = null;
      const payload = this.#latestPayload;
      this.#latestPayload = null;
      void this.#enqueueSync(payload).catch((error) => this.#reportError(error));
    }, 80);
  }

  async #enqueueSync(payload) {
    this.#syncInFlight = this.#syncInFlight
      .catch((error) => this.#reportError(error))
      .then(() => this.#syncNow(payload));
    return this.#syncInFlight;
  }

  async #syncNow({ regions, tibiaState } = {}) {
    if (!this.#enabled || !this.#connected || !this.#sceneName) {
      return;
    }

    const tibiaBounds = tibiaState?.clientBounds || tibiaState?.bounds;
    if (!isUsableBounds(tibiaBounds)) {
      return;
    }

    const activeScene = await this.#obs.call("GetCurrentProgramScene");
    const latestSceneName = String(activeScene?.currentProgramSceneName || "").trim();
    if (latestSceneName && latestSceneName !== this.#sceneName) {
      await this.#removeManagedItems();
      this.#sceneName = latestSceneName;
    }

    const gameCapture = await this.#findTibiaGameCapture();
    if (!gameCapture) {
      throw new Error("Adicione uma fonte de Captura de Jogo do Tibia na cena ativa do OBS antes de ativar os espelhos.");
    }

    const activeIds = new Set();
    for (const region of Array.isArray(regions) ? regions : []) {
      if (!region?.id || !isUsableBounds(region?.mirrorBounds)) {
        continue;
      }

      activeIds.add(String(region.id));
      const managedItem = await this.#ensureMirrorItem(region.id, gameCapture.sourceName);
      if (!isUsableBounds(region.captureBounds)) {
        continue;
      }

      const mirrorTransform = buildMirrorTransform({
        captureBounds: region.captureBounds,
        mirrorBounds: region.mirrorBounds,
        tibiaBounds,
        sourceTransform: gameCapture.sceneItemTransform
      });

      await this.#obs.call("SetSceneItemTransform", {
        sceneName: this.#sceneName,
        sceneItemId: managedItem.sceneItemId,
        sceneItemTransform: mirrorTransform
      });
      await this.#obs.call("SetSceneItemEnabled", {
        sceneName: this.#sceneName,
        sceneItemId: managedItem.sceneItemId,
        sceneItemEnabled: region.isVisible !== false
      });
    }

    for (const [regionId, item] of [...this.#managedItems]) {
      if (activeIds.has(regionId)) {
        continue;
      }
      await this.#removeManagedItem(item);
      this.#managedItems.delete(regionId);
    }
  }

  async #findTibiaGameCapture() {
    const [inputs, sceneItems] = await Promise.all([
      this.#obs.call("GetInputList"),
      this.#getSceneItems()
    ]);
    const managedItemIds = new Set([...this.#managedItems.values()].map((item) => Number(item.sceneItemId)));
    const baseSceneItemBySource = new Map();
    for (const item of sceneItems) {
      const sceneItemId = Number(item?.sceneItemId);
      const sourceName = String(item?.sourceName || "");
      // A cropped mirror points at the same Game Capture input. Never use one
      // of those derived items as the base transform on the next sync.
      if (!sourceName || managedItemIds.has(sceneItemId) || baseSceneItemBySource.has(sourceName)) {
        continue;
      }
      baseSceneItemBySource.set(sourceName, item);
    }
    const gameInputs = (Array.isArray(inputs?.inputs) ? inputs.inputs : [])
      .filter((input) => String(input?.inputKind || "") === "game_capture")
      .filter((input) => baseSceneItemBySource.has(String(input?.inputName || "")));

    for (const input of gameInputs) {
      const sourceName = String(input.inputName || "");
      const settings = await this.#obs.call("GetInputSettings", { inputName: sourceName });
      const windowTarget = String(settings?.inputSettings?.window || "").toLowerCase();
      if (!windowTarget.includes("client.exe") && !windowTarget.includes("tibia")) {
        continue;
      }

      const sceneItem = baseSceneItemBySource.get(sourceName);
      const transform = await this.#obs.call("GetSceneItemTransform", {
        sceneName: this.#sceneName,
        sceneItemId: Number(sceneItem.sceneItemId)
      });
      if (Number(transform?.sceneItemTransform?.sourceWidth) > 0 && Number(transform?.sceneItemTransform?.sourceHeight) > 0) {
        return { sourceName, sceneItemTransform: transform.sceneItemTransform };
      }
    }

    return null;
  }

  async #ensureMirrorItem(regionId, sourceName) {
    const current = this.#managedItems.get(String(regionId));
    if (current?.sceneName === this.#sceneName && current?.sourceName === sourceName) {
      return current;
    }
    if (current) {
      await this.#removeManagedItem(current);
    }

    const created = await this.#obs.call("CreateSceneItem", {
      sceneName: this.#sceneName,
      sourceName,
      sceneItemEnabled: false
    });
    const item = {
      sceneName: this.#sceneName,
      sourceName,
      sceneItemId: Number(created?.sceneItemId)
    };
    if (!Number.isFinite(item.sceneItemId)) {
      throw new Error("OBS nao criou o recorte do espelho.");
    }
    this.#managedItems.set(String(regionId), item);
    this.#log(`mirror=${regionId} duplicated-game-capture source=${sourceName}`);
    return item;
  }

  async #removeManagedItems() {
    for (const item of this.#managedItems.values()) {
      await this.#removeManagedItem(item);
    }
    this.#managedItems.clear();
  }

  async #removeManagedItem(item) {
    if (!item?.sceneName || !Number.isFinite(Number(item.sceneItemId))) {
      return;
    }
    try {
      await this.#obs.call("RemoveSceneItem", {
        sceneName: item.sceneName,
        sceneItemId: Number(item.sceneItemId)
      });
    } catch (error) {
      this.#log(`mirror-item-remove-failed id=${item.sceneItemId} ${error?.message || String(error)}`);
    }
  }

  async #removeLegacyWindowSources() {
    if (!this.#connected || !this.#sceneName) {
      return;
    }
    for (const item of await this.#getSceneItems()) {
      const sourceName = String(item?.sourceName || "");
      if (!sourceName.startsWith(LEGACY_SOURCE_PREFIX)) {
        continue;
      }
      try {
        await this.#obs.call("RemoveInput", { inputName: sourceName });
      } catch (error) {
        this.#log(`legacy-source-remove-failed source=${sourceName} ${error?.message || String(error)}`);
      }
    }
  }

  async #getSceneItems() {
    const result = await this.#obs.call("GetSceneItemList", { sceneName: this.#sceneName });
    return Array.isArray(result?.sceneItems) ? result.sceneItems : [];
  }

  #reportError(error) {
    this.#lastError = String(error?.message || error || "Falha ao sincronizar o OBS.");
    this.#onError?.(error);
  }

  #log(message) {
    this.#onLog?.(message);
  }

  #createClient() {
    this.#obs = new OBSWebSocket();
    this.#obs.on("ConnectionClosed", () => {
      this.#connected = false;
      this.#enabled = false;
    });
  }
}

function buildMirrorTransform({ captureBounds, mirrorBounds, tibiaBounds, sourceTransform }) {
  const sourceWidth = Math.max(1, Number(sourceTransform?.sourceWidth || 0));
  const sourceHeight = Math.max(1, Number(sourceTransform?.sourceHeight || 0));
  const sourceCropLeft = Math.max(0, Number(sourceTransform?.cropLeft || 0));
  const sourceCropTop = Math.max(0, Number(sourceTransform?.cropTop || 0));
  const sourceCropRight = Math.max(0, Number(sourceTransform?.cropRight || 0));
  const sourceCropBottom = Math.max(0, Number(sourceTransform?.cropBottom || 0));
  const visibleSourceWidth = Math.max(1, sourceWidth - sourceCropLeft - sourceCropRight);
  const visibleSourceHeight = Math.max(1, sourceHeight - sourceCropTop - sourceCropBottom);
  const sourceXPerClientPixel = visibleSourceWidth / Math.max(1, Number(tibiaBounds.width));
  const sourceYPerClientPixel = visibleSourceHeight / Math.max(1, Number(tibiaBounds.height));

  // The selected Tibia region supplies the pixels. The independent mirror
  // bounds supply the target position, so dragging a mirror only moves its OBS
  // crop and never alters the user's original Tibia Game Capture.
  const captureLeft = Number(captureBounds.x) - Number(tibiaBounds.x);
  const captureTop = Number(captureBounds.y) - Number(tibiaBounds.y);
  const cropLeft = clamp(Math.round(sourceCropLeft + (captureLeft * sourceXPerClientPixel)), 0, sourceWidth - 1);
  const cropTop = clamp(Math.round(sourceCropTop + (captureTop * sourceYPerClientPixel)), 0, sourceHeight - 1);
  const cropWidth = clamp(Math.round(Number(captureBounds.width) * sourceXPerClientPixel), 1, sourceWidth - cropLeft);
  const cropHeight = clamp(Math.round(Number(captureBounds.height) * sourceYPerClientPixel), 1, sourceHeight - cropTop);
  const baseScaleX = Number.isFinite(Number(sourceTransform?.scaleX)) ? Number(sourceTransform.scaleX) : 1;
  const baseScaleY = Number.isFinite(Number(sourceTransform?.scaleY)) ? Number(sourceTransform.scaleY) : 1;
  const contentWidth = Math.max(1, Number(mirrorBounds.width) - (MIRROR_FRAME_PADDING * 2));
  const contentHeight = Math.max(1, Number(mirrorBounds.height) - (MIRROR_FRAME_PADDING * 2));
  const scaleX = baseScaleX * (contentWidth / Math.max(1, Number(captureBounds.width)));
  const scaleY = baseScaleY * (contentHeight / Math.max(1, Number(captureBounds.height)));

  return {
    positionX: Math.round(Number(sourceTransform?.positionX || 0) + ((Number(mirrorBounds.x) - Number(tibiaBounds.x) + MIRROR_FRAME_PADDING) * sourceXPerClientPixel * baseScaleX)),
    positionY: Math.round(Number(sourceTransform?.positionY || 0) + ((Number(mirrorBounds.y) - Number(tibiaBounds.y) + MIRROR_FRAME_PADDING) * sourceYPerClientPixel * baseScaleY)),
    scaleX,
    scaleY,
    rotation: Number(sourceTransform?.rotation || 0),
    cropLeft,
    cropTop,
    cropRight: Math.max(0, sourceWidth - cropLeft - cropWidth),
    cropBottom: Math.max(0, sourceHeight - cropTop - cropHeight),
    alignment: Number(sourceTransform?.alignment || 5),
    boundsType: "OBS_BOUNDS_NONE"
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function isUsableBounds(value) {
  return value
    && Number.isFinite(Number(value.x))
    && Number.isFinite(Number(value.y))
    && Number(value.width) > 0
    && Number(value.height) > 0;
}
