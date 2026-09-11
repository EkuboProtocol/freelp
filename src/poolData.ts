import { zeroAddress } from "viem";
import { rpc } from "./rpc";
import { DEFAULT_POSITION_DATA_FETCHER } from "./deployments";
import { EVM_QUOTE_DATE_FETCHER_V3_ABI } from "./abis/quoteDataFetcher";
import { parseQuoteDataFetcherResult } from "./quoteData";
import type { Descriptor, Settings } from "./types";
export function quoteFetcher(settings: Settings) {
  return settings.freeLPDataFetcher ?? DEFAULT_POSITION_DATA_FETCHER;
}
export async function fetchPools(
  settings: Settings,
  keys: Descriptor["poolKey"][],
) {
  const address = quoteFetcher(settings);
  if (address === zeroAddress)
    throw new Error(
      "Deploy or configure a FreeLP data fetcher for this Core to display liquidity.",
    );
  const client = rpc(settings);
  const result = await client.readContract({
    address,
    abi: EVM_QUOTE_DATE_FETCHER_V3_ABI,
    functionName: "getQuoteData",
    args: [keys, 1],
  });
  return result.map((entry) => {
    const parsed = parseQuoteDataFetcherResult(entry);
    if (!parsed)
      throw new Error("Invalid pool state returned by FreeLP data fetcher.");
    return parsed;
  });
}
// Fee/spacing presets reused from interface/constants/evm/poolConfigs.ts.
export const POOL_PRESETS = [
  { fee: "0.01", spacing: 200 },
  { fee: "0.05", spacing: 1000 },
  { fee: "0.3", spacing: 5982 },
  { fee: "1", spacing: 19802 },
];
