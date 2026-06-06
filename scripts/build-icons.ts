/**
 * build-icons.ts — the brand favicon + the full icon set, from one source mark.
 *
 * The mark IS the product: the vermillion "car" (your eye-line + marker dot) riding
 * high in the shaft of humanity — the crowd dense at the bottom, the lonely rich tail
 * above you. Same editorial-paper palette as the site. One SVG, rasterised by native
 * @resvg/resvg-js into favicon.svg/.ico, apple-touch, and PWA (incl. maskable) PNGs.
 *
 *   run:  bun run scripts/build-icons.ts   (wired into `bun run build`)
 */
import { Resvg } from "@resvg/resvg-js";
import { writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const PUB = `${ROOT}public`;
const C = { paper: "#f4f0e7", ink: "#191512", line: "#d8d0c0", accent: "#df2f1b" };

// the mark, on a 64×64 grid. crowd dense + low, thinning up; YOU (red) high & alone.
const ART = `
  <g stroke="${C.line}" stroke-width="1.6" opacity="0.6" stroke-linecap="round">
    <line x1="18" y1="9" x2="18" y2="55"/>
    <line x1="46" y1="9" x2="46" y2="55"/>
  </g>
  <g fill="${C.ink}" opacity="0.34">
    <circle cx="25" cy="51" r="1.7"/><circle cx="33" cy="53" r="1.7"/><circle cx="40" cy="50" r="1.6"/>
    <circle cx="29" cy="47" r="1.6"/><circle cx="38" cy="46" r="1.5"/><circle cx="22" cy="45" r="1.4"/>
    <circle cx="43" cy="44" r="1.3"/><circle cx="31" cy="42" r="1.4"/><circle cx="36" cy="40" r="1.2"/>
    <circle cx="27" cy="39" r="1.2"/><circle cx="33" cy="36" r="1.1"/>
  </g>
  <line x1="12" y1="27" x2="52" y2="27" stroke="${C.accent}" stroke-width="4.5" stroke-linecap="round"/>
  <circle cx="32" cy="27" r="12" fill="${C.accent}" opacity="0.16"/>
  <circle cx="32" cy="27" r="8" fill="${C.accent}"/>
`;

/** Compose the mark over a background. `rounded` for the tab tile; `pad` (units of
 *  64) insets the art into the maskable safe zone; otherwise full-bleed for OS rounding. */
function svg({ rounded = false, pad = 0 } = {}): string {
  const bg = rounded
    ? `<rect width="64" height="64" rx="14" fill="${C.paper}"/>`
    : `<rect width="64" height="64" fill="${C.paper}"/>`;
  const inner = pad ? `<g transform="translate(${pad} ${pad}) scale(${(64 - 2 * pad) / 64})">${ART}</g>` : ART;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bg}${inner}</svg>`;
}

const png = (s: string, size: number): Buffer =>
  new Resvg(s, { fitTo: { mode: "width", value: size } }).render().asPng();

/** Pack PNG-encoded images into a multi-resolution .ico (PNG-in-ICO, Vista+). */
function ico(imgs: { size: number; data: Buffer }[]): Buffer {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
  const dir = Buffer.alloc(16 * imgs.length);
  let offset = 6 + 16 * imgs.length;
  imgs.forEach((img, i) => {
    const e = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 0);
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 1);
    dir.writeUInt16LE(1, e + 4); // color planes
    dir.writeUInt16LE(32, e + 6); // bits per pixel
    dir.writeUInt32LE(img.data.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += img.data.length;
  });
  return Buffer.concat([head, dir, ...imgs.map((i) => i.data)]);
}

async function main() {
  const square = svg(); //                full-bleed (OS rounds it)
  const rounded = svg({ rounded: true }); // tab/bookmark tile
  const maskable = svg({ pad: 8 }); //     Android adaptive safe zone

  await writeFile(`${PUB}/favicon.svg`, rounded);
  await writeFile(`${PUB}/favicon-16.png`, png(square, 16));
  await writeFile(`${PUB}/favicon-32.png`, png(square, 32));
  await writeFile(`${PUB}/favicon.ico`, ico([16, 32, 48].map((s) => ({ size: s, data: png(square, s) }))));
  await writeFile(`${PUB}/apple-touch-icon.png`, png(square, 180));
  await writeFile(`${PUB}/icon-192.png`, png(square, 192));
  await writeFile(`${PUB}/icon-512.png`, png(square, 512));
  await writeFile(`${PUB}/icon-512-maskable.png`, png(maskable, 512));
  console.log("✓ build-icons: favicon.svg/.ico + apple-touch + PWA icons → public/");
}

main().catch((e) => { console.error(e); process.exit(1); });
