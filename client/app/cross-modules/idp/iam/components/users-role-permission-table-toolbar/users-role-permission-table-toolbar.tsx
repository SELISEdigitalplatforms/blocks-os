import React, { useCallback, useState } from "react";
import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui-kits/button/button";
import { Cross2Icon } from "@radix-ui/react-icons";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter/data-table-faceted-filter";
import { useIsMobile } from "@seliseblocks/genesis-os/hooks";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui-kits/sheet/sheet";
import { Filter } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { useActiveFiltersCount } from "@/hooks/use-active-filters-count";
import { SearchInput } from "@/components/search-input/search-input";
import useIsServiceBarOpenLocal from "@blocks-localization/hooks/use-is-service-tab-open-local";
import { useT } from "@seliseblocks/genesis-os";

interface TableFilterData {
  resourceGroup: string;
}

interface UsersRolePermissionTableToolbarProps<TData> {
  table: Table<TData>;
}

function FilterContent<TData extends TableFilterData>({ table }: { table: Table<TData> }) {
  const { t } = useT("os.idp.iam-ui");
  return (
    <>
      {table.getRowModel() && (
        <DataTableFacetedFilter
          column={table.getColumn("resourceGroup")}
          title={t("USERS_ROLE_PERMISSION_TABLE_TOOLBAR.GROUP")}
          options={[
            ...Array.from(
              new Set(table.getRowModel().rows.map((row) => row.original.resourceGroup)),
            ).map((group) => ({
              label: group,
              value: group,
            })),
          ]}
        />
      )}
    </>
  );
}

export function UsersRolePermissionTableToolbar<TData extends TableFilterData>({
  table,
}: UsersRolePermissionTableToolbarProps<TData>) {
  const { t } = useT("os.idp.iam-ui");
  const isMobile = useIsMobile();
  const isServiceBarOpen = useIsServiceBarOpenLocal();
  const textSearchColumn = table.getColumn("name");
  const [searchValue, setSearchValue] = useState("");
  // Search visibility defaults to the viewport (hidden on mobile) but can be
  // toggled by the user. The override is scoped to the viewport it was made in,
  // so crossing the breakpoint falls back to the default without an effect that
  // writes state during synchronisation.
  const [searchOverride, setSearchOverride] = useState<{
    mobile: boolean;
    visible: boolean;
  } | null>(null);
  const isSearchVisible =
    searchOverride && searchOverride.mobile === isMobile ? searchOverride.visible : !isMobile;
  const setIsSearchVisible = useCallback(
    (value: React.SetStateAction<boolean>) => {
      setSearchOverride((prev) => {
        const current = prev && prev.mobile === isMobile ? prev.visible : !isMobile;
        return {
          mobile: isMobile,
          visible: typeof value === "function" ? value(current) : value,
        };
      });
    },
    [isMobile],
  );

  const activeFiltersCount = useActiveFiltersCount(table, undefined, "name");
  const isFiltered = activeFiltersCount > 0;

  const onSearchInputChange = useCallback(
    (text: string) => {
      setSearchValue(text);
      textSearchColumn?.setFilterValue(text);
    },
    [textSearchColumn],
  );

  function resetFilters() {
    setSearchValue("");

    table.resetColumnFilters();
  }

  return (
    <div className="flex flex-col space-y-4 md:space-y-0">
      {/* Mobile view */}
      <div className={`flex items-center justify-between ${isServiceBarOpen ? "flex" : "hidden"}`}>
        <SearchInput
          placeholder={t("USERS_ROLE_PERMISSION_TABLE_TOOLBAR.FILTER_PERMISSION")}
          onSearch={onSearchInputChange}
          toggleable={true}
          className="h-8 w-[250px]"
          value={searchValue}
          isVisible={isSearchVisible}
          setIsVisible={setIsSearchVisible}
        />
        {isServiceBarOpen && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="relative h-8 w-8 p-0">
                <Filter className="h-4 w-4" />
                {activeFiltersCount > 0 && (
                  <Badge className="absolute -right-2 -top-2 h-4 w-4 px-1 text-xs font-medium">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full" aria-describedby="filter-description">
              <SheetTitle className="mb-4">{t("common:FILTER")}</SheetTitle>
              <SheetDescription />
              <div className="flex flex-col space-y-4">
                <FilterContent table={table} />
                <SheetClose asChild>
                  <Button className="mt-4" size="sm">
                    {t("USERS_ROLE_PERMISSION_TABLE_TOOLBAR.SHOW_RESULTS")}
                  </Button>
                </SheetClose>
                {isFiltered && (
                  <Button variant="outline" onClick={resetFilters} className="h-8 px-2 lg:px-3">
                    {t("common:RESET")}
                    <Cross2Icon className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Desktop view */}
      <div className={`${isServiceBarOpen ? "hidden" : "flex"} flex-1 items-center space-x-2`}>
        <SearchInput
          placeholder={t("USERS_ROLE_PERMISSION_TABLE_TOOLBAR.FILTER_USERS")}
          onSearch={onSearchInputChange}
          className="h-8 w-[268px]"
          value={searchValue}
          isVisible={isSearchVisible}
          setIsVisible={setIsSearchVisible}
        />
        <FilterContent table={table} />
        {isFiltered && (
          <Button variant="outline" onClick={resetFilters} className="h-8 px-2 lg:px-3">
            {t("common:RESET")}
            <Cross2Icon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
