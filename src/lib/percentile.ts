import type { CountryData } from "./types";

// Must match scripts/build-data.ts TAIL_START (the fraction at which each
// country's Pareto tail takes over). Kept in sync deliberately.
const TAIL_START = 0.9;

/**
 * Global "top X%": the percent of humanity whose welfare is at or above the
 * given daily value, looked up in the supplied world CDF (PPP or nominal).
 * Lower = richer. The value's unit must match the CDF's basis.
 */
export function globalTopPercent(cdf: [number, number][], value: number): number {
  if (value <= cdf[0][0]) return 100;
  if (value >= cdf[cdf.length - 1][0]) return 0.001;
  let lo = 0, hi = cdf.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cdf[m][0] < value) lo = m;
    else hi = m;
  }
  const t = (value - cdf[lo][0]) / (cdf[hi][0] - cdf[lo][0]);
  const F = cdf[lo][1] + t * (cdf[hi][1] - cdf[lo][1]);
  return (1 - Math.min(F, 0.999999)) * 100;
}

/**
 * Local "top X%" within the user's own country. Empirical below the country's
 * Pareto tail start, extrapolated above it (so high earners differentiate).
 */
export function localTopPercent(c: CountryData, dailyIntl: number): number {
  const d = c.dist;
  const tail = c.tail;
  if (dailyIntl >= tail.xmin) {
    return (1 - tail.fromF) * Math.pow(tail.xmin / dailyIntl, tail.alpha) * 100;
  }
  if (dailyIntl <= d[0]) return 99.5;
  let lo = 0, hi = d.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (d[m] < dailyIntl) lo = m;
    else hi = m;
  }
  const t = (dailyIntl - d[lo]) / (d[hi] - d[lo]);
  const F = (lo + 1 + t) / 100; // d[i] is welfare at cumulative fraction (i+1)/100
  return (1 - F) * 100;
}
