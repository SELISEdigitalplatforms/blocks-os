import { useState } from "react";
import { Plus } from "lucide-react";
import { FilterControls } from "@/components/filter-toolbar";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Pagination } from "@/components/ui-kits/pagination/pagination";

export interface AccessPickerItem {
  /** The value that is stored and sent to the API — a user GUID or a role slug. */
  id: string;
  primary: string;
  secondary?: string;
}

export interface AccessPickerDialogProps {
  title: string;
  description: string;
  triggerLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  /** Already-selected ids: shown checked and disabled so they cannot be added twice. */
  selected: string[];
  items: AccessPickerItem[];
  totalCount: number;
  isLoading: boolean;
  page: number;
  pageSize: number;
  search: string;
  open: boolean;
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onAdd: (ids: string[]) => void;
}

/**
 * Searchable, paginated multi-select used for both the user and the role picker.
 *
 * Presentational on purpose: the caller owns fetching, so the same dialog serves two different
 * IAM endpoints and can be tested without either.
 */
export function AccessPickerDialog({
  title,
  description,
  triggerLabel,
  searchPlaceholder,
  emptyLabel,
  selected,
  items,
  totalCount,
  isLoading,
  page,
  pageSize,
  search,
  open,
  disabled,
  onOpenChange,
  onPageChange,
  onSearchChange,
  onAdd,
}: AccessPickerDialogProps) {
  const [pending, setPending] = useState<string[]>([]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setPending([]);
    onOpenChange(next);
  };

  const toggle = (checked: boolean, id: string) =>
    setPending((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs"
          disabled={disabled}
        >
          <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="sr-only sm:not-sr-only">{triggerLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(92vh,720px)] w-[calc(100vw-1.5rem)] max-w-xl flex-col overflow-hidden sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">{title}</DialogTitle>
          <DialogDescription className="text-left">{description}</DialogDescription>
        </DialogHeader>

        <FilterControls.SearchInput
          value={search}
          onChange={onSearchChange}
          className="h-fit w-full py-3"
          placeholder={searchPlaceholder}
        />

        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardContent className="max-h-[min(50vh,360px)] overflow-y-auto">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {Array.from({ length: pageSize }).map((_, index) => (
                  <div key={index} className="flex animate-pulse items-center space-x-2 py-2">
                    <div className="h-4 w-4 rounded bg-muted" />
                    <div className="h-4 w-32 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : items.length ? (
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {items.map((item) => {
                  const alreadySelected = selected.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className="col-span-1 flex cursor-pointer items-center py-2"
                    >
                      <Checkbox
                        checked={alreadySelected || pending.includes(item.id)}
                        disabled={alreadySelected}
                        onCheckedChange={(value) => toggle(!!value, item.id)}
                        aria-label={item.primary}
                      />
                      <div className="ml-2 flex min-w-0 flex-col">
                        <span className="truncate" title={item.primary}>
                          {item.primary}
                        </span>
                        {item.secondary && (
                          <span
                            className="truncate text-sm text-muted-foreground"
                            title={item.secondary}
                          >
                            {item.secondary}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                {emptyLabel}
              </div>
            )}
          </CardContent>
        </Card>

        {!isLoading && totalCount > pageSize && (
          <div className="flex items-center md:justify-end">
            <Pagination
              compact
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onChange={onPageChange}
            />
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending.length === 0}
            onClick={() => {
              onAdd(pending);
              handleOpenChange(false);
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
