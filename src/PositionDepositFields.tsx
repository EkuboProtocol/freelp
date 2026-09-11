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
  batchSupported,
}: {
  position: Position;
  tokens?: [Token, Token];
  deposit: ReturnType<typeof usePositionDeposit>;
  add: () => Promise<void>;
  batchSupported: boolean | undefined;
}) {
  const addresses = [
    position.descriptor.poolKey.token0,
    position.descriptor.poolKey.token1,
  ];
  return (
    <fieldset className="position-deposit" aria-label="Deposit amounts">
      <div className="grid deposit-inputs">
        {addresses.map((address, i) => (
          <div key={address} className="deposit-input">
            <strong className="deposit-token">
              {tokens?.[i].symbol ?? address.slice(0, 8)}
            </strong>
            <input
              aria-label={`Add token ${i} amount`}
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
        The matching amount is calculated from this position’s range and current
        pool price.
      </p>
      <ErrorText error={deposit.error ?? ""} />
      <p className="row">
        {batchSupported === false &&
          tokens?.map((token, i) => (
            <ApprovalButton
              key={token.address}
              token={token}
              amount={deposit.amounts[i] || "0"}
            />
          ))}
        <Action
          run={add}
          disabled={
            batchSupported === undefined ||
            !deposit.result ||
            deposit.result.liquidity === 0n
          }
        >
          Add liquidity
        </Action>
      </p>
    </fieldset>
  );
}
