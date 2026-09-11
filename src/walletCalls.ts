import { createWalletClient, custom, type Address } from "viem";
import { chainDefinition } from "./chains";
import { approval, type Token } from "./contracts";
import type { Provider, Settings, Transaction } from "./types";
export function walletClient(
  provider: Provider,
  account: Address,
  settings: Settings,
) {
  return createWalletClient({
    account,
    chain: chainDefinition(settings.chainId),
    transport: custom(provider),
  });
}
export async function supportsCalls(
  provider: Provider,
  account: Address,
  settings: Settings,
) {
  try {
    const capabilities = await walletClient(
      provider,
      account,
      settings,
    ).getCapabilities({ account });
    return Object.hasOwn(capabilities, settings.chainId);
  } catch {
    return false;
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
