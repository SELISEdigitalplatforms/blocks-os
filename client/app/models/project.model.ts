import { DomainAction } from "@/pages/dashboard/components/domain";
import { IProject, IDomain } from "@seliseblocks/blocks-kit/models";
// export interface IProject {
//   itemId: string;
//   createdDate: string;
//   lastUpdatedDate: string;
//   createdBy: string;
//   lastUpdatedBy: string;
//   organizationIds: string[];
//   tags: string[];
//   name: string;
//   applications: IApplication[];
//   customDomain: string | null;
//   isProduction: true;
//   tenantId: string;
//   isCookieEnable: boolean;
//   isDomainVerified: boolean;
//   cookieDomain: "blocksdevelopers.com";
//   isDisabled: boolean;
//   environment: string;
//   tenantGroupId: string;
//   tenantSlug: string;
// }

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

export interface IUpdateProjectPayload {
  action: DomainAction;
  application: IDomain;
  applicationDomain?: string;
}
export interface IUpdateProjectResponse {
  errors: unknown | null;
  isSuccess: boolean;
}
export interface IValidateCnameProjectPayload {
  cookieDomain: string;
}

export type { IProject };
