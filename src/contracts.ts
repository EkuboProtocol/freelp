import { nativeCurrency } from "./nativeCurrency";
import { DEFAULT_POSITION_DATA_FETCHER } from "./deployments";
import {
  encodeFunctionData,
  decodeFunctionResult,
  encodeDeployData,
  erc20Abi,
  zeroAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import snapshotArtifact from "../artifacts/FreeLPDataFetcher.json" with { type: "json" };
import managerArtifact from "../artifacts/FreeLP.json" with { type: "json" };
import coreArtifact from "../artifacts/Core.json" with { type: "json" };
import { rpc } from "./rpc";
import type { Position, Settings } from "./types";
const CONTRACT_ARTIFACTS = {
  Core: coreArtifact,
  FreeLP: managerArtifact,
  FreeLPDataFetcher: snapshotArtifact,
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
  const { data } = await rpc(settings).call({
    to: settings.freeLPDataFetcher ?? DEFAULT_POSITION_DATA_FETCHER,
    data: encodeFunctionData({
      abi: snapshotArtifact.abi,
      functionName: "ownedPositions",
      args: [settings.manager, holder],
    }),
  });
  if (!data || data === "0x")
    throw new Error(
      "The position data fetcher is not deployed on this network. Deploy it from the Deploy tab.",
    );
  const [chainId, , items] = decodeFunctionResult({
    abi: snapshotArtifact.abi,
    functionName: "ownedPositions",
    data,
  }) as [bigint, boolean, Position[]];
  if (chainId !== BigInt(settings.chainId))
    throw new Error("RPC chain does not match the configured network.");
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
      ...nativeCurrency(settings),
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
  const code = await rpc(settings).getCode({ address });
  if (!code || code === "0x")
    throw new Error(`${kind} is not deployed at this address.`);
}
