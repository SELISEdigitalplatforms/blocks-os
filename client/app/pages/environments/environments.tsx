import { AddEnvironmentModal } from "@/components/environment-card/add-environment-modal";
import { EnvironmentCard } from "@/components/environment-card/environment-card";
import { EnvironmentMigrationWizard } from "@/components/environment-migration/environment-migration-wizard";
import { ProjectCardLoading } from "@/components/project-card/loading";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { useNotificationListener } from "@/cross-modules/communication/hooks/use-notification-listener";
import { useGetMigrationStatus, useGetProjects } from "@/hooks/use-project";
import { useProjectPermissions } from "@/hooks/use-project-access";
import type { IMigrationStatusResponse } from "@blocks-identifier/models/project.model";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { ArrowRightLeft, CircleHelp, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { Navigate, useNavigate } from "react-router";

const isRecentMigrationForTarget = (
  data: IMigrationStatusResponse[number],
  tenantId: string,
): boolean => {
  if (data.targetedProjectKey !== tenantId || !data.createdDate) {
    return false;
  }
  const createdDate = new Date(data.createdDate);
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  return createdDate > tenMinutesAgo;
};

const ProjectGroupLoading = () => (
  <main className="flex flex-1 flex-col gap-4 p-4 sm:mx-10 md:gap-6">
    <div className="mt-4">
      <div className="mb-8 flex flex-row items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array(8)
          .fill(1)
          .map((_, index) => (
            <ProjectCardLoading key={index} />
          ))}
      </div>
    </div>
  </main>
);
export const EnvironmentsPage = () => {
  const groupId = useProjectStore().selectedTenantGroup;
  const {
    data: environmentList,
    isLoading,
    isFetching,
  } = useGetProjects({ tenantGroupId: groupId ?? "", enabled: !!groupId });
  // Reads standing from the project-access endpoint rather than People/Gets. That call was
  // only ever made for its isOwner flag, and it now needs the `people::view` grant — so a
  // contributor granted only environments would have been 403'd on a page that has nothing to
  // do with People.
  const { isOwner, can } = useProjectPermissions(groupId ?? undefined);
  const [addEnvModalOpen, setAddEnvModalOpen] = useState(false);
  const navigate = useNavigate();
  const { data: migrationStatus, refetch: refetchMigrationStatus } = useGetMigrationStatus(
    groupId as string,
  );
  const handleMigrationNotification = useCallback(
    (_: unknown) => {
      void refetchMigrationStatus();
    },
    [refetchMigrationStatus],
  );
  useNotificationListener("EnvironmentDataMigration", handleMigrationNotification);
  const handleAddEnvModalClose = () => {
    setAddEnvModalOpen(false);
  };
  if (isLoading || isFetching || !environmentList || !environmentList[0]?.projects[0]) {
    return <ProjectGroupLoading />;
  }
  // Creating an environment is owner-only and deliberately absent from the grant catalog:
  // provisioning one writes an owner row, so a contributor able to do it could widen their own
  // standing. Migration is delegable, so it is a grant like any other.
  const canAddEnvironment =
    environmentList && environmentList[0]?.projects?.length < 8 && isOwner;
  const canMigrate = can("environments", "migrate");
  return (
    <main className="flex flex-1 flex-col gap-4 p-6 md:gap-6">
      <div>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h4 className="text-lg font-semibold md:text-xl">Environments</h4>
            {/* The eight-environment cap is already enforced by hiding New Environment;
                saying so up front beats the button quietly disappearing. */}
            <p className="mt-0.5 text-sm text-medium-emphasis">
              {environmentList[0]?.projects?.length ?? 0} of 8 environments used
            </p>
          </div>
          <div className="flex gap-2 sm:gap-4">
            {canMigrate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/app/data-migration")}
                className="h-10 whitespace-nowrap text-sm">
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Start Migration</span>
              </Button>
            )}
            {canAddEnvironment && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setAddEnvModalOpen(true)}
                className="h-10 whitespace-nowrap text-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New Environment</span>
              </Button>
            )}
          </div>
        </div>
        {environmentList[0]?.isShared && (
          <div className="mb-4 mt-6 border-b-2 border-border pb-2">
            <h5 className="text-sm font-medium text-muted-foreground">Shared with you</h5>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {environmentList[0]?.projects?.map((project) => (
            <EnvironmentCard
              key={`shared-${project.itemId}`}
              project={project}
              isMigrationOngoing={
                Array.isArray(migrationStatus) &&
                migrationStatus.some((data) => isRecentMigrationForTarget(data, project.tenantId))
              }
            />
          ))}
        </div>
        {environmentList[0]?.isShared && environmentList[0]?.nonSharedProject?.length > 0 && (
          <>
            <div className="mb-4 mt-8 border-b-2 border-border pb-2">
              <h5 className="text-sm font-medium text-muted-foreground">Others</h5>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {environmentList[0]?.nonSharedProject?.map((project) => (
                <div key={`others-${project.itemId}`} className="pointer-events-none grayscale">
                  <EnvironmentCard
                    key={`others-${project.itemId}`}
                    project={project}
                    isMigrationOngoing={
                      Array.isArray(migrationStatus) &&
                      migrationStatus.some((data) =>
                        isRecentMigrationForTarget(data, project.tenantId),
                      )
                    }
                    className="bg-muted"
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <Dialog open={addEnvModalOpen} onOpenChange={setAddEnvModalOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg border p-6 shadow-lg md:max-h-[85vh] md:w-[500px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg md:text-xl">Add Environment</DialogTitle>
            <DialogDescription className="flex flex-col gap-2 text-sm md:flex-row md:items-start md:gap-2">
              <span className="flex flex-row items-start gap-2">
                <span>Please add the environments you want to configure.</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger type="button" asChild>
                      <CircleHelp className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs font-normal md:max-w-96 md:text-sm">
                      You must have the corresponding branch in your repository.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(90vh-160px)] overflow-y-auto md:max-h-[calc(85vh-160px)]">
            <AddEnvironmentModal
              tenantGroupId={groupId ?? undefined}
              projectName={environmentList && environmentList[0]?.projects[0]?.name}
              preSelectedEnvironments={environmentList
                .map((env) => env.projects.map((p) => p.environment))
                .flat()}
              onClose={handleAddEnvModalClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export const EnvironmentMigrationPage = () => {
  // The wizard lives at /app/data-migration, outside the project routes, so the gated
  // "Start Migration" button is not the only way in — a bookmark or a typed URL reaches it
  // directly. The server refuses at Migrate and Verify either way; this stops someone
  // filling in the whole wizard first only to be turned away at the end.
  const groupId = useProjectStore().selectedTenantGroup;
  const { isLoading, can } = useProjectPermissions(groupId ?? undefined);

  if (isLoading) return <ProjectGroupLoading />;
  if (!can("environments", "migrate")) return <Navigate to="/app/console" replace />;

  return <EnvironmentMigrationWizard />;
};
