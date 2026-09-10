import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
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
          href="https://github.com/moodysalem/freelp"
          target="_blank"
          rel="noreferrer"
        >
          moodysalem/freelp
        </a>
      </p>
      <p>
        <Trans>
          Use the FreeLP CLI to verify GitHub CI provenance and all application
          files before opening this app. A website cannot independently prove
          its own authenticity.
        </Trans>
      </p>
      <p>
        <Trans>
          This page does not assert that the build is verified. The independent
          launcher reports the authenticated commit and content identifier.
        </Trans>
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
        <nav aria-label="Main navigation">
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
            <Trans>Chain {session.settings.chainId}</Trans>
          </span>
        </div>
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
      <Page route={route} />
      <footer className="row">
        <a href="#/terms">
          <Trans>Terms</Trans>
        </a>
        <a href="#/build">
          <Trans>Build provenance</Trans>
        </a>
        <span>
          <Trans>No application fees. Network gas applies.</Trans>
        </span>
      </footer>
    </main>
  );
}
