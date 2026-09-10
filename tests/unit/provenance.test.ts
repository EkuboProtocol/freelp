import { test, expect } from "bun:test";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import {
  contentDag,
  sha256,
  verifyApplication,
  decodeApplication,
  type ReleaseDescriptor,
} from "../../cli/content";
import {
  verifyPrivateProof,
  REPOSITORY,
  REPOSITORY_ID,
  OWNER_ID,
  WORKFLOW,
} from "../../cli/provenance";
import { serve } from "../../cli/server";
const bytes = Buffer.from(
  JSON.stringify([
    {
      path: "index.html",
      content: Buffer.from("<p>Verified</p>").toString("base64"),
    },
  ]),
);
async function fixture() {
  const map = decodeApplication(bytes);
  const { root } = await contentDag(map);
  const descriptor: ReleaseDescriptor = {
    schema: 1,
    repository: REPOSITORY,
    commit: "a".repeat(40),
    ref: "refs/heads/main",
    siteCid: root.toString(),
    applicationSha256: sha256(bytes),
    files: [
      {
        path: "index.html",
        sha256: sha256(map.get("index.html")!),
        size: map.get("index.html")!.length,
      },
    ],
  };
  return descriptor;
}
test("verifies bytes and CID, rejects modified files and manifest", async () => {
  const descriptor = await fixture();
  expect((await verifyApplication(bytes, descriptor)).size).toBe(1);
  await expect(
    verifyApplication(Buffer.from("[]"), descriptor),
  ).rejects.toThrow("digest");
  await expect(
    verifyApplication(bytes, { ...descriptor, siteCid: "wrong" }),
  ).rejects.toThrow("CID");
  await expect(
    verifyApplication(bytes, { ...descriptor, files: [] }),
  ).rejects.toThrow("Manifest");
});
test("rejects unsafe paths and duplicate file entries", () => {
  for (const path of ["../index.html", "/index.html", "a/../../x", "a\\b"])
    expect(() =>
      decodeApplication(Buffer.from(JSON.stringify([{ path, content: "" }]))),
    ).toThrow();
  expect(() =>
    decodeApplication(
      Buffer.from(
        JSON.stringify([
          { path: "index.html", content: "" },
          { path: "index.html", content: "" },
        ]),
      ),
    ),
  ).toThrow();
});
test("verifies signed GitHub identity bound to content, not a repo label", async () => {
  const descriptor = await fixture();
  const descriptorBytes = Buffer.from(JSON.stringify(descriptor));
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const key = { ...(await exportJWK(publicKey)), kid: "test", alg: "RS256" };
  const iat = Math.floor(Date.now() / 1000) - 1000;
  const claims = {
    repository: REPOSITORY,
    repository_id: REPOSITORY_ID,
    repository_owner_id: OWNER_ID,
    workflow_ref: `${WORKFLOW}@${descriptor.ref}`,
    workflow_sha: descriptor.commit,
    sha: descriptor.commit,
    ref: descriptor.ref,
    event_name: "push",
    repository_visibility: "private",
  };
  async function sign(overrides: Record<string, unknown> = {}) {
    return new SignJWT({ ...claims, ...overrides })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://token.actions.githubusercontent.com")
      .setAudience(`freelp:sha256:${sha256(descriptorBytes)}`)
      .setIssuedAt(iat)
      .setNotBefore(iat - 5)
      .setExpirationTime(iat + 300)
      .sign(privateKey);
  }
  const proof = { type: "github-oidc" as const, jwt: await sign() };
  expect(
    (await verifyPrivateProof(descriptorBytes, proof, { keys: [key] })).commit,
  ).toBe(descriptor.commit);
  for (const overrides of [
    { repository: "attacker/freelp" },
    { repository_id: "1" },
    {
      workflow_ref: `${REPOSITORY}/.github/workflows/evil.yml@${descriptor.ref}`,
    },
    { sha: "b".repeat(40) },
    { event_name: "pull_request" },
  ])
    await expect(
      verifyPrivateProof(
        descriptorBytes,
        { ...proof, jwt: await sign(overrides) },
        { keys: [key] },
      ),
    ).rejects.toThrow();
  await expect(
    verifyPrivateProof(
      Buffer.from(JSON.stringify({ ...descriptor, siteCid: "modified" })),
      proof,
      { keys: [key] },
    ),
  ).rejects.toThrow();
  await expect(verifyPrivateProof(descriptorBytes, proof)).rejects.toThrow();
});
test("loopback server serves only verified snapshot and rejects bad Host/methods", async () => {
  const files = decodeApplication(bytes);
  const server = await serve(files, 19417, false);
  try {
    const response = await fetch("http://127.0.0.1:19417/");
    expect(await response.text()).toBe("<p>Verified</p>");
    expect(
      (await fetch("http://127.0.0.1:19417/", { method: "POST" })).status,
    ).toBe(405);
    expect((await fetch("http://127.0.0.1:19417/.env")).status).toBe(404);
    expect(
      (
        await fetch("http://127.0.0.1:19417/", {
          headers: { Host: "attacker.example" },
        })
      ).status,
    ).toBe(403);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
