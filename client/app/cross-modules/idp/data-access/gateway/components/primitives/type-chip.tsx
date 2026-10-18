import { cn } from "@/lib/utils";

import { getFieldTypeCategory } from "../../constants/schema-access-control";

/**
 * Property type rendered as a colour-coded chip.
 *
 * The categories here are display-only. They are broader than
 * getFieldTypeCategory's string/array/numeric split, which exists to decide
 * which operators a rule may use — the two must not be conflated.
 */
export type TypeCategory = "string" | "numeric" | "boolean" | "temporal" | "reference";

const CATEGORY_CLASS: Record<TypeCategory, string> = {
  string: "bg-type-string-bg text-type-string-fg",
  numeric: "bg-type-numeric-bg text-type-numeric-fg",
  boolean: "bg-type-boolean-bg text-type-boolean-fg",
  temporal: "bg-type-temporal-bg text-type-temporal-fg",
  reference: "bg-type-ref-bg text-type-ref-fg",
};

const PRIMITIVES: Record<string, TypeCategory> = {
  string: "string",
  guid: "string",
  uuid: "string",
  int: "numeric",
  int32: "numeric",
  int64: "numeric",
  long: "numeric",
  float: "numeric",
  double: "numeric",
  decimal: "numeric",
  bool: "boolean",
  boolean: "boolean",
  date: "temporal",
  datetime: "temporal",
  timestamp: "temporal",
};

/** Anything not a known primitive is a child-schema reference. */
export function categoryForType(type?: string | null): TypeCategory {
  const normalized = (type ?? "").toLowerCase().trim();
  if (!normalized) return "reference";
  return PRIMITIVES[normalized] ?? "reference";
}

interface TypeChipProps {
  type?: string | null;
  isArray?: boolean | null;
  className?: string;
}

export function TypeChip({ type, isArray, className }: Readonly<TypeChipProps>) {
  const category = categoryForType(type);
  const label = type?.trim() ? type : "—";

  return (
    <span
      className={cn(
        "inline-flex h-[23px] items-center rounded-md px-2 font-mono text-[11.5px]",
        CATEGORY_CLASS[category],
        className,
      )}
      /** Surfaces the rule-operator category, which the colour does not encode. */
      title={`${label}${isArray ? "[]" : ""} · ${getFieldTypeCategory(type, isArray)}`}
    >
      {label}
      {isArray ? "[]" : null}
    </span>
  );
}

