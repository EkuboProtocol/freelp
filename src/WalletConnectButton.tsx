import { useRef } from "react";
import { useSession } from "./session";
import { errorMessage } from "./errors";
import type { Wallet } from "./types";

export function WalletConnectButton() {
  const session = useSession();
  const dialog = useRef<HTMLDialogElement>(null);
  async function connect(wallet: Wallet) {
    try {
      await session.connect(wallet);
      dialog.current?.close();
    } catch (error) {
      session.setStatus(errorMessage(error));
    }
  }
  return (
    <>
      <button
        className="primary-button empty-connect"
        onClick={() => {
          if (session.wallets.length === 1) void connect(session.wallets[0]);
          else dialog.current?.showModal();
        }}
      >
        Connect wallet
      </button>
      <dialog
        ref={dialog}
        className="wallet-dialog"
        aria-labelledby="wallet-dialog-title"
      >
        <div className="row spread">
          <h2 id="wallet-dialog-title">Connect wallet</h2>
          <button
            aria-label="Close wallet dialog"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="wallet-options">
          {session.wallets.map((wallet) => (
            <button key={wallet.info.uuid} onClick={() => void connect(wallet)}>
              Connect {wallet.info.name}
            </button>
          ))}
        </div>
        {!session.wallets.length ? (
          <p>
            Open this app in your wallet’s browser or enable a browser wallet to
            connect.
          </p>
        ) : null}
      </dialog>
    </>
  );
}
