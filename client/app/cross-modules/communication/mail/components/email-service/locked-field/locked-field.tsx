import { Lock } from "lucide-react";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";

interface LockedFieldProps {
  id: string;
  label: string;
  value: string;
  hint?: string;
}

/**
 * A value the user can see but not change: a read-only input (announced as read-only) with a
 * lock icon, and an optional hint saying why.
 */
export function LockedField({ id, label, value, hint }: LockedFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-left font-medium text-high-emphasis">
        {label}
      </Label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-low-emphasis"
          aria-hidden="true"
        />
        <Input
          id={id}
          value={value}
          readOnly
          aria-describedby={hintId}
          className="border-default bg-muted/40 pl-9 text-medium-emphasis shadow-none"
        />
      </div>
      {hint ? (
        <p id={hintId} className="text-sm text-low-emphasis">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
