/**
 * build-data.ts — Income Rank data pipeline (ADR-0001).
 *
 * Fetches World Bank PIP percentiles (100 bins/country, 2021 PPP), PIP 2021 PPP
 * factors, current population, country names, and currencies; emits static JSON:
 *
 *   src/data/world.json            pooled population-weighted world CDF
 *   src/data/countries/<ISO3>.json per-country inverse-CDF + Pareto tail + meta
 *   src/data/countries.index.json  selectable country list for the picker
 *
 * Method: each country's CDF is built from its percentile THRESHOLDS (the PIP
 * `quantile` column) with a Pareto tail fit on its well-measured upper-middle
 * (survey data top-codes the rich, so the extreme tail must be extrapolated,
 * not read off). The world CDF is the population-weighted MIXTURE of country
 * CDFs: F(x) = Σ wᵢ·Fᵢ(x). Validated against published global anchors (GWWC /
 * Our World in Data, same PIP 2021 base) in verify().
 *
 * Run: `bun run data`. Downloads cached under scripts/.cache (gitignored).
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const CACHE = `${ROOT}scripts/.cache`;
const OUT = `${ROOT}src/data`; //         world.json + index: build-time imports
const PUB = `${ROOT}public/data/countries`; // per-country: fetched client-side

const SRC = {
  csv: "https://datacatalogfiles.worldbank.org/ddh-published/0063646/DR0090357/world_100bin_revised.csv",
  ppp: "https://api.worldbank.org/pip/v1/aux?table=ppp&format=json",
  pop: "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?mrv=1&per_page=400&format=json",
  // official exchange rate (LCU per US$, 2021) → price level = PPP / FX (US=1).
  // Drives the contextual "buying power in US terms" line: show where cheaper.
  fx: "https://api.worldbank.org/v2/country/all/indicator/PA.NUS.FCRF?date=2021&per_page=400&format=json",
  meta: "https://api.worldbank.org/v2/country?per_page=400&format=json",
  currency: "https://restcountries.com/v3.1/all?fields=cca3,currencies",
};

// Core 5 get hand-tuned native defaults (currency + period). (CONTEXT.md.)
const CORE5: Record<string, { currency: string; period: "annual" | "monthly" }> = {
  USA: { currency: "USD", period: "annual" },
  IND: { currency: "INR", period: "monthly" },
  GBR: { currency: "GBP", period: "annual" },
  DEU: { currency: "EUR", period: "monthly" },
  BRA: { currency: "BRL", period: "monthly" },
};

// Tail handling. Survey data is reliable through the upper-middle but top-codes
// the rich, so we fit a Pareto on [FIT_LO, TAIL_START] and extrapolate above it.
const TAIL_START = 0.9; // CDF fraction where the Pareto tail takes over
const FIT_LO = 0.7; //     fit α on the well-measured [0.70, 0.90] band
// Global top-tail Pareto-Lorenz α ≈ 2 (WID / GWWC). Floor the per-country fit
// so a few fat-tailed surveys don't dominate the pooled extreme tail.
const ALPHA_CLAMP: [number, number] = [1.8, 3.2];

const round = (n: number, sig = 4) => (n === 0 || !isFinite(n) ? 0 : Number(n.toPrecision(sig)));

// ── WID-calibrated extreme tail ──────────────────────────────────────────────
// Above ~p99, household surveys top-code the rich, so the pooled mixture's tail is
// an unanchored extrapolation (it ran +11%/+34% hot at p99.5/p99.9 vs anchors). We
// replace the WORLD tail above p99 with the top-tail SHAPE measured by the World
// Inequality Database (WID.world) for World pre-tax income, 2021 PPP — importing
// only its scale-free curvature, NOT its dollar levels (WID is per-ADULT pre-tax
// NATIONAL income, a structurally higher, different basis than PIP per-capita
// survey welfare), anchored at the survey's own p99 level. The result is a fatter,
// steepening tail (α drops toward the very top) — less flattering for the ultra-rich.
// Source: WID_data_WO.csv, variable tptincj992 (per-adult pre-tax threshold), 2021
// PPP$ — https://wid.world/bulk_download/WID_data_WO.csv (verified 2026-06-05).
const WID_WO_2021 = { p90: 61491, p99: 215662, p999: 781563, p9999: 3078473 };
// Per-segment Pareto α over each 10×-rarer slice: α = ln10 / ln(thresholdRatio).
const WID_A2 = Math.log(10) / Math.log(WID_WO_2021.p999 / WID_WO_2021.p99); //  p99→p99.9  ≈ 1.79
const WID_A3 = Math.log(10) / Math.log(WID_WO_2021.p9999 / WID_WO_2021.p999); // p99.9→     ≈ 1.68

/** F(x) for the WID-shaped tail above x99 (the basis's own 99th-percentile level). */
function widTailF(x: number, x99: number): number {
  const x999 = x99 * Math.pow(10, 1 / WID_A2);
  const x9999 = x999 * Math.pow(10, 1 / WID_A3);
  if (x <= x999) return 1 - 0.01 * Math.pow(x99 / x, WID_A2);
  if (x <= x9999) return 1 - 0.001 * Math.pow(x999 / x, WID_A3);
  return 1 - 0.0001 * Math.pow(x9999 / x, WID_A3);
}

/** Splice the WID tail onto a mixture CDF above its 99th percentile. */
function spliceWidTail(cdf: [number, number][]): [number, number][] {
  let x99 = cdf[cdf.length - 1][0];
  for (let i = 1; i < cdf.length; i++) {
    if (cdf[i][1] >= 0.99) {
      const [x0, f0] = cdf[i - 1], [x1, f1] = cdf[i];
      x99 = x0 + ((0.99 - f0) / (f1 - f0)) * (x1 - x0);
      break;
    }
  }
  return cdf.map(([x, f]): [number, number] => (x >= x99 ? [round(x, 4), round(Math.min(widTailF(x, x99), 1), 6)] : [x, f]));
}

async function fetchCached(url: string, name: string): Promise<string> {
  const path = `${CACHE}/${name}`;
  if (existsSync(path)) return readFile(path, "utf8");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const text = await res.text();
  await writeFile(path, text);
  console.log(`  ↓ ${name} (${(text.length / 1e6).toFixed(1)} MB)`);
  return text;
}

// ── A country's distribution: ascending support points (welfare, F) up to
//    TAIL_START, plus a Pareto tail {xmin, alpha} governing above it. ────────
type Dist = { supW: number[]; supF: number[]; xmin: number; alpha: number };

/** Fit Pareto α via OLS of ln(1−F) on ln(w) over the fit band; α = −slope. */
function fitAlpha(pts: { w: number; F: number }[]): number {
  const band = pts.filter((p) => p.F >= FIT_LO && p.F <= TAIL_START && p.w > 0 && p.F < 1);
  if (band.length < 3) return 2.0;
  const xs = band.map((p) => Math.log(p.w));
  const ys = band.map((p) => Math.log(1 - p.F));
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const a = -(num / den);
  return Math.min(ALPHA_CLAMP[1], Math.max(ALPHA_CLAMP[0], a));
}

/** Build a Dist from ascending (welfare, F) support points. */
function buildDist(pts: { w: number; F: number }[]): Dist {
  pts = pts.filter((p) => p.w > 0).sort((a, b) => a.F - b.F);
  const xmin = interp(pts.map((p) => p.F), pts.map((p) => p.w), TAIL_START);
  const alpha = fitAlpha(pts);
  const body = pts.filter((p) => p.F <= TAIL_START);
  return { supW: body.map((p) => p.w), supF: body.map((p) => p.F), xmin, alpha };
}

/** F(x) for a Dist: empirical below xmin, Pareto above. */
function distAt(d: Dist, x: number): number {
  if (x >= d.xmin) return 1 - (1 - TAIL_START) * Math.pow(d.xmin / x, d.alpha);
  if (x <= d.supW[0]) return d.supF[0] * (x / d.supW[0]); // toward 0 at x→0
  return interp(d.supW, d.supF, x);
}

/** Linear interpolation of ys at query q over ascending xs. */
function interp(xs: number[], ys: number[], q: number): number {
  if (q <= xs[0]) return ys[0];
  if (q >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < q) lo = m; else hi = m; }
  const t = (q - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + t * (ys[hi] - ys[lo]);
}

/** Inverse: welfare at fraction F, for a Dist (used to resample/serialize). */
function quantile(d: Dist, F: number): number {
  if (F >= TAIL_START) return d.xmin * Math.pow((1 - TAIL_START) / (1 - F), 1 / d.alpha);
  return interp(d.supF, d.supW, F);
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  await mkdir(PUB, { recursive: true });
  console.log("Income Rank — data pipeline\n");

  const [csvText, pppJson, popJson, fxJson, metaJson, curJson] = await Promise.all([
    fetchCached(SRC.csv, "world_100bin_revised.csv"),
    fetchCached(SRC.ppp, "pip_ppp_2021.json"),
    fetchCached(SRC.pop, "wb_population.json"),
    fetchCached(SRC.fx, "wb_fx_2021.json"),
    fetchCached(SRC.meta, "wb_country_meta.json"),
    fetchCached(SRC.currency, "restcountries_currencies.json"),
  ]);

  const ppp = new Map<string, number>();
  for (const r of JSON.parse(pppJson) as any[])
    if (r.year === "2021" && r.data_level === "national" && r.value != null) ppp.set(r.country_code, r.value);

  const pop = new Map<string, number>();
  for (const r of (JSON.parse(popJson)[1] ?? []) as any[]) if (r.value != null) pop.set(r.countryiso3code, r.value);

  const fx = new Map<string, number>(); // official exchange rate, LCU per US$, 2021
  for (const r of (JSON.parse(fxJson)[1] ?? []) as any[]) if (r.value) fx.set(r.countryiso3code, r.value);

  const names = new Map<string, { name: string; iso2: string }>();
  for (const r of (JSON.parse(metaJson)[1] ?? []) as any[])
    if (r.region?.value && r.region.value !== "Aggregates") names.set(r.id, { name: r.name, iso2: r.iso2Code });

  const currency = new Map<string, string>();
  for (const c of JSON.parse(curJson) as any[]) {
    const codes = c.currencies ? Object.keys(c.currencies) : [];
    if (c.cca3 && codes.length) currency.set(c.cca3, codes.sort()[0]);
  }

  // ── parse CSV: choose latest national survey (else pool urban+rural) ─────
  console.log("\nParsing percentiles CSV…");
  const lines = csvText.split("\n");
  const head = lines[0].split(",");
  const iCC = head.indexOf("country_code"), iYear = head.indexOf("year"), iLvl = head.indexOf("reporting_level"),
    iWel = head.indexOf("welfare_type"), iAvg = head.indexOf("avg_welfare"), iShare = head.indexOf("pop_share"),
    iPct = head.indexOf("percentile"), iQ = head.indexOf("quantile");

  const avail = new Map<string, Map<string, number>>();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = lines[i].split(",");
    let m = avail.get(f[iCC]); if (!m) avail.set(f[iCC], (m = new Map()));
    const y = +f[iYear]; if (!m.has(f[iLvl]) || y > m.get(f[iLvl])!) m.set(f[iLvl], y);
  }
  const chosen = new Map<string, { levels: Set<string>; year: number }>();
  for (const [cc, m] of avail) {
    if (m.has("national")) chosen.set(cc, { levels: new Set(["national"]), year: m.get("national")! });
    else { const year = Math.max(...m.values()); chosen.set(cc, { levels: new Set([...m].filter(([, y]) => y === year).map(([l]) => l)), year }); }
  }

  // collect rows for the chosen selection
  type Row = { pct: number; q: number; avg: number; share: number; lvl: string };
  const rows = new Map<string, Row[]>();
  const welfareType = new Map<string, string>();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = lines[i].split(",");
    const sel = chosen.get(f[iCC]);
    if (!sel || +f[iYear] !== sel.year || !sel.levels.has(f[iLvl])) continue;
    let a = rows.get(f[iCC]); if (!a) rows.set(f[iCC], (a = []));
    a.push({ pct: +f[iPct], q: +f[iQ], avg: +f[iAvg], share: +f[iShare], lvl: f[iLvl] });
    welfareType.set(f[iCC], f[iWel]);
  }

  // ── build per-country Dist + write files; collect world mixture ─────────
  const countries: { cc: string; dist: Dist; w: number; pl: number | null }[] = [];
  // NOTE: this is the COVERED population — the sum of the ~171 countries with a PIP
  // distribution (~7.9B), not the true world total (~8.1B). Copy that frames it as
  // "the world" means this covered set. (Rename to coveredPopulation in a future pass.)
  let worldPop = 0;
  const index: any[] = [];
  // {name, median daily intl$, population, price level} per country — perspectives.
  const persp: { name: string; median: number; pop: number; pl: number | null }[] = [];
  // compact percentile anchors per country — powers "where you'd be rich".
  const whereData: any[] = [];
  let nFiles = 0;

  for (const [cc, rs] of rows) {
    const cpop = pop.get(cc), meta = names.get(cc);
    if (!cpop || !meta) continue;

    // support points (welfare, cumulative F)
    let pts: { w: number; F: number }[];
    if (rs.every((r) => r.lvl === "national")) {
      // national: use thresholds q at F = pct/100 (pct 1..99); drop open p100
      pts = rs.filter((r) => r.pct <= 99 && r.q > 0).map((r) => ({ w: r.q, F: r.pct / 100 }));
    } else {
      // pooled urban+rural: sort bins by mean welfare, cumulative pop_share
      const s = [...rs].sort((a, b) => a.avg - b.avg);
      const tot = s.reduce((acc, r) => acc + r.share, 0);
      let cum = 0; pts = s.map((r) => { cum += r.share; return { w: r.avg, F: cum / tot }; });
    }
    if (pts.length < 10) continue;
    const dist = buildDist(pts);
    // price level (PPP/FX) — re-expresses the PPP distribution in market-FX US$.
    const plc = ppp.get(cc) && fx.get(cc) ? ppp.get(cc)! / fx.get(cc)! : null;
    countries.push({ cc, dist, w: cpop, pl: plc });
    worldPop += cpop;
    persp.push({ name: meta.name, median: round(quantile(dist, 0.5), 3), pop: cpop, pl: plc != null ? round(plc, 3) : null });
    whereData.push({
      name: meta.name, iso2: meta.iso2, pop: cpop,
      a: [0.5, 0.75, 0.9, 0.95, 0.99].map((f) => round(quantile(dist, f), 3)),
      xmin: round(dist.xmin, 3), alpha: round(dist.alpha, 3),
      pl: plc != null ? round(plc, 3) : null,
    });

    // serialize selectable countries (need currency + ppp to take input)
    const cur = CORE5[cc]?.currency ?? currency.get(cc);
    const factor = ppp.get(cc);
    if (cur && factor) {
      const distOut = Array.from({ length: 99 }, (_, k) => round(quantile(dist, (k + 1) / 100), 4));
      await writeFile(`${PUB}/${cc}.json`, JSON.stringify({
        iso: cc, iso2: meta.iso2, name: meta.name,
        currency: cur, period: CORE5[cc]?.period ?? "annual", core5: !!CORE5[cc],
        welfareType: welfareType.get(cc), year: chosen.get(cc)!.year, ppp2021: round(factor, 6),
        priceLevel: fx.get(cc) ? round(factor / fx.get(cc)!, 3) : null,
        fx: fx.get(cc) ? round(fx.get(cc)!, 4) : null,
        dist: distOut, tail: { fromF: TAIL_START, xmin: round(dist.xmin, 4), alpha: round(dist.alpha, 4) },
      }));
      nFiles++;
      index.push({ iso: cc, iso2: meta.iso2, name: meta.name, currency: cur, period: CORE5[cc]?.period ?? "annual", core5: !!CORE5[cc] });
    }
  }

  // ── world CDF = population-weighted mixture, evaluated on a log grid ─────
  const GRID = 1600, XMINg = 0.2, XMAXg = 6000;
  const grid: number[] = [];
  for (let k = 0; k < GRID; k++) grid.push(XMINg * Math.pow(XMAXg / XMINg, k / (GRID - 1)));
  const cdfMix: [number, number][] = grid.map((x) => {
    let F = 0;
    for (const c of countries) F += c.w * distAt(c.dist, x);
    return [round(x, 4), round(Math.min(F / worldPop, 1), 6)];
  });

  // Nominal (market-FX US$) world CDF — the DEFAULT basis. Each country's
  // distribution re-expressed in US dollars (÷ price level), pooled by pop.
  const NXMIN = 0.05, NXMAX = 8000;
  let wNom = 0;
  for (const c of countries) if (c.pl != null) wNom += c.w;
  const cdfNomMix: [number, number][] = Array.from({ length: GRID }, (_, k) => {
    const x = NXMIN * Math.pow(NXMAX / NXMIN, k / (GRID - 1));
    let F = 0;
    for (const c of countries) if (c.pl != null) F += c.w * distAt(c.dist, x / c.pl);
    return [round(x, 4), round(Math.min(F / wNom, 1), 6)];
  });

  // Replace the unanchored survey tail above p99 with WID-measured top-tail shape.
  const cdf = spliceWidTail(cdfMix);
  const cdfNom = spliceWidTail(cdfNomMix);

  // worldPopulation = true global total (World Bank WLD aggregate); coveredPopulation
  // = sum of the countries with a PIP distribution (used to BUILD the CDF). People-
  // counts use worldPopulation, treating the ~3% uncovered (mostly small/poor states)
  // as following the curve at a given x — honest for high earners, where ~all are below.
  const worldTrueTotal = pop.get("WLD") ?? Math.round(worldPop);
  await writeFile(`${OUT}/world.json`, JSON.stringify({
    unit: "intl$2021/day",
    worldPopulation: Math.round(worldTrueTotal),
    coveredPopulation: Math.round(worldPop),
    countries: countries.length,
    cdf, //    PPP (purchasing power) — [welfare, fractionBelow] ascending
    cdfNom, // nominal market-FX US$ — same shape, the default basis
    generated: { source: "World Bank PIP 0063646 (2021 PPP); mixture of country CDFs; tail >p99 shaped to WID.world WO 2021", tailStart: TAIL_START },
  }));

  index.sort((a, b) => (b.core5 ? 1 : 0) - (a.core5 ? 1 : 0) || a.name.localeCompare(b.name));
  await writeFile(`${OUT}/countries.index.json`, JSON.stringify(index));

  persp.sort((a, b) => b.pop - a.pop);
  await writeFile(`${OUT}/perspectives.json`, JSON.stringify(persp));

  whereData.sort((a, b) => b.pop - a.pop);
  await writeFile(`${OUT}/where.json`, JSON.stringify(whereData));

  console.log(`\n✓ world.json: ${cdf.length}-pt mixture CDF · world pop ${(worldPop / 1e9).toFixed(2)}B · ${countries.length} countries`);
  console.log(`✓ ${nFiles} selectable country files + index`);

  await verify();
}

// ── verification against published global anchors (GWWC / OWID, PIP 2021) ──
async function verify() {
  const world = JSON.parse(await readFile(`${OUT}/world.json`, "utf8"));
  const cdf: [number, number][] = world.cdf;
  const wAtF = (F: number) => {
    if (F <= cdf[0][1]) return cdf[0][0];
    if (F >= cdf[cdf.length - 1][1]) return cdf[cdf.length - 1][0];
    let lo = 0, hi = cdf.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cdf[m][1] < F) lo = m; else hi = m; }
    const t = (F - cdf[lo][1]) / (cdf[hi][1] - cdf[lo][1]);
    return cdf[lo][0] + t * (cdf[hi][0] - cdf[lo][0]);
  };
  // Body (≤ p99): published OWID / GWWC anchors on PIP's per-capita-welfare basis.
  const anchors: [number, number, string][] = [
    [0.5, 8.5, "median"], [0.75, 22, "top25%"], [0.9, 52.5, "top10%"], [0.95, 79.5, "top5%"],
    [0.98, 122, "top2%"], [0.99, 162, "top1%"],
  ];
  console.log("\n── world CDF body vs published anchors ($/day, 2021 PPP · OWID/GWWC) ──");
  let worst = 0;
  for (const [F, a, label] of anchors) {
    const mine = wAtF(F); const err = (mine - a) / a;
    worst = Math.max(worst, Math.abs(err));
    console.log(`  ${label.padEnd(8)} mine ${mine.toFixed(1).padStart(7)}  anchor ${String(a).padStart(6)}  (${(err * 100 >= 0 ? "+" : "") + (err * 100).toFixed(0)}%)`);
  }
  console.log(`  worst abs error (body ≤ p99): ${(worst * 100).toFixed(0)}%`);

  // Tail (> p99): shape imported from WID.world. Surveys top-code the rich, so no
  // agency publishes a global top-0.1% level on this basis; instead verify the
  // implied per-segment Pareto α matches WID's measured curvature (α = ln10/ln ratio).
  const aImplied = (lo: number, hi: number) => Math.log(10) / Math.log(wAtF(hi) / wAtF(lo));
  console.log("\n── world tail shape vs WID.world WO 2021 (Pareto α) ──");
  console.log(`  p99→p99.9    mine ${aImplied(0.99, 0.999).toFixed(2)}   WID 1.79`);
  console.log(`  p99.9→p99.99 mine ${aImplied(0.999, 0.9999).toFixed(2)}   WID 1.68`);
  console.log(`  implied top0.1% threshold: $${wAtF(0.999).toFixed(0)}/day (survey-basis level, WID-shaped)`);

  const globalTop = (daily: number) => {
    if (daily <= cdf[0][0]) return 100;
    if (daily >= cdf[cdf.length - 1][0]) return 0.001;
    let lo = 0, hi = cdf.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cdf[m][0] < daily) lo = m; else hi = m; }
    const t = (daily - cdf[lo][0]) / (cdf[hi][0] - cdf[lo][0]);
    return (1 - (cdf[lo][1] + t * (cdf[hi][1] - cdf[lo][1]))) * 100;
  };
  const localTop = (c: any, daily: number) => {
    const d: number[] = c.dist;
    if (daily >= c.tail.xmin) return (1 - TAIL_START) * Math.pow(c.tail.xmin / daily, c.tail.alpha) * 100;
    if (daily <= d[0]) return 99.5;
    let lo = 0, hi = d.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (d[m] < daily) lo = m; else hi = m; }
    const t = (daily - d[lo]) / (d[hi] - d[lo]);
    return (1 - (lo + 1 + t) / 100) * 100;
  };
  const cases: [string, number, "annual" | "monthly"][] = [
    ["USA", 30000, "annual"], ["USA", 72000, "annual"], ["USA", 200000, "annual"], ["USA", 500000, "annual"],
    ["IND", 30000, "monthly"], ["IND", 80000, "monthly"], ["IND", 300000, "monthly"],
    ["GBR", 45000, "annual"], ["DEU", 5000, "monthly"], ["BRA", 5000, "monthly"],
  ];
  console.log("\n── sample reveals (global top % · local top %) ──");
  for (const [iso, amt, period] of cases) {
    const c = JSON.parse(await readFile(`${PUB}/${iso}.json`, "utf8"));
    const daily = (period === "monthly" ? amt * 12 : amt) / 365 / c.ppp2021;
    const g = globalTop(daily), l = localTop(c, daily);
    const f = (v: number) => (v < 1 ? v.toFixed(2) : v.toFixed(1));
    console.log(`  ${iso} ${(period === "monthly" ? amt + "/mo" : amt + "/yr").padEnd(9)} → $${daily.toFixed(0).padStart(4)}/day · global top ${f(g)}% · local top ${f(l)}%`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
