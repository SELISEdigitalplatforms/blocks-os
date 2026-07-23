import { Badge } from "@/components/ui-kits/badge/badge";
import { Label } from "@/components/ui-kits/label/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { useGetProfileMFAConfig } from "@blocks-idp/mfa/hooks/use-mfa-config";
import { MFA_Provider_Data } from "@blocks-idp/mfa/utils/mfa-config";
import { useGetProfileUserById } from "@blocks-idp/iam/hooks/use-user";
import { useContext, useMemo } from "react";
import { profileMfaContext } from "../profile-mfa";
type UserMFAMethodListProps = {
  selected: number;
  setSelected: (selected: number) => void;
};
export const ProfileMFAMethodList = ({ selected, setSelected }: UserMFAMethodListProps) => {
  const { userId, projectKey } = useContext(profileMfaContext);
  const { isLoading, isFetching, data: projectMfaConfig } = useGetProfileMFAConfig();
  const { data: userData } = useGetProfileUserById({ id: userId, projectKey });
  const projectMfaEnabled = projectMfaConfig?.enabled === true;
  const availableMFaMethod = useMemo(() => {
    if (!projectMfaEnabled) return [];
    if (!projectMfaConfig?.allowedMethods?.length) return [];
    return MFA_Provider_Data.filter((item) =>
      projectMfaConfig.allowedMethods.includes(item.type),
    );
  }, [projectMfaEnabled, projectMfaConfig?.allowedMethods]);
  const isProjectMfaLoading = isLoading || isFetching;
  return (
    <>
      {isProjectMfaLoading ? (
        <div>
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-2 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-full" />
        </div>
      ) : !projectMfaEnabled ? (
        <p className="text-sm text-muted-foreground">
          Multi-factor authentication is not enabled for this project.
        </p>
      ) : availableMFaMethod.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No MFA methods are available for this project.
        </p>
      ) : (
        <RadioGroup
          defaultValue={selected.toString()}
          onValueChange={(val) => setSelected(Number(val))}
          className="gap-5"
        >
          {availableMFaMethod.map((item) => {
            const userHasMethodEnabled =
              userData?.data?.mfaEnabled === true &&
              userData.data.userMfaType === item.type &&
              userData.data.isMfaVerified !== false;
            return (
              <div key={item.type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={item.type.toString()} id={item.type.toString()} />
                  <Label
                    htmlFor={item.type.toString()}
                    className="cursor-pointer text-sm font-medium"
                  >
                    {item.label}
                  </Label>
                </div>
                {userHasMethodEnabled && <Badge variant="success"> Enabled</Badge>}
              </div>
            );
          })}
        </RadioGroup>
      )}
    </>
  );
};
