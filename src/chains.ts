import * as chains from "viem/chains";
import type { Chain } from "viem";
import { DEFAULT_CONTRACTS } from "./deployments";
import type { Settings } from "./types";
// Only networks where this build's contracts are deployed and pools are
// registered. Other viem mainnets can be enabled after a code check.
export const DEFAULT_CHAIN_IDS = [4663, 8453, 42161, 1] as const;
// viem includes a few alternate definitions with the same chain ID. Keep the
// canonical first entry (for example Base, rather than Base preconfirmation).
const catalog = new Map<number, Chain>();
for (const chain of Object.values(chains)) {
  if (!catalog.has(chain.id) && chain.rpcUrls.default.http.length)
    catalog.set(chain.id, chain);
}
export const MAINNET_CHAINS = [...catalog.values()]
  .filter((chain) => !chain.testnet)
  .sort((a, b) => a.name.localeCompare(b.name));
export function chainDefinition(id: number) {
  const chain = catalog.get(id);
  if (!chain)
    throw new Error("This network is not in the supported chain catalog.");
  return chain;
}
export function chainSettings(id: number, rpcUrl = ""): Settings {
  const chain = chainDefinition(id);
  return {
    chainId: id,
    name: chain.name,
    rpcUrl,
    ...DEFAULT_CONTRACTS,
    nativeSymbol: chain.nativeCurrency.symbol,
    nativeName: chain.nativeCurrency.name,
    nativeDecimals: chain.nativeCurrency.decimals,
  };
}
export function rpcEndpoint(settings: Pick<Settings, "chainId" | "rpcUrl">) {
  return (
    settings.rpcUrl || chainDefinition(settings.chainId).rpcUrls.default.http[0]
  );
}
