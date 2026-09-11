import { evmLiquidity, amount0RoundedUp } from "./evmLiquidity";
import { amount1Delta, toSqrtRatio, MAX_U128 } from "@ekubo/sdk";
import type { Descriptor } from "./types";

/** EVM-rounded SDK math; no RPC is needed when an amount or range changes. */
export function quoteDeposit(
  descriptor: Descriptor,
  sqrtRatio: bigint,
  amounts: [bigint, bigint],
  specified: 0 | 1,
) {
  const lower = toSqrtRatio(descriptor.tickLower, "evm");
  const upper = toSqrtRatio(descriptor.tickUpper, "evm");
  if (unusedToken(specified, sqrtRatio, lower, upper))
    return {
      liquidity: 0n,
      used0: 0n,
      used1: 0n,
      max0: amounts[0],
      max1: amounts[1],
    };
  const liquidity = evmLiquidity(
    sqrtRatio,
    lower,
    upper,
    specified === 0 ? amounts[0] : MAX_U128,
    specified === 1 ? amounts[1] : MAX_U128,
  );
  if (liquidity > (1n << 127n) - 1n)
    throw new Error("Deposit exceeds the supported liquidity limit.");
  const [used0, used1] = depositedAmounts(sqrtRatio, lower, upper, liquidity);
  return {
    liquidity,
    used0,
    used1,
    max0: specified === 0 ? amounts[0] : used0,
    max1: specified === 1 ? amounts[1] : used1,
  };
}

function unusedToken(
  side: 0 | 1,
  current: bigint,
  lower: bigint,
  upper: bigint,
) {
  return (side === 0 && current >= upper) || (side === 1 && current <= lower);
}

function depositedAmounts(
  sqrtRatio: bigint,
  lower: bigint,
  upper: bigint,
  liquidity: bigint,
) {
  const used0 =
    sqrtRatio >= upper
      ? 0n
      : amount0RoundedUp(
          sqrtRatio > lower ? sqrtRatio : lower,
          upper,
          liquidity,
        );
  const used1 =
    sqrtRatio <= lower
      ? 0n
      : amount1Delta(
          lower,
          sqrtRatio < upper ? sqrtRatio : upper,
          liquidity,
          true,
        );
  if (used0 > (1n << 127n) - 1n || used1 > (1n << 127n) - 1n)
    throw new Error("Deposit exceeds the supported token amount limit.");
  return [used0, used1];
}
