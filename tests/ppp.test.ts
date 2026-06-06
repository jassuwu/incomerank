import { expect, test } from "bun:test";
import { toDailyIntl, usMonthlyBuyingPower } from "../src/lib/ppp";

test("annual income → daily intl$ (US, ppp=1)", () => {
  expect(toDailyIntl(72000, "annual", 1)).toBeCloseTo(72000 / 365, 6);
});

test("monthly income annualizes before converting", () => {
  expect(toDailyIntl(80000, "monthly", 19.469)).toBeCloseTo((80000 * 12) / 365 / 19.469, 6);
});

test("PPP factor divides the income (cheaper country → more intl$)", () => {
  expect(toDailyIntl(365, "annual", 0.5)).toBeCloseTo(2, 6);
});

test("US monthly buying power equals income/12 when ppp=1", () => {
  expect(usMonthlyBuyingPower(72000, "annual", 1)).toBeCloseTo(6000, 6);
});
