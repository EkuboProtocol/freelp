import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { TERMS, TERMS_HASH } from "./terms";
import { useSession } from "./session";
export function TermsPage() {
  const { account, consent, agree } = useSession();
  const [checked, setChecked] = useState(false);
  return (
    <section>
      <h2>
        <Trans>Terms of Service</Trans>
      </h2>
      <div className="terms" tabIndex={0}>
        {TERMS}
      </div>
      <p className="mono">
        <small>
          <Trans>Terms version: {TERMS_HASH}</Trans>
        </small>
      </p>
      {consent ? (
        <p>
          <Trans>Accepted for the connected wallet.</Trans>
        </p>
      ) : (
        <div className="stack">
          <label className="row">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <Trans>
              I have read and agree to the Terms of Service and understand that
              I use FreeLP at my own risk.
            </Trans>
          </label>
          <button disabled={!checked || !account} onClick={agree}>
            <Trans>Accept terms</Trans>
          </button>
          {!account ? (
            <p>
              <Trans>Connect a wallet to record your acceptance.</Trans>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
