// FreeLP's data module: every resource and mutation app.contract names.
// Reads go to the configured RPC endpoints; wallets, browser storage and the
// app's own files are reached through the page module (src/page.ts).
import type { Answer, Sources } from "./app.contract.d.ts";
import { attach } from "./src/page";
import * as shell from "./src/sources/shell";
import * as tx from "./src/sources/tx";
import * as positions from "./src/sources/positions";

// Reads go to whichever RPC the person configures, and to a local node.
export const grants = "net.fetch https:\nnet.fetch http:";

const sources: Sources = {
  loadSession: () => shell.session(),
  txState: async () => tx.txState(),
  connectWallet: ([uuid]) => shell.connectWallet(uuid),
  disconnectWallet: () => shell.disconnectWallet(),
  dismissNotice: () => shell.dismissNotice(),
  networkCatalog: () => shell.networkCatalog(),
  enableNetwork: ([id]) => shell.enableNetwork(id),
  disableNetwork: ([id]) => shell.disableNetwork(id),
  restoreNetworks: () => shell.restoreNetworks(),
  saveRpc: ([id, url]) => shell.saveRpc(id, url),
  positionNetworks: () => positions.positionNetworks(),
  chainPositions: ([id, revision, tick]) =>
    positions.chainPositions(id, revision, tick),
  positionDetail: ([chain, id, revision, tick]) =>
    positions.positionDetail(chain, id, revision, tick),
  withdrawReview: ([chain, id, revision, tick, portion, recipient]) =>
    positions.withdrawReview(chain, id, revision, tick, portion, recipient),
  depositView: ([chain, id, revision, tick, side, value, slippage]) =>
    positions.depositView(chain, id, revision, tick, side, value, slippage),
  positionBalance: ([chain, address, revision, tick]) =>
    positions.positionBalance(chain, address, revision, tick),
  withdrawPosition: ([chain, id, revision, tick, portion, recipient]) =>
    positions.withdrawPosition(chain, id, revision, tick, portion, recipient),
  collectFees: ([chain, id, revision, tick]) =>
    positions.collectFees(chain, id, revision, tick),
  addLiquidity: ([chain, id, revision, tick, side, value, slippage]) =>
    positions.addLiquidity(chain, id, revision, tick, side, value, slippage),
  approvePositionToken: ([chain, id, revision, tick, index, amount]) =>
    positions.approvePositionToken(chain, id, revision, tick, index, amount),
  positionNativeMax: ([
    chain,
    id,
    revision,
    tick,
    side,
    value,
    slippage,
    index,
  ]) =>
    positions.positionNativeMax(
      chain,
      id,
      revision,
      tick,
      side,
      value,
      slippage,
      index,
    ),
};

export const answer: Answer = (source, args, store, storage, native) => {
  attach(native);
  return sources[source](args, store, storage, native);
};
