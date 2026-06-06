import { expect, test } from "bun:test";
import world from "../src/data/world.json";
import usa from "../public/data/countries/USA.json";
import ind from "../public/data/countries/IND.json";
import {
  computeReveal, formatTopPercent, topToBucket, topToPercentile, formatPeople, ordinal,
} from "../src/lib/rank-copy";

test("formatTopPercent labels", () => {
  expect(formatTopPercent(7.3)).toBe("7%");
  expect(formatTopPercent(0.72)).toBe("0.7%");
  expect(formatTopPercent(0.04)).toBe("0.1%");
  expect(formatTopPercent(52)).toBe("52%");
});

test("bucket + percentile clamp to 1..99", () => {
  expect(topToBucket(0.72)).toBe(1);
  expect(topToBucket(7.3)).toBe(7);
  expect(topToPercentile(0.72)).toBe(99);
  expect(topToPercentile(4.8)).toBe(95);
});

test("formatPeople + ordinal", () => {
  expect(formatPeople(7.5e9)).toBe("7.5 billion");
  expect(formatPeople(120e6)).toBe("120 million");
  expect(ordinal(1)).toBe("1st");
  expect(ordinal(11)).toBe("11th");
  expect(ordinal(93)).toBe("93rd");
});

test("buying-power line is contextual: India shows, US hides", () => {
  const us = computeReveal(world as any, usa as any, 72000, "ppp");
  const india = computeReveal(world as any, ind as any, 80000, "ppp");
  expect(us.showBuyingPower).toBe(false);
  expect(india.showBuyingPower).toBe(true);
});

test("India ₹80k/mo: global top 1–3%, local percentile clamped ≤99", () => {
  const india = computeReveal(world as any, ind as any, 80000, "ppp");
  expect(india.globalTop).toBeGreaterThan(1);
  expect(india.globalTop).toBeLessThan(3);
  expect(india.localPercentile).toBeLessThanOrEqual(99);
});
