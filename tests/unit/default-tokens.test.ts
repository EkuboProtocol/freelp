import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAddress, zeroAddress, type Address } from "viem";
import { chainDefinition, DEFAULT_CHAIN_IDS } from "../../src/chains";
import { currencies } from "../../src/tokens";
import { primeTokenCatalog, type BundledToken } from "../../src/tokenCatalog";

const directory = resolve(import.meta.dirname, "../../public/tokens");
const files = Object.fromEntries(
  readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => [
      name.slice(0, -5),
      JSON.parse(
        readFileSync(resolve(directory, name), "utf8"),
      ) as BundledToken[],
    ]),
);

// The runtime trusts these addresses without hashing them, so the files must
// already be checksummed, unique per chain, and free of native currency.
test("bundled token files are checksummed, unique per chain, and exclude native and wrapped-native entries", () => {
  for (const [chainId, tokens] of Object.entries(files)) {
    const seen = new Set<string>();
    const wrapped = `W${chainDefinition(Number(chainId)).nativeCurrency.symbol}`;
    for (const token of tokens) {
      expect(getAddress(token.address as Address)).toBe(token.address);
      expect(token.address).not.toBe(zeroAddress);
      expect(seen.has(token.address.toLowerCase())).toBe(false);
      seen.add(token.address.toLowerCase());
      expect(token.symbol.toUpperCase()).not.toBe(wrapped.toUpperCase());
      expect(Number.isInteger(token.decimals)).toBe(true);
    }
  }
  for (const chainId of DEFAULT_CHAIN_IDS)
    expect(files[String(chainId)].length).toBeGreaterThan(100);
});

test("USDG is bundled on Ethereum and Robinhood Chain, and lists are empty until a catalog loads", () => {
  expect(currencies(4663).length).toBe(1);
  for (const chainId of [1, 4663]) {
    primeTokenCatalog(chainId, files[String(chainId)]);
    expect(currencies(chainId).some((token) => token.symbol === "USDG")).toBe(
      true,
    );
    expect(currencies(chainId).length).toBe(files[String(chainId)].length + 1);
  }
});
