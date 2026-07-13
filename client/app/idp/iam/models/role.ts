export interface IRole {
  itemId: string;
  name: string;
  slug: string;
  description: string;
  ancestorRoleSlugs: string[];
  parentRoleSlug: string | null;
  canCreateOwn: boolean;
  count: number;
  createdFromDefault: boolean;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  language: string | null;
  lastUpdatedBy: string;
  organizationId: string;
  tags: string[];
  projectKey?: string;
}

export interface GetRolesPayload {
  filter?: {
    search?: string;
    slugs?: string[];
  };
  sort?: {
    property: string;
    isDescending: boolean;
  };
  page?: number;
  pageSize?: number;
}
export interface GetRolesResponse {
  data: IRole[];
  errors: unknown;
  totalCount: number;
}

export interface IGetRolePayload {
  id: string;
  projectKey: string;
}
export interface IGetRoleResponse {
  data: IRole;
  errors: unknown;
}

export interface CreateRolePayload {
  name: string;
  description: string;
  slug: string;
}
export interface UpdateRolePayload extends Partial<Omit<CreateRolePayload, "slug">> {
  itemId: string;
}

export interface CreateGroup {
  name: string;
  description: string;
  slug: string;
  projectKey: string;
}

export interface EditRole {
  itemId: string;
  name: string;
  description: string;
}

export interface GetRolePermission {
  itemId: string;
  name: string;
  description: string;
  resource: string;
  resourceGroup: string;
  group?: string;
}

export interface SetRoles {
  addPermissions: string[];
  removePermissions: string[];
  slug: string;
  projectKey: string;
}

export interface GroupsData {
  itemId: string;
  name: string;
  description: string;
  count: number;
  projectKey: string;
}

/**
 * The kind of resource a permission guards.
 *
 * NOTE: This is a legacy duplicate of the `ResourceType` enum exported from
 * `@/idp/iam/models/permission`. All new code should import from
 * `permission.ts`; this declaration is kept only so existing role-management
 * modules continue to compile.
 */
export enum ResourceType {
  /** Permission guards a server-side API endpoint. */
  "Endpoint" = 1,
  /** Permission guards a client-side user action / UI affordance. */
  "FE action" = 2,
  /** Permission guards access to a specific data record or data class. */
  "Data protection" = 3,
}

export interface IGetRoles {
  page: number;
  pageSize: number;
  search: string;
  type?: string | null;
  isBuiltIn: string;
  roles: string[];
}
export interface IGetRolesPayload {
  page: number;
  pageSize: number;
  filter: {
    search?: string;
    type?: number;
    isBuiltIn: string;
    tags?: string;
    isArchived?: boolean;
  };
  roles?: string[];
  projectKey: string;
}
export interface IUpdateRole {
  itemId: string;
  name: string;
  description: string;
}
