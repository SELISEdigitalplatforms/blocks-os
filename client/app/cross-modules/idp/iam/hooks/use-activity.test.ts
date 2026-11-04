import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { userService } from "@blocks-idp/iam/services/user.service";
import { useGetSessions, useGetHistories } from "./use-activity";

vi.mock("@blocks-idp/iam/services/user.service", () => ({
  userService: {
    getSessions: vi.fn(),
    getHistories: vi.fn(),
  },
}));

describe("use-activity hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetSessions fetches sessions", async () => {
    vi.mocked(userService.getSessions).mockResolvedValue([] as never);
    const { result } = renderHook(() => useGetSessions({} as never), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(userService.getSessions).toHaveBeenCalled();
  });

  it("useGetHistories fetches histories", async () => {
    vi.mocked(userService.getHistories).mockResolvedValue([] as never);
    const { result } = renderHook(() => useGetHistories({} as never), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(userService.getHistories).toHaveBeenCalled();
  });
});
