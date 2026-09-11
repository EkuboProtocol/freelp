import { Trans } from "@lingui/react/macro";
import { decimalInput } from "./decimalFormat";
import { rangeTicks, tickPrice, type RangeInput } from "./prices";
import { stableBounds, type PoolOptions } from "./poolOptions";
import { LiquidityChart } from "./LiquidityChart";
import type { SelectedPool } from "./useSelectedPool";
export function PoolChart({
  options,
  data,
  spacing,
  range,
  onRangeChange,
}: {
  range: RangeInput;
  options: PoolOptions;
  onRangeChange: (range: RangeInput) => void;
  data: SelectedPool;
  spacing: number;
}) {
  const original = data.state;
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
      <Trans>
        This pool is not initialized. Set its initial price when creating the
        first position.
      </Trans>
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
  };
}
