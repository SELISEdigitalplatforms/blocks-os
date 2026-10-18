export const PERMISSION_ACTIONS = [
  { id: "view", label: "View", value: "view" },
  { id: "create", label: "Create", value: "create" },
  { id: "edit", label: "Edit", value: "edit" },
  { id: "delete", label: "Delete", value: "delete" },
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
  { label: "Auth", value: RULE_SOURCE_TYPES.AUTH },
  { label: "Schema Fields", value: RULE_SOURCE_TYPES.SCHEMA_FIELD },
  // { label: "Static Value", value: RULE_SOURCE_TYPES.STATIC_VALUE },
];

export const COMPARE_SOURCE_OPTIONS = [
  { label: "Auth", value: RULE_SOURCE_TYPES.AUTH },
  { label: "Schema Fields", value: RULE_SOURCE_TYPES.SCHEMA_FIELD },
  { label: "Static Value", value: RULE_SOURCE_TYPES.STATIC_VALUE },
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
  { label: "UserId", value: "userId", category: FIELD_TYPE_CATEGORY.STRING },
  { label: "Email", value: "email", category: FIELD_TYPE_CATEGORY.STRING },
  { label: "Roles", value: "roles", category: FIELD_TYPE_CATEGORY.ARRAY },
  {
    label: "Permissions",
    value: "permissions",
    category: FIELD_TYPE_CATEGORY.ARRAY,
  },
  {
    label: "OrganizationId",
    value: "organizationId",
    category: FIELD_TYPE_CATEGORY.STRING,
  },
  // Left out of the selectable auth fields for now; add an entry back here to expose it.
  // { label: "TenantId", value: "tenantId", category: FIELD_TYPE_CATEGORY.STRING },
  // { label: "Custom Claims", value: "customClaims", category: FIELD_TYPE_CATEGORY.STRING },
];

export const RULE_OPERATORS = [
  { label: "Equal", value: "EQUAL" },
  { label: "Not Equal", value: "NOT_EQUAL" },
  { label: "Greater Than", value: "GREATER_THAN" },
  { label: "Greater Than or Equal", value: "GREATER_THAN_OR_EQUAL" },
  { label: "Less Than", value: "LESS_THAN" },
  { label: "Less Than or Equal", value: "LESS_THAN_OR_EQUAL" },
  { label: "Contain", value: "CONTAIN" },
  { label: "Not Contain", value: "NOT_CONTAIN" },
  { label: "In", value: "IN" },
  { label: "Not In", value: "NOT_IN" },
  { label: "Start With", value: "START_WITH" },
  { label: "End With", value: "END_WITH" },
  { label: "Is Null", value: "IS_NULL" },
  { label: "Is Not Null", value: "IS_NOT_NULL" },
  // { label: "Regex", value: "REGEX" },
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
export const ACCESS_TYPE_SHORT_LABELS: Record<string, string> = {
  [ACCESS_TYPES.LOGGED_IN]: "Logged in users",
  [ACCESS_TYPES.PUBLIC]: "Public",
  [ACCESS_TYPES.CUSTOM]: "Custom",
  [ACCESS_TYPES.INHERITED]: "Inherited",
};

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
export const NUMBER_TO_SOURCE_LABEL: Record<number, string> = {
  0: "Auth",
  1: "Schema Fields",
  2: "Static Value",
};

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

export const NUMBER_TO_OPERATOR_LABEL: Record<number, string> = {
  0: "Equal",
  1: "Not Equal",
  2: "Greater Than",
  3: "Greater Than or Equal",
  4: "Less Than",
  5: "Less Than or Equal",
  6: "Contain",
  7: "Not Contain",
  8: "In",
  9: "Not In",
  10: "Start With",
  11: "End With",
  12: "Is Null",
  13: "Is Not Null",
  14: "Regex",
};

/** Natural-language operator labels for readable rule text */
export const READABLE_OPERATORS: Record<number, string> = {
  0: "equals",
  1: "does not equal",
  2: "is greater than",
  3: "is greater than or equal to",
  4: "is less than",
  5: "is less than or equal to",
  6: "contains",
  7: "does not contain",
  8: "is in",
  9: "is not in",
  10: "starts with",
  11: "ends with",
  12: "is null",
  13: "is not null",
  14: "matches regex",
};

/** Operator keys that take no right-hand operand */
export const NULL_OPERATORS: string[] = ["IS_NULL", "IS_NOT_NULL"];

/** Operator keys that accept multiple values */
export const IN_OPERATORS: string[] = ["IN", "NOT_IN"];

/** Display labels for the access type selector */
export const ACCESS_TYPE_LABELS: Record<string, string> = {
  [ACCESS_TYPES.LOGGED_IN]: "All Logged In Users",
  [ACCESS_TYPES.PUBLIC]: "Public",
  [ACCESS_TYPES.CUSTOM]: "Custom Permissions",
  [ACCESS_TYPES.INHERITED]: "Inherited",
};

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

