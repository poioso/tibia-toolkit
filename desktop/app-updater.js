import electronUpdater from "electron-updater";

function normalizeUpdateUrls(values = []) {
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || "").trim().replace(/\/+$/, ""))
    .filter((value, index, list) => /^https?:\/\//i.test(value) && list.indexOf(value) === index);
}

export function startAppUpdater({
  appIsPackaged,
  urls,
  updater: updaterOverride = null,
  onStatus = () => {},
  onError = () => {},
  onAvailable = () => {},
  onProgress = () => {},
  onDownloaded = () => {}
} = {}) {
  if (!appIsPackaged) {
    return null;
  }

  const updateUrls = normalizeUpdateUrls(urls);
  if (updateUrls.length === 0) {
    onStatus("Atualizador sem servidor configurado.");
    return null;
  }

  const updater = updaterOverride || electronUpdater.autoUpdater;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.allowPrerelease = false;
  let activeSourceIndex = -1;
  let sourceSwitchInFlight = false;
  let downloadFinished = false;
  let downloadInFlight = false;
  let installRequested = false;
  let updateInfo = null;
  let resolveInitialCheck;
  let initialCheckSettled = false;
  const initialCheck = new Promise((resolve) => {
    resolveInitialCheck = resolve;
  });

  const settleInitialCheck = (result) => {
    if (initialCheckSettled) return;
    initialCheckSettled = true;
    resolveInitialCheck(result);
  };

  const tryNextSource = async (previousError = null) => {
    if (sourceSwitchInFlight || downloadFinished || downloadInFlight) {
      return;
    }

    sourceSwitchInFlight = true;
    activeSourceIndex += 1;

    try {
      if (activeSourceIndex >= updateUrls.length) {
        const error = previousError || new Error("Nenhum servidor de atualizacao respondeu.");
        settleInitialCheck({ available: false, error });
        onError(error);
        return;
      }

      const url = updateUrls[activeSourceIndex];
      updater.setFeedURL({ provider: "generic", url });
      onStatus(`Verificando atualizacoes em ${url}.`);
      await updater.checkForUpdates();
      onStatus(`Atualizador conectado em ${url}.`);
    } catch (error) {
      sourceSwitchInFlight = false;
      await tryNextSource(error);
      return;
    }

    sourceSwitchInFlight = false;
  };

  updater.on("update-available", (info) => {
    updateInfo = info;
    settleInitialCheck({ available: true, info });
    onStatus(`Nova versao ${info.version} encontrada.`);
    onAvailable(info);
  });
  updater.on("update-not-available", (info) => {
    settleInitialCheck({ available: false, info });
  });
  updater.on("download-progress", (progress) => {
    onStatus(`Baixando atualizacao: ${Math.round(progress.percent || 0)}%.`);
    onProgress(progress);
  });
  updater.on("update-downloaded", (info) => {
    downloadFinished = true;
    downloadInFlight = false;
    onStatus(`Atualizacao ${info.version} pronta. Ela sera instalada ao fechar o aplicativo.`);
    onDownloaded(info);
  });
  updater.on("error", (error) => {
    downloadInFlight = false;
    if (!downloadFinished && activeSourceIndex + 1 < updateUrls.length) {
      void tryNextSource(error);
      return;
    }
    settleInitialCheck({ available: false, error });
    onError(error);
  });

  void tryNextSource();

  const checkInterval = setInterval(() => {
    if (downloadFinished || downloadInFlight) {
      return;
    }
    activeSourceIndex = -1;
    void tryNextSource();
  }, 30 * 60 * 1000);

  return {
    initialCheck,
    getInfo() {
      return updateInfo;
    },
    async download() {
      if (downloadFinished || downloadInFlight) {
        return;
      }
      downloadInFlight = true;
      onStatus("Baixando atualizacao em segundo plano.");
      try {
        await updater.downloadUpdate();
      } catch (error) {
        downloadInFlight = false;
        throw error;
      }
    },
    install() {
      if (installRequested) {
        return true;
      }
      if (!downloadFinished) {
        return false;
      }
      try {
        installRequested = true;
        onStatus("Iniciando instalador da atualizacao.");
        updater.quitAndInstall();
        return true;
      } catch (error) {
        installRequested = false;
        onError(error);
        return false;
      }
    },
    dispose() {
      clearInterval(checkInterval);
    }
  };
}
