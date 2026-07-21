import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { magicUrlConfigService } from "@blocks-utilities/services/magic-url-config.service";
import {
  magicUrlConfigsQueryKey,
  useGetMagicUrlConfigs,
  useSaveMagicUrlConfig,
  useDeleteMagicUrlConfig,
} from "./use-magic-url-config";

vi.mock("@blocks-utilities/services/magic-url-config.service", () => ({
  magicUrlConfigService: {
    getMagicUrlConfigs: vi.fn(),
    saveMagicUrlConfig: vi.fn(),
    deleteMagicUrlConfig: vi.fn(),
  },
}));

describe("use-magic-url-config hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("magicUrlConfigsQueryKey", () => {
    it("builds a stable key with a default empty search text", () => {
      expect(
        magicUrlConfigsQueryKey({ projectKey: "pk", page: 1, pageSize: 10 } as never),
      ).toEqual(["magic-url-configs", "pk", 1, 10, ""]);
    });
  });

  it("useGetMagicUrlConfigs is disabled without a project key", () => {
    const { result } = renderHook(
      () => useGetMagicUrlConfigs({ projectKey: "" } as never),
      { wrapper: createWrapper() },
    );
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetMagicUrlConfigs respects an explicit disabled flag", () => {
    const { result } = renderHook(
      () => useGetMagicUrlConfigs({ projectKey: "pk" } as never, { enabled: false }),
      { wrapper: createWrapper() },
    );
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetMagicUrlConfigs fetches configs", async () => {
    vi.mocked(magicUrlConfigService.getMagicUrlConfigs).mockResolvedValue({} as never);
    const { result } = renderHook(
      () => useGetMagicUrlConfigs({ projectKey: "pk", page: 1, pageSize: 10 } as never),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(magicUrlConfigService.getMagicUrlConfigs).toHaveBeenCalled();
  });

  it("useSaveMagicUrlConfig saves a config", async () => {
    vi.mocked(magicUrlConfigService.saveMagicUrlConfig).mockResolvedValue({} as never);
    const { result } = renderHook(() => useSaveMagicUrlConfig(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({} as never);
    expect(magicUrlConfigService.saveMagicUrlConfig).toHaveBeenCalled();
  });

  it("useDeleteMagicUrlConfig deletes by id", async () => {
    vi.mocked(magicUrlConfigService.deleteMagicUrlConfig).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteMagicUrlConfig(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync("c-1");
    expect(vi.mocked(magicUrlConfigService.deleteMagicUrlConfig).mock.calls[0][0]).toBe(
      "c-1",
    );
  });
});
