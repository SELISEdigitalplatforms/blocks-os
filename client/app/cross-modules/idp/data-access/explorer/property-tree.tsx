import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import type { PlatformSchemaField } from "../data-access.service";
import { hasNestedFields } from "./explorer-utils";

/**
 * The Data Gateway's property tree (`property-tree.tsx`, `nested-tree.util.ts`): object properties open
 * in place as indented rows of the same table, joined to their parent by guide lines. The platform
 * schema already carries its nested fields, so nothing loads.
 *
 * Geometry: the cell's own left padding (1rem), then one 20px step per depth level, then the 20px
 * chevron slot, then the name. A level's line runs down the middle of its step, which is also the
 * middle of the parent's chevron slot one level up, so a branch leaves from under its parent's chevron.
 */
const STEP = 20;
const CELL_INSET = "1rem";
const LINE_CLASS = "pointer-events-none absolute bg-border";

const lineX = (level: number) => `calc(${CELL_INSET} + ${level * STEP + STEP / 2 - 0.5}px)`;

/** One guide cell: blank, a line passing a deeper row (│), a branch (├), or the last branch (└). */
export type TreeGuide = "none" | "through" | "tee" | "end";

/** Left padding that puts a row's chevron slot after its guides. */
export const treeIndent = (depth: number): CSSProperties => ({ paddingLeft: depth * STEP });

/** The guide lines of one nested row, one per depth level. */
export function TreeGuides({ guides }: Readonly<{ guides: TreeGuide[] }>) {
  return (
    <>
      {guides.map((guide, index) => {
        if (guide === "none") return null;
        const x = lineX(index);
        return (
          // Guides are positional and never reorder; the index is their identity.
          <span key={`${index}-${guide}`} aria-hidden>
            <span className={cn(LINE_CLASS, "top-0 w-px", guide === "end" ? "h-1/2" : "-bottom-px")} style={{ left: x }} />
            {guide !== "through" && <span className={cn(LINE_CLASS, "top-1/2 h-px")} style={{ left: x, width: STEP / 2 + 0.5 }} />}
          </span>
        );
      })}
    </>
  );
}

/** The line that drops from an open row's chevron to its first child. */
export function TreeStem({ depth }: Readonly<{ depth: number }>) {
  return <span aria-hidden className={cn(LINE_CLASS, "-bottom-px w-px")} style={{ left: lineX(depth), top: "calc(50% + 10px)" }} />;
}

/** The chevron that opens an object property. */
export function TreeToggle({ expanded, label, onToggle }: Readonly<{ expanded: boolean; label: string; onToggle: () => void }>) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={label}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
        expanded ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
      )}
    >
      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-150", expanded && "rotate-90")} strokeWidth={2.4} />
    </button>
  );
}

/** "3 fields" beside an object property's name. */
export function FieldCount({ count }: Readonly<{ count: number | undefined }>) {
  if (!count) return null;
  return (
    <span className="shrink-0 rounded-full border border-border/60 px-1.5 text-[10.5px] leading-4 text-muted-foreground">
      {count} {count === 1 ? "field" : "fields"}
    </span>
  );
}

/**
 * Which paths are open. `all` turns it around for Expand all: `paths` then lists the ones closed since.
 */
export interface TreeExpansion {
  all: boolean;
  paths: ReadonlySet<string>;
}

export const NOTHING_EXPANDED: TreeExpansion = { all: false, paths: new Set() };
export const EVERYTHING_EXPANDED: TreeExpansion = { all: true, paths: new Set() };

export const isPathExpanded = (expansion: TreeExpansion, path: string) =>
  expansion.all ? !expansion.paths.has(path) : expansion.paths.has(path);

export function togglePath(expansion: TreeExpansion, path: string): TreeExpansion {
  const paths = new Set(expansion.paths);
  if (paths.has(path)) paths.delete(path);
  else paths.add(path);
  return { all: expansion.all, paths };
}

export interface NestedTreeRow {
  /** The dotted path, e.g. "Create.Roles". */
  path: string;
  /** 1 for a direct child of a table row, 2 for a grandchild, and so on. */
  depth: number;
  field: PlatformSchemaField;
  /** One per depth level; the last is this row's own branch. */
  guides: TreeGuide[];
  isExpanded: boolean;
}

/** `lastAt[k]` says whether the ancestor at depth k + 1 was the last of its siblings. */
function guidesFor(depth: number, isLast: boolean, lastAt: readonly boolean[]): TreeGuide[] {
  const guides: TreeGuide[] = [];
  for (let level = 1; level < depth; level++) guides.push(lastAt[level - 1] ? "none" : "through");
  guides.push(isLast ? "end" : "tee");
  return guides;
}

/** The rows under one open property, depth-first, with each open descendant's rows right after it. */
export function nestedRows(
  parent: { path: string; field: PlatformSchemaField },
  expansion: TreeExpansion,
  depth = 1,
  lastAt: readonly boolean[] = [],
): NestedTreeRow[] {
  const fields = parent.field.fields ?? [];
  return fields.flatMap((field, index) => {
    const isLast = index === fields.length - 1;
    const path = `${parent.path}.${field.name}`;
    const isExpanded = hasNestedFields(field) && isPathExpanded(expansion, path);
    const row: NestedTreeRow = { path, depth, field, guides: guidesFor(depth, isLast, lastAt), isExpanded };
    return isExpanded ? [row, ...nestedRows({ path, field }, expansion, depth + 1, [...lastAt, isLast])] : [row];
  });
}
