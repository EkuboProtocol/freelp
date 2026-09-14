import { useCopied } from "./useCopied";
import { AccountControl } from "./AccountControl";
import { useEffect, useState } from "react";
import { useSession } from "./session";
import { SettingsPage } from "./SettingsPage";
import { TermsPage } from "./TermsPage";
import { DeployPage } from "./DeployPage";
import { CreatePage } from "./CreatePage";
import { PositionsPage } from "./PositionsPage";
import { DEFAULT_MANAGER, DEFAULT_POOL_KEY_INDEX } from "./deployments";
function BuildPage() {
  return (
    <section>
      <h2>Build details</h2>
      <p>
        FreeLP manager: <code>{DEFAULT_MANAGER}</code>
      </p>
      <p>
        Shared pool index: <code>{DEFAULT_POOL_KEY_INDEX}</code>
      </p>
      <p>
        Positions from earlier contract deployments remain at their original
        manager. Use a compatible pinned release to manage those NFTs.
      </p>
      <p>
        Official source repository:{" "}
        <a
          href="https://github.com/EkuboProtocol/freelp"
          target="_blank"
          rel="noreferrer"
        >
          EkuboProtocol/freelp
        </a>
      </p>
      <p>
        Run the installed app locally with{" "}
        <code>bunx @ekubo/freelp@latest</code> or{" "}
        <code>npx @ekubo/freelp@latest</code>.
      </p>
      <p>
        The package contains the complete application. Your package manager
        handles package integrity; the launcher serves local files without
        fetching a separate build or contacting GitHub.
      </p>
      <h3>Run locally</h3>
      <Command command="bunx @ekubo/freelp@latest" />
      <Command command="npx @ekubo/freelp@latest" />
      <p>
        Use a version suffix to keep a specific release, for example
        @ekubo/freelp@0.1.1. The package opens a local web server; your wallet
        signs transactions in the browser.
      </p>
      <p className="row">
        <a href="./licenses/freelp.txt">MIT license</a>
        <a href="./licenses/contracts.txt">Contract license</a>
        <a href="./licenses/dependencies.txt">Dependency notices</a>
      </p>
    </section>
  );
}
function Page({ route }: { route: string }) {
  switch (route.split("?")[0]) {
    case "#/settings":
    case "#/networks":
      return <SettingsPage />;
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
      <a
        href="#/deploy"
        aria-current={route.startsWith("#/deploy") ? "page" : undefined}
      >
        Deploy
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
