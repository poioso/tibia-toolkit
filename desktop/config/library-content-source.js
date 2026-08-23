const PRODUCTION_SITE_URL = "https://tibiatoolkit.com";
const PRODUCTION_API_URL = "https://auth.tibiatoolkit.com";

function safeOrigin(value, fallback) {
  try {
    const url = new URL(String(value || "").trim() || fallback);
    return ["http:", "https:"].includes(url.protocol) ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

export function resolveLibraryContentSource({ isProductionRuntime, accountSiteBaseUrl, accountAuthBaseUrl, environment = process.env } = {}) {
  if (isProductionRuntime) {
    return { mode: "production", readOnly: true, siteBaseUrl: PRODUCTION_SITE_URL, apiBaseUrl: PRODUCTION_API_URL };
  }

  const requestedMode = String(environment.TIBIA_TOOLKIT_LIBRARY_SOURCE_MODE || "homologation").trim().toLowerCase();
  if (requestedMode === "production-readonly") {
    return { mode: "production-readonly", readOnly: true, siteBaseUrl: PRODUCTION_SITE_URL, apiBaseUrl: PRODUCTION_API_URL };
  }

  return {
    mode: "homologation",
    readOnly: true,
    siteBaseUrl: safeOrigin(environment.TIBIA_TOOLKIT_LIBRARY_SITE_BASE_URL, accountSiteBaseUrl),
    apiBaseUrl: safeOrigin(environment.TIBIA_TOOLKIT_LIBRARY_API_BASE_URL, accountAuthBaseUrl)
  };
}
