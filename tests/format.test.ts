import { expect, test } from "bun:test";
import { parseAmount, formatCurrency, currencySymbol } from "../src/lib/format";

test("parseAmount handles separators and currency symbols", () => {
  expect(parseAmount("72,000")).toBe(72000);
  expect(parseAmount("$72,000")).toBe(72000);
  expect(parseAmount("₹80,000")).toBe(80000);
  expect(parseAmount("  1,00,000 ")).toBe(100000); // Indian grouping
  expect(parseAmount("72000")).toBe(72000);
});

test("parseAmount handles magnitude suffixes", () => {
  expect(parseAmount("72k")).toBe(72000);
  expect(parseAmount("1.2m")).toBe(1200000);
  expect(parseAmount("1 lakh")).toBe(100000);
  expect(parseAmount("2 crore")).toBe(20000000);
  expect(parseAmount("3bn")).toBe(3000000000);
});

test("parseAmount rejects junk and zero", () => {
  expect(parseAmount("")).toBeNull();
  expect(parseAmount("abc")).toBeNull();
  expect(parseAmount(".")).toBeNull();
  expect(parseAmount("0")).toBeNull();
  expect(parseAmount(null)).toBeNull();
});

test("formatCurrency and symbol", () => {
  expect(formatCurrency(72000, "USD", "en-US")).toBe("$72,000");
  expect(formatCurrency(80000, "INR", "en-IN")).toContain("80,000");
  expect(currencySymbol("USD", "en-US")).toBe("$");
  expect(currencySymbol("INR", "en-IN")).toBe("₹");
});
