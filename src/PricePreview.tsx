import { displayPrice, tickPrice, sqrtPrice } from "./prices";
import type { Descriptor } from "./types";
import type { Token } from "./contracts";
import { formatUnits } from "viem";
import "./identity.css";

export function PricePreview({
  descriptor,
  initialTick,
  sqrtRatio,
  tokens,
  max0,
  max1,
  liquidity,
}: {
  descriptor: Descriptor;
  initialTick?: number;
  sqrtRatio: bigint;
  tokens: [Token, Token];
  max0?: bigint;
  max1?: bigint;
  liquidity?: bigint;
}) {
  const [a, b] = tokens;
  if (sqrtRatio === 0n && initialTick === undefined)
    return <p>Pool state is unavailable.</p>;
  const price =
    sqrtRatio === 0n
      ? tickPrice(initialTick ?? 0, a.decimals, b.decimals)
      : sqrtPrice(sqrtRatio, a.decimals, b.decimals);
  return (
    <div>
      {initialTick !== undefined ? (
        <InitialPriceNotice
          isNew={sqrtRatio === 0n}
          initialTick={initialTick}
          price={price}
          tokens={tokens}
        />
      ) : null}
      <p>
        Price ({b.symbol} per {a.symbol}): ≈ {displayPrice(price)}
      </p>
      <p>
        Position range: ≈{" "}
        {displayPrice(tickPrice(descriptor.tickLower, a.decimals, b.decimals))}{" "}
        —{" "}
        {displayPrice(tickPrice(descriptor.tickUpper, a.decimals, b.decimals))}
      </p>
      <DepositDetails
        max0={max0}
        max1={max1}
        liquidity={liquidity}
        tokens={tokens}
      />
    </div>
  );
}

function InitialPriceNotice({
  isNew,
  initialTick,
  price,
  tokens,
}: {
  isNew: boolean;
  initialTick: number;
  price: number;
  tokens: [Token, Token];
}) {
  return (
    <div className="new-pool-warning" role="note">
      {isNew
        ? "New pool: creation will initialize its price. If the initial price is wrong, arbitrage and price movement can cause an immediate loss before your range is adjusted."
        : "Existing pool: the initial-price input is ignored."}
      {isNew ? (
        <p>
          Initial price: 1 {tokens[0].symbol} unit = {displayPrice(price)}{" "}
          {tokens[1].symbol} units (tick {initialTick}).
        </p>
      ) : null}
    </div>
  );
}

function DepositDetails({
  max0,
  max1,
  liquidity,
  tokens,
}: {
  max0?: bigint;
  max1?: bigint;
  liquidity?: bigint;
  tokens: [Token, Token];
}) {
  if (max0 === undefined || max1 === undefined) return null;
  return (
    <p>
      Deposit maximum: {formatUnits(max0, tokens[0].decimals)}{" "}
      {tokens[0].symbol} and {formatUnits(max1, tokens[1].decimals)}{" "}
      {tokens[1].symbol}
      {liquidity !== undefined
        ? `; estimated liquidity: ${liquidity.toString()}`
        : ""}
    </p>
  );
}
