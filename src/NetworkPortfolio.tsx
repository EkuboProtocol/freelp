import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { zeroAddress } from "viem";
import { useSession } from "./session";
import { networkName } from "./networks";
import { positions } from "./contracts";
import type { Position } from "./types";
type Result = { chainId: number; positions: Position[]; error?: string };
export function NetworkPortfolio() {
  const { networks, account, selectNetwork, revision } = useSession();
  const [loaded, setLoaded] = useState<{ scope: string; rows: Result[] }>({
    scope: "",
    rows: [],
  });
  const scope = JSON.stringify([networks, account, revision]);
  useEffect(() => {
    let active = true;
    if (!account) return;
    networks
      .filter((network) => network.manager !== zeroAddress)
      .map(async (network) => {
        try {
          return {
            chainId: network.chainId,
            positions: await positions(network, account),
          };
        } catch (error) {
          return {
            chainId: network.chainId,
            positions: [],
            error: String(error),
          };
        }
      })
      .forEach((request) => {
        void request.then((row) => {
          if (active)
            setLoaded((previous) => ({
              scope,
              rows: [...(previous.scope === scope ? previous.rows : []), row],
            }));
        });
      });
    return () => {
      active = false;
    };
  }, [networks, account, revision, scope]);
  const results = loaded.scope === scope ? loaded.rows : [];
  function open(chainId: number, route: string) {
    selectNetwork(chainId);
    location.hash = route;
  }
  return (
    <section className="network-overview">
      <div className="row spread">
        <h2>
          <Trans>Your liquidity</Trans>
        </h2>
        <span className="eyebrow">
          <Trans>Across all networks</Trans>
        </span>
      </div>
      <div className="network-cards">
        {networks.map((network) => {
          const result = results.find((row) => row.chainId === network.chainId);
          return (
            <article className="network-card" key={network.chainId}>
              <h3>{networkName(network.chainId, network.name)}</h3>
              {network.manager === zeroAddress ? (
                <button onClick={() => open(network.chainId, "#/positions")}>
                  <Trans>View network</Trans>
                </button>
              ) : (
                <>
                  <strong className="position-count">
                    {result?.positions.length ?? "—"}
                  </strong>
                  <small>
                    <Trans>positions</Trans>
                  </small>
                  {result?.positions.map((position) => (
                    <button
                      key={position.id.toString()}
                      onClick={() =>
                        open(network.chainId, `#/positions/${position.id}`)
                      }
                    >
                      #{position.id.toString()} ·{" "}
                      {position.descriptor.tickLower} →{" "}
                      {position.descriptor.tickUpper}
                    </button>
                  ))}
                  {result?.error ? (
                    <p role="alert">
                      <Trans>
                        RPC unavailable. Check this network’s settings.
                      </Trans>
                    </p>
                  ) : null}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
