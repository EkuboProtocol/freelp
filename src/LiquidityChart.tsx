import { useMemo, useState, useRef } from "react";
import { formatUnits } from "viem";
import { liquidityBuckets } from "./liquidityBuckets";
import { decimalDisplay } from "./decimalFormat";
import { tickPrice } from "./prices";
import type { QuoteDataFetcherResult } from "./quoteData";
type Props = {
  data: QuoteDataFetcherResult;
  decimals0: number;
  decimals1: number;
  spacing: number;
  symbols: string[];
  selection?: { lower: number; upper: number };
  onSelectRange?: (lower: number, upper: number) => void;
  hypothetical?: boolean;
};
export function LiquidityChart({
  data,
  decimals0,
  decimals1,
  spacing,
  symbols,
  selection,
  onSelectRange,
  hypothetical = false,
}: Props) {
  const [zoom, setZoom] = useState(50);
  const [hover, setHover] = useState<number>();
  const [preview, setPreview] = useState<{ lower: number; upper: number }>();
  const start = useRef<number | undefined>(undefined);
  const { lower, upper, buckets } = useMemo(
    () => liquidityBuckets(data, spacing, zoom, selection),
    [data, spacing, zoom, selection],
  );
  const price = (tick: number) =>
    decimalDisplay(tickPrice(tick, decimals0, decimals1), 6);
  // Use token1-equivalent values only for bar heights, keeping exact amounts in tooltips.
  const priceNow = tickPrice(data.tick, decimals0, decimals1);
  const values = buckets.map((b) => [
    Number(formatUnits(b.amounts[0], decimals0)) * priceNow,
    Number(formatUnits(b.amounts[1], decimals1)),
  ]);
  const max = Math.max(...values.map(([a, b]) => a + b), Number.MIN_VALUE);
  const shownSelection = preview ?? selection;
  const x = (tick: number) =>
    Math.max(
      0,
      Math.min(800, ((tick - lower) / Math.max(1, upper - lower)) * 800),
    );
  const pointerTick = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return (
      Math.round(
        (lower +
          Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) *
            (upper - lower)) /
          spacing,
      ) * spacing
    );
  };
  const cancelSelection = () => {
    start.current = undefined;
    setPreview(undefined);
  };
  return (
    <div className="liquidity-chart">
      <div className="row spread">
        <small>
          <span className="token-bar-key" />
          {symbols[0]} <span className="token-bar-key secondary" />
          {symbols[1]}
        </small>
        <div className="row">
          <button
            aria-label={"Zoom out"}
            disabled={zoom >= 256}
            onClick={() => setZoom(Math.min(256, zoom * 2))}
          >
            −
          </button>
          <button
            aria-label={"Zoom in"}
            disabled={zoom <= 4}
            onClick={() => setZoom(Math.max(4, zoom / 2))}
          >
            +
          </button>
        </div>
      </div>
      <p>
        {hypothetical ? "Initial" : "Current"} price: {price(data.tick)}{" "}
        {symbols[1]} per {symbols[0]}
      </p>
      <svg
        viewBox="0 0 800 210"
        preserveAspectRatio="none"
        role="img"
        aria-label={"Pool token amounts by price"}
        className="depth-chart"
        onPointerLeave={() => setHover(undefined)}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancelSelection();
        }}
        tabIndex={onSelectRange ? 0 : undefined}
        onPointerDown={(event) => {
          if (!onSelectRange) return;
          start.current = pointerTick(event);
          setPreview({ lower: start.current, upper: start.current });
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (start.current !== undefined)
            setPreview({
              lower: Math.min(start.current, pointerTick(event)),
              upper: Math.max(start.current, pointerTick(event)),
            });
        }}
        onPointerUp={(event) => {
          const end = pointerTick(event),
            from = start.current;
          start.current = undefined;
          if (from !== undefined && from !== end)
            onSelectRange?.(Math.min(from, end), Math.max(from, end));
          setPreview(undefined);
        }}
        onPointerCancel={cancelSelection}
      >
        {shownSelection ? (
          <rect
            x={x(shownSelection.lower)}
            width={Math.max(
              0,
              x(shownSelection.upper) - x(shownSelection.lower),
            )}
            height="210"
            fill="#000"
            opacity="0.08"
          />
        ) : null}
        {buckets.map((bucket, i) => (
          <g key={bucket.lower} onPointerEnter={() => setHover(i)}>
            {bucket.amounts.map((amount, side) => (
              <rect
                key={side}
                x={x(bucket.lower)}
                y={
                  210 -
                  (values[i]
                    .slice(0, side + 1)
                    .reduce((sum, value) => sum + value, 0) /
                    max) *
                    190
                }
                width={Math.max(0.5, x(bucket.upper) - x(bucket.lower) - 1)}
                height={(values[i][side] / max) * 190}
                fill={side === 0 ? "#111" : "#999"}
              >
                <title>
                  {price(bucket.lower)}–{price(bucket.upper)}:{" "}
                  {formatUnits(amount, side === 0 ? decimals0 : decimals1)}{" "}
                  {symbols[side]}
                </title>
              </rect>
            ))}
            <rect
              x={x(bucket.lower)}
              width={Math.max(1, x(bucket.upper) - x(bucket.lower))}
              height="210"
              fill="transparent"
            />
          </g>
        ))}
        <line
          x1={x(data.tick)}
          x2={x(data.tick)}
          y1="0"
          y2="210"
          stroke="#111"
          strokeDasharray="4 4"
        />
      </svg>
      <div className="row spread chart-axis">
        <span>{price(lower)}</span>
        <span>{price(upper)}</span>
      </div>
      <div className="chart-tooltip" role="status">
        {hover !== undefined && buckets[hover] ? (
          <>
            <span>
              {price(buckets[hover].lower)}–{price(buckets[hover].upper)}
            </span>
            {buckets[hover].amounts.map((amount, side) => (
              <span key={side}>
                {formatUnits(amount, side === 0 ? decimals0 : decimals1)}{" "}
                {symbols[side]}
              </span>
            ))}
          </>
        ) : (
          <small>
            Hover for token amounts. Drag to select a range, or edit its bounds
            in the fields below. Press Escape to cancel a drag.
          </small>
        )}
      </div>
      {selection ? (
        <div className="row spread">
          <span>{price(selection.lower)}</span>
          <small>Selected range</small>
          <span>{price(selection.upper)}</span>
        </div>
      ) : null}
      <DepthDescription
        data={data}
        hypothetical={hypothetical}
        lower={lower}
        upper={upper}
        selection={selection}
      />
      <details className="depth-values">
        <summary>Read depth values</summary>
        <div
          className="depth-values-scroll"
          tabIndex={0}
          role="region"
          aria-label="Exact liquidity depth values"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Price range</th>
                <th scope="col">{symbols[0]}</th>
                <th scope="col">{symbols[1]}</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket) => (
                <tr key={bucket.lower}>
                  <th scope="row">
                    {price(bucket.lower)}–{price(bucket.upper)}
                  </th>
                  <td>{formatUnits(bucket.amounts[0], decimals0)}</td>
                  <td>{formatUnits(bucket.amounts[1], decimals1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function DepthDescription({
  data,
  hypothetical,
  lower,
  upper,
  selection,
}: {
  data: QuoteDataFetcherResult;
  hypothetical: boolean;
  lower: number;
  upper: number;
  selection?: Props["selection"];
}) {
  const outside =
    selection && (selection.lower < lower || selection.upper > upper);
  return (
    <div className="muted">
      <small>
        {hypothetical
          ? "This is an initial-price preview. The pool has no on-chain liquidity yet."
          : `Depth coverage: ticks ${data.minTick} to ${data.maxTick}, from the latest RPC read.`}
      </small>
      {!hypothetical && data.liquidity === 0n && data.ticks.length === 0 ? (
        <p>No liquidity was found within this coverage.</p>
      ) : null}
      {outside ? (
        <p>
          Part of your selected range is outside the displayed depth window. Its
          bounds remain unchanged; liquidity beyond the read coverage is
          unknown.
        </p>
      ) : null}
    </div>
  );
}
