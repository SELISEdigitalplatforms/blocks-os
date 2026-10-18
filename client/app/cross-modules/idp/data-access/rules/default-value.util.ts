import type { DefaultValueKind, IFieldDefaultValue } from "./rules.types";
import { checkVariables, type VariableField } from "./variable-syntax";

/**
 * Default values: which kinds fit a property, the checks before saving, and the one-line summary.
 * Mirrors Genesis `FieldDefaultValueCheck` / `DefaultValueConverter`, with the same messages.
 */

/** Set by the platform on every save; never defaulted. */
export const LOCKED_DEFAULT_PROPERTIES = ["ItemId", "CreatedBy", "LastUpdatedBy", "CreatedDate", "LastUpdatedDate"];

const SUPPORTED_TYPES = new Set(["String", "ID", "Int", "Float", "Boolean", "DateTime", "Enum"]);

export function canHaveDefault(fieldName: string, fieldType: string): boolean {
  return !LOCKED_DEFAULT_PROPERTIES.includes(fieldName) && SUPPORTED_TYPES.has(fieldType);
}

/** Kinds offered for a property: templates on text, Now on a single date-time. */
export function allowedDefaultKinds(fieldType: string, isArray: boolean): DefaultValueKind[] {
  const kinds: DefaultValueKind[] = ["Static"];
  if (fieldType === "String" || fieldType === "ID") kinds.push("Template");
  if (fieldType === "DateTime" && !isArray) kinds.push("Now");
  return kinds;
}

/** One static item, as typed, checked against the property's type; null when it fits. */
export function checkStaticItem(text: string, fieldType: string, enumValues: string[] = []): string | null {
  const value = text.trim();
  switch (fieldType) {
    case "Int":
      return /^[+-]?\d+$/.test(value) && Math.abs(Number(value)) <= 2147483647 ? null : `"${value}" is not a whole number`;
    case "Float":
      return value !== "" && Number.isFinite(Number(value)) ? null : `"${value}" is not a number`;
    case "Boolean":
      return value === "true" || value === "false" ? null : `"${value}" is not true or false`;
    case "DateTime":
      return value !== "" && !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}/.test(value) && isRealDate(value)
        ? null
        : `"${value}" is not a valid date-time`;
    case "Enum":
      return enumValues.length > 0 && !enumValues.includes(value)
        ? `"${value}" is not one of the listed values (${enumValues.join(", ")})`
        : null;
    default:
      return null;
  }
}

/** Rejects dates the browser silently rolls over (2025-02-30 → March 2). */
function isRealDate(value: string): boolean {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** The value to send for one static item: numbers and booleans typed, everything else as text. */
export function convertStaticItem(text: string, fieldType: string): string | number | boolean {
  const value = text.trim();
  if (fieldType === "Int" || fieldType === "Float") return Number(value);
  if (fieldType === "Boolean") return value === "true";
  return value;
}

export interface DefaultDraft {
  kind: DefaultValueKind;
  /** Static or Template: one item, or several for a list property. */
  items: string[];
  offset: { days: string; hours: string; minutes: string; seconds: string };
}

export const emptyDefaultDraft = (kind: DefaultValueKind = "Static"): DefaultDraft => ({
  kind,
  items: [""],
  offset: { days: "0", hours: "0", minutes: "0", seconds: "0" },
});

/** A stored value as the form's text items: a list item by item, a single value as one item. */
function itemsOf(raw: IFieldDefaultValue["value"]): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  return raw === null || raw === undefined ? [""] : [String(raw)];
}

export function draftFromDefault(value: IFieldDefaultValue | null | undefined): DefaultDraft {
  if (!value) return emptyDefaultDraft();
  const items = itemsOf(value.value);
  const offset = value.offset ?? { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    kind: value.kind,
    items: items.length > 0 ? items : [""],
    offset: { days: String(offset.days), hours: String(offset.hours), minutes: String(offset.minutes), seconds: String(offset.seconds) },
  };
}

const OFFSET_LABELS = { days: "Days", hours: "Hours", minutes: "Minutes", seconds: "Seconds" } as const;

export interface DefaultTarget {
  fieldType: string;
  isArray: boolean;
  enumValues?: string[];
  schemaName: string;
  fields: Record<string, VariableField>;
}

/** The items a draft carries: every filled one for a list, the first for a single value. */
const draftItems = (draft: DefaultDraft, target: DefaultTarget) =>
  target.isArray ? draft.items.filter((item) => item.trim() !== "") : draft.items.slice(0, 1);

function checkStaticDraft(items: string[], target: DefaultTarget): string | null {
  if (items.length === 0 || (items[0] ?? "").trim() === "") {
    // Only a single text property may default to empty text.
    return target.fieldType === "String" && !target.isArray ? null : "A value is required";
  }
  for (const item of items) {
    const problem = checkStaticItem(item, target.fieldType, target.enumValues);
    if (problem) return problem;
  }
  return null;
}

function checkTemplateDraft(items: string[], target: DefaultTarget): string | null {
  if (target.fieldType !== "String" && target.fieldType !== "ID") return "Templates can only be used on text properties";
  if (items.every((item) => item.trim() === "")) return "A template is required";
  for (const item of items) {
    const problem = checkVariables(item, "template", target.schemaName, target.fields, target.isArray);
    if (problem) return problem.message;
  }
  return null;
}

function checkNowDraft(offset: DefaultDraft["offset"], target: DefaultTarget): string | null {
  if (target.fieldType !== "DateTime" || target.isArray) return "Now can only be used on single date-time properties";
  const notWhole = (Object.keys(OFFSET_LABELS) as Array<keyof typeof OFFSET_LABELS>).find((key) => !/^[+-]?\d+$/.test(offset[key].trim()));
  return notWhole ? `${OFFSET_LABELS[notWhole]} must be a whole number` : null;
}

/** Why the draft can't be saved yet, or null. Same messages as the server. */
export function checkDefaultDraft(draft: DefaultDraft, target: DefaultTarget): string | null {
  switch (draft.kind) {
    case "Static":
      return checkStaticDraft(draftItems(draft, target), target);
    case "Template":
      return checkTemplateDraft(draftItems(draft, target), target);
    case "Now":
      return checkNowDraft(draft.offset, target);
    default:
      return "Choose Static, Template or Now";
  }
}

/** The payload to save. */
export function defaultFromDraft(draft: DefaultDraft, target: DefaultTarget): IFieldDefaultValue {
  const items = draftItems(draft, target);
  if (draft.kind === "Now") {
    const n = (s: string) => Number.parseInt(s.trim(), 10) || 0;
    return {
      kind: "Now",
      value: null,
      offset: { days: n(draft.offset.days), hours: n(draft.offset.hours), minutes: n(draft.offset.minutes), seconds: n(draft.offset.seconds) },
    };
  }
  if (draft.kind === "Template") {
    return { kind: "Template", value: target.isArray ? items : (items[0] ?? "") };
  }
  const converted = items.map((item) => convertStaticItem(item, target.fieldType));
  return { kind: "Static", value: target.isArray ? converted : (converted[0] ?? "") };
}

/** One line for the DEF flag, e.g. "Now + 365 days" or "{{Employee.FirstName}} {{Employee.LastName}}". */
export function formatDefaultSummary(value: IFieldDefaultValue | null | undefined): string {
  if (!value) return "";
  if (value.kind === "Now") {
    const offset = value.offset;
    if (!offset) return "Now";
    const parts = (Object.keys(OFFSET_LABELS) as Array<keyof typeof OFFSET_LABELS>)
      .filter((key) => offset[key] !== 0)
      .map((key) => `${offset[key] > 0 ? "+" : "−"} ${Math.abs(offset[key])} ${key.slice(0, -1)}${Math.abs(offset[key]) === 1 ? "" : "s"}`);
    return parts.length === 0 ? "Now" : `Now ${parts.join(" ")}`;
  }
  const raw = value.value;
  if (!Array.isArray(raw)) return String(raw ?? "");
  // Fixed text items are quoted, so ["admin", "app-user"] reads as a list of values.
  const quote = (item: string | number | boolean) => (typeof item === "string" && value.kind === "Static" ? JSON.stringify(item) : String(item));
  return "[" + raw.map(quote).join(", ") + "]";
}
