import { decodeEvmPoolConfig } from "@ekubo/sdk";
import { decimalDisplay } from "./decimalFormat";
import { percentFromExactFee } from "./fee";
import { spacingPercent } from "./pools";
import type { Descriptor } from "./types";
export function PoolIdentity({ descriptor }: { descriptor: Descriptor }) {
  const config = decodeEvmPoolConfig(descriptor.poolKey.config);
  const fee = config.fee;
  return (
    <p className="muted">
      <span title={percentFromExactFee(fee.toString()) + "%"}>
        Fee: {decimalDisplay(Number(percentFromExactFee(fee.toString())))}%
      </span>
      {" · "}
      {config.poolType === "concentrated" ? (
        <>Tick spacing: {decimalDisplay(spacingPercent(config.tickSpacing))}%</>
      ) : (
        "Stableswap"
      )}
    </p>
  );
}
