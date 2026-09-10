import {
  encodeFunctionData,
  encodeDeployData,
  erc20Abi,
  zeroAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import managerArtifact from "../artifacts/FreeLP.json" with { type: "json" };
import coreArtifact from "../artifacts/Core.json" with { type: "json" };
import { rpc } from "./session";
import type { Amounts, Descriptor, Position, Settings } from "./types";
export const managerAbi = managerArtifact.abi as Abi;
export const managerData = (
  functionName: string,
  args: readonly unknown[] = [],
) => encodeFunctionData({ abi: managerAbi, functionName, args });
export function deployment(kind: "Core" | "FreeLP", core: Address) {
  const artifact = kind === "Core" ? coreArtifact : managerArtifact;
  return encodeDeployData({
    abi: artifact.abi as Abi,
    bytecode: artifact.bytecode as Hex,
    args: kind === "Core" ? [] : [core],
  });
}
export async function read<T>(
  settings: Settings,
  functionName: string,
  args: readonly unknown[] = [],
  blockNumber?: bigint,
): Promise<T> {
  return (await rpc(settings).readContract({
    address: settings.manager,
    abi: managerAbi,
    functionName,
    args,
    blockNumber,
  })) as T;
}
export async function positions(
  settings: Settings,
  holder: Address,
): Promise<Position[]> {
  const block = await rpc(settings).getBlockNumber();
  const ids: bigint[] = [];
  for (let offset = 0n; ; offset += 100n) {
    const [page, total] = await read<[bigint[], bigint]>(
      settings,
      "ownedIds",
      [holder, offset, 100n],
      block,
    );
    ids.push(...page);
    if (BigInt(ids.length) >= total) break;
    if (!page.length) throw new Error("Invalid ownership page.");
  }
  const rows: Position[] = [];
  for (let offset = 0; offset < ids.length; offset += 5) {
    rows.push(
      ...(await Promise.all(
        ids.slice(offset, offset + 5).map(async (id) => {
          const [descriptor, amounts, metadata] = await Promise.all([
            read<Descriptor>(settings, "descriptor", [id], block),
            read<Amounts>(settings, "positionAmounts", [id], block),
            read<string>(settings, "tokenURI", [id], block),
          ]);
          return { id, descriptor, amounts, metadata };
        }),
      )),
    );
  }
  return rows;
}
export type Token = {
  address: Address;
  symbol: string;
  decimals: number;
  balance: bigint;
  allowance: bigint;
  metadataMissing: boolean;
};
export async function token(
  settings: Settings,
  address: Address,
  holder: Address,
  decimalsFallback = 18,
): Promise<Token> {
  const client = rpc(settings);
  if (address === zeroAddress)
    return {
      address,
      symbol: settings.nativeSymbol,
      decimals: 18,
      balance: await client.getBalance({ address: holder }),
      allowance: 2n ** 256n - 1n,
      metadataMissing: false,
    };
  const [symbol, decimals, balance, allowance] = await Promise.allSettled([
    client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({
      address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [holder],
    }),
    client.readContract({
      address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [holder, settings.manager],
    }),
  ]);
  if (balance.status === "rejected")
    throw new Error("Could not read token balance.");
  if (allowance.status === "rejected")
    throw new Error("Could not read token allowance.");
  return {
    address,
    symbol: symbol.status === "fulfilled" ? symbol.value.slice(0, 32) : address,
    decimals:
      decimals.status === "fulfilled" ? decimals.value : decimalsFallback,
    balance: balance.value,
    allowance: allowance.value,
    metadataMissing: decimals.status === "rejected",
  };
}
export function approval(address: Address, spender: Address, amount: bigint) {
  return {
    to: address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, amount],
    }),
  };
}
function normalizedCode(
  code: Hex,
  refs: Record<string, { start: number; length: number }[]>,
) {
  const bytes = code.slice(2).split("");
  for (const ranges of Object.values(refs))
    for (const { start, length } of ranges)
      bytes.fill("0", start * 2, (start + length) * 2);
  return bytes.join("").toLowerCase();
}
export async function verifyCode(
  settings: Settings,
  address: Address,
  kind: "Core" | "FreeLP",
) {
  const artifact = kind === "Core" ? coreArtifact : managerArtifact;
  const code = await rpc(settings).getCode({ address });
  if (!code) throw new Error("No contract at this address.");
  const refs = artifact.immutableReferences as Record<
    string,
    { start: number; length: number }[]
  >;
  if (
    normalizedCode(code, refs) !==
    normalizedCode(artifact.deployedBytecode as Hex, refs)
  )
    throw new Error("Contract code does not match this build.");
  if (kind === "FreeLP") {
    const core = await read<Address>({ ...settings, manager: address }, "CORE");
    if (core.toLowerCase() !== settings.core.toLowerCase())
      throw new Error("Position manager uses a different Core.");
  }
}
