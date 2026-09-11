import { t } from "@lingui/core/macro";
import { SnappedInput } from "./SnappedInput";
import { Trans } from "@lingui/react/macro";
import { useState, type Dispatch, type SetStateAction } from "react";
import { PoolKeyFields } from "./PoolKeyFields";
import { TickSpacingControl } from "./TickSpacingControl";
import type { CreateForm } from "./createForm";
import { exactFeeFromPercent, percentFromExactFee } from "./fee";
import { decimalDisplay } from "./decimalFormat";
import { spacingPercent } from "./pools";
import { POOL_PRESETS } from "./poolData";
import type { PoolOptions } from "./poolOptions";
import { Field } from "./common";
export function PoolPicker({
  form,
  sourceForm,
  setForm,
}: {
  form: CreateForm;
  sourceForm: CreateForm;
  setForm: Dispatch<SetStateAction<CreateForm>>;
}) {
  const [rawFee, setRawFee] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const { fee, range } = form;
  const presets = poolPresets(fee, range.spacing, form);
  const exact = form.exactFee || exactFeeFromPercent(fee);
  const onFeeChange = (fee: string, exactFee: string) =>
    setForm((previous) => ({ ...previous, fee, exactFee }));
  return (
    <section className="pool-picker">
      <div className="row spread">
        <h3>
          <Trans>Choose a pool</Trans>
        </h3>
        <label className="row advanced-toggle">
          <Trans>Advanced</Trans>
          <input
            type="checkbox"
            role="switch"
            checked={advanced}
            aria-controls="advanced-pool"
            onChange={(e) => setAdvanced(e.target.checked)}
          />
        </label>
      </div>
      <div className="pool-options" hidden={advanced}>
        {presets.map((preset) => (
          <button
            key={`${preset.exactFee}:${preset.spacing}`}
            className={
              preset.exactFee === exact && preset.spacing === range.spacing
                ? "selected"
                : ""
            }
            onClick={() =>
              setForm((previous) => ({
                ...previous,
                fee: preset.fee,
                exactFee: preset.custom ? preset.exactFee : "",
                range: { ...previous.range, spacing: preset.spacing },
              }))
            }
          >
            <strong>
              {decimalDisplay(Number(percentFromExactFee(preset.exactFee)))}%
            </strong>
            <small>
              <Trans>Fee tier</Trans>
            </small>
            {form.kind === "concentrated" ? (
              <small>
                <Trans>Tick spacing</Trans>{" "}
                {decimalDisplay(spacingPercent(preset.spacing), 3)}%
              </small>
            ) : (
              <small>
                <Trans>Stableswap</Trans>
              </small>
            )}
          </button>
        ))}
      </div>
      <div id="advanced-pool" hidden={!advanced} className="advanced-settings">
        <div className="grid">
          <div>
            <Field
              label={
                rawFee ? (
                  <Trans>Exact fee (uint64)</Trans>
                ) : (
                  <Trans>Pool fee (%)</Trans>
                )
              }
            >
              <SnappedInput
                aria-label={rawFee ? t`Exact fee (uint64)` : t`Pool fee (%)`}
                inputMode={rawFee ? "numeric" : "decimal"}
                snapped={rawFee ? exact : displayedFee(form)}
                value={
                  rawFee
                    ? sourceForm.exactFee || exactFeeFromPercent(sourceForm.fee)
                    : sourceForm.exactFee
                      ? percentFromExactFee(sourceForm.exactFee)
                      : sourceForm.fee
                }
                onChange={(e) =>
                  rawFee
                    ? onFeeChange(
                        percentFromExactFee(e.target.value),
                        e.target.value,
                      )
                    : onFeeChange(e.target.value, "")
                }
              />
            </Field>
            <label className="row">
              <input
                type="checkbox"
                checked={rawFee}
                onChange={(e) => setRawFee(e.target.checked)}
              />
              <Trans>Enter exact amount</Trans>
            </label>
          </div>
          <PoolKeyFields
            form={form}
            sourceForm={sourceForm}
            setForm={setForm}
          />
        </div>
        {form.kind === "concentrated" ? (
          <TickSpacingControl
            key={range.spacing}
            spacing={range.spacing}
            sourceSpacing={sourceForm.range.spacing}
            onApply={(spacing) =>
              setForm((previous) => ({
                ...previous,
                range: { ...previous.range, spacing },
              }))
            }
          />
        ) : null}
      </div>
    </section>
  );
}
function poolPresets(fee: string, spacing: number, options: PoolOptions) {
  const presets = POOL_PRESETS.map((preset) => ({
    ...preset,
    spacing: options.kind === "stable" ? spacing : preset.spacing,
    exactFee: exactFeeFromPercent(preset.fee),
    custom: false,
  }));
  const exactFee = options.exactFee || exactFeeFromPercent(fee);
  return presets.some(
    (preset) => preset.exactFee === exactFee && preset.spacing === spacing,
  )
    ? presets
    : [...presets, { fee, spacing, exactFee, custom: true }];
}

function displayedFee(form: CreateForm) {
  return form.exactFee ? percentFromExactFee(form.exactFee) : form.fee;
}
