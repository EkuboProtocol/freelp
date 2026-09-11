import { t } from "@lingui/core/macro";
import { SnappedInput } from "./SnappedInput";
import { decimalInput } from "./decimalFormat";
import { Trans } from "@lingui/react/macro";
import type { Dispatch, SetStateAction } from "react";
import { Field } from "./common";
import type { RangeInput } from "./prices";

export function RangeFields({
  range,
  sourceRange = range,
  setRange,
  symbols,
  stable = false,
  initialized = false,
}: {
  symbols: string[];
  stable?: boolean;
  initialized?: boolean;
  range: RangeInput;
  sourceRange?: RangeInput;
  setRange: Dispatch<SetStateAction<RangeInput>>;
}) {
  const labels = range.raw
    ? [t`Lower tick`, t`Upper tick`, t`Initial tick (new pools only)`]
    : [t`Lower price`, t`Upper price`, t`Initial price (new pools only)`];
  function update(index: number, value: string) {
    setRange((previous) => {
      const field = previous.raw ? "ticks" : "prices";
      const values: [string, string, string] = [...previous[field]];
      values[index] = value;
      return { ...previous, [field]: values };
    });
  }
  return (
    <fieldset>
      <legend>
        <Trans>Price range</Trans>
      </legend>
      <p>
        <Trans>
          Prices are {symbols[1]} per {symbols[0]}. Prices snap to the nearest
          usable tick; review the resulting range in the preview.
        </Trans>
      </p>
      <label className="row">
        <input
          type="checkbox"
          checked={range.raw}
          onChange={(event) =>
            setRange({ ...range, raw: event.target.checked })
          }
        />
        <Trans>Use raw ticks</Trans>
      </label>
      {!stable ? (
        <div className="row">
          {[1, 5, 20].map((percent) => (
            <button
              key={percent}
              type="button"
              disabled={!Number(range.prices[2])}
              onClick={() =>
                setRange({
                  ...range,
                  raw: false,
                  full: false,
                  prices: [
                    decimalInput(Number(range.prices[2]) * (1 - percent / 100)),
                    decimalInput(Number(range.prices[2]) * (1 + percent / 100)),
                    range.prices[2],
                  ],
                })
              }
            >
              ±{percent}%
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid">
        {labels.map((label, index) =>
          (stable && index < 2) || (initialized && index === 2) ? null : (
            <Field key={index} label={label}>
              <SnappedInput
                aria-label={label}
                value={
                  (range.raw ? sourceRange.ticks : sourceRange.prices)[index]
                }
                snapped={(range.raw ? range.ticks : range.prices)[index]}
                disabled={range.full && index < 2}
                onChange={(event) => update(index, event.target.value)}
              />
            </Field>
          ),
        )}
      </div>
      {!stable ? (
        <>
          {" "}
          <button
            type="button"
            onClick={() => setRange({ ...range, full: !range.full })}
          >
            {range.full ? (
              <Trans>Use custom range</Trans>
            ) : (
              <Trans>Use full range</Trans>
            )}
          </button>
        </>
      ) : (
        <p>
          <Trans>
            Stableswap positions use the full active range defined by
            amplification and center tick.
          </Trans>
        </p>
      )}
      {!stable && range.full ? (
        <p>
          <Trans>Full range selected.</Trans>
        </p>
      ) : null}
    </fieldset>
  );
}
