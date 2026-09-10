import { createRoot } from "react-dom/client";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { messages } from "./locales/en.po";
import { App } from "./App";
import { SessionProvider } from "./session";
import "./styles.css";
i18n.load("en", messages);
i18n.activate("en");
createRoot(document.getElementById("root")!).render(
  <I18nProvider i18n={i18n}>
    <SessionProvider>
      <App />
    </SessionProvider>
  </I18nProvider>,
);
