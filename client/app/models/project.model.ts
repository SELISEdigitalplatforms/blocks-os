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
   * Remove the host's SSL certificate along with its nginx binding. Omitted or
   * false keeps the certificate, so re-adding the same domain reuses it instead
   * of issuing a new one against Let's Encrypt's weekly limit.
   */
  deleteCertificate?: boolean;
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
