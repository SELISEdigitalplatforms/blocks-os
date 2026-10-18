import { Card } from "@/components/ui-kits/card/card";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui-kits/table/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Shield } from "lucide-react";
import { Fragment, useState } from "react";
import type { PlatformSchemaField } from "../data-access.service";
import { FieldFlags, TypeChip, flagsFromField, tierFromLevel, ACCESS_TIER_LABELS } from "../gateway/components/primitives";
import { useDefaultPropertiesExpanded } from "./explorer-hooks";
import { hasNestedFields, isScalarField, orderFields } from "./explorer-utils";

/** Opens the access inspector for one property; `path` is the dotted name (e.g. `Create.Roles`). */
export type OnOpenFieldAccess = (target: { path: string; field: PlatformSchemaField }) => void;

/** Property | Type | Flags | Description | Rules. */
const COLUMN_WIDTHS = ["24%", "18%", "15%", "28%", "15%"];
const COLUMN_COUNT = COLUMN_WIDTHS.length;
const CELL = "py-3 align-middle";

const TAB_TRIGGER_CLASS =
  "dg-interactive relative h-8 rounded-none border-b-2 border-transparent bg-transparent px-4 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none";

const ENUM_CHIP_CLASS =
  "inline-flex h-6 items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 text-xs font-medium text-foreground";

function EnumValues({ values }: Readonly<{ values: string[] }>) {
  return (
    <div className="mt-2 space-y-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">Allowed values</span>
      {values.length === 0 ? (
        <p className="text-xs text-muted-foreground">No allowed values defined.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value, i) => (
            <span key={`${value}-${i}`} className={ENUM_CHIP_CLASS}>
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The Rules column: the field's access, which opens the inspector (Edit is what can change here). */
function FieldAccessButton({
  field,
  path,
  onOpenFieldAccess,
}: Readonly<{ field: PlatformSchemaField; path: string; onOpenFieldAccess: OnOpenFieldAccess }>) {
  if (!isScalarField(field)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled
            className="flex h-[26px] w-[26px] shrink-0 cursor-not-allowed items-center justify-center rounded-md border border-border/60 text-muted-foreground/50"
            aria-label="Set access on the properties inside"
          >
            <Shield className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Set access on the properties inside</TooltipContent>
      </Tooltip>
    );
  }

  const isCustomised = tierFromLevel(field.editAccessLevel) !== "inherited";
  const levels = [
    { label: "View", level: field.readAccessLevel },
    { label: "Create", level: field.writeAccessLevel },
    { label: "Edit", level: field.editAccessLevel },
  ];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onOpenFieldAccess({ path, field })}
          className={cn(
            "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
            isCustomised
              ? "border-access-custom-border bg-access-custom-bg text-access-custom-fg"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary",
          )}
          aria-label={`View access for ${path}`}
        >
          <Shield className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex items-center gap-1.5 text-xs">
          {levels.map(({ label, level }, i) => (
            <span key={label} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground">|</span>}
              <span className="text-muted-foreground">{label}:</span>
              <span>{ACCESS_TIER_LABELS[tierFromLevel(level)]}</span>
            </span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function FieldRow({
  field,
  path,
  isDefault,
  isExpanded,
  onToggleExpand,
  onOpenFieldAccess,
}: Readonly<{
  field: PlatformSchemaField;
  path: string;
  isDefault: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenFieldAccess: OnOpenFieldAccess;
}>) {
  const nested = hasNestedFields(field);
  return (
    <TableRow className={cn(isDefault && "bg-primary/5 hover:bg-primary/10")}>
      <TableCell className={CELL}>
        <span className="block truncate font-mono text-[13px] text-foreground" title={field.name}>
          {field.name}
        </span>
      </TableCell>
      <TableCell className={CELL}>
        <div className="flex h-9 flex-col justify-center">
          <div className="flex min-w-0 items-center gap-1.5">
            <TypeChip type={field.type} isArray={field.isArray} className="min-w-0 max-w-full truncate" />
            {nested && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleExpand}
                    className={cn(
                      "flex shrink-0 rounded p-1 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                      isExpanded ? "bg-primary/10 text-primary" : "text-primary hover:bg-primary/10",
                    )}
                    aria-label={isExpanded ? `Collapse ${field.type}` : `Expand ${field.type} attributes`}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {isExpanded ? "Collapse" : "Expand"} {field.type} attributes
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        {field.type === "Enum" && <EnumValues values={field.enumValues ?? []} />}
      </TableCell>
      <TableCell className={CELL}>
        <FieldFlags flags={flagsFromField({ isArray: field.isArray, isPIIData: Boolean(field.isPIIData), isUniqueData: Boolean(field.isUniqueData) })} />
      </TableCell>
      <TableCell className={cn(CELL, "px-3 md:px-3")}>
        <span
          className={cn("block truncate text-xs", field.description ? "text-muted-foreground" : "text-muted-foreground/40")}
          title={field.description || undefined}
        >
          {field.description || "—"}
        </span>
      </TableCell>
      <TableCell className={CELL}>
        <div className="flex h-9 items-center gap-1">
          <FieldAccessButton field={field} path={path} onOpenFieldAccess={onOpenFieldAccess} />
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * The rows of one level of properties, plus the expanded nested table under an
 * object property (one open at a time, as in the Data Gateway).
 */
function FieldRows({
  fields,
  parentPath,
  isDefault,
  onOpenFieldAccess,
}: Readonly<{
  fields: PlatformSchemaField[];
  parentPath: string;
  isDefault: boolean;
  onOpenFieldAccess: OnOpenFieldAccess;
}>) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <>
      {fields.map((field) => {
        const path = parentPath ? `${parentPath}.${field.name}` : field.name;
        const isExpanded = expanded === field.name;
        return (
          <Fragment key={path}>
            <FieldRow
              field={field}
              path={path}
              isDefault={isDefault}
              isExpanded={isExpanded}
              onToggleExpand={() => setExpanded(isExpanded ? null : field.name)}
              onOpenFieldAccess={onOpenFieldAccess}
            />
            {isExpanded && hasNestedFields(field) && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="bg-muted/30 p-4 align-top dark:bg-muted/25">
                  <Card className="flex min-w-0 flex-col overflow-hidden shadow-none">
                    <FieldsTable fields={field.fields ?? []} parentPath={path} onOpenFieldAccess={onOpenFieldAccess} embedded />
                  </Card>
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function FieldsTable({
  fields,
  parentPath = "",
  schemaName,
  embedded = false,
  onOpenFieldAccess,
}: Readonly<{
  fields: PlatformSchemaField[];
  parentPath?: string;
  schemaName?: string;
  embedded?: boolean;
  onOpenFieldAccess: OnOpenFieldAccess;
}>) {
  const [isDefaultsExpanded, setIsDefaultsExpanded] = useDefaultPropertiesExpanded();
  // Only the entity itself splits off its default properties; nested objects list theirs as they are.
  const { defaults, own } = embedded ? { defaults: [], own: fields } : orderFields(fields);

  return (
    <Table className="w-full table-fixed" wrapperClassName="overflow-visible">
      <colgroup>
        {COLUMN_WIDTHS.map((width, index) => (
          <col key={index} style={{ width }} />
        ))}
      </colgroup>
      <TableHeader className={cn(!embedded && "sticky top-0 z-10 bg-card")}>
        <TableRow>
          <TableHead>Property</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Flags</TableHead>
          <TableHead className="px-3 text-left md:px-3">Description</TableHead>
          <TableHead>Rules</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {defaults.length > 0 && (
          <>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMN_COUNT} className="bg-primary/5 px-4 py-2">
                <button
                  type="button"
                  onClick={() => setIsDefaultsExpanded(!isDefaultsExpanded)}
                  aria-expanded={isDefaultsExpanded}
                  className="flex w-full items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isDefaultsExpanded ? "rotate-0" : "-rotate-90")} />
                  <span>Default Properties ({defaults.length})</span>
                </button>
              </TableCell>
            </TableRow>
            {isDefaultsExpanded && <FieldRows fields={defaults} parentPath={parentPath} isDefault onOpenFieldAccess={onOpenFieldAccess} />}
          </>
        )}
        {!embedded && schemaName && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={COLUMN_COUNT} className="bg-muted/30 px-4 py-2">
              <div className="text-sm font-medium text-foreground">
                {schemaName} Properties ({own.length})
              </div>
            </TableCell>
          </TableRow>
        )}
        <FieldRows fields={own} parentPath={parentPath} isDefault={false} onOpenFieldAccess={onOpenFieldAccess} />
      </TableBody>
    </Table>
  );
}

/** One property as a card, for widths below `xl` where the table does not fit. */
function FieldCard({
  field,
  path,
  onOpenFieldAccess,
}: Readonly<{ field: PlatformSchemaField; path: string; onOpenFieldAccess: OnOpenFieldAccess }>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const nested = hasNestedFields(field);
  return (
    <div className="space-y-3 rounded-sm border border-border/40 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-[13px] text-foreground">{field.name}</span>
        <FieldAccessButton field={field} path={path} onOpenFieldAccess={onOpenFieldAccess} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TypeChip type={field.type} isArray={field.isArray} />
        <FieldFlags flags={flagsFromField({ isArray: field.isArray, isPIIData: Boolean(field.isPIIData), isUniqueData: Boolean(field.isUniqueData) })} />
        {nested && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="flex items-center gap-1 rounded p-1 text-xs text-primary hover:bg-primary/10"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {field.fields?.length} attributes
          </button>
        )}
      </div>
      {field.type === "Enum" && <EnumValues values={field.enumValues ?? []} />}
      <p className={cn("text-xs", field.description ? "text-muted-foreground" : "text-muted-foreground/40")}>{field.description || "—"}</p>
      {nested && isExpanded && (
        <div className="space-y-3 border-l-2 border-border/40 pl-3">
          {(field.fields ?? []).map((child) => (
            <FieldCard key={child.name} field={child} path={`${path}.${child.name}`} onOpenFieldAccess={onOpenFieldAccess} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The Data Gateway's field table (`SchemaStructureTable`) in view mode: no edit,
 * no add/duplicate/delete, no validation. Nested object properties expand in
 * place like child schemas do there.
 */
export function SchemaFieldsTable({
  schemaName,
  fields,
  onOpenFieldAccess,
}: Readonly<{
  schemaName: string;
  fields: PlatformSchemaField[];
  onOpenFieldAccess: OnOpenFieldAccess;
}>) {
  const [isDefaultsExpanded, setIsDefaultsExpanded] = useDefaultPropertiesExpanded();
  const { defaults, own } = orderFields(fields);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-none border-t-0 shadow-none">
      <div className="-mx-5 flex shrink-0 items-center border-b border-border/40 px-5">
        <Tabs value="attribute">
          <TabsList className="h-8 gap-1 rounded-none bg-transparent p-0">
            <TabsTrigger value="attribute" className={TAB_TRIGGER_CLASS}>
              Attribute
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {fields.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
          {schemaName} has no properties.
        </div>
      ) : (
        <>
          <ScrollArea className="mt-4 hidden min-h-0 flex-1 xl:block">
            <FieldsTable fields={fields} schemaName={schemaName} onOpenFieldAccess={onOpenFieldAccess} />
          </ScrollArea>

          <div className="mt-4 space-y-3 xl:hidden">
            {defaults.length > 0 && (
              <>
                <div className="rounded-lg bg-primary/5 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setIsDefaultsExpanded(!isDefaultsExpanded)}
                    aria-expanded={isDefaultsExpanded}
                    className="flex w-full items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isDefaultsExpanded ? "rotate-0" : "-rotate-90")} />
                    <span>Default Properties ({defaults.length})</span>
                  </button>
                </div>
                {isDefaultsExpanded &&
                  defaults.map((field) => <FieldCard key={field.name} field={field} path={field.name} onOpenFieldAccess={onOpenFieldAccess} />)}
              </>
            )}
            <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm font-medium text-foreground">
              {schemaName} Properties ({own.length})
            </div>
            {own.map((field) => (
              <FieldCard key={field.name} field={field} path={field.name} onOpenFieldAccess={onOpenFieldAccess} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/** Stand-in for the field table while schemas load, with the same columns and card. */
export const SchemaFieldsTableSkeleton = () => (
  <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-none border-t-0 shadow-none">
    <div className="-mx-5 flex shrink-0 items-center border-b border-border/40 px-5">
      <div className="flex h-8 items-center">
        <Skeleton className="h-4 w-16 rounded" />
      </div>
    </div>
    <div className="mt-4 space-y-3 xl:hidden">
      {Array.from({ length: 4 }).map((_, card) => (
        <div key={card} className="space-y-3 rounded-sm border border-border/40 bg-card p-4">
          <Skeleton className="h-4 w-32 rounded" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-[22px] w-[74px] rounded-md" />
            <Skeleton className="h-[22px] w-[56px] rounded-md" />
          </div>
          <Skeleton className="h-4 w-[80%] rounded" />
        </div>
      ))}
    </div>
    <div className="mt-4 hidden xl:block">
      <Table className="w-full table-fixed">
        <colgroup>
          {COLUMN_WIDTHS.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow>
            {["w-20", "w-12", "w-12", "w-24", "w-10"].map((width, index) => (
              <TableHead key={index}>
                <Skeleton className={`h-3.5 ${width} rounded`} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, row) => (
            <TableRow key={row}>
              <TableCell>
                <Skeleton className="h-4 w-[70%] rounded" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-[22px] w-[74px] rounded-md" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-[22px] w-[56px] rounded-md" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[85%] rounded" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-[26px] w-[26px] rounded-md" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </Card>
);
