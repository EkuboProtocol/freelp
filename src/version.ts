import source from "../artifacts/source.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };

// Vite injects the package version at build time; tests and dev fall back to
// the manifest so the two can never disagree.
export const APP_VERSION =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : pkg.version;
export const REPOSITORY_URL = "https://github.com/EkuboProtocol/freelp";
export const CONTRACTS_SOURCE = source;
