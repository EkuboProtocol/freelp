import {
  createLocalJWKSet,
  jwtVerify,
  decodeJwt,
  type JSONWebKeySet,
  type JWTPayload,
} from "jose";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sigstoreRoots from "./trust/sigstore-public.json" with { type: "json" };
import roots from "./trust/github-oidc-jwks.json" with { type: "json" };
import { sha256, type ReleaseDescriptor } from "./content";
export const REPOSITORY = "moodysalem/freelp";
export const REPOSITORY_ID = "1364764467";
export const OWNER_ID = "7897876";
export const WORKFLOW = `${REPOSITORY}/.github/workflows/deploy.yml`;
const exec = promisify(execFile);
export type PrivateProof = { type: "github-oidc"; jwt: string };
export async function verifyPrivateProof(
  descriptorBytes: Uint8Array,
  proof: PrivateProof,
  keys: JSONWebKeySet = roots,
) {
  const unsigned = decodeJwt(proof.jwt);
  if (typeof unsigned.iat !== "number" || unsigned.iat > Date.now() / 1000 + 60)
    throw new Error("Invalid issuance time.");
  // This is archived issuance evidence, not an authentication token used after expiration.
  // Verify signature and signed issuance interval using independently pinned issuer keys.
  const { payload } = await jwtVerify(proof.jwt, createLocalJWKSet(keys), {
    issuer: "https://token.actions.githubusercontent.com",
    audience: `freelp:sha256:${sha256(descriptorBytes)}`,
    algorithms: ["RS256"],
    currentDate: new Date(unsigned.iat * 1000),
  });
  const descriptor = JSON.parse(
    new TextDecoder().decode(descriptorBytes),
  ) as ReleaseDescriptor;
  assertIdentity(descriptor);
  validateClaims(payload, descriptor);
  validateInterval(payload, unsigned.iat);
  return descriptor;
}
function validateClaims(payload: JWTPayload, descriptor: ReleaseDescriptor) {
  if (
    payload.repository !== REPOSITORY ||
    payload.repository_id !== REPOSITORY_ID ||
    payload.repository_owner_id !== OWNER_ID
  )
    throw new Error("Wrong repository identity.");
  if (
    payload.workflow_ref !== `${WORKFLOW}@${descriptor.ref}` ||
    payload.sha !== descriptor.commit ||
    payload.workflow_sha !== descriptor.commit
  )
    throw new Error("Wrong workflow or source commit.");
  if (
    payload.ref !== descriptor.ref ||
    payload.event_name !== "push" ||
    payload.repository_visibility !== "private"
  )
    throw new Error("Unapproved private build event.");
}
function validateInterval(payload: JWTPayload, issuedAt: number) {
  if (
    typeof payload.exp !== "number" ||
    payload.exp - issuedAt > 3600 ||
    payload.exp <= issuedAt
  )
    throw new Error("Invalid issuance interval.");
}
export function assertIdentity(descriptor: ReleaseDescriptor) {
  if (
    descriptor.schema !== 1 ||
    descriptor.repository !== REPOSITORY ||
    !/^[a-f0-9]{40}$/.test(descriptor.commit)
  )
    throw new Error("Invalid release identity.");
  if (
    descriptor.ref !== "refs/heads/main" &&
    !/^refs\/tags\/v\d+\.\d+\.\d+$/.test(descriptor.ref)
  )
    throw new Error("Unapproved build ref.");
}
export async function verifyPublicProof(
  descriptorPath: string,
  bundlePath: string,
) {
  const descriptor = JSON.parse(
    await readFile(descriptorPath, "utf8"),
  ) as ReleaseDescriptor;
  assertIdentity(descriptor);
  const temp = await mkdtemp(join(tmpdir(), "freelp-trust-"));
  const trustedRootPath = join(temp, "roots.json");
  await writeFile(trustedRootPath, JSON.stringify(sigstoreRoots));
  try {
    await exec(
      "gh",
      [
        "attestation",
        "verify",
        descriptorPath,
        "--repo",
        REPOSITORY,
        "--signer-workflow",
        WORKFLOW,
        "--source-digest",
        descriptor.commit,
        "--source-ref",
        descriptor.ref,
        "--bundle",
        bundlePath,
        "--custom-trusted-root",
        trustedRootPath,
      ],
      { maxBuffer: 4 * 1024 * 1024 },
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  return descriptor;
}
