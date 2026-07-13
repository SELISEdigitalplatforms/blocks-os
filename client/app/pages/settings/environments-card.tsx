import { useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { MaskedText } from "@/components/masked-text";
import { environmentOptions } from "@/constants/environment-options";
import { useDisableProject } from "@/hooks/use-project";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { IProject } from "@/models/project.model";

// Environments are listed in the same order the "Select environments" step
// offers them (dev → test → stg → … → prod); anything unrecognised sinks to the
// bottom of the list.
export const getEnvironmentOrder = (environment: string): number =>
  environmentOptions.find((option) => option.value === environment)?.index ??
  Number.MAX_SAFE_INTEGER;

const getEnvironmentLabel = (environment: string): string =>
  environmentOptions.find((option) => option.value === environment)?.label ||
  environment ||
  "-";

const EnvironmentBadge = ({ environment }: { environment: string }) => (
  <Badge
    variant="secondary"
    className={
      environment === "prod"
        ? "w-fit bg-primary/10 text-xs text-primary hover:bg-primary/10"
        : "w-fit text-xs"
    }>
    {getEnvironmentLabel(environment)}
  </Badge>
);

const EnvironmentDomain = ({ project }: { project: IProject }) => {
  const [primary, ...rest] = project.applications ?? [];
  if (!primary) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex items-center gap-2">
      <a
        href={primary.domain}
        target="_blank"
        rel="noreferrer"
        className="flex max-w-[220px] items-center gap-1 truncate text-primary hover:underline">
        <span className="truncate">
          {primary.domain.replace(/^https?:\/\//, "")}
        </span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      </a>
      {rest.length > 0 && (
        <Badge variant="secondary" className="w-fit text-xs">
          +{rest.length}
        </Badge>
      )}
    </div>
  );
};

const EnvironmentsTableLoading = ({ columnCount }: { columnCount: number }) => (
  <>
    {Array.from({ length: 3 }).map((_, rowIndex) => (
      <TableRow key={rowIndex}>
        {Array.from({ length: columnCount }).map((__, cellIndex) => (
          <TableCell key={cellIndex}>
            <Skeleton className="h-6 w-full rounded-sm" />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

type EnvironmentsCardProps = {
  environments: IProject[];
  isLoading?: boolean;
  canDelete?: boolean;
};

export const EnvironmentsCard = ({
  environments,
  isLoading = false,
  canDelete = false,
}: EnvironmentsCardProps) => {
  const navigate = useNavigate();
  const { selectedProject, setSelectedProject, resetSelectedProject } =
    useProjectStore();
  const [deleteTarget, setDeleteTarget] = useState<IProject | null>(null);
  const { mutateAsync: disableProject, isPending } = useDisableProject({
    projectKey: deleteTarget?.tenantId || "",
  });

  const columnCount = canDelete ? 5 : 4;

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await disableProject({ projectKey: deleteTarget.tenantId });
      if (!res.isSuccess) {
        showErrorToast({ errors: res.errors });
        return;
      }
      showSuccessToast({
        title: "Environment deleted",
        description: `${getEnvironmentLabel(deleteTarget.environment)} has been deleted.`,
      });
      const remaining = environments.filter(
        (environment) => environment.itemId !== deleteTarget.itemId,
      );
      // The deleted environment may be the one the rest of the app is scoped to —
      // re-point the store at a surviving environment so no dangling selection is
      // left behind, and fall back to the console once nothing remains.
      if (remaining.length === 0) {
        resetSelectedProject();
        setDeleteTarget(null);
        navigate("/app/console");
        return;
      }
      if (selectedProject?.itemId === deleteTarget.itemId) {
        setSelectedProject(remaining[0]);
      }
      setDeleteTarget(null);
    } catch (error) {
      showErrorToast({ errors: error });
    }
  };

  return (
    <Card>
      <CardHeader className="mb-4 flex flex-col gap-1">
        <CardTitle>Environments</CardTitle>
        <CardDescription>
          Environments provisioned for this project and their public domains
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs md:text-sm">Environment</TableHead>
              <TableHead className="text-xs md:text-sm">X-Blocks-Key</TableHead>
              <TableHead className="text-xs md:text-sm">Domain</TableHead>
              <TableHead className="text-xs md:text-sm">Created On</TableHead>
              {canDelete && (
                <TableHead className="w-20 text-xs md:text-sm">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <EnvironmentsTableLoading columnCount={columnCount} />
            ) : environments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="h-24 text-center text-sm text-muted-foreground">
                  No environments found for this project.
                </TableCell>
              </TableRow>
            ) : (
              environments.map((environment) => (
                <TableRow key={environment.itemId} className="text-xs md:text-sm">
                  <TableCell>
                    <EnvironmentBadge environment={environment.environment} />
                  </TableCell>
                  <TableCell>
                    <div className="flex h-6 items-center gap-2 font-mono text-medium-emphasis">
                      <CopyToClipboardButton textToCopy={environment.tenantId}>
                        <MaskedText
                          text={environment.tenantId}
                          showFirstN={3}
                          showLastN={3}
                          length={20}
                        />
                      </CopyToClipboardButton>
                    </div>
                  </TableCell>
                  <TableCell>
                    <EnvironmentDomain project={environment} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-medium-emphasis">
                    {environment.createdDate
                      ? formatDate(new Date(environment.createdDate))
                      : "-"}
                  </TableCell>
                  {canDelete && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete environment"
                        aria-label={`Delete ${getEnvironmentLabel(environment.environment)} environment`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(environment)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}>
        {deleteTarget && (
          <ConfirmationModal
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleDeleteConfirm}
            data={{
              dialogTitle: "Delete this environment?",
              dialogSubtitle: (
                <>
                  <p>
                    Are you sure you want to delete the{" "}
                    <span className="font-semibold">
                      {getEnvironmentLabel(deleteTarget.environment)}
                    </span>{" "}
                    environment?
                  </p>
                  <p className="mt-2">
                    This will permanently delete the environment and you&apos;ll
                    need to contact support to recover it.
                  </p>
                </>
              ),
              confirmButton: "Delete",
              cancelButton: "Cancel",
            }}
            buttonState={{ confirm: { disable: isPending } }}
          />
        )}
      </Dialog>
    </Card>
  );
};
