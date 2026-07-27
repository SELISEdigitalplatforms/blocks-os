import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { BulkActionBar } from "@blocks-idp/api-settings/components/bulk-action-bar";
import { ServiceGroupCard } from "@blocks-idp/api-settings/components/service-group-card";
import {
  useBulkUpdateApiEndpoints,
  useGetApiEndpointsInfinite,
  useUpdateApiEndpoint,
} from "@blocks-idp/api-settings/hooks/use-api-settings";
import { IApiEndpoint } from "@blocks-idp/api-settings/models/api-endpoint.model";
import { getServiceSwaggerUrl } from "@blocks-idp/api-settings/utils/service-swagger";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { BookOpen, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
/** ─── Loading skeleton ──────────────────────────────────────────────────────── */
const ServiceGroupSkeleton = () => (
  <div className="rounded-lg border border-border bg-card p-4">
    <div className="flex items-center gap-3">
      <Skeleton className="h-5 w-5 rounded" />
      <Skeleton className="h-6 w-6 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-6 w-24 rounded" />
      <Skeleton className="h-8 w-28 rounded" />
    </div>
  </div>
);
/** ─── Page component ────────────────────────────────────────────────────────── */
export default function ApiSettingsPage() {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useGetApiEndpointsInfinite({ projectKey: tenantId });
  const { mutateAsync: updateEndpoint } = useUpdateApiEndpoint();
  const { mutateAsync: bulkUpdate } = useBulkUpdateApiEndpoints();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const endpoints = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  // Group endpoints: service → controller (nested)
  const serviceGroups = useMemo(() => {
    const byService: Record<string, Record<string, IApiEndpoint[]>> = {};
    for (const ep of endpoints) {
      const svc = ep.service || "unknown";
      const ctrl = ep.controller || svc;
      ((byService[svc] ??= {})[ctrl] ??= []).push(ep);
    }
    return Object.entries(byService)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([svc, controllers]) => {
        const firstEp = Object.values(controllers)[0]?.[0];
        return {
          service: svc,
          swaggerUrl: getServiceSwaggerUrl(svc, firstEp?.baseUrl),
          controllers: Object.entries(controllers)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([ctrl, eps]) => [
              ctrl,
              eps.sort((a, b) => {
                // Sort by method first (GET, POST, PUT, etc.), then by controller
                const methodOrder: Record<string, number> = {
                  GET: 0,
                  POST: 1,
                  PUT: 2,
                  PATCH: 3,
                  DELETE: 4,
                };
                const aMethodKey = a.method?.toUpperCase?.() || "";
                const bMethodKey = b.method?.toUpperCase?.() || "";
                const aMethod = methodOrder[aMethodKey] ?? 999;
                const bMethod = methodOrder[bMethodKey] ?? 999;
                if (aMethod !== bMethod) return aMethod - bMethod;
                // Sort by controller for stable sorting
                const aPath = a.controller || a.method || "";
                const bPath = b.controller || b.method || "";
                return aPath.localeCompare(bPath);
              }),
            ]) as [string, IApiEndpoint[]][],
        };
      });
  }, [endpoints]);
  // ── Selection handlers ──────────────────────────────────────────────────────
  const handleSelectEndpoint = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);
  const handleSelectGroup = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  // ── Toggle handlers ────────────────────────────────────────────────────────
  const handleToggleMfa = useCallback(
    async (ep: IApiEndpoint, value: boolean) => {
      try {
        const result = await updateEndpoint({
          itemId: ep.itemId,
          service: ep.service,
          method: ep.method,
          controller: ep.controller,
          description: ep.description,
          isMFARequired: value,
          mfaType: ep.mfaType,
          isCaptchaRequired: ep.isCaptchaRequired,
          captchaProvider: ep.captchaProvider,
        });
        if (!result.isSuccess) {
          throw new Error(result.errors?.join(", ") || "Failed to update MFA setting");
        }
        showSuccessToast({
          description: `MFA ${value ? "enabled" : "disabled"} for /${ep.controller}/${ep.method.charAt(0).toUpperCase() + ep.method.slice(1)}`,
        });
      } catch (error) {
        showErrorToast({
          errors: error instanceof Error ? error.message : "Failed to update MFA setting",
        });
      }
    },
    [updateEndpoint],
  );
  const handleToggleCaptcha = useCallback(
    async (ep: IApiEndpoint, value: boolean) => {
      try {
        const result = await updateEndpoint({
          itemId: ep.itemId,
          service: ep.service,
          method: ep.method,
          controller: ep.controller,
          description: ep.description,
          isCaptchaRequired: value,
          captchaProvider: ep.captchaProvider,
          isMFARequired: ep.isMFARequired,
          mfaType: ep.mfaType,
        });
        if (!result.isSuccess) {
          throw new Error(result.errors?.join(", ") || "Failed to update Captcha setting");
        }
        showSuccessToast({
          description: `Captcha ${value ? "enabled" : "disabled"} for /${ep.controller}/${ep.method.charAt(0).toUpperCase() + ep.method.slice(1)}`,
        });
      } catch (error) {
        showErrorToast({
          errors: error instanceof Error ? error.message : "Failed to update Captcha setting",
        });
      }
    },
    [updateEndpoint],
  );
  // ── Bulk handlers (group presets) ─────────────────────────────────────────
  const handleBulkGroupMfa = useCallback(
    async (ids: string[], value: boolean) => {
      try {
        // Preserve current Captcha state when toggling MFA
        const groupEndpoints = endpoints.filter((ep) => ids.includes(ep.itemId));
        const captchaState =
          groupEndpoints.length > 0
            ? groupEndpoints.every((ep) => ep.isCaptchaRequired)
              ? true
              : groupEndpoints.some((ep) => ep.isCaptchaRequired)
                ? false // default to false if mixed states
                : false
            : false;
        const result = await bulkUpdate({
          itemIds: ids,
          isMFARequired: value,
          isCaptchaRequired: captchaState,
          disableAll: false,
        });
        if (!result.isSuccess) {
          throw new Error(result.errors?.join(", ") || "Failed to bulk update MFA");
        }
        showSuccessToast({
          description: `MFA ${value ? "enabled" : "disabled"} for ${ids.length} endpoints`,
        });
      } catch (error) {
        showErrorToast({
          errors: error instanceof Error ? error.message : "Failed to bulk update MFA",
        });
      }
    },
    [endpoints, bulkUpdate],
  );
  const handleBulkGroupCaptcha = useCallback(
    async (ids: string[], value: boolean) => {
      try {
        // Preserve current MFA state when toggling Captcha
        const groupEndpoints = endpoints.filter((ep) => ids.includes(ep.itemId));
        const mfaState =
          groupEndpoints.length > 0
            ? groupEndpoints.every((ep) => ep.isMFARequired)
              ? true
              : groupEndpoints.some((ep) => ep.isMFARequired)
                ? false // default to false if mixed states
                : false
            : false;
        const result = await bulkUpdate({
          itemIds: ids,
          isCaptchaRequired: value,
          isMFARequired: mfaState,
          disableAll: false,
        });
        if (!result.isSuccess) {
          throw new Error(result.errors?.join(", ") || "Failed to bulk update Captcha");
        }
        showSuccessToast({
          description: `Captcha ${value ? "enabled" : "disabled"} for ${ids.length} endpoints`,
        });
      } catch (error) {
        showErrorToast({
          errors: error instanceof Error ? error.message : "Failed to bulk update Captcha",
        });
      }
    },
    [endpoints, bulkUpdate],
  );

  // ── Bulk bar actions ───────────────────────────────────────────────────────
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const handleBulkMfa = useCallback(async () => {
    try {
      // Preserve current Captcha state when enabling MFA
      const selectedEndpoints = endpoints.filter((ep) => selectedArray.includes(ep.itemId));
      const captchaState =
        selectedEndpoints.length > 0
          ? selectedEndpoints.every((ep) => ep.isCaptchaRequired)
            ? true
            : selectedEndpoints.some((ep) => ep.isCaptchaRequired)
              ? false // default to false if mixed states
              : false
          : false;
      const result = await bulkUpdate({
        itemIds: selectedArray,
        isMFARequired: true,
        isCaptchaRequired: captchaState,
        disableAll: false,
      });
      if (!result.isSuccess) {
        throw new Error(result.errors?.join(", ") || "Failed to enable MFA");
      }
      showSuccessToast({
        description: `MFA enabled for ${selectedArray.length} endpoints`,
      });
      clearSelection();
    } catch (error) {
      showErrorToast({
        errors: error instanceof Error ? error.message : "Failed to enable MFA",
      });
    }
  }, [endpoints, selectedArray, bulkUpdate, clearSelection]);
  const handleBulkCaptcha = useCallback(async () => {
    try {
      // Preserve current MFA state when enabling Captcha
      const selectedEndpoints = endpoints.filter((ep) => selectedArray.includes(ep.itemId));
      const mfaState =
        selectedEndpoints.length > 0
          ? selectedEndpoints.every((ep) => ep.isMFARequired)
            ? true
            : selectedEndpoints.some((ep) => ep.isMFARequired)
              ? false // default to false if mixed states
              : false
          : false;
      const result = await bulkUpdate({
        itemIds: selectedArray,
        isCaptchaRequired: true,
        isMFARequired: mfaState,
        disableAll: false,
      });
      if (!result.isSuccess) {
        throw new Error(result.errors?.join(", ") || "Failed to enable Captcha");
      }
      showSuccessToast({
        description: `Captcha enabled for ${selectedArray.length} endpoints`,
      });
      clearSelection();
    } catch (error) {
      showErrorToast({
        errors: error instanceof Error ? error.message : "Failed to enable Captcha",
      });
    }
  }, [endpoints, selectedArray, bulkUpdate, clearSelection]);
  return (
    <main className="flex flex-col gap-4 p-4 pb-24 sm:gap-6 sm:p-6">
      <div>
        <h1 className="text-lg font-semibold sm:text-xl md:text-2xl">API Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure security policies for your API endpoints — enable MFA, Captcha, and manage
          access controls.
        </p>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <ServiceGroupSkeleton key={i} />
          ))}
        </div>
      ) : serviceGroups.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-card text-muted-foreground">
          No API endpoints configured.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {serviceGroups.map(({ service, swaggerUrl, controllers }) => (
            <div key={service} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold capitalize sm:text-lg">{service}</h2>
                  {swaggerUrl && (
                    <a
                      href={swaggerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hidden items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary hover:underline sm:inline-flex"
                      title={swaggerUrl}
                    >
                      <span className="truncate">{swaggerUrl}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                </div>
                {swaggerUrl && (
                  <Button size="sm" variant="outline" asChild className="w-fit shrink-0 gap-1.5">
                    <a href={swaggerUrl} target="_blank" rel="noreferrer">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>API Docs</span>
                    </a>
                  </Button>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {controllers.map(([controller, eps]) => (
                  <ServiceGroupCard
                    key={controller}
                    controller={controller}
                    endpoints={eps}
                    selectedIds={selectedIds}
                    onSelectEndpoint={handleSelectEndpoint}
                    onSelectGroup={handleSelectGroup}
                    onToggleMfa={handleToggleMfa}
                    onToggleCaptcha={handleToggleCaptcha}
                    onBulkGroupMfa={handleBulkGroupMfa}
                    onBulkGroupCaptcha={handleBulkGroupCaptcha}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {isFetchingNextPage && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <ServiceGroupSkeleton key={i} />
          ))}
        </div>
      )}
      <div ref={sentinelRef} className="h-1" />
      <BulkActionBar
        selectedCount={selectedIds.size}
        onEnableMfa={handleBulkMfa}
        onEnableCaptcha={handleBulkCaptcha}
        onClear={clearSelection}
      />
    </main>
  );
}
