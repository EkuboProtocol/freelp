import { parseUnits } from "viem";
export function parseAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255)
    throw new Error("Token decimals must be an integer from 0 to 255.");
  if (value.length > 256 || !/^\d+(\.\d+)?$/.test(value))
    throw new Error("Enter a nonnegative decimal amount.");
  if ((value.split(".")[1]?.length ?? 0) > decimals)
    throw new Error("Amount has more decimal places than this token supports.");
  const amount = parseUnits(value, decimals);
  if (amount >= 2n ** 128n)
    throw new Error("Amount exceeds the contract limit.");
  return amount;
}
