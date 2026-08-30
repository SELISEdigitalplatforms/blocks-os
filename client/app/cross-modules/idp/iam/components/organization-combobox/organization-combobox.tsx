import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { cn } from "@/lib/utils";
import { useGetOrganizations } from "@blocks-idp/iam/hooks/use-organization";
import type { IOrganization } from "@blocks-idp/iam/models/organization";

const DEFAULT_ORGANIZATION_ID = "default";
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 500;

interface OrganizationComboboxProps {
  projectKey: string;
  value: string;
  onValueChange: (organizationId: string) => void;
  preselectedOrganizationIds?: Iterable<string>;
  initialSelectedName?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

const mergeOrganizations = (
  current: IOrganization[],
  incoming: IOrganization[],
): IOrganization[] => {
  const organizations = new Map(current.map((organization) => [organization.itemId, organization]));
  incoming.forEach((organization) => organizations.set(organization.itemId, organization));
  return [...organizations.values()];
};

export const OrganizationCombobox = ({
  projectKey,
  value,
  onValueChange,
  preselectedOrganizationIds = [],
  initialSelectedName,
  emptyMessage = "No organizations available",
  disabled = false,
}: OrganizationComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [loadedOrganizations, setLoadedOrganizations] = useState<IOrganization[]>([]);
  const [selectedOption, setSelectedOption] = useState(
    initialSelectedName ? { itemId: value, name: initialSelectedName } : undefined,
  );

  const preselectedIds = useMemo(
    () => new Set(preselectedOrganizationIds),
    [preselectedOrganizationIds],
  );

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearchTerm(searchTerm.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const { data, isLoading, isFetching, isPlaceholderData } = useGetOrganizations({
    projectKey,
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearchTerm || undefined,
    enabled: open && !disabled,
  });

  const [lastSearchTerm, setLastSearchTerm] = useState(debouncedSearchTerm);
  const [lastData, setLastData] = useState<typeof data>(undefined);

  if (lastSearchTerm !== debouncedSearchTerm) {
    setLastSearchTerm(debouncedSearchTerm);
    setLastData(undefined);
    setPage(0);
    setLoadedOrganizations([]);
  } else if (open && data && data !== lastData && !isPlaceholderData) {
    const organizations = data.organizations ?? [];
    setLastData(data);
    setLoadedOrganizations((current) =>
      page === 0 ? organizations : mergeOrganizations(current, organizations),
    );
  }

  const options = useMemo(() => {
    const organizations = loadedOrganizations.filter(
      (organization) =>
        organization.isDisabled !== true && organization.itemId !== DEFAULT_ORGANIZATION_ID,
    );
    const defaultMatchesSearch = "default".includes(debouncedSearchTerm.toLowerCase());
    if (defaultMatchesSearch) {
      return [
        { itemId: DEFAULT_ORGANIZATION_ID, name: "Default" },
        ...organizations.map(({ itemId, name }) => ({ itemId, name })),
      ];
    }
    return organizations.map(({ itemId, name }) => ({ itemId, name }));
  }, [debouncedSearchTerm, loadedOrganizations]);

  const totalCount = data?.totalCount ?? loadedOrganizations.length;
  const hasMore = loadedOrganizations.length < totalCount;
  const isInitialLoading = (isLoading || isFetching) && loadedOrganizations.length === 0;
  const isLoadingMore = isFetching && loadedOrganizations.length > 0;
  const selectedOrganization = loadedOrganizations.find(
    (organization) => organization.itemId === value,
  );
  const selectedLabel =
    value === DEFAULT_ORGANIZATION_ID
      ? "Default"
      : (selectedOrganization?.name ??
        (selectedOption?.itemId === value ? selectedOption.name : undefined) ??
        value);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearchTerm("");
      setDebouncedSearchTerm("");
      setPage(0);
      setLoadedOrganizations([]);
      setLastData(undefined);
    }
  }, []);

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50;
      if (isNearBottom && hasMore && !isFetching && loadedOrganizations.length > 0) {
        setPage((currentPage) => currentPage + 1);
      }
    },
    [hasMore, isFetching, loadedOrganizations.length],
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate text-sm font-normal">
            {value ? selectedLabel : "Select organization"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b px-3">
          <Input
            autoFocus
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search organizations..."
            className="h-11 w-full border-0 bg-transparent px-0 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div
          data-testid="organization-options-list"
          role="listbox"
          onScroll={handleScroll}
          className="max-h-60 overflow-y-auto overflow-x-hidden p-1"
        >
          {isInitialLoading && (
            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Loading organizations...
            </div>
          )}
          {!isInitialLoading && options.length === 0 && (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              {debouncedSearchTerm ? "No organizations found" : emptyMessage}
            </div>
          )}
          {options.map((organization) => {
            const isSelected = value === organization.itemId;
            const isPreselected = preselectedIds.has(organization.itemId);
            return (
              <button
                key={organization.itemId}
                type="button"
                role="option"
                aria-selected={isSelected || isPreselected}
                aria-disabled={isPreselected}
                onClick={() => {
                  if (isPreselected) return;
                  setSelectedOption(organization);
                  onValueChange(organization.itemId);
                  handleOpenChange(false);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted/50",
                  isSelected && "bg-accent text-accent-foreground",
                  isPreselected && "cursor-default",
                )}
              >
                <span className="flex-1 truncate">{organization.name}</span>
                {(isSelected || isPreselected) && (
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isPreselected ? "text-green-600 dark:text-green-400" : "text-primary",
                    )}
                  />
                )}
              </button>
            );
          })}
          {isLoadingMore && (
            <div className="flex items-center justify-center p-2 text-sm text-muted-foreground">
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Loading more...
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
