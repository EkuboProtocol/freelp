import { useCallback, useEffect, useRef, useState } from "react";
import { getAddress, isAddress } from "viem";
import {
  readRegistryPage,
  type RegisteredPool,
  type RegistrySnapshot,
} from "./poolRegistry";
import { useSession } from "./session";
import { errorMessage } from "./errors";

type State = {
  identity: string;
  pools: RegisteredPool[];
  snapshot?: RegistrySnapshot;
  scanned: bigint;
  loading: boolean;
  error: string;
};
function empty(identity: string): State {
  return { identity, pools: [], scanned: 0n, loading: false, error: "" };
}

export function usePoolRegistry(tokenA: string, tokenB: string) {
  const { settings, revision } = useSession();
  const identity = JSON.stringify([
    settings,
    tokenA.toLowerCase(),
    tokenB.toLowerCase(),
    revision,
  ]);
  const validPair =
    isAddress(tokenA) &&
    isAddress(tokenB) &&
    tokenA.toLowerCase() !== tokenB.toLowerCase();
  const [state, setState] = useState<State>(() => empty(""));
  const active = useRef({ generation: 0, pending: false, state: empty("") });
  const load = useCallback(
    async (append: boolean) => {
      const guard = active.current;
      if (!validPair || guard.pending) return;
      const generation = guard.generation;
      const previous = append ? guard.state : empty(identity);
      guard.pending = true;
      setState({ ...previous, identity, loading: true, error: "" });
      try {
        const page = await readRegistryPage(
          settings,
          getAddress(tokenA),
          getAddress(tokenB),
          previous.scanned,
          undefined,
          previous.snapshot,
        );
        if (generation !== guard.generation) return;
        const pools = [
          ...new Map(
            [...previous.pools, ...page.pools].map((pool) => [
              pool.id.toLowerCase(),
              pool,
            ]),
          ).values(),
        ];
        guard.state = {
          identity,
          pools,
          snapshot: page.snapshot,
          scanned: page.scanned,
          loading: false,
          error: "",
        };
        setState(guard.state);
      } catch (error) {
        if (generation === guard.generation)
          setState({
            ...previous,
            identity,
            loading: false,
            error: errorMessage(error),
          });
      } finally {
        if (generation === guard.generation) guard.pending = false;
      }
    },
    [identity, validPair, settings, tokenA, tokenB],
  );
  useEffect(() => {
    const guard = active.current;
    guard.generation++;
    guard.pending = false;
    guard.state = empty(identity);
    setState({ ...empty(identity), loading: validPair });
    const timer = setTimeout(() => {
      void load(false);
    }, 250);
    return () => {
      clearTimeout(timer);
      guard.generation++;
      guard.pending = false;
    };
  }, [identity, load, validPair]);
  const current = state.identity === identity ? state : empty(identity);
  const total = current.snapshot?.total ?? 0n;
  return {
    ...current,
    validPair,
    total,
    loading: validPair && (current.loading || state.identity !== identity),
    hasMore: current.scanned < total,
    retry: () => void load(false),
    loadMore: () => void load(true),
  };
}
