"use client";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { useGetGithubRepos } from "@/cross-modules/devops/hooks/github-info";
import { providers } from "@/cross-modules/devops/models/git-dummy";
import {
  IRepository,
  iconMap,
} from "@/cross-modules/devops/models/github-info";
import { githubInfoService } from "@/cross-modules/devops/services/github-info.service";
import { cn, debounce } from "@/lib/utils";
import { Check, ChevronsUpDown, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
interface RepositorySelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectRepository: (repository: IRepository) => void;
  selectedRepositories?: IRepository[];
  title?: string;
  description?: string;
}
export const RepositorySelectionModal = ({
  open,
  onOpenChange,
  onSelectRepository,
  selectedRepositories = [],
  title = "Select repository",
  description = "Select the repositories you want to link to this project",
}: RepositorySelectionModalProps) => {
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [repoError, setRepoError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(0); // 0-based indexing for API
  const [allRepositories, setAllRepositories] = useState<IRepository[]>([]);
  const [hasMoreData, setHasMoreData] = useState<boolean>(true);
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [isLoadingRevoke, setIsLoadingRevoke] = useState(false);
  // Custom debounce implementation
  const debouncedSetSearch = useRef(
    debounce((value: string) => {
      setDebouncedSearchTerm(value);
    }, 500),
  ).current;
  useEffect(() => {
    debouncedSetSearch(searchTerm);
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [searchTerm, debouncedSetSearch]);
  // Reset pagination when debounced search term changes
  useEffect(() => {
    setCurrentPage(0);
    setAllRepositories([]);
    setHasMoreData(true);
  }, [debouncedSearchTerm]);
  const itemsPerPage = 10;
  // Query only active while modal is open
  const {
    data: repositories,
    isLoading,
    isFetching,
  } = useGetGithubRepos(
    open,
    debouncedSearchTerm || undefined,
    currentPage + 1, // API expects 1-based indexing
    itemsPerPage,
  );
  // Update accumulated repositories when new data arrives
  useEffect(() => {
    // Early return if no data
    if (!repositories?.data) {
      return;
    }
    // Handle the wrapped response structure
    const items = repositories.data.items;
    const totalCount = repositories.data.total_count || 0;
    // If total_count is 0, no repositories available
    if (totalCount === 0) {
      setAllRepositories([]);
      setHasMoreData(false);
      return;
    }
    // Check if items is a valid array
    if (!Array.isArray(items)) {
      setAllRepositories([]);
      setHasMoreData(false);
      return;
    }
    if (items.length > 0) {
      if (currentPage === 0) {
        // First page - replace all repositories
        setAllRepositories(items);
      } else {
        // Subsequent pages - append to existing repositories
        setAllRepositories((prev) => [...prev, ...items]);
      }
      // Check if there's more data to load
      const totalLoadedItems = (currentPage + 1) * itemsPerPage;
      const hasMore =
        totalLoadedItems < totalCount && items.length === itemsPerPage;
      setHasMoreData(hasMore);
    } else {
      // Empty array returned - no more data
      if (currentPage === 0) {
        setAllRepositories([]);
      }
      setHasMoreData(false);
    }
  }, [repositories, currentPage, itemsPerPage]);
  // Scroll handler for infinite scrolling
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50; // Load when 50px from bottom
      // Only load more if near bottom, has more data, not loading, and have some repositories
      if (
        isNearBottom &&
        hasMoreData &&
        !isLoading &&
        !isFetching &&
        allRepositories.length > 0
      ) {
        setCurrentPage((prev) => prev + 1);
      }
    },
    [hasMoreData, isLoading, isFetching, allRepositories.length],
  );
  // Click-outside to close dropdown
  useEffect(() => {
    if (!isPopoverOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !triggerRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setIsPopoverOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isPopoverOpen]);

  // Reset highlight when list changes
  useEffect(() => {
    setHighlightedIndex(allRepositories.length > 0 ? 0 : -1);
  }, [allRepositories]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLDivElement>(
      `[data-repo-index="${highlightedIndex}"]`,
    );
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);
  const handleSearchChange = useCallback(
    (value: string) => {
      const previousValue = searchTerm;
      setSearchTerm(value);
      if (previousValue !== value) {
        setCurrentPage(0);
        setAllRepositories([]);
        setHasMoreData(true);
      }
    },
    [searchTerm],
  );
  const handleSelectRepository = useCallback(() => {
    const repo = allRepositories.find((r) => String(r.id) === selectedRepoId);
    if (!repo) return;
    if (selectedRepositories.some((r) => r.id === repo.id)) {
      setRepoError("Repository already selected.");
      return;
    }
    setRepoError("");
    onSelectRepository(repo);
    setSelectedRepoId("");
  }, [
    selectedRepoId,
    allRepositories,
    selectedRepositories,
    onSelectRepository,
  ]);
  const handleRepoChange = useCallback((val: string) => {
    setSelectedRepoId(val);
    setRepoError("");
  }, []);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isPopoverOpen || allRepositories.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < allRepositories.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : allRepositories.length - 1,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
        const repo = allRepositories[idx];
        if (repo) {
          handleRepoChange(String(repo.id));
          setIsPopoverOpen(false);
          setHighlightedIndex(-1);
        }
      } else if (e.key === "Escape") {
        setIsPopoverOpen(false);
        setHighlightedIndex(-1);
      }
    },
    [isPopoverOpen, allRepositories, highlightedIndex, handleRepoChange],
  );
  const handleCancel = useCallback(() => {
    setSelectedRepoId("");
    setRepoError("");
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setCurrentPage(0);
    setAllRepositories([]);
    setHasMoreData(true);
    setIsPopoverOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);
  const handleCancelAccessModal = () => {
    setShowAccessModal(false);
  };
  const handleConfirm = async () => {
    try {
      setIsLoadingRevoke(true);
      await githubInfoService.revokeAccess();
    } catch (error) {
      console.error("Error revoking GitHub access:", error);
    } finally {
      setIsLoadingRevoke(false);
      setShowAccessModal(false);
      window.location.reload();
    }
  };
  const modalData = {
    dialogTitle: "Revoke Access",
    dialogSubtitle: <>You will no longer be able to access the repositories.</>,
    confirmButton: "Confirm",
    cancelButton: "Cancel",
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="mb-6 mt-4 flex flex-wrap gap-4">
          {providers.map((provider) => {
            const iconSrc = iconMap[provider.icon];
            const isGithub = provider.id === "github";
            return (
              <div
                key={provider.id}
                className={`flex items-center gap-2 ${isGithub ? "" : "cursor-not-allowed opacity-50"}`}>
                <input
                  type="radio"
                  checked={isGithub}
                  readOnly
                  disabled={!isGithub}
                  id={`${provider.id}-radio`}
                />
                <img src={iconSrc} alt={provider.name} width={20} height={20} />
                <label
                  htmlFor={`${provider.id}-radio`}
                  className="text-sm font-medium">
                  {provider.name}
                </label>
              </div>
            );
          })}
        </div>
        <div className="mb-2 gap-1 text-xs text-gray-500 sm:flex">
          {"Not seeing the repositories you expected here? "}
          <span
            className="cursor-pointer text-blue-600 underline transition-colors hover:text-blue-800"
            onClick={() => setShowAccessModal(true)}>
            <span className="flex items-center gap-1">
              Revoke repository access
              <ExternalLink className="h-3 w-3" />
            </span>
          </span>
          <Dialog
            open={showAccessModal}
            onOpenChange={(open) => {
              setShowAccessModal(open);
            }}>
            <ConfirmationModal
              data={modalData}
              onCancel={handleCancelAccessModal}
              onConfirm={handleConfirm}
              buttonState={{
                confirm: { disable: isLoadingRevoke },
              }}
            />
          </Dialog>
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium">
            Github repository{" "}
            {repositories?.data?.total_count
              ? `(${repositories.data.total_count} results)`
              : ""}
          </label>
          <div className="relative" onKeyDown={handleKeyDown}>
            <Button
              ref={triggerRef}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={isPopoverOpen}
              className="w-full justify-between"
              disabled={isLoading || isFetching}
              onClick={() => {
                setIsPopoverOpen((prev) => !prev);
                setHighlightedIndex(allRepositories.length > 0 ? 0 : -1);
              }}>
              {selectedRepoId
                ? allRepositories.find((r) => String(r.id) === selectedRepoId)
                    ?.full_name
                : isLoading || isFetching
                  ? "Loading repositories..."
                  : "Select a repository"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
            {isPopoverOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md">
                <div className="flex items-center border-b px-3">
                  <Input
                    autoFocus
                    placeholder="Search repositories..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="h-11 w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div
                  ref={listRef}
                  onScroll={handleScroll}
                  className="max-h-60 overflow-y-auto overflow-x-hidden p-1">
                  {!isLoading &&
                    !isFetching &&
                    allRepositories.length === 0 && (
                      <div className="py-6 text-center text-sm">
                        No repositories found.
                      </div>
                    )}
                  {(isLoading || isFetching) &&
                    allRepositories.length === 0 && (
                      <div className="flex items-center justify-center p-4 text-sm text-gray-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading repositories...
                      </div>
                    )}
                  {allRepositories.map((repo: IRepository, idx: number) => (
                    <div
                      key={repo.id}
                      data-repo-index={idx}
                      role="option"
                      aria-selected={selectedRepoId === String(repo.id)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleRepoChange(String(repo.id));
                        setIsPopoverOpen(false);
                        setHighlightedIndex(-1);
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={cn(
                        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                        highlightedIndex === idx &&
                          "bg-accent text-accent-foreground",
                        selectedRepoId === String(repo.id) &&
                          "bg-accent text-accent-foreground",
                      )}>
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedRepoId === String(repo.id)
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{repo.full_name}</span>
                      </div>
                    </div>
                  ))}
                  {(isLoading || isFetching) && allRepositories.length > 0 && (
                    <div className="flex items-center justify-center p-2 text-sm text-gray-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading more...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {repoError && (
            <div className="mt-1 text-xs text-red-500">{repoError}</div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedRepoId || isLoading || isFetching}
            onClick={handleSelectRepository}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
