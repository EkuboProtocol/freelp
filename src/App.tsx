import { AccountControl } from "./AccountControl";
import { t } from "@lingui/core/macro";
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
          href="https://github.com/EkuboProtocol/freelp"
          target="_blank"
          rel="noreferrer"
        >
          EkuboProtocol/freelp
        </a>
      </p>
      <p>
        <Trans>Run the installed app locally with</Trans>{" "}
        <code>bunx @ekubo/freelp</code> <Trans>or</Trans>{" "}
        <code>npx @ekubo/freelp</code>.
      </p>
      <p>
        <Trans>
          The package contains the complete application. Your package manager
          handles package integrity; the launcher serves local files without
          fetching a separate build or contacting GitHub.
        </Trans>
      </p>
      <h3>
        <Trans>Run locally</Trans>
      </h3>
      <Command command="bunx @ekubo/freelp" />
      <Command command="npx @ekubo/freelp" />
      <p>
        <Trans>
          Use a version suffix to keep a specific release, for example
          @ekubo/freelp@0.1.1. The package opens a local web server; your wallet
          signs transactions in the browser.
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
  const { settings } = useSession();
  switch (route.split("?")[0]) {
    case "#/settings":
      return <SettingsPage key={settings.chainId} />;
    case "#/terms":
      return <TermsPage />;
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
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        <Trans>Skip to content</Trans>
      </a>
      <header>
        <h1>FreeLP</h1>
        <MainNavigation route={route} />
        <AccountControl />
      </header>
      {session.status ? (
        <p role="status" className="status">
          {session.status}
        </p>
      ) : null}
      <div id="main-content" tabIndex={-1}>
        <Page
          key={route.split("?")[0].split("/")[1] || "positions"}
          route={route}
        />
      </div>
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

function MainNavigation({ route }: { route: string }) {
  return (
    <nav aria-label={t`Main navigation`}>
      <a
        href="#/positions"
        aria-current={
          route.startsWith("#/positions") || !route ? "page" : undefined
        }
      >
        <Trans>Positions</Trans>
      </a>
      <a
        href="#/settings"
        aria-current={route.startsWith("#/settings") ? "page" : undefined}
      >
        <Trans>Settings</Trans>
      </a>
      <a
        href="#/deploy"
        aria-current={route.startsWith("#/deploy") ? "page" : undefined}
      >
        <Trans>Deploy</Trans>
      </a>
    </nav>
  );
}

function Command({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setError(t`Select and copy the command manually.`);
    }
  }
  return (
    <>
      <div className="command">
        <code>{command}</code>
        <button onClick={() => void copy()}>
          {copied ? <Trans>Copied</Trans> : <Trans>Copy command</Trans>}
        </button>
      </div>
      <span role="status">{error}</span>
    </>
  );
}
