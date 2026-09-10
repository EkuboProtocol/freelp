import { t } from "@lingui/core/macro";
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { networkName } from "./networks";
import { useSession } from "./session";
import { SettingsPage } from "./SettingsPage";
import { TermsPage } from "./TermsPage";
import { DeployPage } from "./DeployPage";
import { CreatePage } from "./CreatePage";
import { PositionsPage } from "./PositionsPage";
function BuildPage() {
  return (
    <section>
      <h2>
        <Trans>Build details</Trans>
      </h2>
      <p>
        <Trans>Official source repository:</Trans>{" "}
        <a
          href="https://github.com/EkuboProtocol/freelp"
          target="_blank"
          rel="noreferrer"
        >
          EkuboProtocol/freelp
        </a>
      </p>
      <p>
        <Trans>Run the installed app locally with</Trans>{" "}
        <code>bunx @ekubo/freelp</code>.
      </p>
      <p>
        <Trans>
          The package contains the complete application. Your package manager
          handles package integrity; the launcher serves local files without
          fetching a separate build or contacting GitHub.
        </Trans>
      </p>
      <p className="row">
        <a href="./licenses/freelp.txt">
          <Trans>MIT license</Trans>
        </a>
        <a href="./licenses/contracts.txt">
          <Trans>Contract license</Trans>
        </a>
        <a href="./licenses/dependencies.txt">
          <Trans>Dependency notices</Trans>
        </a>
      </p>
    </section>
  );
}
function Page({ route }: { route: string }) {
  const { account } = useSession();
  switch (route) {
    case "#/settings":
      return <SettingsPage />;
    case "#/terms":
      return <TermsPage key={account ?? "disconnected"} />;
    case "#/deploy":
      return <DeployPage />;
    case "#/create":
      return <CreatePage />;
    case "#/build":
      return <BuildPage />;
    default:
      return <PositionsPage />;
  }
}
export function App() {
  const session = useSession();
  const [route, setRoute] = useState(location.hash);
  useEffect(() => {
    const update = () => setRoute(location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return (
    <main>
      <header>
        <h1>FreeLP</h1>
        <nav aria-label={t`Main navigation`}>
          <a href="#/positions">
            <Trans>Positions</Trans>
          </a>
          <a href="#/create">
            <Trans>Create</Trans>
          </a>
          <a href="#/settings">
            <Trans>Settings</Trans>
          </a>
          <a href="#/deploy">
            <Trans>Deploy</Trans>
          </a>
        </nav>
      </header>
      <div className="panel">
        <div className="row">
          {session.account ? (
            <span className="mono">{session.account}</span>
          ) : (
            session.wallets.map((w) => (
              <button
                key={w.info.uuid}
                onClick={() =>
                  void session
                    .connect(w)
                    .catch((e) => session.setStatus(String(e)))
                }
              >
                <Trans>Connect {w.info.name}</Trans>
              </button>
            ))
          )}
          {!session.account && session.wallets.length === 0 ? (
            <span>
              <Trans>
                No injected wallet detected. Open this page in a browser with a
                wallet extension.
              </Trans>
            </span>
          ) : null}
          <span>
            <select
              aria-label={t`Active network`}
              value={session.settings.chainId}
              disabled={session.busy}
              onChange={(event) =>
                session.selectNetwork(Number(event.target.value))
              }
            >
              {session.networks.map((network) => (
                <option key={network.chainId} value={network.chainId}>
                  {networkName(network.chainId)}
                </option>
              ))}
            </select>
          </span>
        </div>
        {session.account ? (
          <button
            disabled={session.busy}
            onClick={() =>
              void session
                .switchWalletNetwork()
                .catch((error) => session.setStatus(String(error)))
            }
          >
            <Trans>Switch wallet to this network</Trans>
          </button>
        ) : null}
        {!session.consent ? (
          <p>
            <Trans>
              Before any transaction, read and accept the{" "}
              <a href="#/terms">Terms of Service</a>. Use at your own risk.
            </Trans>
          </p>
        ) : null}
      </div>
      {session.status ? (
        <p role="status" className="status">
          {session.status}
        </p>
      ) : null}
      <Page key={`${session.settings.chainId}:${route}`} route={route} />
      <footer className="row">
        <a href="#/terms">
          <Trans>Terms</Trans>
        </a>
        <a href="#/build">
          <Trans>About FreeLP</Trans>
        </a>
        <span>
          <Trans>No application fees. Network gas applies.</Trans>
        </span>
      </footer>
    </main>
  );
}
