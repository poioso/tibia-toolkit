import { getActiveLocale, getIntlLocale } from "./locale-state.js";

export function slugifyItemInput(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´ʻʼ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function humanizeLabel(value) {
  if (!value && value !== 0) {
    return "-";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatCompactNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat(getIntlLocale(getActiveLocale())).format(value);
}

export function formatAbbreviatedNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  if (Math.abs(value) < 1000000) {
    return formatCompactNumber(value);
  }

  const kkCount = Math.max(2, Math.floor(Math.log10(Math.abs(value)) / 3));
  const compactValue = value / (1000 ** kkCount);
  const truncated = Math.sign(compactValue) * Math.floor(Math.abs(compactValue) * 100) / 100;
  const hasDecimals = Math.abs(truncated % 1) > 0;
  return `${new Intl.NumberFormat(getIntlLocale(getActiveLocale()), {
    maximumFractionDigits: hasDecimals ? 2 : 0
  }).format(truncated)}${"k".repeat(kkCount)}`;
}

export function formatNpcPrice(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return `${formatAbbreviatedNumber(value)} gold`;
}

export function formatIsoDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(getIntlLocale(getActiveLocale()), {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export function formatRelativeTimeFromNow(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const rtf = new Intl.RelativeTimeFormat(getIntlLocale(getActiveLocale()), { numeric: "auto" });

  if (absMs < minuteMs) {
    return "agora";
  }

  if (absMs < hourMs) {
    return rtf.format(Math.round(diffMs / minuteMs), "minute");
  }

  if (absMs < dayMs) {
    return rtf.format(Math.round(diffMs / hourMs), "hour");
  }

  return rtf.format(Math.round(diffMs / dayMs), "day");
}

export function convertPrice(value, mode, rates, fallbackTcPrice = null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  const tibiaCoinPrice = rates?.tibiaCoinPrice ?? fallbackTcPrice;
  const goldTokenPrice = rates?.goldTokenPrice ?? null;

  if (mode === "tc") {
    if (!tibiaCoinPrice) {
      return "-";
    }

    return `${(value / tibiaCoinPrice).toFixed(2)} TC`;
  }

  if (mode === "gt") {
    if (!goldTokenPrice) {
      return "-";
    }

    return `${(value / goldTokenPrice).toFixed(2)} GT`;
  }

  return `${formatCompactNumber(value)} gold`;
}
