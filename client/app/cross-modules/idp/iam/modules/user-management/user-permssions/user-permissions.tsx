import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { UserPermissionsList } from "./user-permissions-list";
import { useUserPermissions } from "@blocks-idp/iam/hooks/use-user";
import { AddUserPermission } from "./add-user-permission";
import { Button } from "@/components/ui-kits/button/button";
import { toast } from "@/hooks/use-toast";
import { IPermission } from "@blocks-idp/iam/models/permission";
import { useT } from "@seliseblocks/genesis-os";

type UserPermissionsProps = {
  userId: string;
  projectKey: string;
};

export function UserPermissions({ userId, projectKey }: UserPermissionsProps) {
  const { t } = useT("os.idp.users");
  const { permissions, isLoading, deletePermissions } = useUserPermissions({ userId, projectKey });

  // Only the pending removals are state. The displayed list is derived from the
  // fetched permissions, so a refetch flows straight through without an effect
  // that copies props into state.
  const [removedResources, setRemovedResources] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const localPermissions: IPermission[] = useMemo(
    () => permissions.filter((perm) => !removedResources.includes(perm.resource)),
    [permissions, removedResources],
  );

  const onRemovePermission = (resource: string) => {
    setRemovedResources((prev) => (prev.includes(resource) ? prev : [...prev, resource]));
  };

  const onReset = () => {
    setRemovedResources([]);
  };

  const onSave = async () => {
    if (!removedResources.length) return;
    setIsSaving(true);
    try {
      const res = await deletePermissions(removedResources);
      if (res.isSuccess) {
        setRemovedResources([]);
        toast({
          variant: "success",
          title: t("USER_PERMISSIONS.SUCCESS_TITLE"),
          description: t("USER_PERMISSIONS.UPDATED"),
        });
      } else {
        toast({
          variant: "destructive",
          title: t("USER_PERMISSIONS.ERROR_TITLE"),
          description: (res.errors as string) || t("USER_PERMISSIONS.SOMETHING_WENT_WRONG"),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("USER_PERMISSIONS.ERROR_TITLE"),
        description: t("USER_PERMISSIONS.SOMETHING_WENT_WRONG_DETAILS", {
          details: JSON.stringify(error),
        }),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="flex w-full flex-col">
        <Card>
          <CardHeader className="flex flex-row! items-center justify-between">
            <CardTitle>{t("USER_PERMISSIONS.TITLE")}</CardTitle>
            <div className="flex gap-2">
              {!!removedResources.length && (
                <>
                  <Button variant="outline" onClick={onReset} disabled={isSaving || (!removedResources.length && localPermissions.length === permissions.length)}>
                    {t("common:RESET")}
                  </Button>
                  <Button variant="outline" onClick={onSave} disabled={isSaving || !removedResources.length}>
                    {isSaving ? t("USER_PERMISSIONS.SAVING") : t("common:SAVE")}
                  </Button>
                </>
              )}
              <AddUserPermission userId={userId} projectKey={projectKey} />
            </div>
          </CardHeader>
          <CardContent>
            <UserPermissionsList
              permissions={localPermissions}
              isLoading={isLoading}
              userId={userId}
              onRemovePermission={onRemovePermission}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
