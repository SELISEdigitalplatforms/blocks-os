"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { CircleMinus, Plus } from "lucide-react";
import { User } from "@blocks-idp/iam/models/user";
import { useRemoveEnvironmentAccess, useInvitePeople } from "@/hooks/use-people";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { PeopleGroupedByEnvironments } from "@/models/people";
import { IProjectGroup } from "@/models/project.model";
import { environmentOptions } from "@/constants/environment-options";
import { useProjectStore, useT, tStatic } from "@seliseblocks/genesis-os";
import { buildInvitePeoplePayload } from "./invite-people-utils";

interface PeopleEnvironmentsTabProps {
  user?: User;
  /** The exact People/Gets row selected by the detail page. */
  person?: PeopleGroupedByEnvironments;
  peopleData?: PeopleGroupedByEnvironments[];
  environmentList?: IProjectGroup[];
  /**
   * Removing someone from an environment and adding them to one are two different grants —
   * `people::remove` and `people::invite` — not one privilege of ownership.
   */
  canRemove?: boolean;
  canInvite?: boolean;
}

type PendingAction = {
  type: "add" | "remove";
  envValue: string;
} | null;

export const PeopleEnvironmentsTab = ({
  user,
  person,
  peopleData,
  environmentList,
  canRemove = false,
  canInvite = false,
}: PeopleEnvironmentsTabProps) => {
  const { t } = useT("os.people");
  // Prefer the row selected by the parent. Falling back to a user-id match keeps this component
  // safe for its existing callers without accidentally using the first row of a broad search.
  const userEnvironmentData =
    person ??
    peopleData?.find(
      (candidate) =>
        candidate.peopleDetails?.userId?.toLowerCase() === user?.itemId?.toLowerCase(),
    ) ??
    peopleData?.find(
      (candidate) =>
        !!user?.email &&
        candidate.peopleDetails?.email?.trim().toLowerCase() ===
          user.email.trim().toLowerCase(),
    ) ??
    (peopleData?.length === 1 ? peopleData[0] : undefined);
  const sharedEnvironments = useMemo(
    () => userEnvironmentData?.sharedEnviroments || [],
    [userEnvironmentData?.sharedEnviroments],
  );
  const isProfileUserOwner =
    userEnvironmentData?.role?.toLowerCase() === "owner" ||
    sharedEnvironments.some((env) => env.isCreator);

  // A deactivated account cannot be given or lose access. Pending invitees stay active.
  const isInactive = userEnvironmentData?.peopleDetails?.isActive === false;
  const canChangeAccess = !isProfileUserOwner && !isInactive;

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const withAccessEnvironments = useMemo(
    () => sharedEnvironments.map((env) => env.enviroment),
    [sharedEnvironments],
  );

  const allAvailableEnvironments = useMemo(() => {
    const projects = environmentList?.[0]?.projects?.map((project) => project.environment) || [];
    const nonShared =
      environmentList?.[0]?.nonSharedProject?.map((project) => project.environment) || [];
    return Array.from(new Set([...projects, ...nonShared]));
  }, [environmentList]);

  // An owner reaches every environment in the group. Their own rows are unioned in so the
  // list still shows what they hold even when the project list has not loaded or omits one.
  const currentAvailableEnvironments = useMemo(() => {
    if (isProfileUserOwner)
      return Array.from(new Set([...allAvailableEnvironments, ...withAccessEnvironments]));
    return withAccessEnvironments;
  }, [isProfileUserOwner, allAvailableEnvironments, withAccessEnvironments]);

  const withoutAccessEnvironments = useMemo(() => {
    return allAvailableEnvironments.filter((env) => !currentAvailableEnvironments.includes(env));
  }, [allAvailableEnvironments, currentAvailableEnvironments]);

  const { mutateAsync: removeEnvAsync, isPending: isRemoving } = useRemoveEnvironmentAccess();
  const { mutateAsync: inviteAsync, isPending: isInviting } = useInvitePeople();
  const isProcessing = isRemoving || isInviting;

  const getEnvironmentLabel = (value: string) => {
    return environmentOptions.find((opt) => opt.value === value)?.label || value;
  };

  const getProjectIdForEnvironment = useCallback(
    (envValue: string) => {
      const projectFromEnvList = environmentList?.[0]?.projects?.find(
        (p) => p.environment === envValue,
      );
      if (projectFromEnvList?.tenantId) return projectFromEnvList.tenantId;
      const projectFromShared = sharedEnvironments.find((e) => e.enviroment === envValue);
      return projectFromShared?.tenantId || "";
    },
    [environmentList, sharedEnvironments],
  );

  const handleCloseDialog = useCallback(() => {
    setIsConfirmDialogOpen(false);
    setPendingAction(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pendingAction || !user) return;
    const { type, envValue } = pendingAction;
    const projectId = getProjectIdForEnvironment(envValue);
    const groupId =
      useProjectStore.getState().selectedTenantGroup || environmentList?.[0]?.tenantGroupId || "";

    try {
      if (type === "add") {
        if (!user.email || !projectId) return;
        const res = await inviteAsync(
          buildInvitePeoplePayload({ [user.email]: [projectId] }, groupId),
        );
        if (!res?.isSuccess) {
          throw new Error(t("PEOPLE_ENVIRONMENTS_TAB.FAILED_TO_GRANT_ACCESS_TO", { envValue: getEnvironmentLabel(envValue) }));
        }
        showSuccessToast({
          description: t("PEOPLE_ENVIRONMENTS_TAB.ACCESS_GRANTED_TO", { envValue: getEnvironmentLabel(envValue) }),
        });
      } else {
        if (!user.email || !projectId) return;
        const res = await removeEnvAsync({
          email: user.email,
          tenantIds: [projectId],
          groupId,
        });
        if (!res?.isSuccess) {
          throw new Error(t("PEOPLE_ENVIRONMENTS_TAB.FAILED_TO_REMOVE_ACCESS_FROM", { envValue: getEnvironmentLabel(envValue) }));
        }
        showSuccessToast({
          description: t("PEOPLE_ENVIRONMENTS_TAB.ACCESS_REMOVED_FROM", { envValue: getEnvironmentLabel(envValue) }),
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : tStatic("os.people", "PEOPLE_ENVIRONMENTS_TAB.FAILED_TO_UPDATE_ACCESS");
      showErrorToast({ errors: message });
    } finally {
      handleCloseDialog();
    }
  }, [
    pendingAction,
    user,
    environmentList,
    inviteAsync,
    removeEnvAsync,
    handleCloseDialog,
    getProjectIdForEnvironment,
  ]);

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">{t("PEOPLE_ENVIRONMENTS_TAB.USER_DATA_NOT_AVAILABLE")}</div>
        </CardContent>
      </Card>
    );
  }

  const pendingEnvLabel = pendingAction ? getEnvironmentLabel(pendingAction.envValue) : "";

  return (
    <>
      <Card className="overflow-hidden p-0">
        <CardHeader className="mb-0 flex flex-row items-center justify-between border-b px-5 py-4 sm:px-6">
          <CardTitle>{t("PEOPLE_ENVIRONMENTS_TAB.ENVIRONMENT_ACCESS")}</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          {isInactive && (
            <p className="mb-4 text-sm text-muted-foreground">
              {t("PEOPLE_ENVIRONMENTS_TAB.THIS_ACCOUNT_IS_INACTIVE_SO")}
            </p>
          )}
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 lg:gap-10">
            <section className="min-w-0 space-y-4 lg:border-r lg:pr-10">
              <h3 className="text-sm font-semibold text-foreground">{t("PEOPLE_ENVIRONMENTS_TAB.WITH_ACCESS_TO")}</h3>
              <div className="flex flex-wrap gap-2.5">
              {currentAvailableEnvironments.length > 0 ? (
                currentAvailableEnvironments.map((envValue) => (
                  <div
                    key={envValue}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 shadow-xs transition-colors hover:bg-muted/50"
                  >
                    <span className="text-sm font-medium">{getEnvironmentLabel(envValue)}</span>
                    {canRemove && canChangeAccess && (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingAction({ type: "remove", envValue });
                          setIsConfirmDialogOpen(true);
                        }}
                        disabled={isProcessing}
                        className="ml-2 cursor-pointer p-1 text-destructive transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                        title={t("PEOPLE_ENVIRONMENTS_TAB.REMOVE_ACCESS")}
                        aria-label={t("PEOPLE_ENVIRONMENTS_TAB.REMOVE_ACCESS_FROM", { envValue: getEnvironmentLabel(envValue) })}
                      >
                        <CircleMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-2 text-sm italic text-muted-foreground">
                  {t("PEOPLE_ENVIRONMENTS_TAB.NO_ENVIRONMENTS_WITH_ACCESS_YET")}
                </div>
              )}
              </div>
            </section>
            <section className="min-w-0 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">{t("PEOPLE_ENVIRONMENTS_TAB.WITHOUT_ACCESS_TO")}</h3>
              <div className="flex flex-wrap gap-2.5">
                {withoutAccessEnvironments.length > 0 ? (
                  withoutAccessEnvironments.map((envValue) => (
                    <div
                      key={envValue}
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 shadow-xs transition-colors hover:bg-muted/50"
                    >
                      <span className="text-sm font-medium">{getEnvironmentLabel(envValue)}</span>
                      {canInvite && canChangeAccess && (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingAction({ type: "add", envValue });
                            setIsConfirmDialogOpen(true);
                          }}
                          disabled={isProcessing}
                          className="ml-2 cursor-pointer p-1 text-primary transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                          title={t("PEOPLE_ENVIRONMENTS_TAB.GRANT_ACCESS")}
                          aria-label={t("PEOPLE_ENVIRONMENTS_TAB.GRANT_ACCESS_TO", { envValue: getEnvironmentLabel(envValue) })}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-2 text-sm italic text-muted-foreground">
                    {t("PEOPLE_ENVIRONMENTS_TAB.HAS_ACCESS_TO_ALL_ENVIRONMENTS")}
                  </div>
                )}
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        {isConfirmDialogOpen && pendingAction && (
          <ConfirmationModal
            onCancel={handleCloseDialog}
            onConfirm={handleConfirm}
            buttonState={{ confirm: { disable: isProcessing } }}
            data={{
              dialogTitle: pendingAction.type === "add" ? t("PEOPLE_ENVIRONMENTS_TAB.GRANT_ACCESS_2") : t("PEOPLE_ENVIRONMENTS_TAB.REMOVE_ACCESS_2"),
              dialogSubtitle:
                pendingAction.type === "add"
                  ? t("PEOPLE_ENVIRONMENTS_TAB.ARE_YOU_SURE_YOU_WANT", { email: user.email, pendingEnvLabel })
                  : t("PEOPLE_ENVIRONMENTS_TAB.ARE_YOU_SURE_YOU_WANT_2", { email: user.email, pendingEnvLabel }),
              confirmButton: pendingAction.type === "add" ? t("PEOPLE_ENVIRONMENTS_TAB.GRANT") : t("common:REMOVE"),
              cancelButton: t("common:CANCEL"),
            }}
          />
        )}
      </Dialog>
    </>
  );
};
