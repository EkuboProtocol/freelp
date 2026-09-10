import { Trans } from "@lingui/react/macro";
import type { Dispatch, SetStateAction } from "react";
import { Field } from "./common";
import { MAX_TICK_SPACING } from "./pools";
import type { RangeInput } from "./prices";

export function RangeFields({
  range,
  setRange,
}: {
  range: RangeInput;
  setRange: Dispatch<SetStateAction<RangeInput>>;
}) {
  const labels = range.raw
    ? [
        <Trans>Lower tick</Trans>,
        <Trans>Upper tick</Trans>,
        <Trans>Initial tick (new pools only)</Trans>,
      ]
    : [
        <Trans>Lower price</Trans>,
        <Trans>Upper price</Trans>,
        <Trans>Initial price (new pools only)</Trans>,
      ];
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
          Prices are token 1 per token 0. Range prices round outward to valid
          ticks; review the resulting range in the preview.
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
      <div className="grid">
        {labels.map((label, index) => (
          <Field key={index} label={label}>
            <input
              value={(range.raw ? range.ticks : range.prices)[index]}
              disabled={range.full && index < 2}
              onChange={(event) => update(index, event.target.value)}
            />
          </Field>
        ))}
        <Field label={<Trans>Tick spacing</Trans>}>
          <input
            type="number"
            min={1}
            max={MAX_TICK_SPACING}
            value={range.spacing}
            onChange={(event) =>
              setRange({ ...range, spacing: Number(event.target.value) })
            }
          />
        </Field>
      </div>
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
      {range.full ? (
        <p>
          <Trans>Full range selected.</Trans>
        </p>
      ) : null}
    </fieldset>
  );
}
