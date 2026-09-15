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
import { withdrawalReview } from "./positionReview";
import { isAddress, type Address } from "viem";
import { displayAmount } from "./displayAmount";
import { PositionArtwork } from "./PositionArtwork";

/**
 * Stale data never disables actions: amounts are estimates and the contract
 * enforces the real state. Read-only views only prevent signing.
 */
export function PositionDetail({
  position: p,
  onRefresh,
  owner,
  readOnly = false,
}: {
  position: Position;
  onRefresh?: () => void | Promise<void>;
  owner?: Address;
  readOnly?: boolean;
}) {
  const { settings, account, busy, status, setStatus } = useSession();
  const controlsDisabled = busy || readOnly;
  const actions = usePositionActions(p, owner);
  const { tokens } = actions;
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  function open(next: typeof mode) {
    if (controlsDisabled) return;
    actions.setRecipient(account ?? "");
    actions.setPortion(100);
    setStatus("");
    setMode(next);
    dialog.current?.showModal();
    // Balances only matter for deposits; nothing else is re-read on open.
    if (next === "add") actions.refreshTokens();
  }
  async function add() {
    await actions.add();
    dialog.current?.close();
    await onRefresh?.();
  }
  async function withdraw() {
    await actions.withdraw();
    dialog.current?.close();
    if (actions.portion === 100) window.location.hash = "#/positions";
    await onRefresh?.();
  }
  async function claim() {
    await actions.claim();
    await onRefresh?.();
  }
  return (
    <div className="position-detail">
      <div className="position-heading">
        <PositionArtwork metadata={p.metadata} positionId={p.id.toString()} />
        <div className="position-heading-text">
          <h2 tabIndex={-1}>
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
            disabled={controlsDisabled}
            aria-label="Add liquidity to position"
          >
            Add liquidity
          </button>
          <button disabled={controlsDisabled} onClick={() => open("withdraw")}>
            Withdraw
          </button>
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
            <Action run={claim} disabled={claimUnavailable(readOnly, p)}>
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
        <fieldset
          disabled={controlsDisabled}
          className="position-action-fields"
        >
          {mode === "add" ? (
            <PositionDepositFields
              batchSupported={actions.batchSupported}
              position={p}
              tokens={tokens}
              deposit={actions.deposit}
              add={add}
              slippage={actions.slippage}
              readiness={actions.readiness}
              refreshTokens={actions.refreshTokens}
              nativeCalls={actions.nativeCalls}
            />
          ) : (
            <WithdrawalFields
              position={p}
              actions={actions}
              withdraw={withdraw}
            />
          )}
        </fieldset>
        <p className="status" role="status" aria-live="polite" aria-busy={busy}>
          {status}
        </p>
        {mode === "add" ? (
          <details className="transaction-settings">
            <summary>Advanced</summary>
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
        ) : null}
      </dialog>
    </div>
  );
}

function claimUnavailable(readOnly: boolean, position: Position) {
  return (
    readOnly || (position.amounts.fees0 === 0n && position.amounts.fees1 === 0n)
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
          <dd>
            <span
              title={
                t.metadataMissing
                  ? `${values[i].toString()} raw units`
                  : `${formatUnits(values[i], t.decimals)} ${t.symbol}`
              }
            >
              {displayAmount(values[i], t.decimals)}
            </span>
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
      <Field label="Recipient address">
        <input
          className="recipient-input"
          value={actions.recipient}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => actions.setRecipient(e.target.value)}
        />
      </Field>
      <WithdrawalReview position={p} actions={actions} withdraw={withdraw} />
    </div>
  );
}

function WithdrawalReview({
  position: p,
  actions,
  withdraw,
}: {
  position: Position;
  actions: ReturnType<typeof usePositionActions>;
  withdraw: () => Promise<void>;
}) {
  const { review, error } = getWithdrawalState(p, actions.portion);
  return (
    <>
      <p className="muted">
        Estimated amounts include all uncollected fees. Actual amounts may
        change before execution; withdrawals have no minimum-output limit.
      </p>
      <dl className="withdrawal-review">
        <ReviewRow
          label="Principal"
          values={review && [review.principal0, review.principal1]}
          tokens={actions.tokens}
        />
        <ReviewRow
          label="Fees"
          values={review && [review.fees0, review.fees1]}
          tokens={actions.tokens}
        />
        <ReviewRow
          label="Estimated receipt"
          values={review && [review.total0, review.total1]}
          tokens={actions.tokens}
        />
      </dl>
      <FullWithdrawalNotice review={review} />
      <ReviewError error={error} />
      {!isRecipient(actions.recipient) ? (
        <p className="muted">Enter a valid recipient address to withdraw.</p>
      ) : null}
      <Action run={withdraw} disabled={!canWithdraw(review, actions.recipient)}>
        Withdraw liquidity and fees
      </Action>
    </>
  );
}

function FullWithdrawalNotice({
  review,
}: {
  review?: ReturnType<typeof withdrawalReview>;
}) {
  return review?.full ? (
    <p className="muted">
      100% withdrawal burns the position NFT and closes this position.
    </p>
  ) : null;
}

function ReviewError({ error }: { error: string }) {
  return error ? (
    <p className="status" role="alert">
      {error}
    </p>
  ) : null;
}

function canWithdraw(
  review: ReturnType<typeof withdrawalReview> | undefined,
  recipient: string,
) {
  return Boolean(review && isRecipient(recipient));
}

function getWithdrawalState(position: Position, portion: number) {
  try {
    return {
      review: withdrawalReview(position.amounts, portion),
      error: "",
    };
  } catch (error) {
    return {
      review: undefined,
      error: error instanceof Error ? error.message : "Invalid withdrawal.",
    };
  }
}

function isRecipient(value: string) {
  return isAddress(value);
}

function ReviewRow({
  label,
  values,
  tokens,
}: {
  label: string;
  values?: [bigint, bigint];
  tokens?: [Token, Token];
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {tokens && values
          ? values.map((value, i) => (
              <span key={tokens[i].address}>
                {tokens[i].metadataMissing
                  ? value.toString()
                  : formatUnits(value, tokens[i].decimals)}{" "}
                {tokens[i].symbol}
                {tokens[i].metadataMissing ? " (raw units)" : ""}
              </span>
            ))
          : "Unavailable"}
      </dd>
    </div>
  );
}
