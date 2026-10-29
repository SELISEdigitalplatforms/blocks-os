import { useState } from "react";
import { ShieldCheck, User, X } from "lucide-react";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Label } from "@/components/ui-kits/label/label";
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { useGetUsers } from "@blocks-idp/iam/hooks/use-user";
import {
  useResolvedRoleNames,
  useResolvedUserNames,
  userDisplayName,
} from "@/cross-modules/secrets/hooks/use-access-labels";
import type { SecretAccess } from "@/cross-modules/secrets/models/secret.model";
import { AccessPickerDialog, type AccessPickerItem } from "./access-picker-dialog";

const PAGE_SIZE = 10;

interface UserRolePickerProps {
  value: SecretAccess;
  onChange: (access: SecretAccess) => void;
  disabled?: boolean;
}

const AccessChips = ({
  ids,
  labels,
  onRemove,
  disabled,
  icon: Icon,
}: {
  ids: string[];
  labels: Record<string, string>;
  onRemove: (id: string) => void;
  disabled?: boolean;
  icon: typeof User;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {ids.map((id) => (
      <Badge key={id} variant="secondary" className="gap-1 py-0.5 pl-2 pr-1 font-normal">
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="max-w-[180px] truncate" title={labels[id] ?? id}>
          {labels[id] ?? id}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 hover:bg-transparent"
          onClick={() => onRemove(id)}
          disabled={disabled}
          aria-label={`Remove ${labels[id] ?? id}`}
        >
          <X className="h-3 w-3" />
        </Button>
      </Badge>
    ))}
  </div>
);

/** One bordered box per access kind, so users and roles never read as a single blurred list. */
const AccessBox = ({
  title,
  hint,
  count,
  action,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  action: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="rounded-md border">
    <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{title}</Label>
        {count > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
    <div className="px-3 py-2.5">
      {count > 0 ? children : <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  </div>
);

/**
 * Picks the users and roles allowed to read an `api` secret.
 *
 * Stores identifiers, not display names: `userIds` are user GUIDs and `roles` are role **slugs**,
 * because that is what lands in the JWT `roles` claim and what `SecretAuthorizationService`
 * compares against. A free-text role field would let a typo through, producing a role that
 * matches nobody and a secret that is silently unreadable with no error anywhere.
 */
export function UserRolePicker({ value, onChange, disabled }: UserRolePickerProps) {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  const [usersOpen, setUsersOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(0);

  const [rolesOpen, setRolesOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [rolePage, setRolePage] = useState(0);

  const { data: usersData, isLoading: usersLoading } = useGetUsers(
    {
      page: userPage,
      pageSize: PAGE_SIZE,
      projectKey: tenantId,
      filter: { email: userSearch, name: "" },
    },
    { enabled: usersOpen && !!tenantId },
  );

  const { data: rolesData, isLoading: rolesLoading } = useGetRoles(
    {
      page: rolePage,
      pageSize: PAGE_SIZE,
      sort: { property: "Name", isDescending: false },
      filter: { search: roleSearch },
    },
    { enabled: rolesOpen && !!tenantId },
  );

  const userItems: AccessPickerItem[] = (usersData?.data ?? []).map((user) => ({
    id: user.itemId,
    primary: userDisplayName(user),
    secondary: user.email,
  }));

  const roleItems: AccessPickerItem[] = (rolesData?.data ?? []).map((role) => ({
    id: role.slug,
    primary: role.name || role.slug,
    secondary: role.slug,
  }));

  const userNames = useResolvedUserNames(value.userIds);
  const roleNames = useResolvedRoleNames(value.roles);

  const addUsers = (ids: string[]) =>
    onChange({ ...value, userIds: [...new Set([...value.userIds, ...ids])] });

  const addRoles = (ids: string[]) =>
    onChange({ ...value, roles: [...new Set([...value.roles, ...ids])] });

  const isEmpty = value.userIds.length === 0 && value.roles.length === 0;

  return (
    <div className="space-y-3">
      <AccessBox
        title="People"
        hint="No one added yet."
        count={value.userIds.length}
        action={
          <AccessPickerDialog
            title="Add people"
            description="Pick the people who may read this secret's value."
            triggerLabel="Add"
            searchPlaceholder="Search by email"
            emptyLabel="No users found"
            selected={value.userIds}
            items={userItems}
            totalCount={usersData?.totalCount ?? 0}
            isLoading={usersLoading}
            page={userPage}
            pageSize={PAGE_SIZE}
            search={userSearch}
            open={usersOpen}
            disabled={disabled}
            showAvatar
            onOpenChange={setUsersOpen}
            onPageChange={setUserPage}
            onSearchChange={(search) => {
              setUserSearch(search);
              setUserPage(0);
            }}
            onAdd={addUsers}
          />
        }
      >
        <AccessChips
          ids={value.userIds}
          labels={userNames}
          icon={User}
          disabled={disabled}
          onRemove={(id) =>
            onChange({ ...value, userIds: value.userIds.filter((item) => item !== id) })
          }
        />
      </AccessBox>

      <AccessBox
        title="Roles"
        hint="No roles added yet."
        count={value.roles.length}
        action={
          <AccessPickerDialog
            title="Add roles"
            description="Anyone holding one of these roles may read this secret's value."
            triggerLabel="Add"
            searchPlaceholder="Search by role name"
            emptyLabel="No roles found"
            selected={value.roles}
            items={roleItems}
            totalCount={rolesData?.totalCount ?? 0}
            isLoading={rolesLoading}
            page={rolePage}
            pageSize={PAGE_SIZE}
            search={roleSearch}
            open={rolesOpen}
            disabled={disabled}
            onOpenChange={setRolesOpen}
            onPageChange={setRolePage}
            onSearchChange={(search) => {
              setRoleSearch(search);
              setRolePage(0);
            }}
            onAdd={addRoles}
          />
        }
      >
        <AccessChips
          ids={value.roles}
          labels={roleNames}
          icon={ShieldCheck}
          disabled={disabled}
          onRemove={(id) =>
            onChange({ ...value, roles: value.roles.filter((item) => item !== id) })
          }
        />
      </AccessBox>

      {isEmpty && (
        // Backend semantics: an empty access list is not "everyone", it is the creator plus
        // root. Saying so inline is cheaper than a validation rule that forbids a legal state.
        <p className="text-xs text-muted-foreground">
          Leave both empty and only you and platform administrators will be able to read this.
        </p>
      )}
    </div>
  );
}
