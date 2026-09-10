import { getAddress, isAddress, zeroAddress, type Address } from "viem";
import { load, save } from "./storage";
export type Currency = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
};
const eth: Currency = {
  address: zeroAddress,
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
};
const currency = (
  address: string,
  symbol: string,
  name: string,
  decimals: number,
): Currency => ({
  address: getAddress(address.toLowerCase()),
  symbol,
  name,
  decimals,
});
// Canonical addresses, bundled locally. No token-list or logo service is queried.
const lists: Record<number, Currency[]> = {
  1: [
    eth,
    currency(
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "WETH",
      "Wrapped Ether",
      18,
    ),
    currency(
      "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "USDC",
      "USD Coin",
      6,
    ),
    currency(
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "USDT",
      "Tether USD",
      6,
    ),
    currency("0x6B175474E89094C44Da98b954EedeAC495271d0F", "DAI", "Dai", 18),
  ],
  8453: [
    eth,
    currency(
      "0x4200000000000000000000000000000000000006",
      "WETH",
      "Wrapped Ether",
      18,
    ),
    currency(
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "USDC",
      "USD Coin",
      6,
    ),
  ],
  42161: [
    eth,
    currency(
      "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      "WETH",
      "Wrapped Ether",
      18,
    ),
    currency(
      "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "USDC",
      "USD Coin",
      6,
    ),
  ],
  4663: [
    eth,
    currency(
      "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
      "WETH",
      "Wrapped Ether",
      18,
    ),
  ],
};
export function currencies(chainId: number): Currency[] {
  const imported = load<Currency[]>(`freelp:tokens:${chainId}`, []);
  const valid = Array.isArray(imported)
    ? imported.filter(
        (token) =>
          isAddress(token?.address ?? "") &&
          typeof token.symbol === "string" &&
          typeof token.name === "string" &&
          Number.isInteger(token.decimals) &&
          token.decimals >= 0 &&
          token.decimals <= 255,
      )
    : [];
  const merged = new Map(
    (lists[chainId] ?? [eth]).map((token) => [
      token.address.toLowerCase(),
      token,
    ]),
  );
  for (const token of valid)
    if (!merged.has(token.address.toLowerCase()))
      merged.set(token.address.toLowerCase(), token);
  return [...merged.values()];
}
export function importCurrency(chainId: number, token: Currency) {
  const next = {
    ...token,
    address: getAddress(token.address),
    symbol: token.symbol.trim().slice(0, 32),
    name: token.name.trim().slice(0, 80),
  };
  if (
    !next.symbol ||
    !Number.isInteger(next.decimals) ||
    next.decimals < 0 ||
    next.decimals > 255
  )
    throw new Error("Enter a symbol and decimals between 0 and 255.");
  save(`freelp:tokens:${chainId}`, [
    ...currencies(chainId).filter((entry) => entry.address !== next.address),
    next,
  ]);
  return next;
}
