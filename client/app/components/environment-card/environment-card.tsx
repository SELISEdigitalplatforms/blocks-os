import { useState } from "react";
import { ChevronRight, Clock, Hourglass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { IProject } from "@/models/project.model";
import { useGetProjectStatus } from "@/hooks/use-project";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useStartImpersonation } from "@seliseblocks/blocks-kit/hooks";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { environmentOptions } from "@/constants/environment-options";
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
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

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
  const handleCardClick = (): void => {
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
          <div className="flex items-center gap-2">
            {isSetupComplete === false && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="warning"
                      className="gap-1 rounded-full border-0 px-2.5 py-0.5 font-medium"
                    >
                      <Clock className="h-3 w-3" />
                      Setup pending
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="border-none bg-neutral-500 text-white shadow-none">
                    Environment seeding hasn&apos;t completed — restore it from the dashboard.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <ChevronRight className="h-4 w-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </div>
        </CardHeader>
        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-1.5 py-0.5 text-xs sm:py-1 md:py-1.5">
            <span className="font-semibold text-muted-foreground">X-Blocks-Key:</span>
            <span className="truncate font-mono text-muted-foreground">{project?.tenantId}</span>
          </div>
        </div>
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
