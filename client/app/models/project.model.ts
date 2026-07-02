export interface IProject {
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  lastUpdatedBy: string;
  organizationIds: string[];
  tags: string[];
  name: string;
  applications: IApplication[];
  applicationDomain: string;
  customDomain: string;
  isProduction: true;
  tenantId: string;
  isCookieEnable: boolean;
  isDomainVerified: boolean;
  cookieDomain: "blocksdevelopers.com";
  isDisabled: boolean;
  environment: string;
  tenantGroupId: string;
  tenantSlug: string;
}
export interface IApplication {
  domain: string;
  cookieDomain: string;
  isDomainVerified: boolean;
}

export interface IProjectGroup {
  tenantGroupId: string;
  projects: IProject[];
  nonSharedProject: IProject[];
  isShared: boolean;
}

export interface IGetProjectPayload {
  projectId?: string;
}

export interface IGetProjectResponse {
  data: IProject;
  errors: unknown | null;
}
