import { readFile } from "node:fs/promises";
import { loadArtifacts, setArtifactFetch } from "../../src/contractDeployment";

// The site serves the full contract artifacts; tests read them from the
// repository with the same digest check.
export function loadRepositoryArtifacts() {
  setArtifactFetch((path) => readFile(path, "utf8"));
  return loadArtifacts();
}
