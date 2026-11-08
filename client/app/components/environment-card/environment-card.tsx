import { useNavigate } from "react-router";
import { useState, type MouseEvent } from "react";
import { ChevronRight, Hourglass, Wrench, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { IProject } from "@/models/project.model";
import { useGetProjectStatus, useRestoreProject } from "@/hooks/use-project";
import { useProjectPermissions } from "@/hooks/use-project-access";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { useStartImpersonation } from "@seliseblocks/genesis-os/hooks";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import {
  isErrorWithErrors,
  showErrorToast,
  showSuccessToast,
} from "@seliseblocks/genesis-os/utils";
import { environmentOptions } from "@/constants/environment-options";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { MaskedText } from "@/components/masked-text";
import { Badge } from "@/components/ui-kits/badge/badge";
import { formatDate } from "@/lib/utils";
type EnvironmentCardProps = {
  project: IProject;
  isMigrationOngoing?: boolean;
  isMigrationFailed?: boolean;
  className?: string;
};
export const EnvironmentCard = ({
  project,
  isMigrationOngoing,
  isMigrationFailed,
  className,
}: EnvironmentCardProps) => {
  const { t } = useT("os.environments");
  const navigate = useNavigate();
  const { setSelectedProject } = useProjectStore();
  const { mutateAsync: startImpersonation } = useStartImpersonation();
  const {
    data: isSetupComplete,
    isError: isStatusError,
    isFetching: isStatusFetching,
    refetch: refetchStatus,
  } = useGetProjectStatus(project.itemId);
  const { mutateAsync: restoreProject, isPending: isRestoring } = useRestoreProject();
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  // Repair posts Project/Restore, which re-runs the whole provisioning routine and is
  // [ProjectPolicy(OwnerOnly = true)] — absent from the grant catalog on purpose. A
  // contributor still sees the "setup pending" warning; they just cannot act on it.
  const { isOwner } = useProjectPermissions(project.tenantGroupId);
  const canRepair = isOwner;

  // Only a confirmed `true` opens the card. A failed or unfinished status call used to read
  // as "set up", which let people into an environment whose setup had not finished.
  const setupComplete = isSetupComplete === true;
  const setupPending = isSetupComplete === false;
  const statusFailed = isSetupComplete === undefined && isStatusError;
  const statusChecking = isSetupComplete === undefined && !isStatusError;

  // An environment carries a generated domain plus any custom ones, so the card shows the
  // first and counts the rest rather than implying there is only one.
  const [primaryApplication, ...otherApplications] = project.applications ?? [];
  const primaryDomain = primaryApplication?.domain?.replace(/^https?:\/\//, "") ?? "";
  const extraDomains = otherApplications.length;

  const onClickHandler = async (): Promise<void> => {
    try {
      // Start impersonation for the target env (a clean start — this card lives
      // on console/project-overview where impersonation is terminated). The
      // dashboard's ImpersonationChecker/Synchronizer hydrate the impersonated
      // context after navigation, so no full page reload is needed. Reloading
      // here can abort an in-flight refresh-token rotation, orphaning the
      // rotating RT cookie and 401'ing the later `stop` call.
      await startImpersonation({ targeted_tenant_id: project.tenantId });
      setSelectedProject(project);
      navigate(`/app/${project.itemId}/dashboard`);
    } catch (err) {
      console.error("Failed to switch environment", err);
    }
  };
  const handleCardClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target instanceof Element && event.target.closest("[role='dialog']")) {
      return;
    }
    if (!setupComplete) {
      return;
    }
    if (isMigrationOngoing) {
      setIsConfirmationOpen(true);
      return;
    }
    onClickHandler();
  };
  const handleConfirm = (): void => {
    setIsConfirmationOpen(false);
    onClickHandler();
  };
  const handleRestoreConfirm = async (): Promise<void> => {
    try {
      const res = await restoreProject({ itemId: project.itemId });
      if (res.isSuccess) {
        showSuccessToast({
          title: t("ENVIRONMENT_CARD.ENVIRONMENT_REPAIR"),
          description: t("ENVIRONMENT_CARD.SETUP_HAS_BEEN_RE_TRIGGERED"),
        });
        setIsRestoreOpen(false);
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      }
    }
  };
  return (
    <Dialog open={isConfirmationOpen} onOpenChange={setIsConfirmationOpen}>
      <Card
        onClick={handleCardClick}
        aria-disabled={!setupComplete || undefined}
        className={`group flex min-h-[70px] flex-col justify-between rounded-sm p-4 shadow-none transition-shadow duration-200 ${
          setupComplete ? "cursor-pointer hover:shadow-md" : "cursor-default"
        } ${className}`}
      >
        <CardHeader className="flex flex-row justify-between p-0!">
          <CardTitle className="line-clamp-1 break-all text-lg leading-tight">
            <div className="flex w-fit flex-row items-center gap-1">
              <div className="text-base text-medium-emphasis">
                {environmentOptions.find((option) => option.value === project?.environment)?.label}
              </div>
              {isMigrationFailed && !isMigrationOngoing && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertTriangle
                        className="h-4 w-4 cursor-pointer text-icon-warning"
                        aria-label={t("ENVIRONMENT_CARD.MIGRATION_FAILED")}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="border-none bg-neutral-500 text-white shadow-none">
                      {t("ENVIRONMENT_CARD.MIGRATION_FAILED")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {isMigrationOngoing && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Hourglass className="h-4 w-4 cursor-pointer text-icon-warning" />
                    </TooltipTrigger>
                    <TooltipContent className="border-none bg-neutral-500 text-white shadow-none">
                      {t("ENVIRONMENT_CARD.MIGRATION_IN_PROGRESS")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </CardTitle>
          <div className="flex items-center gap-1">
            {setupPending && (
              <Badge
                variant="warning"
                className="gap-1"
                aria-label={t("ENVIRONMENT_CARD.SETUP_PENDING")}
              >
                <AlertTriangle className="h-3 w-3" />
                {t("ENVIRONMENT_CARD.SETUP_NOT_FINISHED")}
              </Badge>
            )}
            {statusChecking && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("ENVIRONMENT_CARD.CHECKING_SETUP")}
              </span>
            )}
            {setupComplete && (
              <ChevronRight className="h-4 w-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            )}
          </div>
        </CardHeader>
        {/* The reason used to sit in a hover tooltip on a bare icon, named a "restore" button
            the card does not have, and contributors got no button at all. Say it on the card. */}
        {statusFailed && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-sm border border-warning-200 bg-warning-50 p-3 text-xs text-warning-900">
            <p>{t("ENVIRONMENT_CARD.COULDN_T_CHECK_THE_SETUP")}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                refetchStatus();
              }}
              disabled={isStatusFetching}
              className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-secondary px-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isStatusFetching && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("common:RETRY")}
            </button>
          </div>
        )}
        {setupPending && (
          <div className="mt-3 flex flex-col gap-2 rounded-sm border border-warning-200 bg-warning-50 p-3 text-xs text-warning-900">
            <p>{t("ENVIRONMENT_CARD.SETUP_OF_THIS_ENVIRONMENT_DID")}</p>
            {canRepair ? (
              <Dialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    disabled={isRestoring}
                    className="inline-flex h-6 items-center gap-1 rounded-full bg-secondary px-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-70"
                    aria-label={t("ENVIRONMENT_CARD.REPAIR_ENVIRONMENT")}
                  >
                    {isRestoring ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wrench className="h-3 w-3" />
                    )}
                    <span>
                      {isRestoring ? t("ENVIRONMENT_CARD.REPAIRING") : t("ENVIRONMENT_CARD.REPAIR")}
                    </span>
                    {isRestoring && (
                      <span
                        className="ml-0.5 h-1 w-8 overflow-hidden rounded-full bg-secondary-foreground/20"
                        aria-hidden="true"
                      >
                        <span className="block h-full w-1/3 animate-pulse rounded-full bg-secondary-foreground/70" />
                      </span>
                    )}
                  </button>
                </DialogTrigger>
                <ConfirmationModal
                  onCancel={() => setIsRestoreOpen(false)}
                  onConfirm={handleRestoreConfirm}
                  data={{
                    dialogTitle: t("ENVIRONMENT_CARD.REPAIR_THIS_ENVIRONMENT"),
                    dialogSubtitle: (
                      <>
                        <p>{t("ENVIRONMENT_CARD.SETUP_HASN_T_COMPLETED_FOR")}</p>
                        <p>{t("ENVIRONMENT_CARD.THIS_WILL_RE_RUN_THE")}</p>
                      </>
                    ),
                    confirmButton: t("ENVIRONMENT_CARD.REPAIR"),
                  }}
                  buttonState={{ confirm: { disable: isRestoring } }}
                />
              </Dialog>
            ) : (
              <p className="text-warning-700">{t("ENVIRONMENT_CARD.ASK_THE_PROJECT_OWNER_TO")}</p>
            )}
          </div>
        )}
        {/* The card used to carry a name and a raw key and nothing else, while Project
            Settings had the domains, the created date and a masked key all along. Same
            facts, one presentation — including the masking, which only one of the two
            was applying to the same secret. */}
        <dl className="mt-3 flex flex-col gap-1.5 text-xs">
          {primaryDomain && (
            <div className="flex items-center gap-2">
              <dt className="w-[86px] shrink-0 text-muted-foreground">
                {t("ENVIRONMENT_CARD.DOMAIN")}
              </dt>
              <dd className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{primaryDomain}</span>
                {extraDomains > 0 && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    +{extraDomains}
                  </Badge>
                )}
              </dd>
            </div>
          )}
          <div className="flex items-center gap-2">
            <dt className="w-[86px] shrink-0 text-muted-foreground">
              {t("ENVIRONMENT_CARD.X_BLOCKS_KEY")}
            </dt>
            <dd
              className="flex min-w-0 items-center gap-1 font-mono text-muted-foreground"
              onClick={(event) => event.stopPropagation()}
            >
              <CopyToClipboardButton textToCopy={project.tenantId}>
                <MaskedText text={project.tenantId} showFirstN={3} showLastN={3} length={20} />
              </CopyToClipboardButton>
            </dd>
          </div>
          {project.createdDate && (
            <div className="flex items-center gap-2">
              <dt className="w-[86px] shrink-0 text-muted-foreground">
                {t("ENVIRONMENT_CARD.CREATED")}
              </dt>
              <dd className="truncate text-muted-foreground">
                {formatDate(new Date(project.createdDate))}
              </dd>
            </div>
          )}
        </dl>
      </Card>
      {isMigrationOngoing && (
        <ConfirmationModal
          onCancel={() => setIsConfirmationOpen(false)}
          onConfirm={handleConfirm}
          data={{
            dialogTitle: t("ENVIRONMENT_CARD.ENVIRONMENT_MIGRATION_IN_PROGRESS"),
            dialogSubtitle: t("ENVIRONMENT_CARD.THIS_ENVIRONMENT_IS_CURRENTLY"),
            confirmButton: t("ENVIRONMENT_CARD.CONTINUE_ANYWAY"),
            cancelButton: t("common:CANCEL"),
          }}
        />
      )}
    </Dialog>
  );
};
