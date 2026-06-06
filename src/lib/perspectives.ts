import perspData from "../data/perspectives.json";
import type { CountryData, Mode, WorldData } from "./types";
import { toDailyIntl, toDailyNominal } from "./ppp";
import { formatCurrency } from "./format";
import { ordinal, formatPeople, type RevealData } from "./rank-copy";

interface Country { name: string; median: number; pop: number; pl: number | null }
const COUNTRIES = perspData as Country[]; // sorted by population, desc

const TIDY: Record<string, string> = {
  "United States": "the US", "United Kingdom": "the UK", "Russian Federation": "Russia",
  "Congo, Dem. Rep.": "the DR Congo", "Congo, Rep.": "the Congo", "Egypt, Arab Rep.": "Egypt",
  "Iran, Islamic Rep.": "Iran", "Korea, Rep.": "South Korea", "Venezuela, RB": "Venezuela",
  "Yemen, Rep.": "Yemen", "Lao PDR": "Laos", "Slovak Republic": "Slovakia", "Turkiye": "Türkiye",
  "Kyrgyz Republic": "Kyrgyzstan", "Syrian Arab Republic": "Syria", "Viet Nam": "Vietnam",
  "Gambia, The": "the Gambia", "West Bank and Gaza": "Palestine",
};
const tidy = (n: string) => TIDY[n] ?? n;
const list = (names: string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(names);

// Iconic things, priced in nominal US$ (rough, ~2024; see SOURCES.md). Your income
// is converted at market FX and divided by a local price — the travel-arbitrage fun.
// These are colour, not data: they do not affect the percentile rank.
const GOODS_SMALL = [
  { label: "bowls of phở in Hanoi", usd: 2.0 },
  { label: "plates of biryani in Mumbai", usd: 2.5 },
  { label: "street tacos in Mexico City", usd: 1.1 },
  { label: "Big Macs", usd: 5.7 },
  { label: "flat whites in Melbourne", usd: 3.4 },
  { label: "pints in a London pub", usd: 7.0 },
];
const GOODS_BIG = [
  { label: "nights in a Bali beach villa", usd: 70 },
  { label: "months of rent for a city flat in Lisbon", usd: 1350 },
];

function niceCount(n: number): string {
  const r =
    n >= 10000 ? Math.round(n / 1000) * 1000 :
    n >= 1000 ? Math.round(n / 100) * 100 :
    n >= 100 ? Math.round(n / 10) * 10 :
    Math.round(n);
  return r.toLocaleString("en-US");
}

function quantileAt(cdf: [number, number][], F: number): number {
  let lo = 0, hi = cdf.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cdf[m][1] < F) lo = m; else hi = m; }
  return cdf[lo][0];
}

function earnWorldMedianPhrase(fractionOfDay: number): string {
  const h = fractionOfDay * 24;
  if (h < 0.5) return "in minutes";
  if (h < 1.5) return "before your morning coffee";
  if (h < 4) return "by mid-morning";
  if (h < 8) return "before lunch";
  if (h < 16) return "by dinner";
  return "in under a day";
}

/** Biggest countries whose populations sum to less than `target`, up to 4. */
function countriesUnder(target: number): string[] {
  const out: string[] = [];
  let sum = 0;
  for (const c of COUNTRIES) {
    if (out.length >= 4) break;
    if (sum + c.pop <= target) { out.push(tidy(c.name)); sum += c.pop; }
  }
  return out;
}

const POOR = [
  "Madagascar", "Malawi", "Burundi", "Mozambique", "Niger", "Ethiopia",
  "Nepal", "Uganda", "Tanzania", "Rwanda", "Congo, Dem. Rep.",
];

/** A pile of data-grounded perspective lines, punchiest first. */
export function buildPerspectives(
  world: WorldData,
  country: CountryData,
  amount: number,
  reveal: RevealData,
  mode: Mode,
): string[] {
  const dailyPpp = toDailyIntl(amount, country.period, country.ppp2021);
  const dailyNom = toDailyNominal(amount, country.period, country.fx);
  const useNom = mode === "nominal" && dailyNom != null;
  const daily = useNom ? dailyNom! : dailyPpp; // current-basis daily value
  const cdf = useNom ? world.cdfNom : world.cdf;
  // a country's typical income, in the current basis (× price level if nominal)
  const cMed = (c: Country): number | null => (useNom ? (c.pl != null ? c.median * c.pl : null) : c.median);

  const peopleBelow = world.worldPopulation * (1 - reveal.globalTop / 100);
  const peopleAbove = Math.max(1, world.worldPopulation - peopleBelow);
  const gp = reveal.globalPercentile;
  const lp = reveal.localPercentile;
  const out: string[] = [];

  // years a poor country's typical person would need to earn your year
  for (const name of POOR) {
    const c = COUNTRIES.find((x) => x.name === name);
    const m = c ? cMed(c) : null;
    if (c && m) {
      const years = Math.round(daily / m);
      if (years >= 4) { out.push(`someone in ${tidy(name)} would need ${years} years to make what you make in one.`); break; }
    }
  }

  // countries out-earned (typical person)
  const meds = COUNTRIES.map(cMed);
  const total = meds.filter((m) => m != null).length;
  const n = meds.filter((m) => m != null && m < daily).length;
  if (n === total && total > 0) out.push("you out-earn the average person in every single country.");
  else if (n > 1) out.push(`you out-earn the average person in ${n} of ${total} countries.`);

  // billions, made tangible as named countries (population-based)
  const names = countriesUnder(peopleBelow);
  if (names.length >= 2) out.push(`more people live on less than you than live in ${list(names)}. combined.`);

  // ratio below : above
  const ratio = Math.round(peopleBelow / peopleAbove);
  if (ratio >= 3) out.push(`for every 1 person who out-earns you, about ${ratio.toLocaleString("en-US")} dont.`);

  // stadium of 50,000 strangers
  const stadium = Math.round(50000 * (1 - reveal.globalTop / 100));
  if (stadium >= 25000) out.push(`stick 50,000 random people in a stadium. you out-earn about ${stadium.toLocaleString("en-US")} of them.`);

  // half the world reality check (in the current basis)
  const wm = quantileAt(cdf, 0.5);
  if (daily > wm * 1.6) out.push(`half the world lives on under $${Math.round(wm)} a day. you make that ${earnWorldMedianPhrase(wm / daily)}.`);

  // relatable goods (always travel-arbitrage: income at market FX ÷ a local price)
  if (country.fx) {
    const monthlyUsd = (country.period === "monthly" ? amount : amount / 12) / country.fx;
    const small = GOODS_SMALL.map((g) => ({ g, c: monthlyUsd / g.usd })).find((x) => x.c >= 120 && x.c <= 400000);
    if (small) out.push(`your monthly pay is about ${niceCount(small.c)} ${small.g.label}.`);
    const big = GOODS_BIG.map((g) => ({ g, c: monthlyUsd / g.usd })).find((x) => x.c >= 1.5 && x.c <= 90);
    if (big) out.push(`thats about ${Math.round(big.c)} ${big.g.label}. every month.`);
  }

  // local × multiple in your own country (currency-invariant — always PPP)
  const ownMedian = COUNTRIES.find((c) => c.name === country.name)?.median;
  if (ownMedian && dailyPpp / ownMedian >= 2) out.push(`thats about ${Math.round(dailyPpp / ownMedian)}x the typical income where you live.`);

  // world-of-100
  out.push(`if the world was 100 people, ${gp} would have less than you.`);

  // local vs global flip (the thesis)
  if (lp <= gp - 4) out.push(`at home youre ${ordinal(lp)}. on Earth, youre ${ordinal(gp)}. your feed lied to you.`);
  else out.push(`in ${tidy(country.name)} youre ${ordinal(lp)}. on Earth, youre ${ordinal(gp)}.`);

  // the global top-1% line, in your own currency and current basis
  const t1 = quantileAt(cdf, 0.99);
  const t1Local = formatCurrency(useNom ? t1 * 365 * (country.fx as number) : t1 * 365 * country.ppp2021, country.currency);
  out.push(daily >= t1
    ? `youre inside the global top 1%. it kicks in around ${t1Local} a year.`
    : `the global top 1% starts around ${t1Local} a year.`);

  return out;
}

/** Global-only perspectives for a shared /r/N result page (no income known). */
export function globalPerspectives(world: WorldData, bucket: number): string[] {
  const peopleBelow = world.worldPopulation * (1 - bucket / 100);
  const peopleAbove = Math.max(1, world.worldPopulation - peopleBelow);
  const out: string[] = [];
  out.push(`if the world was 100 people, ${Math.max(1, 100 - bucket)} would have less.`);
  const names = countriesUnder(peopleBelow);
  if (names.length >= 2) out.push(`thats more people than live in ${list(names)}. combined.`);
  const ratio = Math.round(peopleBelow / peopleAbove);
  if (ratio >= 3) out.push(`for every 1 person who out-earns them, about ${ratio.toLocaleString("en-US")} dont.`);
  out.push(`~${formatPeople(peopleBelow)} people live on less.`);
  return out;
}
