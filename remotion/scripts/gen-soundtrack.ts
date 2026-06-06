/**
 * gen-soundtrack.ts — bakes the demo's audio to public/soundtrack.wav.
 *
 * Re-synthesizes the site's Web Audio voices (src/lib/sound.ts) as raw PCM and
 * places them on the SAME timeline the visuals use (choreography.ts): a triangle
 * "tick" on every ratchet notch, and a thunk+chime "land" at each landing. Because
 * both the picture and this script read tickFrames()/LAND_FRAMES, they stay locked.
 *
 *   run:  bun scripts/gen-soundtrack.ts
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FPS, CTA_TOTAL, CTA_FRAME, tickFrames, LAND_FRAMES, TYPE_KEY_FRAMES, SUBMIT_FRAME } from "../src/choreography";

const SR = 44100;
const TAIL = 0.8; // seconds of room for the last decay
const len = Math.ceil((CTA_TOTAL / FPS + TAIL) * SR);
const buf = new Float32Array(len);

interface Voice {
  dur: number;
  peak: number;
  attack: number;
  decayEnd: number;
  type: "triangle" | "sine";
  f0: number;
  f1?: number;
  glide?: number;
}

function add(t0: number, v: Voice) {
  const n0 = Math.floor(t0 * SR);
  const ns = Math.ceil(v.dur * SR);
  let phase = 0;
  for (let i = 0; i < ns; i++) {
    const idx = n0 + i;
    if (idx < 0 || idx >= len) continue;
    const tau = i / SR;
    let f = v.f0;
    if (v.f1 !== undefined) {
      const g = Math.min(tau, v.glide ?? v.dur) / (v.glide ?? v.dur);
      f = v.f0 * Math.pow(v.f1 / v.f0, g);
    }
    phase += (2 * Math.PI * f) / SR;
    const s =
      v.type === "triangle" ? 4 * Math.abs(((phase / (2 * Math.PI)) % 1) - 0.5) - 1 : Math.sin(phase);
    let env: number;
    if (tau < v.attack) env = v.peak * (tau / v.attack);
    else {
      const dt = Math.min(1, (tau - v.attack) / (v.decayEnd - v.attack));
      env = v.peak * Math.pow(0.0008 / v.peak, dt);
    }
    if (tau > v.decayEnd) env = 0;
    buf[idx] += s * env;
  }
}

// ── input scene: a soft key-click per keystroke, then a confirming press ──────
// (lower + quieter than the ratchet so it reads as typing, not the climb).
for (const f of TYPE_KEY_FRAMES) {
  add(f / FPS, { dur: 0.05, peak: 0.16, attack: 0.001, decayEnd: 0.04, type: "triangle", f0: 900 + Math.random() * 120 });
}
// the "find my rank" press — a short, bright rising two-note confirm
add(SUBMIT_FRAME / FPS, { dur: 0.16, peak: 0.26, attack: 0.002, decayEnd: 0.14, type: "sine", f0: 660 });
add(SUBMIT_FRAME / FPS + 0.05, { dur: 0.2, peak: 0.22, attack: 0.002, decayEnd: 0.18, type: "sine", f0: 990 });

// ── ratchet ticks (sound.ts tick(): triangle ~1500-1720Hz, ~40ms) ────────────
const ticks = tickFrames();
for (const f of ticks) {
  add(f / FPS, { dur: 0.05, peak: 0.3, attack: 0.001, decayEnd: 0.04, type: "triangle", f0: 1500 + Math.random() * 220 });
}

// ── landings (sound.ts land(): a low thunk + a short chime) ──────────────────
for (const f of LAND_FRAMES) {
  const t = f / FPS;
  add(t, { dur: 0.55, peak: 0.55, attack: 0.012, decayEnd: 0.5, type: "sine", f0: 240, f1: 90, glide: 0.2 });
  add(t + 0.03, { dur: 0.47, peak: 0.22, attack: 0.03, decayEnd: 0.45, type: "sine", f0: 1320 });
}

// ── the CTA: a bright ascending three-note chime as the end card lands ────────
const ctaT = CTA_FRAME / FPS;
[880, 1175, 1568].forEach((hz, i) => {
  add(ctaT + i * 0.11, { dur: 0.7, peak: 0.24, attack: 0.006, decayEnd: 0.66, type: "sine", f0: hz });
});

// ── normalize, then encode 16-bit mono WAV ───────────────────────────────────
let peak = 0;
for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(buf[i]));
const gain = peak > 0.98 ? 0.98 / peak : 1;

const bytes = Buffer.alloc(44 + len * 2);
bytes.write("RIFF", 0);
bytes.writeUInt32LE(36 + len * 2, 4);
bytes.write("WAVE", 8);
bytes.write("fmt ", 12);
bytes.writeUInt32LE(16, 16);
bytes.writeUInt16LE(1, 20); // PCM
bytes.writeUInt16LE(1, 22); // mono
bytes.writeUInt32LE(SR, 24);
bytes.writeUInt32LE(SR * 2, 28);
bytes.writeUInt16LE(2, 32);
bytes.writeUInt16LE(16, 34);
bytes.write("data", 36);
bytes.writeUInt32LE(len * 2, 40);
for (let i = 0; i < len; i++) {
  const s = Math.max(-1, Math.min(1, buf[i] * gain));
  bytes.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, 44 + i * 2);
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "soundtrack.wav");
writeFileSync(out, bytes);
console.log(`wrote ${out}  (${(bytes.length / 1024).toFixed(0)} KB, ${ticks.length} ticks, ${LAND_FRAMES.length} lands, ${(len / SR).toFixed(1)}s)`);
