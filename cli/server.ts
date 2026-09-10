import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { extname } from "node:path";
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
export async function serve(
  files: Map<string, Uint8Array>,
  port = 4173,
  open = true,
) {
  const server = createServer((request, response) => {
    if (request.headers.host !== `127.0.0.1:${port}`) {
      response.writeHead(403).end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    const path = (request.url ?? "/").split("?")[0];
    const key = path === "/" ? "index.html" : path.slice(1);
    const bytes = files.get(key);
    if (!bytes) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": TYPES[extname(key)] ?? "application/octet-stream",
      "Content-Length": bytes.length,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src http: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    });
    response.end(request.method === "HEAD" ? undefined : bytes);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const url = `http://127.0.0.1:${port}/`;
  console.log(`FreeLP: ${url}\nPress Ctrl+C to stop this local server.`);
  if (open) {
    const command =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "rundll32"
          : "xdg-open";
    const args =
      process.platform === "win32"
        ? ["url.dll,FileProtocolHandler", url]
        : [url];
    execFile(command, args, (error) => {
      if (error) console.error(`Open ${url} in your browser.`);
    });
  }
  return server;
}
