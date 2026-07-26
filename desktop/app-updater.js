import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

function normalizeUpdateUrls(values = []) {
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || "").trim().replace(/\/+$/, ""))
    .filter((value, index, list) => /^https?:\/\//i.test(value) && list.indexOf(value) === index);
}

export function startAppUpdater({
  appIsPackaged,
  urls,
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

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  let activeSourceIndex = -1;
  let sourceSwitchInFlight = false;
  let downloadFinished = false;
  let downloadInFlight = false;
  let updateInfo = null;
  let initialCheckResolved = false;
  let resolveInitialCheck = null;
  const initialCheck = new Promise((resolve) => {
    resolveInitialCheck = resolve;
  });

  const completeInitialCheck = (result) => {
    if (initialCheckResolved) return;
    initialCheckResolved = true;
    resolveInitialCheck?.(result);
  };

  const tryNextSource = async (previousError = null) => {
    if (sourceSwitchInFlight || downloadFinished || downloadInFlight) {
      return;
    }

    sourceSwitchInFlight = true;
    activeSourceIndex += 1;

    try {
      if (activeSourceIndex >= updateUrls.length) {
        onError(previousError || new Error("Nenhum servidor de atualizacao respondeu."));
        completeInitialCheck({ available: false, error: previousError || null });
        return;
      }

      const url = updateUrls[activeSourceIndex];
      autoUpdater.setFeedURL({ provider: "generic", url });
      onStatus(`Verificando atualizacoes em ${url}.`);
      await autoUpdater.checkForUpdates();
      onStatus(`Atualizador conectado em ${url}.`);
    } catch (error) {
      sourceSwitchInFlight = false;
      await tryNextSource(error);
      return;
    }

    sourceSwitchInFlight = false;
  };

  autoUpdater.on("update-available", (info) => {
    updateInfo = info;
    completeInitialCheck({ available: true, info });
    onStatus(`Nova versao ${info.version} encontrada.`);
    onAvailable(info);
  });
  autoUpdater.on("update-not-available", () => {
    completeInitialCheck({ available: false, error: null });
  });
  autoUpdater.on("download-progress", (progress) => {
    onStatus(`Baixando atualizacao: ${Math.round(progress.percent || 0)}%.`);
    onProgress(progress);
  });
  autoUpdater.on("update-downloaded", (info) => {
    downloadFinished = true;
    downloadInFlight = false;
    onStatus(`Atualizacao ${info.version} pronta. Ela sera instalada ao fechar o aplicativo.`);
    onDownloaded(info);
  });
  autoUpdater.on("error", (error) => {
    downloadInFlight = false;
    if (!downloadFinished && activeSourceIndex + 1 < updateUrls.length) {
      void tryNextSource(error);
      return;
    }
    onError(error);
    completeInitialCheck({ available: false, error });
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
        await autoUpdater.downloadUpdate();
      } catch (error) {
        downloadInFlight = false;
        throw error;
      }
    },
    install() {
      if (!downloadFinished) {
        return false;
      }
      autoUpdater.quitAndInstall();
      return true;
    },
    dispose() {
      clearInterval(checkInterval);
    }
  };
}
