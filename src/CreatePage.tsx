import { parseAmount } from "./amounts";
import { concentratedConfig } from "./pools";
import { DEFAULT_RANGE, rangeTicks } from "./prices";
import { RangeFields } from "./RangeFields";
import { ApprovalButton } from "./ApprovalButton";
import { PricePreview } from "./PricePreview";
import { rpc } from "./rpc";
import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { formatUnits, getAddress, zeroAddress, type Address } from "viem";
import { useSession } from "./session";
import { read, token, managerData, type Token } from "./contracts";
import { Action, Field } from "./common";
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
};
export function CreatePage() {
  const { settings, account, send, setStatus, revision } = useSession();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [maxA, setMaxA] = useState("1");
  const [maxB, setMaxB] = useState("1");
  const [fee, setFee] = useState("0.3");
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [slippage, setSlippage] = useState(50);
  const [quote, setQuote] = useState<Quote>();
  const [fallbackA, setFallbackA] = useState("");
  const [fallbackB, setFallbackB] = useState("");
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
  ]);
  const current = quote?.key === key ? quote : undefined;
  async function preview() {
    try {
      if (!account) throw new Error("Connect a wallet to preview balances.");
      const addresses: [Address, Address] = [getAddress(a), getAddress(b)];
      if (BigInt(addresses[0]) >= BigInt(addresses[1]))
        throw new Error("Token 0 must sort before token 1 by address.");
      const poolKey = {
        token0: addresses[0],
        token1: addresses[1],
        config: concentratedConfig(fee, range.spacing),
      };
      const block = await rpc(settings).getBlockNumber();
      const [token0, token1, [sqrtRatio]] = await Promise.all([
        token(
          settings,
          addresses[0],
          account,
          fallbackA === "" ? undefined : Number(fallbackA),
        ),
        token(
          settings,
          addresses[1],
          account,
          fallbackB === "" ? undefined : Number(fallbackB),
        ),
        read<[bigint, number, bigint]>(settings, "poolState", [poolKey], block),
      ]);
      const tokens: [Token, Token] = [token0, token1];
      const max0 = parseAmount(maxA, tokens[0].decimals),
        max1 = parseAmount(maxB, tokens[1].decimals);
      const { lower, upper, initial } = rangeTicks(
        range,
        tokens[0].decimals,
        tokens[1].decimals,
        sqrtRatio !== 0n,
      );
      const descriptor = {
        poolKey,
        tickLower: lower,
        tickUpper: upper,
      };
      const [liquidity, used0, used1] = await read<[bigint, bigint, bigint]>(
        settings,
        "quoteDeposit",
        [descriptor, initial, max0, max1],
        block,
      );
      setQuote({
        descriptor,
        initialTick: initial,
        sqrtRatio,
        tokens,
        max0,
        max1,
        liquidity,
        used0,
        used1,
        key,
      });
    } catch (e) {
      setStatus(String(e));
    }
  }
  async function create() {
    if (!current) throw new Error("Refresh the preview.");
    if (!Number.isInteger(slippage) || slippage < 0 || slippage > 1000)
      throw new Error("Slippage must be between 0 and 1000 basis points.");
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
          Enter token addresses in ascending order. Use the zero address for the
          native token. Prices use token 1 per token 0; raw ticks use a 1.000001
          price step.
        </Trans>
      </p>
      <div className="grid">
        <Field label={<Trans>Token 0 address</Trans>}>
          <input value={a} onChange={(e) => setA(e.target.value)} />
        </Field>
        <Field label={<Trans>Token 1 address</Trans>}>
          <input value={b} onChange={(e) => setB(e.target.value)} />
        </Field>
        <Field label={<Trans>Maximum token 0 amount</Trans>}>
          <input value={maxA} onChange={(e) => setMaxA(e.target.value)} />
        </Field>
        <Field label={<Trans>Maximum token 1 amount</Trans>}>
          <input value={maxB} onChange={(e) => setMaxB(e.target.value)} />
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
      <RangeFields range={range} setRange={setRange} />
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
        <button onClick={() => void preview()}>
          <Trans>Preview position</Trans>
        </button>
      </p>
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
              / <Trans>Balance:</Trans> {formatUnits(t.balance, t.decimals)}{" "}
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
                current.liquidity === 0n ||
                current.tokens.some(
                  (t, i) =>
                    t.allowance < (i === 0 ? current.max0 : current.max1),
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
