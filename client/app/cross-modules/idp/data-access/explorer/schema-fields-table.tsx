import { Card } from "@/components/ui-kits/card/card";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui-kits/table/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-kits/button/button";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Shield } from "lucide-react";
import { Fragment, useState } from "react";
import type { PlatformSchemaField } from "../data-access.service";
import { FieldFlags, RequiredBadge, TypeChip, flagTitlesFromField, flagsFromField, tierFromLevel, ACCESS_TIER_LABELS } from "../gateway/components/primitives";
import type { IPlatformSchemaRules } from "../rules/rules.types";
import { FieldRulesButtons, FieldRulesProvider, type OnOpenFieldRules } from "./field-rules-buttons";
import { useDefaultPropertiesExpanded } from "./explorer-hooks";
import { hasNestedFields, isScalarField, orderFields } from "./explorer-utils";
import {
  EVERYTHING_EXPANDED,
  FieldCount,
  NOTHING_EXPANDED,
  TreeGuides,
  TreeStem,
  TreeToggle,
  isPathExpanded,
  nestedRows,
  togglePath,
  treeIndent,
  type TreeExpansion,
  type TreeGuide,
} from "./property-tree";

/** Opens the access inspector for one property; `path` is the dotted name (e.g. `Create.Roles`). */
export type OnOpenFieldAccess = (target: { path: string; field: PlatformSchemaField }) => void;

/** Property | Type | Required | Flags | Description | Rules, at the Data Gateway's view-mode widths. */
const COLUMNS = [
  { id: "property", width: "22%", skeleton: "w-20" },
  { id: "type", width: "16%", skeleton: "w-12" },
  { id: "required", width: "12%", skeleton: "w-10" },
  { id: "flags", width: "14%", skeleton: "w-12" },
  { id: "description", width: "21%", skeleton: "w-24" },
  { id: "rules", width: "15%", skeleton: "w-16" },
] as const;
const COLUMN_COUNT = COLUMNS.length;
const SKELETON_CARDS = ["card-1", "card-2", "card-3", "card-4"];
const SKELETON_ROWS = Array.from({ length: 8 }, (_, row) => `row-${row}`);

function ColumnWidths() {
  return (
    <colgroup>
      {COLUMNS.map((column) => (
        <col key={column.id} style={{ width: column.width }} />
      ))}
    </colgroup>
  );
}
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
          {values.map((value) => (
            <span key={value} className={ENUM_CHIP_CLASS}>
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The Rules column: the field's View and Edit access (the two that apply to a property), which opens the inspector. */
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

  const levels = [
    { label: "View", level: field.readAccessLevel },
    { label: "Edit", level: field.editAccessLevel },
  ];
  const isCustomised = levels.some(({ level }) => tierFromLevel(level) !== "inherited");

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
  depth = 0,
  guides = [],
  isExpanded,
  onToggleExpand,
  onOpenFieldAccess,
}: Readonly<{
  field: PlatformSchemaField;
  path: string;
  isDefault: boolean;
  /** 0 for the table's own rows; nested rows sit under their parent with guide lines. */
  depth?: number;
  guides?: TreeGuide[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenFieldAccess: OnOpenFieldAccess;
}>) {
  const nested = hasNestedFields(field);
  const isTreeRow = depth > 0;
  let toggleLabel = isExpanded ? `Collapse ${field.type}` : `Expand ${field.type} attributes`;
  if (isTreeRow) toggleLabel = `${isExpanded ? "Collapse" : "Expand"} ${path}`;
  return (
    <TableRow
      className={cn(isDefault && !isTreeRow && "bg-primary/5 hover:bg-primary/10", isTreeRow && "bg-muted/20 hover:bg-muted/30")}
      data-tree-depth={isTreeRow ? depth : undefined}
    >
      {/* Property: the tree's chevron slot, the name, and an object's field count */}
      <TableCell className={cn(CELL, "relative")} title={isTreeRow ? path : undefined}>
        <TreeGuides guides={guides} />
        {isExpanded && <TreeStem depth={depth} />}
        <div className="flex min-w-0 items-center gap-1.5" style={treeIndent(depth)}>
          <span className="flex w-5 shrink-0 items-center justify-center">
            {nested && <TreeToggle expanded={isExpanded} label={toggleLabel} onToggle={onToggleExpand} />}
            {!nested && isTreeRow && <span aria-hidden className="h-1 w-1 rounded-full bg-muted-foreground/40" />}
          </span>
          <span
            className={cn("truncate pl-0.5 font-mono text-[13px]", isTreeRow ? "text-foreground/85" : "text-foreground")}
            title={isTreeRow ? undefined : field.name}
          >
            {field.name}
          </span>
          {nested && <FieldCount count={field.fields?.length} />}
        </div>
      </TableCell>
      <TableCell className={CELL}>
        <TypeChip type={field.type} isArray={field.isArray} className="min-w-0 max-w-full truncate" />
        {field.type === "Enum" && <EnumValues values={field.enumValues ?? []} />}
      </TableCell>
      <TableCell className={CELL}>{isScalarField(field) && <RequiredBadge requiredOn={field.requiredOn} />}</TableCell>
      <TableCell className={CELL}>
        <FieldFlags
          flags={flagsFromField({ isArray: field.isArray, isPIIData: Boolean(field.isPIIData), isUniqueData: Boolean(field.isUniqueData), defaultValue: field.defaultValue })}
          titles={flagTitlesFromField(field)}
        />
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
          <FieldRulesButtons field={field} path={path} />
        </div>
      </TableCell>
    </TableRow>
  );
}

type TreeState = { expansion: TreeExpansion; onToggle: (path: string) => void };

/**
 * The rows of the table's properties, each open object property followed by its nested properties as
 * indented rows (any number open at once, as in the Data Gateway).
 */
function FieldRows({
  fields,
  isDefault,
  tree,
  onOpenFieldAccess,
}: Readonly<{
  fields: PlatformSchemaField[];
  isDefault: boolean;
  tree: TreeState;
  onOpenFieldAccess: OnOpenFieldAccess;
}>) {
  return (
    <>
      {fields.map((field) => {
        const isExpanded = hasNestedFields(field) && isPathExpanded(tree.expansion, field.name);
        return (
          <Fragment key={field.name}>
            <FieldRow
              field={field}
              path={field.name}
              isDefault={isDefault}
              isExpanded={isExpanded}
              onToggleExpand={() => tree.onToggle(field.name)}
              onOpenFieldAccess={onOpenFieldAccess}
            />
            {isExpanded &&
              nestedRows({ path: field.name, field }, tree.expansion).map((row) => (
                <FieldRow
                  key={row.path}
                  field={row.field}
                  path={row.path}
                  isDefault={isDefault}
                  depth={row.depth}
                  guides={row.guides}
                  isExpanded={row.isExpanded}
                  onToggleExpand={() => tree.onToggle(row.path)}
                  onOpenFieldAccess={onOpenFieldAccess}
                />
              ))}
          </Fragment>
        );
      })}
    </>
  );
}

function FieldsTable({
  fields,
  schemaName,
  tree,
  onOpenFieldAccess,
}: Readonly<{
  fields: PlatformSchemaField[];
  schemaName: string;
  tree: TreeState;
  onOpenFieldAccess: OnOpenFieldAccess;
}>) {
  const [isDefaultsExpanded, setIsDefaultsExpanded] = useDefaultPropertiesExpanded();
  const { defaults, own } = orderFields(fields);

  return (
    <Table className="w-full table-fixed" wrapperClassName="overflow-visible">
      <ColumnWidths />
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead>Property</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Required</TableHead>
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
            {isDefaultsExpanded && <FieldRows fields={defaults} isDefault tree={tree} onOpenFieldAccess={onOpenFieldAccess} />}
          </>
        )}
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={COLUMN_COUNT} className="bg-muted/30 px-4 py-2">
            <div className="text-sm font-medium text-foreground">
              {schemaName} Properties ({own.length})
            </div>
          </TableCell>
        </TableRow>
        <FieldRows fields={own} isDefault={false} tree={tree} onOpenFieldAccess={onOpenFieldAccess} />
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
        <div className="flex items-center gap-1">
          <FieldAccessButton field={field} path={path} onOpenFieldAccess={onOpenFieldAccess} />
          <FieldRulesButtons field={field} path={path} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TypeChip type={field.type} isArray={field.isArray} />
        <FieldFlags
          flags={flagsFromField({ isArray: field.isArray, isPIIData: Boolean(field.isPIIData), isUniqueData: Boolean(field.isUniqueData), defaultValue: field.defaultValue })}
          titles={flagTitlesFromField(field)}
        />
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
 * The Data Gateway's field table (`SchemaStructureTable`) in view mode: the same columns and Rules
 * buttons, no edit, no add/duplicate/delete. Validation and Default value open only where the Genesis
 * allow-list opens a property (and only while rules are switched on); elsewhere they are disabled with
 * the reason. Object properties open in place as a tree of indented rows, as child schemas do there.
 */
export function SchemaFieldsTable({
  schemaName,
  fields,
  rules,
  onOpenFieldAccess,
  onOpenFieldRules,
}: Readonly<{
  schemaName: string;
  fields: PlatformSchemaField[];
  /** The allow-list for validation rules and defaults; null when off or the schema takes none. */
  rules?: IPlatformSchemaRules | null;
  onOpenFieldAccess: OnOpenFieldAccess;
  onOpenFieldRules?: OnOpenFieldRules;
}>) {
  const [isDefaultsExpanded, setIsDefaultsExpanded] = useDefaultPropertiesExpanded();
  const { defaults, own } = orderFields(fields);
  // The tree closes when another schema is selected.
  const [treeState, setTreeState] = useState<{ schemaName: string; expansion: TreeExpansion }>({ schemaName, expansion: NOTHING_EXPANDED });
  const expansion = treeState.schemaName === schemaName ? treeState.expansion : NOTHING_EXPANDED;
  const setExpansion = (next: TreeExpansion) => setTreeState({ schemaName, expansion: next });
  const tree: TreeState = { expansion, onToggle: (path) => setExpansion(togglePath(expansion, path)) };
  const hasObjects = fields.some(hasNestedFields);

  return (
    <FieldRulesProvider rules={onOpenFieldRules ? rules : null} onOpen={onOpenFieldRules ?? (() => {})}>
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-none border-t-0 shadow-none">
      <div className="-mx-5 flex shrink-0 items-center justify-between border-b border-border/40 px-5">
        <Tabs value="attribute">
          <TabsList className="h-8 gap-1 rounded-none bg-transparent p-0">
            <TabsTrigger value="attribute" className={TAB_TRIGGER_CLASS}>
              Attribute
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {hasObjects && (
          <div className="hidden items-center xl:flex">
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground" onClick={() => setExpansion(EVERYTHING_EXPANDED)}>
              <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden />
              Expand all
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground" onClick={() => setExpansion(NOTHING_EXPANDED)}>
              <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden />
              Collapse all
            </Button>
          </div>
        )}
      </div>

      {fields.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
          {schemaName} has no properties.
        </div>
      ) : (
        <>
          <ScrollArea className="mt-4 hidden min-h-0 flex-1 xl:block">
            <FieldsTable fields={fields} schemaName={schemaName} tree={tree} onOpenFieldAccess={onOpenFieldAccess} />
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
    </FieldRulesProvider>
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
      {SKELETON_CARDS.map((card) => (
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
        <ColumnWidths />
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHead key={column.id}>
                <Skeleton className={`h-3.5 ${column.skeleton} rounded`} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {SKELETON_ROWS.map((row) => (
            <TableRow key={row}>
              <TableCell>
                <Skeleton className="h-4 w-[70%] rounded" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-[22px] w-[74px] rounded-md" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3.5 w-6 rounded" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-[22px] w-[56px] rounded-md" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[85%] rounded" />
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Skeleton className="h-[26px] w-[26px] rounded-md" />
                  <Skeleton className="h-[26px] w-[28px] rounded-md" />
                  <Skeleton className="h-[26px] w-[26px] rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </Card>
);
