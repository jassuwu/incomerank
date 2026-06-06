import React from "react";
import { Composition } from "remotion";
import { HeroCard } from "./HeroCard";
import { FPS, BASE_TOTAL, CTA_TOTAL } from "./choreography";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* the README header — no CTA, silent GIF */}
      <Composition
        id="hero"
        component={HeroCard}
        durationInFrames={BASE_TOTAL}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ cta: false }}
      />
      {/* the social cut — same demo + a call-to-action end card, with sound */}
      <Composition
        id="hero-cta"
        component={HeroCard}
        durationInFrames={CTA_TOTAL}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ cta: true }}
      />
    </>
  );
};
