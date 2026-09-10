import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BUNDLE_FILES } from "./release";
import { MAX_BYTES } from "./content";

function gatewayBase(value: string, privateBuild: boolean) {
  const url = new URL(value);
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      "Gateway URL must not contain credentials, query, or fragment.",
    );
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw new Error("Use HTTPS or a loopback HTTP gateway.");
  if (privateBuild && !local)
    throw new Error(
      "Private builds may only be fetched through a local gateway.",
    );
  return url.toString().replace(/\/$/, "");
}

export async function fetchLimited(url: string, limit: number) {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok || !response.body)
    throw new Error("Gateway download failed.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error("Gateway response exceeds size limit.");
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    await reader.cancel();
  }
}

export async function downloadCid(
  cid: string,
  gateway: string,
  privateBuild: boolean,
  stage: string,
) {
  if (!/^bafy[a-z2-7]{55}$/.test(cid))
    throw new Error("Expected a canonical CIDv1 dag-pb SHA-256 release CID.");
  const base = gatewayBase(gateway, privateBuild);
  for (const name of BUNDLE_FILES) {
    const limit = name === "application.json" ? MAX_BYTES : 1024 * 1024;
    const bytes = await fetchLimited(
      `${base}/ipfs/${cid}/proof/${name}`,
      limit,
    );
    await writeFile(join(stage, name), bytes);
  }
}
