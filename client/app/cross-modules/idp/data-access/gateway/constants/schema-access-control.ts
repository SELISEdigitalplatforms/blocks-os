import { labelledOption, lazyLabels } from "../utils/gateway-i18n";

const KEY_SOURCE_AUTH = "SCHEMA_ACCESS_CONTROL.SOURCE_AUTH";
const KEY_SOURCE_SCHEMA_FIELDS = "SCHEMA_ACCESS_CONTROL.SOURCE_SCHEMA_FIELDS";

export const PERMISSION_ACTIONS = [
  labelledOption("common:VIEW", { id: "view", value: "view" }),
  labelledOption("common:CREATE", { id: "create", value: "create" }),
  labelledOption("common:EDIT", { id: "edit", value: "edit" }),
  labelledOption("common:DELETE", { id: "delete", value: "delete" }),
];

export const ACCESS_TYPES = {
  LOGGED_IN: "logged-in",
  PUBLIC: "public",
  CUSTOM: "custom",
  INHERITED: "inherited",
};

export const RULE_SOURCE_TYPES = {
  AUTH: "auth",
  SCHEMA_FIELD: "schema-field",
  STATIC_VALUE: "static-value",
} as const;

export const RULE_SOURCE_OPTIONS = [
  labelledOption(KEY_SOURCE_AUTH, { value: RULE_SOURCE_TYPES.AUTH }),
  labelledOption(KEY_SOURCE_SCHEMA_FIELDS, {
    value: RULE_SOURCE_TYPES.SCHEMA_FIELD,
  }),
  // labelledOption("SCHEMA_ACCESS_CONTROL.SOURCE_STATIC_VALUE", { value: RULE_SOURCE_TYPES.STATIC_VALUE }),
];

export const COMPARE_SOURCE_OPTIONS = [
  labelledOption(KEY_SOURCE_AUTH, { value: RULE_SOURCE_TYPES.AUTH }),
  labelledOption(KEY_SOURCE_SCHEMA_FIELDS, {
    value: RULE_SOURCE_TYPES.SCHEMA_FIELD,
  }),
  labelledOption("SCHEMA_ACCESS_CONTROL.SOURCE_STATIC_VALUE", {
    value: RULE_SOURCE_TYPES.STATIC_VALUE,
  }),
];

/** Mirrors GraphQlConstant.MaxNestedLevelIterationLimit (server/DataGateway.DomainService) */
export const MAX_NESTED_FIELD_DEPTH = 3;

/**
 * How many group levels the rule-set editor will build: the root plus two
 * nested levels. The server allows unlimited depth, so deeper policies that
 * arrive by API or import still load and save intact; this only stops the
 * editor adding levels past it.
 */
export const MAX_RULE_GROUP_DEPTH = 3;

export const FIELD_TYPE_CATEGORY = {
  STRING: "string",
  ARRAY: "array",
  NUMERIC: "numeric",
} as const;

export type FieldTypeCategory = (typeof FIELD_TYPE_CATEGORY)[keyof typeof FIELD_TYPE_CATEGORY];

export const AUTH_FIELD_OPTIONS = [
  labelledOption("SCHEMA_ACCESS_CONTROL.AUTH_USER_ID", {
    value: "userId",
    category: FIELD_TYPE_CATEGORY.STRING,
  }),
  labelledOption("common:EMAIL", { value: "email", category: FIELD_TYPE_CATEGORY.STRING }),
  labelledOption("SCHEMA_ACCESS_CONTROL.AUTH_ROLES", {
    value: "roles",
    category: FIELD_TYPE_CATEGORY.ARRAY,
  }),
  labelledOption("SCHEMA_ACCESS_CONTROL.AUTH_PERMISSIONS", {
    value: "permissions",
    category: FIELD_TYPE_CATEGORY.ARRAY,
  }),
  labelledOption("SCHEMA_ACCESS_CONTROL.AUTH_ORGANIZATION_ID", {
    value: "organizationId",
    category: FIELD_TYPE_CATEGORY.STRING,
  }),
  // Left out of the selectable auth fields for now; add an entry back here to expose it.
  // { label: "TenantId", value: "tenantId", category: FIELD_TYPE_CATEGORY.STRING },
  // { label: "Custom Claims", value: "customClaims", category: FIELD_TYPE_CATEGORY.STRING },
];

/**
 * An org-scoped access attribute ("Access attributes"), read as `Auth.Attributes.<name>`. The name is
 * typed by the policy author, so the choice is stored as `attributes.<name>` (see
 * `isAuthAttributeField`). Offered on the left side of a rule only; a list of strings, like Roles.
 */
export const AUTH_ATTRIBUTE_PREFIX = "attributes";
export const AUTH_ATTRIBUTE_OPTION = labelledOption("SCHEMA_ACCESS_CONTROL.AUTH_ATTRIBUTES", {
  value: AUTH_ATTRIBUTE_PREFIX,
  category: FIELD_TYPE_CATEGORY.ARRAY,
});

/** Auth fields offered on the left side of a rule: the fixed ones plus access attributes. */
export const AUTH_LEFT_FIELD_OPTIONS = [...AUTH_FIELD_OPTIONS, AUTH_ATTRIBUTE_OPTION];

/** True for `attributes` and `attributes.<name>`. */
export const isAuthAttributeField = (field: string | undefined): boolean =>
  field === AUTH_ATTRIBUTE_PREFIX || field?.startsWith(`${AUTH_ATTRIBUTE_PREFIX}.`) === true;

/** The attribute name inside `attributes.<name>`, or "" while it is not typed yet. */
export const getAuthAttributeName = (field: string | undefined): string =>
  field?.startsWith(`${AUTH_ATTRIBUTE_PREFIX}.`)
    ? field.slice(AUTH_ATTRIBUTE_PREFIX.length + 1)
    : "";

export const RULE_OPERATORS = [
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_EQUAL", { value: "EQUAL" }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_NOT_EQUAL", { value: "NOT_EQUAL" }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_GREATER_THAN", { value: "GREATER_THAN" }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_GREATER_THAN_OR_EQUAL", {
    value: "GREATER_THAN_OR_EQUAL",
  }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_LESS_THAN", { value: "LESS_THAN" }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_LESS_THAN_OR_EQUAL", {
    value: "LESS_THAN_OR_EQUAL",
  }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_CONTAIN", { value: "CONTAIN" }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_NOT_CONTAIN", { value: "NOT_CONTAIN" }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_IN", { value: "IN" }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_NOT_IN", { value: "NOT_IN" }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_START_WITH", { value: "START_WITH" }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_END_WITH", { value: "END_WITH" }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_IS_NULL", { value: "IS_NULL" }),
  labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_IS_NOT_NULL", { value: "IS_NOT_NULL" }),
  // labelledOption("SCHEMA_ACCESS_CONTROL.OPERATOR_REGEX", { value: "REGEX" }),
];

/** Numeric mappings matching the API contract */
export const SOURCE_TYPE_TO_NUMBER: Record<string, number> = {
  [RULE_SOURCE_TYPES.AUTH]: 0,
  [RULE_SOURCE_TYPES.SCHEMA_FIELD]: 1,
  [RULE_SOURCE_TYPES.STATIC_VALUE]: 2,
};

export const OPERATOR_TO_NUMBER: Record<string, number> = {
  EQUAL: 0,
  NOT_EQUAL: 1,
  GREATER_THAN: 2,
  GREATER_THAN_OR_EQUAL: 3,
  LESS_THAN: 4,
  LESS_THAN_OR_EQUAL: 5,
  CONTAIN: 6,
  NOT_CONTAIN: 7,
  IN: 8,
  NOT_IN: 9,
  START_WITH: 10,
  END_WITH: 11,
  IS_NULL: 12,
  IS_NOT_NULL: 13,
  REGEX: 14,
};

/** Reverse mappings: number → source-type string key (for prefilling forms) */
export const NUMBER_TO_SOURCE_TYPE: Record<number, string> = {
  0: RULE_SOURCE_TYPES.AUTH,
  1: RULE_SOURCE_TYPES.SCHEMA_FIELD,
  2: RULE_SOURCE_TYPES.STATIC_VALUE,
};

/** Reverse mappings: number → operator string key (for prefilling forms) */
export const NUMBER_TO_OPERATOR: Record<number, string> = {
  0: "EQUAL",
  1: "NOT_EQUAL",
  2: "GREATER_THAN",
  3: "GREATER_THAN_OR_EQUAL",
  4: "LESS_THAN",
  5: "LESS_THAN_OR_EQUAL",
  6: "CONTAIN",
  7: "NOT_CONTAIN",
  8: "IN",
  9: "NOT_IN",
  10: "START_WITH",
  11: "END_WITH",
  12: "IS_NULL",
  13: "IS_NOT_NULL",
  14: "REGEX",
};

export const LOGICAL_OPERATOR = {
  AND: 0,
  OR: 1,
} as const;

export const POLICY_TYPE = {
  ROW: 0,
  COLUMN: 1,
} as const;

export const POLICY_OPERATION = {
  READ: 0,
  CREATE: 1,
  UPDATE: 2,
  DELETE: 3,
  ALL: 4,
} as const;

/** Short display labels for access type badges */
export const ACCESS_TYPE_SHORT_LABELS: Record<string, string> = lazyLabels({
  [ACCESS_TYPES.LOGGED_IN]: "SCHEMA_ACCESS_CONTROL.TYPE_SHORT_LOGGED_IN",
  [ACCESS_TYPES.PUBLIC]: "SCHEMA_ACCESS_CONTROL.TYPE_PUBLIC",
  [ACCESS_TYPES.CUSTOM]: "SCHEMA_ACCESS_CONTROL.TYPE_CUSTOM",
  [ACCESS_TYPES.INHERITED]: "SCHEMA_ACCESS_CONTROL.TYPE_INHERITED",
});

/** SchemaAccessLevel enum: number → ACCESS_TYPES string */
export const ACCESS_LEVEL_TO_TYPE: Record<number, string> = {
  0: ACCESS_TYPES.INHERITED,
  1: ACCESS_TYPES.LOGGED_IN,
  2: ACCESS_TYPES.PUBLIC,
  3: ACCESS_TYPES.CUSTOM,
};

/** ACCESS_TYPES string → SchemaAccessLevel enum number */
export const ACCESS_TYPE_TO_LEVEL: Record<string, number> = {
  [ACCESS_TYPES.INHERITED]: 0,
  [ACCESS_TYPES.LOGGED_IN]: 1,
  [ACCESS_TYPES.PUBLIC]: 2,
  [ACCESS_TYPES.CUSTOM]: 3,
};

/** Reverse mappings: number → display label */
export const NUMBER_TO_SOURCE_LABEL: Record<number, string> = lazyLabels({
  0: KEY_SOURCE_AUTH,
  1: KEY_SOURCE_SCHEMA_FIELDS,
  2: "SCHEMA_ACCESS_CONTROL.SOURCE_STATIC_VALUE",
});

/** Operators valid per field type category */
export const STRING_OPERATORS = [
  "EQUAL",
  "NOT_EQUAL",
  "IN",
  "NOT_IN",
  "START_WITH",
  "END_WITH",
  "IS_NULL",
  "IS_NOT_NULL",
  "REGEX",
];

export const ARRAY_OPERATORS = ["CONTAIN", "NOT_CONTAIN", "IS_NULL", "IS_NOT_NULL"];

export const NUMERIC_OPERATORS = [
  "EQUAL",
  "NOT_EQUAL",
  "IN",
  "NOT_IN",
  "LESS_THAN",
  "LESS_THAN_OR_EQUAL",
  "GREATER_THAN",
  "GREATER_THAN_OR_EQUAL",
  "IS_NULL",
  "IS_NOT_NULL",
];

export const OPERATORS_BY_CATEGORY: Record<FieldTypeCategory, string[]> = {
  [FIELD_TYPE_CATEGORY.STRING]: STRING_OPERATORS,
  [FIELD_TYPE_CATEGORY.ARRAY]: ARRAY_OPERATORS,
  [FIELD_TYPE_CATEGORY.NUMERIC]: NUMERIC_OPERATORS,
};

/** Auth fields that are string type (for right-side filtering when left is array) */
export const AUTH_STRING_FIELDS = AUTH_FIELD_OPTIONS.filter(
  (opt) => opt.category === FIELD_TYPE_CATEGORY.STRING,
);

/** Numeric schema field types */
const NUMERIC_FIELD_TYPES = new Set([
  "int",
  "int32",
  "int64",
  "long",
  "float",
  "double",
  "decimal",
  "datetime",
]);

/** Resolve the field type category for a schema field */
export function getFieldTypeCategory(
  type?: string | null,
  isArray?: boolean | null,
): FieldTypeCategory {
  if (isArray) return FIELD_TYPE_CATEGORY.ARRAY;
  const normalized = (type ?? "").toLowerCase();
  if (NUMERIC_FIELD_TYPES.has(normalized)) return FIELD_TYPE_CATEGORY.NUMERIC;
  return FIELD_TYPE_CATEGORY.STRING;
}

export const NUMBER_TO_OPERATOR_LABEL: Record<number, string> = lazyLabels({
  0: "SCHEMA_ACCESS_CONTROL.OPERATOR_EQUAL",
  1: "SCHEMA_ACCESS_CONTROL.OPERATOR_NOT_EQUAL",
  2: "SCHEMA_ACCESS_CONTROL.OPERATOR_GREATER_THAN",
  3: "SCHEMA_ACCESS_CONTROL.OPERATOR_GREATER_THAN_OR_EQUAL",
  4: "SCHEMA_ACCESS_CONTROL.OPERATOR_LESS_THAN",
  5: "SCHEMA_ACCESS_CONTROL.OPERATOR_LESS_THAN_OR_EQUAL",
  6: "SCHEMA_ACCESS_CONTROL.OPERATOR_CONTAIN",
  7: "SCHEMA_ACCESS_CONTROL.OPERATOR_NOT_CONTAIN",
  8: "SCHEMA_ACCESS_CONTROL.OPERATOR_IN",
  9: "SCHEMA_ACCESS_CONTROL.OPERATOR_NOT_IN",
  10: "SCHEMA_ACCESS_CONTROL.OPERATOR_START_WITH",
  11: "SCHEMA_ACCESS_CONTROL.OPERATOR_END_WITH",
  12: "SCHEMA_ACCESS_CONTROL.OPERATOR_IS_NULL",
  13: "SCHEMA_ACCESS_CONTROL.OPERATOR_IS_NOT_NULL",
  14: "SCHEMA_ACCESS_CONTROL.OPERATOR_REGEX",
});

/** Natural-language operator labels for readable rule text */
export const READABLE_OPERATORS: Record<number, string> = lazyLabels({
  0: "SCHEMA_ACCESS_CONTROL.READABLE_EQUAL",
  1: "SCHEMA_ACCESS_CONTROL.READABLE_NOT_EQUAL",
  2: "SCHEMA_ACCESS_CONTROL.READABLE_GREATER_THAN",
  3: "SCHEMA_ACCESS_CONTROL.READABLE_GREATER_THAN_OR_EQUAL",
  4: "SCHEMA_ACCESS_CONTROL.READABLE_LESS_THAN",
  5: "SCHEMA_ACCESS_CONTROL.READABLE_LESS_THAN_OR_EQUAL",
  6: "SCHEMA_ACCESS_CONTROL.READABLE_CONTAIN",
  7: "SCHEMA_ACCESS_CONTROL.READABLE_NOT_CONTAIN",
  8: "SCHEMA_ACCESS_CONTROL.READABLE_IN",
  9: "SCHEMA_ACCESS_CONTROL.READABLE_NOT_IN",
  10: "SCHEMA_ACCESS_CONTROL.READABLE_START_WITH",
  11: "SCHEMA_ACCESS_CONTROL.READABLE_END_WITH",
  12: "SCHEMA_ACCESS_CONTROL.READABLE_IS_NULL",
  13: "SCHEMA_ACCESS_CONTROL.READABLE_IS_NOT_NULL",
  14: "SCHEMA_ACCESS_CONTROL.READABLE_REGEX",
});

/** Operator keys that take no right-hand operand */
export const NULL_OPERATORS: string[] = ["IS_NULL", "IS_NOT_NULL"];

/** Operator keys that accept multiple values */
export const IN_OPERATORS: string[] = ["IN", "NOT_IN"];

/** Display labels for the access type selector */
export const ACCESS_TYPE_LABELS: Record<string, string> = lazyLabels({
  [ACCESS_TYPES.LOGGED_IN]: "SCHEMA_ACCESS_CONTROL.TYPE_LOGGED_IN",
  [ACCESS_TYPES.PUBLIC]: "SCHEMA_ACCESS_CONTROL.TYPE_PUBLIC",
  [ACCESS_TYPES.CUSTOM]: "SCHEMA_ACCESS_CONTROL.TYPE_CUSTOM_PERMISSIONS",
  [ACCESS_TYPES.INHERITED]: "SCHEMA_ACCESS_CONTROL.TYPE_INHERITED",
});

/** Map tab id → POLICY_OPERATION number */
export const TAB_TO_OPERATION: Record<string, number> = {
  view: POLICY_OPERATION.READ,
  create: POLICY_OPERATION.CREATE,
  edit: POLICY_OPERATION.UPDATE,
  delete: POLICY_OPERATION.DELETE,
};

/** Map tab id → access-level property key on IField */
export const TAB_TO_ACCESS_LEVEL_KEY: Record<
  string,
  "readAccessLevel" | "writeAccessLevel" | "editAccessLevel" | "deleteAccessLevel"
> = {
  view: "readAccessLevel",
  create: "writeAccessLevel",
  edit: "editAccessLevel",
  delete: "deleteAccessLevel",
};
