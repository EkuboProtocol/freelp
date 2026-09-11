import { SnappedInput } from "./SnappedInput";
import type { Dispatch, SetStateAction } from "react";
import type { CreateForm } from "./createForm";
import { Field } from "./common";
export function PoolKeyFields({
  form,
  sourceForm = form,
  setForm,
}: {
  form: CreateForm;
  sourceForm?: CreateForm;
  setForm: Dispatch<SetStateAction<CreateForm>>;
}) {
  const update = (key: keyof CreateForm, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  return (
    <>
      <Field label={"Pool type"}>
        <select
          aria-label={"Pool type"}
          value={form.kind}
          onChange={(e) => update("kind", e.target.value)}
        >
          <option value="concentrated">Concentrated liquidity</option>
          <option value="stable">Stableswap</option>
        </select>
      </Field>
      <Field label={"Extension address"}>
        <input
          value={form.extension}
          onChange={(e) => update("extension", e.target.value)}
          spellCheck={false}
        />
      </Field>
      {form.kind === "stable" ? (
        <>
          <Field label={"Amplification exponent"}>
            <SnappedInput
              inputMode="numeric"
              aria-label={"Amplification exponent"}
              value={sourceForm.amplification}
              snapped={form.amplification}
              onChange={(e) => update("amplification", e.target.value)}
            />
          </Field>
          <Field label={"Center tick (multiple of 16)"}>
            <SnappedInput
              inputMode="numeric"
              aria-label={"Center tick (multiple of 16)"}
              value={sourceForm.center}
              snapped={form.center}
              onChange={(e) => update("center", e.target.value)}
            />
          </Field>
        </>
      ) : null}
    </>
  );
}
