import { QueryClient, hashKey } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const impersonateState = {
  isImpersonated: false,
  impersonatedTenantId: null as string | null,
  originalTenantId: null as string | null,
};

vi.mock("@seliseblocks/genesis-os/store", () => ({
  useImpersonateStore: { getState: () => impersonateState },
}));

import {
  getEffectiveTenantId,
  isForeignTenantQuery,
  isTenantAgnosticQueryKey,
  tenantScopedQueryKeyHashFn,
} from "./tenant-query-scope";

const impersonate = (tenantId: string | null) => {
  impersonateState.isImpersonated = tenantId !== null;
  impersonateState.impersonatedTenantId = tenantId;
};

const ROLES_KEY = [
  "roles",
  { page: 0, pageSize: 10, filter: { search: "" }, organizationId: "default" },
];

describe("tenant query scope", () => {
  beforeEach(() => {
    impersonateState.isImpersonated = false;
    impersonateState.impersonatedTenantId = null;
    impersonateState.originalTenantId = "console-tenant";
  });

  it("reads the effective tenant from the impersonated one while impersonating", () => {
    expect(getEffectiveTenantId()).toBe("console-tenant");
    impersonate("tenant-a");
    expect(getEffectiveTenantId()).toBe("tenant-a");
  });

  it("falls back to an empty scope before the impersonation status resolves", () => {
    impersonateState.originalTenantId = null;
    expect(getEffectiveTenantId()).toBe("");
  });

  // The regression this whole module exists for: identical keys, different projects.
  it("hashes the same key differently per tenant", () => {
    impersonate("tenant-a");
    const a = tenantScopedQueryKeyHashFn(ROLES_KEY);
    impersonate("tenant-b");
    const b = tenantScopedQueryKeyHashFn(ROLES_KEY);

    expect(a).not.toBe(b);
    impersonate("tenant-a");
    expect(tenantScopedQueryKeyHashFn(ROLES_KEY)).toBe(a);
  });

  it("leaves the impersonation status key unscoped, so it cannot re-key itself", () => {
    const key = ["blocks-kit-impersonation", "status"];
    expect(isTenantAgnosticQueryKey(key)).toBe(true);

    impersonate("tenant-a");
    const a = tenantScopedQueryKeyHashFn(key);
    impersonate("tenant-b");

    expect(tenantScopedQueryKeyHashFn(key)).toBe(a);
    expect(a).toBe(hashKey(key));
  });

  it("does not serve one project's cached data to another", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { queryKeyHashFn: tenantScopedQueryKeyHashFn } },
    });

    impersonate("tenant-a");
    queryClient.setQueryData(ROLES_KEY, { data: [{ slug: "my_manager" }] });
    expect(queryClient.getQueryData(ROLES_KEY)).toBeDefined();

    impersonate("tenant-b");
    expect(queryClient.getQueryData(ROLES_KEY)).toBeUndefined();

    impersonate("tenant-a");
    expect(queryClient.getQueryData(ROLES_KEY)).toBeDefined();
  });

  it("keeps prefix invalidation working across the partition", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { queryKeyHashFn: tenantScopedQueryKeyHashFn } },
    });
    impersonate("tenant-a");
    queryClient.setQueryData(ROLES_KEY, { data: [] });

    expect(queryClient.getQueryCache().findAll({ queryKey: ["roles"] })).toHaveLength(1);
  });

  it("selects only other tenants' entries for cancellation", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { queryKeyHashFn: tenantScopedQueryKeyHashFn } },
    });

    impersonate("tenant-a");
    queryClient.setQueryData(ROLES_KEY, { data: [] });
    queryClient.setQueryData(["blocks-kit-impersonation", "status"], { impersonated: true });
    impersonate("tenant-b");
    queryClient.setQueryData(ROLES_KEY, { data: [] });

    const foreign = queryClient.getQueryCache().getAll().filter(isForeignTenantQuery);

    expect(foreign).toHaveLength(1);
    expect(foreign[0].queryHash).toContain("tenant-a");
  });
});
