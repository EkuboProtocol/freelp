import { fixedSqrtRatioToFloat, toSqrtRatio } from "@ekubo/sdk";
import { decimalInput } from "./decimalFormat";
import {
  priceToTick,
  rangeTicks,
  tickPrice,
  MAX_TICK,
  type RangeInput,
} from "./prices";
import { stableBounds, type PoolOptions } from "./poolOptions";
import { LiquidityChart } from "./LiquidityChart";
import type { SelectedPool } from "./useSelectedPool";
export function PoolChart({
  options,
  symbols,
  data,
  spacing,
  range,
  onRangeChange,
}: {
  range: RangeInput;
  symbols: string[];
  options: PoolOptions;
  onRangeChange: (range: RangeInput) => void;
  data: SelectedPool;
  spacing: number;
}) {
  const original = initializedChartState(data, range);
  const state = chartState(original, options);
  const chartSpacing =
    options.kind === "stable"
      ? Math.max(
          1,
          Math.ceil(
            (stableBounds(options).upper - stableBounds(options).lower) / 100,
          ),
        )
      : spacing;
  return state.sqrtRatio !== 0n ? (
    <LiquidityChart
      data={state}
      hypothetical={data.state.sqrtRatio === 0n}
      symbols={symbols}
      decimals0={data.decimals[0]}
      decimals1={data.decimals[1]}
      spacing={chartSpacing}
      selection={
        options.kind === "stable"
          ? stableBounds(options)
          : chartSelection(range, data.decimals)
      }
      onSelectRange={
        options.kind === "stable"
          ? undefined
          : (lower, upper) =>
              onRangeChange({
                ...range,
                raw: false,
                full: false,
                prices: [
                  decimalInput(tickPrice(lower, ...data.decimals)),
                  decimalInput(tickPrice(upper, ...data.decimals)),
                  range.prices[2],
                ],
              })
      }
    />
  ) : (
    <p>
      This pool is not initialized. Set its initial price when creating the
      first position.
    </p>
  );
}

function chartSelection(range: RangeInput, decimals: [number, number]) {
  try {
    return rangeTicks(range, ...decimals, true);
  } catch {
    return undefined;
  }
}

function chartState(state: SelectedPool["state"], options: PoolOptions) {
  if (options.kind !== "stable") return state;
  const { lower, upper } = stableBounds(options);
  return {
    ...state,
    liquidity: state.tick < lower || state.tick >= upper ? 0n : state.liquidity,
    ticks: [
      { number: lower, liquidityDelta: state.liquidity },
      { number: upper, liquidityDelta: -state.liquidity },
    ],
  };
}

function initializedChartState(data: SelectedPool, range: RangeInput) {
  if (data.state.sqrtRatio !== 0n || !range.prices[2]) return data.state;
  try {
    const tick = priceToTick(range.prices[2], ...data.decimals, 1, "round");
    return {
      ...data.state,
      tick,
      sqrtRatio: fixedSqrtRatioToFloat(toSqrtRatio(tick, "evm")),
      minTick: -MAX_TICK,
      maxTick: MAX_TICK,
      liquidity: 0n,
      ticks: [],
    };
  } catch {
    return data.state;
  }
}
