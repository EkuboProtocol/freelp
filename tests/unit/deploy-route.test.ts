import { expect, test } from "bun:test";
import { deployPath, parseDeployRoute } from "../../src/routes";

test("bare deploy routes target the active network", () => {
  expect(parseDeployRoute("#/deploy")).toEqual({ kind: "active" });
  expect(parseDeployRoute("#/deploy/")).toEqual({ kind: "active" });
  expect(parseDeployRoute("#/deploy?x=1")).toEqual({ kind: "active" });
});

test("chain-scoped deploy routes accept catalog chains only", () => {
  expect(parseDeployRoute(deployPath(8453))).toEqual({
    kind: "chain",
    chainId: 8453,
  });
  expect(parseDeployRoute("#/deploy/4663?ref=networks")).toEqual({
    kind: "chain",
    chainId: 4663,
  });
  for (const route of [
    "#/deploy/987654321987",
    "#/deploy/abc",
    "#/deploy/8453/extra",
    "#/deploy/-1",
    "#/deploy/0x2105",
    "#/deploy/1234567890123456",
  ])
    expect(parseDeployRoute(route)).toEqual({ kind: "invalid" });
});

test("other routes are not deploy routes", () => {
  expect(parseDeployRoute("#/networks")).toBeUndefined();
  expect(parseDeployRoute("#/deployments")).toBeUndefined();
  expect(parseDeployRoute("")).toBeUndefined();
});
