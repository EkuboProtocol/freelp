import { useState } from "react";
import { useSession } from "./session";
import { isUnresolved, type JournalEntry } from "./transactionJournal";
import { networkName } from "./networks";
import { errorMessage } from "./errors";
import "./transaction-activity.css";

export function TransactionActivity() {
  const { activity, account } = useSession();
  const entries = activity.entries.filter(
    (entry) => entry.account.toLowerCase() === account?.toLowerCase(),
  );
  if (!entries.length) return null;
  const unresolved = entries.filter(isUnresolved);
  const completed = entries
    .filter((entry) => !isUnresolved(entry))
    .slice(-5)
    .reverse();
  return (
    <aside aria-label="Transaction activity" className="transaction-activity">
      <strong>This browser’s activity</strong>
      {unresolved.map((entry) => (
        <ActivityEntry key={entry.id} entry={entry} />
      ))}
      {completed.length ? (
        <details>
          <summary>Recent completed requests</summary>
          {completed.map((entry) => (
            <ActivityEntry key={entry.id} entry={entry} />
          ))}
        </details>
      ) : null}
    </aside>
  );
}
function ActivityEntry({ entry }: { entry: JournalEntry }) {
  const { checkTransaction, busy } = useSession();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setChecking(true);
    setError("");
    try {
      await checkTransaction(entry);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setChecking(false);
    }
  }
  return (
    <div className="transaction-activity-entry">
      <strong>
        {networkName(entry.chainId)} · {entry.state}
      </strong>
      <code>
        {entry.batchId ??
          entry.hash ??
          "Identifier unavailable — check your wallet’s activity."}
      </code>
      {entry.state === "partial" ? (
        <p>
          Some batch calls failed. Refresh balances before starting another
          action.
        </p>
      ) : null}
      {isUnresolved(entry) ? (
        <button
          type="button"
          disabled={busy || checking}
          aria-busy={checking}
          onClick={() => void check()}
        >
          Check status
        </button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
