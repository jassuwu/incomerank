import whereData from "../data/where.json";
import type { CountryData } from "./types";
import { toDailyIntl, toDailyNominal } from "./ppp";

interface WEntry { name: string; iso2: string; pop: number; a: number[]; xmin: number; alpha: number; pl: number | null }
const W = whereData as WEntry[];
const TAIL_START = 0.9;
const ANCHOR_F = [0.5, 0.75, 0.9, 0.95, 0.99];

export type WhereMode = "ppp" | "nominal";

// A curated atlas of places people know or dream of — spread across every region.
const NOTABLE = [
  "US", "GB", "DE", "CH", "SE", "AU", // the West, Europe, Oceania
  "AE", //                               the Gulf
  "JP", "KR", "CN", "TH", "VN", //       East & Southeast Asia
  "TR", "RU", //                         Eurasia
  "BR", "MX", //                         Latin America
  "IN", "NG", //                         South Asia & Africa
];

const SHORT: Record<string, string> = {
  "Russian Federation": "Russia", "Korea, Rep.": "South Korea", "Egypt, Arab Rep.": "Egypt",
  "Iran, Islamic Rep.": "Iran", "Viet Nam": "Vietnam", "Turkiye": "Türkiye",
  "United Arab Emirates": "the UAE", "United Kingdom": "the UK", "United States": "the US",
};
const short = (n: string) => SHORT[n] ?? n;

const flag = (iso2: string) =>
  iso2.length === 2
    ? String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)))
    : "";

/**
 * Estimate the "top X%" your `value` would land in within one country.
 * `scale` re-expresses the country's (PPP) distribution into another unit —
 * 1 for the PPP comparison, the country's price level for the market-FX one.
 */
function topIn(e: WEntry, value: number, scale: number): number {
  const xmin = e.xmin * scale;
  let top: number;
  if (value >= xmin) {
    top = (1 - TAIL_START) * Math.pow(xmin / value, e.alpha) * 100; // Pareto above p90
  } else if (value <= e.a[0] * scale) {
    top = 100 - (value / (e.a[0] * scale)) * 50;
  } else {
    top = 50;
    for (let i = 0; i < 2; i++) {
      const lo = e.a[i] * scale, hi = e.a[i + 1] * scale;
      if (value <= hi) {
        const t = (value - lo) / (hi - lo);
        top = (1 - (ANCHOR_F[i] + t * (ANCHOR_F[i + 1] - ANCHOR_F[i]))) * 100;
        break;
      }
    }
  }
  return Math.min(100, Math.max(0.01, top));
}

export interface WhereRow { name: string; flag: string; top: number; iso2: string }

/** Is the market-FX ("exchange rate") comparison available for this country? */
export function nominalAvailable(country: CountryData): boolean {
  return (country.priceLevel ?? (country.fx ? country.ppp2021 / country.fx : null)) != null;
}

export function whereYoudRank(country: CountryData, amount: number, mode: WhereMode): {
  rows: WhereRow[];
  top1Count: number;
  total: number;
} {
  const dailyPpp = toDailyIntl(amount, country.period, country.ppp2021, country.cpiRatio ?? 1);
  const dailyNom = toDailyNominal(amount, country.period, country.fx);
  const nominal = mode === "nominal" && dailyNom != null;

  // In nominal mode your income is today's market-FX US$ (income ÷ current FX), and
  // each country's 2021-PPP distribution is re-expressed in the same US$ (× its price
  // level, which already folds in that country's inflation and current exchange rate).
  const userVal = nominal ? dailyNom! : dailyPpp;
  const rank = (e: WEntry) => topIn(e, userVal, nominal ? (e.pl as number) : 1);

  const set = new Set(NOTABLE);
  set.add(country.iso2);
  const all: WhereRow[] = [];
  for (const iso2 of set) {
    const e = W.find((x) => x.iso2 === iso2);
    if (!e || (nominal && e.pl == null)) continue;
    all.push({ name: short(e.name), flag: flag(iso2), top: rank(e), iso2 });
  }
  // show the whole curated atlas + home, where-you're-richest (lowest top %) first
  const rows = all.sort((a, b) => a.top - b.top);

  const rankable = W.filter((e) => !(nominal && e.pl == null));
  const top1Count = rankable.reduce((n, e) => n + (rank(e) <= 1 ? 1 : 0), 0);
  return { rows, top1Count, total: rankable.length };
}
