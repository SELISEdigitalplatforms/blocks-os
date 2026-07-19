export interface IInviteEnvironmentDetail {
  tenantId: string
  roles: string[]
}

export interface IInvitePeoplePayload {
  invitations: Record<string, IInviteEnvironmentDetail[]>
  groupId: string
}

/** What the server actually did with each address, keyed by the normalized (lowercased) email. */
export type InvitationOutcome =
  | "invited"
  | "user_creation_requested"
  | "invitation_requested"
  | "access_granted"
  | "already_has_access"
  | "invitation_not_sent"
  | "skipped_self"
  | "skipped_no_environments";

export interface IInvitePeopleResponse {
  isSuccess: boolean;
  errors: null | { exceed_limit: string };
  results?: Record<string, InvitationOutcome>;
}

export interface IResendInvitation {
  email: string;
  groupId: string;
}

export interface IRemoveAccess {
  email: string;
  tenantIds: string[];
  groupId: string;
}

export interface IRemoveEnvironmentAccess {
  email: string;
  tenantIds: string[];
  groupId: string;
}

export interface IConfirmInvitation {
  code: string;
}
export interface SharedEnvironment {
  itemId: string;
  tenantId: string;
  isInvitationSent: boolean;
  isInvitationConfirmed: boolean;
  isCreator: boolean;
  enviroment: string; // Note: API has typo "enviroment" instead of "environment"
}

export interface PeopleDetails {
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
  userId: string;
  allowResendActivation: boolean;
}

export interface PeopleGroupedByEnvironments {
  peopleDetails: PeopleDetails;
  sharedEnviroments: SharedEnvironment[];
}

// Legacy interface for backward compatibility
export interface People {
  itemId: string;
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string;
  userId: string;
  tenantId: string;
  role: string;
  isInvitationSent: boolean;
  isInvitationConfirmed: boolean;
  isCreator: boolean;
}
