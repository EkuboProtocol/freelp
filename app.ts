// FreeLP's data module: every resource and mutation app.contract names.
// Reads go to the configured RPC endpoints; wallets, browser storage and the
// app's own files are reached through the page module (src/page.ts).
import type { Answer, Sources } from "./app.contract.d.ts";
import { attach } from "./src/page";
import * as shell from "./src/sources/shell";
import * as tx from "./src/sources/tx";
import * as create from "./src/sources/create";

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
  createSetup: () => create.createSetup(),
  selectNetwork: ([chain]) => create.selectNetwork(chain),
  createTokens: ([chain]) => create.createTokens(chain),
  pickerBalances: ([chain, revision, refresh]) =>
    create.pickerBalances(chain, revision * 1000 + refresh),
  readToken: ([chain, address]) => create.readToken(chain, address),
  importToken: ([chain, address, symbol, name, decimals]) =>
    create.importToken(chain, address, symbol, name, decimals),
  createGate: ([chain]) => create.createGate(chain),
  createRegistry: ([chain, a, b, revision, retry, pages]) =>
    create.createRegistry(chain, a, b, revision, retry, pages),
  createSnap: ([route]) => create.createSnap(route),
  spacingCandidate: ([value, raw]) => create.spacingCandidate(value, raw),
  createPool: ([route, retry, zoom]) => create.createPool(route, retry, zoom),
  createRangeAt: ([route, retry, lower, upper, spacings]) =>
    create.createRangeAt(route, retry, lower, upper, spacings),
  createRangeMode: ([route, retry]) => create.createRangeMode(route, retry),
  createQuote: ([route, revision, retry]) =>
    create.createQuote(route, revision, retry),
  createBalance: ([chain, address, revision, retry]) =>
    create.createBalance(chain, address, revision * 1000 + retry),
  createMax: ([route, revision, retry, side]) =>
    create.createMax(route, revision, retry, side),
  createPosition: ([route, revision, retry, age]) =>
    create.createPosition(route, revision, retry, age),
  createApprove: ([route, revision, retry, side]) =>
    create.createApprove(route, revision, retry, side),
};

export const answer: Answer = (source, args, store, storage, native) => {
  attach(native);
  return sources[source](args, store, storage, native);
};
