import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";

interface FormRowProps {
  label: string;
  children: ReactNode;
}

/** One labelled row of the compact form: the label on the left, the controls on the right. */
export function FormRow({ label, children }: Readonly<FormRowProps>) {
  return (
    <div className="grid grid-cols-1 gap-x-[18px] gap-y-1.5 border-t px-5 py-3.5 first:border-t-0 sm:grid-cols-[150px_minmax(0,1fr)]">
      <div className="pt-1.5 text-sm font-medium text-medium-emphasis">{label}</div>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  );
}

export function HelpText({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="text-xs text-medium-emphasis">{children}</p>;
}

interface CheckRowProps {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckRow({ id, label, checked, disabled, onChange }: Readonly<CheckRowProps>) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
    </div>
  );
}
