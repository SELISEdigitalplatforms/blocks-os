import { TracesOverview } from "@/cross-modules/lmt/components/traces-overview/traces-overview";
import { Card, CardContent, useProjectStore, useT } from "@seliseblocks/genesis-os";

// tracing-route.tsx
export function TracingRoute() {
  const { t } = useT("os.lmt");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  return tenantId ? (
    <TracesOverview projectKey={tenantId} />
  ) : (
    <Card>
      <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        {t("TRACING.SELECT_A_PROJECT_TO_LOAD")}
      </CardContent>
    </Card>
  );
}
