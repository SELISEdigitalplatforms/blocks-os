import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";

interface SegmentedControlProps {
  label: string;
  options: readonly { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** A row of exclusive buttons; the pressed one is the value. */
export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  disabled,
}: Readonly<SegmentedControlProps>) {
  return (
    <fieldset className="m-0 inline-flex w-fit min-w-0 flex-wrap rounded-sm border p-0">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="ghost"
          size="xs"
          disabled={disabled}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-none border-r last:border-r-0",
            value === option.value && "bg-accent font-semibold text-accent-foreground",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </fieldset>
  );
}
