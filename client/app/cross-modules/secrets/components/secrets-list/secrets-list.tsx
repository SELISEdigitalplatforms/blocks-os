import { ReactNode, useState } from "react";
import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { format } from "date-fns";
import { AddSecretModal } from "../add-secret-modal/add-secret-modal";
import { type SecretItem } from "../../constants/secret-key.enum";
import { useGetSecrets, useDeleteSecret } from "../../hooks/use-secrets";

const MY_SECRET_KEY = "my-secret";

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
const LoadingSkeleton = () => (
  <div className="grid gap-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <Card key={i}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-6 w-20 rounded" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-5 w-36 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// ─── Item ─────────────────────────────────────────────────────────────────────
const Item = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <p className="mb-2 text-sm font-medium text-low-emphasis">{label}</p>
    <div className="break-words text-base font-normal text-high-emphasis">{children}</div>
  </div>
);

// ─── Generic Secret Card ──────────────────────────────────────────────────────
const GenericSecretCard = ({ item }: { item: SecretItem }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { mutate: deleteSecret, isPending: isDeleting } = useDeleteSecret();
  const pairs = item.keyValuePairs ?? {};

  const secretName =
    pairs["secretName"] ?? pairs["SecretName"] ?? item.itemId;

  const createdAt = item.createdDate
    ? format(new Date(item.createdDate), "dd/MM/yyyy HH:mm")
    : null;

  const otherPairs = Object.entries(pairs).filter(
    ([k]) => k.toLowerCase() !== "secretname",
  );

  const handleDelete = () => {
    deleteSecret(item.itemId, {
      onSuccess: () => setShowDeleteDialog(false),
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle>{secretName}</CardTitle>
              {createdAt && (
                <p className="mt-0.5 text-xs text-muted-foreground">Created on {createdAt}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        {otherPairs.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {otherPairs.map(([key, value]) => (
                <Item key={key} label={key}>
                  <CopyToClipboardButton textToCopy={value}>
                    <span className="break-all">{value || "N/A"}</span>
                  </CopyToClipboardButton>
                </Item>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
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
              Are you sure you want to delete "<strong>{secretName}</strong>"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
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
      <Card className="flex flex-col items-center justify-center py-16">
        <KeyRound className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm text-muted-foreground">No secrets added yet.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <GenericSecretCard key={item.itemId} item={item} />
      ))}
    </div>
  );
}
