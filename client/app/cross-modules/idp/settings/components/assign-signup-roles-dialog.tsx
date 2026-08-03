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
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles";
import type { IRole } from "@blocks-idp/iam/models/role";
import { CirclePlus } from "lucide-react";
import { useMemo, useState } from "react";

type AssignSignupRolesDialogProps = {
  roles: IRole[];
  onAssign: (roles: IRole[]) => void;
};

export const AssignSignupRolesDialog = ({ roles, onAssign }: AssignSignupRolesDialogProps) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const [open, setOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<IRole[]>([]);
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

  const [prevSync, setPrevSync] = useState<{ open: boolean; roles: typeof roles } | undefined>(
    undefined,
  );
  if (!prevSync || prevSync.open !== open || prevSync.roles !== roles) {
    setPrevSync({ open, roles });
    if (open) {
      setSelectedRoles(roles);
    }
  }

  const selectedRoleSlugs = useMemo(
    () => new Set(selectedRoles.map((role) => role.slug)),
    [selectedRoles],
  );

  const handleCheckedChange = (checked: boolean, role: IRole) => {
    if (checked) {
      setSelectedRoles((current) =>
        current.some((item) => item.slug === role.slug) ? current : [...current, role],
      );
      return;
    }

    setSelectedRoles((current) => current.filter((item) => item.slug !== role.slug));
  };

  const handlePageChange = (page: number) => {
    setFilter((current) => ({ ...current, page }));
  };

  const resetDialog = () => {
    setSelectedRoles([]);
    setFilter({ page: 0, pageSize: 10, search: "" });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetDialog();
    }
    setOpen(nextOpen);
  };

  const handleSet = () => {
    onAssign(selectedRoles);
    resetDialog();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="h-7 bg-primary px-2.5 text-xs" type="button">
          <CirclePlus className="h-3.5 w-3.5 md:mr-1.5" />
          <span className="sr-only sm:not-sr-only">Manage Roles</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(92vh,720px)] w-[calc(100vw-1.5rem)] max-w-xl flex-col overflow-hidden sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">Assign roles</DialogTitle>
          <DialogDescription className="text-left">
            Select roles for new sign-up users. Set adds them to the list, then use Save on the page
            to persist them.
          </DialogDescription>
        </DialogHeader>
        <FilterControls.SearchInput
          value={filter.search}
          onChange={(value) => setFilter((current) => ({ ...current, search: value, page: 0 }))}
          className="h-fit w-full py-3"
          placeholder="Search by role name"
        />
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardContent className="max-h-[min(50vh,360px)] overflow-y-auto">
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              {isLoading ? (
                Array.from({ length: filter.pageSize }).map((_, index) => (
                  <div key={index} className="flex animate-pulse items-center space-x-2 py-2">
                    <div className="h-4 w-4 rounded bg-gray-200" />
                    <div className="h-4 w-24 rounded bg-gray-200" />
                    <div className="h-4 w-20 rounded bg-gray-200" />
                  </div>
                ))
              ) : data?.data?.length ? (
                data.data.map((item) => (
                  <div key={item.itemId} className="col-span-1 flex items-center py-2">
                    <Checkbox
                      checked={selectedRoleSlugs.has(item.slug)}
                      onCheckedChange={(value) => handleCheckedChange(!!value, item)}
                      aria-label={`Assign role ${item.name}`}
                    />
                    <div className="ml-2 min-w-0 flex-1">
                      <div className="truncate font-medium" title={item.name}>
                        {item.name}
                      </div>
                      <div className="truncate text-sm text-muted-foreground" title={item.slug}>
                        {item.slug}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full flex h-24 items-center justify-center text-sm text-muted-foreground">
                  No roles found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {!isLoading && data && data.totalCount > filter.pageSize ? (
          <div className="flex items-center md:justify-end">
            <Pagination
              page={filter.page}
              onChange={handlePageChange}
              totalCount={data.totalCount || 0}
              pageSize={filter.pageSize}
            />
          </div>
        ) : null}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" size="default" type="button">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" size="default" onClick={handleSet}>
            Set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
