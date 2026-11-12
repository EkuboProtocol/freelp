import { defineConfig } from "vite";
// Vite only serves the built site for the browser tests (`bun run preview`).
export default defineConfig({ base: "./" });
