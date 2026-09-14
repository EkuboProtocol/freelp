import { switchWalletChain } from "./walletNetwork";
import { CREATE2_FACTORY, verifyDeploymentTransaction } from "./deterministic";
import { rpc } from "./rpc";
import { verifyCode } from "./contracts";
import { DEFAULT_POOL_KEY_INDEX } from "./deployments";
import { toHex, isAddressEqual, type Address } from "viem";
import type { Provider, Settings, Transaction } from "./types";
import {
  walletRejected,
  isTransactionHash,
  type TransactionState,
} from "./transactionStatus";
export type TransactionObserver = (event: {
  state: TransactionState;
  hash?: string;
  batchId?: string;
}) => void;
export async function assertWallet(
  provider: Provider,
  account: Address,
  chainId: number,
) {
  const [accounts, chain] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);
  if (
    !Array.isArray(accounts) ||
    typeof accounts[0] !== "string" ||
    !isAddressEqual(accounts[0] as Address, account)
  )
    throw new Error("Wallet account changed. Review this transaction again.");
  if (typeof chain !== "string" || BigInt(chain) !== BigInt(chainId))
    throw new Error("Select the configured network in your wallet.");
}
export async function executeTransaction(
  provider: Provider,
  account: Address,
  settings: Settings,
  tx: Transaction,
  observer?: TransactionObserver,
) {
  const client = rpc(settings);
  observer?.({ state: "checking" });
  await validateTransaction(client, provider, account, settings, tx);
  await assertWallet(provider, account, settings.chainId);
  return submitAndObserve(client, provider, account, tx, observer);
}
async function submitAndObserve(
  client: ReturnType<typeof rpc>,
  provider: Provider,
  account: Address,
  tx: Transaction,
  observer?: TransactionObserver,
) {
  observer?.({ state: "awaiting wallet" });
  const hash = await requestHash(provider, account, tx, observer);
  if (!isTransactionHash(hash)) {
    observer?.({ state: "unknown" });
    throw new Error(
      "The wallet returned no valid transaction identifier. Its submission outcome is unknown; check the wallet before retrying.",
    );
  }
  observer?.({ state: "submitted", hash });
  observer?.({ state: "confirming", hash });
  const receipt = await observeReceipt(client, hash, observer);
  if (receipt.status !== "success") {
    observer?.({ state: "reverted", hash });
    throw new Error(`Transaction reverted: ${hash}`);
  }
  observer?.({ state: "confirmed", hash });
  return receipt;
}
async function requestHash(
  provider: Provider,
  account: Address,
  tx: Transaction,
  observer?: TransactionObserver,
) {
  try {
    return await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: account,
          to: tx.to,
          data: tx.data,
          value: toHex(tx.value ?? 0n),
        },
      ],
    });
  } catch (error) {
    if (walletRejected(error)) {
      observer?.({ state: "rejected" });
      throw new Error("Transaction rejected in the wallet.", { cause: error });
    }
    observer?.({ state: "unknown" });
    throw new Error(
      "The wallet request outcome is unknown. Check your wallet for its status.",
      { cause: error },
    );
  }
}

async function validateTransaction(
  client: ReturnType<typeof rpc>,
  provider: Provider,
  account: Address,
  settings: Settings,
  tx: Transaction,
) {
  if ((await client.getChainId()) !== settings.chainId)
    throw new Error("RPC chain ID does not match settings.");
  await ensureWalletChain(provider, settings);
  await assertWallet(provider, account, settings.chainId);
  if (tx.to?.toLowerCase() === CREATE2_FACTORY.toLowerCase())
    await verifyDeploymentTransaction(settings, tx);
  else if (tx.to)
    await Promise.all([
      verifyCode(settings, settings.core, "Core"),
      verifyCode(settings, DEFAULT_POOL_KEY_INDEX, "PoolKeyIndex"),
      verifyCode(settings, settings.manager, "FreeLP"),
    ]);
}

async function observeReceipt(
  client: ReturnType<typeof rpc>,
  hash: `0x${string}`,
  observer?: TransactionObserver,
) {
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });
    if (
      receipt.transactionHash.toLowerCase() !== hash.toLowerCase() ||
      !receipt.blockHash
    )
      throw new Error(
        "RPC returned a receipt for a different or unmined transaction.",
      );
    return receipt;
  } catch (error) {
    observer?.({ state: "unknown", hash });
    throw new Error(
      `Transaction ${hash} was submitted, but confirmation is unknown. Check your wallet for its status.`,
      { cause: error },
    );
  }
}

async function ensureWalletChain(provider: Provider, settings: Settings) {
  const chain = await provider.request({ method: "eth_chainId" });
  if (typeof chain === "string" && BigInt(chain) !== BigInt(settings.chainId))
    await switchWalletChain(provider, settings);
}
