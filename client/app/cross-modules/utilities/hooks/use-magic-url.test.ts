import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { magicUrlService } from "@blocks-utilities/services/magic-url.service";
import {
  useGetMagicUrls,
  useGetMagicUrlById,
  useCreateMagicUrl,
  useRemoveMagicUrl,
} from "./use-magic-url";

vi.mock("@blocks-utilities/services/magic-url.service", () => ({
  magicUrlService: {
    getMagicUrls: vi.fn(),
    getMagicUrl: vi.fn(),
    createMagicUrl: vi.fn(),
    deactivateMagicLinks: vi.fn(),
  },
}));

describe("use-magic-url hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetMagicUrls is disabled without a project key", () => {
    const { result } = renderHook(() => useGetMagicUrls({ projectKey: "" } as never), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetMagicUrls fetches with a project key", async () => {
    vi.mocked(magicUrlService.getMagicUrls).mockResolvedValue({
      data: [],
      errors: [],
      totalCount: 0,
    });
    const option = { projectKey: "pk", page: 1, pageSize: 10 } as never;
    const { result } = renderHook(() => useGetMagicUrls(option), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(magicUrlService.getMagicUrls).toHaveBeenCalledWith(option);
  });

  it("useGetMagicUrlById requires both ItemId and projectKey", () => {
    const { result } = renderHook(
      () => useGetMagicUrlById({ ItemId: "m-1", projectKey: "" } as never),
      { wrapper: createWrapper() },
    );
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetMagicUrlById fetches a single url", async () => {
    vi.mocked(magicUrlService.getMagicUrl).mockResolvedValue({ itemId: "m-1" } as never);
    const { result } = renderHook(
      () => useGetMagicUrlById({ ItemId: "m-1", projectKey: "pk" } as never),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(magicUrlService.getMagicUrl).toHaveBeenCalled();
  });

  it("useCreateMagicUrl creates a url", async () => {
    vi.mocked(magicUrlService.createMagicUrl).mockResolvedValue({} as never);
    const { result } = renderHook(() => useCreateMagicUrl(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({ name: "x" } as never);
    expect(magicUrlService.createMagicUrl).toHaveBeenCalled();
  });

  it("useRemoveMagicUrl deactivates links", async () => {
    vi.mocked(magicUrlService.deactivateMagicLinks).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRemoveMagicUrl(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({ linkIds: ["a"], projectKey: "pk" });
    expect(magicUrlService.deactivateMagicLinks).toHaveBeenCalledWith({
      linkIds: ["a"],
      projectKey: "pk",
    });
  });
});
