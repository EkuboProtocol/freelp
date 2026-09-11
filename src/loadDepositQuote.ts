import { networkCurrencies } from "./tokens";
import { t } from "@lingui/core/macro";
import { getAddress, zeroAddress } from "viem";
import { token, read } from "./contracts";
import { rpc } from "./rpc";
import { poolConfig, poolRange, type PoolOptions } from "./poolOptions";
import { parseAmount } from "./amounts";
import { type RangeInput } from "./prices";
import { quoteDeposit } from "./depositQuote";
import type { Address } from "viem";
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
};
async function loadTokens(input: Input) {
  const owner = input.account ?? zeroAddress;
  const metadata = networkCurrencies(input.settings);
  const [a, b] = await Promise.all(
    [input.a, input.b].map(async (address) => {
      const currency = metadata.find(
        (entry) => entry.address.toLowerCase() === address.toLowerCase(),
      );
      if (!currency)
        throw new Error(
          t`Import this token's on-chain metadata before creating a position.`,
        );
      const result = await token(input.settings, getAddress(address), owner);
      return {
        ...result,
        symbol: currency.symbol,
        decimals: currency.decimals,
        metadataMissing: false,
      };
    }),
  );
  return [a, b] as [typeof a, typeof b];
}
export async function loadDepositQuote(input: Input) {
  const { settings, range } = input;
  const addresses = [getAddress(input.a), getAddress(input.b)];
  if (BigInt(addresses[0]) >= BigInt(addresses[1]))
    throw new Error(t`Choose two different tokens in address order.`);
  const poolKey = {
    token0: addresses[0],
    token1: addresses[1],
    config: poolConfig(input.fee, range.spacing, input.options),
  };
  const client = rpc(settings);
  const [block, code] = await Promise.all([
    client.getBlockNumber(),
    client.getCode({ address: settings.manager }),
  ]);
  if (!code || code === "0x")
    throw new Error(
      t`The shared position manager is not deployed on this network yet. Open the Deploy tab to set it up once for everyone.`,
    );
  const [tokens, [sqrtRatio, tick]] = await Promise.all([
    loadTokens(input),
    read<[bigint, number, bigint]>(settings, "poolState", [poolKey], block),
  ]);
  const max0 = parseAmount(input.maxA || "0", tokens[0].decimals);
  const max1 = parseAmount(input.maxB || "0", tokens[1].decimals);
  const { lower, upper, initial } = poolRange(
    range,
    tokens[0].decimals,
    tokens[1].decimals,
    sqrtRatio !== 0n,
    input.options,
  );
  const descriptor = { poolKey, tickLower: lower, tickUpper: upper };
  const currentTick = sqrtRatio === 0n ? initial : tick;
  const result = await quoteDeposit(
    settings,
    descriptor,
    initial,
    [max0, max1],
    block,
    currentTick,
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
