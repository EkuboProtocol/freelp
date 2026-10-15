import { useEffect, useSyncExternalStore } from "react";
import { isAddress, type Address } from "viem";

export type BundledToken = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
};

const catalog = new Map<number, BundledToken[]>();
const pending = new Map<number, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version++;
  for (const listener of listeners) listener();
}

export function bundledTokens(chainId: number) {
  return catalog.get(chainId);
}

export function tokenCatalogLoaded(chainId: number) {
  return catalog.has(chainId);
}

export function primeTokenCatalog(chainId: number, tokens: BundledToken[]) {
  catalog.set(chainId, validateTokens(tokens));
  notify();
}

function validateTokens(input: unknown): BundledToken[] {
  if (!Array.isArray(input)) throw new Error("Invalid token catalog.");
  return input.filter(
    (token): token is BundledToken =>
      !!token &&
      typeof token === "object" &&
      isAddress(token.address, { strict: false }) &&
      typeof token.symbol === "string" &&
      typeof token.name === "string" &&
      Number.isInteger(token.decimals) &&
      token.decimals >= 0 &&
      token.decimals <= 255,
  );
}

export function tokenCatalogUrl(chainId: number) {
  return new URL(`tokens/${chainId}.json`, document.baseURI);
}

export function loadTokenCatalog(chainId: number): Promise<void> {
  if (catalog.has(chainId) || typeof document === "undefined")
    return Promise.resolve();
  const existing = pending.get(chainId);
  if (existing) return existing;
  const request = fetch(tokenCatalogUrl(chainId), { redirect: "error" })
    .then(async (response) => {
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("json")) return [];
      return validateTokens(await response.json());
    })
    .catch((error: unknown): BundledToken[] => {
      console.warn(`Token catalog for chain ${chainId} unavailable.`, error);
      return [];
    })
    .then((tokens) => {
      catalog.set(chainId, tokens);
      notify();
    })
    .finally(() => pending.delete(chainId));
  pending.set(chainId, request);
  return request;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTokenCatalog(chainId: number) {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  useEffect(() => {
    void loadTokenCatalog(chainId);
  }, [chainId]);
  return catalog.has(chainId);
}
