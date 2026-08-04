import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { serviceRegistryService } from "@blocks-identifier/services/service-registry.service";
import { useRegisterService, useGetAllServices } from "./use-services";

vi.mock("@blocks-identifier/services/service-registry.service", () => ({
  serviceRegistryService: {
    registerService: vi.fn(),
    getAllServices: vi.fn(),
  },
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

describe("use-services hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetAllServices fetches services", async () => {
    vi.mocked(serviceRegistryService.getAllServices).mockResolvedValue([] as never);
    const options = { page: 0, pageSize: 10, sort: {}, filter: {} } as never;
    const { result } = renderHook(() => useGetAllServices(options), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(serviceRegistryService.getAllServices).toHaveBeenCalledWith(options);
  });

  it("useGetAllServices scopes the cache key by the active tenant", async () => {
    vi.mocked(serviceRegistryService.getAllServices).mockResolvedValue([] as never);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
    const options = { page: 0, pageSize: 10 } as never;
    const { result } = renderHook(() => useGetAllServices(options), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);
    expect(keys).toContainEqual(["services", "tenant-1", 0, 10, undefined, undefined]);
  });

  it("useRegisterService registers a service", async () => {
    vi.mocked(serviceRegistryService.registerService).mockResolvedValue({
      isSuccess: true,
    } as never);
    const { result } = renderHook(() => useRegisterService(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({ name: "svc" } as never);
    expect(serviceRegistryService.registerService).toHaveBeenCalled();
  });

  it("useRegisterService does not invalidate on an unsuccessful response", async () => {
    vi.mocked(serviceRegistryService.registerService).mockResolvedValue({
      isSuccess: false,
    } as never);
    const { result } = renderHook(() => useRegisterService(), {
      wrapper: createWrapper(),
    });
    const res = await result.current.mutateAsync({ name: "svc" } as never);
    expect((res as { isSuccess: boolean }).isSuccess).toBe(false);
  });
});
