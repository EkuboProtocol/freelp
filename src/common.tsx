import { useState, type ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { useSession } from "./session";
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
  const { busy, consent, account, setStatus } = useSession();
  const [running, setRunning] = useState(false);
  async function act() {
    setRunning(true);
    try {
      await run();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  }
  return (
    <button
      type="button"
      aria-busy={running}
      className="primary-button"
      disabled={disabled || busy || running || !consent || !account}
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
      <Trans>Error: {error}</Trans>
    </p>
  ) : null;
}
