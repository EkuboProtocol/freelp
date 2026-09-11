import { switchWalletChain } from "./walletNetwork";
import { CREATE2_FACTORY, verifyDeploymentTransaction } from "./deterministic";
import { rpc } from "./rpc";
import { verifyCode } from "./contracts";
import { toHex, isAddressEqual, type Address } from "viem";
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
  const client = rpc(settings);
  if ((await client.getChainId()) !== settings.chainId)
    throw new Error("RPC chain ID does not match settings.");
  await ensureWalletChain(provider, settings);
  await assertWallet(provider, account, settings.chainId);
  if (tx.to?.toLowerCase() === CREATE2_FACTORY.toLowerCase()) {
    await verifyDeploymentTransaction(settings, tx);
  } else if (tx.to) {
    await Promise.all([
      verifyCode(settings, settings.core, "Core"),
      verifyCode(settings, settings.manager, "FreeLP"),
    ]);
  }
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

async function ensureWalletChain(provider: Provider, settings: Settings) {
  const chain = await provider.request({method: "eth_chainId"});
  if (typeof chain === "string" && BigInt(chain) !== BigInt(settings.chainId)) await switchWalletChain(provider, settings);
}
