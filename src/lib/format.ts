/**
 * Parse a user-typed amount into a number. Tolerant of separators, currency
 * symbols, spaces, and magnitude suffixes (k, m/mn, b/bn, lakh, crore).
 * Returns null when there is no positive number to find.
 */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;

  let mult = 1;
  const suffix = s.match(/(crore|cr|lakh|lac|bn|b|mn|m|k)\s*$/);
  if (suffix) {
    const u = suffix[1];
    mult =
      u === "k" ? 1e3 :
      u === "m" || u === "mn" ? 1e6 :
      u === "b" || u === "bn" ? 1e9 :
      u === "lakh" || u === "lac" ? 1e5 :
      1e7; // cr / crore
    s = s.slice(0, suffix.index).trim();
  }

  const num = s.replace(/[^0-9.]/g, "");
  if (!num || num === ".") return null;
  const n = parseFloat(num) * mult;
  return isFinite(n) && n > 0 ? n : null;
}

/** Format an amount in the given ISO-4217 currency (no decimals). */
export function formatCurrency(n: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString(locale)}`;
  }
}

/** Format a US-dollar buying-power figure (no decimals). */
export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** The bare currency symbol for a currency in a locale (e.g. "$", "₹", "€"). */
export function currencySymbol(currency: string, locale?: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}
