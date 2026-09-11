import { test, expect } from "bun:test";
import {
  createFormHash,
  defaultCreateForm,
  readCreateForm,
} from "../../src/createForm";
import { poolConfig, poolRange, stableBounds } from "../../src/poolOptions";

test("every create form field round-trips through a gateway-safe hash", () => {
  const form = {
    ...defaultCreateForm(8453),
    a: "0x123",
    b: "0x456",
    maxA: "0.000000000000000001",
    maxB: "23",
    specified: 1 as const,
    kind: "stable" as const,
    extension: "0xabcdef0123456789abcdef0123456789abcdef01",
    fee: "0.123456789",
    exactFee: "18446744073709551615",
    center: "-160",
    amplification: "26",
    slippage: 73,
    fallbackA: "18",
    fallbackB: "6",
    range: {
      raw: true,
      full: true,
      spacing: 777,
      prices: ["0.12", "45", "1"] as [string, string, string],
      ticks: ["-777", "1554", "0"] as [string, string, string],
    },
  };
  expect(readCreateForm(createFormHash(form), 1)).toEqual(form);
  expect(createFormHash(form)).not.toContain("rpc");
  expect(readCreateForm("#/create?chain=garbage&kind=unknown", 1).chain).toBe(
    1,
  );
});
test("arbitrary fee bits and extension addresses survive both pool encodings", () => {
  const form = {
    ...defaultCreateForm(1),
    extension: "0x1234567890123456789012345678901234567890",
    exactFee: "18446744073709551615",
  };
  const packed = BigInt(poolConfig("0", 777, form));
  expect(packed >> 96n).toBe(BigInt(form.extension));
  expect((packed >> 32n) & ((1n << 64n) - 1n)).toBe((1n << 64n) - 1n);
  expect(packed & 0xffffffffn).toBe(0x80000000n | 777n);
  const stable = {
    ...form,
    kind: "stable" as const,
    amplification: "10",
    center: "-160",
  };
  expect(BigInt(poolConfig("0", 777, stable)) & 0xffffffffn).toBe(
    (10n << 24n) | 0xfffff6n,
  );
  expect(stableBounds(stable)).toEqual({ lower: -86803, upper: 86483 });
  expect(
    poolRange({ ...form.range, prices: ["", "", "1"] }, 18, 18, false, stable),
  ).toEqual({ lower: -86803, upper: 86483, initial: 0 });
  expect(() => poolConfig("0", 777, { ...stable, center: "1" })).toThrow();
  expect(() =>
    poolConfig("0", 777, { ...stable, exactFee: (1n << 64n).toString() }),
  ).toThrow();
});
