import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
export type NetworkDetailsInput = {
  name: string;
  nativeSymbol: string;
  nativeName: string;
  nativeDecimals: string;
};
export const EMPTY_NETWORK_DETAILS: NetworkDetailsInput = {
  name: "",
  nativeSymbol: "",
  nativeName: "",
  nativeDecimals: "",
};
export function NetworkDetailsFields({
  value,
  onChange,
  disabled,
}: {
  value: NetworkDetailsInput;
  onChange: (value: NetworkDetailsInput) => void;
  disabled: boolean;
}) {
  const update = (key: keyof NetworkDetailsInput, next: string) =>
    onChange({ ...value, [key]: next });
  return (
    <fieldset disabled={disabled} className="network-details-fields">
      <label>
        <Trans>Network name</Trans>
        <input
          value={value.name}
          maxLength={80}
          placeholder={t`Detected network name`}
          onChange={(e) => update("name", e.target.value)}
        />
      </label>
      <label>
        <Trans>Native token symbol</Trans>
        <input
          value={value.nativeSymbol}
          maxLength={16}
          placeholder="ETH"
          onChange={(e) => update("nativeSymbol", e.target.value)}
        />
      </label>
      <label>
        <Trans>Native token name</Trans>
        <input
          value={value.nativeName}
          maxLength={80}
          placeholder="Ether"
          onChange={(e) => update("nativeName", e.target.value)}
        />
      </label>
      <label>
        <Trans>Native token decimals</Trans>
        <input
          value={value.nativeDecimals}
          type="number"
          min={0}
          max={255}
          step={1}
          placeholder="18"
          onChange={(e) => update("nativeDecimals", e.target.value)}
        />
      </label>
    </fieldset>
  );
}
