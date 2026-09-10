import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { zeroAddress } from "viem";
import { useSession } from "./session";
import { FetcherDeployments } from "./FetcherDeployments";
import { deployment, verifyCode } from "./contracts";
import { Action } from "./common";
export function DeployPage() {
  const { settings, configure, send, setStatus } = useSession();
  async function deployCore() {
    const receipt = await send({ data: deployment("Core", zeroAddress) });
    if (!receipt.contractAddress)
      throw new Error(t`Deployment receipt has no address.`);
    configure({
      ...settings,
      core: receipt.contractAddress,
      manager: zeroAddress,
      quoteDataFetcher: zeroAddress,
      coreDataFetcher: zeroAddress,
    });
    await verifyCode(settings, receipt.contractAddress, "Core");
    setStatus(t`Core deployed and verified: ${receipt.contractAddress}`);
  }
  async function deployManager() {
    await verifyCode(settings, settings.core, "Core");
    const receipt = await send({ data: deployment("FreeLP", settings.core) });
    if (!receipt.contractAddress)
      throw new Error(t`Deployment receipt has no address.`);
    configure({ ...settings, manager: receipt.contractAddress });
    await verifyCode(settings, receipt.contractAddress, "FreeLP");
    setStatus(
      t`Position manager deployed and verified: ${receipt.contractAddress}`,
    );
  }
  return (
    <section>
      <h2>
        <Trans>Deploy contracts</Trans>
      </h2>
      <p>
        <Trans>
          Deploy an ownerless position manager against an existing compatible
          Core, or deploy a fresh Core first. A fresh Core has separate pools
          and liquidity. You pay network gas.
        </Trans>
      </p>
      <div className="panel">
        <h3>
          <Trans>1. Core</Trans>
        </h3>
        <p className="mono">{settings.core}</p>
        <p>
          <Trans>
            Set an existing Core in Settings, or deploy one here. This step
            creates a new independent Core.
          </Trans>
        </p>
        <Action run={deployCore}>
          <Trans>Review and deploy new Core</Trans>
        </Action>
      </div>
      <div className="panel">
        <h3>
          <Trans>2. Position manager</Trans>
        </h3>
        <p>
          <Trans>Constructor Core address:</Trans> <code>{settings.core}</code>
        </p>
        <p>
          <Trans>
            There is no owner, upgrade key, or manager fee. All position
            information and NFT metadata are on-chain.
          </Trans>
        </p>
        <Action disabled={settings.core === zeroAddress} run={deployManager}>
          <Trans>Review and deploy position manager</Trans>
        </Action>
      </div>
      <FetcherDeployments />
    </section>
  );
}
