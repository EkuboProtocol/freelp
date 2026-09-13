import type { Token } from "./contracts";
import { TokenBalance } from "./TokenBalance";
import { ApprovalButton } from "./ApprovalButton";
import { Action, ErrorText } from "./common";
import type { Position, Transaction } from "./types";
import type { usePositionDeposit } from "./usePositionDeposit";
import { parseAmount } from "./amounts";
import { useSession } from "./session";
import { minimumLiquidity } from "./positionReview";
import type { PositionTokenRead } from "./positionToken";
export function PositionDepositFields({
  position,
  tokens,
  deposit,
  add,
  batchSupported,
  slippage,
  readiness,
  refreshTokens,
  nativeCalls,
}: {
  position: Position;
  tokens?: [Token, Token];
  deposit: ReturnType<typeof usePositionDeposit>;
  add: () => Promise<void>;
  batchSupported: boolean | undefined;
  slippage: number;
  readiness?: [PositionTokenRead, PositionTokenRead];
  refreshTokens: () => void;
  nativeCalls?: Transaction[];
}) {
  const { account } = useSession();
  const addresses = [
    position.descriptor.poolKey.token0,
    position.descriptor.poolKey.token1,
  ];
  const state = getDepositState(
    deposit,
    tokens,
    readiness,
    batchSupported,
    slippage,
  );
  return (
    <fieldset className="position-deposit" aria-label="Deposit amounts">
      <div className="grid deposit-inputs">
        {addresses.map((address, i) => (
          <DepositInput
            key={address}
            address={address}
            index={i}
            tokens={tokens}
            deposit={deposit}
            nativeCalls={nativeCalls}
          />
        ))}
      </div>
      <p className="muted">
        The matching amount is calculated from this position’s range and current
        pool price.
      </p>
      <ErrorText error={deposit.error ?? ""} />
      <DepositMessages
        account={account}
        state={state}
        deposit={deposit}
        refreshTokens={refreshTokens}
      />
      <DepositActions
        account={account}
        tokens={tokens}
        deposit={deposit}
        add={add}
        batchSupported={batchSupported}
        state={state}
      />
    </fieldset>
  );
}

function DepositInput({
  address,
  index,
  tokens,
  deposit,
  nativeCalls,
}: {
  address: string;
  index: number;
  tokens?: [Token, Token];
  deposit: ReturnType<typeof usePositionDeposit>;
  nativeCalls?: Transaction[];
}) {
  return (
    <div className="deposit-input">
      <strong className="deposit-token">
        {tokens?.[index].symbol ?? address.slice(0, 8)}
      </strong>
      {tokens?.[index].metadataMissing ? (
        <small>Enter raw base units: decimals could not be read.</small>
      ) : null}
      <input
        aria-label={`Add token ${index} amount`}
        data-testid={`position-amount-${index}`}
        inputMode="decimal"
        placeholder="0"
        disabled={deposit.inactive[index]}
        value={deposit.amounts[index]}
        onChange={(event) => deposit.update(index as 0 | 1, event.target.value)}
      />
      {deposit.inactive[index] ? (
        <small>This token is not needed for this range.</small>
      ) : null}
      <fieldset disabled={deposit.inactive[index]} className="balance-fieldset">
        <TokenBalance
          address={address}
          fallback=""
          nativeCalls={nativeCalls}
          onAmount={(value) => deposit.update(index as 0 | 1, value)}
        />
      </fieldset>
    </div>
  );
}

function DepositMessages({
  account,
  state,
  deposit,
  refreshTokens,
}: {
  account?: string;
  state: ReturnType<typeof getDepositState>;
  deposit: ReturnType<typeof usePositionDeposit>;
  refreshTokens: () => void;
}) {
  return (
    <>
      {account ? null : (
        <p className="muted" role="status">
          Connect a wallet to add liquidity.
        </p>
      )}
      {account && !state.spendReady ? (
        <p className="muted" role="status">
          Loading token metadata and spend readiness…
        </p>
      ) : null}
      {state.readError ? (
        <p className="status" role="alert">
          {state.readError}{" "}
          <button type="button" onClick={refreshTokens}>
            Retry token reads
          </button>
        </p>
      ) : null}
      {state.insufficient ? (
        <p className="status" role="alert">
          Insufficient balance for this deposit.
        </p>
      ) : null}
      {state.approvalNeeded ? (
        <p className="muted" role="status">
          Approve each token before adding liquidity.
        </p>
      ) : null}
      {state.minLiquidity === 0n && deposit.result ? (
        <p className="status" role="alert">
          Slippage would reduce minimum liquidity to zero.
        </p>
      ) : null}
    </>
  );
}

function DepositActions({
  account,
  tokens,
  deposit,
  add,
  batchSupported,
  state,
}: {
  account?: string;
  tokens?: [Token, Token];
  deposit: ReturnType<typeof usePositionDeposit>;
  add: () => Promise<void>;
  batchSupported: boolean | undefined;
  state: ReturnType<typeof getDepositState>;
}) {
  const disabled = !depositEnabled(account, batchSupported, deposit, state);
  return (
    <p className="row">
      {batchSupported === false &&
        state.spendReady &&
        tokens?.map((token, i) => (
          <ApprovalButton
            key={token.address}
            token={token}
            amount={deposit.amounts[i] || "0"}
          />
        ))}
      <Action run={add} disabled={disabled}>
        Add liquidity
      </Action>
    </p>
  );
}

function depositEnabled(
  account: string | undefined,
  batchSupported: boolean | undefined,
  deposit: ReturnType<typeof usePositionDeposit>,
  state: ReturnType<typeof getDepositState>,
) {
  return (
    !!account &&
    batchSupported !== undefined &&
    !!deposit.result &&
    deposit.result.liquidity > 0n &&
    state.minLiquidity > 0n &&
    state.reading &&
    !state.insufficient &&
    !state.approvalNeeded
  );
}

function getDepositState(
  deposit: ReturnType<typeof usePositionDeposit>,
  tokens: [Token, Token] | undefined,
  readiness: [PositionTokenRead, PositionTokenRead] | undefined,
  batchSupported: boolean | undefined,
  slippage: number,
) {
  const requested = requestedAmounts(deposit, tokens);
  const spendReady =
    readiness?.every((read) => read.balanceReady && read.allowanceReady) ??
    false;
  const reading = Boolean(
    deposit.result &&
    tokens &&
    spendReady &&
    requested?.every((amount) => amount !== undefined),
  );
  const insufficient = hasInsufficientBalance(reading, requested, tokens);
  const approvalNeeded = hasApprovalNeeded(
    batchSupported,
    reading,
    requested,
    tokens,
  );
  const minLiquidity = safeMinimumLiquidity(
    deposit.result?.liquidity,
    slippage,
  );
  const readError = readiness
    ?.map((read) => read.error)
    .filter(Boolean)
    .join(" ");
  return {
    requested,
    spendReady,
    reading,
    insufficient,
    approvalNeeded,
    minLiquidity,
    readError,
  };
}

function requestedAmounts(
  deposit: ReturnType<typeof usePositionDeposit>,
  tokens: [Token, Token] | undefined,
) {
  return tokens?.map((token, i) =>
    parseRequested(deposit.amounts[i], token.decimals),
  );
}

function hasInsufficientBalance(
  reading: boolean,
  requested: (bigint | undefined)[] | undefined,
  tokens: [Token, Token] | undefined,
) {
  return Boolean(
    reading &&
    requested &&
    tokens &&
    requested.some((amount, i) => amount! > tokens[i].balance),
  );
}

function hasApprovalNeeded(
  batchSupported: boolean | undefined,
  reading: boolean,
  requested: (bigint | undefined)[] | undefined,
  tokens: [Token, Token] | undefined,
) {
  return Boolean(
    batchSupported === false &&
    reading &&
    requested &&
    tokens &&
    requested.some((amount, i) => amount! > tokens[i].allowance),
  );
}

function parseRequested(value: string, decimals: number) {
  try {
    return parseAmount(value || "0", decimals);
  } catch {
    return undefined;
  }
}

function safeMinimumLiquidity(liquidity: bigint | undefined, slippage: number) {
  if (liquidity === undefined) return 0n;
  try {
    return minimumLiquidity(liquidity, slippage);
  } catch {
    return 0n;
  }
}
