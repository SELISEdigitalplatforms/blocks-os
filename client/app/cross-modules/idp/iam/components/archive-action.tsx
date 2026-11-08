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
import {
  ARCHIVE_ERROR_MESSAGES,
  normalizeArchiveErrors,
} from "../constants/archive-error-messages";
import { useRoleArchiveImpact, usePermissionArchiveImpact } from "../hooks/use-archive-impact";
import {
  IArchiveImpactBase,
  IRoleArchiveImpact,
  IPermissionArchiveImpact,
} from "../models/archive-impact.model";
import { useT } from "@seliseblocks/genesis-os";

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

type TFn = ReturnType<typeof useT>["t"];

/**
 * The consequence sentence, built from the counts the backend reported.
 *
 * Roles and permissions get different copy on purpose. Archiving a role takes away everything that
 * role granted; archiving a permission takes away one capability, and it reaches users through two
 * unrelated bindings -- a direct per-user grant and any roles that reference it -- which are
 * counted separately and must be described separately.
 */
const consequenceText = (
  t: TFn,
  entity: "role" | "permission",
  impact: IRoleArchiveImpact | IPermissionArchiveImpact,
): string => {
  const clauses: string[] = [];

  // Organization wording is omitted entirely for single-org tenants -- there is no such concept
  // there, and mentioning it would raise a question the reader cannot act on.
  if (impact.isMultiOrgEnabled && impact.organizationCount > 0) {
    clauses.push(
      t("ARCHIVE_ACTION.CLAUSE_USED_IN_ORGANIZATIONS", { count: impact.organizationCount }),
    );
  }

  if (entity === "role") {
    if (impact.affectedUserCount > 0) {
      clauses.push(t("ARCHIVE_ACTION.CLAUSE_HELD_BY_USERS", { count: impact.affectedUserCount }));
    }
  } else {
    const permissionImpact = impact as IPermissionArchiveImpact;
    if (permissionImpact.affectedUserCount > 0) {
      clauses.push(
        t("ARCHIVE_ACTION.CLAUSE_GRANTED_TO_USERS", { count: permissionImpact.affectedUserCount }),
      );
    }
    if (permissionImpact.roleBindingCount > 0) {
      clauses.push(
        t("ARCHIVE_ACTION.CLAUSE_REFERENCED_BY_ROLES", {
          count: permissionImpact.roleBindingCount,
        }),
      );
    }
  }

  if (clauses.length === 0) {
    return "";
  }

  return entity === "role"
    ? t("ARCHIVE_ACTION.CONSEQUENCE_ROLE", { clauses: clauses.join(", ") })
    : t("ARCHIVE_ACTION.CONSEQUENCE_PERMISSION", { clauses: clauses.join(", ") });
};

const getConsentLabel = (
  t: TFn,
  entity: "role" | "permission",
  users: string,
  acrossOrganizations: boolean,
): string => {
  if (entity === "role") {
    return acrossOrganizations
      ? t("ARCHIVE_ACTION.CONSENT_ROLE_ALL_ORGANIZATIONS", { users })
      : t("ARCHIVE_ACTION.CONSENT_ROLE", { users });
  }
  return acrossOrganizations
    ? t("ARCHIVE_ACTION.CONSENT_PERMISSION_ALL_ORGANIZATIONS", { users })
    : t("ARCHIVE_ACTION.CONSENT_PERMISSION", { users });
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
  const { t } = useT("os.idp.iam-ui");
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
            aria-label={
              entity === "role"
                ? t("ARCHIVE_ACTION.ARIA_ARCHIVE_ROLE", { name })
                : t("ARCHIVE_ACTION.ARIA_ARCHIVE_PERMISSION", { name })
            }
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
  const { t } = useT("os.idp.iam-ui");
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
  const consequence = impact ? consequenceText(t, entity, impact) : "";
  const consentUsers = t("ARCHIVE_ACTION.USER_COUNT", { count: affectedUserCount });
  const acrossOrganizations = !!impact?.isMultiOrgEnabled && impact.organizationCount > 0;
  const consentLabel = getConsentLabel(t, entity, consentUsers, acrossOrganizations);

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
        description:
          entity === "role"
            ? t("ARCHIVE_ACTION.ARCHIVED_ROLE")
            : t("ARCHIVE_ACTION.ARCHIVED_PERMISSION"),
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
          : t("ARCHIVE_ACTION.ARCHIVE_FAILED");

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
          aria-label={
            entity === "role"
              ? t("ARCHIVE_ACTION.ARIA_ARCHIVE_ROLE", { name })
              : t("ARCHIVE_ACTION.ARIA_ARCHIVE_PERMISSION", { name })
          }
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {entity === "role"
              ? t("ARCHIVE_ACTION.TITLE_ROLE")
              : t("ARCHIVE_ACTION.TITLE_PERMISSION")}
          </DialogTitle>
          <DialogDescription>{t("ARCHIVE_ACTION.DESCRIPTION", { name })}</DialogDescription>
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
          <p className="text-sm text-muted-foreground">{t("ARCHIVE_ACTION.IMPACT_UNAVAILABLE")}</p>
        )}

        {isBlocked && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">
              {impact?.blockingReason === "Role_Has_Child_Roles"
                ? t("ARCHIVE_ACTION.BLOCKED_CHILD_ROLES")
                : t("ARCHIVE_ACTION.BLOCKED_GENERIC")}
            </p>
            {consequence && <p className="mt-1 text-muted-foreground">{consequence}</p>}
          </div>
        )}

        {!isBlocked && consequence && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p>{consequence}</p>
            <p className="mt-1 text-muted-foreground">
              {entity === "role"
                ? t("ARCHIVE_ACTION.WARNING_ROLE")
                : t("ARCHIVE_ACTION.WARNING_PERMISSION")}
            </p>
          </div>
        )}

        {needsConsent && (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              // `shrink-0`, matching endpoint-row and domain-delete-dialog: as a flex item next to
              // wrapping text the 16px box is squeezed below its size, and checking it widens the
              // box again because the tick gives it a min-content width it did not have empty.
              className="mt-0.5 shrink-0"
              checked={consentChecked}
              onCheckedChange={(checked) => setConsentChecked(checked === true)}
              aria-label={
                entity === "role"
                  ? t("ARCHIVE_ACTION.ARIA_CONSENT_ROLE", { count: affectedUserCount })
                  : t("ARCHIVE_ACTION.ARIA_CONSENT_PERMISSION", { count: affectedUserCount })
              }
            />
            <span>{consentLabel}</span>
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("common:CANCEL")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            // Blocked and still-loading both disable confirming: it must be impossible to agree to
            // a consequence before it is known, or to force one the backend will refuse anyway.
            disabled={isPending || isLoading || isBlocked || (needsConsent && !consentChecked)}
          >
            {isPending ? t("ARCHIVE_ACTION.ARCHIVING") : t("ARCHIVE_ACTION.ARCHIVE")}
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
