import { getAddress, type Address } from "viem";
import { configuredNetwork } from "../networks";
import { errorMessage } from "../errors";
import { page, ready, walletProvider, watch } from "../page";
import { executeBatch } from "../walletBatch";
import { executeTransaction, type TransactionObserver } from "../transactions";
import type { Settings, Transaction } from "../types";

// The one active submission. Only this page's request holds the lock: the
// wallet keeps the history, and availability comes from chain state.
let locked = false;
let status = "";

function announce() {
  void page("announce", { topic: "tx" }).catch(() => {});
}
function setStatus(next: string) {
  status = next;
  announce();
}

export function txState() {
  watch("tx");
  return { busy: locked, status };
}

export function clearStatus() {
  if (!locked) setStatus("");
}

export async function connectedAccount(): Promise<Address | undefined> {
  await ready();
  watch("wallet");
  const { account } = await page<{ account: string }>("wallet");
  return account ? getAddress(account) : undefined;
}

export type TxReply = { ok: boolean; error: string; hash: string };

// Sends one transaction, or a batch through EIP-5792 when the wallet has it,
// on `chainId`'s configured network, reporting each state to the page.
export async function execute(
  chainId: number,
  tx: Transaction | Transaction[],
): Promise<TxReply> {
  const account = await connectedAccount();
  if (!account) return { ok: false, error: "Connect a wallet first.", hash: "" };
  if (locked)
    return { ok: false, error: "A transaction is already pending.", hash: "" };
  const settings: Settings = configuredNetwork(chainId);
  locked = true;
  setStatus("Checking wallet and network…");
  const observer: TransactionObserver = ({ state, hash, batchId }) => {
    const identifier = hash ?? batchId;
    setStatus(identifier ? `${state}: ${identifier}` : `${state}…`);
  };
  try {
    const receipt = await (Array.isArray(tx)
      ? executeBatch(walletProvider, account, settings, tx, observer)
      : executeTransaction(walletProvider, account, settings, tx, observer));
    status = `Confirmed: ${receipt.transactionHash}`;
    return { ok: true, error: "", hash: receipt.transactionHash };
  } catch (error) {
    status = errorMessage(error);
    return { ok: false, error: status, hash: "" };
  } finally {
    locked = false;
    announce();
  }
}
