export const safeString = (value: unknown) => (value == null ? "" : String(value).trim());

export const safeLower = (value: unknown) => safeString(value).toLowerCase();

export const cleanNumber = (value: unknown) => {
  const raw = safeString(value);
  if (!raw) {
    return 0;
  }
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

export const isMissing = (value: unknown) => safeString(value) === "";

export const safeDateLabel = (value: unknown) => {
  const raw = safeString(value);
  if (!raw) {
    return "Missing date";
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString();
};

export const formatMoney = (value: unknown, currency?: unknown) => {
  if (isMissing(value)) {
    return "Missing";
  }
  const amount = cleanNumber(value);
  const currencyLabel = safeString(currency);
  return `${currencyLabel ? `${currencyLabel} ` : ""}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};
