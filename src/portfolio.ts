import type { Address } from "viem";
import { positions } from "./contracts";
import { DEFAULT_POSITION_DATA_FETCHER } from "./deployments";
import { errorMessage } from "./errors";
import { rpc } from "./rpc";
import type { Position, Settings } from "./types";

export async function loadPortfolio(
  settings: Settings,
  owner: Address,
): Promise<{ items: Position[]; error?: string }> {
  try {
    return { items: await positions(settings, owner) };
  } catch (error) {
    // A missing deployment returns no position data, not an unavailable network.
    const codes = await Promise.allSettled(
      [
        settings.core,
        settings.manager,
        settings.freeLPDataFetcher ?? DEFAULT_POSITION_DATA_FETCHER,
      ].map((address) => rpc(settings).getCode({ address })),
    );
    const deployed = codes.every(
      (result) =>
        result.status === "fulfilled" &&
        !!result.value &&
        result.value !== "0x",
    );
    return { items: [], error: deployed ? errorMessage(error) : undefined };
  }
}
