import { t } from "@lingui/core/macro";
import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { getAddress } from "viem";
import { useSession, rpc } from "./session";
import { validateSettings } from "./config";
import { verifyCode } from "./contracts";
import { Field } from "./common";
import type { Settings } from "./types";
export function SettingsPage() {
  const { settings, configure, setStatus } = useSession();
  const [draft, setDraft] = useState(settings);
  const [importText, setImport] = useState("");
  const update = (key: keyof Settings, value: string | number) =>
    setDraft({ ...draft, [key]: value });
  async function test() {
    try {
      validateSettings(draft);
      const chain = await rpc(draft).getChainId();
      if (chain !== draft.chainId)
        throw new Error(t`RPC reports chain ${chain}.`);
      setStatus(t`Connected to chain ${chain}.`);
    } catch (e) {
      setStatus(String(e));
    }
  }
  async function save() {
    try {
      const value = validateSettings({
        ...draft,
        core: getAddress(draft.core),
        manager: getAddress(draft.manager),
      });
      configure(value);
      setStatus(t`Settings saved.`);
    } catch (e) {
      setStatus(String(e));
    }
  }
  async function verify() {
    try {
      await verifyCode(draft, draft.core, "Core");
      await verifyCode(draft, draft.manager, "FreeLP");
      setStatus(
        t`Core and position manager match the bundled contract artifacts.`,
      );
    } catch (e) {
      setStatus(String(e));
    }
  }
  function exportConfig() {
    const url = new URL(draft.rpcUrl);
    if (url.username || url.password || url.search || url.pathname !== "/") {
      setStatus(
        t`RPC URLs can contain credentials. Copy a configuration with a public RPC URL for sharing.`,
      );
      return;
    }
    setImport(JSON.stringify(draft, null, 2));
  }
  function importConfig() {
    try {
      const parsed = JSON.parse(importText) as Settings;
      const next = validateSettings({
        rpcUrl: parsed.rpcUrl,
        chainId: parsed.chainId,
        core: parsed.core,
        manager: parsed.manager,
        nativeSymbol: parsed.nativeSymbol,
      });
      setDraft(next);
    } catch (e) {
      setStatus(String(e));
    }
  }
  return (
    <section>
      <h2>
        <Trans>Connection settings</Trans>
      </h2>
      <p>
        <Trans>
          Use a public RPC or your own node. No API key is required. Settings
          stay in this browser.
        </Trans>
      </p>
      <div className="grid">
        <Field label={<Trans>RPC URL</Trans>}>
          <input
            value={draft.rpcUrl}
            onChange={(e) => update("rpcUrl", e.target.value)}
          />
        </Field>
        <Field label={<Trans>Chain ID</Trans>}>
          <input
            type="number"
            value={draft.chainId}
            onChange={(e) => update("chainId", Number(e.target.value))}
          />
        </Field>
        <Field label={<Trans>Core address</Trans>}>
          <input
            value={draft.core}
            onChange={(e) => update("core", e.target.value)}
          />
        </Field>
        <Field label={<Trans>Position manager address</Trans>}>
          <input
            value={draft.manager}
            onChange={(e) => update("manager", e.target.value)}
          />
        </Field>
        <Field label={<Trans>Native token symbol</Trans>}>
          <input
            value={draft.nativeSymbol}
            onChange={(e) => update("nativeSymbol", e.target.value)}
          />
        </Field>
      </div>
      <p className="row">
        <button onClick={() => void test()}>
          <Trans>Test RPC</Trans>
        </button>
        <button onClick={() => void save()}>
          <Trans>Save settings</Trans>
        </button>
        <button onClick={() => void verify()}>
          <Trans>Verify contracts</Trans>
        </button>
      </p>
      <h3>
        <Trans>Configuration file</Trans>
      </h3>
      <textarea
        aria-label={t`Configuration JSON`}
        rows={6}
        style={{ width: "100%" }}
        value={importText}
        onChange={(e) => setImport(e.target.value)}
      />
      <p className="row">
        <button onClick={exportConfig}>
          <Trans>Export settings</Trans>
        </button>
        <button onClick={importConfig}>
          <Trans>Import settings</Trans>
        </button>
      </p>
    </section>
  );
}
