import { retiredDefault } from "./retiredNetworks";
import { DEFAULT_CONTRACTS } from "./deployments";
import { load, save } from "./storage";
import { validateSettings } from "./config";
import type { Settings } from "./types";

export const NETWORKS = [
  {
    chainId: 4663,
    name: "Robinhood Chain",
    nativeSymbol: "ETH",
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  },
  {
    chainId: 8453,
    name: "Base",
    nativeSymbol: "ETH",
    rpcUrl: "https://mainnet.base.org",
  },
  {
    chainId: 42161,
    name: "Arbitrum",
    nativeSymbol: "ETH",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
  },
  {
    chainId: 1,
    name: "Ethereum",
    nativeSymbol: "ETH",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
  },
  {
    chainId: 10,
    name: "Optimism",
    rpcUrl: "https://mainnet.optimism.io",
    nativeSymbol: "ETH",
  },
  {
    chainId: 56,
    name: "BNB Smart Chain",
    rpcUrl: "https://bsc-rpc.publicnode.com",
    nativeSymbol: "BNB",
  },
  {
    chainId: 100,
    name: "Gnosis",
    rpcUrl: "https://rpc.gnosischain.com",
    nativeSymbol: "XDAI",
  },
  {
    chainId: 130,
    name: "Unichain",
    rpcUrl: "https://mainnet.unichain.org",
    nativeSymbol: "ETH",
  },
  {
    chainId: 137,
    name: "Polygon",
    rpcUrl: "https://polygon-bor-rpc.publicnode.com",
    nativeSymbol: "POL",
  },
  {
    chainId: 143,
    name: "Monad",
    rpcUrl: "https://rpc.monad.xyz",
    nativeSymbol: "MON",
  },
  {
    chainId: 57073,
    name: "Ink",
    rpcUrl: "https://rpc-gel.inkonchain.com",
    nativeSymbol: "ETH",
  },
] as const;
export function networkName(chainId: number, name?: string) {
  return (
    name ||
    NETWORKS.find((network) => network.chainId === chainId)?.name ||
    `Chain ${chainId}`
  );
}
export function loadNetworks(): Settings[] {
  const defaults: Settings[] = NETWORKS.map((network) => ({
    ...network,
    ...DEFAULT_CONTRACTS,
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
  if (retiredDefault(next)) return;
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
