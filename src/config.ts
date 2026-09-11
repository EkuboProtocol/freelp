import { chainDefinition, chainSettings } from "./chains";
import { load } from "./storage";
import type { Settings } from "./types";
export const DEFAULT_SETTINGS: Settings = chainSettings(1);
export function validateSettings(value: Settings) {
  if (!Number.isSafeInteger(value.chainId) || value.chainId < 1)
    throw new Error("Invalid chain ID.");
  chainDefinition(value.chainId);
  if (typeof value.rpcUrl !== "string") throw new Error("Invalid RPC URL.");
  const rpcUrl = value.rpcUrl.trim();
  if (rpcUrl && !["http:", "https:"].includes(new URL(rpcUrl).protocol))
    throw new Error("RPC must use HTTP or HTTPS.");
  return chainSettings(value.chainId, rpcUrl);
}
export function loadSettings() {
  try {
    return validateSettings(
      load<Settings>("freelp:settings", DEFAULT_SETTINGS),
    );
  } catch {
    return DEFAULT_SETTINGS;
  }
}
