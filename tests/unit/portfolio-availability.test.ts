import { expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "../../src/config";
import { DEFAULT_POSITION_DATA_FETCHER } from "../../src/deployments";
import { loadPortfolio } from "../../src/portfolio";

for (const missing of [undefined, "core", "manager", "fetcher"] as const) {
  test(`portfolio errors require deployed contracts (${missing ?? "all deployed"})`, async () => {
    const addresses = {
      core: DEFAULT_SETTINGS.core,
      manager: DEFAULT_SETTINGS.manager,
      fetcher:
        DEFAULT_SETTINGS.freeLPDataFetcher ?? DEFAULT_POSITION_DATA_FETCHER,
    };
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      async fetch(request) {
        const body = await request.json();
        const absent =
          body.method === "eth_getCode" &&
          missing &&
          body.params[0].toLowerCase() === addresses[missing].toLowerCase();
        const result = body.method === "eth_call" || absent ? "0x" : "0x6000";
        return Response.json({ jsonrpc: "2.0", id: body.id, result });
      },
    });
    try {
      const result = await loadPortfolio(
        { ...DEFAULT_SETTINGS, rpcUrl: server.url.href },
        "0x1111111111111111111111111111111111111111",
      );
      expect(result.items).toEqual([]);
      expect(!!result.error).toBe(!missing);
    } finally {
      server.stop(true);
    }
  });
}
