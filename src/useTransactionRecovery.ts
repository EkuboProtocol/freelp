import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { rpc } from "./rpc";
import { walletClient } from "./walletCalls";
import { batchOutcome } from "./batchOutcome";
import {
  isTransactionHash,
  loadJournal,
  isUnresolved,
  subscribeJournal,
  updateJournal,
  type JournalEntry,
} from "./transactionJournal";
import type { Provider, Settings } from "./types";

export function useTransactionRecovery(
  provider: Provider | undefined,
  account: Address | undefined,
  networks: Settings[],
  walletIdentity?: JournalEntry["wallet"],
) {
  const [entries, setEntries] = useState(loadJournal);
  const running = useRef(new Map<string, Promise<boolean>>());
  useEffect(() => subscribeJournal(() => setEntries(loadJournal())), []);
  const check = useCallback(
    (entry: JournalEntry) => {
      const pending = running.current.get(entry.id);
      if (pending) return pending;
      const request = recoverEntry(
        entry.id,
        provider,
        account,
        networks,
        walletIdentity,
      ).finally(() => running.current.delete(entry.id));
      running.current.set(entry.id, request);
      return request;
    },
    [provider, account, networks, walletIdentity],
  );
  return { entries, check };
}

export async function recoverEntry(
  id: string,
  provider: Provider | undefined,
  account: Address | undefined,
  networks: Settings[],
  identity?: JournalEntry["wallet"],
): Promise<boolean> {
  const entry = loadJournal().find((item) => item.id === id);
  if (!entry || !isUnresolved(entry)) return false;
  if (
    !provider ||
    !account ||
    entry.account.toLowerCase() !== account.toLowerCase()
  )
    throw new Error("Reconnect the account that submitted this transaction.");
  const accounts = await provider.request({ method: "eth_accounts" });
  if (
    !Array.isArray(accounts) ||
    String(accounts[0]).toLowerCase() !== account.toLowerCase()
  )
    throw new Error(
      "Wallet account changed. Reconnect before checking status.",
    );
  const settings = recoveryNetwork(networks, entry.chainId);
  const client = rpc(settings);
  if ((await client.getChainId()) !== entry.chainId)
    throw new Error("RPC chain ID does not match this transaction.");
  const outcome = entry.batchId
    ? await recoverBatch(entry, provider, account, settings, identity)
    : await recoverHash(entry, settings);
  updateJournal(entry.id, { state: outcome });
  return !isUnresolved({ ...entry, state: outcome });
}

function recoveryNetwork(networks: Settings[], chainId: number) {
  const settings = networks.find((network) => network.chainId === chainId);
  if (!settings)
    throw new Error(
      "Enable this transaction’s network in Networks before checking status.",
    );
  return settings;
}

export function sameWallet(
  recorded: JournalEntry["wallet"],
  current: JournalEntry["wallet"],
) {
  if (!recorded || !current) return false;
  if (recorded.rdns && current.rdns) return recorded.rdns === current.rdns;
  return !!recorded.name && recorded.name === current.name;
}

async function recoverBatch(
  entry: JournalEntry,
  provider: Provider,
  account: Address,
  settings: Settings,
  identity: JournalEntry["wallet"],
) {
  if (!sameWallet(entry.wallet, identity))
    throw new Error("Select the wallet provider that submitted this batch.");
  const result = await walletClient(provider, account, settings).getCallsStatus(
    { id: entry.batchId! },
  );
  return (await batchOutcome(settings, result)).state;
}
async function recoverHash(entry: JournalEntry, settings: Settings) {
  if (!isTransactionHash(entry.hash))
    throw new Error(
      "The wallet did not return an identifier. Check its activity before attempting this action again; automatic recovery is unavailable.",
    );
  const receipt = await rpc(settings).getTransactionReceipt({
    hash: entry.hash,
  });
  if (
    receipt.transactionHash.toLowerCase() !== entry.hash.toLowerCase() ||
    !receipt.blockHash
  )
    throw new Error("The RPC returned an unrelated or unmined receipt.");
  return receipt.status === "success"
    ? ("confirmed" as const)
    : ("reverted" as const);
}
