import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@seliseblocks/genesis-os";
import { IMembership } from "@blocks-idp/iam/models/user";
import { RemoveMembership } from "../user-memberships/remove-membership";

export type UserOrganizationRow = {
  organizationId: string;
  name: string;
  isEnabled: boolean;
  roleCount: number;
  permissionCount: number;
};

type UserOrganizationsListProps = {
  organizations: UserOrganizationRow[];
  selectedOrgId: string;
  onSelect: (organizationId: string) => void;
  onManageClick: () => void;
  isLoading: boolean;
  userId: string;
  projectKey: string;
  revokeTarget: UserOrganizationRow | null;
  onRevokeRequest: (org: UserOrganizationRow) => void;
  onRevokeDialogChange: (open: boolean) => void;
  onRevokeSuccess: () => void;
};

export const UserOrganizationsList = ({
  organizations,
  selectedOrgId,
  onSelect,
  isLoading,
  userId,
  projectKey,
  revokeTarget,
  onRevokeDialogChange,
  onRevokeSuccess,
}: UserOrganizationsListProps) => {
  const { t } = useT("os.idp.users");
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div>
        <h3 className="text-base font-semibold text-high-emphasis">
          {t("USER_ORGANIZATIONS_LIST.TITLE")}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("USER_ORGANIZATIONS_LIST.DESCRIPTION")}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-md" />
          ))
        ) : organizations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <Building2 className="h-5 w-5" />
            {t("USER_ORGANIZATIONS_LIST.NO_ORGANIZATIONS_FOUND")}
          </div>
        ) : (
          organizations.map((org) => {
            const isSelected = org.organizationId === selectedOrgId;
            return (
              <div
                key={org.organizationId}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-r-md border-l-2 border-transparent pr-1 transition-colors",
                  isSelected ? "border-l-primary bg-primary/5" : "hover:bg-muted/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(org.organizationId)}
                  className="flex flex-1 items-center gap-3 px-2.5 py-2.5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-high-emphasis">{org.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t("USER_ORGANIZATIONS_LIST.SUMMARY", {
                        roles: t("USER_ORGANIZATIONS_LIST.ROLE_COUNT", { count: org.roleCount }),
                        permissions: t("USER_ORGANIZATIONS_LIST.PERMISSION_COUNT", {
                          count: org.permissionCount,
                        }),
                      })}
                    </p>
                  </div>
                </button>
              </div>
            );
          })
        )}
      </div>

      {revokeTarget && (
        <RemoveMembership
          open={!!revokeTarget}
          onOpenChange={onRevokeDialogChange}
          membership={
            {
              organizationId: revokeTarget.organizationId,
              roles: [],
              permissions: [],
            } as IMembership
          }
          organizationName={revokeTarget.name}
          userId={userId}
          projectKey={projectKey}
          onSuccess={onRevokeSuccess}
        />
      )}
    </div>
  );
};
