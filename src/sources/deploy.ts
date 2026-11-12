import { chainDefinition } from "../chains";
import { verifyCode, type ContractKind } from "../contracts";
import {
  DEFAULT_METADATA_RENDERER,
  DEFAULT_POOL_KEY_INDEX,
} from "../deployments";
import {
  CREATE2_FACTORY,
  DEPLOYMENT_SALT,
  deploymentAddress,
  deploymentStatus,
  prepareAllDeployments,
  prepareDeployment,
} from "../deterministic";
import { errorMessage } from "../errors";
import { configuredNetwork, loadNetworks, networkName } from "../networks";
import { verifyNetworkDeployment } from "../networkVerification";
import { loadSettings } from "../config";
import { ready, walletProvider } from "../page";
import { supportsCalls } from "../walletCalls";
import { connectedAccount, execute, report, type TxReply } from "./tx";

const KINDS: ContractKind[] = [
  "Core",
  "PoolKeyIndex",
  "FreeLPMetadataRenderer",
  "FreeLP",
  "FreeLPDataFetcher",
];

// `/deploy/<chainId>` names a network; `/deploy` opens the active one.
function target(route: string): number | "invalid" {
  const path = route.split("?")[0];
  if (path === "/deploy" || path === "/deploy/") {
    const networks = loadNetworks();
    const active = loadSettings().chainId;
    return networks.some((n) => n.chainId === active)
      ? active
      : (networks[0]?.chainId ?? 0);
  }
  const match = /^\/deploy\/(\d{1,15})$/.exec(path);
  if (!match) return "invalid";
  try {
    chainDefinition(Number(match[1]));
    return Number(match[1]);
  } catch {
    return "invalid";
  }
}

async function card(chainId: number, kind: ContractKind) {
  const settings = configuredNetwork(chainId);
  const address = deploymentAddress(kind, settings.core);
  let state = "missing";
  let error = "";
  try {
    if ((await deploymentStatus(settings, kind)).exists) state = "exists";
  } catch (e) {
    state = "error";
    error = errorMessage(e);
  }
  return {
    kind,
    title: kind === "FreeLP" ? "Position manager" : kind,
    address,
    core: ["Core", "FreeLPMetadataRenderer"].includes(kind)
      ? ""
      : settings.core,
    poolKeyIndex: kind === "FreeLP" ? DEFAULT_POOL_KEY_INDEX : "",
    renderer: kind === "FreeLP" ? DEFAULT_METADATA_RENDERER : "",
    state,
    error,
  };
}

export async function deployView(route: string) {
  await ready();
  const chainId = target(route);
  const empty = {
    state: chainId === "invalid" ? "invalid" : "none",
    chainId: 0,
    name: "",
    enabled: false,
    cards: [],
    batch: false,
    missing: 0,
    batchError: "",
    complete: false,
    factory: CREATE2_FACTORY,
    salt: DEPLOYMENT_SALT,
  };
  if (chainId === "invalid" || chainId === 0) return empty;
  const settings = configuredNetwork(chainId);
  const account = await connectedAccount();
  const batch = account
    ? await supportsCalls(walletProvider, account, settings)
    : false;
  let missing = 0;
  let batchError = "";
  if (batch)
    try {
      missing = (await prepareAllDeployments(settings)).length;
    } catch (error) {
      batchError = errorMessage(error);
    }
  const [cards, check] = await Promise.all([
    Promise.all(KINDS.map((kind) => card(chainId, kind))),
    verifyNetworkDeployment(settings),
  ]);
  return {
    ...empty,
    state: "chain",
    chainId,
    name: networkName(chainId, settings.name),
    enabled: loadNetworks().some((n) => n.chainId === chainId),
    cards,
    batch,
    missing,
    batchError,
    complete: check.state === "ready",
  };
}

export async function deployContract(
  chainId: number,
  kind: string,
): Promise<TxReply> {
  await ready();
  if (!KINDS.includes(kind as ContractKind))
    return { ok: false, error: "Unknown contract.", hash: "" };
  try {
    const settings = configuredNetwork(chainId);
    const transaction = await prepareDeployment(settings, kind as ContractKind);
    const sent = await execute(chainId, transaction);
    if (!sent.ok) return sent;
    const address = deploymentAddress(kind as ContractKind, settings.core);
    await verifyCode(settings, address, kind as ContractKind);
    report(`Deployed ${kind} at ${address}.`);
    return sent;
  } catch (error) {
    report(errorMessage(error));
    return { ok: false, error: errorMessage(error), hash: "" };
  }
}

export async function deployAll(chainId: number): Promise<TxReply> {
  await ready();
  try {
    const settings = configuredNetwork(chainId);
    const calls = await prepareAllDeployments(settings);
    if (!calls.length) return { ok: true, error: "", hash: "" };
    const sent = await execute(chainId, calls);
    if (!sent.ok) return sent;
    if ((await prepareAllDeployments(settings)).length)
      throw new Error(
        "Some contracts are still missing. Refresh deployments to see the current state.",
      );
    report("Deployed all required contracts.");
    return sent;
  } catch (error) {
    report(errorMessage(error));
    return { ok: false, error: errorMessage(error), hash: "" };
  }
}
