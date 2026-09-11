import { t } from "@lingui/core/macro";
import { positionState } from "./PositionRange";
import { networkCurrencies } from "./tokens";
import type { Position, Settings } from "./types";
import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { useSession, NetworkScope } from "./session";
import { usePortfolio } from "./usePortfolio";
import { networkName } from "./networks";
import { PositionDetail } from "./PositionDetail";
import { PortfolioPosition } from "./PortfolioPosition";

export function PositionsPage() {
  const { account, busy } = useSession();
  const [refresh, setRefresh] = useState(0);
  const { rows, pending } = usePortfolio(refresh);
  const selected = location.hash.split("/").slice(2).join(":");
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState("");
  const positions = rows.flatMap((row) =>
    row.items.map((position) => ({
      settings: row.settings,
      position,
      fresh: row.fresh,
    })),
  );
  const current = positions.find(
    ({ settings, position }) =>
      `${settings.chainId}:${position.id}` === selected,
  );
  const visible = positions.filter(
    ({ position, settings }) =>
      (showClosed || positionState(position) !== "closed") &&
      matchesPosition(position, settings, search),
  );
  const errors = rows.filter((row) => row.error);
  return (
    <section>
      <div hidden={!!current}>
        <div className="row spread">
          <h2>
            <Trans>Your positions</Trans>{" "}
            <span className="muted">{positions.length}</span>
          </h2>
          <a className="primary-link" href="#/create">
            <Trans>Create position</Trans>
          </a>
        </div>
        <p>
          <Trans>
            All networks. Positions, pool data, and fees are read together from
            each chain.
          </Trans>
        </p>
        {!account ? (
          <p>
            <Trans>
              Connect a wallet to load positions directly from the chain.
            </Trans>
          </p>
        ) : (
          <>
            <button
              disabled={pending > 0 || busy}
              onClick={() => setRefresh((n) => n + 1)}
            >
              <Trans>Refresh positions</Trans>
            </button>
            {pending > 0 ? (
              <p role="status">
                <Trans>Reading {pending} networks…</Trans>
              </p>
            ) : null}
            <div className="row portfolio-filters">
              <input
                aria-label={t`Search positions`}
                placeholder={t`Search by token, network, address or ID`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={showClosed}
                  onChange={(e) => setShowClosed(e.target.checked)}
                />
                <Trans>Show closed</Trans>
              </label>
            </div>
            <div className="portfolio-positions">
              {visible.map(({ settings, position }) => (
                <PortfolioPosition
                  key={`${settings.chainId}:${position.id}`}
                  settings={settings}
                  position={position}
                  onSelect={() =>
                    (window.location.hash = `#/positions/${settings.chainId}/${position.id}`)
                  }
                />
              ))}
            </div>
            {!pending && !visible.length ? (
              <EmptyPositions total={positions.length} />
            ) : null}
            {errors.length ? (
              <details className="network-errors">
                <summary>
                  <Trans>{errors.length} networks unavailable</Trans>
                </summary>
                {errors.map((row) => (
                  <p key={row.settings.chainId}>
                    <strong>
                      {networkName(row.settings.chainId, row.settings.name)}
                    </strong>
                    : {row.error}
                  </p>
                ))}
              </details>
            ) : null}
          </>
        )}
      </div>
      {current ? (
        <>
          <a href="#/positions" className="back-link">
            <Trans>All positions</Trans>
          </a>
          <NetworkScope settings={current.settings}>
            <fieldset
              className="position-management"
              disabled={busy || !current.fresh}
              aria-busy={!current.fresh}
            >
              <legend>
                <Trans>Manage position</Trans> ·{" "}
                {networkName(current.settings.chainId, current.settings.name)}
              </legend>
              <PositionDetail key={selected} position={current.position} />
            </fieldset>
          </NetworkScope>
        </>
      ) : null}
    </section>
  );
}

function matchesPosition(
  position: Position,
  settings: Settings,
  search: string,
) {
  const { token0, token1 } = position.descriptor.poolKey;
  const addresses = [token0.toLowerCase(), token1.toLowerCase()];
  const names = networkCurrencies(settings)
    .filter((token) => addresses.includes(token.address.toLowerCase()))
    .map((token) => `${token.symbol} ${token.name}`);
  return [
    position.id,
    ...addresses,
    ...names,
    networkName(settings.chainId, settings.name),
  ]
    .join(" ")
    .toLowerCase()
    .includes(search.trim().toLowerCase());
}

function EmptyPositions({ total }: { total: number }) {
  return (
    <p>
      {total ? (
        <Trans>
          No matching positions. Try another search or show closed positions.
        </Trans>
      ) : (
        <Trans>No positions found on the available networks.</Trans>
      )}
    </p>
  );
}
