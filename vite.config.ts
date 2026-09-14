import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };
export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  build: {
    sourcemap: false,
    cssCodeSplit: false,
    rolldownOptions: { output: { inlineDynamicImports: true } },
  },
});
