import { retiredDefault } from "./retiredNetworks";
import { DEFAULT_CONTRACTS } from "./deployments";
import { load } from "./storage";
import type { Settings } from "./types";
export const DEFAULT_SETTINGS: Settings = {
  rpcUrl: "https://ethereum-rpc.publicnode.com",
  chainId: 1,
  ...DEFAULT_CONTRACTS,
  nativeSymbol: "ETH",
};
export function validateSettings(value: Settings) {
  if (
    typeof value.rpcUrl !== "string" ||
    typeof value.nativeSymbol !== "string"
  )
    throw new Error("Invalid RPC URL or native token symbol.");
  const url = new URL(value.rpcUrl);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("RPC must use HTTP or HTTPS.");
  if (!Number.isSafeInteger(value.chainId) || value.chainId < 1)
    throw new Error("Invalid chain ID.");
  if (value.nativeSymbol.length > 16)
    throw new Error("Native token symbol is too long.");
  if (
    value.name !== undefined &&
    (typeof value.name !== "string" || value.name.length > 80)
  )
    throw new Error("Invalid network name.");
  return {
    name: value.name,
    rpcUrl: value.rpcUrl,
    chainId: value.chainId,
    nativeSymbol: value.nativeSymbol,
    ...DEFAULT_CONTRACTS,
  };
}

export function loadSettings() {
  try {
    const settings = validateSettings(
      load<Settings>("freelp:settings", DEFAULT_SETTINGS),
    );
    return retiredDefault(settings) ? DEFAULT_SETTINGS : settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
