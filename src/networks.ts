import { DEFAULT_CORE } from "./deployments";
import { zeroAddress } from "viem";
import { load, save } from "./storage";
import { validateSettings } from "./config";
import type { Settings } from "./types";

export const NETWORKS = [
  {
    chainId: 4663,
    name: "Robinhood Chain",
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  },
  { chainId: 8453, name: "Base", rpcUrl: "https://mainnet.base.org" },
  { chainId: 42161, name: "Arbitrum", rpcUrl: "https://arb1.arbitrum.io/rpc" },
  {
    chainId: 1,
    name: "Ethereum",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
  },
] as const;
export function networkName(chainId: number) {
  return (
    NETWORKS.find((network) => network.chainId === chainId)?.name ??
    `Chain ${chainId}`
  );
}
export function loadNetworks(): Settings[] {
  const defaults: Settings[] = NETWORKS.map((network) => ({
    ...network,
    core: DEFAULT_CORE,
    manager: zeroAddress,
    nativeSymbol: "ETH",
  }));
  const saved = load<Settings[]>("freelp:networks", []);
  for (const candidate of Array.isArray(saved) ? saved : []) {
    try {
      putNetwork(defaults, validateSettings(candidate));
    } catch {
      /* Keep usable defaults. */
    }
  }
  const legacy = load<Settings | null>("freelp:settings", null);
  if (legacy) {
    try {
      putNetwork(defaults, validateSettings(legacy));
    } catch {
      /* Ignore invalid legacy settings. */
    }
  }
  return defaults;
}
function putNetwork(networks: Settings[], next: Settings) {
  const index = networks.findIndex(
    (network) => network.chainId === next.chainId,
  );
  if (index < 0) networks.push(next);
  else networks[index] = next;
}
export function updateNetworks(networks: Settings[], next: Settings) {
  const result = [...networks];
  putNetwork(result, validateSettings(next));
  save("freelp:networks", result);
  return result;
}
