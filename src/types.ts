import type { Address, Hex } from "viem";
export type Settings = {
  name?: string;
  rpcUrl: string;
  chainId: number;
  core: Address;
  manager: Address;
  nativeSymbol: string;
  quoteDataFetcher?: Address;
  coreDataFetcher?: Address;
  tokenDataFetcher?: Address;
};
export type Descriptor = {
  poolKey: { token0: Address; token1: Address; config: Hex };
  tickLower: number;
  tickUpper: number;
};
export type Amounts = {
  liquidity: bigint;
  principal0: bigint;
  principal1: bigint;
  fees0: bigint;
  fees1: bigint;
};
export type Position = {
  id: bigint;
  descriptor: Descriptor;
  amounts: Amounts;
  metadata: string;
};
export type Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (name: string, fn: (...args: unknown[]) => void) => void;
  removeListener?: (name: string, fn: (...args: unknown[]) => void) => void;
};
export type Wallet = {
  info: { uuid: string; name: string };
  provider: Provider;
};
export type Transaction = { to?: Address; data: Hex; value?: bigint };
