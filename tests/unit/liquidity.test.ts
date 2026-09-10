import { expect, test } from "bun:test";
import { liquidityAtTick } from "../../src/liquidity";
import { parseQuoteDataFetcherResult } from "../../src/quoteData";

test("reconstructs overlapping position liquidity across both sides of the current tick", () => {
  const pool = parseQuoteDataFetcherResult([
    0,
    123n,
    30n,
    -100,
    100,
    [
      [20, -10n],
      [-20, 10n],
      [40, -20n],
      [-40, 20n],
    ],
  ])!;
  expect(pool.ticks.map((tick) => tick.number)).toEqual([-40, -20, 20, 40]);
  for (const [tick, expected] of [
    [-41, 0n],
    [-40, 20n],
    [-20, 30n],
    [0, 30n],
    [19, 30n],
    [20, 20n],
    [40, 0n],
  ] as const) {
    expect(liquidityAtTick(pool, pool.ticks, tick)).toBe(expected);
  }
  expect(parseQuoteDataFetcherResult({ tick: NaN })).toBeNull();
});
