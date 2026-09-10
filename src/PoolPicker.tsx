import { useEffect, useRef, useState } from "react";
import { erc20Abi, getAddress, isAddress, zeroAddress } from "viem";
import { Trans } from "@lingui/react/macro";
import { useSession, rpc } from "./session";
import { fetchPools, POOL_PRESETS } from "./poolData";
import { concentratedConfig } from "./pools";
import { currencies } from "./tokens";
import { LiquidityChart } from "./LiquidityChart";
import { ErrorText } from "./common";
type PoolStates = Awaited<ReturnType<typeof fetchPools>>;
type Loaded = { key: string; states: PoolStates; decimals: [number, number] };
export function PoolPicker({
  token0,
  token1,
  fee,
  spacing,
  onSelect,
}: {
  token0: string;
  token1: string;
  fee: string;
  spacing: number;
  onSelect: (fee: string, spacing: number, currentPrice?: string) => void;
}) {
  const { settings } = useSession();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [loaded, setLoaded] = useState<Loaded>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const presets = POOL_PRESETS.some(
    (preset) => preset.fee === fee && preset.spacing === spacing,
  )
    ? POOL_PRESETS
    : [...POOL_PRESETS, { fee, spacing }];
  const key = JSON.stringify([settings, token0, token1, presets]);
  const data = loaded?.key === key ? loaded : undefined;
  const selected = presets.findIndex(
    (preset) => preset.fee === fee && preset.spacing === spacing,
  );
  async function decimals(address: string) {
    if (address === zeroAddress) return 18;
    try {
      return await rpc(settings).readContract({
        address: getAddress(address),
        abi: erc20Abi,
        functionName: "decimals",
      });
    } catch (error) {
      const imported = currencies(settings.chainId).find(
        (token) => token.address.toLowerCase() === address.toLowerCase(),
      );
      if (imported) return imported.decimals;
      throw new Error(
        "Import token decimals before displaying its price chart.",
        { cause: error },
      );
    }
  }
  function select(index: number, result = data) {
    const preset = presets[index],
      state = result?.states[index];
    const price =
      state?.sqrtRatio && result
        ? String(
            Math.exp(state.tick * Math.log1p(0.000001)) *
              10 ** (result.decimals[0] - result.decimals[1]),
          )
        : undefined;
    onSelect(preset.fee, preset.spacing, price);
  }
  async function discover() {
    setBusy(true);
    setError("");
    try {
      const keys = presets.map((preset) => ({
        token0: getAddress(token0),
        token1: getAddress(token1),
        config: concentratedConfig(preset.fee, preset.spacing),
      }));
      const [states, d0, d1] = await Promise.all([
        fetchPools(settings, keys),
        decimals(token0),
        decimals(token1),
      ]);
      if (!active.current) return;
      const next: Loaded = { key, states, decimals: [d0, d1] };
      setLoaded(next);
      const first = states.findIndex((state) => state.sqrtRatio !== 0n);
      if (first >= 0) select(first, next);
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pool-picker">
      <div className="row spread">
        <h3>
          <Trans>Choose a pool</Trans>
        </h3>
        <button
          disabled={busy || !isAddress(token0) || !isAddress(token1)}
          onClick={() => void discover()}
        >
          <Trans>Find pools on chain</Trans>
        </button>
      </div>
      <div className="pool-options">
        {presets.map((preset, index) => (
          <button
            key={`${preset.fee}:${preset.spacing}`}
            className={selected === index ? "selected" : ""}
            onClick={() => select(index)}
          >
            <strong>{preset.fee}%</strong>
            <small>
              {data?.states[index].sqrtRatio ? (
                <Trans>Existing pool</Trans>
              ) : (
                <Trans>Fee tier</Trans>
              )}
            </small>
            <small>
              <Trans>Tick spacing</Trans> {preset.spacing}
            </small>
          </button>
        ))}
      </div>
      {data && selected >= 0 ? (
        <PoolChart data={data} selected={selected} spacing={spacing} />
      ) : null}
      <ErrorText error={error} />
    </section>
  );
}
function PoolChart({
  data,
  selected,
  spacing,
}: {
  data: Loaded;
  selected: number;
  spacing: number;
}) {
  const state = data.states[selected];
  return state.sqrtRatio !== 0n ? (
    <LiquidityChart
      data={state}
      decimals0={data.decimals[0]}
      decimals1={data.decimals[1]}
      spacing={spacing}
    />
  ) : (
    <p>
      <Trans>
        This pool is not initialized. Set its initial price when creating the
        first position.
      </Trans>
    </p>
  );
}
