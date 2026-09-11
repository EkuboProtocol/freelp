import { useId, useState, type InputHTMLAttributes } from "react";
import { Trans } from "@lingui/react/macro";
export function SnappedInput({
  value,
  snapped,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  value: string | number;
  snapped: string | number;
}) {
  const description = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const adjusted = String(value) !== "" && String(value) !== String(snapped);
  return (
    <>
      <input
        {...props}
        aria-describedby={adjusted ? description : props["aria-describedby"]}
        value={editing ? draft : snapped}
        onFocus={(event) => {
          setDraft(event.currentTarget.value);
          setEditing(true);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          props.onChange?.(event);
        }}
        onBlur={() => setEditing(false)}
      />
      {adjusted ? (
        <small
          id={description}
          aria-hidden="true"
          className="snapped-value"
          style={{ visibility: editing ? "hidden" : "visible" }}
        >
          <Trans>Adjusted to nearest valid value</Trans>
        </small>
      ) : null}
    </>
  );
}
