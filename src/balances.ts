import type { Address } from "viem";
import tokenFetcher from "../artifacts/FreeLPDataFetcher.json" with { type: "json" };
import { DEFAULT_POSITION_DATA_FETCHER } from "./deployments";
import { rpc } from "./rpc";
import type { Settings } from "./types";
const cache = new Map<
  string,
  {
    expires: number;
    value: Promise<{
      balances: Map<string, bigint>;
      allowances: Map<string, bigint>;
    }>;
  }
>();
// The official interface uses this same sparse balance query. No token API or per-token requests.
export function tokenSnapshot(
  settings: Settings,
  owner: Address,
  tokens: Address[],
  revision: number,
  refresh: number,
) {
  const key = JSON.stringify([
    settings.chainId,
    settings.rpcUrl,
    settings.manager,
    (settings.freeLPDataFetcher ?? DEFAULT_POSITION_DATA_FETCHER).toLowerCase(),
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
  const [balances, allowances] = (await rpc(settings).readContract({
    address: settings.freeLPDataFetcher ?? DEFAULT_POSITION_DATA_FETCHER,
    abi: tokenFetcher.abi,
    functionName: "getNonzeroBalancesAndAllowances",
    args: [owner, tokens, [settings.manager]],
  })) as [
    { token: Address; amount: bigint }[],
    { token: Address; amount: bigint }[],
  ];
  const result = new Map(tokens.map((address) => [address.toLowerCase(), 0n]));
  for (const balance of balances)
    result.set(balance.token.toLowerCase(), balance.amount);
  return {
    balances: result,
    allowances: new Map(
      allowances.map((entry) => [entry.token.toLowerCase(), entry.amount]),
    ),
  };
}

export async function tokenBalances(
  settings: Settings,
  owner: Address,
  tokens: Address[],
  revision: number,
  refresh: number,
) {
  return (await tokenSnapshot(settings, owner, tokens, revision, refresh))
    .balances;
}
