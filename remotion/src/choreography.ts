/**
 * choreography.ts — the demo's single timeline, shared by the visuals (Shaft /
 * HeroCard) and the audio generator (scripts/gen-soundtrack.ts) so the ratchet
 * ticks land exactly on the on-screen motion. Pure + deterministic.
 *
 * It reuses the real site geometry (worldY/camYFor from src/lib/tower.ts) and the
 * real baked world distribution, so the demo ranks $200k/yr exactly like the site.
 */
import { worldY, camYFor, TOWER_PEAK_DAILY, fracBelow } from "../../src/lib/tower";
import world from "../../src/data/world.json";
import india from "../../public/data/countries/IND.json";

export const FPS = 30;

// ── the subject: ₹50,000 / month, India (the site defaults India to monthly) ──
export const CURRENCY = "₹";
export const AMOUNT_LABEL = "50,000";
export const PERIOD = "mo";
export const COUNTRY = "india";
const MONTHLY = 50_000;
export const YOU_DAILY = (MONTHLY * 12) / 365 / india.fx; // → market-FX US$/day (~$22)
export const cdf = world.cdfNom as [number, number][];
export const WORLD_POP = world.worldPopulation;
export const BOTTOM = cdf[0][0]; //            poorest income the data covers
export const PEAK = TOWER_PEAK_DAILY; //       Elon, the ceiling

// ── the beats (frames @ 30fps) ───────────────────────────────────────────────
export const ENTRY = 36; //        ~1.2s — the income on screen, shaft at the ground
export const ASCENT = 84; //       ~2.8s — ratchet up to your floor
export const HOLD = 66; //         ~2.2s — land + "you're top 0.21%"
export const TAIL = 192; //        ~6.4s — climb the famous ladder to Elon
export const ELON_HOLD = 63; //    ~2.1s — the punchline

export const ENTRY_END = ENTRY; //                         36
export const ASCENT_END = ENTRY_END + ASCENT; //           120
export const HOLD_END = ASCENT_END + HOLD; //              186
export const TAIL_END = HOLD_END + TAIL; //                378
export const BASE_TOTAL = TAIL_END + ELON_HOLD; //         441 (~14.7s) — the README GIF
export const CTA_LEN = 84; //                              ~2.8s — the social call-to-action
export const CTA_TOTAL = BASE_TOTAL + CTA_LEN; //          525 (~17.5s) — the social MP4

export const LAND_FRAMES = [ASCENT_END, TAIL_END]; // thunk+chime at each landing
export const CTA_FRAME = BASE_TOTAL; //                    the end-card lands here

export type Phase = "entry" | "ascent" | "hold" | "tail" | "elon" | "cta";
export function phaseAt(f: number): Phase {
  if (f < ENTRY_END) return "entry";
  if (f < ASCENT_END) return "ascent";
  if (f < HOLD_END) return "hold";
  if (f < TAIL_END) return "tail";
  if (f < BASE_TOTAL) return "elon";
  return "cta";
}

const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The income framed at the car line on a given frame (log-interpolated). */
export function camDailyAtFrame(f: number): number {
  if (f <= ENTRY_END) return BOTTOM;
  if (f < ASCENT_END) {
    const p = easeInOutCubic((f - ENTRY_END) / ASCENT);
    return Math.pow(10, lerp(Math.log10(BOTTOM), Math.log10(YOU_DAILY), p));
  }
  if (f <= HOLD_END) return YOU_DAILY;
  if (f < TAIL_END) {
    const p = (f - HOLD_END) / TAIL; // linear: a steady, readable climb
    return Math.pow(10, lerp(Math.log10(YOU_DAILY), Math.log10(PEAK), p));
  }
  return PEAK;
}

export const camYAtFrame = (f: number) => camYFor(camDailyAtFrame(f));
export const fracBelowAt = (f: number) => fracBelow(cdf, camDailyAtFrame(f));

// ── the ratchet: one tick per notch of vertical travel ───────────────────────
const TICK_NOTCH = 11; // world-units between ticks (matches the site)

/** Frames on which a ratchet tick fires — machine-guns when the camera is fast,
 *  slows as it settles. Same accumulator the site uses, walked frame by frame. */
export function tickFrames(): number[] {
  const out: number[] = [];
  let prevY = worldY(camDailyAtFrame(0));
  let acc = 0;
  for (let f = 1; f <= BASE_TOTAL; f++) {
    const y = worldY(camDailyAtFrame(f));
    acc += Math.abs(y - prevY);
    prevY = y;
    let fired = 0;
    while (acc >= TICK_NOTCH && fired < 3) {
      acc -= TICK_NOTCH;
      out.push(f);
      fired++;
    }
    if (acc > TICK_NOTCH) acc = TICK_NOTCH; // drop backlog at peak speed
  }
  return out;
}

/** Per-frame vertical motion blur (stdDeviation), velocity-based like the site. */
export function blurAtFrame(f: number): number {
  if (f <= 0) return 0;
  const d = Math.abs(worldY(camDailyAtFrame(f)) - worldY(camDailyAtFrame(f - 1)));
  const perMs = d / (1000 / FPS);
  return Math.min(4, perMs * 8);
}

// ── the famous ladder (for the right-side caption during the climb) ───────────
// Mirrors FAMOUS in src/lib/tower.ts — keep in sync (re-render the video on change).
export const FAMOUS: { daily: number; name: string }[] = [
  { daily: 110_000, name: "Shah Rukh Khan" },
  { daily: 233_000, name: "MrBeast" },
  { daily: 370_000, name: "BTS" },
  { daily: 753_000, name: "Cristiano Ronaldo" },
  { daily: 1_100_000, name: "Taylor Swift" },
  { daily: 18_000_000, name: "Aliko Dangote" },
  { daily: 30_000_000, name: "Tadashi Yanai" },
  { daily: 50_000_000, name: "Mukesh Ambani" },
  { daily: 120_000_000, name: "Jeff Bezos" },
  { daily: 1_360_000_000, name: "Elon Musk" },
];

/** The most recent famous name the camera has climbed past (or null). */
export function famousPassed(daily: number): string | null {
  let last: string | null = null;
  for (const p of FAMOUS) if (daily >= p.daily * 0.98) last = p.name;
  return last;
}
