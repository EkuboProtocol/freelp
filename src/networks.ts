import { chainDefinition, chainSettings, DEFAULT_CHAIN_IDS } from "./chains";
import { legacyNetworkPreferences } from "./legacyNetworkPreferences";
import { load, save } from "./storage";
import { validateSettings } from "./config";
import { isVerified } from "./networkVerification";
import type { Settings } from "./types";
export const NETWORKS = DEFAULT_CHAIN_IDS.map((id) => chainSettings(id));
export type NetworkPreferences = {
  enabledChainIds: number[];
  rpcOverrides: Record<number, string>;
  version?: number;
};
const key = "freelp:chainPreferences";
// Version 2 dropped the seven former default networks without deployments.
const PREFERENCES_VERSION = 2;
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
  if (saved && saved.version !== PREFERENCES_VERSION) {
    const migrated = migratePreferences(enabledChainIds, rpcOverrides);
    save(key, migrated);
    return migrated;
  }
  return { enabledChainIds, rpcOverrides, version: PREFERENCES_VERSION };
}

/**
 * Older builds enabled eleven networks by default, most without contracts.
 * Keep the current defaults, anything the user verified or configured, and
 * drop the rest once; Enable re-adds any of them after a code check.
 */
function migratePreferences(
  enabledChainIds: number[],
  rpcOverrides: Record<number, string>,
): NetworkPreferences {
  const defaults = new Set<number>(DEFAULT_CHAIN_IDS);
  return {
    enabledChainIds: enabledChainIds.filter(
      (id) => defaults.has(id) || isVerified(id) || id in rpcOverrides,
    ),
    rpcOverrides,
    version: PREFERENCES_VERSION,
  };
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
  preferences.version = PREFERENCES_VERSION;
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
  preferences.version = PREFERENCES_VERSION;
  save(key, preferences);
  return loadNetworks();
}
