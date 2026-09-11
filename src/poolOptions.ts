import { getAddress, toHex } from "viem";
import { parseAmount } from "./amounts";
import { checkSpacing } from "./pools";
import { MAX_TICK, rangeTicks, type RangeInput } from "./prices";
export type PoolOptions = {
  kind: "concentrated" | "stable";
  extension: string;
  exactFee: string;
  amplification: string;
  center: string;
};
export function poolConfig(fee: string, spacing: number, options: PoolOptions) {
  const feeValue =
    options.exactFee === ""
      ? (parseAmount(fee, 20) * (1n << 64n)) / (100n * 10n ** 20n)
      : BigInt(options.exactFee);
  if (feeValue < 0n || feeValue >= 1n << 64n)
    throw new Error("Fee must fit uint64 and be below 100%.");
  return toHex(
    (BigInt(getAddress(options.extension)) << 96n) |
      (feeValue << 32n) |
      typeConfig(spacing, options),
    { size: 32 },
  );
}
function typeConfig(spacing: number, options: PoolOptions) {
  if (options.kind === "concentrated") {
    checkSpacing(spacing);
    return 0x80000000n | BigInt(spacing);
  }
  const { amplification, center } = stableParameters(options);
  return (BigInt(amplification) << 24n) | (BigInt(center / 16) & 0xffffffn);
}
function stableParameters(options: PoolOptions) {
  const amplification = Number(options.amplification),
    center = Number(options.center);
  if (
    !Number.isInteger(amplification) ||
    amplification < 0 ||
    amplification > 26
  )
    throw new Error("Amplification must be an integer from 0 to 26.");
  if (
    !Number.isInteger(center) ||
    Math.abs(center) > MAX_TICK ||
    center % 16 !== 0
  )
    throw new Error(
      "Center tick must be within the supported range and divisible by 16.",
    );
  return { amplification, center };
}
export function stableBounds(options: PoolOptions) {
  const { amplification, center } = stableParameters(options);
  const width = Math.floor(MAX_TICK / 2 ** amplification);
  return {
    lower: Math.max(-MAX_TICK, center - width),
    upper: Math.min(MAX_TICK, center + width),
  };
}
export function poolRange(
  range: RangeInput,
  d0: number,
  d1: number,
  initialized: boolean,
  options: PoolOptions,
) {
  if (options.kind === "concentrated")
    return rangeTicks(range, d0, d1, initialized);
  const { initial } = rangeTicks(
    { ...range, full: true, spacing: 1 },
    d0,
    d1,
    initialized,
  );
  return { ...stableBounds(options), initial };
}
