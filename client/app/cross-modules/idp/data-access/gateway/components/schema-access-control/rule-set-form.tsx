"use client";

import { Button } from "@/components/ui-kits/button/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import {
  NULL_OPERATORS,
  POLICY_OPERATION,
  POLICY_TYPE,
} from "@blocks-idp/data-access/gateway/constants/schema-access-control";
import type { PresetRuleSet } from "@blocks-idp/data-access/gateway/utils/access-presets";
import type {
  ICreatePolicyPayload,
  IPolicyItem,
  IUpdatePolicyPayload,
} from "@blocks-idp/data-access/gateway/models/data-service";
import {
  createBlankGroup,
  createBlankRule,
  formGroupToPolicyGroup,
  policyGroupToFormGroup,
  type RuleGroupValues,
  type RuleSetFormValues,
} from "@blocks-idp/data-access/gateway/utils/schema-access-control.utils";
import { StatusSnackbar } from "../primitives";
import type { TransientStatus } from "@blocks-idp/data-access/gateway/hooks/use-transient-status";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { ChevronLeft, Plus, SquarePlus } from "lucide-react";
import { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import {
  createRuleBuilderHelpers,
  useFocusNewRow,
  type RuleBuilderContext,
  type RuleCellKey,
  type SchemaField,
} from "./rule-condition-row";
import { RuleGroupChildren } from "./rule-group-editor";

const ruleRowSchema = z
  .object({
    source: z.string().min(1, "Source is required"),
    field: z.string().min(1, "Field is required"),
    operator: z.string().min(1, "Operator is required"),
    compareSource: z.string().default(""),
    compareValue: z.string().default(""),
  })
  .superRefine((data, ctx) => {
    if (NULL_OPERATORS.includes(data.operator)) return;

    const directValueOps = ["REGEX", "START_WITH", "END_WITH"];
    if (directValueOps.includes(data.operator)) {
      if (!data.compareValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Value is required",
          path: ["compareValue"],
        });
      }
      return;
    }

    if (!data.compareSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Compare source is required",
        path: ["compareSource"],
      });
    }
    if (!data.compareValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Compare value is required",
        path: ["compareValue"],
      });
    }
  });

/**
 * A group needs something inside it. The server evaluates an empty group to
 * false, so an AND parent holding one would deny everyone — better to refuse
 * it here than to save a rule set that quietly grants nothing.
 */
const groupHasContent = (group: { rules: unknown[]; nestedGroups: unknown[] }) =>
  group.rules.length + group.nestedGroups.length > 0;

const logicalOperatorSchema = z.enum(["AND", "OR"], {
  required_error: "Please select a rule relation",
});

const ruleGroupSchema: z.ZodType<RuleGroupValues, z.ZodTypeDef, unknown> = z
  .object({
    logicalOperator: logicalOperatorSchema,
    rules: z.array(ruleRowSchema),
    nestedGroups: z.array(z.lazy(() => ruleGroupSchema)),
  })
  .refine(groupHasContent, {
    message: "A group needs at least one rule",
    path: ["rules"],
  });

const ruleSetSchema = z
  .object({
    name: z.string().trim().min(1, "Rule Set Name is required"),
    logicalOperator: logicalOperatorSchema,
    rules: z.array(ruleRowSchema),
    nestedGroups: z.array(ruleGroupSchema),
  })
  .refine(groupHasContent, {
    message: "At least one complete rule is required",
    path: ["rules"],
  });

/** The verb shown under the title, e.g. "Order · Update". */
const OPERATION_LABEL: Record<number, string> = {
  [POLICY_OPERATION.READ]: "Read",
  [POLICY_OPERATION.CREATE]: "Create",
  [POLICY_OPERATION.UPDATE]: "Update",
  [POLICY_OPERATION.DELETE]: "Delete",
  [POLICY_OPERATION.ALL]: "All",
};

interface RuleSetFormProps {
  onCancel?: () => void;
  schemaFields?: SchemaField[];
  schemaName: string;
  schemaId: string;
  operation: number;
  fieldNames: string[];
  editingPolicy?: IPolicyItem;
  level: "row" | "column";
  /**
   * Starting values from a preset. It fills the form rather than saving, so the
   * rules are reviewed before they grant anything, and so presets and the form
   * share one payload builder. Ignored while editing an existing set.
   */
  seed?: PresetRuleSet;
  /**
   * Hands the built payload back to the parent instead of sending it — this
   * form doesn't call the create/update API itself. The parent sends it
   * straight away (first saving a pending access-level change, if there is
   * one, so the rule always lands against the right tier).
   */
  onStage: (staged: {
    payload: ICreatePolicyPayload | IUpdatePolicyPayload;
    isEditMode: boolean;
  }) => void;
  /** True while `onStage` has the save in flight. */
  isSubmitting?: boolean;
  /** The parent's most recent save result, shown in this footer's status
   *  slot instead of a toast — see `useTransientStatus`. */
  status?: TransientStatus | null;
}

export const RuleSetForm = ({
  onCancel,
  schemaFields = [],
  schemaName,
  schemaId,
  operation,
  fieldNames,
  editingPolicy,
  level,
  seed,
  onStage,
  isSubmitting = false,
  status = null,
}: RuleSetFormProps) => {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  const isEditMode = !!editingPolicy;

  const form = useForm<RuleSetFormValues>({
    resolver: zodResolver(ruleSetSchema),
    mode: "onChange",
    defaultValues: {
      name: editingPolicy?.policyName ?? seed?.name ?? "",
      ...(editingPolicy
        ? policyGroupToFormGroup(editingPolicy.ruleGroup)
        : {
            logicalOperator: seed?.logicalOperator ?? "AND",
            rules: seed?.rules ?? [],
            nestedGroups: [],
          }),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rules",
  });
  const {
    fields: groupFields,
    append: appendGroup,
    remove: removeGroup,
  } = useFieldArray({
    control: form.control,
    name: "nestedGroups",
  });

  /**
   * Which condition row + column is currently showing its editor instead of
   * its filled/"Not set" chip. One piece of state rather than a hook per row,
   * since rows are rendered from a .map() and hooks can't live inside a loop.
   *
   * `openCellRef` mirrors it synchronously (updated the instant it changes,
   * not after React's next render). A popover-to-popover handoff — clicking
   * compareSource's trigger while operator's is still open — fires two
   * `onOpenChange` calls inside the SAME click: our own (advancing to
   * compareSource) and Radix's dismiss layer for operator, which sees that
   * click as "outside" and asks to close. Both land in one React batch, so
   * whichever runs last wins — and operator's dismiss handler still closes
   * over the pre-click `openCell`, so its "am I still the active cell?" guard
   * reads stale and fires anyway, clobbering the advance. Reading the ref
   * instead of the closed-over state keeps that guard correct mid-event.
   */
  const [openCell, setOpenCell] = useState<{ ruleId: string; key: RuleCellKey } | null>(null);
  const openCellRef = useRef(openCell);
  const setOpenCellSynced = (value: typeof openCell) => {
    openCellRef.current = value;
    setOpenCell(value);
  };

  /** One blank row. The literal was written out at both Add Rule triggers. */
  const addRule = () => append(createBlankRule());

  /** Condition row elements, keyed by their stable field id — see `useFocusNewRow`. */
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  useFocusNewRow(fields, rowRefs);

  /** The option lists and type rules every condition row picks from, root or nested. */
  const ruleBuilderCtx: RuleBuilderContext = {
    ...createRuleBuilderHelpers(schemaFields, schemaName),
    projectKey,
    openCell,
    setOpenCellSynced,
    openCellRef,
    rowRefs,
  };

  const onSubmit = (values: RuleSetFormValues) => {
    const ruleGroup = formGroupToPolicyGroup(values);

    if (isEditMode && editingPolicy?.itemId) {
      const payload: IUpdatePolicyPayload = {
        itemId: editingPolicy.itemId,
        policyName: values.name,
        policyDescription: editingPolicy.policyDescription ?? "Generated from Rule Builder",
        policyType: level === "row" ? POLICY_TYPE.ROW : POLICY_TYPE.COLUMN,
        operation,
        schemaName,
        schemaId,
        fieldNames: editingPolicy.fieldNames,
        ruleGroup,
        priority: editingPolicy.priority,
        isAllowPolicy: editingPolicy.isAllowPolicy,
        projectKey,
      };
      onStage({ payload, isEditMode: true });
    } else {
      const payload: ICreatePolicyPayload = {
        policyName: values.name,
        policyDescription: "Generated from Rule Builder",
        policyType: level === "row" ? POLICY_TYPE.ROW : POLICY_TYPE.COLUMN,
        operation,
        schemaName,
        schemaId,
        fieldNames,
        ruleGroup,
        priority: 1,
        isAllowPolicy: true,
        projectKey,
      };
      onStage({ payload, isEditMode: false });
    }
  };

  const submitRuleSet = form.handleSubmit(onSubmit);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <Form {...form}>
        <form
          onSubmit={(e) => {
            // Schema structure wraps the page in <form>; drawer portals can still leave edge cases
            // where submit bubbles or implicit submit targets the wrong form — keep policy saves isolated.
            e.preventDefault();
            e.stopPropagation();
            void submitRuleSet(e);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* Everything but the footer scrolls in its own region, bounded by
              the flex column above. A `position: sticky` footer here would
              only sit flush with the last rule when there's nothing to
              scroll — sticky never reaches for the bottom of unused space,
              it just holds position once you'd otherwise scroll past it. */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div className="flex items-center gap-2.5 border-b border-border/40 pb-3.5 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Back to rule sets"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                disabled={isSubmitting}
                onClick={onCancel}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-foreground">
                  {isEditMode ? "Edit rule set" : "New rule set for Custom policy"}
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {schemaName} · {OPERATION_LABEL[operation] ?? ""}
                </p>
              </div>
            </div>

            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                    Rule set name
                  </FormLabel>
                  <FormControl>
                    <Input className="h-9" placeholder="Enter a rule name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <section>
              <FormField
                control={form.control}
                name="logicalOperator"
                render={({ field }) => (
                  <FormItem className="mb-3 space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                        Rules
                      </span>
                      <FormControl>
                        <div
                          role="radiogroup"
                          aria-label="Multi-rule relations"
                          className="flex items-center gap-0.5 rounded-md border border-border/50 bg-background p-0.5"
                        >
                          {(
                            [
                              { value: "AND", label: "Match all" },
                              { value: "OR", label: "Match any" },
                            ] as const
                          ).map((option) => {
                            const isSelected = field.value === option.value;
                            return (
                              <label
                                key={option.value}
                                className={cn(
                                  "rounded-sm px-2.5 py-1 text-[11px] font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                                  isSelected
                                    ? "bg-primary/15 text-primary"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                <input
                                  type="radio"
                                  name={field.name}
                                  className="sr-only"
                                  aria-label={option.label}
                                  checked={isSelected}
                                  onChange={() => field.onChange(option.value)}
                                />
                                {option.label}
                              </label>
                            );
                          })}
                        </div>
                      </FormControl>
                      <div className="flex-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Add Rule"
                        className="h-7 shrink-0 gap-1 px-2 text-xs font-semibold text-primary hover:text-primary"
                        onClick={addRule}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Rule
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Add group"
                        className="h-7 shrink-0 gap-1 px-2 text-xs font-semibold text-primary hover:text-primary"
                        onClick={() => appendGroup(createBlankGroup())}
                      >
                        <SquarePlus className="h-3.5 w-3.5" />
                        Group
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {fields.length === 0 && groupFields.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No rules added yet. Add a rule to define who can view.
                </p>
              ) : (
                <RuleGroupChildren
                  path=""
                  depth={1}
                  ctx={ruleBuilderCtx}
                  ruleFields={fields}
                  groupFields={groupFields}
                  onRemoveRule={remove}
                  onRemoveGroup={removeGroup}
                />
              )}
            </section>
          </div>

          {/* Always on screen below the scrollable content above, instead of
              at the end of the form's own content — on a rule set of any
              size, that used to mean scrolling past every rule to reach
              Save, and the view's own access-type footer was hidden while
              this form was open, leaving no visible action at all. One
              footer, both concerns. */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-border/40 bg-card pt-3">
            <StatusSnackbar status={status} />
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                {/* Sent the moment this is saved here — including the pending
                    access-level change first, if Custom was just picked — so
                    there's never a second, separate Save to remember. */}
                {isSubmitting ? "Saving…" : "Saves immediately"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!form.formState.isValid || isSubmitting}
                onClick={() => void submitRuleSet()}
              >
                Save rule set
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

