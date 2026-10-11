import type { ReactNode } from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import {
  LINKED_SECRET_STATUS,
  type LinkedSecretStatus,
} from "@/cross-modules/secrets/models/secret.model";

const BROKEN_COPY = {
  [LINKED_SECRET_STATUS.Archived]: {
    label: "Archived",
    help: "The linked secret was archived. Edit this configuration and enter a new secret to repair it.",
  },
  [LINKED_SECRET_STATUS.Missing]: {
    label: "Missing",
    help: "The linked secret no longer exists. Edit this configuration and enter a new secret to repair it.",
  },
} as const;

/** Copy for the repair notice in an edit form, by broken status. */
export const LINKED_SECRET_REPAIR_NOTICE = {
  [LINKED_SECRET_STATUS.Archived]:
    "The linked secret was archived. Enter a new value to repair this configuration.",
  [LINKED_SECRET_STATUS.Missing]:
    "The linked secret was removed. Enter a new value to repair this configuration.",
} as const;

export const LINKED_SECRET_REPAIR_REQUIRED_MESSAGE =
  "A new secret is required to repair this configuration.";

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
  if (status === LINKED_SECRET_STATUS.Archived || status === LINKED_SECRET_STATUS.Missing) {
    const copy = BROKEN_COPY[status];
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
            Status unavailable
          </span>
        </TooltipTrigger>
        <TooltipContent>Couldn&apos;t check the linked secret right now.</TooltipContent>
      </Tooltip>
    );
  }

  return <>{fallback}</>;
}
