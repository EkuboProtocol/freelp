import { PoolIdentity } from "./PoolIdentity";
import { PositionStatus, PositionRange } from "./PositionRange";
import type { Currency } from "./tokens";
import { displayPrice, tickPrice } from "./prices";
import { networkCurrencies } from "./tokens";
import { networkName } from "./networks";
import { displayAmount } from "./displayAmount";
import type { Position, Settings } from "./types";
export function PortfolioPosition({
  settings,
  position: p,
  onSelect,
}: {
  settings: Settings;
  position: Position;
  onSelect: () => void;
}) {
  const tokens = [p.descriptor.poolKey.token0, p.descriptor.poolKey.token1].map(
    (address) =>
      networkCurrencies(settings).find(
        (t) => t.address.toLowerCase() === address.toLowerCase(),
      ),
  );
  const amount = (value: bigint, i: number) =>
    `${displayAmount(value, tokens[i]?.decimals ?? 0)} ${tokens[i]?.symbol ?? "raw units"}`;
  return (
    <article className="panel portfolio-position">
      <div className="row spread">
        <h3>
          {tokens[0]?.symbol ?? p.descriptor.poolKey.token0.slice(0, 8)} /{" "}
          {tokens[1]?.symbol ?? p.descriptor.poolKey.token1.slice(0, 8)}
        </h3>
        <span>{networkName(settings.chainId, settings.name)}</span>
      </div>
      <PositionStatus position={p} />
      <PoolIdentity descriptor={p.descriptor} />
      <p>
        Principal: {amount(p.amounts.principal0, 0)} /{" "}
        {amount(p.amounts.principal1, 1)}
      </p>
      <p>
        Uncollected fees: {amount(p.amounts.fees0, 0)} /{" "}
        {amount(p.amounts.fees1, 1)}
      </p>
      <PositionRangePrice tokens={tokens} position={p} />
      {tokens[0] && tokens[1] ? (
        <PositionRange
          position={p}
          decimals={[tokens[0].decimals, tokens[1].decimals]}
        />
      ) : null}
      <details>
        <summary>Pool details</summary>
        <p>
          Tick range: {p.descriptor.tickLower} — {p.descriptor.tickUpper}
        </p>
      </details>
      <button onClick={onSelect}>Manage position #{p.id.toString()}</button>
    </article>
  );
}

function PositionRangePrice({
  tokens,
  position: p,
}: {
  tokens: (Currency | undefined)[];
  position: Position;
}) {
  const [a, b] = tokens;
  if (!a || !b) return null;
  return (
    <p>
      Price range:{" "}
      {displayPrice(tickPrice(p.descriptor.tickLower, a.decimals, b.decimals))}{" "}
      —{" "}
      {displayPrice(tickPrice(p.descriptor.tickUpper, a.decimals, b.decimals))}{" "}
      {b.symbol} per {a.symbol}
    </p>
  );
}
