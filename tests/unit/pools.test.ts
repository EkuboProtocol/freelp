import { test, expect } from "bun:test";
import { poolConfig } from "../../src/poolOptions";
import { defaultCreateForm } from "../../src/createForm";
const concentratedConfig = (fee: string, spacing: number) =>
  poolConfig(fee, spacing, defaultCreateForm(1));

test("pool input rejects invalid fee precision and spacing overflow", () => {
  const config = BigInt(concentratedConfig("0.3", 100));
  expect(config & 0x7fffffffn).toBe(100n);
  expect((config >> 32n) & (2n ** 64n - 1n)).toBe(
    (300000n * 2n ** 64n) / 100000000n,
  );
  expect(() => concentratedConfig("0.3", 2 ** 32 + 100)).toThrow("spacing");
  expect(() => concentratedConfig("0.3", 1.5)).toThrow("spacing");
  expect(() => concentratedConfig("0." + "1".repeat(65), 100)).toThrow(
    "Invalid pool fee",
  );
  expect(() => concentratedConfig("100", 100)).toThrow("Invalid pool fee");
});
