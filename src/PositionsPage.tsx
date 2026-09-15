import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useSession, NetworkScope } from "./session";
import { usePortfolio, type PortfolioRow } from "./usePortfolio";
import { networkName } from "./networks";
import { PositionDetail } from "./PositionDetail";
import { WalletConnectButton } from "./WalletConnectButton";
import { PortfolioPosition } from "./PortfolioPosition";
import { PositionLookupPage } from "./PositionLookupPage";
import "./portfolio.css";

const PAGE_SIZE = 12;

function routePosition(hash: string) {
  const match = /^#\/positions\/([0-9]+)\/([0-9]+)$/.exec(hash);
  if (!match) return hash === "#/positions" || hash === "" ? undefined : null;
  return { chainId: Number(match[1]), id: BigInt(match[2]) };
}

function rowMessage(row: PortfolioRow) {
  if (row.availability === "proven-not-deployed")
    return "FreeLP is not deployed on this network yet.";
  if (row.availability === "unavailable")
    return row.error ?? "This network is unavailable.";
  return undefined;
}

export function PositionsPage({ route: hash }: { route: string }) {
  const { account, busy, networks } = useSession();
  const { rows, pending, refreshChain, refreshAll } = usePortfolio(0);
  const route = routePosition(hash);
  const positions = rows.flatMap((row) =>
    row.items.map((position) => ({
      settings: row.settings,
      position,
      stale: row.stale,
      loadedAt: row.loadedAt,
    })),
  );
  const current =
    route && typeof route === "object"
      ? positions.find(
          ({ settings, position }) =>
            settings.chainId === route.chainId && position.id === route.id,
        )
      : undefined;
  if (current) {
    return (
      <PortfolioDetail
        current={current}
        busy={busy}
        refreshChain={refreshChain}
      />
    );
  }

  if (route === null || (route && !current)) {
    const settings = networks.find(
      (network) => network.chainId === route?.chainId,
    );
    if (route && settings)
      return (
        <PositionLookupPage
          settings={settings}
          id={route.id}
          account={account}
          refreshChain={refreshChain}
        />
      );
    return <PositionRouteState route={route} />;
  }

  return (
    <PortfolioList
      account={account}
      busy={busy}
      networks={networks}
      rows={rows}
      positions={positions}
      pending={pending}
      refreshAll={refreshAll}
      refreshChain={refreshChain}
    />
  );
}

function PositionRouteState({
  route,
}: {
  route: ReturnType<typeof routePosition>;
}) {
  return (
    <section className="portfolio-route-state">
      <h2 tabIndex={-1}>Position unavailable</h2>
      <p role="status">
        {route
          ? "Enable this network in Networks to view the position."
          : "This position link is invalid. Check its network and position number."}
      </p>
      <a href="#/positions">All positions</a> <a href="#/networks">Networks</a>
    </section>
  );
}

function PortfolioDetail({
  current,
  busy,
  refreshChain,
}: {
  current: {
    settings: PortfolioRow["settings"];
    position: PortfolioRow["items"][number];
    stale: boolean;
    loadedAt?: number;
  };
  busy: boolean;
  refreshChain: (chainId: number) => Promise<void>;
}) {
  const fresh = !current.stale;
  useEffect(() => {
    requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>(
        ".position-heading h2",
      );
      heading?.focus();
      heading?.scrollIntoView({ block: "start" });
    });
  }, [current.settings.chainId, current.position.id]);
  return (
    <section>
      <a href="#/positions" className="back-link">
        All positions
      </a>
      <NetworkScope settings={current.settings}>
        <div
          className="position-management"
          aria-label="Manage position"
          aria-busy={!fresh}
        >
          <div className="portfolio-detail-toolbar">
            <span role="status" aria-live="polite">
              {fresh
                ? `Updated ${current.loadedAt ? new Date(current.loadedAt).toLocaleTimeString() : ""}`
                : "Updating…"}
            </span>
            <button
              type="button"
              disabled={busy || !fresh}
              onClick={() => refreshChain(current.settings.chainId)}
            >
              Refresh position
            </button>
          </div>
          {current.position.amounts.liquidity === 0n ? (
            <p className="portfolio-closed-note">
              This position is closed. It remains visible so you can review its
              final on-chain state; a fully burned NFT may not be discoverable
              here.
            </p>
          ) : null}
          <PositionDetail
            key={`${current.settings.chainId}:${current.position.id}`}
            position={current.position}
            onRefresh={() => refreshChain(current.settings.chainId)}
          />
        </div>
      </NetworkScope>
    </section>
  );
}

function PortfolioList({
  account,
  busy,
  networks,
  rows,
  positions,
  pending,
  refreshAll,
  refreshChain,
}: {
  account?: string;
  busy: boolean;
  networks: PortfolioRow["settings"][];
  rows: PortfolioRow[];
  positions: {
    settings: PortfolioRow["settings"];
    position: PortfolioRow["items"][number];
    stale: boolean;
    loadedAt?: number;
  }[];
  pending: number;
  refreshAll: () => void;
  refreshChain: (chainId: number) => void;
}) {
  const [chainFilter, setChainFilter] = useState("all");
  const [page, setPage] = useState(0);
  const filtered = useMemo(
    () =>
      positions.filter(
        ({ settings }) =>
          chainFilter === "all" || String(settings.chainId) === chainFilter,
      ),
    [chainFilter, positions],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(
    activePage * PAGE_SIZE,
    (activePage + 1) * PAGE_SIZE,
  );
  const errors = rows.filter((row) => row.availability === "unavailable");
  useEffect(() => setPage(0), [chainFilter]);
  if (!account)
    return (
      <section>
        <div className="portfolio-intro">
          <h2>Your FreeLP positions</h2>
          <p>Connect a wallet to view positions on your enabled networks.</p>
        </div>
        <div className="positions-empty">
          <WalletConnectButton />
          <a href="#/create">Create position</a>
        </div>
      </section>
    );
  return (
    <section>
      <PortfolioHeader showCreate={positions.length > 0} />
      <PortfolioControls
        chainFilter={chainFilter}
        networks={networks}
        busy={busy}
        onFilter={setChainFilter}
        onRefresh={refreshAll}
      />
      <div className="portfolio-positions">
        {visible.map(({ settings, position, stale }) => (
          <PortfolioPosition
            key={`${settings.chainId}:${position.id}`}
            settings={settings}
            position={position}
            stale={stale}
          />
        ))}
      </div>
      <PortfolioEmpty
        pending={pending}
        hasPositions={positions.length > 0}
        hasFiltered={filtered.length > 0}
        allNetworks={chainFilter === "all"}
        unavailable={errors.length}
      />
      <PortfolioPagination
        visible={filtered.length > PAGE_SIZE}
        page={activePage}
        pageCount={pageCount}
        setPage={setPage}
      />
      <UnavailableNetworks rows={errors} retry={refreshChain} />
      {pending ? (
        <p role="status">
          Checking {pending} network{pending === 1 ? "" : "s"}…
        </p>
      ) : null}
      {rows
        .filter((row) => row.availability === "proven-not-deployed")
        .map((row) => (
          <p key={row.settings.chainId}>
            {networkName(row.settings.chainId)}: FreeLP is not deployed.
          </p>
        ))}
    </section>
  );
}

function PortfolioHeader({ showCreate }: { showCreate: boolean }) {
  return (
    <div className="portfolio-intro">
      <div className="row spread">
        <div>
          <h2>Your FreeLP positions</h2>
          <p>
            FreeLP positions on your enabled networks. Official Ekubo Positions
            and Ve33 NFTs are managed separately.
          </p>
        </div>
        {showCreate ? (
          <a className="primary-link" href="#/create">
            Create position
          </a>
        ) : null}
      </div>
    </div>
  );
}

function PortfolioControls({
  chainFilter,
  networks,
  busy,
  onFilter,
  onRefresh,
}: {
  chainFilter: string;
  networks: PortfolioRow["settings"][];
  busy: boolean;
  onFilter: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="portfolio-controls">
      <label>
        Network
        <select
          value={chainFilter}
          onChange={(event) => onFilter(event.target.value)}
        >
          <option value="all">All enabled networks</option>
          {networks.map((network) => (
            <option key={network.chainId} value={network.chainId}>
              {networkName(network.chainId, network.name)}
            </option>
          ))}
        </select>
      </label>
      <button type="button" disabled={busy} onClick={onRefresh}>
        Refresh positions
      </button>
    </div>
  );
}

function PortfolioEmpty({
  pending,
  hasPositions,
  hasFiltered,
  allNetworks,
  unavailable,
}: {
  pending: number;
  hasPositions: boolean;
  hasFiltered: boolean;
  allNetworks: boolean;
  unavailable: number;
}) {
  if (pending > 0 && !hasPositions)
    return (
      <p className="loading-note" aria-busy="true">
        Checking enabled networks for positions…
      </p>
    );
  if (!pending && !hasPositions && allNetworks)
    return (
      <div className="positions-empty">
        <p>
          {unavailable
            ? "Positions could not be checked on all enabled networks. Retry the unavailable networks below."
            : "No FreeLP positions found on the enabled networks."}
        </p>
        <p className="muted">
          Positions from earlier contract deployments remain at their original
          manager and need a compatible pinned release.
        </p>
        <a className="primary-link" href="#/create">
          Create position
        </a>
      </div>
    );
  if (!pending && !hasFiltered)
    return (
      <p className="positions-empty">
        No positions to display for this filter. Check any network errors below
        or choose another filter.
      </p>
    );
  return null;
}

function PortfolioPagination({
  visible,
  page,
  pageCount,
  setPage,
}: {
  visible: boolean;
  page: number;
  pageCount: number;
  setPage: Dispatch<SetStateAction<number>>;
}) {
  if (!visible) return null;
  return (
    <div className="portfolio-pagination" aria-label="Position pages">
      <button
        type="button"
        disabled={page === 0}
        onClick={() => setPage((n) => n - 1)}
      >
        Previous
      </button>
      <span>
        Page {page + 1} of {pageCount}
      </span>
      <button
        type="button"
        disabled={page + 1 >= pageCount}
        onClick={() => setPage((n) => n + 1)}
      >
        Next
      </button>
    </div>
  );
}

function UnavailableNetworks({
  rows,
  retry,
}: {
  rows: PortfolioRow[];
  retry: (chainId: number) => void;
}) {
  if (!rows.length) return null;
  return (
    <div className="network-errors" aria-label="Unavailable networks">
      <h3>Some networks unavailable</h3>
      {rows.map((row) => (
        <p key={row.settings.chainId}>
          <strong>
            {networkName(row.settings.chainId, row.settings.name)}
          </strong>
          : {rowMessage(row)}{" "}
          <button type="button" onClick={() => retry(row.settings.chainId)}>
            Retry
          </button>
        </p>
      ))}
    </div>
  );
}
