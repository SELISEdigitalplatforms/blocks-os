import { QueryClient, QueryClientProvider, type Query } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal stand-in for the package's zustand store: a module-level value plus subscribers, so a
// tenant switch re-renders the boundary the same way the real store does.
const h = vi.hoisted(() => {
  const state = {
    isImpersonated: false,
    impersonatedTenantId: null as string | null,
    originalTenantId: "console-tenant" as string | null,
  };
  const listeners = new Set<() => void>();
  return {
    state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: () => listeners.forEach((listener) => listener()),
  };
});

vi.mock("@seliseblocks/genesis-os/store", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useImpersonateStore: Object.assign(
      (selector: (state: typeof h.state) => unknown) =>
        useSyncExternalStore(
          h.subscribe,
          () => selector(h.state),
          () => selector(h.state),
        ),
      { getState: () => h.state },
    ),
  };
});

import { tenantScopedQueryKeyHashFn } from "@/lib/query/tenant-query-scope";
import { TenantCacheBoundary } from "./tenant-cache-boundary";

const impersonate = (tenantId: string) => {
  h.state.isImpersonated = true;
  h.state.impersonatedTenantId = tenantId;
  act(() => h.emit());
};

const renderBoundary = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { queryKeyHashFn: tenantScopedQueryKeyHashFn } },
  });
  const cancelQueries = vi.spyOn(queryClient, "cancelQueries").mockResolvedValue();
  render(
    <QueryClientProvider client={queryClient}>
      <TenantCacheBoundary />
    </QueryClientProvider>,
  );
  return { queryClient, cancelQueries };
};

describe("TenantCacheBoundary", () => {
  beforeEach(() => {
    h.state.isImpersonated = false;
    h.state.impersonatedTenantId = null;
    h.state.originalTenantId = "console-tenant";
  });

  it("does not cancel anything on mount", () => {
    const { cancelQueries } = renderBoundary();
    expect(cancelQueries).not.toHaveBeenCalled();
  });

  it("cancels in-flight work from the project we left, and nothing else", () => {
    const { queryClient, cancelQueries } = renderBoundary();

    impersonate("tenant-a");
    queryClient.setQueryData(["roles", { page: 0 }], { data: [] });
    queryClient.setQueryData(["blocks-kit-impersonation", "status"], { impersonated: true });

    impersonate("tenant-b");
    queryClient.setQueryData(["roles", { page: 0 }], { data: [] });

    expect(cancelQueries).toHaveBeenCalledTimes(2);
    const { predicate } = cancelQueries.mock.calls.at(-1)?.[0] as {
      predicate: (query: Query) => boolean;
    };
    const cancelled = queryClient.getQueryCache().getAll().filter(predicate);

    // The entry left behind by tenant-a -- not tenant-b's fresh fetch, and not the
    // impersonation status that decides the scope in the first place.
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].queryHash).toContain("tenant-a");
  });
});
