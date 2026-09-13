import { PoolIdentity } from "./PoolIdentity";
import { PositionStatus, PositionRange } from "./PositionRange";
import { networkCurrencies } from "./tokens";
import { networkName } from "./networks";
import { displayAmount } from "./displayAmount";
import type { Position, Settings } from "./types";
export function PortfolioPosition({
  settings,
  position: p,
  onOpen,
  stale = false,
}: {
  settings: Settings;
  position: Position;
  onOpen: () => void;
  stale?: boolean;
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
      {stale ? (
        <p className="muted">
          Cached snapshot — refresh this network for current amounts.
        </p>
      ) : null}
      <PoolIdentity descriptor={p.descriptor} />
      <p>
        Principal: {amount(p.amounts.principal0, 0)} /{" "}
        {amount(p.amounts.principal1, 1)}
      </p>
      <p>
        Uncollected fees: {amount(p.amounts.fees0, 0)} /{" "}
        {amount(p.amounts.fees1, 1)}
      </p>
      {tokens[0] && tokens[1] ? (
        <PositionRange
          position={p}
          decimals={[tokens[0].decimals, tokens[1].decimals]}
          symbols={[tokens[0].symbol, tokens[1].symbol]}
        />
      ) : null}
      <a
        className="primary-link"
        href={`#/positions/${settings.chainId}/${p.id}`}
        onClick={onOpen}
        aria-label={`Manage position #${p.id}`}
      >
        Manage position
      </a>
    </article>
  );
}
