import {
  IN_OPERATORS,
  LOGICAL_OPERATOR,
  NUMBER_TO_OPERATOR,
  NUMBER_TO_SOURCE_TYPE,
  OPERATOR_TO_NUMBER,
  RULE_SOURCE_TYPES,
  SOURCE_TYPE_TO_NUMBER,
} from "../constants/schema-access-control";
import type { IField, IPolicyRule, IPolicyRuleGroup } from "../models/data-service";

// ─── Rule-set form shapes ────────────────────────────────────────────────────

/** One condition row of the rule-set form (string keys, not the API's numbers). */
export interface RuleRowValues {
  source: string;
  field: string;
  operator: string;
  compareSource: string;
  compareValue: string;
}

/** A group of conditions — the root of the form, or any group nested in it. */
export interface RuleGroupValues {
  logicalOperator: "AND" | "OR";
  rules: RuleRowValues[];
  nestedGroups: RuleGroupValues[];
}

// ─── Policy Rule Conversion ──────────────────────────────────────────────────

/** Convert an API policy rule (numeric) to form values (string keys) */
export function policyRuleToFormRow(rule: IPolicyRule) {
  const compareSource = NUMBER_TO_SOURCE_TYPE[rule.rightSource] ?? RULE_SOURCE_TYPES.STATIC_VALUE;
  const operatorKey = NUMBER_TO_OPERATOR[rule.operator] ?? "";
  const isContain = IN_OPERATORS.includes(operatorKey);
  const isDirectValue = ["REGEX", "START_WITH", "END_WITH"].includes(operatorKey);

  let compareValue: string;
  if (isDirectValue) {
    compareValue = (rule.staticValue as string) ?? "";
  } else if (compareSource === RULE_SOURCE_TYPES.STATIC_VALUE) {
    compareValue =
      isContain && Array.isArray(rule.staticValue)
        ? rule.staticValue.join(", ")
        : ((rule.staticValue as string) ?? "");
  } else {
    compareValue = rule.rightOperands?.length
      ? rule.rightOperands.join(",")
      : (rule.rightOperand ?? "");
  }

  return {
    source: NUMBER_TO_SOURCE_TYPE[rule.leftSource] ?? "",
    field: rule.leftOperand,
    operator: operatorKey,
    compareSource,
    compareValue,
  };
}

/** The whole rule-set form: a name, plus the root group's own fields. */
export type RuleSetFormValues = RuleGroupValues & { name: string };

/** A blank condition row, as added by every Add Rule trigger. */
export const createBlankRule = (): RuleRowValues => ({
  source: "",
  field: "",
  operator: "",
  compareSource: "",
  compareValue: "",
});

/** A new nested group: matches any of its rules, and starts with one blank rule. */
export const createBlankGroup = (): RuleGroupValues => ({
  logicalOperator: "OR",
  rules: [createBlankRule()],
  nestedGroups: [],
});

const DIRECT_VALUE_OPERATORS = new Set(["REGEX", "START_WITH", "END_WITH"]);

/** Convert one form row into the API's policy rule. */
export function formRowToPolicyRule(r: RuleRowValues): IPolicyRule {
  const isContain = IN_OPERATORS.includes(r.operator);
  const isDirectValue = DIRECT_VALUE_OPERATORS.has(r.operator);
  const isStatic = r.compareSource === RULE_SOURCE_TYPES.STATIC_VALUE;

  let rightOperand = "";
  let rightOperands: string[] = [];
  let staticValue: string | string[] | null = null;

  if (isDirectValue) {
    staticValue = r.compareValue || null;
  } else if (isContain) {
    if (isStatic) {
      // The policy API stores principal multi-selections as a single,
      // comma-delimited value; the backend expands it during evaluation.
      staticValue = r.compareValue;
    } else {
      rightOperands = r.compareValue
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      rightOperand = rightOperands[0] ?? "";
    }
  } else {
    rightOperand = isStatic ? "" : r.compareValue;
    staticValue = isStatic ? r.compareValue || null : null;
  }

  return {
    leftSource: SOURCE_TYPE_TO_NUMBER[r.source] ?? 0,
    leftOperand: r.field,
    operator: OPERATOR_TO_NUMBER[r.operator] ?? 0,
    rightSource:
      SOURCE_TYPE_TO_NUMBER[r.compareSource] ??
      SOURCE_TYPE_TO_NUMBER[RULE_SOURCE_TYPES.STATIC_VALUE],
    rightOperand,
    rightOperands,
    staticValue,
  };
}

/**
 * Convert an API rule group into form values, recursively. A group stored
 * without `nestedGroups` (older documents) reads as having none.
 */
export function policyGroupToFormGroup(group: IPolicyRuleGroup): RuleGroupValues {
  return {
    logicalOperator: group.logicalOperator === LOGICAL_OPERATOR.OR ? "OR" : "AND",
    rules: (group.rules ?? []).map(policyRuleToFormRow),
    nestedGroups: (group.nestedGroups ?? []).map(policyGroupToFormGroup),
  };
}

/** Convert form values into the API's rule group, recursively. */
export function formGroupToPolicyGroup(group: RuleGroupValues): IPolicyRuleGroup {
  return {
    logicalOperator: group.logicalOperator === "AND" ? LOGICAL_OPERATOR.AND : LOGICAL_OPERATOR.OR,
    rules: group.rules.map(formRowToPolicyRule),
    nestedGroups: group.nestedGroups.map(formGroupToPolicyGroup),
  };
}

/** How many rules a policy's group holds, counting every nested level. */
export function countPolicyRules(group: IPolicyRuleGroup): number {
  return (
    (group.rules?.length ?? 0) +
    (group.nestedGroups ?? []).reduce((total, nested) => total + countPolicyRules(nested), 0)
  );
}

/** How many groups sit beneath a policy's group, counting every nested level. */
export function countPolicyGroups(group: IPolicyRuleGroup): number {
  return (group.nestedGroups ?? []).reduce(
    (total, nested) => total + 1 + countPolicyGroups(nested),
    0,
  );
}

// ─── Field Access Level Resolution ───────────────────────────────────────────

export type FieldAccessLevelKey =
  | "readAccessLevel"
  | "writeAccessLevel"
  | "editAccessLevel"
  | "deleteAccessLevel";

/** Walk nested `IField.fields` using a dotted path (e.g. Products.name). */
export const findFieldAtDottedPath = (
  rootFields: IField[],
  dottedPath: string,
): IField | undefined => {
  const segments = dottedPath.split(".").filter(Boolean);
  if (segments.length === 0) return undefined;

  let list: IField[] = rootFields;
  let node: IField | undefined;

  for (let i = 0; i < segments.length; i++) {
    node = list.find((f) => f.name === segments[i]);
    if (!node) return undefined;
    if (i === segments.length - 1) return node;
    list = node.fields ?? [];
  }

  return undefined;
};

export const resolveFieldAccessLevel = (
  fields: IField[],
  fieldNames: string[],
  key: FieldAccessLevelKey,
): number | undefined => {
  if (fieldNames.length === 1 && fieldNames[0].includes(".")) {
    const path = fieldNames[0];
    let target = findFieldAtDottedPath(fields, path);
    // Child schema tables receive flat `fields` but policy paths stay root-qualified (e.g. Products.name).
    if (!target) {
      const leaf = path.split(".").pop();
      target = leaf ? fields.find((f) => f.name === leaf) : undefined;
    }
    return target?.[key];
  }

  const selectedFields = fields.filter((f) => fieldNames.includes(f.name));
  if (selectedFields.length === 0) return undefined;
  const firstLevel = selectedFields[0][key];
  const allSame = selectedFields.every((f) => f[key] === firstLevel);

  return allSame ? firstLevel : 1;
};

