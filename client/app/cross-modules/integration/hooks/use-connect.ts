import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStartImpersonation } from "@seliseblocks/genesis-os/hooks";
import { showErrorToast } from "@/hooks/use-toast";
import {
  IConnectRequestView,
  integrationConnectService,
} from "@/cross-modules/integration/services/integration-connect.service";

export const integrationConnectQueryKeys = {
  request: (requestId: string) => ["integration-connect", "request", requestId] as const,
};

/** Reads the connect request; the first call also claims it for this user (server-side). */
export const useConnectRequest = (requestId: string | null) =>
  useQuery({
    queryKey: integrationConnectQueryKeys.request(requestId ?? ""),
    queryFn: () => integrationConnectService.getRequest(requestId!),
    enabled: !!requestId,
    retry: false,
    staleTime: 0,
  });

export const useCancelConnectRequest = () =>
  useMutation({
    mutationFn: (requestId: string) => integrationConnectService.cancel(requestId),
  });

export const useApproveConnectRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, templateKey }: { requestId: string; templateKey: string }) =>
      integrationConnectService.approve(requestId, templateKey),
    onSuccess: () => {
      // A connection was created in the environment; drop cached connection lists.
      queryClient.invalidateQueries({ queryKey: ["integration"] });
    },
    onError: (error) => {
      showErrorToast({ title: "Could not approve", errors: error instanceof Error ? error.message : error });
    },
  });
};

/** Milliseconds between readiness polls after choosing an environment. */
const READINESS_INTERVAL_MS = 3_000;
/** Give freshly provisioned environments two minutes before offering a manual retry. */
const READINESS_TIMEOUT_MS = 120_000;

export type ReadinessState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "waiting"; sinceMs: number }
  | { phase: "ready" }
  | { phase: "timeout" }
  | { phase: "permissionDenied" };

/**
 * Impersonates the chosen environment and polls CheckReadiness every 3 seconds for up to
 * 2 minutes (P3-15). A brand-new project's permissions are copied asynchronously, so the
 * first checks legitimately fail; only a timeout should stop the wait.
 */
export const useReadinessWait = (templateKey: string | null, environmentTenantId: string | null) => {
  const { mutateAsync: startImpersonation } = useStartImpersonation();
  const [state, setState] = useState<ReadinessState>({ phase: "idle" });
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setState({ phase: "idle" });
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const check = useCallback(async () => {
    if (!templateKey || !environmentTenantId) return;
    setState({ phase: "checking" });
    try {
      await startImpersonation({ targeted_tenant_id: environmentTenantId });
    } catch {
      // Impersonation itself can fail while provisioning finishes; treat like not-ready.
    }
    try {
      const result = await integrationConnectService.checkReadiness(templateKey);
      if (result.error === "permission_denied") {
        setState({ phase: "permissionDenied" });
        return;
      }
      if (result.ready) {
        setState({ phase: "ready" });
        return;
      }
    } catch (error) {
      if (String(error).includes("permission_denied")) {
        setState({ phase: "permissionDenied" });
        return;
      }
      // Network/permission failures read as "not ready yet" during the wait window.
    }
    const waited = Date.now() - startedAt.current;
    if (waited >= READINESS_TIMEOUT_MS) {
      setState({ phase: "timeout" });
      return;
    }
    setState({ phase: "waiting", sinceMs: waited });
    timer.current = setTimeout(() => {
      setAttempt((a) => a + 1);
    }, READINESS_INTERVAL_MS);
  }, [startImpersonation, templateKey, environmentTenantId]);

  // (attempt changes re-run check below via the page calling check; kept explicit for retries)
  useEffect(() => {
    if (attempt > 0) void check();
  }, [attempt, check]);

  const begin = useCallback(async () => {
    startedAt.current = Date.now();
    setAttempt(0);
    await check();
  }, [check]);

  const retry = useCallback(async () => {
    startedAt.current = Date.now();
    await check();
  }, [check]);

  return { state, begin, retry, reset };
};
