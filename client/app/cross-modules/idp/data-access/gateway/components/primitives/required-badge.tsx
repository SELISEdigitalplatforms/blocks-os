import { cn } from "@/lib/utils";

import type { RequiredOn } from "../../models/data-service";
import { lazyLabels } from "../../utils/gateway-i18n";

/**
 * IsRequired is an enum, not a boolean — None | Insert | Update | Both. It is
 * rendered as a value rather than a toggle so that Insert and Update stay
 * distinguishable at a glance.
 */
const LABELS: Record<RequiredOn, string> = lazyLabels({
  None: "REQUIRED_BADGE.LABEL_NONE",
  Insert: "REQUIRED_BADGE.LABEL_INSERT",
  Update: "common:UPDATE",
  Both: "REQUIRED_BADGE.LABEL_BOTH",
});

const TITLES: Record<RequiredOn, string> = lazyLabels({
  None: "REQUIRED_BADGE.TITLE_NONE",
  Insert: "REQUIRED_BADGE.TITLE_INSERT",
  Update: "REQUIRED_BADGE.TITLE_UPDATE",
  Both: "REQUIRED_BADGE.TITLE_BOTH",
});

export function RequiredBadge({
  requiredOn,
  className,
}: Readonly<{
  requiredOn?: RequiredOn | null;
  className?: string;
}>) {
  const value: RequiredOn = requiredOn ?? "None";
  const isNone = value === "None";

  return (
    <span
      title={TITLES[value]}
      className={cn("text-xs", isNone ? "text-muted-foreground/60" : "text-foreground", className)}
    >
      {LABELS[value]}
    </span>
  );
}

