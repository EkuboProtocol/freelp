import { toSqrtRatio } from "@ekubo/sdk";
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
      {state === "closed"
        ? "Closed"
        : state === "active"
          ? "In range"
          : "Out of range"}
    </span>
  );
}
export function PositionRange({
  position,
  decimals = [0, 0],
  symbols,
}: {
  position: Position;
  decimals?: [number, number];
  symbols?: [string, string];
}) {
  const lower = tickPrice(position.descriptor.tickLower, ...decimals);
  const upper = tickPrice(position.descriptor.tickUpper, ...decimals);
  const current = sqrtPrice(position.sqrtRatio, ...decimals);
  const ratio =
    (Math.log(current) - Math.log(lower)) / (Math.log(upper) - Math.log(lower));
  const marker = Math.max(0, Math.min(100, ratio * 100));
  return (
    <div className="position-range">
      <div className="range-prices">
        <div>
          <span>Min price</span>
          <strong>{displayPrice(lower)}</strong>
        </div>
        <div className="current-price">
          <span>Current price</span>
          <strong>{displayPrice(current)}</strong>
        </div>
        <div>
          <span>Max price</span>
          <strong>{displayPrice(upper)}</strong>
        </div>
      </div>
      {symbols ? (
        <p className="price-unit">
          {symbols[1]} per {symbols[0]}
        </p>
      ) : null}
      <div
        className="position-range-track"
        role="img"
        aria-label={`Current price ${displayPrice(current)}; range ${displayPrice(lower)} to ${displayPrice(upper)}`}
      >
        <span style={{ left: `${Number.isFinite(marker) ? marker : 0}%` }} />
      </div>
    </div>
  );
}
