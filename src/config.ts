import { isAddress, zeroAddress } from "viem";
import { load } from "./storage";
import type { Settings } from "./types";
export const DEFAULT_SETTINGS: Settings = {
  rpcUrl: "https://ethereum-rpc.publicnode.com",
  chainId: 1,
  core: zeroAddress,
  manager: zeroAddress,
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
  if (!isAddress(value.core) || !isAddress(value.manager))
    throw new Error("Invalid contract address.");
  if (value.nativeSymbol.length > 16)
    throw new Error("Native token symbol is too long.");
  return value;
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
