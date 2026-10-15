export type PlatformField = {
  name: string;
  type: string;
  isArray: boolean;
  editAccessLevel: number;
};

export type PlatformSchema = {
  id: string;
  schemaName: string;
  collectionName: string;
  service: "IAM" | "OS" | "Logic" | "Release";
  editAccessLevel: number;
  fields: PlatformField[];
};

export type PolicyRule = {
  leftSource: number;
  leftOperand: string;
  operator: number;
  rightSource: number;
  rightOperand: string;
  rightOperands: string[];
  staticValue: string | null;
};

export type Policy = {
  itemId?: string;
  policyName: string;
  policyDescription?: string;
  policyType: number;
  operation: number;
  entityName: string;
  schemaId: string;
  fieldNames: string[];
  ruleGroup: { logicalOperator: number; rules: PolicyRule[]; nestedGroups: unknown[] };
  priority: number;
  isAllowPolicy: boolean;
};

export type PolicyPayload = Omit<Policy, "entityName" | "itemId"> & {
  itemId?: string;
  schemaName: string;
  projectKey: string;
};

export type ApiResponse<T> = {
  isSuccess: boolean;
  data: T;
  errors?: unknown;
  message?: string;
};
