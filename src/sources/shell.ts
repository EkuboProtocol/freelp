import { getAddress, keccak256, type Address } from "viem";
import { DEFAULT_CHAIN_IDS, MAINNET_CHAINS, rpcEndpoint } from "../chains";
import { DEFAULT_SETTINGS, loadSettings, validateSettings } from "../config";
import { errorMessage } from "../errors";
import {
  configuredNetwork,
  loadNetworks,
  networkName,
  setNetworkEnabled,
  updateNetworks,
} from "../networks";
import {
  isVerified,
  verifyNetworkDeployment,
  type NetworkIssueState,
} from "../networkVerification";
import { page, ready, watch } from "../page";
import { clearStatus } from "./tx";
import { rpc } from "../rpc";
import { save, storageWarning } from "../storage";
import { ensureNativeCurrency } from "../tokens";
import { APP_VERSION, CONTRACTS_SOURCE } from "../version";

export type Reply = { ok: boolean; error: string };
const ok: Reply = { ok: true, error: "" };
const failed = (error: unknown): Reply => ({
  ok: false,
  error: errorMessage(error),
});

type PageWallet = {
  wallets: { uuid: string; name: string }[];
  connected: string;
  account: string;
  notice: string;
};

// The 5×5 mirrored identicon earlier releases drew from the address hash.
function identicon(address: Address) {
  const hash = keccak256(address);
  return Array.from({ length: 25 }, (_, i) => i).filter((i) => {
    const x = i % 5;
    const bit = Math.floor(i / 5) * 3 + Math.min(x, 4 - x);
    return parseInt(hash[bit + 2], 16) % 2 === 1;
  });
}

export async function session() {
  await ready();
  watch("wallet");
  const state = await page<PageWallet>("wallet");
  const account = state.account ? getAddress(state.account) : "";
  return {
    wallets: state.wallets,
    connected: state.connected,
    account,
    short: account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "",
    identicon: account ? identicon(account) : [],
    notice: state.notice,
    ready: true,
  };
}

// Answers in the browser only: a page rendered at build has no page module.
export function client() {
  return { live: true };
}

export function appInfo() {
  return {
    version: APP_VERSION,
    contracts: `${CONTRACTS_SOURCE.repository}@${CONTRACTS_SOURCE.commit.slice(0, 7)}`,
    contractsUrl: `https://github.com/${CONTRACTS_SOURCE.repository}/commit/${CONTRACTS_SOURCE.commit}`,
  };
}

export async function connectWallet(uuid: string): Promise<Reply> {
  return page("connect", { uuid }).then(() => ok, failed);
}
export async function disconnectWallet(): Promise<Reply> {
  return page("disconnect").then(() => ok, failed);
}
export async function dismissNotice(): Promise<Reply> {
  clearStatus();
  return page("dismiss").then(() => ok, failed);
}
export async function copyText(text: string): Promise<Reply> {
  return page("copy", { text }).then(
    () => ok,
    () => ({ ok: false, error: "Select and copy the text manually." }),
  );
}

// Checks that failed this session, so a row says why it stayed disabled.
const negatives = new Map<number, NetworkIssueState>();
const ROW_LABELS = {
  ready: "Ready",
  "needs-deployment": "Needs deployment",
  incompatible: "Incompatible",
  unchecked: "Not checked",
};
function rowState(chainId: number) {
  const negative = negatives.get(chainId);
  if (negative === "missing") return ROW_LABELS["needs-deployment"];
  if (negative === "mismatched") return ROW_LABELS.incompatible;
  return isVerified(chainId) ? ROW_LABELS.ready : ROW_LABELS.unchecked;
}

export async function networkCatalog() {
  await ready();
  const enabled = new Set(loadNetworks().map((network) => network.chainId));
  return {
    rows: MAINNET_CHAINS.map((chain) => {
      const configured = configuredNetwork(chain.id);
      return {
        id: chain.id,
        name: chain.name,
        symbol: chain.nativeCurrency.symbol,
        enabled: enabled.has(chain.id),
        custom: !!configured.rpcUrl,
        rpcUrl: configured.rpcUrl,
        defaultRpc: rpcEndpoint({ ...configured, rpcUrl: "" }),
        state: rowState(chain.id),
      };
    }),
    enabled: enabled.size,
    total: MAINNET_CHAINS.length,
    storageWarning: storageWarning(),
  };
}

function toggle(id: number, enabled: boolean) {
  const next = setNetworkEnabled(loadNetworks(), id, enabled);
  const current = loadSettings();
  const active =
    next.find((network) => network.chainId === current.chainId) ??
    next[0] ??
    DEFAULT_SETTINGS;
  if (enabled)
    ensureNativeCurrency(next.find((network) => network.chainId === id)!);
  save("freelp:settings", active);
}

export async function enableNetwork(id: number) {
  await ready();
  const name = networkName(id);
  try {
    const check = await verifyNetworkDeployment(configuredNetwork(id));
    negatives.delete(id);
    if (check.state !== "ready") {
      negatives.set(id, check.state);
      return { ok: false, error: "", chainId: id, name, state: check.state };
    }
    toggle(id, true);
    return { ok: true, error: "", chainId: id, name, state: "ready" };
  } catch (error) {
    return { ...failed(error), chainId: id, name, state: "unreachable" };
  }
}

export async function disableNetwork(id: number): Promise<Reply> {
  await ready();
  try {
    toggle(id, false);
    return ok;
  } catch (error) {
    return failed(error);
  }
}

export async function restoreNetworks(): Promise<Reply> {
  await ready();
  try {
    const enabled = new Set(loadNetworks().map((network) => network.chainId));
    for (const id of DEFAULT_CHAIN_IDS) if (!enabled.has(id)) toggle(id, true);
    return ok;
  } catch (error) {
    return failed(error);
  }
}

export async function saveRpc(id: number, rpcUrl: string): Promise<Reply> {
  await ready();
  try {
    const next = validateSettings({ ...configuredNetwork(id), rpcUrl });
    if (next.rpcUrl) {
      const reported = await rpc(next).getChainId();
      if (reported !== next.chainId)
        throw new Error(
          `Expected chain ${next.chainId}, but this RPC reports ${reported}.`,
        );
    }
    ensureNativeCurrency(next);
    updateNetworks(loadNetworks(), next);
    const current = loadSettings();
    if (current.chainId === next.chainId) save("freelp:settings", next);
    return ok;
  } catch (error) {
    return failed(error);
  }
}
