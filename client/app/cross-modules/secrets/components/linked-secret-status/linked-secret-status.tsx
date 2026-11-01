import type { ReactNode } from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import {
  LINKED_SECRET_STATUS,
  type LinkedSecretStatus,
} from "@/cross-modules/secrets/models/secret.model";
import { tStatic, useT } from "@seliseblocks/genesis-os";

const getBrokenCopy = () => ({
  [LINKED_SECRET_STATUS.Archived]: {
    label: tStatic("os.secrets", "LINKED_SECRET_STATUS.LABEL_ARCHIVED"),
    help: tStatic("os.secrets", "LINKED_SECRET_STATUS.HELP_ARCHIVED"),
  },
  [LINKED_SECRET_STATUS.Missing]: {
    label: tStatic("os.secrets", "LINKED_SECRET_STATUS.LABEL_MISSING"),
    help: tStatic("os.secrets", "LINKED_SECRET_STATUS.HELP_MISSING"),
  },
});

/** Copy for the repair notice in an edit form, by broken status (read when shown). */
export const LINKED_SECRET_REPAIR_NOTICE = {
  get [LINKED_SECRET_STATUS.Archived]() {
    return tStatic("os.secrets", "LINKED_SECRET_STATUS.REPAIR_ARCHIVED");
  },
  get [LINKED_SECRET_STATUS.Missing]() {
    return tStatic("os.secrets", "LINKED_SECRET_STATUS.REPAIR_MISSING");
  },
};

export const linkedSecretRepairRequiredMessage = () =>
  tStatic("os.secrets", "LINKED_SECRET_STATUS.REPAIR_REQUIRED");

interface LinkedSecretStatusValueProps {
  status?: LinkedSecretStatus | null;
  /**
   * What the screen showed before statuses existed — "Configured", "Not set" and so on, in its
   * own markup. Rendered unchanged for every status that needs no warning, which keeps those
   * screens exactly as they were for healthy (including locked) secrets.
   */
  fallback: ReactNode;
}

/**
 * The secret field of a configuration card or row: an "Archived"/"Missing" badge with the
 * repair hint when the linked secret is broken, "Status unavailable" when it could not be
 * checked, and the screen's own text otherwise.
 */
export function LinkedSecretStatusValue({ status, fallback }: LinkedSecretStatusValueProps) {
  const { t } = useT("os.secrets");
  if (status === LINKED_SECRET_STATUS.Archived || status === LINKED_SECRET_STATUS.Missing) {
    const copy = getBrokenCopy()[status];
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="warning">{copy.label}</Badge>
        <p className="text-xs font-normal text-medium-emphasis">{copy.help}</p>
      </div>
    );
  }

  if (status === LINKED_SECRET_STATUS.Unavailable) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Focusable so keyboard users can reach the explanation too. */}
          <span tabIndex={0} className="text-muted-foreground">
            {t("LINKED_SECRET_STATUS.STATUS_UNAVAILABLE")}
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("LINKED_SECRET_STATUS.COULDN_T_CHECK_THE_LINKED")}</TooltipContent>
      </Tooltip>
    );
  }

  return <>{fallback}</>;
}
