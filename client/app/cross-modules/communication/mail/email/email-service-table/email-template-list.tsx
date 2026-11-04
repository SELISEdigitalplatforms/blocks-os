import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { useMemo, useState } from "react";
import { IEmailConfig, IEmailTemplate } from "@blocks-communication/mail/models/email";
import { checkValidDate, formatDate, parseDateString } from "@/lib/utils";
import { FilterControls } from "@/components/filter-toolbar";
import { useTemplatesSortQueryParams } from "./template-filter-toolbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Button } from "@/components/ui-kits/button/button";
import { AlignLeft, Copy, MoreVertical, Trash } from "lucide-react";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { CloneTemplateDialog } from "@blocks-communication/mail/components/email-service/modals/clone-template/clone-template";
import { DeleteTemplateDialog } from "@blocks-communication/mail/components/email-service/modals/delete-template/delete-template";
import { TemplateConfigurationName } from "@blocks-communication/mail/email/email-service-table/template-configuration-name";
import { languageNameOf } from "@blocks-communication/mail/constants/template-organization";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { useT } from "@seliseblocks/genesis-os";

type EmailTemplateListProps = {
  templates: IEmailTemplate[];
  isLoading: boolean;
  /** The listed organization's configurations and the Default organization's. */
  emailConfigsData: IEmailConfig[];
  /** The project's languages, for the Language column. */
  languages?: Array<{ languageCode: string; languageName: string }>;
  /** The listed organization's name. */
  organizationName?: string;
  isMultiOrgEnabled?: boolean;
  onRowClick: (emailId: number | string) => void;
};
const LoadingSkeleton = () => (
  <div className="grid w-full gap-2">
    {Array.from({ length: 5 }).map((_, index) => (
      <Skeleton key={index} className="h-12 w-full rounded-xl" />
    ))}
  </div>
);
export const EmailTemplateList = ({
  templates,
  isLoading,
  emailConfigsData,
  languages,
  organizationName = "",
  isMultiOrgEnabled = false,
  onRowClick,
}: EmailTemplateListProps) => {
  const { t } = useT("os.communication.mail");
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { sortQueryParams, setSortQueryParams } = useTemplatesSortQueryParams();
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTemplateData, setSelectedTemplateData] = useState<IEmailTemplate | null>(null);
  const cloneEmailTemplate = (rowData: IEmailTemplate) => {
    setSelectedTemplateData(rowData);
    setIsCloneDialogOpen(true);
  };
  const DeleteEmailTemplate = (rowData: IEmailTemplate) => {
    setSelectedTemplateData(rowData);
    setIsDeleteDialogOpen(true);
  };
  const columns = useMemo<ColumnDef<IEmailTemplate>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => (
          <FilterControls.SortHeader
            label={t("common:NAME")}
            id="Name"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => <div className="truncate">{row.getValue("name")}</div>,
      },
      {
        accessorKey: "language",
        header: t("EMAIL_TEMPLATE_LIST.COLUMN_LANGUAGE"),
        cell: ({ row }) => (
          <div className="truncate">{languageNameOf(row.original.language, languages)}</div>
        ),
      },
      {
        accessorKey: "MailConfigurationId",
        header: t("EMAIL_TEMPLATE_LIST.COLUMN_CONFIGURATION"),
        cell: ({ row }) => (
          <TemplateConfigurationName template={row.original} configs={emailConfigsData} />
        ),
      },
      {
        accessorKey: "templateSubject",
        header: () => (
          <FilterControls.SortHeader
            label={t("EMAIL_TEMPLATE_LIST.COLUMN_SUBJECT")}
            id="TemplateSubject"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => <div className="truncate">{row.getValue("templateSubject")}</div>,
      },
      {
        accessorKey: "lastUpdatedDate",
        header: () => (
          <FilterControls.SortHeader
            label={t("EMAIL_TEMPLATE_LIST.COLUMN_LAST_MODIFIED")}
            id="LastUpdatedDate"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => {
          const dateValue = parseDateString(row.getValue("lastUpdatedDate"));
          return checkValidDate(dateValue) ? formatDate(dateValue) : "-";
        },
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          // const meta = table.options.meta as ExtendedMeta;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">{t("EMAIL_TEMPLATE_LIST.OPEN_MENU")}</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="cursor-pointer hover:no-underline"
                  onClick={() => onRowClick(row.original.itemId)}
                >
                  <AlignLeft className="mr-2 h-4 w-4" />
                  <span>{t("EMAIL_TEMPLATE_LIST.VIEW_DETAILS")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer hover:no-underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    cloneEmailTemplate(row.original);
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  <span>{t("EMAIL_TEMPLATE_LIST.CLONE_TEMPLATE")}</span>
                </DropdownMenuItem>
                {row.original.generatedBy !== "Tenant" && (
                  <DropdownMenuItem
                    className="cursor-pointer text-error hover:no-underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      DeleteEmailTemplate(row.original);
                    }}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    <span>{t("common:DELETE")}</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [sortQueryParams, setSortQueryParams, emailConfigsData, languages, onRowClick, t],
  );
  const table = useReactTable({
    data: templates,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  if (isLoading) return <LoadingSkeleton />;
  return (
    <Table className="text-sm">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className={header.id === "actions" ? "w-10" : ""}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:no-underline"
              onClick={() => onRowClick(row.original.itemId)}
              isHoverable
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cell.column.id === "actions" ? "text-right" : ""}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center">
              {t("EMAIL_TEMPLATE_LIST.NO_TEMPLATES")}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
        {!isLoading && selectedTemplateData && isCloneDialogOpen ? (
          <CloneTemplateDialog
            template={selectedTemplateData}
            organizationName={organizationName}
            showOrganization={isMultiOrgEnabled}
            onClose={() => setIsCloneDialogOpen(false)}
            onCloned={(itemId) => {
              setIsCloneDialogOpen(false);
              navigate(scoped(`email-management/communications/${itemId}`));
            }}
          />
        ) : null}
      </Dialog>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        {!isLoading && selectedTemplateData && isDeleteDialogOpen ? (
          <DeleteTemplateDialog
            template={selectedTemplateData}
            languageName={languageNameOf(selectedTemplateData.language, languages)}
            organizationName={organizationName}
            isMultiOrgEnabled={isMultiOrgEnabled}
            onClose={() => setIsDeleteDialogOpen(false)}
            onDeleted={() => setIsDeleteDialogOpen(false)}
          />
        ) : null}
      </Dialog>
    </Table>
  );
};
