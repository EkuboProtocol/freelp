import { contentDag } from "./content";

export const BUNDLE_FILES = [
  "descriptor.json",
  "application.json",
  "provenance.json",
] as const;
export type BundleBytes = Record<(typeof BUNDLE_FILES)[number], Uint8Array>;

/** Proof is outside the authenticated site, avoiding a circular CID/signature dependency. */
export function releaseDag(site: Map<string, Uint8Array>, bundle: BundleBytes) {
  const files = new Map<string, Uint8Array>();
  for (const [path, bytes] of site) files.set("site/" + path, bytes);
  for (const name of BUNDLE_FILES) files.set("proof/" + name, bundle[name]);
  return contentDag(files);
}
