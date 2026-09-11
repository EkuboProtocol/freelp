import { toHex } from "viem";
import { parseAmount } from "./amounts";

export const MAX_TICK_SPACING = 698605;
export function checkSpacing(spacing: number) {
  if (!Number.isInteger(spacing) || spacing < 1 || spacing > MAX_TICK_SPACING)
    throw new Error("Tick spacing must be an integer between 1 and 698605.");
}
export function concentratedConfig(feePercent: string, spacing: number) {
  checkSpacing(spacing);
  const fee = (parseAmount(feePercent, 6) * 2n ** 64n) / 100_000_000n;
  if (fee >= 2n ** 64n) throw new Error("Pool fee must be below 100%.");
  return toHex((fee << 32n) | 0x80000000n | BigInt(spacing), { size: 32 });
}

// Ported from interface/util/common/format.ts: each tick changes price by 1.000001.
export function spacingPercent(spacing: number) {
  return Math.expm1(spacing * Math.log1p(0.000001)) * 100;
}
export function percentToSpacing(percent: number) {
  if (!Number.isFinite(percent) || percent <= 0)
    throw new Error("Enter a positive tick spacing percentage.");
  const spacing = Math.round(Math.log1p(percent / 100) / Math.log1p(0.000001));
  checkSpacing(spacing);
  return spacing;
}
