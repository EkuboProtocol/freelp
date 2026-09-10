import { t } from "@lingui/core/macro";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { getAddress, type Address } from "viem";
export { rpc } from "./rpc";
import { loadSettings, validateSettings } from "./config";
import { save } from "./storage";
import { executeTransaction } from "./transactions";
import { accepted, accept } from "./terms";
import type { Settings, Transaction, Wallet } from "./types";
function useSessionState() {
  const [settings, setSettings] = useState(loadSettings);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [wallet, setWallet] = useState<Wallet>();
  const [account, setAccount] = useState<Address>();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const transactionLock = useRef(false);
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Wallet>).detail;
      if (detail?.provider && detail.info?.uuid)
        setWallets((prev) =>
          prev.some((w) => w.info.uuid === detail.info.uuid)
            ? prev
            : [...prev, detail],
        );
    };
    window.addEventListener("eip6963:announceProvider", listener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () =>
      window.removeEventListener("eip6963:announceProvider", listener);
  }, []);
  useEffect(() => {
    if (!wallet) return;
    const changed = () => {
      setAccount(undefined);
      setConsent(false);
      setStatus(t`Wallet changed. Connect again to review the active account.`);
    };
    wallet.provider.on?.("accountsChanged", changed);
    wallet.provider.on?.("chainChanged", changed);
    return () => {
      wallet.provider.removeListener?.("accountsChanged", changed);
      wallet.provider.removeListener?.("chainChanged", changed);
    };
  }, [wallet]);
  async function connect(selected: Wallet) {
    if (transactionLock.current)
      throw new Error(t`Finish the pending transaction first.`);
    const addresses = await selected.provider.request({
      method: "eth_requestAccounts",
    });
    if (!Array.isArray(addresses) || typeof addresses[0] !== "string")
      throw new Error(t`Wallet has no account.`);
    const address = getAddress(addresses[0]);
    setWallet(selected);
    setAccount(address);
    setConsent(accepted(address));
  }
  const configure = useCallback((next: Settings) => {
    if (transactionLock.current)
      throw new Error(
        t`Finish the pending transaction before changing settings.`,
      );
    validateSettings(next);
    setSettings(next);
    save("freelp:settings", next);
    setRevision((n) => n + 1);
  }, []);
  async function send(tx: Transaction) {
    if (!wallet || !account) throw new Error(t`Connect a wallet first.`);
    if (transactionLock.current)
      throw new Error(t`A transaction is already pending.`);
    transactionLock.current = true;
    setBusy(true);
    setStatus(t`Simulating and requesting wallet confirmation…`);
    try {
      const receipt = await executeTransaction(
        wallet.provider,
        account,
        settings,
        tx,
      );
      setStatus(t`Confirmed: ${receipt.transactionHash}`);
      setRevision((n) => n + 1);
      return receipt;
    } finally {
      transactionLock.current = false;
      setBusy(false);
    }
  }
  function agree() {
    if (account) {
      accept(account);
      setConsent(true);
    }
  }
  return {
    settings,
    configure,
    wallets,
    account,
    connect,
    consent,
    agree,
    busy,
    status,
    setStatus,
    send,
    revision,
  };
}
type Session = ReturnType<typeof useSessionState>;
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <Context.Provider value={useSessionState()}>{children}</Context.Provider>
  );
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error("Session missing");
  return context;
}
