import type { PlatformSchema, PlatformSchemaField } from "../data-access.service";
import { DEFAULT_PROPERTY_NAMES } from "../explorer/explorer-utils";
import type { RuleAccess } from "./rules.types";

/**
 * Bulk rules: the same validations or default value on several default properties (the base entity's own:
 * Language, Tags, Read.Roles, …) of several system schemas. A schema/property pair is only offered where
 * the Genesis allow-list opens it, as the OS server checks again before writing anything.
 */
export type BulkPanel = "validation" | "default";

/** A default property, or one inside it (Read.Roles). */
export const isDefaultPath = (path: string) => DEFAULT_PROPERTY_NAMES.includes(path.split(".")[0]);

/** The property at a dotted path, nested ones included. */
export function fieldAt(fields: PlatformSchemaField[], path: string): PlatformSchemaField | undefined {
  const [head, ...rest] = path.split(".");
  const field = fields.find((f) => f.name === head);
  return rest.length === 0 || !field ? field : fieldAt(field.fields ?? [], rest.join("."));
}

export function accessOf(schema: PlatformSchema, path: string, panel: BulkPanel): RuleAccess {
  const rules = schema.rules?.fields.find((f) => f.path === path);
  if (!rules || !fieldAt(schema.fields, path)) return "Blocked";
  return panel === "validation" ? rules.validation : rules.default;
}

/** Every default property some schema opens to validations or a default, in the table's order. */
export function bulkPaths(schemas: PlatformSchema[]): string[] {
  const paths = new Set(
    schemas.flatMap((schema) =>
      (schema.rules?.fields ?? [])
        .filter((f) => isDefaultPath(f.path) && (f.validation !== "Blocked" || f.default !== "Blocked") && fieldAt(schema.fields, f.path))
        .map((f) => f.path),
    ),
  );
  const rank = (path: string) => DEFAULT_PROPERTY_NAMES.indexOf(path.split(".")[0]);
  return [...paths].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Why the schema can't take the picked properties in this panel, or null when it can. */
export function schemaBlocker(schema: PlatformSchema, paths: string[], panel: BulkPanel): string | null {
  const closed = paths.filter((path) => accessOf(schema, path, panel) === "Blocked");
  if (closed.length === 0) return null;
  const what = panel === "validation" ? "validation rules" : "a default value";
  return `${schema.schemaName} doesn't take ${what} on ${closed.join(", ")}`;
}

export type BulkShape = { type: string; isArray: boolean; enumValues?: string[] };

/**
 * The one shape every picked property shares, which the editor is built for, or why there is none. Rules
 * depend on the type; a default also on whether it is a list (Language is one text, Tags and Read.Roles lists).
 */
export function bulkShape(schemas: PlatformSchema[], paths: string[], panel: BulkPanel): BulkShape | { problem: string } {
  const fields = paths.map((path) => schemas.map((s) => fieldAt(s.fields, path)).find(Boolean)).filter((f): f is PlatformSchemaField => Boolean(f));
  if (fields.length === 0) return { problem: "Pick the properties to change" };
  const [first] = fields;
  const differs = fields.some((f) => f.type !== first.type || (panel === "default" && f.isArray !== first.isArray));
  if (differs) {
    return {
      problem:
        panel === "default"
          ? "These properties take different kinds of value (one text or a list); pick properties of one kind"
          : "These properties have different types; pick properties of one type",
    };
  }
  return { type: first.type, isArray: first.isArray, enumValues: first.enumValues };
}

/** The confirmation to ask for when a picked schema or property is warned, or null. */
export function bulkWarning(schemas: PlatformSchema[], paths: string[], panel: BulkPanel): string | null {
  const warnedSchemas = schemas.filter((s) => s.rules?.level === "Warned").map((s) => s.schemaName);
  const warnedPaths = paths.filter((path) => schemas.some((s) => accessOf(s, path, panel) === "Warned"));
  if (warnedSchemas.length === 0 && warnedPaths.length === 0) return null;
  const what = panel === "validation" ? "rule" : "default";
  const parts = [
    warnedSchemas.length > 0 && `${warnedSchemas.join(", ")} ${warnedSchemas.length === 1 ? "is" : "are"} used by sign-in and the console.`,
    warnedPaths.length > 0 && `${warnedPaths.join(", ")} decide${warnedPaths.length === 1 ? "s" : ""} who can see or change records.`,
  ].filter(Boolean);
  return `${parts.join(" ")} A wrong ${what} applies to every record the services save on all ${schemas.length} schema${schemas.length === 1 ? "" : "s"}.`;
}

/**
 * The server names each refused pair by key ("EmailTemplate.Read.Roles"); put the key in front of its
 * message so the panels, which show messages only, still say which pair it was.
 */
export function withPairNames(error: unknown): unknown {
  if (typeof error !== "object" || error === null || !("errors" in error)) return error;
  const errors = (error as { errors: unknown }).errors;
  if (!errors || typeof errors !== "object") return error;
  const body = errors as Record<string, unknown>;
  const nested = body.errors && typeof body.errors === "object" ? (body.errors as Record<string, unknown>) : body;
  const named = Object.fromEntries(Object.entries(nested).map(([key, message]) => [key, typeof message === "string" && key !== "fieldNames" ? `${key}: ${message}` : message]));
  return { ...error, errors: named };
}
