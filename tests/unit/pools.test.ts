import { test, expect } from "bun:test";
import { concentratedConfig } from "../../src/pools";

test("pool input cannot overflow spacing into fee bits or round fee precision silently", () => {
  const config = BigInt(concentratedConfig("0.3", 100));
  expect(config & 0x7fffffffn).toBe(100n);
  expect((config >> 32n) & (2n ** 64n - 1n)).toBe(
    (300000n * 2n ** 64n) / 100000000n,
  );
  expect(() => concentratedConfig("0.3", 2 ** 32 + 100)).toThrow("spacing");
  expect(() => concentratedConfig("0.3", 1.5)).toThrow("spacing");
  expect(() => concentratedConfig("0.3000001", 100)).toThrow("decimal places");
  expect(() => concentratedConfig("100", 100)).toThrow("below 100%");
});
