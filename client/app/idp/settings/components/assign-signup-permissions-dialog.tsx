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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table"
import { useProjectStore } from "@seliseblocks/blocks-kit"
import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission"
import { IPermission, RESOURCE_TYPE } from "@blocks-idp/iam/models/permission"
import { CirclePlus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

const MAX_SIGNUP_PERMISSIONS = 5

type AssignSignupPermissionsDialogProps = {
  permissions: IPermission[]
  onAssign: (permissions: IPermission[]) => void
}

export const AssignSignupPermissionsDialog = ({
  permissions,
  onAssign,
}: AssignSignupPermissionsDialogProps) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || ""
  const [open, setOpen] = useState(false)
  const [selectedPermissions, setSelectedPermissions] = useState<IPermission[]>([])
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

  useEffect(() => {
    if (open) {
      setSelectedPermissions(permissions)
    }
  }, [open, permissions])

  const selectedPermissionResources = useMemo(
    () => new Set(selectedPermissions.map((permission) => permission.resource)),
    [selectedPermissions],
  )

  const handleCheckedChange = (checked: boolean, permission: IPermission) => {
    if (checked) {
      if (selectedPermissions.length >= MAX_SIGNUP_PERMISSIONS) {
        return
      }
      setSelectedPermissions((current) =>
        current.some((item) => item.resource === permission.resource)
          ? current
          : [...current, permission],
      )
      return
    }

    setSelectedPermissions((current) =>
      current.filter((item) => item.resource !== permission.resource),
    )
  }

  const resetDialog = () => {
    setSelectedPermissions([])
    setFilter({
      page: 0,
      pageSize: 5,
      isBuiltIn: "",
      roles: [],
      search: "",
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetDialog()
    }
    setOpen(nextOpen)
  }

  const handleSet = () => {
    onAssign(selectedPermissions)
    resetDialog()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="h-7 bg-primary px-2.5 text-xs" type="button">
          <CirclePlus className="h-3.5 w-3.5 md:mr-1.5" />
          <span className="sr-only sm:not-sr-only">Manage Permissions</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(92vh,720px)] w-[calc(100vw-1.5rem)] max-w-2xl flex-col overflow-hidden sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">Assign Permissions</DialogTitle>
          <DialogDescription className="text-left">
            Select up to {MAX_SIGNUP_PERMISSIONS} permissions for new sign-up users. Set adds them to
            the list, then use Save on the page to persist them.
          </DialogDescription>
        </DialogHeader>
        <FilterControls.SearchInput
          placeholder="Search by permission name"
          onChange={(search) => setFilter((current) => ({ ...current, search, page: 0 }))}
          value={filter.search}
          className="h-fit w-full py-3"
        />
        <p className="text-sm font-semibold">
          You can select up to {MAX_SIGNUP_PERMISSIONS} permissions. (
          {selectedPermissions.length}/{MAX_SIGNUP_PERMISSIONS})
        </p>
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardContent className="max-h-[min(50vh,360px)] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length ? (
                  data.data.map((item) => {
                    const isChecked = selectedPermissionResources.has(item.resource)
                    const isAtLimit =
                      !isChecked && selectedPermissions.length >= MAX_SIGNUP_PERMISSIONS

                    return (
                      <TableRow key={item.itemId}>
                        <TableCell>
                          <Checkbox
                            checked={isChecked}
                            disabled={isAtLimit}
                            onCheckedChange={(checked) =>
                              handleCheckedChange(checked as boolean, item)
                            }
                            aria-label={`Assign permission ${item.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="w-fit max-w-[200px] truncate">
                            {item.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {
                            RESOURCE_TYPE.find(
                              (resource) => resource.value === item.type.toString(),
                            )?.label
                          }
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-sm text-muted-foreground">
                      {isLoading ? "Loading..." : "No permissions found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {!isLoading && data && data.totalCount > filter.pageSize ? (
          <div className="flex items-center justify-end">
            <Pagination
              page={filter.page}
              pageSize={filter.pageSize}
              onChange={(page) => setFilter((current) => ({ ...current, page }))}
              totalCount={data.totalCount}
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
  )
}
