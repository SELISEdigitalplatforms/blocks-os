import { Card, CardContent } from "@/components/ui-kits/card/card";
import { isErrorWithErrors } from "@/lib/error";
import { isHttpErrorStatus } from "@/lib/http/http-error.util";
import { useGetSignupLinkConfigurations } from "@blocks-idp/iam/hooks/use-signup-link-configurations";
import { useSignupLinkSummary } from "@blocks-idp/iam/hooks/use-signup-link-summary";
import { useProjectStore } from "@seliseblocks/genesis-os";
import type { ReactNode } from "react";
import {
  ActivityFilterToolbar,
  buildSummaryPayload,
  resolveFilterFieldErrors,
  useSignupLinkActivityQueryParams,
} from "./activity-filter-toolbar";
import {
  ActivityChooseState,
  ActivityEmptyState,
  ActivityErrorState,
  ActivityForbiddenState,
  ActivityNoneState,
  ActivityUnknownState,
} from "./activity-empty-states";
import {
  ActivitySummaryTiles,
  ActivitySummaryTilesSkeleton,
} from "./activity-summary-tiles";

const rangeCaption = (range: string, fromUtc?: string, toUtc?: string) => {
  if (range === "7d") return "Last 7 days";
  if (range === "30d") return "Last 30 days";
  if (range === "90d") return "Last 90 days";
  if (fromUtc && toUtc) {
    try {
      const from = new Date(fromUtc).toISOString().slice(0, 10);
      const to = new Date(toUtc).toISOString().slice(0, 10);
      return `${from} → ${to}`;
    } catch {
      return "Custom range";
    }
  }
  return "Custom range";
};

export const SignupLinkActivity = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { queryParams } = useSignupLinkActivityQueryParams();
  const configurationsQuery = useGetSignupLinkConfigurations(
    { page: 0, pageSize: 200, includeInactive: true },
    { enabled: !!tenantId },
  );

  const payload = buildSummaryPayload(queryParams);
  const summaryQuery = useSignupLinkSummary(payload);

  const configsLoading =
    !tenantId ||
    configurationsQuery.isLoading ||
    (configurationsQuery.isFetching && !configurationsQuery.isFetched);
  const configurations = configurationsQuery.data?.items ?? [];
  const hasConfigurations = configurations.length > 0;
  const configurationSelected = Boolean(queryParams.configurationId);

  const isForbidden = isHttpErrorStatus(summaryQuery.error, 403);
  const isBadRequest = isHttpErrorStatus(summaryQuery.error, 400);
  const fieldErrors =
    isBadRequest && isErrorWithErrors(summaryQuery.error)
      ? resolveFilterFieldErrors(summaryQuery.error.errors)
      : {};
  const isHardError =
    summaryQuery.isError && !isForbidden && !isBadRequest && configurationSelected;

  const summary = summaryQuery.data;
  const summaryLoading =
    configurationSelected &&
    (summaryQuery.isLoading ||
      (summaryQuery.isFetching && !summaryQuery.isFetched && !summary));

  const showSelector =
    !isForbidden && !configsLoading && (hasConfigurations || configurationSelected);

  let body: ReactNode;

  if (isForbidden) {
    body = <ActivityForbiddenState />;
  } else if (configsLoading) {
    body = <ActivitySummaryTilesSkeleton />;
  } else if (!hasConfigurations && !configurationSelected) {
    body = <ActivityNoneState />;
  } else if (!configurationSelected) {
    body = <ActivityChooseState />;
  } else if (isHardError) {
    body = (
      <ActivityErrorState
        onRetry={() => {
          void summaryQuery.refetch();
        }}
      />
    );
  } else if (summaryLoading) {
    body = <ActivitySummaryTilesSkeleton />;
  } else if (summary && summary.configurationName === null && !isBadRequest) {
    body = <ActivityUnknownState />;
  } else if (summary && summary.totalGenerated === 0 && !isBadRequest) {
    body = <ActivityEmptyState />;
  } else if (summary) {
    body = (
      <ActivitySummaryTiles
        summary={summary}
        rangeLabel={rangeCaption(queryParams.range, summary.fromUtc, summary.toUtc)}
        dimmed={isBadRequest}
      />
    );
  } else {
    body = <ActivitySummaryTilesSkeleton />;
  }

  return (
    <Card>
      <CardContent>
        {showSelector && (
          <div className="mb-4">
            <ActivityFilterToolbar fieldErrors={fieldErrors} />
          </div>
        )}
        {body}
      </CardContent>
    </Card>
  );
};
