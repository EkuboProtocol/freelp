import { chainDefinition } from "./chains";
import { createPublicClient, http } from "viem";
import type { Settings } from "./types";
export function rpc(settings: Settings) {
  return createPublicClient({
    chain: chainDefinition(settings.chainId),
    ccipRead: false,
    transport: http(settings.rpcUrl || undefined, {
      // A configured RPC cannot redirect application reads to another service.
      fetchOptions: { redirect: "error" },
      retryCount: 2,
      retryDelay: 1000,
      timeout: 15000,
    }),
  });
}
