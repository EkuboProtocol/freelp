import { snapNumber } from "./snapCreateForm";
import { useState, type Dispatch, type SetStateAction } from "react";
import { changeRangeMode } from "./createIntent";
import { errorMessage } from "./errors";
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
      <div className="range-toolbar">
        <RangeModeControls
          stable={stable}
          range={range}
          decimals={decimals}
          setRange={setRange}
        />
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
      </div>
      <small>
        Prices in {symbols[1]} per {symbols[0]}.
      </small>
      {!range.full && !stable ? (
        <div className="grid range-inputs">
          {([0, 1] as const).map((index) => (
            <RangeBoundField
              key={index}
              index={index}
              range={range}
              sourceRange={sourceRange}
              setRange={setRange}
            />
          ))}
        </div>
      ) : null}
      <RangeDescription range={range} />
      {(range.raw ? sourceRange.ticks : sourceRange.prices)
        .slice(0, 2)
        .some(
          (value, i) =>
            value && value !== (range.raw ? range.ticks : range.prices)[i],
        ) ? (
        <small className="snapped-value">Adjusted to nearest valid value</small>
      ) : null}
      {!initialized ? (
        <InitialPriceField
          range={range}
          sourceRange={sourceRange}
          setRange={setRange}
        />
      ) : null}
    </div>
  );
}

function RangeModeControls({
  range,
  decimals,
  setRange,
  stable,
}: {
  range: RangeInput;
  decimals: [number, number];
  setRange: Dispatch<SetStateAction<RangeInput>>;
  stable: boolean;
}) {
  const [error, setError] = useState("");
  function toggleMode() {
    try {
      setRange(changeRangeMode(range, decimals));
      setError("");
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  if (stable)
    return (
      <small>
        Stableswap bounds are determined by its center and amplification.
      </small>
    );
  return (
    <div className="row range-mode">
      <button
        type="button"
        aria-pressed={range.full}
        onClick={() => setRange({ ...range, full: !range.full })}
      >
        {range.full ? "Custom range" : "Full range"}
      </button>
      <button type="button" aria-pressed={range.raw} onClick={toggleMode}>
        {range.raw ? "Use prices" : "Edit exact ticks"}
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </div>
  );
}
function RangeDescription({ range }: { range: RangeInput }) {
  return (
    <small>
      {range.full
        ? "The range spans the protocol's supported tick bounds."
        : range.raw
          ? "Ticks use base 1.000001 and must be multiples of the selected spacing."
          : "Prices are snapped to the selected spacing. The minimum must be below the maximum."}
    </small>
  );
}

function RangeBoundField({
  index,
  range,
  sourceRange,
  setRange,
}: {
  index: 0 | 1;
  range: RangeInput;
  sourceRange: RangeInput;
  setRange: Dispatch<SetStateAction<RangeInput>>;
}) {
  return (
    <Field
      label={
        range.raw
          ? index === 0
            ? "Minimum tick"
            : "Maximum tick"
          : index === 0
            ? "Minimum price"
            : "Maximum price"
      }
    >
      <SnappedInput
        aria-label={
          range.raw
            ? index === 0
              ? "Minimum tick"
              : "Maximum tick"
            : index === 0
              ? "Minimum price"
              : "Maximum price"
        }
        inputMode={range.raw ? "numeric" : "decimal"}
        value={range.raw ? sourceRange.ticks[index] : sourceRange.prices[index]}
        snapped={range.raw ? range.ticks[index] : range.prices[index]}
        onChange={(event) =>
          setRange(updateBound(range, index, event.target.value))
        }
      />
    </Field>
  );
}

function updateBound(
  range: RangeInput,
  index: 0 | 1 | 2,
  value: string,
): RangeInput {
  return range.raw
    ? {
        ...range,
        ticks: range.ticks.map((item, i) =>
          i === index ? value : item,
        ) as RangeInput["ticks"],
      }
    : {
        ...range,
        prices: range.prices.map((item, i) =>
          i === index ? value : item,
        ) as RangeInput["prices"],
      };
}

function InitialPriceField({
  range,
  sourceRange,
  setRange,
}: {
  range: RangeInput;
  sourceRange: RangeInput;
  setRange: Dispatch<SetStateAction<RangeInput>>;
}) {
  return (
    <Field label="Initial price">
      <SnappedInput
        aria-label="Initial price"
        inputMode={range.raw ? "numeric" : "decimal"}
        value={range.raw ? sourceRange.ticks[2] : sourceRange.prices[2]}
        snapped={range.raw ? range.ticks[2] : range.prices[2]}
        onChange={(event) =>
          setRange(updateBound(sourceRange, 2, event.target.value))
        }
      />
    </Field>
  );
}
