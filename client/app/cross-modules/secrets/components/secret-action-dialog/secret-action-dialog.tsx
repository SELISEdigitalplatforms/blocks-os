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
  usePurgeSecret,
  useRestoreSecret,
  useSecretDependents,
  useUnlockSecret,
} from "@/cross-modules/secrets/hooks/use-secret-management";
import { describeSecretError } from "@/cross-modules/secrets/utils/secret-error";
import type { SecretResult } from "@/cross-modules/secrets/models/secret.model";
import {
  SecretDependentsNotice,
  type SecretDependentsAction,
} from "@/cross-modules/secrets/components/secret-dependents-notice/secret-dependents-notice";
import { useT, tStatic } from "@seliseblocks/genesis-os";

export type SecretLifecycleAction = "lock" | "unlock" | "delete" | "restore" | "purge";

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
    get body() { return tStatic("os.secrets", "SECRET_ACTION_DIALOG.WHILE_LOCKED_THE_VALUE_CANNOT"); },
    get confirm() { return tStatic("os.secrets", "SECRET_ACTION_DIALOG.LOCK"); },
    pending: "Locking…",
  },
  unlock: {
    title: (name) => `Unlock ${name}?`,
    get body() { return tStatic("os.secrets", "SECRET_ACTION_DIALOG.THE_VALUE_BECOMES_READABLE_AGAIN"); },
    get confirm() { return tStatic("os.secrets", "SECRET_ACTION_DIALOG.UNLOCK"); },
    pending: "Unlocking…",
  },
  // The backend's soft delete, presented as archive: the vault value is deliberately retained
  // so restore can bring the secret back. Saying "cannot be undone" here would simply be false.
  delete: {
    title: (name) => `Archive ${name}?`,
    get body() { return tStatic("os.secrets", "SECRET_ACTION_DIALOG.THE_SECRET_STOPS_WORKING_IMMEDIATELY"); },
    get confirm() { return tStatic("os.secrets", "SECRET_ACTION_DIALOG.ARCHIVE"); },
    pending: "Archiving…",
  },
  restore: {
    title: (name) => `Restore ${name}?`,
    get body() { return tStatic("os.secrets", "SECRET_ACTION_DIALOG.THE_SECRET_BECOMES_ACTIVE_AGAIN"); },
    get confirm() { return tStatic("os.secrets", "SECRET_ACTION_DIALOG.RESTORE"); },
    pending: "Restoring…",
  },
  purge: {
    title: (name) => `Purge ${name}?`,
    get body() { return tStatic("os.secrets", "SECRET_ACTION_DIALOG.THE_SECRET_AND_ITS_VALUE"); },
    get confirm() { return tStatic("os.secrets", "SECRET_ACTION_DIALOG.PURGE"); },
    pending: "Purging…",
    destructive: true,
  },
};

/** The actions that break a configuration still pointing at the secret. */
const ACTION_FAILED_KEYS: Record<SecretLifecycleAction, string> = {
  lock: "SECRET_ACTION_DIALOG.COULD_NOT_LOCK",
  unlock: "SECRET_ACTION_DIALOG.COULD_NOT_UNLOCK",
  delete: "SECRET_ACTION_DIALOG.COULD_NOT_ARCHIVE",
  restore: "SECRET_ACTION_DIALOG.COULD_NOT_RESTORE",
  purge: "SECRET_ACTION_DIALOG.COULD_NOT_PURGE",
};

const warnsAboutDependents = (action: SecretLifecycleAction): action is SecretDependentsAction =>
  action === "delete" || action === "purge";

interface SecretActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secret: SecretResult;
  action: SecretLifecycleAction;
}

/**
 * Confirmation for the lifecycle transitions. Nothing here fires without a click.
 *
 * Mount this only while it is open; a fresh mount is what clears a previous error.
 */
export function SecretActionDialog({
  open,
  onOpenChange,
  secret,
  action,
}: SecretActionDialogProps) {
  const { t } = useT("os.secrets");
  const [error, setError] = useState<string | null>(null);

  const lock = useLockSecret();
  const unlock = useUnlockSecret();
  const remove = useDeleteSecret();
  const restore = useRestoreSecret();
  const purge = usePurgeSecret();

  const mutation = { lock, unlock, delete: remove, restore, purge }[action];
  const copy = COPY[action];

  // Only Archive and Purge ask, and only while the dialog is open. The answer never blocks the
  // action; confirm waits only for the lookup itself, so the warning is not skipped by a fast click.
  const checksDependents = warnsAboutDependents(action);
  const dependents = useSecretDependents(secret.secretId, open && checksDependents);
  const isCheckingDependents = checksDependents && dependents.isLoading;

  const confirm = async () => {
    setError(null);
    try {
      await mutation.mutateAsync(secret.secretId);
      onOpenChange(false);
    } catch (cause) {
      setError(
        describeSecretError(cause, tStatic("os.secrets", ACTION_FAILED_KEYS[action])).message,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">{copy.title(secret.name)}</DialogTitle>
          {checksDependents && (
            <SecretDependentsNotice
              action={action}
              isLoading={dependents.isLoading}
              isError={dependents.isError}
              dependents={dependents.data?.dependents}
            />
          )}
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
            {t("common:CANCEL")}
          </Button>
          <Button
            type="button"
            variant={copy.destructive ? "destructive" : "default"}
            onClick={confirm}
            disabled={mutation.isPending || isCheckingDependents}
          >
            {mutation.isPending ? copy.pending : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
