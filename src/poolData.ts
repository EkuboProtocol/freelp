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

/**
 * Initialization comes from the live Core state only. Registration in
 * PoolKeyIndex is a discovery hint: pools can be initialized outside this
 * interface, and unregistered pools may already be initialized.
 */
export function poolInitialized(state: { sqrtRatio: bigint }) {
  return state.sqrtRatio !== 0n;
}
