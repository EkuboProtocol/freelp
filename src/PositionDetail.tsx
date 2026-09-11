import { useRef, useState } from "react";
import { PoolIdentity } from "./PoolIdentity";
import { formatUnits } from "viem";
import { PositionDepositFields } from "./PositionDepositFields";
import { PositionRange, PositionStatus } from "./PositionRange";
import { useSession } from "./session";
import { networkName } from "./networks";
import { Action, Field } from "./common";
import { usePositionActions } from "./usePositionActions";
import type { Position } from "./types";
import type { Token } from "./contracts";

export function PositionDetail({ position: p }: { position: Position }) {
  const { settings, busy } = useSession();
  const actions = usePositionActions(p);
  const { tokens } = actions;
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  function open(next: typeof mode) {
    setMode(next);
    dialog.current?.showModal();
  }
  async function add() {
    await actions.add();
    dialog.current?.close();
  }
  async function withdraw() {
    await actions.withdraw(false);
    dialog.current?.close();
  }
  return (
    <div className="position-detail">
      <div className="position-heading row spread">
        <div>
          <h2>
            {tokens
              ? `${tokens[0].symbol} / ${tokens[1].symbol}`
              : "Manage position"}
          </h2>
          <p className="muted">
            {networkName(settings.chainId, settings.name)} · Position #
            {p.id.toString()}
          </p>
          <div className="row">
            <PositionStatus position={p} />
            <PoolIdentity descriptor={p.descriptor} />
          </div>
        </div>
        <div className="row position-actions">
          <button
            onClick={() => open("add")}
            aria-label="Add liquidity to position"
          >
            Add liquidity
          </button>
          <button onClick={() => open("withdraw")}>Withdraw</button>
        </div>
      </div>
      <div className="position-summary-grid">
        <section className="position-summary">
          <h3>Liquidity</h3>
          <PositionAmounts position={p} tokens={tokens} fees={false} />
        </section>
        <section className="position-summary">
          <div className="row spread">
            <h3>Uncollected fees</h3>
            <Action
              run={() => actions.withdraw(true)}
              disabled={p.amounts.fees0 === 0n && p.amounts.fees1 === 0n}
            >
              Collect fees
            </Action>
          </div>
          <PositionAmounts position={p} tokens={tokens} fees />
        </section>
      </div>
      <section className="position-summary">
        <h3>Price range</h3>
        {tokens ? (
          <PositionRange
            position={p}
            decimals={[tokens[0].decimals, tokens[1].decimals]}
            symbols={[tokens[0].symbol, tokens[1].symbol]}
          />
        ) : null}
      </section>
      <dialog
        ref={dialog}
        className="position-dialog"
        aria-labelledby="position-dialog-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="row spread">
          <h2 id="position-dialog-title">
            {mode === "add" ? "Add liquidity" : "Withdraw liquidity"}
          </h2>
          <button
            aria-label="Close position dialog"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        {mode === "add" ? (
          <PositionDepositFields
            batchSupported={actions.batchSupported}
            position={p}
            tokens={tokens}
            deposit={actions.deposit}
            add={add}
          />
        ) : (
          <WithdrawalFields
            position={p}
            actions={actions}
            withdraw={withdraw}
          />
        )}
        <details className="transaction-settings">
          <summary>Advanced</summary>
          {mode === "withdraw" ? (
            <Field label="Recipient address">
              <input
                value={actions.recipient}
                onChange={(e) => actions.setRecipient(e.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Slippage (basis points)">
            <input
              type="number"
              min={0}
              max={1000}
              value={actions.slippage}
              onChange={(e) => actions.setSlippage(Number(e.target.value))}
            />
          </Field>
        </details>
      </dialog>
    </div>
  );
}

function PositionAmounts({
  position: p,
  tokens,
  fees,
}: {
  position: Position;
  tokens?: [Token, Token];
  fees: boolean;
}) {
  if (!tokens) return null;
  const values = fees
    ? [p.amounts.fees0, p.amounts.fees1]
    : [p.amounts.principal0, p.amounts.principal1];
  return (
    <dl className="position-amounts">
      {tokens.map((t, i) => (
        <div key={t.address}>
          <dt>
            {t.symbol}
            {t.metadataMissing ? (
              <small>Raw units · decimals unavailable</small>
            ) : null}
          </dt>
          <dd title={formatUnits(values[i], t.decimals)}>
            {Number(formatUnits(values[i], t.decimals)).toLocaleString(
              "en-US",
              { maximumSignificantDigits: 6 },
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function WithdrawalFields({
  position: p,
  actions,
  withdraw,
}: {
  position: Position;
  actions: ReturnType<typeof usePositionActions>;
  withdraw: () => Promise<void>;
}) {
  const fraction = BigInt(
    Math.max(0, Math.min(100, Math.trunc(actions.portion || 0))),
  );
  return (
    <div className="withdrawal-fields">
      <Field label="Withdraw percentage">
        <div className="withdraw-percentage">
          <input
            type="number"
            min={1}
            max={100}
            value={actions.portion}
            onChange={(e) => actions.setPortion(Number(e.target.value))}
          />
          <span>%</span>
        </div>
      </Field>
      <input
        type="range"
        aria-label="Withdrawal portion"
        min={1}
        max={100}
        value={actions.portion}
        onChange={(e) => actions.setPortion(Number(e.target.value))}
      />
      <div className="withdraw-presets">
        {[25, 50, 75, 100].map((value) => (
          <button
            key={value}
            aria-pressed={actions.portion === value}
            onClick={() => actions.setPortion(value)}
          >
            {value}%
          </button>
        ))}
      </div>
      <p className="muted">Includes all uncollected fees.</p>
      <PositionAmounts
        position={{
          ...p,
          amounts: {
            ...p.amounts,
            principal0:
              (p.amounts.principal0 * fraction) / 100n + p.amounts.fees0,
            principal1:
              (p.amounts.principal1 * fraction) / 100n + p.amounts.fees1,
          },
        }}
        tokens={actions.tokens}
        fees={false}
      />
      <Action run={withdraw}>Withdraw liquidity and fees</Action>
    </div>
  );
}
