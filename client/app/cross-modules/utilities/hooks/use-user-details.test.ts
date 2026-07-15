import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { userService } from "@blocks-idp/iam/services/user.service";
import { useGetCreator } from "./use-user-details";

vi.mock("@blocks-idp/iam/services/user.service", () => ({
  userService: {
    getUser: vi.fn(),
    getUserById: vi.fn(),
  },
}));

const mockAuthState: { user: { itemId: string } | undefined } = { user: undefined };
vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: vi.fn(() => mockAuthState),
}));

describe("useGetCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = undefined;
  });
  afterEach(() => vi.clearAllMocks());

  it("fetches the current user when createdBy matches the logged-in user", async () => {
    mockAuthState.user = { itemId: "u1" };
    vi.mocked(userService.getUser).mockResolvedValue({ data: { itemId: "u1" } } as never);

    const { result } = renderHook(() => useGetCreator("u1", "tenant-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(userService.getUser).toHaveBeenCalled();
    expect(userService.getUserById).not.toHaveBeenCalled();
  });

  it("fetches by id when createdBy is a different user", async () => {
    mockAuthState.user = { itemId: "u1" };
    vi.mocked(userService.getUserById).mockResolvedValue({ data: { itemId: "u2" } } as never);

    const { result } = renderHook(() => useGetCreator("u2", "tenant-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(userService.getUserById).toHaveBeenCalledWith({ id: "u2", projectKey: "tenant-1" });
    expect(userService.getUser).not.toHaveBeenCalled();
  });

  it("is disabled when createdBy is missing", () => {
    mockAuthState.user = { itemId: "u1" };
    const { result } = renderHook(() => useGetCreator(null, "tenant-1"), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(userService.getUser).not.toHaveBeenCalled();
    expect(userService.getUserById).not.toHaveBeenCalled();
  });
});
