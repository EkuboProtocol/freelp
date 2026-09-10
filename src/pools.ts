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
