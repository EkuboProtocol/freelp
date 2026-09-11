import { getAddress, isAddress, zeroAddress, type Address } from "viem";
import defaultTokens from "./default-tokens.json";
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
// Snapshot of EkuboProtocol/default-tokens, stripped of hosted logos and API data.
// Source and verification details: docs/token-defaults.md.
const lists: Record<number, Currency[]> = Object.fromEntries(
  Object.entries(defaultTokens).map(([chainId, tokens]) => [
    chainId,
    [
      eth,
      ...tokens.map((token) => ({
        ...token,
        address: getAddress(token.address.toLowerCase()),
      })),
    ],
  ]),
);
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
