import { useCopied } from "./useCopied";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { keccak256, type Address } from "viem";
import { useSession } from "./session";
import { errorMessage } from "./errors";

function Identicon({ address }: { address: Address }) {
  const hash = keccak256(address);
  return (
    <svg
      className="account-identicon"
      viewBox="0 0 7 7"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect width="7" height="7" fill="#eee" />
      {Array.from({ length: 25 }, (_, i) => {
        const x = i % 5;
        const bit = Math.floor(i / 5) * 3 + Math.min(x, 4 - x);
        return parseInt(hash[bit + 2], 16) % 2 ? (
          <rect
            key={i}
            x={x + 1}
            y={Math.floor(i / 5) + 1}
            width="1"
            height="1"
            fill="#111"
          />
        ) : null;
      })}
    </svg>
  );
}
export function AccountControl() {
  const session = useSession();
  const [copied, showCopied] = useCopied();
  async function copy() {
    try {
      await navigator.clipboard.writeText(session.account!);
      showCopied();
    } catch (error) {
      session.setStatus(errorMessage(error));
    }
  }
  if (session.account)
    return (
      <details className="account-control">
        <summary aria-label={t`Connected wallet: ${session.account}`}>
          <Identicon address={session.account} />
          <span className="mono">
            {session.account.slice(0, 6)}…{session.account.slice(-4)}
          </span>
        </summary>
        <div className="account-menu">
          <span className="mono">{session.account}</span>
          <button onClick={() => void copy()}>
            {copied ? <Trans>Copied</Trans> : <Trans>Copy address</Trans>}
          </button>
        </div>
      </details>
    );
  return (
    <div className="wallet-connect">
      {session.wallets.map((w) => (
        <button
          key={w.info.uuid}
          onClick={() =>
            void session
              .connect(w)
              .catch((error) => session.setStatus(errorMessage(error)))
          }
        >
          <Trans>Connect {w.info.name}</Trans>
        </button>
      ))}
      {!session.wallets.length ? (
        <span className="wallet-unavailable">
          <Trans>No wallet detected</Trans>
        </span>
      ) : null}
    </div>
  );
}
