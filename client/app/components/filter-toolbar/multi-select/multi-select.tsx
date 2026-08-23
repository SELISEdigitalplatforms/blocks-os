import { CheckIcon, PlusCircledIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { usePopoverWidth } from "@seliseblocks/genesis-os/hooks";
import { useIsMobile } from "@seliseblocks/genesis-os/hooks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { Button } from "@/components/ui-kits/button/button";
import { Separator } from "@/components/ui-kits/separator/separator";
import { Badge } from "@/components/ui-kits/badge/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui-kits/command/command";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

interface MultiSelectOption {
  label: string;
  value: string;
  children?: { label: string; value: string }[];
}
interface MultiSelectProps {
  label?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (selected: string[]) => void;
}
export function MultiSelect({ label, options, onChange, value: selectedValues }: MultiSelectProps) {
  const [buttonRef, popoverWidth] = usePopoverWidth();
  const [expanded, setExpanded] = useState<string | null>(null);
  const onSelectHandler = (value: string) => {
    const nextValues = selectedValues.includes(value)
      ? selectedValues.filter((item) => item !== value)
      : [...selectedValues, value];
    onChange(nextValues);
  };
  const onResetHandler = () => {
    onChange([]);
  };
  const isMobile = useIsMobile();
  // Flattened so badge/selection-count lookups can resolve a selected child's
  // label without the caller needing to know which options are nested.
  const flatOptions = useMemo(
    () => options.flatMap((option) => [option, ...(option.children ?? [])]),
    [options],
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button ref={buttonRef} variant="outline" size="sm" className="h-8 border-dashed">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center">
              <PlusCircledIcon className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label?.split(" ")[0]}</span>
            </div>
            {selectedValues?.length > 0 && (
              <>
                <Separator orientation="vertical" className="hidden h-4 sm:mx-2 sm:block" />
                <div className="flex space-x-1">
                  {selectedValues.length > 2 ? (
                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                      {selectedValues.length} selected
                    </Badge>
                  ) : (
                    flatOptions
                      .filter((option) => selectedValues.includes(option.value))
                      .map((option) => (
                        <Badge
                          variant="secondary"
                          key={option.value}
                          className="rounded-sm px-1 font-normal"
                        >
                          {option.label}
                        </Badge>
                      ))
                  )}
                </div>
              </>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 sm:w-full"
        align="start"
        style={isMobile ? { width: popoverWidth ? `${popoverWidth}px` : "auto" } : undefined}
      >
        <Command>
          <CommandInput placeholder={label} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                const hasChildren = !!option.children?.length;
                const isExpanded = hasChildren && expanded === option.value;
                return (
                  <div key={option.value}>
                    <div className="flex items-center">
                      <CommandItem
                        className="flex-1"
                        onSelect={() => onSelectHandler(option.value)}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible",
                          )}
                        >
                          <CheckIcon className={cn("h-4 w-4")} />
                        </div>
                        <span>{option.label}</span>
                      </CommandItem>
                      {hasChildren && (
                        <button
                          type="button"
                          aria-label={
                            isExpanded ? `Collapse ${option.label}` : `Expand ${option.label}`
                          }
                          className="mr-2 rounded-sm p-1 text-muted-foreground hover:bg-accent-foreground/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(isExpanded ? null : option.value);
                          }}
                        >
                          <ChevronRight
                            className={cn(
                              "h-3.5 w-3.5 transition-transform",
                              isExpanded && "rotate-90",
                            )}
                          />
                        </button>
                      )}
                    </div>
                    {hasChildren && isExpanded && (
                      <div className="ml-4 border-l pl-2">
                        {option.children!.map((child) => {
                          const isChildSelected = selectedValues.includes(child.value);
                          return (
                            <CommandItem
                              key={child.value}
                              onSelect={() => onSelectHandler(child.value)}
                            >
                              <div
                                className={cn(
                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                  isChildSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "opacity-50 [&_svg]:invisible",
                                )}
                              >
                                <CheckIcon className={cn("h-4 w-4")} />
                              </div>
                              <span>{child.label}</span>
                            </CommandItem>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </CommandGroup>
            {selectedValues.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onResetHandler()}
                    className="justify-center text-center"
                  >
                    Clear
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
