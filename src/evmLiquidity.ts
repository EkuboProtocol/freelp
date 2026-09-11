import { amount0Delta, maxLiquidityForTokenAmounts } from "@ekubo/sdk";
const Q128 = 1n << 128n;
/** The EVM floors the product before multiplying by token0's amount. */
export function evmLiquidity(
  sqrtPrice: bigint,
  lower: bigint,
  upper: bigint,
  amountBase: bigint,
  amountQuote: bigint,
) {
  const sdk = maxLiquidityForTokenAmounts({
    sqrtPrice,
    sqrtPriceLower: lower,
    sqrtPriceUpper: upper,
    amountBase,
    amountQuote,
  });
  if (sqrtPrice >= upper) return sdk;
  const start = sqrtPrice > lower ? sqrtPrice : lower;
  const evm = (amountBase * ((start * upper) / Q128)) / (upper - start);
  return evm < sdk ? evm : sdk;
}
/** SDK 0.0.10 tests the quotient rather than the remainder in roundUp mode.
 * Use its floor result and the exact remainder until the upstream fix ships. */
export function amount0RoundedUp(
  lower: bigint,
  upper: bigint,
  liquidity: bigint,
) {
  const floor = amount0Delta(lower, upper, liquidity, false);
  return (
    floor +
    (((liquidity << 128n) * (upper - lower)) % (upper * lower) === 0n ? 0n : 1n)
  );
}
