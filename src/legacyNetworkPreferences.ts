import { load } from "./storage";
import { chainDefinition, DEFAULT_CHAIN_IDS, rpcEndpoint } from "./chains";
import { validateSettings } from "./config";
import type { Settings } from "./types";
// These were bundled defaults, never user-selected overrides. Used only to
// migrate old storage; all current default URLs come from viem.
const oldDefaults = new Set([
  "https://rpc.mainnet.chain.robinhood.com",
  "https://mainnet.base.org",
  "https://arb1.arbitrum.io/rpc",
  "https://ethereum-rpc.publicnode.com",
  "https://mainnet.optimism.io",
  "https://bsc-rpc.publicnode.com",
  "https://rpc.gnosischain.com",
  "https://mainnet.unichain.org",
  "https://polygon-bor-rpc.publicnode.com",
  "https://rpc.monad.xyz",
  "https://rpc-gel.inkonchain.com",
]);
export function legacyNetworkPreferences() {
  const enabled = new Set<number>(DEFAULT_CHAIN_IDS);
  const rpcOverrides: Record<number, string> = {};
  const saved = load<Settings[]>("freelp:networks", []);
  const selected = load<Settings | null>("freelp:settings", null);
  const candidates = [
    ...(Array.isArray(saved) ? saved : []),
    ...(selected ? [selected] : []),
  ];
  for (const candidate of candidates) {
    try {
      const settings = validateSettings(candidate);
      const chain = chainDefinition(settings.chainId);
      const url = settings.rpcUrl.replace(/\/$/, "");
      if (
        !url ||
        oldDefaults.has(url) ||
        url === rpcEndpoint({ ...settings, rpcUrl: "" }).replace(/\/$/, "")
      )
        continue;
      // Preserve explicit local development settings, but never resurrect old
      // bundled testnets in the user-facing mainnet catalog.
      if (chain.testnet && settings.chainId !== 31337) continue;
      enabled.add(settings.chainId);
      rpcOverrides[settings.chainId] = settings.rpcUrl;
    } catch {
      /* Invalid or removed custom chains do not replace viem defaults. */
    }
  }
  return { enabledChainIds: [...enabled], rpcOverrides };
}
