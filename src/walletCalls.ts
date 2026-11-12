import { numberToHex, type Address, type Hash, type Hex } from "viem";
import { approval, type Token } from "./contracts";
import type { Provider, Settings, Transaction } from "./types";

// EIP-5792 over the connected wallet's own EIP-1193 provider.
export type CallsStatus = {
  chainId?: number;
  status: "pending" | "success" | "failure" | undefined;
  statusCode: number;
  receipts?: {
    transactionHash: Hash;
    blockHash: Hash;
    status: "success" | "reverted";
  }[];
};

export async function supportsCalls(
  provider: Provider,
  account: Address,
  settings: Settings,
) {
  try {
    const capabilities = await provider.request({
      method: "wallet_getCapabilities",
      params: [account, [numberToHex(settings.chainId)]],
    });
    return capabilities !== undefined && capabilities !== null;
  } catch {
    return false;
  }
}

export async function sendCalls(
  provider: Provider,
  account: Address,
  settings: Settings,
  calls: { to: Address; data: Hex; value?: bigint }[],
) {
  const result = (await provider.request({
    method: "wallet_sendCalls",
    params: [
      {
        version: "2.0.0",
        atomicRequired: false,
        chainId: numberToHex(settings.chainId),
        from: account,
        calls: calls.map((call) => ({
          to: call.to,
          data: call.data,
          value: call.value ? numberToHex(call.value) : undefined,
        })),
      },
    ],
  })) as { id?: unknown } | null;
  if (typeof result?.id !== "string")
    throw new Error("Wallet returned no batch identifier.");
  return { id: result.id };
}

function callsStatus(value: unknown): CallsStatus {
  const raw = value as {
    chainId?: Hex | number;
    status: number;
    receipts?: { transactionHash: Hash; blockHash: Hash; status: Hex }[];
  };
  const code = Number(raw.status);
  return {
    chainId: raw.chainId === undefined ? undefined : Number(raw.chainId),
    statusCode: code,
    status:
      code >= 100 && code < 200
        ? "pending"
        : code >= 200 && code < 300
          ? "success"
          : code >= 300
            ? "failure"
            : undefined,
    receipts: raw.receipts?.map((receipt) => ({
      transactionHash: receipt.transactionHash,
      blockHash: receipt.blockHash,
      status: BigInt(receipt.status) === 1n ? "success" : "reverted",
    })),
  };
}

export async function waitForCallsStatus(
  provider: Provider,
  id: string,
  timeout = 60_000,
) {
  for (let waited = 0; ; waited += 1_000) {
    const status = callsStatus(
      await provider.request({ method: "wallet_getCallsStatus", params: [id] }),
    );
    if (status.statusCode === 200 || status.statusCode >= 300) return status;
    if (waited >= timeout) return status;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

export function depositCalls(
  tokens: Token[],
  amounts: bigint[],
  manager: Address,
  deposit: Transaction,
) {
  const calls: Transaction[] = [];
  tokens.forEach((token, i) => {
    if (token.allowance >= amounts[i]) return;
    if (token.allowance > 0n) calls.push(approval(token.address, manager, 0n));
    calls.push(approval(token.address, manager, amounts[i]));
  });
  return [...calls, deposit];
}
