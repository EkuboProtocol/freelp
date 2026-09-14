import type { Address } from "viem";
import { positions, read } from "./contracts";
import type { Position, Settings } from "./types";

export type PositionLookup = { owner: Address; position: Position };

/**
 * Reads one position by ID without a connected wallet: the manager reports
 * its owner, and the data fetcher returns that owner's positions.
 */
export async function loadPositionById(
  settings: Settings,
  id: bigint,
): Promise<PositionLookup | undefined> {
  let owner: Address;
  try {
    owner = await read<Address>(settings, "ownerOf", [id]);
  } catch (error) {
    if (isMissingToken(error)) return undefined;
    throw error;
  }
  const position = (await positions(settings, owner)).find(
    (item) => item.id === id,
  );
  return position ? { owner, position } : undefined;
}

function isMissingToken(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  return /revert|TokenDoesNotExist|NonexistentToken|returned no data/i.test(
    message,
  );
}
