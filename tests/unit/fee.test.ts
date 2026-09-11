import { poolConfig } from "../../src/poolOptions";
import { defaultCreateForm } from "../../src/createForm";
import { test, expect } from "bun:test";
import { exactFeeFromPercent, percentFromExactFee } from "../../src/fee";
test("exact fee conversion preserves every uint64 bit through percentage notation", () => {
  for (const fee of [0n, 1n, 123456789n, 18446744073709551615n])
    expect(exactFeeFromPercent(percentFromExactFee(fee.toString()))).toBe(
      fee.toString(),
    );
  expect(exactFeeFromPercent("0.3")).toBe("55340232221128654");
  expect(exactFeeFromPercent("100")).toBe("");
  expect(percentFromExactFee("18446744073709551616")).toBe("");
});

test("displayed exact fee is the fee encoded into a pool key", () => {
  for (const exact of ["1", "123456789", "18446744073709551615"]) {
    const config = BigInt(
      poolConfig(percentFromExactFee(exact), 100, defaultCreateForm(1)),
    );
    expect((config >> 32n) & ((1n << 64n) - 1n)).toBe(BigInt(exact));
  }
});
