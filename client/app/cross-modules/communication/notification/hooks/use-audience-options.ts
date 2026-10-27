import { useGetOrganizations } from "@blocks-idp/iam/hooks/use-organization";
import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission";
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { useGetUsers } from "@blocks-idp/iam/hooks/use-user";

export type AudienceOptionKind = "users" | "organizations" | "roles" | "permissions";

export interface IAudienceOption {
  value: string;
  label: string;
}

const PAGE_SIZE = 20;

const userDisplayName = (user: { firstName?: string; lastName?: string; userName: string }) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ") || user.userName;

/**
 * One page of picker options for a kind, read through the IAM hooks the rest of the console uses.
 * Only the hook of the requested kind runs; the others stay disabled.
 */
export const useAudienceOptions = (
  kind: AudienceOptionKind,
  projectKey: string,
  search: string,
  enabled: boolean,
): { options: IAudienceOption[]; isLoading: boolean } => {
  const term = search.trim();

  const users = useGetUsers(
    { page: 0, pageSize: PAGE_SIZE, projectKey, filter: { email: "", name: term } },
    { enabled: enabled && kind === "users" },
  );
  const organizations = useGetOrganizations({
    projectKey,
    page: 0,
    pageSize: PAGE_SIZE,
    search: term || undefined,
    enabled: enabled && kind === "organizations",
  });
  const roles = useGetRoles(
    { page: 0, pageSize: PAGE_SIZE, projectKey, filter: { search: term } },
    { enabled: enabled && kind === "roles" },
  );
  const permissions = useGetPermissions(
    { page: 0, pageSize: PAGE_SIZE, projectKey, search: term, isBuiltIn: "", roles: [] },
    { enabled: enabled && kind === "permissions" },
  );

  switch (kind) {
    case "users":
      return {
        isLoading: users.isLoading,
        options: (users.data?.data ?? []).map((user) => ({
          value: user.itemId,
          label: `${userDisplayName(user)} (${user.email})`,
        })),
      };
    case "organizations":
      return {
        isLoading: organizations.isLoading,
        options: (organizations.data?.organizations ?? []).map((item) => ({
          value: item.itemId,
          label: item.name,
        })),
      };
    case "roles":
      return {
        isLoading: roles.isLoading,
        options: (roles.data?.data ?? []).map((role) => ({ value: role.slug, label: role.name })),
      };
    default:
      return {
        isLoading: permissions.isLoading,
        options: (permissions.data?.data ?? []).map((item) => ({
          // Tokens carry the permission's Resource (e.g. "blocks-iam::iam::users"), so that is what is stored.
          value: item.resource,
          label: item.name,
        })),
      };
  }
};
