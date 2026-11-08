import { ColumnDef } from "@tanstack/react-table";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Play, Pause, Loader2 } from "lucide-react";
import { AIModelRowActionsDropdown } from "./aimodel-action-dropdown";
import { IModelInfo } from "@blocks-ai/types/aimodel.service.type";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.ai";
type TableColumnsOptions = {
  onEdit: (model: IModelInfo) => void;
  onDelete: (model: IModelInfo) => void;
  onValidate: (model: IModelInfo) => void;
  isValidating?: boolean;
  validatingRowId?: string | null;
  onRowMenuOpenChange?: (rowId: string, open: boolean) => void;
};
export const tableColumns = (
  custom: boolean,
  {
    onEdit,
    onDelete,
    onValidate,
    isValidating,
    validatingRowId,
    onRowMenuOpenChange,
  }: TableColumnsOptions,
): ColumnDef<IModelInfo>[] => {
  const providerColumn: ColumnDef<IModelInfo> = {
    id: "provider",
    accessorFn: (row) => row.Provider,
    header: () => (
      <div className="ml-2 font-semibold text-medium-emphasis sm:ml-0">
        {tStatic(I18N_MODULE, "AIMODEL_COLUMNS.PROVIDER_NAME")}
      </div>
    ),
    cell: ({ row }) => (
      <div className="ml-2 flex items-center gap-2 truncate sm:ml-0">
        {row.original.Provider || "-"}
      </div>
    ),
  };
  const columns: ColumnDef<IModelInfo>[] = [
    {
      id: "model",
      accessorFn: (row) => row.DisplayName || row.ModelName,
      header: () => (
        <div className="ml-2 font-semibold text-medium-emphasis sm:ml-0">
          {tStatic(I18N_MODULE, "AIMODEL_COLUMNS.MODEL")}
        </div>
      ),
      cell: ({ row }) => (
        <div className="ml-2 truncate sm:ml-0">
          {row.original.DisplayName || row.original.ModelName || "-"}
        </div>
      ),
    },
    ...(custom ? [providerColumn] : []),
    {
      id: "requestUrl",
      accessorFn: (row) => row.BaseUrl,
      header: () => (
        <div className="ml-2 font-semibold text-medium-emphasis sm:ml-0">
          {tStatic(I18N_MODULE, "AIMODEL_COLUMNS.REQUEST_URL")}
        </div>
      ),
      cell: ({ row }) => (
        <div className="ml-2 flex items-center gap-2 sm:ml-0">
          <CopyToClipboardButton textToCopy={row.original.BaseUrl} isHoverable>
            <span className="inline-block max-w-[180px] truncate">
              {row.original.BaseUrl || "-"}
            </span>
          </CopyToClipboardButton>
        </div>
      ),
    },
    {
      id: "apiKey",
      accessorFn: (row) => row.ApiKey,
      header: () => (
        <div className="ml-2 font-semibold text-medium-emphasis sm:ml-0">
          {tStatic(I18N_MODULE, "AIMODEL_COLUMNS.API_KEY")}
        </div>
      ),
      cell: ({ row }) => (
        <div className="ml-2 flex items-center gap-2 sm:ml-0">
          <span className="inline-block max-w-[180px] truncate">{row.original.ApiKey || "-"}</span>
        </div>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => row.Status,
      header: () => (
        <div className="ml-2 font-semibold text-medium-emphasis sm:ml-0">
          {tStatic(I18N_MODULE, "common:STATUS")}
        </div>
      ),
      cell: ({ row }) => {
        const isRowValidating = validatingRowId === row.original._id && isValidating;
        if (isRowValidating) {
          return (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs text-medium-emphasis">
                {tStatic(I18N_MODULE, "AIMODEL_COLUMNS.VALIDATING")}
              </span>
            </div>
          );
        }
        const isActive = row.original.Status === "valid";
        return (
          <Badge variant={isActive ? "success" : "error"} className="w-fit">
            {isActive
              ? tStatic(I18N_MODULE, "AIMODEL_COLUMNS.ACTIVE")
              : tStatic(I18N_MODULE, "AIMODEL_COLUMNS.INACTIVE")}
          </Badge>
        );
      },
    },
    {
      id: "validate",
      header: () => (
        <div className="ml-2 font-semibold text-medium-emphasis sm:ml-0">
          {tStatic(I18N_MODULE, "AIMODEL_COLUMNS.VALIDATE")}
        </div>
      ),
      cell: ({ row }) => {
        const isRowValidating = validatingRowId === row.original._id && isValidating;
        return (
          <div className="ml-2 flex items-center sm:ml-0">
            <Button
              size="icon"
              className="rounded-full"
              variant="ghost"
              disabled={isRowValidating}
              onClick={(event) => {
                event.stopPropagation();
                onValidate(row.original);
              }}
            >
              {isRowValidating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </div>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      header: () => (
        <div className="ml-2 font-semibold text-medium-emphasis sm:ml-0">
          {tStatic(I18N_MODULE, "common:ACTIONS")}
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-items-center">
          <AIModelRowActionsDropdown
            model={row.original}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenChange={(open) => {
              onRowMenuOpenChange?.(row.original._id, open);
            }}
          />
        </div>
      ),
    },
  ];
  return columns;
};
