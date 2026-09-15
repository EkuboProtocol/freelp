import { expect, test } from "bun:test";
import { extractEntry } from "../../scripts/extract-release-notes";

const notes = `FreeLP 0.1.20 links the hosted site and trims the docs.

Body text here.

Run \`bunx @ekubo/freelp@latest\` or \`npx @ekubo/freelp@latest\`.

FreeLP 0.1.19 gives the position NFT a readable column on the position page.

Older body.
`;

test("extracts only the requested entry, keeping its run command", () => {
  const entry = extractEntry(notes, "v0.1.20");
  expect(entry).toContain("links the hosted site");
  expect(entry).toContain("Run `bunx @ekubo/freelp@latest`");
  expect(entry).not.toContain("0.1.19");
});

test("accepts a bare version and rejects unknown ones", () => {
  expect(extractEntry(notes, "0.1.19")).toContain("readable column");
  expect(() => extractEntry(notes, "9.9.9")).toThrow("No entry");
  expect(() => extractEntry(notes, "nope")).toThrow("Invalid version");
});
