import { test, expect } from "bun:test";
import { decodeFunctionData, encodeFunctionResult, zeroAddress } from "viem";
import artifact from "../../artifacts/FreeLPDataFetcher.json";
import { tokenBalances } from "../../src/balances";

test("picker balances use one sparse contract query, share in-flight reads, and isolate owners", async () => {
  let calls = 0;
  const erc20 = "0x1111111111111111111111111111111111111111";
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      calls++;
      const body = await request.json();
      expect(body.method).toBe("eth_call");
      const decoded = decodeFunctionData({
        abi: artifact.abi,
        data: body.params[0].data,
      });
      expect(decoded.functionName).toBe("getNonzeroBalancesAndAllowances");
      expect(decoded.args?.[2]).toEqual([zeroAddress]);
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: encodeFunctionResult({
          abi: artifact.abi,
          functionName: "getNonzeroBalancesAndAllowances",
          result: [
            [{ token: erc20, amount: 123456789012345678901234567890n }],
            [],
          ],
        }),
      });
    },
  });
  const settings = {
    rpcUrl: server.url.toString(),
    chainId: 31337,
    core: zeroAddress,
    manager: zeroAddress,
    nativeSymbol: "ETH",
  };
  try {
    const [a, b] = await Promise.all([
      tokenBalances(settings, zeroAddress, [zeroAddress, erc20], 0, 0),
      tokenBalances(
        { name: "Same chain", ...settings },
        zeroAddress,
        [zeroAddress, erc20],
        0,
        0,
      ),
    ]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(a.get(zeroAddress)).toBe(0n);
    expect(a.get(erc20)).toBe(123456789012345678901234567890n);
    await tokenBalances(settings, erc20, [zeroAddress, erc20], 0, 0);
    expect(calls).toBe(2);
  } finally {
    server.stop(true);
  }
});
