import { i18n } from "@lingui/core";
import { expect, test } from "bun:test";
import { zeroAddress, toHex } from "viem";
import { defaultCreateForm } from "../../src/createForm";
import { snapCreateForm, snapPrice, snapTick } from "../../src/snapCreateForm";
import { priceToTick } from "../../src/prices";
import { parseAmount } from "../../src/amounts";
import { errorMessage } from "../../src/errors";
const tokens = [
  { address: zeroAddress, name: "Ether", symbol: "ETH", decimals: 18 },
  { address: toHex(1, { size: 20 }), name: "USD", symbol: "USD", decimals: 6 },
];
test("URL numeric values snap without mutating source parameters", () => {
  const source = {
    ...defaultCreateForm(8453),
    a: tokens[0].address,
    b: tokens[1].address,
    center: "31",
    amplification: "99",
    slippage: 1001,
    exactFee: String(1n << 64n),
    range: {
      ...defaultCreateForm(8453).range,
      spacing: 777.4,
      raw: true,
      ticks: ["-1000", "1000", "2.7"] as [string, string, string],
    },
  };
  const saved = JSON.stringify(source);
  const snapped = snapCreateForm(source, tokens);
  expect(snapped.range.spacing).toBe(777);
  expect(snapped.range.ticks).toEqual(["-777", "777", "3"]);
  expect(snapped.center).toBe("32");
  expect(snapped.amplification).toBe("26");
  expect(snapped.exactFee).toBe(String((1n << 64n) - 1n));
  expect(snapped.slippage).toBe(1000);
  expect(JSON.stringify(source)).toBe(saved);
});
test("snapped decimal prices round-trip to the nearest usable tick", () => {
  for (const spacing of [1, 777, 5982, 698605]) {
    const price = snapPrice("2345.6789", 18, 6, spacing);
    expect(
      Math.abs(priceToTick(price, 18, 6, spacing, "round") % spacing),
    ).toBe(0);
    expect(snapPrice(price, 18, 6, spacing)).toBe(price);
  }
  expect(snapTick("-88722835", 777)).toBe("-88722522");
});
test("amount typing accepts leading and trailing decimal points but rejects invalid values", () => {
  expect(parseAmount(".25", 6)).toBe(250000n);
  expect(parseAmount("1.", 6)).toBe(1000000n);
  for (const value of [".", "-1", "1e3", "NaN", "1.0000001"])
    expect(() => parseAmount(value, 6)).toThrow();
});
test("RPC diagnostic data stays out of user-facing errors", () => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  const text = errorMessage(
    new Error(
      "RPC Request failed.\nURL: https://secret.example/key\nRequest body: {}\nDetails: over rate limit",
    ),
  );
  expect(text).toContain("RPC is busy");
  expect(text).not.toContain("https");
});

test("collapsed URL ranges become one usable interval without changing the source", () => {
  const source = {
    ...defaultCreateForm(8453),
    a: tokens[0].address,
    b: tokens[1].address,
    range: {
      ...defaultCreateForm(8453).range,
      raw: true,
      ticks: ["0", "0", "0"] as [string, string, string],
    },
  };
  const result = snapCreateForm(source, tokens);
  expect(Number(result.range.ticks[1]) - Number(result.range.ticks[0])).toBe(
    result.range.spacing,
  );
  expect(source.range.ticks).toEqual(["0", "0", "0"]);
});
