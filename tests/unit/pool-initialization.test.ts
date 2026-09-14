import { expect, test } from "bun:test";
import { keccak256 } from "viem";
import { poolInitialized } from "../../src/poolData";
import { verifiedPool } from "../../src/poolRegistry";
import { deriveEvmPoolId } from "@ekubo/sdk";

// Pools can be initialized outside this interface, and registration in
// PoolKeyIndex is only a discovery hint. Only live Core state decides.
test("initialization comes from Core pool state, never from registry presence", () => {
  expect(poolInitialized({ sqrtRatio: 0n })).toBe(false);
  expect(poolInitialized({ sqrtRatio: 1n << 96n })).toBe(true);
  const key = {
    token0: "0x0000000000000000000000000000000000000000",
    token1: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    config:
      "0x00000000000000000000000000000000000000000020c49ba5e353f7800003e8",
  } as const;
  const registered = verifiedPool(deriveEvmPoolId(key, keccak256), key);
  expect(Object.keys(registered)).not.toContain("initialized");
  expect(Object.keys(registered)).not.toContain("sqrtRatio");
});
