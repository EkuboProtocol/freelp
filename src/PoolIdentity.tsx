import { decodeEvmPoolConfig } from "@ekubo/sdk";
import { decimalDisplay } from "./decimalFormat";
import { percentFromExactFee } from "./fee";
import { spacingPercent } from "./pools";
import type { Descriptor } from "./types";
import "./identity.css";
export function PoolIdentity({ descriptor }: { descriptor: Descriptor }) {
  const config = decodeEvmPoolConfig(descriptor.poolKey.config);
  const fee = config.fee;
  return (
    <div className="pool-identity">
      <p className="muted">
        <span title={percentFromExactFee(fee.toString()) + "%"}>
          Fee: {decimalDisplay(Number(percentFromExactFee(fee.toString())))}%
        </span>
        {" · "}
        {config.poolType === "concentrated" ? (
          <>
            Tick spacing: {decimalDisplay(spacingPercent(config.tickSpacing))}%
          </>
        ) : config.poolType === "stableswap" ? (
          "Stableswap"
        ) : (
          "Full range"
        )}
      </p>
      <details>
        <summary>Show full pool identity</summary>
        <dl className="pool-identity-details">
          <dt>Token 0</dt>
          <dd className="mono">{descriptor.poolKey.token0}</dd>
          <dt>Token 1</dt>
          <dd className="mono">{descriptor.poolKey.token1}</dd>
          <dt>Pool type</dt>
          <dd>
            {config.poolType === "concentrated"
              ? "Concentrated liquidity"
              : config.poolType === "stableswap"
                ? "Stableswap"
                : "Full range"}
          </dd>
          <dt>Fee (uint64 Q64)</dt>
          <dd className="mono">{fee.toString()}</dd>
          {config.poolType === "concentrated" ? (
            <>
              <dt>Tick spacing</dt>
              <dd>{config.tickSpacing}</dd>
            </>
          ) : (
            <>
              <dt>Center tick</dt>
              <dd>{config.stableswapParams.centerTick}</dd>
              <dt>Amplification exponent</dt>
              <dd>{config.stableswapParams.amplification}</dd>
            </>
          )}
          <dt>Extension</dt>
          <dd className="mono">{config.extension}</dd>
          <dt>Config</dt>
          <dd className="mono">{descriptor.poolKey.config}</dd>
        </dl>
      </details>
    </div>
  );
}
