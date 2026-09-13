import { switchWalletChain } from "./walletNetwork";
import { CREATE2_FACTORY, verifyDeploymentTransaction } from "./deterministic";
import { rpc } from "./rpc";
import { verifyCode } from "./contracts";
import { DEFAULT_POOL_KEY_INDEX } from "./deployments";
import { toHex, isAddressEqual, type Address } from "viem";
import type { Provider, Settings, Transaction } from "./types";
import {
  journalId,
  upsertJournal,
  updateJournal,
  walletRejected,
  isTransactionHash,
  type TransactionState,
} from "./transactionJournal";
import { assertNativeFunding, paddedGas } from "./nativeGas";
export type TransactionObserver = (event: {
  state: TransactionState;
  hash?: string;
  batchId?: string;
}) => void;
export type WalletIdentity = { uuid?: string; rdns?: string; name?: string };
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
  walletIdentity?: WalletIdentity,
) {
  const client = rpc(settings);
  observer?.({ state: "simulation" });
  const gas = await validateTransaction(
    client,
    provider,
    account,
    settings,
    tx,
  );
  await assertWallet(provider, account, settings.chainId);
  await assertNativeFunding(settings, account, paddedGas(gas), tx.value ?? 0n);
  await assertWallet(provider, account, settings.chainId);
  return submitAndObserve(
    client,
    provider,
    account,
    settings,
    tx,
    gas,
    observer,
    walletIdentity,
  );
}
async function submitAndObserve(
  client: ReturnType<typeof rpc>,
  provider: Provider,
  account: Address,
  settings: Settings,
  tx: Transaction,
  gas: bigint,
  observer?: TransactionObserver,
  walletIdentity?: WalletIdentity,
) {
  observer?.({ state: "awaiting wallet" });
  const id = journalId();
  upsertJournal({
    id,
    chainId: settings.chainId,
    account,
    wallet: walletIdentity,
    count: 1,
    state: "awaiting wallet",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const hash = await requestHash(provider, account, tx, gas, id, observer);
  if (!isTransactionHash(hash)) {
    updateJournal(id, { state: "unknown" });
    observer?.({ state: "unknown" });
    throw new Error(
      "The wallet returned no valid transaction identifier. Its submission outcome is unknown; check the wallet before retrying.",
    );
  }
  upsertJournal({
    id,
    chainId: settings.chainId,
    account,
    wallet: walletIdentity,
    hash,
    count: 1,
    state: "submitted",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  observer?.({ state: "submitted", hash });
  updateJournal(id, { state: "confirming" });
  observer?.({ state: "confirming", hash });
  const receipt = await observeReceipt(client, hash, id, observer);
  if (receipt.status !== "success") {
    updateJournal(id, { state: "reverted" });
    observer?.({ state: "reverted", hash });
    throw new Error(`Transaction reverted: ${hash}`);
  }
  updateJournal(id, { state: "confirmed" });
  observer?.({ state: "confirmed", hash });
  return receipt;
}
async function requestHash(
  provider: Provider,
  account: Address,
  tx: Transaction,
  gas: bigint,
  id: string,
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
          gas: toHex(paddedGas(gas)),
        },
      ],
    });
  } catch (error) {
    if (walletRejected(error)) {
      updateJournal(id, { state: "rejected" });
      observer?.({ state: "rejected" });
      throw new Error("Transaction rejected in the wallet.", { cause: error });
    }
    updateJournal(id, { state: "unknown" });
    observer?.({ state: "unknown" });
    throw new Error(
      "The wallet request outcome is unknown. Check transaction activity before retrying.",
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
  await client.call({ ...tx, account });
  return client.estimateGas({ ...tx, account });
}

async function observeReceipt(
  client: ReturnType<typeof rpc>,
  hash: `0x${string}`,
  id: string,
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
    updateJournal(id, { state: "unknown" });
    observer?.({ state: "unknown", hash });
    throw new Error(
      `Transaction ${hash} was submitted, but confirmation is unknown. Check transaction activity before retrying.`,
      { cause: error },
    );
  }
}

async function ensureWalletChain(provider: Provider, settings: Settings) {
  const chain = await provider.request({ method: "eth_chainId" });
  if (typeof chain === "string" && BigInt(chain) !== BigInt(settings.chainId))
    await switchWalletChain(provider, settings);
}
