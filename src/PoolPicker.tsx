import { SnappedInput } from "./SnappedInput";
import { useState, type Dispatch, type SetStateAction } from "react";
import { PoolKeyFields } from "./PoolKeyFields";
import { TickSpacingControl } from "./TickSpacingControl";
import type { CreateForm } from "./createForm";
import { exactFeeFromPercent, percentFromExactFee } from "./fee";
import { decimalDisplay } from "./decimalFormat";
import { spacingPercent } from "./pools";
import { Field } from "./common";
import { zeroAddress } from "viem";
import "./identity.css";
import "./pool-registry.css";
import { usePoolRegistry } from "./usePoolRegistry";
import {
  selectRegisteredPool,
  isSelectedPool,
  type RegisteredPool,
} from "./poolRegistry";
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
  const registry = usePoolRegistry(form.a, form.b);
  const exact = form.exactFee || exactFeeFromPercent(fee);
  const onFeeChange = (fee: string, exactFee: string) =>
    setForm((previous) => ({ ...previous, fee, exactFee }));
  return (
    <section className="pool-picker">
      <div className="row spread">
        <h3>Choose a pool</h3>
        <label className="row advanced-toggle">
          Advanced
          <input
            type="checkbox"
            role="switch"
            checked={advanced}
            aria-controls="advanced-pool"
            onChange={(e) => setAdvanced(e.target.checked)}
          />
        </label>
      </div>
      <PoolOptions
        advanced={advanced}
        form={form}
        registry={registry}
        setForm={setForm}
      />
      <PoolSummary form={form} exact={exact} />
      <div id="advanced-pool" hidden={!advanced} className="advanced-settings">
        <div className="grid">
          <div>
            <Field label={rawFee ? "Exact fee (uint64)" : "Pool fee (%)"}>
              <SnappedInput
                aria-label={rawFee ? "Exact fee (uint64)" : "Pool fee (%)"}
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
              Enter exact amount
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

function PoolOptions({
  advanced,
  form,
  registry,
  setForm,
}: {
  advanced: boolean;
  form: CreateForm;
  registry: ReturnType<typeof usePoolRegistry>;
  setForm: Dispatch<SetStateAction<CreateForm>>;
}) {
  return (
    <div className="pool-options registry-options" hidden={advanced}>
      {registry.validPair ? (
        <RegisteredPools registry={registry} form={form} setForm={setForm} />
      ) : (
        <p>Select two tokens to discover registered pools for the pair.</p>
      )}
    </div>
  );
}

function RegisteredPools({
  registry,
  form,
  setForm,
}: {
  registry: ReturnType<typeof usePoolRegistry>;
  form: CreateForm;
  setForm: Dispatch<SetStateAction<CreateForm>>;
}) {
  return (
    <div className="registered-pools" aria-label="Registered pools">
      <p className="registry-note">
        Registered pools for this pair. Use Advanced to configure a pool not
        listed here.
      </p>
      <RegistryMessage registry={registry} />
      <div className="registered-pool-list">
        {registry.pools.map((pool) => (
          <RegisteredPoolCard
            key={pool.id}
            pool={pool}
            form={form}
            setForm={setForm}
          />
        ))}
      </div>
      <div className="registry-footer">
        <small>
          Loaded {registry.scanned.toString()} of {registry.total.toString()}{" "}
          registered pools for this pair.
          {registry.snapshot
            ? ` Snapshot block ${registry.snapshot.blockNumber}.`
            : ""}
        </small>
        <div className="registry-actions">
          <button
            type="button"
            disabled={registry.loading}
            onClick={registry.retry}
          >
            {registry.error ? "Retry pools" : "Refresh pools"}
          </button>
          {registry.hasMore ? (
            <button
              type="button"
              onClick={registry.loadMore}
              disabled={registry.loading}
            >
              Load more registered pools
            </button>
          ) : null}
        </div>
      </div>
      {registry.error ? (
        <p className="registry-error" role="alert">
          {registry.error}
        </p>
      ) : null}
    </div>
  );
}

function RegistryMessage({
  registry,
}: {
  registry: ReturnType<typeof usePoolRegistry>;
}) {
  if (registry.loading) return <p role="status">Loading registered pools…</p>;
  if (registry.error || !registry.snapshot || registry.pools.length)
    return null;
  return (
    <p role="status">
      No registered pools found for this pair. Use Advanced to configure a pool.
    </p>
  );
}

function RegisteredPoolCard({
  pool,
  form,
  setForm,
}: {
  pool: RegisteredPool;
  form: CreateForm;
  setForm: Dispatch<SetStateAction<CreateForm>>;
}) {
  const selected = isSelectedPool(form, pool);
  return (
    <button
      type="button"
      className={`registered-pool-card ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      onClick={() =>
        setForm((previous) => selectRegisteredPool(previous, pool))
      }
    >
      <strong>
        {decimalDisplay(Number(percentFromExactFee(pool.fee.toString())))}% fee
      </strong>
      <small>
        {pool.poolType === "concentrated"
          ? `Concentrated, spacing ${pool.tickSpacing}`
          : `${pool.poolType === "full_range" ? "Full-range" : "Stableswap"}, center ${pool.stableswapParams?.centerTick}, amplification ${pool.stableswapParams?.amplification}`}
      </small>
      <small>
        {pool.extension === zeroAddress
          ? "No extension"
          : `Extension: ${pool.extension}`}
      </small>
    </button>
  );
}

function PoolSummary({ form, exact }: { form: CreateForm; exact: string }) {
  const type = form.kind === "stable" ? "Stableswap" : "Concentrated liquidity";
  const parameter =
    form.kind === "stable"
      ? `Center tick: ${form.center}; amplification exponent: ${form.amplification}`
      : `Tick spacing: ${decimalDisplay(spacingPercent(form.range.spacing), 3)}%`;
  return (
    <details className="pool-summary" aria-label="Selected pool configuration">
      <summary>Selected pool details</summary>
      <div className="pool-summary-values">
        <span>Type: {type}</span>
        <span>Fee: {decimalDisplay(Number(percentFromExactFee(exact)))}%</span>
        <span>{parameter}</span>
        <span className="mono">Extension: {form.extension || zeroAddress}</span>
      </div>
    </details>
  );
}
function displayedFee(form: CreateForm) {
  return form.exactFee ? percentFromExactFee(form.exactFee) : form.fee;
}
