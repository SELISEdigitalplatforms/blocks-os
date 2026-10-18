import { Button } from "@/components/ui-kits/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { cn } from "@/lib/utils";
import { Database, Eye, MoreVertical, Shield } from "lucide-react";
import { useState } from "react";
import type { PlatformSchema } from "../data-access.service";
import { AccessVerbPill } from "../gateway/components/primitives";
import { useNarrowContainer } from "../gateway/hooks/use-narrow-container";
import { DEFAULT_PROPERTY_NAMES } from "./explorer-utils";

/** Below this width Preview + Schema Access + the access pills no longer fit on one line. */
const NARROW_HEADER_WIDTH = 560;

/**
 * The schema header of the Data Gateway (`SchemaBasicInfo`), read-only: no
 * delete. Only Edit access can be changed here, so the Edit pill opens the
 * inspector and View / Create / Delete are shown as they are.
 */
export function SchemaHeader({
  schema,
  isAccessPanelOpen = false,
  onOpenPreview,
  onOpenSchemaAccess,
}: Readonly<{
  schema: PlatformSchema;
  isAccessPanelOpen?: boolean;
  onOpenPreview: () => void;
  onOpenSchemaAccess: () => void;
}>) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { ref: headerRef, isNarrow } = useNarrowContainer<HTMLDivElement>(NARROW_HEADER_WIDTH);
  const foldPreviewIntoMenu = isNarrow || isAccessPanelOpen;

  const ownCount = schema.fields.filter((f) => !DEFAULT_PROPERTY_NAMES.includes(f.name)).length;
  const systemCount = schema.fields.length - ownCount;
  const fieldsSummary = `${ownCount} ${ownCount === 1 ? "field" : "fields"} · ${systemCount} system`;

  const accessLevels = [
    { label: "View", level: schema.readAccessLevel, editable: false },
    { label: "Create", level: schema.writeAccessLevel, editable: false },
    { label: "Edit", level: schema.editAccessLevel, editable: true },
    { label: "Delete", level: schema.deleteAccessLevel, editable: false },
  ] as const;

  return (
    <div ref={headerRef} className="relative overflow-hidden rounded-t-sm border border-b-0 border-border/40 bg-card">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.04),transparent_60%)]" />
      <div className="relative flex items-start justify-between gap-3 px-3 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Database className="h-4 w-4 text-primary" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 wrap-break-word text-sm font-semibold text-foreground">{schema.schemaName}</h2>
              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Entity
              </span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {schema.service}
              </span>
            </div>
            <div
              className={cn(
                "flex text-[11px] text-muted-foreground/60",
                isNarrow ? "flex-col items-start gap-0.5" : "flex-wrap items-center gap-1.5",
              )}
            >
              <span className="break-all font-mono">{schema.collectionName}</span>
              {!isNarrow && <span aria-hidden className="h-[3px] w-[3px] shrink-0 rounded-full bg-current opacity-50" />}
              <span>{fieldsSummary}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!foldPreviewIntoMenu && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onOpenPreview}>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            aria-label="Schema Access"
            className={cn(
              "h-8 gap-1.5 border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
              isNarrow && "w-8 px-0",
            )}
            onClick={onOpenSchemaAccess}
          >
            <Shield className="h-3.5 w-3.5" />
            {!isNarrow && "Schema Access"}
          </Button>
          {foldPreviewIntoMenu && (
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="More options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={() => {
                    setIsMenuOpen(false);
                    onOpenPreview();
                  }}
                >
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  Preview
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="relative flex flex-col items-start gap-2.5 border-t border-border/40 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <span className="shrink-0 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">Access Control</span>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          {accessLevels.map(({ label, level, editable }) => (
            <AccessVerbPill
              key={label}
              verb={label}
              level={level}
              compact={isNarrow || isAccessPanelOpen}
              onClick={editable ? onOpenSchemaAccess : undefined}
              className={cn(
                "justify-center sm:justify-start",
                !editable && "cursor-default hover:ring-0",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Stand-in for the header while schemas load, with the same box model. */
export const SchemaHeaderSkeleton = () => (
  <div className="overflow-hidden rounded-t-sm border border-b-0 border-border/40 bg-card">
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-[17px] w-14 rounded" />
          </div>
          <Skeleton className="h-4 w-44 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-8 w-[88px] rounded-sm" />
        <Skeleton className="h-8 w-[124px] rounded-sm" />
      </div>
    </div>
    <div className="flex items-center gap-4 border-t border-border/40 px-5 py-3">
      <Skeleton className="h-[13px] w-[86px] rounded" />
      <div className="flex flex-wrap items-center gap-2">
        {["View", "Create", "Edit", "Delete"].map((verb) => (
          <Skeleton key={verb} className="h-[26px] w-[104px] rounded-md" />
        ))}
      </div>
    </div>
  </div>
);
