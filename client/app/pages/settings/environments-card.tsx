import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { MaskedText } from "@/components/masked-text";
import { environmentOptions } from "@/constants/environment-options";
import { formatDate } from "@/lib/utils";
import { IProject } from "@/models/project.model";
import { useGetEnvRepositories } from "@/hooks/use-project";

const DEFAULT_LAST_DEPLOYMENT = "0001-01-01T00:00:00";

// Environments are listed in the same order the "Select environments" step
// offers them (dev → test → stg → … → prod); anything unrecognized sinks to
// the bottom of the list.
export const getEnvironmentOrder = (environment: string): number =>
  environmentOptions.find((option) => option.value === environment)?.index ??
  Number.MAX_SAFE_INTEGER;

const getEnvironmentLabel = (environment: string): string =>
  environmentOptions.find((option) => option.value === environment)?.label || environment || "-";

const isDeployed = (lastDeploymentDate?: string) =>
  !!lastDeploymentDate && lastDeploymentDate !== DEFAULT_LAST_DEPLOYMENT;

const EnvironmentBadge = ({ environment }: { environment: string }) => (
  <Badge
    variant="secondary"
    className={
      environment === "prod"
        ? "w-fit bg-primary/10 text-xs text-primary hover:bg-primary/10"
        : "w-fit text-xs"
    }
  >
    {getEnvironmentLabel(environment)}
  </Badge>
);

const EnvironmentDomain = ({
  project,
  hasDeployment,
}: {
  project: IProject;
  hasDeployment: boolean;
}) => {
  const [primary, ...rest] = project.applications ?? [];
  if (!primary) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex items-center gap-2">
      {hasDeployment ? (
        <a
          href={primary.domain}
          target="_blank"
          rel="noreferrer"
          className="flex max-w-[220px] items-center gap-1 truncate text-primary hover:underline"
        >
          <span className="truncate">{primary.domain.replace(/^https?:\/\//, "")}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        <span
          className="flex max-w-[220px] items-center gap-2 truncate text-muted-foreground"
          title="No repository has been deployed for this environment yet."
        >
          <span className="truncate">{primary.domain.replace(/^https?:\/\//, "")}</span>
          <Badge variant="outline" className="w-fit shrink-0 text-[10px]">
            Not deployed
          </Badge>
        </span>
      )}
      {rest.length > 0 && (
        <Badge variant="secondary" className="w-fit text-xs">
          +{rest.length}
        </Badge>
      )}
    </div>
  );
};

const COLUMN_COUNT = 4;

const EnvironmentsTableLoading = () => (
  <>
    {Array.from({ length: 3 }).map((_, rowIndex) => (
      <TableRow key={rowIndex}>
        {Array.from({ length: COLUMN_COUNT }).map((_, cellIndex) => (
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
};

export const EnvironmentsCard = ({ environments, isLoading = false }: EnvironmentsCardProps) => {
  const firstTenantId = environments[0]?.tenantId || "";
  const {
    data: envRepositories,
    isLoading: isLoadingRepos,
    isFetching: isFetchingRepos,
  } = useGetEnvRepositories(firstTenantId);

  const isRepoDataLoading = isLoadingRepos || isFetchingRepos;
  const hasAnyDeployment = !!envRepositories?.data?.some((repo) =>
    isDeployed(repo.lastDeploymentDate),
  );

  const showRowLoading = isLoading || (isRepoDataLoading && !envRepositories?.data);

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {showRowLoading ? (
              <EnvironmentsTableLoading />
            ) : environments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
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
                    <EnvironmentDomain project={environment} hasDeployment={hasAnyDeployment} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-medium-emphasis">
                    {environment.createdDate ? formatDate(new Date(environment.createdDate)) : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
