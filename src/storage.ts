const memory = new Map<string, unknown>();
const memoryOnly = new Set<string>();
let warning = "";
type StorageWarningListener = (message: string) => void;
const listeners = new Set<StorageWarningListener>();

function report(message: string) {
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
  // A failed write supersedes older persisted data for this session.
  if (memoryOnly.has(key)) return memory.get(key) as T;
  try {
    const value = localStorage.getItem(key);
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
    localStorage.setItem(key, JSON.stringify(value));
    memoryOnly.delete(key);
    if (!memoryOnly.size) report("");
  } catch {
    memoryOnly.add(key);
    report(
      "Browser storage is full or unavailable. Changes are active for this session only.",
    );
  }
}
