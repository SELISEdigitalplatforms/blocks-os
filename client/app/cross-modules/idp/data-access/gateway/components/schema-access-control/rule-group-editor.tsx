"use client";

import { Button } from "@/components/ui-kits/button/button";
import { MAX_RULE_GROUP_DEPTH } from "@blocks-idp/data-access/gateway/constants/schema-access-control";
import {
  createBlankGroup,
  createBlankRule,
  type RuleSetFormValues,
} from "@blocks-idp/data-access/gateway/utils/schema-access-control.utils";
import { cn } from "@/lib/utils";
import { Plus, SquarePlus, X } from "lucide-react";
import { Fragment } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { RuleConditionRow, useFocusNewRow, type RuleBuilderContext } from "./rule-condition-row";

/** `nestedGroups.1` + `rules` → `nestedGroups.1.rules`; the root's path is empty. */
const joinPath = (path: string, key: string) => (path ? `${path}.${key}` : key);

/**
 * How a group combines what is directly inside it, shown between its items:
 * a centred rule at the top level, a small label inside a nested group.
 */
const GroupJoiner = ({ operator, centered }: { operator: string; centered: boolean }) => {
  const word = operator === "OR" ? "OR" : "AND";
  if (centered) {
    return (
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="h-px flex-1 bg-border/50" />
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary">
          {word}
        </span>
        <span className="h-px flex-1 bg-border/50" />
      </div>
    );
  }
  return (
    <span
      className="pl-1 text-[10px] font-bold tracking-wider text-muted-foreground"
      aria-hidden="true"
    >
      {word}
    </span>
  );
};

interface RuleGroupChildrenProps {
  /** Form path of the group, `""` for the root. */
  path: string;
  /** 1 for the root, 2 for a group in it, and so on. */
  depth: number;
  ctx: RuleBuilderContext;
  ruleFields: { id: string }[];
  groupFields: { id: string }[];
  onRemoveRule: (index: number) => void;
  onRemoveGroup: (index: number) => void;
  /** Screen-reader prefix for conditions inside nested groups, e.g. "Group 1 ". */
  labelPrefix?: string;
}

/**
 * A group's contents: its rules, then its groups.
 *
 * Every join is labelled exactly once. A rule card carries its own "When" /
 * "And" / "Or" lead, so nothing more is drawn between rules; a nested group has
 * no lead, so the group's AND/OR is drawn in front of it instead. Shared by the
 * root (rendered by the form) and every nested group, so both lay out alike.
 */
export const RuleGroupChildren = ({
  path,
  depth,
  ctx,
  ruleFields,
  groupFields,
  onRemoveRule,
  onRemoveGroup,
  labelPrefix = "",
}: RuleGroupChildrenProps) => {
  const form = useFormContext<RuleSetFormValues>();
  const operator = form.watch(joinPath(path, "logicalOperator") as "logicalOperator");

  const children = [
    ...ruleFields.map((field, index) => ({ kind: "rule" as const, id: field.id, index })),
    ...groupFields.map((field, index) => ({ kind: "group" as const, id: field.id, index })),
  ];

  return (
    <div className="flex flex-col gap-3">
      {children.map((child, position) => (
        <Fragment key={child.id}>
          {child.kind === "group" && position > 0 && (
            <GroupJoiner operator={operator} centered={depth === 1} />
          )}
          {child.kind === "rule" ? (
            <RuleConditionRow
              basePath={joinPath(path, `rules.${child.index}`)}
              ruleId={child.id}
              conditionLabel={`${labelPrefix}Condition ${child.index + 1}`}
              lead={position === 0 ? "When" : operator === "OR" ? "Or" : "And"}
              ctx={ctx}
              onRemove={() => onRemoveRule(child.index)}
            />
          ) : (
            <RuleGroupEditor
              path={joinPath(path, `nestedGroups.${child.index}`)}
              depth={depth + 1}
              ctx={ctx}
              labelPrefix={`${labelPrefix}Group ${child.index + 1} `}
              onRemove={() => onRemoveGroup(child.index)}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
};

interface RuleGroupEditorProps {
  /** Form path of this group, e.g. `nestedGroups.0`. */
  path: string;
  /** Depth of this group: 2 for a group in the root. */
  depth: number;
  ctx: RuleBuilderContext;
  /** Screen-reader prefix, e.g. "Group 1 ". */
  labelPrefix: string;
  onRemove: () => void;
}

const MATCH_OPTIONS = [
  { value: "AND", label: "Match all", ariaLabel: "Group match all" },
  { value: "OR", label: "Match any", ariaLabel: "Group match any" },
] as const;

/**
 * One nested group of a rule set: its own Match all / Match any, its own
 * rules, and — until the depth cap — its own groups. Recurses through
 * `RuleGroupChildren`.
 */
export const RuleGroupEditor = ({
  path,
  depth,
  ctx,
  labelPrefix,
  onRemove,
}: RuleGroupEditorProps) => {
  const form = useFormContext<RuleSetFormValues>();
  const {
    fields: ruleFields,
    append: appendRule,
    remove: removeRule,
  } = useFieldArray({ control: form.control, name: `${path}.rules` as "rules" });
  const {
    fields: groupFields,
    append: appendGroup,
    remove: removeGroup,
  } = useFieldArray({ control: form.control, name: `${path}.nestedGroups` as "nestedGroups" });
  useFocusNewRow(ruleFields, ctx.rowRefs);

  const operator = form.watch(`${path}.logicalOperator` as "logicalOperator");
  const canNest = depth < MAX_RULE_GROUP_DEPTH;
  const isEmpty = ruleFields.length + groupFields.length === 0;

  return (
    <section
      aria-label={`${labelPrefix}group`.trim()}
      className={cn(
        "rounded-lg border p-2.5",
        depth > 2 ? "border-border/70 bg-muted/25" : "border-border/50 bg-muted/10",
      )}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Group
        </span>
        <div
          role="radiogroup"
          aria-label={`${labelPrefix}group match`}
          className="flex items-center gap-1 rounded-md border border-border/40 bg-background p-0.5"
        >
          {MATCH_OPTIONS.map((option) => {
            const isSelected = operator === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-label={option.ariaLabel}
                aria-checked={isSelected}
                onClick={() =>
                  form.setValue(`${path}.logicalOperator` as "logicalOperator", option.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                className={cn(
                  "rounded-sm px-2 py-0.5 text-[10.5px] font-semibold transition-colors",
                  isSelected
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Add rule to group"
          className="h-6 gap-1 px-1.5 text-[11px] font-semibold text-primary hover:text-primary"
          onClick={() => appendRule(createBlankRule())}
        >
          <Plus className="h-3 w-3" />
          Rule
        </Button>
        {canNest && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Add group inside group"
            className="h-6 gap-1 px-1.5 text-[11px] font-semibold text-primary hover:text-primary"
            onClick={() => appendGroup(createBlankGroup())}
          >
            <SquarePlus className="h-3 w-3" />
            Group
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove group"
          className="h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.25} />
        </Button>
      </div>

      {isEmpty ? (
        <p
          role="alert"
          className="rounded-md border border-dashed border-destructive/40 px-3 py-2 text-[11px] text-destructive"
        >
          Empty group: add a rule, or remove the group. An empty group never matches.
        </p>
      ) : (
        <RuleGroupChildren
          path={path}
          depth={depth}
          ctx={ctx}
          ruleFields={ruleFields}
          groupFields={groupFields}
          onRemoveRule={removeRule}
          onRemoveGroup={removeGroup}
          labelPrefix={labelPrefix}
        />
      )}
    </section>
  );
};

