import { formatUnits } from "viem";
// Display only. Quotes, balances, approvals, and transaction limits retain bigint precision.
export function displayAmount(amount: bigint, decimals: number) {
  const exact = formatUnits(amount, decimals);
  return exact.length <= 20 ? exact : `≈ ${Number(exact).toPrecision(6)}`;
}
