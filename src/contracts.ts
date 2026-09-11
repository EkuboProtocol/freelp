import { assertRuntime } from "./runtime";
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
import { rpc } from "./rpc";
import type { Amounts, Descriptor, Position, Settings } from "./types";
import quoteArtifact from "../artifacts/QuoteDataFetcher.json" with { type: "json" };
import coreDataArtifact from "../artifacts/CoreDataFetcher.json" with { type: "json" };
import tokenDataArtifact from "../artifacts/TokenDataFetcher.json" with { type: "json" };
const CONTRACT_ARTIFACTS = {
  Core: coreArtifact,
  FreeLP: managerArtifact,
  QuoteDataFetcher: quoteArtifact,
  CoreDataFetcher: coreDataArtifact,
  TokenDataFetcher: tokenDataArtifact,
};
export type ContractKind = keyof typeof CONTRACT_ARTIFACTS;
export const managerAbi = managerArtifact.abi as Abi;
export const managerData = (
  functionName: string,
  args: readonly unknown[] = [],
) => encodeFunctionData({ abi: managerAbi, functionName, args });
export function deployment(kind: ContractKind, core: Address) {
  const artifact = CONTRACT_ARTIFACTS[kind];
  return encodeDeployData({
    abi: artifact.abi as Abi,
    bytecode: artifact.bytecode as Hex,
    args: kind === "Core" || kind === "TokenDataFetcher" ? [] : [core],
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
  const code = await rpc(settings).getCode({ address: settings.manager });
  if (!code || code === "0x") return [];
  const block = await rpc(settings).getBlockNumber();
  const ids: bigint[] = [];
  const total = await read<bigint>(settings, "balanceOf", [holder], block);
  for (let offset = 0n; offset < total; offset += 5n) {
    const indexes = Array.from(
      { length: Number(total - offset < 5n ? total - offset : 5n) },
      (_, i) => offset + BigInt(i),
    );
    ids.push(
      ...(await Promise.all(
        indexes.map((index) =>
          read<bigint>(settings, "tokenOfOwnerByIndex", [holder, index], block),
        ),
      )),
    );
  }
  ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
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
function validateDecimals(decimalsFallback?: number) {
  if (
    decimalsFallback !== undefined &&
    (!Number.isInteger(decimalsFallback) ||
      decimalsFallback < 0 ||
      decimalsFallback > 255)
  )
    throw new Error("Decimals must be an integer between 0 and 255.");
}
export async function token(
  settings: Settings,
  address: Address,
  holder: Address,
  decimalsFallback?: number,
): Promise<Token> {
  validateDecimals(decimalsFallback);
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
      decimals.status === "fulfilled"
        ? decimals.value
        : (decimalsFallback ?? 0),
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
export async function verifyCode(
  settings: Settings,
  address: Address,
  kind: ContractKind,
) {
  const artifact = CONTRACT_ARTIFACTS[kind];
  const code = await rpc(settings).getCode({ address });
  if (!code) throw new Error("No contract at this address.");
  assertRuntime(artifact, code, settings.core);
  if (kind === "FreeLP") {
    const core = await read<Address>({ ...settings, manager: address }, "CORE");
    if (core.toLowerCase() !== settings.core.toLowerCase())
      throw new Error("Position manager uses a different Core.");
  }
}
