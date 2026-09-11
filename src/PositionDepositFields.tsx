import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Token } from "./contracts";
import { TokenBalance } from "./TokenBalance";
import { ApprovalButton } from "./ApprovalButton";
import { Action, ErrorText } from "./common";
import type { Position } from "./types";
import type { usePositionDeposit } from "./usePositionDeposit";
export function PositionDepositFields({
  position,
  tokens,
  deposit,
  add,
}: {
  position: Position;
  tokens?: [Token, Token];
  deposit: ReturnType<typeof usePositionDeposit>;
  add: () => Promise<void>;
}) {
  const addresses = [
    position.descriptor.poolKey.token0,
    position.descriptor.poolKey.token1,
  ];
  return (
    <fieldset className="position-deposit">
      <legend>
        <Trans>Add liquidity</Trans>
      </legend>
      <div className="grid deposit-inputs">
        {addresses.map((address, i) => (
          <div key={address} className="deposit-input">
            <strong className="deposit-token">
              {tokens?.[i].symbol ?? address.slice(0, 8)}
            </strong>
            <input
              aria-label={t`Add token ${i} amount`}
              data-testid={`position-amount-${i}`}
              inputMode="decimal"
              placeholder="0"
              disabled={deposit.result?.inactive[i]}
              value={deposit.amounts[i]}
              onChange={(event) =>
                deposit.update(i as 0 | 1, event.target.value)
              }
            />
            <fieldset
              disabled={deposit.result?.inactive[i]}
              className="balance-fieldset"
            >
              <TokenBalance
                address={address}
                fallback=""
                onAmount={(value) => deposit.update(i as 0 | 1, value)}
              />
            </fieldset>
          </div>
        ))}
      </div>
      <p className="muted">
        <Trans>
          The matching amount is calculated from this position’s range and
          current pool price.
        </Trans>
      </p>
      <ErrorText error={deposit.error ?? ""} />
      {deposit.pending ? (
        <p role="status">
          <Trans>Calculating matching amount…</Trans>
        </p>
      ) : null}
      <p className="row">
        {tokens?.map((token, i) => (
          <ApprovalButton
            key={token.address}
            token={token}
            amount={deposit.amounts[i] || "0"}
          />
        ))}
        <Action
          run={add}
          disabled={!deposit.result || deposit.result.liquidity === 0n}
        >
          <Trans>Add liquidity</Trans>
        </Action>
      </p>
    </fieldset>
  );
}
