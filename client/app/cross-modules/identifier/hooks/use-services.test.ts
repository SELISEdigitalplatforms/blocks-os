import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { serviceRegistryService } from "@blocks-identifier/services/service-registery.service";
import { useRegisterService, useGetAllServices } from "./use-services";

vi.mock("@blocks-identifier/services/service-registery.service", () => ({
  serviceRegistryService: {
    registerService: vi.fn(),
    getAllServices: vi.fn(),
  },
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
