import type { QueryClient } from "@tanstack/react-query";
import type Rollbar from "rollbar";
import { getHttpErrorStatus } from "@/lib/http/http-error.util";

/**
 * Reports request failures that no other layer can see.
 *
 * Deliberately narrow: anything that came back with an HTTP status is skipped. A 4xx is a
 * business outcome the UI already surfaces, and a 5xx has already been reported from the server
 * with a real stack trace -- reporting it again from the browser would only duplicate the better
 * item. What is left is transport failure: the API unreachable, DNS, CORS, a TLS error, or an
 * outright bug thrown inside a query function. None of those ever reach the server.
 *
 * Returns an unsubscribe function.
 */
export const attachQueryErrorReporting = (queryClient: QueryClient, rollbar: Rollbar) => {
  const report = (error: unknown, context: Record<string, unknown>) => {
    if (getHttpErrorStatus(error) !== undefined) return;

    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      source: "react-query",
      ...context,
    });
  };

  const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "error") return;

    report(event.action.error, { kind: "query", queryHash: event.query.queryHash });
  });

  const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "error") return;

    report(event.action.error, {
      kind: "mutation",
      mutationKey: event.mutation.options.mutationKey,
    });
  });

  return () => {
    unsubscribeQueries();
    unsubscribeMutations();
  };
};
