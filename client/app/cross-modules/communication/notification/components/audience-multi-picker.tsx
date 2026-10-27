import { useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Input } from "@/components/ui-kits/input/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { useAudienceOptions, type AudienceOptionKind } from "../hooks/use-audience-options";

interface AudienceMultiPickerProps {
  kind: AudienceOptionKind;
  label: string;
  projectKey: string;
  selected: string[];
  onChange: (next: string[]) => void;
  max: number;
}

/** Pick several ids from a searchable list; the picked ones show as removable chips. */
export const AudienceMultiPicker = ({
  kind,
  label,
  projectKey,
  selected,
  onChange,
  max,
}: AudienceMultiPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // A saved audience holds bare ids; a name is known only after the user picks it here.
  const [names, setNames] = useState<Record<string, string>>({});
  const { options, isLoading } = useAudienceOptions(kind, projectKey, search, open);
  const atLimit = selected.length >= max;

  const toggle = (value: string, optionLabel: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    if (atLimit) return;
    setNames((current) => ({ ...current, [value]: optionLabel }));
    onChange([...selected, value]);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`${label} picker`}
            className="h-9 justify-between font-normal"
          >
            {selected.length > 0 ? `${selected.length} selected` : `Select ${label.toLowerCase()}`}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex w-80 flex-col gap-2 p-2" align="start">
          <Input
            aria-label={`Search ${label.toLowerCase()}`}
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {isLoading && <p className="px-2 py-1 text-xs text-medium-emphasis">Loading...</p>}
            {!isLoading && options.length === 0 && (
              <p className="px-2 py-1 text-xs text-medium-emphasis">Nothing found</p>
            )}
            {options.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    disabled={!checked && atLimit}
                    onCheckedChange={() => toggle(option.value, option.label)}
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })}
          </div>
          {atLimit && <p className="text-xs text-medium-emphasis">Limit of {max} reached.</p>}
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((value) => (
            <Badge key={value} variant="secondary" className="gap-1">
              {names[value] ?? value}
              <button
                type="button"
                aria-label={`Remove ${names[value] ?? value}`}
                onClick={() => onChange(selected.filter((item) => item !== value))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
