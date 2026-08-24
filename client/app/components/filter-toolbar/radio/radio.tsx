import { PlusCircledIcon } from "@radix-ui/react-icons";
import { usePopoverWidth } from "@seliseblocks/genesis-os/hooks";
import { useIsMobile } from "@seliseblocks/genesis-os/hooks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { Button } from "@/components/ui-kits/button/button";
import { Separator } from "@/components/ui-kits/separator/separator";
import { Badge } from "@/components/ui-kits/badge/badge";
import { useMemo, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { Label } from "@/components/ui-kits/label/label";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui-kits/input/input";
import { ClearButton } from "../clear-button/clear-button";
import { cn } from "@/lib/utils";

interface RadioOption {
  label: string;
  value: string;
  children?: { label: string; value: string }[];
}
interface MultiSelectProps {
  label?: string;
  options: RadioOption[];
  value: string;
  onChange: (value: unknown) => void;
}
export function Radio({ label, options, onChange, value }: MultiSelectProps) {
  const [search, setSearch] = useState("");
  const [manuallyExpanded, setManuallyExpanded] = useState<string | null>(null);
  const [buttonRef, popoverWidth] = usePopoverWidth();
  const isMobile = useIsMobile();
  const selected = useMemo(() => {
    for (const option of options) {
      if (option.value === value) return { label: option.label };
      const child = option.children?.find((item) => item.value === value);
      if (child) return { label: child.label, parentLabel: option.label };
    }
    return null;
  }, [options, value]);
  // The parent of the current selection is expanded by default, so reopening the
  // popover shows the active child instead of hiding it behind a collapsed row.
  const autoExpanded = useMemo(
    () => options.find((option) => option.children?.some((item) => item.value === value))?.value ?? null,
    [options, value],
  );
  const expandedValue = manuallyExpanded ?? autoExpanded;
  const searchedOptions = useMemo(() => {
    if (!search) return options;
    const term = search.toLowerCase();
    return options
      .map((option) => {
        if (option.label.toLowerCase().includes(term)) return option;
        const matchingChildren = option.children?.filter((item) =>
          item.label.toLowerCase().includes(term),
        );
        return matchingChildren?.length ? { ...option, children: matchingChildren } : null;
      })
      .filter((option): option is RadioOption => option !== null);
  }, [options, search]);
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
            {selected && (
              <>
                <Separator orientation="vertical" className="hidden h-4 sm:mx-2 sm:block" />
                <div className="flex space-x-1">
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selected.parentLabel ? `${selected.parentLabel} · ${selected.label}` : selected.label}
                  </Badge>
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
        <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            className={
              "flex h-11 w-full rounded-md border-none bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
            }
            placeholder={label}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <>
          {searchedOptions.length > 0 ? (
            <RadioGroup
              onValueChange={onChange}
              value={value}
              className="gap-0 p-1 text-xs font-thin text-accent-foreground"
            >
              {searchedOptions.length > 0 &&
                searchedOptions.map((option) => {
                  const hasChildren = !!option.children?.length;
                  const isExpanded = hasChildren && expandedValue === option.value;
                  return (
                    <div key={option.value}>
                      <div className="flex items-center gap-2 rounded-sm px-2 py-2 hover:bg-accent">
                        <Label
                          className="flex flex-1 items-center gap-2"
                          htmlFor={option.value}
                        >
                          <RadioGroupItem value={option.value} id={option.value} />
                          <span>{option.label}</span>
                        </Label>
                        {hasChildren && (
                          <button
                            type="button"
                            aria-label={isExpanded ? `Collapse ${option.label}` : `Expand ${option.label}`}
                            className="rounded-sm p-1 text-muted-foreground hover:bg-accent-foreground/10"
                            onClick={() =>
                              setManuallyExpanded(isExpanded ? "" : option.value)
                            }
                          >
                            <ChevronRight
                              className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")}
                            />
                          </button>
                        )}
                      </div>
                      {hasChildren && isExpanded && (
                        <div className="ml-4 border-l pl-2">
                          {option.children!.map((child) => (
                            <Label
                              key={child.value}
                              className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
                              htmlFor={child.value}
                            >
                              <RadioGroupItem value={child.value} id={child.value} />
                              <span>{child.label}</span>
                            </Label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </RadioGroup>
          ) : (
            <div className="py-6 text-center text-sm !text-popover-foreground">
              No results found.
            </div>
          )}
        </>
        {value ? (
          <>
            <Separator />
            <ClearButton onClear={() => onChange(null)} />
          </>
        ) : (
          ""
        )}
      </PopoverContent>
    </Popover>
  );
}
