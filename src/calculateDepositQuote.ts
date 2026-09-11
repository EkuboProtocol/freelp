import { floatSqrtRatioToFixed, toSqrtRatio } from "@ekubo/sdk";
import { networkCurrencies } from "./tokens";
import { getAddress } from "viem";
import { poolConfig, poolRange, type PoolOptions } from "./poolOptions";
import { parseAmount } from "./amounts";
import { type RangeInput } from "./prices";
import { quoteDeposit } from "./depositQuote";
import type { Address } from "viem";
import type { Token } from "./contracts";
import type { Currency } from "./tokens";
import type { Settings } from "./types";
type Input = {
  settings: Settings;
  account?: Address;
  a: string;
  b: string;
  maxA: string;
  maxB: string;
  fee: string;
  range: RangeInput;
  specified: 0 | 1;
  options: PoolOptions;
  initialized: boolean;
  tokens?: [import("./contracts").Token, import("./contracts").Token];
  state: import("./quoteData").QuoteDataFetcherResult;
};
export function calculateDepositQuote(input: Input) {
  const { settings, range } = input;
  const addresses = [getAddress(input.a), getAddress(input.b)];
  if (BigInt(addresses[0]) >= BigInt(addresses[1]))
    throw new Error("Choose two different tokens in address order.");
  const poolKey = {
    token0: addresses[0],
    token1: addresses[1],
    config: poolConfig(input.fee, range.spacing, input.options),
  };
  const metadata = [input.a, input.b].map((address) => {
    const currency = networkCurrencies(settings).find(
      (entry) => entry.address.toLowerCase() === address.toLowerCase(),
    );
    if (!currency)
      throw new Error(
        "Import this token's on-chain metadata before creating a position.",
      );
    return currency;
  });
  const amounts: [bigint, bigint] = [0n, 0n];
  amounts[input.specified] = parseAmount(
    input.specified === 0 ? input.maxA : input.maxB,
    metadata[input.specified].decimals,
  );
  if (amounts[input.specified] === 0n)
    throw new Error("Enter an amount greater than zero.");
  // Validate the pool key and range before calculating with the SDK.
  poolRange(
    range,
    metadata[0].decimals,
    metadata[1].decimals,
    input.initialized,
    input.options,
  );
  const tokens = input.tokens ?? [
    emptyToken(metadata[0]),
    emptyToken(metadata[1]),
  ];
  const sqrtRatio =
    input.state.sqrtRatio === 0n
      ? 0n
      : floatSqrtRatioToFixed(input.state.sqrtRatio);
  const tick = input.state.tick;
  const [max0, max1] = amounts;
  const { lower, upper, initial } = poolRange(
    range,
    tokens[0].decimals,
    tokens[1].decimals,
    sqrtRatio !== 0n,
    input.options,
  );
  const descriptor = { poolKey, tickLower: lower, tickUpper: upper };
  const currentTick = sqrtRatio === 0n ? initial : tick;
  assertNeededToken(input.specified, currentTick, lower, upper);
  const result = quoteDeposit(
    descriptor,
    sqrtRatio || toSqrtRatio(initial, "evm"),
    [max0, max1],
    input.specified,
  );
  return {
    descriptor,
    initialTick: initial,
    sqrtRatio,
    tokens,
    ...result,
    inactive: [currentTick >= upper, currentTick <= lower],
    adjusted: result.max0 !== max0 || result.max1 !== max1,
  };
}

function assertNeededToken(
  side: 0 | 1,
  tick: number,
  lower: number,
  upper: number,
) {
  if ((side === 0 && tick >= upper) || (side === 1 && tick <= lower))
    throw new Error(
      "This token is not needed for the selected range. Enter an amount for the other token.",
    );
}

function emptyToken(currency: Currency): Token {
  return { ...currency, balance: 0n, allowance: 0n, metadataMissing: false };
}
