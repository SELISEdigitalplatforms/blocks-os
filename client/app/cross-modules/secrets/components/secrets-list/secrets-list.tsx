import { useState } from "react";
import { KeyRound, Pencil, Trash2, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { MaskedText } from "@/components/masked-text";
import { format } from "date-fns";
import { AddSecretModal } from "../add-secret-modal/add-secret-modal";
import { type SecretItem } from "../../constants/secret-key.enum";
import { useGetSecrets, useDeleteSecret } from "../../hooks/use-secrets";

const MY_SECRET_KEY = "my-secret";

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
const LoadingSkeleton = () => (
  <Card>
    <CardContent className="p-0">
      <div className="border-b px-4 py-3 flex items-center gap-4 bg-muted/40">
        <Skeleton className="h-3 w-4" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-4 last:border-0">
          <Skeleton className="h-4 w-4 rounded" />
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <div className="ml-auto flex gap-1.5">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

// ─── KV Row (expanded) ────────────────────────────────────────────────────────
const KVRow = ({ keyName, value }: { keyName: string; value: string }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <TableRow className="group bg-muted/20 hover:bg-muted/30">
      <TableCell className="w-8 pl-4" />
      <TableCell className="py-2 pl-8 font-mono text-xs text-muted-foreground" colSpan={1}>
        {keyName}
      </TableCell>
      <TableCell className="py-2" colSpan={2}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 font-mono text-xs">
            {value ? (
              revealed ? (
                <span className="break-all text-high-emphasis">{value}</span>
              ) : (
                <MaskedText text={value} length={Math.min(value.length, 36)} />
              )
            ) : (
              <span className="italic text-muted-foreground">empty</span>
            )}
          </div>
          {value && (
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-high-emphasis"
                onClick={() => setRevealed((r) => !r)}
              >
                {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
              <CopyToClipboardButton textToCopy={value}>
                <span />
              </CopyToClipboardButton>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell />
    </TableRow>
  );
};

// ─── Secret Row ───────────────────────────────────────────────────────────────
const SecretRow = ({ item, defaultExpanded = false }: { item: SecretItem; defaultExpanded?: boolean }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { mutate: deleteSecret, isPending: isDeleting } = useDeleteSecret();

  const pairs = item.keyValuePairs ?? {};
  const secretName = pairs["secretName"] ?? pairs["SecretName"] ?? item.itemId;
  const otherPairs = Object.entries(pairs).filter(([k]) => k.toLowerCase() !== "secretname");
  const createdAt = item.createdDate ? format(new Date(item.createdDate), "dd MMM yyyy") : "—";
  const hasKeys = otherPairs.length > 0;

  return (
    <>
      <TableRow
        className={`${hasKeys ? "cursor-pointer" : ""} hover:bg-muted/50`}
        onClick={() => hasKeys && setExpanded((e) => !e)}
      >
        <TableCell className="w-8 py-3.5 pl-4">
          {hasKeys ? (
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            />
          ) : (
            <span className="block h-4 w-4" />
          )}
        </TableCell>
        <TableCell className="py-3.5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium text-high-emphasis">{secretName}</span>
          </div>
        </TableCell>
        <TableCell className="py-3.5">
          <Badge variant="secondary" className="gap-1 text-xs font-normal">
            {otherPairs.length} {otherPairs.length === 1 ? "key" : "keys"}
          </Badge>
        </TableCell>
        <TableCell className="py-3.5 text-sm text-muted-foreground">{createdAt}</TableCell>
        <TableCell
          className="py-3.5 pr-4 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowEditModal(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {expanded && otherPairs.map(([k, v]) => (
        <KVRow key={k} keyName={k} value={v} />
      ))}

      <AddSecretModal
        mode="edit"
        editItem={item}
        open={showEditModal}
        onOpenChange={setShowEditModal}
        hideTrigger
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Secret</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "<strong>{secretName}</strong>"? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                deleteSecret(item.itemId, { onSuccess: () => setShowDeleteDialog(false) })
              }
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function SecretsList() {
  const { data: items = [], isLoading } = useGetSecrets(MY_SECRET_KEY);

  if (isLoading) return <LoadingSkeleton />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={KeyRound}
        title="No secrets yet"
        description="Add your first secret to get started."
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8 pl-4" />
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-high-emphasis">
                Name
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-high-emphasis">
                Keys
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-high-emphasis">
                Created On
              </TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <SecretRow key={item.itemId} item={item} defaultExpanded={index === 0} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
