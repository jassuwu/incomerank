import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { fracBelow } from "../../src/lib/tower";
import { Shaft } from "./Shaft";
import { C, display, body } from "./theme";
import {
  phaseAt,
  fracBelowAt,
  camDailyAtFrame,
  cdf,
  WORLD_POP,
  YOU_DAILY,
  PEAK,
  famousPassed,
  CURRENCY,
  AMOUNT_LABEL,
  COUNTRY,
  ENTRY_END,
  ASCENT_END,
  HOLD_END,
  TAIL_END,
  BASE_TOTAL,
  LAND_FRAMES,
  type Phase,
} from "./choreography";

// derived once from the subject — so the copy follows the amount, never hardcoded
const YOU_FRAC = fracBelow(cdf, YOU_DAILY);
const YOU_TOP = (1 - YOU_FRAC) * 100;
const ELON_MULT = PEAK / YOU_DAILY;
const BILLIONS_BELOW = (WORLD_POP * YOU_FRAC) / 1e9;
const DOLLARS_DAY = Math.round(YOU_DAILY);

const fmtPeople = (n: number) => Math.round(Math.max(0, n)).toLocaleString("en-US");
const fmtTop = (t: number) => (t >= 10 ? `${Math.round(t)}` : t >= 1 ? t.toFixed(1) : t.toFixed(2));
const fmtMult = (m: number) =>
  m >= 1e6 ? `${(m / 1e6).toFixed(m / 1e6 >= 10 ? 0 : 1)}M` : m >= 1e3 ? `${Math.round(m / 1e3)}k` : m >= 10 ? `${Math.round(m)}` : m.toFixed(1);

const PHASE_START: Record<Phase, number> = {
  entry: 0,
  ascent: ENTRY_END,
  hold: ASCENT_END,
  tail: HOLD_END,
  elon: TAIL_END,
  cta: BASE_TOTAL,
};

interface Readout {
  eyebrow: string;
  pre?: string;
  big: string;
  unit: string;
  sub: string;
  size?: number;
}

function readoutAt(frame: number): Readout {
  const phase = phaseAt(frame);
  const cam = camDailyAtFrame(frame);
  const frac = fracBelowAt(frame);
  switch (phase) {
    case "entry":
      return {
        eyebrow: "how rich are you, really?",
        pre: CURRENCY,
        big: AMOUNT_LABEL,
        unit: "",
        size: 168,
        sub: `a monthly salary · ${COUNTRY}`,
      };
    case "ascent":
      return {
        eyebrow: "ascending the shaft of humanity…",
        pre: "top ",
        big: fmtTop((1 - frac) * 100),
        unit: "%",
        sub: `${fmtPeople(WORLD_POP * frac)} people below`,
      };
    case "hold":
      return {
        eyebrow: "you're in the global",
        pre: "top ",
        big: fmtTop(YOU_TOP),
        unit: "%",
        sub: `${BILLIONS_BELOW.toFixed(1)} billion people below · $${DOLLARS_DAY}/day`,
      };
    case "tail": {
      const name = famousPassed(cam);
      return {
        eyebrow: "keep going. flying past everyone…",
        big: fmtMult(cam / YOU_DAILY),
        unit: "×",
        sub: name ? `just passed ${name}` : "your income",
      };
    }
    case "elon":
    default:
      return {
        eyebrow: "and at the very top, elon musk earns",
        big: fmtMult(ELON_MULT),
        unit: "×",
        sub: "your income. every single day.",
      };
  }
}

/** The social call-to-action end card (MP4 only — the GIF never reaches it). */
const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - BASE_TOTAL;
  const opacity = interpolate(local, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(local, [0, 16], [0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ fontSize: 44, color: C.muted, marginBottom: 26 }}>so… where do you land?</div>
      <div
        style={{
          fontFamily: display,
          fontWeight: 800,
          fontSize: 150,
          lineHeight: 0.96,
          letterSpacing: -4,
          color: C.ink,
          textAlign: "center",
        }}
      >
        find your rank
      </div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 110, letterSpacing: -2, color: C.accent, marginTop: 18 }}>
        incomerank.jass.gg
      </div>
      <div style={{ fontSize: 36, color: C.muted, marginTop: 40, letterSpacing: 0.2 }}>
        free · takes 10 seconds · your income never leaves your browser
      </div>
    </AbsoluteFill>
  );
};

export const HeroCard: React.FC<{ cta?: boolean }> = () => {
  const frame = useCurrentFrame();
  const phase = phaseAt(frame);
  const isCta = phase === "cta";
  const r = readoutAt(frame);

  const start = PHASE_START[phase];
  const enter = interpolate(frame, [start, start + 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(frame, [start, start + 9], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const flash = Math.max(
    0,
    ...LAND_FRAMES.map((lf) =>
      interpolate(frame, [lf, lf + 2, lf + 16], [0, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    ),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: C.paper, fontFamily: body, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 30% 40%, transparent 60%, ${C.panel})`, opacity: 0.6 }} />

      {/* brand mark, top-left */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 72,
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: display,
          fontWeight: 800,
          fontSize: 30,
          letterSpacing: -0.5,
          color: C.ink,
        }}
      >
        <span style={{ width: 16, height: 16, borderRadius: 9999, background: C.accent, display: "inline-block" }} />
        income rank
      </div>

      {isCta ? (
        <CtaScene />
      ) : (
        <AbsoluteFill style={{ display: "flex", flexDirection: "row", alignItems: "center", padding: "120px 96px 110px 96px" }}>
          <div style={{ height: "100%", flex: "0 0 auto", paddingRight: 40 }}>
            <Shaft />
          </div>

          <div
            style={{
              flex: "1 1 auto",
              paddingLeft: 64,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              opacity: enter,
              transform: `translateY(${rise}px)`,
            }}
          >
            <div style={{ fontSize: 40, color: C.muted, letterSpacing: 0.2, marginBottom: 18 }}>{r.eyebrow}</div>

            <div
              style={{
                fontFamily: display,
                fontWeight: 800,
                fontSize: r.size ?? 230,
                lineHeight: 0.92,
                letterSpacing: -4,
                color: C.ink,
                fontVariantNumeric: "tabular-nums",
                display: "flex",
                alignItems: "baseline",
              }}
            >
              {r.pre ? (
                <span style={{ fontSize: (r.size ?? 230) * 0.42, fontWeight: 700, color: C.muted, marginRight: 8 }}>{r.pre}</span>
              ) : null}
              <span>{r.big}</span>
              <span style={{ color: C.accent }}>{r.unit}</span>
            </div>

            <div style={{ fontSize: 46, color: C.inkSoft, marginTop: 26, fontVariantNumeric: "tabular-nums" }}>{r.sub}</div>
          </div>
        </AbsoluteFill>
      )}

      {/* url, bottom-right (hidden on the CTA card, which says it bigger) */}
      {!isCta ? (
        <div style={{ position: "absolute", bottom: 56, right: 72, fontSize: 30, color: C.faint, letterSpacing: 0.3 }}>
          incomerank.jass.gg
        </div>
      ) : null}

      <AbsoluteFill style={{ backgroundColor: C.accent, opacity: flash, pointerEvents: "none" }} />

      <Audio src={staticFile("soundtrack.wav")} />
    </AbsoluteFill>
  );
};
