import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { AddUserRole } from "./add-user-role";
import { useUserRoles } from "@blocks-idp/iam/hooks/use-user";
import { UserRolesList } from "./user-roles-list";
import { Button } from "@/components/ui-kits/button/button";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { IRole } from "@blocks-idp/iam/models/role";
import { useT } from "@seliseblocks/genesis-os";

type UserRolesProps = {
  id: string;
  projectKey: string;
};

export const UserRoles = ({ id, projectKey }: UserRolesProps) => {
  const { t } = useT("os.idp.users");
  const { isLoading, roles } = useUserRoles({ id, projectKey });

  // Only the pending removals are state. The displayed list is derived from the
  // fetched roles, so a refetch flows straight through without an effect that
  // copies props into state.
  const [removedRoleSlugs, setRemovedRoleSlugs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const localRoles: IRole[] = useMemo(
    () => roles.filter((role) => !removedRoleSlugs.includes(role.slug)),
    [roles, removedRoleSlugs],
  );

  const onRemoveRole = (slug: string) => {
    setRemovedRoleSlugs((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  };

  const onReset = () => {
    setRemovedRoleSlugs([]);
  };

  const { deleteRoles } = useUserRoles({ id, projectKey });

  const onSave = async () => {
    if (!removedRoleSlugs.length) return;
    setIsSaving(true);
    try {
      const res = await deleteRoles(removedRoleSlugs);
      if (!res.isSuccess) {
        showErrorToast({ errors: res.errors });
      } else {
        setRemovedRoleSlugs([]);
        showSuccessToast({ description: t("USER_ROLES.ROLES_UPDATED") });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) showErrorToast({ errors: error.errors });
      else showErrorToast({ errors: t("USER_ROLES.SOMETHING_WENT_WRONG") });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("USER_ROLES.TITLE")}</CardTitle>
        <div className="flex gap-2">
          {!!removedRoleSlugs.length && (
            <>
              <Button variant="outline" onClick={onReset} disabled={isSaving}>
                {t("common:RESET")}
              </Button>
              <Button variant="outline" onClick={onSave} disabled={isSaving}>
                {isSaving ? t("USER_ROLES.SAVING") : t("common:SAVE")}
              </Button>
            </>
          )}
          <AddUserRole userId={id} projectKey={projectKey} />
        </div>
      </CardHeader>
      <CardContent>
        <UserRolesList
          roles={localRoles}
          isLoading={isLoading}
          userId={id}
          projectKey={projectKey}
          onRemoveRole={onRemoveRole}
        />
      </CardContent>
    </Card>
  );
};
