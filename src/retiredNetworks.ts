import { DEFAULT_CONTRACTS } from "./deployments";
import type { Settings } from "./types";

// Remove the untouched testnet presets that older builds saved with every edit.
// Explicitly customized networks remain user-owned configuration.
const RETIRED = new Map([
  [11155111, "https://ethereum-sepolia-rpc.publicnode.com"],
  [84532, "https://sepolia.base.org"],
  [421614, "https://sepolia-rollup.arbitrum.io/rpc"],
  [46630, "https://rpc.testnet.chain.robinhood.com"],
]);
export function retiredDefault(settings: Settings) {
  return (
    RETIRED.get(settings.chainId) === settings.rpcUrl &&
    settings.nativeSymbol === "ETH" &&
    Object.entries(DEFAULT_CONTRACTS)
      .filter(([key]) => key !== "freeLPDataFetcher")
      .every(([key, value]) => settings[key as keyof Settings] === value)
  );
}
