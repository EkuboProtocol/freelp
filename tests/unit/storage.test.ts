import { expect, test } from "bun:test";
import { load, save, storageWarning } from "../../src/storage";

test("storage keeps the latest value in memory when a write exceeds quota", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    },
  });
  try {
    save("test:storage-quota", { enabled: true });
    expect(load("test:storage-quota", { enabled: false })).toEqual({
      enabled: true,
    });
    expect(storageWarning()).toContain("session only");
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("load observes a value changed outside the in-memory cache", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let value = JSON.stringify({ version: 1 });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => value,
      setItem: (_key: string, next: string) => (value = next),
    },
  });
  try {
    expect(
      load<{ version: number } | null>("test:storage-external", null),
    ).toEqual({ version: 1 });
    value = JSON.stringify({ version: 2 });
    expect(
      load<{ version: number } | null>("test:storage-external", null),
    ).toEqual({ version: 2 });
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
test("a quota failure must not resurrect older persisted settings", () => {
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => JSON.stringify({ enabled: false }),
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    },
  });
  try {
    save("freelp:test-existing-quota", { enabled: true });
    expect(load("freelp:test-existing-quota", { enabled: false })).toEqual({
      enabled: true,
    });
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: previous,
    });
  }
});
