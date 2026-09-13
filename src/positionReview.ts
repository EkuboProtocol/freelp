import type { Amounts } from "./types";

export function slippageFactor(slippage: number) {
  if (!Number.isInteger(slippage) || slippage < 0 || slippage > 1000)
    throw new Error("Invalid slippage.");
  return BigInt(10000 - slippage);
}

export function minimumLiquidity(liquidity: bigint, slippage: number) {
  return (liquidity * slippageFactor(slippage)) / 10000n;
}

export function withdrawalReview(amounts: Amounts, portion: number) {
  if (!Number.isInteger(portion) || portion < 1 || portion > 100)
    throw new Error("Withdrawal percentage must be 1–100.");
  const fraction = BigInt(portion);
  const liquidity = (amounts.liquidity * fraction) / 100n;
  if (liquidity === 0n)
    throw new Error("This percentage rounds to zero liquidity.");
  const principal0 = (amounts.principal0 * liquidity) / amounts.liquidity;
  const principal1 = (amounts.principal1 * liquidity) / amounts.liquidity;
  const total0 = principal0 + amounts.fees0;
  const total1 = principal1 + amounts.fees1;
  return {
    liquidity,
    principal0,
    principal1,
    fees0: amounts.fees0,
    fees1: amounts.fees1,
    total0,
    total1,
    full: portion === 100,
  };
}
