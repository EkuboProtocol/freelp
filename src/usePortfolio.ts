import { useCallback, useEffect, useRef, useState } from "react";
import { loadPortfolio, type PortfolioAvailability } from "./portfolio";
import { errorMessage } from "./errors";
import { useSession } from "./session";
import type { Position, Settings } from "./types";

export type PortfolioRow = {
  settings: Settings;
  items: Position[];
  availability: PortfolioAvailability | "loading";
  error?: string;
  loadedAt?: number;
  stale: boolean;
  ticket?: number;
  generation?: string;
};
type Snapshot = { identity: string; rows: PortfolioRow[] };

function emptyRow(settings: Settings): PortfolioRow {
  return { settings, items: [], availability: "loading", stale: true };
}

export function settledPortfolioRow(
  row: PortfolioRow,
  result: Awaited<ReturnType<typeof loadPortfolio>>,
): PortfolioRow {
  const available =
    result.availability === "available" ||
    result.availability === "available-empty";
  return {
    ...row,
    availability: result.availability,
    error: result.error,
    items:
      result.availability === "unavailable"
        ? row.items
        : [...result.items].sort((a, b) =>
            a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
          ),
    loadedAt: available ? Date.now() : row.loadedAt,
    stale: !available,
  };
}

export function usePortfolio(refresh: number) {
  const { networks, account, revision } = useSession();
  const identity = JSON.stringify([networks, account]);
  const [loaded, setLoaded] = useState<Snapshot>({ identity: "", rows: [] });
  const requests = useRef(new Map<string, Promise<void>>());
  const sequence = useRef(0);
  const generation = JSON.stringify([identity, revision, refresh]);

  const refreshChain = useCallback(
    (chainId: number): Promise<void> => {
      const settings = networks.find((network) => network.chainId === chainId);
      if (!account || !settings) return Promise.resolve();
      const key = `${generation}:${chainId}`;
      const pending = requests.current.get(key);
      if (pending) return pending;
      const ticket = ++sequence.current;
      setLoaded((previous) => {
        const rows = previous.identity === identity ? previous.rows : [];
        return {
          identity,
          rows: networks.map((network) => {
            const row =
              rows.find((row) => row.settings.chainId === network.chainId) ??
              emptyRow(network);
            return network.chainId === chainId
              ? {
                  ...row,
                  availability: "loading",
                  stale: true,
                  ticket,
                  generation,
                }
              : row;
          }),
        };
      });
      const update = (result: Awaited<ReturnType<typeof loadPortfolio>>) =>
        setLoaded((previous) => {
          if (previous.identity !== identity) return previous;
          return {
            ...previous,
            rows: previous.rows.map((row) =>
              row.settings.chainId === chainId && row.ticket === ticket
                ? settledPortfolioRow(row, result)
                : row,
            ),
          };
        });
      const request = loadPortfolio(settings, account)
        .then(update)
        .catch((error) =>
          update({
            items: [],
            availability: "unavailable",
            error: errorMessage(error),
          }),
        )
        .finally(() => requests.current.delete(key));
      requests.current.set(key, request);
      return request;
    },
    [account, networks, identity, generation],
  );

  useEffect(() => {
    if (account)
      for (const settings of networks) void refreshChain(settings.chainId);
  }, [account, networks, refreshChain]);
  const snapshots = !account
    ? []
    : networks.map(
        (settings) =>
          (loaded.identity === identity
            ? loaded.rows.find(
                (row) => row.settings.chainId === settings.chainId,
              )
            : undefined) ?? emptyRow(settings),
      );
  const rows = snapshots.map((row) =>
    row.generation === generation
      ? row
      : { ...row, availability: "loading" as const, stale: true },
  );
  return {
    rows,
    pending: rows.filter((row) => row.availability === "loading").length,
    refreshChain,
    refreshAll: () =>
      Promise.all(networks.map((network) => refreshChain(network.chainId))),
  };
}
