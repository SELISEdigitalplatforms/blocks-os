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
import { useT } from "@seliseblocks/genesis-os";
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
  const { t } = useT("os.idp.users");
  const affectedCount = preview?.affectedCount ?? 0;
  const matchedCount = preview?.matchedCount ?? 0;
  const unchangedCount = preview?.unchangedCount ?? 0;
  const isRemove = mode === "remove";
  const nothingToDo = affectedCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-left">{t("BULK_ROLE_REVIEW_DIALOG.TITLE")}</DialogTitle>
          <DialogDescription className="text-left">
            {t("BULK_ROLE_REVIEW_DIALOG.DESCRIPTION")}
          </DialogDescription>
        </DialogHeader>

        {/* affectedCount, not matchedCount, is the headline: matched is the larger
            and more alarming number but includes users nothing happens to. Both are
            shown so the operator can reconcile them rather than wonder. */}
        <div className="min-w-0 rounded-lg border bg-muted/40 px-4 py-3">
          <p data-testid="bulk-review-headline" className="text-2xl font-bold text-high-emphasis">
            {affectedCount}{" "}
            <span className="text-base font-medium text-muted-foreground">
              {t("BULK_ROLE_REVIEW_DIALOG.USERS_WILL_BE_UPDATED", { count: affectedCount })}
            </span>
          </p>
          <p className="mt-1 wrap-break-word text-sm text-muted-foreground">
            {t("BULK_ROLE_REVIEW_DIALOG.IN_ORGANIZATION", { organization: organizationLabel })}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-high-emphasis">
              {isRemove ? t("BULK_ROLE_REVIEW_DIALOG.REMOVING") : t("BULK_ROLE_REVIEW_DIALOG.ADDING")}
            </span>
            {roleSlugs.map((slug) => (
              <Badge
                key={slug}
                variant={isRemove ? "error" : "info"}
                className="max-w-full break-all"
              >
                {slug}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("BULK_ROLE_REVIEW_DIALOG.OTHER_ROLES_KEPT")}
          </p>
        </div>

        {/* min-w-0 on the card and on every value cell: DialogContent is a
            fixed-width grid, and a grid or flex child defaults to min-width:auto,
            so one long unbreakable value would push the whole card past the
            dialog's edge instead of wrapping inside it. */}
        <div className="min-w-0 rounded-lg border px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("BULK_ROLE_REVIEW_DIALOG.WHO_WAS_MATCHED")}
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">{t("BULK_ROLE_REVIEW_DIALOG.MATCHED")}</dt>
              <dd
                data-testid="bulk-review-matched"
                className="min-w-0 text-right font-medium text-high-emphasis"
              >
                {t("BULK_ROLE_REVIEW_DIALOG.MATCHED_COUNT", { count: matchedCount })}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">{t("BULK_ROLE_REVIEW_DIALOG.BY")}</dt>
              {/* Wrapped, not truncated: this line is the whole point of the
                  summary -- it says which filter produced the number above, so
                  clipping it to "Asif ..." hides the thing being reconciled. */}
              <dd
                data-testid="bulk-review-matched-by"
                className="min-w-0 wrap-break-word text-right font-medium text-high-emphasis"
              >
                {matchedBy}
              </dd>
            </div>
          </dl>
          {unchangedCount > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                isRemove
                  ? "BULK_ROLE_REVIEW_DIALOG.UNCHANGED_REMOVE"
                  : "BULK_ROLE_REVIEW_DIALOG.UNCHANGED_ADD",
                { unchanged: unchangedCount, matched: matchedCount },
              )}
            </p>
          )}
        </div>

        {nothingToDo && (
          <p data-testid="bulk-review-no-change" className="text-sm text-muted-foreground">
            {t("BULK_ROLE_REVIEW_DIALOG.NO_CHANGE")}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {t("BULK_ROLE_REVIEW_DIALOG.BACKGROUND_WORKER")}
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {t("common:BACK")}
          </Button>
          <Button
            type="button"
            size="default"
            variant={isRemove ? "destructive" : "default"}
            data-testid="bulk-review-submit"
            disabled={isSubmitting || nothingToDo}
            onClick={onSubmit}
          >
            {isSubmitting
              ? t("BULK_ROLE_REVIEW_DIALOG.SUBMITTING")
              : t("BULK_ROLE_REVIEW_DIALOG.SUBMIT_FOR", { count: affectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
