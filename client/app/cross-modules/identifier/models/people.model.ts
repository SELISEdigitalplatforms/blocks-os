import { PeopleGroupedByEnvironments } from "@/models/people";

export interface IPeopleAcceptInvitationPayload {
  code: string;
}

export interface IPeopleAcceptInvitationResponse {
  isSuccess: boolean;
  activationKey?: string;
  /** The project (IAM tenant) the invitation was for, used to build the IAM OIDC activation URL. */
  tenantId?: string;
  errors?: Record<string, string>;
}

export interface ITransferOwnershipPayload {
  tenantGroupId: string;
  transferToUserEmail: string;
}

export interface GetPeopleResponse {
  peoples: PeopleGroupedByEnvironments[];
  totalCount: number;
  peoplesTotalCount: number;
  errors: null | unknown;
  isSuccess: boolean;
  isOwner: boolean;
}
