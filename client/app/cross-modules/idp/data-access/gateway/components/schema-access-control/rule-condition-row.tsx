"use client";

import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { FormField } from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { PrincipalSelector } from "@blocks-idp/data-access/gateway/components/schema-access-control/principal-selector";
import {
  AUTH_ATTRIBUTE_OPTION,
  AUTH_FIELD_OPTIONS,
  AUTH_LEFT_FIELD_OPTIONS,
  AUTH_STRING_FIELDS,
  COMPARE_SOURCE_OPTIONS,
  FIELD_TYPE_CATEGORY,
  IN_OPERATORS,
  MAX_NESTED_FIELD_DEPTH,
  NULL_OPERATORS,
  OPERATORS_BY_CATEGORY,
  RULE_OPERATORS,
  RULE_SOURCE_OPTIONS,
  RULE_SOURCE_TYPES,
  getAuthAttributeName,
  getFieldTypeCategory,
  isAuthAttributeField,
  type FieldTypeCategory,
} from "@blocks-idp/data-access/gateway/constants/schema-access-control";
import type { RuleSetFormValues } from "@blocks-idp/data-access/gateway/utils/schema-access-control.utils";
import { cn } from "@/lib/utils";
import { CheckIcon } from "@radix-ui/react-icons";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";
import { useFormContext } from "react-hook-form";

export type RuleCellKey = "source" | "field" | "operator" | "compareSource" | "compareValue";

export interface SchemaField {
  name: string;
  type?: string | null;
  isArray?: boolean | null;
  /** Nested properties for child-schema (object) fields, e.g. AddressInfo's own fields */
  fields?: SchemaField[];
}

interface SchemaFieldOption {
  label: string;
  value: string;
  type?: string | null;
  isArray?: boolean | null;
}

/**
 * Flattens a (possibly nested) schema field tree into dotted-path leaf options,
 * e.g. AddressInfo.StreetNo, capped at MAX_NESTED_FIELD_DEPTH to mirror the
 * server's GraphQlConstant.MaxNestedLevelIterationLimit.
 */
const flattenSchemaFields = (
  items: SchemaField[],
  parentPath = "",
  depth = 1,
): SchemaFieldOption[] =>
  items.flatMap((f) => {
    const value = parentPath ? `${parentPath}.${f.name}` : f.name;
    if (f.fields?.length) {
      if (depth >= MAX_NESTED_FIELD_DEPTH) return [];
      return flattenSchemaFields(f.fields, value, depth + 1);
    }
    return [{ label: value, value, type: f.type, isArray: f.isArray }];
  });

/**
 * The option lists and type rules a condition row picks from. They depend on
 * the schema being edited, so the form builds them once and hands the same set
 * to every row, in every group.
 */
export const createRuleBuilderHelpers = (schemaFields: SchemaField[], schemaName: string) => {
  /** Schema fields flattened to dotted-path leaf options (e.g. AddressInfo.StreetNo) */
  const schemaFieldOptions = flattenSchemaFields(schemaFields);

  const getFieldOptions = (source: string) => {
    if (source === RULE_SOURCE_TYPES.AUTH) return AUTH_LEFT_FIELD_OPTIONS;
    if (source === RULE_SOURCE_TYPES.SCHEMA_FIELD) return schemaFieldOptions;
    return [];
  };

  /** Resolve field type category from left source + field name */
  const getLeftFieldCategory = (
    source: string,
    fieldName: string,
  ): FieldTypeCategory | undefined => {
    if (!source || !fieldName) return undefined;
    if (source === RULE_SOURCE_TYPES.AUTH) {
      if (isAuthAttributeField(fieldName)) return AUTH_ATTRIBUTE_OPTION.category;
      return AUTH_FIELD_OPTIONS.find((o) => o.value === fieldName)?.category;
    }
    if (source === RULE_SOURCE_TYPES.SCHEMA_FIELD) {
      const sf = schemaFieldOptions.find((f) => f.value === fieldName);
      return getFieldTypeCategory(sf?.type, sf?.isArray);
    }
    return undefined;
  };

  /** Filter RULE_OPERATORS to those valid for the category (all if unknown) */
  const getFilteredOperators = (
    category: FieldTypeCategory | undefined,
    source?: string,
    fieldName?: string,
  ) => {
    if (!category) return RULE_OPERATORS;
    const allowed = [...OPERATORS_BY_CATEGORY[category]];
    // Auth → roles: also allow IN / NOT_IN
    if (source === RULE_SOURCE_TYPES.AUTH && fieldName === "roles" && !allowed.includes("IN")) {
      allowed.push("IN", "NOT_IN");
    }
    return RULE_OPERATORS.filter((op) => allowed.includes(op.value));
  };

  /** Left-side source options with the schema field option labeled by the current schema's name */
  const ruleSourceOptions = RULE_SOURCE_OPTIONS.map((opt) =>
    opt.value === RULE_SOURCE_TYPES.SCHEMA_FIELD && schemaName
      ? { ...opt, label: schemaName }
      : opt,
  );

  /** Compare source options with the schema field option labeled by the current schema's name */
  const compareSourceOptions = COMPARE_SOURCE_OPTIONS.map((opt) =>
    opt.value === RULE_SOURCE_TYPES.SCHEMA_FIELD && schemaName
      ? { ...opt, label: schemaName }
      : opt,
  );

  /** Filter compare source options by category */
  const getFilteredCompareSourceOptions = (category: FieldTypeCategory | undefined) => {
    if (!category) return compareSourceOptions;
    // Numeric: no auth fields are numeric, so remove Auth
    if (category === FIELD_TYPE_CATEGORY.NUMERIC) {
      return compareSourceOptions.filter((o) => o.value !== RULE_SOURCE_TYPES.AUTH);
    }
    return compareSourceOptions;
  };

  /** Filter right-side field options based on left operand category */
  const getRightFieldOptions = (cmpSource: string, category: FieldTypeCategory | undefined) => {
    if (cmpSource === RULE_SOURCE_TYPES.AUTH) {
      // A single value (e.g. DepartmentId) may be matched against an access attribute list.
      if (!category || category === FIELD_TYPE_CATEGORY.STRING) return AUTH_LEFT_FIELD_OPTIONS;
      // Array left → only string auth fields (userId, email)
      if (category === FIELD_TYPE_CATEGORY.ARRAY) return AUTH_STRING_FIELDS;
      return AUTH_FIELD_OPTIONS;
    }
    if (cmpSource === RULE_SOURCE_TYPES.SCHEMA_FIELD) {
      if (!category) return schemaFieldOptions;
      return schemaFieldOptions.filter((f) => {
        const fCat = getFieldTypeCategory(f.type, f.isArray);
        if (category === FIELD_TYPE_CATEGORY.STRING) {
          return fCat === FIELD_TYPE_CATEGORY.STRING || fCat === FIELD_TYPE_CATEGORY.ARRAY;
        }
        if (category === FIELD_TYPE_CATEGORY.ARRAY) {
          // Collection operators can compare against either one string or
          // another string-array schema field.
          return getFieldTypeCategory(f.type, false) === FIELD_TYPE_CATEGORY.STRING;
        }
        if (category === FIELD_TYPE_CATEGORY.NUMERIC) {
          return getFieldTypeCategory(f.type, false) === FIELD_TYPE_CATEGORY.NUMERIC;
        }
        return true;
      });
    }
    return [];
  };

  return {
    getFieldOptions,
    getLeftFieldCategory,
    getFilteredOperators,
    getFilteredCompareSourceOptions,
    getRightFieldOptions,
    ruleSourceOptions,
  };
};

export type RuleBuilderHelpers = ReturnType<typeof createRuleBuilderHelpers>;

/**
 * Which condition row + column is currently showing its editor instead of its
 * filled/"Not set" chip, and the shared row-element registry. Owned once by the
 * form so only one cell is ever open across every group.
 */
export interface RuleBuilderContext extends RuleBuilderHelpers {
  projectKey: string;
  openCell: { ruleId: string; key: RuleCellKey } | null;
  setOpenCellSynced: (value: { ruleId: string; key: RuleCellKey } | null) => void;
  openCellRef: RefObject<{ ruleId: string; key: RuleCellKey } | null>;
  rowRefs: RefObject<Map<string, HTMLDivElement>>;
}

/**
 * Scrolls a newly appended row into view and focuses it. It's added at the end
 * of its list — easy to miss if the form is already scrolled or has several
 * rules — and the form's own content scrolls independently of the page, so
 * nothing else would carry the view down to it.
 */
export const useFocusNewRow = (
  fields: { id: string }[],
  rowRefs: RefObject<Map<string, HTMLDivElement>>,
) => {
  const previousCountRef = useRef(fields.length);
  useEffect(() => {
    if (fields.length > previousCountRef.current) {
      const newRow = fields.at(-1);
      const rowEl = newRow && rowRefs.current.get(newRow.id);
      rowEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      rowEl?.querySelector<HTMLElement>("button")?.focus();
    }
    previousCountRef.current = fields.length;
  }, [fields, rowRefs]);
};

const DIRECT_VALUE_PLACEHOLDERS: Record<string, string> = {
  REGEX: "Enter regex pattern",
  START_WITH: "Enter prefix",
};

/** Chip look shared by every cell: disabled, filled or still "Not set". */
const optionsChipTone = (disabled: boolean, isFilled: boolean): string => {
  if (disabled) return "cursor-not-allowed border-dashed border-border/40 text-muted-foreground/40";
  // Every filled chip in a rule looks the same, whichever column it is.
  if (isFilled) return "border-border/70 bg-muted/70 text-foreground hover:bg-muted";
  return "border-dashed border-border/50 bg-background text-muted-foreground hover:bg-muted/30";
};

interface CompareFieldMultiSelectProps {
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (next: string) => void;
}

/** Multi-select popover for the right side of an IN / NOT_IN rule that compares against fields. */
const CompareFieldMultiSelect = ({
  options,
  selectedValues,
  onChange,
}: Readonly<CompareFieldMultiSelectProps>) => {
  const toggleValue = (value: string, selected: boolean) => {
    const updated = selected
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(updated.join(","));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full min-w-0 items-center justify-between rounded-md border border-input bg-background px-3 text-xs"
        >
          <span className="truncate text-left">
            {selectedValues.length > 0 ? selectedValues.join(", ") : "Select fields"}
          </span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {options.map((option) => {
                const selected = selectedValues.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => toggleValue(option.value, selected)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <CheckIcon className="h-4 w-4" />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface RuleConditionRowProps {
  /** Form path of this row, e.g. `rules.0` or `nestedGroups.1.rules.0`. */
  basePath: string;
  /** Stable field id from the owning `useFieldArray`. */
  ruleId: string;
  /** Screen-reader name, e.g. "Condition 1". */
  conditionLabel: string;
  /** What this row does to the one before it: "When" for the first, then "And" / "Or". */
  lead: string;
  ctx: RuleBuilderContext;
  onRemove: () => void;
}

export const RuleConditionRow = ({
  basePath,
  ruleId,
  conditionLabel,
  lead,
  ctx,
  onRemove,
}: RuleConditionRowProps) => {
  const form = useFormContext<RuleSetFormValues>();
  const {
    getFieldOptions,
    getLeftFieldCategory,
    getFilteredOperators,
    getFilteredCompareSourceOptions,
    getRightFieldOptions,
    ruleSourceOptions,
    projectKey,
    openCell,
    setOpenCellSynced,
    openCellRef,
    rowRefs,
  } = ctx;

  /** Typed against row 0 of the root list; the real prefix is only known at runtime. */
  const path = (key: RuleCellKey) => `${basePath}.${key}` as `rules.0.${RuleCellKey}`;

  const source = form.watch(path("source"));
  const leftField = form.watch(path("field"));
  const operatorValue = form.watch(path("operator"));
  const compareSource = form.watch(path("compareSource"));
  const compareValue = form.watch(path("compareValue"));
  const fieldOptions = getFieldOptions(source);
  const category = getLeftFieldCategory(source, leftField);
  const filteredOperators = getFilteredOperators(category, source, leftField);
  const filteredCompareSourceOptions = getFilteredCompareSourceOptions(category);
  const compareFieldOptions = getRightFieldOptions(compareSource, category);
  const isStaticValue = source === RULE_SOURCE_TYPES.STATIC_VALUE;
  const isNullOperator = NULL_OPERATORS.includes(operatorValue);
  const isCompareStatic = compareSource === RULE_SOURCE_TYPES.STATIC_VALUE;
  /** Right side is `Auth.Attributes.<name>`: the name is typed, like on the left. */
  const isCompareAttribute =
    compareSource === RULE_SOURCE_TYPES.AUTH && isAuthAttributeField(compareValue);
  const isInOp = IN_OPERATORS.includes(operatorValue);
  const isDirectValueOp = ["REGEX", "START_WITH", "END_WITH"].includes(operatorValue);
  /**
   * Tenant-scoped principal selector eligibility.
   *
   * Requires the operator to be in a POSITIVE eligible set rather than merely
   * "not excluded", so nothing queries IAM before an operator is chosen.
   *
   * `roles` is an ARRAY field, so its operator surface is
   * CONTAIN/NOT_CONTAIN (+ IN/NOT_IN, which getFilteredOperators adds) - it
   * has no EQUAL. The spec's H1/example name EQUAL for roles, which this UI
   * cannot produce; CONTAIN/NOT_CONTAIN are its scalar operators.
   * `userId` is a STRING field, so EQUAL/NOT_EQUAL and also IN/NOT_IN are
   * reachable - hence userId can legitimately be multi-select.
   */
  const principalScalarOps =
    leftField === "roles" ? ["CONTAIN", "NOT_CONTAIN"] : ["EQUAL", "NOT_EQUAL"];
  const showPrincipalSelector =
    source === RULE_SOURCE_TYPES.AUTH &&
    (leftField === "roles" || leftField === "userId" || leftField === "email") &&
    isCompareStatic &&
    (principalScalarOps.includes(operatorValue) || IN_OPERATORS.includes(operatorValue));

  const selectedInValues =
    isInOp && compareValue
      ? compareValue
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];

  const sourceLabel = ruleSourceOptions.find((option) => option.value === source)?.label;
  const leftFieldLabel = isAuthAttributeField(leftField)
    ? `Attributes.${getAuthAttributeName(leftField)}`
    : (fieldOptions.find((option) => option.value === leftField)?.label ?? leftField);
  const operatorLabel = RULE_OPERATORS.find((option) => option.value === operatorValue)?.label;
  const compareSourceLabel = filteredCompareSourceOptions.find(
    (option) => option.value === compareSource,
  )?.label;
  const compareValueLabel = isCompareAttribute
    ? `Attributes.${getAuthAttributeName(compareValue)}`
    : (compareFieldOptions.find((option) => option.value === compareValue)?.label ?? compareValue);

  const isCellActive = (key: RuleCellKey) => openCell?.ruleId === ruleId && openCell.key === key;

  const openCellFor = (key: RuleCellKey | null) =>
    setOpenCellSynced(key ? { ruleId: ruleId, key } : null);

  /**
   * One entry per table column, always rendered so a rule row stays
   * aligned under the header regardless of how much of it is filled in.
   * `applicable` hides a column the current operator has no use for
   * (e.g. right side for a null-check); `reachable` gates whether an
   * empty column can be opened yet (its prerequisite column is set).
   */
  const cellDefs: {
    key: RuleCellKey;
    title: string;
    label: string | undefined;
    applicable: boolean;
    reachable: boolean;
  }[] = [
    {
      key: "source",
      title: "Left operand",
      label: sourceLabel,
      applicable: true,
      reachable: true,
    },
    {
      key: "field",
      title: "Left value",
      label: leftFieldLabel,
      applicable: true,
      reachable: Boolean(source),
    },
    {
      key: "operator",
      title: "Operator",
      label: operatorLabel,
      applicable: true,
      reachable: Boolean(leftField),
    },
    {
      key: "compareSource",
      title: "Right operand",
      label: compareSourceLabel,
      applicable: !isNullOperator && !isDirectValueOp,
      reachable: Boolean(operatorValue),
    },
    {
      key: "compareValue",
      title: "Right value",
      label: compareValueLabel,
      applicable: !isNullOperator,
      reachable: isDirectValueOp ? Boolean(operatorValue) : Boolean(compareSource),
    },
  ];

  /**
   * Left operand, Right operand and Operator are each a plain list of
   * fixed options, so picking one is a single click on a popover instead
   * of clicking the chip open, then clicking the Select trigger it reveals.
   */
  const pickSource = (value: string) => {
    form.setValue(path("source"), value, { shouldValidate: true });
    form.setValue(path("field"), "", { shouldValidate: true });
    form.setValue(path("operator"), "", { shouldValidate: true });
    form.setValue(path("compareSource"), "", {
      shouldValidate: true,
    });
    form.setValue(path("compareValue"), "", {
      shouldValidate: true,
    });
    openCellFor("field");
  };

  const pickField = (value: string) => {
    form.setValue(path("field"), value, {
      shouldValidate: true,
    });
    const newCategory = getLeftFieldCategory(source, value);
    const allowedOperators = newCategory ? OPERATORS_BY_CATEGORY[newCategory] : null;
    const currentOperator = form.getValues(path("operator"));
    if (allowedOperators && currentOperator && !allowedOperators.includes(currentOperator)) {
      form.setValue(path("operator"), "", {
        shouldValidate: true,
      });
    }
    form.setValue(path("compareSource"), "", {
      shouldValidate: true,
    });
    form.setValue(path("compareValue"), "", {
      shouldValidate: true,
    });
    openCellFor(null);
  };

  const pickOperator = (value: string) => {
    const wasIn = IN_OPERATORS.includes(operatorValue);
    const willBeIn = IN_OPERATORS.includes(value);
    form.setValue(path("operator"), value, {
      shouldValidate: true,
    });
    if (NULL_OPERATORS.includes(value) || ["REGEX", "START_WITH", "END_WITH"].includes(value)) {
      form.setValue(path("compareSource"), "", {
        shouldValidate: true,
      });
      form.setValue(path("compareValue"), "", {
        shouldValidate: true,
      });
    } else if (wasIn !== willBeIn) {
      form.setValue(path("compareValue"), "", {
        shouldValidate: true,
      });
    }
    // Never auto-opens compareSource: chaining straight from one
    // popover into another within the same interaction is unreliable
    // (two Radix popover layers racing to open/close together). Once
    // reachable it shows as a plain "Not set" chip — one more click
    // opens it, same as any other popover column.
    openCellFor(["REGEX", "START_WITH", "END_WITH"].includes(value) ? "compareValue" : null);
  };

  const pickCompareSource = (value: string) => {
    form.setValue(path("compareSource"), value, {
      shouldValidate: true,
    });
    form.setValue(path("compareValue"), "", {
      shouldValidate: true,
    });
    openCellFor("compareValue");
  };

  const pickCompareValue = (value: string) => {
    // An access attribute still needs its name, so the cell stays open for it.
    const isAttribute = compareSource === RULE_SOURCE_TYPES.AUTH && isAuthAttributeField(value);
    form.setValue(path("compareValue"), isAttribute ? `${AUTH_ATTRIBUTE_OPTION.value}.` : value, {
      shouldValidate: true,
    });
    openCellFor(isAttribute ? "compareValue" : null);
  };

  /**
   * The popover-driven chip shared by source, operator and compareSource.
   * Stays mounted (just with its trigger disabled) rather than appearing
   * only once the column becomes reachable — a Popover that is inserted
   * into the tree already `open` (the instant a pick advances to it) can
   * mount before its own positioning is ready, so it never shows.
   */
  const renderOptionsChip = (
    cell: (typeof cellDefs)[number],
    options: { value: string; label: string }[],
    onPick: (value: string) => void,
  ) => {
    const isFilled = Boolean(cell.label);
    const disabled = !cell.reachable;
    let ariaLabel: string | undefined;
    if (!disabled) ariaLabel = isFilled ? cell.label : `Set ${cell.title}`;

    return (
      <Popover
        key={cell.key}
        open={!disabled && isCellActive(cell.key)}
        onOpenChange={(open) => {
          // Guarded against the ref, not the closed-over `openCell`: a
          // stale dismiss signal for a popover a pick already advanced
          // past (operator -> compareSource, both inside one click) must
          // not clobber that newer state — see the state declaration.
          const stillActive =
            openCellRef.current?.ruleId === ruleId && openCellRef.current.key === cell.key;
          if (!open && stillActive) openCellFor(null);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-hidden={disabled || undefined}
            onClick={() => openCellFor(cell.key)}
            title={disabled ? undefined : `Edit ${cell.key}`}
            className={cn(
              "flex h-8 min-w-0 max-w-full items-center justify-center truncate rounded-md border px-3 text-center text-xs font-semibold transition-colors",
              optionsChipTone(disabled, isFilled),
            )}
          >
            <span className="block truncate">{isFilled ? cell.label : "Not set"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0" align="start">
          <Command>
            <CommandList>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem key={option.value} onSelect={() => onPick(option.value)}>
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const renderCellEditor = (key: RuleCellKey) => {
    if (key === "field") {
      return (
        <FormField
          control={form.control}
          name={path("field")}
          render={({ field }) =>
            isStaticValue ? (
              <Input
                className="h-9 w-full min-w-0 rounded-md px-3 text-xs"
                placeholder="Enter value"
                value={field.value}
                onChange={field.onChange}
                onBlur={() => openCellFor(field.value ? "operator" : null)}
                autoFocus
              />
            ) : (
<>
              <Select
                value={(isAuthAttributeField(field.value) ? AUTH_ATTRIBUTE_OPTION.value : field.value) || undefined}
                onValueChange={(value) => {
                  // An access attribute still needs its name, so the cell stays open for it.
                  const isAttribute = isAuthAttributeField(value);
                  field.onChange(isAttribute ? `${AUTH_ATTRIBUTE_OPTION.value}.` : value);
                  const newCategory = getLeftFieldCategory(source, value);
                  const allowedOperators = newCategory ? OPERATORS_BY_CATEGORY[newCategory] : null;
                  const currentOperator = form.getValues(path("operator"));
                  if (
                    allowedOperators &&
                    currentOperator &&
                    !allowedOperators.includes(currentOperator)
                  ) {
                    form.setValue(path("operator"), "", {
                      shouldValidate: true,
                    });
                  }
                  form.setValue(path("compareSource"), "", {
                    shouldValidate: true,
                  });
                  form.setValue(path("compareValue"), "", {
                    shouldValidate: true,
                  });
                  // Not auto-opened, same reasoning as the operator ->
                  // compareSource handoff below.
                  if (!isAttribute) openCellFor(null);
                }}
              >
                <SelectTrigger className="h-9 w-full min-w-0 rounded-md px-3 text-xs">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAuthAttributeField(field.value) && (
                <Input
                  className="mt-1 h-9 w-full min-w-0 rounded-md px-3 text-xs"
                  placeholder="Attribute name"
                  aria-label="Attribute name"
                  value={getAuthAttributeName(field.value)}
                  onChange={(event) =>
                    field.onChange(
                      `${AUTH_ATTRIBUTE_OPTION.value}.${event.target.value.replaceAll(/\W/g, "")}`,
                    )
                  }
                  onBlur={() => openCellFor(getAuthAttributeName(field.value) ? "operator" : null)}
                />
              )}
            </>
            )
          }
        />
      );
    }

    return (
      <FormField
        control={form.control}
        name={path("compareValue")}
        render={({ field }) => {
          if (isCompareAttribute) {
            return (
              <Input
                className="h-9 w-full min-w-0 rounded-md px-3 text-xs"
                placeholder="Attribute name"
                aria-label="Attribute name"
                value={getAuthAttributeName(field.value)}
                onChange={(event) =>
                  field.onChange(
                    `${AUTH_ATTRIBUTE_OPTION.value}.${event.target.value.replaceAll(/\W/g, "")}`,
                  )
                }
                onBlur={() => openCellFor(null)}
                autoFocus
              />
            );
          }
          if (isDirectValueOp) {
            const placeholder = DIRECT_VALUE_PLACEHOLDERS[operatorValue] ?? "Enter suffix";
            return (
              <Input
                className="h-9 w-full min-w-0 rounded-md px-3 text-xs"
                placeholder={placeholder}
                value={field.value}
                onChange={field.onChange}
                onBlur={() => openCellFor(null)}
                autoFocus
              />
            );
          }

          if (isInOp && isCompareStatic) {
            return (
              <Input
                className="h-9 w-full min-w-0 rounded-md px-3 text-xs"
                placeholder="Values"
                value={field.value}
                onChange={field.onChange}
                onBlur={() => openCellFor(null)}
                autoFocus
              />
            );
          }

          if (isInOp && !isCompareStatic && compareSource) {
            return (
              <CompareFieldMultiSelect
                options={compareFieldOptions}
                selectedValues={selectedInValues}
                // Attributes stand alone: picking them replaces the other fields.
                onChange={(next) =>
                  field.onChange(
                    next.split(",").includes(AUTH_ATTRIBUTE_OPTION.value)
                      ? `${AUTH_ATTRIBUTE_OPTION.value}.`
                      : next,
                  )
                }
              />
            );
          }

          return isCompareStatic ? (
            <Input
              className="h-9 w-full min-w-0 rounded-md px-3 text-xs"
              placeholder="Enter value"
              value={field.value}
              onChange={field.onChange}
              onBlur={() => openCellFor(null)}
              autoFocus
            />
          ) : (
            <Select
              value={field.value || undefined}
              onValueChange={(value) => {
                field.onChange(value);
                openCellFor(null);
              }}
            >
              <SelectTrigger className="h-9 w-full min-w-0 rounded-md px-3 text-xs">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {compareFieldOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }}
      />
    );
  };

  const optionsChipConfig = (cell: (typeof cellDefs)[number]) => {
    switch (cell.key) {
      case "source":
        return { options: ruleSourceOptions, onPick: pickSource };
      case "operator":
        return { options: filteredOperators, onPick: pickOperator };
      case "compareSource":
        return { options: filteredCompareSourceOptions, onPick: pickCompareSource };
      case "field":
        return isStaticValue ? null : { options: fieldOptions, onPick: pickField };
      default:
        return isDirectValueOp ||
          isCompareStatic ||
          showPrincipalSelector ||
          isInOp ||
          isCompareAttribute
          ? null
          : { options: compareFieldOptions, onPick: pickCompareValue };
    }
  };

  const renderCell = (cell: (typeof cellDefs)[number]) => {
      if (!cell.applicable) return null;

    // Operand/operator columns are a fixed option list opened
    // with a single click on a popover — renderOptionsChip
    // handles the "not reachable yet" (disabled) state itself,
    // so its Popover stays mounted rather than appearing only
    // once the column opens.
    const chip = optionsChipConfig(cell);
    if (chip) return renderOptionsChip(cell, chip.options, chip.onPick);

    // Roles / users: the chip is the picker, like the other option chips — one
    // click opens the list, no editor step in between.
    if (cell.key === "compareValue" && showPrincipalSelector) {
      return (
        <PrincipalSelector
          key={cell.key}
          variant="chip"
          entity={leftField === "roles" ? "role" : "user"}
          userValueField={leftField === "email" ? "email" : "itemId"}
          projectKey={projectKey}
          value={compareValue}
          onChange={(next) =>
            form.setValue(path("compareValue"), next, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          multiple
        />
      );
    }

    if (!cell.reachable) {
      return (
        <div
          key={cell.key}
          aria-hidden="true"
          className="flex h-8 min-w-0 max-w-full items-center justify-center truncate rounded-md border border-dashed border-border/40 px-3 text-center text-xs text-muted-foreground/40"
        >
          Not set
        </div>
      );
    }

    if (isCellActive(cell.key)) {
      return (
        <div key={cell.key} className="min-w-36 flex-1 rounded-md bg-muted/30 p-1">
          {renderCellEditor(cell.key)}
        </div>
      );
    }

    // Only "field" and "compareValue" reach here — their editor
    // shape varies too much (input, select, popover multi-select,
    // the principal selector) for a single shared popover.
    const isFilled = Boolean(cell.label);

    return (
      <button
        key={cell.key}
        type="button"
        aria-label={isFilled ? cell.label : `Set ${cell.title}`}
        onClick={() => openCellFor(cell.key)}
        title={`Edit ${cell.key}`}
        className={cn(
          "flex h-8 min-w-0 max-w-full items-center justify-center truncate rounded-md border px-3 text-center text-xs font-semibold transition-colors",
          isFilled
            ? "border-border/70 bg-muted/70 text-foreground hover:bg-muted"
            : "border-dashed border-border/50 bg-background text-muted-foreground hover:bg-muted/30",
        )}
      >
        <span className="block truncate">{isFilled ? cell.label : "Not set"}</span>
      </button>
    );
  };

  return (
    <Card
      ref={(el) => {
        if (el) rowRefs.current.set(ruleId, el);
        else rowRefs.current.delete(ruleId);
      }}
      className="rounded-lg border border-border/60 bg-background p-3 shadow-none"
    >
      <span className="sr-only">{conditionLabel}</span>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10.5px] font-semibold text-muted-foreground">{lead}</span>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove rule"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.25} />
        </Button>
      </div>
      <div
        className="flex flex-wrap items-center gap-1.5"
        aria-label={`${conditionLabel} expression`}
      >
        {cellDefs.map(renderCell)}
      </div>
    </Card>
  );
};

