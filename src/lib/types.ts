// Shared data shapes, produced by scripts/build-data.ts.

export type Period = "annual" | "monthly";
export type WelfareType = "income" | "consumption";

/** src/data/world.json — pooled population-weighted world distribution. */
export interface WorldData {
  unit: string;
  /** True global total (World Bank WLD); used for "X people live on less" counts. */
  worldPopulation: number;
  /** Sum of the `countries` with a PIP distribution — the population the CDF is built on. */
  coveredPopulation: number;
  countries: number;
  /** PPP basis: [welfareDaily (intl$ 2021), fractionBelow] ascending. */
  cdf: [number, number][];
  /** Nominal market-FX US$ basis (the default), same shape. */
  cdfNom: [number, number][];
}

/** Comparison basis: market exchange rate (default) or purchasing power. */
export type Mode = "nominal" | "ppp";

/** public/data/countries/<ISO3>.json — one country's distribution + meta. */
export interface CountryData {
  iso: string;
  iso2: string;
  name: string;
  currency: string;
  period: Period;
  core5: boolean;
  welfareType: WelfareType;
  year: number;
  /** PIP 2021 PPP conversion factor (LCU per international $). */
  ppp2021: number;
  /** Scale re-expressing an intl$-2021 value in CURRENT nominal US$:
   *  ppp2021 · CPI(2021→fxYear) / fx. Null where FX is unavailable. */
  priceLevel: number | null;
  /** Market exchange rate, local currency per US$, at `fxYear`; null if unavailable. */
  fx: number | null;
  /** Year of the FX (and CPI target) behind the current-nominal re-projection. */
  fxYear?: number | null;
  /** Local CPI inflation 2021→fxYear folded into `priceLevel` (transparency). */
  cpiRatio?: number | null;
  /** 99 welfare thresholds (intl$/day) at F = 1%..99%. */
  dist: number[];
  /** Pareto tail governing above `fromF`. */
  tail: { fromF: number; xmin: number; alpha: number };
}

/** src/data/countries.index.json entry — for the picker. */
export interface CountryIndexEntry {
  iso: string;
  iso2: string;
  name: string;
  currency: string;
  period: Period;
  core5: boolean;
}
