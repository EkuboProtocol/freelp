import { errorMessage } from "./errors";
import { useEffect, useEffectEvent, useState } from "react";
import { tokenBalances } from "./balances";
import { networkCurrencies } from "./tokens";
import { useSession } from "./session";
import type { Settings } from "./types";
export type BalanceState = { balances?: Map<string, bigint>; error?: string };
export function useTokenBalances(
  networks: readonly Settings[],
  enabled: boolean,
  refresh: number,
) {
  const { account, revision } = useSession();
  const plans = networks.map((settings) => ({
    settings,
    tokens: networkCurrencies(settings).map((t) => t.address),
  }));
  const key = JSON.stringify([plans, account, revision, refresh]);
  const [loaded, setLoaded] = useState<{
    key: string;
    chains: Map<number, BalanceState>;
  }>({ key: "", chains: new Map() });
  const start = useEffectEvent(() => {
    let active = true;
    if (!account) return;
    for (const plan of plans) {
      void tokenBalances(plan.settings, account, plan.tokens, revision, refresh)
        .then((balances) => ({ balances }))
        .catch((error) => ({ error: errorMessage(error) }))
        .then((result) => {
          if (active)
            setLoaded((previous) => ({
              key,
              chains: new Map(previous.key === key ? previous.chains : []).set(
                plan.settings.chainId,
                result,
              ),
            }));
        });
    }
    return () => {
      active = false;
    };
  });
  useEffect(() => {
    if (enabled) return start();
  }, [key, enabled]);
  return loaded.key === key ? loaded.chains : new Map<number, BalanceState>();
}
