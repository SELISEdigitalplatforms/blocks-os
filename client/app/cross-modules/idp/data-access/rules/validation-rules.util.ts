import type { ISchemaFieldValidation, ValidationRuleValue } from "./rules.types";
import { checkVariables, parseVariables, type VariableField } from "./variable-syntax";

/** Mirrors the server's ValidationType (Genesis); the API sends the number. */
export const VALIDATION_TYPE = {
  NotEmpty: 0,
  Regex: 1,
  MinLength: 2,
  MaxLength: 3,
  LengthRange: 4,
  Equal: 5,
  NotEqual: 6,
  GreaterThan: 7,
  LessThan: 8,
  GreaterThanOrEqual: 9,
  LessThanOrEqual: 10,
  Range: 11,
  Reference: 12,
} as const;

export type ValidationTypeValue = (typeof VALIDATION_TYPE)[keyof typeof VALIDATION_TYPE];

/** Which inputs a rule type needs in the form. */
export type RuleInputKind = "none" | "regex" | "length" | "lengthRange" | "value" | "valueRange" | "reference";

export const VALIDATION_TYPE_META: Record<ValidationTypeValue, { label: string; input: RuleInputKind }> = {
  [VALIDATION_TYPE.NotEmpty]: { label: "Not empty", input: "none" },
  [VALIDATION_TYPE.Regex]: { label: "Regex", input: "regex" },
  [VALIDATION_TYPE.MinLength]: { label: "Min length", input: "length" },
  [VALIDATION_TYPE.MaxLength]: { label: "Max length", input: "length" },
  [VALIDATION_TYPE.LengthRange]: { label: "Length range", input: "lengthRange" },
  [VALIDATION_TYPE.Equal]: { label: "Equal", input: "value" },
  [VALIDATION_TYPE.NotEqual]: { label: "Not equal", input: "value" },
  [VALIDATION_TYPE.GreaterThan]: { label: "Greater than", input: "value" },
  [VALIDATION_TYPE.LessThan]: { label: "Less than", input: "value" },
  [VALIDATION_TYPE.GreaterThanOrEqual]: { label: "Greater than or equal", input: "value" },
  [VALIDATION_TYPE.LessThanOrEqual]: { label: "Less than or equal", input: "value" },
  [VALIDATION_TYPE.Range]: { label: "Range", input: "valueRange" },
  [VALIDATION_TYPE.Reference]: { label: "Reference", input: "reference" },
};

/** The target field a Reference rule uses when none is picked. */
export const DEFAULT_REFERENCE_FIELD = "ItemId";

const T = VALIDATION_TYPE;
const COMPARISONS = [T.GreaterThan, T.LessThan, T.GreaterThanOrEqual, T.LessThanOrEqual, T.Range];

/**
 * The rule types that make sense for a property's type. Must match what the server accepts:
 * Reference only on text and number fields (Genesis `ReferenceRuleCompatibility`).
 */
export function getAllowedValidationTypes(fieldType: string): ValidationTypeValue[] {
  switch (fieldType) {
    case "String":
    case "ID":
      return [T.NotEmpty, T.Regex, T.MinLength, T.MaxLength, T.LengthRange, T.Equal, T.NotEqual, T.Reference];
    case "Int":
    case "Float":
      return [T.NotEmpty, T.Equal, T.NotEqual, ...COMPARISONS, T.Reference];
    case "DateTime":
      return [T.NotEmpty, T.Equal, T.NotEqual, ...COMPARISONS];
    case "Boolean":
      return [T.NotEmpty, T.Equal, T.NotEqual];
    case "Enum":
      return [T.NotEmpty, T.Equal, T.NotEqual, T.Reference];
    default:
      return [T.NotEmpty];
  }
}

/** How a compared value is entered: a number, a date-time, true/false, one of the enum values, or text. */
export type ValueKind = "number" | "date" | "boolean" | "enum" | "text";

export function valueKindForField(fieldType: string): ValueKind {
  switch (fieldType) {
    case "Int":
    case "Float":
      return "number";
    case "DateTime":
      return "date";
    case "Boolean":
      return "boolean";
    case "Enum":
      return "enum";
    default:
      return "text";
  }
}

/** The form's view of a rule: every value as text, as typed. */
export interface RuleDraft {
  type: ValidationTypeValue;
  value: string;
  secondaryValue: string;
  errorMessage: string;
  isActive: boolean;
}

const asText = (value: ValidationRuleValue | undefined): string => (value === null || value === undefined ? "" : String(value));

export function draftFromRule(rule: ISchemaFieldValidation): RuleDraft {
  return {
    type: rule.type as ValidationTypeValue,
    value: asText(rule.value),
    secondaryValue: asText(rule.secondaryValue),
    errorMessage: rule.errorMessage ?? "",
    isActive: rule.isActive,
  };
}

/**
 * Comparison values may be one record variable, e.g. {{Employee.StartDate}}. Only text with "{{" or "}}"
 * is read as one, the same test the server makes, so fixed values stay fixed.
 */
export const looksLikeVariable = (text: string) => text.includes("{{") || text.includes("}}");

/** The schema a rule's variables refer to: its name and properties by full path. */
export interface RuleVariableContext {
  schemaName: string;
  fields: Record<string, VariableField>;
}

/** The server's kinds for comparing a variable with the property: Enum compares as text. */
export function variableKind(type: string): "number" | "date" | "boolean" | "text" {
  switch (type) {
    case "Int":
    case "Float":
      return "number";
    case "DateTime":
      return "date";
    case "Boolean":
      return "boolean";
    default:
      return "text";
  }
}

const describeKind = (type: string, isArray: boolean) =>
  isArray ? "a list" : ({ number: "a number", date: "a date-time", boolean: "true or false", text: "text" } as const)[variableKind(type)];

/** A variable value's problem, with the server's messages (Genesis `ValidationVariableCheck`), or null. */
export function checkRuleVariable(text: string, fieldType: string, context: RuleVariableContext): string | null {
  const problem = checkVariables(text, "single", context.schemaName, context.fields);
  if (problem) return problem.message;
  const variable = parseVariables(text, "single", context.schemaName).parts.find((part) => part.prefix !== undefined);
  if (!variable) return null;
  const target = context.fields[variable.path!];
  if (variableKind(target.type) !== variableKind(fieldType) || target.isArray) {
    return `${variable.prefix}.${variable.path} is ${describeKind(target.type, target.isArray)} at position ${variable.position}: ${describeKind(fieldType, false)} is expected`;
  }
  return null;
}

/** The properties a comparison may name: single values of the same kind, as {{Schema.Path}}. */
export function fittingVariables(fieldType: string, context: RuleVariableContext, exclude?: string): string[] {
  return Object.entries(context.fields)
    .filter(([path, field]) => !field.isObject && !field.isArray && path !== exclude && variableKind(field.type) === variableKind(fieldType))
    .map(([path]) => `{{${context.schemaName}.${path}}}`);
}

const isWholeNumber = (text: string) => /^\d+$/.test(text.trim());
const isNumber = (text: string) => text.trim() !== "" && Number.isFinite(Number(text));

/**
 * Comparison values written as variables: each must name a fitting property (with `variables`; without them
 * the syntax is left to the server), and a fixed bound beside one is still checked for its type, since the
 * order is known only at insert. Undefined when no slot is a variable, so the fixed-value checks apply.
 */
function checkVariableSlots(slots: string[], fieldType: string, variables?: RuleVariableContext): string | null | undefined {
  if (!slots.some(looksLikeVariable)) return undefined;
  if (slots.includes("")) return slots.length === 1 ? "Value is required" : "Both values are required";
  for (const slot of slots.filter(looksLikeVariable)) {
    const problem = variables?.schemaName ? checkRuleVariable(slot, fieldType, variables) : null;
    if (problem) return problem;
  }
  const fixed = slots.filter((slot) => !looksLikeVariable(slot));
  return valueKindForField(fieldType) === "number" && fixed.some((slot) => !isNumber(slot)) ? "Not a valid number" : null;
}

/** The pattern's syntax is checked by the server, which refuses an invalid one. */
function checkRegex(value: string): string | null {
  return value ? null : "Pattern is required";
}

function checkLengthRange(value: string, secondary: string): string | null {
  if (!isWholeNumber(value) || !isWholeNumber(secondary)) return "Enter whole numbers of 0 or more";
  return Number(value) <= Number(secondary) ? null : "Min must be ≤ max";
}

function checkValue(value: string, fieldType: string): string | null {
  if (!value) return "Value is required";
  return valueKindForField(fieldType) === "number" && !isNumber(value) ? "Not a valid number" : null;
}

function checkValueRange(value: string, secondary: string, fieldType: string): string | null {
  if (!value || !secondary) return "Both values are required";
  const kind = valueKindForField(fieldType);
  if (kind === "number") {
    if (!isNumber(value) || !isNumber(secondary)) return "Not a valid number";
    return Number(value) <= Number(secondary) ? null : "Min must be ≤ max";
  }
  return kind === "date" && new Date(value) > new Date(secondary) ? "Min must be ≤ max" : null;
}

/** The fixed-value check for each kind of rule input. */
const INPUT_CHECKS: Record<RuleInputKind, (value: string, secondary: string, fieldType: string) => string | null> = {
  none: () => null,
  regex: (value) => checkRegex(value),
  length: (value) => (isWholeNumber(value) ? null : "Enter a whole number of 0 or more"),
  lengthRange: (value, secondary) => checkLengthRange(value, secondary),
  value: (value, _secondary, fieldType) => checkValue(value, fieldType),
  valueRange: checkValueRange,
  reference: (value) => (value ? null : "Choose the schema the value must exist in"),
};

/**
 * Why the draft cannot be saved yet, or null when it can. With `variables`, a comparison value written as
 * a variable is checked against the schema; without them its syntax is left to the server.
 */
export function checkRuleDraft(draft: RuleDraft, fieldType: string, variables?: RuleVariableContext): string | null {
  const input = VALIDATION_TYPE_META[draft.type]?.input;
  if (!input) return "Choose a rule type";
  const value = draft.value.trim();
  const secondary = draft.secondaryValue.trim();
  if (input === "value" || input === "valueRange") {
    const variableProblem = checkVariableSlots(input === "value" ? [value] : [value, secondary], fieldType, variables);
    if (variableProblem !== undefined) return variableProblem;
  }
  return INPUT_CHECKS[input](value, secondary, fieldType);
}

/** Rules added or edited in the console; rules saved earlier keep their version until edited. */
export const CURRENT_EVALUATION_VERSION = 1;

/** The rule to send: lengths and numbers as numbers, booleans as booleans, the rest as text. */
export function ruleFromDraft(draft: RuleDraft, fieldType: string): ISchemaFieldValidation {
  const input = VALIDATION_TYPE_META[draft.type].input;
  const kind = valueKindForField(fieldType);
  const convert = (text: string): ValidationRuleValue => {
    const trimmed = text.trim();
    if (trimmed === "") return null;
    if ((input === "value" || input === "valueRange") && looksLikeVariable(trimmed)) return trimmed;
    if (input === "length" || input === "lengthRange" || ((input === "value" || input === "valueRange") && kind === "number")) {
      return Number(trimmed);
    }
    if (input === "value" && kind === "boolean") return trimmed === "true";
    return trimmed;
  };

  let value: ValidationRuleValue = convert(draft.value);
  let secondaryValue: ValidationRuleValue = input === "lengthRange" || input === "valueRange" ? convert(draft.secondaryValue) : null;
  if (input === "none") value = null;
  if (input === "regex") value = draft.value.trim();
  if (input === "reference") secondaryValue = draft.secondaryValue.trim() || DEFAULT_REFERENCE_FIELD;

  return {
    type: draft.type,
    value,
    secondaryValue,
    errorMessage: draft.errorMessage,
    isActive: draft.isActive,
    evaluationVersion: CURRENT_EVALUATION_VERSION,
  };
}

/** One line describing a saved rule, e.g. "3–50 characters" or "Must exist in Department.ItemId". */
export function formatRuleSummary(rule: ISchemaFieldValidation): string {
  const value = asText(rule.value);
  const secondary = asText(rule.secondaryValue);
  switch (rule.type) {
    case T.NotEmpty:
      return "Must not be empty";
    case T.Regex:
      return value;
    case T.MinLength:
      return `At least ${value} characters`;
    case T.MaxLength:
      return `At most ${value} characters`;
    case T.LengthRange:
      return `${value}–${secondary} characters`;
    case T.Equal:
      return `= ${value}`;
    case T.NotEqual:
      return `≠ ${value}`;
    case T.GreaterThan:
      return `> ${value}`;
    case T.LessThan:
      return `< ${value}`;
    case T.GreaterThanOrEqual:
      return `≥ ${value}`;
    case T.LessThanOrEqual:
      return `≤ ${value}`;
    case T.Range:
      return `Between ${value} and ${secondary}`;
    case T.Reference:
      return `Must exist in ${value}.${secondary || DEFAULT_REFERENCE_FIELD}`;
    default:
      return value;
  }
}

/** The label for a rule type, including types this client does not know yet. */
export const ruleTypeLabel = (type: number) => VALIDATION_TYPE_META[type as ValidationTypeValue]?.label ?? `Type ${type}`;
