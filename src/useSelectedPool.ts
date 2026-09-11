import { useEffect, useEffectEvent, useState } from "react";
import { getAddress } from "viem";
import { fetchPools } from "./poolData";
import { poolConfig } from "./poolOptions";
import { networkCurrencies } from "./tokens";
import { useSession } from "./session";
import { errorMessage } from "./errors";
import type { CreateForm } from "./createForm";
export type SelectedPool = {
  key: string;
  state: Awaited<ReturnType<typeof fetchPools>>[number];
  decimals: [number, number];
};
export function useSelectedPool(form: CreateForm) {
  const { settings } = useSession();
  const { a, b, fee, exactFee, kind, extension, amplification, center } = form;
  const key = JSON.stringify([
    settings,
    a,
    b,
    fee,
    exactFee,
    kind,
    extension,
    amplification,
    center,
    form.range.spacing,
  ]);
  const [result, setResult] = useState<{
    key: string;
    data?: SelectedPool;
    error?: string;
  }>();
  const [retry, setRetry] = useState(0);
  const load = useEffectEvent(async () => {
    const tokens = [a, b].map((address) => {
      const token = networkCurrencies(settings).find(
        (token) => token.address.toLowerCase() === address.toLowerCase(),
      );
      if (!token)
        throw new Error(
          "Import this token's on-chain metadata before selecting a pool.",
        );
      return token;
    });
    const poolKey = {
      token0: getAddress(a),
      token1: getAddress(b),
      config: poolConfig(fee, form.range.spacing, form),
    };
    if (BigInt(a) >= BigInt(b))
      throw new Error("Choose two different tokens in address order.");
    const [state] = await fetchPools(settings, [poolKey]);
    return {
      key,
      state,
      decimals: tokens.map((token) => token.decimals) as [number, number],
    };
  });
  useEffect(() => {
    if (!a || !b) return;
    let active = true;
    const timer = setTimeout(() => {
      void load()
        .then((data) => {
          if (active) {
            setResult({ key, data });
          }
        })
        .catch((error) => {
          if (active) setResult({ key, error: errorMessage(error) });
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, a, b, retry]);
  const current = result?.key === key ? result : undefined;
  return {
    data: current?.data,
    error: current?.error,
    loading: !!a && !!b && !current,
    refresh: () => {
      setResult(undefined);
      setRetry((value) => value + 1);
    },
  };
}
