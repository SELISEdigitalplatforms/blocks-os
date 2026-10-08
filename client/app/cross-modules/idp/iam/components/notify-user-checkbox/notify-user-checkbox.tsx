import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";

type NotifyUserCheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description: string;
  disabled?: boolean;
};

/**
 * Whether IAM should email the user about an organization membership change.
 * IAM only sends when membership actually changes, and a tenant without the
 * matching mail template simply sends nothing.
 */
export const NotifyUserCheckbox = ({
  checked,
  onCheckedChange,
  description,
  disabled,
}: NotifyUserCheckboxProps) => (
  <label className="flex items-start gap-2 text-sm">
    <Checkbox
      // `shrink-0` so the box keeps its size as a flex item next to wrapping text.
      className="mt-0.5 shrink-0"
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      disabled={disabled}
      aria-label="Notify user by email"
    />
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">Notify user by email</span>
      <span className="text-xs text-medium-emphasis">{description}</span>
    </span>
  </label>
);
