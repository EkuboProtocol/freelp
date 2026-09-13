import { expect, test } from "bun:test";
import { changeCreateToken, changeRangeMode } from "../../src/createIntent";
import { defaultCreateForm } from "../../src/createForm";
import { rangeTicks } from "../../src/prices";

const a = "0x1111111111111111111111111111111111111111";
const b = "0x2222222222222222222222222222222222222222";
const c = "0x3333333333333333333333333333333333333333";
test("replacing a token clears pair-dependent values even when address order reverses", () => {
  const form = { ...defaultCreateForm(1), a, b, maxA: "4", maxB: "9" };
  const next = changeCreateToken(form, 0, c);
  expect([next.a, next.b]).toEqual([b, c]);
  expect(next.range.prices).toEqual(["", "", ""]);
  expect(next.range.ticks).toEqual(["", "", ""]);
  expect([next.maxA, next.maxB]).toEqual(["", ""]);
  expect(changeCreateToken(form, 0, a)).toBe(form);
  expect(() => changeCreateToken(form, 0, b)).toThrow("different tokens");
});
test("price/tick mode changes preserve valid bounds including differing token decimals", () => {
  const range = {
    ...defaultCreateForm(1).range,
    spacing: 100,
    prices: ["2000", "3000", "2500"] as [string, string, string],
  };
  const before = rangeTicks(range, 18, 6);
  const raw = changeRangeMode(range, [18, 6]);
  expect(raw.raw).toBe(true);
  expect(rangeTicks(raw, 18, 6)).toEqual(before);
  expect(rangeTicks(changeRangeMode(raw, [18, 6]), 18, 6)).toEqual(before);
});
