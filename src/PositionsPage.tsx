import { useState } from "react";
import { useSession, NetworkScope } from "./session";
import { usePortfolio } from "./usePortfolio";
import { networkName } from "./networks";
import { PositionDetail } from "./PositionDetail";
import { WalletConnectButton } from "./WalletConnectButton";
import { PortfolioPosition } from "./PortfolioPosition";

export function PositionsPage() {
  const { account, busy } = useSession();
  const [refresh, setRefresh] = useState(0);
  const { rows, pending } = usePortfolio(refresh);
  const selected = location.hash.split("/").slice(2).join(":");
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
  const errors = rows.filter((row) => row.error);
  return (
    <section>
      <div hidden={!!current}>
        <div className="row spread">
          <h2>Your positions</h2>
          {account && positions.length ? (
            <a className="primary-link" href="#/create">
              Create position
            </a>
          ) : null}
        </div>
        {!account ? (
          <div className="positions-empty">
            <WalletConnectButton />
          </div>
        ) : (
          <>
            <button
              disabled={pending > 0 || busy}
              onClick={() => setRefresh((n) => n + 1)}
            >
              Refresh positions
            </button>
            <div className="portfolio-positions">
              {positions.map(({ settings, position }) => (
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
            {!positions.length ? (
              <div className="positions-empty" aria-busy={pending > 0}>
                {!pending ? (
                  <p>No positions found on the available networks.</p>
                ) : null}
                <a className="primary-link" href="#/create">
                  Create position
                </a>
              </div>
            ) : null}
            {errors.length ? (
              <details className="network-errors">
                <summary>{errors.length} networks unavailable</summary>
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
            All positions
          </a>
          <NetworkScope settings={current.settings}>
            <fieldset
              className="position-management"
              aria-label="Manage position"
              disabled={busy || !current.fresh}
              aria-busy={!current.fresh}
            >
              <PositionDetail key={selected} position={current.position} />
            </fieldset>
          </NetworkScope>
        </>
      ) : null}
    </section>
  );
}
