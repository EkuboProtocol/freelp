import { BaseError } from "viem";
export function errorMessage(error: unknown): string {
  const message = messageText(error);
  if (/rate.limit|too many requests|\b429\b/i.test(message))
    return "This network's RPC is busy. Wait a moment and retry, or change its RPC URL in Settings.";
  if (error instanceof BaseError) {
    if (/revert/i.test(message))
      return "The contract rejected this request. Check the pool settings and amounts, then retry.";
    return "Could not load data from this network. Retry or change its RPC URL in Settings.";
  }
  if (message && message !== "[object Object]")
    return message.split(
      /\n(?:URL:|Request body:|Raw Call Arguments:|Docs:)/,
    )[0];
  return "The request failed. Please try again.";
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
