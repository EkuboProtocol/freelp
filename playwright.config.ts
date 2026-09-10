import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 120000,
  use: { baseURL: "http://127.0.0.1:14173", headless: true },
  webServer: {
    command: "bun run preview --port 14173",
    url: "http://127.0.0.1:14173",
    reuseExistingServer: false,
  },
});
