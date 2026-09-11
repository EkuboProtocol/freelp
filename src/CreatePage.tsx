import { snapCreateForm, snapPrice } from "./snapCreateForm";
import { SnappedInput } from "./SnappedInput";
import { PoolChart } from "./PoolChart";
import { useSelectedPool } from "./useSelectedPool";
import { tickPrice } from "./prices";
import { CreateDeploymentGate } from "./CreateDeploymentGate";
import { networkName } from "./networks";
import { defaultCreateForm } from "./createForm";
import { errorMessage } from "./errors";
import { decimalInput } from "./decimalFormat";
import { displayAmount } from "./displayAmount";
import { TokenBalance } from "./TokenBalance";
import { PoolPicker } from "./PoolPicker";
import { networkCurrencies, type Currency } from "./tokens";
import { CurrencySelect } from "./CurrencySelect";
import { t } from "@lingui/core/macro";
import { RangeFields } from "./RangeFields";
import { ApprovalButton } from "./ApprovalButton";
import { PricePreview } from "./PricePreview";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { loadDepositQuote } from "./loadDepositQuote";
import { Trans } from "@lingui/react/macro";
import { formatUnits, isAddress, zeroAddress } from "viem";
import { useCreateForm, formField } from "./useCreateForm";
import type { CreateForm } from "./createForm";
import type { Dispatch, SetStateAction } from "react";
import { NetworkScope, useSession } from "./session";
import { managerData, type Token } from "./contracts";
import { Action, Field, ErrorText } from "./common";
import type { Descriptor } from "./types";
type Quote = {
  descriptor: Descriptor;
  initialTick: number;
  sqrtRatio: bigint;
  tokens: [Token, Token];
  max0: bigint;
  max1: bigint;
  liquidity: bigint;
  used0: bigint;
  used1: bigint;
  key: string;
  inactive: boolean[];
};
export function CreatePage() {
  const { settings, networks, selectNetwork, busy } = useSession();
  const [sourceForm, setForm] = useCreateForm(settings.chainId);
  const form = sourceForm;
  const network = networks.find((n) => n.chainId === form.chain);
  if (!network)
    return (
      <p role="alert">
        <Trans>
          Configure this network in Settings before using this link.
        </Trans>
      </p>
    );
  return (
    <NetworkScope settings={network}>
      <section className="create-position">
        <h2>
          <Trans>Create position</Trans>
        </h2>
        <Field label={<Trans>Network</Trans>}>
          <select
            aria-label={t`Network`}
            disabled={busy}
            value={form.chain}
            onChange={(event) => {
              const chain = Number(event.target.value);
              selectNetwork(chain);
              setForm(defaultCreateForm(chain));
            }}
          >
            {networks.map((n) => (
              <option key={n.chainId} value={n.chainId}>
                {networkName(n.chainId, n.name)}
              </option>
            ))}
          </select>
        </Field>
        <CreateDeploymentGate>
          <CreatePositionForm
            key={network.chainId}
            form={snapCreateForm(form, networkCurrencies(network))}
            sourceForm={sourceForm}
            setForm={setForm}
          />
        </CreateDeploymentGate>
      </section>
    </NetworkScope>
  );
}
function CreatePositionForm({
  sourceForm,
  form: inputForm,
  setForm,
}: {
  form: CreateForm;
  sourceForm: CreateForm;
  setForm: Dispatch<SetStateAction<CreateForm>>;
}) {
  const { settings, account, send, revision } = useSession();
  const pool = useSelectedPool(inputForm);
  const form = {
    ...inputForm,
    range: poolRangeDefaults(inputForm.range, pool.data),
  };
  const [a, setA] = formField(form, setForm, "a");
  const [b, setB] = formField(form, setForm, "b");
  const [maxA, setMaxA] = formField(form, setForm, "maxA");
  const [maxB, setMaxB] = formField(form, setForm, "maxB");
  const [specified, setSpecified] = formField(form, setForm, "specified");
  const fee = form.fee;
  const [range, setRange] = formField(form, setForm, "range");
  const [slippage, setSlippage] = formField(form, setForm, "slippage");
  const [failure, setFailure] = useState<{ key: string; error: string }>();
  const [pendingKey, setPendingKey] = useState<string>();
  const request = useRef(0);
  const [quote, setQuote] = useState<Quote>();
  function chooseCurrency(side: 0 | 1, token: Currency) {
    const pair = side === 0 ? [token.address, b] : [a, token.address];
    if (
      isAddress(pair[0]) &&
      isAddress(pair[1]) &&
      BigInt(pair[0]) > BigInt(pair[1])
    ) {
      pair.reverse();
      setMaxA(maxB);
      setMaxB(maxA);
      setSpecified((previous) => (previous === 0 ? 1 : 0));
    }
    setQuote(undefined);
    setA(pair[0]);
    setB(pair[1]);
  }
  const key = JSON.stringify([
    settings,
    account,
    revision,
    pool.data?.key,
    a,
    b,
    specified === 0 ? maxA : maxB,
    fee,
    range,
    specified,
    form.kind,
    form.extension,
    form.exactFee,
    form.amplification,
    form.center,
  ]);
  const current = currentQuote(quote, key);
  const previewBusy = pendingKey === key;
  const previewError = scopedError(failure, key);
  const symbols = [a, b].map(
    (address, index) =>
      networkCurrencies(settings).find(
        (token) => token.address.toLowerCase() === address.toLowerCase(),
      )?.symbol ?? (index === 0 ? t`First token` : t`Second token`),
  );
  async function preview() {
    const id = ++request.current;
    setPendingKey(key);
    setFailure(undefined);
    try {
      const next = await loadDepositQuote({
        settings,
        account,
        a,
        b,
        maxA,
        maxB,
        fee,
        range,
        specified,
        options: form,
        initialized: pool.data?.state.sqrtRatio !== 0n,
        revision,
      });
      if (id !== request.current) return;
      if (next.adjusted) {
        if (specified === 0)
          setMaxB(formatUnits(next.max1, next.tokens[1].decimals));
        else setMaxA(formatUnits(next.max0, next.tokens[0].decimals));
      }
      setQuote({ ...next, key });
    } catch (e) {
      if (id === request.current) setFailure({ key, error: errorMessage(e) });
    } finally {
      if (id === request.current) setPendingKey(undefined);
    }
  }
  const refreshPreview = useEffectEvent(() => {
    if (pool.data && (specified === 0 ? maxA : maxB)) void preview();
  });
  const invalidatePreview = useEffectEvent(() => {
    request.current++;
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshPreview();
    }, 450);
    return () => {
      clearTimeout(timer);
      invalidatePreview();
    };
  }, [key, pool.data]);
  async function create() {
    if (!current) throw new Error(t`Refresh the preview.`);
    if (!Number.isInteger(slippage) || slippage < 0 || slippage > 1000)
      throw new Error(t`Slippage must be between 0 and 1000 basis points.`);
    const limits = {
      maxAmount0: current.max0,
      maxAmount1: current.max1,
      minLiquidity: (current.liquidity * BigInt(10000 - slippage)) / 10000n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
    };
    await send({
      to: settings.manager,
      data: managerData("createPosition", [
        current.descriptor,
        current.initialTick,
        limits,
      ]),
      value:
        current.descriptor.poolKey.token0 === zeroAddress ? current.max0 : 0n,
    });
    window.location.hash = "#/positions";
  }
  return (
    <div>
      <p>
        <Trans>
          Choose your tokens and pool, set a price range, and enter either
          deposit amount. The matching amount and preview update automatically.
        </Trans>
      </p>
      <div className="grid currency-pair">
        <CurrencySelect
          value={a}
          label={t`Select first token`}
          onChange={(token) => chooseCurrency(0, token)}
        />
        <CurrencySelect
          value={b}
          label={t`Select second token`}
          onChange={(token) => chooseCurrency(1, token)}
        />
      </div>
      <PoolPicker form={form} sourceForm={sourceForm} setForm={setForm} />
      <PoolLoadStatus pool={pool} />
      {pool.data ? (
        <>
          <PoolChart
            data={pool.data}
            options={form}
            spacing={range.spacing}
            range={range}
            onRangeChange={setRange}
          />
          <RangeFields
            range={range}
            sourceRange={sourceForm.range}
            setRange={setRange}
            symbols={symbols}
            stable={form.kind === "stable"}
            initialized={pool.data.state.sqrtRatio !== 0n}
          />
          <h3>
            <Trans>Deposit amounts</Trans>
          </h3>
          <div className="grid deposit-inputs">
            <div className="deposit-input">
              <strong className="deposit-token">{symbols[0]}</strong>
              <SnappedInput
                snapped={maxA}
                aria-label={t`${symbols[0]} amount`}
                inputMode="decimal"
                placeholder="0"
                disabled={!!current?.inactive[0]}
                data-testid="deposit-amount-0"
                value={sourceForm.maxA}
                onChange={(e) => {
                  setSpecified(0);
                  setMaxA(e.target.value);
                }}
              />
              <TokenBalance
                address={a}
                fallback=""
                onAmount={(value) => {
                  setSpecified(0);
                  setMaxA(value);
                }}
              />
            </div>
            <div className="deposit-input">
              <strong className="deposit-token">{symbols[1]}</strong>
              <SnappedInput
                snapped={maxB}
                aria-label={t`${symbols[1]} amount`}
                inputMode="decimal"
                placeholder="0"
                disabled={!!current?.inactive[1]}
                data-testid="deposit-amount-1"
                value={sourceForm.maxB}
                onChange={(e) => {
                  setSpecified(1);
                  setMaxB(e.target.value);
                }}
              />
              <TokenBalance
                address={b}
                fallback=""
                onAmount={(value) => {
                  setSpecified(1);
                  setMaxB(value);
                }}
              />
            </div>
          </div>
          <div className="slippage-control">
            <Field label={<Trans>Slippage (basis points)</Trans>}>
              <SnappedInput
                aria-label={t`Slippage (basis points)`}
                snapped={slippage}
                type="number"
                min={0}
                max={1000}
                value={sourceForm.slippage}
                onChange={(e) => setSlippage(Number(e.target.value))}
              />
            </Field>
          </div>
          <p className="row">
            <button disabled={previewBusy} onClick={() => void preview()}>
              <Trans>Preview position</Trans>
            </button>
          </p>
          <ErrorText error={previewError} />
          {previewBusy ? (
            <p role="status">
              <Trans>Updating deposit preview…</Trans>
            </p>
          ) : null}
          {current ? (
            <div className="panel">
              <h3>
                <Trans>Deposit preview</Trans>
              </h3>
              <PricePreview {...current} />
              {current.tokens.map((t, i) => (
                <p key={t.address}>
                  {t.symbol}:{" "}
                  {formatUnits(
                    i === 0 ? current.used0 : current.used1,
                    t.decimals,
                  )}{" "}
                  / <Trans>Balance:</Trans>{" "}
                  <span title={formatUnits(t.balance, t.decimals)}>
                    {displayAmount(t.balance, t.decimals)}
                  </span>{" "}
                  {t.balance < (i === 0 ? current.max0 : current.max1) ? (
                    <strong>
                      <Trans>Insufficient {t.symbol} balance</Trans>
                    </strong>
                  ) : null}
                  {current.inactive[i] ? (
                    <small>
                      <Trans>
                        This token is not needed for the selected range.
                      </Trans>
                    </small>
                  ) : null}
                </p>
              ))}
              <p>
                <Trans>Liquidity:</Trans> {current.liquidity.toString()}
              </p>
              <div className="row">
                {current.tokens.map((t, i) => (
                  <ApprovalButton
                    key={t.address}
                    token={t}
                    amount={formatUnits(
                      i === 0 ? current.max0 : current.max1,
                      t.decimals,
                    )}
                  />
                ))}
                <Action
                  disabled={
                    previewBusy ||
                    current.liquidity === 0n ||
                    current.tokens.some(
                      (t, i) =>
                        t.allowance < (i === 0 ? current.max0 : current.max1) ||
                        t.balance < (i === 0 ? current.max0 : current.max1),
                    )
                  }
                  run={create}
                >
                  <Trans>Create position</Trans>
                </Action>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function scopedError(
  failure: { key: string; error: string } | undefined,
  key: string,
) {
  return failure?.key === key ? failure.error : "";
}

function currentQuote(quote: Quote | undefined, key: string) {
  return quote?.key === key ? quote : undefined;
}
function PoolLoadStatus({
  pool,
}: {
  pool: ReturnType<typeof useSelectedPool>;
}) {
  return (
    <>
      {pool.loading ? (
        <p role="status">
          <Trans>Loading pool…</Trans>
        </p>
      ) : null}
      <ErrorText error={pool.error || ""} />
      {pool.error ? (
        <button onClick={pool.refresh}>
          <Trans>Retry pool data</Trans>
        </button>
      ) : null}
    </>
  );
}

function poolRangeDefaults(
  range: CreateForm["range"],
  pool: ReturnType<typeof useSelectedPool>["data"],
) {
  if (!pool || pool.state.sqrtRatio === 0n) return range;
  const price = tickPrice(pool.state.tick, ...pool.decimals);
  return {
    ...range,
    prices: [
      range.prices[0] ||
        snapPrice(decimalInput(price * 0.9), ...pool.decimals, range.spacing),
      range.prices[1] ||
        snapPrice(decimalInput(price * 1.1), ...pool.decimals, range.spacing),
      decimalInput(price),
    ] as CreateForm["range"]["prices"],
  };
}
