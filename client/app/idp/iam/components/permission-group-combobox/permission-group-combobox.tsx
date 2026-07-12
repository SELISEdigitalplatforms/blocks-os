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
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useGetResourceGroup } from "@blocks-idp/iam/hooks/use-permission";
import { ChevronDown, Plus, X } from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";

type PermissionGroupComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function PermissionGroupCombobox({ value, onChange, disabled }: PermissionGroupComboboxProps) {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data: resourceGroupData } = useGetResourceGroup({ projectKey: tenantId });
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const resourceGroups = useMemo(
    () => resourceGroupData?.map((item) => item.resourceGroup) ?? [],
    [resourceGroupData],
  );

  const trimmedInput = inputValue.trim();

  const filtered = useMemo(() => {
    if (!trimmedInput) return resourceGroups;
    return resourceGroups.filter((item) =>
      item.toLowerCase().includes(trimmedInput.toLowerCase()),
    );
  }, [resourceGroups, trimmedInput]);

  const canCreate =
    trimmedInput.length > 0 &&
    !resourceGroups.some((group) => group.toLowerCase() === trimmedInput.toLowerCase());

  const handleSelect = (selectedValue: string) => {
    setOpen(false);
    setInputValue("");
    onChange(selectedValue);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setInputValue("");
  };

  const handleCreate = () => {
    if (!canCreate) return;
    handleSelect(trimmedInput);
  };

  const handleClear = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setInputValue("");
    onChange("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <div
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left",
              !value && "text-muted-foreground",
            )}
          >
            {value || "Select or create group..."}
          </span>
          {value && !disabled ? (
            <button
              type="button"
              aria-label="Clear group"
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or create a group..."
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !canCreate) return;
              e.preventDefault();
              handleCreate();
            }}
          />
          <CommandList>
            {value ? (
              <CommandItem
                value="__clear__"
                onSelect={() => handleSelect("")}
                className="text-muted-foreground"
              >
                <X className="mr-2 h-4 w-4" aria-hidden="true" />
                Clear selection
              </CommandItem>
            ) : null}

            {canCreate ? (
              <CommandItem
                value={`__create__${trimmedInput}`}
                onSelect={handleCreate}
                className="font-medium text-primary"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>
                  Create group &ldquo;{trimmedInput}&rdquo;
                </span>
                <span className="ml-auto text-xs text-muted-foreground">Enter</span>
              </CommandItem>
            ) : null}

            {filtered.length > 0 ? (
              <CommandGroup heading={canCreate ? "Existing groups" : "Groups"}>
                {filtered.map((opt) => (
                  <CommandItem key={opt} value={opt} onSelect={() => handleSelect(opt)}>
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {!canCreate && filtered.length === 0 ? (
              <CommandEmpty>
                {trimmedInput
                  ? `No groups match "${trimmedInput}". Type a new name to create one.`
                  : "Type a name to create a new group, or pick one below."}
              </CommandEmpty>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
