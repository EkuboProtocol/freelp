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
  const [selected, setSelected] = useState(
    location.hash.split("/").slice(2).join(":"),
  );
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
      <div className="row spread">
        <h2>
          <Trans>Your positions</Trans>
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
          <div className="portfolio-positions">
            {positions.map(({ settings, position }) => (
              <PortfolioPosition
                key={`${settings.chainId}:${position.id}`}
                settings={settings}
                position={position}
                onSelect={() =>
                  setSelected(`${settings.chainId}:${position.id}`)
                }
              />
            ))}
          </div>
          {!pending && !positions.length ? (
            <p>
              <Trans>No positions found on the available networks.</Trans>
            </p>
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
      {current ? (
        <NetworkScope settings={current.settings}>
          <fieldset
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
      ) : null}
    </section>
  );
}
