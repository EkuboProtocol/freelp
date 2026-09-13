import { test, expect } from "bun:test";
import { toSqrtRatio, fixedSqrtRatioToFloat } from "@ekubo/sdk";
import { amount0RoundedUp } from "../../src/evmLiquidity";
import { quoteDeposit } from "../../src/depositQuote";
import { bucketAmounts } from "../../src/liquidityBuckets";
import { supportsCalls, depositCalls } from "../../src/walletCalls";
import { DEFAULT_SETTINGS } from "../../src/config";
import { decodeFunctionData, zeroAddress } from "viem";
import { managerAbi, managerData } from "../../src/contracts";
import { depositWithRefund } from "../../src/depositTransaction";
const descriptor = {
  poolKey: {
    token0: zeroAddress,
    token1: "0x0000000000000000000000000000000000000001" as const,
    config: `0x${"0".repeat(64)}` as const,
  },
  tickLower: -10000,
  tickUpper: 10000,
};
test("token0 rounding is exact on both integral and fractional amounts", () => {
  const q = 1n << 128n;
  expect(amount0RoundedUp(q, q * 2n, 2n)).toBe(1n);
  expect(amount0RoundedUp(q, q * 2n, 3n)).toBe(2n);
});
test("local quotes preserve the specified limit on either side and outside the range", () => {
  for (const tick of [-20000, -10000, 0, 10000, 20000])
    for (const side of [0, 1] as const) {
      const amounts: [bigint, bigint] = [0n, 0n];
      amounts[side] = 1000000n;
      const result = quoteDeposit(
        descriptor,
        toSqrtRatio(tick, "evm"),
        amounts,
        side,
      );
      expect(side === 0 ? result.used0 : result.used1).toBeLessThanOrEqual(
        1000000n,
      );
      expect(side === 0 ? result.max0 : result.max1).toBe(1000000n);
    }
});
test("chart integrates liquidity changes and reports both token reserves across current price", () => {
  const data = {
    tick: 0,
    sqrtRatio: fixedSqrtRatioToFloat(toSqrtRatio(0, "evm")),
    liquidity: 1000000n,
    minTick: -10000,
    maxTick: 10000,
    ticks: [
      { number: -10000, liquidityDelta: 1000000n },
      { number: 10000, liquidityDelta: -1000000n },
    ],
  };
  const [a, b] = bucketAmounts(data, -10000, 10000);
  expect(a).toBeGreaterThan(0n);
  expect(b).toBeGreaterThan(0n);
  expect(bucketAmounts(data, -10000, 0)[0]).toBe(0n);
  expect(bucketAmounts(data, 0, 10000)[1]).toBe(0n);
});
test("batch support does not require atomic capability", async () => {
  for (const status of ["supported", "ready", "unsupported"]) {
    const provider = {
      request: async ({ params }: { params?: unknown }) => {
        expect(params).toEqual([zeroAddress, ["0x1"]]);
        return { "0x1": { atomic: { status } } };
      },
    };
    expect(await supportsCalls(provider, zeroAddress, DEFAULT_SETTINGS)).toBe(
      true,
    );
  }
  expect(
    await supportsCalls(
      {
        request: async () => {
          throw new Error("unsupported");
        },
      },
      zeroAddress,
      DEFAULT_SETTINGS,
    ),
  ).toBe(false);
});
test("batch includes zero-reset and exact approval before the deposit", () => {
  const token = {
    address: descriptor.poolKey.token1,
    name: "Token",
    symbol: "T",
    decimals: 18,
    balance: 100n,
    allowance: 1n,
    metadataMissing: false,
  };
  const deposit = { to: DEFAULT_SETTINGS.manager, data: "0x" as const };
  const calls = depositCalls([token], [10n], DEFAULT_SETTINGS.manager, deposit);
  expect(calls).toHaveLength(3);
  expect(calls[2]).toEqual(deposit);
});
test("native deposits use one manager multicall with an atomic refund", () => {
  const createData = managerData("createPosition", [
    descriptor.poolKey,
    descriptor.tickLower,
    descriptor.tickUpper,
    10n,
    20n,
    3n,
  ]);
  const deposit = { to: DEFAULT_SETTINGS.manager, data: createData };
  const transaction = depositWithRefund(DEFAULT_SETTINGS, createData, 42n);
  const call = decodeFunctionData({ abi: managerAbi, data: transaction.data });
  expect(call.functionName).toBe("multicall");
  expect(call.args).toEqual([[deposit.data, managerData("refundNativeToken")]]);
  expect(transaction.value).toBe(42n);
  const create = decodeFunctionData({ abi: managerAbi, data: createData });
  expect(create.functionName).toBe("createPosition");
  expect(create.args).toEqual([
    descriptor.poolKey,
    descriptor.tickLower,
    descriptor.tickUpper,
    10n,
    20n,
    3n,
  ]);
});
