import type { CountryData, Mode, WorldData } from "./types";
import { globalTopPercent, localTopPercent } from "./percentile";
import { toDailyIntl, toDailyNominal, usMonthlyBuyingPower } from "./ppp";
import { formatUsd } from "./format";

/** Everything the reveal + share card need, derived once from an income. */
export interface RevealData {
  /** Precise global top %, e.g. 0.72. */
  globalTop: number;
  /** Display label: "7%", "0.7%", or floored "0.1%". */
  globalTopLabel: string;
  /** Integer 1..99 for the /r/<bucket> result path + OG image. */
  globalBucket: number;
  /** Integer percentile 1..99 for the contrast line. */
  globalPercentile: number;
  localTop: number;
  localPercentile: number;
  /** "7.5 billion" / "120 million". */
  peopleBelowLabel: string;
  /** US$/month of PPP buying power. */
  usMonthly: number;
  /** US$/year at market exchange rates. */
  usAnnualNominal: number;
  /** Whether the contextual cross-basis line is worth showing. */
  showBuyingPower: boolean;
}

export function computeReveal(world: WorldData, country: CountryData, amount: number, mode: Mode): RevealData {
  const dailyPpp = toDailyIntl(amount, country.period, country.ppp2021);
  const dailyNom = toDailyNominal(amount, country.period, country.fx);
  // Global rank uses the chosen basis; local rank is currency-invariant (PPP).
  const useNom = mode === "nominal" && dailyNom != null;
  const globalTop = globalTopPercent(useNom ? world.cdfNom : world.cdf, useNom ? dailyNom! : dailyPpp);
  const localTop = localTopPercent(country, dailyPpp);
  const peopleBelow = world.worldPopulation * (1 - globalTop / 100);
  return {
    globalTop,
    globalTopLabel: formatTopPercent(globalTop),
    globalBucket: topToBucket(globalTop),
    globalPercentile: topToPercentile(globalTop),
    localTop,
    localPercentile: topToPercentile(localTop),
    peopleBelowLabel: formatPeople(peopleBelow),
    usMonthly: usMonthlyBuyingPower(amount, country.period, country.ppp2021),
    usAnnualNominal: (dailyNom ?? dailyPpp) * 365,
    showBuyingPower: country.priceLevel != null && Math.abs(country.priceLevel - 1) > 0.15,
  };
}

/** "top %": integer at/above 1, one decimal in (0.1, 1), floored at 0.1. */
export function formatTopPercent(top: number): string {
  if (top >= 1) return `${Math.round(top)}%`;
  if (top >= 0.1) return `${top.toFixed(1)}%`;
  return "0.1%";
}

export function topToBucket(top: number): number {
  return Math.min(99, Math.max(1, Math.round(top)));
}

export function topToPercentile(top: number): number {
  return Math.min(99, Math.max(1, Math.round(100 - top)));
}

export function formatPeople(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} million`;
  return Math.round(n).toLocaleString("en-US");
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

// ── Reveal sentences (reused by the page and the share/OG card) ────────────

export function heroLine(r: RevealData): string {
  return `global top ${r.globalTopLabel}`;
}

export function peopleLine(r: RevealData): string {
  return `More than ~${r.peopleBelowLabel} people live on less.`;
}

export function buyingPowerLine(r: RevealData, mode: Mode): string | null {
  if (!r.showBuyingPower) return null;
  // Show the *other* basis as context for the current one.
  return mode === "nominal"
    ? `in local prices thats about ${formatUsd(r.usMonthly)}/month of US buying power.`
    : `at market rates thats about ${formatUsd(r.usAnnualNominal)}/year in US dollars.`;
}

export function contrastLine(r: RevealData): string {
  return `At home you're ${ordinal(r.localPercentile)} · on Earth you're ${ordinal(r.globalPercentile)}.`;
}
