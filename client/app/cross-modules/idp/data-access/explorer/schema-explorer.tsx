import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { cn } from "@/lib/utils";
import { Database, PanelLeftOpen, Search } from "lucide-react";
import { PLATFORM_SERVICES, type PlatformSchema } from "../data-access.service";
import { AccessTierDot } from "../gateway/components/primitives";
import { schemaExposure } from "./explorer-utils";

const SERVICE_FILTERS = [{ value: "all", label: "All" }, ...PLATFORM_SERVICES.map((service) => ({ value: service, label: service }))];

/** Schemas the explorer lists: the service filter, then a name search. */
export function filterSchemas(schemas: PlatformSchema[], service: string, search: string) {
  const keyword = search.trim().toLowerCase();
  return schemas.filter(
    (schema) =>
      (service === "all" || schema.service === service) &&
      (!keyword || schema.schemaName.toLowerCase().includes(keyword) || schema.collectionName.toLowerCase().includes(keyword)),
  );
}

const SchemaListSkeleton = () => (
  <div className="space-y-1">
    {Array.from({ length: 12 }).map((_, index) => (
      <Skeleton key={index} className="h-[34px] w-full rounded-md" />
    ))}
  </div>
);

/**
 * The explorer column: the Data Gateway's schema list, read-only. Filtering by
 * service replaces its Entity/Child filter (every platform schema is an entity),
 * and the whole list arrives in one call, so there is no paging.
 */
export function SchemaExplorer({
  schemas,
  isLoading,
  service,
  search,
  selectedSchemaId,
  onServiceChange,
  onSearchChange,
  onSelectSchema,
}: Readonly<{
  schemas: PlatformSchema[];
  isLoading: boolean;
  service: string;
  search: string;
  selectedSchemaId?: string | null;
  onServiceChange: (service: string) => void;
  onSearchChange: (search: string) => void;
  onSelectSchema: (id: string) => void;
}>) {
  const visible = filterSchemas(schemas, service, search);
  const isFilteredOrSearched = service !== "all" || search.trim().length > 0;

  return (
    <div className="relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-sm border border-border/40 bg-card">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/40 pl-4 pr-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">Schemas</h2>
        {!isLoading && (
          <span className="text-[11px] text-muted-foreground" aria-label={`${visible.length} schemas`}>
            {visible.length}
          </span>
        )}
      </div>

      <div className="shrink-0 border-b border-border/40 px-2.5 py-2">
        <div className="dg-interactive flex h-[30px] items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-2.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search schemas…"
            aria-label="Search schemas"
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-hidden placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-border/40 px-2.5 py-2">
        {SERVICE_FILTERS.map(({ value, label }) => {
          const active = service === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onServiceChange(value)}
              className={cn(
                "dg-interactive h-[25px] rounded-full border px-2.5 text-[11px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                active
                  ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                  : "border-border/40 font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto px-2 py-1.5">
        {isLoading ? (
          <SchemaListSkeleton />
        ) : visible.length > 0 ? (
          visible.map((schema) => {
            const isSelected = schema.id === selectedSchemaId;
            const exposure = schemaExposure(schema);
            return (
              <button
                key={schema.id}
                type="button"
                onClick={() => onSelectSchema(schema.id)}
                aria-current={isSelected ? "true" : undefined}
                title={`${schema.schemaName} · ${schema.collectionName}`}
                className={cn(
                  "dg-interactive relative flex h-[34px] w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                  isSelected ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-muted/40 hover:text-foreground",
                )}
              >
                {isSelected && <span className="absolute inset-y-2 left-0 w-[2.5px] rounded-r-sm bg-primary" />}
                <span className={cn("min-w-0 flex-1 truncate text-[13px]", isSelected ? "font-semibold" : "font-normal")}>
                  {schema.schemaName}
                </span>
                {exposure && <AccessTierDot tier={exposure.tier} title={exposure.reason} />}
                <span className={cn("shrink-0 text-[11px]", isSelected ? "text-primary/60" : "text-muted-foreground/70")}>
                  {schema.service}
                </span>
              </button>
            );
          })
        ) : isFilteredOrSearched ? (
          <div className="flex h-full items-center justify-center py-8 text-sm text-muted-foreground/60">No schemas found</div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-dashed border-border/60 text-muted-foreground/40">
              <Database className="h-[19px] w-[19px]" aria-hidden />
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground/70">
              No platform schemas yet.
              <br />
              They will be listed here once seeded.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** The collapsed explorer while the access inspector is open: an initial per schema. */
export function SchemaRail({
  schemas,
  selectedSchemaId,
  onSelectSchema,
  onExpand,
}: Readonly<{
  schemas: PlatformSchema[];
  selectedSchemaId?: string | null;
  onSelectSchema: (id: string) => void;
  onExpand: () => void;
}>) {
  return (
    <div className="flex h-full w-full shrink-0 flex-col items-center overflow-hidden rounded-sm border border-border/40 bg-card">
      <div className="flex h-11 w-full shrink-0 items-center justify-center border-b border-border/40">
        <button
          type="button"
          onClick={onExpand}
          aria-label="Show the schema list"
          className="dg-interactive flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <PanelLeftOpen className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto py-2">
        {schemas.map((schema) => {
          const isSelected = schema.id === selectedSchemaId;
          return (
            <button
              key={schema.id}
              type="button"
              title={schema.schemaName}
              aria-label={schema.schemaName}
              aria-current={isSelected ? "true" : undefined}
              onClick={() => onSelectSchema(schema.id)}
              className={cn(
                "dg-interactive relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md text-[12px] font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                isSelected ? "bg-primary/10 text-primary" : "text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {isSelected && <span className="absolute inset-y-2 left-[-9px] w-[2.5px] rounded-r-sm bg-primary" />}
              {schema.schemaName.charAt(0).toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
