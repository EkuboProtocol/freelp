// Reused from EkuboProtocol/interface math/evm/marketDepth.ts.
import type { QuoteDataFetcherResult } from "./quoteData";
export function liquidityAtTick(
  poolTickData: QuoteDataFetcherResult,
  tickDeltas: QuoteDataFetcherResult["ticks"],
  tick: number,
): bigint {
  const currentTick = poolTickData.tick;
  let liquidity = BigInt(poolTickData.liquidity);

  for (const entry of tickDeltas) {
    if (
      tick <= currentTick &&
      entry.number > tick &&
      entry.number <= currentTick
    ) {
      liquidity -= entry.liquidityDelta;
    } else if (
      tick > currentTick &&
      entry.number > currentTick &&
      entry.number <= tick
    ) {
      liquidity += entry.liquidityDelta;
    }
  }

  return liquidity;
}
