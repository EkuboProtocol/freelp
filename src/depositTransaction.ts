import { zeroAddress, type Hex } from "viem";
import { managerData } from "./contracts";
import { minimumLiquidity } from "./positionReview";
import type { Settings, Transaction } from "./types";
import type { calculateDepositQuote } from "./calculateDepositQuote";

export function createDepositTransaction(
  settings: Settings,
  quote: ReturnType<typeof calculateDepositQuote>,
  slippage: number,
): Transaction {
  const minLiquidity = minimumLiquidity(quote.liquidity, slippage);
  if (minLiquidity <= 0n)
    throw new Error(
      "Increase the deposit or reduce slippage: minimum liquidity must be positive.",
    );
  return depositWithRefund(
    settings,
    managerData("createPosition", [
      quote.descriptor.poolKey,
      quote.descriptor.tickLower,
      quote.descriptor.tickUpper,
      quote.initialTick,
      quote.max0,
      quote.max1,
      minLiquidity,
    ]),
    quote.descriptor.poolKey.token0 === zeroAddress ? quote.max0 : 0n,
  );
}

/** The manager shares msg.value across its payable subcalls; refund in the same
 * transaction, never a subsequent EIP-5792 call that could fail independently. */
export function depositWithRefund(
  settings: Settings,
  deposit: Hex,
  value = 0n,
): Transaction {
  return {
    to: settings.manager,
    data: managerData("multicall", [
      [deposit, managerData("refundNativeToken")],
    ]),
    value,
  };
}
