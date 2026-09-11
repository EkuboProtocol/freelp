import { useEffect, useState } from "react";
import { loadPortfolio } from "./portfolio";
import { useSession } from "./session";
import type { Position, Settings } from "./types";
type Row = {
  settings: Settings;
  items: Position[];
  error?: string;
  scope: string;
};
export function usePortfolio(refresh: number) {
  const { networks, account, revision } = useSession();
  const identity = JSON.stringify([networks, account]);
  const scope = JSON.stringify([identity, revision, refresh]);
  const [loaded, setLoaded] = useState<{ identity: string; rows: Row[] }>({
    identity: "",
    rows: [],
  });
  useEffect(() => {
    let active = true;
    if (!account) return;
    for (const settings of networks) {
      void loadPortfolio(settings, account)
        .then((result) => ({ settings, ...result, scope }))
        .then((row) => {
          if (active)
            setLoaded((previous) => ({
              identity,
              rows: [
                ...(previous.identity === identity
                  ? previous.rows.filter(
                      (r) => r.settings.chainId !== settings.chainId,
                    )
                  : []),
                row,
              ],
            }));
        });
    }
    return () => {
      active = false;
    };
  }, [networks, account, revision, refresh, identity, scope]);
  const rows = loaded.identity === identity ? loaded.rows : [];
  return {
    rows: rows.map((row) => ({ ...row, fresh: row.scope === scope })),
    pending: account
      ? networks.length - rows.filter((row) => row.scope === scope).length
      : 0,
  };
}
