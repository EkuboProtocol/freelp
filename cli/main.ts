#!/usr/bin/env bun
import { readdir, readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { serve } from "./server";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4173" },
    "no-browser": { type: "boolean" },
    help: { type: "boolean" },
  },
  strict: true,
});
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
if (values.help)
  console.log(
    "bunx @ekubo/freelp [--port 4173] [--no-browser]\nServes the app bundled in the installed package on localhost. No GitHub access or binary download is required.",
  );
else {
  try {
    const port = Number(values.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new Error("Port must be 1024–65535.");
    const files = await collect(join(import.meta.dir, "../dist"));
    const server = await serve(files, port, !values["no-browser"]);
    process.on("SIGINT", () => server.close(() => process.exit(0)));
    process.on("SIGTERM", () => server.close(() => process.exit(0)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
