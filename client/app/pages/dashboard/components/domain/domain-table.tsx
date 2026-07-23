import { useUpdateProject } from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import type { IDomain } from "@seliseblocks/blocks-kit/models";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Settings, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { DomainFormDialog } from "./domain-form-dialog";
import { DomainAction } from "./domain.constant";
import {
  showErrorToast,
  showSuccessToast,
} from "@seliseblocks/blocks-kit/utils";
import { CnameValidatorDialog } from "../cname/dialog";
import {
  Button,
  CopyToClipboardButton,
  RenderConditionally,
} from "@seliseblocks/blocks-kit/components";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ verified }: { verified: boolean }) =>
  verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
      Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      Unverified
    </span>
  );

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<IDomain>();

const CopyableDomainValue = ({
  value,
  muted = false,
}: {
  value: string;
  muted?: boolean;
}) => (
  <CopyToClipboardButton textToCopy={value} isHoverable className="min-w-0">
    <span
      className={cn(
        "break-all text-sm",
        muted ? "text-muted-foreground" : "text-high-emphasis",
      )}>
      {value}
    </span>
  </CopyToClipboardButton>
);

const buildColumns = (
  onEdit: (domain: IDomain) => void,
  onDeleteRequest: (domain: IDomain) => void,
  onCname: (domain: IDomain) => void,
) => [
  columnHelper.accessor("domain", {
    header: "Domain",
    cell: (info) => <CopyableDomainValue value={info.getValue()} />,
  }),
  columnHelper.accessor("isDomainVerified", {
    header: "DNS Status",
    cell: (info) => <StatusBadge verified={info.getValue()} />,
  }),
  columnHelper.accessor("cookieDomain", {
    header: "Cookie Domain",
    cell: (info) => <CopyableDomainValue value={info.getValue()} muted />,
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const domain = row.original;
      return (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Delete domain"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDeleteRequest(domain)}>
            <Trash2 className="h-4 w-4" />
          </Button>

          {/* Configure + CNAME lookup — only for unverified domains */}
          <RenderConditionally condition={!domain.isDomainVerified}>
            <Button
              variant="ghost"
              size="icon"
              title="Configure domain"
              onClick={() => onEdit(domain)}>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Validate CNAME"
              onClick={() => onCname(domain)}>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </Button>
          </RenderConditionally>
        </div>
      );
    },
  }),
];

// ─── Component ────────────────────────────────────────────────────────────────

interface DomainTableProps {
  data: IDomain[];
}

export const DomainTable = ({ data }: DomainTableProps) => {
  const { mutateAsync, isPending } = useUpdateProject();

  // ── Edit dialog ────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<IDomain | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleEdit = (domain: IDomain) => {
    setEditTarget(domain);
    setEditDialogOpen(true);
  };

  // ── Delete dialog ──────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<IDomain | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDeleteRequest = (domain: IDomain) => {
    setDeleteTarget(domain);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await mutateAsync({
        action: DomainAction.Delete,
        application: deleteTarget,
        applicationDomain: deleteTarget.domain,
      });
      if (res.isSuccess) {
        showSuccessToast({ description: "Domain deleted successfully" });
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch {
      showErrorToast({ errors: "Failed to delete domain" });
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  // ── CNAME dialog ───────────────────────────────────────────────────────────
  const [cnameTarget, setCnameTarget] = useState<IDomain | null>(null);
  const [cnameDialogOpen, setCnameDialogOpen] = useState(false);

  const handleCname = (domain: IDomain) => {
    setCnameTarget(domain);
    setCnameDialogOpen(true);
  };

  // ── Table ──────────────────────────────────────────────────────────────────
  const columns = buildColumns(handleEdit, handleDeleteRequest, handleCname);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      {/* Edit dialog — one instance, target swaps per row */}
      <DomainFormDialog
        open={editDialogOpen}
        application={editTarget}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditTarget(null);
        }}
      />

      {/* Delete confirmation — one instance, target swaps per row */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <ConfirmationModal
          data={{
            dialogTitle: "Delete Domain",
            dialogSubtitle: (
              <>
                Are you sure you want to delete{" "}
                <span className="break-all font-semibold">
                  {deleteTarget?.domain}
                </span>
                ? This action cannot be undone.
              </>
            ),
            confirmButton: "Delete",
            cancelButton: "Cancel",
          }}
          onCancel={() => setDeleteDialogOpen(false)}
          onConfirm={handleDeleteConfirm}
          buttonState={{ confirm: { disable: isPending } }}
        />
      </Dialog>

      {/* CNAME validator dialog — one instance, target swaps per row.
          Re-resolve the target from `data` so the open dialog reflects the
          refetched verification status instead of a stale click-time snapshot */}
      <CnameValidatorDialog
        open={cnameDialogOpen}
        domain={
          (cnameTarget && data.find((d) => d.domain === cnameTarget.domain)) ||
          cnameTarget
        }
        onOpenChange={(open) => {
          setCnameDialogOpen(open);
          if (!open) setCnameTarget(null);
        }}
      />

      {/* Table — min width keeps columns readable and scrolls horizontally
          on narrow screens, matching the repo table's behavior */}
      <div className="relative w-full overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "h-12 px-4 text-left text-xs font-semibold uppercase tracking-wide text-medium-emphasis",
                      header.id === "actions" && "w-32",
                    )}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-10 text-center text-sm text-muted-foreground">
                  No domains configured yet.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-2 md:px-4 md:py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};
