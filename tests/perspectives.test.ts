import { expect, test } from "bun:test";
import world from "../src/data/world.json";
import usa from "../public/data/countries/USA.json";
import ind from "../public/data/countries/IND.json";
import { computeReveal } from "../src/lib/rank-copy";
import { buildPerspectives, globalPerspectives } from "../src/lib/perspectives";

function sane(lines: string[]) {
  for (const l of lines) {
    expect(l).not.toContain("NaN");
    expect(l).not.toContain("undefined");
    expect(l).not.toContain("Infinity");
  }
}

test("US $72k/yr perspectives", () => {
  const r = computeReveal(world as any, usa as any, 72000, "ppp");
  const lines = buildPerspectives(world as any, usa as any, 72000, r, "ppp");
  expect(lines.length).toBeGreaterThanOrEqual(3);
  expect(lines.some((l) => /world were 100 people/.test(l))).toBe(true);
  sane(lines);
  console.log("\nUS $72k:\n  " + lines.join("\n  "));
});

test("India ₹80k/mo perspectives", () => {
  const r = computeReveal(world as any, ind as any, 80000, "ppp");
  const lines = buildPerspectives(world as any, ind as any, 80000, r, "ppp");
  expect(lines.length).toBeGreaterThanOrEqual(2);
  sane(lines);
  console.log("\nIndia ₹80k/mo:\n  " + lines.join("\n  "));
});

test("global (shared bucket) perspectives", () => {
  const lines = globalPerspectives(world as any, 7);
  sane(lines);
  expect(lines.some((l) => l.includes("93"))).toBe(true);
  console.log("\nshared /r/7:\n  " + lines.join("\n  "));
});
