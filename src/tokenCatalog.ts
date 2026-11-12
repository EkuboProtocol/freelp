import { isAddress, type Address } from "viem";

export type BundledToken = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
};

const catalog = new Map<number, BundledToken[]>();
const pending = new Map<number, Promise<void>>();
let version = 0;
export const catalogVersion = () => version;
function notify() {
  version++;
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

export type CatalogFetch = (
  path: string,
) => Promise<{ status: number; type: string; text: string }>;
let fetchAsset: CatalogFetch | undefined;
// The app's own files are the page's, fetched relative to the document.
export function setCatalogFetch(next: CatalogFetch) {
  fetchAsset = next;
}

export function loadTokenCatalog(chainId: number): Promise<void> {
  if (catalog.has(chainId) || !fetchAsset) return Promise.resolve();
  const existing = pending.get(chainId);
  if (existing) return existing;
  const request = fetchAsset(`tokens/${chainId}.json`)
    .then((response) => {
      if (response.status !== 200 || !response.type.includes("json")) return [];
      return validateTokens(JSON.parse(response.text));
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
