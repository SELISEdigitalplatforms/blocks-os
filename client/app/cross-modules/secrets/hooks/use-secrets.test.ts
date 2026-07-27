import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { secretsService } from "@/services/secrets.service";
import { showSuccessToast, showErrorToast } from "@/hooks/use-toast";
import { useGetSecrets, useGetSecret, useSaveSecret, useDeleteSecret } from "./use-secrets";

vi.mock("@seliseblocks/blocks-kit", () => mockProjectStoreFactory());
vi.mock("@/services/secrets.service", () => ({
  secretsService: {
    gets: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

describe("use-secrets hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetSecrets", () => {
    it("fetches secrets for the given key", async () => {
      vi.mocked(secretsService.gets).mockResolvedValue([{ itemId: "s-1" }] as never);
      const { result } = renderHook(() => useGetSecrets("captcha"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(secretsService.gets).toHaveBeenCalledWith("captcha");
      expect(result.current.data).toEqual([{ itemId: "s-1" }]);
    });

    it("is disabled when no secret key is provided", () => {
      const { result } = renderHook(() => useGetSecrets(""), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe("idle");
      expect(secretsService.gets).not.toHaveBeenCalled();
    });
  });

  describe("useGetSecret", () => {
    it("fetches a single secret by id", async () => {
      vi.mocked(secretsService.get).mockResolvedValue({ itemId: "s-1" } as never);
      const { result } = renderHook(() => useGetSecret("s-1"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(secretsService.get).toHaveBeenCalledWith("s-1");
    });

    it("is disabled without an itemId", () => {
      const { result } = renderHook(() => useGetSecret(""), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useSaveSecret", () => {
    it("saves and shows a success toast", async () => {
      vi.mocked(secretsService.save).mockResolvedValue({ itemId: "s-1" } as never);
      const { result } = renderHook(() => useSaveSecret(), {
        wrapper: createWrapper(),
      });
      await result.current.mutateAsync({ secretKey: "captcha", keyValuePairs: {} });
      expect(secretsService.save).toHaveBeenCalled();
      expect(showSuccessToast).toHaveBeenCalledWith({
        description: "Secret saved successfully.",
      });
    });

    it("shows an error toast on failure", async () => {
      vi.mocked(secretsService.save).mockRejectedValue(new Error("nope"));
      const { result } = renderHook(() => useSaveSecret(), {
        wrapper: createWrapper(),
      });
      await expect(
        result.current.mutateAsync({ secretKey: "captcha", keyValuePairs: {} }),
      ).rejects.toThrow("nope");
      await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    });
  });

  describe("useDeleteSecret", () => {
    it("deletes and shows a success toast", async () => {
      vi.mocked(secretsService.delete).mockResolvedValue(undefined as never);
      const { result } = renderHook(() => useDeleteSecret(), {
        wrapper: createWrapper(),
      });
      await result.current.mutateAsync("s-1");
      expect(secretsService.delete).toHaveBeenCalledWith("s-1");
      expect(showSuccessToast).toHaveBeenCalledWith({
        description: "Secret deleted successfully.",
      });
    });
  });
});
