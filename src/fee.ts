import { formatUnits } from "viem";
const SCALE = 1n << 64n;
export function exactFeeFromPercent(value: string): string {
  if (!/^\d+(\.\d{0,64})?$/.test(value)) return "";
  const [whole, fraction = ""] = value.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole) * denominator + BigInt(fraction || "0");
  const exact = (numerator * SCALE) / (100n * denominator);
  return exact < SCALE ? exact.toString() : "";
}
export function percentFromExactFee(value: string): string {
  if (!/^\d+$/.test(value)) return "";
  const exact = BigInt(value);
  return exact < SCALE ? formatUnits(exact * 100n * 5n ** 64n, 64) : "";
}
