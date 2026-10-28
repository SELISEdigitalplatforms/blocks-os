import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGetUsers } from "@blocks-idp/iam/hooks/use-user";
import { useGetAssignableRoles } from "@blocks-idp/iam/hooks/use-roles";
import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission";
import type { User } from "@blocks-idp/iam/models/user";
import { LIMITS, NOTIFICATION_TEXT } from "../../constants/notification-ui.constant";
import { EntityPicker, type PickerSearchResult } from "./entity-picker";

const PAGE_SIZE = 10;

interface PickerProps {
  values: string[];
  onChange: (values: string[]) => void;
}

const userLabel = (user: User): string => {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name ? `${name} (${user.email})` : user.email;
};

const useUserSearch = (term: string, enabled: boolean): PickerSearchResult => {
  const projectKey = useProjectStore()?.selectedProject?.tenantId || "";
  const { data, isFetching } = useGetUsers(
    { page: 0, pageSize: PAGE_SIZE, projectKey, filter: { email: "", name: term } },
    { enabled },
  );
  return {
    options: (data?.data ?? []).map((u) => ({ value: u.itemId, label: userLabel(u) })),
    isLoading: isFetching,
  };
};

/** Resolves the names of the saved user ids; an id with no match keeps showing as the id. */
const useUserNames = (ids: string[]) => {
  const projectKey = useProjectStore()?.selectedProject?.tenantId || "";
  const { data } = useGetUsers(
    {
      page: 0,
      pageSize: Math.max(ids.length, 1),
      projectKey,
      filter: { email: "", name: "", userIds: ids },
    },
    { enabled: ids.length > 0 },
  );
  const names = new Map((data?.data ?? []).map((u) => [u.itemId, userLabel(u)]));
  return (id: string) => names.get(id) ?? id;
};

export function UserPicker({ values, onChange }: Readonly<PickerProps>) {
  const labelOf = useUserNames(values);
  return (
    <EntityPicker
      label={NOTIFICATION_TEXT.users}
      placeholder={NOTIFICATION_TEXT.searchUsers}
      values={values}
      max={LIMITS.userIds}
      onChange={onChange}
      useSearch={useUserSearch}
      labelOf={labelOf}
    />
  );
}

const useRoleSearch = (term: string, enabled: boolean): PickerSearchResult => {
  const { data, isFetching } = useGetAssignableRoles(
    { page: 0, pageSize: PAGE_SIZE, filter: { search: term } },
    { enabled },
  );
  return {
    options: (data?.data ?? []).map((r) => ({ value: r.slug, label: r.name || r.slug })),
    isLoading: isFetching,
  };
};

export function RolePicker({ values, onChange }: Readonly<PickerProps>) {
  return (
    <EntityPicker
      label={NOTIFICATION_TEXT.roles}
      placeholder={NOTIFICATION_TEXT.searchRoles}
      values={values}
      max={LIMITS.roles}
      onChange={onChange}
      useSearch={useRoleSearch}
    />
  );
}

const usePermissionSearch = (term: string, enabled: boolean): PickerSearchResult => {
  const projectKey = useProjectStore()?.selectedProject?.tenantId || "";
  const { data, isFetching } = useGetPermissions(
    { projectKey, page: 0, pageSize: PAGE_SIZE, search: term, isBuiltIn: "", roles: [] },
    { enabled },
  );
  const resources = new Set<string>();
  for (const permission of data?.data ?? []) resources.add(permission.resource);
  return {
    options: [...resources].filter(Boolean).map((resource) => ({ value: resource, label: resource })),
    isLoading: isFetching,
  };
};

export function PermissionPicker({ values, onChange }: Readonly<PickerProps>) {
  return (
    <EntityPicker
      label={NOTIFICATION_TEXT.permissions}
      placeholder={NOTIFICATION_TEXT.searchPermissions}
      values={values}
      max={LIMITS.permissions}
      onChange={onChange}
      useSearch={usePermissionSearch}
    />
  );
}
