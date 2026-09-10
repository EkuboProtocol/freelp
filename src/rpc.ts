import { createPublicClient, http } from "viem";
import type { Settings } from "./types";
export function rpc(settings: Settings) {
  return createPublicClient({
    ccipRead: false,
    transport: http(settings.rpcUrl, {
      retryCount: 2,
      retryDelay: 1000,
      timeout: 15000,
    }),
  });
}
