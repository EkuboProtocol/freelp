import { test, expect } from "bun:test";
import {
  DEFAULT_RANGE,
  rangeTicks,
  priceToTick,
  tickPrice,
  sqrtPrice,
} from "../../src/prices";

test("prices scale token decimals and round ranges outward", () => {
  const lower = priceToTick("1000", 18, 6, 100, "floor");
  const upper = priceToTick("2000", 18, 6, 100, "ceil");
  expect(lower % 100).toBe(-0);
  expect(upper % 100).toBe(-0);
  expect(tickPrice(lower, 18, 6)).toBeLessThanOrEqual(1000);
  expect(tickPrice(upper, 18, 6)).toBeGreaterThanOrEqual(2000);
  expect(sqrtPrice(1n << 128n, 18, 6)).toBe(1e12);
  expect(sqrtPrice(2n << 128n, 6, 18)).toBe(4e-12);
  expect(priceToTick("1", 18, 18, 1, "round")).toBe(0);
});

test("full range preserves initialization and existing pools ignore that input", () => {
  const full = rangeTicks(
    { ...DEFAULT_RANGE, full: true, prices: ["", "", "2"] },
    18,
    18,
  );
  expect(full.lower).toBe(-88719042);
  expect(full.upper).toBe(88719042);
  expect(tickPrice(full.initial, 18, 18)).toBeCloseTo(2, 5);
  expect(
    rangeTicks(
      { ...DEFAULT_RANGE, prices: ["0.99", "1.01", "invalid"] },
      18,
      18,
      true,
    ).initial,
  ).toBe(0);
  expect(() =>
    rangeTicks(
      { ...DEFAULT_RANGE, raw: true, ticks: ["1", "100", "0"] },
      18,
      18,
    ),
  ).toThrow("align");
  expect(() => priceToTick("Infinity", 18, 18, 1, "round")).toThrow("finite");
  expect(() => priceToTick("0", 18, 18, 1, "round")).toThrow("positive");
  expect(() => priceToTick("1e300", 0, 0, 1, "round")).toThrow(
    "supported range",
  );
});
