import { Card, CardContent } from "@/components/ui-kits/card/card";
import { isErrorWithErrors } from "@/lib/error";
import { isHttpErrorStatus } from "@/lib/http/http-error.util";
import { useGetSignupLinkConfigurations } from "@blocks-idp/iam/hooks/use-signup-link-configurations";
import { useSignupLinkSummary } from "@blocks-idp/iam/hooks/use-signup-link-summary";
import { tStatic, useProjectStore } from "@seliseblocks/genesis-os";
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
import { ActivitySummaryTiles, ActivitySummaryTilesSkeleton } from "./activity-summary-tiles";

const I18N_MODULE = "os.idp.signup-links";

const rangeCaption = (range: string, fromUtc?: string, toUtc?: string) => {
  if (range === "7d") return tStatic(I18N_MODULE, "ACTIVITY.RANGE_7D");
  if (range === "30d") return tStatic(I18N_MODULE, "ACTIVITY.RANGE_30D");
  if (range === "90d") return tStatic(I18N_MODULE, "ACTIVITY.RANGE_90D");
  if (fromUtc && toUtc) {
    try {
      const from = new Date(fromUtc).toISOString().slice(0, 10);
      const to = new Date(toUtc).toISOString().slice(0, 10);
      return `${from} → ${to}`;
    } catch {
      return tStatic(I18N_MODULE, "ACTIVITY.RANGE_CUSTOM");
    }
  }
  return tStatic(I18N_MODULE, "ACTIVITY.RANGE_CUSTOM");
};

type SummaryBodyInput = {
  isHardError: boolean;
  summaryLoading: boolean;
  summary: ReturnType<typeof useSignupLinkSummary>["data"];
  isBadRequest: boolean;
  range: Parameters<typeof rangeCaption>[0];
  onRetry: () => void;
};

// What the card shows once a configuration is selected.
const summaryBody = ({
  isHardError,
  summaryLoading,
  summary,
  isBadRequest,
  range,
  onRetry,
}: SummaryBodyInput): ReactNode => {
  if (isHardError) return <ActivityErrorState onRetry={onRetry} />;
  if (summaryLoading) return <ActivitySummaryTilesSkeleton />;
  if (summary?.configurationName === null && !isBadRequest) return <ActivityUnknownState />;
  if (summary?.totalGenerated === 0 && !isBadRequest) return <ActivityEmptyState />;
  if (!summary) return <ActivitySummaryTilesSkeleton />;
  return (
    <ActivitySummaryTiles
      summary={summary}
      rangeLabel={rangeCaption(range, summary.fromUtc, summary.toUtc)}
      dimmed={isBadRequest}
    />
  );
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
    (summaryQuery.isLoading || (summaryQuery.isFetching && !summaryQuery.isFetched && !summary));

  const showSelector =
    !isForbidden && !configsLoading && (hasConfigurations || configurationSelected);

  let body: ReactNode;

  if (isForbidden) {
    body = <ActivityForbiddenState />;
  } else if (configsLoading) {
    body = <ActivitySummaryTilesSkeleton />;
  } else if (!hasConfigurations && !configurationSelected) {
    body = <ActivityNoneState />;
  } else if (configurationSelected) {
    body = summaryBody({
      isHardError,
      summaryLoading,
      summary,
      isBadRequest,
      range: queryParams.range,
      onRetry: () => {
        void summaryQuery.refetch();
      },
    });
  } else {
    body = <ActivityChooseState />;
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
