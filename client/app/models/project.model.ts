import { DomainAction } from "@/pages/dashboard/components/domain";
import { IProject, IDomain } from "@seliseblocks/blocks-kit/models";

export interface IProjectGroup {
  tenantGroupId: string;
  projects: IProject[];
  nonSharedProject: IProject[];
  isShared: boolean;
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
