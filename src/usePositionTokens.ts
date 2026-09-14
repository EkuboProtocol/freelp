import { useEffect, useRef, useState } from "react";
import { readPositionToken, type PositionTokenRead } from "./positionToken";
import { useSession } from "./session";
import type { Address } from "viem";
import type { Position } from "./types";
import type { Token } from "./contracts";

type Loaded = {
  identity: string;
  scope: string;
  reads: [PositionTokenRead, PositionTokenRead];
};
/** Reads token metadata for the position; balances belong to the holder. */
export function usePositionTokens(position: Position, holder?: Address) {
  const { settings, account: connected, revision } = useSession();
  const account = connected ?? holder;
  const [refresh, setRefresh] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>();
  const previous = useRef<Loaded | undefined>(undefined);
  const { token0, token1 } = position.descriptor.poolKey;
  const identity = JSON.stringify([settings, account, token0, token1]);
  const scope = JSON.stringify([identity, revision, refresh]);
  useEffect(() => {
    if (!account) return;
    let active = true;
    const cached =
      previous.current?.identity === identity
        ? previous.current.reads
        : undefined;
    void Promise.all([
      readPositionToken(settings, token0, account, cached?.[0].token),
      readPositionToken(settings, token1, account, cached?.[1].token),
    ]).then((reads) => {
      if (!active) return;
      const next = { identity, scope, reads };
      previous.current = next;
      setLoaded(next);
    });
    return () => {
      active = false;
    };
  }, [account, settings, token0, token1, identity, scope]);
  const reads = loaded?.identity === identity ? loaded.reads : undefined;
  return {
    tokens: reads?.map((read) => read.token) as [Token, Token] | undefined,
    readiness: loaded?.scope === scope ? reads : undefined,
    refreshTokens: () => setRefresh((value) => value + 1),
  };
}
