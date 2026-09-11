import { expect, test } from "bun:test";
import { zeroAddress } from "viem";
import { validateSettings, DEFAULT_SETTINGS } from "../../src/config";
import { chainDefinition } from "../../src/chains";
import { networkCurrencies } from "../../src/tokens";
test("network metadata and zero-address native currency come from viem", () => {
  const settings = validateSettings({
    ...DEFAULT_SETTINGS,
    chainId: 56,
    nativeSymbol: "WRONG",
    nativeName: "Custom",
    nativeDecimals: 6,
  });
  const native = networkCurrencies(settings).find(
    (token) => token.address === zeroAddress,
  )!;
  expect(native).toMatchObject(chainDefinition(56).nativeCurrency);
  expect(settings.rpcUrl).toBe("");
  expect(settings.name).toBe(chainDefinition(56).name);
  expect(validateSettings(DEFAULT_SETTINGS).nativeDecimals).toBe(18);
  expect(() =>
    validateSettings({ ...settings, chainId: 987654321987 }),
  ).toThrow("catalog");
});
