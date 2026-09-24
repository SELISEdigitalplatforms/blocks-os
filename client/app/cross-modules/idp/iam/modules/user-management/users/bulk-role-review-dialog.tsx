import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import type { IBulkRolePreviewResponse } from "@blocks-idp/iam/models/user";
import type { BulkRolesMode } from "./bulk-roles-dialog";

export type BulkRoleReviewDialogProps = {
  open: boolean;
  mode: BulkRolesMode;
  organizationLabel: string;
  roleSlugs: string[];
  preview: IBulkRolePreviewResponse | null;
  /** How the matched set was expressed, for the "who was matched" summary. */
  matchedBy: string;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
};

/**
 * The last screen before anything is queued.
 *
 * It carries the whole safety burden of this feature: the write runs on IAM's
 * background worker, which reports nothing back, so once the operator clicks submit
 * there is no progress feed and no report to correct a misunderstanding. Every
 * number here came from the server a moment ago rather than being computed locally.
 */
export const BulkRoleReviewDialog = ({
  open,
  mode,
  organizationLabel,
  roleSlugs,
  preview,
  matchedBy,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: BulkRoleReviewDialogProps) => {
  const affectedCount = preview?.affectedCount ?? 0;
  const matchedCount = preview?.matchedCount ?? 0;
  const unchangedCount = preview?.unchangedCount ?? 0;
  const isRemove = mode === "remove";
  const nothingToDo = affectedCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-left">Review before applying</DialogTitle>
          <DialogDescription className="text-left">
            Nothing is submitted yet. These numbers came back from the server just now.
          </DialogDescription>
        </DialogHeader>

        {/* affectedCount, not matchedCount, is the headline: matched is the larger
            and more alarming number but includes users nothing happens to. Both are
            shown so the operator can reconcile them rather than wonder. */}
        <div className="rounded-lg border bg-muted/40 px-4 py-3">
          <p data-testid="bulk-review-headline" className="text-2xl font-bold text-high-emphasis">
            {affectedCount}{" "}
            <span className="text-base font-medium text-muted-foreground">
              users will be updated
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">in {organizationLabel}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-high-emphasis">
              {isRemove ? "Removing" : "Adding"}
            </span>
            {roleSlugs.map((slug) => (
              <Badge key={slug} variant={isRemove ? "error" : "info"}>
                {slug}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Every other role each user holds is kept.
          </p>
        </div>

        <div className="rounded-lg border px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Who was matched
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Matched</dt>
              <dd data-testid="bulk-review-matched" className="font-medium text-high-emphasis">
                {matchedCount} users
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">By</dt>
              <dd className="max-w-[60%] truncate text-right font-medium text-high-emphasis">
                {matchedBy}
              </dd>
            </div>
          </dl>
          {unchangedCount > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {unchangedCount} of the {matchedCount} matched users already{" "}
              {isRemove ? "do not have these roles" : "hold these roles"} and are left alone. There
              is no per-user role limit, so nobody is skipped for holding too many.
            </p>
          )}
        </div>

        {nothingToDo && (
          <p data-testid="bulk-review-no-change" className="text-sm text-muted-foreground">
            No user would change, so there is nothing to submit. Adjust the roles or the filter and
            try again.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Runs on IAM&rsquo;s background worker. You get a confirmation toast, not a progress bar.
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Back
          </Button>
          <Button
            type="button"
            size="default"
            variant={isRemove ? "destructive" : "default"}
            data-testid="bulk-review-submit"
            disabled={isSubmitting || nothingToDo}
            onClick={onSubmit}
          >
            {isSubmitting ? "Submitting…" : `Submit for ${affectedCount} users`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
