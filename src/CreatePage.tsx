import { useBatchSupport } from "./useBatchSupport";
import { depositCalls } from "./walletCalls";
import { snapCreateForm, snapPrice, snapNumber } from "./snapCreateForm";
import { SnappedInput } from "./SnappedInput";
import { PoolChart } from "./PoolChart";
import { useSelectedPool } from "./useSelectedPool";
import { MAX_TICK, tickPrice } from "./prices";
import { changeCreateToken, changeCreateAmount } from "./createIntent";
import { CreateDeploymentGate } from "./CreateDeploymentGate";
import { networkName } from "./networks";
import { defaultCreateForm } from "./createForm";
import { decimalInput } from "./decimalFormat";
import { TokenBalance } from "./TokenBalance";
import { PoolPicker } from "./PoolPicker";
import { networkCurrencies, type Currency } from "./tokens";
import { CurrencySelect } from "./CurrencySelect";
import { RangeFields } from "./RangeFields";
import { ApprovalButton } from "./ApprovalButton";
import { PricePreview } from "./PricePreview";
import { useCreateDeposit } from "./useCreateDeposit";
import { formatUnits } from "viem";
import { createDepositTransaction } from "./depositTransaction";
import { minimumLiquidity } from "./positionReview";
import { useCreateForm, formField } from "./useCreateForm";
import type { CreateForm } from "./createForm";
import type { Dispatch, SetStateAction } from "react";
import { NetworkScope, useSession } from "./session";
import { Action, Field, ErrorText } from "./common";
import type { Settings } from "./types";
import { WalletConnectButton } from "./WalletConnectButton";
export function CreatePage() {
  const { settings, networks, selectNetwork, busy } = useSession();
  const [sourceForm, setForm] = useCreateForm(settings.chainId);
  const form = sourceForm;
  const network = networks.find((n) => n.chainId === form.chain);
  if (!network)
    return (
      <p role="alert">
        Enable this network in Networks before using this link.
      </p>
    );
  return (
    <NetworkScope settings={network}>
      <section className="create-position">
        <h2>Create position</h2>
        <Field label={"Network"}>
          <select
            aria-label={"Network"}
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
        <CreatePositionForm
          key={network.chainId}
          form={snapCreateForm(form, networkCurrencies(network))}
          sourceForm={sourceForm}
          setForm={setForm}
        />
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
  const { settings, account, send, setStatus } = useSession();
  const batchSupported = useBatchSupport();
  const pool = useSelectedPool(inputForm);
  const form = {
    ...inputForm,
    range: poolRangeDefaults(inputForm.range, pool.data),
  };
  const { a, b } = form;
  const [maxA, setMaxA] = formField(form, setForm, "maxA");
  const [maxB, setMaxB] = formField(form, setForm, "maxB");
  const [range, setRange] = formField(form, setForm, "range");
  const [slippage, setSlippage] = formField(form, setForm, "slippage");
  function chooseCurrency(side: 0 | 1, token: Currency) {
    try {
      setForm(changeCreateToken(sourceForm, side, token.address));
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Choose two different tokens.",
      );
    }
  }
  const { current, ready, previewError, refresh, inactive } = useCreateDeposit(
    form,
    pool,
    setMaxA,
    setMaxB,
  );
  const symbols = [a, b].map(
    (address, index) =>
      networkCurrencies(settings).find(
        (token) => token.address.toLowerCase() === address.toLowerCase(),
      )?.symbol ?? (index === 0 ? "First token" : "Second token"),
  );
  async function create() {
    if (!pool.data || Date.now() - pool.data.updatedAt > 30_000) {
      refresh();
      throw new Error(
        "Refreshing the pool and balances. Review the updated deposit preview before creating.",
      );
    }
    if (!current || !ready)
      throw new Error(
        "Connect a wallet and refresh balances and allowances before creating.",
      );
    if (!Number.isInteger(slippage) || slippage < 0 || slippage > 1000)
      throw new Error("Slippage must be between 0 and 1000 basis points.");
    const transaction = createDepositTransaction(settings, current, slippage);
    await send(
      batchSupported
        ? depositCalls(
            current.tokens,
            [current.max0, current.max1],
            settings.manager,
            transaction,
          )
        : transaction,
    );
    window.location.hash = "#/positions";
  }
  const nativeCalls = createGasCalls(settings, current, slippage);
  const minLiquidity = createMinimum(current?.liquidity, slippage);
  return (
    <div>
      <p>
        Choose your tokens and pool, set a price range, and enter either deposit
        amount. The matching amount and preview update automatically.
      </p>
      <div className="grid currency-pair">
        <CurrencySelect
          value={a}
          label={"Select first token"}
          onChange={(token) => chooseCurrency(0, token)}
        />
        <CurrencySelect
          value={b}
          label={"Select second token"}
          onChange={(token) => chooseCurrency(1, token)}
        />
      </div>
      <PoolPicker form={form} sourceForm={sourceForm} setForm={setForm} />
      <CreateDeploymentGate>
        <PoolLoadStatus pool={pool} refreshBalances={refresh} />
        {pool.data ? (
          <>
            <section className="range-section">
              <h3>Price range and liquidity</h3>
              {pool.data.state.sqrtRatio === 0n ? (
                <p className="status">
                  New pool: you set its first price. An incorrect price can
                  cause immediate loss of your deposit. Enter and verify the
                  initial price before depositing.
                </p>
              ) : null}
              <PoolChart
                symbols={symbols}
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
                decimals={pool.data.decimals}
                stable={form.kind === "stable"}
                initialized={pool.data.state.sqrtRatio !== 0n}
              />
            </section>
            <h3>Deposit amounts</h3>
            <div className="grid deposit-inputs">
              <div className="deposit-input">
                <strong className="deposit-token">{symbols[0]}</strong>
                <SnappedInput
                  snapped={maxA}
                  aria-label={`${symbols[0]} amount`}
                  inputMode="decimal"
                  placeholder="0"
                  disabled={inactive[0]}
                  data-testid="deposit-amount-0"
                  value={sourceForm.maxA}
                  onChange={(e) => {
                    setForm((previous) =>
                      changeCreateAmount(previous, 0, e.target.value),
                    );
                  }}
                />
                <TokenBalance
                  address={a}
                  fallback=""
                  disabled={inactive[0]}
                  nativeCalls={nativeCalls}
                  onAmount={(value) => {
                    setForm((previous) =>
                      changeCreateAmount(previous, 0, value),
                    );
                  }}
                />
              </div>
              <div className="deposit-input">
                <strong className="deposit-token">{symbols[1]}</strong>
                <SnappedInput
                  snapped={maxB}
                  aria-label={`${symbols[1]} amount`}
                  inputMode="decimal"
                  placeholder="0"
                  disabled={inactive[1]}
                  data-testid="deposit-amount-1"
                  value={sourceForm.maxB}
                  onChange={(e) => {
                    setForm((previous) =>
                      changeCreateAmount(previous, 1, e.target.value),
                    );
                  }}
                />
                <TokenBalance
                  address={b}
                  fallback=""
                  disabled={inactive[1]}
                  nativeCalls={nativeCalls}
                  onAmount={(value) => {
                    setForm((previous) =>
                      changeCreateAmount(previous, 1, value),
                    );
                  }}
                />
              </div>
            </div>
            <div className="slippage-control">
              <Field label={"Slippage (basis points)"}>
                <SnappedInput
                  aria-label={"Slippage (basis points)"}
                  snapped={slippage}
                  type="number"
                  min={0}
                  max={1000}
                  value={sourceForm.slippage}
                  onChange={(e) => setSlippage(Number(e.target.value))}
                />
              </Field>
            </div>
            <ErrorText error={previewError} />
            {current ? (
              <div className="panel">
                <h3>Deposit preview</h3>
                <PricePreview {...current} />
                {current.tokens.map((t, i) => (
                  <p key={t.address}>
                    {t.symbol}:{" "}
                    {formatUnits(
                      i === 0 ? current.used0 : current.used1,
                      t.decimals,
                    )}{" "}
                    {ready &&
                    t.balance < (i === 0 ? current.max0 : current.max1) ? (
                      <strong>Insufficient {t.symbol} balance</strong>
                    ) : null}
                    {current.inactive[i] ? (
                      <small>
                        This token is not needed for the selected range.
                      </small>
                    ) : null}
                  </p>
                ))}
                <p>
                  Estimated liquidity: {current.liquidity.toString()}. Minimum
                  received after liquidity slippage: {minLiquidity.toString()}.
                </p>
                <CreationPrerequisites
                  account={account}
                  ready={ready}
                  minLiquidity={minLiquidity}
                />
                <div className="row">
                  {(ready && batchSupported === false
                    ? current.tokens
                    : []
                  ).map((t, i) => (
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
                      batchSupported === undefined ||
                      !ready ||
                      minLiquidity === 0n ||
                      current.tokens.some(
                        (t, i) =>
                          (!batchSupported &&
                            t.allowance <
                              (i === 0 ? current.max0 : current.max1)) ||
                          t.balance < (i === 0 ? current.max0 : current.max1),
                      )
                    }
                    run={create}
                  >
                    Create position
                  </Action>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </CreateDeploymentGate>
    </div>
  );
}

function CreationPrerequisites({
  account,
  ready,
  minLiquidity,
}: {
  account?: string;
  ready: boolean;
  minLiquidity: bigint;
}) {
  return (
    <>
      {minLiquidity === 0n ? (
        <p role="alert">
          Increase the amount or reduce slippage so minimum liquidity stays
          positive.
        </p>
      ) : null}
      {!account ? <WalletConnectButton /> : null}
      {!ready && account ? (
        <p role="status">
          Load or refresh balances and allowances before creating.
        </p>
      ) : null}
    </>
  );
}

function createMinimum(liquidity: bigint | undefined, slippage: number) {
  try {
    return minimumLiquidity(liquidity ?? 0n, slippage);
  } catch {
    return 0n;
  }
}

function createGasCalls(
  settings: Settings,
  current: ReturnType<typeof useCreateDeposit>["current"],
  slippage: number,
) {
  if (!current) return undefined;
  try {
    return depositCalls(
      current.tokens,
      [current.max0, current.max1],
      settings.manager,
      createDepositTransaction(settings, current, slippage),
    );
  } catch {
    return undefined;
  }
}

function PoolLoadStatus({
  pool,
  refreshBalances,
}: {
  pool: ReturnType<typeof useSelectedPool>;
  refreshBalances: () => void;
}) {
  return (
    <>
      {pool.loading ? <p role="status">Loading pool…</p> : null}
      {pool.data ? (
        <p className="muted">
          Pool updated at {new Date(pool.data.updatedAt).toLocaleTimeString()}.
        </p>
      ) : null}
      <ErrorText error={pool.error || ""} />
      <button
        type="button"
        onClick={() => {
          pool.refresh();
          refreshBalances();
        }}
      >
        Refresh pool, balances, and allowances
      </button>
    </>
  );
}

function poolRangeDefaults(
  range: CreateForm["range"],
  pool: ReturnType<typeof useSelectedPool>["data"],
) {
  if (!pool) return range;
  const initialized = pool.state.sqrtRatio !== 0n;
  const price = initialized
    ? tickPrice(pool.state.tick, ...pool.decimals)
    : initialRangePrice(range, pool.decimals);
  if (!Number.isFinite(price) || price <= 0) return range;
  const center = snapNumber(
    (Math.log(price) - (pool.decimals[0] - pool.decimals[1]) * Math.LN10) /
      Math.log1p(0.000001),
    -MAX_TICK,
    MAX_TICK,
    range.spacing,
  );
  return {
    ...range,
    prices: [
      range.prices[0] ||
        snapPrice(
          decimalInput(
            tickPrice(center - range.spacing * 16, ...pool.decimals),
          ),
          ...pool.decimals,
          range.spacing,
        ),
      range.prices[1] ||
        snapPrice(
          decimalInput(
            tickPrice(center + range.spacing * 16, ...pool.decimals),
          ),
          ...pool.decimals,
          range.spacing,
        ),
      decimalInput(price),
    ] as CreateForm["range"]["prices"],
  };
}

function initialRangePrice(
  range: CreateForm["range"],
  decimals: [number, number],
) {
  return range.raw
    ? range.ticks[2] === ""
      ? NaN
      : tickPrice(Number(range.ticks[2]), ...decimals)
    : Number(range.prices[2]);
}
