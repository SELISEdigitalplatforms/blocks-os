import { FilterControls } from "@/components/filter-toolbar";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { IRole } from "@blocks-idp/iam/models/role";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

type AddClientCredentialRoleProps = {
  selectedSlugs: string[];
  onAdd: (slugs: string[]) => void;
};

export const AddClientCredentialRole = ({ onAdd, selectedSlugs }: AddClientCredentialRoleProps) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const [open, setOpen] = useState<boolean>(false);
  const [pendingRoles, setPendingRoles] = useState<IRole[]>([]);
  const [filter, setFilter] = useState({ page: 0, pageSize: 10, search: "" });

  const { data, isLoading } = useGetRoles(
    {
      page: filter.page,
      pageSize: filter.pageSize,
      sort: { property: "Name", isDescending: false },
      filter: { search: filter.search },
    },
    { enabled: open && Boolean(tenantId) },
  );

  const pendingSlugs = useMemo(() => pendingRoles.map((role) => role.slug), [pendingRoles]);

  const handleCheckedChange = (checked: boolean, role: IRole) => {
    if (checked) {
      setPendingRoles((prev) => [...prev, role]);
      return;
    }
    setPendingRoles((prev) => prev.filter((item) => item.slug !== role.slug));
  };

  const handlePageChange = (page: number) => setFilter((prev) => ({ ...prev, page }));

  const reset = () => {
    setPendingRoles([]);
    setFilter({ page: 0, pageSize: 10, search: "" });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset();
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="h-7 bg-primary px-2.5 text-xs" type="button">
          <Plus className="h-3.5 w-3.5 md:mr-1.5" />
          <span className="sr-only sm:not-sr-only">Assign Role</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(92vh,720px)] w-[calc(100vw-1.5rem)] max-w-xl flex-col overflow-hidden sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">Assign roles</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <div>
          <FilterControls.SearchInput
            value={filter.search}
            onChange={(value) => setFilter((prev) => ({ ...prev, search: value, page: 0 }))}
            className="h-fit w-full py-3"
            placeholder="Search by role name"
          />
        </div>
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardContent className="max-h-[min(50vh,360px)] overflow-y-auto">
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              {isLoading ? (
                Array.from({ length: filter.pageSize }).map((_, idx) => (
                  <div key={idx} className="flex animate-pulse items-center space-x-2 py-2">
                    <div className="h-4 w-4 rounded bg-gray-200" />
                    <div className="h-4 w-24 rounded bg-gray-200" />
                    <div className="h-4 w-20 rounded bg-gray-200" />
                  </div>
                ))
              ) : data?.data?.length ? (
                data.data.map((item) => (
                  <div key={item.itemId} className="col-span-1 flex items-center py-2">
                    <Checkbox
                      checked={
                        selectedSlugs.includes(item.slug) || pendingSlugs.includes(item.slug)
                      }
                      disabled={selectedSlugs.includes(item.slug)}
                      onCheckedChange={(value) => handleCheckedChange(!!value, item)}
                    />
                    <div className="ml-2 flex flex-col">
                      <div className="max-w-[150px] truncate" title={item.name}>
                        {item.name}
                      </div>
                      <div
                        className="max-w-[150px] truncate text-sm text-muted-foreground"
                        title={item.slug}
                      >
                        {item.slug}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-24 items-center justify-center">No roles are found</div>
              )}
            </div>
          </CardContent>
        </Card>
        <div>
          {!isLoading && data && data.totalCount > filter.pageSize && (
            <div className="flex items-center md:justify-end">
              <Pagination
                page={filter.page}
                onChange={handlePageChange}
                totalCount={data.totalCount || 0}
                pageSize={filter.pageSize}
              />
            </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" size="default">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            size="default"
            disabled={pendingRoles.length === 0}
            onClick={() => {
              onAdd(pendingSlugs);
              reset();
              setOpen(false);
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
