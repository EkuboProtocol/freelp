import { chainDefinition, chainSettings, DEFAULT_CHAIN_IDS } from "./chains";
import { legacyNetworkPreferences } from "./legacyNetworkPreferences";
import { load, save } from "./storage";
import { validateSettings } from "./config";
import type { Settings } from "./types";
export const NETWORKS = DEFAULT_CHAIN_IDS.map((id) => chainSettings(id));
export type NetworkPreferences = {
  enabledChainIds: number[];
  rpcOverrides: Record<number, string>;
};
const key = "freelp:chainPreferences";
export function networkName(chainId: number, name?: string) {
  try {
    return chainDefinition(chainId).name;
  } catch {
    return name || `Chain ${chainId}`;
  }
}
export function loadNetworkPreferences(): NetworkPreferences {
  const saved = load<NetworkPreferences | null>(key, null);
  const source =
    saved && Array.isArray(saved.enabledChainIds)
      ? saved
      : legacyNetworkPreferences();
  const enabledChainIds = [...new Set(source.enabledChainIds)].filter((id) => {
    try {
      chainDefinition(id);
      return true;
    } catch {
      return false;
    }
  });
  const rpcOverrides: Record<number, string> = {};
  for (const [id, rpcUrl] of Object.entries(source.rpcOverrides ?? {})) {
    try {
      const next = validateSettings(chainSettings(Number(id), rpcUrl));
      if (next.rpcUrl) rpcOverrides[next.chainId] = next.rpcUrl;
    } catch {
      /* Ignore invalid overrides. */
    }
  }
  return { enabledChainIds, rpcOverrides };
}
export function loadNetworks(): Settings[] {
  const preferences = loadNetworkPreferences();
  return preferences.enabledChainIds.map((id) =>
    chainSettings(id, preferences.rpcOverrides[id]),
  );
}
export function configuredNetwork(id: number) {
  return chainSettings(id, loadNetworkPreferences().rpcOverrides[id]);
}
export function updateNetworks(networks: Settings[], value: Settings) {
  const next = validateSettings(value);
  const preferences = loadNetworkPreferences();
  if (next.rpcUrl) preferences.rpcOverrides[next.chainId] = next.rpcUrl;
  else delete preferences.rpcOverrides[next.chainId];
  preferences.enabledChainIds = networks.map((network) => network.chainId);
  save(key, preferences);
  return networks.map((network) =>
    network.chainId === next.chainId ? next : network,
  );
}
export function setNetworkEnabled(
  networks: Settings[],
  id: number,
  enabled: boolean,
) {
  chainDefinition(id);
  const preferences = loadNetworkPreferences();
  const ids = new Set(networks.map((network) => network.chainId));
  if (enabled) ids.add(id);
  else ids.delete(id);
  preferences.enabledChainIds = [...ids];
  save(key, preferences);
  return loadNetworks();
}
