import { retiredDefault } from "./retiredNetworks";
import { DEFAULT_CONTRACTS } from "./deployments";
import { isAddress } from "viem";
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
  validateAddresses(value);
  return value;
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

function validateAddresses(value: Settings) {
  const addresses = [
    value.core,
    value.manager,
    value.coreDataFetcher ?? "0x0000000000000000000000000000000000000000",
    value.freeLPDataFetcher ?? "0x0000000000000000000000000000000000000000",
    value.tokenDataFetcher ?? "0x0000000000000000000000000000000000000000",
    value.quoteDataFetcher ?? "0x0000000000000000000000000000000000000000",
  ];
  if (!addresses.every((address) => isAddress(address)))
    throw new Error("Invalid contract address.");
}
