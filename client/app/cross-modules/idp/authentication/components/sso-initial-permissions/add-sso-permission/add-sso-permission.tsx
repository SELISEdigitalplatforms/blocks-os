import { FilterControls } from "@/components/filter-toolbar";
import { Badge } from "@/components/ui-kits/badge/badge";
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
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission";
import { IPermission, RESOURCE_TYPE } from "@blocks-idp/iam/models/permission";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
type AddSSOPermissionProps = {
  permissions: IPermission[];
  onAdd: (data: IPermission[]) => void;
};
export const AddSSOPermission = ({ onAdd, permissions }: AddSSOPermissionProps) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const [open, setOpen] = useState<boolean>(false);
  const [selectedPermission, setSelectedPermissions] = useState<IPermission[]>([]);
  const [filter, setFilter] = useState({
    page: 0,
    pageSize: 5,
    isBuiltIn: "",
    roles: [],
    search: "",
  });
  const { data, isLoading } = useGetPermissions(
    {
      ...filter,
      projectKey: tenantId,
    },
    { enabled: open && Boolean(tenantId) },
  );
  const onClickHandler = async () => {
    onAdd(selectedPermission);
    resetFilter();
    setOpen(false);
  };
  const onCheckedChangeHandler = (checked: boolean, permission: IPermission) => {
    if (checked) {
      return setSelectedPermissions((prev) => [...prev, permission]);
    }
    setSelectedPermissions((prev) => prev.filter((item) => item.resource !== permission.resource));
  };
  const handlePermissionCheckboxChange = (checked: boolean, permission: IPermission) => {
    if (checked && permissionsResource.length + selectedPermission.length >= 5) {
      return;
    }
    onCheckedChangeHandler(checked, permission);
  };
  const resetFilter = () => {
    setFilter({
      page: 0,
      pageSize: 5,
      isBuiltIn: "",
      roles: [],
      search: "",
    });
    setSelectedPermissions([]);
  };
  // Plain derivation: the compiler declines to memoize this mapping, and nothing observes the
  // array's identity (it is only read inside this component), so the useMemo bought nothing.
  const permissionsResource = permissions.map((item) => item.resource);
  const selectedPermissionsResource = useMemo(() => {
    return selectedPermission.map((item) => item.resource) || [];
  }, [selectedPermission]);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetFilter();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="default"
          className="h-7 bg-primary text-xs px-2.5"
          onClick={(e) => {
            e.stopPropagation();
          }}
          disabled={permissions.length >= 5}
        >
          <Plus className="h-3.5 w-3.5 md:mr-1.5" />
          <span className="sr-only sm:not-sr-only">Assign Permissions</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(92vh,720px)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col overflow-hidden sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">Assign Permissions</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <div>
          <FilterControls.SearchInput
            placeholder="Search by permission name"
            onChange={(search) => setFilter((prev) => ({ ...prev, search, page: 0 }))}
            value={filter.search}
            className="h-fit w-full py-3"
          />
        </div>
        <h1
          className={cn("text-sm font-semibold", selectedPermission.length === 5 && "text-error")}
        >
          *You can select up to 5 permissions. <span>{`(${selectedPermission.length}/5)`}</span>
        </h1>
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardContent className="max-h-[min(50vh,360px)] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: filter.pageSize }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Skeleton className="h-4 w-4 rounded" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-40 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-full max-w-[220px] rounded" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16 rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.data?.length ? (
                  (data.data as IPermission[]).map((item) => (
                    <TableRow key={item.itemId}>
                      <TableCell>
                        <Checkbox
                          checked={
                            permissionsResource.includes(item.resource) ||
                            selectedPermissionsResource.includes(item.resource)
                          }
                          disabled={permissionsResource.includes(item.resource)}
                          onCheckedChange={(checked) => {
                            handlePermissionCheckboxChange(checked as boolean, item);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="w-fit">
                          {item.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className="block min-w-0 max-w-[220px] truncate text-sm text-muted-foreground"
                          title={item.resource}
                        >
                          {item.resource}
                        </span>
                      </TableCell>
                      <TableCell>
                        {
                          RESOURCE_TYPE.find((resource) => resource.value === item.type.toString())
                            ?.label
                        }
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No permissions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="flex items-center justify-end">
          {!isLoading && data && data.totalCount > filter.pageSize && (
            <Pagination
              page={filter.page}
              pageSize={filter.pageSize}
              onChange={(page) => setFilter((prev) => ({ ...prev, page }))}
              totalCount={data.totalCount}
            />
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" size="default">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="default"
            onClick={onClickHandler}
            disabled={selectedPermission.length === 0}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
