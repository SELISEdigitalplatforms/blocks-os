import { EnvironmentCard } from "@/components/environment-card/environment-card";
import { EnvironmentMigrationWizard } from "@/components/environment-migration/environment-migration-wizard";
import { ProjectCardLoading } from "@/components/project-card/loading";
import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { useNotificationListener } from "@/cross-modules/communication/hooks/use-notification-listener";
import {
  MIGRATION_ONGOING_WINDOW_MS,
  useGetMigrationStatus,
  useGetProjects,
} from "@/hooks/use-project";
import { useProjectPermissions } from "@/hooks/use-project-access";
import type { IMigrationStatusResponse } from "@blocks-identifier/models/project.model";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { ArrowRightLeft, Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { PlanPanel } from "@blocks-identifier/components/plan/plan-panel";
import { Navigate, useNavigate } from "react-router";

const isRecentMigrationForTarget = (
  data: IMigrationStatusResponse[number],
  tenantId: string,
): boolean => {
  if (data.targetedProjectKey !== tenantId || !data.createdDate) {
    return false;
  }
  const createdDate = new Date(data.createdDate);
  return createdDate.getTime() > Date.now() - MIGRATION_ONGOING_WINDOW_MS;
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
  // Adding an environment is a purchase now: it opens the plan's add pane (prorated, checkout).
  const [adding, setAdding] = useState(false);
  const planRef = useRef<HTMLDivElement>(null);
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
  if (isLoading || isFetching || !environmentList || !environmentList[0]?.projects[0]) {
    return <ProjectGroupLoading />;
  }
  // Creating an environment is owner-only and deliberately absent from the grant catalog:
  // provisioning one writes an owner row, so a contributor able to do it could widen their own
  // standing. Migration is delegable, so it is a grant like any other.
  const canAddEnvironment = isOwner;
  const canMigrate = can("environments", "migrate");
  // Counts the environments this user can open (the same list the wizard offers), so greyed-out
  // "Others" never make a single accessible environment look migratable.
  const accessibleEnvironmentCount = environmentList[0]?.projects?.length ?? 0;
  const canStartMigration = canMigrate && accessibleEnvironmentCount >= 2;
  return (
    <main className="flex flex-1 flex-col gap-4 p-6 md:gap-6">
      <div>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h4 className="text-lg font-semibold md:text-xl">Environments</h4>
            {/* The eight-environment cap is already enforced by hiding New Environment;
                saying so up front beats the button quietly disappearing. */}
            <p className="mt-0.5 text-sm text-medium-emphasis">
              {environmentList[0]?.projects?.length ?? 0}{" "}
              {(environmentList[0]?.projects?.length ?? 0) === 1 ? "environment" : "environments"}
            </p>
          </div>
          <div className="flex gap-2 sm:gap-4">
            {canStartMigration && (
              <Button
                variant="outline"
                size="sm"
                aria-label="Start Migration"
                onClick={() => navigate("/app/data-migration")}
                className="h-10 whitespace-nowrap text-sm"
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Start Migration</span>
              </Button>
            )}
            {canMigrate && !canStartMigration && (
              <TooltipProvider>
                <Tooltip>
                  {/* A disabled button gets no pointer or focus events, so the focusable
                      wrapper is what opens the explanation. */}
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      data-testid="start-migration-disabled-trigger"
                      className="inline-flex"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Start Migration"
                        disabled
                        className="h-10 whitespace-nowrap text-sm"
                      >
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Start Migration</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="border-none bg-neutral-500 text-white shadow-none">
                    Add another environment to start a migration.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {canAddEnvironment && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setAdding(true);
                  planRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                }}
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
      {groupId && (
        <div ref={planRef} className="scroll-mt-4">
          <PlanPanel
            tenantGroupId={groupId}
            isOwner={isOwner}
            existingEnvironments={[
              ...(environmentList[0]?.projects ?? []),
              ...(environmentList[0]?.nonSharedProject ?? []),
            ].map((p) => p.environment)}
            adding={adding}
            onAddingChange={setAdding}
          />
        </div>
      )}
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
