import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Input } from "@/components/ui-kits/input/input";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

type ConfigMultiSelectOption = {
  label: string;
  value: string;
};

type ConfigMultiSelectProps = {
  options: ConfigMultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  isLoading?: boolean;
};

export const ConfigMultiSelect = ({
  options,
  selected,
  onChange,
  placeholder = "Select items",
  emptyMessage = "No items available",
  disabled = false,
  isLoading = false,
}: ConfigMultiSelectProps) => {
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query),
    );
  }, [options, search]);

  const handleToggle = (value: string) => {
    if (disabled) return;
    const isSelected = selected.includes(value);
    onChange(isSelected ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  const handleClear = () => {
    if (disabled) return;
    onChange([]);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (options.length === 0) {
    return <div className="text-sm text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((value) => {
            const option = options.find((item) => item.value === value);
            return (
              <Badge key={value} variant="secondary" className="gap-1 pr-1">
                <span className="max-w-[12rem] truncate">{option?.label ?? value}</span>
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-muted"
                  aria-label={`Remove ${option?.label ?? value}`}
                  onClick={() => handleToggle(value)}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleClear}
            disabled={disabled}
          >
            Clear all
          </Button>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${placeholder.toLowerCase()}...`}
          className="pl-9"
          disabled={disabled}
          aria-label={`Search ${placeholder.toLowerCase()}`}
        />
      </div>

      <div
        className={cn(
          "max-h-44 overflow-y-auto rounded-md border bg-muted/20 sm:max-h-52",
          disabled && "pointer-events-none opacity-60",
        )}
        role="listbox"
        aria-label={placeholder}
        aria-multiselectable="true"
      >
        {filteredOptions.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results found.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {filteredOptions.map((option) => {
              const isSelected = selected.includes(option.value);
              const optionId = `config-multi-select-${option.value}`;

              return (
                <li key={option.value}>
                  <label
                    htmlFor={optionId}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors",
                      "hover:bg-accent/60 focus-within:bg-accent/60",
                      isSelected && "bg-accent/40",
                    )}
                  >
                    <Checkbox
                      id={optionId}
                      className="mt-0.5 h-4 w-4"
                      checked={isSelected}
                      onCheckedChange={() => handleToggle(option.value)}
                      disabled={disabled}
                    />
                    <span className="min-w-0 flex-1 text-sm leading-snug">{option.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {selected.length} selected · {options.length} available
      </p>
    </div>
  );
};
