import { test, expect } from "bun:test";
import {
  contentDag,
  sha256,
  verifyApplication,
  decodeApplication,
  type ReleaseDescriptor,
} from "../../cli/content";
const REPOSITORY = "EkuboProtocol/freelp";
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
test("loopback server serves only its packaged snapshot and rejects bad Host/methods", async () => {
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
