import { useState } from "react";
import { ChevronRight, Eye, Pencil, Power, PowerOff, Trash2, Waypoints } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";
import { KVDetailItem } from "@blocks-idp/authentication/components/kv-detail-item";
import {
  keySourceLabel,
  SIGNING_ALGORITHMS,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

const algorithmLabel = (value: number) =>
  SIGNING_ALGORITHMS.find((a) => a.value === value)?.label ?? "—";

export type ExternalIdpEntryActions = {
  onToggleActive: (provider: ThirdPartyJwtProvider) => void;
  isTogglingActive: boolean;
  onOpen: (provider: ThirdPartyJwtProvider) => void;
  onEdit: (provider: ThirdPartyJwtProvider) => void;
  onMapClaims: (provider: ThirdPartyJwtProvider) => void;
  onDelete: (provider: ThirdPartyJwtProvider) => void;
};

type ExternalIdpEntryItemProps = ExternalIdpEntryActions & {
  provider: ThirdPartyJwtProvider;
};

function RowAction({
  label,
  tooltip,
  className,
  disabled,
  onClick,
  children,
}: Readonly<{
  label: string;
  tooltip: string;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 w-6 p-0", className)}
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A single configured external IdP, rendered as a row inside its platform's gallery card. The
 * issuer sits under the key so a row is identifiable folded; the rest of what it validates
 * unfolds below. Starts unfolded, since audience and key source are what tell two rows apart.
 */
export function ExternalIdpEntryItem({
  provider,
  onToggleActive,
  isTogglingActive,
  onOpen,
  onEdit,
  onMapClaims,
  onDelete,
}: Readonly<ExternalIdpEntryItemProps>) {
  const [expanded, setExpanded] = useState(true);
  const { isActive, key } = provider;

  const kvPairs = [
    {
      label: "Audience",
      value: provider.audiences?.length ? provider.audiences.join(", ") : "Any (validation off)",
    },
    { label: "Algorithm", value: provider.algorithms?.map(algorithmLabel).join(", ") || "—" },
    { label: "Key source", value: keySourceLabel(provider) },
    { label: "User ID claim", value: provider.claimsMapping?.userId || "—" },
  ];

  return (
    <li className={cn("rounded-md border border-border/60", !isActive && "opacity-75")}>
      <div
        className="flex cursor-pointer items-center gap-2.5 px-2.5 py-2"
        onClick={() => setExpanded((e) => !e)}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-90",
          )}
        />
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            isActive ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <code className="truncate font-mono text-xs font-medium">{key}</code>
            {!isActive && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-medium-emphasis">
                Inactive
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {provider.issuer || "No issuer (tokens without iss)"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <RowAction
            label={`Map JWT claim for ${key}`}
            tooltip="Map JWT claim"
            onClick={() => onMapClaims(provider)}
          >
            <Waypoints className="h-3 w-3" />
          </RowAction>
          <RowAction
            label={`View details for ${key}`}
            tooltip="Details"
            onClick={() => onOpen(provider)}
          >
            <Eye className="h-3 w-3" />
          </RowAction>
          <RowAction label={`Edit ${key}`} tooltip="Edit" onClick={() => onEdit(provider)}>
            <Pencil className="h-3 w-3" />
          </RowAction>
          <RowAction
            label={isActive ? `Disable ${key}` : `Enable ${key}`}
            tooltip={isActive ? "Disable" : "Enable"}
            className={
              isActive
                ? "text-emerald-600 hover:text-destructive"
                : "text-muted-foreground hover:text-emerald-600"
            }
            disabled={isTogglingActive}
            onClick={() => onToggleActive(provider)}
          >
            {isActive ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
          </RowAction>
          <RowAction
            label={`Delete ${key}`}
            tooltip="Delete"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(provider)}
          >
            <Trash2 className="h-3 w-3" />
          </RowAction>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/60 bg-muted/20 px-3 py-3">
          <div className="grid min-w-0 grid-cols-1 gap-3 overflow-hidden sm:grid-cols-2">
            {kvPairs.map(({ label, value }) => (
              <KVDetailItem key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
