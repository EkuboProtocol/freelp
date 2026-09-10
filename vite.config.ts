import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { lingui } from "@lingui/vite-plugin";
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    babel({ plugins: ["@lingui/babel-plugin-lingui-macro"] }),
    lingui(),
  ],
  build: { sourcemap: false },
});
