import { PoolKeyFields } from "./PoolKeyFields";
import { TickSpacingControl } from "./TickSpacingControl";
import type { CreateForm } from "./createForm";
import type { Dispatch, SetStateAction } from "react";
import { exactFeeFromPercent, percentFromExactFee } from "./fee";
import { errorMessage } from "./errors";
import { decimalInput, decimalDisplay } from "./decimalFormat";
import { spacingPercent } from "./pools";
import { rangeTicks, tickPrice, type RangeInput } from "./prices";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getAddress, isAddress } from "viem";
import { Trans } from "@lingui/react/macro";
import { useSession } from "./session";
import { fetchPools, POOL_PRESETS } from "./poolData";
import { poolConfig, stableBounds, type PoolOptions } from "./poolOptions";
import { networkCurrencies } from "./tokens";
import { LiquidityChart } from "./LiquidityChart";
import { Field, ErrorText } from "./common";
type PoolStates = Awaited<ReturnType<typeof fetchPools>>;
type Loaded = { key: string; states: PoolStates; decimals: [number, number] };
export function PoolPicker({
  token0,
  token1,
  fee,
  options,
  form,
  setForm,
  onFeeChange,
  spacing,
  onSelect,
  range,
  onRangeChange,
}: {
  token0: string;
  token1: string;
  fee: string;
  options: PoolOptions;
  form: CreateForm;
  setForm: Dispatch<SetStateAction<CreateForm>>;
  onFeeChange: (fee: string, exactFee: string) => void;
  spacing: number;
  range: RangeInput;
  onRangeChange: (range: RangeInput) => void;
  onSelect: (fee: string, spacing: number, currentPrice?: string) => void;
}) {
  const { settings } = useSession();
  const active = useRef(true);
  const request = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [loaded, setLoaded] = useState<Loaded>();
  const [pending, setPending] = useState<string>();
  const [failure, setFailure] = useState<{ key: string; error: string }>();
  const presets = poolPresets(fee, spacing, options);
  const key = JSON.stringify([
    settings,
    token0,
    token1,
    presets,
    options.kind,
    options.extension,
    options.exactFee,
    options.amplification,
    options.center,
  ]);
  const data = loaded?.key === key ? loaded : undefined;
  const busy = pending === key;
  const error = scopedPoolError(failure, key);
  const selected = presets.findIndex(
    (preset) =>
      preset.exactFee === (options.exactFee || exactFeeFromPercent(fee)) &&
      preset.spacing === spacing,
  );
  function decimals(address: string) {
    const currency = networkCurrencies(settings).find(
      (token) => token.address.toLowerCase() === address.toLowerCase(),
    );
    if (!currency)
      throw new Error(
        "Import this token's on-chain metadata before displaying its price chart.",
      );
    return currency.decimals;
  }
  function select(index: number, result = data) {
    const preset = presets[index],
      state = result?.states[index];
    const price =
      state?.sqrtRatio && result
        ? decimalInput(
            Math.exp(state.tick * Math.log1p(0.000001)) *
              10 ** (result.decimals[0] - result.decimals[1]),
          )
        : undefined;
    onFeeChange(preset.fee, preset.custom ? preset.exactFee : "");
    onSelect(preset.fee, preset.spacing, price);
  }
  async function discover() {
    const id = ++request.current;
    setPending(key);
    setFailure(undefined);
    try {
      const keys = presets.map((preset) => ({
        token0: getAddress(token0),
        token1: getAddress(token1),
        config: poolConfig(preset.fee, preset.spacing, {
          ...options,
          exactFee: preset.exactFee,
        }),
      }));
      const [states, d0, d1] = await Promise.all([
        fetchPools(settings, keys),
        decimals(token0),
        decimals(token1),
      ]);
      if (!active.current || id !== request.current) return;
      const next: Loaded = { key, states, decimals: [d0, d1] };
      setLoaded(next);
      if (selected >= 0 && states[selected].sqrtRatio !== 0n)
        select(selected, next);
    } catch (error) {
      if (id === request.current)
        setFailure({ key, error: errorMessage(error) });
    } finally {
      if (id === request.current) setPending(undefined);
    }
  }
  const refreshPools = useEffectEvent(discover);
  const invalidate = useEffectEvent(() => {
    request.current++;
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAddress(token0) && isAddress(token1) && token0 !== token1)
        void refreshPools();
    }, 250);
    return () => {
      clearTimeout(timer);
      invalidate();
    };
  }, [key, token0, token1]);
  return (
    <section className="pool-picker">
      <div className="row spread">
        <h3>
          <Trans>Choose a pool</Trans>
        </h3>
        <button
          aria-busy={busy}
          disabled={busy || !isAddress(token0) || !isAddress(token1)}
          onClick={() => void discover()}
        >
          <Trans>Find pools on chain</Trans>
          {busy ? " …" : ""}
        </button>
      </div>
      <FeeOptions
        onFeeChange={onFeeChange}
        presets={presets}
        options={options}
        fee={fee}
        selected={selected}
        data={data}
        select={select}
      />
      <details className="advanced-settings">
        <summary>
          <Trans>Advanced pool settings</Trans>
        </summary>
        <div className="grid">
          <PoolKeyFields form={form} setForm={setForm} />
        </div>
        {options.kind === "concentrated" ? (
          <TickSpacingControl
            key={spacing}
            spacing={spacing}
            onApply={(spacing) => onRangeChange({ ...range, spacing })}
          />
        ) : null}
      </details>
      {data && selected >= 0 ? (
        <PoolChart
          options={options}
          data={data}
          selected={selected}
          spacing={options.kind === "stable" ? 1 : spacing}
          range={range}
          onRangeChange={onRangeChange}
        />
      ) : null}
      <ErrorText error={error} />
    </section>
  );
}
function PoolChart({
  options,
  data,
  selected,
  spacing,
  range,
  onRangeChange,
}: {
  range: RangeInput;
  options: PoolOptions;
  onRangeChange: (range: RangeInput) => void;
  data: Loaded;
  selected: number;
  spacing: number;
}) {
  const original = data.states[selected];
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

function scopedPoolError(
  failure: { key: string; error: string } | undefined,
  key: string,
) {
  return failure?.key === key ? failure.error : "";
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
function FeeOptions({
  onFeeChange,
  presets,
  options,
  fee,
  selected,
  data,
  select,
}: {
  onFeeChange: (fee: string, exactFee: string) => void;
  presets: { fee: string; spacing: number; exactFee: string }[];
  options: PoolOptions;
  fee: string;
  selected: number;
  data?: Loaded;
  select: (index: number) => void;
}) {
  return (
    <>
      <div className="pool-options">
        {presets.map((preset, index) => (
          <button
            key={`${preset.fee}:${preset.spacing}`}
            className={selected === index ? "selected" : ""}
            onClick={() => select(index)}
          >
            <strong>
              {decimalDisplay(Number(percentFromExactFee(preset.exactFee)))}%
            </strong>
            <small>
              {data?.states[index].sqrtRatio ? (
                <Trans>Existing pool</Trans>
              ) : (
                <Trans>Fee tier</Trans>
              )}
            </small>
            {options.kind === "concentrated" ? (
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
      <details className="pool-edit">
        <summary>
          <Trans>Edit fee</Trans> · {feeDisplay(fee, options)}%
        </summary>
        <Field label={<Trans>Pool fee (%)</Trans>}>
          <input
            inputMode="decimal"
            value={
              options.exactFee ? percentFromExactFee(options.exactFee) : fee
            }
            onChange={(e) => onFeeChange(e.target.value, "")}
          />
        </Field>
        <Field label={<Trans>Exact fee (uint64)</Trans>}>
          <input
            inputMode="numeric"
            value={options.exactFee || exactFeeFromPercent(fee)}
            onChange={(e) =>
              onFeeChange(percentFromExactFee(e.target.value), e.target.value)
            }
          />
        </Field>
      </details>
    </>
  );
}

function feeDisplay(fee: string, options: PoolOptions) {
  return options.exactFee === ""
    ? fee
    : decimalDisplay((Number(options.exactFee) / 2 ** 64) * 100);
}
function chartState(state: PoolStates[number], options: PoolOptions) {
  if (options.kind !== "stable") return state;
  const { lower, upper } = stableBounds(options);
  return {
    ...state,
    liquidity: state.tick < lower || state.tick >= upper ? 0n : state.liquidity,
  };
}
