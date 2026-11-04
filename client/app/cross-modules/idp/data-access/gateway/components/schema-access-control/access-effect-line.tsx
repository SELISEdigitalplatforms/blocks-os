import { cn } from "@/lib/utils";
import { AlertTriangle, HelpCircle, Info, ShieldAlert, ShieldCheck } from "lucide-react";

import type { AccessEffect, AccessRisk } from "../../utils/access-phrase";

const RISK_STYLE: Record<AccessRisk, string> = {
  open: "border-access-public-border bg-access-public-bg text-access-public-fg",
  caution: "border-access-user-border bg-access-user-bg text-access-user-fg",
  scoped: "border-access-custom-border bg-access-custom-bg text-access-custom-fg",
  none: "border-warning-500/50 bg-warning-100 text-warning-800",
  inherited:
    "border-access-inherited-border bg-access-inherited-bg text-access-inherited-fg",
  unknown: "border-base-error bg-blocks-error-100 text-blocks-error-800",
};

const RISK_ICON: Record<AccessRisk, typeof Info> = {
  open: ShieldAlert,
  caution: AlertTriangle,
  scoped: ShieldCheck,
  none: AlertTriangle,
  inherited: Info,
  unknown: HelpCircle,
};

/**
 * Who can do this, in one sentence.
 *
 * The old header stated the tier — "API is public" — and left the reader to
 * work out what that meant for this verb on this schema. The wording comes from
 * `access-phrase`, which also decides when the effect cannot honestly be
 * summarised at all.
 */
export function AccessEffectLine({
  effect,
  className,
}: Readonly<{
  effect: AccessEffect;
  className?: string;
}>) {
  const Icon = RISK_ICON[effect.risk];

  return (
    <output
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5",
        RISK_STYLE[effect.risk],
        className,
      )}
    >
      <Icon className="mt-px h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-semibold">{effect.heading}</p>
        <p className="mt-0.5 text-xs leading-relaxed opacity-90">{effect.text}</p>
      </div>
    </output>
  );
}

