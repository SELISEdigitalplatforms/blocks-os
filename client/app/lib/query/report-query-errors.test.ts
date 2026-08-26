import { QueryClient } from "@tanstack/react-query";
import type Rollbar from "rollbar";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachQueryErrorReporting } from "./report-query-errors";

const transportFailure = () => Promise.reject(new TypeError("Failed to fetch"));
const httpFailure = (status: number) => () =>
  Promise.reject(Object.assign(new Error("request failed"), { status, errors: {} }));

describe("attachQueryErrorReporting", () => {
  let queryClient: QueryClient;
  let rollbar: Rollbar;

  const runQuery = (queryFn: () => Promise<unknown>) =>
    queryClient.fetchQuery({ queryKey: ["subject"], queryFn }).catch(() => undefined);

  const runMutation = (mutationFn: () => Promise<unknown>) =>
    queryClient
      .getMutationCache()
      .build(queryClient, { mutationKey: ["subject"], mutationFn })
      .execute(undefined)
      .catch(() => undefined);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    rollbar = { error: vi.fn() } as unknown as Rollbar;
  });

  it("reports a query that failed before it reached the server", async () => {
    attachQueryErrorReporting(queryClient, rollbar);

    await runQuery(transportFailure);

    expect(rollbar.error).toHaveBeenCalledTimes(1);
    expect(rollbar.error).toHaveBeenCalledWith(
      expect.any(TypeError),
      expect.objectContaining({ source: "react-query", kind: "query" }),
    );
  });

  it("reports a failed mutation", async () => {
    attachQueryErrorReporting(queryClient, rollbar);

    await runMutation(transportFailure);

    expect(rollbar.error).toHaveBeenCalledWith(
      expect.any(TypeError),
      expect.objectContaining({ kind: "mutation", mutationKey: ["subject"] }),
    );
  });

  it.each([400, 401, 403, 404, 409])(
    "leaves a %i to the UI, which already surfaces it",
    async (status) => {
      attachQueryErrorReporting(queryClient, rollbar);

      await runQuery(httpFailure(status));

      expect(rollbar.error).not.toHaveBeenCalled();
    },
  );

  it("leaves a 500 to the server, which reports it with a real stack trace", async () => {
    attachQueryErrorReporting(queryClient, rollbar);

    await runQuery(httpFailure(500));

    expect(rollbar.error).not.toHaveBeenCalled();
  });

  it("stops reporting once unsubscribed", async () => {
    const unsubscribe = attachQueryErrorReporting(queryClient, rollbar);
    unsubscribe();

    await runQuery(transportFailure);

    expect(rollbar.error).not.toHaveBeenCalled();
  });
});
