import { isAddressEqual, type Address } from "viem";
import { NetworkScope } from "./session";
import { PositionDetail } from "./PositionDetail";
import { usePositionLookup } from "./usePositionLookup";
import { WalletConnectButton } from "./WalletConnectButton";
import type { Settings } from "./types";

/**
 * Shows any position by ID, with or without a wallet. Only the owning wallet
 * can sign; everyone else sees the same on-chain state read-only.
 */
export function PositionLookupPage({
  settings,
  id,
  account,
  refreshChain,
}: {
  settings: Settings;
  id: bigint;
  account?: Address;
  refreshChain: (chainId: number) => Promise<void>;
}) {
  const lookup = usePositionLookup(settings, id);
  if (lookup.state !== "found")
    return <LookupState lookup={lookup} account={account} />;
  const owned = !!account && isAddressEqual(lookup.owner, account);
  return (
    <section>
      <a href="#/positions" className="back-link">
        All positions
      </a>
      <NetworkScope settings={settings}>
        <div className="position-management" aria-label="Manage position">
          <div className="portfolio-detail-toolbar">
            <span>
              Owner: <code>{shortAddress(lookup.owner)}</code>
              {owned ? " · this wallet" : ""}
            </span>
            <button type="button" onClick={lookup.retry}>
              Refresh position
            </button>
          </div>
          {!owned ? (
            <p role="status" className="portfolio-closed-note">
              {account
                ? "This position is owned by another wallet. Connect that wallet to add, withdraw, or collect."
                : "Connect the owning wallet to add, withdraw, or collect. Viewing needs no wallet."}
            </p>
          ) : null}
          <PositionDetail
            key={`${settings.chainId}:${id}`}
            position={lookup.position}
            owner={lookup.owner}
            readOnly={!owned}
            onRefresh={
              owned ? () => refreshChain(settings.chainId) : lookup.retry
            }
          />
        </div>
      </NetworkScope>
    </section>
  );
}

function LookupState({
  lookup,
  account,
}: {
  lookup: ReturnType<typeof usePositionLookup>;
  account?: Address;
}) {
  const heading =
    lookup.state === "missing" ? "Position not found" : "Position unavailable";
  return (
    <section className="portfolio-route-state">
      <h2 tabIndex={-1}>{lookup.state === "loading" ? "Position" : heading}</h2>
      <p role="status">{lookupMessage(lookup)}</p>
      {lookup.state === "error" ? (
        <button type="button" onClick={lookup.retry}>
          Retry network
        </button>
      ) : null}
      {!account && lookup.state === "missing" ? <WalletConnectButton /> : null}
      <a href="#/positions">All positions</a> <a href="#/networks">Networks</a>
    </section>
  );
}

function lookupMessage(lookup: ReturnType<typeof usePositionLookup>) {
  if (lookup.state === "loading")
    return "Reading this position from the network…";
  if (lookup.state === "error") return lookup.message;
  return "No position with this number exists on this network. It may have been fully withdrawn and burned, or created with another position manager.";
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
