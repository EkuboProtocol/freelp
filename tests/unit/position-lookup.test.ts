import { expect, test } from "bun:test";
import {
  decodeFunctionData,
  encodeErrorResult,
  encodeFunctionResult,
  padHex,
  zeroAddress,
} from "viem";
import snapshot from "../../artifacts/FreeLPDataFetcher.json" with { type: "json" };
import manager from "../../artifacts/FreeLP.json" with { type: "json" };
import { DEFAULT_SETTINGS } from "../../src/config";
import { loadPositionById } from "../../src/positionLookup";

const owner = "0x1111111111111111111111111111111111111111";
const item = {
  id: 7n,
  descriptor: {
    poolKey: {
      token0: zeroAddress,
      token1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      config: ("0x" + "00".repeat(32)) as `0x${string}`,
    },
    tickLower: -100,
    tickUpper: 100,
  },
  amounts: {
    liquidity: 5n,
    principal0: 1n,
    principal1: 2n,
    fees0: 0n,
    fees1: 0n,
  },
  sqrtRatio: 1n << 128n,
  metadata: "data:application/json;base64,e30=",
};

test("positions load by ID through ownerOf and the owner's snapshot", async () => {
  let exists = true;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = await request.json();
      const data = body.params?.[0]?.data as `0x${string}`;
      let result: unknown = "0x";
      if (body.method === "eth_call" && data) {
        const call = decodeFunctionData({
          abi: [...manager.abi, ...snapshot.abi],
          data,
        });
        if (call.functionName === "ownerOf")
          return Response.json(
            exists
              ? {
                  jsonrpc: "2.0",
                  id: body.id,
                  result: padHex(owner, { size: 32 }),
                }
              : {
                  jsonrpc: "2.0",
                  id: body.id,
                  error: {
                    code: 3,
                    message: "execution reverted",
                    data: encodeErrorResult({
                      abi: manager.abi,
                      errorName: "TokenDoesNotExist",
                    }),
                  },
                },
          );
        if (call.functionName === "ownedPositions")
          result = encodeFunctionResult({
            abi: snapshot.abi,
            functionName: "ownedPositions",
            result: [1n, true, [item]],
          });
      }
      return Response.json({ jsonrpc: "2.0", id: body.id, result });
    },
  });
  const settings = { ...DEFAULT_SETTINGS, rpcUrl: server.url.href };
  try {
    const found = await loadPositionById(settings, 7n);
    expect(found?.owner).toBe(owner);
    expect(found?.position.id).toBe(7n);
    expect(await loadPositionById(settings, 8n)).toBeUndefined();
    exists = false;
    expect(await loadPositionById(settings, 7n)).toBeUndefined();
  } finally {
    server.stop(true);
  }
  await expect(
    loadPositionById({ ...settings, rpcUrl: "http://127.0.0.1:1/" }, 7n),
  ).rejects.toThrow();
});
