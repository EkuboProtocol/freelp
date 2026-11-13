// Files derived from the imported artifacts: artifacts/abi and digests.json.
// The app bundles only the ABIs it reads with and the digests of the full
// artifacts; deploying and checking a network's code fetch the full artifacts
// from the site, verified by digest.
import { readFile } from "node:fs/promises";
import { keccak256, toBytes } from "viem";

export const DEPLOYED_ARTIFACTS = [
  "Core",
  "PoolKeyIndex",
  "FreeLPMetadataRenderer",
  "FreeLP",
  "FreeLPDataFetcher",
] as const;
const READ_ABIS = ["FreeLP", "FreeLPDataFetcher", "PoolKeyIndex"] as const;

export async function artifactDerivatives(root = ".") {
  const files: Record<string, string> = {};
  const digests: Record<string, string> = {};
  for (const name of DEPLOYED_ARTIFACTS) {
    const text = await readFile(`${root}/artifacts/${name}.json`, "utf8");
    digests[name] = keccak256(toBytes(text));
    if ((READ_ABIS as readonly string[]).includes(name))
      files[`artifacts/abi/${name}.json`] =
        JSON.stringify(JSON.parse(text).abi) + "\n";
  }
  files["artifacts/digests.json"] = JSON.stringify(digests, null, 2) + "\n";
  return files;
}
