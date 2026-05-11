import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { mockAuthServiceFactory } from "../../test-utils/__mocks__";
import { authService } from "@blocks-idp/authentication/services/auth.service";
import { useLogout } from "./use-auth";

vi.mock("@blocks-idp/authentication/services/auth.service", () => mockAuthServiceFactory());

describe("use-auth hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("useLogout", () => {
    it("should call authService.logout", async () => {
      vi.mocked(authService.logout).mockResolvedValue(undefined);
      const { result } = renderHook(() => useLogout(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(undefined);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(authService.logout).toHaveBeenCalled();
    });
  });
});
