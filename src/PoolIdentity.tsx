import { decodeEvmPoolConfig } from "@ekubo/sdk";
import { Trans } from "@lingui/react/macro";
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
        <Trans>Fee:</Trans>{" "}
        {decimalDisplay(Number(percentFromExactFee(fee.toString())))}%
      </span>
      {" · "}
      {config.poolType === "concentrated" ? (
        <>
          <Trans>Tick spacing:</Trans>{" "}
          {decimalDisplay(spacingPercent(config.tickSpacing))}%
        </>
      ) : (
        <Trans>Stableswap</Trans>
      )}
    </p>
  );
}
