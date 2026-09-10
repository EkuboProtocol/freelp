import { keccak256, stringToHex } from "viem";
import { load, save } from "./storage";
export const TERMS = `FreeLP Terms of Service

Use FreeLP at your own risk. You may lose some or all of your funds. Blockchain transactions can be irreversible. FreeLP is provided as is and as available, without warranties of any kind, to the extent permitted by applicable law.

You are responsible for reviewing the network, contracts, tokens, amounts, permissions, and transaction details before signing. Risks include contract defects, malicious tokens, wallet or RPC compromise, market movement, liquidity losses, and unavailable infrastructure. No returns, uninterrupted availability, recovery of funds, or continuing maintenance are promised.

To the fullest extent permitted by applicable law, the authors and contributors disclaim liability for losses or damages arising from use of FreeLP. Nothing in these terms excludes rights or liabilities that applicable law does not allow to be excluded.

FreeLP does not take custody of your wallet keys. You decide whether to sign each transaction.

These terms govern use of this application. They do not restrict rights granted under the MIT software license or other applicable component licenses.`;
export const TERMS_HASH = keccak256(stringToHex(TERMS));
type Consent = { hash: string; account: string; acceptedAt: string };
const session = new Map<string, Consent>();
export function accepted(account: string) {
  const key = account.toLowerCase();
  const value =
    session.get(key) ?? load<Consent | null>(`freelp:consent:${key}`, null);
  return value?.hash === TERMS_HASH && value.account === key;
}
export function accept(account: string) {
  const key = account.toLowerCase();
  const value = {
    hash: TERMS_HASH,
    account: key,
    acceptedAt: new Date().toISOString(),
  };
  session.set(key, value);
  save(`freelp:consent:${key}`, value);
}
export function requireConsent(account: string) {
  if (!accepted(account))
    throw new Error(
      "Read and accept the Terms of Service before requesting a transaction.",
    );
}
