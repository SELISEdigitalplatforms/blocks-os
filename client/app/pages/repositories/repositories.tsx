import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGetAssets, useAddAssets, useDeleteAsset } from "@/hooks/use-project";
import { useProjectPermissions } from "@/hooks/use-project-access";
import { Plus, Github, FolderGit2, Trash2 } from "lucide-react";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Input } from "@/components/ui-kits/input/input";
import { AssetMutationStatus, IResource } from "@blocks-identifier/models/project.model";
import { IRepository } from "@/cross-modules/devops/models/github-info";
import { useDebounce } from "@seliseblocks/genesis-os/hooks";
import { useValidateAuthorization } from "@/cross-modules/devops/hooks/github-info";
import { RepositorySelectionModal } from "@/components/repository-selection-modal/repository-selection-modal";
import ProviderButtons from "@/cross-modules/devops/components/deployment-steps/render-repos/render-provider";
// Repositories linked before the field existed carry .NET's DateTime.MinValue, which is not a
// real creation date, so those read as unknown rather than 01/01/0001.
const formatCreatedDate = (value?: string) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() <= 1) return "—";
  return formatDate(parsed, true);
};
const ADD_REPOSITORY_MESSAGES: Record<AssetMutationStatus, string> = {
  Added: "Repository added successfully",
  Updated: "Repository details updated successfully",
  Unchanged: "Repository is already up to date",
  Restored: "Repository restored successfully",
};
const RepositoriesLoading = () => (
  <main className="p-6">
    <div className="flex flex-row justify-between md:items-center">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-10 w-20" />
    </div>
    <div className="mt-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-10 w-full" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  </main>
);
export const RepositoriesPage = () => {
  const groupId = useProjectStore().selectedTenantGroup;
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize] = useState(12);
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebounce(searchText, 500);
  const {
    data: resourcesResponse,
    isLoading: isLoadingAssets,
    isFetching: isFetchingAssets,
    refetch,
  } = useGetAssets(groupId ?? "", pageNumber, pageSize, debouncedSearchText);
  useEffect(() => {
    setPageNumber(0);
  }, [debouncedSearchText]);
  const [repositoryModalOpen, setRepositoryModalOpen] = useState(false);
  const [selectRepositoryModalOpen, setSelectRepositoryModalOpen] = useState(false);
  const [repositoryToRemove, setRepositoryToRemove] = useState<IResource | null>(null);
  const { data: _isAuthenticated, refetch: refetchAuthorization } = useValidateAuthorization();
  const { mutateAsync } = useAddAssets();
  const { mutateAsync: deleteAsset, isPending: isRemoving } = useDeleteAsset();

  // Adding and removing a repository are separate grants, and removing one also tears down
  // its running deployments — so the two buttons are gated apart.
  const { can } = useProjectPermissions(groupId ?? undefined);
  const canAdd = can("repositories", "add");
  const canDelete = can("repositories", "delete");
  // Handler for Add Repository button click
  const handleAddRepositoryClick = async () => {
    try {
      const authResult = await refetchAuthorization();
      if (authResult.data?.isSuccess) {
        setSelectRepositoryModalOpen(true);
      } else {
        setRepositoryModalOpen(true);
      }
    } catch (error) {
      console.error("Authorization check failed:", error);
      setRepositoryModalOpen(true);
    }
  };
  const handleProviderClose = (verifyAuth?: boolean) => {
    setRepositoryModalOpen(false);
    if (verifyAuth) {
      setSelectRepositoryModalOpen(true);
    }
  };
  const onAddRepo = async (repo: IRepository) => {
    try {
      setSelectRepositoryModalOpen(false);
      // A repository keeps its id across a rename, so the server may have refreshed the stored
      // name and link rather than linking a new repository. Say which one happened.
      const result = await mutateAsync({
        tenantGroupId: groupId ?? "",
        resource: {
          resourceId: String(repo.id),
          name: repo.full_name,
          link: repo.html_url,
        },
      });
      toast({
        title: "Success",
        description: ADD_REPOSITORY_MESSAGES[result?.status] ?? ADD_REPOSITORY_MESSAGES.Added,
        variant: "success",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setSelectRepositoryModalOpen(false);
    }
  };
  const onRemoveRepo = async () => {
    if (!repositoryToRemove) return;
    try {
      await deleteAsset({
        tenantGroupId: groupId ?? "",
        resourceId: repositoryToRemove.resourceId,
      });
      // Removing the only row on the last page would otherwise leave the table stranded past
      // the end of the list.
      if (pageResources.length === 1 && pageNumber > 0) setPageNumber(pageNumber - 1);
      setRepositoryToRemove(null);
      toast({
        title: "Success",
        description: "Repository removed successfully",
        variant: "success",
      });
      refetch();
    } catch (error) {
      setRepositoryToRemove(null);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };
  const columns = useMemo<ColumnDef<IResource>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.name}`.trim(),
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Name</span>
          </div>
        ),
        cell: (repos) => <div className="truncate">{repos.row.original.name}</div>,
      },
      {
        id: "repo link",
        accessorFn: (row) => `${row.link}`.trim(),
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Repo Link</span>
          </div>
        ),
        cell: (repos) => (
          <div className="truncate">
            <span
              onClick={() => window.open(repos.row.original.link, "_blank", "noopener,noreferrer")}
              className="cursor-pointer text-blue-600 hover:underline"
            >
              {repos.row.original.link}
            </span>
          </div>
        ),
      },
      {
        id: "source",
        accessorFn: (row) => `${row.resourceId}`.trim(),
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Source</span>
          </div>
        ),
        cell: () => (
          <div className="flex flex-row">
            <Github className="mr-2 inline-block h-5 w-5" />
            <div className="truncate">Github</div>
          </div>
        ),
      },
      {
        id: "created",
        accessorFn: (row) => `${row.createdDate ?? ""}`,
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Created</span>
          </div>
        ),
        cell: (repos) => (
          <div className="truncate">{formatCreatedDate(repos.row.original.createdDate)}</div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: (repos) => (
          <div className="flex justify-end">
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                aria-label={`Remove ${repos.row.original.name}`}
                onClick={() => setRepositoryToRemove(repos.row.original)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [],
  );
  // The server returns one page of resources plus the count of everything the current search
  // matches, so neither list is filtered or sliced again here.
  const pageResources = useMemo(
    () => resourcesResponse?.assets?.resources ?? [],
    [resourcesResponse?.assets?.resources],
  );
  const totalCount = resourcesResponse?.totalCount ?? 0;
  const table = useReactTable({
    data: pageResources,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const onPageChangeHandler = (page: number) => {
    setPageNumber(page);
  };
  const isSearching = Boolean(searchText.trim());
  // A search that matches nothing is not an empty project, so the search field has to stay.
  // While a fetch is in flight the counts still describe the previous query, which would flash
  // the empty state when a search is cleared.
  const isEmptyWithoutSearch = totalCount === 0 && !isSearching && !isFetchingAssets;
  const hasRepositories = totalCount > 0 || isSearching;
  const repositoryModals = (
    <>
      <Dialog open={repositoryModalOpen} onOpenChange={setRepositoryModalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-lg border p-6 shadow-lg md:w-[425px]">
          <DialogHeader>
            <DialogTitle>Connect repository</DialogTitle>
            <DialogDescription>
              Select a Git provider to import an existing project from a Git Repository.
            </DialogDescription>
          </DialogHeader>
          <ProviderButtons destination="/intermediate-page" onClose={handleProviderClose} />
        </DialogContent>
      </Dialog>
      <RepositorySelectionModal
        open={selectRepositoryModalOpen}
        onOpenChange={setSelectRepositoryModalOpen}
        onSelectRepository={onAddRepo}
        title="Select repository"
        description="Select the repositories you want to link to this project"
      />
      <Dialog
        open={Boolean(repositoryToRemove)}
        onOpenChange={(open) => !open && setRepositoryToRemove(null)}
      >
        <ConfirmationModal
          onCancel={() => setRepositoryToRemove(null)}
          onConfirm={onRemoveRepo}
          data={{
            dialogTitle: "Remove this repository?",
            dialogSubtitle: (
              <>
                <p>
                  <span className="font-medium">{repositoryToRemove?.name}</span> will no longer be
                  listed for this project.
                </p>
                <p>You can add it again later to bring it back.</p>
              </>
            ),
            confirmButton: "Remove",
          }}
          buttonState={{ confirm: { disable: isRemoving } }}
        />
      </Dialog>
    </>
  );

  if (isLoadingAssets) {
    return (
      <>
        <RepositoriesLoading />
        {repositoryModals}
      </>
    );
  }

  return (
    <main className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-4 md:items-end">
        <div>
          <h4 className="text-lg font-semibold md:text-xl">Repositories</h4>
          <p className="mt-0.5 text-sm text-medium-emphasis">
            Code that builds and deploys into every environment of this project
          </p>
        </div>
        {canAdd && (
          <Button
            size="sm"
            variant="default"
            className="h-10 text-sm text-primary-foreground"
            onClick={handleAddRepositoryClick}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Add repository</span>
          </Button>
        )}
      </div>
      <div className="mt-4">
        {isEmptyWithoutSearch ? (
          <EmptyState
            icon={FolderGit2}
            title="No repositories yet"
            description="Add your first repository to get started."
          />
        ) : (
          <Card>
            {hasRepositories && (
              <CardHeader>
                <div className="w-1/3">
                  <Input
                    placeholder="Search repositories..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>
              </CardHeader>
            )}
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="mt-4 px-4 py-3 hover:bg-transparent">
                    {table.getHeaderGroups().map((headerGroup) =>
                      headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="text-xs md:text-sm">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      )),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!pageResources.length ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-sm text-muted-foreground md:text-base"
                      >
                        {isFetchingAssets ? "Loading repositories..." : "No repositories found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className="text-xs md:text-sm">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-2 md:py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {totalCount > pageSize && (
                <div className="mt-5 flex flex-col items-center gap-4 md:flex-row md:justify-end">
                  <Pagination
                    page={pageNumber}
                    onChange={onPageChangeHandler}
                    totalCount={totalCount}
                    pageSize={pageSize}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      {repositoryModals}
    </main>
  );
};
