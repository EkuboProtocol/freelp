import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { zeroAddress } from "viem";
import { useSession } from "./session";
import { deployment, verifyCode } from "./contracts";
import { quoteFetcher } from "./poolData";
import { Action } from "./common";
const FETCHERS = [
  { kind: "QuoteDataFetcher", field: "quoteDataFetcher", usesCore: true },
  { kind: "CoreDataFetcher", field: "coreDataFetcher", usesCore: true },
  { kind: "TokenDataFetcher", field: "tokenDataFetcher", usesCore: false },
] as const;
function Fetcher({ entry }: { entry: (typeof FETCHERS)[number] }) {
  const { settings, configure, send, setStatus } = useSession();
  const address =
    entry.kind === "QuoteDataFetcher"
      ? quoteFetcher(settings)
      : (settings[entry.field] ?? zeroAddress);
  async function deploy() {
    if (entry.usesCore) await verifyCode(settings, settings.core, "Core");
    const receipt = await send({ data: deployment(entry.kind, settings.core) });
    if (!receipt.contractAddress)
      throw new Error(t`Deployment receipt has no address.`);
    configure({ ...settings, [entry.field]: receipt.contractAddress });
    await verifyCode(settings, receipt.contractAddress, entry.kind);
    setStatus(
      t`${entry.kind} deployed and verified: ${receipt.contractAddress}`,
    );
  }
  return (
    <article className="panel">
      <h3>{entry.kind}</h3>
      <p className="mono">{address}</p>
      {entry.usesCore ? (
        <p>
          <Trans>Constructor Core address:</Trans> <code>{settings.core}</code>
        </p>
      ) : (
        <p>
          <Trans>
            Standalone token balance and metadata reader. No Core constructor
            argument.
          </Trans>
        </p>
      )}
      <Action
        disabled={entry.usesCore && settings.core === zeroAddress}
        run={deploy}
      >
        <Trans>Deploy {entry.kind}</Trans>
      </Action>
    </article>
  );
}
export function FetcherDeployments() {
  return (
    <section>
      <h2>
        <Trans>Data fetchers</Trans>
      </h2>
      <p>
        <Trans>
          QuoteDataFetcher supplies current prices and initialized ticks for
          liquidity charts. Deploy it for a new Core, or use the canonical
          deployment. All fetchers below are bundled and deployable from this
          page.
        </Trans>
      </p>
      {FETCHERS.map((entry) => (
        <Fetcher key={entry.kind} entry={entry} />
      ))}
    </section>
  );
}
