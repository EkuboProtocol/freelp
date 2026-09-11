import { expect } from "@playwright/test";
import { createPublicClient, http, zeroAddress } from "viem";
import { toSqrtRatio } from "@ekubo/sdk";
import { quoteDeposit } from "../../src/depositQuote";
import { poolConfig } from "../../src/poolOptions";
import { defaultCreateForm } from "../../src/createForm";
import { managerAbi } from "../../src/contracts";
export async function checkSdkParity() {
  const client = createPublicClient({
    transport: http("http://127.0.0.1:18545"),
  });
  const form = defaultCreateForm(31337);
  const descriptor = {
    poolKey: {
      token0: zeroAddress,
      token1: "0x0000000000000000000000000000000000001234" as const,
      config: poolConfig("0.05", 1000, form),
    },
    tickLower: -20000000,
    tickUpper: -19800000,
  };
  for (const tick of [-20100000, -19900000, -19700000])
    for (const side of [0, 1] as const) {
      const amounts: [bigint, bigint] = [0n, 0n];
      amounts[side] = 123456789n;
      const local = quoteDeposit(
        descriptor,
        toSqrtRatio(tick, "evm"),
        amounts,
        side,
      );
      const expected = await client.readContract({
        address: "0xF45a36e4FFbeaEBdCE8cc574f52039aeC6b468A1",
        abi: managerAbi,
        functionName: "quoteDeposit",
        args: [descriptor, tick, local.max0, local.max1],
      });
      expect(expected).toEqual([local.liquidity, local.used0, local.used1]);
    }
}
