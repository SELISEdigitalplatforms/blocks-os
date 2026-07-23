import { FilterControls } from "@/components/filter-toolbar"
import { Badge } from "@/components/ui-kits/badge/badge"
import { Button } from "@/components/ui-kits/button/button"
import { Card, CardContent } from "@/components/ui-kits/card/card"
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog"
import { Pagination } from "@/components/ui-kits/pagination/pagination"
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table"
import { cn } from "@/lib/utils"
import { useProjectStore } from "@seliseblocks/blocks-kit"
import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission"
import { IPermission, RESOURCE_TYPE } from "@blocks-idp/iam/models/permission"
import { Plus } from "lucide-react"
import { useMemo, useState } from "react"

type AddClientCredentialPermissionProps = {
  selectedResources: string[]
  onAdd: (resources: string[]) => void
  maxPermissions: number
}

export const AddClientCredentialPermission = ({
  onAdd,
  selectedResources,
  maxPermissions,
}: AddClientCredentialPermissionProps) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || ""
  const [open, setOpen] = useState<boolean>(false)
  const [pendingPermissions, setPendingPermissions] = useState<IPermission[]>([])
  const [filter, setFilter] = useState({
    page: 0,
    pageSize: 5,
    isBuiltIn: "",
    roles: [] as string[],
    search: "",
  })

  const { data, isLoading } = useGetPermissions(
    {
      ...filter,
      projectKey: tenantId,
    },
    { enabled: open && Boolean(tenantId) },
  )

  const pendingResources = useMemo(
    () => pendingPermissions.map((permission) => permission.resource),
    [pendingPermissions],
  )

  const handleCheckedChange = (checked: boolean, permission: IPermission) => {
    if (checked) {
      setPendingPermissions((prev) => [...prev, permission])
      return
    }
    setPendingPermissions((prev) =>
      prev.filter((item) => item.resource !== permission.resource),
    )
  }

  const handlePermissionCheckboxChange = (
    checked: boolean,
    permission: IPermission,
  ) => {
    if (
      checked &&
      selectedResources.length + pendingPermissions.length >= maxPermissions
    ) {
      return
    }
    handleCheckedChange(checked, permission)
  }

  const resetFilter = () => {
    setFilter({
      page: 0,
      pageSize: 5,
      isBuiltIn: "",
      roles: [],
      search: "",
    })
    setPendingPermissions([])
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetFilter()
        setOpen(value)
      }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="default"
          className="h-7 bg-primary px-2.5 text-xs"
          type="button"
          onClick={(e) => {
            e.stopPropagation()
          }}
          disabled={selectedResources.length >= maxPermissions}>
          <Plus className="h-3.5 w-3.5 md:mr-1.5" />
          <span className="sr-only sm:not-sr-only">Assign Permissions</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(92vh,720px)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col overflow-hidden sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">Assign Permissions</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <div>
          <FilterControls.SearchInput
            placeholder="Search by permission name"
            onChange={(search) =>
              setFilter((prev) => ({ ...prev, search, page: 0 }))
            }
            value={filter.search}
            className="h-fit w-full py-3"
          />
        </div>
        <h1
          className={cn(
            "text-sm font-semibold",
            pendingPermissions.length === maxPermissions && "text-error",
          )}>
          *You can select up to {maxPermissions} permissions.{" "}
          <span>{`(${pendingPermissions.length}/${maxPermissions})`}</span>
        </h1>
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardContent className="max-h-[min(50vh,360px)] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
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
                  data.data.map((item) => (
                    <TableRow key={item.itemId}>
                      <TableCell>
                        <Checkbox
                          checked={
                            selectedResources.includes(item.resource) ||
                            pendingResources.includes(item.resource)
                          }
                          disabled={selectedResources.includes(item.resource)}
                          onCheckedChange={(checked) => {
                            handlePermissionCheckboxChange(
                              checked as boolean,
                              item,
                            )
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
                          title={item.resource}>
                          {item.resource}
                        </span>
                      </TableCell>
                      <TableCell>
                        {
                          RESOURCE_TYPE.find(
                            (resource) =>
                              resource.value === item.type.toString(),
                          )?.label
                        }
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground">
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
            type="button"
            size="default"
            disabled={pendingPermissions.length === 0}
            onClick={() => {
              onAdd(pendingResources)
              resetFilter()
              setOpen(false)
            }}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
