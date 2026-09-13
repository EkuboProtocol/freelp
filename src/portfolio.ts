import type { Address } from "viem";
import { positions } from "./contracts";
import { ContractIdentityError } from "./contractIdentity";
import { DEFAULT_POSITION_DATA_FETCHER } from "./deployments";
import { errorMessage } from "./errors";
import { rpc } from "./rpc";
import type { Position, Settings } from "./types";

export type PortfolioAvailability =
  "available" | "available-empty" | "proven-not-deployed" | "unavailable";

export type PortfolioResult = {
  items: Position[];
  availability: PortfolioAvailability;
  error?: string;
};

export async function loadPortfolio(
  settings: Settings,
  owner: Address,
): Promise<PortfolioResult> {
  try {
    const items = await positions(settings, owner);
    return {
      items,
      availability: items.length ? "available" : "available-empty",
    };
  } catch (error) {
    if (error instanceof ContractIdentityError && error.state === "missing")
      return { items: [], availability: "proven-not-deployed" };
    const codes = await Promise.allSettled(
      [
        settings.core,
        settings.manager,
        settings.freeLPDataFetcher ?? DEFAULT_POSITION_DATA_FETCHER,
      ].map((address) => rpc(settings).getCode({ address })),
    );
    if (codes.some((result) => result.status === "rejected"))
      return {
        items: [],
        availability: "unavailable",
        error: "Could not check this network. Try again.",
      };
    if (
      codes.some(
        (result) =>
          result.status === "fulfilled" &&
          (!result.value || result.value === "0x"),
      )
    )
      return { items: [], availability: "proven-not-deployed" };
    return {
      items: [],
      availability: "unavailable",
      error: errorMessage(error),
    };
  }
}
