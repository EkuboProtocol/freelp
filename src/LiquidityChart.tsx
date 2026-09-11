import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
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
};
export function LiquidityChart({
  data,
  decimals0,
  decimals1,
  spacing,
  symbols,
  selection,
  onSelectRange,
}: Props) {
  const [zoom, setZoom] = useState(50);
  const [hover, setHover] = useState<number>();
  const start = useRef<number | undefined>(undefined);
  const { lower, upper, buckets } = useMemo(
    () => liquidityBuckets(data, spacing, zoom),
    [data, spacing, zoom],
  );
  const price = (tick: number) =>
    decimalDisplay(tickPrice(tick, decimals0, decimals1), 6);
  // Use token1-equivalent values only for bar heights, keeping exact amounts in tooltips.
  const priceNow = tickPrice(data.tick, decimals0, decimals1);
  const values = buckets.map((b) => [
    Number(formatUnits(b.amounts[0], decimals0)) * priceNow,
    Number(formatUnits(b.amounts[1], decimals1)),
  ]);
  const max = Math.max(...values.flat(), Number.MIN_VALUE);
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
            aria-label={t`Zoom out`}
            disabled={zoom >= 256}
            onClick={() => setZoom(Math.min(256, zoom * 2))}
          >
            −
          </button>
          <button
            aria-label={t`Zoom in`}
            disabled={zoom <= 4}
            onClick={() => setZoom(Math.max(4, zoom / 2))}
          >
            +
          </button>
        </div>
      </div>
      <svg
        viewBox="0 0 800 210"
        preserveAspectRatio="none"
        role="img"
        aria-label={t`Pool token amounts by price`}
        className="depth-chart"
        onPointerLeave={() => setHover(undefined)}
        onPointerDown={(event) => {
          start.current = pointerTick(event);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          const end = pointerTick(event),
            from = start.current;
          start.current = undefined;
          if (from !== undefined && from !== end)
            onSelectRange?.(Math.min(from, end), Math.max(from, end));
        }}
      >
        {selection ? (
          <rect
            x={x(selection.lower)}
            width={Math.max(0, x(selection.upper) - x(selection.lower))}
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
                x={
                  x(bucket.lower) +
                  ((x(bucket.upper) - x(bucket.lower)) * side) / 2
                }
                y={210 - (values[i][side] / max) * 190}
                width={Math.max(
                  0.5,
                  (x(bucket.upper) - x(bucket.lower)) / 2 - 1,
                )}
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
            <Trans>
              Hover for token amounts. Drag across the chart to select a range.
            </Trans>
          </small>
        )}
      </div>
      {selection ? (
        <div className="row spread">
          <span>{price(selection.lower)}</span>
          <small>
            <Trans>Selected range</Trans>
          </small>
          <span>{price(selection.upper)}</span>
        </div>
      ) : null}
      <small>
        <Trans>Only the range read from chain is shown.</Trans>
      </small>
    </div>
  );
}
