import {
  decodeEvmPoolConfig,
  deriveEvmPoolId,
  type EvmPoolKey,
} from "@ekubo/sdk";
import {
  getAddress,
  keccak256,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import artifact from "../artifacts/PoolKeyIndex.json" with { type: "json" };
import { DEFAULT_POOL_KEY_INDEX } from "./deployments";
import { rpc } from "./rpc";
import type { Settings } from "./types";
import type { CreateForm } from "./createForm";
import { poolConfig } from "./poolOptions";
import { percentFromExactFee } from "./fee";

export const PAGE_SIZE = 16;
const abi = artifact.abi as Abi;
type IndexClient = Pick<
  PublicClient,
  "getBlockNumber" | "getChainId" | "readContract"
>;
export type RegisteredPool = {
  id: Hex;
  key: EvmPoolKey;
  fee: bigint;
  extension: Address;
  poolType: "concentrated" | "stableswap" | "full_range";
  tickSpacing: number | null;
  stableswapParams: { centerTick: number; amplification: number } | null;
};
export type RegistrySnapshot = {
  blockNumber: bigint;
  chainId: number;
  token0: Address;
  token1: Address;
  total: bigint;
};
export type RegistryPage = {
  pools: RegisteredPool[];
  scanned: bigint;
  total: bigint;
  hasMore: boolean;
  snapshot: RegistrySnapshot;
};
export function registryAddress(): Address {
  return DEFAULT_POOL_KEY_INDEX;
}

export function orderedPair(a: string, b: string): [Address, Address] {
  const first = getAddress(a),
    second = getAddress(b);
  if (first === second) throw new Error("Select two different tokens.");
  return BigInt(first) < BigInt(second) ? [first, second] : [second, first];
}

async function captureSnapshot(
  settings: Settings,
  tokens: [Address, Address],
  client: IndexClient,
): Promise<RegistrySnapshot> {
  const [chainId, blockNumber] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber({ cacheTime: 0 }),
  ]);
  if (chainId !== settings.chainId)
    throw new Error("RPC chain does not match the selected network.");
  const count = await client.readContract({
    address: registryAddress(),
    abi,
    functionName: "pairPoolIdCount",
    args: tokens,
    blockNumber,
  });
  if (typeof count !== "bigint" || count < 0n)
    throw new Error("Invalid pool count returned by the registry.");
  return {
    chainId,
    blockNumber,
    token0: tokens[0],
    token1: tokens[1],
    total: count,
  };
}

function assertSnapshot(
  snapshot: RegistrySnapshot,
  chainId: number,
  tokens: [Address, Address],
  offset: bigint,
) {
  if (
    snapshot.chainId !== chainId ||
    snapshot.token0 !== tokens[0] ||
    snapshot.token1 !== tokens[1]
  )
    throw new Error(
      "The registry snapshot belongs to a different pair or network. Refresh pools.",
    );
  if (offset < 0n || offset > snapshot.total)
    throw new Error("Invalid registry cursor. Refresh pools.");
}

async function boundedMap<T, R>(values: T[], read: (value: T) => Promise<R>) {
  const result: R[] = [];
  for (let i = 0; i < values.length; i += 4)
    result.push(...(await Promise.all(values.slice(i, i + 4).map(read))));
  return result;
}

export async function readRegistryPage(
  settings: Settings,
  tokenA: Address,
  tokenB: Address,
  offset: bigint,
  client: IndexClient = rpc(settings),
  pinned?: RegistrySnapshot,
): Promise<RegistryPage> {
  const tokens = orderedPair(tokenA, tokenB);
  const snapshot = pinned ?? (await captureSnapshot(settings, tokens, client));
  assertSnapshot(snapshot, settings.chainId, tokens, offset);
  const end =
    offset + BigInt(PAGE_SIZE) < snapshot.total
      ? offset + BigInt(PAGE_SIZE)
      : snapshot.total;
  const indexes = Array.from(
    { length: Number(end - offset) },
    (_, i) => offset + BigInt(i),
  );
  const ids = await boundedMap(
    indexes,
    async (index) =>
      (await client.readContract({
        address: registryAddress(),
        abi,
        functionName: "pairPoolIds",
        args: [snapshot.token0, snapshot.token1, index],
        blockNumber: snapshot.blockNumber,
      })) as Hex,
  );
  const pools = await boundedMap(ids, async (id) => {
    const value = (await client.readContract({
      address: registryAddress(),
      abi,
      functionName: "poolKeyById",
      args: [id],
      blockNumber: snapshot.blockNumber,
    })) as [Address, Address, Hex];
    return verifiedPool(id, {
      token0: value[0],
      token1: value[1],
      config: value[2],
    });
  });
  const matches = pools.every(
    (pool) =>
      pool.key.token0.toLowerCase() === tokens[0].toLowerCase() &&
      pool.key.token1.toLowerCase() === tokens[1].toLowerCase(),
  );
  if (!matches)
    throw new Error(
      "Registry returned a pool for a different pair. Check the RPC and retry.",
    );
  return {
    pools,
    scanned: end,
    total: snapshot.total,
    hasMore: end < snapshot.total,
    snapshot,
  };
}

export function verifiedPool(id: Hex, key: EvmPoolKey): RegisteredPool {
  if (deriveEvmPoolId(key, keccak256).toLowerCase() !== id.toLowerCase())
    throw new Error(
      "Registry key does not match its pool ID. Check the RPC and retry.",
    );
  const decoded = decodeEvmPoolConfig(key.config);
  return {
    id,
    key,
    fee: decoded.fee,
    extension: getAddress(decoded.extension),
    poolType: decoded.poolType,
    tickSpacing: decoded.tickSpacing,
    stableswapParams: decoded.stableswapParams,
  };
}

function matchesFormPair(form: CreateForm, pool: RegisteredPool) {
  try {
    const [a, b] = orderedPair(form.a, form.b);
    return (
      a.toLowerCase() === pool.key.token0.toLowerCase() &&
      b.toLowerCase() === pool.key.token1.toLowerCase()
    );
  } catch {
    return false;
  }
}
export function isSelectedPool(form: CreateForm, pool: RegisteredPool) {
  try {
    return (
      matchesFormPair(form, pool) &&
      poolConfig(form.fee, form.range.spacing, form).toLowerCase() ===
        pool.key.config.toLowerCase()
    );
  } catch {
    return false;
  }
}
export function selectRegisteredPool(
  form: CreateForm,
  pool: RegisteredPool,
): CreateForm {
  if (!matchesFormPair(form, pool) || isSelectedPool(form, pool)) return form;
  return {
    ...form,
    a: getAddress(pool.key.token0),
    b: getAddress(pool.key.token1),
    exactFee: pool.fee.toString(),
    fee: percentFromExactFee(pool.fee.toString()),
    extension: pool.extension,
    kind: pool.poolType === "concentrated" ? "concentrated" : "stable",
    range: {
      ...form.range,
      raw: false,
      full: false,
      spacing: pool.tickSpacing ?? form.range.spacing,
      prices: ["", "", ""],
      ticks: ["", "", ""],
    },
    center: String(pool.stableswapParams?.centerTick ?? 0),
    amplification: String(pool.stableswapParams?.amplification ?? 0),
    maxA: "",
    maxB: "",
    specified: 0,
  };
}
