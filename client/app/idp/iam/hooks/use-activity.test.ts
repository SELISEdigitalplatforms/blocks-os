import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { userService } from "@blocks-idp/iam/services/user.service";
import { useGetSessions, useGetHistories, useGetPats, useGeneratePats } from "./use-activity";

vi.mock("@blocks-idp/iam/services/user.service", () => ({
  userService: {
    getSessions: vi.fn(),
    getHistories: vi.fn(),
    getPats: vi.fn(),
    generatePats: vi.fn(),
  },
}));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ toast: (...args: unknown[]) => toast(...args) }));

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

  it("useGetPats sorts tokens newest-first", async () => {
    vi.mocked(userService.getPats).mockResolvedValue([
      { createdDate: "2026-01-01" },
      { createdDate: "2026-03-01" },
      { createdDate: "2026-02-01" },
    ] as never);
    const { result } = renderHook(() => useGetPats(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((p) => p.createdDate)).toEqual([
      "2026-03-01",
      "2026-02-01",
      "2026-01-01",
    ]);
  });

  it("useGetPats returns an empty array for non-array data", async () => {
    vi.mocked(userService.getPats).mockResolvedValue(null as never);
    const { result } = renderHook(() => useGetPats(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("useGeneratePats shows a success toast on success", async () => {
    vi.mocked(userService.generatePats).mockResolvedValue({} as never);
    const { result } = renderHook(() => useGeneratePats(), { wrapper: createWrapper() });
    await result.current.mutateAsync({} as never);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      ),
    );
  });

  it("useGeneratePats shows an error toast on failure", async () => {
    vi.mocked(userService.generatePats).mockRejectedValue(new Error("fail"));
    const { result } = renderHook(() => useGeneratePats(), { wrapper: createWrapper() });
    await expect(result.current.mutateAsync({} as never)).rejects.toThrow("fail");
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });
});
