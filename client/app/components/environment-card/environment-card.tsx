import { useNavigate } from "react-router";
import { useState, type MouseEvent } from "react";
import { ChevronRight, Hourglass, Wrench, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { IProject } from "@/models/project.model";
import { useGetProjectStatus, useRestoreProject } from "@/hooks/use-project";
import { useProjectPermissions } from "@/hooks/use-project-access";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useStartImpersonation } from "@seliseblocks/genesis-os/hooks";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { isErrorWithErrors, showErrorToast, showSuccessToast } from "@seliseblocks/genesis-os/utils";
import { environmentOptions } from "@/constants/environment-options";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { MaskedText } from "@/components/masked-text";
import { Badge } from "@/components/ui-kits/badge/badge";
import { formatDate } from "@/lib/utils";
type EnvironmentCardProps = {
  project: IProject;
  isMigrationOngoing?: boolean;
  className?: string;
};
export const EnvironmentCard = ({
  project,
  isMigrationOngoing,
  className,
}: EnvironmentCardProps) => {
  const navigate = useNavigate();
  const { setSelectedProject } = useProjectStore();
  const { mutateAsync: startImpersonation } = useStartImpersonation();
  const { data: isSetupComplete } = useGetProjectStatus(project.itemId);
  const { mutateAsync: restoreProject, isPending: isRestoring } = useRestoreProject();
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  // Repair posts Project/Restore, which re-runs the whole provisioning routine and is
  // [ProjectPolicy(OwnerOnly = true)] — absent from the grant catalog on purpose. A
  // contributor still sees the "setup pending" warning; they just cannot act on it.
  const { isOwner } = useProjectPermissions(project.tenantGroupId);
  const canRepair = isOwner;

  const setupPending = isSetupComplete === false;

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
    if (setupPending) {
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
          title: "Environment repair",
          description: "Setup has been re-triggered for this environment.",
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
        className={`group flex min-h-[70px] cursor-pointer flex-col justify-between rounded-sm p-4 shadow-none transition-shadow duration-200 hover:shadow-md ${className}`}
      >
        <CardHeader className="flex flex-row justify-between !p-0">
          <CardTitle className="line-clamp-1 break-all text-lg leading-tight">
            <div className="flex w-fit flex-row items-center gap-1">
              <div className="text-base text-medium-emphasis">
                {environmentOptions.find((option) => option.value === project?.environment)?.label}
              </div>
              {isMigrationOngoing && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Hourglass className="h-4 w-4 cursor-pointer text-icon-warning" />
                    </TooltipTrigger>
                    <TooltipContent className="border-none bg-neutral-500 text-white shadow-none">
                      Migration in progress
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </CardTitle>
          <div className="flex items-center gap-1">
            {setupPending && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-warning-100 text-warning-700"
                      aria-label="Setup pending"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="border-none bg-neutral-500 text-white shadow-none">
                    Setup pending — click restore to re-run seeding.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {setupPending && canRepair && (
              <Dialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    disabled={isRestoring}
                    className="inline-flex h-6 items-center gap-1 rounded-full bg-secondary px-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-70"
                    aria-label="Repair environment"
                  >
                    {isRestoring ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wrench className="h-3 w-3" />
                    )}
                    <span>{isRestoring ? "Repairing…" : "Repair"}</span>
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
                    dialogTitle: "Repair this environment?",
                    dialogSubtitle: (
                      <>
                        <p>Setup hasn&apos;t completed for this environment.</p>
                        <p>This will re-run the setup for this environment.</p>
                      </>
                    ),
                    confirmButton: "Repair",
                  }}
                  buttonState={{ confirm: { disable: isRestoring } }}
                />
              </Dialog>
            )}
            {!setupPending && (
              <ChevronRight className="h-4 w-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            )}
          </div>
        </CardHeader>
        {/* The card used to carry a name and a raw key and nothing else, while Project
            Settings had the domains, the created date and a masked key all along. Same
            facts, one presentation — including the masking, which only one of the two
            was applying to the same secret. */}
        <dl className="mt-3 flex flex-col gap-1.5 text-xs">
          {primaryDomain && (
            <div className="flex items-center gap-2">
              <dt className="w-[86px] shrink-0 text-muted-foreground">Domain</dt>
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
            <dt className="w-[86px] shrink-0 text-muted-foreground">X-Blocks-Key</dt>
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
              <dt className="w-[86px] shrink-0 text-muted-foreground">Created</dt>
              <dd className="truncate text-muted-foreground">{formatDate(new Date(project.createdDate))}</dd>
            </div>
          )}
        </dl>
      </Card>
      {isMigrationOngoing && (
        <ConfirmationModal
          onCancel={() => setIsConfirmationOpen(false)}
          onConfirm={handleConfirm}
          data={{
            dialogTitle: "Environment Migration in Progress",
            dialogSubtitle:
              "This environment is currently migrating. Any changes now may cause incomplete data or service interruptions. Proceed only if necessary.",
            confirmButton: "Continue Anyway",
            cancelButton: "Cancel",
          }}
        />
      )}
    </Dialog>
  );
};
