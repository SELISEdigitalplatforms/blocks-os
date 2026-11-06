import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { useId } from "react";
import { useT } from "@seliseblocks/genesis-os";

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
}: NotifyUserCheckboxProps) => {
  const { t } = useT("os.idp.iam-ui");
  const checkboxId = useId();
  return (
    <label htmlFor={checkboxId} className="flex items-start gap-2 text-sm">
      <Checkbox
        id={checkboxId}
        // `shrink-0` so the box keeps its size as a flex item next to wrapping text.
        className="mt-0.5 shrink-0"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        disabled={disabled}
        aria-label={t("NOTIFY_USER_CHECKBOX.LABEL")}
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{t("NOTIFY_USER_CHECKBOX.LABEL")}</span>
        <span className="text-xs text-medium-emphasis">{description}</span>
      </span>
    </label>
  );
};
