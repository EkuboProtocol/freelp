import { type Address } from "viem";
import { rpc } from "./rpc";
import { walletClient } from "./walletCalls";
import { assertWallet, executeTransaction } from "./transactions";
import { switchWalletChain } from "./walletNetwork";
import { verifyCode } from "./contracts";
import type { Provider, Settings, Transaction } from "./types";
export async function executeBatch(
  provider: Provider,
  account: Address,
  settings: Settings,
  calls: Transaction[],
) {
  if (calls.length === 1)
    return executeTransaction(provider, account, settings, calls[0]);
  const client = rpc(settings);
  if ((await client.getChainId()) !== settings.chainId)
    throw new Error("RPC chain ID does not match settings.");
  await switchWalletChain(provider, settings);
  await assertWallet(provider, account, settings.chainId);
  await Promise.all([
    verifyCode(settings, settings.core, "Core"),
    verifyCode(settings, settings.manager, "FreeLP"),
  ]);
  const batch = calls.map((call) => {
    if (!call.to) throw new Error("Batch calls require a destination.");
    return { ...call, to: call.to };
  });
  // Sequential simulation preserves approvals for the following deposit.
  const simulation = await client
    .simulateCalls({ account, calls: batch })
    .catch(() => {
      throw new Error(
        "Unable to simulate this batch. Approve the tokens separately, then deposit.",
      );
    });
  if (simulation.results.some((result) => result.status !== "success"))
    throw new Error(
      "The batch simulation failed. Review the deposit amounts and approvals.",
    );
  await assertWallet(provider, account, settings.chainId);
  const wallet = walletClient(provider, account, settings);
  const { id } = await wallet.sendCalls({ calls: batch });
  // Never resubmit a pending or partially completed batch as separate calls.
  const result = await wallet.waitForCallsStatus({ id, throwOnFailure: true });
  const last = result.receipts?.at(-1);
  if (!last)
    throw new Error(
      "The wallet has not returned a transaction receipt. Check the wallet before retrying.",
    );
  const receipt = await client.waitForTransactionReceipt({
    hash: last.transactionHash,
  });
  if (receipt.status !== "success")
    throw new Error("The deposit reverted. Refresh balances before retrying.");
  return receipt;
}
