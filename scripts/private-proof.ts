import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../cli/content";
import { verifyPrivateProof } from "../cli/provenance";
const bytes = await readFile("release/descriptor.json");
const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if (!requestUrl || !requestToken)
  throw new Error("GitHub Actions OIDC environment required.");
const url = new URL(requestUrl);
url.searchParams.set("audience", `freelp:sha256:${sha256(bytes)}`);
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${requestToken}` },
});
if (!response.ok) throw new Error(`OIDC request failed: ${response.status}`);
const data = (await response.json()) as { value: string };
const proof = { type: "github-oidc" as const, jwt: data.value };
await verifyPrivateProof(bytes, proof);
await writeFile("release/provenance.json", JSON.stringify(proof));
console.log("Verified private GitHub CI identity bound to release descriptor.");
