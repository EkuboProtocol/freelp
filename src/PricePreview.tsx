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
    return <p>Pool state is unavailable.</p>;
  const price =
    sqrtRatio === 0n
      ? tickPrice(initialTick ?? 0, a.decimals, b.decimals)
      : sqrtPrice(sqrtRatio, a.decimals, b.decimals);
  return (
    <div>
      {initialTick !== undefined ? (
        <p>
          {sqrtRatio === 0n
            ? "New pool: creation will initialize its price."
            : "Existing pool: the initial-price input is ignored."}
        </p>
      ) : null}
      <p>
        Price ({b.symbol} per {a.symbol}): ≈ {displayPrice(price)}
      </p>
      <p>
        Position range: ≈{" "}
        {displayPrice(tickPrice(descriptor.tickLower, a.decimals, b.decimals))}{" "}
        —{" "}
        {displayPrice(tickPrice(descriptor.tickUpper, a.decimals, b.decimals))}
      </p>
    </div>
  );
}
