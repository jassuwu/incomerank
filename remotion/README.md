# incomerank · remotion demo

Renders the README header (silent GIF) and the social card (MP4 with sound). It's a
deterministic [Remotion](https://remotion.dev) composition that **reuses the site's
real geometry** (`../src/lib/tower.ts`) and **re-synthesizes `../src/lib/sound.ts`'s
exact ratchet/landing voices** onto a shared timeline, so the demo ranks
`₹50,000/mo` (India) and sounds exactly like the live site. Two compositions:
`hero` (silent, CTA-free → the README GIF) and `hero-cta` (sound + call-to-action
end card → the social MP4).

```bash
npm install
npm run render        # audio + both cuts + the GIF, end to end
# …or individually:
bun run audio         # synthesize the soundtrack → public/soundtrack.wav (run first)
npm run render:social # → out/incomerank-social.mp4  (CTA + sound, for Twitter/LinkedIn/Reddit)
npm run render:hero   # → out/incomerank-hero.mp4    (no CTA, source for the GIF)
npm run gif           # → out/incomerank-hero.gif    (silent, the README header)
npm run studio        # live preview / scrub in the Remotion studio
npm run still -- --frame=245   # one frame (frame 245 = the "you're top 16%" beat)
```

The published assets live in `../docs/assets/readme/`. After re-rendering, copy them:

```bash
cp out/incomerank-hero.gif   ../docs/assets/readme/incomerank-header.gif   # header (no CTA)
cp out/incomerank-social.mp4 ../docs/assets/readme/incomerank-demo.mp4     # social (CTA + sound)
```

## How it's wired

| file | role |
|---|---|
| `src/choreography.ts` | the single timeline — camera path + tick/land schedule (shared by picture + audio) |
| `src/Shaft.tsx` | the animated shaft (real `buildTower`/`towerBody`, slice + `inset:0` car alignment) |
| `src/HeroCard.tsx` | the 16:9 scene — shaft left, live-counting readout right, captions, soundtrack |
| `scripts/gen-soundtrack.ts` | bakes the ticks + thunk/chime to `public/soundtrack.wav` |

Generated artifacts (`node_modules/`, `out/`, `public/*.wav`) are git-ignored;
regenerate the wav with `bun run audio` before rendering.
