import { useEffect, useRef, useState } from "react";
import { configuredNetwork, networkName } from "./networks";
import { deployPath } from "./routes";
import {
  isVerified,
  verifyNetworkDeployment,
  type NetworkCheck,
  type NetworkIssueState,
} from "./networkVerification";

export type RowState =
  "ready" | "needs-deployment" | "incompatible" | "unchecked";
export const ROW_LABELS: Record<RowState, string> = {
  ready: "Ready",
  "needs-deployment": "Needs deployment",
  incompatible: "Incompatible",
  unchecked: "Not checked",
};
export type Blocked = { chainId: number; check: NetworkCheck };

/**
 * Enabling a network verifies that chain only, then persists the choice.
 * Negative results live in memory for this page; only success is cached.
 */
export function useEnableGate(enableNetwork: (chainId: number) => void) {
  const [checking, setChecking] = useState<number>();
  const [blocked, setBlocked] = useState<Blocked>();
  const [negatives, setNegatives] = useState<Record<number, NetworkIssueState>>(
    {},
  );
  const [, setVerifiedRevision] = useState(0);
  async function enable(chainId: number) {
    setChecking(chainId);
    try {
      const check = await verifyNetworkDeployment(configuredNetwork(chainId));
      setNegatives((current) => {
        const next = { ...current };
        delete next[chainId];
        if (check.state !== "ready") next[chainId] = check.state;
        return next;
      });
      if (check.state === "ready") {
        enableNetwork(chainId);
        setBlocked(undefined);
      } else setBlocked({ chainId, check });
    } finally {
      setChecking(undefined);
      setVerifiedRevision((n) => n + 1);
    }
  }
  function rowState(chainId: number): RowState {
    const negative = negatives[chainId];
    if (negative === "missing") return "needs-deployment";
    if (negative === "mismatched") return "incompatible";
    return isVerified(chainId) ? "ready" : "unchecked";
  }
  return {
    checking,
    blocked,
    enable,
    rowState,
    dismiss: () => setBlocked(undefined),
  };
}

const TITLES: Record<NetworkIssueState, string> = {
  missing: "Contracts are not deployed on",
  mismatched: "Incompatible contracts on",
  unreachable: "Could not verify",
};
const EXPLANATIONS: Record<NetworkIssueState, string> = {
  missing:
    "This build's contracts are missing at their fixed addresses. Deploy them once for everyone, then enable the network.",
  mismatched:
    "Code at this build's fixed addresses does not match. Do not use this network with this build.",
  unreachable:
    "The RPC did not answer for this network. Review its RPC settings, then enable it again.",
};

export function EnableBlockedDialog({
  blocked,
  onCancel,
}: {
  blocked?: Blocked;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (blocked && !element.open) element.showModal();
    if (!blocked && element.open) element.close();
  }, [blocked]);
  const state = blocked?.check.state === "ready" ? undefined : blocked?.check;
  const name = blocked ? networkName(blocked.chainId) : "";
  return (
    <dialog
      ref={dialog}
      className="network-dialog"
      aria-labelledby="enable-blocked-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {blocked && state ? (
        <>
          <div className="row spread">
            <h2 id="enable-blocked-title">
              {TITLES[state.state]} {name}
            </h2>
            <button
              type="button"
              aria-label="Close network check"
              onClick={onCancel}
            >
              ×
            </button>
          </div>
          <p>{EXPLANATIONS[state.state]} The network stays disabled.</p>
          <div className="rpc-dialog-actions">
            {state.state === "unreachable" ? (
              <span />
            ) : (
              <a className="primary-link" href={deployPath(blocked.chainId)}>
                Deploy on this network
              </a>
            )}
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
