import { Eip1559FeesNotSupportedError } from "viem";
import { rpc } from "./rpc";
import type { Settings, Transaction } from "./types";

// A provisional Max budget, not a simulation or a limit sent to the wallet.
export const PROVISIONAL_CALL_GAS = 1_000_000n;

export function availableAfterReserve(balance: bigint, reserve: bigint) {
  if (balance < 0n || reserve <= 0n)
    throw new Error("A positive gas reserve is required.");
  return balance > reserve ? balance - reserve : 0n;
}

export async function nativeFeeCeiling(settings: Settings) {
  const client = rpc(settings);
  const price = await client
    .estimateFeesPerGas()
    .then((fees) => fees.maxFeePerGas ?? fees.gasPrice)
    .catch((error) => {
      if (error instanceof Eip1559FeesNotSupportedError)
        return client.getGasPrice();
      throw error;
    });
  if (price === undefined || price <= 0n)
    throw new Error(
      "RPC did not return a usable gas price. Enter an amount leaving native currency for gas.",
    );
  return price;
}

/** Reserve a provisional budget per call at current fees without executing the draft. */
export async function estimateNativeReserve(
  settings: Settings,
  calls: Transaction[],
) {
  if (!calls.length)
    throw new Error("Enter a valid deposit amount before estimating Max.");
  if ((await rpc(settings).getChainId()) !== settings.chainId)
    throw new Error("RPC chain ID does not match settings.");
  return (
    PROVISIONAL_CALL_GAS *
    BigInt(calls.length) *
    (await nativeFeeCeiling(settings))
  );
}
