import { useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { cn } from "@/lib/utils";

type ScopeOption = { value: string; label: string; locked?: boolean };

export const STANDARD_OIDC_SCOPES: ScopeOption[] = [
  { value: "openid", label: "openid", locked: true },
];

type Props = {
  value: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
};

export function ScopeMultiSelect({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const options: ScopeOption[] = [
    ...STANDARD_OIDC_SCOPES,
    ...value
      .filter((scope) => !STANDARD_OIDC_SCOPES.some((option) => option.value === scope))
      .map((scope) => ({ value: scope, label: scope })),
  ];

  const toggleScope = (scope: string) => {
    if (scope === "openid") return;
    onChange(value.includes(scope) ? value.filter((s) => s !== scope) : [...value, scope]);
  };

  const addCustomScope = () => {
    const scope = query.trim();
    if (!scope || value.includes(scope)) return;
    onChange([...value, scope]);
    setQuery("");
  };

  const trimmedQuery = query.trim();
  const canAddCustom =
    trimmedQuery.length > 0 && !options.some((option) => option.value === trimmedQuery);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-auto min-h-10 w-full justify-between px-3 py-2 font-normal"
        >
          <span className="flex flex-1 flex-wrap items-center gap-1.5 text-left">
            {value.length === 0 ? (
              <span className="text-sm text-muted-foreground">Select scope(s)</span>
            ) : (
              value.map((scope) => (
                <Badge key={scope} variant="secondary" className="gap-1 pr-1 font-normal">
                  {scope}
                  {scope !== "openid" && (
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={`Remove ${scope}`}
                      className="rounded-sm p-0.5 hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleScope(scope);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </Badge>
              ))
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search or add a scope..."
          />
          <CommandList>
            <CommandEmpty>
              {canAddCustom ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={addCustomScope}
                >
                  <Plus className="h-4 w-4" />
                  Add &quot;{trimmedQuery}&quot;
                </button>
              ) : (
                "No scopes found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = value.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => toggleScope(option.value)}
                    disabled={option.locked}
                    className={cn(option.locked && "opacity-70")}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")}
                    />
                    {option.label}
                    {option.locked && (
                      <span className="ml-auto text-xs text-muted-foreground">required</span>
                    )}
                  </CommandItem>
                );
              })}
              {canAddCustom && (
                <CommandItem value={trimmedQuery} onSelect={addCustomScope}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add &quot;{trimmedQuery}&quot;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
