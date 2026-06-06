/**
 * sound.ts — the ascent's casino-ratchet, synthesized with Web Audio (no assets).
 *
 * The ride ticks once per "notch" of travel; because the ride decelerates, the
 * ticks naturally machine-gun at launch and slow to a crawl as the doors land —
 * the prize-wheel / case-opening feel. A thunk + chime marks the landing.
 *
 * Audio is created only inside a user gesture (the "Lock in" tap), so autoplay
 * policies are satisfied. Everything no-ops when muted or unsupported.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

export const soundEnabled = () => enabled;

export function initSoundPref() {
  try { enabled = localStorage.getItem("ir.sound") !== "0"; } catch { /* private mode */ }
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
  try { localStorage.setItem("ir.sound", v ? "1" : "0"); } catch { /* private mode */ }
  if (master && ctx) master.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.01);
}

/** Create/resume the audio graph. MUST be called from a user gesture. */
export function ensureAudio() {
  if (!enabled) return;
  if (!ctx) {
    const AC: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

/** A short, bright mechanical tick (one notch of the selector). `freq` lets the
 *  sliders pitch their ticks by rank; omit it for the ride's flat ratchet. */
export function tick(vol = 0.32, freq?: number) {
  if (!enabled || !ctx || !master) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq ?? 1500 + Math.random() * 220;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.05);
}

/** The satisfying landing: a low thunk + a short chime. */
export function land() {
  if (!enabled || !ctx || !master) return;
  const t = ctx.currentTime;
  const thunk = ctx.createOscillator();
  thunk.type = "sine";
  thunk.frequency.setValueAtTime(240, t);
  thunk.frequency.exponentialRampToValueAtTime(90, t + 0.2);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(0.55, t + 0.012);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  thunk.connect(tg).connect(master);
  thunk.start(t); thunk.stop(t + 0.55);

  const chime = ctx.createOscillator();
  chime.type = "sine";
  chime.frequency.value = 1320;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.0001, t + 0.03);
  cg.gain.exponentialRampToValueAtTime(0.22, t + 0.06);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  chime.connect(cg).connect(master);
  chime.start(t + 0.03); chime.stop(t + 0.5);
}
