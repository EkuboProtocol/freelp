// Adapted from EkuboProtocol/interface useQuoteData.ts.
export type QuoteDataFetcherResult = {
  tick: number;
  liquidity: bigint;
  minTick: number;
  maxTick: number;
  ticks: { number: number; liquidityDelta: bigint }[];
  sqrtRatio: bigint;
};

function parseTickDeltas(raw: unknown) {
  const entries =
    (raw as Array<{ number?: number | bigint; liquidityDelta?: bigint }>) ?? [];

  return entries
    .map((entry) => {
      const item = entry as {
        number?: number | bigint;
        liquidityDelta?: bigint;
        [key: number]: unknown;
      };
      return {
        number: readNumber(item.number, item[0]),
        liquidityDelta: readBigInt(item.liquidityDelta, item[1]),
      };
    })
    .filter((entry) => Number.isFinite(entry.number))
    .sort((a, b) => a.number - b.number);
}

// The decoded struct is read by name where viem gives us one and by position
// otherwise, so the same parser handles either shape.
function readNumber(named: number | bigint | undefined, positional: unknown) {
  return Number(named ?? (positional as number | bigint | undefined));
}

function readBigInt(named: bigint | undefined, positional: unknown) {
  return BigInt((named ?? positional ?? 0n) as bigint);
}

export function parseQuoteDataFetcherResult(
  raw: unknown,
): QuoteDataFetcherResult | null {
  if (!raw || typeof raw !== "object") return null;
  const result = raw as {
    tick?: number | bigint;
    sqrtRatio?: bigint;
    liquidity?: bigint;
    minTick?: number | bigint;
    maxTick?: number | bigint;
    ticks?: Array<unknown>;
    [key: number]: unknown;
  };

  const tick = readNumber(result.tick, result[0]);
  const sqrtRatio = readBigInt(result.sqrtRatio, result[1]);
  const liquidity = readBigInt(result.liquidity, result[2]);
  const minTick = readNumber(result.minTick, result[3]);
  const maxTick = readNumber(result.maxTick, result[4]);

  if (
    !Number.isFinite(tick) ||
    !Number.isFinite(minTick) ||
    !Number.isFinite(maxTick)
  )
    return null;

  return {
    tick,
    sqrtRatio,
    liquidity,
    minTick,
    maxTick,
    ticks: parseTickDeltas(result.ticks ?? result[5]),
  };
}
