import { expect, test } from "bun:test";
import catalog from "../../src/chainCatalog.json" with { type: "json" };
import { chainCatalog } from "../../scripts/chain-catalog";

test("the bundled chain catalog matches the installed viem chains", () => {
  // Regenerate with `bun scripts/chain-catalog.ts` after updating viem.
  expect(catalog).toEqual(JSON.parse(JSON.stringify(chainCatalog())));
});
