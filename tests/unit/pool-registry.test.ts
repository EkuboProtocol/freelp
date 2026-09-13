import { expect, test } from "bun:test";
import { encodeEvmConcentratedPoolConfig, deriveEvmPoolId } from "@ekubo/sdk";
import { keccak256, zeroAddress, type Address, type Hex } from "viem";
import {
  readRegistryPage,
  selectRegisteredPool,
  isSelectedPool,
  verifiedPool,
} from "../../src/poolRegistry";
import { chainSettings } from "../../src/chains";
import { defaultCreateForm } from "../../src/createForm";

const tokenA = "0x0000000000000000000000000000000000000001" as Address;
const tokenB = "0x0000000000000000000000000000000000000002" as Address;
const key = {
  token0: tokenA,
  token1: tokenB,
  config: encodeEvmConcentratedPoolConfig({
    fee: 123456789012345678n,
    tickSpacing: 200,
    extension: zeroAddress,
  }),
};
const id = deriveEvmPoolId(key, keccak256);

function client(ids: Hex[], count: bigint = BigInt(ids.length)) {
  return {
    getBlockNumber: async () => 99n,
    getChainId: async () => 1,
    readContract: async (request: {
      functionName: string;
      args?: readonly unknown[];
    }) => {
      if (request.functionName === "tokenPoolIdCount") return count;
      if (request.functionName === "tokenPoolIds")
        return ids[Number(request.args?.[1])] ?? ids[0];
      return [key.token0, key.token1, key.config];
    },
  } as never;
}

test("scans the smaller token list and matches pairs in either order", async () => {
  const page = await readRegistryPage(
    chainSettings(1),
    tokenB,
    tokenA,
    0n,
    client([id]),
  );
  expect(page.pools[0]?.fee).toBe(123456789012345678n);
  expect(page.pools[0]?.tickSpacing).toBe(200);
});

test("keeps huge counts exact and reports partial pagination", async () => {
  const page = await readRegistryPage(
    chainSettings(1),
    tokenA,
    tokenB,
    0n,
    client([id], 2n ** 80n),
  );
  expect(page.total).toBe(2n ** 80n);
  expect(page.scanned).toBe(16n);
  expect(page.hasMore).toBe(true);
});

test("rejects a registry page whose returned key does not hash to its id", async () => {
  const wrong =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;
  await expect(
    readRegistryPage(chainSettings(1), tokenA, tokenB, 0n, client([wrong])),
  ).rejects.toThrow("does not match");
});

test("later pages keep the original block, list choice, and total even if the chain advances", async () => {
  const first = await readRegistryPage(
    chainSettings(1),
    tokenA,
    tokenB,
    0n,
    client([id], 30n),
  );
  const pinnedReads: bigint[] = [];
  const nextClient = {
    getBlockNumber: async () => {
      throw new Error("Must reuse snapshot");
    },
    getChainId: async () => 1,
    readContract: async (request: {
      functionName: string;
      blockNumber: bigint;
      args: unknown[];
    }) => {
      pinnedReads.push(request.blockNumber);
      if (request.functionName === "tokenPoolIdCount")
        throw new Error("Must reuse original count");
      return request.functionName === "tokenPoolIds"
        ? id
        : [key.token0, key.token1, key.config];
    },
  } as never;
  const page = await readRegistryPage(
    chainSettings(1),
    tokenA,
    tokenB,
    first.scanned,
    nextClient,
    first.snapshot,
  );
  expect(page.scanned).toBe(30n);
  expect(page.total).toBe(30n);
  expect(page.hasMore).toBe(false);
  expect(pinnedReads.every((block) => block === 99n)).toBe(true);
});

test("selection applies the exact registered config and ignores stale-pair clicks", () => {
  const pool = verifiedPool(id, key);
  const previous = {
    ...defaultCreateForm(1),
    a: tokenA,
    b: tokenB,
    maxA: "3",
    maxB: "4",
  };
  const selected = selectRegisteredPool(previous, pool);
  expect(selected.exactFee).toBe("123456789012345678");
  expect(isSelectedPool(selected, pool)).toBe(true);
  expect([selected.maxA, selected.maxB]).toEqual(["", ""]);
  const stale = { ...previous, a: zeroAddress };
  expect(selectRegisteredPool(stale, pool)).toBe(stale);
});
