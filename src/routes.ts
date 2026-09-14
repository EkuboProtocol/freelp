import { chainDefinition } from "./chains";

export type DeployRoute =
  { kind: "active" } | { kind: "chain"; chainId: number } | { kind: "invalid" };

export function deployPath(chainId: number) {
  return `#/deploy/${chainId}`;
}

/** `#/deploy` targets the active network; `#/deploy/:chainId` a catalog chain. */
export function parseDeployRoute(route: string): DeployRoute | undefined {
  const path = route.split("?")[0];
  if (path === "#/deploy" || path === "#/deploy/") return { kind: "active" };
  const match = /^#\/deploy\/(\d{1,15})$/.exec(path);
  if (!path.startsWith("#/deploy/")) return undefined;
  if (!match) return { kind: "invalid" };
  const chainId = Number(match[1]);
  try {
    chainDefinition(chainId);
    return { kind: "chain", chainId };
  } catch {
    return { kind: "invalid" };
  }
}
