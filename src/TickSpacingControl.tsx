import { useState } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { checkSpacing, percentToSpacing, spacingPercent } from "./pools";
import { decimalDisplay } from "./decimalFormat";
import { Field, ErrorText } from "./common";
function candidate(value: string, raw: boolean) {
  try {
    const spacing = raw ? Number(value) : percentToSpacing(Number(value));
    checkSpacing(spacing);
    return { spacing, error: "" };
  } catch {
    return {
      spacing: undefined,
      error: t`Enter a positive spacing that rounds to 1–698605 integer ticks.`,
    };
  }
}
export function TickSpacingControl({
  spacing,
  sourceSpacing = spacing,
  onApply,
}: {
  spacing: number;
  sourceSpacing?: number;
  onApply: (spacing: number) => void;
}) {
  const [raw, setRaw] = useState(false);
  const [percent, setPercent] = useState(
    decimalDisplay(spacingPercent(spacing)),
  );
  const [ticks, setTicks] = useState(String(spacing));
  const next = candidate(raw ? ticks : percent, raw);
  return (
    <details className="tick-spacing-control">
      <summary>
        <Trans>Tick spacing</Trans> ·{" "}
        {decimalDisplay(spacingPercent(spacing), 3)}%
      </summary>
      {sourceSpacing !== spacing ? (
        <small className="snapped-value">
          <Trans>Adjusted to nearest valid value</Trans>
        </small>
      ) : null}
      <p>
        <Trans>
          Spacing is the price change between adjacent usable ticks. It is
          independent of the pool fee.
        </Trans>
      </p>
      <div className="row spacing-presets">
        {[200, 1000, 5982, 19802].map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={value === spacing}
            onClick={() => onApply(value)}
          >
            {decimalDisplay(spacingPercent(value), 3)}%
          </button>
        ))}
      </div>
      <Field
        label={
          raw ? (
            <Trans>Tick spacing (ticks)</Trans>
          ) : (
            <Trans>Tick spacing (%)</Trans>
          )
        }
      >
        <input
          inputMode={raw ? "numeric" : "decimal"}
          value={raw ? ticks : percent}
          onChange={(e) =>
            raw ? setTicks(e.target.value) : setPercent(e.target.value)
          }
        />
      </Field>
      <label className="row">
        <input
          type="checkbox"
          checked={raw}
          onChange={(e) => setRaw(e.target.checked)}
        />
        <Trans>Enter exact ticks</Trans>
      </label>
      {next.spacing ? (
        <p>
          <Trans>Applies {next.spacing} ticks:</Trans>{" "}
          {decimalDisplay(spacingPercent(next.spacing))}%
        </p>
      ) : null}
      <ErrorText error={next.error} />
      <button
        type="button"
        disabled={!next.spacing}
        onClick={() => {
          if (next.spacing) onApply(next.spacing);
        }}
      >
        <Trans>Apply tick spacing</Trans>
      </button>
    </details>
  );
}
