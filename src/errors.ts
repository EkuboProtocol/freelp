import { i18n } from "@lingui/core";
export function errorMessage(error: unknown): string {
  if (typeof error === "string" && error !== "[object Object]") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  return i18n._({ id: "requestFailed", message: "The request failed. Please try again." });
}
