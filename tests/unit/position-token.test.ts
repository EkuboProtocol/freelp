import { expect, test } from "bun:test";
import { encodeFunctionResult, erc20Abi, toFunctionSelector } from "viem";
import { readPositionToken } from "../../src/positionToken";
import { DEFAULT_SETTINGS } from "../../src/config";
const address = "0x1111111111111111111111111111111111111111";
test("failed decimals use explicit raw units while failed allowance blocks spending, not display", async () => {
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const body = await request.json();
      const selector = body.params[0].data.slice(0, 10);
      let result = "0x";
      if (selector === toFunctionSelector("symbol()"))
        result = encodeFunctionResult({
          abi: erc20Abi,
          functionName: "symbol",
          result: "TT",
        });
      if (selector === toFunctionSelector("balanceOf(address)"))
        result = encodeFunctionResult({
          abi: erc20Abi,
          functionName: "balanceOf",
          result: 21n,
        });
      return Response.json({ jsonrpc: "2.0", id: body.id, result });
    },
  });
  try {
    const result = await readPositionToken(
      { ...DEFAULT_SETTINGS, rpcUrl: server.url.href },
      address,
      address,
      {
        address,
        symbol: "TT",
        decimals: 18,
        balance: 99n,
        allowance: 99n,
        metadataMissing: false,
      },
    );
    expect(result.token.decimals).toBe(0);
    expect(result.token.metadataMissing).toBe(true);
    expect(result.token.balance).toBe(21n);
    expect(result.balanceReady).toBe(true);
    expect(result.allowanceReady).toBe(false);
    expect(result.error).toContain("allowance");
  } finally {
    server.stop(true);
  }
});
