import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useImpersonateStore } from "@seliseblocks/genesis-os";
import { projectService as crossProjectService } from "@blocks-identifier/services/project.service";
import { parseSSEBuffer } from "@blocks-ai/shared/utils/parse-sse";
import type {
  DomainSetupStepId,
  DomainSetupStepStatus,
  IDomainSetupProgress,
  IDomainSetupResult,
} from "@/models/domain-setup.model";

/**
 * DNS records and API base URLs for every domain on the current project. Keyed under
 * ["identifier", "project", tenantId] like the project itself, so every invalidation that
 * refreshes the domain list (add, edit, delete, verify) refreshes this too.
 */
export const useDomainSetupGuide = () => {
  const { isInitialized, isImpersonated, impersonatedTenantId, originalTenantId } =
    useImpersonateStore();
  const tenantId = isImpersonated ? impersonatedTenantId : originalTenantId;

  return useQuery({
    queryKey: ["identifier", "project", tenantId, "domain-setup-guide"],
    queryFn: () => crossProjectService.getDomainSetupGuide(),
    enabled: isInitialized && Boolean(tenantId),
  });
};

export type DomainSetupPhase = "idle" | "running" | "succeeded" | "failed";

export interface IDomainSetupStepState {
  status: "pending" | DomainSetupStepStatus;
  message?: string;
}

export type DomainSetupSteps = Record<DomainSetupStepId, IDomainSetupStepState>;

const initialSteps = (): DomainSetupSteps => ({
  app_dns: { status: "pending" },
  api_dns: { status: "pending" },
  ssl: { status: "pending" },
});

const CONNECTION_LOST_MESSAGE =
  "We lost the connection to the server. Setup may still finish on its own, so check the domain's status in a moment.";

const firstErrorMessage = (errors?: Record<string, string> | null) =>
  (errors && Object.values(errors)[0]) || "Domain setup failed. Please try again.";

/**
 * Runs `Domain/ConfigureStream` and follows its progress. The run itself belongs to the
 * server: leaving the page only stops listening, so the project is refetched at the end
 * whatever happened to the connection.
 */
export const useDomainSetupStream = () => {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<DomainSetupPhase>("idle");
  const [steps, setSteps] = useState<DomainSetupSteps>(initialSteps);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const start = useCallback(
    async (domain: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setPhase("running");
      setSteps(initialSteps());
      setError(null);

      let result: IDomainSetupResult | null = null;

      try {
        const stream = await crossProjectService.configureDomainStream(
          { cookieDomain: domain },
          controller.signal,
        );
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, remaining } = parseSSEBuffer(buffer);
          buffer = remaining;

          for (const { eventType, eventData } of events) {
            if (eventType === "step") {
              const progress = eventData as unknown as IDomainSetupProgress;
              setSteps((current) => ({
                ...current,
                [progress.step]: {
                  status: progress.status,
                  message: progress.message ?? undefined,
                },
              }));
            } else if (eventType === "result") {
              result = eventData as unknown as IDomainSetupResult;
            }
          }
        }
      } catch {
        // Handled below: no result means the outcome is unknown to us
      }

      if (controller.signal.aborted) return;

      await queryClient.invalidateQueries({ queryKey: ["identifier", "project"] });

      if (result?.isSuccess) {
        setPhase("succeeded");
        return;
      }

      setError(result ? firstErrorMessage(result.errors) : CONNECTION_LOST_MESSAGE);
      setPhase("failed");
    },
    [queryClient],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setSteps(initialSteps());
    setError(null);
  }, []);

  return { phase, steps, error, start, reset };
};
