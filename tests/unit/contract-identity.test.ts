import { expect, test } from "bun:test";
import { padHex, type Hex, type Address } from "viem";
import { expectedRuntime } from "../../src/contractDeployment";
import {
  assertContractRuntime,
  ContractIdentityError,
} from "../../src/contractIdentity";
import { DEFAULT_SETTINGS } from "../../src/config";
import manager from "../../artifacts/FreeLP.json";
import {
  DEFAULT_POOL_KEY_INDEX,
  DEFAULT_METADATA_RENDERER,
} from "../../src/deployments";

for (const kind of [
  "Core",
  "PoolKeyIndex",
  "FreeLPMetadataRenderer",
  "FreeLP",
  "FreeLPDataFetcher",
] as const) {
  test(`${kind} rejects occupied but incompatible addresses`, () => {
    expect(() =>
      assertContractRuntime(kind, DEFAULT_SETTINGS.core, "0x6000"),
    ).toThrow("incompatible code");
    expect(() =>
      assertContractRuntime(kind, DEFAULT_SETTINGS.core, "0x"),
    ).toThrow(ContractIdentityError);
    const code = expectedRuntime(kind, DEFAULT_SETTINGS.core);
    expect(() =>
      assertContractRuntime(kind, DEFAULT_SETTINGS.core, code),
    ).not.toThrow();
    const tampered = `${code.slice(0, 10)}ff${code.slice(12)}` as Hex;
    expect(() =>
      assertContractRuntime(kind, DEFAULT_SETTINGS.core, tampered),
    ).toThrow();
  });
}

test("manager immutables are bound to their exact protocol addresses", () => {
  const core = DEFAULT_SETTINGS.core;
  const expected = expectedRuntime("FreeLP", core);
  for (const [id, slots] of Object.entries(manager.immutableReferences)) {
    const binding =
      manager.immutableBindings[id as keyof typeof manager.immutableBindings];
    const addresses: Record<string, Address> = {
      core,
      poolKeyIndex: DEFAULT_POOL_KEY_INDEX,
      metadataRenderer: DEFAULT_METADATA_RENDERER,
    };
    const address = addresses[binding]!;
    for (const { start, length } of slots) {
      expect(expected.slice(2 + start * 2, 2 + (start + length) * 2)).toBe(
        padHex(address, { size: 32 }).slice(2).toLowerCase(),
      );
      const offset = 2 + start * 2;
      const wrong =
        expected.slice(0, offset) +
        "0".repeat(64) +
        expected.slice(offset + 64);
      expect(() =>
        assertContractRuntime("FreeLP", core, wrong as Hex),
      ).toThrow();
    }
  }
});
