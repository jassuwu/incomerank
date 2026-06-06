import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import {
  buildTower,
  towerBody,
  VIEW_W,
  VIEW_H,
  type TowerColors,
} from "../../src/lib/tower";
import {
  cdf,
  WORLD_POP,
  YOU_DAILY,
  camDailyAtFrame,
  camYAtFrame,
  blurAtFrame,
} from "./choreography";
import { C } from "./theme";

const TOWER_C: TowerColors = {
  wall: "var(--color-line)",
  crowd: "var(--color-ink)",
  you: "var(--color-accent)",
  rich: "var(--color-muted)",
  ink: "var(--color-ink)",
  muted: "var(--color-muted)",
  guess: "var(--color-ink)",
  paper: "var(--color-paper)",
};

const CAR_FRAC = 0.54;

/** The glass car climbing the shaft — same geometry as the live site. */
export const Shaft: React.FC = () => {
  const frame = useCurrentFrame();

  // the tower body is income-independent per frame: build the dots + floors once
  // (YOU hidden — the car overlay marks the camera line), then only the viewBox
  // + the crowd's motion-blur change frame to frame.
  const bodyBase = useMemo(() => {
    const t = buildTower(cdf, YOU_DAILY, WORLD_POP, 3000);
    return towerBody(t, TOWER_C, { live: true, hideYou: true });
  }, []);

  const cam = camDailyAtFrame(frame);
  const blur = blurAtFrame(frame);
  const body = bodyBase.replace('stdDeviation="0 0"', `stdDeviation="0 ${blur.toFixed(2)}"`);
  const viewBox = `${-VIEW_W / 2} ${camYAtFrame(frame)} ${VIEW_W} ${VIEW_H}`;
  void cam;

  const cssVars = {
    "--color-paper": C.paper,
    "--color-line": C.line,
    "--color-ink": C.ink,
    "--color-accent": C.accent,
    "--color-muted": C.muted,
  } as React.CSSProperties;

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        aspectRatio: `${VIEW_W} / ${VIEW_H}`,
        margin: "0 auto",
        borderLeft: `2px solid ${C.line}`,
        borderRight: `2px solid ${C.line}`,
        ...cssVars,
      }}
    >
      {/* the shaft, with the top/bottom fade the site uses */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, #000 9%, #000 91%, transparent)",
          maskImage:
            "linear-gradient(to bottom, transparent, #000 9%, #000 91%, transparent)",
        }}
      >
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>

      {/* the car: the eye-line at CAR_FRAC, exactly on the floor lines */}
      <div style={{ position: "absolute", left: 0, right: 0, top: `${CAR_FRAC * 100}%`, zIndex: 2 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: -2,
            height: 4,
            background: C.accent,
            opacity: 0.92,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: 30,
            height: 30,
            transform: "translate(-50%, -50%)",
            borderRadius: 9999,
            background: C.accent,
            boxShadow: `0 0 0 10px color-mix(in srgb, ${C.accent} 22%, transparent)`,
          }}
        />
      </div>
    </div>
  );
};
