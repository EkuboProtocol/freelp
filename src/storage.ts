// Where preferences persist: the page's localStorage, reached through the
// backend the app installs (a data module has no DOM of its own).
export type StorageBackend = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};
let backend: StorageBackend | undefined;
export function setStorageBackend(next: StorageBackend) {
  backend = next;
}
function persisted(): StorageBackend {
  if (!backend) throw new Error("Browser storage is not connected.");
  return backend;
}
const memory = new Map<string, unknown>();
const memoryOnly = new Set<string>();
let warning = "";
type StorageWarningListener = (message: string) => void;
const listeners = new Set<StorageWarningListener>();

export function report(message: string) {
  if (warning === message) return;
  warning = message;
  queueMicrotask(() => {
    for (const listener of listeners) listener(warning);
  });
}

export function storageWarning() {
  return warning;
}

export function subscribeStorageWarnings(listener: StorageWarningListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function load<T>(key: string, fallback: T): T {
  if (memoryOnly.has(key)) return memory.get(key) as T;
  try {
    const value = persisted().getItem(key);
    if (!value) {
      memory.delete(key);
      return fallback;
    }
    const parsed = JSON.parse(value) as T;
    memory.set(key, parsed);
    return parsed;
  } catch {
    report(
      "Browser storage is unavailable. Changes will remain in memory until you reload.",
    );
    return (memory.has(key) ? memory.get(key) : fallback) as T;
  }
}
export function save(key: string, value: unknown) {
  memory.set(key, value);
  try {
    persisted().setItem(key, JSON.stringify(value));
    memoryOnly.delete(key);
    if (!memoryOnly.size) report("");
  } catch {
    memoryOnly.add(key);
    report(
      "Browser storage is full or unavailable. Changes are active for this session only.",
    );
  }
}
