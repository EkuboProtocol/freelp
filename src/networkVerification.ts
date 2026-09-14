import { verifyCode, type ContractKind } from "./contracts";
import { ContractIdentityError } from "./contractIdentity";
import {
  DEFAULT_MANAGER,
  DEFAULT_METADATA_RENDERER,
  DEFAULT_POOL_KEY_INDEX,
  DEFAULT_POSITION_DATA_FETCHER,
} from "./deployments";
import { errorMessage } from "./errors";
import { rpc } from "./rpc";
import { load, save } from "./storage";
import type { Settings } from "./types";

/** Why a network cannot be used with this build. */
export type NetworkIssueState = "missing" | "mismatched" | "unreachable";
export type NetworkIssue = { kind: ContractKind; message: string };
export type NetworkCheck =
  | { state: "ready"; issues: [] }
  | { state: NetworkIssueState; issues: NetworkIssue[] };

export function requiredContracts(
  settings: Settings,
): readonly (readonly [ContractKind, Settings["core"]])[] {
  return [
    ["Core", settings.core],
    ["PoolKeyIndex", DEFAULT_POOL_KEY_INDEX],
    ["FreeLPMetadataRenderer", DEFAULT_METADATA_RENDERER],
    ["FreeLP", settings.manager],
    [
      "FreeLPDataFetcher",
      settings.freeLPDataFetcher ?? DEFAULT_POSITION_DATA_FETCHER,
    ],
  ];
}

function issueState(error: unknown): NetworkIssueState {
  if (error instanceof ContractIdentityError)
    return error.state === "missing" ? "missing" : "mismatched";
  return "unreachable";
}

/**
 * One chain ID read plus one code read per required contract, then the local
 * runtime assertion. Never cached when it fails.
 */
export async function verifyNetworkDeployment(
  settings: Settings,
): Promise<NetworkCheck> {
  let chainId: number;
  try {
    chainId = await rpc(settings).getChainId();
  } catch (error) {
    return {
      state: "unreachable",
      issues: [{ kind: "Core", message: errorMessage(error) }],
    };
  }
  if (chainId !== settings.chainId)
    return {
      state: "unreachable",
      issues: [
        {
          kind: "Core",
          message: `Expected chain ${settings.chainId}, but this RPC reports ${chainId}.`,
        },
      ],
    };
  const states: NetworkIssueState[] = [];
  const issues: NetworkIssue[] = [];
  await Promise.all(
    requiredContracts(settings).map(async ([kind, address]) => {
      try {
        await verifyCode(settings, address, kind);
      } catch (error) {
        states.push(issueState(error));
        issues.push({ kind, message: `${kind}: ${errorMessage(error)}` });
      }
    }),
  );
  if (!issues.length) {
    rememberVerification(settings.chainId);
    return { state: "ready", issues: [] };
  }
  forgetVerification(settings.chainId);
  return { state: summarize(states), issues };
}

function summarize(states: NetworkIssueState[]): NetworkIssueState {
  if (states.includes("unreachable")) return "unreachable";
  if (states.includes("mismatched")) return "mismatched";
  return "missing";
}

// Successful checks are remembered per chain for this build's contract set.
// A build with different addresses ignores older entries.
const key = "freelp:verifiedNetworks";
type VerifiedNetworks = Record<string, { manager: string; fetcher: string }>;
function loadVerified(): VerifiedNetworks {
  const saved = load<VerifiedNetworks | null>(key, null);
  return saved && typeof saved === "object" && !Array.isArray(saved)
    ? saved
    : {};
}
export function isVerified(chainId: number) {
  const entry = loadVerified()[chainId];
  return (
    !!entry &&
    entry.manager === DEFAULT_MANAGER &&
    entry.fetcher === DEFAULT_POSITION_DATA_FETCHER
  );
}
export function rememberVerification(chainId: number) {
  const verified = loadVerified();
  verified[chainId] = {
    manager: DEFAULT_MANAGER,
    fetcher: DEFAULT_POSITION_DATA_FETCHER,
  };
  save(key, verified);
}
export function forgetVerification(chainId: number) {
  const verified = loadVerified();
  if (!(chainId in verified)) return;
  delete verified[chainId];
  save(key, verified);
}
