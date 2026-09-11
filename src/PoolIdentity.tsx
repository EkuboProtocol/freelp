import { Trans } from "@lingui/react/macro";
import { decimalDisplay } from "./decimalFormat";
import { percentFromExactFee } from "./fee";
import { spacingPercent } from "./pools";
import type { Descriptor } from "./types";
export function PoolIdentity({ descriptor }: { descriptor: Descriptor }) {
  const config = BigInt(descriptor.poolKey.config);
  const fee = (config >> 32n) & ((1n << 64n) - 1n);
  const concentrated = (config & (1n << 31n)) !== 0n;
  return (
    <p className="muted">
      <span title={percentFromExactFee(fee.toString()) + "%"}>
        <Trans>Fee:</Trans>{" "}
        {decimalDisplay(Number(percentFromExactFee(fee.toString())))}%
      </span>
      {" · "}
      {concentrated ? (
        <>
          <Trans>Tick spacing:</Trans>{" "}
          {decimalDisplay(spacingPercent(Number(config & 0x7fffffffn)))}%
        </>
      ) : (
        <Trans>Stableswap</Trans>
      )}
    </p>
  );
}
