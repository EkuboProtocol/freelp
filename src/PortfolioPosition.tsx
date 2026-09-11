import type { Currency } from "./tokens";
import { displayPrice, tickPrice } from "./prices";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { currencies } from "./tokens";
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
      currencies(settings.chainId, settings.nativeSymbol).find(
        (t) => t.address.toLowerCase() === address.toLowerCase(),
      ),
  );
  const amount = (value: bigint, i: number) =>
    `${displayAmount(value, tokens[i]?.decimals ?? 0)} ${tokens[i]?.symbol ?? t`raw units`}`;
  return (
    <article className="panel portfolio-position">
      <div className="row spread">
        <h3>
          {tokens[0]?.symbol ?? p.descriptor.poolKey.token0.slice(0, 8)} /{" "}
          {tokens[1]?.symbol ?? p.descriptor.poolKey.token1.slice(0, 8)}
        </h3>
        <span>{networkName(settings.chainId, settings.name)}</span>
      </div>
      <p>
        <Trans>Principal:</Trans> {amount(p.amounts.principal0, 0)} /{" "}
        {amount(p.amounts.principal1, 1)}
      </p>
      <p>
        <Trans>Uncollected fees:</Trans> {amount(p.amounts.fees0, 0)} /{" "}
        {amount(p.amounts.fees1, 1)}
      </p>
      <PositionRangePrice tokens={tokens} position={p} />
      <details>
        <summary>
          <Trans>Pool details</Trans>
        </summary>
        <p>
          <Trans>Tick range:</Trans> {p.descriptor.tickLower} —{" "}
          {p.descriptor.tickUpper}
        </p>
      </details>
      <button onClick={onSelect}>#{p.id.toString()}</button>
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
      <Trans>Price range:</Trans>{" "}
      {displayPrice(tickPrice(p.descriptor.tickLower, a.decimals, b.decimals))}{" "}
      —{" "}
      {displayPrice(tickPrice(p.descriptor.tickUpper, a.decimals, b.decimals))}{" "}
      {b.symbol} <Trans>per</Trans> {a.symbol}
    </p>
  );
}
