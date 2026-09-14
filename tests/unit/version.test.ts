import { expect, test } from "bun:test";
import { version } from "../../package.json";
import { APP_VERSION, CONTRACTS_SOURCE } from "../../src/version";

test("the displayed version follows the package manifest", () => {
  expect(APP_VERSION).toBe(version);
  expect(CONTRACTS_SOURCE.commit).toMatch(/^[0-9a-f]{40}$/);
});
