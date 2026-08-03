import { FilterControls } from "@/components/filter-toolbar";
import { Badge } from "@/components/ui-kits/badge/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission";
import { RESOURCE_TYPE } from "@blocks-idp/iam/models/permission";
import { useRef, useState } from "react";

const MAX_DEPENDENT_PERMISSIONS = 5;

type AddDependentPermissionProps = {
  permissionsResource: string[];
  onChange: (data: string[]) => void;
};

export const AddDependentPermission = ({
  onChange,
  permissionsResource,
}: AddDependentPermissionProps) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const [open, setOpen] = useState(false);
  const [workingSet, setWorkingSet] = useState<string[]>([]);
  const snapshotRef = useRef<string[]>([]);
  const [filter, setFilter] = useState({
    page: 0,
    pageSize: 5,
    isBuiltIn: "",
    roles: [],
    type: 1,
    search: "",
  });

  const { data, isLoading } = useGetPermissions({
    ...filter,
    projectKey: tenantId,
  });

  const resetFilter = () => {
    setFilter({
      type: 1,
      page: 0,
      pageSize: 5,
      isBuiltIn: "",
      roles: [],
      search: "",
    });
  };

  const closeModal = () => {
    resetFilter();
    setWorkingSet([]);
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const initial = [...permissionsResource];
      snapshotRef.current = initial;
      setWorkingSet(initial);
      setOpen(true);
      return;
    }
    // X / Escape / overlay: keep live selections (already applied via onChange)
    closeModal();
  };

  const handleCancel = () => {
    onChange([...snapshotRef.current]);
    closeModal();
  };

  const handleAdd = () => {
    // Keep live selections; close without reverting
    closeModal();
  };

  const handleCheckedChange = (checked: boolean, resource: string) => {
    if (checked) {
      if (workingSet.length >= MAX_DEPENDENT_PERMISSIONS) return;
      const next = [...workingSet, resource];
      setWorkingSet(next);
      onChange(next);
      return;
    }
    const next = workingSet.filter((item) => item !== resource);
    setWorkingSet(next);
    onChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="h-[34px]"
        >
          Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-left">Assign Permissions</DialogTitle>
            <Badge
              variant="secondary"
              aria-label={`${workingSet.length} of ${MAX_DEPENDENT_PERMISSIONS} permissions selected`}
            >
              {workingSet.length}/{MAX_DEPENDENT_PERMISSIONS} selected
            </Badge>
          </div>
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
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell>
                      <Checkbox
                        checked={workingSet.includes(item.resource)}
                        onCheckedChange={(checked) => {
                          handleCheckedChange(checked as boolean, item.resource);
                        }}
                        aria-label={`Select ${item.name}`}
                      />
                    </TableCell>
                    <TableCell className="w-full">
                      <Badge variant="secondary" className="w-fit break-all">
                        {item.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[100px]">
                      {
                        RESOURCE_TYPE.find((resoruce) => resoruce.value === item.type.toString())
                          ?.label
                      }
                    </TableCell>
                  </TableRow>
                ))}
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
        <DialogFooter>
          <Button variant="outline" size="default" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="default" onClick={handleAdd}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
