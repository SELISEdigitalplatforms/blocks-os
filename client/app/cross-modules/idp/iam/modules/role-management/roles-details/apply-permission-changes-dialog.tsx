import { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { useRolePermissionChangeImpact } from "@blocks-idp/iam/hooks/use-role-permission-change-impact";

type ApplyPermissionChangesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleName: string;
  slug: string;
  organizationId: string;
  addPermissions: string[];
  removePermissions: string[];
  isPending: boolean;
  /** Runs the save. Resolves on success; rejects so this dialog can stay open on failure. */
  onConfirm: (propagateToAllOrganizations: boolean) => Promise<unknown>;
};

const plural = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;

/**
 * Confirms a pending role permission change, and -- only where the backend would honour it --
 * offers to apply the same change to every organization's copy of the role.
 *
 * The option defaults to ON. Editing the default organization's roles is how this platform defines
 * what a role means everywhere, so leaving the other organizations behind is the exceptional
 * choice and should be the one that takes a deliberate click. This dialog exists precisely so that
 * default is never silent.
 */
export const ApplyPermissionChangesDialog = ({
  open,
  onOpenChange,
  roleName,
  slug,
  organizationId,
  addPermissions,
  removePermissions,
  isPending,
  onConfirm,
}: ApplyPermissionChangesDialogProps) => {
  const [propagate, setPropagate] = useState(true);

  const {
    data: impact,
    isLoading,
    isError,
  } = useRolePermissionChangeImpact(
    { slug, organizationId, addPermissions, removePermissions },
    { enabled: open },
  );

  // Reset as the dialog closes, in the handler rather than an effect: what the user agreed to must
  // never be carried into a later, different diff, and the counts behind it are refetched for each
  // opening. Radix routes Escape and the overlay click through here too, so every route out of the
  // dialog resets, not just Cancel.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPropagate(true);
    }
    onOpenChange(next);
  };

  // An unavailable preview must not make saving impossible -- it degrades to the plain confirm.
  // Propagation is then withheld: offering to change every organization on the strength of numbers
  // that failed to load is exactly the blind platform-wide edit this dialog is here to prevent.
  const canPropagate = impact?.canPropagate === true;
  const willPropagate = canPropagate && propagate;

  const addCount = impact?.addCount ?? addPermissions.length;
  const removeCount = impact?.removeCount ?? removePermissions.length;

  const changeSummary = [
    addCount > 0 ? `adds ${plural(addCount, "permission")}` : "",
    removeCount > 0 ? `removes ${plural(removeCount, "permission")}` : "",
  ]
    .filter(Boolean)
    .join(" and ");

  const handleConfirm = async () => {
    try {
      await onConfirm(willPropagate);
      handleOpenChange(false);
    } catch {
      // The caller surfaces the reason as a toast. The dialog stays open so the user can retry or
      // cancel without rebuilding the selection they were about to save.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Apply permission changes?</DialogTitle>
          <DialogDescription>
            This change {changeSummary || "updates the permissions"} on <strong>{roleName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-2" data-testid="permission-change-impact-loading">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-muted-foreground">
            The impact of this change could not be loaded. You can still save it for this
            organization, but the number of affected users and organizations is unknown, so applying
            it to every organization is not offered.
          </p>
        )}

        {impact && (
          <div className="space-y-3 text-sm">
            {/* One sentence names the population, the next says what happens to it. Splitting the
                adds and the removes into separate paragraphs restated "N users currently hold this
                role" twice for a diff that does both. */}
            {impact.affectedUserCount > 0 && (
              <div
                className={
                  removeCount > 0
                    ? "rounded-md border border-destructive/40 bg-destructive/5 p-3"
                    : "text-muted-foreground"
                }
              >
                <p>
                  {plural(impact.affectedUserCount, "user")} currently hold this role
                  {impact.activeUserCount !== impact.affectedUserCount
                    ? ` (${impact.activeUserCount} active)`
                    : ""}
                  {willPropagate ? " across every organization" : " in this organization"}.
                </p>
                <p className="mt-1">
                  {addCount > 0 && <>They gain {plural(addCount, "permission")}. </>}
                  {removeCount > 0 && <>They lose {plural(removeCount, "permission")}.</>}
                </p>
                {removeCount > 0 && (
                  <p className="mt-1 text-muted-foreground">
                    Affected users keep their current access until they next sign in.
                  </p>
                )}
              </div>
            )}

            {canPropagate && (
              <label className="flex items-start gap-2">
                <Checkbox
                  className="mt-0.5"
                  checked={propagate}
                  onCheckedChange={(checked) => setPropagate(checked === true)}
                  aria-label="Apply this change to all organizations"
                />
                <span>
                  Also apply this to{" "}
                  {impact.organizationCount > 0
                    ? plural(impact.organizationCount, "other organization")
                    : "every other organization"}
                  .
                  <span className="mt-0.5 block text-muted-foreground">
                    Only the permissions added or removed here are applied. Organizations that have
                    already diverged in other ways are left as they are.
                  </span>
                </span>
              </label>
            )}

            {/* Surfaced, not swallowed: propagation logs a warning and moves on for these, and a
                skip nobody is told about is how the organizations drift apart in the first place. */}
            {willPropagate && impact.skippedOrganizationCount > 0 && (
              <p className="text-muted-foreground">
                {plural(impact.skippedOrganizationCount, "organization")} will be skipped because
                the role is missing or archived there.
              </p>
            )}

            {impact.isMultiOrgEnabled && !canPropagate && (
              <p className="text-muted-foreground">
                This change applies to this organization only. Other organizations&apos; copies of
                this role are managed from the default organization.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            // Saving is blocked while the preview loads: it must be impossible to agree to a
            // consequence before it is known.
            disabled={isPending || isLoading}
          >
            {isPending ? "Saving..." : willPropagate ? "Apply to all organizations" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
