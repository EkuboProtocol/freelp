import { test, expect } from "bun:test";
import { decodeFunctionData, encodeFunctionResult, zeroAddress } from "viem";
import { managerAbi, positions } from "../../src/contracts";

test("standard owner enumeration reads one block and sorts the complete list", async () => {
  const ids = [10n, 2n, 8n, 1n, 9n, 3n];
  const seen: string[] = [];
  const blocks: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = await request.json();
      let result: unknown;
      if (body.method === "eth_blockNumber") result = "0x123";
      else {
        expect(body.method).toBe("eth_call");
        blocks.push(body.params[1]);
        const call = decodeFunctionData({
          abi: managerAbi,
          data: body.params[0].data,
        });
        seen.push(call.functionName);
        const args = call.args as bigint[];
        const outputs: Record<string, unknown> = {
          balanceOf: BigInt(ids.length),
          tokenOfOwnerByIndex: ids[Number(args[1])],
          descriptor: {
            poolKey: {
              token0: zeroAddress,
              token1: zeroAddress,
              config: "0x" + "00".repeat(32),
            },
            tickLower: -100,
            tickUpper: 100,
          },
          positionAmounts: {
            liquidity: 1n,
            principal0: 1n,
            principal1: 1n,
            fees0: 0n,
            fees1: 0n,
          },
          tokenURI: "data:application/json;base64,e30=",
        };
        result = encodeFunctionResult({
          abi: managerAbi,
          functionName: call.functionName,
          result: outputs[call.functionName],
        });
      }
      return Response.json({ jsonrpc: "2.0", id: body.id, result });
    },
  });
  try {
    const rows = await positions(
      {
        rpcUrl: server.url.toString(),
        chainId: 31337,
        core: zeroAddress,
        manager: zeroAddress,
        nativeSymbol: "ETH",
      },
      zeroAddress,
    );
    expect(rows.map((p) => p.id)).toEqual([1n, 2n, 3n, 8n, 9n, 10n]);
    expect(seen.filter((name) => name === "tokenOfOwnerByIndex")).toHaveLength(
      ids.length,
    );
    expect(new Set(blocks)).toEqual(new Set(["0x123"]));
  } finally {
    server.stop(true);
  }
});
