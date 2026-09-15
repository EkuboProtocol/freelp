import { useCopied } from "./useCopied";
import { AccountControl } from "./AccountControl";
import { useEffect, useState } from "react";
import { useSession } from "./session";
import { SettingsPage } from "./SettingsPage";
import { TermsPage } from "./TermsPage";
import { DeployPage, DeployRedirect, InvalidDeployLink } from "./DeployPage";
import {
  parseDeployRoute,
  type DeployRoute as DeployRouteTarget,
} from "./routes";
import { CreatePage } from "./CreatePage";
import { PositionsPage } from "./PositionsPage";
import { APP_VERSION, CONTRACTS_SOURCE, REPOSITORY_URL } from "./version";
function AboutPage() {
  return (
    <section className="about-page">
      <h2>About FreeLP</h2>
      <p>
        FreeLP is an ownerless liquidity position manager for Ekubo on EVM
        networks. It charges no application fees and talks only to the RPC
        endpoints you configure and the wallet you connect.
      </p>
      <h3>Hosted version</h3>
      <p>
        <a href="https://freelp.ekubo.org/">freelp.ekubo.org</a> serves this
        release. Your wallet still signs transactions in the browser.
      </p>
      <h3>Run locally</h3>
      <Command command="bunx @ekubo/freelp@latest" />
      <p>
        <code>npx @ekubo/freelp@latest</code> works the same way. Add a version
        suffix such as <code>@ekubo/freelp@{APP_VERSION}</code> to keep a
        specific release. The package opens a local web server; your wallet
        signs transactions in the browser.
      </p>
      <h3>Version and source</h3>
      <p>
        FreeLP {APP_VERSION} · contracts pinned to{" "}
        <a
          href={`https://github.com/${CONTRACTS_SOURCE.repository}/commit/${CONTRACTS_SOURCE.commit}`}
          target="_blank"
          rel="noreferrer"
        >
          {CONTRACTS_SOURCE.repository}@{CONTRACTS_SOURCE.commit.slice(0, 7)}
        </a>
        {" · "}
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
          source repository
        </a>
      </p>
      <p>
        Contract addresses are fixed by this build. Each network's Deploy page
        shows them next to a code check against the bundled artifacts.
      </p>
      <h3>Data and privacy</h3>
      <p>
        Everything on-chain comes from the RPC endpoints configured in Networks.
        Network preferences and imported token metadata stay in this browser.
        Loading the hosted site involves distribution traffic; nothing else
        leaves the browser.
      </p>
      <h3>Licenses</h3>
      <p className="row">
        <a href="./licenses/freelp.txt">MIT license</a>
        <a href="./licenses/contracts.txt">Contract license</a>
        <a href="./licenses/dependencies.txt">Dependency notices</a>
      </p>
    </section>
  );
}
function DeployRoute({ target }: { target: DeployRouteTarget }) {
  if (target.kind === "chain") return <DeployPage chainId={target.chainId} />;
  if (target.kind === "active") return <DeployRedirect />;
  return <InvalidDeployLink />;
}
function Page({ route }: { route: string }) {
  const deploy = parseDeployRoute(route);
  if (deploy) return <DeployRoute target={deploy} />;
  switch (route.split("?")[0]) {
    case "#/settings":
    case "#/networks":
      return <SettingsPage />;
    case "#/terms":
      return <TermsPage />;
    case "#/create":
      return <CreatePage />;
    case "#/build":
      return <AboutPage />;
    default:
      return <PositionsPage route={route} />;
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
        Skip to content
      </a>
      <header>
        <h1>FreeLP</h1>
        <MainNavigation route={route} />
        <AccountControl />
      </header>
      {session.status ? (
        <div className="notification-toast" aria-label="Notification">
          <p role="status" className="status" tabIndex={0}>
            {session.status}
          </p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => session.setStatus("")}
          >
            ×
          </button>
        </div>
      ) : null}
      <div id="main-content" tabIndex={-1}>
        <Page
          key={route.split("?")[0].split("/")[1] || "positions"}
          route={route}
        />
      </div>
      <footer className="row">
        <a href="#/terms">Terms</a>
        <a href="#/build">About FreeLP</a>
        <a
          className="github-link"
          href={REPOSITORY_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="FreeLP on GitHub"
          title="FreeLP on GitHub"
        >
          <GitHubMark />
        </a>
        <span className="app-version">v{APP_VERSION}</span>
        <span className="free-forever">
          No application fees. Network gas costs apply.
        </span>
      </footer>
    </main>
  );
}

function MainNavigation({ route }: { route: string }) {
  return (
    <nav aria-label={"Main navigation"}>
      <a
        href="#/positions"
        aria-current={
          route.startsWith("#/positions") || !route ? "page" : undefined
        }
      >
        Positions
      </a>
      <a
        href="#/networks"
        aria-current={
          route.startsWith("#/networks") || route.startsWith("#/settings")
            ? "page"
            : undefined
        }
      >
        Networks
      </a>
    </nav>
  );
}

function Command({ command }: { command: string }) {
  const [copied, showCopied] = useCopied();
  const [error, setError] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      showCopied();
    } catch {
      setError("Select and copy the command manually.");
    }
  }
  return (
    <>
      <div className="command">
        <code>{command}</code>
        <button onClick={() => void copy()}>
          {copied ? "Copied" : "Copy command"}
        </button>
      </div>
      <span role="status">{error}</span>
    </>
  );
}

function GitHubMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="18"
      height="18"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
