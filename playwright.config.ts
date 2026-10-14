import { defineConfig } from "@playwright/test";

// The chain specs drive a local Anvil node on port 18545 and take most of the
// suite's time, so CI runs them in their own job beside the browser specs.
const chainSpecs = ["lifecycle.spec.ts", "deterministic.spec.ts"];

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 120000,
  use: { baseURL: "http://127.0.0.1:14173", headless: true },
  projects: [
    { name: "chain", testMatch: chainSpecs },
    { name: "browser", testIgnore: chainSpecs },
  ],
  webServer: {
    command: "bun run preview --port 14173",
    url: "http://127.0.0.1:14173",
    reuseExistingServer: false,
  },
});
