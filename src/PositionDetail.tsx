import { t } from "@lingui/core/macro";
import { parseAmount } from "./amounts";
import { ApprovalButton } from "./ApprovalButton";
import { PricePreview } from "./PricePreview";
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import {
  encodeFunctionData,
  erc721Abi,
  formatUnits,
  getAddress,
  zeroAddress,
} from "viem";
import { useSession } from "./session";
import { read, token, managerData, type Token } from "./contracts";
import { Action, Field } from "./common";
import type { Position } from "./types";
function metadataImage(uri: string) {
  if (!uri.startsWith("data:application/json;base64,")) return undefined;
  try {
    const data = JSON.parse(atob(uri.slice(29)));
    return typeof data.image === "string" &&
      data.image.startsWith("data:image/svg+xml;base64,")
      ? data.image
      : undefined;
  } catch {
    return undefined;
  }
}
export function PositionDetail({ position: p }: { position: Position }) {
  const { settings, account, setStatus, send } = useSession();
  const [tokens, setTokens] = useState<[Token, Token]>();
  const sqrtRatio = p.sqrtRatio;
  const [recipient, setRecipient] = useState(account ?? "");
  const [portion, setPortion] = useState(100);
  const [slippage, setSlippage] = useState(50);
  const [amount0, setAmount0] = useState("0");
  const [amount1, setAmount1] = useState("0");
  useEffect(() => {
    let active = true;
    if (!account) return;
    Promise.all([
      token(settings, p.descriptor.poolKey.token0, account),
      token(settings, p.descriptor.poolKey.token1, account),
    ])
      .then(([a, b]) => {
        if (active) {
          setTokens([a, b]);
        }
      })
      .catch((e) => {
        if (active) setStatus(String(e));
      });
    return () => {
      active = false;
    };
  }, [account, settings, p.descriptor, setStatus]);
  function deadline() {
    return BigInt(Math.floor(Date.now() / 1000) + 1200);
  }
  function factor() {
    if (!Number.isInteger(slippage) || slippage < 0 || slippage > 1000)
      throw new Error(t`Invalid slippage.`);
    return BigInt(10000 - slippage);
  }
  async function withdraw(feesOnly: boolean) {
    if (!Number.isInteger(portion) || portion < 1 || portion > 100)
      throw new Error(t`Withdrawal percentage must be 1–100.`);
    const liquidity = feesOnly
      ? 0n
      : (p.amounts.liquidity * BigInt(portion)) / 100n;
    const fraction = feesOnly ? 0n : BigInt(portion);
    const min0 =
      (((p.amounts.principal0 * fraction) / 100n + p.amounts.fees0) *
        factor()) /
      10000n;
    const min1 =
      (((p.amounts.principal1 * fraction) / 100n + p.amounts.fees1) *
        factor()) /
      10000n;
    await send({
      to: settings.manager,
      data: managerData("withdraw", [
        p.id,
        liquidity,
        getAddress(recipient),
        min0,
        min1,
        deadline(),
      ]),
    });
  }
  async function add() {
    if (!tokens) throw new Error(t`Token metadata unavailable.`);
    const max0 = parseAmount(amount0, tokens[0].decimals),
      max1 = parseAmount(amount1, tokens[1].decimals);
    const [liquidity] = await read<[bigint, bigint, bigint]>(
      settings,
      "quoteDeposit",
      [p.descriptor, 0, max0, max1],
    );
    await send({
      to: settings.manager,
      data: managerData("addLiquidity", [
        p.id,
        {
          maxAmount0: max0,
          maxAmount1: max1,
          minLiquidity: (liquidity * factor()) / 10000n,
          deadline: deadline(),
        },
      ]),
      value: p.descriptor.poolKey.token0 === zeroAddress ? max0 : 0n,
    });
  }
  const image = metadataImage(p.metadata);
  return (
    <div className="panel">
      <h3>
        <Trans>Position #{p.id.toString()}</Trans>
      </h3>
      {image ? (
        <img className="nft" src={image} alt="On-chain position metadata" />
      ) : null}
      {tokens ? (
        <PricePreview
          descriptor={p.descriptor}
          sqrtRatio={sqrtRatio}
          tokens={tokens}
        />
      ) : null}
      {tokens ? (
        <div className="grid">
          {tokens.map((t, i) => (
            <p key={t.address}>
              <strong>{t.symbol}</strong>
              {t.metadataMissing ? (
                <small>
                  <Trans>
                    Decimals unavailable: displayed and deposit amounts use raw
                    integer units.
                  </Trans>
                </small>
              ) : null}
              <br />
              <Trans>Principal:</Trans>{" "}
              {formatUnits(
                i === 0 ? p.amounts.principal0 : p.amounts.principal1,
                t.decimals,
              )}
              <br />
              <Trans>Uncollected fees:</Trans>{" "}
              {formatUnits(
                i === 0 ? p.amounts.fees0 : p.amounts.fees1,
                t.decimals,
              )}
            </p>
          ))}
        </div>
      ) : null}
      <div className="grid">
        <Field label={<Trans>Recipient address</Trans>}>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </Field>
        <Field label={<Trans>Slippage (basis points)</Trans>}>
          <input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(Number(e.target.value))}
          />
        </Field>
      </div>
      <fieldset>
        <legend>
          <Trans>Withdraw or collect</Trans>
        </legend>
        <Field label={<Trans>Withdraw percentage</Trans>}>
          <input
            type="number"
            min={1}
            max={100}
            value={portion}
            onChange={(e) => setPortion(Number(e.target.value))}
          />
        </Field>
        <p className="row">
          <Action run={() => withdraw(false)}>
            <Trans>Withdraw liquidity and fees</Trans>
          </Action>
          <Action run={() => withdraw(true)}>
            <Trans>Collect fees</Trans>
          </Action>
        </p>
      </fieldset>
      <fieldset>
        <legend>
          <Trans>Add liquidity</Trans>
        </legend>
        <div className="grid">
          <Field label={<Trans>Token 0 maximum</Trans>}>
            <input
              value={amount0}
              onChange={(e) => setAmount0(e.target.value)}
            />
          </Field>
          <Field label={<Trans>Token 1 maximum</Trans>}>
            <input
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
            />
          </Field>
        </div>
        <p className="row">
          {tokens?.map((t, i) => (
            <ApprovalButton
              key={t.address}
              token={t}
              amount={i === 0 ? amount0 : amount1}
            />
          ))}
          <Action run={add}>
            <Trans>Add liquidity</Trans>
          </Action>
        </p>
      </fieldset>
      <p className="row">
        <Action
          run={() =>
            send({
              to: settings.manager,
              data: encodeFunctionData({
                abi: erc721Abi,
                functionName: "safeTransferFrom",
                args: [account!, getAddress(recipient), p.id],
              }),
            })
          }
        >
          <Trans>Transfer NFT to recipient</Trans>
        </Action>
        <Action
          disabled={
            p.amounts.liquidity !== 0n ||
            p.amounts.fees0 !== 0n ||
            p.amounts.fees1 !== 0n
          }
          run={() =>
            send({ to: settings.manager, data: managerData("burn", [p.id]) })
          }
        >
          <Trans>Burn empty NFT</Trans>
        </Action>
      </p>
    </div>
  );
}
