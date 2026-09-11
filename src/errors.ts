import { i18n } from "@lingui/core";
import { BaseError } from "viem";
export function errorMessage(error: unknown): string {
  const message = messageText(error);
  if (/rate.limit|too many requests|\b429\b/i.test(message))
    return i18n._({
      id: "rpcRateLimit",
      message:
        "This network's RPC is busy. Wait a moment and retry, or change its RPC URL in Settings.",
    });
  if (error instanceof BaseError) {
    if (/revert/i.test(message))
      return i18n._({
        id: "contractRejected",
        message:
          "The contract rejected this request. Check the pool settings and amounts, then retry.",
      });
    return i18n._({
      id: "rpcUnavailable",
      message:
        "Could not load data from this network. Retry or change its RPC URL in Settings.",
    });
  }
  if (message && message !== "[object Object]")
    return message.split(
      /\n(?:URL:|Request body:|Raw Call Arguments:|Docs:)/,
    )[0];
  return i18n._({
    id: "requestFailed",
    message: "The request failed. Please try again.",
  });
}
function messageText(error: unknown) {
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  return "";
}
