import { TracesOverview } from "@/cross-modules/lmt/components/traces-overview/traces-overview";
import { Card, CardContent, useProjectStore } from "@seliseblocks/genesis-os";

// tracing-route.tsx
export function TracingRoute() {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  return tenantId ? (
    <TracesOverview projectKey={tenantId} />
  ) : (
    <Card>
      <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Select a project to load tracing data.
      </CardContent>
    </Card>
  );
}
