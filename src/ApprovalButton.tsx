import { zeroAddress } from "viem";
import { useSession } from "./session";
import { approval, type Token } from "./contracts";
import { Action } from "./common";
import { parseAmount } from "./amounts";
export function ApprovalButton({
  token,
  amount,
}: {
  token: Token;
  amount: string;
}) {
  const { settings, send } = useSession();
  let required = 0n;
  try {
    required = parseAmount(amount, token.decimals);
  } catch {
    return null;
  }
  if (token.address === zeroAddress || token.allowance >= required) return null;
  const reset = token.allowance !== 0n;
  return (
    <Action
      run={() =>
        send(approval(token.address, settings.manager, reset ? 0n : required))
      }
    >
      {reset ? <>Reset {token.symbol} approval</> : <>Approve {token.symbol}</>}
    </Action>
  );
}
