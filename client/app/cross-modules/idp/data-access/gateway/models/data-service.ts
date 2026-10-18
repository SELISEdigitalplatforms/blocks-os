export interface IAnalyticsConfiguration {
  enableAnalytics: boolean;
  enableDate: string | null;
  validTill: string | null;
}

export interface IDefaultResponse {
  isSuccess: boolean;
  message: string;
  httpStatusCode: number;
  errors: string[];
}

/** The connection string is never returned: only which kind is saved. */
export type DataSourceConnectionType = "Default" | "Custom";

export interface IDataSourceResponse {
  projectKey: string;
  projectShortKey?: string;
  databaseName: string;
  connectionType: DataSourceConnectionType;
  ItemId?: string;
  itemId?: string;
  isCollectionNameEditable?: boolean;
  collectionNamePattern?: string;
  analyticsConfiguration?: IAnalyticsConfiguration;
}

export interface IUnadaptedChangeLogsResponse {
  errors: unknown;
  isSuccess: boolean;
  data: Array<{
    changeType: number;
  }>;
}

/** One published schema version, as listed in the version history. */
export interface ISchemaVersionSummary {
  version: number;
  /** "Publish", or "Bootstrap" for the first version taken from the drafts. */
  kind: string;
  publishedDate: string;
  publishedBy: string | null;
  changeCount: number;
  schemaCount: number;
  isCurrent: boolean;
}

export interface ISchemaVersionHistoryResponse {
  isSuccess: boolean;
  errors: unknown;
  data: {
    currentVersion: number;
    versions: ISchemaVersionSummary[];
  } | null;
}

export interface ISchemaRollbackResponse {
  isSuccess: boolean;
  message: string;
  errors: unknown;
  data: { version: number; previousVersion: number } | null;
}

export interface IDataServiceConfigurationResponse {
  errors: unknown;
  isSuccess: boolean;
  data: unknown;
}

export interface ICreateSchemaResponse {
  errors: unknown;
  isSuccess: boolean;
  data: {
    acknowledged: boolean;
    itemId: string;
  };
}

export interface IGetSchemaListPayload {
  keyword?: string;
  pageNo: number;
  pageSize: number;
  sortDescending?: boolean;
  sortBy?: "CreatedDate";
  schemaName?: string;
  projectKey: string;
  schemaType?: string | number;
}

export interface IDataAccessRuleSet {
  roles: string[];
  permissions: string[];
  users: string[];
}

export interface IDataAccessRuleSetDto {
  roles: string[] | null;
  permissions: string[] | null;
  users: string[] | null;
}

export interface IField {
  name: string;
  type: string;
  isArray: boolean;
  /** Allowed values when type is Enum (GraphQL-name-safe strings). */
  enumValues?: string[];
  isPIIData?: boolean;
  isUniqueData?: boolean;
  description?: string;
  requiredOn?: RequiredOn;
  readAccess?: IDataAccessRuleSet;
  writeAccess?: IDataAccessRuleSet;
  deleteAccess?: IDataAccessRuleSet;
  totalRoles?: number;
  totalUsers?: number;
  totalPermissions?: number;
  deleteAccessLevel?: number;
  editAccessLevel?: number;
  readAccessLevel?: number;
  writeAccessLevel?: number;
  totalValidationRules?: number;
  validationRule?: IFieldValidationRule | null;
  /** Nested fields for custom/child type properties */
  fields?: IField[];
}

export type RequiredOn = "None" | "Insert" | "Update" | "Both";

export interface ISchemaDetails {
  id: string;
  schemaName: string;
  schemaType: number;
  collectionName: string;
  fields: IField[];
  totalPermissions: number;
  totalRoles: number;
  totalUsers: number;
  readAccess?: IDataAccessRuleSet;
  writeAccess?: IDataAccessRuleSet;
  deleteAccess?: IDataAccessRuleSet;
  projectKey?: string;
  isRlsEnabled?: boolean;
  isClsEnabled?: boolean;
  projectShortKey: string;
  totalSchemaReferences: number;
  schemaReferences: string[];
  rowAccessLevel?: number;
  columnAccessLevel?: number;
  deleteAccessLevel: number;
  editAccessLevel: number;
  readAccessLevel: number;
  writeAccessLevel: number;
}

/** Grants at one tier, for a single verb. */
export interface IAccessLevelCounts {
  public: number;
  user: number;
  custom: number;
}

/**
 * Access-level counts across every entity schema in the project.
 *
 * The per-verb breakdown has always been sent; the client read only the three
 * flat totals. Inherited is absent by construction — the aggregation counts the
 * three levels that are set, so inherited is whatever is left of 4 × schemas.
 */
export interface IPermissionAggregation {
  totalCustomPermission: number;
  totalPublicPermission: number;
  totalUserPermission: number;
  read?: IAccessLevelCounts;
  write?: IAccessLevelCounts;
  edit?: IAccessLevelCounts;
  delete?: IAccessLevelCounts;
}

// Permission counts
export interface IGetSchemaListResponse extends IDataServiceConfigurationResponse {
  data: {
    items: ISchemaDetails[];
    totalCount: number;
    schemas: {
      items: ISchemaDetails[];
      totalCount: number;
    };
    aggregation: IPermissionAggregation;
  };
}
export interface IRemoteSchemaField {
  name: string;
  type: string;
  isArray: boolean;
  enumValues?: string[];
  isPIIData?: boolean;
  isUniqueData?: boolean;
  description?: string;
  requiredOn?: RequiredOn;
  readAccess?: IDataAccessRuleSetDto | null;
  writeAccess?: IDataAccessRuleSetDto | null;
  deleteAccess?: IDataAccessRuleSetDto | null;
  totalRoles?: number;
  totalUsers?: number;
  totalPermissions?: number;
  deleteAccessLevel?: number;
  editAccessLevel?: number;
  readAccessLevel?: number;
  writeAccessLevel?: number;
  totalValidationRules?: number;
  validationRule?: IFieldValidationRule | null;
  /** Nested fields for custom/child type properties */
  fields?: IRemoteSchemaField[];
}

export interface IGetSchemaDetailsResponse extends IDataServiceConfigurationResponse {
  data: {
    id: string;
    schemaName: string;
    schemaType: number;
    collectionName: string;
    fields: IRemoteSchemaField[];
    totalCount: number;
    totalPermissions: number;
    totalRoles: number;
    totalUsers: number;
    readAccess?: IDataAccessRuleSetDto | null;
    writeAccess?: IDataAccessRuleSetDto | null;
    deleteAccess?: IDataAccessRuleSetDto | null;
    projectKey?: string;
    isRlsEnabled?: boolean;
    isClsEnabled?: boolean;
    projectShortKey: string;
    totalSchemaReferences: number;
    schemaReferences: string[];
    rowAccessLevel?: number;
    columnAccessLevel?: number;
    deleteAccessLevel: number;
    editAccessLevel: number;
    readAccessLevel: number;
    writeAccessLevel: number;
  };
}

export interface ICreateSchemaPayload {
  schemaName: string;
  collectionName: string | undefined;
  schemaType: number;
  itemId?: string;
  projectKey: string;
}

export interface ICreateSchemaDefaultValues {
  schemaName: string;
  schemaType: "Entity" | "DTO";
  entityName?: string;
}

export interface IUpdateSchemaStructure {
  schemaDefinitionItemId: string;
  deletableFieldNames?: string[];
  fields: IField[];
  projectKey: string;
}

interface IFieldLevelAccess {
  name: string;
  readAccess: IDataAccessRuleSet;
  writeAccess: IDataAccessRuleSet;
  deleteAccess: IDataAccessRuleSet;
}

export interface ISetDataAccessPayload {
  projectKey: string;
  writeAccess: IDataAccessRuleSet;
  deleteAccess: IDataAccessRuleSet;
  readAccess: IDataAccessRuleSet;
  fields: IFieldLevelAccess[];
  schemaId: string;
}

export interface ISetRowColumnPermissionPayload {
  projectKey: string;
  schemaId: string;
  operation: number;
  policyType: number;
  fieldNames: Array<string>;
  accessLevel: number;
}

export interface ISetDataAccessResponse {
  isSuccess: boolean;
  message: string;
  httpStatusCode: number;
  data: {
    acknowledged: boolean;
    itemId: string;
    totalImpactedData: number;
  };
  errors: unknown[];
}

export interface IExecuteGraphQLPayload {
  projectShortKey: string;
  query: string;
}

export interface IMockDataResponse {
  errors: unknown;
  isSuccess: boolean;
  data: {
    items: Array<{
      collectionName: string;
      schemaName: string;
      count: number;
    }>;
  };
}

export interface IDeleteMockDataPayload {
  projectKey: string;
  schemaNames: Array<string>;
}

export interface IDeleteMockDataResponse extends ISetDataAccessResponse {}

/** Policy rule within a rule group */
export interface IPolicyRule {
  leftSource: number;
  leftOperand: string;
  operator: number;
  rightSource: number;
  rightOperand: string;
  rightOperands?: string[];
  staticValue: string | string[] | null;
  description?: string;
}

/** A group of rules with a logical operator */
export interface IPolicyRuleGroup {
  logicalOperator: number;
  rules: IPolicyRule[];
  nestedGroups: IPolicyRuleGroup[];
}

/** Payload for creating a data-access policy */
export interface ICreatePolicyPayload {
  policyName: string;
  policyDescription?: string;
  policyType: number;
  operation: number;
  schemaName: string;
  schemaId: string;
  fieldNames: string[];
  ruleGroup: IPolicyRuleGroup;
  priority: number;
  isAllowPolicy: boolean;
  projectKey: string;
}

export interface ICreatePolicyData {
  acknowledged: boolean;
  itemId: string;
  totalImpactedData: number;
  message: string | null;
}

export interface ICreatePolicyResponse {
  isSuccess: boolean;
  message: string;
  httpStatusCode: number;
  data: ICreatePolicyData;
  errors: string[];
}

/** Single policy item returned from getPolicy */
export interface IPolicyItem {
  itemId?: string;
  policyName: string;
  policyDescription?: string;
  policyType: number;
  operation: number;
  entityName: string;
  schemaId: string;
  fieldNames: string[];
  ruleGroup: IPolicyRuleGroup;
  priority: number;
  isAllowPolicy: boolean;
  projectKey: string;
}

/** Payload for updating a data-access policy */
export interface IUpdatePolicyPayload extends ICreatePolicyPayload {
  itemId: string;
}

/** Response from getPolicy API */
export interface IGetPolicyResponse {
  isSuccess: boolean;
  message: string;
  httpStatusCode: number;
  data: IPolicyItem[];
  errors: string[];
}

export interface IDeletePolicyPayload {
  itemId: string;
  projectKey: string;
}

export type IDeletePolicyResponse = ICreatePolicyResponse;

export interface IGetConfigurationPayload {
  projectKey: string;
}

export interface IGetSchemaFieldValidationPayload {
  schemaId: string;
  fieldName: string;
  projectKey: string;
  enabled?: boolean;
}

export interface ISchemaFieldValidation {
  type: number;
  value: string;
  secondaryValue: string;
  errorMessage: string;
  isActive: boolean;
}

export interface ISchemaFieldValidationData {
  itemId: string;
  schemaId: string;
  fieldName: string;
  validations: ISchemaFieldValidation[];
  createdDate: string;
  lastUpdatedDate: string;
}

export interface IFieldValidationRule extends ISchemaFieldValidationData {
  deletedDate: string | null;
  isDeleted: boolean;
  createdBy: string;
  language: string | null;
  lastUpdatedBy: string;
  organizationIds: string[];
  tags: string[];
}

export interface IGetSchemaFieldValidationResponse extends IDefaultResponse {
  data: ISchemaFieldValidationData | null;
}

export interface ICreateSchemaFieldValidationPayload {
  projectKey: string;
  schemaId: string;
  fieldName: string;
  validations: ISchemaFieldValidation[];
}

export interface IUpdateSchemaFieldValidationPayload {
  projectKey: string;
  itemId: string;
  schemaId: string;
  fieldName: string;
  validations: ISchemaFieldValidation[];
}

export interface IDeleteSchemaFieldValidationPayload {
  id: string;
  projectKey: string;
}

// ── Schema Indexes ────────────────────────────────────────────────────────

/** Wire form of the backend's SortDirection enum (JsonStringEnumConverter → member name). */
export type IndexDirection = "ASC" | "DESC";

export interface IIndexFieldPayload {
  fieldName: string;
  direction: IndexDirection;
}

export interface ISchemaIndex {
  itemId: string;
  name: string;
  fields: IIndexFieldPayload[];
  isUnique: boolean;
  createdDate: string;
}

export interface IGetSchemaIndexesResponse {
  isSuccess: boolean;
  message?: string | null;
  errors?: unknown;
  /**
   * `systemIndexes` are the read-only, automatically managed indexes that exist in MongoDB
   * (the 2dsphere index of each GeoJson field). Absent from older backends.
   */
  data: { indexes: ISchemaIndex[]; systemIndexes?: ISchemaIndex[] } | null;
}

export interface ICreateSchemaIndexPayload {
  schemaDefinitionItemId: string;
  name?: string;
  fields: IIndexFieldPayload[];
  isUnique: boolean;
}

export interface ISchemaIndexActionResponse {
  isSuccess: boolean;
  message?: string | null;
  errors?: unknown;
  data: { acknowledged: boolean; itemId: string } | null;
}

export interface IDeleteSchemaIndexPayload {
  itemId: string;
  /** Not sent to the API — used only to invalidate the right ["schema-indexes", id] query. */
  schemaDefinitionItemId: string;
}

// ── Schema Export ──────────────────────────────────────────────────────────
/** Mirrors backend `SchemaExportOption`. Value `All` (3) includes both optional sections together. */
export const SchemaExportOption = {
  /** Schema structure and field access levels (Read/Write/Edit/Delete) from schema definition */
  Schema: 0,
  /** Include RLS and CLS policies from data access policy */
  AccessPolicies: 1,
  /** Include per-field validation rules */
  ValidationRules: 2,
  /** Schema plus all optional sections (AccessPolicies + ValidationRules) */
  All: 3,
} as const;

export type SchemaExportOptionValue = (typeof SchemaExportOption)[keyof typeof SchemaExportOption];

export interface ISchemaExportPayload {
  projectKey: string;
  messageCoRelationId: string;
  /**
   * Export scope: `Schema` (0) is schema-only; `AccessPolicies` (1) or `ValidationRules` (2) for a single
   * extra section; `All` (3) when both policies and validations are included.
   */
  exportOption: SchemaExportOptionValue;
}

export interface ISchemaExportResponseData {
  acknowledged: boolean;
  itemId: string;
  totalImpactedData: number;
  message: string;
}

export interface ISchemaExportResponse {
  isSuccess: boolean;
  message: string;
  httpStatusCode: number;
  data: ISchemaExportResponseData;
  errors: Array<{
    propertyName: string;
    errorMessage: string;
    attemptedValue: string;
    customState: string;
    severity: number;
    errorCode: string;
    formattedMessagePlaceholderValues: Record<string, string>;
  }>;
}

export type IGetUnAdaptedChangeLogsPayload = IGetConfigurationPayload;
export type IInitiateDataGatewayPipelinePayload = IGetConfigurationPayload;

