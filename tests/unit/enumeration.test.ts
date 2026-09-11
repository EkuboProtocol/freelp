import { test, expect } from "bun:test";
import { decodeFunctionData, encodeFunctionResult, zeroAddress } from "viem";
import snapshotArtifact from "../../artifacts/FreeLPDataFetcher.json";
import { positions } from "../../src/contracts";

for (const returnedChain of [31337n, 1n])
  test(`portfolio uses one eth_call and validates chain ${returnedChain}`, async () => {
    const ids = Array.from({ length: 257 }, (_, i) => BigInt(257 - i));
    const requests: string[] = [];
    const items = ids.map((id) => ({
      id,
      descriptor: {
        poolKey: {
          token0: zeroAddress,
          token1: zeroAddress,
          config: "0x" + "00".repeat(32),
        },
        tickLower: -100,
        tickUpper: 100,
      },
      amounts: {
        liquidity: 1n,
        principal0: 2n,
        principal1: 3n,
        fees0: 4n,
        fees1: 5n,
      },
      sqrtRatio: 1n << 128n,
      metadata: "data:application/json;base64,e30=",
    }));
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const body = await request.json();
        requests.push(body.method);
        expect(body.params[1]).toBe("latest");
        const call = decodeFunctionData({
          abi: snapshotArtifact.abi,
          data: body.params[0].data,
        });
        expect(call.functionName).toBe("ownedPositions");
        return Response.json({
          jsonrpc: "2.0",
          id: body.id,
          result: encodeFunctionResult({
            abi: snapshotArtifact.abi,
            functionName: "ownedPositions",
            result: [returnedChain, true, items],
          }),
        });
      },
    });
    try {
      const result = positions(
        {
          rpcUrl: server.url.toString(),
          chainId: 31337,
          core: zeroAddress,
          manager: zeroAddress,
          nativeSymbol: "ETH",
        },
        zeroAddress,
      );
      if (returnedChain !== 31337n)
        await expect(result).rejects.toThrow("RPC chain");
      else {
        const rows = await result;
        expect(rows.map((p) => p.id)).toEqual([...ids].reverse());
        expect(rows[0].amounts.fees0).toBe(4n);
        expect(rows[0].descriptor.tickUpper).toBe(100);
        expect(rows[0].sqrtRatio).toBe(1n << 128n);
      }
      expect(requests).toEqual(["eth_call"]);
    } finally {
      server.stop(true);
    }
  });
