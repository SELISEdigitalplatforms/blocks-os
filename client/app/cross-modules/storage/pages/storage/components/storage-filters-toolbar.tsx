import { FilterChangeHandler, FilterToolbar } from "@/components/filter-toolbar";
import { Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { useT } from "@seliseblocks/genesis-os";
type FilterValues = {
  search: string;
  providers: string[];
  types: string[];
};
type StorageFiltersToolbarProps = {
  filters: FilterValues;
  onChange: FilterChangeHandler<FilterValues>;
  onReset: () => void;
  onAddConfiguration: () => void;
};
export function StorageFiltersToolbar({
  filters,
  onChange,
  onReset,
  onAddConfiguration,
}: StorageFiltersToolbarProps) {
  const { t } = useT("os.storage");
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="flex-1">
        <FilterToolbar
          filters={[
            { key: "search", type: "SearchInput", label: t("common:SEARCH") },
            {
              key: "providers",
              type: "MultiSelect",
              label: t("STORAGE_FILTERS_TOOLBAR.PROVIDER"),
              props: {
                options: [
                  { label: "AWS", value: "AWS" },
                  { label: "Azure", value: "Azure" },
                  { label: "SFTP", value: "SftpStorage" },
                  { label: "AWS S3 Compatible", value: "S3Compatible" },
                ],
              },
            },
          ]}
          values={filters}
          defaultValues={{ search: "", providers: [], types: [] }}
          onChange={onChange}
          onReset={onReset}
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {t("common:ADD")}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onAddConfiguration}>
            <Plus className="mr-2 h-4 w-4" />
            {t("STORAGE_FILTERS_TOOLBAR.ADD_CONFIGURATION")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
