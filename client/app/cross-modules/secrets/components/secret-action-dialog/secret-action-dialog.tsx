import { useState } from "react";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  useDeleteSecret,
  useLockSecret,
  useRestoreSecret,
  useUnlockSecret,
} from "@/cross-modules/secrets/hooks/use-secret-management";
import { describeSecretError } from "@/cross-modules/secrets/utils/secret-error";
import type { SecretResult } from "@/cross-modules/secrets/models/secret.model";

export type SecretLifecycleAction = "lock" | "unlock" | "delete" | "restore";

interface Copy {
  title: (name: string) => string;
  body: string;
  confirm: string;
  pending: string;
  destructive?: boolean;
}

const COPY: Record<SecretLifecycleAction, Copy> = {
  lock: {
    title: (name) => `Lock ${name}?`,
    body: "While locked, the value cannot be read by anyone, including administrators. Metadata stays visible and the value stays in the store. You can unlock it again at any time.",
    confirm: "Lock",
    pending: "Locking…",
  },
  unlock: {
    title: (name) => `Unlock ${name}?`,
    body: "The value becomes readable again to whoever the access list allows.",
    confirm: "Unlock",
    pending: "Unlocking…",
  },
  delete: {
    title: (name) => `Delete ${name}?`,
    // A soft delete: the vault value is deliberately retained so restore can bring the secret
    // back. Saying "cannot be undone" here would simply be false.
    body: "The secret stops working immediately and is hidden from the default list. This is a soft delete — you can restore it later from the Deleted filter.",
    confirm: "Delete",
    pending: "Deleting…",
    destructive: true,
  },
  restore: {
    title: (name) => `Restore ${name}?`,
    body: "The secret becomes active again with its previous value.",
    confirm: "Restore",
    pending: "Restoring…",
  },
};

interface SecretActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secret: SecretResult;
  action: SecretLifecycleAction;
}

/**
 * Confirmation for the four lifecycle transitions. Nothing here fires without a click.
 *
 * Mount this only while it is open; a fresh mount is what clears a previous error.
 */
export function SecretActionDialog({
  open,
  onOpenChange,
  secret,
  action,
}: SecretActionDialogProps) {
  const [error, setError] = useState<string | null>(null);

  const lock = useLockSecret();
  const unlock = useUnlockSecret();
  const remove = useDeleteSecret();
  const restore = useRestoreSecret();

  const mutation = { lock, unlock, delete: remove, restore }[action];
  const copy = COPY[action];

  const confirm = async () => {
    setError(null);
    try {
      await mutation.mutateAsync(secret.secretId);
      onOpenChange(false);
    } catch (cause) {
      setError(describeSecretError(cause, `Could not ${action} the secret.`).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">{copy.title(secret.name)}</DialogTitle>
          <DialogDescription className="text-left">{copy.body}</DialogDescription>
        </DialogHeader>

        {error && <Banner variant="destructive">{error}</Banner>}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={copy.destructive ? "destructive" : "default"}
            onClick={confirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? copy.pending : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
