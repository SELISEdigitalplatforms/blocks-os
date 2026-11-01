import type {
  IInviteEnvironmentDetail,
  IInvitePeoplePayload,
  InvitationOutcome,
} from "@/models/people";
import { tStatic } from "@seliseblocks/genesis-os";

export const emailRegex = /^(?=.{1,320}$)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const GRANTED_OUTCOMES: InvitationOutcome[] = [
  "invited",
  "user_creation_requested",
  "invitation_requested",
  "access_granted",
];

const SKIP_REASON_KEYS: Record<string, string> = {
  already_has_access: "INVITE_PEOPLE_UTILS.SKIP_ALREADY_HAS_ACCESS",
  invitation_not_sent: "INVITE_PEOPLE_UTILS.SKIP_INVITATION_NOT_SENT",
  skipped_self: "INVITE_PEOPLE_UTILS.SKIP_SELF",
  skipped_no_environments: "INVITE_PEOPLE_UTILS.SKIP_NO_ENVIRONMENTS",
};

/** Splits the server's per-email outcomes into people who got access and people who did not. */
export const summarizeInviteOutcomes = (
  results?: Record<string, InvitationOutcome>,
): { granted: string[]; skipped: [string, InvitationOutcome][] } => {
  const entries = Object.entries(results ?? {}) as [string, InvitationOutcome][];

  return {
    granted: entries.filter(([, o]) => GRANTED_OUTCOMES.includes(o)).map(([email]) => email),
    skipped: entries.filter(([, o]) => !GRANTED_OUTCOMES.includes(o)),
  };
};

export const describeSkippedInvites = (skipped: [string, InvitationOutcome][]): string =>
  tStatic("os.people", "INVITE_PEOPLE_UTILS.NO_INVITATION_WAS_SENT", {
    details: skipped
      .map(([email, outcome]) =>
        tStatic("os.people", SKIP_REASON_KEYS[outcome] ?? "INVITE_PEOPLE_UTILS.SKIP_DEFAULT", { email }),
      )
      .join(", "),
  });

export const describeInviteSuccess = (
  granted: string[],
  skipped: [string, InvitationOutcome][],
): string => {
  // A server that does not report outcomes yet sends neither list; say nothing more than we know.
  if (granted.length === 0 && skipped.length === 0) return tStatic("os.people", "INVITE_PEOPLE_UTILS.INVITATION_IS_SENT");

  const sent = tStatic("os.people", "INVITE_PEOPLE_UTILS.INVITATION_SENT_TO", { count: granted.length });
  return skipped.length === 0
    ? sent
    : tStatic("os.people", "INVITE_PEOPLE_UTILS.SENT_AND_SKIPPED", {
        sent,
        emails: skipped.map(([email]) => email).join(", "),
      });
};

export const DEFAULT_INVITE_ROLES = ["user"] as const;

const getInviteRolesFromAuthStorage = (): string[] => {
  try {
    const raw = localStorage.getItem("auth-storage");
    if (!raw) return [...DEFAULT_INVITE_ROLES];

    const parsed = JSON.parse(raw) as {
      state?: {
        user?: { roles?: Record<string, string[]> } | { roles?: Record<string, string[]> }[];
      };
    };
    const user = parsed.state?.user;
    const rolesRecord = Array.isArray(user) ? user[0]?.roles : user?.roles;
    const orgRoles = rolesRecord ? Object.values(rolesRecord).flat() : [];

    return orgRoles.length > 0 ? orgRoles : [...DEFAULT_INVITE_ROLES];
  } catch {
    return [...DEFAULT_INVITE_ROLES];
  }
};

export const buildInviteEnvironmentDetail = (tenantId: string): IInviteEnvironmentDetail => ({
  tenantId,
  roles: getInviteRolesFromAuthStorage(),
});

export const buildInvitePeoplePayload = (
  invitationsMap: Record<string, string[]>,
  groupId: string,
): IInvitePeoplePayload => {
  const invitations: IInvitePeoplePayload["invitations"] = {};

  Object.entries(invitationsMap).forEach(([email, tenantIds]) => {
    const uniqueTenantIds = Array.from(new Set(tenantIds));
    invitations[email] = uniqueTenantIds.map((tenantId) => buildInviteEnvironmentDetail(tenantId));
  });

  return { invitations, groupId };
};
