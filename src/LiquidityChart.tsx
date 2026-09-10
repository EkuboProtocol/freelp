import { t } from "@lingui/core/macro";
import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { liquidityAtTick } from "./liquidity";
import type { QuoteDataFetcherResult } from "./quoteData";

export function LiquidityChart({
  data,
  decimals0,
  decimals1,
  spacing,
}: {
  data: QuoteDataFetcherResult;
  decimals0: number;
  decimals1: number;
  spacing: number;
}) {
  const [zoom, setZoom] = useState(50);
  const [hover, setHover] = useState<number>();
  const lower = Math.max(data.minTick, data.tick - spacing * zoom);
  const upper = Math.min(data.maxTick, data.tick + spacing * zoom);
  const samples = Array.from({ length: 80 }, (_, index) => {
    const tick = Math.floor(lower + ((upper - lower) * (index + 0.5)) / 80);
    return { tick, liquidity: liquidityAtTick(data, data.ticks, tick) };
  });
  const max = samples.reduce(
    (value, point) => (point.liquidity > value ? point.liquidity : value),
    1n,
  );
  const price = (tick: number) =>
    (
      Math.exp(tick * Math.log1p(0.000001)) *
      10 ** (decimals0 - decimals1)
    ).toPrecision(5);
  const selected = samples[hover ?? 40];
  return (
    <div className="liquidity-chart">
      <div className="row spread">
        <div>
          <h3>
            <Trans>Liquidity distribution</Trans>
          </h3>
          <small>
            <Trans>Current pool liquidity, read directly from chain</Trans>
          </small>
        </div>
        <div className="segmented">
          {[10, 25, 50, 100].map((value) => (
            <button
              key={value}
              aria-pressed={zoom === value}
              onClick={() => setZoom(value)}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
      <svg
        viewBox="0 0 800 240"
        role="img"
        aria-label={t`Pool liquidity by price`}
        onMouseLeave={() => setHover(undefined)}
      >
        <line x1="0" y1="210" x2="800" y2="210" stroke="#ccc" />
        {samples.map((point, index) => (
          <rect
            key={index}
            x={index * 10 + 1}
            y={210 - Number((point.liquidity * 190n) / max)}
            width="8"
            height={Number((point.liquidity * 190n) / max)}
            fill={index === hover ? "#111" : "#888"}
            onMouseEnter={() => setHover(index)}
          >
            <title>
              {price(point.tick)}: {point.liquidity.toString()}
            </title>
          </rect>
        ))}
        <line
          x1={((data.tick - lower) / Math.max(upper - lower, 1)) * 800}
          x2={((data.tick - lower) / Math.max(upper - lower, 1)) * 800}
          y1="10"
          y2="212"
          stroke="#111"
          strokeDasharray="4 4"
        />
        <text x="0" y="236" fontSize="13">
          {price(lower)}
        </text>
        <text x="800" y="236" textAnchor="end" fontSize="13">
          {price(upper)}
        </text>
      </svg>
      <div className="row spread">
        <small>
          <Trans>Price</Trans> {price(selected.tick)}
        </small>
        <small>
          <Trans>Active liquidity</Trans> {selected.liquidity.toString()}
        </small>
      </div>
      <small>
        <Trans>
          Only the on-chain tick range fetched is shown. Empty space outside
          that range is not assumed to have zero liquidity.
        </Trans>
      </small>
    </div>
  );
}
