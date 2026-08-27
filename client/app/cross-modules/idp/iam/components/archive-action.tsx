import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { ARCHIVE_ERROR_MESSAGES, normalizeArchiveErrors } from "../constants/archive-error-messages";
import { useRoleArchiveImpact, usePermissionArchiveImpact } from "../hooks/use-archive-impact";
import { IArchiveImpactBase, IRoleArchiveImpact, IPermissionArchiveImpact } from "../models/archive-impact.model";

type ArchiveActionProps = {
  /** What is being archived, for the dialog copy and the button's accessible name. */
  entity: "role" | "permission";
  name: string;
  /** The per-row mutation. Instantiated by the caller *inside* the row, never hoisted. */
  archive: (input: { id: string; confirmRevokeFromUsers?: boolean }) => Promise<unknown>;
  isPending: boolean;
  itemId: string;
  /**
   * When set, the trash button renders visibly disabled and reveals this reason instead of the
   * confirm dialog. For entities the tenant may never archive -- built-in permissions -- which the
   * API does not refuse on its own, so the gate has to live here.
   */
  disabledReason?: string;
};

const plural = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;

/**
 * The consequence sentence, built from the counts the backend reported.
 *
 * Roles and permissions get different copy on purpose. Archiving a role takes away everything that
 * role granted; archiving a permission takes away one capability, and it reaches users through two
 * unrelated bindings -- a direct per-user grant and any roles that reference it -- which are
 * counted separately and must be described separately.
 */
const consequenceText = (
  entity: "role" | "permission",
  impact: IRoleArchiveImpact | IPermissionArchiveImpact,
): string => {
  const clauses: string[] = [];

  // Organization wording is omitted entirely for single-org tenants -- there is no such concept
  // there, and mentioning it would raise a question the reader cannot act on.
  if (impact.isMultiOrgEnabled && impact.organizationCount > 0) {
    clauses.push(`is used in ${plural(impact.organizationCount, "other organization")}`);
  }

  if (entity === "role") {
    if (impact.affectedUserCount > 0) {
      clauses.push(`is currently held by ${plural(impact.affectedUserCount, "user")}`);
    }
  } else {
    const permissionImpact = impact as IPermissionArchiveImpact;
    if (permissionImpact.affectedUserCount > 0) {
      clauses.push(`is granted directly to ${plural(permissionImpact.affectedUserCount, "user")}`);
    }
    if (permissionImpact.roleBindingCount > 0) {
      clauses.push(`is referenced by ${plural(permissionImpact.roleBindingCount, "role")}`);
    }
  }

  if (clauses.length === 0) {
    return "";
  }

  const subject = entity === "role" ? "This role" : "This permission";
  const effect =
    entity === "role"
      ? "Archiving it removes the role from all of them."
      : "Archiving it removes the permission from those users and roles.";

  return `${subject} ${clauses.join(", ")}. ${effect}`;
};

/** How long a click keeps the reason visible; a pointer leaving closes it sooner. */
const REASON_VISIBLE_MS = 3000;

/**
 * The trash button for a row that can never be archived.
 *
 * `aria-disabled` rather than `disabled`: a truly disabled button fires neither click nor hover, so
 * it could not surface the one thing the user opened it to learn. The icon drops its destructive
 * colour so the row still reads as inert at a glance.
 */
const ArchiveActionBlocked = ({
  entity,
  name,
  reason,
}: {
  entity: "role" | "permission";
  name: string;
  reason: string;
}) => {
  const [open, setOpen] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearDismiss = () => {
    if (dismissTimer.current !== undefined) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = undefined;
    }
  };

  useEffect(() => clearDismiss, []);

  const close = () => {
    clearDismiss();
    setOpen(false);
  };

  const hold = () => {
    clearDismiss();
    setOpen(true);
  };

  // Clicking is the only trigger a touch device has, and it is what the user tries first on a
  // button that looks dead, so it opens the tooltip and times it out on its own.
  const reveal = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    clearDismiss();
    setOpen(true);
    dismissTimer.current = setTimeout(() => setOpen(false), REASON_VISIBLE_MS);
  };

  return (
    <TooltipProvider>
      <Tooltip open={open}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-disabled
            aria-label={`Archive ${entity} ${name}`}
            className="cursor-not-allowed rounded-full opacity-50 hover:bg-transparent"
            onClick={reveal}
            onPointerEnter={hold}
            onPointerLeave={close}
            onFocus={hold}
            onBlur={close}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Trash button plus its confirm dialog, for one row.
 *
 * Both lists render this per row so that `isPending` is scoped to the row being archived. The
 * obvious model to copy -- `SignOutButton` in session-list-card -- takes `mutateAsync` and
 * `isPending` as props from a single parent hook, which would make one row's archive disable every
 * other row's confirm button.
 */
const ArchiveActionConfirm = ({ entity, name, archive, isPending, itemId }: ArchiveActionProps) => {
  const [open, setOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Guarded on `open`, so a list of N rows issues zero impact requests until one dialog is opened.
  const roleImpact = useRoleArchiveImpact(itemId, { enabled: open && entity === "role" });
  const permissionImpact = usePermissionArchiveImpact(itemId, {
    enabled: open && entity === "permission",
  });

  const { data: impact, isLoading, isError } = entity === "role" ? roleImpact : permissionImpact;

  const affectedUserCount = impact?.affectedUserCount ?? 0;
  const isBlocked = impact?.blocked === true;
  // Consent tracks affectedUserCount, not the active subset: the backend scrub is unconditional
  // over the organization's users, so an inactive holder loses the assignment just as permanently.
  const needsConsent = !!impact && !isBlocked && affectedUserCount > 0;
  const consequence = impact ? consequenceText(entity, impact) : "";

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Consent is never carried across openings, and the counts are refetched, so what the user
    // agreed to is always what they were just shown.
    if (!next) {
      setConsentChecked(false);
    }
  };

  const handleConfirm = async () => {
    try {
      await archive({ id: itemId, confirmRevokeFromUsers: needsConsent && consentChecked });
      showSuccessToast({
        description: `${entity === "role" ? "Role" : "Permission"} archived successfully`,
      });
      setOpen(false);
      setConsentChecked(false);
    } catch (error) {
      // Rejections arrive thrown, never as a resolved failure, so there is no `isSuccess` branch
      // here. The dialog deliberately stays open so the reason is read next to the action.
      const dictionary =
        normalizeArchiveErrors(error) ?? (isErrorWithErrors(error) ? error.errors : undefined);

      // An empty dictionary counts as absent. The HTTP client attaches `errors: {}` to a transport
      // failure, and a plain `??` would keep it, leaving getErrorMessage to answer with its generic
      // "Something went wrong." instead of the archive-specific copy.
      const errors =
        dictionary && Object.keys(dictionary).length > 0
          ? dictionary
          : "Something went wrong while archiving.";

      // The dictionary and the map go in raw; showErrorToast runs the lookup itself. Mapping here
      // first yielded a string[], and handleErrorMessages collapses any array to "An unexpected
      // error occurred." -- so the mapped copy was computed and then discarded.
      showErrorToast({ errors, customMessages: ARCHIVE_ERROR_MESSAGES });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* DialogTrigger rather than a manual setOpen: Radix needs the trigger reference to
          return focus to this button after Cancel, Escape or a successful archive. */}
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          aria-label={`Archive ${entity} ${name}`}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Archive this {entity}?</DialogTitle>
          <DialogDescription>
            {name} will be archived and hidden from this list. Existing records are kept, so nothing
            is permanently deleted.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-2" data-testid="archive-impact-loading">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {/* An unavailable preview must not make archiving impossible -- it degrades to the plain
            confirm this dialog had before impact counts existed. */}
        {isError && (
          <p className="text-sm text-muted-foreground">
            The impact of this change could not be loaded. You can still archive, but the number of
            affected users and organizations is unknown.
          </p>
        )}

        {isBlocked && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">
              {impact?.blockingReason === "Role_Has_Child_Roles"
                ? "This role has child roles. Retire or re-parent them before archiving."
                : "This item cannot be archived right now."}
            </p>
            {consequence && <p className="mt-1 text-muted-foreground">{consequence}</p>}
          </div>
        )}

        {!isBlocked && consequence && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p>{consequence}</p>
            <p className="mt-1 text-muted-foreground">
              Affected users keep their current access until they next sign in. This cannot be
              undone — restoring the {entity} later does not restore who held it.
            </p>
          </div>
        )}

        {needsConsent && (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={consentChecked}
              onCheckedChange={(checked) => setConsentChecked(checked === true)}
              aria-label={`Confirm removing this ${entity} from ${affectedUserCount} users`}
            />
            <span>
              I understand this removes the {entity} from {plural(affectedUserCount, "user")}
              {impact?.isMultiOrgEnabled && impact.organizationCount > 0
                ? " across all organizations"
                : ""}
              .
            </span>
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            // Blocked and still-loading both disable confirming: it must be impossible to agree to
            // a consequence before it is known, or to force one the backend will refuse anyway.
            disabled={isPending || isLoading || isBlocked || (needsConsent && !consentChecked)}
          >
            {isPending ? "Archiving..." : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Picks the variant for the row. Split so the blocked variant never mounts the impact queries or
 * the dialog it has no use for.
 */
export const ArchiveAction = (props: ArchiveActionProps) =>
  props.disabledReason ? (
    <ArchiveActionBlocked entity={props.entity} name={props.name} reason={props.disabledReason} />
  ) : (
    <ArchiveActionConfirm {...props} />
  );

export type { IArchiveImpactBase };
