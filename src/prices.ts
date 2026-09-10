import { checkSpacing } from "./pools";

export const MAX_TICK = 88722835;
const LOG_STEP = Math.log1p(0.000001);
export type RangeInput = {
  raw: boolean;
  full: boolean;
  spacing: number;
  prices: [string, string, string];
  ticks: [string, string, string];
};
export const DEFAULT_RANGE: RangeInput = {
  raw: false,
  full: false,
  spacing: 5982,
  prices: ["0.99", "1.01", "1"],
  ticks: ["-10000", "10000", "0"],
};
function checkTick(tick: number) {
  if (!Number.isInteger(tick) || Math.abs(tick) > MAX_TICK)
    throw new Error("Price or tick is outside the supported range.");
  return tick;
}
function rawTick(value: string) {
  if (!/^-?\d+$/.test(value)) throw new Error("Enter an integer tick.");
  return checkTick(Number(value));
}
export function priceToTick(
  value: string,
  decimals0: number,
  decimals1: number,
  spacing: number,
  rounding: "floor" | "ceil" | "round",
) {
  const price = Number(value);
  if (
    !/^\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value) ||
    !Number.isFinite(price) ||
    price <= 0
  )
    throw new Error("Enter a positive finite price.");
  const tick =
    (Math.log(price) - (decimals0 - decimals1) * Math.LN10) / LOG_STEP;
  return checkTick(Math[rounding](tick / spacing) * spacing);
}
export function rangeTicks(
  input: RangeInput,
  decimals0: number,
  decimals1: number,
  initialized = false,
) {
  checkSpacing(input.spacing);
  const initial = initialized
    ? 0
    : input.raw
      ? rawTick(input.ticks[2])
      : priceToTick(input.prices[2], decimals0, decimals1, 1, "round");
  const [lower, upper] = bounds(input, decimals0, decimals1);
  if (
    lower >= upper ||
    lower % input.spacing !== 0 ||
    upper % input.spacing !== 0
  )
    throw new Error("Range ticks must increase and align to tick spacing.");
  return { lower, upper, initial };
}
function bounds(input: RangeInput, decimals0: number, decimals1: number) {
  if (input.full) {
    const edge = Math.floor(MAX_TICK / input.spacing) * input.spacing;
    return [-edge, edge];
  }
  if (input.raw) return [rawTick(input.ticks[0]), rawTick(input.ticks[1])];
  return [
    priceToTick(input.prices[0], decimals0, decimals1, input.spacing, "floor"),
    priceToTick(input.prices[1], decimals0, decimals1, input.spacing, "ceil"),
  ];
}
/** Display only; deposits and slippage limits use the contract's integer quote. */
export function tickPrice(tick: number, decimals0: number, decimals1: number) {
  return Math.exp(tick * LOG_STEP + (decimals0 - decimals1) * Math.LN10);
}
export function sqrtPrice(ratio: bigint, decimals0: number, decimals1: number) {
  return (Number(ratio) / 2 ** 128) ** 2 * 10 ** (decimals0 - decimals1);
}
export function displayPrice(price: number) {
  return price.toPrecision(8);
}
