import { snapNumber } from "./snapCreateForm";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Dispatch, SetStateAction } from "react";
import { SnappedInput } from "./SnappedInput";
import { Field } from "./common";
import { spacingPercent } from "./pools";
import { decimalDisplay, decimalInput } from "./decimalFormat";
import { priceToTick, tickPrice, MAX_TICK, type RangeInput } from "./prices";
export function RangeFields({
  range,
  sourceRange = range,
  setRange,
  symbols,
  decimals,
  stable = false,
  initialized = false,
}: {
  range: RangeInput;
  sourceRange?: RangeInput;
  setRange: Dispatch<SetStateAction<RangeInput>>;
  symbols: string[];
  decimals: [number, number];
  stable?: boolean;
  initialized?: boolean;
}) {
  function select(spacings: number) {
    const center = snapNumber(
      priceToTick(range.prices[2], ...decimals, 1, "round"),
      -MAX_TICK,
      MAX_TICK,
      range.spacing,
    );
    const edge = Math.floor(MAX_TICK / range.spacing) * range.spacing;
    const lower = Math.max(-edge, center - spacings * range.spacing),
      upper = Math.min(edge, center + spacings * range.spacing);
    setRange({
      ...range,
      raw: false,
      full: false,
      prices: [
        decimalInput(tickPrice(lower, ...decimals)),
        decimalInput(tickPrice(upper, ...decimals)),
        range.prices[2],
      ],
    });
  }
  return (
    <div className="range-controls">
      {!stable ? (
        <div className="row range-presets">
          {[4, 16, 64, 256].map((n) => (
            <button
              key={n}
              disabled={!Number(range.prices[2])}
              onClick={() => select(n)}
            >
              ±{decimalDisplay(spacingPercent(n * range.spacing), 3)}%
            </button>
          ))}
        </div>
      ) : null}
      <small>
        <Trans>
          Prices in {symbols[1]} per {symbols[0]}.
        </Trans>
      </small>
      {(range.raw ? sourceRange.ticks : sourceRange.prices)
        .slice(0, 2)
        .some(
          (value, i) =>
            value && value !== (range.raw ? range.ticks : range.prices)[i],
        ) ? (
        <small className="snapped-value">
          <Trans>Adjusted to nearest valid value</Trans>
        </small>
      ) : null}
      {!initialized ? (
        <Field label={<Trans>Initial price</Trans>}>
          <SnappedInput
            aria-label={t`Initial price`}
            inputMode="decimal"
            value={sourceRange.prices[2]}
            snapped={range.prices[2]}
            onChange={(e) =>
              setRange({
                ...range,
                raw: false,
                prices: [range.prices[0], range.prices[1], e.target.value],
              })
            }
          />
        </Field>
      ) : null}
    </div>
  );
}
