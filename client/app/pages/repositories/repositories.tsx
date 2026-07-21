import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useGetAssets, useAddAssets } from "@/hooks/use-project";
import { Plus, Github, FolderGit2 } from "lucide-react";
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
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Input } from "@/components/ui-kits/input/input";
import { IResource } from "@blocks-identifier/models/project.model";
import { IRepository } from "@/cross-modules/devops/models/github-info";
import { useDebounce } from "@seliseblocks/blocks-kit";
import { useValidateAuthorization } from "@/cross-modules/devops/hooks/github-info";
import { RepositorySelectionModal } from "@/components/repository-selection-modal/repository-selection-modal";
import ProviderButtons from "@/cross-modules/devops/components/deployment-steps/render-repos/render-provider";
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
    refetch,
  } = useGetAssets(groupId ?? "");
  useEffect(() => {
    setPageNumber(0);
  }, [debouncedSearchText]);
  const [repositoryModalOpen, setRepositoryModalOpen] = useState(false);
  const [selectRepositoryModalOpen, setSelectRepositoryModalOpen] =
    useState(false);
  const { data: _isAuthenticated, refetch: refetchAuthorization } =
    useValidateAuthorization();
  const { mutateAsync } = useAddAssets();
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
      await mutateAsync({
        tenantGroupId: groupId ?? "",
        resource: {
          resourceId: String(repo.id),
          name: repo.full_name,
          link: repo.html_url,
        },
      });
      toast({
        title: "Success",
        description: "Repository added successfully",
        variant: "success",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setSelectRepositoryModalOpen(false);
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
        cell: (repos) => (
          <div className="truncate">{repos.row.original.name}</div>
        ),
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
              onClick={() =>
                window.open(
                  repos.row.original.link,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              className="cursor-pointer text-blue-600 hover:underline">
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
    ],
    [],
  );
  const allResources = useMemo(
    () => resourcesResponse?.assets?.resources ?? [],
    [resourcesResponse?.assets?.resources],
  );
  const filteredResources = useMemo(() => {
    const search = debouncedSearchText.trim().toLowerCase();
    if (!search) return allResources;

    return allResources.filter(
      (resource) =>
        resource.name.toLowerCase().includes(search) ||
        resource.link.toLowerCase().includes(search),
    );
  }, [allResources, debouncedSearchText]);
  const paginatedResources = useMemo(() => {
    const start = pageNumber * pageSize;
    return filteredResources.slice(start, start + pageSize);
  }, [filteredResources, pageNumber, pageSize]);
  const table = useReactTable({
    data: paginatedResources,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const onPageChangeHandler = (page: number) => {
    setPageNumber(page);
  };
  const hasRepositories = allResources.length > 0;
  const isEmptyWithoutSearch = !hasRepositories && !searchText.trim();
  const repositoryModals = (
    <>
      <Dialog open={repositoryModalOpen} onOpenChange={setRepositoryModalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-lg border p-6 shadow-lg md:w-[425px]">
          <DialogHeader>
            <DialogTitle>Connect repository</DialogTitle>
            <DialogDescription>
              Select a Git provider to import an existing project from a Git
              Repository.
            </DialogDescription>
          </DialogHeader>
          <ProviderButtons
            destination="/intermediate-page"
            onClose={handleProviderClose}
          />
        </DialogContent>
      </Dialog>
      <RepositorySelectionModal
        open={selectRepositoryModalOpen}
        onOpenChange={setSelectRepositoryModalOpen}
        onSelectRepository={onAddRepo}
        title="Select repository"
        description="Select the repositories you want to link to this project"
      />
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
      <div className="flex flex-row justify-between md:items-center">
        <h4 className="text-lg font-semibold md:text-xl">Repositories</h4>
        <Button
          size="sm"
          variant="default"
          className="h-10 text-sm text-primary-foreground"
          onClick={handleAddRepositoryClick}>
          <Plus className="mr-2 h-4 w-4" />
          <span>Add</span>
        </Button>
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
                        <TableHead
                          key={header.id}
                          className="text-xs md:text-sm">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      )),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!filteredResources.length ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-sm text-muted-foreground md:text-base">
                        No repositories found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className="text-xs md:text-sm">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-2 md:py-3">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredResources.length > pageSize && (
                <div className="mt-5 flex flex-col items-center gap-4 md:flex-row md:justify-end">
                  <Pagination
                    page={pageNumber}
                    onChange={onPageChangeHandler}
                    totalCount={filteredResources.length}
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
