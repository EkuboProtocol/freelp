#!/usr/bin/env node
import { readdir, readFile, lstat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { serve } from "./server";

export function parseLauncherArgs(args: string[] = process.argv.slice(2)) {
  return parseArgs({
    args,
    options: {
      port: { type: "string", default: "4173" },
      "no-browser": { type: "boolean" },
      help: { type: "boolean" },
    },
    strict: true,
  }).values;
}
async function collect(directory: string, prefix = "") {
  const files = new Map<string, Uint8Array>();
  for (const name of await readdir(directory)) {
    const path = join(directory, name),
      key = prefix + name;
    const stat = await lstat(path);
    if (stat.isSymbolicLink())
      throw new Error("Package assets must not contain symlinks.");
    if (stat.isDirectory()) {
      for (const [file, bytes] of await collect(path, key + "/"))
        files.set(file, bytes);
    } else if (stat.isFile()) files.set(key, await readFile(path));
  }
  return files;
}
export function validatePort(value: string) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Port must be an integer from 1024 to 65535.");
  return port;
}

export async function runLauncher(args?: string[]) {
  const values = parseLauncherArgs(args);
  if (values.help)
    return console.log(
      "bunx @ekubo/freelp@latest | npx @ekubo/freelp@latest [--port 4173] [--no-browser]\nServes the app bundled in the installed package on localhost. No GitHub access or binary download is required.",
    );
  try {
    const port = validatePort(values.port);
    const files = await collect(
      fileURLToPath(new URL("../dist/", import.meta.url)),
    );
    const server = await serve(files, port, !values["no-browser"]);
    process.on("SIGINT", () => server.close(() => process.exit(0)));
    process.on("SIGTERM", () => server.close(() => process.exit(0)));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EADDRINUSE"
    )
      throw new Error(
        `Port ${values.port} is already in use. Choose another port with --port; FreeLP will not change the origin automatically.`,
        { cause: error },
      );
    throw error;
  }
}

function isEntrypoint() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}
if (isEntrypoint())
  void runLauncher().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
