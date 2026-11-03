import { useMemo, useState } from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Button } from "@/components/ui-kits/button/button";
import { EllipsisVertical, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { EmptyState } from "@/components/ui-kits/empty-state";
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
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Badge } from "@/components/ui-kits/badge/badge";
import { useGetMFAConfig, useSaveMFAConfig } from "../../hooks/use-mfa-config";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { MFA_PROVIDER_DATA } from "../../utils/mfa-config";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useT } from "@seliseblocks/genesis-os";
type MethodInfo = {
  enable: boolean;
  name: string;
  type: number | null;
};
const LoadingSkelton = () => {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded" />
      ))}
    </div>
  );
};
export const ConfigureMFA = () => {
  const { t } = useT("os.idp.mfa");
  const { isLoading, isFetching, data } = useGetMFAConfig();
  const [openEnableDisableModal, setOpenEnableDisableModal] = useState<boolean>(false);
  const [methodInfo, setMethodInfo] = useState<MethodInfo>({
    enable: false,
    name: "",
    type: null,
  });
  const columns: ColumnDef<(typeof MFA_PROVIDER_DATA)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "provider",
        header: t("CONFIGURE_MFA.COLUMN_PROVIDER"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {<row.original.Icon className="h-4 w-4" />}
            <span>{row.original.label}</span>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("common:STATUS"),
        cell: ({ row }) => (
          <div className="flex max-w-[200px]">
            <Badge variant={data?.allowedMethods.includes(row.original.type) ? "success" : "error"}>
              {data?.allowedMethods.includes(row.original.type)
                ? t("common:ENABLED")
                : t("common:DISABLED")}
            </Badge>
          </div>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-full p-1">
                  <EllipsisVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={async (e) => {
                    e.stopPropagation();
                    setOpenEnableDisableModal(true);
                    setMethodInfo(() => ({
                      enable: !data?.allowedMethods.includes(row.original.type),
                      name: row.original.label,
                      type: row.original.type,
                    }));
                  }}
                >
                  {data?.allowedMethods.includes(row.original.type)
                    ? t("CONFIGURE_MFA.ACTION_DISABLE")
                    : t("CONFIGURE_MFA.ACTION_ENABLE")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [data?.allowedMethods, t],
  );
  const { isPending, mutateAsync } = useSaveMFAConfig();
  const onSaveHandler = async (methodInfo: MethodInfo) => {
    const userMfaTypes = new Set(data?.allowedMethods || []);
    const { type, enable } = methodInfo;
    if (!type) return;
    if (!enable) {
      if (userMfaTypes.has(type)) {
        userMfaTypes.delete(type);
      } else return;
    } else {
      userMfaTypes.add(type);
    }
    const payload = {
      enabled: !!userMfaTypes.size,
      allowedMethods: Array.from(userMfaTypes),
    };
    const res = await mutateAsync(payload);
    if (!res.isSuccess) return showErrorToast({ errors: res.errors });
    showSuccessToast({
      description: methodInfo.enable
        ? t("CONFIGURE_MFA.MFA_ENABLED", { name: methodInfo.name })
        : t("CONFIGURE_MFA.MFA_DISABLED", { name: methodInfo.name }),
    });
    setOpenEnableDisableModal(false);
  };
  const mfaConfigData = useMemo(() => {
    if (!data) return [];
    return MFA_PROVIDER_DATA;
  }, [data]);
  const table = useReactTable({
    data: mfaConfigData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const loading = isLoading || isFetching;
  return (
    <>
      <div>
        {loading && <LoadingSkelton />}
        {!loading &&
          (mfaConfigData.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={t("CONFIGURE_MFA.EMPTY_TITLE")}
              description={t("CONFIGURE_MFA.EMPTY_DESCRIPTION")}
            />
          ) : (
            <Card className="border-none shadow-none">
              <CardContent>
                <Table className="text-sm md:table-fixed">
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="hover:bg-transparent">
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
      </div>
      <Dialog open={openEnableDisableModal} onOpenChange={setOpenEnableDisableModal}>
        <ConfirmationModal
          onCancel={() => {}}
          onConfirm={() => onSaveHandler(methodInfo)}
          data={{
            dialogTitle: t("CONFIGURE_MFA.CONFIRM_TITLE"),
            dialogSubtitle: methodInfo.enable
              ? t("CONFIGURE_MFA.CONFIRM_ENABLE", { name: methodInfo.name })
              : t("CONFIGURE_MFA.CONFIRM_DISABLE", { name: methodInfo.name }),
          }}
          buttonState={{ confirm: { disable: isPending } }}
        />
      </Dialog>
    </>
  );
};
