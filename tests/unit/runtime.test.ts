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

test("saved or imported settings cannot replace protocol contracts", async () => {
  const { validateSettings, DEFAULT_SETTINGS } =
    await import("../../src/config");
  const { DEFAULT_CONTRACTS } = await import("../../src/deployments");
  const address = "0x1111111111111111111111111111111111111111" as const;
  const settings = validateSettings({
    ...DEFAULT_SETTINGS,
    core: address,
    manager: address,
    freeLPDataFetcher: address,
  });
  expect(settings.core).toBe(DEFAULT_CONTRACTS.core);
  expect(settings.manager).toBe(DEFAULT_CONTRACTS.manager);
  expect(settings.freeLPDataFetcher).toBe(DEFAULT_CONTRACTS.freeLPDataFetcher);
});
