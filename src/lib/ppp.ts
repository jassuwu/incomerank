import type { Period } from "./types";

/**
 * Convert an entered gross income to 2021 international dollars per day —
 * the unit the world/country distributions are expressed in. (ADR-0001.)
 */
export function toDailyIntl(amount: number, period: Period, ppp2021: number): number {
  const annual = period === "monthly" ? amount * 12 : amount;
  return annual / 365 / ppp2021;
}

/**
 * Convert an entered gross income to market-FX US dollars per day — the basis
 * for the default "exchange rate" comparison. Returns null without an FX rate.
 */
export function toDailyNominal(amount: number, period: Period, fx: number | null): number | null {
  if (!fx) return null;
  const annual = period === "monthly" ? amount * 12 : amount;
  return annual / 365 / fx;
}

/**
 * The same income expressed as US dollars of buying power per month.
 * International dollars are anchored to US prices (US PPP = 1), so an intl$/day
 * figure is already US$/day of buying power; we just scale to a month.
 */
export function usMonthlyBuyingPower(amount: number, period: Period, ppp2021: number): number {
  return (toDailyIntl(amount, period, ppp2021) * 365) / 12;
}
