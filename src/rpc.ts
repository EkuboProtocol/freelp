import { rpcEndpoint } from "./chains";
import {
  decodeFunctionResult,
  encodeFunctionData,
  Eip1559FeesNotSupportedError,
  numberToHex,
  TransactionReceiptNotFoundError,
  WaitForTransactionReceiptTimeoutError,
  type Abi,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type Hash,
  type Hex,
  type ReadContractParameters,
  type ReadContractReturnType,
} from "viem";
import type { Settings } from "./types";

// A JSON-RPC client over fetch with the read surface FreeLP uses. viem's own
// client also loads WebSocket, WebAuthn and worker code, which Exact refuses
// in a data module; its encoders and decoders are pure and stay.

const TIMEOUT = 15_000;
const RETRIES = 2;
const RETRY_DELAY = 1_000;

export class RpcRequestError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
}

export type Receipt = {
  status: "success" | "reverted";
  transactionHash: Hash;
  blockHash: Hash;
  blockNumber: bigint;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const block = (blockNumber?: bigint) =>
  blockNumber === undefined ? "latest" : numberToHex(blockNumber);

async function post(url: string, method: string, params: unknown[]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    // A configured RPC cannot redirect application reads to another service.
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new RpcRequestError(`RPC request failed: HTTP ${response.status}`);
    const body = (await response.json()) as {
      result?: unknown;
      error?: { code?: number; message?: string };
    };
    if (body.error)
      throw new RpcRequestError(
        body.error.message ?? "RPC error",
        body.error.code,
      );
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

function transport(url: string) {
  return async (method: string, params: unknown[]): Promise<unknown> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await post(url, method, params);
      } catch (error) {
        // An answer the RPC gave (a revert, an unknown method) is final.
        if (error instanceof RpcRequestError && error.code !== undefined)
          throw error;
        if (attempt >= RETRIES) throw error;
        await delay(RETRY_DELAY);
      }
    }
  };
}

function receipt(value: unknown): Receipt {
  const raw = value as {
    status: Hex;
    transactionHash: Hash;
    blockHash: Hash;
    blockNumber: Hex;
  };
  return {
    status: BigInt(raw.status) === 1n ? "success" : "reverted",
    transactionHash: raw.transactionHash,
    blockHash: raw.blockHash,
    blockNumber: BigInt(raw.blockNumber),
  };
}

export function rpc(settings: Settings) {
  const url = rpcEndpoint(settings);
  const send = transport(url);
  const quantity = async (method: string, params: unknown[] = []) =>
    BigInt((await send(method, params)) as Hex);
  const call = async ({
    to,
    data,
    account,
    value,
    blockNumber,
  }: {
    to: Address;
    data: Hex;
    account?: Address;
    value?: bigint;
    blockNumber?: bigint;
  }) => {
    const result = (await send("eth_call", [
      {
        to,
        data,
        ...(account ? { from: account } : {}),
        ...(value ? { value: numberToHex(value) } : {}),
      },
      block(blockNumber),
    ])) as Hex;
    return { data: result === "0x" ? undefined : result };
  };
  async function getTransactionReceipt({ hash }: { hash: Hash }) {
    const value = await send("eth_getTransactionReceipt", [hash]);
    if (!value) throw new TransactionReceiptNotFoundError({ hash });
    return receipt(value);
  }
  const client = {
    ccipRead: false as const,
    transport: { url },
    getChainId: async () => Number(await quantity("eth_chainId")),
    getBlockNumber: (_options?: { cacheTime?: number }) =>
      quantity("eth_blockNumber"),
    getGasPrice: () => quantity("eth_gasPrice"),
    getBalance: ({
      address,
      blockNumber,
    }: {
      address: Address;
      blockNumber?: bigint;
    }) => quantity("eth_getBalance", [address, block(blockNumber)]),
    async getCode({
      address,
      blockNumber,
    }: {
      address: Address;
      blockNumber?: bigint;
    }) {
      const code = (await send("eth_getCode", [
        address,
        block(blockNumber),
      ])) as Hex;
      return code === "0x" ? undefined : code;
    },
    call,
    async readContract<
      const abi extends Abi | readonly unknown[],
      functionName extends ContractFunctionName<abi, "pure" | "view">,
      const args extends ContractFunctionArgs<
        abi,
        "pure" | "view",
        functionName
      >,
    >(
      parameters: ReadContractParameters<abi, functionName, args>,
    ): Promise<ReadContractReturnType<abi, functionName, args>> {
      const { address, abi, functionName, args, blockNumber } =
        parameters as unknown as {
          address: Address;
          abi: Abi;
          functionName: string;
          args?: readonly unknown[];
          blockNumber?: bigint;
        };
      const { data } = await call({
        to: address,
        data: encodeFunctionData({ abi, functionName, args }),
        blockNumber,
      });
      return decodeFunctionResult({
        abi,
        functionName,
        args,
        data: data ?? "0x",
      }) as ReadContractReturnType<abi, functionName, args>;
    },
    getTransactionReceipt,
    async waitForTransactionReceipt({
      hash,
      timeout = 180_000,
    }: {
      hash: Hash;
      timeout?: number;
    }) {
      for (let waited = 0; ; waited += 1_000) {
        try {
          return await getTransactionReceipt({ hash });
        } catch (error) {
          if (!(error instanceof TransactionReceiptNotFoundError)) throw error;
        }
        if (waited >= timeout)
          throw new WaitForTransactionReceiptTimeoutError({ hash });
        await delay(1_000);
      }
    },
    // viem's default: the latest base fee with 20% headroom plus the RPC's tip.
    async estimateFeesPerGas() {
      const latest = (await send("eth_getBlockByNumber", [
        "latest",
        false,
      ])) as {
        baseFeePerGas?: Hex | null;
      } | null;
      if (!latest?.baseFeePerGas) throw new Eip1559FeesNotSupportedError();
      const baseFee = BigInt(latest.baseFeePerGas);
      const tip = await quantity("eth_maxPriorityFeePerGas").catch(() => 0n);
      return {
        maxFeePerGas: (baseFee * 12n) / 10n + tip,
        maxPriorityFeePerGas: tip,
        gasPrice: undefined as bigint | undefined,
      };
    },
  };
  return client;
}
