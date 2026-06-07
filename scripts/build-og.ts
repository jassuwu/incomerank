/**
 * build-og.ts — pre-render editorial-paper share cards at build time (ADR-0002).
 *
 * Each global-rank bucket gets a path-based result page (/r/N) with its own PNG
 * (public/og/top-N.png), so links unfurl with a personalised ASCENT card — the
 * shaft of humanity framed on this rank (src/lib/tower.ts) rasterised by native
 * @resvg/resvg-js. Run via `bun run og` (wired into `bun run build`).
 */
import { Resvg } from "@resvg/resvg-js";
import { writeFile, mkdir } from "node:fs/promises";
import world from "../src/data/world.json";
import { formatPeople } from "../src/lib/rank-copy";
import { globalPerspectives } from "../src/lib/perspectives";
import type { WorldData } from "../src/lib/types";
import { towerFrame, incomeAtF, type TowerColors } from "../src/lib/tower";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = `${ROOT}public/og`;
const FONTS = `${ROOT}node_modules/@fontsource/inter/files`;
const FONT_FILES = ["400", "600", "800"].map((w) => `${FONTS}/inter-latin-${w}-normal.woff`);

const C = { paper: "#f4f0e7", ink: "#191512", inkSoft: "#3a342c", muted: "#6d655b", line: "#d8d0c0", accent: "#df2f1b" };
const cdfNom = (world as any).cdfNom as [number, number][];
const pop = (world as any).worldPopulation as number;
const TC: TowerColors = { wall: C.line, crowd: C.ink, you: C.accent, rich: C.muted, ink: C.ink, muted: C.muted, guess: C.muted, paper: C.paper };

// The ASCENT shaft framed on this rank, as a nested <svg> in the card.
function towerBox(b: number, x: number, y: number, w: number, h: number): string {
  const youDaily = incomeAtF(cdfNom, 1 - b / 100);
  const { viewBox, body } = towerFrame(cdfNom, youDaily, pop, TC);
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}

function shell(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="${C.paper}"/>
    <text x="84" y="92" font-family="Inter" font-weight="600" font-size="26" letter-spacing="1" fill="${C.muted}">income rank</text>
    <text x="1116" y="92" text-anchor="end" font-family="Inter" font-weight="600" font-size="26" letter-spacing="1" fill="${C.muted}">earth</text>
    <line x1="84" y1="116" x2="1116" y2="116" stroke="${C.line}" stroke-width="2"/>
    ${inner}
    <text x="84" y="588" font-family="Inter" font-weight="700" font-size="30" fill="${C.accent}">incomerank.jass.gg</text>
  </svg>`;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Wrap a line to `maxChars` per line and emit stacked <text> elements. */
function wrapText(text: string, x: number, y: number, size: number, fill: string, weight: number, maxChars: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) { lines.push(cur); cur = w; }
    else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines
    .map((ln, i) => `<text x="${x}" y="${y + i * Math.round(size * 1.22)}" font-family="Inter" font-weight="${weight}" font-size="${size}" fill="${fill}">${escapeXml(ln)}</text>`)
    .join("");
}

function rankCard(b: number): string {
  const persp = globalPerspectives(world as unknown as WorldData, b);
  const people = formatPeople((world as any).worldPopulation * (1 - b / 100));
  const ofHundred = Math.max(1, 100 - b);
  // lead with the most visceral line this bucket has (the countries-combined
  // gut-punch when it exists, else the world-of-100 line) — ADR-0004's "punchier
  // static copy" win, no per-guess personalization.
  const combined = persp.find((p) => p.startsWith("thats more people than live in"));
  const punch = combined ?? `if the world was 100 people, ${ofHundred} would have less.`;
  return shell(`
    <text x="84" y="214" font-family="Inter" font-weight="600" font-size="40" fill="${C.inkSoft}">you're in the global</text>
    <text x="80" y="374" font-family="Inter" font-weight="800" font-size="156" fill="${C.accent}">top ${b}%</text>
    ${wrapText(punch, 84, 452, 33, C.ink, 700, 40)}
    <text x="84" y="548" font-family="Inter" font-weight="400" font-size="27" fill="${C.muted}">~${people} people live on less than you.</text>
    ${towerBox(b, 800, 40, 340, 540)}
  `);
}

function defaultCard(): string {
  return shell(`
    <text x="84" y="300" font-family="Inter" font-weight="800" font-size="80" fill="${C.ink}">find your global</text>
    <text x="84" y="388" font-family="Inter" font-weight="800" font-size="80" fill="${C.accent}">income rank.</text>
    <text x="84" y="452" font-family="Inter" font-weight="400" font-size="30" fill="${C.muted}">ride the elevator of humanity. how high are you?</text>
    ${towerBox(50, 800, 40, 340, 540)}
  `);
}

function png(svg: string): Buffer {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    // resvg-js can't parse .woff/.woff2 here, so the bundled Inter files don't
    // load — fall back to system fonts (defaultFontFamily) so text renders.
    font: { fontFiles: FONT_FILES, loadSystemFonts: true, defaultFontFamily: "Helvetica" },
  }).render().asPng();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/default.png`, png(defaultCard()));
  for (let b = 1; b <= 99; b++) await writeFile(`${OUT}/top-${b}.png`, png(rankCard(b)));
  console.log("✓ build-og: ASCENT cards → public/og/ (default + top-1..99)");
}

main().catch((e) => { console.error(e); process.exit(1); });
