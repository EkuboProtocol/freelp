import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Dispatch, SetStateAction } from "react";
import type { CreateForm } from "./createForm";
import { Field } from "./common";
export function PoolKeyFields({
  form,
  setForm,
}: {
  form: CreateForm;
  setForm: Dispatch<SetStateAction<CreateForm>>;
}) {
  const update = (key: keyof CreateForm, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  return (
    <>
      <Field label={<Trans>Pool type</Trans>}>
        <select
          aria-label={t`Pool type`}
          value={form.kind}
          onChange={(e) => update("kind", e.target.value)}
        >
          <option value="concentrated">
            <Trans>Concentrated liquidity</Trans>
          </option>
          <option value="stable">
            <Trans>Stableswap</Trans>
          </option>
        </select>
      </Field>
      <Field label={<Trans>Extension address</Trans>}>
        <input
          value={form.extension}
          onChange={(e) => update("extension", e.target.value)}
          spellCheck={false}
        />
      </Field>
      {form.kind === "stable" ? (
        <>
          <Field label={<Trans>Amplification exponent</Trans>}>
            <input
              inputMode="numeric"
              value={form.amplification}
              onChange={(e) => update("amplification", e.target.value)}
            />
          </Field>
          <Field label={<Trans>Center tick (multiple of 16)</Trans>}>
            <input
              inputMode="numeric"
              value={form.center}
              onChange={(e) => update("center", e.target.value)}
            />
          </Field>
        </>
      ) : null}
    </>
  );
}
