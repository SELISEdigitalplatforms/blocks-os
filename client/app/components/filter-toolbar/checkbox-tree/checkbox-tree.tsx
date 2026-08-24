import { PlusCircledIcon } from "@radix-ui/react-icons";
import { usePopoverWidth } from "@seliseblocks/genesis-os/hooks";
import { useIsMobile } from "@seliseblocks/genesis-os/hooks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { Button } from "@/components/ui-kits/button/button";
import { Separator } from "@/components/ui-kits/separator/separator";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Label } from "@/components/ui-kits/label/label";
import { Input } from "@/components/ui-kits/input/input";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxTreeOption {
  label: string;
  value: string;
  children?: { label: string; value: string }[];
}
interface CheckboxTreeProps {
  label?: string;
  options: CheckboxTreeOption[];
  value: string[];
  onChange: (selected: string[]) => void;
}
type GroupState = "all" | "partial" | "none";

const childValuesOf = (option: CheckboxTreeOption) => (option.children ?? []).map((c) => c.value);

// A parent value in the selection means the whole group; individual child values mean
// a narrowed selection. The two forms are never stored together, so state is unambiguous.
const groupStateOf = (option: CheckboxTreeOption, value: string[]): GroupState => {
  if (value.includes(option.value)) return "all";
  const children = childValuesOf(option);
  if (children.length === 0) return "none";
  const selected = children.filter((child) => value.includes(child));
  if (selected.length === 0) return "none";
  return selected.length === children.length ? "all" : "partial";
};

const selectedChildrenOf = (option: CheckboxTreeOption, value: string[]) => {
  const children = childValuesOf(option);
  if (value.includes(option.value)) return children;
  return children.filter((child) => value.includes(child));
};

const INDETERMINATE_CLASSES = cn(
  "relative data-[state=indeterminate]:border-blocks-primary-500",
  "data-[state=indeterminate]:bg-blocks-primary-500 data-[state=indeterminate]:text-primary-foreground",
  "[&[data-state=indeterminate]_svg]:hidden",
  "data-[state=indeterminate]:after:absolute data-[state=indeterminate]:after:inset-x-[3px]",
  "data-[state=indeterminate]:after:top-1/2 data-[state=indeterminate]:after:h-[1.5px]",
  "data-[state=indeterminate]:after:-translate-y-1/2 data-[state=indeterminate]:after:rounded-full",
  "data-[state=indeterminate]:after:bg-current",
);

export function CheckboxTree({
  label,
  options,
  onChange,
  value: selectedValues,
}: CheckboxTreeProps) {
  const [search, setSearch] = useState("");
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});
  const [buttonRef, popoverWidth] = usePopoverWidth();
  const isMobile = useIsMobile();
  // Memoized so the derived badge/search memos below keep a stable dependency.
  const value = useMemo(() => selectedValues ?? [], [selectedValues]);

  // Only this option's own values are rewritten, so other groups keep their selection.
  const commit = (option: CheckboxTreeOption, groupValues: string[]) => {
    const owned = new Set([option.value, ...childValuesOf(option)]);
    onChange([...value.filter((item) => !owned.has(item)), ...groupValues]);
  };
  const toggleParent = (option: CheckboxTreeOption) => {
    // Checking a parent checks every child with it; unchecking drops the whole group.
    commit(option, groupStateOf(option, value) === "none" ? [option.value] : []);
  };
  const toggleChild = (option: CheckboxTreeOption, childValue: string) => {
    const children = childValuesOf(option);
    const current = selectedChildrenOf(option, value);
    const next = current.includes(childValue)
      ? current.filter((item) => item !== childValue)
      : children.filter((item) => current.includes(item) || item === childValue);
    if (next.length === 0) return commit(option, []);
    // A complete child set collapses back to the parent value, keeping one form per state.
    commit(option, next.length === children.length ? [option.value] : next);
  };

  const selectedBadges = useMemo(
    () =>
      options
        .map((option) => {
          const state = groupStateOf(option, value);
          if (state === "none") return null;
          if (state === "all") return option.label;
          const selected = selectedChildrenOf(option, value);
          if (selected.length === 1) {
            const child = option.children?.find((item) => item.value === selected[0]);
            return `${option.label} · ${child?.label ?? selected[0]}`;
          }
          return `${option.label} · ${selected.length} selected`;
        })
        .filter((item): item is string => item !== null),
    [options, value],
  );

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
      .filter((option): option is CheckboxTreeOption => option !== null);
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
            {selectedBadges.length > 0 && (
              <>
                <Separator orientation="vertical" className="hidden h-4 sm:mx-2 sm:block" />
                <div className="flex space-x-1">
                  {selectedBadges.length > 2 ? (
                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                      {selectedBadges.length} selected
                    </Badge>
                  ) : (
                    selectedBadges.map((badge) => (
                      <Badge
                        variant="secondary"
                        key={badge}
                        className="rounded-sm px-1 font-normal"
                      >
                        {badge}
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
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            className="flex h-11 w-full rounded-md border-none bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={label}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {searchedOptions.length > 0 ? (
          <div className="gap-0 p-1 text-xs font-thin text-accent-foreground">
            {searchedOptions.map((option) => {
              const hasChildren = !!option.children?.length;
              const state = groupStateOf(option, value);
              // A partially selected group opens by default so active children stay visible.
              const isExpanded =
                hasChildren && (expandedOverrides[option.value] ?? state === "partial");
              const selectedChildren = selectedChildrenOf(option, value);
              return (
                <div key={option.value}>
                  <div className="flex items-center gap-2 rounded-sm px-2 py-2 hover:bg-accent">
                    <Label className="flex flex-1 items-center gap-2" htmlFor={option.value}>
                      <Checkbox
                        id={option.value}
                        checked={
                          state === "all" ? true : state === "partial" ? "indeterminate" : false
                        }
                        onCheckedChange={() => toggleParent(option)}
                        className={INDETERMINATE_CLASSES}
                      />
                      <span>{option.label}</span>
                    </Label>
                    {hasChildren && (
                      <button
                        type="button"
                        aria-label={
                          isExpanded ? `Collapse ${option.label}` : `Expand ${option.label}`
                        }
                        className="rounded-sm p-1 text-muted-foreground hover:bg-accent-foreground/10"
                        onClick={() =>
                          setExpandedOverrides((current) => ({
                            ...current,
                            [option.value]: !isExpanded,
                          }))
                        }
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
                      {option.children!.map((child) => (
                        <Label
                          key={child.value}
                          className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
                          htmlFor={child.value}
                        >
                          <Checkbox
                            id={child.value}
                            checked={selectedChildren.includes(child.value)}
                            onCheckedChange={() => toggleChild(option, child.value)}
                          />
                          <span>{child.label}</span>
                        </Label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-sm !text-popover-foreground">No results found.</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
