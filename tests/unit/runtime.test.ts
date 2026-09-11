import { test, expect } from "bun:test";
import { expectedRuntime, assertRuntime } from "../../src/runtime";
import artifact from "../../artifacts/FreeLP.json" with { type: "json" };
import type { Hex } from "viem";
test("all immutable bindings must match, including the accountant", () => {
  const core = "0x0000000000000000000000000000000000000123";
  const code = expectedRuntime(artifact, core);
  expect(() => assertRuntime(artifact, code, core)).not.toThrow();
  const offset =
    Object.values(artifact.immutableReferences)[1][0].start * 2 + 2;
  const changed = (code.slice(0, offset) +
    "00".repeat(31) +
    "ff" +
    code.slice(offset + 64)) as Hex;
  expect(() => assertRuntime(artifact, changed, core)).toThrow("binding");
});

import { parseAmount } from "../../src/amounts";
test("amount parsing never silently rounds user maxima", () => {
  expect(parseAmount("1.25", 2)).toBe(125n);
  for (const value of ["1.251", "-1", "1e3", "NaN"])
    expect(() => parseAmount(value, 2)).toThrow();
  expect(() => parseAmount("1", 256)).toThrow();
});

test("legacy and omitted readers follow a custom Core without replacing custom readers", async () => {
  const { validateSettings, DEFAULT_SETTINGS } =
    await import("../../src/config");
  const { deploymentAddress } = await import("../../src/deterministic");
  const core = "0x1111111111111111111111111111111111111111" as const;
  const expected = deploymentAddress("FreeLPDataFetcher", core);
  for (const freeLPDataFetcher of [
    undefined,
    "0xaf388FFa60a69D0bc59E0D31a9313D28EB8E3b18",
  ] as const) {
    expect(
      validateSettings({ ...DEFAULT_SETTINGS, core, freeLPDataFetcher })
        .freeLPDataFetcher,
    ).toBe(expected);
  }
  expect(
    validateSettings({ ...DEFAULT_SETTINGS, core, freeLPDataFetcher: core })
      .freeLPDataFetcher,
  ).toBe(core);
});
