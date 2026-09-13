import { createRoot } from "react-dom/client";
import { App } from "./App";
import { SessionProvider } from "./session";
import { AppErrorBoundary } from "./AppErrorBoundary";
import "./styles.css";
import "./ux-layout.css";
createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <SessionProvider>
      <App />
    </SessionProvider>
  </AppErrorBoundary>,
);
