import {
  createPublicClient,
  http,
  toHex,
  isAddressEqual,
  type Address,
} from "viem";
import { requireConsent } from "./terms";
import type { Provider, Settings, Transaction } from "./types";
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
  requireConsent(account);
}
export async function executeTransaction(
  provider: Provider,
  account: Address,
  settings: Settings,
  tx: Transaction,
) {
  requireConsent(account);
  const client = createPublicClient({
    ccipRead: false,
    transport: http(settings.rpcUrl, { retryCount: 1, timeout: 15000 }),
  });
  if ((await client.getChainId()) !== settings.chainId)
    throw new Error("RPC chain ID does not match settings.");
  await assertWallet(provider, account, settings.chainId);
  await client.call({ ...tx, account });
  const gas = await client.estimateGas({ ...tx, account });
  await assertWallet(provider, account, settings.chainId);
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: account,
        to: tx.to,
        data: tx.data,
        value: toHex(tx.value ?? 0n),
        gas: toHex(gas + gas / 5n),
      },
    ],
  });
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash))
    throw new Error("Wallet returned an invalid transaction hash.");
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as `0x${string}`,
  });
  if (receipt.status !== "success")
    throw new Error(`Transaction reverted: ${hash}`);
  return receipt;
}
