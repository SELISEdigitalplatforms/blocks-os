import type { IRuleField as IField } from "./rules.types";

/**
 * The variable grammar of default values and validation rules: the client copy of Genesis
 * `VariableSyntax`. Both run the same table of cases in their tests, so the editor shows exactly the
 * message the server would return.
 *
 *   template := ( text | variable )*
 *   variable := "{{" space* name space* "}}"
 *   name     := "Auth." authName | schemaName "." segment ( "." segment )*
 */

export type VariableMode = "template" | "single";

export interface VariablePart {
  text?: string;
  prefix?: string;
  path?: string;
  /** 1-based position in the text. */
  position: number;
}

export interface VariableError {
  message: string;
  position: number;
}

export interface VariableField {
  type: string;
  isArray: boolean;
  isObject: boolean;
}

export const AUTH_PREFIX = "Auth";
export const AUTH_NAMES = ["UserId", "Email", "Roles", "Permissions", "OrganizationId"] as const;
const AUTH_LIST_NAMES = new Set(["roles", "permissions"]);
const SCALAR_TYPES = new Set(["String", "Int", "Float", "Boolean", "DateTime", "ID", "GeoJson", "Enum", "Json"]);
const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+$/;
const SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const isVariable = (part: VariablePart) => part.prefix !== undefined;
const isAuth = (part: VariablePart) => part.prefix?.toLowerCase() === AUTH_PREFIX.toLowerCase();
const nameOf = (part: VariablePart) => `${part.prefix}.${part.path}`;

const invalidName = (name: string, position: number): VariableError => ({
  message: `Invalid name "${name}" at position ${position}: use letters, digits, "_" and "." between parts`,
  position,
});

function checkNameShape(name: string, position: number, mode: VariableMode, schema: string): VariableError | null {
  if (!name.includes(".")) {
    if (!SEGMENT_PATTERN.test(name)) return invalidName(name, position);
    const target = mode === "template" ? `{{${schema}.${name}}} or {{Auth.…}}` : `{{${schema}.${name}}}`;
    return { message: `Missing prefix at position ${position}: write ${target}`, position };
  }
  return NAME_PATTERN.test(name) ? null : invalidName(name, position);
}

/** Splits text into plain text and variables, checking the syntax only. */
export function parseVariables(
  text: string,
  mode: VariableMode,
  schemaName?: string,
): { parts: VariablePart[]; error: VariableError | null } {
  const schema = schemaName?.trim() ? schemaName : "Schema";
  const parts: VariablePart[] = [];
  let buffer = "";
  let bufferStart = 0;
  let i = 0;

  const flush = () => {
    if (buffer.length > 0) parts.push({ text: buffer, position: bufferStart + 1 });
    buffer = "";
  };

  while (i < text.length) {
    const c = text[i];
    if (c === "{") {
      if (text[i + 1] !== "{") {
        const inner = text.slice(i + 1).split("}")[0].trim();
        const example = inner.length > 0 ? `{{${inner}}}` : `{{${schema}.Property}}`;
        return { parts, error: { message: `Single "{" at position ${i + 1}: variables are written ${example}`, position: i + 1 } };
      }
      const close = text.indexOf("}}", i + 2);
      const nextOpen = text.indexOf("{{", i + 2);
      if (close < 0 || (nextOpen >= 0 && nextOpen < close)) {
        return { parts, error: { message: `Unclosed variable at position ${i + 1}: expected "}}"`, position: i + 1 } };
      }
      const name = text.slice(i + 2, close).trim();
      if (name.length === 0) return { parts, error: { message: `Empty variable at position ${i + 1}`, position: i + 1 } };
      if (name.includes("{") || name.includes("}")) {
        return { parts, error: { message: `Unclosed variable at position ${i + 1}: expected "}}"`, position: i + 1 } };
      }
      const shapeError = checkNameShape(name, i + 1, mode, schema);
      if (shapeError) return { parts, error: shapeError };

      flush();
      const dot = name.indexOf(".");
      parts.push({ prefix: name.slice(0, dot), path: name.slice(dot + 1), position: i + 1 });
      i = close + 2;
      bufferStart = i;
      continue;
    }
    if (c === "}") {
      const message = text.startsWith("}}", i) ? `Unexpected "}}" at position ${i + 1}` : `Single "}" at position ${i + 1}`;
      return { parts, error: { message, position: i + 1 } };
    }
    if (buffer.length === 0) bufferStart = i;
    buffer += c;
    i++;
  }
  flush();

  if (mode === "single" && parts.some(isVariable) && (parts.length !== 1 || (parts[0].text ?? "").trim() !== "")) {
    const example = parts.find(isVariable);
    const name = example ? nameOf(example) : `${schema}.Property`;
    return { parts, error: { message: `A validation value is either a fixed value or one variable, e.g. {{${name}}}`, position: 1 } };
  }
  return { parts, error: null };
}

/** Checks what each variable refers to: its prefix, and that the property exists and holds a single value. */
export function checkVariableReferences(
  parts: VariablePart[],
  mode: VariableMode,
  schemaName: string,
  fields: Record<string, VariableField>,
  targetIsList: boolean,
): VariableError | null {
  for (const part of parts.filter(isVariable)) {
    const { position } = part;
    if (isAuth(part)) {
      if (mode === "single") {
        return { message: `Auth values aren't available in validation rules at position ${position}: use an access policy`, position };
      }
      const authName = AUTH_NAMES.find((n) => n.toLowerCase() === part.path?.toLowerCase());
      if (!authName) {
        return { message: `Unknown value "${nameOf(part)}" at position ${position}: use ${AUTH_NAMES.map((n) => `Auth.${n}`).join(", ")}`, position };
      }
      if (AUTH_LIST_NAMES.has(authName.toLowerCase()) && !targetIsList) {
        return { message: `Auth.${authName} is a list at position ${position}: use it in a list property`, position };
      }
      continue;
    }
    if (part.prefix !== schemaName) {
      const allowed = mode === "template" ? `${schemaName} or Auth` : schemaName;
      return { message: `Unknown prefix "${part.prefix}" at position ${position}: use ${allowed}`, position };
    }
    const field = fields[part.path!];
    if (!field) {
      const guess = closestName(part.path!, Object.keys(fields).filter((k) => !fields[k].isObject));
      const hint = guess ? ` (did you mean ${schemaName}.${guess}?)` : "";
      return { message: `Unknown property "${nameOf(part)}" at position ${position}${hint}`, position };
    }
    if (field.isObject) {
      const child = Object.keys(fields).find((k) => k.startsWith(`${part.path}.`) && !fields[k].isObject);
      const example = child ? `, e.g. {{${schemaName}.${child}}}` : "";
      return { message: `"${nameOf(part)}" holds an object at position ${position}: use one of its properties${example}`, position };
    }
  }
  return null;
}

/** Parse and check in one go: the first problem, or null. */
export function checkVariables(
  text: string,
  mode: VariableMode,
  schemaName: string,
  fields: Record<string, VariableField>,
  targetIsList = false,
): VariableError | null {
  const { parts, error } = parseVariables(text, mode, schemaName);
  return error ?? checkVariableReferences(parts, mode, schemaName, fields, targetIsList);
}

/** The properties a variable may name, by full dotted path (nested fields included). */
export function variableFieldsOf(fields: IField[], prefix = ""): Record<string, VariableField> {
  const result: Record<string, VariableField> = {};
  for (const field of fields) {
    const path = `${prefix}${field.name}`;
    const isObject = !SCALAR_TYPES.has(field.type);
    result[path] = { type: field.type, isArray: field.isArray, isObject };
    if (isObject && field.fields?.length) Object.assign(result, variableFieldsOf(field.fields, `${path}.`));
  }
  return result;
}

function closestName(wanted: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const d = distance(wanted.toLowerCase(), candidate.toLowerCase());
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return bestDistance <= 2 ? best : null;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}
