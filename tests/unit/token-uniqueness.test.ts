import { test, expect } from "bun:test";
import { zeroAddress, getAddress } from "viem";
import {
  currencies,
  importCurrency,
  ensureNativeCurrency,
} from "../../src/tokens";
import { DEFAULT_CONTRACTS } from "../../src/deployments";
test("token imports and network saves persist one native token and unique case-insensitive addresses per chain", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });
  try {
    const address = getAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    const secondAddress = getAddress(
      "0x1234567890123456789012345678901234567890",
    );
    const token = { address, name: "Test", symbol: "T", decimals: 6 };
    store.set(
      "freelp:tokens:31337",
      JSON.stringify([token, { ...token, address: address.toLowerCase() }]),
    );
    importCurrency(31337, token);
    importCurrency(31338, { ...token, symbol: "OTHER" });
    importCurrency(31337, {
      address: secondAddress,
      name: "Test",
      symbol: "T",
      decimals: 18,
    });
    const settings = {
      ...DEFAULT_CONTRACTS,
      chainId: 31337,
      rpcUrl: "http://localhost",
      nativeSymbol: "GAS",
      nativeName: "Gas coin",
      nativeDecimals: 6,
    };
    ensureNativeCurrency(settings);
    ensureNativeCurrency(settings);
    const saved = JSON.parse(
      store.get("freelp:tokens:31337")!,
    ) as (typeof token)[];
    expect(
      saved.filter((t) => t.address.toLowerCase() === address.toLowerCase()),
    ).toHaveLength(1);
    expect(saved.filter((t) => t.symbol === "T")).toHaveLength(2);
    expect(saved.filter((t) => t.address === zeroAddress)).toEqual([
      { address: zeroAddress, symbol: "GAS", name: "Gas coin", decimals: 6 },
    ]);
    expect(currencies(31337).find((t) => t.address === address)?.source).toBe(
      "imported",
    );
    expect(currencies(31338).find((t) => t.address === address)?.symbol).toBe(
      "OTHER",
    );
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
