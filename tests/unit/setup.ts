import { loadRepositoryArtifacts } from "../support/artifacts";
import { setStorageBackend } from "../../src/storage";
await loadRepositoryArtifacts();
// Tests stand in for the page's localStorage by defining the global.
setStorageBackend({
  getItem: (key) =>
    (globalThis as { localStorage?: Storage }).localStorage?.getItem(key) ??
    null,
  setItem: (key, value) => {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage) throw new Error("Browser storage is unavailable.");
    storage.setItem(key, value);
  },
});
