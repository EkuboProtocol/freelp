import type { Address } from "viem";
import tokenFetcher from "../artifacts/TokenDataFetcher.json" with { type: "json" };
import { DEFAULT_TOKEN_DATA_FETCHER } from "./deployments";
import { rpc } from "./rpc";
import type { Settings } from "./types";
const cache = new Map<
  string,
  { expires: number; value: Promise<Map<string, bigint>> }
>();
// The official interface uses this same sparse balance query. No token API or per-token requests.
export function tokenBalances(
  settings: Settings,
  owner: Address,
  tokens: Address[],
  revision: number,
  refresh: number,
) {
  const key = JSON.stringify([
    settings.chainId,
    settings.rpcUrl,
    (settings.tokenDataFetcher ?? DEFAULT_TOKEN_DATA_FETCHER).toLowerCase(),
    owner.toLowerCase(),
    tokens.map((address) => address.toLowerCase()),
    revision,
    refresh,
  ]);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = readBalances(settings, owner, tokens);
  cache.set(key, { expires: Date.now() + 30000, value });
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  void value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key);
  });
  return value;
}
async function readBalances(
  settings: Settings,
  owner: Address,
  tokens: Address[],
) {
  const [balances] = (await rpc(settings).readContract({
    address: settings.tokenDataFetcher ?? DEFAULT_TOKEN_DATA_FETCHER,
    abi: tokenFetcher.abi,
    functionName: "getNonzeroBalancesAndAllowances",
    args: [owner, tokens, []],
  })) as [{ token: Address; amount: bigint }[], unknown[]];
  const result = new Map(tokens.map((address) => [address.toLowerCase(), 0n]));
  for (const balance of balances)
    result.set(balance.token.toLowerCase(), balance.amount);
  return result;
}
