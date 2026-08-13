import { DomainAction } from "@/pages/dashboard/components/domain";
import { IProject, IDomain } from "@seliseblocks/genesis-os/models";

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
  /**
   * Also tear down the shared API host under the cookie domain. It serves every
   * application under that domain — in this project and in others — so omitting
   * it (the default) keeps it running.
   */
  deleteSharedApiHost?: boolean;
}
export interface IUpdateProjectResponse {
  errors: unknown | null;
  isSuccess: boolean;
}
export interface IValidateCnameProjectPayload {
  cookieDomain: string;
}

export interface IRestoreProjectPayload {
  itemId: string;
}
export interface IRestoreProjectResponse {
  errors: unknown | null;
  isSuccess: boolean;
}

export type { IProject };
