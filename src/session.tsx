import { executeBatch } from "./walletBatch";
import { executeTransaction } from "./transactions";
import { errorMessage } from "./errors";
import { ensureNativeCurrency } from "./tokens";
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
import { loadNetworks, updateNetworks, setNetworkEnabled } from "./networks";
import { loadSettings, validateSettings, DEFAULT_SETTINGS } from "./config";
import { save } from "./storage";
import type { Settings, Transaction, Wallet } from "./types";
import type { TransactionObserver } from "./transactions";
function useSessionState() {
  const [networks, setNetworks] = useState(loadNetworks);
  const [settings, setSettings] = useState(
    () =>
      networks.find((network) => network.chainId === loadSettings().chainId) ??
      networks[0] ??
      DEFAULT_SETTINGS,
  );
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [wallet, setWallet] = useState<Wallet>();
  const [account, setAccount] = useState<Address>();
  const [busy, setBusy] = useState(false);
  const transactionLock = useRef(false);
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Wallet>).detail;
      if (
        typeof detail?.provider?.request === "function" &&
        typeof detail.info?.uuid === "string" &&
        typeof detail.info.name === "string"
      )
        setWallets((prev) =>
          prev.some((w) => w.info.uuid === detail.info.uuid)
            ? prev
            : [...prev, detail],
        );
    };
    window.addEventListener("eip6963:announceProvider", listener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const legacyTimer = window.setTimeout(() => {
      const provider = (window as Window & { ethereum?: Wallet["provider"] })
        .ethereum;
      if (typeof provider?.request !== "function") return;
      setWallets((current) =>
        current.some((wallet) => wallet.provider === provider)
          ? current
          : [
              ...current,
              {
                info: { uuid: "legacy-injected", name: "Injected wallet" },
                provider,
              },
            ],
      );
    }, 250);
    return () => {
      clearTimeout(legacyTimer);
      window.removeEventListener("eip6963:announceProvider", listener);
    };
  }, []);
  useEffect(() => {
    if (!wallet) return;
    const changed = () => {
      setAccount(undefined);
      setStatus("Wallet changed. Connect again to review the active account.");
    };
    wallet.provider.on?.("accountsChanged", changed);

    return () => {
      wallet.provider.removeListener?.("accountsChanged", changed);
    };
  }, [wallet]);
  async function connect(selected: Wallet) {
    if (transactionLock.current)
      throw new Error("Finish the pending transaction first.");
    const addresses = await selected.provider.request({
      method: "eth_requestAccounts",
    });
    if (!Array.isArray(addresses) || typeof addresses[0] !== "string")
      throw new Error("Wallet has no account.");
    const address = getAddress(addresses[0]);
    setWallet(selected);
    setAccount(address);
    setStatus("");
  }
  function disconnect() {
    if (transactionLock.current) return;
    setWallet(undefined);
    setAccount(undefined);
    setStatus("");
    setRevision((value) => value + 1);
  }
  const configure = useCallback((next: Settings) => {
    if (transactionLock.current)
      throw new Error(
        "Finish the pending transaction before changing settings.",
      );
    next = validateSettings(next);
    ensureNativeCurrency(next);
    setSettings((current) =>
      current.chainId === next.chainId ? next : current,
    );
    setNetworks((current) => updateNetworks(current, next));
    setRevision((n) => n + 1);
  }, []);
  function toggleNetwork(id: number, enabled: boolean) {
    if (transactionLock.current)
      throw new Error(
        "Finish the pending transaction before changing settings.",
      );
    const next = setNetworkEnabled(networks, id, enabled);
    setNetworks(next);
    const active =
      next.find((network) => network.chainId === settings.chainId) ??
      next[0] ??
      DEFAULT_SETTINGS;
    if (enabled)
      ensureNativeCurrency(next.find((network) => network.chainId === id)!);
    setSettings(active);
    save("freelp:settings", active);
  }
  function selectNetwork(chainId: number) {
    const next = networks.find((network) => network.chainId === chainId);
    if (!next || next.chainId === settings.chainId) return;
    if (transactionLock.current)
      throw new Error(
        "Finish the pending transaction before changing settings.",
      );
    // Choosing an existing network does not invalidate balances or portfolio data.
    setSettings(next);
    save("freelp:settings", next);
  }
  async function send(tx: Transaction | Transaction[], target = settings) {
    if (!wallet || !account) throw new Error("Connect a wallet first.");
    if (transactionLock.current)
      throw new Error("A transaction is already pending.");
    // Only this page's active submission holds the lock. Browser history is
    // incomplete and cannot determine whether another action is available.
    transactionLock.current = true;
    setBusy(true);
    setStatus("Simulating transaction…");
    const observer: TransactionObserver = ({ state, hash, batchId }) => {
      const identifier = hash ?? batchId;
      setStatus(identifier ? `${state}: ${identifier}` : `${state}…`);
    };
    try {
      const receipt = await (Array.isArray(tx)
        ? executeBatch(wallet.provider, account, target, tx, observer)
        : executeTransaction(wallet.provider, account, target, tx, observer));
      setStatus(`Confirmed: ${receipt.transactionHash}`);
      return receipt;
    } catch (error) {
      setStatus(errorMessage(error));
      throw error;
    } finally {
      setRevision((n) => n + 1);
      transactionLock.current = false;
      setBusy(false);
    }
  }
  return {
    settings,
    networks,
    selectNetwork,
    configure,
    toggleNetwork,
    wallets,
    wallet,
    provider: wallet?.provider,
    account,
    connect,
    disconnect,
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

export function NetworkScope({
  settings,
  children,
}: {
  settings: Settings;
  children: ReactNode;
}) {
  const session = useSession();
  return (
    <Context.Provider
      value={{ ...session, settings, send: (tx) => session.send(tx, settings) }}
    >
      {children}
    </Context.Provider>
  );
}
