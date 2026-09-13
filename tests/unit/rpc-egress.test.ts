import { expect, test } from "bun:test";
import { rpc } from "../../src/rpc";
import { DEFAULT_SETTINGS } from "../../src/config";

test("RPC redirects cannot send reads to an unconfigured endpoint", async () => {
  let forwarded = 0;
  const target = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () => {
      forwarded++;
      return Response.json({ jsonrpc: "2.0", result: "0x1" });
    },
  });
  const source = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () => Response.redirect(target.url, 307),
  });
  try {
    await expect(
      rpc({ ...DEFAULT_SETTINGS, rpcUrl: source.url.href }).getChainId(),
    ).rejects.toThrow();
    expect(forwarded).toBe(0);
    expect(rpc(DEFAULT_SETTINGS).ccipRead).toBe(false);
  } finally {
    source.stop(true);
    target.stop(true);
  }
});
