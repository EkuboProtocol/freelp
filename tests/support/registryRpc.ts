import type { Page } from "@playwright/test";
import {
  decodeFunctionData,
  encodeFunctionResult,
  keccak256,
  type Hex,
} from "viem";
import {
  deriveEvmPoolId,
  encodeEvmConcentratedPoolConfig,
  type EvmPoolKey,
} from "@ekubo/sdk";
import artifact from "../../artifacts/PoolKeyIndex.json" with { type: "json" };
import { DEFAULT_POOL_KEY_INDEX } from "../../src/deployments";
import { NETWORKS } from "../../src/networks";
import { rpcEndpoint } from "../../src/chains";
import { exactFeeFromPercent } from "../../src/fee";

export const BASE_PAIR = {
  token0: "0x0000000000000000000000000000000000000000",
  token1: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
} as const;
export function fixturePools(): EvmPoolKey[] {
  return [
    ["0.3", 5982],
    ["0.05", 1000],
  ].map(([fee, tickSpacing]) => ({
    ...BASE_PAIR,
    config: encodeEvmConcentratedPoolConfig({
      fee: BigInt(exactFeeFromPercent(String(fee))),
      tickSpacing: Number(tickSpacing),
      extension: BASE_PAIR.token0,
    }),
  }));
}
export async function mockRegistry(page: Page, keys: EvmPoolKey[] = []) {
  const endpoints = new Set(
    NETWORKS.map((network) => new URL(rpcEndpoint(network)).href),
  );
  await page.route(
    (url) => endpoints.has(url.href),
    async (route) => {
      const body = route.request().postDataJSON();
      if (body.method === "eth_blockNumber")
        return route.fulfill({
          json: { jsonrpc: "2.0", id: body.id, result: "0x64" },
        });
      if (
        body.method !== "eth_call" ||
        body.params[0].to?.toLowerCase() !==
          DEFAULT_POOL_KEY_INDEX.toLowerCase()
      )
        return route.fallback();
      const call = decodeFunctionData({
        abi: artifact.abi,
        data: body.params[0].data,
      });
      const result = registryResult(
        call.functionName,
        call.args as unknown[],
        keys,
      );
      if (result === undefined) return route.fallback();
      await route.fulfill({
        json: {
          jsonrpc: "2.0",
          id: body.id,
          result: encodeFunctionResult({
            abi: artifact.abi,
            functionName: call.functionName,
            result,
          }),
        },
      });
    },
  );
}
function registryResult(name: string, args: unknown[], keys: EvmPoolKey[]) {
  if (name === "poolKeyById") {
    const key = keys.find(
      (key) =>
        deriveEvmPoolId(key, keccak256).toLowerCase() ===
        String(args[0]).toLowerCase(),
    );
    return key ? [key.token0, key.token1, key.config] : undefined;
  }
  const [token0, token1] = args
    .slice(0, 2)
    .map((token) => String(token).toLowerCase())
    .sort();
  const matches = keys.filter(
    (key) =>
      key.token0.toLowerCase() === token0 &&
      key.token1.toLowerCase() === token1,
  );
  if (name === "pairPoolIdCount") return BigInt(matches.length);
  if (name === "pairPoolIds")
    return deriveEvmPoolId(matches[Number(args[2])], keccak256) as Hex;
  return undefined;
}
