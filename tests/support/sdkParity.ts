import { expect } from "@playwright/test";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  erc20Abi,
  http,
  maxUint256,
  zeroAddress,
  type Address,
} from "viem";
import { foundry } from "viem/chains";
import { toSqrtRatio } from "@ekubo/sdk";
import { quoteDeposit } from "../../src/depositQuote";
import { poolConfig } from "../../src/poolOptions";
import { defaultCreateForm } from "../../src/createForm";
import { managerAbi } from "../../src/contracts";
import { DEFAULT_MANAGER } from "../../src/deployments";

export async function checkSdkParity(tokens: Address[]) {
  const transport = http("http://127.0.0.1:18545");
  const client = createPublicClient({ chain: foundry, transport });
  const testClient = createTestClient({
    chain: foundry,
    transport,
    mode: "anvil",
  });
  const wallet = createWalletClient({ chain: foundry, transport });
  const [account] = await wallet.getAddresses();
  const snapshot = await testClient.snapshot();
  try {
    for (const address of tokens.filter((address) => address !== zeroAddress)) {
      const hash = await wallet.writeContract({
        account,
        address,
        abi: erc20Abi,
        functionName: "approve",
        args: [DEFAULT_MANAGER, maxUint256],
      });
      await client.waitForTransactionReceipt({ hash });
    }
    const descriptor = {
      poolKey: {
        token0: tokens[0],
        token1: tokens[1],
        config: poolConfig("0.05", 1000, defaultCreateForm(31337)),
      },
      tickLower: -20000000,
      tickUpper: -19800000,
    };
    for (const tick of [-20100000, -19900000, -19700000]) {
      for (const side of [0, 1] as const) {
        const amounts: [bigint, bigint] = [0n, 0n];
        amounts[side] = 123456789n;
        const local = quoteDeposit(
          descriptor,
          toSqrtRatio(tick, "evm"),
          amounts,
          side,
        );
        const simulation = client.simulateContract({
          account,
          address: DEFAULT_MANAGER,
          abi: managerAbi,
          functionName: "createPosition",
          args: [
            descriptor,
            tick,
            {
              maxAmount0: local.max0,
              maxAmount1: local.max1,
              minLiquidity: local.liquidity,
              deadline: maxUint256,
            },
          ],
          value: tokens[0] === zeroAddress ? local.max0 : 0n,
        });
        if (local.liquidity === 0n) await expect(simulation).rejects.toThrow();
        else {
          const { result } = await simulation;
          expect((result as bigint[]).slice(1)).toEqual([
            local.liquidity,
            local.used0,
            local.used1,
          ]);
        }
      }
    }
  } finally {
    await testClient.revert({ id: snapshot });
  }
}
