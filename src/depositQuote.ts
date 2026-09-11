import { read } from "./contracts";
import type { Descriptor, Settings } from "./types";
const MAX_AMOUNT = (1n << 128n) - 1n;
type Amounts = readonly [bigint, bigint, bigint];
export async function quoteDeposit(
  settings: Settings,
  descriptor: Descriptor,
  initialTick: number,
  amounts: [bigint, bigint],
  block: bigint,
  currentTick: number,
  specified: 0 | 1,
) {
  const quote = (limits: [bigint, bigint]) =>
    read<Amounts>(
      settings,
      "quoteDeposit",
      [descriptor, initialTick, ...limits],
      block,
    );
  let [max0, max1] = amounts;
  if (currentTick <= descriptor.tickLower) max1 = 0n;
  else if (currentTick >= descriptor.tickUpper) max0 = 0n;
  else {
    const [, used0, used1] = await quote(
      specified === 0 ? [max0, MAX_AMOUNT] : [MAX_AMOUNT, max1],
    );
    if (specified === 0) max1 = used1;
    else max0 = used0;
  }
  const [liquidity, used0, used1] = await quote([max0, max1]);
  return { max0, max1, liquidity, used0, used1 };
}
