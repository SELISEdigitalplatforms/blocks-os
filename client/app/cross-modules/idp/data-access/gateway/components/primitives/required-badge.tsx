import { cn } from "@/lib/utils";

import type { RequiredOn } from "../../models/data-service";

/**
 * IsRequired is an enum, not a boolean — None | Insert | Update | Both. It is
 * rendered as a value rather than a toggle so that Insert and Update stay
 * distinguishable at a glance.
 */
const LABELS: Record<RequiredOn, string> = {
  None: "—",
  Insert: "Insert",
  Update: "Update",
  Both: "Both",
};

const TITLES: Record<RequiredOn, string> = {
  None: "Never required",
  Insert: "Required when the record is created",
  Update: "Required when the record is updated",
  Both: "Required on create and update",
};

export function RequiredBadge({
  requiredOn,
  className,
}: {
  requiredOn?: RequiredOn | null;
  className?: string;
}) {
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

