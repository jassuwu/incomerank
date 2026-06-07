/**
 * tower.ts — ASCENT: the elevator with no top floor.
 *
 * Income is altitude on a log axis. All of humanity is a column of dots, densest
 * at the bottom (billions crammed into a few dollars a day) and thinning to a
 * lonely thread in the rich tail. You ride a glass car UP the shaft; the world
 * scrolls down past you; floors are income landmarks. The camera is a pure
 * vertical pan (viewBox y), so type stays crisp at every altitude.
 *
 * Pure + dependency-free: the live reveal, the static /r/N page, the OG card and
 * the reduced-motion fallback all render from the same geometry.
 */

// ── axis: income → world-y (up = richer = more negative y) ───────────────────
export const DECADE = 120; //   world units per 10× of income
export const SHAFT_HALF = 112; // shaft half-width — fills the viewBox (±116) so the
//                                crowd reaches the walls instead of a narrow centre band
export const VIEW_W = 232; //    viewBox width (portrait shaft + thin label margins)
export const VIEW_H = 300; //    viewBox height (~2.5 decades visible)
// The guess phase frames a TALLER window than the ride so the puck can reach the
// poor end of the distribution: 390 world-units (~3.25 decades) from $900/day spans
// global top ~0.1% down to ~top 97% (a 300-unit window bottoms out at only top 56%).
// Keep in sync with the `.ascent.guessing` aspect-ratio in index.astro.
export const GUESS_VIEW_H = 390;
export const CAR_FRAC = 0.54; // the car (your eye-line) sits this far down the frame

export const worldY = (daily: number) => -DECADE * Math.log10(Math.max(daily, 1e-6));
/** viewBox top (y) that puts `daily` at the car line. */
export const camYFor = (daily: number) => worldY(daily) - VIEW_H * CAR_FRAC;

/** Income (height) at fraction-below F, from an ascending [income, F] CDF. */
export function incomeAtF(cdf: [number, number][], F: number): number {
  const n = cdf.length;
  if (F <= cdf[0][1]) return cdf[0][0];
  if (F >= cdf[n - 1][1]) return cdf[n - 1][0];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cdf[m][1] < F) lo = m; else hi = m; }
  const t = (F - cdf[lo][1]) / (cdf[hi][1] - cdf[lo][1]);
  return cdf[lo][0] + t * (cdf[hi][0] - cdf[lo][0]);
}
/** Fraction-below for a daily income (inverse of the above). */
export function fracBelow(cdf: [number, number][], daily: number): number {
  const n = cdf.length;
  if (daily <= cdf[0][0]) return cdf[0][1];
  if (daily >= cdf[n - 1][0]) return cdf[n - 1][1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cdf[m][0] < daily) lo = m; else hi = m; }
  const t = (daily - cdf[lo][0]) / (cdf[hi][0] - cdf[lo][0]);
  return cdf[lo][1] + t * (cdf[hi][1] - cdf[lo][1]);
}

export interface Dot { x: number; y: number }
export interface Floor { daily: number; y: number; label: string; tag: string; kind: "poor" | "mid" | "you" | "rich" | "famous" | "peak" }

// Famous-income ladder for the lonely tail (nominal US$/day, estimated 2025–2026).
// A deliberately INTERNATIONAL yardstick — names recognized across India, Korea,
// Japan, Africa and the West, not just Silicon Valley. Basis is mixed and disclosed:
// ANNUAL EARNINGS ÷ 365 for the creators/athletes/entertainers; year-over-year
// WEALTH GROWTH ÷ 365 for the billionaires (paper wealth, not salary — volatile,
// and in a bad year negative: Ambani's net worth actually fell in 2026, so his rung
// is a representative recent up-year, not 2026). Sources: Forbes (Billionaires 2026,
// Highest-Paid Athletes, Top Creators), Bloomberg Billionaires Index & celebrity
// earnings. See SOURCES.md.
// You blow past every one of them on "keep going" and stop at the ceiling: Elon.
const FAMOUS: Omit<Floor, "y">[] = [
  { daily: 110_000, label: "Shah Rukh Khan", tag: "India · Bollywood · ~$110K/day", kind: "famous" },
  { daily: 233_000, label: "MrBeast", tag: "US · top creator · ~$233K/day", kind: "famous" },
  { daily: 370_000, label: "BTS", tag: "S. Korea · K-pop · ~$370K/day", kind: "famous" },
  { daily: 753_000, label: "Cristiano Ronaldo", tag: "Portugal · football · ~$750K/day", kind: "famous" },
  { daily: 1_100_000, label: "Taylor Swift", tag: "US · pop music · ~$1.1M/day", kind: "famous" },
  { daily: 18_000_000, label: "Aliko Dangote", tag: "Nigeria · Africa's richest · +~$18M/day", kind: "famous" },
  { daily: 30_000_000, label: "Tadashi Yanai", tag: "Japan · Uniqlo · +~$30M/day", kind: "famous" },
  { daily: 50_000_000, label: "Mukesh Ambani", tag: "India · Reliance · +~$50M/day", kind: "famous" },
  { daily: 120_000_000, label: "Jeff Bezos", tag: "US · Amazon · +~$120M/day", kind: "famous" },
  { daily: 1_360_000_000, label: "Elon Musk", tag: "richest person alive · +~$1.4B/day", kind: "peak" },
];
/** The ceiling of the tower — Elon Musk's estimated daily wealth growth. */
export const TOWER_PEAK_DAILY = FAMOUS[FAMOUS.length - 1].daily;
export interface Tower {
  dots: Dot[];
  floors: Floor[];
  you: { daily: number; y: number; frac: number };
  shaftTopY: number; //    y of the highest drawn landmark (the lonely tail)
  shaftBottomY: number; // y of the ground
  dotsTopY: number; //     y above which the data runs out (the empty rich tail begins)
}

const fmtDay = (d: number) =>
  d >= 1000 ? `$${Math.round(d / 1000)}k/day` : d >= 10 ? `$${Math.round(d)}/day` : `$${d.toFixed(2)}/day`;

// deterministic jitter so static frames (OG/SSR) are stable
const jitter = (i: number) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1; // [-1, 1)
};

/**
 * Build the tower for a user income (in the basis of `cdf`). `pop` = world total.
 * `nDots` people-dots are inverse-CDF sampled, so they cluster where billions live.
 */
export function buildTower(cdf: [number, number][], youDaily: number, pop: number, nDots = 2200): Tower {
  const dataTop = cdf[cdf.length - 1][0]; // richest income the survey/tail data covers
  const dots: Dot[] = [];
  for (let i = 1; i <= nDots; i++) {
    const F = i / (nDots + 1);
    const income = incomeAtF(cdf, F);
    dots.push({ x: jitter(i) * SHAFT_HALF * 0.97, y: worldY(income) });
  }

  const youFrac = fracBelow(cdf, youDaily);
  const median = incomeAtF(cdf, 0.5);
  const top1 = incomeAtF(cdf, 0.99);

  // landmark floors (poverty → median → you → the rich → a billionaire). Built,
  // sorted by income, with the user spliced in and near-duplicates of YOU dropped.
  const base: Omit<Floor, "y">[] = [
    { daily: 2.15, label: fmtDay(2.15), tag: "extreme poverty line", kind: "poor" },
    { daily: median, label: fmtDay(median), tag: "the world's median person", kind: "mid" },
    { daily: 30, label: fmtDay(30), tag: "a global middle-class life", kind: "mid" },
    { daily: top1, label: fmtDay(top1), tag: "the global top 1%", kind: "rich" },
    { daily: 1000, label: "$1,000/day", tag: "the top 0.1%", kind: "rich" },
    { daily: 10000, label: "$10,000/day", tag: "the top 0.01%", kind: "rich" },
    ...FAMOUS, //                          the famous tail, topping out at Elon Musk
  ];
  const raw: Floor[] = base.map((f) => ({ ...f, y: worldY(f.daily) }));

  const sorted = raw
    .filter((f) => Math.abs(Math.log10(f.daily) - Math.log10(youDaily)) > 0.12)
    .concat([{ daily: youDaily, y: worldY(youDaily), label: fmtDay(youDaily), tag: "YOU", kind: "you" }])
    .sort((a, b) => a.daily - b.daily);
  // keep labels from stacking: enforce a minimum vertical gap. YOU + the famous
  // tail are always kept (their spacing is hand-curated).
  const floors: Floor[] = [];
  let lastLog = -Infinity;
  for (const f of sorted) {
    const lg = Math.log10(f.daily);
    if (f.kind === "you" || f.kind === "famous" || f.kind === "peak" || lg - lastLog > 0.16) { floors.push(f); lastLog = lg; }
  }

  return {
    dots,
    floors,
    you: { daily: youDaily, y: worldY(youDaily), frac: youFrac },
    shaftTopY: worldY(TOWER_PEAK_DAILY), // the shaft now runs all the way to Elon
    shaftBottomY: worldY(cdf[0][0]),
    dotsTopY: worldY(dataTop),
  };
}

export interface TowerColors {
  wall: string; crowd: string; you: string; rich: string; ink: string; muted: string; guess: string; paper: string;
}

const nn = (v: number) => Math.round(v * 100) / 100;

export interface TowerOpts {
  guessDaily?: number; //   draw a ghost "guess" line here
  live?: boolean; //        non-scaling strokes for the browser (false → resvg)
  clampTopY?: number; //    don't render above this y (resvg-safe for the tail)
  clampBottomY?: number; // don't render below this y (resvg-safe)
  hideYou?: boolean; //     skip the YOU floor + marker (the live car overlay draws them)
  // ── live-reveal-only flags (the remotion video + static /r/ pages never set these,
  // so their output stays byte-identical and no re-render/regen is forced) ──
  quietFloors?: boolean; // recede ordinary floors + suppress tags near YOU/guess so the
  //                         three protagonists (you / guess / Elon) pop; adds Elon's ▲ cap
  youLabel?: string; //     render a labeled accent "YOU" pill on the shaft (in a .you-mark
  //                         group the live reveal reveals on landing)
  guessTopLabel?: string; // label text for the guess pill (else a plain "YOUR GUESS")
}

/** The shaft body (walls, crowd, floors, you, guess) as an inner-SVG string. */
export function towerBody(t: Tower, c: TowerColors, o: TowerOpts = {}): string {
  const live = o.live ?? true;
  const ve = live ? ` vector-effect="non-scaling-stroke"` : "";
  const top = o.clampTopY ?? -Infinity;
  const bot = o.clampBottomY ?? Infinity;
  const bottomY = Math.min(t.shaftBottomY + 30, bot);
  let s = "";

  // a small right-anchored label pill (rect + text), pinned to the right wall.
  // width is estimated from the label length (server-side text metrics aren't
  // available); a little padding slack is fine. Used for the YOU + guess marks.
  const pill = (yc: number, label: string, fillc: string, txtc: string, borderc?: string) => {
    const fs = 7.4;
    const w = label.length * fs * 0.56 + 13;
    const h = 13;
    const xL = SHAFT_HALF - w;
    return (
      `<rect x="${nn(xL)}" y="${nn(yc - h / 2)}" width="${nn(w)}" height="${h}" rx="6.5" fill="${fillc}"${borderc ? ` stroke="${borderc}" stroke-width="1"` : ""}/>` +
      `<text x="${nn(SHAFT_HALF - 6)}" y="${nn(yc + 2.6)}" text-anchor="end" font-size="${fs}" font-weight="700" fill="${txtc}" letter-spacing="0.2">${label}</text>`
    );
  };

  // shaft walls
  for (const x of [-SHAFT_HALF, SHAFT_HALF])
    s += `<line x1="${x}" y1="${nn(Math.max(t.shaftTopY - 40, top))}" x2="${x}" y2="${nn(bottomY)}" stroke="${c.wall}" stroke-width="${live ? 1 : 1.2}" opacity="0.5"${ve}/>`;

  // the crowd of humanity (dense at the bottom, thinning to a lonely tail).
  // Live: wrapped in a vertical motion-blur filter the ride drives by speed.
  if (live) s += `<defs><filter id="vblur" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur id="vblur-b" in="SourceGraphic" stdDeviation="0 0"/></filter></defs>`;
  s += `<g class="pg-crowd"${live ? ` filter="url(#vblur)"` : ""}>`;
  for (const d of t.dots) {
    if (d.y < top || d.y > bot) continue;
    s += `<circle cx="${nn(d.x)}" cy="${nn(d.y)}" r="1.15" fill="${c.crowd}" opacity="0.55"/>`;
  }
  s += `</g>`;

  // floors: a hairline across the shaft + label inside, left. With quietFloors
  // (live reveal only) the ordinary floors recede and tags near YOU/guess are
  // suppressed, so the you / guess / Elon marks are the only things that pop.
  const q = o.quietFloors ?? false;
  const lg = (d: number) => Math.log10(Math.max(d, 1e-6));
  for (const f of t.floors) {
    if (f.y < top || f.y > bot) continue;
    if (o.hideYou && f.kind === "you") continue;
    const isYou = f.kind === "you";
    const isPeak = f.kind === "peak"; //   Elon: the accented ceiling
    const isFamous = f.kind === "famous";
    const strong = isYou || isPeak; //     solid, emphasized lines
    const col = isYou || isPeak ? c.you : isFamous ? c.ink : c.ink;
    const haloW = q ? 2.6 : 2.4;
    const halo = `paint-order="stroke" stroke="${c.paper}" stroke-width="${haloW}" stroke-linejoin="round"`;
    const lineOp = strong ? 0.95 : isFamous ? 0.5 : q ? 0.26 : 0.32;
    const labelOp = strong ? 1 : q ? 0.78 : 0.9;
    s += `<line x1="${-SHAFT_HALF}" y1="${nn(f.y)}" x2="${SHAFT_HALF}" y2="${nn(f.y)}" stroke="${col}" stroke-width="${strong ? (live ? 2 : 2.4) : live ? 1 : 1.1}" opacity="${lineOp}" stroke-dasharray="${strong ? "" : live ? "3 4" : "4 5"}"${ve}/>`;
    s += `<text x="${-SHAFT_HALF + 5}" y="${nn(f.y - 4.5)}" font-size="${isFamous || isPeak ? 9.6 : 9}" font-weight="700" fill="${col}" opacity="${labelOp}" ${halo}>${f.label}</text>`;
    // the secondary tag recedes too, and is dropped near the action so it never
    // overlaps the YOU/guess marks or the dense dot field.
    const nearAction = q && !strong && (Math.abs(lg(f.daily) - lg(t.you.daily)) < 0.35 || (o.guessDaily ? Math.abs(lg(f.daily) - lg(o.guessDaily)) < 0.35 : false));
    if (!nearAction)
      s += `<text x="${-SHAFT_HALF + 5}" y="${nn(f.y + 8)}" font-size="6.4" fill="${isYou || isPeak ? c.you : c.muted}" opacity="${strong ? 0.95 : q ? 0.7 : 0.85}" letter-spacing="0.3" paint-order="stroke" stroke="${c.paper}" stroke-width="1.7" stroke-linejoin="round">${f.tag.toUpperCase()}</text>`;
    // Elon gets a small ▲ cap so the ceiling reads as a distinct accent FORM
    // from the (also-accent) YOU dot. Live reveal only (gated by quietFloors).
    if (isPeak && q) s += `<text x="0" y="${nn(f.y - 2.5)}" text-anchor="middle" font-size="9" fill="${c.you}">▲</text>`;
  }

  // YOUR GUESS — deliberately UNLIKE the truth so they can never be confused:
  // muted (not accent), a HOLLOW ring on the right wall (not a filled center dot),
  // a longer "5 4" dash, and a right-anchored pill. Only the live reveal passes
  // guessDaily, so the video + /r/ pages never render this.
  if (o.guessDaily) {
    const gy = worldY(o.guessDaily);
    if (gy >= top && gy <= bot) {
      s += `<line x1="${-SHAFT_HALF}" y1="${nn(gy)}" x2="${SHAFT_HALF}" y2="${nn(gy)}" stroke="${c.guess}" stroke-width="${live ? 1.4 : 1.6}" opacity="0.7" stroke-dasharray="5 4"${ve}/>`;
      s += `<circle cx="${SHAFT_HALF}" cy="${nn(gy)}" r="3.6" fill="${c.paper}" stroke="${c.guess}" stroke-width="1.4"/>`;
      s += pill(gy - 11, o.guessTopLabel ?? "YOUR GUESS", c.paper, c.guess, c.wall);
    }
  }

  // YOU — the truth. Live reveal: a labeled accent group (the .you-mark group the
  // reveal fades in on landing; the live car overlay supplies the dot + eye-line,
  // so here we add the solid accent line + the right-anchored "YOU" pill). Static
  // /r/ pages keep the plain glowing dot. The video (hideYou, no youLabel) draws
  // nothing — the car overlay marks YOU there too.
  const yy = t.you.y;
  if (o.youLabel && yy >= top && yy <= bot) {
    // the car overlay (HTML) draws the dot + accent eye-line at the car line; here
    // we add the labeled pill, in a group the reveal fades in on landing.
    s += `<g class="you-mark">${pill(yy - 11, o.youLabel, c.you, c.paper)}</g>`;
  } else if (!o.hideYou && yy >= top && yy <= bot) {
    s += `<circle cx="0" cy="${nn(yy)}" r="4.5" fill="${c.you}"/>`;
    s += `<circle cx="0" cy="${nn(yy)}" r="8" fill="none" stroke="${c.you}" stroke-width="${live ? 1 : 1.2}" opacity="0.6"${ve}/>`;
  }
  return s;
}

/** Static tower at one camera frame as composable parts — for /r/N + OG, where
 *  the caller supplies its own wrapping/nested <svg> (class, x/y/width/height). */
export function towerFrame(cdf: [number, number][], youDaily: number, pop: number, c: TowerColors, focusDaily?: number, guessDaily?: number): { viewBox: string; body: string } {
  const t = buildTower(cdf, youDaily, pop, 2800);
  const camY = camYFor(focusDaily ?? youDaily);
  const body = towerBody(t, c, { guessDaily, live: false, clampTopY: camY - 8, clampBottomY: camY + VIEW_H + 8 });
  return { viewBox: `${nn(-VIEW_W / 2)} ${nn(camY)} ${VIEW_W} ${VIEW_H}`, body };
}

/** A static, fully-resolved tower <svg> framed on a given income. */
export function towerStill(cdf: [number, number][], youDaily: number, pop: number, c: TowerColors, focusDaily?: number, guessDaily?: number): string {
  const f = towerFrame(cdf, youDaily, pop, c, focusDaily, guessDaily);
  return `<svg viewBox="${f.viewBox}" preserveAspectRatio="xMidYMid meet">${f.body}</svg>`;
}
