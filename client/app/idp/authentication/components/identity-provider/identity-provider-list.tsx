import { useCallback, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Globe,
  Key,
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  Shield,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";
import {
  useGetIdentityProviders,
  useUpdateIdentityProviderStatus,
} from "@blocks-idp/authentication/hooks/use-identity-provider";
import { IdentityProviderFormDialog } from "./identity-provider-form-dialog";

const PROVIDER_CONFIG: Record<
  string,
  { label: string; Icon: React.ElementType; iconBg: string; iconColor: string; badgeClass: string }
> = {
  social: {
    label: "Social",
    Icon: Users,
    iconBg: "bg-blue-100 dark:bg-blue-950",
    iconColor: "text-blue-600 dark:text-blue-400",
    badgeClass:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  "blocks-oidc": {
    label: "Blocks OIDC",
    Icon: Shield,
    iconBg: "bg-emerald-100 dark:bg-emerald-950",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  byos: {
    label: "BYOS",
    Icon: Key,
    iconBg: "bg-purple-100 dark:bg-purple-950",
    iconColor: "text-purple-600 dark:text-purple-400",
    badgeClass:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
  },
};

const DEFAULT_PROVIDER_CONFIG = {
  label: "OIDC",
  Icon: Shield,
  iconBg: "bg-muted",
  iconColor: "text-muted-foreground",
  badgeClass: "",
};

const TOKEN_AUTH_LABELS: Record<string, string> = {
  client_secret_basic: "Basic",
  client_secret_post: "Post",
  none: "Public",
};

const SKELETON_ROWS = 3;

export function IdentityProviderList() {
  const [editItem, setEditItem] = useState<IdentityProvider | null>(null);
  const { data, isLoading, isFetching } = useGetIdentityProviders();
  const { mutateAsync: updateStatus } = useUpdateIdentityProviderStatus();

  const providers = data?.data ?? [];

  const handleToggleStatus = useCallback(
    async (provider: IdentityProvider) => {
      try {
        const res = await updateStatus({
          id: provider.itemId!,
          request: { isActive: !provider.isActive },
        });
        if (!res.isSuccess) return showErrorToast({ errors: res.errors });
        showSuccessToast({
          description: `Identity provider ${provider.isActive ? "disabled" : "enabled"} successfully`,
        });
      } catch (err) {
        if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
        showErrorToast({ errors: "Something went wrong" });
      }
    },
    [updateStatus],
  );

  const columns = useMemo<ColumnDef<IdentityProvider>[]>(
    () => [
      {
        id: "provider",
        header: "Provider",
        cell: ({ row }) => {
          const p = row.original;
          const cfg = PROVIDER_CONFIG[p.providerType] ?? DEFAULT_PROVIDER_CONFIG;
          const Icon = cfg.Icon;
          return (
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg}`}
              >
                <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.displayName}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{p.provider}</p>
              </div>
            </div>
          );
        },
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => {
          const cfg = PROVIDER_CONFIG[row.original.providerType];
          return (
            <Badge variant="outline" className={`text-xs ${cfg?.badgeClass ?? ""}`}>
              {cfg?.label ?? row.original.providerType}
            </Badge>
          );
        },
      },
      {
        id: "tokenAuth",
        header: "Token Auth",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {TOKEN_AUTH_LABELS[row.original.tokenEndpointAuthMethod] ??
              row.original.tokenEndpointAuthMethod}
          </span>
        ),
      },
      {
        accessorKey: "clientId",
        header: "Client ID",
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate font-mono text-xs text-muted-foreground">
            {row.original.clientId}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const active = row.original.isActive;
          return (
            <Badge
              variant={active ? "default" : "secondary"}
              className={`gap-1.5 text-xs ${
                active
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                  : "text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
              />
              {active ? "Active" : "Inactive"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 data-[state=open]:bg-muted">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => setEditItem(p)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleToggleStatus(p)}
                    className={p.isActive ? "text-destructive focus:text-destructive" : ""}
                  >
                    {p.isActive ? (
                      <>
                        <PowerOff className="mr-2 h-4 w-4" />
                        Disable
                      </>
                    ) : (
                      <>
                        <Power className="mr-2 h-4 w-4" />
                        Enable
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [handleToggleStatus],
  );

  const table = useReactTable({
    data: providers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <Card>
        <CardContent className="p-0">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs font-semibold uppercase tracking-wide text-high-emphasis"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading || isFetching ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div>
                        <Skeleton className="mb-1 h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-8 w-8 rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} isHoverable>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Globe className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">No identity providers configured</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click "Add Identity Provider" to connect.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </CardContent>
      </Card>

      {editItem && (
        <IdentityProviderFormDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditItem(null);
          }}
          editItem={editItem}
        />
      )}
    </>
  );
}
