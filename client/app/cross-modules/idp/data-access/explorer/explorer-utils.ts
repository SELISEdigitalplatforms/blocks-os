import type { AccessTier } from "../gateway/components/primitives";
import { tierFromLevel } from "../gateway/components/primitives";
import type { PlatformSchema, PlatformSchemaField } from "../data-access.service";

/**
 * Layout and motion constants of the schema shell, mirroring the Data Gateway's
 * `utils/motion.ts` (the CSS side lives in `styles/globals.css` as `--dg-*`).
 */
export const MOTION = { fast: 120, base: 180, panel: 260 } as const;

export const SHELL = {
  explorerWidth: 264,
  railWidth: 52,
  inspectorWidthExpanded: 540,
} as const;

/** Properties every entity carries from the platform's base entity; listed apart as "Default Properties". */
export const DEFAULT_PROPERTY_NAMES = [
  "ItemId",
  "CreatedDate",
  "CreatedBy",
  "LastUpdatedDate",
  "LastUpdatedBy",
  "Language",
  "OrganizationId",
  "Tags",
];

/** Types a column access rule can be set on. Object properties are reached through their children. */
const SCALAR_TYPES = new Set(["String", "Int", "Float", "Boolean", "DateTime", "GeoJson", "Enum", "Json"]);

export const isScalarField = (field: Pick<PlatformSchemaField, "type" | "fields">) =>
  SCALAR_TYPES.has(field.type) && !(field.fields && field.fields.length > 0);

export const hasNestedFields = (field: Pick<PlatformSchemaField, "fields">) =>
  Boolean(field.fields && field.fields.length > 0);

/** Default properties first, in their usual order, then the entity's own. */
export function orderFields(fields: PlatformSchemaField[]) {
  const defaults = DEFAULT_PROPERTY_NAMES.flatMap((name) => fields.filter((f) => f.name === name));
  const own = fields.filter((f) => !DEFAULT_PROPERTY_NAMES.includes(f.name));
  return { defaults, own };
}

export type SchemaExposure = { tier: Extract<AccessTier, "public" | "user">; reason: string };

type Verb = "read" | "write" | "edit" | "delete";
const WRITE_VERBS: readonly Verb[] = ["write", "edit", "delete"];
const VERB_PHRASES: Record<Verb, string> = {
  read: "read",
  write: "create records in",
  edit: "edit",
  delete: "delete from",
};

/**
 * What is worth warning about on a schema row (same rule as the Data Gateway's
 * `schemaExposure`): anyone can reach the data, or any signed-in user can change it.
 */
export function schemaExposure(
  schema: Pick<PlatformSchema, "readAccessLevel" | "writeAccessLevel" | "editAccessLevel" | "deleteAccessLevel">,
): SchemaExposure | null {
  const level = (verb: Verb) => schema[`${verb}AccessLevel` as const];
  const publicWrite = WRITE_VERBS.find((verb) => tierFromLevel(level(verb)) === "public");
  if (publicWrite) return { tier: "public", reason: `Anyone can ${VERB_PHRASES[publicWrite]} this schema` };
  if (tierFromLevel(level("read")) === "public") return { tier: "public", reason: "Anyone can read this schema" };
  const userWrite = WRITE_VERBS.find((verb) => tierFromLevel(level(verb)) === "user");
  if (userWrite) return { tier: "user", reason: `Any signed-in user can ${VERB_PHRASES[userWrite]} this schema` };
  return null;
}

const PREVIEW_TYPE_MAP: Record<string, string> = {
  String: "string",
  Int: "integer",
  Long: "long",
  Float: "float",
  Boolean: "boolean",
  DateTime: "datetime",
  GeoJson: "geojson",
  Enum: "enum",
  Json: "json",
};

/** The entity's shape as JSON: each property's type, nested objects expanded, arrays wrapped. */
export function buildStructurePreview(fields: PlatformSchemaField[]): Record<string, unknown> {
  const structure: Record<string, unknown> = {};
  for (const field of fields) {
    const value = hasNestedFields(field)
      ? buildStructurePreview(field.fields ?? [])
      : (PREVIEW_TYPE_MAP[field.type] ?? field.type.toLowerCase());
    structure[field.name] = field.isArray ? [value] : value;
  }
  return structure;
}
