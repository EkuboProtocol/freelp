// FreeLP's page module: what the data module (app.ts) cannot reach itself.
// Exact calls `later(request)` for `native.later` and `connect` once the page
// has painted. It holds the browser's injected wallets (EIP-6963, else the
// legacy `window.ethereum`), forwards an allowlist of EIP-1193 methods to the
// one the person connected, and keeps FreeLP's preferences in localStorage
// under the keys earlier releases used. A topic named in `changed` makes every
// source that watched it read again.

export const WALLET_METHODS = new Set([
  "eth_accounts",
  "eth_chainId",
  "eth_requestAccounts",
  "eth_sendTransaction",
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
  "wallet_getCapabilities",
  "wallet_sendCalls",
  "wallet_getCallsStatus",
]);
const LEGACY = "legacy-injected";
const STORAGE_PREFIX = "freelp:";

export function createBridge(win) {
  const announced = [];
  let legacyReady = false;
  let connected = null;
  let account = "";
  let notice = "";
  let notify = () => {};
  const changed = () => notify("wallet");

  const wallets = () => {
    if (announced.length || !legacyReady) return announced;
    const provider = win.ethereum;
    return typeof provider?.request === "function"
      ? [{ info: { uuid: LEGACY, name: "Injected wallet" }, provider }]
      : [];
  };
  const onAccounts = () => {
    if (!account) return;
    account = "";
    notice = "Wallet changed. Connect again to review the active account.";
    changed();
  };
  const onChain = () => changed();
  const unbind = () => {
    connected?.provider.removeListener?.("accountsChanged", onAccounts);
    connected?.provider.removeListener?.("chainChanged", onChain);
  };

  function start({ changed: announce }) {
    notify = announce;
    win.addEventListener("eip6963:announceProvider", (event) => {
      const detail = event.detail;
      if (
        typeof detail?.provider?.request !== "function" ||
        typeof detail.info?.uuid !== "string" ||
        typeof detail.info.name !== "string" ||
        announced.some((w) => w.info.uuid === detail.info.uuid)
      )
        return;
      announced.push({ info: { uuid: detail.info.uuid, name: detail.info.name }, provider: detail.provider });
      changed();
    });
    win.dispatchEvent(new win.Event("eip6963:requestProvider"));
    // Wallets that announce also own window.ethereum, often through another
    // wrapper: offer the legacy entry only when nothing announced.
    win.setTimeout(() => {
      legacyReady = true;
      changed();
    }, 250);
  }

  async function chainOf(provider) {
    try {
      const id = await provider.request({ method: "eth_chainId" });
      return typeof id === "string" ? Number(BigInt(id)) : 0;
    } catch {
      return 0;
    }
  }

  const failure = (error) => ({
    error: {
      code: typeof error?.code === "number" ? error.code : null,
      message: String(error?.message ?? error ?? "Wallet request failed."),
    },
  });

  const handlers = {
    async wallet() {
      return {
        wallets: wallets().map((w) => ({ uuid: w.info.uuid, name: w.info.name })),
        connected: connected?.info.uuid ?? "",
        account,
        chainId: connected && account ? await chainOf(connected.provider) : 0,
        notice,
      };
    },
    async connect({ uuid }) {
      const selected = wallets().find((w) => w.info.uuid === uuid);
      if (!selected) return failure(new Error("That wallet is no longer available."));
      try {
        const addresses = await selected.provider.request({ method: "eth_requestAccounts" });
        if (!Array.isArray(addresses) || typeof addresses[0] !== "string")
          return failure(new Error("Wallet has no account."));
        unbind();
        connected = selected;
        account = addresses[0];
        notice = "";
        selected.provider.on?.("accountsChanged", onAccounts);
        selected.provider.on?.("chainChanged", onChain);
        changed();
        return { account };
      } catch (error) {
        return failure(error);
      }
    },
    async disconnect() {
      unbind();
      connected = null;
      account = "";
      notice = "";
      changed();
      return {};
    },
    async dismiss() {
      notice = "";
      changed();
      return {};
    },
    async request({ method, params }) {
      if (!WALLET_METHODS.has(method))
        return failure(new Error(`FreeLP does not send ${method} to wallets.`));
      if (!connected || !account) return failure(new Error("Connect a wallet first."));
      try {
        return { result: (await connected.provider.request(params === undefined ? { method } : { method, params })) ?? null };
      } catch (error) {
        return failure(error);
      }
    },
    async storageSnapshot() {
      const values = {};
      try {
        for (let i = 0; i < win.localStorage.length; i++) {
          const key = win.localStorage.key(i);
          if (key?.startsWith(STORAGE_PREFIX)) values[key] = win.localStorage.getItem(key);
        }
        return { values };
      } catch {
        return { values, unavailable: true };
      }
    },
    async storageSet({ key, value }) {
      if (typeof key !== "string" || !key.startsWith(STORAGE_PREFIX)) return failure(new Error("Invalid storage key."));
      try {
        win.localStorage.setItem(key, value);
        return {};
      } catch (error) {
        return failure(error);
      }
    },
    async asset({ path }) {
      if (typeof path !== "string" || !/^[a-z0-9/_.-]+$/i.test(path) || path.includes(".."))
        return failure(new Error("Invalid asset path."));
      try {
        const response = await win.fetch(new URL(path, win.document.baseURI), { redirect: "error" });
        return { status: response.status, type: response.headers.get("content-type") ?? "", text: response.ok ? await response.text() : "" };
      } catch (error) {
        return failure(error);
      }
    },
    // The data module's own topics: a source that watched one reads again.
    async announce({ topic }) {
      if (!["tx", "balances"].includes(topic)) return failure(new Error("Unknown topic."));
      notify(topic);
      return {};
    },
    async copy({ text }) {
      try {
        await win.navigator.clipboard.writeText(String(text));
        return {};
      } catch (error) {
        return failure(error);
      }
    },
  };

  async function later(request) {
    const handler = Object.hasOwn(handlers, request?.op) ? handlers[request.op] : null;
    if (!handler) return failure(new Error("Unknown request."));
    return handler(request);
  }
  return { start, later };
}

const bridge = createBridge(globalThis);
export function connect(host) {
  bridge.start(host);
}
export function later(request) {
  return bridge.later(request);
}
