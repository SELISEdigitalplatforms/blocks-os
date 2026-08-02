import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { identityProviderService } from "@blocks-idp/authentication/services/identity-provider.service";
import {
  useGetIdentityProviders,
  useGetIdentityProviderById,
  useCreateIdentityProvider,
  useUpdateIdentityProvider,
  useUpdateIdentityProviderStatus,
  useDeleteIdentityProvider,
} from "./use-identity-provider";

vi.mock("@blocks-idp/authentication/services/identity-provider.service", () => ({
  identityProviderService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("use-identity-provider hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetIdentityProviders fetches all providers", async () => {
    vi.mocked(identityProviderService.getAll).mockResolvedValue([] as never);
    const { result } = renderHook(() => useGetIdentityProviders({ projectId: "proj-1" }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(identityProviderService.getAll).toHaveBeenCalled();
  });

  it("useGetIdentityProviders is disabled without a projectId", () => {
    const { result } = renderHook(() => useGetIdentityProviders({ projectId: "" }), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(identityProviderService.getAll).not.toHaveBeenCalled();
  });

  it("useGetIdentityProviderById is disabled without an id", () => {
    const { result } = renderHook(() => useGetIdentityProviderById(""), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetIdentityProviderById fetches by id", async () => {
    vi.mocked(identityProviderService.getById).mockResolvedValue({} as never);
    const { result } = renderHook(() => useGetIdentityProviderById("p-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(identityProviderService.getById).toHaveBeenCalledWith("p-1");
  });

  it("useCreateIdentityProvider creates a provider", async () => {
    vi.mocked(identityProviderService.create).mockResolvedValue({} as never);
    const { result } = renderHook(() => useCreateIdentityProvider(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({ name: "p" } as never);
    expect(identityProviderService.create).toHaveBeenCalled();
  });

  it("useUpdateIdentityProvider updates by id", async () => {
    vi.mocked(identityProviderService.update).mockResolvedValue({} as never);
    const { result } = renderHook(() => useUpdateIdentityProvider(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({ id: "p-1", provider: {} as never });
    expect(identityProviderService.update).toHaveBeenCalledWith("p-1", {});
  });

  it("useUpdateIdentityProviderStatus updates status", async () => {
    vi.mocked(identityProviderService.updateStatus).mockResolvedValue({} as never);
    const { result } = renderHook(() => useUpdateIdentityProviderStatus(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({ id: "p-1", request: {} as never });
    expect(identityProviderService.updateStatus).toHaveBeenCalledWith("p-1", {});
  });

  it("useDeleteIdentityProvider deletes by id", async () => {
    vi.mocked(identityProviderService.delete).mockResolvedValue({} as never);
    const { result } = renderHook(() => useDeleteIdentityProvider(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync("p-1");
    expect(vi.mocked(identityProviderService.delete).mock.calls[0][0]).toBe("p-1");
  });
});
