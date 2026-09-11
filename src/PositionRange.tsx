import { toSqrtRatio } from "@ekubo/sdk";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { sqrtPrice, tickPrice, displayPrice } from "./prices";
import type { Position } from "./types";
export function positionState(position: Position) {
  if (position.amounts.liquidity === 0n) return "closed";
  return position.sqrtRatio >=
    toSqrtRatio(position.descriptor.tickLower, "evm") &&
    position.sqrtRatio < toSqrtRatio(position.descriptor.tickUpper, "evm")
    ? "active"
    : "inactive";
}
export function PositionStatus({ position }: { position: Position }) {
  const state = positionState(position);
  return (
    <span className={`position-status ${state}`}>
      {state === "closed" ? (
        <Trans>Closed</Trans>
      ) : state === "active" ? (
        <Trans>In range</Trans>
      ) : (
        <Trans>Out of range</Trans>
      )}
    </span>
  );
}
export function PositionRange({
  position,
  decimals = [0, 0],
}: {
  position: Position;
  decimals?: [number, number];
}) {
  const lower = tickPrice(position.descriptor.tickLower, ...decimals);
  const upper = tickPrice(position.descriptor.tickUpper, ...decimals);
  const current = sqrtPrice(position.sqrtRatio, ...decimals);
  const ratio =
    (Math.log(current) - Math.log(lower)) / (Math.log(upper) - Math.log(lower));
  const marker = Math.max(0, Math.min(100, ratio * 100));
  return (
    <div className="position-range">
      <div
        className="position-range-track"
        role="img"
        aria-label={t`Current price ${displayPrice(current)}; range ${displayPrice(lower)} to ${displayPrice(upper)}`}
      >
        <span style={{ left: `${Number.isFinite(marker) ? marker : 0}%` }} />
      </div>
      <div className="row spread">
        <span>{displayPrice(lower)}</span>
        <span>{displayPrice(upper)}</span>
      </div>
    </div>
  );
}
