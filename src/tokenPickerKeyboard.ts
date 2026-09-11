import type { KeyboardEvent } from "react";
// Adapted from the interface's token navigation; real buttons retain native Tab/Enter behavior.
export function tokenPickerKeyboard(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(".token-option"),
  );
  if (!buttons.length) return;
  event.preventDefault();
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === "ArrowDown"
      ? Math.min(index + 1, buttons.length - 1)
      : Math.max(index - 1, 0);
  buttons[next].focus();
  buttons[next].scrollIntoView({ block: "nearest" });
}
