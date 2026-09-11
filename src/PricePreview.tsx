import { Trans } from "@lingui/react/macro";
import { displayPrice, tickPrice, sqrtPrice } from "./prices";
import type { Descriptor } from "./types";
import type { Token } from "./contracts";

export function PricePreview({
  descriptor,
  initialTick,
  sqrtRatio,
  tokens,
}: {
  descriptor: Descriptor;
  initialTick?: number;
  sqrtRatio: bigint;
  tokens: [Token, Token];
}) {
  const [a, b] = tokens;
  if (sqrtRatio === 0n && initialTick === undefined)
    return (
      <p>
        <Trans>Pool state is unavailable.</Trans>
      </p>
    );
  const price =
    sqrtRatio === 0n
      ? tickPrice(initialTick ?? 0, a.decimals, b.decimals)
      : sqrtPrice(sqrtRatio, a.decimals, b.decimals);
  return (
    <div>
      {initialTick !== undefined ? (
        <p>
          {sqrtRatio === 0n ? (
            <Trans>New pool: creation will initialize its price.</Trans>
          ) : (
            <Trans>Existing pool: the initial-price input is ignored.</Trans>
          )}
        </p>
      ) : null}
      <p>
        <Trans>
          Price ({b.symbol} per {a.symbol}):
        </Trans>{" "}
        ≈ {displayPrice(price)}
      </p>
      <p>
        <Trans>Position range:</Trans> ≈{" "}
        {displayPrice(tickPrice(descriptor.tickLower, a.decimals, b.decimals))}{" "}
        —{" "}
        {displayPrice(tickPrice(descriptor.tickUpper, a.decimals, b.decimals))}
      </p>
      <details>
        <summary>
          <Trans>Exact ticks</Trans>
        </summary>
        <p>
          {descriptor.tickLower} — {descriptor.tickUpper}
        </p>
      </details>
    </div>
  );
}
