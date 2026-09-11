import { erc20Abi, getAddress } from "viem";
import { rpc } from "./rpc";
import type { Settings } from "./types";
import type { Currency } from "./tokens";
export async function readTokenMetadata(
  settings: Settings,
  value: string,
): Promise<Currency> {
  const address = getAddress(value);
  const client = rpc(settings);
  const [symbol, name, decimals, code] = await Promise.all([
    client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address, abi: erc20Abi, functionName: "name" }),
    client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
    client.getCode({ address }),
  ]);
  if (!code || code === "0x")
    throw new Error("No token contract at this address.");
  if (
    !symbol.trim() ||
    !name.trim() ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255
  )
    throw new Error(
      "This token must provide a name, symbol, and valid decimals on chain.",
    );
  return { address, symbol, name, decimals };
}
