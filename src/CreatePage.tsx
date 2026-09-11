import { decimalInput } from "./decimalFormat";
import { displayAmount } from "./displayAmount";
import { TokenBalance } from "./TokenBalance";
import { PoolPicker } from "./PoolPicker";
import { currencies, type Currency } from "./tokens";
import { CurrencySelect } from "./CurrencySelect";
import { t } from "@lingui/core/macro";
import { DEFAULT_RANGE } from "./prices";
import { RangeFields } from "./RangeFields";
import { ApprovalButton } from "./ApprovalButton";
import { PricePreview } from "./PricePreview";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { loadDepositQuote } from "./loadDepositQuote";
import { Trans } from "@lingui/react/macro";
import { formatUnits, isAddress, zeroAddress } from "viem";
import { useSession } from "./session";
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
  const { settings, account, send, revision, selectNetwork } = useSession();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [maxA, setMaxA] = useState("");
  const [maxB, setMaxB] = useState("");
  const [linked, setLinked] = useState(true);
  const [specified, setSpecified] = useState<0 | 1>(0);
  const [failure, setFailure] = useState<{ key: string; error: string }>();
  const [pendingKey, setPendingKey] = useState<string>();
  const request = useRef(0);
  const [fee, setFee] = useState("0.3");
  const [range, setRange] = useState({
    ...DEFAULT_RANGE,
    prices: ["", "", ""] as [string, string, string],
  });
  const [slippage, setSlippage] = useState(50);
  const [quote, setQuote] = useState<Quote>();
  const [fallbackA, setFallbackA] = useState("");
  const [fallbackB, setFallbackB] = useState("");
  function chooseCurrency(side: 0 | 1, token: Currency, chainId: number) {
    if (chainId !== settings.chainId) {
      selectNetwork(chainId);
      setSpecified(0);
      setA(token.address);
      setB("");
      setMaxA("");
      setMaxB("");
      setQuote(undefined);
      setFallbackA(String(token.decimals));
      setFallbackB("");
      setRange({ ...DEFAULT_RANGE, prices: ["", "", ""] });
      return;
    }
    const pair = side === 0 ? [token.address, b] : [a, token.address];
    const fallback =
      side === 0
        ? [String(token.decimals), fallbackB]
        : [fallbackA, String(token.decimals)];
    if (
      isAddress(pair[0]) &&
      isAddress(pair[1]) &&
      BigInt(pair[0]) > BigInt(pair[1])
    ) {
      pair.reverse();
      fallback.reverse();
      setMaxA(maxB);
      setMaxB(maxA);
      setSpecified((previous) => (previous === 0 ? 1 : 0));
    }
    setQuote(undefined);
    setA(pair[0]);
    setB(pair[1]);
    setFallbackA(fallback[0]);
    setFallbackB(fallback[1]);
  }
  const key = JSON.stringify([
    settings,
    account,
    revision,
    a,
    b,
    maxA,
    maxB,
    fee,
    range,
    fallbackA,
    fallbackB,
    linked,
    specified,
  ]);
  const current = quote?.key === key ? quote : undefined;
  const previewBusy = pendingKey === key;
  const previewError = scopedError(failure, key);
  const symbols = [a, b].map(
    (address, index) =>
      currencies(settings.chainId, settings.nativeSymbol).find(
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
        fallbackA,
        fallbackB,
        fee,
        range,
        linked,
        specified,
      });
      if (id !== request.current) return;
      if (linked && next.adjusted) {
        setMaxA(formatUnits(next.max0, next.tokens[0].decimals));
        setMaxB(formatUnits(next.max1, next.tokens[1].decimals));
        return;
      }
      setQuote({ ...next, key });
    } catch (e) {
      if (id === request.current) setFailure({ key, error: String(e) });
    } finally {
      if (id === request.current) setPendingKey(undefined);
    }
  }
  const refreshPreview = useEffectEvent(preview);
  const invalidatePreview = useEffectEvent(() => {
    request.current++;
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAddress(a) && isAddress(b) && a !== b && (maxA || maxB))
        void refreshPreview();
    }, 450);
    return () => {
      clearTimeout(timer);
      invalidatePreview();
    };
  }, [key, a, b, maxA, maxB]);
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
    <section>
      <h2>
        <Trans>Create position</Trans>
      </h2>
      <p>
        <Trans>
          Choose your tokens and pool, set a price range, and enter either
          deposit amount. The matching amount and preview update automatically.
        </Trans>
      </p>
      <div className="grid deposit-inputs">
        <div className="deposit-input">
          <CurrencySelect
            value={a}
            label={t`Select first token`}
            allNetworks
            onChange={(token, chainId) => chooseCurrency(0, token, chainId)}
          />
          <Field label={<Trans>{symbols[0]} amount</Trans>}>
            <input
              inputMode="decimal"
              placeholder="0"
              disabled={inactiveInput(current, linked, 0)}
              data-testid="deposit-amount-0"
              value={maxA}
              onChange={(e) => {
                setSpecified(0);
                setMaxA(e.target.value);
              }}
            />
          </Field>
          <TokenBalance
            address={a}
            fallback={fallbackA}
            onAmount={(value) => {
              setSpecified(0);
              setMaxA(value);
            }}
          />
        </div>
        <div className="deposit-input">
          <CurrencySelect
            value={b}
            label={t`Select second token`}
            onChange={(token, chainId) => chooseCurrency(1, token, chainId)}
          />
          <Field label={<Trans>{symbols[1]} amount</Trans>}>
            <input
              inputMode="decimal"
              placeholder="0"
              disabled={inactiveInput(current, linked, 1)}
              data-testid="deposit-amount-1"
              value={maxB}
              onChange={(e) => {
                setSpecified(1);
                setMaxB(e.target.value);
              }}
            />
          </Field>
          <TokenBalance
            address={b}
            fallback={fallbackB}
            onAmount={(value) => {
              setSpecified(1);
              setMaxB(value);
            }}
          />
        </div>
      </div>
      <label className="row">
        <input
          type="checkbox"
          checked={linked}
          onChange={(e) => setLinked(e.target.checked)}
        />
        <Trans>Calculate the matching token amount</Trans>
      </label>
      <details className="advanced-settings">
        <summary>
          <Trans>Advanced pool settings</Trans>
        </summary>
        <div className="grid">
          <Field label={<Trans>Token 0 address</Trans>}>
            <input value={a} onChange={(e) => setA(e.target.value)} />
          </Field>
          <Field label={<Trans>Token 1 address</Trans>}>
            <input value={b} onChange={(e) => setB(e.target.value)} />
          </Field>
          <Field label={<Trans>Pool fee (%)</Trans>}>
            <input value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
          <Field label={<Trans>Slippage (basis points)</Trans>}>
            <input
              type="number"
              min={0}
              max={1000}
              value={slippage}
              onChange={(e) => setSlippage(Number(e.target.value))}
            />
          </Field>
        </div>
      </details>
      <PoolPicker
        key={JSON.stringify([settings, a, b])}
        range={range}
        onRangeChange={setRange}
        token0={a}
        token1={b}
        fee={fee}
        spacing={range.spacing}
        onSelect={(selectedFee, spacing, price) => {
          setFee(selectedFee);
          setRange({
            ...range,
            spacing,
            prices: price
              ? [
                  range.prices[0] || decimalInput(Number(price) * 0.9),
                  range.prices[1] || decimalInput(Number(price) * 1.1),
                  price,
                ]
              : range.prices,
          });
        }}
      />
      <RangeFields range={range} setRange={setRange} symbols={symbols} />
      <details>
        <summary>
          <Trans>Token metadata fallback</Trans>
        </summary>
        <p>
          <Trans>
            If a token has no decimals method, amounts use raw integer units.
            You can supply known decimals here to enter human-readable amounts.
          </Trans>
        </p>
        <div className="grid">
          <Field label={<Trans>Token 0 fallback decimals</Trans>}>
            <input
              type="number"
              min={0}
              max={255}
              value={fallbackA}
              onChange={(e) => setFallbackA(e.target.value)}
            />
          </Field>
          <Field label={<Trans>Token 1 fallback decimals</Trans>}>
            <input
              type="number"
              min={0}
              max={255}
              value={fallbackB}
              onChange={(e) => setFallbackB(e.target.value)}
            />
          </Field>
        </div>
      </details>
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
              {formatUnits(i === 0 ? current.used0 : current.used1, t.decimals)}{" "}
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
              {t.metadataMissing ? (
                <strong>
                  {(i === 0 ? fallbackA : fallbackB) === "" ? (
                    <Trans>
                      Decimals unavailable: amounts are raw integer units.
                    </Trans>
                  ) : (
                    <Trans>
                      Using manually supplied decimals: {t.decimals}
                    </Trans>
                  )}
                </strong>
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
    </section>
  );
}

function inactiveInput(
  quote: Quote | undefined,
  linked: boolean,
  side: number,
) {
  return linked && !!quote?.inactive[side];
}

function scopedError(
  failure: { key: string; error: string } | undefined,
  key: string,
) {
  return failure?.key === key ? failure.error : "";
}
