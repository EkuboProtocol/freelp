import { errorMessage } from "./errors";
import { useState, type ReactNode } from "react";
import { useSession } from "./session";
import { unresolvedForScope } from "./transactionJournal";
export function Field({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
export function Action({
  children,
  run,
  disabled = false,
}: {
  children: ReactNode;
  run: () => Promise<unknown>;
  disabled?: boolean;
}) {
  const { busy, account, settings, activity, setStatus } = useSession();
  const unresolved =
    !!account &&
    unresolvedForScope(activity.entries, settings.chainId, account).length > 0;
  const [running, setRunning] = useState(false);
  async function act() {
    setRunning(true);
    try {
      await run();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setRunning(false);
    }
  }
  return (
    <button
      type="button"
      aria-busy={running}
      className="primary-button"
      disabled={disabled || busy || running || !account || unresolved}
      title={
        unresolved
          ? "Check the pending request in transaction activity before sending another."
          : undefined
      }
      onClick={() => void act()}
    >
      {children}
      {running ? <span aria-hidden="true"> …</span> : null}
    </button>
  );
}
export function ErrorText({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="status">
      Error: {error}
    </p>
  ) : null;
}
