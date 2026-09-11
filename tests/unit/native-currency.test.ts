import { expect, test } from "bun:test";
import { zeroAddress } from "viem";
import { validateSettings, DEFAULT_SETTINGS } from "../../src/config";
import { networkCurrencies } from "../../src/tokens";
import { parseAmount } from "../../src/amounts";
import { displayAmount } from "../../src/displayAmount";
test("custom native metadata controls token units and survives normalized settings", () => {
  const settings = validateSettings({
    ...DEFAULT_SETTINGS,
    chainId: 98765,
    nativeSymbol: "TST",
    nativeName: "Test Coin",
    nativeDecimals: 6,
  });
  const native = networkCurrencies(settings).find(
    (token) => token.address === zeroAddress,
  )!;
  expect(native).toMatchObject({
    symbol: "TST",
    name: "Test Coin",
    decimals: 6,
  });
  expect(parseAmount("1.25", native.decimals)).toBe(1250000n);
  expect(displayAmount(1250000n, native.decimals)).toBe("1.25");
  expect(
    validateSettings({ ...settings, nativeDecimals: 0 }).nativeDecimals,
  ).toBe(0);
  expect(validateSettings(DEFAULT_SETTINGS).nativeDecimals).toBe(18);
  for (const nativeDecimals of [-1, 256, 1.5, NaN])
    expect(() => validateSettings({ ...settings, nativeDecimals })).toThrow(
      "decimals",
    );
});
