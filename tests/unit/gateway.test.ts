import { test, expect } from "bun:test";
import { fetchLimited, downloadCid } from "../../cli/gateway";
import { releaseDag } from "../../cli/release";

test("gateway requests reject oversized responses, redirects, and private remote gateways", async () => {
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      return new URL(request.url).pathname === "/redirect"
        ? Response.redirect("https://example.invalid/", 302)
        : new Response("123456");
    },
  });
  try {
    expect((await fetchLimited(server.url.toString(), 6)).toString()).toBe(
      "123456",
    );
    await expect(fetchLimited(server.url.toString(), 5)).rejects.toThrow(
      "size limit",
    );
    await expect(
      fetchLimited(new URL("/redirect", server.url).toString(), 100),
    ).rejects.toThrow();
    const cid = "bafybeibe2waprfugsrxdmni5z677evunugyi5xqj3yhiq6umexb65piom4";
    await expect(
      downloadCid(cid, "https://example.invalid", true, "/unused"),
    ).rejects.toThrow("local gateway");
    await expect(
      downloadCid("../escape", server.url.toString(), true, "/unused"),
    ).rejects.toThrow("canonical CID");
    await expect(
      downloadCid(cid, "http://example.invalid", false, "/unused"),
    ).rejects.toThrow("HTTPS");
  } finally {
    server.stop(true);
  }
});

test("outer release CID binds both the unchanged site and detached proof", async () => {
  const site = new Map([["index.html", Buffer.from("<html>FreeLP</html>")]]);
  const bundle = {
    "descriptor.json": Buffer.from("{}"),
    "application.json": Buffer.from("[]"),
    "provenance.json": Buffer.from("proof"),
  };
  const first = await releaseDag(site, bundle);
  expect((await releaseDag(site, bundle)).root.toString()).toBe(
    first.root.toString(),
  );
  expect(
    (
      await releaseDag(site, {
        ...bundle,
        "provenance.json": Buffer.from("changed"),
      })
    ).root.toString(),
  ).not.toBe(first.root.toString());
  expect(
    (
      await releaseDag(
        new Map([["index.html", Buffer.from("changed")]]),
        bundle,
      )
    ).root.toString(),
  ).not.toBe(first.root.toString());
});
