/**
 * Severity classification for a permission entry. Higher severity grants
 * access to more sensitive operations and warrants stricter review.
 */
export enum PermissionSeverityLevel {
  /** No severity assigned; default for newly created permissions. */
  None = 0,
  /** Critical permissions can affect security, billing, or data deletion. */
  Critical = 1,
  /** High-severity permissions touch sensitive PII or privileged actions. */
  High,
  /** Medium-severity permissions affect normal application data. */
  Medium,
  /** Low-severity permissions cover read-only or non-sensitive operations. */
  Low,
}

type PermissionSeverityOption = {
  label: string;
  value: PermissionSeverityLevel;
  variant: "error" | "destructive" | "info" | "success" | "secondary";
  className?: string;
  barClassName?: string;
  id: string;
  bg: string;
};

export const PERMISSION_SEVERITY_OPTIONS: PermissionSeverityOption[] = [
  {
    id: "Critical",
    label: "Critical",
    value: PermissionSeverityLevel.Critical,
    variant: "error",
    className: "text-red-800",
    barClassName: "bg-red-800",
    bg: "bg-red-50",
  },
  {
    id: "High",
    label: "High",
    value: PermissionSeverityLevel.High,
    variant: "destructive",
    className: "text-rose-800",
    barClassName: "bg-rose-500",
    bg: "bg-rose-50",
  },
  {
    id: "Medium",
    label: "Medium",
    value: PermissionSeverityLevel.Medium,
    variant: "info",
    className: "text-yellow-500",
    barClassName: "bg-yellow-400",
    bg: "bg-yellow-50",
  },
  {
    id: "Low",
    label: "Low",
    value: PermissionSeverityLevel.Low,
    variant: "success",
    className: "text-blue-500",
    barClassName: "bg-blue-400",
    bg: "bg-blue-50",
  },
  {
    id: "None",
    label: "None",
    value: PermissionSeverityLevel.None,
    variant: "secondary",
    className: "text-gray-600",
    barClassName: "bg-gray-400",
    bg: "bg-gray-50",
  },
];

export interface IPermission {
  itemId: string;
  name: string;
  type: number;
  description: string;
  resource: string;
  resourceGroup: string;
  projectKey: string;
  tags: string[];
  roles: string[];
  dependentPermissions: string[];
  isArchived: boolean;
  isBuiltIn: boolean;
  language: string | null;
  organizationIds: string[];
  permissionSeverity: PermissionSeverityLevel;
}

export interface IPermissionFilter {
  projectKey: string;
  type?: number | null;
  page: number;
  pageSize: number;
  search: string;
  isBuiltIn: string;
  roles: string[];
  resourceGroup?: string;
  tags?: string[];
  resources?: string[];
  isArchived?: boolean;
  sort?: {
    property: string;
    isDescending: boolean;
  };
  permissionSeverity?: string;
}

export interface IGetPermissionsPayload {
  page: number;
  pageSize: number;
  sort?: {
    property: string;
    isDescending: boolean;
  };
  filter: {
    search: string;
    isBuiltIn: string;
    type?: number;
    tags?: string[];
    isArchived?: boolean;
    resourceGroup?: string;
    resources?: string[];
    permissionSeverity?: number;
  };
  roles: string[];
  projectKey: string;
}
export interface IGetPermissionByIdPayload {
  id: string;
}
export interface IGetPermissionByIdResponse {
  data: IPermission;
  errors: unknown;
}

export interface CreatePermissionPayload {
  name: string;
  type: number;
  description: string;
  resource: string;
  resourceGroup: string;
  tags: string[];
  dependentPermissions: string[];
  isBuiltIn: boolean;
  permissionSeverity?: PermissionSeverityLevel;
}
export interface CreatePermissionResponse {
  errors: unknown;
  isSuccess: boolean;
  itemId: string;
}
export interface UpdatePermissionPayload extends Partial<CreatePermissionPayload> {
  itemId: string;
  isArchived?: boolean;
}
export interface UpdatePermissionResponse {
  errors: unknown;
  isSuccess: boolean;
  itemId: string;
}

export interface GetRolePermission {
  itemId: string;
  name: string;
  description: string;
  resource: string;
  resourceGroup: string;
  group?: string;
}

export interface GetPermission {
  itemId: string;
  name: string;
  description: string;
  resource: string;
  resourceGroup: string;
}

/**
 * The kind of resource a permission guards. Used by the permission
 * management UI to group, filter, and present permissions consistently.
 */
export enum ResourceType {
  /** Permission guards a server-side API endpoint. */
  "Endpoint" = 1,
  /** Permission guards a client-side user action / UI affordance. */
  "FE action" = 2,
  /** Permission guards access to a specific data record or data class. */
  "Data protection" = 3,
}

export const RESOURCE_TYPE = [
  {
    value: "1",
    label: "Endpoint",
  },
  {
    value: "2",
    label: "FE action",
  },
  {
    value: "3",
    label: "Data protection",
  },
];

export interface IGetResourceGroupPayload {
  projectKey: string;
}

export type IGetResourceGroupResponse = {
  resourceGroup: string;
  count: number;
}[];

export type IGetPermissionsSeverityResponse = {
  severityLevel: string;
  count: number;
}[];

export interface IGetPermissionsSeverityRequestPayload {
  projectKey: string;
}

export const normalizePermissionSeverity = (
  value: PermissionSeverityLevel | string | number | null | undefined,
): PermissionSeverityLevel | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number" && PermissionSeverityLevel[value] !== undefined) {
    return value as PermissionSeverityLevel;
  }
  if (typeof value === "string") {
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue) && PermissionSeverityLevel[numericValue] !== undefined) {
      return numericValue as PermissionSeverityLevel;
    }
    const matchedOption = PERMISSION_SEVERITY_OPTIONS.find(
      (option) => option.id.toLowerCase() === value.toLowerCase() || option.label.toLowerCase() === value.toLowerCase(),
    );
    return matchedOption?.value;
  }
  return undefined;
};

export const getSeverityOptionsFromResponse = (
  data: IGetPermissionsSeverityResponse | undefined,
) => {
  if (!data?.length) return PERMISSION_SEVERITY_OPTIONS;
  return data
    .map((item) => PERMISSION_SEVERITY_OPTIONS.find((option) => option.id === item.severityLevel))
    .filter((option): option is (typeof PERMISSION_SEVERITY_OPTIONS)[number] => !!option);
};
