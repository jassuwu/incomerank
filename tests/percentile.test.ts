import { expect, test } from "bun:test";
import world from "../src/data/world.json";
import usa from "../public/data/countries/USA.json";
import type { WorldData, CountryData } from "../src/lib/types";
import { globalTopPercent, localTopPercent } from "../src/lib/percentile";
import { toDailyIntl } from "../src/lib/ppp";

const W = world as unknown as WorldData;
const US = usa as unknown as CountryData;

test("US $72k single ≈ global top 0.7% (anchor ~0.6%)", () => {
  const top = globalTopPercent(W.cdf, toDailyIntl(72000, "annual", US.ppp2021));
  expect(top).toBeGreaterThan(0.4);
  expect(top).toBeLessThan(1.1);
});

test("US $30k single ≈ global top ~5% (anchor ~4–5%)", () => {
  const top = globalTopPercent(W.cdf, toDailyIntl(30000, "annual", US.ppp2021));
  expect(top).toBeGreaterThan(3.5);
  expect(top).toBeLessThan(6);
});

test("world anchor: $52.5/day ≈ global top 10%", () => {
  const top = globalTopPercent(W.cdf, 52.5);
  expect(top).toBeGreaterThan(8);
  expect(top).toBeLessThan(12);
});

test("global top % is strictly decreasing in income", () => {
  const tops = [10000, 30000, 72000, 200000, 500000].map((a) =>
    globalTopPercent(W.cdf, toDailyIntl(a, "annual", 1)),
  );
  for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeLessThan(tops[i - 1]);
});

test("local top % differentiates high earners (Q10)", () => {
  const at200k = localTopPercent(US, toDailyIntl(200000, "annual", US.ppp2021));
  const at500k = localTopPercent(US, toDailyIntl(500000, "annual", US.ppp2021));
  expect(at500k).toBeLessThan(at200k);
  expect(at200k).toBeLessThan(5);
});
