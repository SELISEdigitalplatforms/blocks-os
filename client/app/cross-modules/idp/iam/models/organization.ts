export interface IOrganization {
  itemId: string;
  name: string;
  isEnable: boolean;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  lastUpdatedBy: string;
  language: string | null;
  organizationIds: string[];
  tags: string[];
  // Fields below are returned by the IAM organizations endpoints and consumed by the
  // organization-management UI; optional because older records may omit them.
  description?: string | null;
  isDisabled?: boolean;
  defaultRoleForMembers?: string[];
  defaultPermissionsForMembers?: string[];
  email?: string | null;
  phoneNumber?: string | null;
  websiteUrl?: string | null;
  addresses?: unknown[];
  logoUrl?: string | null;
}

export interface IOrganizationFilter {
  projectKey: string;
  page: number;
  pageSize: number;
  search?: string;
  sort?: {
    property: string;
    isDescending: boolean;
  };
}

export interface IGetOrganizationsParams {
  projectKey: string;
  page: number;
  pageSize: number;
  searchText?: string;
  sort?: {
    property: string;
    isDescending: boolean;
  };
}

export interface IGetOrganizationsResponse {
  organizations: IOrganization[];
  errors: unknown;
  isSuccess: boolean;
  totalCount: number;
}

export interface IGetOrganizationByIdParams {
  projectKey: string;
  itemId: string;
}

export interface IGetOrganizationByIdResponse {
  organization: IOrganization;
  errors: unknown;
  isSuccess: boolean;
}

export interface ICreateOrUpdateOrganizationPayload {
  projectKey?: string;
  name: string;
  itemId?: string;
  isEnable?: boolean;
  /** Origin of the creation request; the cloud UI sends 1. */
  createdFrom?: number;
}

export interface IUpdateOrganizationPayload {
  itemId: string;
  name: string;
  isEnable: boolean;
}

export interface ICreateOrUpdateOrganizationResponse {
  errors: unknown;
  isSuccess: boolean;
}
