// Adapted from interface/math/evm/marketDepth.ts: integrate every liquidity
// delta in each price bucket rather than sampling liquidity at its midpoint.
import {
  amount0Delta,
  amount1Delta,
  floatSqrtRatioToFixed,
  toSqrtRatio,
} from "@ekubo/sdk";
import { liquidityAtTick } from "./liquidity";
import type { QuoteDataFetcherResult } from "./quoteData";
export function bucketAmounts(
  data: QuoteDataFetcherResult,
  lower: number,
  upper: number,
) {
  const boundaries = [
    lower,
    ...data.ticks
      .filter((t) => t.number > lower && t.number < upper)
      .map((t) => t.number),
    upper,
  ];
  const current = floatSqrtRatioToFixed(data.sqrtRatio);
  let amount0 = 0n,
    amount1 = 0n;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const lo = toSqrtRatio(boundaries[i], "evm"),
      hi = toSqrtRatio(boundaries[i + 1], "evm");
    const liquidity = liquidityAtTick(data, data.ticks, boundaries[i]);
    if (liquidity <= 0n) continue;
    if (current < hi)
      amount0 += amount0Delta(
        current > lo ? current : lo,
        hi,
        liquidity,
        false,
      );
    if (current > lo)
      amount1 += amount1Delta(
        lo,
        current < hi ? current : hi,
        liquidity,
        false,
      );
  }
  return [amount0, amount1] as const;
}
export function liquidityBuckets(
  data: QuoteDataFetcherResult,
  spacing: number,
  zoom: number,
) {
  const lower = Math.max(
    data.minTick,
    Math.floor((data.tick - spacing * zoom) / spacing) * spacing,
  );
  const upper = Math.min(
    data.maxTick,
    Math.ceil((data.tick + spacing * zoom) / spacing) * spacing,
  );
  const step = Math.max(
    spacing,
    Math.ceil((upper - lower) / spacing / 80) * spacing,
  );
  const buckets = [];
  for (let from = lower; from < upper; from += step) {
    const to = Math.min(upper, from + step);
    buckets.push({
      lower: from,
      upper: to,
      amounts: bucketAmounts(data, from, to),
    });
  }
  return { lower, upper, buckets };
}
